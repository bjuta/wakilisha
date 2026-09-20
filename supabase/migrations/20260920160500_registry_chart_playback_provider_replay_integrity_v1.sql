-- Chart Playback Provider V1 idempotent replay integrity.
--
-- The initial provider-link authority correctly froze the pre-write Track state
-- into each exact grant. After a successful mutation, the operation itself
-- changes Registry Track metadata, so recomputing a fresh pre-write state
-- fingerprint on replay makes the same idempotency key look like different
-- authority before the existing terminal operation can be replayed.
--
-- Preserve stale-state protection for every new grant. For an existing
-- idempotency key, first prove that the durable grant is bound to the same
-- caller, item, evidence, claim, target, and policy, then return that immutable
-- grant unchanged. The executor remains responsible for terminal replay and for
-- rejecting stale or unauthorized non-terminal operations.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'registry-chart-playback-provider-replay-integrity-v1',
    0
  )
);

do $preflight$
begin
  if to_regprocedure(
       'platform_private.issue_registry_chart_playback_provider_grant_v1(uuid,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.execute_registry_chart_playback_provider_v1(uuid)'
     ) is null
     or to_regprocedure(
       'public.chart_admit_track_provider_link_v1(uuid)'
     ) is null
  then
    raise exception
      'STOP: Chart Playback Provider V1 authority is not installed';
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key='registry.track.provider_link.admit'
      and operation_type.operation_version=1
      and operation_type.capability_key='admit_registry_track_provider_link'
  ) then
    raise exception
      'STOP: Chart Playback Provider V1 operation type is missing';
  end if;
end
$preflight$;

create or replace function platform_private.issue_registry_chart_playback_provider_grant_v1(
  p_evidence_assertion_id uuid,
  p_item_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_item public.wk_chart_playback_enrichment_items%rowtype;
  v_run public.wk_chart_playback_enrichment_runs%rowtype;
  v_existing platform_private.registry_execution_grants%rowtype;
  v_state_fingerprint text;
  v_plan jsonb;
  v_plan_fingerprint text;
  v_target_fingerprint text;
  v_idempotency_key text;
  v_grant_id uuid;
begin
  if v_user_id is null
     or p_evidence_assertion_id is null
     or p_item_id is null
     or not coalesce(public.current_user_has_capability('manage_charts'),false)
  then
    raise exception using errcode='42501',
      message='manage_charts caller authority is required.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type<>'track'
     or v_evidence.claim_key<>'registry.track.provider_link'
     or v_evidence.trust_class<>'EXTERNAL_EVIDENCE'
     or v_evidence.recorded_by_principal_key<>'user:'||v_user_id::text
     or v_evidence.source_ref<>'chart-playback:item:'||p_item_id::text
  then
    raise exception using errcode='42501',
      message='Evidence is not caller-bound Chart playback provider authority.';
  end if;

  select item.*
  into v_item
  from public.wk_chart_playback_enrichment_items item
  where item.id=p_item_id
  for update;

  select run.*
  into v_run
  from public.wk_chart_playback_enrichment_runs run
  where run.id=v_item.run_id
  for update;

  if not found
     or v_run.requested_by is distinct from v_user_id
     or not v_run.write_mode
     or v_item.status<>'accepted'
     or v_item.registry_track_id is distinct from v_evidence.subject_id
     or btrim(v_item.provider_track_id) is distinct from
        v_evidence.claim_payload->>'provider_track_id'
  then
    raise exception using errcode='42501',
      message='Chart playback evidence no longer matches the locked accepted item.';
  end if;

  v_idempotency_key := 'chart-playback-provider:'||p_item_id::text;

  select execution_grant.*
  into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_chart_admission'
    and execution_grant.capability_key='admit_registry_track_provider_link'
    and execution_grant.operation_key='registry.track.provider_link.admit'
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=v_idempotency_key;

  if found then
    if v_existing.issued_by_user_id is distinct from v_user_id
       or v_existing.issued_by_principal_key is distinct from
          'user:'||v_user_id::text
       or v_existing.required_user_capability_key is distinct from
          'manage_charts'
       or v_existing.policy_ruleset_version is distinct from
          'registry-chart-playback-provider-v1'
       or v_existing.max_rows<>1
       or v_existing.plan_payload->>'item_id' is distinct from p_item_id::text
       or v_existing.plan_payload->>'track_id' is distinct from
          v_evidence.subject_id::text
       or v_existing.plan_payload->>'evidence_assertion_id' is distinct from
          v_evidence.id::text
       or v_existing.plan_payload->>'evidence_assertion_fingerprint'
          is distinct from v_evidence.assertion_fingerprint
       or v_existing.plan_payload->'claim_payload'
          is distinct from v_evidence.claim_payload
       or v_existing.plan_payload->>'trust_class'
          is distinct from v_evidence.trust_class
       or v_existing.plan_payload->>'policy_ruleset_version'
          is distinct from 'registry-chart-playback-provider-v1'
       or platform_private.registry_plan_fingerprint(
            v_existing.plan_payload
          )<>v_existing.plan_fingerprint
       or platform_private.registry_execution_target_set_fingerprint(
            v_existing.id
          )<>v_existing.target_set_fingerprint
       or (
         select count(*)
         from platform_private.registry_execution_grant_targets target
         where target.execution_grant_id=v_existing.id
           and target.subject_type='track'
           and target.subject_id=v_evidence.subject_id
           and target.expected_state_fingerprint=
               v_existing.plan_payload->>'expected_state_fingerprint'
       )<>1
       or (
         select count(*)
         from platform_private.registry_execution_grant_targets target
         where target.execution_grant_id=v_existing.id
       )<>1
    then
      raise exception using errcode='23505',
        message='Chart playback provider idempotency key is bound to different authority.';
    end if;

    return v_existing.id;
  end if;

  v_state_fingerprint :=
    platform_private.registry_subject_state_fingerprint(
      'track',
      v_evidence.subject_id
    );

  if v_state_fingerprint is null then
    raise exception using errcode='P0002',
      message='Registry Track state fingerprint is unavailable.';
  end if;

  v_plan := jsonb_build_object(
    'operation_key','registry.track.provider_link.admit',
    'operation_version',1,
    'item_id',p_item_id::text,
    'track_id',v_evidence.subject_id::text,
    'evidence_assertion_id',v_evidence.id::text,
    'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
    'claim_payload',v_evidence.claim_payload,
    'expected_state_fingerprint',v_state_fingerprint,
    'trust_class',v_evidence.trust_class,
    'policy_ruleset_version','registry-chart-playback-provider-v1'
  );

  v_plan_fingerprint :=
    platform_private.registry_plan_fingerprint(v_plan);

  v_target_fingerprint := encode(
    extensions.digest(
      jsonb_build_array(
        jsonb_build_object(
          'subject_type','track',
          'subject_id',v_evidence.subject_id::text,
          'expected_state_fingerprint',v_state_fingerprint
        )
      )::text,
      'sha256'
    ),
    'hex'
  );

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
    'registry_chart_admission',
    'admit_registry_track_provider_link',
    null,
    'registry.track.provider_link.admit',
    1,
    v_plan,
    v_plan_fingerprint,
    v_target_fingerprint,
    1,
    v_idempotency_key,
    'active',
    v_user_id,
    'user:'||v_user_id::text,
    'registry-chart-playback-provider-v1',
    'manage_charts',
    now(),
    now()+interval '5 minutes'
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
    'track',
    v_evidence.subject_id,
    v_state_fingerprint
  );

  return v_grant_id;
end;
$$;

revoke all on function
  platform_private.issue_registry_chart_playback_provider_grant_v1(uuid,uuid)
from public, anon, authenticated, service_role;

do $proof$
declare
  v_definition text;
  v_existing_lookup integer;
  v_state_capture integer;
begin
  select lower(pg_get_functiondef(
    'platform_private.issue_registry_chart_playback_provider_grant_v1(uuid,uuid)'::regprocedure
  ))
  into v_definition;

  v_existing_lookup :=
    position(
      'and execution_grant.idempotency_key=v_idempotency_key'
      in v_definition
    );

  v_state_capture :=
    position(
      'v_state_fingerprint :='
      in v_definition
    );

  if v_existing_lookup=0
     or v_state_capture=0
     or v_existing_lookup>=v_state_capture
     or position(
          'v_existing.plan_payload->>''evidence_assertion_id'''
          in v_definition
        )=0
     or position(
          'v_existing.plan_payload->''claim_payload'''
          in v_definition
        )=0
     or position(
          'registry_execution_target_set_fingerprint('
          in v_definition
        )=0
  then
    raise exception
      'Chart Playback Provider V1 replay-integrity repair drifted';
  end if;

  if has_function_privilege(
       'public',
       'platform_private.issue_registry_chart_playback_provider_grant_v1(uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'platform_private.issue_registry_chart_playback_provider_grant_v1(uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.issue_registry_chart_playback_provider_grant_v1(uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.issue_registry_chart_playback_provider_grant_v1(uuid,uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'Chart Playback Provider V1 replay repair leaked private grant authority';
  end if;
end
$proof$;

commit;
