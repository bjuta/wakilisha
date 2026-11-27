-- Issue #1441: autonomous shared native candidate discovery and admission.
-- CLI 2.107.0 mint #45946017153, job 140330781435.
-- No new permission granted to existing policies. Exact quoted labels are
-- candidates only; no identity, canonical fact or independent corroboration.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
do $guard$ begin
 if current_user<>'postgres' or to_regprocedure('public.mizizi_admit_desk_shared_source_v1(text,text,uuid,jsonb,text,text)') is null
 or to_regprocedure('public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text)') is not null
 then raise exception 'STOP_MIZIZI_ENGINE_CONVERGENCE_PREIMAGE';end if;
end $guard$;
alter table mizizi_private.desk_operational_policy_versions_v1
 add column shared_native_auto_allowed boolean not null default false,
 add constraint mz_desk_shared_auto_enabled check(not shared_native_auto_allowed or
 (enabled and 'read_page'=any(tool_names) and 'search_web'=any(tool_names)));
-- The existing private receipt relation is the index, not a parallel search
-- database. Search only bounded original excerpts with exact postfilter.
create index mz_desk_native_source_text_search on mizizi_private.desk_tool_receipts_v1
 using gin(to_tsvector('simple'::regconfig,result_text))
 where operation='read_page' and source_id is not null and not(provenance ? 'sharedNative');
create or replace function mizizi_private.desk_shared_native_source_v1(r mizizi_private.desk_tool_receipts_v1)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $source$
declare s mizizi_private.chart_candidate_subjects_v1; c jsonb; item jsonb;a jsonb;
begin
 if r.id is null or r.source_id is distinct from r.id or r.operation<>'read_page'
 or r.provenance ? 'sharedNative'
 or exists(with recursive parents as (
  select d.id,d.parent_receipt_id,d.provenance,1 depth from mizizi_private.desk_tool_receipts_v1 d where d.id=r.parent_receipt_id
  union all select d.id,d.parent_receipt_id,d.provenance,p.depth+1 from parents p
   join mizizi_private.desk_tool_receipts_v1 d on d.id=p.parent_receipt_id where p.depth<200
 ) select 1 from parents where provenance ? 'sharedNative' or provenance ? 'sharedNativeSearch' or depth=200)
 or r.operational_revision is null or r.provenance->>'locator' not in ('plain_text','article_text')
 or r.provenance->>'contentType' not in ('text/plain','text/html','application/xhtml+xml')
 or r.result_sha256 is distinct from encode(sha256(convert_to(r.result_text,'UTF8')),'hex')
 then return null;end if;
 select * into s from mizizi_private.chart_candidate_subjects_v1
 where case_id=r.case_id and workspace_id=r.workspace_id;
 if not found or s.membership_sha256<>r.membership_sha256 or s.observation_sha256<>r.observation_sha256 then return null;end if;
 c:=jsonb_build_object('caseId',r.case_id,'workspaceId',r.workspace_id,'expectedRevision',r.expected_revision,
  'membershipSha256',s.membership_sha256,'observationSha256',s.observation_sha256,'leaseExpiresAt',r.lease_expires_at);
 if not coalesce(mizizi_private.desk_custody_receipt_current_v1(r,c),false) then return null;end if;
 if jsonb_typeof(r.result_text::jsonb->'sources') is distinct from 'array'
 or jsonb_array_length(r.result_text::jsonb->'sources')<>1 then return null;end if;
 item:=r.result_text::jsonb->'sources'->0;a:=item->'source';
 if a->>'sourceId' is distinct from r.id::text or a->>'caseId' is distinct from r.case_id::text
 or a->>'workspaceId' is distinct from r.workspace_id::text
 or a->>'fingerprint' is distinct from r.provenance->>'sourceSha256'
 or a->'privateResearchAllowed' is distinct from 'true'::jsonb
 or a->'privateEvidenceRetentionAllowed' is distinct from 'true'::jsonb
 or a->'revokedAt' is distinct from 'null'::jsonb
 or coalesce((a->>'expiresAt')::timestamptz<=clock_timestamp(),true)
 or jsonb_typeof(item->'excerpt') is distinct from 'string'
 or length(item->>'excerpt') not between 1 and 4000
 then return null;end if;
 return item;
end $source$;

create function mizizi_private.desk_shared_exact_label_v1(c jsonb)
returns jsonb language plpgsql immutable set search_path=pg_catalog as $f$
declare t text;a text;
begin
 if jsonb_typeof(c->'positions') is distinct from 'array' or jsonb_array_length(c->'positions') not between 1 and 600
 then return null;end if;
 t:=c->'positions'->0->>'title';a:=c->'positions'->0->>'artist';
 if t is null or a is null or length(t) not between 2 and 140 or length(a) not between 2 and 140
 or t<>btrim(t) or a<>btrim(a) or t~'[[:cntrl:]]' or a~'[[:cntrl:]]'
 or exists(select 1 from jsonb_array_elements(c->'positions') v where v->>'title' is distinct from t or v->>'artist' is distinct from a)
 then return null;end if;
 return jsonb_build_object('title',t,'artist',a);
end $f$;

create function mizizi_private.desk_shared_auto_match_v1(c jsonb,r mizizi_private.desk_tool_receipts_v1)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare labels jsonb;item jsonb;o mizizi_private.desk_operational_policy_versions_v1;
 origin mizizi_private.desk_operational_policy_versions_v1;ap mizizi_private.desk_access_policy_versions_v1;
 quote_text text;excerpt text;start_at integer;expiry timestamptz;u text;
begin
 labels:=mizizi_private.desk_shared_exact_label_v1(c);
 if labels is null or r.id is null or r.case_id::text=c->>'caseId' or r.workspace_id::text is distinct from c->>'workspaceId'
 then return null;end if;
 o:=mizizi_private.current_desk_operational_policy_v1(c);
 if not coalesce(mizizi_private.desk_operational_policy_live_v1(o,c),false) or not o.shared_native_auto_allowed
 then return null;end if;
 select * into origin from mizizi_private.desk_operational_policy_versions_v1
  where workspace_id=r.workspace_id and case_id=r.case_id and revision=r.operational_revision;
 if not found or not origin.shared_native_auto_allowed then return null;end if;
 item:=mizizi_private.desk_shared_native_source_v1(r);
 if item is null or item->'source'->'externalModelProcessingAllowed' is distinct from 'true'::jsonb then return null;end if;
 u:=r.provenance->>'finalUrl';
 if not coalesce(mizizi_private.desk_operational_url_allowed_v1(o,r.host,u,'native_text',r.policy_revision),false)
 then return null;end if;
 select * into ap from mizizi_private.desk_access_policy_versions_v1 where workspace_id=r.workspace_id
  and host=r.host and url_sha256=encode(sha256(convert_to(u,'UTF8')),'hex') and operation='native_text'
  order by revision desc limit 1;
 if ap.revision is not null and (not ap.enabled or ap.custody_revision is distinct from r.policy_revision or ap.valid_until<=clock_timestamp())
 then return null;end if;
 -- Deliberately conservative independent extraction: an exact standalone
 -- title/artist pair, not substring similarity, a model assertion, or a
 -- pair assembled from different sentences. Conflicting/duplicate spans miss.
 excerpt:=item->>'excerpt';
 quote_text:=(labels->>'title')||' by '||(labels->>'artist');
 start_at:=strpos(excerpt,quote_text);
 if start_at=0 or strpos(substring(excerpt from start_at+length(quote_text)),quote_text)>0
 or (start_at>1 and substring(excerpt from start_at-1 for 1)!~'[[:space:][:punct:]]')
 or (start_at+length(quote_text)<=length(excerpt) and substring(excerpt from start_at+length(quote_text) for 1)!~'[[:space:][:punct:]]')
 then return null;end if;
 expiry:=least(o.valid_until,origin.valid_until,(item->'source'->>'expiresAt')::timestamptz,
  mizizi_private.desk_shared_policy_expiry_v1(r.id),ap.valid_until);
 if expiry is null or expiry<=clock_timestamp() then return null;end if;
 return jsonb_build_object('sourceReceiptId',r.id,'sourceResultSha256',r.result_sha256,'fieldKey','recording_title',
  'spanStart',start_at,'spanLength',length(quote_text),'spanSha256',encode(sha256(convert_to(quote_text,'UTF8')),'hex'),
  'targetOperationalRevision',o.revision,'validUntil',expiry);
end $f$;

-- Historical readback checks the same independent attribution and current
-- permission; revoked or replaced grants cannot be silently reused.
create function mizizi_private.desk_shared_search_current_v1(r mizizi_private.desk_tool_receipts_v1,c jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog as $f$
declare m jsonb:=r.provenance->'sharedNativeSearch';origin mizizi_private.desk_tool_receipts_v1;
 g mizizi_private.desk_shared_attribution_versions_v1;fresh jsonb;entry jsonb;l mizizi_private.desk_reference_leads_v1;
begin
 if r.operation<>'search_web' or r.source_id is not null or r.parent_receipt_id is not null
 or jsonb_typeof(m) is distinct from 'object' or coalesce(m->>'sourceReceiptId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 or r.result_sha256 is distinct from encode(sha256(convert_to(r.result_text,'UTF8')),'hex')
 then return false;end if;
 select * into origin from mizizi_private.desk_tool_receipts_v1 where id=(m->>'sourceReceiptId')::uuid;
 if not found then return false;end if;
 fresh:=mizizi_private.desk_shared_auto_match_v1(c,origin);
 if fresh is null or fresh is distinct from m then return false;end if;
 select * into g from mizizi_private.desk_shared_attribution_versions_v1 where workspace_id=r.workspace_id
  and target_case_id=r.case_id and source_receipt_id=origin.id and field_key='recording_title' order by revision desc limit 1;
 if not found or g.revision<>1 or not g.enabled or not g.model_disclosure_allowed
 or g.authority_ref<>'standing:exact-native-label-pair:v1' or g.valid_until<=clock_timestamp()
 or g.source_result_sha256 is distinct from fresh->>'sourceResultSha256'
 or g.span_sha256 is distinct from fresh->>'spanSha256'
 or g.span_start is distinct from (fresh->>'spanStart')::integer
 or g.span_length is distinct from (fresh->>'spanLength')::integer
 or g.target_operational_revision is distinct from (fresh->>'targetOperationalRevision')::integer
 then return false;end if;
 entry:=r.result_text::jsonb->'leads'->0;
 if coalesce(entry->>'id','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then return false;end if;
 select * into l from mizizi_private.desk_reference_leads_v1 where id=(entry->>'id')::uuid and receipt_id=r.id;
 return coalesce(found and l.kind='reference' and l.label='Retained source candidate (unverified)'
  and l.url=origin.provenance->>'finalUrl' and r.host=origin.host and r.policy_revision=origin.policy_revision
  and r.result_text::jsonb=jsonb_build_object('receiptId',r.id,'leads',jsonb_build_array(jsonb_build_object(
    'id',l.id,'kind','reference','label',l.label)),'sources','[]'::jsonb,'visual',null),false);
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
  'sharedNativeAutoAllowed',o.shared_native_auto_allowed,
  'adaptiveFollowupsAllowed',o.adaptive_followups_allowed,'publicQueryTerms',to_jsonb(o.public_query_terms),
  'validUntil',least(o.valid_until,(c->>'leaseExpiresAt')::timestamptz));
end $f$;

-- The existing search_web action first checks qualified retained material.
-- Its opaque lead is a real receiving receipt with explicit reused-source
-- provenance, not a fabricated provider reservation or search result.
create function public.mizizi_use_desk_shared_search_v1(p_call_text text,p_call_sha256 text,p_receipt_id uuid,p_lead_id uuid,
 p_result_text text,p_result_sha256 text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare b jsonb;s jsonb;c jsonb;labels jsonb;m jsonb;selected jsonb;candidate mizizi_private.desk_tool_receipts_v1;
 origin mizizi_private.desk_tool_receipts_v1;previous mizizi_private.desk_tool_receipts_v1;g mizizi_private.desk_shared_attribution_versions_v1;
 o mizizi_private.desk_operational_policy_versions_v1;query_text text;n integer:=0;ts tsquery;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service-role required' using errcode='42501';end if;
 if p_call_text is null or octet_length(p_call_text) not between 1 and 4096
 or p_call_sha256 is distinct from encode(sha256(convert_to(p_call_text,'UTF8')),'hex')
 or p_result_text is null or octet_length(p_result_text) not between 1 and 30000
 or p_result_sha256 is distinct from encode(sha256(convert_to(p_result_text,'UTF8')),'hex')
 or p_receipt_id is null or p_lead_id is null or p_receipt_id=p_lead_id
 then raise exception 'Invalid shared search binding' using errcode='22023';end if;
 b:=p_call_text::jsonb;s:=b->'scope';query_text:=b->'call'->'input'->>'query';
 if jsonb_typeof(b) is distinct from 'object' or jsonb_typeof(b->'call') is distinct from 'object'
 or jsonb_typeof(b->'call'->'input') is distinct from 'object' or (select count(*) from jsonb_object_keys(b))<>2
 or (select count(*) from jsonb_object_keys(b->'call'))<>2 or (select count(*) from jsonb_object_keys(b->'call'->'input'))<>1
 or b->'call'->>'name' is distinct from 'search_web' or jsonb_typeof(b->'call'->'input'->'query') is distinct from 'string'
 or p_result_text::jsonb is distinct from jsonb_build_object('receiptId',p_receipt_id,'leads',jsonb_build_array(
 jsonb_build_object('id',p_lead_id,'kind','reference','label','Retained source candidate (unverified)')),'sources','[]'::jsonb,'visual',null)
 then return null;end if;
 perform pg_advisory_xact_lock(214781521,61431);
 c:=mizizi_private.desk_custody_context_v1(s);
 if c is null then return null;end if;
 o:=mizizi_private.current_desk_operational_policy_v1(c);
 labels:=mizizi_private.desk_shared_exact_label_v1(c);
 if labels is null or not coalesce(mizizi_private.desk_operational_policy_live_v1(o,c),false) or not o.shared_native_auto_allowed
 or query_text not in (labels->>'title',(labels->>'title')||' '||(labels->>'artist'))
 or public.mizizi_authorize_desk_model_operation_v1(s,'tool_execute',p_call_text,p_call_sha256) is null
 then return null;end if;
 select * into previous from mizizi_private.desk_tool_receipts_v1 where job_id=(s->>'jobId')::uuid
  and lease_expires_at=(s->>'leaseExpiresAt')::timestamptz and call_sha256=p_call_sha256;
 if found then
  if previous.id=p_receipt_id and previous.result_text=p_result_text and previous.result_sha256=p_result_sha256
   and previous.provenance ? 'sharedNativeSearch' and mizizi_private.desk_custody_receipt_current_v1(previous,c)
  then return jsonb_build_object('receiptId',p_receipt_id,'resultSha256',p_result_sha256,'outcome','replayed');end if;
  raise exception 'Shared search receipt replay conflict' using errcode='PT409';
 end if;
 ts:=plainto_tsquery('simple'::regconfig,(labels->>'title')||' '||(labels->>'artist'));
 if numnode(ts)=0 then return null;end if;
 for candidate in select d.* from mizizi_private.desk_tool_receipts_v1 d
  where d.workspace_id=(c->>'workspaceId')::uuid and d.case_id<>(c->>'caseId')::uuid
   and d.operation='read_page' and d.source_id is not null and not(d.provenance ? 'sharedNative')
   and to_tsvector('simple'::regconfig,d.result_text) @@ ts
  order by d.id limit 33
 loop
  n:=n+1;if n>32 then return null;end if;
  m:=mizizi_private.desk_shared_auto_match_v1(c,candidate);
  if m is null then continue;end if;
  select * into g from mizizi_private.desk_shared_attribution_versions_v1 where workspace_id=candidate.workspace_id
   and target_case_id=(c->>'caseId')::uuid and source_receipt_id=candidate.id and field_key='recording_title'
   order by revision desc limit 1;
  -- Never override a human decision, candidate-only grant or revocation.
  if found and (g.revision<>1 or not g.enabled or not g.model_disclosure_allowed
   or g.authority_ref<>'standing:exact-native-label-pair:v1' or g.valid_until<=clock_timestamp()
   or g.span_sha256 is distinct from m->>'spanSha256' or g.target_operational_revision is distinct from o.revision)
  then continue;end if;
  if exists(select 1 from mizizi_private.desk_shared_attribution_versions_v1 a
   where a.workspace_id=candidate.workspace_id and a.target_case_id=(c->>'caseId')::uuid
   and a.source_receipt_id=candidate.id and a.field_key<>'recording_title') then continue;end if;
  if selected is not null then return null;end if;
  selected:=m;origin:=candidate;
 end loop;
 if selected is null or (select count(*) from mizizi_private.desk_tool_receipts_v1 where case_id=(c->>'caseId')::uuid)>=200 then return null;end if;
 if not exists(select 1 from mizizi_private.desk_shared_attribution_versions_v1 a where a.workspace_id=origin.workspace_id
  and a.target_case_id=(c->>'caseId')::uuid and a.source_receipt_id=origin.id and a.field_key='recording_title') then
  insert into mizizi_private.desk_shared_attribution_versions_v1(workspace_id,target_case_id,source_receipt_id,field_key,
   revision,enabled,expected_revision,target_operational_revision,membership_sha256,observation_sha256,source_result_sha256,
   span_start,span_length,span_sha256,authority_ref,valid_until,model_disclosure_allowed)
  values(origin.workspace_id,(c->>'caseId')::uuid,origin.id,'recording_title',1,true,(c->>'expectedRevision')::integer,
   o.revision,c->>'membershipSha256',c->>'observationSha256',origin.result_sha256,(selected->>'spanStart')::integer,
   (selected->>'spanLength')::integer,selected->>'spanSha256','standing:exact-native-label-pair:v1',(selected->>'validUntil')::timestamptz,true);
 end if;
 insert into mizizi_private.desk_tool_receipts_v1(id,job_id,case_id,workspace_id,expected_revision,worker_id,lease_expires_at,
  membership_sha256,observation_sha256,operation,call_sha256,result_sha256,host,policy_revision,result_text,provenance,operational_revision)
 values(p_receipt_id,(s->>'jobId')::uuid,(c->>'caseId')::uuid,(c->>'workspaceId')::uuid,(c->>'expectedRevision')::integer,
  s->>'workerId',(s->>'leaseExpiresAt')::timestamptz,c->>'membershipSha256',c->>'observationSha256','search_web',p_call_sha256,
  p_result_sha256,origin.host,origin.policy_revision,p_result_text,jsonb_build_object('sharedNativeSearch',selected),o.revision)
 returning * into previous;
 insert into mizizi_private.desk_reference_leads_v1(id,receipt_id,url,kind,label)
 values(p_lead_id,p_receipt_id,origin.provenance->>'finalUrl','reference','Retained source candidate (unverified)');
 if not coalesce(mizizi_private.desk_custody_receipt_current_v1(previous,c),false)
 then raise exception 'Shared search authority changed' using errcode='42501';end if;
 return jsonb_build_object('receiptId',p_receipt_id,'resultSha256',p_result_sha256,'outcome','created');
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
   or coalesce(b->>'questionSha256','') !~ '^[0-9a-f]{64}
 mizizi_private.desk_shared_auto_match_v1(jsonb,mizizi_private.desk_tool_receipts_v1),
 mizizi_private.desk_shared_search_current_v1(mizizi_private.desk_tool_receipts_v1,jsonb),
 public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) to service_role;
do $acl$ begin
 if has_function_privilege('authenticated','public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text)','EXECUTE')
 or has_table_privilege('service_role','mizizi_private.desk_shared_attribution_versions_v1','INSERT')
 then raise exception 'STOP_MIZIZI_AUTO_SHARED_ACL';end if;
end $acl$;
commit;

   or coalesce(b->>'requestSha256','') !~ '^[0-9a-f]{64}
 mizizi_private.desk_shared_auto_match_v1(jsonb,mizizi_private.desk_tool_receipts_v1),
 mizizi_private.desk_shared_search_current_v1(mizizi_private.desk_tool_receipts_v1,jsonb),
 public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) to service_role;
do $acl$ begin
 if has_function_privilege('authenticated','public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text)','EXECUTE')
 or has_table_privilege('service_role','mizizi_private.desk_shared_attribution_versions_v1','INSERT')
 then raise exception 'STOP_MIZIZI_AUTO_SHARED_ACL';end if;
end $acl$;
commit;

   or coalesce(b->>'bodySha256','') !~ '^[0-9a-f]{64}
 mizizi_private.desk_shared_auto_match_v1(jsonb,mizizi_private.desk_tool_receipts_v1),
 mizizi_private.desk_shared_search_current_v1(mizizi_private.desk_tool_receipts_v1,jsonb),
 public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) to service_role;
do $acl$ begin
 if has_function_privilege('authenticated','public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text)','EXECUTE')
 or has_table_privilege('service_role','mizizi_private.desk_shared_attribution_versions_v1','INSERT')
 then raise exception 'STOP_MIZIZI_AUTO_SHARED_ACL';end if;
end $acl$;
commit;

   or coalesce(b->>'credentialSha256','') !~ '^[0-9a-f]{64}
 mizizi_private.desk_shared_auto_match_v1(jsonb,mizizi_private.desk_tool_receipts_v1),
 mizizi_private.desk_shared_search_current_v1(mizizi_private.desk_tool_receipts_v1,jsonb),
 public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) to service_role;
do $acl$ begin
 if has_function_privilege('authenticated','public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text)','EXECUTE')
 or has_table_privilege('service_role','mizizi_private.desk_shared_attribution_versions_v1','INSERT')
 then raise exception 'STOP_MIZIZI_AUTO_SHARED_ACL';end if;
end $acl$;
commit;

   or coalesce(b->>'model','') !~ '^[A-Za-z0-9._:-]{3,100}
 mizizi_private.desk_shared_auto_match_v1(jsonb,mizizi_private.desk_tool_receipts_v1),
 mizizi_private.desk_shared_search_current_v1(mizizi_private.desk_tool_receipts_v1,jsonb),
 public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) to service_role;
do $acl$ begin
 if has_function_privilege('authenticated','public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text)','EXECUTE')
 or has_table_privilege('service_role','mizizi_private.desk_shared_attribution_versions_v1','INSERT')
 then raise exception 'STOP_MIZIZI_AUTO_SHARED_ACL';end if;
end $acl$;
commit;

   or jsonb_typeof(b->'round') is distinct from 'number' or coalesce(b->>'round','') !~ '^[1-5]
 mizizi_private.desk_shared_auto_match_v1(jsonb,mizizi_private.desk_tool_receipts_v1),
 mizizi_private.desk_shared_search_current_v1(mizizi_private.desk_tool_receipts_v1,jsonb),
 public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) to service_role;
do $acl$ begin
 if has_function_privilege('authenticated','public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text)','EXECUTE')
 or has_table_privilege('service_role','mizizi_private.desk_shared_attribution_versions_v1','INSERT')
 then raise exception 'STOP_MIZIZI_AUTO_SHARED_ACL';end if;
end $acl$;
commit;

   or jsonb_typeof(b->'requestBytes') is distinct from 'number' or coalesce(b->>'requestBytes','') !~ '^[1-9][0-9]{0,6}
 mizizi_private.desk_shared_auto_match_v1(jsonb,mizizi_private.desk_tool_receipts_v1),
 mizizi_private.desk_shared_search_current_v1(mizizi_private.desk_tool_receipts_v1,jsonb),
 public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) to service_role;
do $acl$ begin
 if has_function_privilege('authenticated','public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text)','EXECUTE')
 or has_table_privilege('service_role','mizizi_private.desk_shared_attribution_versions_v1','INSERT')
 then raise exception 'STOP_MIZIZI_AUTO_SHARED_ACL';end if;
end $acl$;
commit;

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
    or coalesce(item->>'receiptId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}
 mizizi_private.desk_shared_auto_match_v1(jsonb,mizizi_private.desk_tool_receipts_v1),
 mizizi_private.desk_shared_search_current_v1(mizizi_private.desk_tool_receipts_v1,jsonb),
 public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) to service_role;
do $acl$ begin
 if has_function_privilege('authenticated','public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text)','EXECUTE')
 or has_table_privilege('service_role','mizizi_private.desk_shared_attribution_versions_v1','INSERT')
 then raise exception 'STOP_MIZIZI_AUTO_SHARED_ACL';end if;
end $acl$;
commit;

    or coalesce(item->>'callSha256','') !~ '^[0-9a-f]{64}
 mizizi_private.desk_shared_auto_match_v1(jsonb,mizizi_private.desk_tool_receipts_v1),
 mizizi_private.desk_shared_search_current_v1(mizizi_private.desk_tool_receipts_v1,jsonb),
 public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) to service_role;
do $acl$ begin
 if has_function_privilege('authenticated','public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text)','EXECUTE')
 or has_table_privilege('service_role','mizizi_private.desk_shared_attribution_versions_v1','INSERT')
 then raise exception 'STOP_MIZIZI_AUTO_SHARED_ACL';end if;
end $acl$;
commit;

    or coalesce(item->>'resultSha256','') !~ '^[0-9a-f]{64}
 mizizi_private.desk_shared_auto_match_v1(jsonb,mizizi_private.desk_tool_receipts_v1),
 mizizi_private.desk_shared_search_current_v1(mizizi_private.desk_tool_receipts_v1,jsonb),
 public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) to service_role;
do $acl$ begin
 if has_function_privilege('authenticated','public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text)','EXECUTE')
 or has_table_privilege('service_role','mizizi_private.desk_shared_attribution_versions_v1','INSERT')
 then raise exception 'STOP_MIZIZI_AUTO_SHARED_ACL';end if;
end $acl$;
commit;
 then return null;end if;
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
   if jsonb_typeof(item) is distinct from 'string' or coalesce(item#>>'{}','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}
 mizizi_private.desk_shared_auto_match_v1(jsonb,mizizi_private.desk_tool_receipts_v1),
 mizizi_private.desk_shared_search_current_v1(mizizi_private.desk_tool_receipts_v1,jsonb),
 public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) to service_role;
do $acl$ begin
 if has_function_privilege('authenticated','public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text)','EXECUTE')
 or has_table_privilege('service_role','mizizi_private.desk_shared_attribution_versions_v1','INSERT')
 then raise exception 'STOP_MIZIZI_AUTO_SHARED_ACL';end if;
end $acl$;
commit;
 then return null;end if;
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
   if coalesce(i->>'lead_id','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}
 mizizi_private.desk_shared_auto_match_v1(jsonb,mizizi_private.desk_tool_receipts_v1),
 mizizi_private.desk_shared_search_current_v1(mizizi_private.desk_tool_receipts_v1,jsonb),
 public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) to service_role;
do $acl$ begin
 if has_function_privilege('authenticated','public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text)','EXECUTE')
 or has_table_privilege('service_role','mizizi_private.desk_shared_attribution_versions_v1','INSERT')
 then raise exception 'STOP_MIZIZI_AUTO_SHARED_ACL';end if;
end $acl$;
commit;
 then return null;end if;
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
     or coalesce(i->>'page_start','') !~ '^[1-9][0-9]{0,4}
 mizizi_private.desk_shared_auto_match_v1(jsonb,mizizi_private.desk_tool_receipts_v1),
 mizizi_private.desk_shared_search_current_v1(mizizi_private.desk_tool_receipts_v1,jsonb),
 public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) to service_role;
do $acl$ begin
 if has_function_privilege('authenticated','public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text)','EXECUTE')
 or has_table_privilege('service_role','mizizi_private.desk_shared_attribution_versions_v1','INSERT')
 then raise exception 'STOP_MIZIZI_AUTO_SHARED_ACL';end if;
end $acl$;
commit;
 or coalesce(i->>'page_end','') !~ '^[1-9][0-9]{0,4}
 mizizi_private.desk_shared_auto_match_v1(jsonb,mizizi_private.desk_tool_receipts_v1),
 mizizi_private.desk_shared_search_current_v1(mizizi_private.desk_tool_receipts_v1,jsonb),
 public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) to service_role;
do $acl$ begin
 if has_function_privilege('authenticated','public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text)','EXECUTE')
 or has_table_privilege('service_role','mizizi_private.desk_shared_attribution_versions_v1','INSERT')
 then raise exception 'STOP_MIZIZI_AUTO_SHARED_ACL';end if;
end $acl$;
commit;
 then return null;end if;
    if (i->>'page_end')::integer>10000 or (i->>'page_end')::integer-(i->>'page_start')::integer not between 0 and 9 then return null;end if;
   elsif op='inspect_visual' then
    if (select count(*) from jsonb_object_keys(i))<>2 or jsonb_typeof(i->'page') is distinct from 'number'
     or coalesce(i->>'page','') !~ '^[1-9][0-9]{0,4}
 mizizi_private.desk_shared_auto_match_v1(jsonb,mizizi_private.desk_tool_receipts_v1),
 mizizi_private.desk_shared_search_current_v1(mizizi_private.desk_tool_receipts_v1,jsonb),
 public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) to service_role;
do $acl$ begin
 if has_function_privilege('authenticated','public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text)','EXECUTE')
 or has_table_privilege('service_role','mizizi_private.desk_shared_attribution_versions_v1','INSERT')
 then raise exception 'STOP_MIZIZI_AUTO_SHARED_ACL';end if;
end $acl$;
commit;
 then return null;end if;
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
  if r.provenance ? 'sharedNative' then
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
revoke all on function mizizi_private.desk_shared_exact_label_v1(jsonb),
 mizizi_private.desk_shared_auto_match_v1(jsonb,mizizi_private.desk_tool_receipts_v1),
 mizizi_private.desk_shared_search_current_v1(mizizi_private.desk_tool_receipts_v1,jsonb),
 public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text) to service_role;
do $acl$ begin
 if has_function_privilege('authenticated','public.mizizi_use_desk_shared_search_v1(text,text,uuid,uuid,text,text)','EXECUTE')
 or has_table_privilege('service_role','mizizi_private.desk_shared_attribution_versions_v1','INSERT')
 then raise exception 'STOP_MIZIZI_AUTO_SHARED_ACL';end if;
end $acl$;
commit;
