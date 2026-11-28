-- Issue #1441. CLI 2.107.0 mint #45843413175.
-- Enforce current custody of explicit chart journal source references at the
-- existing database RPC boundary. No new grants, data edits or policy seeds.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
do $guard$
begin
 if current_user<>'postgres'
 or to_regprocedure('mizizi_private.desk_custody_receipt_current_v1(mizizi_private.desk_tool_receipts_v1,jsonb)') is null
 or to_regprocedure('public.mizizi_read_research_passes_v1(uuid,text)') is null
 or to_regprocedure('public.mizizi_append_research_pass_v1(uuid,text,text,text,text)') is null
 or to_regprocedure('public.mizizi_complete_case_research_job_v1(uuid,text,jsonb)') is null
 or to_regprocedure('mizizi_private.assert_desk_journal_current_v1(uuid,text,uuid,jsonb)') is not null
 or has_schema_privilege('service_role','mizizi_private','USAGE')
 then raise exception 'STOP_MIZIZI_DESK_JOURNAL_PREIMAGE';end if;
end $guard$;

create function mizizi_private.assert_desk_journal_current_v1(
 p_job_id uuid,p_worker_id text,p_case_id uuid,p_pending jsonb
) returns void language plpgsql security definer set search_path=pg_catalog as $journal$
declare c jsonb;b jsonb;ref jsonb;r mizizi_private.desk_tool_receipts_v1;
 s jsonb;a jsonb;seen uuid[];sid uuid;
begin
 -- Same lock order as the existing custody RPCs: policy lock, then exact
 -- job/case locks. Public chart RPCs take the policy lock before row locks.
 perform pg_advisory_xact_lock(214781521,61431);
 c:=mizizi_private.read_leased_chart_research_context_v1(p_job_id,p_worker_id);
 if c is null or c->>'caseId' is distinct from p_case_id::text then
  raise exception 'Desk journal scope denied' using errcode='42501';end if;
 for b in
  select p.body_text::jsonb from mizizi_private.research_passes p
   where p.case_id=p_case_id
  union all select p_pending where p_pending is not null
 loop
  if b->>'caseId' is distinct from c->>'caseId'
   or b->>'workspaceId' is distinct from c->>'workspaceId'
   or jsonb_typeof(b->'sourceReceipts') is distinct from 'array'
   or jsonb_array_length(b->'sourceReceipts')>30 then
   raise exception 'Desk journal source shape denied' using errcode='42501';end if;
  seen:=array[]::uuid[];
  for ref in select value from jsonb_array_elements(b->'sourceReceipts')
  loop
   if jsonb_typeof(ref) is distinct from 'object'
    or coalesce(ref->>'sourceId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
    or ref->'modelDisclosed' is distinct from 'true'::jsonb then
    raise exception 'Desk journal source denied' using errcode='42501';end if;
   sid:=(ref->>'sourceId')::uuid;
   if sid=any(seen) then raise exception 'Desk journal duplicate source denied' using errcode='42501';end if;
   seen:=array_append(seen,sid);
   select * into r from mizizi_private.desk_tool_receipts_v1 where id=sid and source_id=sid;
   if not found or not coalesce(mizizi_private.desk_custody_receipt_current_v1(r,c),false) then
    raise exception 'Desk journal custody denied' using errcode='42501';end if;
   s:=null;
   select value into s from jsonb_array_elements(r.result_text::jsonb->'sources')
    where value->'source'->>'sourceId'=sid::text;
   a:=s->'source';
   if s is null or a->>'caseId' is distinct from c->>'caseId'
    or a->>'workspaceId' is distinct from c->>'workspaceId'
    or ref->'originKey' is distinct from a->'originKey'
    or ref->'lineageKey' is distinct from a->'lineageKey'
    or ref->'payloadFingerprint' is distinct from a->'fingerprint'
    or ref->'useBasis' is distinct from a->'useBasis'
    or ref->'authorityRef' is distinct from a->'authorityRef'
    or ref->'observedAt' is distinct from a->'observedAt'
    or ref->'citation' is distinct from s->'citation'
    or ref->'excerpt' is distinct from s->'excerpt'
    or a->'privateResearchAllowed' is distinct from 'true'::jsonb
    or a->'externalModelProcessingAllowed' is distinct from 'true'::jsonb
    or a->'privateEvidenceRetentionAllowed' is distinct from 'true'::jsonb
    or a->'revokedAt' is distinct from 'null'::jsonb
    or coalesce((a->>'expiresAt')::timestamptz<=clock_timestamp(),true) then
    raise exception 'Desk journal source projection denied' using errcode='42501';end if;
  end loop;
 end loop;
 if (c->>'leaseExpiresAt')::timestamptz<=clock_timestamp() then
  raise exception 'Desk journal lease expired' using errcode='55000';end if;
end $journal$;
revoke all on function mizizi_private.assert_desk_journal_current_v1(uuid,text,uuid,jsonb)
 from public,anon,authenticated,service_role,mizizi_executor;

create or replace function public.mizizi_read_research_passes_v1(
 p_job_id uuid,p_worker_id text
)
returns table (ordinal integer,body_text text,fingerprint text)
language plpgsql security definer set search_path=pg_catalog
as $read$
declare v_case_id uuid;
begin
 if coalesce(auth.role(),'')<>'service_role' then
  raise exception 'Service-role research authority required' using errcode='42501';
 end if;
 if p_job_id is null or p_worker_id is null or
    p_worker_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$'
 then raise exception 'Invalid leased research identity' using errcode='22023';
 end if;
 if p_worker_id like 'mizizi-chart:%' then
  perform pg_advisory_xact_lock(214781521,61431);
 end if;
 select c.id into v_case_id
  from platform_private.jobs j
  join mizizi_private.case_resource_bindings b
   on b.resource_id=j.resource_id and b.case_id=j.resource_id
  join mizizi_private.cases c
   on c.id=b.case_id and c.workspace_id=b.workspace_id
 where j.id=p_job_id
   and j.command_type='mizizi.case_research_v1'
   and j.job_type='mizizi.case_research_v1'
   and j.status='running' and j.locked_by=p_worker_id
   and j.lease_expires_at>now()
   and (j.input_payload->>'case_id')::uuid=c.id
   and (j.input_payload->>'workspace_id')::uuid=c.workspace_id
   and c.current_stage='research'
   and c.revision=(j.input_payload->>'expected_case_revision')::integer;
 if v_case_id is null then
  raise exception 'Research case/worker lease not current' using errcode='55000';
 end if;
 if exists (select 1 from mizizi_private.cases c where c.id=v_case_id and
   (c.claim_family_key='charts2_recording_investigation_v1' or exists (
    select 1 from mizizi_private.chart_candidate_subjects_v1 s where s.case_id=c.id)))
 then
   perform mizizi_private.assert_desk_journal_current_v1(p_job_id,p_worker_id,v_case_id,null);
 end if;
 return query
  select p.ordinal,p.body_text,p.fingerprint
  from mizizi_private.research_passes p
  where p.case_id=v_case_id order by p.ordinal;
end;
$read$;

create or replace function public.mizizi_append_research_pass_v1(
 p_job_id uuid,p_worker_id text,p_body_text text,
 p_fingerprint text,p_predecessor text
)
returns table (case_id uuid,ordinal integer,fingerprint text,outcome text)
language plpgsql security definer set search_path=pg_catalog
as $append$
declare
 v_case_id uuid;
 v_workspace_id uuid;
 v_body jsonb;
 v_ordinal integer;
 v_last_ordinal integer;
 v_last_fingerprint text;
 v_existing text;
begin
 if coalesce(auth.role(),'')<>'service_role' then
  raise exception 'Service-role research authority required' using errcode='42501';
 end if;
 if p_job_id is null or p_worker_id is null or
    p_worker_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$' or
    p_body_text is null or octet_length(p_body_text)>32768 or
    (p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$')
 then raise exception 'Invalid bounded research-pass request' using errcode='22023';
 end if;
 if encode(sha256(convert_to(p_body_text,'UTF8')),'hex')<>p_fingerprint
 then raise exception 'Research-pass content fingerprint mismatch' using errcode='22023';
 end if;
 begin
  v_body:=p_body_text::jsonb;
 exception when others then
  raise exception 'Invalid research-pass JSON' using errcode='22023';
 end;
 if jsonb_typeof(v_body)<>'object'
    or v_body->>'contract' is distinct from 'mizizi.adaptive_investigation.v1'
    or v_body ? 'fingerprint'
    or jsonb_typeof(v_body->'sourceReceipts')<>'array'
    or jsonb_array_length(v_body->'sourceReceipts')>30
    or jsonb_typeof(v_body->'findings')<>'array'
    or jsonb_typeof(v_body->'proposedLeads')<>'array'
    or jsonb_typeof(v_body->'decision')<>'object'
 then
  raise exception 'Invalid research-pass contract' using errcode='22023';
 end if;
 begin
  v_ordinal:=(v_body->>'ordinal')::integer;
 exception when others then
  raise exception 'Research-pass ordinal is invalid' using errcode='22023';
 end;
 if (v_ordinal is null or v_ordinal not between 1 and 10000)
    or nullif(v_body->>'question','') is null
    or (v_body->>'predecessorFingerprint') is distinct from p_predecessor
 then raise exception 'Invalid research-pass identity' using errcode='22023';
 end if;
 if p_worker_id like 'mizizi-chart:%' then
  perform pg_advisory_xact_lock(214781521,61431);
 end if;
 -- Serialize appenders on the actual case row, and verify the worker's
 -- current lease and exact case revision inside this very transaction.
 select c.id,c.workspace_id into v_case_id,v_workspace_id
 from platform_private.jobs j
 join platform_private.command_receipts cr
  on cr.id=j.command_receipt_id
   and cr.resource_id=j.resource_id and cr.command_type=j.command_type
 join mizizi_private.case_resource_bindings b
  on b.resource_id=j.resource_id and b.case_id=j.resource_id
 join mizizi_private.cases c
  on c.id=b.case_id and c.workspace_id=b.workspace_id
 where j.id=p_job_id
  and j.command_type='mizizi.case_research_v1'
  and j.job_type='mizizi.case_research_v1'
  and j.status='running' and j.locked_by=p_worker_id
  and j.lease_expires_at>now() and cr.status='accepted'
  and (j.input_payload->>'case_id')::uuid=c.id
  and (j.input_payload->>'workspace_id')::uuid=c.workspace_id
  and j.input_payload->>'operation'='read_only_research'
  and c.case_state in ('open','in_progress')
  and c.current_stage='research'
  and c.revision=(j.input_payload->>'expected_case_revision')::integer
 for update of j,c;
 if v_case_id is null then
  raise exception 'Research pass is not authorized by a current job lease' using errcode='55000';
 end if;
 if exists (select 1 from mizizi_private.cases c where c.id=v_case_id and
   (c.claim_family_key='charts2_recording_investigation_v1' or exists (
    select 1 from mizizi_private.chart_candidate_subjects_v1 s where s.case_id=c.id)))
 then
   perform mizizi_private.assert_desk_journal_current_v1(p_job_id,p_worker_id,v_case_id,v_body);
 end if;
 if v_body->>'caseId' is distinct from v_case_id::text
    or v_body->>'workspaceId' is distinct from v_workspace_id::text
 then raise exception 'Research-pass workspace or case mismatch' using errcode='42501';
 end if;
 select p.fingerprint into v_existing
  from mizizi_private.research_passes p
 where p.case_id=v_case_id and p.ordinal=v_ordinal;
 if v_existing is not null then
  if v_existing<>p_fingerprint then
   raise exception 'Conflicting immutable pass ordinal' using errcode='55000';
  end if;
  return query select v_case_id,v_ordinal,p_fingerprint,'replayed'::text;
  return;
 end if;
 select p.ordinal,p.fingerprint into v_last_ordinal,v_last_fingerprint
 from mizizi_private.research_passes p
 where p.case_id=v_case_id order by p.ordinal desc limit 1;
 if v_ordinal<>coalesce(v_last_ordinal,0)+1
    or p_predecessor is distinct from v_last_fingerprint
 then raise exception 'Research-pass chain stale or out of order' using errcode='55000';
 end if;
 insert into mizizi_private.research_passes(
  case_id,workspace_id,job_id,ordinal,predecessor_fingerprint,fingerprint,body_text
 ) values(
  v_case_id,v_workspace_id,p_job_id,v_ordinal,p_predecessor,p_fingerprint,p_body_text
 );
 return query select v_case_id,v_ordinal,p_fingerprint,'created'::text;
end;
$append$;

CREATE OR REPLACE FUNCTION public.mizizi_complete_case_research_job_v1(p_job_id uuid, p_worker_id text, p_result jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_job_id uuid;
  v_case_id uuid;
  v_receipt_id uuid;
  v_event_id uuid;
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Service-role access is required' using errcode='42501';
  end if;
  if p_job_id is null or p_worker_id is null or
     p_worker_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$' or
     p_result is null or jsonb_typeof(p_result) <> 'object' or
     octet_length(p_result::text) > 65536
  then
    raise exception 'Invalid MIZIZI research completion request' using errcode='22023';
  end if;

 if p_worker_id like 'mizizi-chart:%' then
  perform pg_advisory_xact_lock(214781521,61431);
 end if;
  -- Lock job and case before completion. The immutable typed case/resource
  -- binding and receipt tuple are both checked under the same transaction.
  select j.id, c.id
    into v_job_id, v_case_id
    from platform_private.jobs j
    join platform_private.command_receipts cr
      on cr.id=j.command_receipt_id
     and cr.resource_id=j.resource_id and cr.command_type=j.command_type
    join mizizi_private.case_resource_bindings b
      on b.resource_id=j.resource_id and b.case_id=j.resource_id
    join mizizi_private.cases c
      on c.id=b.case_id and c.workspace_id=b.workspace_id
   where j.id=p_job_id
     and j.command_type='mizizi.case_research_v1'
     and j.job_type='mizizi.case_research_v1'
     and j.status='running'
     and j.locked_by=p_worker_id
     and j.lease_expires_at>now()
     and cr.status='accepted'
     and c.case_state in ('open','in_progress')
     and c.current_stage='research'
     and c.revision=(j.input_payload->>'expected_case_revision')::integer
     and (j.input_payload->>'case_id')::uuid=c.id
     and (j.input_payload->>'workspace_id')::uuid=c.workspace_id
     and j.input_payload->>'operation'='read_only_research'
    for update of j,c;
  if not found then
    raise exception 'MIZIZI research job is not leased, current, and tied to this case'
      using errcode='55000';
  end if;
 if exists (select 1 from mizizi_private.cases c where c.id=v_case_id and
   (c.claim_family_key='charts2_recording_investigation_v1' or exists (
    select 1 from mizizi_private.chart_candidate_subjects_v1 s where s.case_id=c.id)))
 then
   perform mizizi_private.assert_desk_journal_current_v1(p_job_id,p_worker_id,v_case_id,null);
 end if;
  select command_receipt_id,success_event_id
    into strict v_receipt_id,v_event_id
    from platform_private.complete_job(p_job_id,p_worker_id,p_result);
  return jsonb_build_object(
    'job_id',p_job_id,
    'case_id',v_case_id,
    'command_receipt_id',v_receipt_id,
    'success_event_id',v_event_id,
    'job_status','succeeded'
  );
end;
$function$;

do $acl$
declare signature text;
begin
 foreach signature in array array[
  'public.mizizi_read_research_passes_v1(uuid,text)',
  'public.mizizi_append_research_pass_v1(uuid,text,text,text,text)',
  'public.mizizi_complete_case_research_job_v1(uuid,text,jsonb)'
 ] loop
  if has_function_privilege('anon',signature,'EXECUTE')
   or has_function_privilege('authenticated',signature,'EXECUTE')
   or has_function_privilege('mizizi_executor',signature,'EXECUTE')
   or not has_function_privilege('service_role',signature,'EXECUTE') then
   raise exception 'STOP_DESK_JOURNAL_RPC_ACL';end if;
 end loop;
 if has_function_privilege('service_role','mizizi_private.assert_desk_journal_current_v1(uuid,text,uuid,jsonb)','EXECUTE') then
  raise exception 'STOP_DESK_JOURNAL_PRIVATE_ACL';end if;
end $acl$;
commit;
