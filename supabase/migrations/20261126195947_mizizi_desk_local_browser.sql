-- Issue #1441. CLI 2.107.0 mint #45887710246 job 140142478343.
-- Local Chromium uses the existing resource and source receipt ledgers.
-- No host entitlement, account, source access, or enabled policy is seeded.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
do $guard$ begin
 if current_user<>'postgres' or to_regprocedure('public.mizizi_continue_desk_research_job_v1(jsonb,text)') is null
 or to_regprocedure('public.mizizi_read_desk_local_browser_session_v1(jsonb,uuid,text,text)') is not null
 then raise exception 'STOP_MIZIZI_LOCAL_BROWSER_PREIMAGE';end if;
end $guard$;
alter table mizizi_private.desk_resource_policy_versions_v1
 drop constraint desk_resource_policy_versions_v1_resource_check,
 add constraint desk_resource_policy_versions_v1_resource_check check(resource in ('anthropic','native_https','cloudflare_browser_run','local_chromium'));
create unique index mz_desk_local_browser_lease_once on mizizi_private.desk_resource_reservations_v1(job_id,lease_expires_at)
 where resource='local_chromium';
alter table mizizi_private.desk_operational_policy_versions_v1
 drop constraint desk_operational_policy_versions_v1_tool_names_check,
 add constraint desk_operational_policy_versions_v1_tool_names_check check(cardinality(tool_names) between 1 and 6);
alter table mizizi_private.desk_operational_call_proofs_v1
 drop constraint desk_operational_call_proofs_v1_operation_check,
 add constraint desk_operational_call_proofs_v1_operation_check check(operation in ('tool_execute','native_acquire','native_text','browser_request','browser_render','browser_text','browser_visual','pdf_visual'));
alter table mizizi_private.desk_tool_receipts_v1
 drop constraint desk_tool_receipts_v1_operation_check,
 add constraint desk_tool_receipts_v1_operation_check check(operation in ('search_web','search_news','read_page','read_document','render_page','inspect_visual','browse_page'));
alter table mizizi_private.desk_reference_leads_v1
 drop constraint desk_reference_leads_v1_kind_check,
 add constraint desk_reference_leads_v1_kind_check check(kind in ('reference','document','render','visual','browser_action'));

create or replace function mizizi_private.qualify_desk_resource_v1(p_binding_text text)
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
 coalesce(b->>'resource','') not in ('anthropic','native_https','cloudflare_browser_run','local_chromium') or
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
 if p.resource='local_chromium' and exists(select 1 from mizizi_private.desk_resource_reservations_v1 r
  where r.resource='local_chromium' and r.job_id=(s->>'jobId')::uuid and r.lease_expires_at=(s->>'leaseExpiresAt')::timestamptz)
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

-- Full 120s capacity is reserved, independently of source permissions.
-- The 30s reservation expiry is a send window, not session duration.
create function mizizi_private.desk_local_browser_active_v1(r mizizi_private.desk_resource_reservations_v1,s jsonb,sid text)
returns boolean language sql volatile security definer set search_path=pg_catalog as $f$
 select coalesce(r.resource='local_chromium' and r.units=120 and r.consumed_at is not null
  and r.job_id::text=s->>'jobId' and r.case_id::text=s->>'caseId' and r.workspace_id::text=s->>'workspaceId'
  and r.expected_revision::text=s->>'expectedRevision' and r.worker_id=s->>'workerId'
  and r.lease_expires_at=(s->>'leaseExpiresAt')::timestamptz and r.lease_expires_at>clock_timestamp()
  and r.consumed_at+interval '120 seconds'>clock_timestamp()
  and exists(select 1 from mizizi_private.desk_resource_policy_versions_v1 p
   where p.resource=r.resource and p.revision=r.policy_revision and p.enabled and p.zero_incremental_cost_verified
    and p.account_fingerprint=r.account_fingerprint and p.valid_until>clock_timestamp() and p.allowance_end>clock_timestamp()
    and not exists(select 1 from mizizi_private.desk_resource_policy_versions_v1 v where v.resource=p.resource and v.revision>p.revision))
  and exists(select 1 from mizizi_private.desk_resource_events_v1 e where e.reservation_id=r.id
   and e.state='opened' and e.detail->>'sessionId'=sid
   and not exists(select 1 from mizizi_private.desk_resource_events_v1 later where later.reservation_id=e.reservation_id and later.ordinal>e.ordinal)),false)
$f$;
create function public.mizizi_read_desk_local_browser_session_v1(p_scope jsonb,p_reservation_id uuid,p_request_sha256 text,p_session_id text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare c jsonb;r mizizi_private.desk_resource_reservations_v1;p mizizi_private.desk_resource_policy_versions_v1;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service-role required' using errcode='42501';end if;
 c:=mizizi_private.desk_custody_context_v1(p_scope);
 if c is null then return null;end if;
 select * into r from mizizi_private.desk_resource_reservations_v1 where id=p_reservation_id and request_sha256=p_request_sha256;
 if not found or not mizizi_private.desk_local_browser_active_v1(r,p_scope,p_session_id)
  or r.membership_sha256<>c->>'membershipSha256' or r.observation_sha256<>c->>'observationSha256' then return null;end if;
 select * into strict p from mizizi_private.desk_resource_policy_versions_v1 where resource=r.resource and revision=r.policy_revision;
 return jsonb_build_object('reservationId',r.id,'requestSha256',r.request_sha256,'sessionId',p_session_id,
  'scope',p_scope,'accountFingerprint',r.account_fingerprint,'validUntil',
  least(r.lease_expires_at,r.consumed_at+interval '120 seconds',p.valid_until,p.allowance_end),
  'resource','local_chromium');
end $f$;
-- Open receipt can be disclosed only in the current live session. Once
-- closed, evidence remains governed by current source and operational
-- policy; expiry of the capacity allocation alone does not erase evidence.
create function mizizi_private.desk_local_browser_receipt_available_v1(a mizizi_private.desk_tool_receipts_v1,c jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog as $f$
declare d jsonb:=a.provenance->'detail'->'localBrowser';r mizizi_private.desk_resource_reservations_v1;s jsonb;
begin
 select * into r from mizizi_private.desk_resource_reservations_v1 where id=(d->>'reservationId')::uuid
 and request_sha256=d->>'requestSha256' and resource='local_chromium' and consumed_at is not null
 and job_id=a.job_id and case_id=a.case_id and workspace_id=a.workspace_id
 and expected_revision=a.expected_revision and worker_id=a.worker_id and lease_expires_at=a.lease_expires_at;
 if not found or r.membership_sha256<>c->>'membershipSha256' or r.observation_sha256<>c->>'observationSha256' then return false;end if;
 if exists(select 1 from mizizi_private.desk_resource_events_v1 e where e.reservation_id=r.id
  and e.state='close_acknowledged' and e.detail->>'sessionId'=d->>'sessionId') then return true;end if;
 s:=jsonb_build_object('jobId',a.job_id,'caseId',a.case_id,'workspaceId',a.workspace_id,
  'expectedRevision',a.expected_revision,'workerId',a.worker_id,'leaseExpiresAt',a.lease_expires_at);
 return mizizi_private.desk_local_browser_active_v1(r,s,d->>'sessionId')
  and a.lease_expires_at=(c->>'leaseExpiresAt')::timestamptz;
end $f$;

create or replace function mizizi_private.guard_desk_operational_policy_v1()
returns trigger language plpgsql set search_path=pg_catalog as $guard$
declare prev integer;v text;rule jsonb;h text;prefix text;ops jsonb;
begin
 if tg_op<>'INSERT' then raise exception 'Desk operational policy immutable' using errcode='55000';end if;
 perform pg_advisory_xact_lock(214781521,61431);
 select max(revision) into prev from mizizi_private.desk_operational_policy_versions_v1
 where workspace_id=new.workspace_id and case_id=new.case_id;
 if new.revision<>coalesce(prev,0)+1 then raise exception 'Desk operational policy revision conflict' using errcode='PT409';end if;
 if new.enabled and new.valid_until<=clock_timestamp() then raise exception 'Expired operational policy' using errcode='22023';end if;
 foreach v in array new.model_ids loop
  if coalesce(v,'') !~ '^[A-Za-z0-9._:-]{3,100}$' then raise exception 'Invalid model' using errcode='22023';end if;
 end loop;
 foreach v in array new.question_sha256s loop
  if coalesce(v,'') !~ '^[0-9a-f]{64}$' then raise exception 'Invalid question digest' using errcode='22023';end if;
 end loop;
 if cardinality(new.public_query_terms)>32 or
  (select count(distinct entries.item) from unnest(new.public_query_terms) as entries(item))<>cardinality(new.public_query_terms)
  or (not new.adaptive_followups_allowed and cardinality(new.public_query_terms)>0)
 then raise exception 'Invalid public query vocabulary' using errcode='22023';end if;
 foreach v in array new.public_query_terms loop
  if v is null or length(v) not between 1 and 80 or btrim(v)<>v or v ~ '[[:cntrl:]]'
  then raise exception 'Invalid public query term' using errcode='22023';end if;
 end loop;
 foreach v in array new.tool_names loop
  if coalesce(v,'') not in ('search_web','search_news','read_page','read_document','browse_page','inspect_visual') then raise exception 'Unsupported operational tool' using errcode='22023';end if;
 end loop;
 if (select count(distinct entries.item) from unnest(new.model_ids) as entries(item))<>cardinality(new.model_ids)
 or (select count(distinct entries.item) from unnest(new.question_sha256s) as entries(item))<>cardinality(new.question_sha256s)
 or (select count(distinct entries.item) from unnest(new.tool_names) as entries(item))<>cardinality(new.tool_names)
 then raise exception 'Duplicate policy entries' using errcode='22023';end if;
 for rule in select value from jsonb_array_elements(new.access_rules) loop
  if jsonb_typeof(rule) is distinct from 'object' then raise exception 'Invalid source rule' using errcode='22023';end if;
  h:=rule->>'host';prefix:=rule->>'pathPrefix';ops:=rule->'operations';
  if (select count(*) from jsonb_object_keys(rule))<>4 or not(rule ?& array['host','pathPrefix','custodyRevision','operations'])
   or h is null or h='api.search.brave.com' or mizizi_private.desk_custody_url_host_v1('https://'||h||'/') is distinct from h
   or coalesce(prefix,'') !~ '^/[A-Za-z0-9_./~-]+/$' or length(prefix)>500
   or prefix like '%//%' or prefix ~ '/[.]{1,2}/'
   or coalesce(rule->>'custodyRevision','') !~ '^[1-9][0-9]{0,8}$'
   or jsonb_typeof(ops) is distinct from 'array' then raise exception 'Invalid source rule' using errcode='22023';end if;
  if jsonb_array_length(ops) not between 1 and 7
   or exists(select 1 from jsonb_array_elements(ops) x where x not in ('"native_acquire"'::jsonb,'"native_text"'::jsonb,'"browser_request"'::jsonb,'"browser_render"'::jsonb,'"browser_text"'::jsonb,'"browser_visual"'::jsonb,'"pdf_visual"'::jsonb))
   or (select count(distinct x) from jsonb_array_elements(ops) x)<>jsonb_array_length(ops)
   then raise exception 'Invalid source operation' using errcode='22023';end if;
  if not exists(select 1 from mizizi_private.desk_custody_policy_versions_v1 cp
   where cp.workspace_id=new.workspace_id and cp.host=h and cp.revision=(rule->>'custodyRevision')::integer)
   then raise exception 'Unknown source custody revision' using errcode='22023';end if;
 end loop;
 new.recorded_at:=clock_timestamp();return new;
end $guard$;

create or replace function mizizi_private.desk_operational_url_allowed_v1(
 p mizizi_private.desk_operational_policy_versions_v1,h text,u text,op text,rev integer)
returns boolean language sql stable set search_path=pg_catalog as $f$
 select coalesce(
 ((op in ('native_acquire','native_text','pdf_visual') and u ~ '^https://[a-z0-9.-]+/[A-Za-z0-9_./~-]*$')
 or (op in ('browser_request','browser_render','browser_text','browser_visual')
  and split_part(u,'?',1) ~ '^https://[a-z0-9.-]+/[A-Za-z0-9_./~%:-]*$'
  and split_part(u,'?',1) !~* '%(2e|2f|5c|25)'
  and mizizi_private.desk_custody_url_host_v1(u)=h))
 and split_part(u,'?',1) !~ '/[.]{1,2}(/|$)' and split_part(split_part(u,'?',1),'/',4)<>'' and
 exists(select 1 from jsonb_array_elements(p.access_rules) x
  where x->>'host'=h and x->>'custodyRevision'=rev::text and (x->'operations') ? op
  and left(u,length('https://'||h||(x->>'pathPrefix')))='https://'||h||(x->>'pathPrefix')),false)
$f$;

create or replace function public.mizizi_authorize_desk_access_v1(
 p_scope jsonb,p_operation text,p_binding_text text,p_binding_sha256 text
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $authorize$
declare c jsonb;b jsonb;d jsonb;u text;h text;urlhash text;
 p mizizi_private.desk_access_policy_versions_v1;
 custody mizizi_private.desk_custody_policy_versions_v1;
 expiry timestamptz;o mizizi_private.desk_operational_policy_versions_v1;callhash text;hophash text;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service-role required' using errcode='42501';end if;
 if p_binding_text is null or octet_length(p_binding_text) not between 1 and 8192
 or p_binding_sha256 is null or p_binding_sha256<>encode(sha256(convert_to(p_binding_text,'UTF8')),'hex')
 or coalesce(p_operation,'') not in ('native_acquire','native_text','browser_text','pdf_visual','browser_visual','browser_render','browser_request')
 then raise exception 'Invalid desk access binding' using errcode='22023';end if;
 b:=p_binding_text::jsonb;d:=b->'descriptor';u:=b->>'url';
 if jsonb_typeof(b) is distinct from 'object' or jsonb_typeof(d) is distinct from 'object'
 then raise exception 'Invalid desk access object' using errcode='22023';end if;
 if (select count(*) from jsonb_object_keys(b)) not between 2 and 4
 or exists(select 1 from jsonb_object_keys(b) k where k not in ('url','descriptor','callSha256','hopSha256'))
 or not(b ?& array['url','descriptor']) or jsonb_typeof(b->'url') is distinct from 'string'
 or (b ? 'callSha256' and coalesce(b->>'callSha256','') !~ '^[0-9a-f]{64}$')
 or (b ? 'hopSha256' and (p_operation not in ('native_acquire','browser_request') or not(b ? 'callSha256') or coalesce(b->>'hopSha256','') !~ '^[0-9a-f]{64}$'))
 then raise exception 'Invalid desk access shape' using errcode='22023';end if;
 callhash:=b->>'callSha256';hophash:=b->>'hopSha256';
 h:=mizizi_private.desk_custody_url_host_v1(u);
 if h is null or h='api.search.brave.com' then return null;end if;
 if p_operation='native_acquire' and d<>'{}'::jsonb then return null;end if;
 if p_operation in ('native_text','browser_text','pdf_visual','browser_visual') and
  (d->>'finalUrl' is distinct from u or coalesce(d->>'sha256','') !~ '^[0-9a-f]{64}$') then return null;end if;
 if p_operation='native_text' and d->>'representation' is distinct from 'native_response_bytes' then return null;end if;
 if p_operation='browser_text' and d->>'representation' is distinct from 'rendered_dom_not_original_response' then return null;end if;
 if p_operation in ('pdf_visual','browser_visual') and d->>'mode' is distinct from p_operation then return null;end if;
 if p_operation='browser_render' and (d->>'url' is distinct from u or jsonb_typeof(d->'visual') is distinct from 'boolean') then return null;end if;
 if p_operation='browser_request' and (d->>'url' is distinct from u or coalesce(d->>'resourceType','') not in ('document','stylesheet','image','font','script','xhr','fetch','other','media','manifest','texttrack','eventsource')) then return null;end if;
 urlhash:=encode(sha256(convert_to(u,'UTF8')),'hex');
 perform pg_advisory_xact_lock(214781521,61431);
 c:=mizizi_private.desk_custody_context_v1(p_scope);
 if c is null then return null;end if;
 custody:=mizizi_private.current_desk_custody_policy_v1((c->>'workspaceId')::uuid,h);
 if not mizizi_private.desk_custody_policy_live_v1(custody) or custody.source_family<>'public_web' then return null;end if;
 if p_operation in ('browser_text','browser_visual','browser_render','browser_request') and not custody.browser_render_allowed then return null;end if;
 if (p_operation in ('pdf_visual','browser_visual') or (p_operation='browser_render' and d->'visual'='true'::jsonb))
 and (not custody.visual_processing_allowed or not custody.excerpt_retention_allowed) then return null;end if;
 select * into p from mizizi_private.desk_access_policy_versions_v1
 where workspace_id=(c->>'workspaceId')::uuid and host=h and url_sha256=urlhash and operation=p_operation
 order by revision desc limit 1;
 o:=mizizi_private.current_desk_operational_policy_v1(c);
 if (p.revision is null and o.revision is null)
 or (p.revision is not null and (not p.enabled or p.custody_revision is distinct from custody.revision)) then return null;end if;
 if o.revision is not null then
  if not mizizi_private.desk_operational_policy_live_v1(o,c)
   or not mizizi_private.desk_operational_url_allowed_v1(o,h,u,p_operation,custody.revision)
   or callhash is null or not exists(select 1 from mizizi_private.desk_operational_call_proofs_v1 q
    where q.job_id=(p_scope->>'jobId')::uuid and q.lease_expires_at=(p_scope->>'leaseExpiresAt')::timestamptz
    and q.call_sha256=callhash and q.operation='tool_execute' and q.standing_revision=o.revision
    and q.valid_until>clock_timestamp()) then return null;end if;
  if p_operation='native_text' and (coalesce(d->>'pageStart','') !~ '^[1-9][0-9]{0,4}$'
   or coalesce(d->>'pageEnd','') !~ '^[1-9][0-9]{0,4}$') then return null;end if;
 end if;
 expiry:=least(p.valid_until,o.valid_until,custody.valid_until,(c->>'leaseExpiresAt')::timestamptz);
 if expiry<=clock_timestamp() then return null;end if;
 if o.revision is not null then
  insert into mizizi_private.desk_operational_call_proofs_v1(job_id,case_id,workspace_id,worker_id,lease_expires_at,
   call_sha256,operation,binding_sha256,standing_revision,host,url_sha256,custody_revision,exact_revision,
   hop_sha256,source_sha256,page_start,page_end,valid_until)
  values((p_scope->>'jobId')::uuid,(c->>'caseId')::uuid,(c->>'workspaceId')::uuid,p_scope->>'workerId',
   (p_scope->>'leaseExpiresAt')::timestamptz,callhash,p_operation,p_binding_sha256,o.revision,h,urlhash,custody.revision,p.revision,
   hophash,d->>'sha256',case when p_operation='native_text' then (d->>'pageStart')::integer end,
   case when p_operation='native_text' then (d->>'pageEnd')::integer end,expiry)
  on conflict do nothing;
  if not exists(select 1 from mizizi_private.desk_operational_call_proofs_v1 q where q.job_id=(p_scope->>'jobId')::uuid
   and q.lease_expires_at=(p_scope->>'leaseExpiresAt')::timestamptz and q.operation=p_operation
   and q.binding_sha256=p_binding_sha256 and q.standing_revision=o.revision and q.exact_revision is not distinct from p.revision
   and q.valid_until>clock_timestamp()) then return null;end if;
 end if;
 return jsonb_build_object('operation',p_operation,'bindingSha256',p_binding_sha256,'urlSha256',urlhash,
  'policyRef','desk-access:'||urlhash||':'||p_operation||':'||coalesce(p.revision,0)::text||':'||custody.revision::text||
   case when o.revision is null then '' else ':standing:'||o.revision::text end,
  'validUntil',expiry,'allowed',true);
end $authorize$;

create or replace function mizizi_private.desk_operational_receipt_current_v1(r mizizi_private.desk_tool_receipts_v1,c jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog as $f$
declare o mizizi_private.desk_operational_policy_versions_v1;g mizizi_private.desk_operational_call_proofs_v1;
 p mizizi_private.desk_access_policy_versions_v1;cp mizizi_private.desk_custody_policy_versions_v1;
 mp mizizi_private.desk_model_authority_versions_v1;
begin
 o:=mizizi_private.current_desk_operational_policy_v1(c);
 if o.revision is null then return r.operational_revision is null;end if;
 if not mizizi_private.desk_operational_policy_live_v1(o,c)
 or r.operational_revision is distinct from o.revision or not(r.operation=any(o.tool_names)) then return false;end if;
 select * into g from mizizi_private.desk_operational_call_proofs_v1 q
  where q.job_id=r.job_id and q.lease_expires_at=r.lease_expires_at and q.call_sha256=r.call_sha256
  and q.operation='tool_execute' and q.binding_sha256=r.call_sha256 and q.standing_revision=o.revision;
 if not found then return false;end if;
 select * into mp from mizizi_private.desk_model_authority_versions_v1
  where workspace_id=r.workspace_id and case_id=r.case_id and operation='tool_execute' and binding_sha256=r.call_sha256
  order by revision desc limit 1;
 if mp.revision is distinct from g.exact_revision or (mp.revision is not null and
  (not mp.enabled or mp.valid_until<=clock_timestamp())) then return false;end if;
 for g in select * from mizizi_private.desk_operational_call_proofs_v1 q
  where q.job_id=r.job_id and q.lease_expires_at=r.lease_expires_at and q.call_sha256=r.call_sha256
   and q.operation in ('native_acquire','native_text','browser_render','browser_request','browser_text','browser_visual','pdf_visual') loop
  cp:=mizizi_private.current_desk_custody_policy_v1(r.workspace_id,g.host);
  if g.standing_revision is distinct from o.revision or not mizizi_private.desk_custody_policy_live_v1(cp)
   or cp.revision is distinct from g.custody_revision then return false;end if;
  select * into p from mizizi_private.desk_access_policy_versions_v1
   where workspace_id=r.workspace_id and host=g.host and url_sha256=g.url_sha256 and operation=g.operation
   order by revision desc limit 1;
  if p.revision is distinct from g.exact_revision
   or (p.revision is not null and (not p.enabled or p.custody_revision is distinct from cp.revision or p.valid_until<=clock_timestamp()))
   then return false;end if;
 end loop;
 return true;
end $f$;

create or replace function mizizi_private.desk_custody_receipt_current_v1(r mizizi_private.desk_tool_receipts_v1,c jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog as $current$
declare p mizizi_private.desk_custody_policy_versions_v1;
 ancestor mizizi_private.desk_tool_receipts_v1:=r;depth integer:=0;
begin
 loop
  depth:=depth+1;
  if depth>200 or ancestor.id is null or c is null or ancestor.case_id::text is distinct from c->>'caseId'
   or ancestor.workspace_id::text is distinct from c->>'workspaceId'
   or ancestor.membership_sha256 is distinct from c->>'membershipSha256'
   or ancestor.observation_sha256 is distinct from c->>'observationSha256' then return false;end if;
  if not mizizi_private.desk_operational_receipt_current_v1(ancestor,c) then return false;end if;
  p:=mizizi_private.current_desk_custody_policy_v1(ancestor.workspace_id,ancestor.host);
  if not mizizi_private.desk_custody_policy_live_v1(p) or p.revision is distinct from ancestor.policy_revision
   or (ancestor.source_id is not null and not p.excerpt_retention_allowed)
   or (ancestor.operation in ('render_page','browse_page') and not p.browser_render_allowed)
   or (ancestor.provenance->'detail' ? 'localBrowser' and (not p.browser_render_allowed or not mizizi_private.desk_local_browser_receipt_available_v1(ancestor,c)))
   or (ancestor.operation='inspect_visual' and not p.visual_processing_allowed)
   or (ancestor.operation='render_page' and ancestor.provenance->'detail'->'visual'<>'null'::jsonb and not p.visual_processing_allowed)
   then return false;end if;
  if ancestor.parent_receipt_id is null then return true;end if;
  select * into ancestor from mizizi_private.desk_tool_receipts_v1 where id=ancestor.parent_receipt_id;
 end loop;
end $current$;

create or replace function public.mizizi_authorize_desk_model_operation_v1(
 p_scope jsonb,p_operation text,p_binding_text text,p_binding_sha256 text
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $authorize$
declare c jsonb;b jsonb;t jsonb;i jsonb;op text;item jsonb;rid uuid;sid uuid;
 p mizizi_private.desk_model_authority_versions_v1;
 r mizizi_private.desk_tool_receipts_v1;l mizizi_private.desk_reference_leads_v1;
 receipt_ids uuid[]:=array[]::uuid[];source_ids uuid[]:=array[]::uuid[];seen_sources uuid[]:=array[]::uuid[];
 expiry timestamptz;receipt_expiry timestamptz;o mizizi_private.desk_operational_policy_versions_v1;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service-role required' using errcode='42501';end if;
 if coalesce(p_operation,'') not in ('model_disclose','tool_execute')
 or p_binding_text is null or octet_length(p_binding_text) not between 1 and 16384
 or p_binding_sha256 is null or p_binding_sha256<>encode(sha256(convert_to(p_binding_text,'UTF8')),'hex')
 then raise exception 'Invalid desk model binding' using errcode='22023';end if;
 b:=p_binding_text::jsonb;
 if jsonb_typeof(b) is distinct from 'object' or b->'scope' is distinct from p_scope then return null;end if;
 perform pg_advisory_xact_lock(214781521,61431);
 c:=mizizi_private.desk_custody_context_v1(p_scope);
 if c is null then return null;end if;
 select * into p from mizizi_private.desk_model_authority_versions_v1
 where workspace_id=(c->>'workspaceId')::uuid and case_id=(c->>'caseId')::uuid
 and operation=p_operation and binding_sha256=p_binding_sha256
 order by revision desc limit 1;
 o:=mizizi_private.current_desk_operational_policy_v1(c);
 if (p.revision is null and o.revision is null) or (p.revision is not null and not p.enabled) then return null;end if;
 if o.revision is not null and not mizizi_private.desk_operational_policy_live_v1(o,c) then return null;end if;
 expiry:=least(p.valid_until,o.valid_until,(c->>'leaseExpiresAt')::timestamptz);
 if expiry<=clock_timestamp() then return null;end if;
 if p_operation='model_disclose' then
  if (select count(*) from jsonb_object_keys(b))<>11
   or not(b ?& array['scope','questionSha256','model','round','requestSha256','bodySha256','credentialSha256','requestBytes','maxOutputTokens','sourceIds','toolReceipts'])
   or coalesce(b->>'questionSha256','') !~ '^[0-9a-f]{64}$'
   or coalesce(b->>'requestSha256','') !~ '^[0-9a-f]{64}$'
   or coalesce(b->>'bodySha256','') !~ '^[0-9a-f]{64}$'
   or coalesce(b->>'credentialSha256','') !~ '^[0-9a-f]{64}$'
   or coalesce(b->>'model','') !~ '^[A-Za-z0-9._:-]{3,100}$'
   or jsonb_typeof(b->'round') is distinct from 'number' or coalesce(b->>'round','') !~ '^[1-5]$'
   or jsonb_typeof(b->'requestBytes') is distinct from 'number' or coalesce(b->>'requestBytes','') !~ '^[1-9][0-9]{0,6}$'
   or b->'maxOutputTokens' is distinct from '2500'::jsonb
   or jsonb_typeof(b->'sourceIds') is distinct from 'array'
   or jsonb_typeof(b->'toolReceipts') is distinct from 'array' then return null;end if;
  if (b->>'requestBytes')::integer>3200000 or jsonb_array_length(b->'sourceIds')>12
   or jsonb_array_length(b->'toolReceipts')<>(b->>'round')::integer-1 then return null;end if;
  if o.revision is not null and (not(b->>'model'=any(o.model_ids)) or b->>'credentialSha256' is distinct from o.credential_sha256
   or not mizizi_private.desk_research_question_allowed_v1(o,c,b->>'questionSha256') or (b->>'round')::integer>o.max_rounds
   or (b->>'requestBytes')::integer>o.max_request_bytes) then return null;end if;
  for item in select value from jsonb_array_elements(b->'toolReceipts') loop
   if jsonb_typeof(item) is distinct from 'object' then return null;end if;
   if (select count(*) from jsonb_object_keys(item))<>3
    or coalesce(item->>'receiptId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
    or coalesce(item->>'callSha256','') !~ '^[0-9a-f]{64}$'
    or coalesce(item->>'resultSha256','') !~ '^[0-9a-f]{64}$' then return null;end if;
   rid:=(item->>'receiptId')::uuid;
   if rid=any(receipt_ids) then return null;end if;
   select * into r from mizizi_private.desk_tool_receipts_v1 where id=rid;
   if not found or r.call_sha256 is distinct from item->>'callSha256'
    or r.result_sha256 is distinct from item->>'resultSha256'
    or r.job_id::text is distinct from p_scope->>'jobId'
    or r.worker_id is distinct from p_scope->>'workerId'
    or r.lease_expires_at is distinct from (p_scope->>'leaseExpiresAt')::timestamptz
    or not coalesce(mizizi_private.desk_custody_receipt_current_v1(r,c),false) then return null;end if;
   receipt_ids:=array_append(receipt_ids,rid);
   if r.source_id is not null then source_ids:=array_append(source_ids,r.source_id);end if;
  end loop;
  for item in select value from jsonb_array_elements(b->'sourceIds') loop
   if jsonb_typeof(item) is distinct from 'string' or coalesce(item#>>'{}','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then return null;end if;
   sid:=(item#>>'{}')::uuid;
   if sid=any(seen_sources) or not(sid=any(source_ids)) then return null;end if;
   seen_sources:=array_append(seen_sources,sid);
  end loop;
  if cardinality(seen_sources)<>cardinality(source_ids) then return null;end if;
 else
  t:=b->'call';i:=t->'input';op:=t->>'name';
  if (select count(*) from jsonb_object_keys(b))<>2 or jsonb_typeof(t) is distinct from 'object'
   or jsonb_typeof(i) is distinct from 'object' then return null;end if;
  if (select count(*) from jsonb_object_keys(t))<>2
   or coalesce(op,'') not in ('search_web','search_news','read_page','read_document','render_page','inspect_visual','browse_page') then return null;end if;
  if (o.revision is not null and not(op=any(o.tool_names))) or (op='browse_page' and o.revision is null) then return null;end if;
  if op in ('search_web','search_news') then
   if (select count(*) from jsonb_object_keys(i))<>1 or jsonb_typeof(i->'query') is distinct from 'string'
    or length(btrim(i->>'query')) not between 3 and 300 then return null;end if;
   if o.revision is not null and not mizizi_private.desk_public_research_query_allowed_v1(c,i->>'query') then return null;end if;
  else
   if coalesce(i->>'lead_id','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then return null;end if;
   select * into l from mizizi_private.desk_reference_leads_v1 where id=(i->>'lead_id')::uuid;
   if not found then return null;end if;
   if (op='read_page' and l.kind<>'reference') or (op='render_page' and l.kind<>'render')
    or (op='read_document' and l.kind<>'document') or (op='inspect_visual' and l.kind not in ('document','visual'))
    or (op='browse_page' and l.kind not in ('reference','browser_action')) then return null;end if;
   if op='browse_page' then
    if (select count(*) from jsonb_object_keys(i))<>2 or jsonb_typeof(i->'query') is distinct from 'string'
     or (l.kind='reference' and i->>'query'<>'')
     or (i->>'query'<>'' and not mizizi_private.desk_public_research_query_allowed_v1(c,i->>'query')) then return null;end if;
   elsif op='read_document' then
    if (select count(*) from jsonb_object_keys(i))<>3
     or jsonb_typeof(i->'page_start') is distinct from 'number' or jsonb_typeof(i->'page_end') is distinct from 'number'
     or coalesce(i->>'page_start','') !~ '^[1-9][0-9]{0,4}$' or coalesce(i->>'page_end','') !~ '^[1-9][0-9]{0,4}$' then return null;end if;
    if (i->>'page_end')::integer>10000 or (i->>'page_end')::integer-(i->>'page_start')::integer not between 0 and 9 then return null;end if;
   elsif op='inspect_visual' then
    if (select count(*) from jsonb_object_keys(i))<>2 or jsonb_typeof(i->'page') is distinct from 'number'
     or coalesce(i->>'page','') !~ '^[1-9][0-9]{0,4}$' then return null;end if;
    if (i->>'page')::integer>10000 then return null;end if;
   elsif (select count(*) from jsonb_object_keys(i))<>1 then return null;end if;
   select * into r from mizizi_private.desk_tool_receipts_v1 where id=l.receipt_id;
   if not found or r.job_id::text is distinct from p_scope->>'jobId'
    or r.worker_id is distinct from p_scope->>'workerId'
    or r.lease_expires_at is distinct from (p_scope->>'leaseExpiresAt')::timestamptz
    or not coalesce(mizizi_private.desk_custody_receipt_current_v1(r,c),false) then return null;end if;
   if l.kind='browser_action' or (l.kind='visual' and r.provenance->'detail' ? 'localBrowser') then
    if not (r.provenance->'detail' ? 'localBrowser') or o.revision is null
     or not exists(select 1 from jsonb_array_elements(r.provenance->'detail'->'actionBindings') v
      where v->>'id'=l.id::text and
       ((op='browse_page' and ((v->>'action'='search' and i->>'query'<>'') or
          (v->>'action' in ('expand','follow','scroll_down') and i->>'query'='')))
        or (op='inspect_visual' and v->>'action'='visual' and i->>'page'='1')))
    then return null;end if;
   end if;
   receipt_ids:=array_append(receipt_ids,r.id);
  end if;
 end if;
 -- Clamp to every referenced custody ancestor's permission expiry.
 foreach rid in array receipt_ids loop
  with recursive chain as (
   select id,parent_receipt_id,workspace_id,host,policy_revision,1 as depth
   from mizizi_private.desk_tool_receipts_v1 where id=rid
   union all select d.id,d.parent_receipt_id,d.workspace_id,d.host,d.policy_revision,chain.depth+1
   from chain join mizizi_private.desk_tool_receipts_v1 d on d.id=chain.parent_receipt_id
   where chain.depth<200
  )
  select min(cp.valid_until) into receipt_expiry from chain
  join mizizi_private.desk_custody_policy_versions_v1 cp on cp.workspace_id=chain.workspace_id
   and cp.host=chain.host and cp.revision=chain.policy_revision;
  if receipt_expiry is null then return null;end if;
  expiry:=least(expiry,receipt_expiry);
 end loop;
 if expiry<=clock_timestamp() then return null;end if;
 if o.revision is not null and p_operation='tool_execute' then
  insert into mizizi_private.desk_operational_call_proofs_v1(job_id,case_id,workspace_id,worker_id,lease_expires_at,
   call_sha256,operation,binding_sha256,standing_revision,exact_revision,valid_until)
  values((p_scope->>'jobId')::uuid,(c->>'caseId')::uuid,(c->>'workspaceId')::uuid,p_scope->>'workerId',
   (p_scope->>'leaseExpiresAt')::timestamptz,p_binding_sha256,p_operation,p_binding_sha256,o.revision,p.revision,expiry)
  on conflict do nothing;
  if not exists(select 1 from mizizi_private.desk_operational_call_proofs_v1 q where q.job_id=(p_scope->>'jobId')::uuid
   and q.lease_expires_at=(p_scope->>'leaseExpiresAt')::timestamptz and q.operation=p_operation
   and q.binding_sha256=p_binding_sha256 and q.standing_revision=o.revision and q.exact_revision is not distinct from p.revision
   and q.valid_until>clock_timestamp()) then return null;end if;
 end if;
 return jsonb_build_object('operation',p_operation,'bindingSha256',p_binding_sha256,
  'policyRef','desk-model:'||p_binding_sha256||':'||coalesce(p.revision,0)::text||
   case when o.revision is null then '' else ':standing:'||o.revision::text end,'validUntil',expiry,'allowed',true);
end $authorize$;

create or replace function public.mizizi_record_desk_tool_receipt_v1(
 p_call_text text,p_call_sha256 text,p_result_text text,p_result_sha256 text,
 p_host text,p_policy_revision integer,p_provenance jsonb,p_lead_bindings jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $append$
declare x jsonb;s jsonb;call_body jsonb;result jsonb;c jsonb;
 p mizizi_private.desk_custody_policy_versions_v1;
 r mizizi_private.desk_tool_receipts_v1;previous mizizi_private.desk_tool_receipts_v1;
 rid uuid;op text;lead jsonb;binding jsonb;src jsonb;authsrc jsonb;
 parent_lead mizizi_private.desk_reference_leads_v1;parent_receipt mizizi_private.desk_tool_receipts_v1;
 source_id uuid;search_r mizizi_private.desk_search_reservations_v1;
 native_r mizizi_private.desk_resource_reservations_v1;hop text;observed timestamptz;
 parent_id uuid; detail jsonb; browser_request jsonb; visual jsonb; page_start integer;page_end integer;
 clean_provenance jsonb;o mizizi_private.desk_operational_policy_versions_v1;hop_index integer;final_hash text;local_meta jsonb;local_action text;local_res mizizi_private.desk_resource_reservations_v1;parent_action jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service-role required' using errcode='42501';end if;
 if p_call_text is null or octet_length(p_call_text) not between 1 and 4096
 or p_result_text is null or octet_length(p_result_text) not between 1 and 30000
 or p_call_sha256 is null or p_call_sha256<>encode(sha256(convert_to(p_call_text,'UTF8')),'hex')
 or p_result_sha256 is null or p_result_sha256<>encode(sha256(convert_to(p_result_text,'UTF8')),'hex')
 or jsonb_typeof(p_provenance) is distinct from 'object' or octet_length(p_provenance::text)>10000
 or jsonb_typeof(p_lead_bindings) is distinct from 'array' or jsonb_array_length(p_lead_bindings)>20
 then raise exception 'Invalid custody bytes' using errcode='22023';end if;
 x:=p_call_text::jsonb;s:=x->'scope';call_body:=x->'call';result:=p_result_text::jsonb;op:=call_body->>'name';
 if jsonb_typeof(x) is distinct from 'object' or jsonb_typeof(call_body) is distinct from 'object'
 or jsonb_typeof(result) is distinct from 'object' or coalesce(op,'') not in ('search_web','search_news','read_page','read_document','render_page','inspect_visual','browse_page')
 or jsonb_typeof(call_body->'input') is distinct from 'object'
 or (select count(*) from jsonb_object_keys(x))<>2 or (select count(*) from jsonb_object_keys(call_body))<>2
 or (select count(*) from jsonb_object_keys(call_body->'input'))<>(case op when 'read_document' then 3 when 'inspect_visual' then 2 when 'browse_page' then 2 else 1 end)
 or (select count(*) from jsonb_object_keys(result))<>4
 or not(result ?& array['receiptId','leads','sources','visual'])
 or (op<>'inspect_visual' and result->'visual'<>'null'::jsonb)
 or (op='inspect_visual' and jsonb_typeof(result->'visual') is distinct from 'object')
 or coalesce(result->>'receiptId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 or jsonb_typeof(result->'leads') is distinct from 'array' or jsonb_array_length(result->'leads')<>jsonb_array_length(p_lead_bindings)
 or jsonb_typeof(result->'sources') is distinct from 'array' or jsonb_array_length(result->'sources')>1
 then raise exception 'Invalid custody projection' using errcode='22023';end if;
 rid:=(result->>'receiptId')::uuid;
 clean_provenance:=p_provenance-'requestText';
 if op='render_page' then clean_provenance:=clean_provenance #- '{detail,requestText}';end if;
 perform pg_advisory_xact_lock(214781521,61431);
 c:=mizizi_private.desk_custody_context_v1(s);
 if c is null then return null;end if;
 p:=mizizi_private.current_desk_custody_policy_v1((s->>'workspaceId')::uuid,p_host);
 if not mizizi_private.desk_custody_policy_live_v1(p) or p.revision is distinct from p_policy_revision then return null;end if;
 o:=mizizi_private.current_desk_operational_policy_v1(c);
 if o.revision is not null and (not mizizi_private.desk_operational_policy_live_v1(o,c) or not(op=any(o.tool_names))
 or not exists(select 1 from mizizi_private.desk_operational_call_proofs_v1 q where q.job_id=(s->>'jobId')::uuid
  and q.lease_expires_at=(s->>'leaseExpiresAt')::timestamptz and q.call_sha256=p_call_sha256 and q.operation='tool_execute'
  and q.standing_revision=o.revision and q.valid_until>clock_timestamp())) then return null;end if;
 -- Do not silently reuse a historical receipt for another call or policy.
 select * into previous from mizizi_private.desk_tool_receipts_v1
 where job_id=(s->>'jobId')::uuid and lease_expires_at=(s->>'leaseExpiresAt')::timestamptz and call_sha256=p_call_sha256;
 if found then
  if previous.id=rid and previous.result_sha256=p_result_sha256 and previous.result_text=p_result_text
   and previous.host=p_host and previous.policy_revision=p_policy_revision and previous.provenance=clean_provenance
   and (select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'url',l.url) order by l.id),'[]'::jsonb)
     from mizizi_private.desk_reference_leads_v1 l where l.receipt_id=rid)=
    (select coalesce(jsonb_agg(v order by v->>'id'),'[]'::jsonb) from jsonb_array_elements(p_lead_bindings) v)
   and mizizi_private.desk_custody_receipt_current_v1(previous,c)
  then return jsonb_build_object('receiptId',rid,'resultSha256',p_result_sha256,'outcome','replayed');end if;
  raise exception 'Desk receipt replay conflict' using errcode='PT409';
 end if;
 if (select count(*) from mizizi_private.desk_tool_receipts_v1 where case_id=(s->>'caseId')::uuid)>=200
 then return null;end if;
 if op in ('search_web','search_news') then
  if (case when p_host='api.search.brave.com' then p.source_family<>'brave_discovery' else p.source_family<>'public_web' end)
   or jsonb_array_length(result->'sources')<>0
   or not(call_body->'input' ? 'query') or jsonb_typeof(call_body->'input'->'query') is distinct from 'string'
   or length(call_body->'input'->>'query') not between 3 and 300
   or not(p_provenance ?& array['reservationId','requestSha256','requestText'])
   or (select count(*) from jsonb_object_keys(p_provenance))<>3
   or octet_length(p_provenance->>'requestText') not between 1 and 4096
   or encode(sha256(convert_to(p_provenance->>'requestText','UTF8')),'hex') is distinct from p_provenance->>'requestSha256'
   or (p_provenance->>'requestText')::jsonb->'scope' is distinct from s
   or (p_provenance->>'requestText')::jsonb->>'operation' is distinct from op
   or (p_provenance->>'requestText')::jsonb->>'query' is distinct from call_body->'input'->>'query'
   or coalesce(p_provenance->>'reservationId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  then return null;end if;
  select * into search_r from mizizi_private.desk_search_reservations_v1
   where id=(p_provenance->>'reservationId')::uuid and request_sha256=p_provenance->>'requestSha256'
    and job_id=(s->>'jobId')::uuid and case_id=(s->>'caseId')::uuid and workspace_id=(s->>'workspaceId')::uuid
    and worker_id=s->>'workerId' and lease_expires_at=(s->>'leaseExpiresAt')::timestamptz
    and expected_revision=(s->>'expectedRevision')::integer and operation=op and consumed_at is not null;
  if not found or search_r.membership_sha256<>c->>'membershipSha256' or search_r.observation_sha256<>c->>'observationSha256'
   or not exists(select 1 from mizizi_private.desk_search_policy_versions_v1 v
    where v.revision=search_r.policy_revision and v.provider_host=p_host
    and ((v.provider='brave' and not((p_provenance->>'requestText')::jsonb ? 'provider')
     and not((p_provenance->>'requestText')::jsonb ? 'providerHost'))
     or (v.provider<>'brave' and v.provider=(p_provenance->>'requestText')::jsonb->>'provider'
      and v.provider_host=(p_provenance->>'requestText')::jsonb->>'providerHost')))
  then return null;end if;
 elsif op='read_page' then
  if p.source_family<>'public_web' or not(call_body->'input' ? 'lead_id')
   or coalesce(call_body->'input'->>'lead_id','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or not(p_provenance ?& array['requestedUrl','finalUrl','sourceSha256','projectionSha256','contentType','retrievedAt','byteLength','hopSha256','locator'])
   or ((select count(*) from jsonb_object_keys(p_provenance))<>9 and
    ((select count(*) from jsonb_object_keys(p_provenance))<>11 or not(p_provenance ?& array['documentPages','renderRequired'])))
   or (p_provenance ? 'documentPages' and p_provenance->'documentPages'<>'null'::jsonb and
    (coalesce(p_provenance->>'documentPages','') !~ '^[1-9][0-9]{0,4}$' or (p_provenance->>'documentPages')::integer>10000 or p_provenance->>'contentType'<>'application/pdf'))
   or (p_provenance ? 'renderRequired' and (jsonb_typeof(p_provenance->'renderRequired')<>'boolean'
    or (p_provenance->'renderRequired'='true'::jsonb and (p_provenance->>'contentType' not in ('text/html','application/xhtml+xml') or p_provenance->>'locator'<>'no_text'))))
   or mizizi_private.desk_custody_url_host_v1(p_provenance->>'finalUrl') is distinct from p.host
   or coalesce(p_provenance->>'sourceSha256','') !~ '^[0-9a-f]{64}$'
   or coalesce(p_provenance->>'projectionSha256','') !~ '^[0-9a-f]{64}$'
   or coalesce(p_provenance->>'contentType','') not in ('text/html','application/xhtml+xml','text/plain','application/pdf')
   or coalesce(p_provenance->>'byteLength','') !~ '^[1-9][0-9]{0,6}$'
   or (p_provenance->>'byteLength')::integer>2000000
   or coalesce(p_provenance->>'locator','') !~ '^(article_text|plain_text|pdf_page:[1-9][0-9]{0,4}|no_text)$'
   or jsonb_typeof(p_provenance->'hopSha256') is distinct from 'array'
   or jsonb_array_length(p_provenance->'hopSha256') not between 1 and 4
   or (select count(distinct v) from jsonb_array_elements_text(p_provenance->'hopSha256') v)<>jsonb_array_length(p_provenance->'hopSha256')
  then return null;end if;
  observed:=(p_provenance->>'retrievedAt')::timestamptz;
  if observed is null or observed>clock_timestamp() then return null;end if;
  select * into parent_lead from mizizi_private.desk_reference_leads_v1 where id=(call_body->'input'->>'lead_id')::uuid;
  if not found or parent_lead.kind<>'reference' or parent_lead.url is distinct from p_provenance->>'requestedUrl' then return null;end if;
  select * into parent_receipt from mizizi_private.desk_tool_receipts_v1 where id=parent_lead.receipt_id;
  if not mizizi_private.desk_custody_receipt_current_v1(parent_receipt,c) then return null;end if;
  parent_id:=parent_receipt.id;
  for hop in select jsonb_array_elements_text(p_provenance->'hopSha256') loop
   if hop !~ '^[0-9a-f]{64}$' or exists(select 1 from mizizi_private.desk_tool_receipts_v1 q
    where q.operation='read_page' and q.provenance->'hopSha256' ? hop)
   then return null;end if;
   select * into native_r from mizizi_private.desk_resource_reservations_v1
   where resource='native_https' and request_sha256=hop and job_id=(s->>'jobId')::uuid
   and case_id=(s->>'caseId')::uuid and workspace_id=(s->>'workspaceId')::uuid
   and expected_revision=(s->>'expectedRevision')::integer and worker_id=s->>'workerId'
   and lease_expires_at=(s->>'leaseExpiresAt')::timestamptz and consumed_at is not null;
   if not found or native_r.membership_sha256<>c->>'membershipSha256' or native_r.observation_sha256<>c->>'observationSha256'
   then return null;end if;
  end loop;
 elsif op='browse_page' or (op='inspect_visual' and p_provenance->'detail' ? 'localBrowser') then
  -- Local interactive browser: one consumed capacity slot per lease,
  -- exact current action/source grants and the same private receipt ledger.
  -- Source bytes and the live DOM are not retained in SQL.
  detail:=p_provenance->'detail';local_meta:=detail->'localBrowser';local_action:=local_meta->>'action';
  if o.revision is null or not p.browser_render_allowed or p.source_family<>'public_web'
   or not(p_provenance ?& array['parentReceiptId','finalUrl','sourceSha256','projectionSha256','contentType','retrievedAt','byteLength','locator','detail'])
   or (select count(*) from jsonb_object_keys(p_provenance))<>9
   or jsonb_typeof(detail) is distinct from 'object' or (select count(*) from jsonb_object_keys(detail))<>3
   or not(detail ?& array['localBrowser','visual','actionBindings'])
   or jsonb_typeof(local_meta) is distinct from 'object' or (select count(*) from jsonb_object_keys(local_meta))<>6
   or not(local_meta ?& array['reservationId','requestSha256','sessionId','observationSha256','action','generation'])
   or coalesce(local_meta->>'reservationId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or coalesce(local_meta->>'sessionId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or coalesce(local_meta->>'requestSha256','') !~ '^[0-9a-f]{64}$'
   or coalesce(local_meta->>'observationSha256','') !~ '^[0-9a-f]{64}$'
   or coalesce(local_meta->>'generation','') !~ '^[1-9][0-9]{0,2}$'
   or coalesce(local_action,'') not in ('navigate','expand','follow','search','scroll_down','visual')
   or coalesce(call_body->'input'->>'lead_id','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or mizizi_private.desk_custody_url_host_v1(p_provenance->>'finalUrl') is distinct from p.host
   or p_provenance->>'contentType' is distinct from 'text/html'
   or coalesce(p_provenance->>'sourceSha256','') !~ '^[0-9a-f]{64}$'
   or coalesce(p_provenance->>'projectionSha256','') !~ '^[0-9a-f]{64}$'
   or coalesce(p_provenance->>'byteLength','') !~ '^[1-9][0-9]{0,6}$'
   or (p_provenance->>'byteLength')::integer>2000000
   or jsonb_typeof(detail->'actionBindings') is distinct from 'array'
   or jsonb_array_length(detail->'actionBindings')<>jsonb_array_length(result->'leads')
  then return null;end if;
  select * into parent_lead from mizizi_private.desk_reference_leads_v1 where id=(call_body->'input'->>'lead_id')::uuid;
  if not found then return null;end if;
  select * into parent_receipt from mizizi_private.desk_tool_receipts_v1 where id=parent_lead.receipt_id;
  if not found or parent_receipt.id::text is distinct from p_provenance->>'parentReceiptId'
   or parent_receipt.job_id::text is distinct from s->>'jobId' or parent_receipt.worker_id is distinct from s->>'workerId'
   or parent_receipt.lease_expires_at is distinct from (s->>'leaseExpiresAt')::timestamptz
   or not mizizi_private.desk_custody_receipt_current_v1(parent_receipt,c) then return null;end if;
  parent_id:=parent_receipt.id;
  if local_action='navigate' then
   if op<>'browse_page' or parent_lead.kind<>'reference' or call_body->'input'->>'query' is distinct from ''
    or not exists(select 1 from mizizi_private.desk_operational_call_proofs_v1 q where q.job_id=parent_receipt.job_id
     and q.lease_expires_at=parent_receipt.lease_expires_at and q.call_sha256=p_call_sha256 and q.operation='browser_render'
     and q.url_sha256=encode(sha256(convert_to(parent_lead.url,'UTF8')),'hex') and q.valid_until>clock_timestamp())
   then return null;end if;
  else
   if parent_receipt.provenance->'detail'->'localBrowser'->>'reservationId' is distinct from local_meta->>'reservationId'
    or parent_receipt.provenance->'detail'->'localBrowser'->>'sessionId' is distinct from local_meta->>'sessionId'
    or (local_meta->>'generation')::integer<=coalesce((parent_receipt.provenance->'detail'->'localBrowser'->>'generation')::integer,0)
    or exists(select 1 from mizizi_private.desk_tool_receipts_v1 q where q.job_id=parent_receipt.job_id
     and q.lease_expires_at=parent_receipt.lease_expires_at and q.provenance->'detail'->'localBrowser'->>'reservationId'=local_meta->>'reservationId'
     and (q.provenance->'detail'->'localBrowser'->>'generation')::integer>(parent_receipt.provenance->'detail'->'localBrowser'->>'generation')::integer)
    then return null;end if;
   select value into parent_action from jsonb_array_elements(parent_receipt.provenance->'detail'->'actionBindings')
    where value->>'id'=parent_lead.id::text;
   if not found or parent_action->>'action' is distinct from local_action
    or (local_action='visual' and (op<>'inspect_visual' or parent_lead.kind<>'visual' or call_body->'input'->>'page'<>'1'))
    or (local_action<>'visual' and (op<>'browse_page' or parent_lead.kind<>'browser_action'))
    or (local_action='search' and not mizizi_private.desk_public_research_query_allowed_v1(c,call_body->'input'->>'query'))
    or (local_action not in ('visual','search') and call_body->'input'->>'query' is distinct from '')
    or (local_action in ('expand','scroll_down','visual') and parent_lead.url is distinct from p_provenance->>'finalUrl')
   then return null;end if;
  end if;
  select * into local_res from mizizi_private.desk_resource_reservations_v1 where id=(local_meta->>'reservationId')::uuid
    and resource='local_chromium' and request_sha256=local_meta->>'requestSha256';
  if not found or not mizizi_private.desk_local_browser_active_v1(local_res,s,local_meta->>'sessionId')
   or local_res.membership_sha256<>c->>'membershipSha256' or local_res.observation_sha256<>c->>'observationSha256'
  then return null;end if;
  observed:=(p_provenance->>'retrievedAt')::timestamptz;
  if observed is null or observed<local_res.consumed_at or observed>clock_timestamp() then return null;end if;
  final_hash:=encode(sha256(convert_to(p_provenance->>'finalUrl','UTF8')),'hex');
  if not exists(select 1 from mizizi_private.desk_operational_call_proofs_v1 q where q.job_id=local_res.job_id
   and q.lease_expires_at=local_res.lease_expires_at and q.call_sha256=p_call_sha256
   and q.operation=case when op='inspect_visual' then 'browser_visual' else 'browser_text' end
   and q.url_sha256=final_hash and q.source_sha256=p_provenance->>'sourceSha256'
   and q.standing_revision=o.revision and q.valid_until>clock_timestamp())
   or exists(select 1 from mizizi_private.desk_operational_call_proofs_v1 q
    where q.job_id=local_res.job_id and q.lease_expires_at=local_res.lease_expires_at
     and q.call_sha256=p_call_sha256 and q.operation='browser_request' and q.hop_sha256 is not null
     and not exists(select 1 from mizizi_private.desk_resource_reservations_v1 rr where rr.resource='native_https'
      and rr.request_sha256=q.hop_sha256 and rr.job_id=local_res.job_id and rr.case_id=local_res.case_id
      and rr.workspace_id=local_res.workspace_id and rr.worker_id=local_res.worker_id
      and rr.lease_expires_at=local_res.lease_expires_at and rr.consumed_at is not null))
  then return null;end if;
  if local_action in ('navigate','follow','search') and not exists(
   select 1 from mizizi_private.desk_operational_call_proofs_v1 q
   where q.job_id=local_res.job_id and q.lease_expires_at=local_res.lease_expires_at
    and q.call_sha256=p_call_sha256 and q.operation='browser_request' and q.url_sha256=final_hash and q.hop_sha256 is not null)
  then return null;end if;
  if op='inspect_visual' then
   if not p.visual_processing_allowed or not p.excerpt_retention_allowed or local_action<>'visual'
    or not mizizi_private.desk_visual_descriptor_valid_v1(detail->'visual')
    or detail->'visual'->>'width'<>'1280' or detail->'visual'->>'height'<>'900'
    or p_provenance->>'projectionSha256' is distinct from detail->'visual'->>'sha256'
    or p_provenance->>'locator' is distinct from 'browser_viewport:1'
    or jsonb_array_length(result->'leads')<>0 or jsonb_array_length(result->'sources')<>1
    or result->'visual' is distinct from jsonb_build_object('sourceId',rid,'sha256',detail->'visual'->>'sha256','contentType','image/png')
    or result->'sources'->0->>'excerpt' is distinct from 'Visual derivative for examination; no textual claim is verified.'
   then return null;end if;
  elsif local_action='visual' or detail->'visual' is distinct from 'null'::jsonb
   or coalesce(p_provenance->>'locator','') not in ('browser_visible_text','no_text') then return null;end if;
 else
  -- Follow-ups are restricted to bytes held transiently in the exact lease.
  -- The DB binds metadata and parent custody; it never claims to verify
  -- original/raster bytes that are not retained.
  detail:=p_provenance->'detail';
  if p.source_family<>'public_web' or not(call_body->'input' ? 'lead_id')
   or coalesce(call_body->'input'->>'lead_id','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or not(p_provenance ?& array['parentReceiptId','finalUrl','sourceSha256','projectionSha256','contentType','retrievedAt','byteLength','locator','detail'])
   or (select count(*) from jsonb_object_keys(p_provenance))<>9
   or jsonb_typeof(detail) is distinct from 'object'
   or mizizi_private.desk_custody_url_host_v1(p_provenance->>'finalUrl') is distinct from p.host
   or coalesce(p_provenance->>'sourceSha256','') !~ '^[0-9a-f]{64}$'
   or coalesce(p_provenance->>'projectionSha256','') !~ '^[0-9a-f]{64}$'
   or coalesce(p_provenance->>'byteLength','') !~ '^[1-9][0-9]{0,6}$'
   or (p_provenance->>'byteLength')::integer>2000000
  then return null;end if;
  observed:=(p_provenance->>'retrievedAt')::timestamptz;
  if observed is null or observed>clock_timestamp() then return null;end if;
  select * into parent_lead from mizizi_private.desk_reference_leads_v1 where id=(call_body->'input'->>'lead_id')::uuid;
  if not found or parent_lead.url is distinct from p_provenance->>'finalUrl' then return null;end if;
  select * into parent_receipt from mizizi_private.desk_tool_receipts_v1 where id=parent_lead.receipt_id;
  if not mizizi_private.desk_custody_receipt_current_v1(parent_receipt,c)
   or parent_receipt.id::text is distinct from p_provenance->>'parentReceiptId'
   or parent_receipt.job_id::text is distinct from s->>'jobId'
   or parent_receipt.worker_id is distinct from s->>'workerId'
   or parent_receipt.lease_expires_at is distinct from (s->>'leaseExpiresAt')::timestamptz
   or parent_receipt.host is distinct from p.host
   or parent_receipt.policy_revision is distinct from p.revision
  then return null;end if;
  parent_id:=parent_receipt.id;
  if op='render_page' then
   if parent_lead.kind<>'render' or parent_receipt.operation<>'read_page'
    or parent_receipt.provenance->'renderRequired' is distinct from 'true'::jsonb
    or not p.browser_render_allowed or p_provenance->>'contentType' is distinct from 'text/html'
    or coalesce(p_provenance->>'locator','') not in ('article_text','no_text')
    or not(detail ?& array['reservationId','requestSha256','requestText','visual'])
    or (select count(*) from jsonb_object_keys(detail))<>4
    or coalesce(detail->>'reservationId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
    or coalesce(detail->>'requestSha256','') !~ '^[0-9a-f]{64}$'
    or octet_length(detail->>'requestText') not between 1 and 4096
    or encode(sha256(convert_to(detail->>'requestText','UTF8')),'hex') is distinct from detail->>'requestSha256'
   then return null;end if;
   browser_request:=(detail->>'requestText')::jsonb;
   if jsonb_typeof(browser_request) is distinct from 'object'
    or (select count(*) from jsonb_object_keys(browser_request))<>8
    or browser_request->'scope' is distinct from s or browser_request->>'url' is distinct from p_provenance->>'finalUrl'
    or browser_request->>'hostname' is distinct from p.host
    or browser_request->>'sourceSha256' is distinct from parent_receipt.provenance->>'sourceSha256'
    or browser_request->>'projectionSha256' is distinct from parent_receipt.provenance->>'projectionSha256'
    or browser_request->'reserveSeconds' is distinct from '120'::jsonb
    or browser_request->'visual' is distinct from to_jsonb(detail->'visual'<>'null'::jsonb)
   then return null;end if;
   if detail->'visual'<>'null'::jsonb and (not p.visual_processing_allowed or not p.excerpt_retention_allowed
      or not mizizi_private.desk_visual_descriptor_valid_v1(detail->'visual')
      or detail->'visual'->>'width'<>'1280' or detail->'visual'->>'height'<>'900') then return null;end if;
   select * into native_r from mizizi_private.desk_resource_reservations_v1
    where resource='cloudflare_browser_run' and id=(detail->>'reservationId')::uuid
    and request_sha256=detail->>'requestSha256' and account_fingerprint=browser_request->>'accountFingerprint'
    and job_id=(s->>'jobId')::uuid and case_id=(s->>'caseId')::uuid and workspace_id=(s->>'workspaceId')::uuid
    and expected_revision=(s->>'expectedRevision')::integer and worker_id=s->>'workerId'
    and lease_expires_at=(s->>'leaseExpiresAt')::timestamptz and consumed_at is not null;
   if not found or native_r.membership_sha256<>c->>'membershipSha256' or native_r.observation_sha256<>c->>'observationSha256'
    or not exists(select 1 from mizizi_private.desk_resource_events_v1 e where e.reservation_id=native_r.id and e.state='close_acknowledged')
    or exists(select 1 from mizizi_private.desk_tool_receipts_v1 q where q.operation='render_page' and q.provenance->'detail'->>'reservationId'=native_r.id::text)
   then return null;end if;
  else
   -- Text pages and visual derivatives preserve the parent payload fingerprint:
   -- another page or raster is not independent corroboration.
   if p_provenance->>'sourceSha256' is distinct from parent_receipt.provenance->>'sourceSha256'
    or p_provenance->>'contentType' is distinct from parent_receipt.provenance->>'contentType'
    or p_provenance->>'byteLength' is distinct from parent_receipt.provenance->>'byteLength'
    or observed is distinct from (parent_receipt.provenance->>'retrievedAt')::timestamptz
    or jsonb_array_length(result->'leads')<>0 then return null;end if;
   if op='read_document' then
    if parent_lead.kind<>'document' or parent_receipt.operation<>'read_page'
     or p_provenance->>'contentType'<>'application/pdf'
     or not(detail ?& array['pageStart','pageEnd']) or (select count(*) from jsonb_object_keys(detail))<>2
     or coalesce(call_body->'input'->>'page_start','') !~ '^[1-9][0-9]{0,4}$'
     or coalesce(call_body->'input'->>'page_end','') !~ '^[1-9][0-9]{0,4}$'
     or detail->'pageStart' is distinct from call_body->'input'->'page_start'
     or detail->'pageEnd' is distinct from call_body->'input'->'page_end'
     or parent_receipt.provenance->>'documentPages' is null then return null;end if;
    page_start:=(detail->>'pageStart')::integer;page_end:=(detail->>'pageEnd')::integer;
    if page_end<page_start or page_end-page_start>9 or page_end>(parent_receipt.provenance->>'documentPages')::integer
     or coalesce(p_provenance->>'locator','') not in ('no_text','pdf_pages:'||page_start||'-'||page_end)
    then return null;end if;
   else
    if not p.visual_processing_allowed or not p.excerpt_retention_allowed
     or not(detail ?& array['page','visual']) or (select count(*) from jsonb_object_keys(detail))<>2
     or coalesce(detail->>'page','') !~ '^[1-9][0-9]{0,4}$'
     or detail->'page' is distinct from call_body->'input'->'page'
     or not mizizi_private.desk_visual_descriptor_valid_v1(detail->'visual')
     or p_provenance->>'projectionSha256' is distinct from detail->'visual'->>'sha256'
     or jsonb_array_length(result->'sources')<>1
     or result->'visual' is distinct from jsonb_build_object('sourceId',rid,'sha256',detail->'visual'->>'sha256','contentType','image/png')
     or result->'sources'->0->>'excerpt' is distinct from 'Visual derivative for examination; no textual claim is verified.'
    then return null;end if;
    if parent_lead.kind='document' and parent_receipt.operation='read_page' and p_provenance->>'contentType'='application/pdf' then
     if parent_receipt.provenance->>'documentPages' is null or (detail->>'page')::integer>(parent_receipt.provenance->>'documentPages')::integer
      or p_provenance->>'locator' is distinct from ('pdf_visual:'||(detail->>'page')) then return null;end if;
    elsif parent_lead.kind='visual' and parent_receipt.operation='render_page' then
     if detail->>'page'<>'1' or detail->'visual' is distinct from parent_receipt.provenance->'detail'->'visual'
      or p_provenance->>'locator' is distinct from 'browser_viewport:1' then return null;end if;
    else return null;end if;
   end if;
  end if;
 end if;
 if o.revision is not null and op in ('read_page','read_document') then
  final_hash:=encode(sha256(convert_to(p_provenance->>'finalUrl','UTF8')),'hex');
  if not exists(select 1 from mizizi_private.desk_operational_call_proofs_v1 q where q.job_id=(s->>'jobId')::uuid
   and q.lease_expires_at=(s->>'leaseExpiresAt')::timestamptz and q.call_sha256=p_call_sha256 and q.operation='native_text'
   and q.standing_revision=o.revision and q.url_sha256=final_hash and q.source_sha256=p_provenance->>'sourceSha256'
   and q.valid_until>clock_timestamp() and (op='read_page' or
     (q.page_start=(detail->>'pageStart')::integer and q.page_end=(detail->>'pageEnd')::integer))) then return null;end if;
  if op='read_page' then
   hop_index:=0;
   for hop in select jsonb_array_elements_text(p_provenance->'hopSha256') loop
    hop_index:=hop_index+1;
    if not exists(select 1 from mizizi_private.desk_operational_call_proofs_v1 q where q.job_id=(s->>'jobId')::uuid
     and q.lease_expires_at=(s->>'leaseExpiresAt')::timestamptz and q.call_sha256=p_call_sha256 and q.operation='native_acquire'
     and q.standing_revision=o.revision and q.hop_sha256=hop and q.valid_until>clock_timestamp()
     and (hop_index<>1 or q.url_sha256=encode(sha256(convert_to(p_provenance->>'requestedUrl','UTF8')),'hex'))
     and (hop_index<>jsonb_array_length(p_provenance->'hopSha256') or q.url_sha256=final_hash)) then return null;end if;
   end loop;
  end if;
 end if;
 if op not in ('search_web','search_news') then
  if jsonb_array_length(result->'sources')=1 then
   if not p.excerpt_retention_allowed or p_provenance->>'locator'='no_text' then return null;end if;
   src:=result->'sources'->0;authsrc:=src->'source';source_id:=rid;
   if jsonb_typeof(src) is distinct from 'object' or (select count(*) from jsonb_object_keys(src))<>3
   or jsonb_typeof(authsrc) is distinct from 'object' or (select count(*) from jsonb_object_keys(authsrc))<>14
   or jsonb_typeof(src->'excerpt') is distinct from 'string' or length(btrim(src->>'excerpt')) not between 1 and 4000
   or src->>'citation' is distinct from ((p_provenance->>'finalUrl')||'#'||(p_provenance->>'locator'))
   or authsrc->>'sourceId' is distinct from rid::text
   or authsrc->>'caseId' is distinct from s->>'caseId' or authsrc->>'workspaceId' is distinct from s->>'workspaceId'
   or authsrc->>'originKey' is distinct from p.origin_key or authsrc->>'lineageKey' is distinct from p.lineage_key
   or authsrc->>'fingerprint' is distinct from p_provenance->>'sourceSha256'
   or authsrc->>'authorityRef' is distinct from p.authority_ref or authsrc->>'useBasis' is distinct from p.use_basis
   or (authsrc->>'observedAt')::timestamptz is distinct from observed
   or (authsrc->>'expiresAt')::timestamptz is distinct from p.valid_until
   or authsrc->'revokedAt' is distinct from 'null'::jsonb
   or authsrc->'privateResearchAllowed' is distinct from 'true'::jsonb
   or authsrc->'externalModelProcessingAllowed' is distinct from 'true'::jsonb
   or authsrc->'privateEvidenceRetentionAllowed' is distinct from 'true'::jsonb
   then return null;end if;
  end if;
 end if;
 -- Match private URL bindings one-to-one to model-facing opaque leads.
 if (select count(distinct v->>'id') from jsonb_array_elements(p_lead_bindings) v)<>jsonb_array_length(p_lead_bindings)
 or (select count(distinct v->>'id') from jsonb_array_elements(result->'leads') v)<>jsonb_array_length(result->'leads') then return null;end if;
 for lead in select value from jsonb_array_elements(result->'leads') loop
  if jsonb_typeof(lead) is distinct from 'object' or (select count(*) from jsonb_object_keys(lead))<>3
   or coalesce(lead->>'id','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or coalesce(lead->>'kind','') not in ('reference','document','render','visual','browser_action') or jsonb_typeof(lead->'label') is distinct from 'string'
   or length(btrim(lead->>'label')) not between 1 and 500 then return null;end if;
  select value into binding from jsonb_array_elements(p_lead_bindings) where value->>'id'=lead->>'id';
  if not found or jsonb_typeof(binding) is distinct from 'object'
   or (select count(*) from jsonb_object_keys(binding))<>2
   or mizizi_private.desk_custody_url_host_v1(binding->>'url') is null then return null;end if;
  if local_meta is not null and lead->>'kind' not in ('browser_action','visual') then return null;end if;
  if lead->>'kind'<>'reference' then
   if binding->>'url' is distinct from p_provenance->>'finalUrl' then return null;end if;
   if lead->>'kind'='document' then
    if op<>'read_page' or p_provenance->>'contentType'<>'application/pdf' or p_provenance->>'documentPages' is null then return null;end if;
   elsif lead->>'kind'='render' then
    if op<>'read_page' or not p.browser_render_allowed or p_provenance->'renderRequired' is distinct from 'true'::jsonb then return null;end if;
   elsif lead->>'kind'='browser_action' or (lead->>'kind'='visual' and op='browse_page') then
    if op<>'browse_page' or local_meta is null or not p.browser_render_allowed
     or (lead->>'kind'='visual' and (not p.visual_processing_allowed or not p.excerpt_retention_allowed))
     or not exists(select 1 from jsonb_array_elements(detail->'actionBindings') v
      where v->>'id'=lead->>'id' and (select count(*) from jsonb_object_keys(v))=2
       and ((lead->>'kind'='visual' and v->>'action'='visual') or
        (lead->>'kind'='browser_action' and v->>'action' in ('expand','follow','search','scroll_down'))))
    then return null;end if;
   elsif lead->>'kind'='visual' then
    if op<>'render_page' or not p.visual_processing_allowed or not mizizi_private.desk_visual_descriptor_valid_v1(detail->'visual') then return null;end if;
   else return null;end if;
  end if;
 end loop;
 if p.valid_until<=clock_timestamp() or (s->>'leaseExpiresAt')::timestamptz<=clock_timestamp() then return null;end if;
 if o.revision is not null then
  r.job_id:=(s->>'jobId')::uuid;r.case_id:=(s->>'caseId')::uuid;r.workspace_id:=(s->>'workspaceId')::uuid;
  r.worker_id:=s->>'workerId';r.lease_expires_at:=(s->>'leaseExpiresAt')::timestamptz;
  r.operation:=op;r.call_sha256:=p_call_sha256;r.operational_revision:=o.revision;
  if not mizizi_private.desk_operational_receipt_current_v1(r,c) then return null;end if;
 end if;
 insert into mizizi_private.desk_tool_receipts_v1(id,job_id,case_id,workspace_id,expected_revision,worker_id,
 lease_expires_at,membership_sha256,observation_sha256,operation,call_sha256,result_sha256,host,policy_revision,result_text,provenance,source_id,parent_receipt_id,operational_revision)
 values(rid,(s->>'jobId')::uuid,(s->>'caseId')::uuid,(s->>'workspaceId')::uuid,(s->>'expectedRevision')::integer,s->>'workerId',
 (s->>'leaseExpiresAt')::timestamptz,c->>'membershipSha256',c->>'observationSha256',op,p_call_sha256,p_result_sha256,p.host,p.revision,p_result_text,clean_provenance,source_id,parent_id,o.revision);
 insert into mizizi_private.desk_reference_leads_v1(id,receipt_id,url,kind,label)
 select (l->>'id')::uuid,rid,b->>'url',l->>'kind',l->>'label'
 from jsonb_array_elements(result->'leads') l join jsonb_array_elements(p_lead_bindings) b on l->>'id'=b->>'id';
 return jsonb_build_object('receiptId',rid,'resultSha256',p_result_sha256,'outcome','created');
end $append$;

create or replace function mizizi_private.assert_desk_journal_current_v1(
 p_job_id uuid,p_worker_id text,p_case_id uuid,p_pending jsonb
) returns void language plpgsql security definer set search_path=pg_catalog as $journal$
declare c jsonb;b jsonb;ref jsonb;r mizizi_private.desk_tool_receipts_v1;
 s jsonb;a jsonb;seen uuid[];sid uuid;o mizizi_private.desk_operational_policy_versions_v1;deps uuid[];dep_sources uuid[];
begin
 -- Same lock order as the existing custody RPCs: policy lock, then exact
 -- job/case locks. Public chart RPCs take the policy lock before row locks.
 perform pg_advisory_xact_lock(214781521,61431);
 c:=mizizi_private.read_leased_chart_research_context_v1(p_job_id,p_worker_id);
 if c is null or c->>'caseId' is distinct from p_case_id::text then
  raise exception 'Desk journal scope denied' using errcode='42501';end if;
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
    if o.revision is not null and p_pending is not null and b=p_pending and
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

revoke all on function mizizi_private.desk_local_browser_active_v1(mizizi_private.desk_resource_reservations_v1,jsonb,text),
 mizizi_private.desk_local_browser_receipt_available_v1(mizizi_private.desk_tool_receipts_v1,jsonb),
 public.mizizi_read_desk_local_browser_session_v1(jsonb,uuid,text,text) from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_read_desk_local_browser_session_v1(jsonb,uuid,text,text) to service_role;
do $acl$ begin
 if has_table_privilege('service_role','mizizi_private.desk_resource_policy_versions_v1','INSERT')
 or has_table_privilege('service_role','mizizi_private.desk_tool_receipts_v1','INSERT')
 or has_function_privilege('authenticated','public.mizizi_read_desk_local_browser_session_v1(jsonb,uuid,text,text)','EXECUTE')
 then raise exception 'STOP_MIZIZI_LOCAL_BROWSER_ACL';end if;
end $acl$;
commit;
