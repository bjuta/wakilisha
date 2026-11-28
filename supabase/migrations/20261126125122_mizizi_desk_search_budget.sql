-- Issue #1441, Slice 1. CLI 2.107.0 mint run 45823531611.
-- Private, disabled-by-absence budget and disclosure policy. No live account,
-- provider call, entitlement, model disclosure or owner approval is seeded.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
do $guard$
begin
 if current_user<>'postgres'
  or to_regprocedure('mizizi_private.read_leased_chart_research_context_v1(uuid,text)') is null
  or to_regclass('mizizi_private.desk_search_policy_versions_v1') is not null
  or to_regclass('mizizi_private.desk_search_reservations_v1') is not null
  or to_regprocedure('public.mizizi_authorize_desk_search_v1(text,text,text)') is not null
  or to_regprocedure('public.mizizi_reserve_desk_search_v1(text,text,text,text)') is not null
  or to_regprocedure('public.mizizi_consume_desk_search_v1(uuid,text,text)') is not null
  or has_schema_privilege('service_role','mizizi_private','USAGE')
  or has_schema_privilege('authenticated','mizizi_private','USAGE')
 then raise exception 'STOP_MIZIZI_DESK_SEARCH_PREIMAGE';end if;
end $guard$;

-- One provider-account authority across workspaces, not per worker. Policy
-- issuance is deliberately owner-only; an enabled policy requires independently
-- verified commercial terms, hard spending protection and exclusive allocated
-- usage across every environment/process using the credential. A DB allowance
-- alone cannot prove a provider bill is zero. No service or browser can issue
-- a policy. A future reviewed owner control path may append one.
create table mizizi_private.desk_search_policy_versions_v1(
 revision integer primary key check(revision>=1),
 enabled boolean not null default false,
 workspace_id uuid not null,
 account_fingerprint text not null check(account_fingerprint ~ '^[a-f0-9]{64}$'),
 entitlement_ref text not null check(length(btrim(entitlement_ref)) between 8 and 300),
 billing_safeguard_ref text not null check(length(btrim(billing_safeguard_ref)) between 8 and 300),
 disclosure_policy_ref text not null check(length(btrim(disclosure_policy_ref)) between 8 and 300),
 commercial_search_allowed boolean not null default false,
 zero_cost_hard_cap_verified boolean not null default false,
 exclusive_allocated_usage_verified boolean not null default false,
 public_chart_labels_allowed boolean not null default false,
 allowance_start timestamptz not null,
 allowance_end timestamptz not null,
 valid_until timestamptz not null,
 account_limit integer not null check(account_limit between 1 and 1000),
 daily_limit integer not null check(daily_limit between 1 and account_limit),
 case_limit integer not null check(case_limit between 1 and account_limit),
 recorded_at timestamptz not null default clock_timestamp(),
 check(allowance_end>allowance_start and allowance_end<=allowance_start+interval '32 days'),
 check(valid_until<=allowance_end),
 check(not enabled or (commercial_search_allowed and zero_cost_hard_cap_verified
   and exclusive_allocated_usage_verified and public_chart_labels_allowed))
);
alter table mizizi_private.desk_search_policy_versions_v1 enable row level security;
alter table mizizi_private.desk_search_policy_versions_v1 force row level security;
revoke all on mizizi_private.desk_search_policy_versions_v1 from public,anon,authenticated,service_role,mizizi_executor;

create table mizizi_private.desk_search_reservations_v1(
 id uuid primary key default gen_random_uuid(),
 policy_revision integer not null references mizizi_private.desk_search_policy_versions_v1(revision),
 request_sha256 text not null unique check(request_sha256 ~ '^[a-f0-9]{64}$'),
 job_id uuid not null,case_id uuid not null,workspace_id uuid not null,
 expected_revision integer not null check(expected_revision>=1),
 worker_id text not null check(worker_id ~ '^mizizi-chart:[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'),
 lease_expires_at timestamptz not null,
 membership_sha256 text not null check(membership_sha256 ~ '^[a-f0-9]{64}$'),
 observation_sha256 text not null check(observation_sha256 ~ '^[a-f0-9]{64}$'),
 operation text not null check(operation in ('search_web','search_news')),
 reserved_at timestamptz not null,
 valid_until timestamptz not null,
 consumed_at timestamptz,
 check(valid_until>reserved_at and valid_until<=lease_expires_at),
 check(consumed_at is null or (consumed_at>=reserved_at and consumed_at<valid_until))
);
create index mz_desk_search_reserved_at_idx on mizizi_private.desk_search_reservations_v1(reserved_at);
create index mz_desk_search_case_idx on mizizi_private.desk_search_reservations_v1(case_id);
alter table mizizi_private.desk_search_reservations_v1 enable row level security;
alter table mizizi_private.desk_search_reservations_v1 force row level security;
revoke all on mizizi_private.desk_search_reservations_v1 from public,anon,authenticated,service_role,mizizi_executor;

-- The advisory lock is a single fixed namespace, not an account/worker/case
-- argument. Policy issuance, reserve and consume share lock ordering.
create function mizizi_private.guard_desk_search_policy_v1()
returns trigger language plpgsql set search_path=pg_catalog as $policy$
declare prior mizizi_private.desk_search_policy_versions_v1%rowtype;
begin
 if tg_op<>'INSERT' then raise exception 'Desk search policy history immutable' using errcode='55000';end if;
 perform pg_advisory_xact_lock(214781521,61429);
 select * into prior from mizizi_private.desk_search_policy_versions_v1 order by revision desc limit 1;
 if new.revision<>coalesce(prior.revision,0)+1 then
  raise exception 'Desk search policy revision conflict' using errcode='PT409';end if;
 -- While the old provider period remains open, changing the account or
 -- shifting the window is forbidden. This prevents budget reset by renewal.
 if prior.revision is not null and (
   (prior.allowance_end>clock_timestamp() and
    (new.allowance_start<>prior.allowance_start or new.allowance_end<>prior.allowance_end
      or new.account_fingerprint<>prior.account_fingerprint))
   or (new.allowance_start<>prior.allowance_start and new.allowance_start<prior.allowance_end))
 then raise exception 'Desk search allowance period overlap or reset' using errcode='PT409';end if;
 new.recorded_at:=clock_timestamp();
 return new;
end $policy$;
create trigger mz_desk_search_policy_guard before insert or update or delete
 on mizizi_private.desk_search_policy_versions_v1 for each row
 execute function mizizi_private.guard_desk_search_policy_v1();

create function mizizi_private.guard_desk_search_reservation_v1()
returns trigger language plpgsql set search_path=pg_catalog as $journal$
begin
 if tg_op='DELETE' then raise exception 'Desk search reservation history immutable' using errcode='55000';end if;
 if old.consumed_at is not null or new.consumed_at is null
  or (to_jsonb(new)-'consumed_at') is distinct from (to_jsonb(old)-'consumed_at')
 then raise exception 'Desk search reservation mutation denied' using errcode='55000';end if;
 return new;
end $journal$;
create trigger mz_desk_search_reservation_guard before update or delete
 on mizizi_private.desk_search_reservations_v1 for each row
 execute function mizizi_private.guard_desk_search_reservation_v1();

-- Validate exact canonical request bytes and current scoped lease. For this
-- first transport, standing policy permits ONLY an exact public chart title
-- or title plus artist from the current receipt-bound position. No private
-- case notes, model-generated free text, IDs or arbitrary follow-up questions.
-- Site-wide/general research and model disclosure require later authority.
-- Do not persist query text or source excerpts.
create function mizizi_private.qualify_desk_search_request_v1(p_request_text text,p_request_sha256 text,p_account_fingerprint text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $qualify$
declare
 p mizizi_private.desk_search_policy_versions_v1%rowtype;
 req jsonb; scope jsonb; ctx jsonb; t timestamptz; until_at timestamptz;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service-role required' using errcode='42501';end if;
 if p_request_text is null or octet_length(p_request_text) not between 1 and 4096
  or p_request_sha256 is null or p_request_sha256 !~ '^[a-f0-9]{64}$'
  or p_account_fingerprint is null or p_account_fingerprint !~ '^[a-f0-9]{64}$'
  or encode(sha256(convert_to(p_request_text,'UTF8')),'hex')<>p_request_sha256
 then raise exception 'Invalid exact search digest' using errcode='22023';end if;
 req:=p_request_text::jsonb; scope:=req->'scope';
 if jsonb_typeof(req) is distinct from 'object' or jsonb_typeof(scope) is distinct from 'object'
 then raise exception 'Invalid search request' using errcode='22023';end if;
 if (select count(*) from jsonb_object_keys(req))<>4 or (select count(*) from jsonb_object_keys(scope))<>6
  or not (req ?& array['scope','operation','query','count'])
  or not (scope ?& array['jobId','caseId','workspaceId','expectedRevision','workerId','leaseExpiresAt'])
  or jsonb_typeof(req->'query') is distinct from 'string'
  or jsonb_typeof(req->'operation') is distinct from 'string'
  or jsonb_typeof(req->'count') is distinct from 'number'
  or jsonb_typeof(scope->'expectedRevision') is distinct from 'number'
  or coalesce(req->>'operation','') not in ('search_web','search_news')
  or length(req->>'query') not between 3 and 300 or btrim(req->>'query')<>req->>'query'
  or req->>'query' ~ '[[:cntrl:]]'
  or coalesce(req->>'count','') !~ '^([1-9]|10)$'
  or coalesce(scope->>'expectedRevision','') !~ '^[1-9][0-9]{0,8}$'
  or coalesce(scope->>'jobId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  or coalesce(scope->>'caseId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  or coalesce(scope->>'workspaceId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  or coalesce(scope->>'workerId','') !~ '^mizizi-chart:[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  or coalesce(scope->>'leaseExpiresAt','') !~ '^.{20,40}$'
 then raise exception 'Invalid search request scope' using errcode='22023';end if;
 perform pg_advisory_xact_lock(214781521,61429);
 select * into p from mizizi_private.desk_search_policy_versions_v1 order by revision desc limit 1;
 t:=clock_timestamp();
 if not found or not p.enabled or not p.commercial_search_allowed
  or not p.zero_cost_hard_cap_verified or not p.exclusive_allocated_usage_verified
  or not p.public_chart_labels_allowed or p.workspace_id::text<>scope->>'workspaceId'
  or p.account_fingerprint<>p_account_fingerprint
  or t<p.allowance_start or t>=p.allowance_end or t>=p.valid_until
 then return null;end if;
 ctx:=mizizi_private.read_leased_chart_research_context_v1((scope->>'jobId')::uuid,scope->>'workerId');
 if ctx->>'caseId' is distinct from scope->>'caseId'
  or ctx->>'workspaceId' is distinct from scope->>'workspaceId'
  or ctx->>'expectedRevision' is distinct from scope->>'expectedRevision'
  or (ctx->>'leaseExpiresAt')::timestamptz is distinct from (scope->>'leaseExpiresAt')::timestamptz
  or not exists(select 1 from jsonb_array_elements(ctx->'positions') v
    where req->>'query'=v->>'title'
     or (nullif(btrim(v->>'artist'),'') is not null and req->>'query'=(v->>'title')||' '||(v->>'artist')))
 then return null;end if;
 t:=clock_timestamp();
 until_at:=least(p.valid_until,p.allowance_end,(ctx->>'leaseExpiresAt')::timestamptz,
   (date_trunc('day',t at time zone 'UTC') at time zone 'UTC')+interval '1 day',t+interval '30 seconds');
 if until_at<=t then return null;end if;
 return jsonb_build_object('requestSha256',p_request_sha256,
  'policyRef','desk-search:brave:'||p.revision,'validUntil',until_at,
  'publicQueryAllowed',true,'providerUseAllowed',true,'zeroIncrementalSpendAllowed',true,
  'policyRevision',p.revision,'membershipSha256',ctx->>'membershipSha256',
  'observationSha256',ctx->>'observationSha256');
end $qualify$;

create function public.mizizi_authorize_desk_search_v1(p_request_text text,p_request_sha256 text,p_account_fingerprint text)
returns jsonb language sql security definer set search_path=pg_catalog as $authorize$
 select mizizi_private.qualify_desk_search_request_v1(p_request_text,p_request_sha256,p_account_fingerprint)
  - 'policyRevision' - 'membershipSha256' - 'observationSha256';
$authorize$;

create function public.mizizi_reserve_desk_search_v1(p_request_text text,p_request_sha256 text,p_policy_ref text,p_account_fingerprint text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $reserve$
declare a jsonb; s jsonb; p mizizi_private.desk_search_policy_versions_v1%rowtype;
 reservation mizizi_private.desk_search_reservations_v1%rowtype; t timestamptz; until_at timestamptz;
begin
 -- qualify retains the provider-wide xact lock through the insertion.
 a:=mizizi_private.qualify_desk_search_request_v1(p_request_text,p_request_sha256,p_account_fingerprint);
 if a is null or a->>'policyRef' is distinct from p_policy_ref then return null;end if;
 s:=p_request_text::jsonb->'scope';
 select * into strict p from mizizi_private.desk_search_policy_versions_v1 where revision=(a->>'policyRevision')::integer;
 t:=clock_timestamp(); until_at:=(a->>'validUntil')::timestamptz;
 if t>=until_at or exists(select 1 from mizizi_private.desk_search_reservations_v1 where request_sha256=p_request_sha256)
  or (select count(*) from mizizi_private.desk_search_reservations_v1 where reserved_at>=p.allowance_start and reserved_at<p.allowance_end)>=p.account_limit
  or (select count(*) from mizizi_private.desk_search_reservations_v1 where reserved_at>=(date_trunc('day',t at time zone 'UTC') at time zone 'UTC'))>=p.daily_limit
  or (select count(*) from mizizi_private.desk_search_reservations_v1 where case_id=(s->>'caseId')::uuid)>=p.case_limit
 then return null;end if;
 insert into mizizi_private.desk_search_reservations_v1(policy_revision,request_sha256,job_id,case_id,
  workspace_id,expected_revision,worker_id,lease_expires_at,membership_sha256,observation_sha256,
  operation,reserved_at,valid_until)
 values(p.revision,p_request_sha256,(s->>'jobId')::uuid,(s->>'caseId')::uuid,(s->>'workspaceId')::uuid,
  (s->>'expectedRevision')::integer,s->>'workerId',(s->>'leaseExpiresAt')::timestamptz,
  a->>'membershipSha256',a->>'observationSha256',p_request_text::jsonb->>'operation',t,until_at)
 returning * into reservation;
 return jsonb_build_object('reservationId',reservation.id,'requestSha256',reservation.request_sha256,
  'provider','brave','units',1,'maximumIncrementalCostMicrousd',0,'validUntil',reservation.valid_until);
end $reserve$;

create function public.mizizi_consume_desk_search_v1(p_reservation_id uuid,p_request_sha256 text,p_account_fingerprint text)
returns boolean language plpgsql security definer set search_path=pg_catalog as $consume$
declare p mizizi_private.desk_search_policy_versions_v1%rowtype;
 r mizizi_private.desk_search_reservations_v1%rowtype; ctx jsonb; t timestamptz;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service-role required' using errcode='42501';end if;
 if p_reservation_id is null or p_request_sha256 is null or p_request_sha256 !~ '^[a-f0-9]{64}$'
  or p_account_fingerprint is null or p_account_fingerprint !~ '^[a-f0-9]{64}$'
 then raise exception 'Invalid search reservation' using errcode='22023';end if;
 perform pg_advisory_xact_lock(214781521,61429);
 select * into r from mizizi_private.desk_search_reservations_v1
  where id=p_reservation_id and request_sha256=p_request_sha256 for update;
 if not found or r.consumed_at is not null or r.valid_until<=clock_timestamp() then return false;end if;
 select * into p from mizizi_private.desk_search_policy_versions_v1 order by revision desc limit 1;
 if not found or p.revision<>r.policy_revision or not p.enabled
  or not p.commercial_search_allowed or not p.zero_cost_hard_cap_verified
  or not p.exclusive_allocated_usage_verified or not p.public_chart_labels_allowed
  or p.workspace_id<>r.workspace_id or p.account_fingerprint<>p_account_fingerprint
  or p.valid_until<=clock_timestamp()
  or p.allowance_end<=clock_timestamp() then return false;end if;
 ctx:=mizizi_private.read_leased_chart_research_context_v1(r.job_id,r.worker_id);
 if ctx->>'caseId' is distinct from r.case_id::text or ctx->>'workspaceId' is distinct from r.workspace_id::text
  or ctx->>'expectedRevision' is distinct from r.expected_revision::text
  or (ctx->>'leaseExpiresAt')::timestamptz is distinct from r.lease_expires_at
  or ctx->>'membershipSha256' is distinct from r.membership_sha256
  or ctx->>'observationSha256' is distinct from r.observation_sha256 then return false;end if;
 t:=clock_timestamp();
 if t>=r.valid_until or t>=p.valid_until or t>=p.allowance_end then return false;end if;
 update mizizi_private.desk_search_reservations_v1 set consumed_at=t where id=r.id and consumed_at is null;
 return found;
end $consume$;

revoke all on function mizizi_private.guard_desk_search_policy_v1(),mizizi_private.guard_desk_search_reservation_v1(),
 mizizi_private.qualify_desk_search_request_v1(text,text,text) from public,anon,authenticated,service_role,mizizi_executor;
revoke all on function public.mizizi_authorize_desk_search_v1(text,text,text),
 public.mizizi_reserve_desk_search_v1(text,text,text,text),public.mizizi_consume_desk_search_v1(uuid,text,text)
 from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_authorize_desk_search_v1(text,text,text),
 public.mizizi_reserve_desk_search_v1(text,text,text,text),public.mizizi_consume_desk_search_v1(uuid,text,text) to service_role;
comment on table mizizi_private.desk_search_reservations_v1 is 'Conservative precharge: all reservations count, consumed or not; no refund, query text, credentials or source grant.';
commit;
