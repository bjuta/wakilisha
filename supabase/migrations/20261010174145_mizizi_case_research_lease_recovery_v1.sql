-- MIZIZI Headquarters Slice 1. Canonical filename minted by owner's Supabase CLI.
-- Narrow shared-job claim and expired-lease recovery. No new queue or Registry writer.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '90s';

do $preflight$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations where version='20261010161101')
     or to_regprocedure('mizizi_private.admit_case_research_job_v1(uuid,uuid,integer,text,text,text,text)') is null
     or to_regprocedure('platform_private.claim_jobs(text,integer,integer)') is null
     or to_regprocedure('platform_private.complete_job(uuid,text,jsonb)') is null
     or to_regprocedure('platform_private.fail_job(uuid,text,text,boolean,integer)') is null
     or to_regclass('mizizi_private.case_resource_bindings') is null then
    raise exception 'MIZIZI recovery requires accepted shared-jobs authority';
  end if;
  if to_regprocedure('mizizi_private.claim_case_research_jobs_v1(text,integer,integer)') is not null
     or to_regprocedure('mizizi_private.recover_expired_case_research_jobs_v1(integer,integer)') is not null then
    raise exception 'MIZIZI research recovery function collision';
  end if;
end;
$preflight$;

create function mizizi_private.claim_case_research_jobs_v1(
  p_worker_id text, p_limit integer default 1, p_lease_seconds integer default 300
)
returns table(
  job_id uuid, command_receipt_id uuid, resource_id uuid, command_type text,
  job_type text, attempt_count integer, max_attempts integer,
  input_payload jsonb, lease_expires_at timestamptz
)
language plpgsql security definer set search_path to 'pg_catalog'
as $claim$
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Service-role access is required' using errcode='42501';
  end if;
  if p_worker_id is null or p_worker_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$'
     or p_limit is null or p_limit not between 1 and 10
     or p_lease_seconds is null or p_lease_seconds not between 30 and 3600 then
    raise exception 'Invalid MIZIZI job claim arguments' using errcode='22023';
  end if;
  return query
  with candidates as (
    select j.id
      from platform_private.jobs j
      join mizizi_private.case_resource_bindings b
        on b.resource_id=j.resource_id and b.case_id=j.resource_id
      join mizizi_private.cases c
        on c.id=b.case_id and c.workspace_id=b.workspace_id
      join platform_private.command_receipts cr
        on cr.id=j.command_receipt_id and cr.resource_id=j.resource_id
          and cr.command_type=j.command_type
     where j.command_type='mizizi.case_research_v1'
       and j.job_type='mizizi.case_research_v1'
       and j.status in ('queued','retry_wait')
       and j.available_at<=now()
       and j.attempt_count<j.max_attempts
       and j.locked_by is null
       and cr.status='accepted'
       and c.case_state in ('open','in_progress')
       and c.current_stage='research'
       and c.revision=(j.input_payload->>'expected_case_revision')::integer
       and (j.input_payload->>'case_id')::uuid=c.id
       and (j.input_payload->>'workspace_id')::uuid=c.workspace_id
       and j.input_payload->>'operation'='read_only_research'
     order by j.priority,j.available_at,j.created_at
     for update of j skip locked
     limit p_limit
  ), claimed as (
    update platform_private.jobs j
       set status='running', attempt_count=j.attempt_count+1,
           locked_by=p_worker_id, locked_at=now(),
           lease_expires_at=now()+make_interval(secs=>p_lease_seconds),
           started_at=coalesce(j.started_at,now())
      from candidates
     where j.id=candidates.id
     returning j.*
  )
  select x.id,x.command_receipt_id,x.resource_id,x.command_type,
         x.job_type,x.attempt_count,x.max_attempts,x.input_payload,x.lease_expires_at
    from claimed x;
end;
$claim$;

create function mizizi_private.recover_expired_case_research_jobs_v1(
  p_limit integer default 10, p_retry_delay_seconds integer default 30
)
returns integer
language plpgsql security definer set search_path to 'pg_catalog'
as $recover$
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
$recover$;

revoke all on function mizizi_private.claim_case_research_jobs_v1(text,integer,integer)
  from public,anon,authenticated,service_role,mizizi_executor;
revoke all on function mizizi_private.recover_expired_case_research_jobs_v1(integer,integer)
  from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function mizizi_private.claim_case_research_jobs_v1(text,integer,integer) to service_role;
grant execute on function mizizi_private.recover_expired_case_research_jobs_v1(integer,integer) to service_role;
commit;
