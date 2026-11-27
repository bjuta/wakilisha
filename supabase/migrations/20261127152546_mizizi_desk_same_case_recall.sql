-- CLI 2.107.0 mint #46024796517. Issue #1441.
-- Same-case native-text and unexamined public-reference recall. No entitlement,
-- new provider, old transcript, browser state, cross-case reuse or canonical assertion.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
do $guard$
begin
 if current_user<>'postgres'
 or to_regprocedure('public.mizizi_admit_desk_same_case_recall_v1(text,text,uuid,uuid,text,text)') is not null
 or to_regprocedure('mizizi_private.desk_shared_native_source_v1(mizizi_private.desk_tool_receipts_v1)') is null
 or to_regprocedure('public.mizizi_read_desk_tool_receipt_v1(jsonb,uuid)') is null
 or to_regprocedure('mizizi_private.assert_desk_journal_current_v1(uuid,text,uuid,jsonb)') is null
 then raise exception 'STOP_MIZIZI_RECALL_PREIMAGE';end if;
end $guard$;
alter table mizizi_private.desk_tool_receipts_v1
 drop constraint desk_tool_receipts_v1_operation_check,
 add constraint desk_tool_receipts_v1_operation_check check(operation in ('search_web','search_news','read_page','read_document','render_page','inspect_visual','browse_page','recall_evidence'));
alter table mizizi_private.desk_operational_policy_versions_v1
 drop constraint desk_operational_policy_versions_v1_tool_names_check,
 add constraint desk_operational_policy_versions_v1_tool_names_check check(cardinality(tool_names) between 1 and 7);
-- One recall of each original source in this investigation; never issue a second
-- copy to make repeated evidence look like independent observations.
create unique index mz_desk_same_case_recall_origin_once on mizizi_private.desk_tool_receipts_v1(case_id,parent_receipt_id)
 where operation='recall_evidence' and source_id is not null;
create unique index mz_desk_same_case_recall_lead_once on mizizi_private.desk_tool_receipts_v1(case_id,(provenance->'sameCaseRecall'->>'originLeadId'))
 where operation='recall_evidence' and source_id is null;

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
 if 'recall_evidence'=any(new.tool_names) and (not new.adaptive_followups_allowed or not('read_page'=any(new.tool_names))
  or not('search_web'=any(new.tool_names) or 'search_news'=any(new.tool_names))) then
  raise exception 'Recall requires explicit adaptive native research authority' using errcode='22023';end if;
 foreach v in array new.tool_names loop
  if coalesce(v,'') not in ('search_web','search_news','read_page','read_document','browse_page','inspect_visual','recall_evidence') then raise exception 'Unsupported operational tool' using errcode='22023';end if;
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

-- Reconstruct the exact original native-text projection with a new receipt
-- identity only. No new source observation, lineage, expiry or other rights.
create function mizizi_private.desk_same_case_recall_result_v1(r mizizi_private.desk_tool_receipts_v1,p_id uuid)
returns jsonb language plpgsql stable set search_path=pg_catalog as $f$
declare item jsonb;a jsonb;body jsonb;
begin
 if r.id is null or p_id is null or p_id=r.id or r.source_id is distinct from r.id or r.operation<>'read_page'
 or r.parent_receipt_id is null or r.provenance ? 'sharedNative' or r.provenance ? 'sameCaseRecall'
 or coalesce(r.provenance->>'locator','') not in ('plain_text','article_text')
 or coalesce(r.provenance->>'contentType','') not in ('text/plain','text/html','application/xhtml+xml')
 or r.result_sha256 is distinct from encode(sha256(convert_to(r.result_text,'UTF8')),'hex')
 then return null;end if;
 body:=r.result_text::jsonb;
 if jsonb_typeof(body->'sources') is distinct from 'array' or jsonb_array_length(body->'sources')<>1
 or body->'visual' is distinct from 'null'::jsonb or body ? 'unavailable' then return null;end if;
 item:=body->'sources'->0;a:=item->'source';
 if a->>'sourceId' is distinct from r.id::text or a->>'caseId' is distinct from r.case_id::text
 or a->>'workspaceId' is distinct from r.workspace_id::text or a->>'fingerprint' is distinct from r.provenance->>'sourceSha256'
 or a->'privateResearchAllowed' is distinct from 'true'::jsonb
 or a->'externalModelProcessingAllowed' is distinct from 'true'::jsonb
 or a->'privateEvidenceRetentionAllowed' is distinct from 'true'::jsonb
 or a->'revokedAt' is distinct from 'null'::jsonb or a->>'expiresAt' is null
 or coalesce((a->>'expiresAt')::timestamptz<=clock_timestamp(),true)
 or jsonb_typeof(item->'excerpt') is distinct from 'string' or length(item->>'excerpt') not between 1 and 4000
 or jsonb_typeof(item->'citation') is distinct from 'string'
 then return null;end if;
 return jsonb_build_object('receiptId',p_id,'leads','[]'::jsonb,'sources',jsonb_build_array(
  item||jsonb_build_object('source',a||jsonb_build_object('sourceId',p_id))),'visual',null);
end $f$;

-- A retained search result is a reference only. Bind the exact old lead and
-- label, but create a fresh opaque ID; URL stays in the private lead table.
create function mizizi_private.desk_same_case_lead_projection_v1(r mizizi_private.desk_tool_receipts_v1,
 l mizizi_private.desk_reference_leads_v1,p_id uuid,p_new_lead uuid)
returns jsonb language plpgsql stable set search_path=pg_catalog as $f$
begin
 if r.id is null or l.id is null or p_id is null or p_new_lead is null or p_id=r.id or p_new_lead=l.id
 or r.operation not in ('search_web','search_news') or r.source_id is not null or r.parent_receipt_id is not null
 or r.provenance ? 'sharedNativeSearch' or l.receipt_id<>r.id or l.kind<>'reference'
 or r.result_sha256 is distinct from encode(sha256(convert_to(r.result_text,'UTF8')),'hex')
 or r.result_text::jsonb ? 'unavailable' or r.result_text::jsonb->'sources' is distinct from '[]'::jsonb
 or r.result_text::jsonb->'visual' is distinct from 'null'::jsonb
 or not(r.result_text::jsonb->'leads' @> jsonb_build_array(jsonb_build_object('id',l.id,'kind','reference','label',l.label)))
 or mizizi_private.desk_custody_url_host_v1(l.url) is null then return null;end if;
 return jsonb_build_object('receiptId',p_id,'leads',jsonb_build_array(jsonb_build_object('id',p_new_lead,'kind','reference','label',l.label)),
  'sources','[]'::jsonb,'visual',null);
end $f$;

-- Called by current custody ancestry traversal, without recursively invoking
-- that traversal here. The parent is independently checked on the next loop.
create function mizizi_private.desk_same_case_recall_current_v1(r mizizi_private.desk_tool_receipts_v1,c jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog as $f$
declare origin mizizi_private.desk_tool_receipts_v1;m jsonb;old_lead mizizi_private.desk_reference_leads_v1;new_lead mizizi_private.desk_reference_leads_v1;meta jsonb;
begin
 if r.operation<>'recall_evidence' or (r.source_id is not null and r.source_id is distinct from r.id) or r.parent_receipt_id is null
 or r.result_sha256 is distinct from encode(sha256(convert_to(r.result_text,'UTF8')),'hex') then return false;end if;
 select * into origin from mizizi_private.desk_tool_receipts_v1 where id=r.parent_receipt_id;
 if not found or origin.job_id is distinct from r.job_id or origin.case_id is distinct from r.case_id
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
  if ancestor.operation='recall_evidence' and not coalesce(mizizi_private.desk_same_case_recall_current_v1(ancestor,c),false) then return false;end if;
  if ancestor.provenance ? 'sameCaseRecall' and ancestor.operation<>'recall_evidence' then return false;end if;
  if ancestor.provenance ? 'sharedNative' and not mizizi_private.desk_shared_receipt_current_v1(ancestor,c) then return false;end if;
  if ancestor.provenance ? 'sharedNativeSearch' and not mizizi_private.desk_shared_search_current_v1(ancestor,c) then return false;end if;
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
   or coalesce(op,'') not in ('search_web','search_news','read_page','read_document','render_page','inspect_visual','browse_page','recall_evidence') then return null;end if;
  if (o.revision is not null and not(op=any(o.tool_names))) or (op='browse_page' and o.revision is null) then return null;end if;
  if op='recall_evidence' then
   if o.revision is null or not o.adaptive_followups_allowed or i is distinct from jsonb_build_object('query','case evidence') then return null;end if;
  elsif op in ('search_web','search_news') then
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
  select * into r from mizizi_private.desk_tool_receipts_v1 where id=rid;
  if r.provenance ? 'sharedNative' or (r.provenance ? 'sameCaseRecall' and r.source_id is not null) then
   expiry:=least(expiry,(r.result_text::jsonb->'sources'->0->'source'->>'expiresAt')::timestamptz);
  elsif r.provenance ? 'sharedNativeSearch' then
   expiry:=least(expiry,(r.provenance->'sharedNativeSearch'->>'validUntil')::timestamptz);
  end if;
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

-- Pick only an original native receipt already committed in the same exact
-- job's earlier journal; its exact dependency and source projection must agree.
-- Current independent operational policy and all custody ancestors must pass.
create function mizizi_private.desk_same_case_recall_candidate_v1(c jsonb)
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
  and p.job_id=j.id) then return null;end if;
 perform mizizi_private.assert_desk_journal_current_v1(j.id,j.locked_by,o.case_id,null);
 if (select count(*) from mizizi_private.desk_tool_receipts_v1 d where d.case_id=o.case_id)>=200 then return null;end if;
 for r in select d.* from mizizi_private.desk_tool_receipts_v1 d
  where d.case_id=o.case_id and d.workspace_id=o.workspace_id and d.job_id=j.id
   and d.expected_revision=o.expected_revision and d.operational_revision=o.revision and d.operation='read_page'
   and d.source_id=d.id and d.lease_expires_at is distinct from j.lease_expires_at
   and not exists(select 1 from mizizi_private.desk_tool_receipts_v1 q where q.case_id=d.case_id
    and q.operation='recall_evidence' and q.parent_receipt_id=d.id)
   and exists(select 1 from mizizi_private.research_passes p where p.case_id=d.case_id and p.workspace_id=d.workspace_id
    and p.job_id=j.id
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

-- Only original, journal-bound search leads never examined or attempted in
-- this case are eligible. Revalidate current target native-access standing
-- policy; acquisition itself still requires its own exact grant and budget.
create function mizizi_private.desk_same_case_lead_candidate_v1(c jsonb)
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
  where d.case_id=o.case_id and d.workspace_id=o.workspace_id and d.job_id=j.id
   and d.expected_revision=o.expected_revision and d.operational_revision=o.revision
   and d.lease_expires_at is distinct from j.lease_expires_at and d.operation in ('search_web','search_news')
   and lead.kind='reference' and not(d.provenance ? 'sharedNativeSearch') and not(d.result_text::jsonb ? 'unavailable')
   and exists(select 1 from mizizi_private.research_passes p where p.case_id=d.case_id and p.workspace_id=d.workspace_id and p.job_id=j.id
    and p.body_text::jsonb->'deskToolReceipts' @> jsonb_build_array(jsonb_build_object('receiptId',d.id,'callSha256',d.call_sha256,'resultSha256',d.result_sha256)))
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

-- Pre-inference inventory exposes only an exact receipt identity and digest to
-- the trusted service executor; no old excerpt/lead is sent to a model here.
create function public.mizizi_read_desk_same_case_recall_candidate_v1(p_scope jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare c jsonb;r mizizi_private.desk_tool_receipts_v1;l mizizi_private.desk_reference_leads_v1;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service-role required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(214781521,61431);
 c:=mizizi_private.desk_custody_context_v1(p_scope);
 if c is null or exists(select 1 from mizizi_private.desk_tool_receipts_v1 q where q.job_id=(p_scope->>'jobId')::uuid
  and q.lease_expires_at=(p_scope->>'leaseExpiresAt')::timestamptz and q.operation='recall_evidence') then return null;end if;
 r:=mizizi_private.desk_same_case_recall_candidate_v1(c);
 if r.id is not null then return jsonb_build_object('sourceReceiptId',r.id,'sourceResultSha256',r.result_sha256);end if;
 l:=mizizi_private.desk_same_case_lead_candidate_v1(c);
 if l.id is null then return null;end if;
 select * into r from mizizi_private.desk_tool_receipts_v1 where id=l.receipt_id;
 return jsonb_build_object('sourceReceiptId',r.id,'sourceResultSha256',r.result_sha256,'originLeadId',l.id);
end $f$;

create function public.mizizi_admit_desk_same_case_recall_v1(p_call_text text,p_call_sha256 text,p_receipt_id uuid,
 p_origin_id uuid,p_result_text text,p_result_sha256 text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare b jsonb;s jsonb;c jsonb;r mizizi_private.desk_tool_receipts_v1;fresh mizizi_private.desk_tool_receipts_v1;
 m jsonb;o mizizi_private.desk_operational_policy_versions_v1;l mizizi_private.desk_reference_leads_v1;new_lead uuid;meta jsonb;new_source uuid;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service-role required' using errcode='42501';end if;
 if p_call_text is null or octet_length(p_call_text) not between 1 and 4096
 or p_call_sha256 is distinct from encode(sha256(convert_to(p_call_text,'UTF8')),'hex')
 or p_result_text is null or octet_length(p_result_text) not between 1 and 30000
 or p_result_sha256 is distinct from encode(sha256(convert_to(p_result_text,'UTF8')),'hex')
 or p_receipt_id is null or p_origin_id is null or p_receipt_id=p_origin_id
 then raise exception 'Invalid recall binding' using errcode='22023';end if;
 b:=p_call_text::jsonb;s:=b->'scope';
 if jsonb_typeof(b) is distinct from 'object' or (select count(*) from jsonb_object_keys(b))<>2
 or b->'call' is distinct from jsonb_build_object('name','recall_evidence','input',jsonb_build_object('query','case evidence'))
 then return null;end if;
 perform pg_advisory_xact_lock(214781521,61431);
 c:=mizizi_private.desk_custody_context_v1(s);
 if c is null then return null;end if;
 o:=mizizi_private.current_desk_operational_policy_v1(c);
 if not coalesce(mizizi_private.desk_operational_policy_live_v1(o,c),false) or not o.adaptive_followups_allowed
 or not('recall_evidence'=any(o.tool_names)) then return null;end if;
 if exists(select 1 from mizizi_private.desk_tool_receipts_v1 q where q.job_id=(s->>'jobId')::uuid
  and q.lease_expires_at=(s->>'leaseExpiresAt')::timestamptz and q.operation='recall_evidence') then return null;end if;
 r:=mizizi_private.desk_same_case_recall_candidate_v1(c);
 if r.id is not null then
  if r.id is distinct from p_origin_id then return null;end if;
  new_source:=p_receipt_id;
  m:=mizizi_private.desk_same_case_recall_result_v1(r,p_receipt_id);
  meta:=jsonb_build_object('originReceiptId',r.id,'originResultSha256',r.result_sha256);
 else
  l:=mizizi_private.desk_same_case_lead_candidate_v1(c);
  if l.id is null or l.receipt_id is distinct from p_origin_id
   or coalesce(p_result_text::jsonb->'leads'->0->>'id','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then return null;end if;
  select * into r from mizizi_private.desk_tool_receipts_v1 where id=l.receipt_id;
  new_lead:=(p_result_text::jsonb->'leads'->0->>'id')::uuid;
  m:=mizizi_private.desk_same_case_lead_projection_v1(r,l,p_receipt_id,new_lead);
  meta:=jsonb_build_object('originReceiptId',r.id,'originResultSha256',r.result_sha256,'originLeadId',l.id);
 end if;
 if m is null or m is distinct from p_result_text::jsonb
 or public.mizizi_authorize_desk_model_operation_v1(s,'tool_execute',p_call_text,p_call_sha256)->>'allowed' is distinct from 'true'
 then return null;end if;
 insert into mizizi_private.desk_tool_receipts_v1(id,job_id,case_id,workspace_id,expected_revision,worker_id,lease_expires_at,
  membership_sha256,observation_sha256,operation,call_sha256,result_sha256,host,policy_revision,result_text,provenance,source_id,parent_receipt_id,operational_revision)
 values(p_receipt_id,(s->>'jobId')::uuid,r.case_id,r.workspace_id,r.expected_revision,s->>'workerId',
  (s->>'leaseExpiresAt')::timestamptz,r.membership_sha256,r.observation_sha256,'recall_evidence',p_call_sha256,p_result_sha256,
  r.host,r.policy_revision,p_result_text,jsonb_build_object('sameCaseRecall',meta),new_source,r.id,o.revision) returning * into fresh;
 if new_lead is not null then
  insert into mizizi_private.desk_reference_leads_v1(id,receipt_id,url,kind,label) values(new_lead,fresh.id,l.url,'reference',l.label);
 end if;
 if not coalesce(mizizi_private.desk_custody_receipt_current_v1(fresh,c),false) then
  raise exception 'Recall custody changed' using errcode='42501';end if;
 return jsonb_build_object('receiptId',fresh.id,'resultSha256',fresh.result_sha256,'outcome','created');
end $f$;

revoke all on function mizizi_private.desk_same_case_recall_result_v1(mizizi_private.desk_tool_receipts_v1,uuid),
 mizizi_private.desk_same_case_recall_current_v1(mizizi_private.desk_tool_receipts_v1,jsonb),
 mizizi_private.desk_same_case_recall_candidate_v1(jsonb),
 mizizi_private.desk_same_case_lead_candidate_v1(jsonb),
 mizizi_private.desk_same_case_lead_projection_v1(mizizi_private.desk_tool_receipts_v1,mizizi_private.desk_reference_leads_v1,uuid,uuid),
 public.mizizi_read_desk_same_case_recall_candidate_v1(jsonb),
 public.mizizi_admit_desk_same_case_recall_v1(text,text,uuid,uuid,text,text)
 from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_read_desk_same_case_recall_candidate_v1(jsonb),
 public.mizizi_admit_desk_same_case_recall_v1(text,text,uuid,uuid,text,text) to service_role;
do $guard$ begin
 if has_function_privilege('anon','public.mizizi_read_desk_same_case_recall_candidate_v1(jsonb)','EXECUTE')
 or has_function_privilege('authenticated','public.mizizi_admit_desk_same_case_recall_v1(text,text,uuid,uuid,text,text)','EXECUTE')
 or has_function_privilege('service_role','mizizi_private.desk_same_case_recall_candidate_v1(jsonb)','EXECUTE')
 or has_table_privilege('service_role','mizizi_private.desk_tool_receipts_v1','INSERT')
 then raise exception 'STOP_MIZIZI_RECALL_ACL';end if;
end $guard$;
commit;
