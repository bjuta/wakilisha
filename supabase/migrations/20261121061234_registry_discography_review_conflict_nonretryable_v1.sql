-- Reviewed Registry Artist identity conflicts are permanent review gates,
-- not PostgreSQL serialization failures. A false 40001 causes PostgREST 14
-- to retry until gateway timeout. Preserve fail-closed Artist reconciliation.
-- No historical evidence, Artist, Release, or Track data is modified.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

do $preflight$
declare v_definition text;
begin
  v_definition:=pg_get_functiondef(to_regprocedure(
    'platform_private.registry_discography_release_artist_desired_v1(uuid,uuid,jsonb,jsonb)'
  ));
  if v_definition is null
     or (select md5(btrim(prosrc, chr(10)||chr(13)||chr(9)||' '))
         from pg_proc where oid=to_regprocedure(
           'platform_private.registry_discography_release_artist_desired_v1(uuid,uuid,jsonb,jsonb)'
         )) is distinct from '3ef7e6549ae2f73540aca017ef478ce3'
     or position('Unresolved provider Artist identity collides with an existing credited-name identity; review is required.' in v_definition)=0
     or position('Reviewed co-primary Artist changed before plan freeze.' in v_definition)=0
     or position('errcode=''40001''' in v_definition)=0
  then
    raise exception 'Discography review-conflict SQL authority drifted';
  end if;
end
$preflight$;

create or replace function
platform_private.registry_discography_release_artist_desired_v1(
  p_release_id uuid,
  p_artist_id uuid,
  p_album jsonb,
  p_additional_primary_artists jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private
as $$
declare
  v_artist public.registry_artists%rowtype;
  v_result jsonb:='[]'::jsonb;
  v_seen_slugs text[]:=array[]::text[];
  v_current_primary boolean;
  v_additional jsonb;
  v_related jsonb;
  v_related_name text;
  v_related_provider_id text;
  v_credit jsonb;
  v_resolved_artist public.registry_artists%rowtype;
  v_slug text;
  v_order integer:=2;
  v_related_order integer:=99;
begin
  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id=p_artist_id
    and artist.status<>'archived';

  if not found then
    raise exception using errcode='P0002',
      message='Discography Artist is missing.';
  end if;

  v_current_primary :=
    platform_private.registry_discography_credit_includes_artist_v1(
      p_album->>'album_artist_name',
      v_artist.display_name
    );

  v_result:=v_result||jsonb_build_array(
    jsonb_build_object(
      'release_id',p_release_id,
      'artist_id',v_artist.id,
      'artist_slug',v_artist.slug,
      'artist_name_text',v_artist.display_name,
      'role',case when v_current_primary then 'primary_artist' else 'featured_artist' end,
      'is_primary',v_current_primary,
      'is_featured',not v_current_primary,
      'credit_order',case when v_current_primary then 1 else 98 end,
      'display_credit',null,
      'source','apple_music_ingest',
      'confidence',case when v_current_primary then 90 else 70 end,
      'status','active',
      'metadata',case
        when v_current_primary then
          jsonb_build_object('apple_music_album_id',p_album->>'apple_music_id')
        else
          jsonb_build_object(
            'apple_music_album_id',p_album->>'apple_music_id',
            'ingested_artist_is_featured',true
          )
      end
    )
  );
  v_seen_slugs:=array_append(v_seen_slugs,v_artist.slug);

  for v_additional in
    select value
    from jsonb_array_elements(
      coalesce(p_additional_primary_artists,'[]'::jsonb)
    )
    order by value->>'artist_id'
  loop
    select artist.*
    into v_resolved_artist
    from public.registry_artists artist
    where artist.id=(v_additional->>'artist_id')::uuid
      and artist.status<>'archived';

    if not found
       or v_resolved_artist.slug is distinct from v_additional->>'artist_slug'
       or v_resolved_artist.display_name is distinct from v_additional->>'artist_name'
    then
      raise exception using errcode='PT409',
        message='Reviewed co-primary Artist changed before plan freeze; review is required.';
    end if;

    if array_position(v_seen_slugs,v_resolved_artist.slug) is null then
      v_result:=v_result||jsonb_build_array(
        jsonb_build_object(
          'release_id',p_release_id,
          'artist_id',v_resolved_artist.id,
          'artist_slug',v_resolved_artist.slug,
          'artist_name_text',v_resolved_artist.display_name,
          'role','primary_artist',
          'is_primary',true,
          'is_featured',false,
          'credit_order',v_order,
          'display_credit',null,
          'source','apple_music_ingest',
          'confidence',90,
          'status','active',
          'metadata',jsonb_build_object(
            'apple_music_album_id',p_album->>'apple_music_id',
            'admin_selected',true
          )
        )
      );
      v_seen_slugs:=array_append(v_seen_slugs,v_resolved_artist.slug);
      v_order:=v_order+1;
    end if;
  end loop;

  for v_related in
    select value
    from jsonb_array_elements(
      coalesce(p_album->'related_artists','[]'::jsonb)
    )
    order by value->>'name',value->>'apple_music_artist_id'
  loop
    v_related_name:=nullif(btrim(v_related->>'name'),'');
    if v_related_name is null then
      continue;
    end if;

    v_related_provider_id:=
      nullif(btrim(v_related->>'apple_music_artist_id'),'');

    if v_related_provider_id is not null then
      v_credit:=
        platform_private.registry_discography_resolve_artist_provider_credit_v1(
          'apple_music',
          v_related_provider_id,
          v_related_name
        );
    else
      v_credit:=
        platform_private.registry_discography_resolve_artist_credit_v1(
          v_related_name
        );
    end if;

    v_slug:=v_credit->>'artist_slug';

    if nullif(v_slug,'') is null then
      raise exception using errcode='22023',
        message='Provider Release credit cannot be normalized to credited-name identity.';
    end if;

    if array_position(v_seen_slugs,v_slug) is not null then
      if v_related_provider_id is not null
         and nullif(v_credit->>'artist_id','') is null
      then
        raise exception using errcode='PT409',
          message=
            'Unresolved provider Artist identity collides with an existing credited-name identity; review is required.';
      end if;
      continue;
    end if;

    v_result:=v_result||jsonb_build_array(
      jsonb_build_object(
        'release_id',p_release_id,
        'artist_id',nullif(v_credit->>'artist_id','')::uuid,
        'artist_slug',v_slug,
        'artist_name_text',v_credit->>'artist_name_text',
        'role','featured_artist',
        'is_primary',false,
        'is_featured',true,
        'credit_order',v_related_order,
        'display_credit',nullif(v_credit->>'display_credit',''),
        'source','apple_music_ingest',
        'confidence',case
          when v_credit->>'resolved_by'='provider_identity' then 100
          when nullif(v_credit->>'artist_id','') is null then 50
          else 85
        end,
        'status','active',
        'metadata',jsonb_build_object(
          'apple_music_album_id',p_album->>'apple_music_id',
          'apple_music_artist_id',v_related_provider_id,
          'resolved_by',v_credit->>'resolved_by'
        )
      )
    );

    v_seen_slugs:=array_append(v_seen_slugs,v_slug);
    v_related_order:=v_related_order+1;
  end loop;

  return v_result;
end
$$;

do $verify$
declare v_definition text;
  v_count integer;
begin
  v_definition:=pg_get_functiondef(to_regprocedure(
    'platform_private.registry_discography_release_artist_desired_v1(uuid,uuid,jsonb,jsonb)'
  ));
  v_count:=(length(v_definition)-length(replace(v_definition,'errcode=''PT409''','')))/length('errcode=''PT409''');
  if v_definition is null
     or v_count<>2
     or position('errcode=''40001''' in v_definition)>0
  then
    raise exception 'Non-retryable Discography review-conflict verifier failed';
  end if;
end
$verify$;
commit;
