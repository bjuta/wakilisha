-- Public Music Identity Slice 3 — one-track Release / Single identity alignment.
--
-- Aligns only safe internal Single Release slugs to their one canonical Track.
-- A collision-free Release community thread may move to the Track identity in
-- place. Track identity, Release membership, and redirect history never mutate.
-- Ambiguous Single identity / Community state fails closed into human review.

begin;
set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'public-music-identity-slice3-release-single-alignment-v1',
    0
  )
);

do $preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version='20260925050859'
      and name='public_music_identity_slice2_review_broker_regex_fix'
  ) then
    raise exception
      'STOP: Public Music Identity Slice 2 review authority is required';
  end if;

  if to_regclass('public.registry_releases') is null
     or to_regclass('public.registry_tracks') is null
     or to_regclass('public.registry_release_tracks') is null
     or to_regclass('public.registry_release_artists') is null
     or to_regclass('public.registry_track_artists') is null
     or to_regclass('public.registry_review_items') is null
     or to_regclass('public.community_threads') is null
     or to_regclass('public.community_saves') is null
     or to_regclass('public.audience_interests') is null
     or to_regclass('public.community_activity') is null
     or to_regclass('public.community_contributions') is null
     or to_regclass('public.community_notifications') is null
     or to_regclass('public.signal_os_content_opportunities') is null
     or to_regclass('public.registry_canonical_write_events') is null
     or to_regclass('platform_private.registry_operation_types') is null
     or to_regclass('platform_private.registry_execution_grants') is null
     or to_regclass('platform_private.registry_execution_grant_targets') is null
     or to_regclass('platform_private.registry_mutation_operations') is null
     or to_regclass('platform_private.registry_operation_write_events') is null
     or to_regprocedure('mizizi_private.assert_executor_v1()') is null
     or to_regprocedure('platform_private.registry_plan_fingerprint(jsonb)') is null
     or to_regprocedure(
          'platform_private.registry_subject_state_fingerprint(text,uuid)'
        ) is null
     or to_regprocedure(
          'platform_private.begin_registry_mutation_operation(text,uuid)'
        ) is null
     or to_regprocedure('public.current_user_has_capability(text)') is null
  then
    raise exception
      'STOP: Registry/MIZIZI governance dependencies are incomplete';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants
    where actor_key='mizizi'
      and status='active'
  )
  or exists (
    select 1
    from platform_private.registry_execution_grants
    where actor_key='mizizi'
      and status='active'
      and consumed_at is null
  ) then
    raise exception
      'STOP: Release Single alignment migration requires zero MIZIZI authority at rest';
  end if;

  if exists (
    select 1
    from public.capability_definitions
    where capability_key='align_registry_release_single_identity'
  )
  or exists (
    select 1
    from platform_private.registry_operation_types
    where operation_key='registry.release_single_identity.align'
      and operation_version=1
  )
  or to_regprocedure(
       'mizizi_private.release_single_identity_state_fingerprint_v1(uuid)'
     ) is not null
  or to_regprocedure(
       'mizizi_private.release_single_identity_analysis_v1(uuid)'
     ) is not null
  or to_regprocedure(
       'mizizi_private.release_single_identity_candidate_v1(uuid)'
     ) is not null
  or to_regprocedure(
       'mizizi_private.release_single_identity_plan_v1(uuid)'
     ) is not null
  or to_regprocedure(
       'mizizi_private.release_single_identity_review_candidate_v1(uuid)'
     ) is not null
  or to_regprocedure(
       'mizizi_private.queue_release_single_identity_review_v1(uuid)'
     ) is not null
  or to_regprocedure(
       'mizizi_private.issue_release_single_identity_execution_grant_v1(uuid,text)'
     ) is not null
  or to_regprocedure(
       'mizizi_private.execute_release_single_identity_alignment_v1(uuid)'
     ) is not null
  or to_regprocedure(
       'mizizi_private.verify_release_single_identity_alignment_v1(uuid)'
     ) is not null
  or to_regprocedure(
       'mizizi_private.close_release_single_identity_authority_window_v1(uuid,text)'
     ) is not null
  or to_regprocedure(
       'public.admin_open_mizizi_release_single_identity_authority_v1(timestamptz,text)'
     ) is not null
  or to_regprocedure(
       'public.admin_revoke_mizizi_release_single_identity_authority_v1(uuid,text)'
     ) is not null
  then
    raise exception
      'STOP: Release Single identity alignment V1 already exists or namespace is occupied';
  end if;
end
$preflight$;

insert into public.capability_definitions (
  capability_key,
  label,
  description,
  domain
)
values (
  'align_registry_release_single_identity',
  'Align Registry Single public identity',
  'Align one reviewed-safe one-track Single Release slug to its canonical Track identity and move at most one collision-free Release community thread to that Track identity.',
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
values (
  'registry.release_single_identity.align',
  1,
  'align_registry_release_single_identity',
  'medium',
  array['release']::text[],
  true,
  1,
  2,
  300,
  false,
  true,
  false,
  'Align one exact safe one-track Single Release to its canonical Track public identity. One Release row and at most one collision-free community thread may change.'
);

create function mizizi_private.release_single_identity_state_fingerprint_v1(
  p_release_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, platform_private, extensions
as $$
declare
  v_track_id uuid;
  v_release_slug text;
  v_track_slug text;
  v_track_artist_id uuid;
  v_payload jsonb;
begin
  if p_release_id is null then
    return null;
  end if;

  select
    scope.track_id,
    release.slug,
    track.slug
  into
    v_track_id,
    v_release_slug,
    v_track_slug
  from public.registry_releases release
  join lateral (
    select
      count(distinct track.id) filter (
        where track.status='active'
      )::integer as active_track_count,
      (min(track.id::text) filter (
        where track.status='active'
      ))::uuid as track_id
    from public.registry_release_tracks membership
    left join public.registry_tracks track
      on track.id=membership.track_id
    where membership.release_id=release.id
      and membership.status='active'
  ) scope on true
  join public.registry_tracks track
    on track.id=scope.track_id
   and track.status='active'
  where release.id=p_release_id
    and release.status='active'
    and scope.active_track_count=1;

  if not found or v_track_id is null then
    return null;
  end if;

  select (min(credit.artist_id::text))::uuid
  into v_track_artist_id
  from public.registry_track_artists credit
  where credit.track_id=v_track_id
    and credit.status='active'
    and credit.is_primary is true
    and credit.artist_id is not null
    and nullif(btrim(credit.artist_slug),'') is not null;

  select jsonb_build_object(
    'release',(
      select to_jsonb(release)
      from public.registry_releases release
      where release.id=p_release_id
    ),
    'active_release_tracks',coalesce((
      select jsonb_agg(to_jsonb(membership) order by membership.id::text)
      from public.registry_release_tracks membership
      where membership.release_id=p_release_id
        and membership.status='active'
    ),'[]'::jsonb),
    'track',(
      select to_jsonb(track)
      from public.registry_tracks track
      where track.id=v_track_id
    ),
    'release_primary_credits',coalesce((
      select jsonb_agg(to_jsonb(credit) order by credit.id::text)
      from public.registry_release_artists credit
      where credit.release_id=p_release_id
        and credit.status='active'
        and credit.is_primary is true
    ),'[]'::jsonb),
    'track_primary_credits',coalesce((
      select jsonb_agg(to_jsonb(credit) order by credit.id::text)
      from public.registry_track_artists credit
      where credit.track_id=v_track_id
        and credit.status='active'
        and credit.is_primary is true
    ),'[]'::jsonb),
    'open_track_identity_reviews',coalesce((
      select jsonb_agg(to_jsonb(review) order by review.id::text)
      from public.registry_review_items review
      where review.review_type='mizizi_data_hygiene'
        and review.status='open'
        and review.entity_type='track'
        and review.source_id=v_track_id::text
        and review.source_payload->>'ruleId' in (
          'track_slug_identity_noise',
          'track_slug_credit_evidence_gap',
          'track_recording_identity_conflict'
        )
    ),'[]'::jsonb),
    'other_active_single_memberships',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'membership',to_jsonb(other_membership),
          'release',to_jsonb(other_release)
        )
        order by other_membership.id::text
      )
      from public.registry_release_tracks other_membership
      join public.registry_releases other_release
        on other_release.id=other_membership.release_id
       and other_release.status='active'
      where other_membership.track_id=v_track_id
        and other_membership.status='active'
        and other_membership.release_id<>p_release_id
        and 1=(
          select count(distinct other_track.id)
          from public.registry_release_tracks other_row
          join public.registry_tracks other_track
            on other_track.id=other_row.track_id
           and other_track.status='active'
          where other_row.release_id=other_membership.release_id
            and other_row.status='active'
        )
    ),'[]'::jsonb),
    'same_artist_target_slug_conflicts',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'release',to_jsonb(other_release),
          'credit',to_jsonb(other_credit)
        )
        order by other_release.id::text,other_credit.id::text
      )
      from public.registry_releases other_release
      join public.registry_release_artists other_credit
        on other_credit.release_id=other_release.id
       and other_credit.status='active'
       and other_credit.is_primary is true
      where other_release.status='active'
        and other_release.id<>p_release_id
        and other_credit.artist_id=v_track_artist_id
        and other_release.slug=v_track_slug
    ),'[]'::jsonb),
    'release_threads',coalesce((
      select jsonb_agg(to_jsonb(thread_row) order by thread_row.id::text)
      from public.community_threads thread_row
      where thread_row.entity_type='release'
        and thread_row.entity_id=p_release_id::text
    ),'[]'::jsonb),
    'track_threads',coalesce((
      select jsonb_agg(to_jsonb(thread_row) order by thread_row.id::text)
      from public.community_threads thread_row
      where thread_row.entity_type='track'
        and thread_row.entity_id=v_track_id::text
    ),'[]'::jsonb),
    'release_saves',coalesce((
      select jsonb_agg(to_jsonb(pointer) order by pointer.id::text)
      from public.community_saves pointer
      where pointer.entity_type='release'
        and pointer.entity_id=p_release_id::text
    ),'[]'::jsonb),
    'release_interests',coalesce((
      select jsonb_agg(to_jsonb(pointer) order by pointer.id::text)
      from public.audience_interests pointer
      where pointer.entity_type='release'
        and pointer.entity_id=p_release_id
    ),'[]'::jsonb),
    'release_activity',coalesce((
      select jsonb_agg(to_jsonb(pointer) order by pointer.id::text)
      from public.community_activity pointer
      where pointer.entity_type='release'
        and pointer.entity_id=p_release_id::text
    ),'[]'::jsonb),
    'release_contributions',coalesce((
      select jsonb_agg(to_jsonb(pointer) order by pointer.id::text)
      from public.community_contributions pointer
      where pointer.entity_type='release'
        and pointer.entity_id=p_release_id::text
    ),'[]'::jsonb),
    'release_notifications',coalesce((
      select jsonb_agg(to_jsonb(pointer) order by pointer.id::text)
      from public.community_notifications pointer
      where pointer.entity_type='release'
        and pointer.entity_id=p_release_id::text
    ),'[]'::jsonb),
    'release_opportunities',coalesce((
      select jsonb_agg(to_jsonb(pointer) order by pointer.id::text)
      from public.signal_os_content_opportunities pointer
      where pointer.entity_type='release'
        and pointer.entity_slug=v_release_slug
    ),'[]'::jsonb)
  )
  into v_payload;

  return encode(
    extensions.digest(v_payload::text,'sha256'),
    'hex'
  );
end
$$;

create function mizizi_private.release_single_identity_analysis_v1(
  p_release_id uuid
)
returns table (
  release_id uuid,
  track_id uuid,
  current_release_slug text,
  proposed_release_slug text,
  release_primary_artist_id uuid,
  release_primary_artist_slug text,
  track_primary_artist_id uuid,
  track_primary_artist_slug text,
  current_release_path text,
  canonical_track_path text,
  release_thread_id uuid,
  track_thread_id uuid,
  reason_codes text[],
  disposition text,
  expected_release_state_fingerprint text,
  expected_track_state_fingerprint text,
  alignment_state_fingerprint text,
  expected_row_budget integer
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, platform_private, mizizi_private
as $$
begin
  perform mizizi_private.assert_executor_v1();

  return query
  with release_scope as (
    select
      release.id,
      release.slug,
      lower(coalesce(btrim(release.release_type),'')) as release_type,
      count(distinct track.id) filter (
        where track.status='active'
      )::integer as active_track_count,
      (min(track.id::text) filter (
        where track.status='active'
      ))::uuid as track_id
    from public.registry_releases release
    left join public.registry_release_tracks membership
      on membership.release_id=release.id
     and membership.status='active'
    left join public.registry_tracks track
      on track.id=membership.track_id
    where release.id=p_release_id
      and release.status='active'
    group by release.id,release.slug,release.release_type
  ),
  base as (
    select
      scope.id as release_id,
      scope.slug as release_slug,
      scope.track_id,
      track.slug as track_slug,
      scope.release_type,
      scope.active_track_count,
      (
        select count(distinct credit.artist_id)::integer
        from public.registry_track_artists credit
        where credit.track_id=scope.track_id
          and credit.status='active'
          and credit.is_primary is true
          and credit.artist_id is not null
          and nullif(btrim(credit.artist_slug),'') is not null
      ) as track_primary_id_count,
      (
        select count(distinct credit.artist_slug)::integer
        from public.registry_track_artists credit
        where credit.track_id=scope.track_id
          and credit.status='active'
          and credit.is_primary is true
          and credit.artist_id is not null
          and nullif(btrim(credit.artist_slug),'') is not null
      ) as track_primary_slug_count,
      (
        select (min(credit.artist_id::text))::uuid
        from public.registry_track_artists credit
        where credit.track_id=scope.track_id
          and credit.status='active'
          and credit.is_primary is true
          and credit.artist_id is not null
          and nullif(btrim(credit.artist_slug),'') is not null
      ) as track_artist_id,
      (
        select min(credit.artist_slug)
        from public.registry_track_artists credit
        where credit.track_id=scope.track_id
          and credit.status='active'
          and credit.is_primary is true
          and credit.artist_id is not null
          and nullif(btrim(credit.artist_slug),'') is not null
      ) as track_artist_slug,
      (
        select count(distinct credit.artist_id)::integer
        from public.registry_release_artists credit
        where credit.release_id=scope.id
          and credit.status='active'
          and credit.is_primary is true
          and credit.artist_id is not null
          and nullif(btrim(credit.artist_slug),'') is not null
      ) as release_primary_id_count,
      (
        select count(distinct credit.artist_slug)::integer
        from public.registry_release_artists credit
        where credit.release_id=scope.id
          and credit.status='active'
          and credit.is_primary is true
          and credit.artist_id is not null
          and nullif(btrim(credit.artist_slug),'') is not null
      ) as release_primary_slug_count,
      (
        select (min(credit.artist_id::text))::uuid
        from public.registry_release_artists credit
        where credit.release_id=scope.id
          and credit.status='active'
          and credit.is_primary is true
          and credit.artist_id is not null
          and nullif(btrim(credit.artist_slug),'') is not null
      ) as release_artist_id,
      (
        select min(credit.artist_slug)
        from public.registry_release_artists credit
        where credit.release_id=scope.id
          and credit.status='active'
          and credit.is_primary is true
          and credit.artist_id is not null
          and nullif(btrim(credit.artist_slug),'') is not null
      ) as release_artist_slug,
      (
        select count(*)::integer
        from public.community_threads thread_row
        where thread_row.entity_type='release'
          and thread_row.entity_id=scope.id::text
      ) as release_thread_count,
      (
        select min(thread_row.id::text)::uuid
        from public.community_threads thread_row
        where thread_row.entity_type='release'
          and thread_row.entity_id=scope.id::text
      ) as release_thread_id,
      (
        select count(*)::integer
        from public.community_threads thread_row
        where thread_row.entity_type='track'
          and thread_row.entity_id=scope.track_id::text
      ) as track_thread_count,
      (
        select min(thread_row.id::text)::uuid
        from public.community_threads thread_row
        where thread_row.entity_type='track'
          and thread_row.entity_id=scope.track_id::text
      ) as track_thread_id,
      exists (
        select 1
        from public.registry_review_items review
        where review.review_type='mizizi_data_hygiene'
          and review.status='open'
          and review.entity_type='track'
          and review.source_id=scope.track_id::text
          and review.source_payload->>'ruleId' in (
            'track_slug_identity_noise',
            'track_slug_credit_evidence_gap',
            'track_recording_identity_conflict'
          )
      ) as has_track_review
    from release_scope scope
    join public.registry_tracks track
      on track.id=scope.track_id
     and track.status='active'
    where scope.release_type='single'
      and scope.active_track_count=1
      and scope.slug ~* '(^|-)(feat|featuring|ft)(-|$)'
      and scope.slug is distinct from track.slug
  ),
  facts as (
    select
      base.*,
      '/releases/' ||
        coalesce(base.release_artist_slug,base.track_artist_slug,'') ||
        '/' ||
        base.release_slug as current_release_path,
      '/tracks/' ||
        coalesce(base.track_artist_slug,'') ||
        '/' ||
        base.track_slug as canonical_track_path,
      exists (
        select 1
        from public.registry_release_tracks other_membership
        join public.registry_releases other_release
          on other_release.id=other_membership.release_id
         and other_release.status='active'
        where other_membership.track_id=base.track_id
          and other_membership.status='active'
          and other_membership.release_id<>base.release_id
          and 1=(
            select count(distinct other_track.id)
            from public.registry_release_tracks other_row
            join public.registry_tracks other_track
              on other_track.id=other_row.track_id
             and other_track.status='active'
            where other_row.release_id=other_membership.release_id
              and other_row.status='active'
          )
      ) as duplicate_single,
      (
        base.release_primary_id_count<>1
        or base.release_primary_slug_count<>1
        or base.track_primary_id_count<>1
        or base.track_primary_slug_count<>1
        or base.release_artist_id is distinct from base.track_artist_id
        or base.release_artist_slug is distinct from base.track_artist_slug
      ) as artist_mismatch,
      (
        base.release_thread_count>0
        and base.track_thread_count>0
      ) as thread_collision,
      (
        base.release_thread_count>1
        or base.track_thread_count>1
      ) as thread_multiplicity,
      exists (
        select 1
        from public.registry_releases other_release
        join public.registry_release_artists other_credit
          on other_credit.release_id=other_release.id
         and other_credit.status='active'
         and other_credit.is_primary is true
        where other_release.status='active'
          and other_release.id<>base.release_id
          and other_credit.artist_id=base.track_artist_id
          and other_release.slug=base.track_slug
      ) as target_slug_collision,
      (
        exists (
          select 1
          from public.community_saves pointer
          where pointer.entity_type='release'
            and pointer.entity_id=base.release_id::text
        )
        or exists (
          select 1
          from public.audience_interests pointer
          where pointer.entity_type='release'
            and pointer.entity_id=base.release_id
        )
        or exists (
          select 1
          from public.community_activity pointer
          where pointer.entity_type='release'
            and pointer.entity_id=base.release_id::text
        )
        or exists (
          select 1
          from public.community_contributions pointer
          where pointer.entity_type='release'
            and pointer.entity_id=base.release_id::text
        )
        or exists (
          select 1
          from public.community_notifications pointer
          where pointer.entity_type='release'
            and pointer.entity_id=base.release_id::text
        )
        or exists (
          select 1
          from public.signal_os_content_opportunities pointer
          where pointer.entity_type='release'
            and pointer.entity_slug=base.release_slug
        )
      ) as unsupported_pointer
    from base
  ),
  shaped as (
    select
      facts.*,
      (
        facts.release_thread_id is not null
        and exists (
          select 1
          from public.community_threads thread_row
          where thread_row.id=facts.release_thread_id
            and (
              thread_row.entity_slug is distinct from facts.release_slug
              or regexp_replace(
                   regexp_replace(
                     split_part(coalesce(thread_row.entity_url,''),'?',1),
                     '^https?://(www\.)?wakilisha\.africa',
                     '',
                     'i'
                   ),
                   '/+$',
                   ''
                 )
                 is distinct from facts.current_release_path
            )
        )
      ) as release_thread_path_mismatch,
      (
        facts.track_thread_id is not null
        and exists (
          select 1
          from public.community_threads thread_row
          where thread_row.id=facts.track_thread_id
            and (
              thread_row.entity_slug is distinct from facts.track_slug
              or regexp_replace(
                   regexp_replace(
                     split_part(coalesce(thread_row.entity_url,''),'?',1),
                     '^https?://(www\.)?wakilisha\.africa',
                     '',
                     'i'
                   ),
                   '/+$',
                   ''
                 )
                 is distinct from facts.canonical_track_path
            )
        )
      ) as track_thread_path_mismatch
    from facts
  ),
  reasoned as (
    select
      shaped.*,
      array_remove(array[
        case when shaped.has_track_review then 'track_identity_review' end,
        case when shaped.duplicate_single then 'duplicate_single_identity' end,
        case when shaped.artist_mismatch then 'primary_artist_mismatch' end,
        case when shaped.thread_collision then 'community_thread_collision' end,
        case when shaped.thread_multiplicity then 'community_thread_multiplicity' end,
        case when shaped.target_slug_collision then 'release_slug_collision' end,
        case when shaped.unsupported_pointer then 'unsupported_release_pointer' end,
        case when shaped.release_thread_path_mismatch then 'release_thread_state_mismatch' end,
        case when shaped.track_thread_path_mismatch then 'track_thread_state_mismatch' end
      ]::text[],null) as reasons
    from shaped
  )
  select
    reasoned.release_id,
    reasoned.track_id,
    reasoned.release_slug,
    reasoned.track_slug,
    reasoned.release_artist_id,
    reasoned.release_artist_slug,
    reasoned.track_artist_id,
    reasoned.track_artist_slug,
    reasoned.current_release_path,
    reasoned.canonical_track_path,
    reasoned.release_thread_id,
    reasoned.track_thread_id,
    reasoned.reasons,
    case
      when reasoned.has_track_review then 'blocked'
      when cardinality(reasoned.reasons)>0 then 'review'
      else 'auto'
    end,
    platform_private.registry_subject_state_fingerprint(
      'release',
      reasoned.release_id
    ),
    platform_private.registry_subject_state_fingerprint(
      'track',
      reasoned.track_id
    ),
    mizizi_private.release_single_identity_state_fingerprint_v1(
      reasoned.release_id
    ),
    1 + case
      when reasoned.release_thread_id is null then 0
      else 1
    end
  from reasoned;
end
$$;

create function mizizi_private.release_single_identity_candidate_v1(
  p_release_id uuid
)
returns table (
  release_id uuid,
  track_id uuid,
  primary_artist_id uuid,
  primary_artist_slug text,
  current_release_slug text,
  proposed_release_slug text,
  current_release_path text,
  canonical_track_path text,
  release_thread_id uuid,
  track_thread_id uuid,
  expected_release_state_fingerprint text,
  expected_track_state_fingerprint text,
  alignment_state_fingerprint text,
  expected_row_budget integer
)
language plpgsql
stable
security definer
set search_path = pg_catalog, mizizi_private
as $$
begin
  perform mizizi_private.assert_executor_v1();

  return query
  select
    analysis.release_id,
    analysis.track_id,
    analysis.track_primary_artist_id,
    analysis.track_primary_artist_slug,
    analysis.current_release_slug,
    analysis.proposed_release_slug,
    analysis.current_release_path,
    analysis.canonical_track_path,
    analysis.release_thread_id,
    analysis.track_thread_id,
    analysis.expected_release_state_fingerprint,
    analysis.expected_track_state_fingerprint,
    analysis.alignment_state_fingerprint,
    analysis.expected_row_budget
  from mizizi_private.release_single_identity_analysis_v1(
    p_release_id
  ) analysis
  where analysis.disposition='auto'
    and analysis.expected_row_budget between 1 and 2;
end
$$;

create function mizizi_private.release_single_identity_plan_v1(
  p_release_id uuid
)
returns table (
  release_id uuid,
  track_id uuid,
  primary_artist_id uuid,
  primary_artist_slug text,
  current_release_slug text,
  proposed_release_slug text,
  current_release_path text,
  canonical_track_path text,
  release_thread_id uuid,
  track_thread_id uuid,
  expected_release_state_fingerprint text,
  expected_track_state_fingerprint text,
  alignment_state_fingerprint text,
  expected_row_budget integer
)
language plpgsql
stable
security definer
set search_path = pg_catalog, mizizi_private
as $$
declare
  v_rows integer;
begin
  perform mizizi_private.assert_executor_v1();

  return query
  select *
  from mizizi_private.release_single_identity_candidate_v1(
    p_release_id
  );

  get diagnostics v_rows=row_count;
  if v_rows<>1 then
    raise exception using errcode='P0002',
      message='Release is not an automatic Single identity alignment candidate.';
  end if;
end
$$;

create function mizizi_private.release_single_identity_review_candidate_v1(
  p_release_id uuid
)
returns table (
  release_id uuid,
  track_id uuid,
  current_release_slug text,
  proposed_release_slug text,
  release_primary_artist_id uuid,
  release_primary_artist_slug text,
  track_primary_artist_id uuid,
  track_primary_artist_slug text,
  current_release_path text,
  canonical_track_path text,
  release_thread_id uuid,
  track_thread_id uuid,
  reason_codes text[],
  alignment_state_fingerprint text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, mizizi_private
as $$
begin
  perform mizizi_private.assert_executor_v1();

  return query
  select
    analysis.release_id,
    analysis.track_id,
    analysis.current_release_slug,
    analysis.proposed_release_slug,
    analysis.release_primary_artist_id,
    analysis.release_primary_artist_slug,
    analysis.track_primary_artist_id,
    analysis.track_primary_artist_slug,
    analysis.current_release_path,
    analysis.canonical_track_path,
    analysis.release_thread_id,
    analysis.track_thread_id,
    analysis.reason_codes,
    analysis.alignment_state_fingerprint
  from mizizi_private.release_single_identity_analysis_v1(
    p_release_id
  ) analysis
  where analysis.disposition='review';
end
$$;

create function mizizi_private.queue_release_single_identity_review_v1(
  p_release_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, mizizi_private, extensions
as $$
declare
  v_candidate record;
  v_programme_candidate jsonb;
  v_fingerprint text;
  v_review_id uuid;
  v_existing_review_key text;
begin
  perform mizizi_private.assert_executor_v1();

  select *
  into v_candidate
  from mizizi_private.release_single_identity_review_candidate_v1(
    p_release_id
  );

  if not found then
    raise exception using errcode='P0002',
      message='Release has no current Single identity review candidate.';
  end if;

  v_programme_candidate:=jsonb_build_object(
    'release_id',v_candidate.release_id::text,
    'track_id',v_candidate.track_id::text,
    'current_release_slug',v_candidate.current_release_slug,
    'proposed_release_slug',v_candidate.proposed_release_slug,
    'release_primary_artist_id',v_candidate.release_primary_artist_id::text,
    'release_primary_artist_slug',v_candidate.release_primary_artist_slug,
    'track_primary_artist_id',v_candidate.track_primary_artist_id::text,
    'track_primary_artist_slug',v_candidate.track_primary_artist_slug,
    'current_release_path',v_candidate.current_release_path,
    'canonical_track_path',v_candidate.canonical_track_path,
    'release_thread_id',v_candidate.release_thread_id::text,
    'track_thread_id',v_candidate.track_thread_id::text,
    'reason_codes',to_jsonb(v_candidate.reason_codes),
    'alignment_state_fingerprint',v_candidate.alignment_state_fingerprint
  );

  v_fingerprint:=encode(
    extensions.digest(
      v_programme_candidate::text,
      'sha256'
    ),
    'hex'
  );

  select
    review.id,
    review.review_key
  into
    v_review_id,
    v_existing_review_key
  from public.registry_review_items review
  where review.review_type='mizizi_data_hygiene'
    and review.status='open'
    and review.entity_type='release'
    and review.source_id=v_candidate.release_id::text
    and review.source_payload->>'ruleId'=
      'release_single_identity_conflict'
  order by review.created_at,review.id
  limit 1
  for update;

  if found then
    if v_existing_review_key is distinct from
       'mizizi:'||v_fingerprint
    then
      raise exception using errcode='40001',
        message='Existing Release Single identity review no longer matches current evidence.';
    end if;
    return v_review_id;
  end if;

  insert into public.registry_review_items (
    review_key,
    entity_type,
    entity_id,
    review_type,
    priority,
    status,
    title,
    summary,
    source_table,
    source_id,
    source_payload,
    candidate_payload,
    created_at,
    updated_at
  )
  values (
    'mizizi:'||v_fingerprint,
    'release',
    v_candidate.release_id,
    'mizizi_data_hygiene',
    'high',
    'open',
    'MIZIZI found a Single public-identity conflict',
    'This one-track Release cannot automatically converge to its canonical Track presentation because current Registry or Community identity evidence conflicts.',
    'registry_releases',
    v_candidate.release_id::text,
    jsonb_build_object(
      'agent','mizizi',
      'ruleId','release_single_identity_conflict',
      'ruleVersion','1.4.0',
      'fieldName','public_identity',
      'currentValue',v_candidate.current_release_slug,
      'confidence',1,
      'reasonCodes',to_jsonb(v_candidate.reason_codes),
      'programmeCandidate',v_programme_candidate
    ),
    jsonb_build_object(
      'proposedValue',v_candidate.proposed_release_slug,
      'disposition','review'
    ),
    now(),
    now()
  )
  on conflict (review_key)
  do nothing
  returning id into v_review_id;

  if v_review_id is null then
    select review.id
    into v_review_id
    from public.registry_review_items review
    where review.review_key='mizizi:'||v_fingerprint;
  end if;

  if v_review_id is null then
    raise exception using errcode='23505',
      message='Release Single identity review could not be materialized idempotently.';
  end if;

  return v_review_id;
end
$$;

create function mizizi_private.issue_release_single_identity_execution_grant_v1(
  p_release_id uuid,
  p_idempotency_key text
)
returns table (
  execution_grant_id uuid,
  programme_candidate jsonb,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, mizizi_private, extensions
as $$
declare
  v_candidate record;
  v_operation platform_private.registry_operation_types%rowtype;
  v_standing platform_private.system_actor_capability_grants%rowtype;
  v_existing platform_private.registry_execution_grants%rowtype;
  v_programme_candidate jsonb;
  v_plan jsonb;
  v_plan_fingerprint text;
  v_target_fingerprint text;
  v_grant_id uuid;
  v_expires_at timestamptz;
begin
  perform mizizi_private.assert_executor_v1();

  if p_release_id is null
     or p_idempotency_key is null
     or p_idempotency_key !~
       '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  then
    raise exception using errcode='22023',
      message='Release id and bounded idempotency key are required.';
  end if;

  select *
  into v_candidate
  from mizizi_private.release_single_identity_plan_v1(
    p_release_id
  );

  v_programme_candidate:=jsonb_build_object(
    'release_id',v_candidate.release_id::text,
    'track_id',v_candidate.track_id::text,
    'primary_artist_id',v_candidate.primary_artist_id::text,
    'primary_artist_slug',v_candidate.primary_artist_slug,
    'current_release_slug',v_candidate.current_release_slug,
    'proposed_release_slug',v_candidate.proposed_release_slug,
    'current_release_path',v_candidate.current_release_path,
    'canonical_track_path',v_candidate.canonical_track_path,
    'release_thread_id',v_candidate.release_thread_id::text,
    'track_thread_id',v_candidate.track_thread_id::text,
    'expected_release_state_fingerprint',
      v_candidate.expected_release_state_fingerprint,
    'expected_track_state_fingerprint',
      v_candidate.expected_track_state_fingerprint,
    'alignment_state_fingerprint',
      v_candidate.alignment_state_fingerprint,
    'expected_row_budget',v_candidate.expected_row_budget
  );

  select operation.*
  into v_operation
  from platform_private.registry_operation_types operation
  where operation.operation_key=
        'registry.release_single_identity.align'
    and operation.operation_version=1
    and operation.capability_key=
        'align_registry_release_single_identity'
    and operation.enabled;

  if not found
     or v_operation.risk_class<>'medium'
     or v_operation.allowed_subject_types<>
        array['release']::text[]
     or not v_operation.requires_existing_target
     or v_operation.max_targets<>1
     or v_operation.max_rows_ceiling<>2
     or v_operation.max_grant_ttl_seconds<>300
     or v_operation.requires_human_approval
     or not v_operation.requires_verifier
  then
    raise exception using errcode='42501',
      message='Release Single identity operation is disabled or malformed.';
  end if;

  select standing.*
  into v_standing
  from platform_private.system_actor_capability_grants standing
  where standing.actor_key='mizizi'
    and standing.capability_key=
      'align_registry_release_single_identity'
    and standing.status='active'
    and standing.valid_from<=now()
    and standing.expires_at>now()
    and standing.revoked_at is null
    and standing.scope @> jsonb_build_object(
      'operation_key','registry.release_single_identity.align',
      'operation_version',1,
      'subject_type','release',
      'max_rows',2
    );

  if not found
     or (
       select count(*)
       from platform_private.system_actor_capability_grants standing
       where standing.actor_key='mizizi'
         and standing.status='active'
         and standing.valid_from<=now()
         and standing.expires_at>now()
         and standing.revoked_at is null
     )<>1
  then
    raise exception using errcode='42501',
      message='Exactly one matching human-issued MIZIZI Single identity authority window is required.';
  end if;

  v_plan:=jsonb_build_object(
    'operation_key','registry.release_single_identity.align',
    'operation_version',1,
    'target_ref',p_release_id::text,
    'programme_candidate',v_programme_candidate,
    'policy_ruleset_version',
      'public-music-identity-release-single-v1'
  );

  v_plan_fingerprint:=
    platform_private.registry_plan_fingerprint(v_plan);

  v_target_fingerprint:=encode(
    extensions.digest(
      jsonb_build_array(
        jsonb_build_object(
          'subject_type','release',
          'subject_id',p_release_id::text,
          'expected_state_fingerprint',
            v_candidate.expected_release_state_fingerprint
        )
      )::text,
      'sha256'
    ),
    'hex'
  );

  select grant_row.*
  into v_existing
  from platform_private.registry_execution_grants grant_row
  where grant_row.actor_key='mizizi'
    and grant_row.operation_key=
      'registry.release_single_identity.align'
    and grant_row.operation_version=1
    and grant_row.idempotency_key=p_idempotency_key;

  if found then
    if v_existing.plan_fingerprint<>v_plan_fingerprint
       or v_existing.target_set_fingerprint<>
          v_target_fingerprint
       or v_existing.system_actor_capability_grant_id<>
          v_standing.id
    then
      raise exception using errcode='23505',
        message='Release Single identity idempotency key is bound to different authority.';
    end if;

    execution_grant_id:=v_existing.id;
    programme_candidate:=v_programme_candidate;
    expires_at:=v_existing.expires_at;
    return next;
    return;
  end if;

  v_expires_at:=least(
    now()+interval '5 minutes',
    v_standing.expires_at
  );

  if v_expires_at<=now() then
    raise exception using errcode='42501',
      message='Release Single identity authority window expires too soon.';
  end if;

  insert into platform_private.registry_execution_grants (
    actor_key,
    capability_key,
    system_actor_capability_grant_id,
    operation_key,
    operation_version,
    plan_payload,
    plan_fingerprint,
    target_set_fingerprint,
    max_rows,
    idempotency_key,
    status,
    issued_by_user_id,
    issued_by_principal_key,
    policy_ruleset_version,
    required_user_capability_key,
    issued_at,
    expires_at
  )
  values (
    'mizizi',
    'align_registry_release_single_identity',
    v_standing.id,
    'registry.release_single_identity.align',
    1,
    v_plan,
    v_plan_fingerprint,
    v_target_fingerprint,
    v_candidate.expected_row_budget,
    p_idempotency_key,
    'active',
    null,
    'policy:public-music-identity-release-single-v1',
    'public-music-identity-release-single-v1',
    null,
    now(),
    v_expires_at
  )
  returning id into v_grant_id;

  insert into platform_private.registry_execution_grant_targets (
    execution_grant_id,
    subject_type,
    subject_id,
    expected_state_fingerprint
  )
  values (
    v_grant_id,
    'release',
    p_release_id,
    v_candidate.expected_release_state_fingerprint
  );

  execution_grant_id:=v_grant_id;
  programme_candidate:=v_programme_candidate;
  expires_at:=v_expires_at;
  return next;
end
$$;

create function mizizi_private.execute_release_single_identity_alignment_v1(
  p_execution_grant_id uuid
)
returns table (
  operation_id uuid,
  operation_status text,
  verifier_status text,
  idempotent_replay boolean,
  result_payload jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, mizizi_private
as $$
declare
  v_begin record;
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_plan jsonb;
  v_candidate jsonb;
  v_current record;
  v_release_id uuid;
  v_track_id uuid;
  v_primary_artist_id uuid;
  v_release_thread_id uuid;
  v_track_thread_id uuid;
  v_rows integer;
  v_release_rows integer;
  v_thread_rows integer:=0;
  v_event_id uuid;
  v_result jsonb;
begin
  perform mizizi_private.assert_executor_v1();

  select *
  into v_begin
  from platform_private.begin_registry_mutation_operation(
    'mizizi',
    p_execution_grant_id
  );

  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=v_begin.operation_id
  for update;

  if v_begin.idempotent_replay
     and v_operation.status='succeeded'
  then
    operation_id:=v_operation.id;
    operation_status:=v_operation.status;
    verifier_status:=v_operation.verifier_status;
    idempotent_replay:=true;
    result_payload:=v_operation.result_payload;
    return next;
    return;
  end if;

  select grant_row.*
  into v_grant
  from platform_private.registry_execution_grants grant_row
  where grant_row.id=p_execution_grant_id;

  if not found
     or v_operation.status<>'authorized'
     or v_grant.actor_key<>'mizizi'
     or v_grant.capability_key<>
        'align_registry_release_single_identity'
     or v_grant.operation_key<>
        'registry.release_single_identity.align'
     or v_grant.operation_version<>1
     or v_grant.max_rows not between 1 and 2
     or v_grant.policy_ruleset_version<>
        'public-music-identity-release-single-v1'
     or v_grant.issued_by_principal_key<>
        'policy:public-music-identity-release-single-v1'
     or v_grant.required_user_capability_key is not null
  then
    raise exception using errcode='42501',
      message='Execution grant is not Release Single identity V1 authority.';
  end if;

  v_plan:=v_grant.plan_payload;
  v_candidate:=v_plan->'programme_candidate';

  if v_plan->>'operation_key'<>
       'registry.release_single_identity.align'
     or (v_plan->>'operation_version')::integer<>1
     or v_plan->>'policy_ruleset_version'<>
        'public-music-identity-release-single-v1'
     or jsonb_typeof(v_candidate)<>'object'
  then
    raise exception using errcode='42501',
      message='Release Single identity execution plan is malformed.';
  end if;

  begin
    v_release_id:=(v_candidate->>'release_id')::uuid;
    v_track_id:=(v_candidate->>'track_id')::uuid;
    v_primary_artist_id:=(v_candidate->>'primary_artist_id')::uuid;
    v_release_thread_id:=
      nullif(v_candidate->>'release_thread_id','')::uuid;
    v_track_thread_id:=
      nullif(v_candidate->>'track_thread_id','')::uuid;
  exception when others then
    raise exception using errcode='22023',
      message='Release Single identity plan contains malformed UUID values.';
  end;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'mizizi:release-slug:'||v_primary_artist_id::text,
      0
    )
  );

  perform 1
  from public.registry_releases release
  where release.id=v_release_id
  for update;

  perform 1
  from public.registry_tracks track
  where track.id=v_track_id
  for update;

  perform 1
  from public.registry_release_tracks membership
  where membership.release_id=v_release_id
     or membership.track_id=v_track_id
  order by membership.id
  for update;

  perform 1
  from public.registry_release_artists credit
  where credit.release_id=v_release_id
  order by credit.id
  for update;

  perform 1
  from public.registry_track_artists credit
  where credit.track_id=v_track_id
  order by credit.id
  for update;

  perform 1
  from public.community_threads thread_row
  where (
      thread_row.entity_type='release'
      and thread_row.entity_id=v_release_id::text
    )
    or (
      thread_row.entity_type='track'
      and thread_row.entity_id=v_track_id::text
    )
  order by thread_row.id
  for update;

  select *
  into v_current
  from mizizi_private.release_single_identity_plan_v1(
    v_release_id
  );

  if v_current.release_id::text is distinct from
       v_candidate->>'release_id'
     or v_current.track_id::text is distinct from
        v_candidate->>'track_id'
     or v_current.primary_artist_id::text is distinct from
        v_candidate->>'primary_artist_id'
     or v_current.primary_artist_slug is distinct from
        v_candidate->>'primary_artist_slug'
     or v_current.current_release_slug is distinct from
        v_candidate->>'current_release_slug'
     or v_current.proposed_release_slug is distinct from
        v_candidate->>'proposed_release_slug'
     or v_current.current_release_path is distinct from
        v_candidate->>'current_release_path'
     or v_current.canonical_track_path is distinct from
        v_candidate->>'canonical_track_path'
     or v_current.release_thread_id::text is distinct from
        nullif(v_candidate->>'release_thread_id','')
     or v_current.track_thread_id::text is distinct from
        nullif(v_candidate->>'track_thread_id','')
     or v_current.expected_release_state_fingerprint
        is distinct from
        v_candidate->>'expected_release_state_fingerprint'
     or v_current.expected_track_state_fingerprint
        is distinct from
        v_candidate->>'expected_track_state_fingerprint'
     or v_current.alignment_state_fingerprint
        is distinct from
        v_candidate->>'alignment_state_fingerprint'
     or v_current.expected_row_budget<>
        (v_candidate->>'expected_row_budget')::integer
     or v_current.expected_row_budget<>v_grant.max_rows
  then
    raise exception using errcode='40001',
      message='WK_STALE_RELEASE_SINGLE_IDENTITY: exact alignment plan changed after grant issuance.';
  end if;

  update platform_private.registry_mutation_operations
  set
    status='executing',
    started_at=coalesce(started_at,now()),
    updated_at=now()
  where id=v_operation.id;

  update public.registry_releases
  set
    slug=v_current.proposed_release_slug,
    updated_at=now()
  where id=v_release_id
    and status='active'
    and slug=v_current.current_release_slug;
  get diagnostics v_release_rows=row_count;

  if v_release_rows<>1 then
    raise exception using errcode='40001',
      message='Release Single identity compare-and-set lost its one-row Release boundary.';
  end if;

  if v_release_thread_id is not null then
    if v_track_thread_id is not null then
      raise exception using errcode='42501',
        message='Release Single identity cannot auto-merge two Community threads.';
    end if;

    update public.community_threads
    set
      entity_type='track',
      entity_id=v_track_id::text,
      entity_slug=v_current.proposed_release_slug,
      entity_url='https://wakilisha.africa'||
        v_current.canonical_track_path,
      updated_at=now()
    where id=v_release_thread_id
      and entity_type='release'
      and entity_id=v_release_id::text
      and entity_slug=v_current.current_release_slug;
    get diagnostics v_thread_rows=row_count;

    if v_thread_rows<>1 then
      raise exception using errcode='40001',
        message='Release Single identity thread move lost its one-row boundary.';
    end if;
  end if;

  v_rows:=v_release_rows+v_thread_rows;

  if v_rows<>v_grant.max_rows then
    raise exception using errcode='54000',
      message='Release Single identity operation exceeded or under-ran its exact row budget.';
  end if;

  insert into public.registry_canonical_write_events (
    registry_entity_type,
    registry_entity_id,
    source_suggestion_id,
    source_table,
    field_name,
    target_path,
    before_value,
    after_value,
    action,
    status,
    actor
  )
  values (
    'release',
    v_release_id::text,
    v_grant.idempotency_key,
    'mizizi_private.release_single_identity_plan_v1',
    'slug',
    'public.registry_releases.slug',
    jsonb_build_object(
      'value',v_current.current_release_slug,
      'release_thread_id',v_release_thread_id
    ),
    jsonb_build_object(
      'value',v_current.proposed_release_slug,
      'track_id',v_track_id,
      'track_primary_artist_slug',v_current.primary_artist_slug,
      'canonical_track_path',v_current.canonical_track_path,
      'thread_moved',v_release_thread_id is not null,
      'release_thread_id',v_release_thread_id,
      'redirects_created',0,
      'programme_candidate',v_candidate,
      'policy_ruleset_version',
        'public-music-identity-release-single-v1'
    ),
    'align_release_single_identity',
    'succeeded',
    'system:mizizi'
  )
  returning id into v_event_id;

  insert into platform_private.registry_operation_write_events (
    operation_id,
    canonical_write_event_id
  )
  values (
    v_operation.id,
    v_event_id
  );

  v_result:=jsonb_build_object(
    'release_id',v_release_id,
    'track_id',v_track_id,
    'old_release_slug',v_current.current_release_slug,
    'new_release_slug',v_current.proposed_release_slug,
    'canonical_track_path',v_current.canonical_track_path,
    'release_thread_id',v_release_thread_id,
    'thread_moved',v_release_thread_id is not null,
    'redirects_created',0,
    'canonical_write_event_id',v_event_id
  );

  update platform_private.registry_mutation_operations
  set
    affected_rows=v_rows,
    status='succeeded',
    verifier_status='pending',
    result_payload=v_result,
    completed_at=now(),
    updated_at=now()
  where id=v_operation.id;

  operation_id:=v_operation.id;
  operation_status:='succeeded';
  verifier_status:='pending';
  idempotent_replay:=v_begin.idempotent_replay;
  result_payload:=v_result;
  return next;
end
$$;

create function mizizi_private.verify_release_single_identity_alignment_v1(
  p_operation_id uuid
)
returns table (
  operation_id uuid,
  verifier_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, mizizi_private
as $$
declare
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_plan jsonb;
  v_candidate jsonb;
  v_release_id uuid;
  v_track_id uuid;
  v_release_thread_id uuid;
  v_track_thread_id uuid;
  v_event public.registry_canonical_write_events%rowtype;
  v_link_count integer;
  v_failure text;
begin
  perform mizizi_private.assert_executor_v1();

  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=p_operation_id
  for update;

  if not found
     or v_operation.actor_key<>'mizizi'
     or v_operation.capability_key<>
        'align_registry_release_single_identity'
     or v_operation.operation_key<>
        'registry.release_single_identity.align'
     or v_operation.operation_version<>1
  then
    raise exception using errcode='P0002',
      message='Release Single identity operation not found.';
  end if;

  if v_operation.verifier_status='passed' then
    operation_id:=v_operation.id;
    verifier_status:='passed';
    return next;
    return;
  end if;

  select grant_row.*
  into v_grant
  from platform_private.registry_execution_grants grant_row
  where grant_row.id=v_operation.execution_grant_id;

  if v_operation.status<>'succeeded'
     or not found
     or v_operation.affected_rows<>v_operation.max_rows
     or v_operation.affected_rows not between 1 and 2
     or v_grant.policy_ruleset_version<>
        'public-music-identity-release-single-v1'
  then
    v_failure:='operation_status_or_row_budget_mismatch';
  end if;

  if v_failure is null then
    v_plan:=v_grant.plan_payload;
    v_candidate:=v_plan->'programme_candidate';

    begin
      v_release_id:=(v_candidate->>'release_id')::uuid;
      v_track_id:=(v_candidate->>'track_id')::uuid;
      v_release_thread_id:=
        nullif(v_candidate->>'release_thread_id','')::uuid;
      v_track_thread_id:=
        nullif(v_candidate->>'track_thread_id','')::uuid;
    exception when others then
      v_failure:='programme_candidate_malformed';
    end;
  end if;

  if v_failure is null
     and not exists (
       select 1
       from public.registry_releases release
       where release.id=v_release_id
         and release.status='active'
         and release.slug=
           v_candidate->>'proposed_release_slug'
     )
  then
    v_failure:='canonical_release_slug_mismatch';
  end if;

  if v_failure is null
     and (
       select count(distinct track.id)
       from public.registry_release_tracks membership
       join public.registry_tracks track
         on track.id=membership.track_id
        and track.status='active'
       where membership.release_id=v_release_id
         and membership.status='active'
     )<>1
  then
    v_failure:='single_release_membership_mismatch';
  end if;

  if v_failure is null
     and not exists (
       select 1
       from public.registry_release_tracks membership
       where membership.release_id=v_release_id
         and membership.track_id=v_track_id
         and membership.status='active'
     )
  then
    v_failure:='canonical_track_membership_mismatch';
  end if;

  if v_failure is null
     and exists (
       select 1
       from public.community_threads thread_row
       where thread_row.entity_type='release'
         and thread_row.entity_id=v_release_id::text
     )
  then
    v_failure:=
      'release_thread_remained_after_track_convergence';
  end if;

  if v_failure is null
     and v_release_thread_id is not null
     and not exists (
       select 1
       from public.community_threads thread_row
       where thread_row.id=v_release_thread_id
         and thread_row.entity_type='track'
         and thread_row.entity_id=v_track_id::text
         and thread_row.entity_slug=
           v_candidate->>'proposed_release_slug'
         and regexp_replace(
               regexp_replace(
                 split_part(
                   coalesce(thread_row.entity_url,''),
                   '?',
                   1
                 ),
                 '^https?://(www\.)?wakilisha\.africa',
                 '',
                 'i'
               ),
               '/+$',
               ''
             )=
             v_candidate->>'canonical_track_path'
     )
  then
    v_failure:='moved_track_thread_identity_mismatch';
  end if;

  if v_failure is null
     and v_track_thread_id is not null
     and not exists (
       select 1
       from public.community_threads thread_row
       where thread_row.id=v_track_thread_id
         and thread_row.entity_type='track'
         and thread_row.entity_id=v_track_id::text
         and thread_row.entity_slug=
           v_candidate->>'proposed_release_slug'
         and regexp_replace(
               regexp_replace(
                 split_part(
                   coalesce(thread_row.entity_url,''),
                   '?',
                   1
                 ),
                 '^https?://(www\.)?wakilisha\.africa',
                 '',
                 'i'
               ),
               '/+$',
               ''
             )=
             v_candidate->>'canonical_track_path'
     )
  then
    v_failure:='existing_track_thread_identity_mismatch';
  end if;

  if v_failure is null
     and (
       exists (
         select 1
         from public.community_saves pointer
         where pointer.entity_type='release'
           and pointer.entity_id=v_release_id::text
       )
       or exists (
         select 1
         from public.audience_interests pointer
         where pointer.entity_type='release'
           and pointer.entity_id=v_release_id
       )
       or exists (
         select 1
         from public.community_activity pointer
         where pointer.entity_type='release'
           and pointer.entity_id=v_release_id::text
       )
       or exists (
         select 1
         from public.community_contributions pointer
         where pointer.entity_type='release'
           and pointer.entity_id=v_release_id::text
       )
       or exists (
         select 1
         from public.community_notifications pointer
         where pointer.entity_type='release'
           and pointer.entity_id=v_release_id::text
       )
     )
  then
    v_failure:='unsupported_release_pointer_remained';
  end if;

  if v_failure is null then
    select count(*)::integer
    into v_link_count
    from platform_private.registry_operation_write_events link
    where link.operation_id=v_operation.id;

    if v_link_count<>1 then
      v_failure='canonical_write_event_link_count_mismatch';
    end if;
  end if;

  if v_failure is null then
    select event.*
    into v_event
    from platform_private.registry_operation_write_events link
    join public.registry_canonical_write_events event
      on event.id=link.canonical_write_event_id
    where link.operation_id=v_operation.id
    limit 1;

    if not found
       or v_event.registry_entity_type<>'release'
       or v_event.registry_entity_id<>v_release_id::text
       or v_event.source_table<>
          'mizizi_private.release_single_identity_plan_v1'
       or v_event.field_name<>'slug'
       or v_event.target_path<>
          'public.registry_releases.slug'
       or v_event.action<>'align_release_single_identity'
       or v_event.status<>'succeeded'
       or v_event.actor<>'system:mizizi'
       or v_event.after_value->>'value'
          is distinct from
          v_candidate->>'proposed_release_slug'
       or v_event.after_value->>'canonical_track_path'
          is distinct from
          v_candidate->>'canonical_track_path'
       or v_event.after_value->'programme_candidate'
          is distinct from v_candidate
       or coalesce(
            (v_event.after_value->>'redirects_created')::integer,
            -1
          )<>0
    then
      v_failure='canonical_write_event_causality_mismatch';
    end if;
  end if;

  if v_failure is null then
    update platform_private.registry_mutation_operations
    set
      verifier_status='passed',
      result_payload=
        result_payload ||
        jsonb_build_object(
          'verification',
          jsonb_build_object(
            'status','passed',
            'verified_at',now()
          )
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
    error_code='release_single_identity_verification_failed',
    error_message=v_failure,
    result_payload=
      result_payload ||
      jsonb_build_object(
        'verification',
        jsonb_build_object(
          'status','failed',
          'reason',v_failure,
          'verified_at',now()
        )
      ),
    updated_at=now()
  where id=v_operation.id;

  operation_id:=v_operation.id;
  verifier_status:='failed';
  return next;
end
$$;

create function public.admin_open_mizizi_release_single_identity_authority_v1(
  p_expires_at timestamptz,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid:=auth.uid();
  v_grant_id uuid;
  v_before_enabled boolean;
begin
  if v_user_id is null
     or not coalesce(
       public.current_user_has_capability('manage_registry'),
       false
     )
  then
    raise exception using errcode='42501',
      message='manage_registry is required.';
  end if;

  if p_expires_at<now()+interval '35 minutes'
     or p_expires_at>now()+interval '24 hours'
     or nullif(btrim(p_reason),'') is null
     or octet_length(p_reason)>1000
  then
    raise exception using errcode='22023',
      message='A 35-minute to 24-hour expiry and bounded reason are required.';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants
    where actor_key='mizizi'
      and status='active'
  )
  or exists (
    select 1
    from platform_private.registry_execution_grants
    where actor_key='mizizi'
      and status='active'
      and consumed_at is null
  ) then
    raise exception using errcode='55000',
      message='MIZIZI authority is not zero at rest.';
  end if;

  select enabled
  into v_before_enabled
  from platform_private.registry_operation_types
  where operation_key='registry.release_single_identity.align'
    and operation_version=1
    and capability_key='align_registry_release_single_identity'
  for update;

  if not found or v_before_enabled then
    raise exception using errcode='55000',
      message='Release Single identity operation is missing or already enabled.';
  end if;

  update platform_private.registry_operation_types
  set
    enabled=true,
    updated_at=now()
  where operation_key='registry.release_single_identity.align'
    and operation_version=1;

  insert into platform_private.system_actor_capability_grants (
    actor_key,
    capability_key,
    scope,
    status,
    valid_from,
    expires_at,
    granted_by_user_id,
    grant_reason
  )
  values (
    'mizizi',
    'align_registry_release_single_identity',
    jsonb_build_object(
      'operation_key','registry.release_single_identity.align',
      'operation_version',1,
      'subject_type','release',
      'max_rows',2
    ),
    'active',
    now(),
    p_expires_at,
    v_user_id,
    btrim(p_reason)
  )
  returning id into v_grant_id;

  insert into public.registry_audit_log (
    actor_id,
    actor_label,
    action,
    entity_type,
    entity_id,
    before_value,
    after_value,
    metadata
  )
  values (
    v_user_id,
    'registry_admin',
    'open_mizizi_release_single_identity_authority',
    'system_actor_capability_grant',
    v_grant_id,
    jsonb_build_object('operation_enabled',false),
    jsonb_build_object(
      'operation_enabled',true,
      'actor_key','mizizi',
      'capability_key',
        'align_registry_release_single_identity',
      'expires_at',p_expires_at
    ),
    jsonb_build_object(
      'operation_key','registry.release_single_identity.align',
      'operation_version',1,
      'max_rows',2,
      'reason',btrim(p_reason)
    )
  );

  return v_grant_id;
end
$$;

create function public.admin_revoke_mizizi_release_single_identity_authority_v1(
  p_grant_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid:=auth.uid();
  v_standing platform_private.system_actor_capability_grants%rowtype;
begin
  if v_user_id is null
     or not coalesce(
       public.current_user_has_capability('manage_registry'),
       false
     )
  then
    raise exception using errcode='42501',
      message='manage_registry is required.';
  end if;

  if p_grant_id is null
     or nullif(btrim(p_reason),'') is null
     or octet_length(p_reason)>1000
  then
    raise exception using errcode='22023',
      message='Grant id and bounded revoke reason are required.';
  end if;

  select standing.*
  into v_standing
  from platform_private.system_actor_capability_grants standing
  where standing.id=p_grant_id
    and standing.actor_key='mizizi'
    and standing.capability_key=
      'align_registry_release_single_identity'
  for update;

  if not found or v_standing.status<>'active' then
    raise exception using errcode='P0002',
      message='Active Release Single identity authority grant not found.';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants grant_row
    join platform_private.registry_mutation_operations operation
      on operation.execution_grant_id=grant_row.id
    where grant_row.system_actor_capability_grant_id=p_grant_id
      and (
        operation.status in (
          'authorized',
          'executing',
          'compensating'
        )
        or (
          operation.status='succeeded'
          and operation.verifier_status<>'passed'
        )
      )
  ) then
    raise exception using errcode='55000',
      message='Cannot revoke Release Single identity authority while unsafe operation residue remains.';
  end if;

  update platform_private.registry_execution_grants
  set
    status='revoked',
    revoked_at=now(),
    revoked_by_user_id=v_user_id,
    revoke_reason=btrim(p_reason),
    updated_at=now()
  where system_actor_capability_grant_id=p_grant_id
    and actor_key='mizizi'
    and operation_key='registry.release_single_identity.align'
    and operation_version=1
    and status='active'
    and consumed_at is null;

  update platform_private.registry_operation_types
  set
    enabled=false,
    updated_at=now()
  where operation_key='registry.release_single_identity.align'
    and operation_version=1;

  update platform_private.system_actor_capability_grants
  set
    status='revoked',
    revoked_at=now(),
    revoked_by_user_id=v_user_id,
    revoke_reason=btrim(p_reason),
    updated_at=now()
  where id=p_grant_id
    and status='active';

  insert into public.registry_audit_log (
    actor_id,
    actor_label,
    action,
    entity_type,
    entity_id,
    before_value,
    after_value,
    metadata
  )
  values (
    v_user_id,
    'registry_admin',
    'revoke_mizizi_release_single_identity_authority',
    'system_actor_capability_grant',
    p_grant_id,
    jsonb_build_object(
      'status','active',
      'operation_enabled',true
    ),
    jsonb_build_object(
      'status','revoked',
      'operation_enabled',false
    ),
    jsonb_build_object(
      'operation_key','registry.release_single_identity.align',
      'operation_version',1,
      'reason',btrim(p_reason)
    )
  );

  return true;
end
$$;

create function mizizi_private.close_release_single_identity_authority_window_v1(
  p_capability_grant_id uuid,
  p_reason text
)
returns table (
  expired_exact_grants integer,
  operation_was_enabled boolean,
  standing_grant_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, mizizi_private
as $$
declare
  v_standing platform_private.system_actor_capability_grants%rowtype;
  v_expired integer:=0;
  v_operation_was_enabled boolean:=false;
  v_before_status text;
begin
  perform mizizi_private.assert_executor_v1();

  if p_capability_grant_id is null
     or nullif(btrim(p_reason),'') is null
     or octet_length(p_reason)>1000
  then
    raise exception using errcode='22023',
      message='Capability grant and bounded close reason are required.';
  end if;

  select standing.*
  into v_standing
  from platform_private.system_actor_capability_grants standing
  where standing.id=p_capability_grant_id
  for update;

  if not found
     or v_standing.actor_key<>'mizizi'
     or v_standing.capability_key<>
        'align_registry_release_single_identity'
     or v_standing.status not in (
       'active',
       'expired',
       'revoked'
     )
     or not (
       v_standing.scope @> jsonb_build_object(
         'operation_key','registry.release_single_identity.align',
         'operation_version',1,
         'subject_type','release',
         'max_rows',2
       )
     )
  then
    raise exception using errcode='42501',
      message='Capability grant does not bind Release Single identity authority.';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants grant_row
    join platform_private.registry_mutation_operations operation
      on operation.execution_grant_id=grant_row.id
    where grant_row.system_actor_capability_grant_id=
          p_capability_grant_id
      and (
        operation.status in (
          'authorized',
          'executing',
          'compensating'
        )
        or (
          operation.status='succeeded'
          and operation.verifier_status<>'passed'
        )
      )
  ) then
    raise exception using errcode='55000',
      message='Cannot close Release Single identity authority while unsafe operation residue remains.';
  end if;

  v_before_status:=v_standing.status;

  update platform_private.registry_execution_grants
  set
    status='expired',
    updated_at=now()
  where system_actor_capability_grant_id=
        p_capability_grant_id
    and actor_key='mizizi'
    and operation_key='registry.release_single_identity.align'
    and operation_version=1
    and status='active'
    and consumed_at is null
    and revoked_at is null;
  get diagnostics v_expired=row_count;

  select enabled
  into v_operation_was_enabled
  from platform_private.registry_operation_types
  where operation_key='registry.release_single_identity.align'
    and operation_version=1
  for update;

  if not found then
    raise exception using errcode='P0002',
      message='Release Single identity operation type is missing.';
  end if;

  if v_operation_was_enabled then
    update platform_private.registry_operation_types
    set
      enabled=false,
      updated_at=now()
    where operation_key='registry.release_single_identity.align'
      and operation_version=1;
  end if;

  if v_standing.status='active' then
    update platform_private.system_actor_capability_grants
    set
      status='expired',
      updated_at=now()
    where id=p_capability_grant_id
      and status='active';

    v_standing.status:='expired';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants
    where system_actor_capability_grant_id=
          p_capability_grant_id
      and status='active'
      and consumed_at is null
  )
  or exists (
    select 1
    from platform_private.registry_operation_types
    where operation_key='registry.release_single_identity.align'
      and operation_version=1
      and enabled
  )
  then
    raise exception using errcode='55000',
      message='Release Single identity authority remained active after close.';
  end if;

  if v_before_status is distinct from v_standing.status
     or v_operation_was_enabled
     or v_expired>0
  then
    insert into public.registry_audit_log (
      actor_id,
      actor_label,
      action,
      entity_type,
      entity_id,
      before_value,
      after_value,
      metadata
    )
    values (
      v_standing.granted_by_user_id,
      'system:mizizi',
      'close_mizizi_release_single_identity_authority',
      'system_actor_capability_grant',
      p_capability_grant_id,
      jsonb_build_object(
        'standing_grant_status',v_before_status,
        'operation_enabled',v_operation_was_enabled
      ),
      jsonb_build_object(
        'standing_grant_status',v_standing.status,
        'operation_enabled',false,
        'expired_exact_grants',v_expired
      ),
      jsonb_build_object(
        'operation_key','registry.release_single_identity.align',
        'operation_version',1,
        'reason',btrim(p_reason)
      )
    );
  end if;

  expired_exact_grants:=v_expired;
  operation_was_enabled:=v_operation_was_enabled;
  standing_grant_status:=v_standing.status;
  return next;
end
$$;

revoke all on function
  mizizi_private.release_single_identity_state_fingerprint_v1(uuid),
  mizizi_private.release_single_identity_analysis_v1(uuid),
  mizizi_private.release_single_identity_candidate_v1(uuid),
  mizizi_private.release_single_identity_plan_v1(uuid),
  mizizi_private.release_single_identity_review_candidate_v1(uuid),
  mizizi_private.queue_release_single_identity_review_v1(uuid),
  mizizi_private.issue_release_single_identity_execution_grant_v1(uuid,text),
  mizizi_private.execute_release_single_identity_alignment_v1(uuid),
  mizizi_private.verify_release_single_identity_alignment_v1(uuid),
  mizizi_private.close_release_single_identity_authority_window_v1(uuid,text)
from public, anon, authenticated, service_role;

grant execute on function
  mizizi_private.release_single_identity_analysis_v1(uuid),
  mizizi_private.release_single_identity_candidate_v1(uuid),
  mizizi_private.release_single_identity_plan_v1(uuid),
  mizizi_private.release_single_identity_review_candidate_v1(uuid),
  mizizi_private.queue_release_single_identity_review_v1(uuid),
  mizizi_private.issue_release_single_identity_execution_grant_v1(uuid,text),
  mizizi_private.execute_release_single_identity_alignment_v1(uuid),
  mizizi_private.verify_release_single_identity_alignment_v1(uuid),
  mizizi_private.close_release_single_identity_authority_window_v1(uuid,text)
to mizizi_executor;

revoke all on function
  public.admin_open_mizizi_release_single_identity_authority_v1(
    timestamptz,
    text
  ),
  public.admin_revoke_mizizi_release_single_identity_authority_v1(
    uuid,
    text
  )
from public, anon, authenticated, service_role;

grant execute on function
  public.admin_open_mizizi_release_single_identity_authority_v1(
    timestamptz,
    text
  ),
  public.admin_revoke_mizizi_release_single_identity_authority_v1(
    uuid,
    text
  )
to authenticated;

do $postflight$
declare
  v_executor text;
begin
  if not exists (
    select 1
    from platform_private.registry_operation_types operation
    where operation.operation_key=
          'registry.release_single_identity.align'
      and operation.operation_version=1
      and operation.capability_key=
          'align_registry_release_single_identity'
      and operation.risk_class='medium'
      and operation.allowed_subject_types=
          array['release']::text[]
      and operation.requires_existing_target
      and operation.max_targets=1
      and operation.max_rows_ceiling=2
      and operation.max_grant_ttl_seconds=300
      and not operation.requires_human_approval
      and operation.requires_verifier
      and not operation.enabled
  ) then
    raise exception
      'STOP: Release Single identity operation registry shape is not exact';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants
    where actor_key='mizizi'
      and status='active'
  )
  or exists (
    select 1
    from platform_private.registry_execution_grants
    where actor_key='mizizi'
      and status='active'
      and consumed_at is null
  ) then
    raise exception
      'STOP: Release Single identity migration created authority at rest';
  end if;

  if has_table_privilege(
       'mizizi_executor',
       'public.registry_releases',
       'UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_tracks',
       'UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_release_tracks',
       'UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.community_threads',
       'UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_review_items',
       'INSERT'
     )
  then
    raise exception
      'STOP: Release Single identity leaked direct mizizi_executor mutation authority';
  end if;

  if not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.execute_release_single_identity_alignment_v1(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.verify_release_single_identity_alignment_v1(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.queue_release_single_identity_review_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'mizizi_private.execute_release_single_identity_alignment_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'mizizi_private.execute_release_single_identity_alignment_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Release Single identity private function grants are not exact';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.admin_open_mizizi_release_single_identity_authority_v1(timestamptz,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_revoke_mizizi_release_single_identity_authority_v1(uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_open_mizizi_release_single_identity_authority_v1(timestamptz,text)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Release Single identity human authority grants are not exact';
  end if;

  select pg_get_functiondef(
    'mizizi_private.execute_release_single_identity_alignment_v1(uuid)'::regprocedure
  )
  into v_executor;

  if position(
       'update public.registry_releases'
       in lower(v_executor)
     )=0
     or position(
       'update public.community_threads'
       in lower(v_executor)
     )=0
     or position(
       'align_release_single_identity'
       in v_executor
     )=0
     or position(
       'redirects_created'
       in v_executor
     )=0
     or position('wk_slug_redirects' in v_executor)>0
     or position('date_fallback' in v_executor)>0
     or position(
       'update public.registry_tracks'
       in lower(v_executor)
     )>0
     or position(
       'update public.registry_release_tracks'
       in lower(v_executor)
     )>0
  then
    raise exception
      'STOP: Release Single identity executor mutation surface drifted';
  end if;
end
$postflight$;

commit;
