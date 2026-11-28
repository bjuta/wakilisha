-- Issue #1441; CLI 2.107.0 mint #46033769166.
-- Reviewed event admission reuses the existing shared ledger; no historical
-- job reset, policy revision, entitlement, provider, or automatic retry.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
do $guard$ begin
 if current_user<>'postgres'
 or to_regclass('mizizi_private.desk_reopening_events_v1') is not null
 or to_regprocedure('mizizi_private.desk_same_case_recall_candidate_v1(jsonb)') is null
 or to_regprocedure('mizizi_private.assert_chart_candidate_research_actor_v1(uuid,uuid)') is null
 then raise exception 'STOP_MIZIZI_REOPEN_PREIMAGE';end if;
end $guard$;

-- Independent steward attestation of a new event, not a source permission.
-- The digest refers to a separately reviewed artifact held by its custodian.
create table mizizi_private.desk_reopening_events_v1(
 event_id uuid primary key,case_id uuid not null,workspace_id uuid not null,
 previous_job_id uuid not null references platform_private.jobs(id),
 predecessor_fingerprint text not null check(predecessor_fingerprint ~ '^[a-f0-9]{64}$'),
 predecessor_ordinal integer not null check(predecessor_ordinal between 1 and 9999),
 expected_revision integer not null check(expected_revision>0),
 operational_revision integer not null check(operational_revision>0),
 membership_sha256 text not null check(membership_sha256 ~ '^[a-f0-9]{64}$'),
 observation_sha256 text not null check(observation_sha256 ~ '^[a-f0-9]{64}$'),
 event_sha256 text not null check(event_sha256 ~ '^[a-f0-9]{64}$'),
 event_kind text not null check(event_kind in ('new_source','independent_capability')),
 observed_at timestamptz not null,question text not null check(length(question) between 8 and 500 and btrim(question)=question and question !~ '[[:cntrl:]]'),
 actor_id uuid not null,valid_until timestamptz not null,recorded_at timestamptz not null default clock_timestamp(),
 unique(case_id,event_sha256),
 check(observed_at<=recorded_at and valid_until>recorded_at)
);
create table mizizi_private.desk_reopening_dispatches_v1(
 event_id uuid primary key references mizizi_private.desk_reopening_events_v1(event_id),
 case_id uuid not null,predecessor_fingerprint text not null,
 job_id uuid not null unique references platform_private.jobs(id),
 command_receipt_id uuid not null unique references platform_private.command_receipts(id),
 recorded_at timestamptz not null default clock_timestamp(),
 unique(case_id,predecessor_fingerprint)
);
alter table mizizi_private.desk_reopening_events_v1 enable row level security;
alter table mizizi_private.desk_reopening_events_v1 force row level security;
alter table mizizi_private.desk_reopening_dispatches_v1 enable row level security;
alter table mizizi_private.desk_reopening_dispatches_v1 force row level security;
revoke all on mizizi_private.desk_reopening_events_v1,mizizi_private.desk_reopening_dispatches_v1 from public,anon,authenticated,service_role,mizizi_executor;

create function mizizi_private.desk_reopening_event_current_v1(e mizizi_private.desk_reopening_events_v1)
returns boolean language plpgsql security definer set search_path=pg_catalog as $f$
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
 if not found or p.fingerprint<>e.predecessor_fingerprint or p.job_id<>e.previous_job_id
 or p.body_text::jsonb->'decision'->>'action' is distinct from 'pause'
 or encode(sha256(convert_to(p.body_text,'UTF8')),'hex')<>p.fingerprint then return false;end if;
 -- Batch and interactive-browser cross-job replay require distinct custody
 -- qualification. Deny these histories rather than treating a fresh job as
 -- consent to replay a previous transient session or batch result.
 if exists(select 1 from mizizi_private.research_passes h where h.case_id=e.case_id and h.ordinal<=e.predecessor_ordinal
  and (h.body_text::jsonb ? 'deskBatchReceipt'
   or exists(select 1 from jsonb_array_elements(coalesce(h.body_text::jsonb->'deskToolReceipts','[]'::jsonb)) d
    join mizizi_private.desk_tool_receipts_v1 r on r.id::text=d->>'receiptId'
    where r.operation in ('browse_page','render_page','inspect_visual')))) then return false;end if;
 return true;
end $f$;

create function public.admin_mizizi_authorize_desk_reopening_v1(p_case_id uuid,p_expected_revision integer,
 p_previous_job_id uuid,p_predecessor_fingerprint text,p_event_id uuid,p_event_sha256 text,p_event_kind text,
 p_observed_at timestamptz,p_question text,p_valid_until timestamptz,p_acknowledgement text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare actor uuid;c mizizi_private.cases%rowtype;s mizizi_private.chart_candidate_subjects_v1;
 p mizizi_private.research_passes%rowtype;o mizizi_private.desk_operational_policy_versions_v1;
 e mizizi_private.desk_reopening_events_v1;scope jsonb;
begin
 actor:=mizizi_private.assert_headquarters_operator_v1('steward');
 if not coalesce(public.current_user_has_capability('manage_charts'),false) then raise exception 'Chart steward required' using errcode='42501';end if;
 if p_case_id is null or p_expected_revision is null or p_expected_revision<1 or p_previous_job_id is null or p_event_id is null
 or coalesce(p_predecessor_fingerprint,'') !~ '^[a-f0-9]{64}$' or coalesce(p_event_sha256,'') !~ '^[a-f0-9]{64}$'
 or p_event_kind is null or p_event_kind not in ('new_source','independent_capability') or p_observed_at is null or p_observed_at>clock_timestamp()
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
 if s.case_id is null or p.case_id is null or p.fingerprint is distinct from p_predecessor_fingerprint or p.job_id is distinct from p_previous_job_id
 or c.revision<>p_expected_revision
 or exists(select 1 from platform_private.jobs j where j.resource_id=c.id and j.command_type='mizizi.case_research_v1' and j.status in ('queued','running','retry_wait'))
 then raise exception 'Reopening head or active job conflict' using errcode='55000';end if;
 scope:=jsonb_build_object('caseId',c.id,'workspaceId',c.workspace_id,'expectedRevision',c.revision,
  'membershipSha256',s.membership_sha256,'observationSha256',s.observation_sha256);
 o:=mizizi_private.current_desk_operational_policy_v1(scope);
 if o.revision is null then raise exception 'Existing standing authority required' using errcode='42501';end if;
 e.event_id:=p_event_id;e.case_id:=c.id;e.workspace_id:=c.workspace_id;e.previous_job_id:=p_previous_job_id;
 e.predecessor_fingerprint:=p.fingerprint;e.predecessor_ordinal:=p.ordinal;e.expected_revision:=c.revision;
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
end $f$;

-- Existing JIT actor consumes one reviewed event atomically into a NEW
-- command and job. Historical attempts and monetary reservations stay intact.
create function mizizi_private.admit_desk_reopening_job_v1(p_event_id uuid,p_event_sha256 text)
returns table(case_id uuid,workspace_id uuid,resource_id uuid,case_revision integer,command_receipt_id uuid,job_id uuid,job_status text,outcome text)
language plpgsql security definer set search_path=pg_catalog as $f$
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
 if (select h.fingerprint from mizizi_private.research_passes h where h.case_id=e.case_id order by h.ordinal desc limit 1) is distinct from e.predecessor_fingerprint
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
end $f$;

create function mizizi_private.desk_reopening_job_current_v1(j platform_private.jobs,c mizizi_private.cases,cr platform_private.command_receipts)
returns boolean language plpgsql security definer set search_path=pg_catalog as $f$
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
 if found then return coalesce(p.job_id=j.id and p.predecessor_fingerprint=e.predecessor_fingerprint
  and p.body_text::jsonb->>'question'=e.question and p.body_text::jsonb->'reopenEvent'=jsonb_build_object(
   'sourceEventRef',e.event_id,'eventSha256',e.event_sha256,'predecessorFingerprint',e.predecessor_fingerprint),false);end if;
 return (select h.fingerprint from mizizi_private.research_passes h where h.case_id=c.id order by h.ordinal desc limit 1)=e.predecessor_fingerprint;
end $f$;

create or replace function mizizi_private.read_leased_chart_research_context_v1(p_job_id uuid,p_worker_id text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $context$
declare
 j platform_private.jobs%rowtype;
 c mizizi_private.cases%rowtype;
 s mizizi_private.chart_candidate_subjects_v1%rowtype;
 material jsonb;
 positions jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role' then
  raise exception 'Service-role chart research authority required' using errcode='42501';end if;
 if p_job_id is null or p_worker_id is null
   or p_worker_id !~ '^mizizi-chart:[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 then raise exception 'Invalid scoped chart worker' using errcode='22023';end if;
 select jobs.* into j from platform_private.jobs jobs where jobs.id=p_job_id
  and jobs.command_type='mizizi.case_research_v1' and jobs.job_type='mizizi.case_research_v1'
  and jobs.status='running' and jobs.locked_by=p_worker_id
  and jobs.lease_expires_at>clock_timestamp() for update;
 if not found then raise exception 'Chart research lease is not current' using errcode='55000';end if;
 select k.* into c from mizizi_private.cases k
 join mizizi_private.case_resource_bindings b on b.case_id=k.id and b.workspace_id=k.workspace_id
 where b.resource_id=j.resource_id and b.case_id=j.resource_id and b.resource_kind='mizizi_case'
  and k.case_state='in_progress' and k.current_stage='research'
  and k.claim_family_key='charts2_recording_investigation_v1'
  and k.revision::text=j.input_payload->>'expected_case_revision'
  and k.id::text=j.input_payload->>'case_id' and k.workspace_id::text=j.input_payload->>'workspace_id'
  and j.input_payload->>'operation'='read_only_research'
  and j.input_payload->>'reason'='Investigate receipt-bound chart recording identity.'
  and k.transition_reason='Investigate receipt-bound chart recording identity.'
  and k.transition_actor_key ~ '^user:[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  and exists (select 1 from platform_private.command_receipts cr where cr.id=j.command_receipt_id
    and cr.resource_id=k.id and cr.command_type=j.command_type and cr.status='accepted'
    and cr.principal_key='system:mizizi' and cr.request_payload=j.input_payload
    and ((not(j.input_payload ? 'reopen_event_id') and cr.idempotency_key='mizizi.case_research_v1.'||k.id::text||'.'||k.revision::text)
      or (j.input_payload ? 'reopen_event_id' and mizizi_private.desk_reopening_job_current_v1(j,k,cr))))
 for update of k;
 if not found then raise exception 'Chart research job scope changed' using errcode='55000';end if;
 perform mizizi_private.assert_chart_candidate_research_actor_v1(c.workspace_id,substring(c.transition_actor_key from 6)::uuid);
 perform mizizi_private.assert_chart_candidate_current_v1(c.id,c.workspace_id,null);
 select b.* into strict s from mizizi_private.chart_candidate_subjects_v1 b where b.case_id=c.id and b.workspace_id=c.workspace_id;
 material:=platform_private.charts2_compute_private_freeze_v1(true);
 select jsonb_agg((v-'disposition')||jsonb_build_object(
  'original_bucket',r.original_bucket,'original_object_key',r.original_object_key,
  'original_byte_length',r.original_byte_length,'original_content_type',r.original_content_type)
  order by p.source_key,p.receipt_id,p.rank) into positions
 from mizizi_private.chart_candidate_positions_v1 p
 join platform_private.charts2_capture_receipts_v1 r on r.id=p.receipt_id
  and r.source_key=p.source_key and r.original_sha256=p.original_sha256
 join jsonb_array_elements(material->'investigation_positions') v
  on v->>'receipt_id'=p.receipt_id::text and (v->>'rank')::integer=p.rank
  and v->>'source_key'=p.source_key and v->>'original_sha256'=p.original_sha256
  and v->>'disposition'='research'
 where p.case_id=c.id and p.workspace_id=c.workspace_id
  and r.original_verified_at is not null and r.original_bucket='charts2-evidence-private-v1'
  and r.original_byte_length between 1 and 4000000
  and ((p.source_key in ('apple_ke','mdundo_ke','audiomack_ke') and r.original_content_type='text/html')
    or (p.source_key='shazam_ke' and r.original_content_type='text/csv')
    or (p.source_key='youtube_ke' and r.original_content_type in ('application/json','text/csv')))
  and r.original_object_key=p.source_key||'/'||left(p.original_sha256,2)||'/'||p.original_sha256||
   case r.original_content_type when 'text/html' then '.html' when 'text/csv' then '.csv'
    when 'application/json' then '.json' end;
 if positions is null or jsonb_array_length(positions)<>s.member_count
  or encode(extensions.digest((select jsonb_agg(v - 'original_bucket' - 'original_object_key' -
    'original_byte_length' - 'original_content_type' || jsonb_build_object('disposition','research')
    order by v->>'source_key',v->>'receipt_id',(v->>'rank')::integer) from jsonb_array_elements(positions) v)::text,'sha256'),'hex')
    is distinct from s.observation_sha256
  or j.lease_expires_at<=clock_timestamp()
 then raise exception 'Chart research original context is stale or incomplete' using errcode='PT409';end if;
 return jsonb_build_object('contract','mizizi.charts.research_context.v1',
  'jobId',j.id,'receiptId',j.command_receipt_id,'caseId',c.id,'workspaceId',c.workspace_id,
  'expectedRevision',c.revision,'leaseExpiresAt',j.lease_expires_at,
  'membershipSha256',s.membership_sha256,'observationSha256',s.observation_sha256,
  'positions',positions,'publicSourceSearchApproved',false,'externalModelProcessingAllowed',false);
end $context$;

-- Historical jobs are read only through a new event-bound job's journal;
-- the original dependency must have been committed before the reviewed head.
create function mizizi_private.desk_reopening_origin_job_v1(p_job uuid,p_origin_job uuid,p_receipt uuid,p_case uuid,p_workspace uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $f$
 select coalesce(p_job=p_origin_job or exists(
  select 1 from mizizi_private.desk_reopening_dispatches_v1 d
  join mizizi_private.desk_reopening_events_v1 e on e.event_id=d.event_id
  join mizizi_private.research_passes p on p.case_id=e.case_id and p.workspace_id=e.workspace_id and p.ordinal<=e.predecessor_ordinal
  join mizizi_private.desk_tool_receipts_v1 r on r.id=p_receipt and r.job_id=p.job_id and r.case_id=p.case_id and r.workspace_id=p.workspace_id
  where d.job_id=p_job and e.case_id=p_case and e.workspace_id=p_workspace and p.job_id=p_origin_job
   and p.body_text::jsonb->'deskToolReceipts' @> jsonb_build_array(jsonb_build_object('receiptId',r.id,'callSha256',r.call_sha256,'resultSha256',r.result_sha256))
 ),false)
$f$;

create or replace function mizizi_private.desk_same_case_recall_current_v1(r mizizi_private.desk_tool_receipts_v1,c jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog as $f$
declare origin mizizi_private.desk_tool_receipts_v1;m jsonb;old_lead mizizi_private.desk_reference_leads_v1;new_lead mizizi_private.desk_reference_leads_v1;meta jsonb;
begin
 if r.operation<>'recall_evidence' or (r.source_id is not null and r.source_id is distinct from r.id) or r.parent_receipt_id is null
 or r.result_sha256 is distinct from encode(sha256(convert_to(r.result_text,'UTF8')),'hex') then return false;end if;
 select * into origin from mizizi_private.desk_tool_receipts_v1 where id=r.parent_receipt_id;
 if not found or not mizizi_private.desk_reopening_origin_job_v1(r.job_id,origin.job_id,origin.id,r.case_id,r.workspace_id) or origin.case_id is distinct from r.case_id
 or origin.workspace_id is distinct from r.workspace_id or origin.expected_revision is distinct from r.expected_revision
 or origin.lease_expires_at is not distinct from r.lease_expires_at or origin.recorded_at>=r.recorded_at
 or origin.host is distinct from r.host or origin.policy_revision is distinct from r.policy_revision
 or origin.operational_revision is distinct from r.operational_revision then return false;end if;
 meta:=r.provenance->'sameCaseRecall';
 if r.source_id is not null then
  if r.provenance is distinct from jsonb_build_object('sameCaseRecall',jsonb_build_object(
   'originReceiptId',origin.id,'originResultSha256',origin.result_sha256)) then return false;end if;
  m:=mizizi_private.desk_same_case_recall_result_v1(origin,r.id);
 else
  if coalesce(meta->>'originLeadId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or coalesce(r.result_text::jsonb->'leads'->0->>'id','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then return false;end if;
  select * into old_lead from mizizi_private.desk_reference_leads_v1 where id=(meta->>'originLeadId')::uuid;
  select * into new_lead from mizizi_private.desk_reference_leads_v1 where id=(r.result_text::jsonb->'leads'->0->>'id')::uuid;
  if old_lead.id is null or new_lead.id is null or new_lead.receipt_id<>r.id or new_lead.url<>old_lead.url
   or new_lead.label<>old_lead.label or new_lead.kind<>'reference'
   or r.provenance is distinct from jsonb_build_object('sameCaseRecall',jsonb_build_object(
    'originReceiptId',origin.id,'originResultSha256',origin.result_sha256,'originLeadId',old_lead.id)) then return false;end if;
  m:=mizizi_private.desk_same_case_lead_projection_v1(origin,old_lead,r.id,new_lead.id);
 end if;
 return coalesce(m is not null and m=r.result_text::jsonb,false);
end $f$;

create or replace function mizizi_private.desk_same_case_recall_candidate_v1(c jsonb)
returns mizizi_private.desk_tool_receipts_v1 language plpgsql security definer set search_path=pg_catalog as $f$
declare o mizizi_private.desk_operational_policy_versions_v1;j platform_private.jobs%rowtype;
 r mizizi_private.desk_tool_receipts_v1;item jsonb;
begin
 if c is null then return null;end if;
 o:=mizizi_private.current_desk_operational_policy_v1(c);
 if not coalesce(mizizi_private.desk_operational_policy_live_v1(o,c),false) or not o.adaptive_followups_allowed
 or not('recall_evidence'=any(o.tool_names)) then return null;end if;
 select * into j from platform_private.jobs where id=(c->>'jobId')::uuid;
 if not found or j.status<>'running' or j.locked_at is null then return null;end if;
 if not exists(select 1 from mizizi_private.research_passes p where p.case_id=o.case_id and p.workspace_id=o.workspace_id
  and (p.job_id=j.id or exists(select 1 from mizizi_private.desk_reopening_dispatches_v1 x where x.job_id=j.id))) then return null;end if;
 perform mizizi_private.assert_desk_journal_current_v1(j.id,j.locked_by,o.case_id,null);
 if (select count(*) from mizizi_private.desk_tool_receipts_v1 d where d.case_id=o.case_id)>=200 then return null;end if;
 for r in select d.* from mizizi_private.desk_tool_receipts_v1 d
  where d.case_id=o.case_id and d.workspace_id=o.workspace_id and mizizi_private.desk_reopening_origin_job_v1(j.id,d.job_id,d.id,d.case_id,d.workspace_id)
   and d.expected_revision=o.expected_revision and d.operational_revision=o.revision and d.operation='read_page'
   and d.source_id=d.id and d.lease_expires_at is distinct from j.lease_expires_at
   and not exists(select 1 from mizizi_private.desk_tool_receipts_v1 q where q.case_id=d.case_id
    and q.operation='recall_evidence' and q.parent_receipt_id=d.id)
   and exists(select 1 from mizizi_private.research_passes p where p.case_id=d.case_id and p.workspace_id=d.workspace_id
    and p.job_id=d.job_id
    and p.body_text::jsonb->'sourceReceipts' @> jsonb_build_array(jsonb_build_object('sourceId',d.id,'modelDisclosed',true))
    and p.body_text::jsonb->'deskToolReceipts' @> jsonb_build_array(jsonb_build_object('receiptId',d.id,
     'callSha256',d.call_sha256,'resultSha256',d.result_sha256)))
  order by d.recorded_at,d.id limit 200
 loop
  item:=mizizi_private.desk_shared_native_source_v1(r);
  if item is not null and item->'source'->'externalModelProcessingAllowed'='true'::jsonb
   and coalesce(mizizi_private.desk_custody_receipt_current_v1(r,c),false)
   and mizizi_private.desk_same_case_recall_result_v1(r,'00000000-0000-4000-8000-000000000000'::uuid) is not null
  then return r;end if;
 end loop;
 return null;
end $f$;

create or replace function mizizi_private.desk_same_case_lead_candidate_v1(c jsonb)
returns mizizi_private.desk_reference_leads_v1 language plpgsql security definer set search_path=pg_catalog as $f$
declare o mizizi_private.desk_operational_policy_versions_v1;j platform_private.jobs%rowtype;
 l mizizi_private.desk_reference_leads_v1;r mizizi_private.desk_tool_receipts_v1;
 p mizizi_private.desk_custody_policy_versions_v1;h text;
begin
 if c is null then return null;end if;
 o:=mizizi_private.current_desk_operational_policy_v1(c);
 if not coalesce(mizizi_private.desk_operational_policy_live_v1(o,c),false) or not o.adaptive_followups_allowed
 or not('recall_evidence'=any(o.tool_names)) or not('read_page'=any(o.tool_names)) then return null;end if;
 select * into j from platform_private.jobs where id=(c->>'jobId')::uuid;
 if not found or j.status<>'running' or j.locked_at is null then return null;end if;
 perform mizizi_private.assert_desk_journal_current_v1(j.id,j.locked_by,o.case_id,null);
 if (select count(*) from mizizi_private.desk_tool_receipts_v1 d where d.case_id=o.case_id)>=200 then return null;end if;
 for l in select lead.* from mizizi_private.desk_reference_leads_v1 lead
  join mizizi_private.desk_tool_receipts_v1 d on d.id=lead.receipt_id
  where d.case_id=o.case_id and d.workspace_id=o.workspace_id and mizizi_private.desk_reopening_origin_job_v1(j.id,d.job_id,d.id,d.case_id,d.workspace_id)
   and d.expected_revision=o.expected_revision and d.operational_revision=o.revision
   and d.lease_expires_at is distinct from j.lease_expires_at and d.operation in ('search_web','search_news')
   and lead.kind='reference' and not(d.provenance ? 'sharedNativeSearch') and not(d.result_text::jsonb ? 'unavailable')
   and exists(select 1 from mizizi_private.research_passes journal_pass where journal_pass.case_id=d.case_id and journal_pass.workspace_id=d.workspace_id and journal_pass.job_id=d.job_id
    and journal_pass.body_text::jsonb->'deskToolReceipts' @> jsonb_build_array(jsonb_build_object('receiptId',d.id,'callSha256',d.call_sha256,'resultSha256',d.result_sha256)))
   and not exists(select 1 from mizizi_private.desk_tool_receipts_v1 q where q.case_id=d.case_id and
    (q.operation='recall_evidence' and q.provenance->'sameCaseRecall'->>'originLeadId'=lead.id::text
     or q.operation in ('read_page','browse_page') and (q.provenance->>'requestedUrl'=lead.url or q.provenance->>'finalUrl'=lead.url)))
   and not exists(select 1 from mizizi_private.desk_operational_call_proofs_v1 q where q.case_id=d.case_id
    and q.operation in ('native_acquire','browser_render','browser_request') and q.url_sha256=encode(sha256(convert_to(lead.url,'UTF8')),'hex'))
  order by d.recorded_at,d.id,lead.id limit 200
 loop
  select * into r from mizizi_private.desk_tool_receipts_v1 where id=l.receipt_id;
  h:=mizizi_private.desk_custody_url_host_v1(l.url);
  p:=mizizi_private.current_desk_custody_policy_v1(o.workspace_id,h);
  if h is not null and coalesce(mizizi_private.desk_custody_policy_live_v1(p),false) and p.source_family='public_web'
   and mizizi_private.desk_operational_url_allowed_v1(o,h,l.url,'native_acquire',p.revision)
   and not exists(select 1 from mizizi_private.desk_tool_receipts_v1 d where d.case_id=o.case_id
    and d.result_text::jsonb->'unavailable'->>'host'=h)
   and coalesce(mizizi_private.desk_custody_receipt_current_v1(r,c),false)
   and mizizi_private.desk_same_case_lead_projection_v1(r,l,'00000000-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001') is not null
  then return l;end if;
 end loop;
 return null;
end $f$;

-- No worker can add an unapproved event pointer; the first new pass must
-- consume the exact reviewed paused predecessor and question.
create function mizizi_private.desk_reopening_pending_pass_v1(p_job uuid,p_case uuid,p_body jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog as $f$
declare e mizizi_private.desk_reopening_events_v1;
begin
 select v.* into e from mizizi_private.desk_reopening_dispatches_v1 d join mizizi_private.desk_reopening_events_v1 v on v.event_id=d.event_id
 where d.job_id=p_job and d.case_id=p_case;
 if not found then return not(p_body ? 'reopenEvent');end if;
 if p_body->>'ordinal'=(e.predecessor_ordinal+1)::text then
  return coalesce(p_body->>'predecessorFingerprint'=e.predecessor_fingerprint and p_body->>'question'=e.question
   and p_body->'reopenEvent'=jsonb_build_object('sourceEventRef',e.event_id,'eventSha256',e.event_sha256,
    'predecessorFingerprint',e.predecessor_fingerprint),false);
 end if;
 return not(p_body ? 'reopenEvent') and exists(select 1 from mizizi_private.research_passes p
  where p.case_id=p_case and p.job_id=p_job and p.ordinal=e.predecessor_ordinal+1);
end $f$;

create or replace function mizizi_private.assert_desk_journal_current_v1(
 p_job_id uuid,p_worker_id text,p_case_id uuid,p_pending jsonb
) returns void language plpgsql security definer set search_path=pg_catalog as $journal$
declare c jsonb;b jsonb;ref jsonb;r mizizi_private.desk_tool_receipts_v1;
 s jsonb;a jsonb;seen uuid[];sid uuid;o mizizi_private.desk_operational_policy_versions_v1;deps uuid[];dep_sources uuid[];batch_bound boolean;
begin
 -- Same lock order as the existing custody RPCs: policy lock, then exact
 -- job/case locks. Public chart RPCs take the policy lock before row locks.
 perform pg_advisory_xact_lock(214781521,61431);
 c:=mizizi_private.read_leased_chart_research_context_v1(p_job_id,p_worker_id);
 if c is null or c->>'caseId' is distinct from p_case_id::text then
  raise exception 'Desk journal scope denied' using errcode='42501';end if;
 if p_pending is not null and not mizizi_private.desk_reopening_pending_pass_v1(p_job_id,p_case_id,p_pending) then
  raise exception 'Desk reopening event journal binding denied' using errcode='42501';end if;
 o:=mizizi_private.current_desk_operational_policy_v1(c);
 if o.revision is not null and not mizizi_private.desk_operational_policy_live_v1(o,c) then
  raise exception 'Desk operational policy revoked or expired' using errcode='42501';end if;
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
  batch_bound:=false;
  if b ? 'deskBatchReceipt' then
   batch_bound:=mizizi_private.desk_retained_batch_journal_current_v1(c,b);
   if not batch_bound then raise exception 'Desk batch journal binding denied' using errcode='42501';end if;
  end if;
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
  if o.revision is not null or b ? 'deskToolReceipts' then
   if jsonb_typeof(b->'deskToolReceipts') is distinct from 'array' or jsonb_array_length(b->'deskToolReceipts')>4 then
    raise exception 'Desk journal dependency shape denied' using errcode='42501';end if;
   deps:=array[]::uuid[];dep_sources:=array[]::uuid[];
   for ref in select value from jsonb_array_elements(b->'deskToolReceipts') loop
    if jsonb_typeof(ref) is distinct from 'object' or coalesce(ref->>'receiptId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
     then raise exception 'Desk journal dependency denied' using errcode='42501';end if;
    sid:=(ref->>'receiptId')::uuid;
    if sid=any(deps) then raise exception 'Duplicate desk dependency' using errcode='42501';end if;
    select * into r from mizizi_private.desk_tool_receipts_v1 where id=sid;
    if not found or r.call_sha256 is distinct from ref->>'callSha256' or r.result_sha256 is distinct from ref->>'resultSha256'
     or not mizizi_private.desk_custody_receipt_current_v1(r,c) then
     raise exception 'Desk journal dependency custody denied' using errcode='42501';end if;
    if o.revision is not null and p_pending is not null and b=p_pending and not batch_bound and
     (r.job_id is distinct from p_job_id or r.worker_id is distinct from p_worker_id
      or r.lease_expires_at is distinct from (c->>'leaseExpiresAt')::timestamptz) then
     raise exception 'Desk journal pending dependency lease denied' using errcode='42501';end if;
    if r.provenance->'detail' ? 'localBrowser' and not exists(
     select 1 from mizizi_private.desk_resource_events_v1 e
     where e.reservation_id=(r.provenance->'detail'->'localBrowser'->>'reservationId')::uuid
      and e.state='close_acknowledged' and e.detail->>'sessionId'=r.provenance->'detail'->'localBrowser'->>'sessionId')
    then raise exception 'Desk local browser cleanup unconfirmed' using errcode='42501';end if;
    deps:=array_append(deps,sid);
    if r.source_id is not null then dep_sources:=array_append(dep_sources,r.source_id);end if;
   end loop;
   if not(seen @> dep_sources and dep_sources @> seen) then
    raise exception 'Desk journal dependency source set denied' using errcode='42501';end if;
   if o.revision is not null and p_pending is not null and b=p_pending and exists(
    select 1 from mizizi_private.desk_tool_receipts_v1 q where q.job_id=p_job_id
     and q.lease_expires_at=(c->>'leaseExpiresAt')::timestamptz and not(q.id=any(deps))) then
    raise exception 'Desk journal missing lease dependency' using errcode='42501';end if;
  end if;
 end loop;
 if (c->>'leaseExpiresAt')::timestamptz<=clock_timestamp() then
  raise exception 'Desk journal lease expired' using errcode='55000';end if;
end $journal$;

-- Only an exact service lease can see the reviewed question. It is already
-- independently on the standing policy's allowed question hash list.
create function public.mizizi_read_desk_reopening_event_v1(p_scope jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
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
 return jsonb_build_object('sourceEventRef',e.event_id,'eventSha256',e.event_sha256,'predecessorFingerprint',e.predecessor_fingerprint,'question',e.question);
end $f$;

revoke all on function mizizi_private.desk_reopening_event_current_v1(mizizi_private.desk_reopening_events_v1),
 mizizi_private.desk_reopening_job_current_v1(platform_private.jobs,mizizi_private.cases,platform_private.command_receipts),
 mizizi_private.desk_reopening_origin_job_v1(uuid,uuid,uuid,uuid,uuid),
 mizizi_private.desk_reopening_pending_pass_v1(uuid,uuid,jsonb),
 mizizi_private.admit_desk_reopening_job_v1(uuid,text),
 public.admin_mizizi_authorize_desk_reopening_v1(uuid,integer,uuid,text,uuid,text,text,timestamptz,text,timestamptz,text),
 public.mizizi_read_desk_reopening_event_v1(jsonb)
 from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.admin_mizizi_authorize_desk_reopening_v1(uuid,integer,uuid,text,uuid,text,text,timestamptz,text,timestamptz,text) to authenticated;
grant execute on function mizizi_private.admit_desk_reopening_job_v1(uuid,text) to mizizi_executor;
grant execute on function public.mizizi_read_desk_reopening_event_v1(jsonb) to service_role;
commit;
