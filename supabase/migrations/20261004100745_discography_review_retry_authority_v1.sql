-- WAKILISHA — Discography reviewed retry authority V1.
-- Forward-only correction for reviewed Discography retries after planner-policy
-- convergence. Preserves append-only review history and exact human causality.
-- No bulk mutation. No standing authority. No client-role widening.

begin;
set local statement_timeout='180s';
set local lock_timeout='5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'discography-review-retry-authority-v1',
    0
  )
);

do $preflight$
begin
  if to_regprocedure(
       'platform_private.seal_registry_execution_grant_review_v1()'
     ) is null
     or to_regprocedure(
       'platform_private.transition_registry_review_case_v1(uuid,text,text,text)'
     ) is null
     or to_regprocedure(
       'platform_private.record_registry_review_decision_v1(uuid,text,text,text,uuid)'
     ) is null
  then
    raise exception
      'Shared Registry review authority is incomplete for Discography retry convergence.';
  end if;
end
$preflight$;

create or replace function platform_private.seal_registry_execution_grant_review_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform_private
as $$
declare
  v_grant platform_private.registry_execution_grants%rowtype;
  v_operation platform_private.registry_operation_types%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_prior_grant platform_private.registry_execution_grants%rowtype;
  v_status record;
  v_evidence_id_text text;
  v_evidence_id uuid;
  v_case_id uuid;
  v_rationale text;
  v_transition_rationale text;
begin
  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id = new.execution_grant_id;

  if not found then
    raise exception using errcode='23503',
      message='Registry execution target lost its exact grant.';
  end if;

  select operation_type.*
  into v_operation
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key = v_grant.operation_key
    and operation_type.operation_version = v_grant.operation_version;

  if not found then
    raise exception using errcode='23503',
      message='Registry execution grant lost its typed operation definition.';
  end if;

  if not v_operation.requires_human_approval then
    return new;
  end if;

  if v_grant.issued_by_user_id is null
     or v_grant.issued_by_principal_key <>
        'user:' || v_grant.issued_by_user_id::text
  then
    raise exception using errcode='42501',
      message='Human-approved Registry operations require a real user issuer.';
  end if;

  v_evidence_id_text := v_grant.plan_payload ->> 'evidence_assertion_id';

  if v_evidence_id_text is null
     or v_evidence_id_text !~
       '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    raise exception using errcode='42501',
      message='Human-approved Registry grant lacks an exact evidence assertion reference.';
  end if;

  v_evidence_id := v_evidence_id_text::uuid;

  select evidence.*
  into v_evidence
  from platform_private.registry_evidence_assertions evidence
  where evidence.id = v_evidence_id;

  if not found
     or v_grant.plan_payload ->> 'evidence_assertion_fingerprint'
        is distinct from v_evidence.assertion_fingerprint
     or v_grant.plan_payload ->> 'trust_class'
        is distinct from v_evidence.trust_class
  then
    raise exception using errcode='42501',
      message='Human-approved Registry grant is not bound to immutable evidence authority.';
  end if;

  v_case_id := platform_private.ensure_registry_review_case_v1(
    new.subject_type,
    new.subject_id,
    v_grant.operation_key,
    v_grant.operation_version,
    v_evidence.id
  );

  select review_status.*
  into v_status
  from platform_private.registry_review_case_status_v1 review_status
  where review_status.review_case_id = v_case_id;

  if v_grant.actor_key = 'registry_discography_admin'
     and nullif(v_grant.plan_payload ->> 'review_plan_id', '') is not null
     and v_status.review_state = 'effective'
     and v_status.effective_decision = 'approved'
     and v_status.effective_reviewer_principal_key =
         v_grant.issued_by_principal_key
     and v_status.effective_execution_grant_id is not null
     and v_status.effective_execution_grant_id <> v_grant.id
  then
    select prior_grant.*
    into v_prior_grant
    from platform_private.registry_execution_grants prior_grant
    where prior_grant.id = v_status.effective_execution_grant_id;

    if not found
       or v_prior_grant.actor_key <> v_grant.actor_key
       or v_prior_grant.operation_key <> v_grant.operation_key
       or v_prior_grant.operation_version <> v_grant.operation_version
       or v_prior_grant.issued_by_principal_key <>
          v_grant.issued_by_principal_key
       or v_prior_grant.status = 'active'
    then
      raise exception using errcode='55000',
        message='Discography retry cannot replace non-terminal or mismatched review authority.';
    end if;

    v_transition_rationale := format(
      'Supersede terminal exact Registry grant %s before reviewed Discography retry grant %s for %s v%s on %s:%s using unchanged evidence %s.',
      v_prior_grant.id,
      v_grant.id,
      v_grant.operation_key,
      v_grant.operation_version,
      new.subject_type,
      new.subject_id,
      v_evidence.id
    );

    perform platform_private.transition_registry_review_case_v1(
      v_case_id,
      'supersede',
      v_transition_rationale,
      v_grant.issued_by_principal_key
    );

    perform platform_private.transition_registry_review_case_v1(
      v_case_id,
      'reopen',
      format(
        'Reopen reviewed Registry case for exact Discography retry grant %s after terminal grant %s was superseded.',
        v_grant.id,
        v_prior_grant.id
      ),
      v_grant.issued_by_principal_key
    );
  end if;

  v_rationale := format(
    'Approved exact Registry grant for %s v%s on %s:%s using evidence %s.',
    v_grant.operation_key,
    v_grant.operation_version,
    new.subject_type,
    new.subject_id,
    v_evidence.id
  );

  perform platform_private.record_registry_review_decision_v1(
    v_case_id,
    'approved',
    v_rationale,
    v_grant.issued_by_principal_key,
    v_grant.id
  );

  return new;
end;
$$;

revoke all on function
  platform_private.seal_registry_execution_grant_review_v1()
from public,anon,authenticated,service_role;

do $integrity$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'platform_private.seal_registry_execution_grant_review_v1()'::regprocedure
  ) into v_definition;

  if position('registry_discography_admin' in v_definition)=0
     or position('review_plan_id' in v_definition)=0
     or position('transition_registry_review_case_v1' in v_definition)=0
     or position('effective_execution_grant_id' in v_definition)=0
     or position('v_prior_grant.status' in v_definition)=0
     or position('active' in v_definition)=0
  then
    raise exception
      'Discography retry review-seal convergence is incomplete.';
  end if;

  if has_function_privilege(
       'public',
       'platform_private.seal_registry_execution_grant_review_v1()',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'platform_private.seal_registry_execution_grant_review_v1()',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.seal_registry_execution_grant_review_v1()',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.seal_registry_execution_grant_review_v1()',
       'EXECUTE'
     )
  then
    raise exception
      'Discography retry review seal leaked client execution authority.';
  end if;
end
$integrity$;

commit;
