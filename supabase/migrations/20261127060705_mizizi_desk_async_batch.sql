-- Issue #1441. CLI 2.107.0 mint #45949793019 job 140342749472.
-- Asynchronous opening decision for a currently authorized public question.
-- No source excerpts or private prior analysis leave the process on this path.
-- Existing jobs and resource reservations remain the only work/spend authority.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
do $guard$ begin
 if current_user<>'postgres' or to_regclass('mizizi_private.desk_operational_policy_versions_v1') is null
 or to_regclass('mizizi_private.desk_async_batch_requests_v1') is not null
 then raise exception 'STOP_MIZIZI_ASYNC_BATCH_PREIMAGE';end if;
end $guard$;
alter table mizizi_private.desk_operational_policy_versions_v1
 add column public_opening_batch_allowed boolean not null default false,
 add constraint mz_desk_batch_enabled check(not public_opening_batch_allowed or enabled);
-- This opt-in explicitly permits the provider's asynchronous public-question
-- processing and result retention. It is not permission to batch private
-- evidence or to assume that a generic synchronous grant covers retention.
create table mizizi_private.desk_async_batch_requests_v1(
 job_id uuid primary key references platform_private.jobs(id),
 reservation_id uuid not null unique references mizizi_private.desk_resource_reservations_v1(id),
 case_id uuid not null,workspace_id uuid not null,expected_revision integer not null,
 membership_sha256 text not null check(membership_sha256 ~ '^[a-f0-9]{64}$'),
 observation_sha256 text not null check(observation_sha256 ~ '^[a-f0-9]{64}$'),
 operational_revision integer not null,
 question_sha256 text not null check(question_sha256 ~ '^[a-f0-9]{64}$'),
 body_sha256 text not null check(body_sha256 ~ '^[a-f0-9]{64}$'),
 original_request_sha256 text not null check(original_request_sha256 ~ '^[a-f0-9]{64}$'),
 binding_sha256 text not null check(binding_sha256 ~ '^[a-f0-9]{64}$'),
 exact_model_revision integer,
 account_fingerprint text not null check(account_fingerprint ~ '^[a-f0-9]{64}$'),
 model text not null check(model ~ '^[A-Za-z0-9._:-]{3,100}$'),
 recorded_at timestamptz not null default clock_timestamp(),
 foreign key(workspace_id,case_id,operational_revision)
 references mizizi_private.desk_operational_policy_versions_v1(workspace_id,case_id,revision)
);
-- Only provider identifiers, digest and terminal metering status, no prompt
-- or response payload. Original reservation is the charge even if POST is lost.
create table mizizi_private.desk_async_batch_events_v1(
 reservation_id uuid not null references mizizi_private.desk_async_batch_requests_v1(reservation_id),
 ordinal integer not null check(ordinal between 1 and 2),
 state text not null check(state in ('accepted','metered','unconfirmed')),
 provider_batch_id text check(provider_batch_id ~ '^msgbatch_[A-Za-z0-9_-]{1,128}$'),
 result_sha256 text check(result_sha256 ~ '^[a-f0-9]{64}$'),
 recorded_at timestamptz not null default clock_timestamp(),
 primary key(reservation_id,ordinal),
 check((state='accepted' and ordinal=1 and provider_batch_id is not null and result_sha256 is null)
 or (state='metered' and ordinal=2 and provider_batch_id is not null and result_sha256 is not null)
 or (state='unconfirmed' and result_sha256 is null))
);
create unique index mz_desk_async_batch_provider_once on mizizi_private.desk_async_batch_events_v1(provider_batch_id) where state='accepted';
alter table mizizi_private.desk_async_batch_requests_v1 enable row level security;
alter table mizizi_private.desk_async_batch_requests_v1 force row level security;
alter table mizizi_private.desk_async_batch_events_v1 enable row level security;
alter table mizizi_private.desk_async_batch_events_v1 force row level security;
revoke all on mizizi_private.desk_async_batch_requests_v1,mizizi_private.desk_async_batch_events_v1
 from public,anon,authenticated,service_role,mizizi_executor;
create trigger mz_desk_async_batch_request_immutable before update or delete on mizizi_private.desk_async_batch_requests_v1
 for each row execute function mizizi_private.guard_desk_resource_event_v1();
create trigger mz_desk_async_batch_event_immutable before update or delete on mizizi_private.desk_async_batch_events_v1
 for each row execute function mizizi_private.guard_desk_resource_event_v1();

-- Current lease can recover the first-round body, but cannot silently
-- replace a submitted/ambiguous request after model, policy or case drift.
create function public.mizizi_read_desk_async_batch_v1(p_scope jsonb,p_question_sha256 text,p_body_sha256 text,
 p_model text,p_account_fingerprint text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare c jsonb;o mizizi_private.desk_operational_policy_versions_v1;a mizizi_private.desk_async_batch_requests_v1;
 r mizizi_private.desk_resource_reservations_v1;e mizizi_private.desk_async_batch_events_v1;
 p mizizi_private.desk_model_authority_versions_v1;batch_id text;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service-role required' using errcode='42501';end if;
 if coalesce(p_question_sha256,'') !~ '^[a-f0-9]{64}$' or coalesce(p_body_sha256,'') !~ '^[a-f0-9]{64}$'
 or coalesce(p_account_fingerprint,'') !~ '^[a-f0-9]{64}$' or coalesce(p_model,'') !~ '^[A-Za-z0-9._:-]{3,100}$'
 then return null;end if;
 perform pg_advisory_xact_lock(214781521,61431);
 c:=mizizi_private.desk_custody_context_v1(p_scope);
 if c is null then return null;end if;
 o:=mizizi_private.current_desk_operational_policy_v1(c);
 select * into a from mizizi_private.desk_async_batch_requests_v1 where job_id=(p_scope->>'jobId')::uuid;
 if not found then
  if not coalesce(mizizi_private.desk_operational_policy_live_v1(o,c),false)
   or not o.public_opening_batch_allowed or not(p_question_sha256=any(o.question_sha256s))
   or not(p_model=any(o.model_ids)) or o.credential_sha256<>p_account_fingerprint
   or exists(select 1 from mizizi_private.research_passes x where x.case_id=(c->>'caseId')::uuid)
   or o.valid_until<=clock_timestamp()+interval '24 hours'
  then return jsonb_build_object('state','disabled');end if;
  return jsonb_build_object('state','available');
 end if;
 if a.case_id::text is distinct from c->>'caseId' or a.workspace_id::text is distinct from c->>'workspaceId'
 or a.expected_revision::text is distinct from c->>'expectedRevision'
 or a.membership_sha256 is distinct from c->>'membershipSha256'
 or a.observation_sha256 is distinct from c->>'observationSha256'
 or a.body_sha256<>p_body_sha256 or a.question_sha256<>p_question_sha256 or a.model<>p_model
 or a.account_fingerprint<>p_account_fingerprint or o.revision is distinct from a.operational_revision
 or not coalesce(mizizi_private.desk_operational_policy_live_v1(o,c),false) or not o.public_opening_batch_allowed
 or exists(select 1 from mizizi_private.research_passes x where x.case_id=a.case_id)
 then return jsonb_build_object('state','blocked');end if;
 select * into p from mizizi_private.desk_model_authority_versions_v1
  where workspace_id=a.workspace_id and case_id=a.case_id and operation='model_disclose' and binding_sha256=a.binding_sha256
  order by revision desc limit 1;
 if p.revision is distinct from a.exact_model_revision or
 (p.revision is not null and (not p.enabled or p.valid_until<=clock_timestamp()))
 then return jsonb_build_object('state','blocked');end if;
 select * into strict r from mizizi_private.desk_resource_reservations_v1 where id=a.reservation_id;
 select * into e from mizizi_private.desk_async_batch_events_v1 where reservation_id=a.reservation_id order by ordinal desc limit 1;
 if e.ordinal is null or e.state='unconfirmed' then return jsonb_build_object('state','uncertain');end if;
 return jsonb_build_object('state',case when e.state='metered' then 'metered' else 'pending' end,
  'reservationId',r.id,'originalRequestSha256',r.request_sha256,'providerBatchId',e.provider_batch_id,
  'bodySha256',a.body_sha256,'model',a.model,'maxInputTokens',r.max_input_tokens,
  'maxOutputTokens',r.max_output_tokens,'maximumCostMicrousd',r.units,'resultSha256',e.result_sha256);
end $f$;

-- Persist the irreversible send intent before any provider POST. The same
-- ordinary disclosure RPC and full conservative monetary reservation are
-- prerequisites; batching never creates a second allowance or an implicit discount.
create function public.mizizi_begin_desk_async_batch_v1(p_scope jsonb,p_binding_text text,p_binding_sha256 text,
 p_reservation_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog as $f$
declare c jsonb;b jsonb;o mizizi_private.desk_operational_policy_versions_v1;
 r mizizi_private.desk_resource_reservations_v1;p mizizi_private.desk_model_authority_versions_v1;state jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service-role required' using errcode='42501';end if;
 if p_binding_text is null or octet_length(p_binding_text) not between 1 and 16384
 or p_binding_sha256 is distinct from encode(sha256(convert_to(p_binding_text,'UTF8')),'hex')
 then return false;end if;
 b:=p_binding_text::jsonb;
 if b->'scope' is distinct from p_scope or b->'round' is distinct from '1'::jsonb
 or b->'sourceIds' is distinct from '[]'::jsonb or b->'toolReceipts' is distinct from '[]'::jsonb
 or b->'maxOutputTokens' is distinct from '2500'::jsonb
 then return false;end if;
 perform pg_advisory_xact_lock(214781521,61431);
 c:=mizizi_private.desk_custody_context_v1(p_scope);
 if c is null then return false;end if;
 o:=mizizi_private.current_desk_operational_policy_v1(c);
 state:=public.mizizi_read_desk_async_batch_v1(p_scope,b->>'questionSha256',b->>'bodySha256',b->>'model',b->>'credentialSha256');
 if state->>'state' is distinct from 'available' then return false;end if;
 if public.mizizi_authorize_desk_model_operation_v1(p_scope,'model_disclose',p_binding_text,p_binding_sha256)->>'allowed' is distinct from 'true'
 then return false;end if;
 select * into r from mizizi_private.desk_resource_reservations_v1 where id=p_reservation_id;
 if not found or r.resource<>'anthropic' or r.job_id::text is distinct from p_scope->>'jobId'
 or r.case_id::text is distinct from c->>'caseId' or r.workspace_id::text is distinct from c->>'workspaceId'
 or r.expected_revision::text is distinct from c->>'expectedRevision'
 or r.worker_id is distinct from p_scope->>'workerId'
 or r.lease_expires_at is distinct from (p_scope->>'leaseExpiresAt')::timestamptz
 or r.membership_sha256 is distinct from c->>'membershipSha256' or r.observation_sha256 is distinct from c->>'observationSha256'
 or r.request_sha256 is distinct from b->>'requestSha256' or r.model is distinct from b->>'model'
 or r.account_fingerprint is distinct from b->>'credentialSha256'
 or r.consumed_at is null or r.valid_until<=clock_timestamp()
 or not exists(select 1 from mizizi_private.desk_resource_events_v1 e where e.reservation_id=r.id and e.ordinal=1 and e.state='send_pending')
 or exists(select 1 from mizizi_private.desk_resource_events_v1 e where e.reservation_id=r.id and e.ordinal>1)
 then return false;end if;
 select * into p from mizizi_private.desk_model_authority_versions_v1 where workspace_id=r.workspace_id and case_id=r.case_id
  and operation='model_disclose' and binding_sha256=p_binding_sha256 order by revision desc limit 1;
 -- An exact grant must itself cover the processing window. Standing consent
 -- must explicitly cover the asynchronous retention terms for this public question.
 if p.revision is not null and (not p.enabled or p.valid_until<=clock_timestamp()+interval '24 hours') then return false;end if;
 insert into mizizi_private.desk_async_batch_requests_v1(job_id,reservation_id,case_id,workspace_id,expected_revision,
 membership_sha256,observation_sha256,operational_revision,question_sha256,body_sha256,original_request_sha256,
 binding_sha256,exact_model_revision,account_fingerprint,model)
 values(r.job_id,r.id,r.case_id,r.workspace_id,r.expected_revision,r.membership_sha256,r.observation_sha256,o.revision,
 b->>'questionSha256',b->>'bodySha256',r.request_sha256,p_binding_sha256,p.revision,r.account_fingerprint,r.model)
 on conflict do nothing;
 return found;
end $f$;

-- Financial reconciliation is intentionally available even after lease/policy
-- expiry. It cannot grant fresh disclosure, spend, or journal completion.
-- Exact event replay is accepted; an ambiguous POST never gets another POST.
create function public.mizizi_record_desk_async_batch_v1(p_reservation_id uuid,p_account_fingerprint text,
 p_state text,p_provider_batch_id text,p_result_sha256 text,p_usage jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog as $f$
declare a mizizi_private.desk_async_batch_requests_v1;r mizizi_private.desk_resource_reservations_v1;
 e mizizi_private.desk_async_batch_events_v1;charge_state text;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service-role required' using errcode='42501';end if;
 select * into a from mizizi_private.desk_async_batch_requests_v1 where reservation_id=p_reservation_id
 and account_fingerprint=p_account_fingerprint for update;
 if not found then return false;end if;
 select * into strict r from mizizi_private.desk_resource_reservations_v1 where id=a.reservation_id;
 select * into e from mizizi_private.desk_async_batch_events_v1 where reservation_id=r.id order by ordinal desc limit 1;
 if p_state='accepted' then
  if coalesce(p_provider_batch_id,'') !~ '^msgbatch_[A-Za-z0-9_-]{1,128}$' or p_result_sha256 is not null
   or p_usage is distinct from '{}'::jsonb then return false;end if;
  if e.ordinal is not null then
   return exists(select 1 from mizizi_private.desk_async_batch_events_v1 x where x.reservation_id=r.id
    and x.ordinal=1 and x.state='accepted' and x.provider_batch_id=p_provider_batch_id);
  end if;
  insert into mizizi_private.desk_async_batch_events_v1(reservation_id,ordinal,state,provider_batch_id)
  values(r.id,1,'accepted',p_provider_batch_id);
  return true;
 end if;
 if p_state='metered' then
  if coalesce(p_result_sha256,'') !~ '^[a-f0-9]{64}$' or e.ordinal is null
   or e.provider_batch_id is distinct from p_provider_batch_id or e.state not in ('accepted','metered')
   or (e.state='metered' and e.result_sha256 is distinct from p_result_sha256) then return false;end if;
  charge_state:='response_metered';
 elsif p_state='unconfirmed' then
  if p_result_sha256 is not null or p_usage is distinct from '{}'::jsonb or e.state='metered'
   or (e.ordinal is not null and e.provider_batch_id is distinct from p_provider_batch_id)
   or (e.ordinal is null and p_provider_batch_id is not null) then return false;end if;
  charge_state:='response_unconfirmed';
 else return false;end if;
 if not public.mizizi_record_desk_resource_event_v1(r.id,r.request_sha256,r.account_fingerprint,charge_state,p_usage)
 then return false;end if;
 if e.state=p_state then return true;end if;
 insert into mizizi_private.desk_async_batch_events_v1(reservation_id,ordinal,state,provider_batch_id,result_sha256)
 values(r.id,coalesce(e.ordinal,0)+1,p_state,p_provider_batch_id,p_result_sha256);
 return true;
end $f$;

revoke all on function public.mizizi_read_desk_async_batch_v1(jsonb,text,text,text,text),
 public.mizizi_begin_desk_async_batch_v1(jsonb,text,text,uuid),
 public.mizizi_record_desk_async_batch_v1(uuid,text,text,text,text,jsonb)
 from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_read_desk_async_batch_v1(jsonb,text,text,text,text),
 public.mizizi_begin_desk_async_batch_v1(jsonb,text,text,uuid),
 public.mizizi_record_desk_async_batch_v1(uuid,text,text,text,text,jsonb) to service_role;
do $acl$ begin
 if has_function_privilege('authenticated','public.mizizi_begin_desk_async_batch_v1(jsonb,text,text,uuid)','EXECUTE')
 or has_table_privilege('service_role','mizizi_private.desk_async_batch_requests_v1','INSERT')
 or has_table_privilege('service_role','mizizi_private.desk_async_batch_events_v1','INSERT')
 then raise exception 'STOP_MIZIZI_BATCH_ACL';end if;
end $acl$;
commit;
