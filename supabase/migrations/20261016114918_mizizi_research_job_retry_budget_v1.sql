-- Migration path authority: Supabase CLI 2.107.0, GitHub Actions 38896293206.
-- Only new MIZIZI research jobs receive the existing shared maximum of 25.
-- Unrelated job types retain the shared default; case continuation remains governed.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $preflight$
begin
 if current_user <> 'postgres'
    or to_regprocedure('mizizi_private.admit_case_research_job_v1(uuid,uuid,integer,text,text,text,text)') is null
    or to_regclass('mizizi_private.research_passes') is null
    or (select count(*) from supabase_migrations.schema_migrations) <> 233
    or (select max(version) from supabase_migrations.schema_migrations) <> '20261016092731'
    or encode(sha256(convert_to(
       pg_get_functiondef(to_regprocedure('mizizi_private.admit_case_research_job_v1(uuid,uuid,integer,text,text,text,text)')),'UTF8')),'hex')
       <> '68db13d02ff4b8cb964bd17bb197cd19345287cee20b327aaaba6a9171532dfb'
 then raise exception 'STOP_MIZIZI_RESEARCH_RETRY_BUDGET_BASELINE_DRIFT';end if;
 if (select pg_get_constraintdef(c.oid) from pg_constraint c
     where c.conrelid='platform_private.jobs'::regclass
       and c.conname='jobs_attempt_count_check')
    not like '%max_attempts <= 25%'
 then raise exception 'STOP_MIZIZI_SHARED_JOB_CAP_NOT_25';end if;
end $preflight$;

CREATE OR REPLACE FUNCTION mizizi_private.admit_case_research_job_v1(p_case_id uuid, p_workspace_id uuid, p_expected_revision integer, p_principal_key text, p_idempotency_key text, p_request_fingerprint text, p_reason text)
 RETURNS TABLE(case_id uuid, workspace_id uuid, resource_id uuid, case_revision integer, command_receipt_id uuid, job_id uuid, job_status text, outcome text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_case mizizi_private.cases%rowtype;
  v_workspace uuid;
  v_resource editorial.resources%rowtype;
  v_binding mizizi_private.case_resource_bindings%rowtype;
  v_request jsonb;
  v_fp text;
  v_receipt platform_private.command_receipts%rowtype;
  v_job platform_private.jobs%rowtype;
  v_link mizizi_private.case_receipt_links%rowtype;
  v_created boolean := false;
  v_reason text;
begin
  perform mizizi_private.assert_executor_v1();
  if session_user <> 'mizizi_executor' then
    raise exception 'Only approved MIZIZI JIT executor may admit research jobs' using errcode='42501';
  end if;
  v_reason := btrim(p_reason);
  if p_case_id is null or p_workspace_id is null
     or p_expected_revision is null or p_expected_revision < 1
     or p_principal_key is distinct from 'system:mizizi'
     or p_idempotency_key is null
     or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
     or p_request_fingerprint is null
     or p_request_fingerprint !~ '^[0-9a-f]{64}$'
     or p_reason is null or char_length(v_reason) < 8
     or octet_length(v_reason) > 2000
  then
    raise exception 'Invalid MIZIZI shared research command' using errcode='22023';
  end if;
  v_fp := encode(extensions.digest(convert_to(
    p_case_id::text || E'\n' || p_workspace_id::text || E'\n' ||
    p_expected_revision::text || E'\nread_only_research\n' || v_reason,
    'UTF8'), 'sha256'),'hex');
  if p_request_fingerprint <> v_fp then
    raise exception 'MIZIZI research command fingerprint mismatch' using errcode='23514';
  end if;
  select w.id into strict v_workspace from mizizi_private.workspaces w
  where w.id=p_workspace_id and w.workspace_key='wakilisha-internal'
    and w.workspace_kind='internal' and w.status='active';
  select c.* into strict v_case from mizizi_private.cases c
  where c.id=p_case_id and c.workspace_id=v_workspace for update;
  if v_case.revision <> p_expected_revision
     or v_case.case_state not in ('open','in_progress') or v_case.current_stage <> 'research'
  then
    raise exception 'MIZIZI case revision or stage not eligible for research' using errcode='55000';
  end if;
  -- Make the exact case ID an actual typed editorial Resource, not a cast.
  insert into editorial.resources(id,resource_kind,visibility,lifecycle_state)
  values (v_case.id,'mizizi_case','internal','active')
  on conflict (id) do nothing;
  select res.* into strict v_resource from editorial.resources res
  where res.id=v_case.id for update;
  if v_resource.resource_kind <> 'mizizi_case'
     or v_resource.visibility <> 'internal'
     or v_resource.lifecycle_state <> 'active' then
    raise exception 'MIZIZI case Resource ID collided with another authority' using errcode='23514';
  end if;
  insert into mizizi_private.case_resource_bindings(case_id,workspace_id,resource_id)
  values(v_case.id,v_workspace,v_case.id) on conflict on constraint case_resource_bindings_pkey do nothing;
  select b.* into strict v_binding from mizizi_private.case_resource_bindings b
  where b.case_id=v_case.id for update;
  if v_binding.workspace_id <> v_workspace or v_binding.resource_id <> v_case.id
     or v_binding.resource_kind <> 'mizizi_case' then
    raise exception 'MIZIZI case Resource binding drift' using errcode='23514';
  end if;

  v_request := jsonb_build_object(
    'case_id',v_case.id,'workspace_id',v_workspace,
    'expected_case_revision',p_expected_revision,
    'operation','read_only_research','reason',v_reason);
  insert into platform_private.command_receipts(
    command_type,resource_id,principal_key,actor_user_id,idempotency_key,
    request_fingerprint,request_payload
  ) values (
    'mizizi.case_research_v1',v_case.id,p_principal_key,null,p_idempotency_key,
    v_fp,v_request
  ) on conflict (principal_key,command_type,idempotency_key) do nothing
  returning * into v_receipt;
  if v_receipt.id is null then
    select cr.* into strict v_receipt from platform_private.command_receipts cr
    where cr.principal_key=p_principal_key and cr.command_type='mizizi.case_research_v1'
      and cr.idempotency_key=p_idempotency_key for update;
    if v_receipt.resource_id <> v_case.id
       or v_receipt.request_fingerprint <> v_fp
       or v_receipt.request_payload <> v_request then
      raise exception 'MIZIZI job idempotency key was reused for a different command' using errcode='23505';
    end if;
  else
    v_created := true;
  end if;

  insert into platform_private.jobs (
    command_receipt_id,resource_id,command_type,job_key,job_type,
    status,input_payload,max_attempts
  ) values (
    v_receipt.id,v_case.id,'mizizi.case_research_v1',
    'research:' || p_expected_revision::text,'mizizi.case_research_v1',
    'queued',v_request,25
  ) on conflict on constraint jobs_receipt_job_key do nothing returning * into v_job;
  if v_job.id is null then
    select j.* into strict v_job from platform_private.jobs j
    where j.command_receipt_id=v_receipt.id
      and j.job_key='research:' || p_expected_revision::text for update;
    if v_job.resource_id <> v_case.id
       or v_job.command_type <> 'mizizi.case_research_v1'
       or v_job.job_type <> 'mizizi.case_research_v1'
       or v_job.input_payload <> v_request then
      raise exception 'MIZIZI job replay disagrees with immutable command' using errcode='23514';
    end if;
  end if;
  if v_job.status not in ('queued','retry_wait','running','succeeded') then
    raise exception 'MIZIZI job is terminal and requires a separate reviewed retry' using errcode='55000';
  end if;
  -- Reuse DB02's immutable, existence-checked typed authority links, rather
  -- than inventing a parallel receipt table or copying private payloads.
  insert into mizizi_private.case_receipt_links (
    workspace_id,case_id,relation_type,authority_schema,authority_object_type,
    authority_id,authority_fingerprint,linked_by_actor_key,link_reason
  ) values (
    v_workspace,v_case.id,'command_receipt','platform_private','command_receipts',
    v_receipt.id,v_fp,'system:mizizi',
    'MIZIZI read-only research stage accepted by the shared platform jobs ledger.'
  ) on conflict on constraint mizizi_case_receipt_links_unique
    do nothing;
  select l.* into strict v_link from mizizi_private.case_receipt_links l
  where l.case_id=v_case.id and l.relation_type='command_receipt'
    and l.authority_schema='platform_private'
    and l.authority_object_type='command_receipts'
    and l.authority_id=v_receipt.id;
  if v_link.workspace_id <> v_workspace or v_link.authority_fingerprint <> v_fp
     or v_link.linked_by_actor_key <> 'system:mizizi' then
    raise exception 'MIZIZI command receipt link identity/fingerprint drift' using errcode='23514';
  end if;
  insert into platform_private.outbox_events (
    event_key,command_receipt_id,job_id,command_type,aggregate_id,event_type,payload
  ) values (
    'command:' || v_receipt.id::text || ':accepted',v_receipt.id,v_job.id,
    'mizizi.case_research_v1',v_case.id,'mizizi.case_research_v1.accepted',
    jsonb_build_object('case_id',v_case.id,'workspace_id',v_workspace,
      'case_revision',v_case.revision,'job_id',v_job.id,
      'command_receipt_id',v_receipt.id)
  ) on conflict (event_key) do nothing;

  return query select v_case.id,v_workspace,v_case.id,v_case.revision,
    v_receipt.id,v_job.id,v_job.status,
    case when v_created then 'created'::text else 'replayed'::text end;
end;
$function$;

do $verify$
begin
 if (select proowner::regrole::text from pg_proc
      where oid='mizizi_private.admit_case_research_job_v1(uuid,uuid,integer,text,text,text,text)'::regprocedure)
    <> 'postgres'
    or has_function_privilege('authenticated',
       'mizizi_private.admit_case_research_job_v1(uuid,uuid,integer,text,text,text,text)','EXECUTE')
    or has_function_privilege('anon',
       'mizizi_private.admit_case_research_job_v1(uuid,uuid,integer,text,text,text,text)','EXECUTE')
 then raise exception 'STOP_MIZIZI_RESEARCH_RETRY_FUNCTION_ACL_DRIFT';end if;
end $verify$;
commit;
