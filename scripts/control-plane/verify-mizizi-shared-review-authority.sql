\set ON_ERROR_STOP on

do $$
declare
  v_invalid bigint;
begin
  if to_regclass('platform_private.registry_review_cases') is null
     or to_regclass('platform_private.registry_review_events') is null
     or to_regclass('platform_private.registry_review_case_status_v1') is null
  then
    raise exception 'Gate E verifier: shared Registry review relations are missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns column_row
    where column_row.table_schema = 'platform_private'
      and column_row.table_name = 'registry_review_events'
      and column_row.column_name = 'event_sequence'
      and column_row.data_type = 'bigint'
      and column_row.is_identity = 'YES'
  ) then
    raise exception 'Gate E verifier: review event sequence authority is missing';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid =
          'platform_private.registry_review_events'::regclass
      and constraint_row.conname = 'registry_review_events_sequence_key'
      and constraint_row.contype = 'u'
  ) then
    raise exception 'Gate E verifier: review event sequence is not unique';
  end if;

  if position(
       'ORDER BY review_event.event_sequence DESC'
       in pg_get_viewdef(
         'platform_private.registry_review_case_status_v1'::regclass,
         true
       )
     ) = 0
     or position(
       'ORDER BY decision_event.event_sequence DESC'
       in pg_get_viewdef(
         'platform_private.registry_review_case_status_v1'::regclass,
         true
       )
     ) = 0
  then
    raise exception 'Gate E verifier: deterministic review event ordering is missing';
  end if;

  if to_regprocedure(
       'platform_private.ensure_registry_review_case_v1(text,uuid,text,integer,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.record_registry_review_decision_v1(uuid,text,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.transition_registry_review_case_v1(uuid,text,text,text)'
     ) is null
  then
    raise exception 'Gate E verifier: shared Registry review recorders are missing';
  end if;

  if not exists (
       select 1
       from pg_trigger
       where tgrelid =
             'platform_private.registry_execution_grant_targets'::regclass
         and tgname = 'registry_execution_grant_target_review_seal'
         and not tgisinternal
         and tgenabled <> 'D'
     )
     or not exists (
       select 1
       from pg_trigger
       where tgrelid =
             'platform_private.registry_execution_grants'::regclass
         and tgname = 'registry_execution_grants_review_authority_guard'
         and not tgisinternal
         and tgenabled <> 'D'
     )
  then
    raise exception 'Gate E verifier: exact-grant review guards are missing';
  end if;

  if not exists (
       select 1
       from pg_trigger
       where tgrelid =
             'platform_private.registry_review_cases'::regclass
         and tgname = 'registry_review_cases_immutable'
         and not tgisinternal
         and tgenabled <> 'D'
     )
     or not exists (
       select 1
       from pg_trigger
       where tgrelid =
             'platform_private.registry_review_events'::regclass
         and tgname = 'registry_review_events_immutable'
         and not tgisinternal
         and tgenabled <> 'D'
     )
  then
    raise exception 'Gate E verifier: append-only review guards are missing';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants grant_row
    where grant_row.table_schema = 'platform_private'
      and grant_row.table_name in (
        'registry_review_cases',
        'registry_review_events',
        'registry_review_case_status_v1'
      )
      and grant_row.grantee in (
        'anon',
        'authenticated',
        'service_role',
        'PUBLIC'
      )
  ) then
    raise exception 'Gate E verifier: client role can access private review authority';
  end if;

  if has_function_privilege(
       'anon',
       'platform_private.ensure_registry_review_case_v1(text,uuid,text,integer,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.ensure_registry_review_case_v1(text,uuid,text,integer,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.ensure_registry_review_case_v1(text,uuid,text,integer,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'platform_private.record_registry_review_decision_v1(uuid,text,text,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.record_registry_review_decision_v1(uuid,text,text,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.record_registry_review_decision_v1(uuid,text,text,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'platform_private.transition_registry_review_case_v1(uuid,text,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.transition_registry_review_case_v1(uuid,text,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.transition_registry_review_case_v1(uuid,text,text,text)',
       'EXECUTE'
     )
  then
    raise exception 'Gate E verifier: client role can execute private review authority';
  end if;

  select count(*)
  into v_invalid
  from platform_private.registry_review_cases review_case
  join platform_private.registry_operation_types operation_type
    on operation_type.operation_key = review_case.operation_key
   and operation_type.operation_version = review_case.operation_version
  where not operation_type.requires_human_approval
     or not (
       review_case.subject_type = any(operation_type.allowed_subject_types)
     );

  if v_invalid <> 0 then
    raise exception 'Gate E verifier: review case is outside human-approved typed operation authority';
  end if;

  select count(*)
  into v_invalid
  from platform_private.registry_review_events review_event
  join platform_private.registry_review_events related_event
    on related_event.id = review_event.related_event_id
  where review_event.related_event_id is not null
    and related_event.review_case_id <> review_event.review_case_id;

  if v_invalid <> 0 then
    raise exception 'Gate E verifier: review transition crosses case authority';
  end if;


  select count(*)
  into v_invalid
  from (
    select review_event.review_case_id
    from platform_private.registry_review_events review_event
    where review_event.event_type = 'decision'
      and not exists (
        select 1
        from platform_private.registry_review_events supersede_event
        where supersede_event.review_case_id = review_event.review_case_id
          and supersede_event.event_type = 'supersede'
          and supersede_event.related_event_id = review_event.id
      )
    group by review_event.review_case_id
    having count(*) > 1
  ) duplicate_effective;

  if v_invalid <> 0 then
    raise exception 'Gate E verifier: review case has multiple unsuperseded decisions';
  end if;

  if position(
       'FOR UPDATE'
       in upper(
         pg_get_functiondef(
           'platform_private.record_registry_review_decision_v1(uuid,text,text,text,uuid)'::regprocedure
         )
       )
     ) = 0
     or position(
       'FOR UPDATE'
       in upper(
         pg_get_functiondef(
           'platform_private.transition_registry_review_case_v1(uuid,text,text,text)'::regprocedure
         )
       )
     ) = 0
  then
    raise exception 'Gate E verifier: review-case lifecycle is not serialized';
  end if;

  select count(*)
  into v_invalid
  from platform_private.registry_execution_grants execution_grant
  join platform_private.registry_operation_types operation_type
    on operation_type.operation_key = execution_grant.operation_key
   and operation_type.operation_version = execution_grant.operation_version
  where operation_type.requires_human_approval
    and (
      select count(*)
      from platform_private.registry_execution_grant_targets target
      where target.execution_grant_id = execution_grant.id
    ) < 1;

  if v_invalid <> 0 then
    raise exception 'Gate E verifier: human-approved grant has no exact target';
  end if;

  select count(*)
  into v_invalid
  from platform_private.registry_execution_grants execution_grant
  join platform_private.registry_operation_types operation_type
    on operation_type.operation_key = execution_grant.operation_key
   and operation_type.operation_version = execution_grant.operation_version
  where operation_type.requires_human_approval
    and (
      select count(*)
      from platform_private.registry_execution_grant_targets target
      where target.execution_grant_id = execution_grant.id
    ) <>
    (
      select count(*)
      from platform_private.registry_review_events review_event
      join platform_private.registry_review_cases review_case
        on review_case.id = review_event.review_case_id
      join platform_private.registry_execution_grant_targets target
        on target.execution_grant_id = execution_grant.id
       and target.subject_type = review_case.subject_type
       and target.subject_id = review_case.subject_id
      join platform_private.registry_evidence_assertions evidence
        on evidence.id = review_case.evidence_assertion_id
      where review_event.execution_grant_id = execution_grant.id
        and review_event.event_type = 'decision'
        and review_event.decision = 'approved'
        and review_case.operation_key = execution_grant.operation_key
        and review_case.operation_version = execution_grant.operation_version
        and review_event.reviewer_principal_key = execution_grant.issued_by_principal_key
        and review_case.evidence_assertion_id::text
            = execution_grant.plan_payload ->> 'evidence_assertion_id'
        and evidence.assertion_fingerprint
            = execution_grant.plan_payload ->> 'evidence_assertion_fingerprint'
        and evidence.trust_class
            = execution_grant.plan_payload ->> 'trust_class'
    );

  if v_invalid <> 0 then
    raise exception 'Gate E verifier: human-approved grant lacks exact historical review causality';
  end if;

  select count(*)
  into v_invalid
  from platform_private.registry_execution_grants execution_grant
  join platform_private.registry_operation_types operation_type
    on operation_type.operation_key = execution_grant.operation_key
   and operation_type.operation_version = execution_grant.operation_version
  join platform_private.registry_review_events review_event
    on review_event.execution_grant_id = execution_grant.id
  where not operation_type.requires_human_approval;

  if v_invalid <> 0 then
    raise exception 'Gate E verifier: non-human operation depends on human review authority';
  end if;

  select count(*)
  into v_invalid
  from platform_private.registry_execution_grants execution_grant
  join platform_private.registry_operation_types operation_type
    on operation_type.operation_key = execution_grant.operation_key
   and operation_type.operation_version = execution_grant.operation_version
  where operation_type.requires_human_approval
    and execution_grant.status = 'active'
    and exists (
      select 1
      from platform_private.registry_review_events review_event
      join platform_private.registry_review_case_status_v1 review_status
        on review_status.review_case_id = review_event.review_case_id
      where review_event.execution_grant_id = execution_grant.id
        and review_status.effective_review_event_id is distinct from review_event.id
    );

  if v_invalid <> 0 then
    raise exception 'Gate E verifier: active human grant lost effective review authority';
  end if;

  select count(*)
  into v_invalid
  from platform_private.registry_mutation_operations operation_row
  join platform_private.registry_execution_grants execution_grant
    on execution_grant.id = operation_row.execution_grant_id
  join platform_private.registry_operation_types operation_type
    on operation_type.operation_key = execution_grant.operation_key
   and operation_type.operation_version = execution_grant.operation_version
  where operation_type.requires_human_approval
    and not exists (
      select 1
      from platform_private.registry_review_events review_event
      where review_event.execution_grant_id = execution_grant.id
        and review_event.event_type = 'decision'
        and review_event.decision = 'approved'
    );

  if v_invalid <> 0 then
    raise exception 'Gate E verifier: human Registry mutation operation lacks causal approved review';
  end if;
end;
$$;

select 'MIZIZI_SHARED_REVIEW_AUTHORITY_PASS' as verification_result;
