-- WAKILISHA — Registry provider Artist identity convergence V1.
-- Alias-aware reviewed Discography credit identity, provider-credit preservation,
-- bounded historical convergence, and Track primary/featured role correction.
--
-- No standing authority is introduced. No client role gains canonical DML.

begin;
set local statement_timeout='180s';
set local lock_timeout='5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'registry-provider-artist-identity-convergence-v1',
    0
  )
);

do $preflight$
declare
  v_track_rows integer;
  v_track_duplicates integer;
  v_release_rows integer;
  v_release_duplicates integer;
  v_ambiguous integer;
begin
  if to_regprocedure(
       'platform_private.registry_discography_resolve_artist_name_v1(text)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_discography_release_artist_desired_v1(uuid,uuid,jsonb,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_discography_track_artist_desired_v1(uuid,uuid,text,jsonb)'
     ) is null
  then
    raise exception
      'Discography Artist-credit authority is incomplete before provider identity convergence.';
  end if;

  select count(*)::integer
  into v_ambiguous
  from (
    select lower(alias.alias_slug)
    from public.registry_artist_aliases alias
    join public.registry_artists canonical
      on canonical.id=alias.canonical_artist_id
     and canonical.status<>'archived'
    where alias.status='active'
    group by lower(alias.alias_slug)
    having count(distinct alias.canonical_artist_id)>1
  ) ambiguous;

  if v_ambiguous<>0 then
    raise exception
      'Active Registry Artist alias authority is ambiguous; convergence must stop.';
  end if;

  select count(*)::integer
  into v_track_rows
  from public.registry_track_artists credit
  join public.registry_artist_aliases alias
    on lower(alias.alias_slug)=lower(credit.artist_slug)
   and alias.status='active'
  join public.registry_artists canonical
    on canonical.id=alias.canonical_artist_id
   and canonical.status<>'archived'
  where credit.artist_id is null
    and credit.status='active';

  select count(*)::integer
  into v_track_duplicates
  from public.registry_track_artists credit
  join public.registry_artist_aliases alias
    on lower(alias.alias_slug)=lower(credit.artist_slug)
   and alias.status='active'
  join public.registry_artists canonical
    on canonical.id=alias.canonical_artist_id
   and canonical.status<>'archived'
  where credit.artist_id is null
    and credit.status='active'
    and exists (
      select 1
      from public.registry_track_artists existing
      where existing.track_id=credit.track_id
        and existing.artist_id=alias.canonical_artist_id
        and existing.status='active'
        and existing.id<>credit.id
    );

  select count(*)::integer
  into v_release_rows
  from public.registry_release_artists credit
  join public.registry_artist_aliases alias
    on lower(alias.alias_slug)=lower(credit.artist_slug)
   and alias.status='active'
  join public.registry_artists canonical
    on canonical.id=alias.canonical_artist_id
   and canonical.status<>'archived'
  where credit.artist_id is null
    and credit.status='active';

  select count(*)::integer
  into v_release_duplicates
  from public.registry_release_artists credit
  join public.registry_artist_aliases alias
    on lower(alias.alias_slug)=lower(credit.artist_slug)
   and alias.status='active'
  join public.registry_artists canonical
    on canonical.id=alias.canonical_artist_id
   and canonical.status<>'archived'
  where credit.artist_id is null
    and credit.status='active'
    and exists (
      select 1
      from public.registry_release_artists existing
      where existing.release_id=credit.release_id
        and existing.artist_id=alias.canonical_artist_id
        and existing.status='active'
        and existing.id<>credit.id
    );

  if not (
       (v_track_rows=0
        and v_track_duplicates=0
        and v_release_rows=0
        and v_release_duplicates=0)
       or
       (v_track_rows=12
        and v_track_duplicates=3
        and v_release_rows=2
        and v_release_duplicates=2)
     )
  then
    raise exception
      'Alias-credit repair scope drifted: Track %/% duplicates; Release %/% duplicates.',
      v_track_rows,
      v_track_duplicates,
      v_release_rows,
      v_release_duplicates;
  end if;
end
$preflight$;

create or replace function
platform_private.registry_discography_resolve_artist_name_v1(
  p_artist_name text
)
returns uuid
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private
as $$
declare
  v_normalized text;
  v_slug text;
  v_ids uuid[];
begin
  if nullif(btrim(p_artist_name),'') is null then
    return null;
  end if;

  v_normalized :=
    platform_private.registry_identity_normalize_text_v1(p_artist_name);
  v_slug := public.wk_slugify_text(v_normalized);

  select array_agg(distinct candidate.artist_id order by candidate.artist_id)
  into v_ids
  from (
    select artist.id as artist_id
    from public.registry_artists artist
    where artist.status<>'archived'
      and (
        artist.normalized_name=v_normalized
        or artist.slug=v_slug
      )

    union

    select alias.canonical_artist_id
    from public.registry_artist_aliases alias
    join public.registry_artists canonical
      on canonical.id=alias.canonical_artist_id
     and canonical.status<>'archived'
    where alias.status='active'
      and (
        lower(alias.alias_slug)=lower(v_slug)
        or platform_private.registry_identity_normalize_text_v1(
             alias.alias_display_name
           )=v_normalized
      )
  ) candidate;

  if coalesce(array_length(v_ids,1),0)=1 then
    return v_ids[1];
  end if;

  return null;
end
$$;

create function
platform_private.registry_discography_resolve_artist_credit_v1(
  p_artist_name text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private
as $$
declare
  v_name text;
  v_normalized text;
  v_slug text;
  v_artist_id uuid;
  v_artist public.registry_artists%rowtype;
  v_display_credit text;
  v_resolved_by text;
begin
  v_name:=nullif(btrim(p_artist_name),'');
  if v_name is null then
    return null;
  end if;

  v_normalized :=
    platform_private.registry_identity_normalize_text_v1(v_name);
  v_slug := public.wk_slugify_text(v_normalized);
  v_artist_id :=
    platform_private.registry_discography_resolve_artist_name_v1(v_name);

  if v_artist_id is null then
    return jsonb_build_object(
      'artist_id',null,
      'artist_slug',v_slug,
      'artist_name_text',v_name,
      'display_credit',null,
      'resolved_by','text_only'
    );
  end if;

  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id=v_artist_id
    and artist.status<>'archived';

  if not found then
    raise exception
      'Resolved Discography Artist disappeared before credit freeze.';
  end if;

  if v_normalized is distinct from v_artist.normalized_name
     or v_slug is distinct from v_artist.slug
  then
    v_display_credit:=v_name;
    v_resolved_by:='active_alias';
  else
    v_display_credit:=null;
    v_resolved_by:='name_match';
  end if;

  return jsonb_build_object(
    'artist_id',v_artist.id,
    'artist_slug',v_artist.slug,
    'artist_name_text',v_artist.display_name,
    'display_credit',v_display_credit,
    'resolved_by',v_resolved_by
  );
end
$$;

revoke all on function
  platform_private.registry_discography_resolve_artist_credit_v1(text)
from public,anon,authenticated,service_role;

create function
platform_private.registry_discography_title_feature_credit_includes_artist_v1(
  p_title text,
  p_artist_name text
)
returns boolean
language plpgsql
immutable
security definer
set search_path=pg_catalog
as $$
declare
  v_pattern text;
  v_match text[];
  v_feature_text text;
  v_part text;
  v_target text;
begin
  v_target :=
    btrim(
      regexp_replace(
        lower(pg_catalog.normalize(coalesce(p_artist_name,''),'NFKC')),
        '[[:space:]]+',
        ' ',
        'g'
      )
    );

  if v_target='' then
    return false;
  end if;

  foreach v_pattern in array array[
    '\((?:feat\.?|ft\.?|featuring|with|w/)\s+([^)]+)\)',
    '\[(?:feat\.?|ft\.?|featuring|with|w/)\s+([^]]+)\]',
    '\s[-–—]\s*(?:feat\.?|ft\.?|featuring|with|w/)\s+(.+)$'
  ]
  loop
    v_match:=regexp_match(coalesce(p_title,''),v_pattern,'i');
    if v_match is null or array_length(v_match,1)<1 then
      continue;
    end if;

    v_feature_text:=v_match[1];

    for v_part in
      select btrim(part)
      from regexp_split_to_table(
        coalesce(v_feature_text,''),
        '\s*(?:,|&|\sand\s|\sx\s|\+)\s*',
        'i'
      ) part
      where btrim(part)<>''
    loop
      if btrim(
           regexp_replace(
             lower(pg_catalog.normalize(v_part,'NFKC')),
             '[[:space:]]+',
             ' ',
             'g'
           )
         )=v_target
      then
        return true;
      end if;
    end loop;
  end loop;

  return false;
end
$$;

revoke all on function
  platform_private.registry_discography_title_feature_credit_includes_artist_v1(text,text)
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

    v_credit :=
      platform_private.registry_discography_resolve_artist_credit_v1(
        v_related_name
      );

    v_slug:=v_credit->>'artist_slug';

    if nullif(v_slug,'') is null then
      raise exception using errcode='22023',
        message='Provider Release credit cannot be normalized to credited-name identity.';
    end if;

    if array_position(v_seen_slugs,v_slug) is not null then
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
          when nullif(v_credit->>'artist_id','') is null then 50
          else 85
        end,
        'status','active',
        'metadata',jsonb_build_object(
          'apple_music_album_id',p_album->>'apple_music_id',
          'apple_music_artist_id',nullif(v_related->>'apple_music_artist_id',''),
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

create or replace function
platform_private.registry_discography_track_artist_desired_v1(
  p_track_id uuid,
  p_current_artist_id uuid,
  p_album_id text,
  p_track jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private
as $$
declare
  v_current public.registry_artists%rowtype;
  v_result jsonb:='[]'::jsonb;
  v_seen_slugs text[]:=array[]::text[];
  v_names text[];
  v_name text;
  v_name_key text;
  v_current_key text;
  v_credit jsonb;
  v_slug text;
  v_is_primary boolean;
  v_is_explicit_feature boolean;
  v_primary_order integer:=2;
  v_feature_order integer:=99;
begin
  select artist.*
  into v_current
  from public.registry_artists artist
  where artist.id=p_current_artist_id
    and artist.status<>'archived';

  if not found then
    raise exception using errcode='P0002',
      message='Discography Artist is missing.';
  end if;

  v_current_key :=
    platform_private.registry_identity_normalize_text_v1(
      v_current.display_name
    );

  v_names :=
    platform_private.registry_discography_track_credit_names_v1(
      p_track->>'artist_name',
      p_track->>'title',
      v_current.display_name
    );

  foreach v_name in array v_names
  loop
    v_name_key :=
      platform_private.registry_identity_normalize_text_v1(v_name);

    if v_name_key=v_current_key
       or public.wk_slugify_text(v_name_key)=v_current.slug
    then
      if array_position(v_seen_slugs,v_current.slug) is null then
        v_result:=v_result||jsonb_build_array(
          jsonb_build_object(
            'track_id',p_track_id,
            'artist_id',v_current.id,
            'artist_slug',v_current.slug,
            'artist_name_text',v_current.display_name,
            'role','primary_artist',
            'is_primary',true,
            'is_featured',false,
            'credit_order',1,
            'display_credit',null,
            'source','apple_music_ingest',
            'confidence',90,
            'status','active',
            'metadata',jsonb_build_object(
              'apple_music_track_id',p_track->>'apple_music_id',
              'apple_music_album_id',p_album_id
            )
          )
        );
        v_seen_slugs:=array_append(v_seen_slugs,v_current.slug);
      end if;
      continue;
    end if;

    v_credit :=
      platform_private.registry_discography_resolve_artist_credit_v1(v_name);
    v_slug:=v_credit->>'artist_slug';

    if nullif(v_slug,'') is null then
      raise exception using errcode='22023',
        message='Provider Track credit cannot be normalized to credited-name identity.';
    end if;

    if array_position(v_seen_slugs,v_slug) is not null then
      continue;
    end if;

    v_is_explicit_feature :=
      platform_private.registry_discography_title_feature_credit_includes_artist_v1(
        p_track->>'title',
        v_name
      );

    v_is_primary :=
      not v_is_explicit_feature
      and platform_private.registry_discography_credit_includes_artist_v1(
        p_track->>'artist_name',
        v_name
      );

    v_result:=v_result||jsonb_build_array(
      jsonb_build_object(
        'track_id',p_track_id,
        'artist_id',nullif(v_credit->>'artist_id','')::uuid,
        'artist_slug',v_slug,
        'artist_name_text',v_credit->>'artist_name_text',
        'role',case
          when v_is_primary then 'primary_artist'
          else 'featured_artist'
        end,
        'is_primary',v_is_primary,
        'is_featured',not v_is_primary,
        'credit_order',case
          when v_is_primary then v_primary_order
          else v_feature_order
        end,
        'display_credit',nullif(v_credit->>'display_credit',''),
        'source','apple_music_ingest',
        'confidence',case
          when nullif(v_credit->>'artist_id','') is null then 50
          else 85
        end,
        'status','active',
        'metadata',jsonb_build_object(
          'apple_music_track_id',p_track->>'apple_music_id',
          'apple_music_album_id',p_album_id,
          'resolved_by',v_credit->>'resolved_by',
          'provider_role',case
            when v_is_primary then 'primary_artist'
            else 'featured_artist'
          end
        )
      )
    );

    v_seen_slugs:=array_append(v_seen_slugs,v_slug);

    if v_is_primary then
      v_primary_order:=v_primary_order+1;
    else
      v_feature_order:=v_feature_order+1;
    end if;
  end loop;

  return v_result;
end
$$;

-- ---------------------------------------------------------------------------
-- Historical convergence:
-- 9 Track rows can be rebound directly.
-- 3 Track rows and 2 Release rows duplicate an already-active canonical credit;
-- preserve their provider credit on the canonical relationship, then archive
-- the redundant alias relationship.
-- ---------------------------------------------------------------------------

with alias_rows as (
  select
    alias_credit.id as alias_credit_id,
    alias_credit.track_id,
    alias_credit.artist_name_text as alias_credit_name,
    alias_credit.display_credit as alias_display_credit,
    alias.alias_slug,
    alias.canonical_artist_id,
    canonical.id as canonical_credit_id
  from public.registry_track_artists alias_credit
  join public.registry_artist_aliases alias
    on lower(alias.alias_slug)=lower(alias_credit.artist_slug)
   and alias.status='active'
  join public.registry_artists canonical_artist
    on canonical_artist.id=alias.canonical_artist_id
   and canonical_artist.status<>'archived'
  join public.registry_track_artists canonical
    on canonical.track_id=alias_credit.track_id
   and canonical.artist_id=alias.canonical_artist_id
   and canonical.status='active'
   and canonical.id<>alias_credit.id
  where alias_credit.artist_id is null
    and alias_credit.status='active'
)
update public.registry_track_artists canonical
set
  display_credit=coalesce(
    nullif(canonical.display_credit,''),
    nullif(alias_rows.alias_display_credit,''),
    nullif(alias_rows.alias_credit_name,''),
    alias_rows.alias_slug
  ),
  metadata=coalesce(canonical.metadata,'{}'::jsonb) || jsonb_build_object(
    'alias_convergence','v1',
    'provider_alias_credit',coalesce(
      nullif(alias_rows.alias_display_credit,''),
      nullif(alias_rows.alias_credit_name,''),
      alias_rows.alias_slug
    ),
    'provider_alias_credit_id',alias_rows.alias_credit_id,
    'provider_alias_slug',alias_rows.alias_slug
  ),
  updated_at=now()
from alias_rows
where canonical.id=alias_rows.canonical_credit_id;

with alias_rows as (
  select
    alias_credit.id as alias_credit_id,
    alias.alias_slug,
    canonical.id as canonical_credit_id
  from public.registry_track_artists alias_credit
  join public.registry_artist_aliases alias
    on lower(alias.alias_slug)=lower(alias_credit.artist_slug)
   and alias.status='active'
  join public.registry_artists canonical_artist
    on canonical_artist.id=alias.canonical_artist_id
   and canonical_artist.status<>'archived'
  join public.registry_track_artists canonical
    on canonical.track_id=alias_credit.track_id
   and canonical.artist_id=alias.canonical_artist_id
   and canonical.status='active'
   and canonical.id<>alias_credit.id
  where alias_credit.artist_id is null
    and alias_credit.status='active'
)
update public.registry_track_artists alias_credit
set
  status='archived',
  metadata=coalesce(alias_credit.metadata,'{}'::jsonb) || jsonb_build_object(
    'alias_convergence','v1',
    'superseded_by_credit_id',alias_rows.canonical_credit_id,
    'provider_alias_slug',alias_rows.alias_slug
  ),
  updated_at=now()
from alias_rows
where alias_credit.id=alias_rows.alias_credit_id;

with candidate as (
  select
    credit.id,
    alias.alias_slug,
    alias.canonical_artist_id,
    canonical.slug as canonical_slug,
    canonical.display_name as canonical_name
  from public.registry_track_artists credit
  join public.registry_artist_aliases alias
    on lower(alias.alias_slug)=lower(credit.artist_slug)
   and alias.status='active'
  join public.registry_artists canonical
    on canonical.id=alias.canonical_artist_id
   and canonical.status<>'archived'
  where credit.artist_id is null
    and credit.status='active'
    and not exists (
      select 1
      from public.registry_track_artists existing
      where existing.track_id=credit.track_id
        and existing.artist_id=alias.canonical_artist_id
        and existing.status='active'
        and existing.id<>credit.id
    )
)
update public.registry_track_artists credit
set
  artist_id=candidate.canonical_artist_id,
  artist_slug=candidate.canonical_slug,
  artist_name_text=candidate.canonical_name,
  display_credit=coalesce(
    nullif(credit.display_credit,''),
    nullif(credit.artist_name_text,''),
    candidate.alias_slug
  ),
  confidence=greatest(credit.confidence,85),
  metadata=coalesce(credit.metadata,'{}'::jsonb) || jsonb_build_object(
    'alias_convergence','v1',
    'resolved_by','active_alias',
    'provider_alias_slug',candidate.alias_slug,
    'resolved_canonical_artist_id',candidate.canonical_artist_id
  ),
  updated_at=now()
from candidate
where credit.id=candidate.id;

with alias_rows as (
  select
    alias_credit.id as alias_credit_id,
    alias_credit.release_id,
    alias_credit.artist_name_text as alias_credit_name,
    alias_credit.display_credit as alias_display_credit,
    alias.alias_slug,
    alias.canonical_artist_id,
    canonical.id as canonical_credit_id
  from public.registry_release_artists alias_credit
  join public.registry_artist_aliases alias
    on lower(alias.alias_slug)=lower(alias_credit.artist_slug)
   and alias.status='active'
  join public.registry_artists canonical_artist
    on canonical_artist.id=alias.canonical_artist_id
   and canonical_artist.status<>'archived'
  join public.registry_release_artists canonical
    on canonical.release_id=alias_credit.release_id
   and canonical.artist_id=alias.canonical_artist_id
   and canonical.status='active'
   and canonical.id<>alias_credit.id
  where alias_credit.artist_id is null
    and alias_credit.status='active'
)
update public.registry_release_artists canonical
set
  display_credit=coalesce(
    nullif(canonical.display_credit,''),
    nullif(alias_rows.alias_display_credit,''),
    nullif(alias_rows.alias_credit_name,''),
    alias_rows.alias_slug
  ),
  metadata=coalesce(canonical.metadata,'{}'::jsonb) || jsonb_build_object(
    'alias_convergence','v1',
    'provider_alias_credit',coalesce(
      nullif(alias_rows.alias_display_credit,''),
      nullif(alias_rows.alias_credit_name,''),
      alias_rows.alias_slug
    ),
    'provider_alias_credit_id',alias_rows.alias_credit_id,
    'provider_alias_slug',alias_rows.alias_slug
  ),
  updated_at=now()
from alias_rows
where canonical.id=alias_rows.canonical_credit_id;

with alias_rows as (
  select
    alias_credit.id as alias_credit_id,
    alias.alias_slug,
    canonical.id as canonical_credit_id
  from public.registry_release_artists alias_credit
  join public.registry_artist_aliases alias
    on lower(alias.alias_slug)=lower(alias_credit.artist_slug)
   and alias.status='active'
  join public.registry_artists canonical_artist
    on canonical_artist.id=alias.canonical_artist_id
   and canonical_artist.status<>'archived'
  join public.registry_release_artists canonical
    on canonical.release_id=alias_credit.release_id
   and canonical.artist_id=alias.canonical_artist_id
   and canonical.status='active'
   and canonical.id<>alias_credit.id
  where alias_credit.artist_id is null
    and alias_credit.status='active'
)
update public.registry_release_artists alias_credit
set
  status='archived',
  metadata=coalesce(alias_credit.metadata,'{}'::jsonb) || jsonb_build_object(
    'alias_convergence','v1',
    'superseded_by_credit_id',alias_rows.canonical_credit_id,
    'provider_alias_slug',alias_rows.alias_slug
  ),
  updated_at=now()
from alias_rows
where alias_credit.id=alias_rows.alias_credit_id;

do $integrity$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'platform_private.registry_discography_resolve_artist_name_v1(text)'::regprocedure
  ) into v_definition;

  if position('registry_artist_aliases' in v_definition)=0
     or position('canonical_artist_id' in v_definition)=0
     or position('alias_display_name' in v_definition)=0
  then
    raise exception
      'Discography Artist resolver did not bind active alias authority.';
  end if;

  select pg_get_functiondef(
    'platform_private.registry_discography_track_artist_desired_v1(uuid,uuid,text,jsonb)'::regprocedure
  ) into v_definition;

  if position('registry_discography_resolve_artist_credit_v1' in v_definition)=0
     or position('registry_discography_title_feature_credit_includes_artist_v1' in v_definition)=0
  then
    raise exception
      'Discography Track credit identity/role convergence is incomplete.';
  end if;

  if exists (
    select 1
    from public.registry_track_artists credit
    join public.registry_artist_aliases alias
      on lower(alias.alias_slug)=lower(credit.artist_slug)
     and alias.status='active'
    join public.registry_artists canonical
      on canonical.id=alias.canonical_artist_id
     and canonical.status<>'archived'
    where credit.artist_id is null
      and credit.status='active'
  ) then
    raise exception
      'Active Track credit still ignores known canonical Artist alias authority.';
  end if;

  if exists (
    select 1
    from public.registry_release_artists credit
    join public.registry_artist_aliases alias
      on lower(alias.alias_slug)=lower(credit.artist_slug)
     and alias.status='active'
    join public.registry_artists canonical
      on canonical.id=alias.canonical_artist_id
     and canonical.status<>'archived'
    where credit.artist_id is null
      and credit.status='active'
  ) then
    raise exception
      'Active Release credit still ignores known canonical Artist alias authority.';
  end if;
end
$integrity$;

commit;
