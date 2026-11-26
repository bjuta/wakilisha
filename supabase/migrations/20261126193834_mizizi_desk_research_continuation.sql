-- Issue #1441. CLI 2.107.0 mint #45885135537 job 140133846109.
-- Continue one existing exact job across productive passes, without a
-- second queue, owner approval per question, or automatic canonical write.
-- Disabled by default. No active authority or budget is seeded.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
do $guard$ begin
 if current_user<>'postgres' or to_regclass('mizizi_private.desk_operational_policy_versions_v1') is null
  or to_regprocedure('public.mizizi_continue_desk_research_job_v1(jsonb,text)') is not null
 then raise exception 'STOP_MIZIZI_CONTINUATION_PREIMAGE';end if;
end $guard$;
alter table mizizi_private.desk_operational_policy_versions_v1
 add column adaptive_followups_allowed boolean not null default false,
 add column public_query_terms text[] not null default array[]::text[];
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
  if coalesce(v,'') not in ('search_web','search_news','read_page','read_document') then raise exception 'Unsupported operational tool' using errcode='22023';end if;
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
  if jsonb_array_length(ops) not between 1 and 2
   or exists(select 1 from jsonb_array_elements(ops) x where x not in ('"native_acquire"'::jsonb,'"native_text"'::jsonb))
   or (select count(distinct x) from jsonb_array_elements(ops) x)<>jsonb_array_length(ops)
   then raise exception 'Invalid source operation' using errcode='22023';end if;
  if not exists(select 1 from mizizi_private.desk_custody_policy_versions_v1 cp
   where cp.workspace_id=new.workspace_id and cp.host=h and cp.revision=(rule->>'custodyRevision')::integer)
   then raise exception 'Unknown source custody revision' using errcode='22023';end if;
 end loop;
 new.recorded_at:=clock_timestamp();return new;
end $guard$;

-- Approved public subject labels remain the anchor. A reviewed reusable
-- vocabulary allows refinement without approving each query or permitting
-- arbitrary private text to be transmitted to search providers.
create function mizizi_private.desk_public_research_query_allowed_v1(c jsonb,q text)
returns boolean language plpgsql security definer set search_path=pg_catalog as $f$
declare o mizizi_private.desk_operational_policy_versions_v1;
begin
 if q is null or length(q) not between 3 and 300 or btrim(q)<>q or q ~ '[[:cntrl:]]' then return false;end if;
 o:=mizizi_private.current_desk_operational_policy_v1(c);
 if o.revision is not null and not mizizi_private.desk_operational_policy_live_v1(o,c) then return false;end if;
 return exists(select 1 from jsonb_array_elements(c->'positions') v
 cross join lateral (select v->>'title' as label union all
  select (v->>'title')||' '||(v->>'artist') where nullif(btrim(v->>'artist'),'') is not null) a
 where q=a.label or (o.adaptive_followups_allowed and exists(
  select 1 from unnest(o.public_query_terms) as terms(term) where q=a.label||' '||terms.term)));
end $f$;

-- The session owner grants subsequent questions derived from the same
-- verified journal. Never allow a caller to substitute arbitrary text.
-- Existing exact grants/denials, source rights and monetary policy survive.
create function mizizi_private.desk_research_question_allowed_v1(
 o mizizi_private.desk_operational_policy_versions_v1,c jsonb,qhash text)
returns boolean language plpgsql security definer set search_path=pg_catalog as $f$
declare p mizizi_private.research_passes%rowtype; question text;
begin
 if qhash is null or qhash !~ '^[a-f0-9]{64}$' then return false;end if;
 if qhash=any(o.question_sha256s) then return true;end if;
 if not coalesce(o.adaptive_followups_allowed,false) then return false;end if;
 select * into p from mizizi_private.research_passes
 where case_id=o.case_id and workspace_id=o.workspace_id order by ordinal desc limit 1;
 if not found or p.body_text::jsonb->'decision'->>'action' is distinct from 'continue'
  or not(p.body_text::jsonb ? 'deskToolReceipts') then return false;end if;
 question:=p.body_text::jsonb->'decision'->>'nextQuestion';
 if question is null or length(question) not between 8 and 500 or btrim(question)<>question
  or question ~ '[[:cntrl:]]' or encode(sha256(convert_to(question,'UTF8')),'hex')<>qhash
 then return false;end if;
 perform mizizi_private.assert_desk_journal_current_v1((c->>'jobId')::uuid,
  (select locked_by from platform_private.jobs where id=(c->>'jobId')::uuid),o.case_id,null);
 return true;
end $f$;

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
   or coalesce(op,'') not in ('search_web','search_news','read_page','read_document','render_page','inspect_visual') then return null;end if;
  if o.revision is not null and not(op=any(o.tool_names)) then return null;end if;
  if op in ('search_web','search_news') then
   if (select count(*) from jsonb_object_keys(i))<>1 or jsonb_typeof(i->'query') is distinct from 'string'
    or length(btrim(i->>'query')) not between 3 and 300 then return null;end if;
   if o.revision is not null and not mizizi_private.desk_public_research_query_allowed_v1(c,i->>'query') then return null;end if;
  else
   if coalesce(i->>'lead_id','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then return null;end if;
   select * into l from mizizi_private.desk_reference_leads_v1 where id=(i->>'lead_id')::uuid;
   if not found then return null;end if;
   if (op='read_page' and l.kind<>'reference') or (op='render_page' and l.kind<>'render')
    or (op='read_document' and l.kind<>'document') or (op='inspect_visual' and l.kind not in ('document','visual')) then return null;end if;
   if op='read_document' then
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

create or replace function mizizi_private.qualify_desk_search_request_v1(p_request_text text,p_request_sha256 text,p_account_fingerprint text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $qualify$
declare
 p mizizi_private.desk_search_policy_versions_v1%rowtype;
 req jsonb; scope jsonb; ctx jsonb; t timestamptz; until_at timestamptz; provider_name text; provider_host_name text;
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
 provider_name:=case when req ? 'provider' then req->>'provider' else 'brave' end;
 provider_host_name:=case when req ? 'providerHost' then req->>'providerHost' else 'api.search.brave.com' end;
 if provider_name is null or provider_host_name is null or
  (provider_name='brave' and (req ? 'provider' or req ? 'providerHost')) or
  (provider_name<>'brave' and (not(req ?& array['provider','providerHost']) or
   jsonb_typeof(req->'provider') is distinct from 'string' or jsonb_typeof(req->'providerHost') is distinct from 'string' or
   not mizizi_private.desk_search_provider_host_valid_v1(provider_name,provider_host_name))) or
  (provider_name='wikimedia' and req->>'operation' is distinct from 'search_web') or
  (provider_name='gdelt' and req->>'operation' is distinct from 'search_news') or
  (select count(*) from jsonb_object_keys(req))<>(case when provider_name='brave' then 4 else 6 end)
  or (select count(*) from jsonb_object_keys(scope))<>6
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
 select * into p from mizizi_private.desk_search_policy_versions_v1 where provider=provider_name order by revision desc limit 1;
 t:=clock_timestamp();
 if not found or not p.enabled or not p.commercial_search_allowed
  or not p.zero_cost_hard_cap_verified or not p.exclusive_allocated_usage_verified
  or not p.public_chart_labels_allowed or p.workspace_id::text<>scope->>'workspaceId'
  or p.account_fingerprint<>p_account_fingerprint or p.provider_host<>provider_host_name
  or t<p.allowance_start or t>=p.allowance_end or t>=p.valid_until
 then return null;end if;
 ctx:=mizizi_private.read_leased_chart_research_context_v1((scope->>'jobId')::uuid,scope->>'workerId');
 if ctx->>'caseId' is distinct from scope->>'caseId'
  or ctx->>'workspaceId' is distinct from scope->>'workspaceId'
  or ctx->>'expectedRevision' is distinct from scope->>'expectedRevision'
  or (ctx->>'leaseExpiresAt')::timestamptz is distinct from (scope->>'leaseExpiresAt')::timestamptz
  or not mizizi_private.desk_public_research_query_allowed_v1(ctx,req->>'query')
 then return null;end if;
 t:=clock_timestamp();
 until_at:=least(p.valid_until,p.allowance_end,(ctx->>'leaseExpiresAt')::timestamptz,
   (date_trunc('day',t at time zone 'UTC') at time zone 'UTC')+interval '1 day',t+interval '30 seconds');
 if until_at<=t then return null;end if;
 return jsonb_build_object('requestSha256',p_request_sha256,
  'policyRef','desk-search:'||p.provider||':'||p.revision,'validUntil',until_at,
  'publicQueryAllowed',true,'providerUseAllowed',true,'zeroIncrementalSpendAllowed',true,
  'policyRevision',p.revision,'membershipSha256',ctx->>'membershipSha256',
  'observationSha256',ctx->>'observationSha256');
end $qualify$;

create or replace function public.mizizi_read_desk_operational_policy_v1(p_scope jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare c jsonb;o mizizi_private.desk_operational_policy_versions_v1;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service-role required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(214781521,61431);
 c:=mizizi_private.desk_custody_context_v1(p_scope);
 if c is null then return null;end if;
 o:=mizizi_private.current_desk_operational_policy_v1(c);
 if not mizizi_private.desk_operational_policy_live_v1(o,c) then return null;end if;
 return jsonb_build_object('revision',o.revision,'scope',p_scope,'credentialSha256',o.credential_sha256,
  'modelIds',to_jsonb(o.model_ids),'questionSha256s',to_jsonb(o.question_sha256s),'toolNames',to_jsonb(o.tool_names),
  'maxRounds',o.max_rounds,'maxRequestBytes',o.max_request_bytes,'accessRules',o.access_rules,
  'adaptiveFollowupsAllowed',o.adaptive_followups_allowed,'publicQueryTerms',to_jsonb(o.public_query_terms),
  'validUntil',least(o.valid_until,(c->>'leaseExpiresAt')::timestamptz));
end $f$;

-- Same existing job and accepted command receipt. An exact, current,
-- independently custody-checked completed pass can yield the lease once.
-- No failure event, attempt reset, or new job is manufactured. The existing
-- monotonic lease-attempt ceiling remains a safety bound.
create function public.mizizi_continue_desk_research_job_v1(p_scope jsonb,p_fingerprint text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare c jsonb;o mizizi_private.desk_operational_policy_versions_v1;
 j platform_private.jobs%rowtype;p mizizi_private.research_passes%rowtype;question text;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service-role required' using errcode='42501';end if;
 if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' then
  raise exception 'Invalid continuation fingerprint' using errcode='22023';end if;
 perform pg_advisory_xact_lock(214781521,61431);
 c:=mizizi_private.desk_custody_context_v1(p_scope);
 if c is null then return null;end if;
 o:=mizizi_private.current_desk_operational_policy_v1(c);
 if not mizizi_private.desk_operational_policy_live_v1(o,c) or not o.adaptive_followups_allowed then return null;end if;
 select * into strict j from platform_private.jobs where id=(p_scope->>'jobId')::uuid for update;
 if j.attempt_count>=j.max_attempts then return null;end if;
 select * into p from mizizi_private.research_passes
 where case_id=o.case_id and workspace_id=o.workspace_id order by ordinal desc limit 1;
 if not found or p.job_id<>j.id or p.recorded_at<j.locked_at or p.fingerprint<>p_fingerprint
  or p.body_text::jsonb->'decision'->>'action' is distinct from 'continue'
  or jsonb_typeof(p.body_text::jsonb->'deskToolReceipts') is distinct from 'array'
  or jsonb_typeof(p.body_text::jsonb->'costUnits') is distinct from 'number'
  or coalesce(p.body_text::jsonb->>'costUnits','') !~ '^[1-9][0-9]{0,6}$'
 then return null;end if;
 question:=p.body_text::jsonb->'decision'->>'nextQuestion';
 if question is null or length(question) not between 8 and 500 or btrim(question)<>question
  or question ~ '[[:cntrl:]]' then return null;end if;
 perform mizizi_private.assert_desk_journal_current_v1(j.id,j.locked_by,o.case_id,null);
 if clock_timestamp()>=j.lease_expires_at then return null;end if;
 -- No stale process can yield a newly claimed lease using an old fingerprint:
 -- p_scope includes lease expiry, pass timestamp must belong to this lease.
 update platform_private.jobs set status='retry_wait',available_at=now(),
  locked_by=null,locked_at=null,lease_expires_at=null,last_error=null
 where id=j.id and status='running' and locked_by=j.locked_by and lease_expires_at=j.lease_expires_at;
 if not found then return null;end if;
 return jsonb_build_object('job_id',j.id,'case_id',o.case_id,'command_receipt_id',j.command_receipt_id,
  'job_status','retry_wait','pass_fingerprint',p.fingerprint,'ordinal',p.ordinal);
end $f$;
revoke all on function public.mizizi_continue_desk_research_job_v1(jsonb,text),
 mizizi_private.desk_public_research_query_allowed_v1(jsonb,text),
 mizizi_private.desk_research_question_allowed_v1(mizizi_private.desk_operational_policy_versions_v1,jsonb,text)
 from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_continue_desk_research_job_v1(jsonb,text) to service_role;
do $acl$ begin
 if has_function_privilege('authenticated','public.mizizi_continue_desk_research_job_v1(jsonb,text)','EXECUTE')
 or has_table_privilege('service_role','platform_private.jobs','UPDATE')
 or has_table_privilege('service_role','mizizi_private.desk_operational_policy_versions_v1','INSERT')
 then raise exception 'STOP_MIZIZI_CONTINUATION_ACL';end if;
end $acl$;
commit;
