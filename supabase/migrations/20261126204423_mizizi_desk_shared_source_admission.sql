-- Issue #1441. CLI 2.107.0 mint #45893179956 job 140160583560.
-- Reuse a separately authorized field through the existing read_page receipt,
-- exact model envelope and journal authorities; never relabel a foreign receipt.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
do $guard$ begin
 if current_user<>'postgres'
 or to_regclass('mizizi_private.desk_shared_attribution_versions_v1') is null
 or to_regprocedure('public.mizizi_offer_desk_shared_source_v1(text,text,uuid)') is not null
 then raise exception 'STOP_MIZIZI_SHARED_ADMISSION_PREIMAGE';end if;
end $guard$;
-- Existing candidate-only grants do not acquire model disclosure rights.
alter table mizizi_private.desk_shared_attribution_versions_v1
 add column model_disclosure_allowed boolean not null default false,
 add constraint desk_shared_disclosure_enabled check(not model_disclosure_allowed or enabled);

create or replace function mizizi_private.desk_shared_native_source_v1(r mizizi_private.desk_tool_receipts_v1)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $source$
declare s mizizi_private.chart_candidate_subjects_v1; c jsonb; item jsonb;a jsonb;
begin
 if r.id is null or r.source_id is distinct from r.id or r.operation<>'read_page'
 or r.provenance ? 'sharedNative'
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

-- Only immutable policy expirations (not an old worker lease or proof send
-- window) are used for historical receipt validity. Current revisions and
-- all ancestry are separately checked by the existing custody predicate.
create function mizizi_private.desk_shared_policy_expiry_v1(p_receipt_id uuid)
returns timestamptz language sql stable security definer set search_path=pg_catalog as $f$
 with recursive chain as (
  select r.*,1 as depth from mizizi_private.desk_tool_receipts_v1 r where r.id=p_receipt_id
  union all
  select r.*,c.depth+1 from chain c join mizizi_private.desk_tool_receipts_v1 r on r.id=c.parent_receipt_id
  where c.depth<200
 )
 select min(least(cp.valid_until,o.valid_until,mp.valid_until,ap.valid_until))
 from chain c
 join mizizi_private.desk_custody_policy_versions_v1 cp on cp.workspace_id=c.workspace_id and cp.host=c.host and cp.revision=c.policy_revision
 left join mizizi_private.desk_operational_policy_versions_v1 o on o.workspace_id=c.workspace_id and o.case_id=c.case_id and o.revision=c.operational_revision
 left join mizizi_private.desk_operational_call_proofs_v1 q on q.job_id=c.job_id and q.lease_expires_at=c.lease_expires_at and q.call_sha256=c.call_sha256
 left join mizizi_private.desk_model_authority_versions_v1 mp on q.operation='tool_execute' and mp.workspace_id=c.workspace_id
  and mp.case_id=c.case_id and mp.operation=q.operation and mp.binding_sha256=q.binding_sha256 and mp.revision=q.exact_revision
 left join mizizi_private.desk_access_policy_versions_v1 ap on q.operation<>'tool_execute' and ap.workspace_id=c.workspace_id
  and ap.host=q.host and ap.url_sha256=q.url_sha256 and ap.operation=q.operation and ap.revision=q.exact_revision
$f$;

-- Same deterministic projection at offer, append and historical readback.
-- Only a native original is eligible. No shared-to-shared propagation.
create function mizizi_private.desk_shared_admission_material_v1(
 c jsonb,g mizizi_private.desk_shared_attribution_versions_v1,r mizizi_private.desk_tool_receipts_v1,
 p_receipt_id uuid,p_parent_id uuid,p_call_sha256 text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare o mizizi_private.desk_operational_policy_versions_v1; ap mizizi_private.desk_access_policy_versions_v1;
 parent mizizi_private.desk_tool_receipts_v1;item jsonb;a jsonb;quote_text text;u text;expiry timestamptz;
 origin_expiry timestamptz;parent_expiry timestamptz;
 tool_policy mizizi_private.desk_model_authority_versions_v1;
begin
 if c is null or g.revision is null or not g.enabled or not g.model_disclosure_allowed
 or g.valid_until<=clock_timestamp() or g.workspace_id::text is distinct from c->>'workspaceId'
 or g.target_case_id::text is distinct from c->>'caseId' or g.expected_revision::text is distinct from c->>'expectedRevision'
 or g.membership_sha256 is distinct from c->>'membershipSha256' or g.observation_sha256 is distinct from c->>'observationSha256'
 or r.id is distinct from g.source_receipt_id or r.case_id=g.target_case_id or r.workspace_id<>g.workspace_id
 or r.result_sha256 is distinct from g.source_result_sha256 or p_receipt_id is null or p_receipt_id=r.id
 or exists(select 1 from mizizi_private.desk_shared_attribution_versions_v1 later
  where later.workspace_id=g.workspace_id and later.target_case_id=g.target_case_id
   and later.source_receipt_id=g.source_receipt_id and later.field_key=g.field_key and later.revision>g.revision)
 then return null;end if;
 o:=mizizi_private.current_desk_operational_policy_v1(c);
 u:=r.provenance->>'finalUrl';
 if not coalesce(mizizi_private.desk_operational_policy_live_v1(o,c),false) or o.revision is distinct from g.target_operational_revision
 or not('read_page'=any(o.tool_names))
 or not coalesce(mizizi_private.desk_operational_url_allowed_v1(o,r.host,u,'native_text',r.policy_revision),false)
 then return null;end if;
 select * into parent from mizizi_private.desk_tool_receipts_v1 where id=p_parent_id;
 if not found or parent.provenance ? 'sharedNative' or not coalesce(mizizi_private.desk_custody_receipt_current_v1(parent,c),false)
 then return null;end if;
 select * into ap from mizizi_private.desk_access_policy_versions_v1 where workspace_id=g.workspace_id
  and host=r.host and url_sha256=encode(sha256(convert_to(u,'UTF8')),'hex') and operation='native_text'
  order by revision desc limit 1;
 if ap.revision is not null and (not ap.enabled or ap.custody_revision is distinct from r.policy_revision or ap.valid_until<=clock_timestamp())
 then return null;end if;
 select * into tool_policy from mizizi_private.desk_model_authority_versions_v1 where workspace_id=g.workspace_id
  and case_id=g.target_case_id and operation='tool_execute' and binding_sha256=p_call_sha256 order by revision desc limit 1;
 if tool_policy.revision is not null and (not tool_policy.enabled or tool_policy.valid_until<=clock_timestamp()) then return null;end if;
 item:=mizizi_private.desk_shared_native_source_v1(r);
 if item is null then return null;end if;
 a:=item->'source';quote_text:=substring(item->>'excerpt' from g.span_start for g.span_length);
 if length(quote_text) is distinct from g.span_length or encode(sha256(convert_to(quote_text,'UTF8')),'hex') is distinct from g.span_sha256
 or a->'externalModelProcessingAllowed' is distinct from 'true'::jsonb then return null;end if;
 origin_expiry:=mizizi_private.desk_shared_policy_expiry_v1(r.id);
 parent_expiry:=mizizi_private.desk_shared_policy_expiry_v1(parent.id);
 if origin_expiry is null or parent_expiry is null then return null;end if;
 expiry:=least(g.valid_until,o.valid_until,(a->>'expiresAt')::timestamptz,origin_expiry,parent_expiry,ap.valid_until,tool_policy.valid_until);
 if expiry<=clock_timestamp() then return null;end if;
 return jsonb_build_object('contract','mizizi.desk_shared_source_offer.v1',
  'sourceReceiptId',r.id,'sourceResultSha256',r.result_sha256,'fieldKey',g.field_key,'attributionRevision',g.revision,
  'spanSha256',g.span_sha256,'finalUrl',u,'host',r.host,'policyRevision',r.policy_revision,
  'parentReceiptId',parent.id,'operationalRevision',o.revision,'result',jsonb_build_object(
   'receiptId',p_receipt_id,'leads','[]'::jsonb,'visual',null,'sources',jsonb_build_array(jsonb_build_object(
    'source',a||jsonb_build_object('sourceId',p_receipt_id,'caseId',g.target_case_id,'expiresAt',expiry),
    'excerpt',quote_text,'citation',item->>'citation'))));
end $f$;

create function mizizi_private.desk_shared_receipt_current_v1(r mizizi_private.desk_tool_receipts_v1,c jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog as $f$
declare d jsonb:=r.provenance->'sharedNative';g mizizi_private.desk_shared_attribution_versions_v1;
 origin mizizi_private.desk_tool_receipts_v1; m jsonb;
begin
 if r.operation<>'read_page' or r.source_id is distinct from r.id or r.parent_receipt_id is null
 or jsonb_typeof(d) is distinct from 'object' or coalesce(d->>'sourceReceiptId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 or coalesce(d->>'attributionRevision','') !~ '^[1-9][0-9]{0,8}$'
 or r.result_sha256 is distinct from encode(sha256(convert_to(r.result_text,'UTF8')),'hex')
 then return false;end if;
 select * into g from mizizi_private.desk_shared_attribution_versions_v1 where workspace_id=r.workspace_id
  and target_case_id=r.case_id and source_receipt_id=(d->>'sourceReceiptId')::uuid
  and field_key=d->>'fieldKey' and revision=(d->>'attributionRevision')::integer;
 if not found then return false;end if;
 select * into origin from mizizi_private.desk_tool_receipts_v1 where id=g.source_receipt_id;
 if not found then return false;end if;
 m:=mizizi_private.desk_shared_admission_material_v1(c,g,origin,r.id,r.parent_receipt_id,r.call_sha256);
 return coalesce(m is not null and m->'result'=r.result_text::jsonb
  and m-'result'=d and r.host=m->>'host' and r.policy_revision=(m->>'policyRevision')::integer
  and r.operational_revision=(m->>'operationalRevision')::integer,false);
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

-- The exact current opaque lead, tool permission and receiving grant must
-- all exist. Ambiguous multiple field offers deliberately take the existing
-- native path rather than picking an attribution. No model is sent an offer.
create function public.mizizi_offer_desk_shared_source_v1(p_call_text text,p_call_sha256 text,p_receipt_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare b jsonb;s jsonb;c jsonb; l mizizi_private.desk_reference_leads_v1;
 parent mizizi_private.desk_tool_receipts_v1;origin mizizi_private.desk_tool_receipts_v1;
 o mizizi_private.desk_operational_policy_versions_v1;g mizizi_private.desk_shared_attribution_versions_v1;
 m jsonb;answer jsonb;candidate record;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service-role required' using errcode='42501';end if;
 if p_call_text is null or octet_length(p_call_text) not between 1 and 4096
 or p_call_sha256 is distinct from encode(sha256(convert_to(p_call_text,'UTF8')),'hex') or p_receipt_id is null
 then raise exception 'Invalid shared call binding' using errcode='22023';end if;
 b:=p_call_text::jsonb;s:=b->'scope';
 if jsonb_typeof(b) is distinct from 'object' or jsonb_typeof(b->'call') is distinct from 'object'
 or jsonb_typeof(b->'call'->'input') is distinct from 'object' then return null;end if;
 if (select count(*) from jsonb_object_keys(b))<>2 or (select count(*) from jsonb_object_keys(b->'call'))<>2
 or b->'call'->>'name' is distinct from 'read_page' or (select count(*) from jsonb_object_keys(b->'call'->'input'))<>1
 or coalesce(b->'call'->'input'->>'lead_id','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 then return null;end if;
 perform pg_advisory_xact_lock(214781521,61431);
 c:=mizizi_private.desk_custody_context_v1(s);
 if c is null then return null;end if;
 o:=mizizi_private.current_desk_operational_policy_v1(c);
 if not coalesce(mizizi_private.desk_operational_policy_live_v1(o,c),false)
 or not exists(select 1 from mizizi_private.desk_operational_call_proofs_v1 q
  where q.job_id=(s->>'jobId')::uuid and q.lease_expires_at=(s->>'leaseExpiresAt')::timestamptz
   and q.call_sha256=p_call_sha256 and q.operation='tool_execute' and q.binding_sha256=p_call_sha256
   and q.standing_revision=o.revision and q.valid_until>clock_timestamp())
 then return null;end if;
 if public.mizizi_authorize_desk_model_operation_v1(s,'tool_execute',p_call_text,p_call_sha256) is null then return null;end if;
 select * into l from mizizi_private.desk_reference_leads_v1 where id=(b->'call'->'input'->>'lead_id')::uuid;
 if not found or l.kind<>'reference' then return null;end if;
 select * into parent from mizizi_private.desk_tool_receipts_v1 where id=l.receipt_id;
 if not found or parent.job_id::text is distinct from s->>'jobId' or parent.worker_id is distinct from s->>'workerId'
 or parent.lease_expires_at is distinct from (s->>'leaseExpiresAt')::timestamptz
 or not coalesce(mizizi_private.desk_custody_receipt_current_v1(parent,c),false) then return null;end if;
 -- Latest revision per exact source/field, never fall back to an older grant.
 for candidate in
  select v.source_receipt_id,v.field_key,v.revision from (
   select distinct on (a.source_receipt_id,a.field_key) a.* from mizizi_private.desk_shared_attribution_versions_v1 a
   where a.workspace_id=(c->>'workspaceId')::uuid and a.target_case_id=(c->>'caseId')::uuid
   order by a.source_receipt_id,a.field_key,a.revision desc
  ) v join mizizi_private.desk_tool_receipts_v1 d on d.id=v.source_receipt_id
  where v.enabled and v.model_disclosure_allowed and v.valid_until>clock_timestamp()
   and d.provenance->>'finalUrl'=l.url order by v.source_receipt_id,v.field_key limit 2
 loop
  if answer is not null then return null;end if;
  select * into strict g from mizizi_private.desk_shared_attribution_versions_v1 where workspace_id=(c->>'workspaceId')::uuid
   and target_case_id=(c->>'caseId')::uuid and source_receipt_id=candidate.source_receipt_id
   and field_key=candidate.field_key and revision=candidate.revision;
  select * into strict origin from mizizi_private.desk_tool_receipts_v1 where id=g.source_receipt_id;
  m:=mizizi_private.desk_shared_admission_material_v1(c,g,origin,p_receipt_id,parent.id,p_call_sha256);
  if m is null then return null;end if;
  answer:=m;
 end loop;
 return answer;
end $f$;

create function public.mizizi_admit_desk_shared_source_v1(p_call_text text,p_call_sha256 text,p_receipt_id uuid,
 p_offer jsonb,p_result_text text,p_result_sha256 text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare s jsonb;c jsonb;m jsonb;old mizizi_private.desk_tool_receipts_v1;inserted mizizi_private.desk_tool_receipts_v1;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service-role required' using errcode='42501';end if;
 if p_result_text is null or octet_length(p_result_text) not between 1 and 30000
 or p_result_sha256 is distinct from encode(sha256(convert_to(p_result_text,'UTF8')),'hex')
 or jsonb_typeof(p_offer) is distinct from 'object' or octet_length(p_offer::text)>32000
 then raise exception 'Invalid shared result binding' using errcode='22023';end if;
 perform pg_advisory_xact_lock(214781521,61431);
 m:=public.mizizi_offer_desk_shared_source_v1(p_call_text,p_call_sha256,p_receipt_id);
 if m is null or m is distinct from p_offer or m->'result' is distinct from p_result_text::jsonb then return null;end if;
 s:=p_call_text::jsonb->'scope';c:=mizizi_private.desk_custody_context_v1(s);
 if c is null or not exists(select 1 from mizizi_private.desk_operational_call_proofs_v1 q
  where q.job_id=(s->>'jobId')::uuid and q.lease_expires_at=(s->>'leaseExpiresAt')::timestamptz and q.call_sha256=p_call_sha256
   and q.operation='native_text' and q.standing_revision=(m->>'operationalRevision')::integer
   and q.host=m->>'host' and q.custody_revision=(m->>'policyRevision')::integer
   and q.url_sha256=encode(sha256(convert_to(m->>'finalUrl','UTF8')),'hex')
   and q.source_sha256=m->'result'->'sources'->0->'source'->>'fingerprint'
   and q.page_start=1 and q.page_end=10 and q.valid_until>clock_timestamp()) then return null;end if;
 select * into old from mizizi_private.desk_tool_receipts_v1 where job_id=(s->>'jobId')::uuid
  and lease_expires_at=(s->>'leaseExpiresAt')::timestamptz and call_sha256=p_call_sha256;
 if found then
  if old.id=p_receipt_id and old.result_sha256=p_result_sha256 and old.result_text=p_result_text
   and old.provenance->'sharedNative'=m-'result' and mizizi_private.desk_custody_receipt_current_v1(old,c)
  then return jsonb_build_object('receiptId',old.id,'resultSha256',old.result_sha256,'outcome','replayed');end if;
  raise exception 'Shared receipt replay conflict' using errcode='PT409';
 end if;
 if (select count(*) from mizizi_private.desk_tool_receipts_v1 where case_id=(c->>'caseId')::uuid)>=200
 or (s->>'leaseExpiresAt')::timestamptz<=clock_timestamp() then return null;end if;
 insert into mizizi_private.desk_tool_receipts_v1(id,job_id,case_id,workspace_id,expected_revision,worker_id,
  lease_expires_at,membership_sha256,observation_sha256,operation,call_sha256,result_sha256,host,policy_revision,
  result_text,provenance,source_id,parent_receipt_id,operational_revision)
 values(p_receipt_id,(s->>'jobId')::uuid,(c->>'caseId')::uuid,(c->>'workspaceId')::uuid,(c->>'expectedRevision')::integer,
  s->>'workerId',(s->>'leaseExpiresAt')::timestamptz,c->>'membershipSha256',c->>'observationSha256',
  'read_page',p_call_sha256,p_result_sha256,m->>'host',(m->>'policyRevision')::integer,p_result_text,
  jsonb_build_object('sharedNative',m-'result','finalUrl',m->>'finalUrl','sourceSha256',m->'result'->'sources'->0->'source'->>'fingerprint'),
  p_receipt_id,(m->>'parentReceiptId')::uuid,(m->>'operationalRevision')::integer) returning * into inserted;
 if not mizizi_private.desk_custody_receipt_current_v1(inserted,c) then
  raise exception 'Shared receipt authority changed' using errcode='42501';end if;
 return jsonb_build_object('receiptId',inserted.id,'resultSha256',inserted.result_sha256,'outcome','created');
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
  select * into r from mizizi_private.desk_tool_receipts_v1 where id=rid;
  if r.provenance ? 'sharedNative' then
   expiry:=least(expiry,(r.result_text::jsonb->'sources'->0->'source'->>'expiresAt')::timestamptz);
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

revoke all on function mizizi_private.desk_shared_policy_expiry_v1(uuid),
 mizizi_private.desk_shared_admission_material_v1(jsonb,mizizi_private.desk_shared_attribution_versions_v1,mizizi_private.desk_tool_receipts_v1,uuid,uuid,text),
 mizizi_private.desk_shared_receipt_current_v1(mizizi_private.desk_tool_receipts_v1,jsonb),
 public.mizizi_offer_desk_shared_source_v1(text,text,uuid),
 public.mizizi_admit_desk_shared_source_v1(text,text,uuid,jsonb,text,text)
 from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_offer_desk_shared_source_v1(text,text,uuid),
 public.mizizi_admit_desk_shared_source_v1(text,text,uuid,jsonb,text,text) to service_role;
do $acl$ begin
 if has_table_privilege('service_role','mizizi_private.desk_shared_attribution_versions_v1','INSERT')
 or has_function_privilege('authenticated','public.mizizi_offer_desk_shared_source_v1(text,text,uuid)','EXECUTE')
 or has_function_privilege('anon','public.mizizi_admit_desk_shared_source_v1(text,text,uuid,jsonb,text,text)','EXECUTE')
 then raise exception 'STOP_MIZIZI_SHARED_ADMISSION_ACL';end if;
end $acl$;
commit;
