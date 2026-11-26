-- Issue #1441, Slice 1. Pinned CLI 2.107.0 mint run 45832972262.
-- Financial/capacity authority ONLY. Does not authorize any outbound payload,
-- source access, retention, model disclosure, remote egress or canonical writes.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
do $guard$
begin
 if current_user<>'postgres'
 or to_regprocedure('mizizi_private.read_leased_chart_research_context_v1(uuid,text)') is null
 or to_regclass('mizizi_private.desk_search_reservations_v1') is null
 or to_regclass('mizizi_private.desk_resource_policy_versions_v1') is not null
 or to_regclass('mizizi_private.desk_resource_reservations_v1') is not null
 or to_regclass('mizizi_private.desk_resource_events_v1') is not null
 or has_schema_privilege('service_role','mizizi_private','USAGE')
 or has_schema_privilege('authenticated','mizizi_private','USAGE')
 then raise exception 'STOP_MIZIZI_DESK_RESOURCE_PREIMAGE'; end if;
end $guard$;

-- One shared account allocation per resource. No seeded allocation. Owner
-- policy must independently verify pricing/entitlement, billing ceiling,
-- resource isolation and exclusivity of allocation across environments.
-- Native units conservatively represent 2 MB response capacity per hop;
-- browser seconds are conservative precharges, not actual provider duration;
-- Anthropic units are USD millionths, never generic token units.
create table mizizi_private.desk_resource_policy_versions_v1(
 resource text not null check(resource in ('anthropic','native_https','cloudflare_browser_run')),
 revision integer not null check(revision>=1),
 enabled boolean not null default false,
 workspace_id uuid not null,
 account_fingerprint text not null check(account_fingerprint ~ '^[a-f0-9]{64}$'),
 entitlement_ref text not null check(length(btrim(entitlement_ref)) between 8 and 300),
 billing_safeguard_ref text not null check(length(btrim(billing_safeguard_ref)) between 8 and 300),
 exclusive_allocation_verified boolean not null default false,
 capacity_ceiling_verified boolean not null default false,
 paid_inference_authorized boolean not null default false,
 zero_incremental_cost_verified boolean not null default false,
 allowance_start timestamptz not null,
 allowance_end timestamptz not null,
 valid_until timestamptz not null,
 account_limit bigint not null check(account_limit between 1 and 100000000000),
 daily_limit bigint not null check(daily_limit between 1 and account_limit),
 case_limit bigint not null check(case_limit between 1 and account_limit),
 -- Owner-issued, exact active model ID -> verified full input context bound,
 -- conservative maximum input/output rates (microusd/million tokens), price ref.
 model_tariffs jsonb not null default '{}'::jsonb check(jsonb_typeof(model_tariffs)='object'),
 recorded_at timestamptz not null default clock_timestamp(),
 primary key(resource,revision),
 check(allowance_end>allowance_start and allowance_end<=allowance_start+interval '32 days'),
 check(valid_until<=allowance_end),
 check(resource='anthropic' or model_tariffs='{}'::jsonb),
 check(not enabled or (exclusive_allocation_verified and capacity_ceiling_verified
   and ((resource='anthropic' and paid_inference_authorized and model_tariffs<>'{}'::jsonb)
        or (resource<>'anthropic' and zero_incremental_cost_verified and not paid_inference_authorized))))
);
create table mizizi_private.desk_resource_reservations_v1(
 id uuid primary key default gen_random_uuid(),
 resource text not null,
 policy_revision integer not null,
 request_sha256 text not null check(request_sha256 ~ '^[a-f0-9]{64}$'),
 binding_sha256 text not null check(binding_sha256 ~ '^[a-f0-9]{64}$'),
 job_id uuid not null,case_id uuid not null,workspace_id uuid not null,
 expected_revision integer not null check(expected_revision>=1),
 worker_id text not null check(worker_id ~ '^mizizi-chart:[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'),
 lease_expires_at timestamptz not null,
 membership_sha256 text not null check(membership_sha256 ~ '^[a-f0-9]{64}$'),
 observation_sha256 text not null check(observation_sha256 ~ '^[a-f0-9]{64}$'),
 account_fingerprint text not null check(account_fingerprint ~ '^[a-f0-9]{64}$'),
 units bigint not null check(units>0),
 model text,pricing_ref text,max_input_tokens integer,max_output_tokens integer,
 reserved_at timestamptz not null,valid_until timestamptz not null,consumed_at timestamptz,
 foreign key(resource,policy_revision) references mizizi_private.desk_resource_policy_versions_v1(resource,revision),
 unique(resource,request_sha256),
 check(valid_until>reserved_at and valid_until<=lease_expires_at),
 check(consumed_at is null or (consumed_at>=reserved_at and consumed_at<valid_until)),
 check((resource='anthropic' and model is not null and pricing_ref is not null and
   max_input_tokens between 1 and 1000000 and max_output_tokens=2500)
   or (resource<>'anthropic' and model is null and pricing_ref is null and max_input_tokens is null and max_output_tokens is null))
);
create index mz_desk_resource_reserved_at on mizizi_private.desk_resource_reservations_v1(resource,reserved_at);
create index mz_desk_resource_case on mizizi_private.desk_resource_reservations_v1(resource,case_id);
create table mizizi_private.desk_resource_events_v1(
 reservation_id uuid not null references mizizi_private.desk_resource_reservations_v1(id),
 ordinal integer not null check(ordinal between 1 and 3),
 state text not null check(state in ('send_pending','response_metered','response_unconfirmed',
  'open_pending','opened','close_acknowledged','cleanup_unconfirmed')),
 detail jsonb not null default '{}'::jsonb check(jsonb_typeof(detail)='object'),
 recorded_at timestamptz not null default clock_timestamp(),
 primary key(reservation_id,ordinal)
);
alter table mizizi_private.desk_resource_policy_versions_v1 enable row level security;
alter table mizizi_private.desk_resource_policy_versions_v1 force row level security;
alter table mizizi_private.desk_resource_reservations_v1 enable row level security;
alter table mizizi_private.desk_resource_reservations_v1 force row level security;
alter table mizizi_private.desk_resource_events_v1 enable row level security;
alter table mizizi_private.desk_resource_events_v1 force row level security;
revoke all on mizizi_private.desk_resource_policy_versions_v1,mizizi_private.desk_resource_reservations_v1,
 mizizi_private.desk_resource_events_v1 from public,anon,authenticated,service_role,mizizi_executor;

create function mizizi_private.guard_desk_resource_policy_v1()
returns trigger language plpgsql set search_path=pg_catalog as $policy$
declare prior mizizi_private.desk_resource_policy_versions_v1%rowtype;
 k text; v jsonb;
begin
 if tg_op<>'INSERT' then raise exception 'Desk resource policy history immutable' using errcode='55000';end if;
 perform pg_advisory_xact_lock(214781521,61430);
 select * into prior from mizizi_private.desk_resource_policy_versions_v1
  where resource=new.resource order by revision desc limit 1;
 if new.revision<>coalesce(prior.revision,0)+1 then raise exception 'Resource revision conflict' using errcode='PT409';end if;
 if prior.revision is not null and (
 (prior.allowance_end>clock_timestamp() and (new.allowance_start<>prior.allowance_start
 or new.allowance_end<>prior.allowance_end or new.account_fingerprint<>prior.account_fingerprint))
 or (new.allowance_start<>prior.allowance_start and new.allowance_start<prior.allowance_end))
 then raise exception 'Resource allowance period overlap or reset' using errcode='PT409';end if;
 if octet_length(new.model_tariffs::text)>64000 or (select count(*) from jsonb_object_keys(new.model_tariffs))>100
 then raise exception 'Tariff bound' using errcode='22023';end if;
 for k,v in select key,value from jsonb_each(new.model_tariffs) loop
  if k !~ '^[A-Za-z0-9._:-]{3,100}$' or jsonb_typeof(v)<>'object'
  or not (v ?& array['pricingRef','maxInputTokens','maxOutputTokens','inputRate','outputRate'])
  or (select count(*) from jsonb_object_keys(v))<>5
  or coalesce(v->>'pricingRef','') !~ '^[A-Za-z0-9._:/-]{8,200}$'
  or coalesce(v->>'maxInputTokens','') !~ '^[1-9][0-9]{0,6}$'
  or coalesce(v->>'maxOutputTokens','') !~ '^[1-9][0-9]{0,6}$'
  or coalesce(v->>'inputRate','') !~ '^[1-9][0-9]{0,11}$'
  or coalesce(v->>'outputRate','') !~ '^[1-9][0-9]{0,11}$'
  then raise exception 'Invalid model tariff' using errcode='22023';end if;
  if (v->>'maxInputTokens')::bigint>1000000 or (v->>'maxOutputTokens')::bigint<2500
  then raise exception 'Invalid full model context bound' using errcode='22023';end if;
 end loop;
 new.recorded_at:=clock_timestamp();return new;
end $policy$;
create trigger mz_desk_resource_policy_guard before insert or update or delete on
 mizizi_private.desk_resource_policy_versions_v1 for each row execute function mizizi_private.guard_desk_resource_policy_v1();
-- Reuse the existing immutable reservation trigger: only one consumed_at transition.
create trigger mz_desk_resource_reservation_guard before update or delete on
 mizizi_private.desk_resource_reservations_v1 for each row execute function mizizi_private.guard_desk_search_reservation_v1();
create function mizizi_private.guard_desk_resource_event_v1()
returns trigger language plpgsql set search_path=pg_catalog as $event$
begin
 raise exception 'Desk resource event history immutable' using errcode='55000';
end $event$;
create trigger mz_desk_resource_event_guard before update or delete on
 mizizi_private.desk_resource_events_v1 for each row execute function mizizi_private.guard_desk_resource_event_v1();

-- Exact canonical resource descriptor. External request digest is a reference
-- to the independently authorized envelope/URL/target, not a disclosure grant.
-- No full body, query, URL, source content, secret or model response stored.
create function mizizi_private.qualify_desk_resource_v1(p_binding_text text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $qualify$
declare b jsonb;s jsonb;ctx jsonb;p mizizi_private.desk_resource_policy_versions_v1%rowtype;
 t timestamptz; until_at timestamptz; tariff jsonb; units bigint; model_id text; price text;
 input_tokens integer;output_tokens integer;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service-role required' using errcode='42501';end if;
 if p_binding_text is null or octet_length(p_binding_text) not between 1 and 4096
 then raise exception 'Invalid resource descriptor' using errcode='22023';end if;
 b:=p_binding_text::jsonb;s:=b->'scope';
 if jsonb_typeof(b) is distinct from 'object' or jsonb_typeof(s) is distinct from 'object'
 then raise exception 'Invalid resource descriptor' using errcode='22023';end if;
 if not (b ?& array['scope','resource','requestSha256','accountFingerprint','model']) or
 (select count(*) from jsonb_object_keys(b))<>5 or
 not(s ?& array['jobId','caseId','workspaceId','expectedRevision','workerId','leaseExpiresAt']) or
 (select count(*) from jsonb_object_keys(s))<>6 or
 coalesce(b->>'resource','') not in ('anthropic','native_https','cloudflare_browser_run') or
 coalesce(b->>'requestSha256','') !~ '^[a-f0-9]{64}$' or
 coalesce(b->>'accountFingerprint','') !~ '^[a-f0-9]{64}$' or
 coalesce(s->>'jobId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' or
 coalesce(s->>'caseId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' or
 coalesce(s->>'workspaceId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' or
 coalesce(s->>'expectedRevision','') !~ '^[1-9][0-9]{0,8}$' or
 coalesce(s->>'workerId','') !~ '^mizizi-chart:[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' or
 coalesce(s->>'leaseExpiresAt','') !~ '^.{20,40}$' or
 (b->>'resource'='anthropic' and coalesce(b->>'model','') !~ '^[A-Za-z0-9._:-]{3,100}$') or
 (b->>'resource'<>'anthropic' and b->'model'<>'null'::jsonb)
 then raise exception 'Invalid resource scope' using errcode='22023';end if;
 perform pg_advisory_xact_lock(214781521,61430);
 select * into p from mizizi_private.desk_resource_policy_versions_v1
 where resource=b->>'resource' order by revision desc limit 1;
 t:=clock_timestamp();
 if not found or not p.enabled or not p.exclusive_allocation_verified or not p.capacity_ceiling_verified
 or p.workspace_id::text<>s->>'workspaceId' or p.account_fingerprint<>b->>'accountFingerprint'
 or t<p.allowance_start or t>=p.allowance_end or t>=p.valid_until then return null;end if;
 if p.resource='anthropic' then
  if not p.paid_inference_authorized then return null;end if;
  model_id:=b->>'model';tariff:=p.model_tariffs->model_id;
  if tariff is null then return null;end if;
  input_tokens:=(tariff->>'maxInputTokens')::integer;output_tokens:=2500;price:=tariff->>'pricingRef';
  -- Charge full verified context ceiling, not caller-supplied estimates.
  units:=ceil((input_tokens::numeric*(tariff->>'inputRate')::numeric+
    output_tokens::numeric*(tariff->>'outputRate')::numeric)/1000000)::bigint;
 else
  if not p.zero_incremental_cost_verified then return null;end if;
  units:=case p.resource when 'native_https' then 2000000 else 120 end;
 end if;
 if units<1 or units>p.account_limit or units>p.daily_limit or units>p.case_limit then return null;end if;
 ctx:=mizizi_private.read_leased_chart_research_context_v1((s->>'jobId')::uuid,s->>'workerId');
 if ctx->>'caseId' is distinct from s->>'caseId' or ctx->>'workspaceId' is distinct from s->>'workspaceId'
 or ctx->>'expectedRevision' is distinct from s->>'expectedRevision'
 or (ctx->>'leaseExpiresAt')::timestamptz is distinct from (s->>'leaseExpiresAt')::timestamptz
 then return null;end if;
 t:=clock_timestamp();
 until_at:=least(p.valid_until,p.allowance_end,(ctx->>'leaseExpiresAt')::timestamptz,
 (date_trunc('day',t at time zone 'UTC') at time zone 'UTC')+interval '1 day',t+interval '30 seconds');
 if until_at<=t then return null;end if;
 return jsonb_build_object('requestSha256',b->>'requestSha256','bindingSha256',encode(sha256(convert_to(p_binding_text,'UTF8')),'hex'),
 'resource',p.resource,'policyRevision',p.revision,'units',units,'validUntil',until_at,
 'membershipSha256',ctx->>'membershipSha256','observationSha256',ctx->>'observationSha256',
 'model',model_id,'pricingRef',price,'maxInputTokens',input_tokens,'maxOutputTokens',output_tokens,
 'maximumCostMicrousd',case when p.resource='anthropic' then units else 0 end);
end $qualify$;

create function public.mizizi_quote_desk_resource_v1(p_binding_text text)
returns jsonb language sql security definer set search_path=pg_catalog as $quote$
 select mizizi_private.qualify_desk_resource_v1(p_binding_text)-'membershipSha256'-'observationSha256';
$quote$;
create function public.mizizi_reserve_desk_resource_v1(p_binding_text text,p_policy_revision integer,p_expected_units bigint)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $reserve$
declare a jsonb;b jsonb;s jsonb;p mizizi_private.desk_resource_policy_versions_v1%rowtype;
 r mizizi_private.desk_resource_reservations_v1%rowtype;t timestamptz;u bigint;
begin
 a:=mizizi_private.qualify_desk_resource_v1(p_binding_text);
 if a is null or p_policy_revision is distinct from (a->>'policyRevision')::integer
 or p_expected_units is distinct from (a->>'units')::bigint then return null;end if;
 b:=p_binding_text::jsonb;s:=b->'scope';u:=(a->>'units')::bigint;t:=clock_timestamp();
 select * into strict p from mizizi_private.desk_resource_policy_versions_v1
 where resource=a->>'resource' and revision=p_policy_revision;
 if t>=(a->>'validUntil')::timestamptz
 or exists(select 1 from mizizi_private.desk_resource_reservations_v1 where resource=p.resource and request_sha256=b->>'requestSha256')
 or u+coalesce((select sum(units) from mizizi_private.desk_resource_reservations_v1 where resource=p.resource
  and reserved_at>=p.allowance_start and reserved_at<p.allowance_end),0)>p.account_limit
 or u+coalesce((select sum(units) from mizizi_private.desk_resource_reservations_v1 where resource=p.resource
  and reserved_at>=(date_trunc('day',t at time zone 'UTC') at time zone 'UTC')),0)>p.daily_limit
 or u+coalesce((select sum(units) from mizizi_private.desk_resource_reservations_v1 where resource=p.resource
  and case_id=(s->>'caseId')::uuid),0)>p.case_limit then return null;end if;
 insert into mizizi_private.desk_resource_reservations_v1(resource,policy_revision,request_sha256,binding_sha256,
 job_id,case_id,workspace_id,expected_revision,worker_id,lease_expires_at,membership_sha256,observation_sha256,
 account_fingerprint,units,model,pricing_ref,max_input_tokens,max_output_tokens,reserved_at,valid_until)
 values(p.resource,p.revision,b->>'requestSha256',a->>'bindingSha256',(s->>'jobId')::uuid,(s->>'caseId')::uuid,
 (s->>'workspaceId')::uuid,(s->>'expectedRevision')::integer,s->>'workerId',(s->>'leaseExpiresAt')::timestamptz,
 a->>'membershipSha256',a->>'observationSha256',p.account_fingerprint,u,a->>'model',a->>'pricingRef',
 (a->>'maxInputTokens')::integer,(a->>'maxOutputTokens')::integer,t,(a->>'validUntil')::timestamptz) returning * into r;
 return a-'membershipSha256'-'observationSha256'||jsonb_build_object('reservationId',r.id);
end $reserve$;

create function public.mizizi_consume_desk_resource_v1(p_reservation_id uuid,p_request_sha256 text,p_account_fingerprint text)
returns boolean language plpgsql security definer set search_path=pg_catalog as $consume$
declare r mizizi_private.desk_resource_reservations_v1%rowtype;
 p mizizi_private.desk_resource_policy_versions_v1%rowtype;ctx jsonb;t timestamptz;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service-role required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(214781521,61430);
 select * into r from mizizi_private.desk_resource_reservations_v1
 where id=p_reservation_id and request_sha256=p_request_sha256 and account_fingerprint=p_account_fingerprint for update;
 if not found or r.consumed_at is not null or r.valid_until<=clock_timestamp() then return false;end if;
 select * into p from mizizi_private.desk_resource_policy_versions_v1 where resource=r.resource order by revision desc limit 1;
 if not found or p.revision<>r.policy_revision or not p.enabled or p.valid_until<=clock_timestamp()
 or p.allowance_end<=clock_timestamp() then return false;end if;
 ctx:=mizizi_private.read_leased_chart_research_context_v1(r.job_id,r.worker_id);
 if ctx->>'caseId' is distinct from r.case_id::text or ctx->>'workspaceId' is distinct from r.workspace_id::text
 or ctx->>'expectedRevision' is distinct from r.expected_revision::text
 or (ctx->>'leaseExpiresAt')::timestamptz is distinct from r.lease_expires_at
 or ctx->>'membershipSha256' is distinct from r.membership_sha256
 or ctx->>'observationSha256' is distinct from r.observation_sha256 then return false;end if;
 t:=clock_timestamp();if t>=r.valid_until or t>=p.valid_until or t>=p.allowance_end then return false;end if;
 update mizizi_private.desk_resource_reservations_v1 set consumed_at=t where id=r.id and consumed_at is null;
 return found;
end $consume$;

-- Post-send reconciliation intentionally remains possible after lease expiry
-- or policy revocation. It cannot spend, refund, reopen, or grant authority.
-- Exact replay returns true; conflicting or out-of-order events fail closed.
create function public.mizizi_record_desk_resource_event_v1(p_reservation_id uuid,p_request_sha256 text,
 p_account_fingerprint text,p_state text,p_detail jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog as $record$
declare r mizizi_private.desk_resource_reservations_v1%rowtype;
 last_event mizizi_private.desk_resource_events_v1%rowtype;
 prev_session text; k text; n numeric;input_sum numeric:=0;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service-role required' using errcode='42501';end if;
 if p_detail is null or jsonb_typeof(p_detail)<>'object' or octet_length(p_detail::text)>1024 then return false;end if;
 perform pg_advisory_xact_lock(214781521,61430);
 select * into r from mizizi_private.desk_resource_reservations_v1
 where id=p_reservation_id and request_sha256=p_request_sha256 and account_fingerprint=p_account_fingerprint for update;
 if not found or r.consumed_at is null or r.resource='native_https' then return false;end if;
 select * into last_event from mizizi_private.desk_resource_events_v1 where reservation_id=r.id order by ordinal desc limit 1;
 if exists(select 1 from mizizi_private.desk_resource_events_v1 where reservation_id=r.id and state=p_state and detail=p_detail) then return true;end if;
 if r.resource='anthropic' then
  if last_event.ordinal is null then
   if p_state<>'send_pending' or p_detail<>'{}'::jsonb or clock_timestamp()>=r.valid_until then return false;end if;
  elsif last_event.state='send_pending' then
   if p_state='response_unconfirmed' then
    if p_detail<>'{}'::jsonb then return false;end if;
   elsif p_state='response_metered' then
    if (select count(*) from jsonb_object_keys(p_detail))<>4 or
     not(p_detail ?& array['inputTokens','outputTokens','cacheCreationTokens','cacheReadTokens']) then return false;end if;
    for k in select jsonb_object_keys(p_detail) loop
     if jsonb_typeof(p_detail->k)<>'number' or coalesce(p_detail->>k,'') !~ '^(0|[1-9][0-9]{0,7})$' then return false;end if;
     n:=(p_detail->>k)::numeric;
     if k='outputTokens' then if n>r.max_output_tokens then return false;end if;
     else input_sum:=input_sum+n;end if;
    end loop;
    if input_sum>r.max_input_tokens or input_sum+(p_detail->>'outputTokens')::numeric<1 then return false;end if;
   else return false;end if;
  else return false;end if;
 else
  if last_event.ordinal is null then
   if p_state<>'open_pending' or p_detail<>'{}'::jsonb or clock_timestamp()>=r.valid_until then return false;end if;
  elsif last_event.state='open_pending' then
   if p_state='opened' then
    if (select count(*) from jsonb_object_keys(p_detail))<>1 or coalesce(p_detail->>'sessionId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then return false;end if;
   elsif p_state='cleanup_unconfirmed' then
    if p_detail<>'{}'::jsonb then return false;end if;
   else return false;end if;
  elsif last_event.state='opened' then
   if p_state not in ('close_acknowledged','cleanup_unconfirmed') or p_detail<>last_event.detail then return false;end if;
  else return false;end if;
 end if;
 insert into mizizi_private.desk_resource_events_v1(reservation_id,ordinal,state,detail)
 values(r.id,coalesce(last_event.ordinal,0)+1,p_state,p_detail);
 return true;
end $record$;
revoke all on function mizizi_private.guard_desk_resource_policy_v1(),mizizi_private.guard_desk_resource_event_v1(),
 mizizi_private.qualify_desk_resource_v1(text) from public,anon,authenticated,service_role,mizizi_executor;
revoke all on function public.mizizi_quote_desk_resource_v1(text),public.mizizi_reserve_desk_resource_v1(text,integer,bigint),
 public.mizizi_consume_desk_resource_v1(uuid,text,text),public.mizizi_record_desk_resource_event_v1(uuid,text,text,text,jsonb)
 from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_quote_desk_resource_v1(text),public.mizizi_reserve_desk_resource_v1(text,integer,bigint),
 public.mizizi_consume_desk_resource_v1(uuid,text,text),public.mizizi_record_desk_resource_event_v1(uuid,text,text,text,jsonb) to service_role;
comment on table mizizi_private.desk_resource_reservations_v1 is 'Conservative resource precharge only; never grants outbound source or model disclosure authority. No automatic refund.';
commit;
