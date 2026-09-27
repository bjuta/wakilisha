-- Permanent verifier for:
-- 20260925213519_public_music_identity_track_slug_primary_followup_v1.sql

do $verify$
declare
  v_candidate_definition text;
  v_finalizer_definition text;
  v_candidate_count integer;
  v_candidate_fingerprint text;
  v_decisions integer;
  v_resolved integer;
  v_identity_noise integer;
  v_collision_reviews integer;
  v_missing_primary integer;
  v_credit_gap integer;
  v_track_redirects integer;
begin
  if (
    select count(*)::integer
    from supabase_migrations.schema_migrations
  ) <> 184
     or (
       select max(version)
       from supabase_migrations.schema_migrations
     ) <> '20260925213519'
  then
    raise exception
      '#1087 migration ledger drifted.';
  end if;

  if to_regprocedure(
       'mizizi_private.track_slug_primary_followup_candidate_v1()'
     ) is null
     or to_regprocedure(
       'mizizi_private.finalize_track_slug_primary_followup_v1(uuid)'
     ) is null
     or to_regprocedure(
       'mizizi_private.execute_stewardship_operation_v2(uuid)'
     ) is null
     or to_regprocedure(
       'mizizi_private.verify_stewardship_operation_v2(uuid)'
     ) is null
  then
    raise exception
      '#1087 function surface is incomplete.';
  end if;

  if not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.track_slug_primary_followup_candidate_v1()',
       'EXECUTE'
     )
     or not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.finalize_track_slug_primary_followup_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'mizizi_private.finalize_track_slug_primary_followup_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'mizizi_private.finalize_track_slug_primary_followup_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      '#1087 private authority grants are not exact.';
  end if;

  select lower(pg_get_functiondef(
    'mizizi_private.track_slug_primary_followup_candidate_v1()'::regprocedure
  ))
  into v_candidate_definition;

  if position(
       '''missing_explicit_primary_artist_scope'''
       in v_candidate_definition
     )=0
     or position(
       '''release_primary_review'''
       in v_candidate_definition
     )=0
     or position(
       '''registry-release-primary-review-v1'''
       in v_candidate_definition
     )=0
     or position(
       'source_review_id'
       in v_candidate_definition
     )=0
     or position(
       'track_slug_candidate_v1'
       in v_candidate_definition
     )=0
  then
    raise exception
      '#1087 candidate provenance/collision contract drifted.';
  end if;

  select lower(pg_get_functiondef(
    'mizizi_private.finalize_track_slug_primary_followup_v1(uuid)'::regprocedure
  ))
  into v_finalizer_definition;

  if position(
       'auto_resolved_release_primary_scope_blocker'
       in v_finalizer_definition
     )=0
     or position(
       'governed_track_slug_primary_followup'
       in v_finalizer_definition
     )=0
     or position(
       'public_music_identity_track_slug_primary_followup'
       in v_finalizer_definition
     )=0
     or position(
       '71d13b5535983bf937fcb0c0dbbf3b790e0961f8e8b0543c742b8d9d9f6c7cdf'
       in v_finalizer_definition
     )=0
     or position(
       'close_stewardship_authority_window_v1'
       in v_finalizer_definition
     )=0
     or position(
       'wk_slug_redirects'
       in v_finalizer_definition
     )<>0
  then
    raise exception
      '#1087 finalizer contract drifted.';
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
      '#1087 Track-slug authority is not zero at rest.';
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
  into v_candidate_count,v_candidate_fingerprint
  from payload;

  select count(*)::integer
  into v_decisions
  from public.registry_canonicalization_decisions decision
  where decision.decision_type=
        'auto_resolved_release_primary_scope_blocker'
    and decision.metadata->>'programmeKey'=
        'public_music_identity_track_slug_primary_followup'
    and decision.after_payload->>'candidateFingerprint'=
        '71d13b5535983bf937fcb0c0dbbf3b790e0961f8e8b0543c742b8d9d9f6c7cdf'
    and decision.entity_id=any(array[
      '0022d51b-1fcb-425a-b6af-b450645e1fd7'::uuid,
      '40b2bdd6-99f7-4f99-801b-6b975bac62c6'::uuid,
      '473297fa-1cf9-4e72-a259-67c57b754127'::uuid,
      '584d8bc1-b84c-4ec6-bc20-2b2fa9076d10'::uuid,
      '741ff8e9-90bf-44b0-bbd8-3dc73e2bde79'::uuid
    ]);

  select count(*)::integer
  into v_resolved
  from public.registry_review_items review
  where review.status='resolved'
    and review.resolution_payload->>'programmeKey'=
        'public_music_identity_track_slug_primary_followup'
    and review.resolution_payload->>'candidateFingerprint'=
        '71d13b5535983bf937fcb0c0dbbf3b790e0961f8e8b0543c742b8d9d9f6c7cdf'
    and review.id=any(array[
      'dd78662c-2d1f-458b-b84b-92d807a67903'::uuid,
      'd01aa090-9ed3-4f96-aee6-36c4d0e66c24'::uuid,
      '1ccada22-cbeb-4add-829a-ded9f211a7db'::uuid,
      '32bf86a6-edb5-4d34-819a-dd6c21bc1882'::uuid,
      '0748203b-1826-4f7e-81ce-10485049df60'::uuid
    ]);

  if not (
    (
      v_candidate_count=5
      and v_candidate_fingerprint=
        '71d13b5535983bf937fcb0c0dbbf3b790e0961f8e8b0543c742b8d9d9f6c7cdf'
      and v_decisions=0
      and v_resolved=0
    )
    or (
      v_candidate_count=0
      and v_decisions=5
      and v_resolved=5
    )
  )
  then
    raise exception
      '#1087 pending/accepted state is not an exact recognized boundary.';
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
  into v_credit_gap
  from public.registry_review_items review
  where review.status='open'
    and review.review_type='mizizi_data_hygiene'
    and review.entity_type='track'
    and review.source_payload->>'ruleId'=
        'track_slug_credit_evidence_gap'
    and review.source_payload->>'ruleVersion'='1.3.0';

  if v_candidate_count=5 then
    if v_identity_noise<>32
       or v_collision_reviews<>26
       or v_missing_primary<>6
       or v_credit_gap<>12
    then
      raise exception
        '#1087 pending residual review boundary drifted.';
    end if;
  else
    if v_identity_noise<>27
       or v_collision_reviews<>26
       or v_missing_primary<>1
       or v_credit_gap<>12
    then
      raise exception
        '#1087 accepted residual review boundary drifted.';
    end if;
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
  then
    raise exception
      '#1087 Nana holdout drifted.';
  end if;

  select count(*)::integer
  into v_track_redirects
  from public.wk_slug_redirects
  where entity_type='track';

  if v_track_redirects<>1148 then
    raise exception
      '#1087 Track redirect history drifted.';
  end if;
end
$verify$;

select
  'PUBLIC_MUSIC_IDENTITY_TRACK_SLUG_PRIMARY_FOLLOWUP_V1_PASS'
  as result;
