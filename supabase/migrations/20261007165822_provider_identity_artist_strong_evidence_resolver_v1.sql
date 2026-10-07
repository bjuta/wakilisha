-- Provider Identity Slice 5A candidate.
-- Canonical migration filename minted with Supabase CLI 2.107.0:
--   20261007165822_provider_identity_artist_strong_evidence_resolver_v1.sql
--
-- Converges only Discography related-Artist identity policy when an exact
-- provider Artist object ID is present. Name/alias credit semantics remain
-- available for genuinely name-only provider credits.
-- No historical data rewrite.

begin;
set local statement_timeout='180s';
set local lock_timeout='5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'provider-identity-artist-strong-evidence-resolver-v1',
    0
  )
);

do $preflight$
begin
  if to_regprocedure(
       'platform_private.registry_discography_resolve_artist_credit_v1(text)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_discography_release_artist_desired_v1(uuid,uuid,jsonb,jsonb)'
     ) is null
     or to_regprocedure(
       'public.resolve_registry_identity_lineage_v1(text,uuid,integer)'
     ) is null
     or to_regclass('public.registry_external_identifier_assertions') is null
     or to_regprocedure(
       'platform_private.registry_discography_resolve_artist_provider_credit_v1(text,text,text)'
     ) is not null
  then
    raise exception
      'Provider Identity Artist resolver preflight failed: required authority is missing or candidate already exists.';
  end if;
end
$preflight$;

create function
platform_private.registry_discography_resolve_artist_provider_credit_v1(
  p_provider_key text,
  p_provider_artist_id text,
  p_artist_name text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private
as $$
declare
  v_provider_key text:=lower(nullif(btrim(p_provider_key),''));
  v_provider_artist_id text:=nullif(btrim(p_provider_artist_id),'');
  v_name text:=nullif(btrim(p_artist_name),'');
  v_normalized text;
  v_slug text;
  v_source_ids uuid[]:='{}'::uuid[];
  v_current_ids uuid[]:='{}'::uuid[];
  v_source_id uuid;
  v_current_id uuid;
  v_lineage jsonb;
  v_lineage_status text;
  v_source_has_current boolean;
  v_artist public.registry_artists%rowtype;
  v_display_credit text;
begin
  if v_provider_key is null
     or v_provider_artist_id is null
     or v_name is null
  then
    raise exception using errcode='22023',
      message='Provider Artist credit resolution requires provider, provider Artist ID, and credited name.';
  end if;

  if v_provider_key<>'apple_music' then
    raise exception using errcode='22023',
      message='Discography provider Artist credit resolution currently supports Apple Music only.';
  end if;

  v_normalized:=
    platform_private.registry_identity_normalize_text_v1(v_name);
  v_slug:=public.wk_slugify_text(v_normalized);

  select coalesce(
    array_agg(candidate.artist_id order by candidate.artist_id),
    '{}'::uuid[]
  )
  into v_source_ids
  from (
    select distinct artist.id as artist_id
    from public.registry_artists artist
    where nullif(
            btrim(artist.metadata->>'apple_music_id'),
            ''
          )=v_provider_artist_id

    union

    select distinct assertion.artist_id
    from public.registry_external_identifier_assertions assertion
    where assertion.artist_id is not null
      and assertion.assertion_status='accepted'
      and assertion.valid_to is null
      and assertion.issuer_namespace is null
      and assertion.scheme_key='apple_music'
      and assertion.comparison_value=v_provider_artist_id
  ) candidate;

  if cardinality(v_source_ids)=0 then
    return jsonb_build_object(
      'artist_id',null,
      'artist_slug',v_slug,
      'artist_name_text',v_name,
      'display_credit',null,
      'resolved_by','provider_unresolved',
      'provider_key',v_provider_key,
      'provider_artist_id',v_provider_artist_id
    );
  end if;

  foreach v_source_id in array v_source_ids
  loop
    v_lineage:=public.resolve_registry_identity_lineage_v1(
      'artist',
      v_source_id,
      16
    );
    v_lineage_status:=v_lineage->>'resolution_status';

    if v_lineage_status not in ('current','successor') then
      raise exception using errcode='40001',
        message=
          'Strong Artist identity is not one unambiguous current Registry Artist; review is required.';
    end if;

    v_source_has_current:=false;

    for v_current_id in
      select value::uuid
      from jsonb_array_elements_text(
        coalesce(v_lineage->'current_entity_ids','[]'::jsonb)
      ) value
      order by value
    loop
      perform 1
      from public.registry_artists artist
      where artist.id=v_current_id
        and artist.status<>'archived';

      if found then
        v_source_has_current:=true;

        if array_position(v_current_ids,v_current_id) is null then
          v_current_ids:=array_append(v_current_ids,v_current_id);
        end if;
      end if;
    end loop;

    if not v_source_has_current then
      raise exception using errcode='40001',
        message=
          'Strong Artist identity resolves only to archived or missing Registry state; review is required.';
    end if;
  end loop;

  if cardinality(v_current_ids)<>1 then
    raise exception using errcode='40001',
      message=
        'Strong Artist identity resolves to multiple current Registry Artists; review is required.';
  end if;

  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id=v_current_ids[1]
    and artist.status<>'archived';

  if not found then
    raise exception using errcode='40001',
      message='Resolved strong Artist identity disappeared before credit freeze.';
  end if;

  if v_normalized is distinct from v_artist.normalized_name
     or v_slug is distinct from v_artist.slug
  then
    v_display_credit:=v_name;
  else
    v_display_credit:=null;
  end if;

  return jsonb_build_object(
    'artist_id',v_artist.id,
    'artist_slug',v_artist.slug,
    'artist_name_text',v_artist.display_name,
    'display_credit',v_display_credit,
    'resolved_by','provider_identity',
    'provider_key',v_provider_key,
    'provider_artist_id',v_provider_artist_id
  );
end
$$;

revoke all on function
  platform_private.registry_discography_resolve_artist_provider_credit_v1(text,text,text)
from public,anon,authenticated,service_role;

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
      raise exception using errcode='40001',
        message='Reviewed co-primary Artist changed before plan freeze.';
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
        raise exception using errcode='40001',
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
declare
  v_definition text;
  v_role text;
begin
  select regexp_replace(
    lower(
      pg_get_functiondef(
        'platform_private.registry_discography_resolve_artist_provider_credit_v1(text,text,text)'::regprocedure
      )
    ),
    '[[:space:]]+',
    ' ',
    'g'
  )
  into v_definition;

  if position('apple_music_id' in v_definition)=0
     or position('registry_external_identifier_assertions' in v_definition)=0
     or position('resolve_registry_identity_lineage_v1' in v_definition)=0
     or position('assertion_status=''accepted''' in v_definition)=0
     or position('provider_unresolved' in v_definition)=0
     or position('provider_identity' in v_definition)=0
  then
    raise exception
      'Provider Identity Artist resolver lost required strong-evidence authority.';
  end if;

  if position('registry_discography_resolve_artist_name_v1' in v_definition)>0
     or position('registry_artist_aliases' in v_definition)>0
  then
    raise exception
      'Provider Identity Artist resolver still contains weak name/alias canonical resolution.';
  end if;

  select regexp_replace(
    lower(
      pg_get_functiondef(
        'platform_private.registry_discography_release_artist_desired_v1(uuid,uuid,jsonb,jsonb)'::regprocedure
      )
    ),
    '[[:space:]]+',
    ' ',
    'g'
  )
  into v_definition;

  if position('registry_discography_resolve_artist_provider_credit_v1' in v_definition)=0
     or position('apple_music_artist_id' in v_definition)=0
     or position('v_related_provider_id is not null' in v_definition)=0
     or position('registry_discography_resolve_artist_credit_v1' in v_definition)=0
  then
    raise exception
      'Discography Release Artist planner lost provider-first / name-only fallback separation.';
  end if;

  foreach v_role in array array['public','anon','authenticated','service_role']
  loop
    if has_function_privilege(
         v_role,
         'platform_private.registry_discography_resolve_artist_provider_credit_v1(text,text,text)',
         'EXECUTE'
       )
    then
      raise exception
        'Provider Identity Artist resolver leaked EXECUTE to role %.',v_role;
    end if;
  end loop;
end
$verify$;

commit;
