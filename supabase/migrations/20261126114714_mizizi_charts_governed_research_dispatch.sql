-- Issue #1441; pinned CLI 2.107.0 filename mint run 45813674431.
-- Receipt-bound steward transition and JIT-only shared research job admission.
-- Existing legacy research claim excludes chart jobs until a scoped runner
-- is separately accepted. No source/model permission, canonical write, or publication.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';

do $preflight$
declare v_def text;
begin
 if current_user<>'postgres'
   or to_regclass('mizizi_private.chart_candidate_subjects_v1') is null
   or to_regclass('mizizi_private.research_passes') is null
   or to_regprocedure('public.admin_mizizi_begin_chart_case_research_v1(uuid,integer,text,text)') is not null
   or to_regprocedure('mizizi_private.assert_chart_candidate_current_v1(uuid,uuid,text)') is not null
   or to_regprocedure('mizizi_private.assert_chart_candidate_research_actor_v1(uuid,uuid)') is not null
 then raise exception 'STOP_CHART_RESEARCH_DISPATCH_SUBSTRATE';end if;
 select pg_get_functiondef(to_regprocedure('mizizi_private.admit_case_research_job_v1(uuid,uuid,integer,text,text,text,text)')) into v_def;
 if v_def is null or position('status,input_payload,max_attempts' in v_def)=0
    or position('''queued'',v_request,25' in v_def)=0
    or encode(sha256(convert_to(replace(replace(v_def,'status,input_payload,max_attempts','status,input_payload'),'''queued'',v_request,25','''queued'',v_request'),'UTF8')),'hex')
       is distinct from '68db13d02ff4b8cb964bd17bb197cd19345287cee20b327aaaba6a9171532dfb'
    or encode(sha256(convert_to(pg_get_functiondef(to_regprocedure('mizizi_private.claim_case_research_jobs_v1(text,integer,integer)')),'UTF8')),'hex')
       is distinct from '7b364c66dc560ff66629f40fbb844e0a8d2f433b0e7a54d61fd0bfe3308009b3'
    or encode(sha256(convert_to(pg_get_functiondef(to_regprocedure('platform_private.claim_jobs(text,integer,integer)')),'UTF8')),'hex')
       is distinct from '8300110f46775f46c60ef4f7e3b612fc4ddc98ffe11fa9a5c9de2763ea82750f'
 then raise exception 'STOP_CHART_RESEARCH_DISPATCH_BROKER_PREIMAGE';end if;
end $preflight$;

-- The JIT session does not impersonate auth.uid(). Re-evaluate the actor's
-- current membership and the same role/capability authority used by
-- current_user_has_capability, without setting request.jwt claims.
create function mizizi_private.assert_chart_candidate_research_actor_v1(p_workspace_id uuid,p_actor uuid)
returns void language plpgsql stable set search_path=pg_catalog as $actor$
begin
 if p_actor is null or not exists (
   select 1 from mizizi_private.workspace_memberships m
   join mizizi_private.workspaces w on w.id=m.workspace_id
   where w.id=p_workspace_id and w.workspace_key='wakilisha-internal'
     and w.workspace_kind='internal' and w.status='active'
     and m.user_id=p_actor and m.revoked_at is null
     and m.valid_from<=clock_timestamp()
     and (m.valid_until is null or m.valid_until>clock_timestamp())
     and m.member_role in ('steward','owner')
 ) or (select count(distinct rc.capability_key) from public.user_role_assignments ura
   join public.role_capabilities rc on rc.role_key=ura.role_key
   where ura.user_id=p_actor and ura.status='active'
     and (ura.expires_at is null or ura.expires_at>now())
     and rc.capability_key in ('manage_registry','manage_charts'))<>2
 then raise exception 'Current chart research steward authority required' using errcode='42501';end if;
end $actor$;
revoke all on function mizizi_private.assert_chart_candidate_research_actor_v1(uuid,uuid)
 from public,anon,authenticated,service_role,mizizi_executor;

-- Verify exact current unresolved observation membership from the existing
-- scoring projection. A different case resolving is not a change to this
-- case's evidence. Changed/superseded/resolved/conflicted members fail closed.
create function mizizi_private.assert_chart_candidate_current_v1(
 p_case_id uuid,p_workspace_id uuid,p_expected_input_sha256 text
)
returns void language plpgsql stable set search_path=pg_catalog as $current$
declare
 binding mizizi_private.chart_candidate_subjects_v1%rowtype;
 material jsonb;
 coords jsonb;
 observations jsonb;
 n integer;
begin
 select s.* into binding from mizizi_private.chart_candidate_subjects_v1 s
 join mizizi_private.cases c on c.id=s.case_id and c.workspace_id=s.workspace_id
 where s.case_id=p_case_id and s.workspace_id=p_workspace_id
   and s.initial_disposition='research'
   and c.subject_type='recording' and c.subject_id=s.case_id
   and c.claim_family_key='charts2_recording_investigation_v1'
   and c.case_key='mizizi:chart-candidate:v1:'||s.membership_sha256
   and c.last_observation_fingerprint=s.observation_sha256
   and c.mutation_state='not_planned';
 if not found then raise exception 'Chart hypothesis is not research eligible' using errcode='55000';end if;
 material:=platform_private.charts2_compute_private_freeze_v1(true);
 if p_expected_input_sha256 is not null and
    material->>'input_sha256' is distinct from p_expected_input_sha256
 then raise exception 'Stale chart research snapshot' using errcode='PT409';end if;
 select count(*),jsonb_agg(v - 'title' - 'artist' - 'provider_track_id' - 'disposition'
       order by v->>'source_key',v->>'receipt_id',(v->>'rank')::integer),
     jsonb_agg(v order by v->>'source_key',v->>'receipt_id',(v->>'rank')::integer)
 into n,coords,observations
 from mizizi_private.chart_candidate_positions_v1 p
 join jsonb_array_elements(material->'investigation_positions') v
   on v->>'receipt_id'=p.receipt_id::text and (v->>'rank')::integer=p.rank
   and v->>'source_key'=p.source_key and v->>'original_sha256'=p.original_sha256
   and v->>'disposition'='research'
 where p.case_id=binding.case_id and p.workspace_id=binding.workspace_id;
 if n<>binding.member_count or coords is null or observations is null
   or (select count(*) from mizizi_private.chart_candidate_positions_v1 p where p.case_id=binding.case_id)<>binding.member_count
   or encode(extensions.digest(coords::text,'sha256'),'hex') is distinct from binding.membership_sha256
   or encode(extensions.digest(observations::text,'sha256'),'hex') is distinct from binding.observation_sha256
 then raise exception 'Chart research evidence changed; reviewed reconciliation required' using errcode='PT409';end if;
end $current$;
revoke all on function mizizi_private.assert_chart_candidate_current_v1(uuid,uuid,text)
 from public,anon,authenticated,service_role,mizizi_executor;

-- Human transition only. No job, execution grant, source permission or write
-- authority. The previously accepted generic Registry review route is intact.
create function public.admin_mizizi_begin_chart_case_research_v1(
 p_case_id uuid,p_expected_revision integer,p_expected_input_sha256 text,p_acknowledgement text
)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $transition$
declare actor uuid; ws uuid; c mizizi_private.cases%rowtype; new_rev integer;
begin
 actor:=mizizi_private.assert_headquarters_operator_v1('steward');
 if not coalesce(public.current_user_has_capability('manage_charts'),false)
 then raise exception 'Charts research steward required' using errcode='42501';end if;
 if p_case_id is null or p_expected_revision is null or p_expected_revision<1
   or p_expected_input_sha256 is null or p_expected_input_sha256 !~ '^[a-f0-9]{64}$'
   or p_acknowledgement is distinct from 'I authorize read-only investigation of this chart recording hypothesis.'
 then raise exception 'Explicit bounded chart research transition required' using errcode='22023';end if;
 select w.id into strict ws from mizizi_private.workspaces w
 where w.workspace_key='wakilisha-internal' and w.workspace_kind='internal' and w.status='active'
 for update;
 perform mizizi_private.assert_chart_candidate_research_actor_v1(ws,actor);
 select k.* into c from mizizi_private.cases k where k.id=p_case_id and k.workspace_id=ws for update;
 if not found then raise exception 'Chart case not found in authorized workspace' using errcode='42501';end if;
 if c.revision<>p_expected_revision then raise exception 'Stale chart case revision' using errcode='PT409';end if;
 if c.case_state<>'open' or c.current_stage<>'triage'
 then raise exception 'Chart case is not eligible to begin research' using errcode='55000';end if;
 perform mizizi_private.assert_chart_candidate_current_v1(c.id,ws,p_expected_input_sha256);
 update mizizi_private.cases k set revision=k.revision+1,case_state='in_progress',current_stage='research',
   transition_actor_key='user:'||actor::text,transition_reason='Investigate receipt-bound chart recording identity.'
 where k.id=c.id and k.workspace_id=ws and k.revision=p_expected_revision
 returning k.revision into strict new_rev;
 return jsonb_build_object('caseId',c.id,'workspaceId',ws,'revision',new_rev,'state','in_progress',
  'stage','research','researchReason','Investigate receipt-bound chart recording identity.','jobsDispatched',0,'canPublish',false);
end $transition$;
revoke all on function public.admin_mizizi_begin_chart_case_research_v1(uuid,integer,text,text)
 from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.admin_mizizi_begin_chart_case_research_v1(uuid,integer,text,text) to authenticated;

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
  -- Chart research is a separate, receipt-bound authority. Never let the
  -- generic JIT route bypass the human transition or mint public-source consent.
  if v_case.claim_family_key='charts2_recording_investigation_v1'
     or exists (select 1 from mizizi_private.chart_candidate_subjects_v1 s where s.case_id=v_case.id)
  then
    if v_case.case_state<>'in_progress' or v_case.transition_reason is distinct from 'Investigate receipt-bound chart recording identity.'
      or v_reason is distinct from 'Investigate receipt-bound chart recording identity.'
      or p_idempotency_key is distinct from 'mizizi.case_research_v1.'||v_case.id::text||'.'||v_case.revision::text
      or v_case.transition_actor_key !~ '^user:[0-9a-f-]{36}$'
    then raise exception 'Chart research requires exact steward transition and command' using errcode='42501';end if;
    perform mizizi_private.assert_chart_candidate_research_actor_v1(
      v_case.workspace_id,substring(v_case.transition_actor_key from 6)::uuid);
    perform mizizi_private.assert_chart_candidate_current_v1(v_case.id,v_case.workspace_id,null);
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

CREATE OR REPLACE FUNCTION mizizi_private.claim_case_research_jobs_v1(p_worker_id text, p_limit integer DEFAULT 1, p_lease_seconds integer DEFAULT 300)
 RETURNS TABLE(job_id uuid, command_receipt_id uuid, resource_id uuid, command_type text, job_type text, attempt_count integer, max_attempts integer, input_payload jsonb, lease_expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
       -- Legacy workers must not consume chart jobs until a scoped chart-aware
       -- claim and source permission context are implemented and accepted.
       and c.claim_family_key<>'charts2_recording_investigation_v1'
       and not exists (select 1 from mizizi_private.chart_candidate_subjects_v1 s where s.case_id=c.id)
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
$function$;

-- Preserve the general platform claim contract for every other job; also
-- exclude chart research from this broader legacy claim path.
CREATE OR REPLACE FUNCTION platform_private.claim_jobs(p_worker_id text, p_limit integer DEFAULT 1, p_lease_seconds integer DEFAULT 300)
 RETURNS TABLE(job_id uuid, command_receipt_id uuid, resource_id uuid, command_type text, job_type text, attempt_count integer, max_attempts integer, input_payload jsonb, lease_expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'auth', 'platform_private'
AS $function$
begin
  if coalesce(auth.role(), '') <>
    'service_role'
  then
    raise exception
      using
        errcode = '42501',
        message = 'Service-role access is required.';
  end if;

  if p_worker_id is null
    or p_worker_id !~
      '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$'
  then
    raise exception
      using
        errcode = '22023',
        message = 'worker_id is invalid.';
  end if;

  if p_limit not between 1 and 100 then
    raise exception
      using
        errcode = '22023',
        message = 'limit must be between 1 and 100.';
  end if;

  if p_lease_seconds not between 30 and 3600 then
    raise exception
      using
        errcode = '22023',
        message =
          'lease_seconds must be between 30 and 3600.';
  end if;

  return query
  with candidates as (
    select jobs.id
    from platform_private.jobs
    where jobs.status in (
        'queued',
        'retry_wait'
      )
      and jobs.available_at <= now()
      and jobs.attempt_count <
        jobs.max_attempts
      and jobs.locked_by is null
      -- Chart research requires an independently accepted, scoped runner.
      and not (jobs.job_type='mizizi.case_research_v1' and exists (
        select 1 from mizizi_private.cases c
        where c.id=jobs.resource_id and
          (c.claim_family_key='charts2_recording_investigation_v1' or exists (
            select 1 from mizizi_private.chart_candidate_subjects_v1 s where s.case_id=c.id
          ))
      ))
    order by
      jobs.priority,
      jobs.available_at,
      jobs.created_at
    for update skip locked
    limit p_limit
  ),
  claimed as (
    update platform_private.jobs
    set
      status = 'running',
      attempt_count =
        platform_private.jobs.attempt_count + 1,
      locked_by = p_worker_id,
      locked_at = now(),
      lease_expires_at =
        now() +
        make_interval(
          secs => p_lease_seconds
        ),
      started_at = coalesce(
        platform_private.jobs.started_at,
        now()
      )
    from candidates
    where platform_private.jobs.id =
      candidates.id
    returning platform_private.jobs.*
  )
  select
    claimed.id,
    claimed.command_receipt_id,
    claimed.resource_id,
    claimed.command_type,
    claimed.job_type,
    claimed.attempt_count,
    claimed.max_attempts,
    claimed.input_payload,
    claimed.lease_expires_at
  from claimed;
end
$function$;

do $acl$
begin
 if not has_function_privilege('authenticated','public.admin_mizizi_begin_chart_case_research_v1(uuid,integer,text,text)','EXECUTE')
   or has_function_privilege('anon','public.admin_mizizi_begin_chart_case_research_v1(uuid,integer,text,text)','EXECUTE')
   or has_function_privilege('service_role','public.admin_mizizi_begin_chart_case_research_v1(uuid,integer,text,text)','EXECUTE')
   or has_function_privilege('mizizi_executor','public.admin_mizizi_begin_chart_case_research_v1(uuid,integer,text,text)','EXECUTE')
   or has_function_privilege('authenticated','mizizi_private.assert_chart_candidate_current_v1(uuid,uuid,text)','EXECUTE')
   or has_function_privilege('service_role','mizizi_private.assert_chart_candidate_current_v1(uuid,uuid,text)','EXECUTE')
   or not has_function_privilege('mizizi_executor','mizizi_private.admit_case_research_job_v1(uuid,uuid,integer,text,text,text,text)','EXECUTE')
   or has_function_privilege('service_role','mizizi_private.admit_case_research_job_v1(uuid,uuid,integer,text,text,text,text)','EXECUTE')
   or has_function_privilege('authenticated','mizizi_private.admit_case_research_job_v1(uuid,uuid,integer,text,text,text,text)','EXECUTE')
 then raise exception 'STOP_CHART_RESEARCH_DISPATCH_ACL_DRIFT';end if;
end $acl$;
commit;
