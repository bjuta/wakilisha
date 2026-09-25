-- Public Music Identity Track-slug zero V2 clean replay verifier.
--
-- Read-only proof for the fresh data-backed Preview after:
--   1. migration replay,
--   2. exact 34-operation V2 rehearsal,
--   3. transaction rollback.
--
-- This verifier does not mutate Registry state.

do $verify$
declare
  v_executor text;
  v_verifier text;
  v_identity_noise integer;
  v_stale_blockers integer;
  v_candidate_count integer;
  v_candidate_fingerprint text;
begin
  if (
    select max(version)
    from supabase_migrations.schema_migrations
  ) <> '20260925141117'
  then
    raise exception
      'Track-slug zero Preview migration head drifted.';
  end if;

  if (
    select count(*)::integer
    from supabase_migrations.schema_migrations
  ) <> 182
  then
    raise exception
      'Track-slug zero Preview migration count drifted.';
  end if;

  if to_regprocedure(
       'mizizi_private.execute_stewardship_operation_v2(uuid)'
     ) is null
     or to_regprocedure(
       'mizizi_private.verify_stewardship_operation_v2(uuid)'
     ) is null
     or to_regprocedure(
       'mizizi_private.finalize_track_slug_zero_convergence_v1(uuid)'
     ) is null
  then
    raise exception
      'Track-slug zero V2 function surface is incomplete.';
  end if;

  if not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.execute_stewardship_operation_v2(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.verify_stewardship_operation_v2(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.finalize_track_slug_zero_convergence_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'mizizi_executor V2 authority is incomplete.';
  end if;

  if has_function_privilege(
       'authenticated',
       'mizizi_private.execute_stewardship_operation_v2(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'mizizi_private.execute_stewardship_operation_v2(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'mizizi_private.verify_stewardship_operation_v2(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'mizizi_private.verify_stewardship_operation_v2(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'Track-slug zero V2 private authority leaked.';
  end if;

  select pg_get_functiondef(
    'mizizi_private.execute_stewardship_operation_v2(uuid)'::regprocedure
  )
  into v_executor;

  select pg_get_functiondef(
    'mizizi_private.verify_stewardship_operation_v2(uuid)'::regprocedure
  )
  into v_verifier;

  if position(
       'update public.community_threads'
       in lower(v_executor)
     ) = 0
     or position(
       'entity_id=v_track_id::text'
       in regexp_replace(
         lower(v_executor),
         '[[:space:]]+',
         '',
         'g'
       )
     ) = 0
     or position(
       'insert into public.wk_slug_redirects'
       in lower(v_executor)
     ) > 0
     or position(
       'update public.wk_slug_redirects'
       in lower(v_executor)
     ) > 0
     or position(
       'delete from public.wk_slug_redirects'
       in lower(v_executor)
     ) > 0
  then
    raise exception
      'Track-slug V2 executor pointer/redirect contract drifted.';
  end if;

  if position(
       'community_thread_track_pointer_mismatch'
       in v_verifier
     ) = 0
     or position(
       'thread_row.entity_id=v_track_id::text'
       in regexp_replace(
         lower(v_verifier),
         '[[:space:]]+',
         '',
         'g'
       )
     ) = 0
     or position(
       'canonical_write_event_causality_mismatch'
       in v_verifier
     ) = 0
  then
    raise exception
      'Track-slug V2 verifier contract drifted.';
  end if;

  if exists (
    select 1
    from platform_private.registry_operation_types
    where operation_key='registry.track_slug.canonicalize'
      and operation_version=1
      and enabled
  )
  or exists (
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
  )
  then
    raise exception
      'MIZIZI Track-slug authority is not zero at rest.';
  end if;

  select count(*)::integer
  into v_identity_noise
  from public.registry_review_items review
  where review.status='open'
    and review.review_type='mizizi_data_hygiene'
    and review.entity_type='track'
    and review.source_payload->>'ruleId'=
        'track_slug_identity_noise';

  select count(*)::integer
  into v_stale_blockers
  from public.registry_review_items review
  where review.status='open'
    and review.review_type='mizizi_data_hygiene'
    and review.entity_type='track'
    and review.source_payload->>'ruleId'=
        'track_slug_identity_noise'
    and (
      review.source_payload->'evidence'->>'collision'
        like
        'candidate_slug_collides_with_current_community_thread:%'
      or review.source_payload->'evidence'->>'collision'
        like
        'current_community_thread_ownership_ambiguous:%'
    );

  if v_identity_noise <> 66
     or v_stale_blockers <> 34
  then
    raise exception
      'Rollback state drifted: identity_noise %, stale_blockers %.',
      v_identity_noise,
      v_stale_blockers;
  end if;

  with primary_artist as (
    select distinct on (credit.track_id)
      credit.track_id,
      credit.artist_slug
    from public.registry_track_artists credit
    where credit.status='active'
      and credit.is_primary is true
      and credit.artist_id is not null
      and nullif(btrim(credit.artist_slug),'') is not null
    order by
      credit.track_id,
      credit.credit_order nulls last,
      credit.created_at,
      credit.id
  ),
  candidate as (
    select
      review.id::text as review_id,
      track.id::text as track_id,
      track.slug as current_slug,
      review.candidate_payload->>'proposedValue' as proposed_slug,
      artist.artist_slug,
      review.source_payload->'evidence'->>'collision'
        as stale_blocker,
      platform_private.registry_subject_state_fingerprint(
        'track',
        track.id
      ) as state_fingerprint
    from public.registry_review_items review
    join public.registry_tracks track
      on track.id::text=review.source_id
     and track.status='active'
    join primary_artist artist
      on artist.track_id=track.id
    where review.status='open'
      and review.review_type='mizizi_data_hygiene'
      and review.entity_type='track'
      and review.source_payload->>'ruleId'=
          'track_slug_identity_noise'
      and (
        review.source_payload->'evidence'->>'collision'
          like
          'candidate_slug_collides_with_current_community_thread:%'
        or review.source_payload->'evidence'->>'collision'
          like
          'current_community_thread_ownership_ambiguous:%'
      )
  ),
  payload as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'review_id',review_id,
          'track_id',track_id,
          'current_slug',current_slug,
          'proposed_slug',proposed_slug,
          'artist_slug',artist_slug,
          'stale_blocker',stale_blocker,
          'state_fingerprint',state_fingerprint
        )
        order by track_id
      ),
      '[]'::jsonb
    ) body
    from candidate
  )
  select
    jsonb_array_length(body)::integer,
    encode(
      extensions.digest(
        body::text,
        'sha256'
      ),
      'hex'
    )
  into
    v_candidate_count,
    v_candidate_fingerprint
  from payload;

  if v_candidate_count <> 34
     or v_candidate_fingerprint <>
        '1f178ed3aff1ac2ba998eefec42ac1f8abdb62ed4e70a93471715552399f5669'
  then
    raise exception
      'Frozen Track-slug zero candidate manifest drifted.';
  end if;
end
$verify$;

select
  'PUBLIC_MUSIC_IDENTITY_TRACK_SLUG_ZERO_V2_REPLAY_PASS'
  as result;
