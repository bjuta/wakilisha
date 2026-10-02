-- Reviewed Registry Admission Spine: Discography review + active publication convergence.
--
-- Binding design:
-- docs/engineering/registry-reviewed-admission-spine-and-mizizi-stewardship-design-20261002.md
--
-- This migration does not weaken public/editorial readers. It repairs the
-- reviewed ingestion contract so explicitly admitted provider recordings
-- reach active canonical Registry state before parent success.

begin;
set local statement_timeout='180s';
set local lock_timeout='5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'discography-review-publication-convergence-v1',
    0
  )
);

do $preflight$
begin
  if to_regprocedure(
       'platform_private.registry_discography_normalize_reviewed_selections_v1(uuid,jsonb,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_discography_build_frozen_plan_v1(uuid,uuid,uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.issue_registry_discography_user_execution_grant_v1(uuid,text,text,uuid,jsonb,text,integer)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_subject_state_fingerprint(text,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.begin_registry_mutation_operation(text,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_track_creation_slug_v1(text,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_release_creation_slug_v1(text,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_track_creation_collision_state_v1(uuid,text,uuid,text)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_release_creation_collision_state_v1(uuid,text,uuid,text)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_discography_observation_fingerprint_v1(jsonb)'
     ) is null
     or to_regclass(
       'platform_private.registry_discography_review_plans'
     ) is null
     or to_regclass(
       'platform_private.registry_discography_provider_snapshots'
     ) is null
     or to_regclass(
       'platform_private.registry_operation_types'
     ) is null
  then
    raise exception
      'STOP: accepted Registry/Discography authority required by reviewed admission convergence is missing';
  end if;

  if exists (
       select 1
       from public.capability_definitions
       where capability_key in (
         'activate_registry_release',
         'reconcile_registry_draft_identity'
       )
     )
     or exists (
       select 1
       from platform_private.registry_operation_types
       where (operation_key,operation_version) in (
         ('registry.release.activate',1),
         ('registry.draft_identity.reconcile',1)
       )
     )
     or to_regprocedure(
       'platform_private.execute_registry_reviewed_identity_reconciliation_v1(text,uuid)'
     ) is not null
     or to_regprocedure(
       'platform_private.verify_registry_reviewed_identity_reconciliation_v1(uuid)'
     ) is not null
     or to_regprocedure(
       'platform_private.execute_registry_reviewed_lifecycle_v1(text,uuid)'
     ) is not null
     or to_regprocedure(
       'platform_private.verify_registry_reviewed_lifecycle_v1(uuid)'
     ) is not null
     or to_regprocedure(
       'mizizi_private.registry_reviewed_admission_sentry_v1(uuid)'
     ) is not null
  then
    raise exception
      'STOP: reviewed admission convergence authority already exists; audit before reapplying';
  end if;
end
$preflight$;

insert into public.capability_definitions (
  capability_key,label,description,domain
)
values
(
  'activate_registry_release',
  'Activate Registry Release',
  'Activate one exact reviewed draft Registry Release.',
  'registry'
),
(
  'reconcile_registry_draft_identity',
  'Reconcile Registry Draft Identity',
  'Reconcile one exact draft Track or Release slug before first activation.',
  'registry'
);

insert into platform_private.registry_operation_types (
  operation_key,
  operation_version,
  capability_key,
  risk_class,
  allowed_subject_types,
  requires_existing_target,
  max_targets,
  max_rows_ceiling,
  max_grant_ttl_seconds,
  requires_human_approval,
  requires_verifier,
  enabled,
  description
)
values
(
  'registry.release.activate',
  1,
  'activate_registry_release',
  'medium',
  array['release']::text[],
  true,
  1,
  1,
  300,
  true,
  true,
  true,
  'Activate one exact reviewed draft Registry Release after its admitted relationships and Tracks are complete.'
),
(
  'registry.draft_identity.reconcile',
  1,
  'reconcile_registry_draft_identity',
  'medium',
  array['track','release']::text[],
  true,
  1,
  1,
  300,
  true,
  true,
  true,
  'Reconcile one exact reviewed draft Track or Release slug before first activation.'
);

update platform_private.system_actors
set capability_profile =
  jsonb_set(
    coalesce(capability_profile,'{}'::jsonb),
    '{operation_versions}',
    coalesce(capability_profile->'operation_versions','{}'::jsonb)
      || jsonb_build_object(
        'registry.track.activate',1,
        'registry.release.activate',1,
        'registry.draft_identity.reconcile',1
      ),
    true
  ),
  updated_at=now()
where actor_key='registry_discography_admin';


-- ---------------------------------------------------------------------------
-- Artist-scoped canonical identity creation.
--
-- Track/Release public routes already carry Artist scope. Entity slugs must not
-- duplicate that Artist scope internally. Collision detection remains scoped
-- to the identity Artist for slug/title reasons while ISRC/UPC remain global.
-- ---------------------------------------------------------------------------

create or replace function
platform_private.registry_track_creation_slug_v1(
  p_title text,
  p_identity_artist_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, platform_private
as $$
begin
  if not exists (
    select 1
    from public.registry_artists artist
    where artist.id=p_identity_artist_id
      and artist.status<>'archived'
  ) then
    return null;
  end if;

  return public.wk_slugify_text(
    platform_private.registry_identity_normalize_text_v1(p_title)
  );
end
$$;

create or replace function
platform_private.registry_release_creation_slug_v1(
  p_title text,
  p_identity_artist_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, platform_private
as $$
begin
  if not exists (
    select 1
    from public.registry_artists artist
    where artist.id=p_identity_artist_id
      and artist.status<>'archived'
  ) then
    return null;
  end if;

  return public.wk_slugify_text(
    platform_private.registry_identity_normalize_text_v1(p_title)
  );
end
$$;

create or replace function
platform_private.registry_track_creation_collision_state_v1(
  p_future_track_id uuid,
  p_title text,
  p_identity_artist_id uuid,
  p_isrc text
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, platform_private
as $$
  with proposed as (
    select
      platform_private.registry_identity_comparison_key_v1(p_title)
        as comparison_key,
      platform_private.registry_track_creation_slug_v1(
        p_title,p_identity_artist_id
      ) as slug,
      platform_private.registry_identity_canonical_isrc_v1(p_isrc)
        as isrc
  ),
  collisions as (
    select track.id::text as registry_entity_id,'future_id'::text as reason
    from public.registry_tracks track
    where track.id=p_future_track_id

    union all

    select track.id::text,'slug'
    from public.registry_tracks track
    cross join proposed
    where track.status<>'archived'
      and proposed.slug is not null
      and track.slug=proposed.slug
      and exists (
        select 1
        from public.registry_track_artists credit
        where credit.track_id=track.id
          and credit.artist_id=p_identity_artist_id
          and credit.status<>'archived'
      )

    union all

    select track.id::text,'isrc'
    from public.registry_tracks track
    cross join proposed
    where track.status<>'archived'
      and proposed.isrc is not null
      and track.isrc=proposed.isrc

    union all

    select track.id::text,'title_artist'
    from public.registry_tracks track
    cross join proposed
    where track.status<>'archived'
      and platform_private.registry_identity_comparison_key_v1(track.title)
          = proposed.comparison_key
      and exists (
        select 1
        from public.registry_track_artists credit
        where credit.track_id=track.id
          and credit.artist_id=p_identity_artist_id
          and credit.status<>'archived'
      )
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'registry_entity_id',collision.registry_entity_id,
        'reason',collision.reason
      )
      order by collision.registry_entity_id,collision.reason
    ),
    '[]'::jsonb
  )
  from collisions collision;
$$;

create or replace function
platform_private.registry_release_creation_collision_state_v1(
  p_future_release_id uuid,
  p_title text,
  p_identity_artist_id uuid,
  p_upc text
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, platform_private
as $$
  with proposed as (
    select
      platform_private.registry_identity_comparison_key_v1(p_title)
        as comparison_key,
      platform_private.registry_release_creation_slug_v1(
        p_title,p_identity_artist_id
      ) as slug,
      platform_private.registry_identity_canonical_upc_v1(p_upc)
        as upc
  ),
  collisions as (
    select release.id::text as registry_entity_id,'future_id'::text as reason
    from public.registry_releases release
    where release.id=p_future_release_id

    union all

    select release.id::text,'slug'
    from public.registry_releases release
    cross join proposed
    where release.status<>'archived'
      and proposed.slug is not null
      and release.slug=proposed.slug
      and exists (
        select 1
        from public.registry_release_artists credit
        where credit.release_id=release.id
          and credit.artist_id=p_identity_artist_id
          and credit.status<>'archived'
      )

    union all

    select release.id::text,'upc'
    from public.registry_releases release
    cross join proposed
    where release.status<>'archived'
      and proposed.upc is not null
      and release.upc=proposed.upc

    union all

    select release.id::text,'title_artist'
    from public.registry_releases release
    cross join proposed
    where release.status<>'archived'
      and platform_private.registry_identity_comparison_key_v1(release.title)
          = proposed.comparison_key
      and exists (
        select 1
        from public.registry_release_artists credit
        where credit.release_id=release.id
          and credit.artist_id=p_identity_artist_id
          and credit.status<>'archived'
      )
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'registry_entity_id',collision.registry_entity_id,
        'reason',collision.reason
      )
      order by collision.registry_entity_id,collision.reason
    ),
    '[]'::jsonb
  )
  from collisions collision;
$$;

create function
platform_private.registry_reviewed_release_slug_v1(
  p_title text,
  p_release_type text,
  p_identity_artist_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private
as $$
declare
  v_title text;
  v_type text;
begin
  if not exists (
    select 1
    from public.registry_artists artist
    where artist.id=p_identity_artist_id
      and artist.status<>'archived'
  ) then
    return null;
  end if;

  v_title:=platform_private.registry_identity_normalize_text_v1(p_title);
  v_type:=lower(btrim(coalesce(p_release_type,'')));

  if v_type in ('single','ep','album')
     and v_title ~* ('[[:space:]]+-[[:space:]]+'||v_type||'$')
  then
    v_title:=btrim(
      regexp_replace(
        v_title,
        '[[:space:]]+-[[:space:]]+'||v_type||'$',
        '',
        'i'
      )
    );
  end if;

  return public.wk_slugify_text(v_title);
end
$$;


-- ---------------------------------------------------------------------------
-- Discography identity resolution now uses Artist-scoped slug identity.
-- Provider IDs and ISRC/UPC remain stronger evidence and are checked first.
-- ---------------------------------------------------------------------------

create or replace function
platform_private.registry_discography_resolve_release_v1(
  p_artist_id uuid,
  p_album jsonb
)
returns uuid
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private
as $$
declare
  v_apple_id text:=nullif(btrim(p_album->>'apple_music_id'),'');
  v_upc text;
  v_slug text;
  v_normalized_title text;
  v_ids uuid[];
begin
  if p_artist_id is null
     or p_album is null
     or jsonb_typeof(p_album)<>'object'
     or v_apple_id is null
     or nullif(btrim(p_album->>'title'),'') is null
  then
    raise exception using errcode='22023',
      message='Release resolution requires exact Artist and provider Album identity.';
  end if;

  v_upc:=platform_private.registry_identity_canonical_upc_v1(
    nullif(p_album->>'upc','')
  );
  v_slug:=platform_private.registry_release_creation_slug_v1(
    p_album->>'title',p_artist_id
  );
  v_normalized_title:=
    platform_private.registry_identity_normalize_text_v1(p_album->>'title');

  select array_agg(release.id order by release.id)
  into v_ids
  from public.registry_releases release
  where release.status<>'archived'
    and release.metadata->>'apple_music_album_id'=v_apple_id;

  if coalesce(array_length(v_ids,1),0)>1 then
    raise exception using errcode='40001',
      message='Apple Music Album identity resolves to multiple Registry Releases.';
  elsif coalesce(array_length(v_ids,1),0)=1 then
    return v_ids[1];
  end if;

  if v_upc is not null then
    select array_agg(release.id order by release.id)
    into v_ids
    from public.registry_releases release
    where release.status<>'archived'
      and release.upc=v_upc;

    if coalesce(array_length(v_ids,1),0)>1 then
      raise exception using errcode='40001',
        message='UPC resolves to multiple Registry Releases.';
    elsif coalesce(array_length(v_ids,1),0)=1 then
      return v_ids[1];
    end if;
  end if;

  select array_agg(release.id order by release.id)
  into v_ids
  from public.registry_releases release
  where release.status<>'archived'
    and release.slug=v_slug
    and exists (
      select 1
      from public.registry_release_artists credit
      where credit.release_id=release.id
        and credit.artist_id=p_artist_id
        and credit.status<>'archived'
    );

  if coalesce(array_length(v_ids,1),0)>1 then
    raise exception using errcode='40001',
      message='Artist-scoped Release slug resolves ambiguously.';
  elsif coalesce(array_length(v_ids,1),0)=1 then
    return v_ids[1];
  end if;

  select array_agg(release.id order by release.id)
  into v_ids
  from public.registry_releases release
  where release.status<>'archived'
    and release.normalized_title=v_normalized_title
    and exists (
      select 1
      from public.registry_release_artists credit
      where credit.release_id=release.id
        and credit.artist_id=p_artist_id
        and credit.status<>'archived'
    );

  if coalesce(array_length(v_ids,1),0)>1 then
    raise exception using errcode='40001',
      message='Release title/Artist identity resolves ambiguously.';
  elsif coalesce(array_length(v_ids,1),0)=1 then
    return v_ids[1];
  end if;

  return null;
end
$$;

create or replace function
platform_private.registry_discography_resolve_track_v1(
  p_artist_id uuid,
  p_track jsonb
)
returns uuid
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private
as $$
declare
  v_apple_id text:=nullif(btrim(p_track->>'apple_music_id'),'');
  v_isrc text;
  v_slug text;
  v_normalized_title text;
  v_ids uuid[];
begin
  if p_artist_id is null
     or p_track is null
     or jsonb_typeof(p_track)<>'object'
     or v_apple_id is null
     or nullif(btrim(p_track->>'title'),'') is null
  then
    raise exception using errcode='22023',
      message='Track resolution requires exact Artist and provider Track identity.';
  end if;

  v_isrc:=platform_private.registry_identity_canonical_isrc_v1(
    nullif(p_track->>'isrc','')
  );
  v_slug:=platform_private.registry_track_creation_slug_v1(
    p_track->>'title',p_artist_id
  );
  v_normalized_title:=
    platform_private.registry_identity_normalize_text_v1(p_track->>'title');

  select array_agg(track.id order by track.id)
  into v_ids
  from public.registry_tracks track
  where track.status<>'archived'
    and track.metadata->>'apple_music_track_id'=v_apple_id;

  if coalesce(array_length(v_ids,1),0)>1 then
    raise exception using errcode='40001',
      message='Apple Music Track identity resolves to multiple Registry Tracks.';
  elsif coalesce(array_length(v_ids,1),0)=1 then
    return v_ids[1];
  end if;

  if v_isrc is not null then
    select array_agg(track.id order by track.id)
    into v_ids
    from public.registry_tracks track
    where track.status<>'archived'
      and track.isrc=v_isrc;

    if coalesce(array_length(v_ids,1),0)>1 then
      raise exception using errcode='40001',
        message='ISRC resolves to multiple Registry Tracks.';
    elsif coalesce(array_length(v_ids,1),0)=1 then
      return v_ids[1];
    end if;
  end if;

  select array_agg(track.id order by track.id)
  into v_ids
  from public.registry_tracks track
  where track.status<>'archived'
    and track.slug=v_slug
    and exists (
      select 1
      from public.registry_track_artists credit
      where credit.track_id=track.id
        and credit.artist_id=p_artist_id
        and credit.status<>'archived'
    );

  if coalesce(array_length(v_ids,1),0)>1 then
    raise exception using errcode='40001',
      message='Artist-scoped Track slug resolves ambiguously.';
  elsif coalesce(array_length(v_ids,1),0)=1 then
    return v_ids[1];
  end if;

  select array_agg(track.id order by track.id)
  into v_ids
  from public.registry_tracks track
  where track.status<>'archived'
    and track.normalized_title=v_normalized_title
    and exists (
      select 1
      from public.registry_track_artists credit
      where credit.track_id=track.id
        and credit.artist_id=p_artist_id
        and credit.status<>'archived'
    );

  if coalesce(array_length(v_ids,1),0)>1 then
    raise exception using errcode='40001',
      message='Track title/Artist identity resolves ambiguously.';
  elsif coalesce(array_length(v_ids,1),0)=1 then
    return v_ids[1];
  end if;

  return null;
end
$$;


-- ---------------------------------------------------------------------------
-- Exhaustive review-set validation.
-- Every observed Album must have exactly one explicit decision. Leave-all is
-- valid because observation is evidence and canonical admission is optional.
-- ---------------------------------------------------------------------------

create or replace function
platform_private.registry_discography_normalize_reviewed_selections_v1(
  p_artist_id uuid,
  p_observation jsonb,
  p_reviewed_selections jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private
as $$
declare
  v_result jsonb:='[]'::jsonb;
  v_selection jsonb;
  v_album_id text;
  v_action text;
  v_additional jsonb;
  v_additional_row jsonb;
  v_normalized_additional jsonb;
  v_additional_id uuid;
  v_additional_artist public.registry_artists%rowtype;
  v_seen_album_ids text[]:=array[]::text[];
  v_seen_artist_ids uuid[];
  v_observed_count integer;
begin
  if p_artist_id is null
     or p_reviewed_selections is null
     or jsonb_typeof(p_reviewed_selections)<>'array'
     or p_observation is null
     or jsonb_typeof(p_observation)<>'object'
     or jsonb_typeof(p_observation->'albums')<>'array'
     or octet_length(p_reviewed_selections::text)>131072
  then
    raise exception using errcode='22023',
      message='Reviewed Discography selections are required.';
  end if;

  v_observed_count:=jsonb_array_length(p_observation->'albums');

  if jsonb_array_length(p_reviewed_selections)<>v_observed_count then
    raise exception using errcode='22023',
      message='Every observed Release requires one explicit Discography review decision.';
  end if;

  for v_selection in
    select value
    from jsonb_array_elements(p_reviewed_selections)
    order by value->>'apple_music_id'
  loop
    if jsonb_typeof(v_selection)<>'object'
       or (
         v_selection-
         array['apple_music_id','action','additional_primary_artists']::text[]
       )<>'{}'::jsonb
    then
      raise exception using errcode='22023',
        message='Reviewed Discography selection contains fields outside the V1 browser contract.';
    end if;

    v_album_id:=nullif(btrim(v_selection->>'apple_music_id'),'');
    v_action:=nullif(btrim(v_selection->>'action'),'');

    if v_album_id is null
       or v_action not in ('merge','canonicalize','ignore')
       or array_position(v_seen_album_ids,v_album_id) is not null
       or not exists (
         select 1
         from jsonb_array_elements(p_observation->'albums') album
         where album->>'apple_music_id'=v_album_id
       )
    then
      raise exception using errcode='22023',
        message='Reviewed Discography selection is invalid, duplicated, or absent from immutable evidence.';
    end if;

    v_seen_album_ids:=array_append(v_seen_album_ids,v_album_id);
    v_additional:=coalesce(v_selection->'additional_primary_artists','[]'::jsonb);

    if jsonb_typeof(v_additional)<>'array' then
      raise exception using errcode='22023',
        message='Additional primary Artist selection must be an array.';
    end if;

    if v_action='ignore' and jsonb_array_length(v_additional)>0 then
      raise exception using errcode='22023',
        message='Left Releases cannot carry canonical co-primary Artist authority.';
    end if;

    v_normalized_additional:='[]'::jsonb;
    v_seen_artist_ids:=array[]::uuid[];

    for v_additional_row in
      select value
      from jsonb_array_elements(v_additional)
      order by value->>'artist_id'
    loop
      if jsonb_typeof(v_additional_row)<>'object'
         or (
           v_additional_row-
           array['artist_id','artist_slug','artist_name']::text[]
         )<>'{}'::jsonb
         or coalesce(v_additional_row->>'artist_id','') !~
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      then
        raise exception using errcode='22023',
          message='Additional primary Artist identity is malformed.';
      end if;

      v_additional_id:=(v_additional_row->>'artist_id')::uuid;

      select artist.*
      into v_additional_artist
      from public.registry_artists artist
      where artist.id=v_additional_id
        and artist.status<>'archived';

      if not found
         or v_additional_id=p_artist_id
         or array_position(v_seen_artist_ids,v_additional_id) is not null
         or btrim(coalesce(v_additional_row->>'artist_slug',''))
              is distinct from v_additional_artist.slug
         or btrim(coalesce(v_additional_row->>'artist_name',''))
              is distinct from v_additional_artist.display_name
      then
        raise exception using errcode='22023',
          message='Additional primary Artist identity is inconsistent inside one reviewed plan.';
      end if;

      v_seen_artist_ids:=array_append(v_seen_artist_ids,v_additional_id);
      v_normalized_additional:=
        v_normalized_additional ||
        jsonb_build_array(
          jsonb_build_object(
            'artist_id',v_additional_artist.id,
            'artist_slug',v_additional_artist.slug,
            'artist_name',v_additional_artist.display_name
          )
        );
    end loop;

    v_result:=v_result || jsonb_build_array(
      jsonb_build_object(
        'apple_music_id',v_album_id,
        'action',v_action,
        'additional_primary_artists',v_normalized_additional
      )
    );
  end loop;

  if cardinality(v_seen_album_ids)<>v_observed_count then
    raise exception using errcode='22023',
      message='Every observed Release requires one explicit Discography review decision.';
  end if;

  return v_result;
end
$$;


-- ---------------------------------------------------------------------------
-- Shared reviewed draft-identity reconciliation primitive.
-- This operation is intentionally draft-only. Active historical cleanup remains
-- MIZIZI stewardship authority rather than being smuggled through ingestion.
-- ---------------------------------------------------------------------------

create function
platform_private.execute_registry_reviewed_identity_reconciliation_v1(
  p_actor_key text,
  p_execution_grant_id uuid
)
returns table (
  operation_id uuid,
  operation_status text,
  verifier_status text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private
as $$
declare
  v_begin record;
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_target platform_private.registry_execution_grant_targets%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_review platform_private.registry_discography_review_plans%rowtype;
  v_child jsonb;
  v_payload jsonb;
  v_current_fingerprint text;
  v_after_fingerprint text;
  v_current_slug text;
  v_canonical_slug text;
  v_identity_artist_id uuid;
  v_event_id uuid;
  v_rows integer;
begin
  select *
  into v_begin
  from platform_private.begin_registry_mutation_operation(
    p_actor_key,p_execution_grant_id
  );

  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=v_begin.operation_id
  for update;

  if v_begin.idempotent_replay and v_operation.status='succeeded' then
    operation_id:=v_operation.id;
    operation_status:=v_operation.status;
    verifier_status:=v_operation.verifier_status;
    idempotent_replay:=true;
    return next;
    return;
  end if;

  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id=p_execution_grant_id;

  if v_operation.status<>'authorized'
     or not found
     or v_grant.actor_key<>p_actor_key
     or v_grant.operation_key<>'registry.draft_identity.reconcile'
     or v_grant.operation_version<>1
     or v_grant.capability_key<>'reconcile_registry_draft_identity'
     or v_grant.max_rows<>1
     or v_grant.policy_ruleset_version<>
        'registry-reviewed-admission-identity-v1'
  then
    raise exception using errcode='42501',
      message='Execution grant is not a reviewed draft identity reconciliation grant.';
  end if;

  select target.*
  into v_target
  from platform_private.registry_execution_grant_targets target
  where target.execution_grant_id=v_grant.id;

  if not found
     or v_target.subject_type not in ('track','release')
     or v_target.expected_state_fingerprint is null
     or (
       select count(*)
       from platform_private.registry_execution_grant_targets target_count
       where target_count.execution_grant_id=v_grant.id
     )<>1
  then
    raise exception using errcode='42501',
      message='Draft identity reconciliation requires one exact existing Track or Release.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=(v_grant.plan_payload->>'evidence_assertion_id')::uuid;

  if not found
     or v_evidence.assertion_fingerprint is distinct from
        v_grant.plan_payload->>'evidence_assertion_fingerprint'
     or v_evidence.recorded_by_principal_key is distinct from
        v_grant.issued_by_principal_key
  then
    raise exception using errcode='42501',
      message='Reviewed draft identity evidence no longer satisfies the grant.';
  end if;

  select review.*
  into v_review
  from platform_private.registry_discography_review_plans review
  where review.id=(v_grant.plan_payload->>'review_plan_id')::uuid
    and review.reviewed_by_user_id=v_grant.issued_by_user_id;

  if not found
     or platform_private.registry_discography_observation_fingerprint_v1(
          v_review.frozen_plan
        )<>v_review.frozen_plan_fingerprint
  then
    raise exception using errcode='42501',
      message='Reviewed admission plan integrity changed before identity reconciliation.';
  end if;

  select value
  into v_child
  from jsonb_array_elements(v_review.frozen_plan->'operations')
  where value->>'ref'=v_grant.plan_payload->>'child_ref';

  if v_child is null
     or v_child->>'operation_key'<>'registry.draft_identity.reconcile'
     or v_child->>'subject_type'<>v_target.subject_type
     or (v_child->>'subject_id')::uuid<>v_target.subject_id
     or platform_private.registry_discography_observation_fingerprint_v1(
          v_child->'payload'
        ) is distinct from
        v_grant.plan_payload->>'child_payload_fingerprint'
  then
    raise exception using errcode='42501',
      message='Draft identity reconciliation drifted from the frozen review plan.';
  end if;

  v_payload:=v_child->'payload';
  v_current_slug:=v_payload->>'current_slug';
  v_canonical_slug:=v_payload->>'canonical_slug';
  v_identity_artist_id:=(v_payload->>'identity_artist_id')::uuid;

  if nullif(v_current_slug,'') is null
     or nullif(v_canonical_slug,'') is null
     or v_current_slug=v_canonical_slug
  then
    raise exception using errcode='22023',
      message='Draft identity reconciliation requires a real slug transition.';
  end if;

  v_current_fingerprint:=
    platform_private.registry_subject_state_fingerprint(
      v_target.subject_type,v_target.subject_id
    );

  if v_current_fingerprint is distinct from
     v_target.expected_state_fingerprint
  then
    raise exception using errcode='23514',
      message='Registry subject changed after draft identity reconciliation grant issuance.';
  end if;

  if v_target.subject_type='track' then
    if exists (
      select 1
      from public.registry_tracks other
      where other.id<>v_target.subject_id
        and other.status<>'archived'
        and other.slug=v_canonical_slug
        and exists (
          select 1
          from public.registry_track_artists credit
          where credit.track_id=other.id
            and credit.artist_id=v_identity_artist_id
            and credit.status<>'archived'
        )
    ) then
      raise exception using errcode='23505',
        message='Artist-scoped canonical Track slug collides before activation.';
    end if;

    update public.registry_tracks
    set slug=v_canonical_slug,updated_at=now()
    where id=v_target.subject_id
      and status='draft'
      and slug=v_current_slug;
  else
    if exists (
      select 1
      from public.registry_releases other
      where other.id<>v_target.subject_id
        and other.status<>'archived'
        and other.slug=v_canonical_slug
        and exists (
          select 1
          from public.registry_release_artists credit
          where credit.release_id=other.id
            and credit.artist_id=v_identity_artist_id
            and credit.status<>'archived'
        )
    ) then
      raise exception using errcode='23505',
        message='Artist-scoped canonical Release slug collides before activation.';
    end if;

    update public.registry_releases
    set slug=v_canonical_slug,updated_at=now()
    where id=v_target.subject_id
      and status='draft'
      and slug=v_current_slug;
  end if;

  get diagnostics v_rows=row_count;
  if v_rows<>1 then
    raise exception using errcode='40001',
      message='Draft identity reconciliation lost its exact one-row boundary.';
  end if;

  v_after_fingerprint:=
    platform_private.registry_subject_state_fingerprint(
      v_target.subject_type,v_target.subject_id
    );

  insert into public.registry_canonical_write_events (
    registry_entity_type,registry_entity_id,
    source_suggestion_id,source_table,
    field_name,target_path,before_value,after_value,
    action,status,actor
  )
  values (
    v_target.subject_type,
    v_target.subject_id::text,
    v_review.evidence_assertion_id::text,
    'platform_private.registry_evidence_assertions',
    'slug',
    case
      when v_target.subject_type='track'
        then 'public.registry_tracks.slug'
      else 'public.registry_releases.slug'
    end,
    jsonb_build_object('value',v_current_slug),
    jsonb_build_object(
      'value',v_canonical_slug,
      'review_plan_id',v_review.id,
      'policy_ruleset_version',
        'registry-reviewed-admission-identity-v1'
    ),
    'reconcile_draft_identity',
    'succeeded',
    'system:'||p_actor_key
  )
  returning id into v_event_id;

  insert into platform_private.registry_operation_write_events (
    operation_id,canonical_write_event_id
  )
  values (v_operation.id,v_event_id);

  update platform_private.registry_mutation_operations
  set
    affected_rows=1,
    status='succeeded',
    verifier_status='pending',
    result_payload=jsonb_build_object(
      'subject_type',v_target.subject_type,
      'subject_id',v_target.subject_id,
      'old_slug',v_current_slug,
      'new_slug',v_canonical_slug,
      'after_state_fingerprint',v_after_fingerprint,
      'canonical_write_event_id',v_event_id
    ),
    completed_at=now(),
    updated_at=now()
  where id=v_operation.id;

  operation_id:=v_operation.id;
  operation_status:='succeeded';
  verifier_status:='pending';
  idempotent_replay:=v_begin.idempotent_replay;
  return next;
end
$$;

create function
platform_private.verify_registry_reviewed_identity_reconciliation_v1(
  p_operation_id uuid
)
returns table (
  operation_id uuid,
  verifier_status text
)
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private
as $$
declare
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_target platform_private.registry_execution_grant_targets%rowtype;
  v_current_fingerprint text;
  v_event_count integer;
  v_failure text;
begin
  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=p_operation_id
  for update;

  if not found
     or v_operation.operation_key<>'registry.draft_identity.reconcile'
     or v_operation.operation_version<>1
  then
    raise exception using errcode='P0002',
      message='Reviewed draft identity reconciliation operation not found.';
  end if;

  if v_operation.verifier_status='passed' then
    operation_id:=v_operation.id;
    verifier_status:='passed';
    return next;
    return;
  end if;

  if v_operation.status<>'succeeded' or v_operation.affected_rows<>1 then
    v_failure:='operation_not_succeeded_exactly_once';
  end if;

  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id=v_operation.execution_grant_id;

  if v_failure is null and (
    not found
    or v_grant.policy_ruleset_version<>
       'registry-reviewed-admission-identity-v1'
  ) then
    v_failure:='execution_grant_mismatch';
  end if;

  if v_failure is null then
    select target.*
    into v_target
    from platform_private.registry_execution_grant_targets target
    where target.execution_grant_id=v_grant.id;

    if not found then
      v_failure:='exact_target_missing';
    end if;
  end if;

  if v_failure is null then
    if v_target.subject_type='track' then
      if not exists (
        select 1
        from public.registry_tracks track
        where track.id=v_target.subject_id
          and track.status='draft'
          and track.slug=v_operation.result_payload->>'new_slug'
      ) then
        v_failure:='canonical_track_draft_identity_mismatch';
      end if;
    elsif v_target.subject_type='release' then
      if not exists (
        select 1
        from public.registry_releases release
        where release.id=v_target.subject_id
          and release.status='draft'
          and release.slug=v_operation.result_payload->>'new_slug'
      ) then
        v_failure:='canonical_release_draft_identity_mismatch';
      end if;
    else
      v_failure:='subject_type_mismatch';
    end if;
  end if;

  if v_failure is null then
    v_current_fingerprint:=
      platform_private.registry_subject_state_fingerprint(
        v_target.subject_type,v_target.subject_id
      );

    if v_current_fingerprint is distinct from
       v_operation.result_payload->>'after_state_fingerprint'
    then
      v_failure:='canonical_state_changed_after_reconciliation';
    end if;
  end if;

  if v_failure is null then
    select count(*)::integer
    into v_event_count
    from platform_private.registry_operation_write_events link
    join public.registry_canonical_write_events event
      on event.id=link.canonical_write_event_id
    where link.operation_id=v_operation.id
      and event.registry_entity_type=v_target.subject_type
      and event.registry_entity_id=v_target.subject_id::text
      and event.field_name='slug'
      and event.action='reconcile_draft_identity'
      and event.status='succeeded'
      and event.actor='system:'||v_operation.actor_key;

    if v_event_count<>1 then
      v_failure:='canonical_write_event_causality_mismatch';
    end if;
  end if;

  if v_failure is null then
    update platform_private.registry_mutation_operations
    set
      verifier_status='passed',
      result_payload=result_payload||jsonb_build_object(
        'verification',
        jsonb_build_object('status','passed','verified_at',now())
      ),
      updated_at=now()
    where id=v_operation.id;

    operation_id:=v_operation.id;
    verifier_status:='passed';
    return next;
    return;
  end if;

  update platform_private.registry_mutation_operations
  set
    verifier_status='failed',
    error_code='registry_reviewed_identity_reconciliation_verification_failed',
    error_message=v_failure,
    result_payload=result_payload||jsonb_build_object(
      'verification',
      jsonb_build_object(
        'status','failed','reason',v_failure,'verified_at',now()
      )
    ),
    updated_at=now()
  where id=v_operation.id;

  operation_id:=v_operation.id;
  verifier_status:='failed';
  return next;
end
$$;


-- ---------------------------------------------------------------------------
-- Shared reviewed lifecycle primitive.
-- Discography composes the existing registry.track.activate/v1 vocabulary and
-- adds the matching registry.release.activate/v1 command. Track Intake keeps
-- its current wrapper until a separately guarded convergence.
-- ---------------------------------------------------------------------------

create function
platform_private.execute_registry_reviewed_lifecycle_v1(
  p_actor_key text,
  p_execution_grant_id uuid
)
returns table (
  operation_id uuid,
  operation_status text,
  verifier_status text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private
as $$
declare
  v_begin record;
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_target platform_private.registry_execution_grant_targets%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_review platform_private.registry_discography_review_plans%rowtype;
  v_child jsonb;
  v_payload jsonb;
  v_before_status text;
  v_after_fingerprint text;
  v_event_id uuid;
  v_rows integer;
begin
  select *
  into v_begin
  from platform_private.begin_registry_mutation_operation(
    p_actor_key,p_execution_grant_id
  );

  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=v_begin.operation_id
  for update;

  if v_begin.idempotent_replay and v_operation.status='succeeded' then
    operation_id:=v_operation.id;
    operation_status:=v_operation.status;
    verifier_status:=v_operation.verifier_status;
    idempotent_replay:=true;
    return next;
    return;
  end if;

  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id=p_execution_grant_id;

  if v_operation.status<>'authorized'
     or not found
     or v_grant.actor_key<>p_actor_key
     or v_grant.operation_key not in (
       'registry.track.activate',
       'registry.release.activate'
     )
     or v_grant.operation_version<>1
     or v_grant.max_rows<>1
     or v_grant.policy_ruleset_version<>
        'registry-reviewed-lifecycle-v1'
  then
    raise exception using errcode='42501',
      message='Execution grant is not a reviewed Registry lifecycle grant.';
  end if;

  if (
       v_grant.operation_key='registry.track.activate'
       and v_grant.capability_key<>'activate_registry_track'
     )
     or (
       v_grant.operation_key='registry.release.activate'
       and v_grant.capability_key<>'activate_registry_release'
     )
  then
    raise exception using errcode='42501',
      message='Reviewed Registry lifecycle operation/capability pair is invalid.';
  end if;

  select target.*
  into v_target
  from platform_private.registry_execution_grant_targets target
  where target.execution_grant_id=v_grant.id;

  if not found
     or v_target.expected_state_fingerprint is null
     or (
       v_grant.operation_key='registry.track.activate'
       and v_target.subject_type<>'track'
     )
     or (
       v_grant.operation_key='registry.release.activate'
       and v_target.subject_type<>'release'
     )
     or (
       select count(*)
       from platform_private.registry_execution_grant_targets target_count
       where target_count.execution_grant_id=v_grant.id
     )<>1
  then
    raise exception using errcode='42501',
      message='Reviewed Registry lifecycle grant has an invalid exact target.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=(v_grant.plan_payload->>'evidence_assertion_id')::uuid;

  if not found
     or v_evidence.assertion_fingerprint is distinct from
        v_grant.plan_payload->>'evidence_assertion_fingerprint'
     or v_evidence.recorded_by_principal_key is distinct from
        v_grant.issued_by_principal_key
  then
    raise exception using errcode='42501',
      message='Reviewed lifecycle evidence no longer satisfies the grant.';
  end if;

  select review.*
  into v_review
  from platform_private.registry_discography_review_plans review
  where review.id=(v_grant.plan_payload->>'review_plan_id')::uuid
    and review.reviewed_by_user_id=v_grant.issued_by_user_id;

  if not found
     or platform_private.registry_discography_observation_fingerprint_v1(
          v_review.frozen_plan
        )<>v_review.frozen_plan_fingerprint
  then
    raise exception using errcode='42501',
      message='Reviewed admission plan integrity changed before lifecycle transition.';
  end if;

  select value
  into v_child
  from jsonb_array_elements(v_review.frozen_plan->'operations')
  where value->>'ref'=v_grant.plan_payload->>'child_ref';

  if v_child is null
     or v_child->>'operation_key'<>v_grant.operation_key
     or v_child->>'subject_type'<>v_target.subject_type
     or (v_child->>'subject_id')::uuid<>v_target.subject_id
     or platform_private.registry_discography_observation_fingerprint_v1(
          v_child->'payload'
        ) is distinct from
        v_grant.plan_payload->>'child_payload_fingerprint'
  then
    raise exception using errcode='42501',
      message='Reviewed lifecycle transition drifted from the frozen plan.';
  end if;

  v_payload:=v_child->'payload';
  v_before_status:=v_payload->>'from_status';

  if v_before_status<>'draft'
     or v_payload->>'to_status'<>'active'
  then
    raise exception using errcode='22023',
      message='Reviewed active-ingest lifecycle requires draft to active.';
  end if;

  if platform_private.registry_subject_state_fingerprint(
       v_target.subject_type,v_target.subject_id
     ) is distinct from v_target.expected_state_fingerprint
  then
    raise exception using errcode='23514',
      message='Registry subject changed after lifecycle grant issuance.';
  end if;

  if v_target.subject_type='track' then
    update public.registry_tracks
    set status='active',updated_at=now()
    where id=v_target.subject_id
      and status=v_before_status;
  else
    if exists (
      select 1
      from public.registry_release_tracks membership
      join public.registry_tracks track
        on track.id=membership.track_id
      where membership.release_id=v_target.subject_id
        and membership.status<>'archived'
        and track.status<>'active'
    ) then
      raise exception using errcode='23514',
        message='Release activation requires every admitted member Track to be active.';
    end if;

    update public.registry_releases
    set status='active',updated_at=now()
    where id=v_target.subject_id
      and status=v_before_status;
  end if;

  get diagnostics v_rows=row_count;
  if v_rows<>1 then
    raise exception using errcode='40001',
      message='Reviewed lifecycle transition lost its exact one-row boundary.';
  end if;

  v_after_fingerprint:=
    platform_private.registry_subject_state_fingerprint(
      v_target.subject_type,v_target.subject_id
    );

  insert into public.registry_canonical_write_events (
    registry_entity_type,registry_entity_id,
    source_suggestion_id,source_table,
    field_name,target_path,before_value,after_value,
    action,status,actor
  )
  values (
    v_target.subject_type,
    v_target.subject_id::text,
    v_review.evidence_assertion_id::text,
    'platform_private.registry_evidence_assertions',
    'status',
    case
      when v_target.subject_type='track'
        then 'public.registry_tracks.status'
      else 'public.registry_releases.status'
    end,
    jsonb_build_object('status',v_before_status),
    jsonb_build_object(
      'status','active',
      'review_plan_id',v_review.id,
      'terminal_policy','active_ingest_v1'
    ),
    'activate',
    'succeeded',
    'system:'||p_actor_key
  )
  returning id into v_event_id;

  insert into platform_private.registry_operation_write_events (
    operation_id,canonical_write_event_id
  )
  values (v_operation.id,v_event_id);

  update platform_private.registry_mutation_operations
  set
    affected_rows=1,
    status='succeeded',
    verifier_status='pending',
    result_payload=jsonb_build_object(
      'subject_type',v_target.subject_type,
      'subject_id',v_target.subject_id,
      'before_status',v_before_status,
      'after_status','active',
      'after_state_fingerprint',v_after_fingerprint,
      'canonical_write_event_id',v_event_id
    ),
    completed_at=now(),
    updated_at=now()
  where id=v_operation.id;

  operation_id:=v_operation.id;
  operation_status:='succeeded';
  verifier_status:='pending';
  idempotent_replay:=v_begin.idempotent_replay;
  return next;
end
$$;

create function
platform_private.verify_registry_reviewed_lifecycle_v1(
  p_operation_id uuid
)
returns table (
  operation_id uuid,
  verifier_status text
)
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private
as $$
declare
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_target platform_private.registry_execution_grant_targets%rowtype;
  v_current_fingerprint text;
  v_event_count integer;
  v_failure text;
begin
  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=p_operation_id
  for update;

  if not found
     or v_operation.operation_key not in (
       'registry.track.activate',
       'registry.release.activate'
     )
     or v_operation.operation_version<>1
  then
    raise exception using errcode='P0002',
      message='Reviewed Registry lifecycle operation not found.';
  end if;

  if v_operation.verifier_status='passed' then
    operation_id:=v_operation.id;
    verifier_status:='passed';
    return next;
    return;
  end if;

  if v_operation.status<>'succeeded' or v_operation.affected_rows<>1 then
    v_failure:='operation_not_succeeded_exactly_once';
  end if;

  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id=v_operation.execution_grant_id;

  if v_failure is null and (
    not found
    or v_grant.policy_ruleset_version<>'registry-reviewed-lifecycle-v1'
  ) then
    v_failure:='execution_grant_mismatch';
  end if;

  if v_failure is null then
    select target.*
    into v_target
    from platform_private.registry_execution_grant_targets target
    where target.execution_grant_id=v_grant.id;

    if not found then
      v_failure:='exact_target_missing';
    end if;
  end if;

  if v_failure is null then
    if v_target.subject_type='track' then
      if not exists (
        select 1 from public.registry_tracks track
        where track.id=v_target.subject_id
          and track.status='active'
      ) then
        v_failure:='canonical_track_not_active';
      end if;
    elsif v_target.subject_type='release' then
      if not exists (
        select 1 from public.registry_releases release
        where release.id=v_target.subject_id
          and release.status='active'
      ) then
        v_failure:='canonical_release_not_active';
      elsif exists (
        select 1
        from public.registry_release_tracks membership
        join public.registry_tracks track
          on track.id=membership.track_id
        where membership.release_id=v_target.subject_id
          and membership.status<>'archived'
          and track.status<>'active'
      ) then
        v_failure:='canonical_release_has_non_active_member_track';
      end if;
    else
      v_failure:='subject_type_mismatch';
    end if;
  end if;

  if v_failure is null then
    v_current_fingerprint:=
      platform_private.registry_subject_state_fingerprint(
        v_target.subject_type,v_target.subject_id
      );

    if v_current_fingerprint is distinct from
       v_operation.result_payload->>'after_state_fingerprint'
    then
      v_failure:='canonical_state_changed_after_activation';
    end if;
  end if;

  if v_failure is null then
    select count(*)::integer
    into v_event_count
    from platform_private.registry_operation_write_events link
    join public.registry_canonical_write_events event
      on event.id=link.canonical_write_event_id
    where link.operation_id=v_operation.id
      and event.registry_entity_type=v_target.subject_type
      and event.registry_entity_id=v_target.subject_id::text
      and event.field_name='status'
      and event.action='activate'
      and event.status='succeeded'
      and event.before_value=jsonb_build_object('status','draft')
      and event.after_value->>'status'='active'
      and event.actor='system:'||v_operation.actor_key;

    if v_event_count<>1 then
      v_failure:='canonical_write_event_causality_mismatch';
    end if;
  end if;

  if v_failure is null then
    update platform_private.registry_mutation_operations
    set
      verifier_status='passed',
      result_payload=result_payload||jsonb_build_object(
        'verification',
        jsonb_build_object('status','passed','verified_at',now())
      ),
      updated_at=now()
    where id=v_operation.id;

    operation_id:=v_operation.id;
    verifier_status:='passed';
    return next;
    return;
  end if;

  update platform_private.registry_mutation_operations
  set
    verifier_status='failed',
    error_code='registry_reviewed_lifecycle_verification_failed',
    error_message=v_failure,
    result_payload=result_payload||jsonb_build_object(
      'verification',
      jsonb_build_object(
        'status','failed','reason',v_failure,'verified_at',now()
      )
    ),
    updated_at=now()
  where id=v_operation.id;

  operation_id:=v_operation.id;
  verifier_status:='failed';
  return next;
end
$$;

