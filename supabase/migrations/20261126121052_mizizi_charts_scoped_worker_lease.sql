-- Issue #1441; CLI 2.107.0 mint run 45817220538.
-- Scope the accepted shared research ledger; no new queue or source permission.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
do $guard$
begin
 if current_user<>'postgres'
  or to_regprocedure('mizizi_private.assert_chart_candidate_current_v1(uuid,uuid,text)') is null
  or to_regprocedure('mizizi_private.assert_chart_candidate_research_actor_v1(uuid,uuid)') is null
  or to_regprocedure('public.mizizi_read_research_passes_v1(uuid,text)') is null
  or to_regprocedure('public.mizizi_append_research_pass_v1(uuid,text,text,text,text)') is null
  or to_regprocedure('public.mizizi_claim_exact_chart_research_job_v1(uuid,uuid,uuid,integer,text,integer)') is not null
  or to_regprocedure('public.mizizi_recover_expired_chart_research_job_v1(uuid,uuid,uuid,integer,integer)') is not null
  or to_regprocedure('public.mizizi_read_leased_chart_research_context_v1(uuid,text)') is not null
  or to_regprocedure('mizizi_private.read_leased_chart_research_context_v1(uuid,text)') is not null
  or to_regprocedure('mizizi_private.recover_scoped_case_research_jobs_v1(integer,integer,uuid,uuid,uuid,integer)') is not null
  or encode(sha256(convert_to(pg_get_functiondef(to_regprocedure('mizizi_private.recover_expired_case_research_jobs_v1(integer,integer)')),'UTF8')),'hex') is distinct from '37c9d6e6ee4f8a86fd10a3670c8efa0d55dcb700ba699c80b3cc3223f3167285'
  or encode(sha256(convert_to(pg_get_functiondef(to_regprocedure('public.mizizi_complete_case_research_job_v1(uuid,text,jsonb)')),'UTF8')),'hex') is distinct from 'e74cbef693511873ecf66ba56c3b5151e87d645da18a7d9890d0a0a9ea2f44fc'
 then raise exception 'STOP_CHART_SCOPED_WORKER_PREIMAGE';end if;
end $guard$;

-- Read only the case's immutable coordinates and bounded original metadata,
-- under its exact live lease, current steward authority and scoring binding.
-- This is internal custody, not permission for third-party disclosure.
create function mizizi_private.read_leased_chart_research_context_v1(p_job_id uuid,p_worker_id text)
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
    and cr.idempotency_key='mizizi.case_research_v1.'||k.id::text||'.'||k.revision::text)
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
revoke all on function mizizi_private.read_leased_chart_research_context_v1(uuid,text)
 from public,anon,authenticated,service_role,mizizi_executor;

create function public.mizizi_read_leased_chart_research_context_v1(p_job_id uuid,p_worker_id text)
returns jsonb language sql security definer set search_path=pg_catalog as $read_context$
 select mizizi_private.read_leased_chart_research_context_v1(p_job_id,p_worker_id);
$read_context$;

create function public.mizizi_claim_exact_chart_research_job_v1(
 p_job_id uuid,p_case_id uuid,p_workspace_id uuid,p_expected_revision integer,
 p_worker_id text,p_lease_seconds integer default 300)
returns table(job_id uuid,command_receipt_id uuid,resource_id uuid,command_type text,
 job_type text,attempt_count integer,max_attempts integer,input_payload jsonb,lease_expires_at timestamptz)
language plpgsql security definer set search_path=pg_catalog as $claim$
declare claimed platform_private.jobs%rowtype;
begin
 if coalesce(auth.role(),'')<>'service_role' then
  raise exception 'Service-role chart research authority required' using errcode='42501';end if;
 if p_job_id is null or p_case_id is null or p_workspace_id is null
  or p_expected_revision is null or p_expected_revision<1 or p_worker_id is null
  or p_worker_id !~ '^mizizi-chart:[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  or p_lease_seconds is null or p_lease_seconds not between 30 and 3600
 then raise exception 'Invalid exact chart claim' using errcode='22023';end if;
 with candidate as (
  select j.id from platform_private.jobs j
  join mizizi_private.chart_candidate_subjects_v1 s on s.case_id=j.resource_id
  join mizizi_private.cases c on c.id=s.case_id and c.workspace_id=s.workspace_id
  where j.id=p_job_id and j.resource_id=p_case_id and s.workspace_id=p_workspace_id
   and c.revision=p_expected_revision and c.case_state='in_progress' and c.current_stage='research'
   and j.command_type='mizizi.case_research_v1' and j.job_type='mizizi.case_research_v1'
   and j.status in ('queued','retry_wait') and j.available_at<=now()
   and j.attempt_count<j.max_attempts and j.locked_by is null
   and j.input_payload->>'case_id'=p_case_id::text
   and j.input_payload->>'workspace_id'=p_workspace_id::text
   and j.input_payload->>'expected_case_revision'=p_expected_revision::text
   and j.input_payload->>'operation'='read_only_research'
   and j.input_payload->>'reason'='Investigate receipt-bound chart recording identity.'
  for update of j skip locked
 )
 update platform_private.jobs j set status='running',attempt_count=j.attempt_count+1,
  locked_by=p_worker_id,locked_at=now(),lease_expires_at=now()+make_interval(secs=>p_lease_seconds),
  started_at=coalesce(j.started_at,now())
 from candidate where j.id=candidate.id returning j.* into claimed;
 if not found then return;end if;
 -- A context denial rolls back the lease and its attempt increment atomically.
 perform mizizi_private.read_leased_chart_research_context_v1(claimed.id,p_worker_id);
 return query select claimed.id,claimed.command_receipt_id,claimed.resource_id,
  claimed.command_type,claimed.job_type,claimed.attempt_count,claimed.max_attempts,
  claimed.input_payload,claimed.lease_expires_at;
end $claim$;

-- One recovery implementation, two constrained callers. Keep the historical
-- retry/dead-letter/receipt/outbox body unchanged except the candidate filter.
CREATE FUNCTION mizizi_private.recover_scoped_case_research_jobs_v1(p_limit integer,p_retry_delay_seconds integer,p_job_id uuid,p_case_id uuid,p_workspace_id uuid,p_expected_revision integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_job platform_private.jobs%rowtype;
  v_count integer := 0;
  v_error text;
  v_event_type text;
  v_dead boolean;
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Service-role access is required' using errcode='42501';
  end if;
  if p_limit is null or p_limit not between 1 and 100
     or p_retry_delay_seconds is null or p_retry_delay_seconds not between 1 and 3600 then
    raise exception 'Invalid MIZIZI lease recovery arguments' using errcode='22023';
  end if;
  for v_job in
    select j.* from platform_private.jobs j
     where j.command_type='mizizi.case_research_v1'
       and j.job_type='mizizi.case_research_v1'
       and j.status='running'
       and j.lease_expires_at is not null
       and j.lease_expires_at<=now()
       and ((p_job_id is null and not exists (
         select 1 from mizizi_private.cases c where c.id=j.resource_id and
           (c.claim_family_key='charts2_recording_investigation_v1' or exists (
             select 1 from mizizi_private.chart_candidate_subjects_v1 s where s.case_id=c.id))))
         or (p_job_id is not null and j.id=p_job_id and j.resource_id=p_case_id
           and j.input_payload->>'case_id'=p_case_id::text
           and j.input_payload->>'workspace_id'=p_workspace_id::text
           and j.input_payload->>'expected_case_revision'=p_expected_revision::text
           and j.input_payload->>'reason'='Investigate receipt-bound chart recording identity.'
           and exists (select 1 from mizizi_private.chart_candidate_subjects_v1 s
             where s.case_id=p_case_id and s.workspace_id=p_workspace_id)))
     order by j.lease_expires_at,j.created_at
     for update skip locked
     limit p_limit
  loop
    v_dead := v_job.attempt_count >= v_job.max_attempts;
    v_error := case when v_dead then
      'MIZIZI research lease expired after final allowed attempt.'
      else 'MIZIZI research lease expired before completion.' end;
    select case when v_dead then ct.failure_event_type else ct.retry_event_type end
      into strict v_event_type
      from platform_private.command_types ct
     where ct.command_type=v_job.command_type and ct.job_type=v_job.job_type and ct.enabled;
    if v_dead then
      update platform_private.jobs
         set status='dead_letter',locked_by=null,locked_at=null,
             lease_expires_at=null,finished_at=now(),last_error=v_error
       where id=v_job.id;
      update platform_private.command_receipts
         set status='failed',error_code='job_failed',error_message=v_error,
             completed_at=now()
       where id=v_job.command_receipt_id and status='accepted';
      if not found then
        raise exception 'MIZIZI terminal receipt mismatch' using errcode='23514';
      end if;
      insert into platform_private.outbox_events(
        event_key,command_receipt_id,job_id,command_type,aggregate_id,event_type,payload
      ) values (
        'command:'||v_job.command_receipt_id::text||':failed',
        v_job.command_receipt_id,v_job.id,v_job.command_type,v_job.resource_id,v_event_type,
        jsonb_build_object('command_receipt_id',v_job.command_receipt_id,'job_id',v_job.id,
          'resource_id',v_job.resource_id,'error',v_error,'failed_at',now())
      ) on conflict(event_key) do nothing;
    else
      update platform_private.jobs
         set status='retry_wait',available_at=now()+make_interval(secs=>p_retry_delay_seconds),
             locked_by=null,locked_at=null,lease_expires_at=null,last_error=v_error
       where id=v_job.id;
      insert into platform_private.outbox_events(
        event_key,command_receipt_id,job_id,command_type,aggregate_id,event_type,payload
      ) values (
        'job:'||v_job.id::text||':retry:'||v_job.attempt_count::text,
        v_job.command_receipt_id,v_job.id,v_job.command_type,v_job.resource_id,v_event_type,
        jsonb_build_object('command_receipt_id',v_job.command_receipt_id,'job_id',v_job.id,
          'resource_id',v_job.resource_id,'attempt_count',v_job.attempt_count,
          'error',v_error,'available_at',now()+make_interval(secs=>p_retry_delay_seconds))
      ) on conflict(event_key) do nothing;
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;
revoke all on function mizizi_private.recover_scoped_case_research_jobs_v1(integer,integer,uuid,uuid,uuid,integer)
 from public,anon,authenticated,service_role,mizizi_executor;

create or replace function mizizi_private.recover_expired_case_research_jobs_v1(
 p_limit integer default 10,p_retry_delay_seconds integer default 30)
returns integer language sql security definer set search_path=pg_catalog as $legacy_recover$
 select mizizi_private.recover_scoped_case_research_jobs_v1(p_limit,p_retry_delay_seconds,null,null,null,null);
$legacy_recover$;

create function public.mizizi_recover_expired_chart_research_job_v1(
 p_job_id uuid,p_case_id uuid,p_workspace_id uuid,p_expected_revision integer,p_retry_delay_seconds integer default 60)
returns integer language plpgsql security definer set search_path=pg_catalog as $exact_recover$
begin
 if coalesce(auth.role(),'')<>'service_role' then
  raise exception 'Service-role chart research authority required' using errcode='42501';end if;
 if p_job_id is null or p_case_id is null or p_workspace_id is null
  or p_expected_revision is null or p_expected_revision<1
  or p_retry_delay_seconds is null or p_retry_delay_seconds not between 1 and 3600
 then raise exception 'Invalid exact chart recovery' using errcode='22023';end if;
 return mizizi_private.recover_scoped_case_research_jobs_v1(
  1,p_retry_delay_seconds,p_job_id,p_case_id,p_workspace_id,p_expected_revision);
end $exact_recover$;

-- Keep existing pass and completion contracts; charts additionally revalidate
-- receipt/actor authority at each persistence boundary inside the transaction.
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
   perform mizizi_private.read_leased_chart_research_context_v1(p_job_id,p_worker_id);
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
   perform mizizi_private.read_leased_chart_research_context_v1(p_job_id,p_worker_id);
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
   perform mizizi_private.read_leased_chart_research_context_v1(p_job_id,p_worker_id);
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
  'public.mizizi_read_leased_chart_research_context_v1(uuid,text)',
  'public.mizizi_claim_exact_chart_research_job_v1(uuid,uuid,uuid,integer,text,integer)',
  'public.mizizi_recover_expired_chart_research_job_v1(uuid,uuid,uuid,integer,integer)'
 ] loop
  execute 'revoke all on function '||signature||' from public,anon,authenticated,service_role,mizizi_executor';
  execute 'grant execute on function '||signature||' to service_role';
  if has_function_privilege('anon',signature,'EXECUTE')
   or has_function_privilege('authenticated',signature,'EXECUTE')
   or has_function_privilege('mizizi_executor',signature,'EXECUTE')
   or not has_function_privilege('service_role',signature,'EXECUTE')
  then raise exception 'STOP_CHART_SCOPED_WORKER_ACL';end if;
 end loop;
 if has_schema_privilege('service_role','mizizi_private','USAGE')
  or has_function_privilege('service_role','mizizi_private.read_leased_chart_research_context_v1(uuid,text)','EXECUTE')
  or has_function_privilege('service_role','mizizi_private.recover_scoped_case_research_jobs_v1(integer,integer,uuid,uuid,uuid,integer)','EXECUTE')
 then raise exception 'STOP_CHART_SCOPED_WORKER_PRIVATE_ACL';end if;
end $acl$;
commit;
