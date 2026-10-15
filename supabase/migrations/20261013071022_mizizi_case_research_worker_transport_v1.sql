-- WAKILISHA MIZIZI Headquarters Slice 1.
-- UNAPPLIED FORWARD MIGRATION PAYLOAD. The filename MUST be minted with the
-- repository-pinned Supabase CLI. This file must never be applied to Production
-- as a stand-alone SQL statement. Only after local replay and Preview acceptance.
--
-- The existing private service-role claim and recovery functions are the sole
-- job authority. The service_role is intentionally NOT granted schema USAGE on
-- mizizi_private; narrow service-only public RPC façades delegate to them.
-- No queue, table, RLS policy, Registry source record, or execution grant is created.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '90s';

do $wk_worker_preflight$
begin
  -- Supabase CLI passwordless db push authenticates as cli_login_postgres
  -- then switches effective authority to postgres. The DDL grantor/owner must
  -- remain postgres; never accept the temporary login without that role.
  if current_database() <> 'postgres'
     or current_user <> 'postgres'
     or (
       session_user <> 'postgres'
       and (
         session_user <> 'cli_login_postgres'
         or not pg_has_role(session_user, 'postgres', 'SET')
       )
     )
  then
    raise exception 'MIZIZI worker transport requires the accepted postgres migration session';
  end if;
  if (select count(*) from supabase_migrations.schema_migrations) <> 224
     or (select max(version) from supabase_migrations.schema_migrations) <> '20261011095852'
  then
    raise exception 'MIZIZI worker transport requires exact 224-migration Preview substrate';
  end if;
  if to_regprocedure('mizizi_private.claim_case_research_jobs_v1(text,integer,integer)') is null
     or to_regprocedure('mizizi_private.recover_expired_case_research_jobs_v1(integer,integer)') is null
     or to_regclass('mizizi_private.case_resource_bindings') is null
     or to_regclass('platform_private.jobs') is null
     or to_regprocedure('platform_private.complete_job(uuid,text,jsonb)') is null
     or to_regprocedure('platform_private.fail_job(uuid,text,text,boolean,integer)') is null
  then
    raise exception 'MIZIZI worker transport substrate missing';
  end if;
  if to_regprocedure('public.mizizi_claim_case_research_jobs_v1(text,integer,integer)') is not null
     or to_regprocedure('public.mizizi_recover_expired_case_research_jobs_v1(integer,integer)') is not null
     or to_regprocedure('public.mizizi_complete_case_research_job_v1(uuid,text,jsonb)') is not null
     or to_regprocedure('public.mizizi_fail_case_research_job_v1(uuid,text,text,boolean,integer)') is not null
  then
    raise exception 'MIZIZI worker transport collision: do not replace existing entrypoints';
  end if;
  if has_schema_privilege('service_role','mizizi_private','USAGE')
     or not has_schema_privilege('service_role','public','USAGE')
     or has_schema_privilege('authenticated','mizizi_private','USAGE')
     or has_schema_privilege('anon','mizizi_private','USAGE')
  then
    raise exception 'MIZIZI worker private-schema authority drift';
  end if;
  if not has_function_privilege('service_role',
       'mizizi_private.claim_case_research_jobs_v1(text,integer,integer)','EXECUTE')
     or not has_function_privilege('service_role',
       'mizizi_private.recover_expired_case_research_jobs_v1(integer,integer)','EXECUTE')
  then
    raise exception 'MIZIZI worker function admission authority drift';
  end if;
  if has_function_privilege('authenticated',
       'mizizi_private.claim_case_research_jobs_v1(text,integer,integer)','EXECUTE')
     or has_function_privilege('anon',
       'mizizi_private.recover_expired_case_research_jobs_v1(integer,integer)','EXECUTE')
  then
    raise exception 'MIZIZI private worker function unexpectedly available to browser roles';
  end if;
end;
$wk_worker_preflight$;

-- Public-schema RPC does NOT mean public execution. The migration atomically
-- revokes PostgreSQL's default PUBLIC EXECUTE before COMMIT.
create function public.mizizi_claim_case_research_jobs_v1(
  p_worker_id text,
  p_limit integer default 1,
  p_lease_seconds integer default 300
)
returns table (
  job_id uuid,
  command_receipt_id uuid,
  resource_id uuid,
  command_type text,
  job_type text,
  attempt_count integer,
  max_attempts integer,
  input_payload jsonb,
  lease_expires_at timestamptz
)
language plpgsql security definer
set search_path to 'pg_catalog'
as $wk_claim$
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Service-role access is required' using errcode='42501';
  end if;
  return query
    select worker.job_id, worker.command_receipt_id, worker.resource_id,
           worker.command_type, worker.job_type, worker.attempt_count,
           worker.max_attempts, worker.input_payload, worker.lease_expires_at
    from mizizi_private.claim_case_research_jobs_v1(
      p_worker_id, p_limit, p_lease_seconds
    ) as worker;
end;
$wk_claim$;

revoke all on function public.mizizi_claim_case_research_jobs_v1(text,integer,integer)
  from public, anon, authenticated, mizizi_executor;
grant execute on function public.mizizi_claim_case_research_jobs_v1(text,integer,integer)
  to service_role;

create function public.mizizi_recover_expired_case_research_jobs_v1(
  p_limit integer default 10,
  p_retry_delay_seconds integer default 30
)
returns integer
language plpgsql security definer
set search_path to 'pg_catalog'
as $wk_recover$
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Service-role access is required' using errcode='42501';
  end if;
  return mizizi_private.recover_expired_case_research_jobs_v1(
    p_limit, p_retry_delay_seconds
  );
end;
$wk_recover$;

revoke all on function public.mizizi_recover_expired_case_research_jobs_v1(integer,integer)
  from public, anon, authenticated, mizizi_executor;
grant execute on function public.mizizi_recover_expired_case_research_jobs_v1(integer,integer)
  to service_role;

-- Completion and failure MUST also be scoped to MIZIZI research. The generic
-- platform_private.complete_job/fail_job accept all command types and must never
-- be exposed as generic service-worker RPCs.
create function public.mizizi_complete_case_research_job_v1(
  p_job_id uuid,
  p_worker_id text,
  p_result jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql security definer
set search_path to 'pg_catalog'
as $wk_complete$
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
$wk_complete$;
revoke all on function public.mizizi_complete_case_research_job_v1(uuid,text,jsonb)
  from public, anon, authenticated, mizizi_executor;
grant execute on function public.mizizi_complete_case_research_job_v1(uuid,text,jsonb)
  to service_role;

create function public.mizizi_fail_case_research_job_v1(
  p_job_id uuid,
  p_worker_id text,
  p_error text,
  p_retryable boolean default true,
  p_retry_delay_seconds integer default 60
)
returns jsonb
language plpgsql security definer
set search_path to 'pg_catalog'
as $wk_fail$
declare
  v_case_id uuid;
  v_job_status text;
  v_receipt_status text;
  v_event_id uuid;
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Service-role access is required' using errcode='42501';
  end if;
  if p_job_id is null or p_worker_id is null or
     p_worker_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$' or
     p_error is null or nullif(btrim(p_error),'') is null or
     p_retryable is null or p_retry_delay_seconds is null or
     p_retry_delay_seconds not between 1 and 3600
  then
    raise exception 'Invalid MIZIZI research failure request' using errcode='22023';
  end if;

  select c.id into v_case_id
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
   for update of j,c;
  if not found then
    raise exception 'MIZIZI research failure cannot touch this job'
      using errcode='55000';
  end if;
  select job_status,command_receipt_status,outbox_event_id
    into strict v_job_status,v_receipt_status,v_event_id
    from platform_private.fail_job(
      p_job_id,p_worker_id,p_error,p_retryable,p_retry_delay_seconds
    );
  return jsonb_build_object(
    'job_id',p_job_id,
    'case_id',v_case_id,
    'job_status',v_job_status,
    'command_receipt_status',v_receipt_status,
    'outbox_event_id',v_event_id
  );
end;
$wk_fail$;
revoke all on function public.mizizi_fail_case_research_job_v1(uuid,text,text,boolean,integer)
  from public, anon, authenticated, mizizi_executor;
grant execute on function public.mizizi_fail_case_research_job_v1(uuid,text,text,boolean,integer)
  to service_role;

-- Defense in depth: public API exposure is not allowed to widen private ACLs.
do $wk_worker_postcondition$
begin
  if has_schema_privilege('service_role','mizizi_private','USAGE')
     or has_function_privilege('anon',
         'public.mizizi_claim_case_research_jobs_v1(text,integer,integer)','EXECUTE')
     or has_function_privilege('authenticated',
         'public.mizizi_claim_case_research_jobs_v1(text,integer,integer)','EXECUTE')
     or has_function_privilege('anon',
         'public.mizizi_recover_expired_case_research_jobs_v1(integer,integer)','EXECUTE')
     or has_function_privilege('authenticated',
         'public.mizizi_recover_expired_case_research_jobs_v1(integer,integer)','EXECUTE')
     or has_function_privilege('anon',
         'public.mizizi_complete_case_research_job_v1(uuid,text,jsonb)','EXECUTE')
     or has_function_privilege('authenticated',
         'public.mizizi_complete_case_research_job_v1(uuid,text,jsonb)','EXECUTE')
     or has_function_privilege('anon',
         'public.mizizi_fail_case_research_job_v1(uuid,text,text,boolean,integer)','EXECUTE')
     or has_function_privilege('authenticated',
         'public.mizizi_fail_case_research_job_v1(uuid,text,text,boolean,integer)','EXECUTE')
     or not has_function_privilege('service_role',
         'public.mizizi_claim_case_research_jobs_v1(text,integer,integer)','EXECUTE')
     or not has_function_privilege('service_role',
         'public.mizizi_recover_expired_case_research_jobs_v1(integer,integer)','EXECUTE')
     or not has_function_privilege('service_role',
         'public.mizizi_complete_case_research_job_v1(uuid,text,jsonb)','EXECUTE')
     or not has_function_privilege('service_role',
         'public.mizizi_fail_case_research_job_v1(uuid,text,text,boolean,integer)','EXECUTE')
  then
    raise exception 'MIZIZI worker transport postcondition failed';
  end if;
end;
$wk_worker_postcondition$;

commit;
