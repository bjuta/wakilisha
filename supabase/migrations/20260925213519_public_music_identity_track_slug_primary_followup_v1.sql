-- Public Music Identity Track-slug primary-scope follow-up V1.
--
-- Issue #1087.
--
-- This migration does not create a new mutation primitive. It reuses:
--   registry.track_slug.canonicalize/v1
--   canonicalize_registry_track_slug
--   mizizi_private.issue_stewardship_execution_grant_v1(...)
--   mizizi_private.execute_stewardship_operation_v2(uuid)
--   mizizi_private.verify_stewardship_operation_v2(uuid)
--   mizizi_private.close_stewardship_authority_window_v1(...)
--
-- It adds only:
--   1. the exact current five-row candidate manifest; and
--   2. the dedicated review/decision finalizer for that five-row tranche.

create or replace function
  mizizi_private.track_slug_primary_followup_candidate_v1()
returns table(
  review_id uuid,
  track_id uuid,
  current_slug text,
  proposed_slug text,
  primary_artist_slug text,
  expected_state_fingerprint text,
  primary_relation_id uuid,
  release_evidence_fingerprint text
)
language sql
stable
security definer
set search_path =
  pg_catalog,
  public,
  platform_private,
  mizizi_private,
  extensions
as $function$
  with review_scope as (
    select
      review.id as review_id,
      review.source_id::uuid as track_id,
      review.source_payload->>'currentValue'
        as historical_current_slug,
      review.candidate_payload->>'proposedValue'
        as historical_proposed_slug
    from public.registry_review_items review
    where review.status='open'
      and review.review_type='mizizi_data_hygiene'
      and review.entity_type='track'
      and review.source_payload->>'ruleId'=
          'track_slug_identity_noise'
      and review.source_payload->>'ruleVersion'='1.1.0'
      and review.source_payload->'evidence'->>'collision'=
          'missing_explicit_primary_artist_scope'
  ),
  resolved_primary as (
    select
      review.review_id,
      review.track_id,
      review.historical_current_slug,
      review.historical_proposed_slug,
      credit.id as primary_relation_id,
      credit.artist_slug as primary_artist_slug,
      credit.metadata->>'release_evidence_fingerprint'
        as release_evidence_fingerprint
    from review_scope review
    join lateral (
      select credit.*
      from public.registry_track_artists credit
      where credit.track_id=review.track_id
        and credit.status='active'
        and credit.is_primary is true
        and credit.is_featured is false
        and credit.artist_id is not null
        and credit.credit_order=1
        and credit.source='release_primary_review'
        and credit.confidence=100
        and credit.metadata->>'source_review_id'=
            review.review_id::text
        and credit.metadata->>'admission_contract'=
            'registry-release-primary-review-v1'
      order by credit.created_at,credit.id
      limit 1
    ) credit on true
    where (
      select count(*)::integer
      from public.registry_track_artists all_primary
      where all_primary.track_id=review.track_id
        and all_primary.status='active'
        and all_primary.is_primary is true
        and all_primary.artist_id is not null
    )=1
  ),
  current_candidate as (
    select
      resolved.review_id,
      resolved.track_id,
      candidate.current_slug,
      candidate.proposed_slug,
      candidate.primary_artist_slug,
      candidate.expected_state_fingerprint,
      resolved.primary_relation_id,
      resolved.release_evidence_fingerprint,
      resolved.historical_current_slug,
      resolved.historical_proposed_slug
    from resolved_primary resolved
    cross join lateral
      mizizi_private.track_slug_candidate_v1(
        resolved.track_id
      ) candidate
    where candidate.strong_noise is true
      and nullif(btrim(candidate.proposed_slug),'') is not null
      and nullif(btrim(candidate.primary_artist_slug),'') is not null
      and candidate.current_slug is distinct from
          candidate.proposed_slug
      and candidate.primary_artist_slug=
          resolved.primary_artist_slug
      and candidate.current_slug=
          resolved.historical_current_slug
      and candidate.proposed_slug=
          resolved.historical_proposed_slug
  )
  select
    candidate.review_id,
    candidate.track_id,
    candidate.current_slug,
    candidate.proposed_slug,
    candidate.primary_artist_slug,
    candidate.expected_state_fingerprint,
    candidate.primary_relation_id,
    candidate.release_evidence_fingerprint
  from current_candidate candidate
  where not exists (
    select 1
    from public.registry_tracks other_track
    cross join lateral
      mizizi_private.track_slug_candidate_v1(
        other_track.id
      ) other_candidate
    where other_track.status='active'
      and other_track.id<>candidate.track_id
      and other_candidate.primary_artist_slug=
          candidate.primary_artist_slug
      and other_candidate.proposed_slug=
          candidate.proposed_slug
  )
  and not exists (
    select 1
    from public.registry_release_tracks target_membership
    join public.registry_release_tracks sibling
      on sibling.release_id=target_membership.release_id
     and sibling.status='active'
    join public.registry_tracks other_track
      on other_track.id=sibling.track_id
     and other_track.status='active'
    where target_membership.track_id=candidate.track_id
      and target_membership.status='active'
      and other_track.id<>candidate.track_id
      and other_track.slug=candidate.proposed_slug
  )
  order by candidate.track_id
$function$;

revoke all on function
  mizizi_private.track_slug_primary_followup_candidate_v1()
from public, anon, authenticated, service_role;

grant execute on function
  mizizi_private.track_slug_primary_followup_candidate_v1()
to mizizi_executor;

do $candidate_gate$
declare
  v_count integer;
  v_fingerprint text;
  v_identity_noise integer;
  v_missing_primary integer;
  v_collision_reviews integer;
  v_credit_gap integer;
begin
  if (
    select count(*)::integer
    from supabase_migrations.schema_migrations
  ) <> 183
     or (
       select max(version)
       from supabase_migrations.schema_migrations
     ) <> '20260925172710'
  then
    raise exception
      'STOP: #1087 must install from exact Production baseline 183 / 20260925172710.';
  end if;

  if to_regprocedure(
       'mizizi_private.issue_stewardship_execution_grant_v1(text,text,text)'
     ) is null
     or to_regprocedure(
       'mizizi_private.execute_stewardship_operation_v2(uuid)'
     ) is null
     or to_regprocedure(
       'mizizi_private.verify_stewardship_operation_v2(uuid)'
     ) is null
     or to_regprocedure(
       'mizizi_private.close_stewardship_authority_window_v1(text,uuid,text)'
     ) is null
  then
    raise exception
      'STOP: accepted Track-slug stewardship primitive is incomplete.';
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
      'STOP: MIZIZI Track-slug authority is not zero at rest.';
  end if;

  with payload as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'track_id',candidate.track_id,
          'review_id',candidate.review_id,
          'current_slug',candidate.current_slug,
          'proposed_slug',candidate.proposed_slug,
          'primary_artist_slug',
            candidate.primary_artist_slug,
          'expected_state_fingerprint',
            candidate.expected_state_fingerprint
        )
        order by candidate.track_id
      ),
      '[]'::jsonb
    ) body
    from
      mizizi_private.track_slug_primary_followup_candidate_v1()
      candidate
  )
  select
    jsonb_array_length(body)::integer,
    encode(
      extensions.digest(body::text,'sha256'),
      'hex'
    )
  into v_count,v_fingerprint
  from payload;

  if v_count<>5
     or v_fingerprint<>
       '71d13b5535983bf937fcb0c0dbbf3b790e0961f8e8b0543c742b8d9d9f6c7cdf'
  then
    raise exception
      'STOP: #1087 exact five-row candidate freeze drifted.';
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
  into v_missing_primary
  from public.registry_review_items review
  where review.status='open'
    and review.review_type='mizizi_data_hygiene'
    and review.entity_type='track'
    and review.source_payload->>'ruleId'=
        'track_slug_identity_noise'
    and review.source_payload->'evidence'->>'collision'=
        'missing_explicit_primary_artist_scope';

  select count(*)::integer
  into v_collision_reviews
  from public.registry_review_items review
  where review.status='open'
    and review.review_type='mizizi_data_hygiene'
    and review.entity_type='track'
    and review.source_payload->>'ruleId'=
        'track_slug_identity_noise'
    and review.source_payload->'evidence'->>'collision'
        like 'candidate_slug_collides_with_track:%';

  select count(*)::integer
  into v_credit_gap
  from public.registry_review_items review
  where review.status='open'
    and review.review_type='mizizi_data_hygiene'
    and review.entity_type='track'
    and review.source_payload->>'ruleId'=
        'track_slug_credit_evidence_gap'
    and review.source_payload->>'ruleVersion'='1.3.0';

  if v_identity_noise<>32
     or v_missing_primary<>6
     or v_collision_reviews<>26
     or v_credit_gap<>12
  then
    raise exception
      'STOP: #1087 residual review boundary drifted.';
  end if;

  if not exists (
    select 1
    from public.registry_review_items review
    where review.id=
      '35a58395-668e-4b19-b044-9d8af6d6910a'::uuid
      and review.status='open'
      and review.source_id=
        '78c3ff76-cbeb-4e64-b2b2-8b2bb30567ab'
  )
  or exists (
    select 1
    from
      mizizi_private.track_slug_primary_followup_candidate_v1()
      candidate
    where candidate.track_id=
      '78c3ff76-cbeb-4e64-b2b2-8b2bb30567ab'::uuid
  )
  then
    raise exception
      'STOP: Nana holdout boundary drifted.';
  end if;
end
$candidate_gate$;

create or replace function
  mizizi_private.finalize_track_slug_primary_followup_v1(
    p_capability_grant_id uuid
  )
returns table(
  resolved_reviews integer,
  decision_rows integer,
  standing_grant_status text
)
language plpgsql
security definer
set search_path =
  pg_catalog,
  public,
  platform_private,
  mizizi_private,
  extensions
as $function$
declare
  v_standing
    platform_private.system_actor_capability_grants%rowtype;
  v_applied_count integer:=0;
  v_applied_fingerprint text;
  v_total_verified integer:=0;
  v_review_ids uuid[];
  v_decisions integer:=0;
  v_resolved integer:=0;
  v_close record;
begin
  perform mizizi_private.assert_executor_v1();

  if p_capability_grant_id is null then
    raise exception using errcode='22023',
      message='Capability grant id is required.';
  end if;

  select standing.*
  into v_standing
  from platform_private.system_actor_capability_grants standing
  where standing.id=p_capability_grant_id
  for update;

  if not found
     or v_standing.actor_key<>'mizizi'
     or v_standing.capability_key<>
        'canonicalize_registry_track_slug'
     or v_standing.status<>'active'
     or not (
       v_standing.scope @>
       jsonb_build_object(
         'operation_key',
           'registry.track_slug.canonicalize',
         'operation_version',1,
         'subject_type','track',
         'max_rows',1
       )
     )
  then
    raise exception using errcode='42501',
      message=
        'Active exact human Track-slug capability grant is required.';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants exact_grant
    join platform_private.registry_mutation_operations operation
      on operation.execution_grant_id=exact_grant.id
    where exact_grant.system_actor_capability_grant_id=
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
  )
  then
    raise exception using errcode='55000',
      message=
        'Unsafe #1087 Track-slug operation residue remains.';
  end if;

  select count(*)::integer
  into v_total_verified
  from platform_private.registry_execution_grants exact_grant
  join platform_private.registry_mutation_operations operation
    on operation.execution_grant_id=exact_grant.id
  where exact_grant.system_actor_capability_grant_id=
        p_capability_grant_id
    and exact_grant.actor_key='mizizi'
    and exact_grant.operation_key=
        'registry.track_slug.canonicalize'
    and exact_grant.operation_version=1
    and operation.status='succeeded'
    and operation.verifier_status='passed';

  if v_total_verified<>5 then
    raise exception using errcode='55000',
      message=
        'Expected exactly five verified #1087 Track-slug operations.';
  end if;

  with applied as (
    select
      review.id as review_id,
      review.source_id::uuid as track_id,
      exact_grant.plan_payload->>'current_slug'
        as current_slug,
      exact_grant.plan_payload->>'proposed_slug'
        as proposed_slug,
      exact_grant.plan_payload->>'primary_artist_slug'
        as primary_artist_slug,
      exact_grant.plan_payload->>'expected_state_fingerprint'
        as expected_state_fingerprint,
      primary_relation.id as primary_relation_id,
      primary_relation.metadata->>'release_evidence_fingerprint'
        as release_evidence_fingerprint
    from public.registry_review_items review
    join public.registry_tracks track
      on track.id::text=review.source_id
     and track.status='active'
    join lateral (
      select credit.*
      from public.registry_track_artists credit
      where credit.track_id=review.source_id::uuid
        and credit.status='active'
        and credit.is_primary is true
        and credit.is_featured is false
        and credit.artist_id is not null
        and credit.credit_order=1
        and credit.source='release_primary_review'
        and credit.confidence=100
        and credit.metadata->>'source_review_id'=
            review.id::text
        and credit.metadata->>'admission_contract'=
            'registry-release-primary-review-v1'
      order by credit.created_at,credit.id
      limit 1
    ) primary_relation on true
    join platform_private.registry_execution_grants
      exact_grant
      on exact_grant.system_actor_capability_grant_id=
         p_capability_grant_id
     and exact_grant.actor_key='mizizi'
     and exact_grant.operation_key=
         'registry.track_slug.canonicalize'
     and exact_grant.operation_version=1
     and exact_grant.idempotency_key=
         'public-music-track-primary-followup:' ||
         review.id::text
    join platform_private.registry_execution_grant_targets
      target
      on target.execution_grant_id=exact_grant.id
     and target.subject_type='track'
     and target.subject_id=review.source_id::uuid
    join platform_private.registry_mutation_operations
      operation
      on operation.execution_grant_id=exact_grant.id
     and operation.status='succeeded'
     and operation.verifier_status='passed'
    where review.status='open'
      and review.review_type='mizizi_data_hygiene'
      and review.entity_type='track'
      and review.source_payload->>'ruleId'=
          'track_slug_identity_noise'
      and review.source_payload->>'ruleVersion'='1.1.0'
      and review.source_payload->'evidence'->>'collision'=
          'missing_explicit_primary_artist_scope'
      and exact_grant.plan_payload->>'track_id'=
          review.source_id
      and exact_grant.plan_payload->>'current_slug'=
          review.source_payload->>'currentValue'
      and exact_grant.plan_payload->>'proposed_slug'=
          review.candidate_payload->>'proposedValue'
      and exact_grant.plan_payload->>'primary_artist_slug'=
          primary_relation.artist_slug
      and target.expected_state_fingerprint=
          exact_grant.plan_payload->>'expected_state_fingerprint'
      and track.slug=
          review.candidate_payload->>'proposedValue'
      and (
        select count(*)::integer
        from public.registry_track_artists all_primary
        where all_primary.track_id=review.source_id::uuid
          and all_primary.status='active'
          and all_primary.is_primary is true
          and all_primary.artist_id is not null
      )=1
      and not exists (
        select 1
        from public.registry_tracks other_track
        cross join lateral
          mizizi_private.track_slug_candidate_v1(
            other_track.id
          ) other_candidate
        where other_track.status='active'
          and other_track.id<>review.source_id::uuid
          and other_candidate.primary_artist_slug=
              primary_relation.artist_slug
          and other_candidate.proposed_slug=
              review.candidate_payload->>'proposedValue'
      )
  ),
  payload as (
    select
      count(*)::integer as candidate_count,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'track_id',applied.track_id,
            'review_id',applied.review_id,
            'current_slug',applied.current_slug,
            'proposed_slug',applied.proposed_slug,
            'primary_artist_slug',
              applied.primary_artist_slug,
            'expected_state_fingerprint',
              applied.expected_state_fingerprint
          )
          order by applied.track_id
        ),
        '[]'::jsonb
      ) as body,
      array_agg(
        applied.review_id
        order by applied.track_id
      ) as review_ids
    from applied
  )
  select
    candidate_count,
    encode(
      extensions.digest(body::text,'sha256'),
      'hex'
    ),
    review_ids
  into
    v_applied_count,
    v_applied_fingerprint,
    v_review_ids
  from payload;

  if v_applied_count<>5
     or v_applied_fingerprint<>
       '71d13b5535983bf937fcb0c0dbbf3b790e0961f8e8b0543c742b8d9d9f6c7cdf'
  then
    raise exception using errcode='55000',
      message=
        'Verified #1087 Track-slug applied set drifted.';
  end if;

  insert into public.registry_canonicalization_decisions (
    review_item_id,
    decision_type,
    entity_type,
    entity_id,
    before_payload,
    after_payload,
    decision_notes,
    decided_by,
    status,
    metadata
  )
  select
    review.id,
    'auto_resolved_release_primary_scope_blocker',
    'track',
    review.source_id::uuid,
    jsonb_build_object(
      'reviewKey',review.review_key,
      'sourcePayload',review.source_payload,
      'candidatePayload',review.candidate_payload
    ),
    jsonb_build_object(
      'resolution',
        'governed_track_slug_primary_followup',
      'finalSlug',track.slug,
      'candidateFingerprint',
        '71d13b5535983bf937fcb0c0dbbf3b790e0961f8e8b0543c742b8d9d9f6c7cdf',
      'capabilityGrantId',
        p_capability_grant_id,
      'primaryRelationId',
        primary_relation.id,
      'releaseEvidenceFingerprint',
        primary_relation.metadata->>'release_evidence_fingerprint',
      'admissionContract',
        primary_relation.metadata->>'admission_contract'
    ),
    'Resolved after governed Release-primary evidence supplied the exact primary Artist scope required by the historical Track slug review and the V2 Track mutation verified.',
    v_standing.granted_by_user_id,
    'recorded',
    jsonb_build_object(
      'programmeIssue',1087,
      'parentProgrammeIssue',1068,
      'programmeKey',
        'public_music_identity_track_slug_primary_followup',
      'publicRenderingChanged',true,
      'canonicalEntitiesChanged',true
    )
  from public.registry_review_items review
  join public.registry_tracks track
    on track.id::text=review.source_id
   and track.status='active'
  join lateral (
    select credit.*
    from public.registry_track_artists credit
    where credit.track_id=review.source_id::uuid
      and credit.status='active'
      and credit.is_primary is true
      and credit.is_featured is false
      and credit.artist_id is not null
      and credit.credit_order=1
      and credit.source='release_primary_review'
      and credit.confidence=100
      and credit.metadata->>'source_review_id'=
          review.id::text
      and credit.metadata->>'admission_contract'=
          'registry-release-primary-review-v1'
    order by credit.created_at,credit.id
    limit 1
  ) primary_relation on true
  where review.id=any(v_review_ids)
    and review.status='open'
    and track.slug=
        review.candidate_payload->>'proposedValue';

  get diagnostics v_decisions=row_count;

  update public.registry_review_items review
  set
    status='resolved',
    resolution_payload=
      jsonb_build_object(
        'decisionType',
          'auto_resolved_release_primary_scope_blocker',
        'resolution',
          'governed_track_slug_primary_followup',
        'programmeKey',
          'public_music_identity_track_slug_primary_followup',
        'programmeIssue',1087,
        'candidateFingerprint',
          '71d13b5535983bf937fcb0c0dbbf3b790e0961f8e8b0543c742b8d9d9f6c7cdf',
        'capabilityGrantId',
          p_capability_grant_id
      ),
    resolved_at=now(),
    updated_at=now()
  where review.id=any(v_review_ids)
    and review.status='open';

  get diagnostics v_resolved=row_count;

  if v_resolved<>5 or v_decisions<>5 then
    raise exception using errcode='55000',
      message=
        '#1087 Track-slug review finalization was not exactly 5/5.';
  end if;

  select *
  into v_close
  from mizizi_private.close_stewardship_authority_window_v1(
    'registry.track_slug.canonicalize',
    p_capability_grant_id,
    'close after accepted #1087 Track-slug primary-scope follow-up'
  );

  if v_close.standing_grant_status<>'expired' then
    raise exception using errcode='55000',
      message=
        '#1087 Track-slug authority did not return to zero at rest.';
  end if;

  resolved_reviews:=v_resolved;
  decision_rows:=v_decisions;
  standing_grant_status:=v_close.standing_grant_status;
  return next;
end
$function$;

revoke all on function
  mizizi_private.finalize_track_slug_primary_followup_v1(uuid)
from public, anon, authenticated, service_role;

grant execute on function
  mizizi_private.finalize_track_slug_primary_followup_v1(uuid)
to mizizi_executor;
