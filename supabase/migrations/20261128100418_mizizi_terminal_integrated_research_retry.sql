-- CLI minted 2026-11-28T10:04:18Z by pinned Supabase CLI 2.107.0.
-- Extends ONLY the existing append-only event/command/leased research gates.
-- Reviewed terminal requalification is not retroactive mutability, replay, or
-- permission to bypass independent source, provider, finance, case or steward.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
do $guard$
begin
 if current_user<>'postgres'
  or (select count(*) from supabase_migrations.schema_migrations)<>308
  or (select max(version) from supabase_migrations.schema_migrations)<>'20261128081335'
 then raise exception 'STOP_TERMINAL_RETRY_PREIMAGE';end if;
 if (select encode(sha256(convert_to(prosrc,'UTF8')),'hex') from pg_proc where oid='mizizi_private.admit_desk_reopening_job_v1(uuid,text)'::regprocedure)
 is distinct from 'f96e4ae1d074f61ef08d5edabb187fd26594ed6b053ac461768f2396661e53e1' then raise exception 'STOP_TERMINAL_RETRY_ADMISSION_PREIMAGE';end if;
 if (select encode(sha256(convert_to(prosrc,'UTF8')),'hex') from pg_proc where oid='mizizi_private.desk_reopening_event_current_v1(mizizi_private.desk_reopening_events_v1)'::regprocedure)
 is distinct from 'e9181ae23fd4300273aa2106ca01c7edc29ae771b70738c571f405cce925be7f' then raise exception 'STOP_TERMINAL_RETRY_EVENT_PREIMAGE';end if;
 if (select encode(sha256(convert_to(prosrc,'UTF8')),'hex') from pg_proc where oid='mizizi_private.desk_reopening_job_current_v1(platform_private.jobs,mizizi_private.cases,platform_private.command_receipts)'::regprocedure)
 is distinct from 'a44d2d4d28e1fde25d492da48b283dc4d41183c7c90f16b12429f1dc262a6195' then raise exception 'STOP_TERMINAL_RETRY_JOB_PREIMAGE';end if;
 if (select encode(sha256(convert_to(prosrc,'UTF8')),'hex') from pg_proc where oid='mizizi_private.desk_reopening_pending_pass_v1(uuid,uuid,jsonb)'::regprocedure)
 is distinct from 'f98c2a3a79dcf1739831fc86e15caa709ebcc97f063e4f686061b590c91053eb' then raise exception 'STOP_TERMINAL_RETRY_JOURNAL_PREIMAGE';end if;
end $guard$;
alter table mizizi_private.desk_reopening_events_v1
 drop constraint desk_reopening_events_v1_predecessor_ordinal_check,
 add constraint desk_reopening_events_v1_predecessor_ordinal_check
 check(predecessor_ordinal between 0 and 9999);
alter table mizizi_private.desk_reopening_events_v1
 drop constraint desk_reopening_events_v1_event_kind_check,
 add constraint desk_reopening_events_v1_event_kind_check
 check(event_kind in ('new_source','independent_capability','terminal_requalification'));

-- Existing mizizi_private.desk_reopening_event_current_v1 guarded replacement.
CREATE OR REPLACE FUNCTION mizizi_private.desk_reopening_event_current_v1(e mizizi_private.desk_reopening_events_v1)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare c mizizi_private.cases%rowtype;s mizizi_private.chart_candidate_subjects_v1;
 o mizizi_private.desk_operational_policy_versions_v1;j platform_private.jobs%rowtype;
 p mizizi_private.research_passes%rowtype;scope jsonb;
begin
 if e.event_id is null or e.valid_until<=clock_timestamp() then return false;end if;
 select * into c from mizizi_private.cases where id=e.case_id and workspace_id=e.workspace_id;
 if not found or c.revision<>e.expected_revision or c.case_state<>'in_progress' or c.current_stage<>'research'
 or c.claim_family_key<>'charts2_recording_investigation_v1'
 or c.transition_reason<>'Investigate receipt-bound chart recording identity.' then return false;end if;
 perform mizizi_private.assert_chart_candidate_research_actor_v1(e.workspace_id,e.actor_id);
 perform mizizi_private.assert_chart_candidate_current_v1(e.case_id,e.workspace_id,null);
 select * into s from mizizi_private.chart_candidate_subjects_v1 where case_id=e.case_id and workspace_id=e.workspace_id;
 if not found or s.membership_sha256<>e.membership_sha256 or s.observation_sha256<>e.observation_sha256 then return false;end if;
 scope:=jsonb_build_object('caseId',e.case_id,'workspaceId',e.workspace_id,'expectedRevision',e.expected_revision,
  'membershipSha256',e.membership_sha256,'observationSha256',e.observation_sha256);
 o:=mizizi_private.current_desk_operational_policy_v1(scope);
 if not coalesce(mizizi_private.desk_operational_policy_live_v1(o,scope),false) or not o.adaptive_followups_allowed
 or o.revision<>e.operational_revision or e.valid_until>o.valid_until
 or not(encode(sha256(convert_to(e.question,'UTF8')),'hex')=any(o.question_sha256s)) then return false;end if;
 select * into j from platform_private.jobs where id=e.previous_job_id and resource_id=e.case_id
  and command_type='mizizi.case_research_v1' and job_type='mizizi.case_research_v1';
 if not found or j.status not in ('succeeded','dead_letter') or j.finished_at is null or e.observed_at<=j.finished_at
 or j.input_payload->>'workspace_id' is distinct from e.workspace_id::text
 or j.input_payload->>'expected_case_revision' is distinct from e.expected_revision::text
 or not exists(select 1 from platform_private.command_receipts cr where cr.id=j.command_receipt_id
  and cr.resource_id=e.case_id and cr.command_type=j.command_type and cr.status in ('succeeded','failed')) then return false;end if;
 select * into p from mizizi_private.research_passes where case_id=e.case_id and workspace_id=e.workspace_id and ordinal=e.predecessor_ordinal;
 if e.event_kind='terminal_requalification' and e.predecessor_ordinal=0 then
  if e.predecessor_fingerprint<>repeat('0',64) or j.status<>'dead_letter'
   or exists(select 1 from mizizi_private.research_passes q where q.case_id=e.case_id and q.ordinal>1)
  then return false;end if;
  -- Once the new first pass exists, it must belong to this event's exact
  -- dispatch; old terminal history cannot be silently rewritten.
  if exists(select 1 from mizizi_private.research_passes q where q.case_id=e.case_id and q.ordinal=1
   and (not exists(select 1 from mizizi_private.desk_reopening_dispatches_v1 d
    where d.event_id=e.event_id and d.job_id=q.job_id)
    or q.predecessor_fingerprint is not null
    or q.body_text::jsonb->'reopenEvent' is distinct from jsonb_build_object(
      'sourceEventRef',e.event_id,'eventSha256',e.event_sha256,
      'predecessorFingerprint',e.predecessor_fingerprint,'reopeningMode','terminal_retry')))
  then return false;end if;
 else
  if not found or p.fingerprint<>e.predecessor_fingerprint or p.job_id<>e.previous_job_id
   or encode(sha256(convert_to(p.body_text,'UTF8')),'hex')<>p.fingerprint
   or (e.event_kind='terminal_requalification' and (p.body_text::jsonb->'decision'->>'action' is distinct from 'continue'))
   or (e.event_kind<>'terminal_requalification' and p.body_text::jsonb->'decision'->>'action' is distinct from 'pause')
  then return false;end if;
 end if;
 -- Batch and interactive-browser cross-job replay require distinct custody
 -- qualification. Deny these histories rather than treating a fresh job as
 -- consent to replay a previous transient session or batch result.
 if exists(select 1 from mizizi_private.research_passes h where h.case_id=e.case_id and h.ordinal<=e.predecessor_ordinal
  and (h.body_text::jsonb ? 'deskBatchReceipt'
   or exists(select 1 from jsonb_array_elements(coalesce(h.body_text::jsonb->'deskToolReceipts','[]'::jsonb)) d
    join mizizi_private.desk_tool_receipts_v1 r on r.id::text=d->>'receiptId'
    where r.operation in ('browse_page','render_page','inspect_visual')))) then return false;end if;
 return true;
end $function$;

-- Existing public.admin_mizizi_authorize_desk_reopening_v1 guarded replacement.
CREATE OR REPLACE FUNCTION public.admin_mizizi_authorize_desk_reopening_v1(p_case_id uuid, p_expected_revision integer, p_previous_job_id uuid, p_predecessor_fingerprint text, p_event_id uuid, p_event_sha256 text, p_event_kind text, p_observed_at timestamp with time zone, p_question text, p_valid_until timestamp with time zone, p_acknowledgement text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare actor uuid;c mizizi_private.cases%rowtype;s mizizi_private.chart_candidate_subjects_v1;
 p mizizi_private.research_passes%rowtype;o mizizi_private.desk_operational_policy_versions_v1;
 e mizizi_private.desk_reopening_events_v1;scope jsonb;
begin
 actor:=mizizi_private.assert_headquarters_operator_v1('steward');
 if not coalesce(public.current_user_has_capability('manage_charts'),false) then raise exception 'Chart steward required' using errcode='42501';end if;
 if p_case_id is null or p_expected_revision is null or p_expected_revision<1 or p_previous_job_id is null or p_event_id is null
 or coalesce(p_predecessor_fingerprint,'') !~ '^[a-f0-9]{64}$' or coalesce(p_event_sha256,'') !~ '^[a-f0-9]{64}$'
 or p_event_kind is null or p_event_kind not in ('new_source','independent_capability','terminal_requalification') or p_observed_at is null or p_observed_at>clock_timestamp()
 or p_question is null or length(p_question) not between 8 and 500 or btrim(p_question)<>p_question or p_question ~ '[[:cntrl:]]'
 or p_valid_until is null or p_valid_until<=clock_timestamp() or p_valid_until>clock_timestamp()+interval '24 hours'
 or p_acknowledgement is distinct from 'I reviewed this new event and authorize bounded read-only continuation under existing permissions and budget.'
 then raise exception 'Invalid reviewed reopening event' using errcode='22023';end if;
 perform pg_advisory_xact_lock(214781521,61431);
 select * into c from mizizi_private.cases where id=p_case_id for update;
 if not found then raise exception 'Case unavailable' using errcode='42501';end if;
 perform mizizi_private.assert_chart_candidate_research_actor_v1(c.workspace_id,actor);
 select * into s from mizizi_private.chart_candidate_subjects_v1 where case_id=c.id and workspace_id=c.workspace_id;
 select * into p from mizizi_private.research_passes where case_id=c.id and workspace_id=c.workspace_id order by ordinal desc limit 1;
 if s.case_id is null or c.revision<>p_expected_revision
 or exists(select 1 from platform_private.jobs j where j.resource_id=c.id and j.command_type='mizizi.case_research_v1' and j.status in ('queued','running','retry_wait'))
 then raise exception 'Reopening head or active job conflict' using errcode='55000';end if;
 if p.case_id is null then
  -- A terminal zero-pass job has no predecessor journal to invent.
  -- The one explicit sentinel is scoped to an actual exact dead-letter job.
  if p_event_kind<>'terminal_requalification' or p_predecessor_fingerprint<>repeat('0',64)
   or exists(select 1 from mizizi_private.research_passes q where q.case_id=c.id)
   or not exists(select 1 from platform_private.jobs j where j.id=p_previous_job_id and j.resource_id=c.id
     and j.job_type='mizizi.case_research_v1' and j.status='dead_letter' and j.finished_at< p_observed_at)
  then raise exception 'Zero-pass terminal recovery review denied' using errcode='42501';end if;
 else
  if p.fingerprint is distinct from p_predecessor_fingerprint or p.job_id is distinct from p_previous_job_id
   or (p_event_kind='terminal_requalification' and p.body_text::jsonb->'decision'->>'action'<>'continue')
  then raise exception 'Predecessor review conflict' using errcode='55000';end if;
 end if;
 scope:=jsonb_build_object('caseId',c.id,'workspaceId',c.workspace_id,'expectedRevision',c.revision,
  'membershipSha256',s.membership_sha256,'observationSha256',s.observation_sha256);
 o:=mizizi_private.current_desk_operational_policy_v1(scope);
 if o.revision is null then raise exception 'Existing standing authority required' using errcode='42501';end if;
 e.event_id:=p_event_id;e.case_id:=c.id;e.workspace_id:=c.workspace_id;e.previous_job_id:=p_previous_job_id;
 e.predecessor_fingerprint:=coalesce(p.fingerprint,repeat('0',64));e.predecessor_ordinal:=coalesce(p.ordinal,0);e.expected_revision:=c.revision;
 e.operational_revision:=o.revision;e.membership_sha256:=s.membership_sha256;e.observation_sha256:=s.observation_sha256;
 e.event_sha256:=p_event_sha256;e.event_kind:=p_event_kind;e.observed_at:=p_observed_at;e.question:=p_question;
 e.actor_id:=actor;e.valid_until:=p_valid_until;e.recorded_at:=clock_timestamp();
 if not mizizi_private.desk_reopening_event_current_v1(e) then raise exception 'Reviewed reopening authority denied' using errcode='42501';end if;
 insert into mizizi_private.desk_reopening_events_v1 select (e).* on conflict do nothing;
 if not exists(select 1 from mizizi_private.desk_reopening_events_v1 v where v.event_id=e.event_id and
  (to_jsonb(v)-'recorded_at')=(to_jsonb(e)-'recorded_at')) then raise exception 'Conflicting reopening event' using errcode='23505';end if;
 return jsonb_build_object('eventId',e.event_id,'caseId',e.case_id,'workspaceId',e.workspace_id,
  'previousJobId',e.previous_job_id,'expectedRevision',e.expected_revision,'eventSha256',e.event_sha256,
  'predecessorFingerprint',e.predecessor_fingerprint,'validUntil',e.valid_until,'jobsDispatched',0);
end $function$;

-- Existing mizizi_private.admit_desk_reopening_job_v1 guarded replacement.
CREATE OR REPLACE FUNCTION mizizi_private.admit_desk_reopening_job_v1(p_event_id uuid, p_event_sha256 text)
 RETURNS TABLE(case_id uuid, workspace_id uuid, resource_id uuid, case_revision integer, command_receipt_id uuid, job_id uuid, job_status text, outcome text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare e mizizi_private.desk_reopening_events_v1;d mizizi_private.desk_reopening_dispatches_v1;
 cr platform_private.command_receipts%rowtype;j platform_private.jobs%rowtype;
 payload jsonb;fp text;remaining integer;
begin
 perform mizizi_private.assert_executor_v1();
 if session_user<>'mizizi_executor' then raise exception 'Approved JIT executor required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(214781521,61431);
 select * into e from mizizi_private.desk_reopening_events_v1 where event_id=p_event_id and event_sha256=p_event_sha256;
 if not found or not mizizi_private.desk_reopening_event_current_v1(e) then raise exception 'Reopening event denied' using errcode='42501';end if;
 perform 1 from mizizi_private.cases where id=e.case_id for update;
 select * into d from mizizi_private.desk_reopening_dispatches_v1 x where x.event_id=e.event_id;
 if found then
  select q.* into strict j from platform_private.jobs q where q.id=d.job_id and q.resource_id=e.case_id and q.command_receipt_id=d.command_receipt_id;
  return query select e.case_id,e.workspace_id,e.case_id,e.expected_revision,j.command_receipt_id,j.id,j.status,'replayed'::text;return;
 end if;
 if not((e.predecessor_ordinal=0 and e.event_kind='terminal_requalification' and
  not exists(select 1 from mizizi_private.research_passes h where h.case_id=e.case_id))
  or (e.predecessor_ordinal>0 and
    (select h.fingerprint from mizizi_private.research_passes h where h.case_id=e.case_id order by h.ordinal desc limit 1)=e.predecessor_fingerprint))
 or exists(select 1 from mizizi_private.desk_reopening_dispatches_v1 x where x.case_id=e.case_id and x.predecessor_fingerprint=e.predecessor_fingerprint)
 or exists(select 1 from platform_private.jobs q where q.resource_id=e.case_id and q.command_type='mizizi.case_research_v1' and q.status in ('queued','running','retry_wait'))
 then raise exception 'Reopening already dispatched or stale' using errcode='55000';end if;
 select 25-coalesce(sum(q.attempt_count),0)::integer into remaining from platform_private.jobs q
 where q.resource_id=e.case_id and q.command_type='mizizi.case_research_v1';
 if remaining<1 then raise exception 'Cumulative attempt ceiling reached' using errcode='55000';end if;
 payload:=jsonb_build_object('case_id',e.case_id,'workspace_id',e.workspace_id,'expected_case_revision',e.expected_revision,
  'operation','read_only_research','reason','Investigate receipt-bound chart recording identity.','reopen_event_id',e.event_id);
 fp:=encode(sha256(convert_to(payload::text,'UTF8')),'hex');
 insert into platform_private.command_receipts(command_type,resource_id,principal_key,actor_user_id,idempotency_key,request_fingerprint,request_payload)
 values('mizizi.case_research_v1',e.case_id,'system:mizizi',null,'mizizi.case_research_v1.reopen.'||e.event_id::text,fp,payload) returning * into cr;
 insert into platform_private.jobs(command_receipt_id,resource_id,command_type,job_key,job_type,status,input_payload,max_attempts)
 values(cr.id,e.case_id,'mizizi.case_research_v1','reopen:'||e.event_id::text,'mizizi.case_research_v1','queued',payload,remaining) returning * into j;
 insert into mizizi_private.desk_reopening_dispatches_v1(event_id,case_id,predecessor_fingerprint,job_id,command_receipt_id)
 values(e.event_id,e.case_id,e.predecessor_fingerprint,j.id,cr.id);
 insert into mizizi_private.case_receipt_links(workspace_id,case_id,relation_type,authority_schema,authority_object_type,
  authority_id,authority_fingerprint,linked_by_actor_key,link_reason)
 values(e.workspace_id,e.case_id,'command_receipt','platform_private','command_receipts',cr.id,fp,'system:mizizi',
  'Reviewed new event authorized read-only continuation on the existing investigation journal.');
 insert into platform_private.outbox_events(event_key,command_receipt_id,job_id,command_type,aggregate_id,event_type,payload)
 values('command:'||cr.id::text||':accepted',cr.id,j.id,'mizizi.case_research_v1',e.case_id,'mizizi.case_research_v1.accepted',
  jsonb_build_object('case_id',e.case_id,'workspace_id',e.workspace_id,'case_revision',e.expected_revision,'job_id',j.id,'command_receipt_id',cr.id));
 return query select e.case_id,e.workspace_id,e.case_id,e.expected_revision,cr.id,j.id,j.status,'created'::text;
end $function$;

-- Existing mizizi_private.desk_reopening_job_current_v1 guarded replacement.
CREATE OR REPLACE FUNCTION mizizi_private.desk_reopening_job_current_v1(j platform_private.jobs, c mizizi_private.cases, cr platform_private.command_receipts)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare e mizizi_private.desk_reopening_events_v1;d mizizi_private.desk_reopening_dispatches_v1;p mizizi_private.research_passes%rowtype;
begin
 select * into d from mizizi_private.desk_reopening_dispatches_v1 where job_id=j.id and command_receipt_id=cr.id and case_id=c.id;
 if not found then return false;end if;
 select * into e from mizizi_private.desk_reopening_events_v1 where event_id=d.event_id;
 if e.event_id is null or e.case_id<>c.id or e.workspace_id<>c.workspace_id or e.expected_revision<>c.revision
 or d.predecessor_fingerprint<>e.predecessor_fingerprint
 or j.input_payload->>'reopen_event_id' is distinct from e.event_id::text
 or cr.idempotency_key is distinct from 'mizizi.case_research_v1.reopen.'||e.event_id::text
 or cr.request_fingerprint is distinct from encode(sha256(convert_to(j.input_payload::text,'UTF8')),'hex')
 or not mizizi_private.desk_reopening_event_current_v1(e) then return false;end if;
 select * into p from mizizi_private.research_passes where case_id=c.id and ordinal=e.predecessor_ordinal+1;
 if found then return coalesce(p.job_id=j.id
  and ((e.predecessor_ordinal=0 and p.predecessor_fingerprint is null)
   or (e.predecessor_ordinal>0 and p.predecessor_fingerprint=e.predecessor_fingerprint))
  and p.body_text::jsonb->>'question'=e.question and p.body_text::jsonb->'reopenEvent'=(
   jsonb_build_object('sourceEventRef',e.event_id,'eventSha256',e.event_sha256,
    'predecessorFingerprint',e.predecessor_fingerprint)||
    case when e.event_kind='terminal_requalification'
      then jsonb_build_object('reopeningMode','terminal_retry') else '{}'::jsonb end),false);end if;
 if e.predecessor_ordinal=0 then return not exists(
  select 1 from mizizi_private.research_passes h where h.case_id=c.id);end if;
 return (select h.fingerprint from mizizi_private.research_passes h where h.case_id=c.id order by h.ordinal desc limit 1)=e.predecessor_fingerprint;
end $function$;

-- Existing mizizi_private.desk_reopening_pending_pass_v1 guarded replacement.
CREATE OR REPLACE FUNCTION mizizi_private.desk_reopening_pending_pass_v1(p_job uuid, p_case uuid, p_body jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare e mizizi_private.desk_reopening_events_v1;
begin
 select v.* into e from mizizi_private.desk_reopening_dispatches_v1 d join mizizi_private.desk_reopening_events_v1 v on v.event_id=d.event_id
 where d.job_id=p_job and d.case_id=p_case;
 if not found then return not(p_body ? 'reopenEvent');end if;
 if p_body->>'ordinal'=(e.predecessor_ordinal+1)::text then
  return coalesce(((e.predecessor_ordinal=0 and p_body->'predecessorFingerprint'='null'::jsonb)
     or (e.predecessor_ordinal>0 and p_body->>'predecessorFingerprint'=e.predecessor_fingerprint))
    and p_body->>'question'=e.question
    and p_body->'reopenEvent'=(jsonb_build_object('sourceEventRef',e.event_id,'eventSha256',e.event_sha256,
     'predecessorFingerprint',e.predecessor_fingerprint)||
     case when e.event_kind='terminal_requalification'
       then jsonb_build_object('reopeningMode','terminal_retry') else '{}'::jsonb end),false);
 end if;
 return not(p_body ? 'reopenEvent') and exists(select 1 from mizizi_private.research_passes p
  where p.case_id=p_case and p.job_id=p_job and p.ordinal=e.predecessor_ordinal+1);
end $function$;

-- Existing public.mizizi_read_desk_reopening_event_v1 guarded replacement.
CREATE OR REPLACE FUNCTION public.mizizi_read_desk_reopening_event_v1(p_scope jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare c jsonb;e mizizi_private.desk_reopening_events_v1;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service role required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(214781521,61431);
 c:=mizizi_private.desk_custody_context_v1(p_scope);
 if c is null then return null;end if;
 select v.* into e from mizizi_private.desk_reopening_dispatches_v1 d join mizizi_private.desk_reopening_events_v1 v on v.event_id=d.event_id
 where d.job_id=(c->>'jobId')::uuid and v.case_id=(c->>'caseId')::uuid;
 if not found or exists(select 1 from mizizi_private.research_passes p where p.case_id=e.case_id and p.ordinal=e.predecessor_ordinal+1) then return null;end if;
 perform mizizi_private.assert_desk_journal_current_v1((c->>'jobId')::uuid,p_scope->>'workerId',e.case_id,null);
 return jsonb_build_object('sourceEventRef',e.event_id,'eventSha256',e.event_sha256,'predecessorFingerprint',e.predecessor_fingerprint,'question',e.question)||case when e.event_kind='terminal_requalification' then jsonb_build_object('reopeningMode','terminal_retry') else '{}'::jsonb end;
end $function$;

-- This migration never creates a grant or rewrites any existing case,
-- terminal job, immutable research pass, command receipt or financial event.
commit;
