-- Issue #1441. CLI 2.107.0 mint #45837271542. Extend the same private
-- custody authority. No persisted raw image, HTML or PDF, no seeded grants.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
do $guard$
begin
 if current_user<>'postgres'
 or to_regprocedure('public.mizizi_record_desk_tool_receipt_v1(text,text,text,text,text,integer,jsonb,jsonb)') is null
 or to_regclass('mizizi_private.desk_reference_leads_v1') is null
 or exists(select 1 from information_schema.columns where table_schema='mizizi_private' and table_name='desk_tool_receipts_v1' and column_name='parent_receipt_id')
 or has_schema_privilege('service_role','mizizi_private','USAGE')
 then raise exception 'STOP_MIZIZI_DERIVATIVE_PREIMAGE';end if;
end $guard$;
alter table mizizi_private.desk_custody_policy_versions_v1
 add column browser_render_allowed boolean not null default false,
 add column visual_processing_allowed boolean not null default false,
 add constraint mz_desk_derivative_policy check(source_family='public_web' or (not browser_render_allowed and not visual_processing_allowed));
alter table mizizi_private.desk_tool_receipts_v1
 add column parent_receipt_id uuid references mizizi_private.desk_tool_receipts_v1(id),
 drop constraint desk_tool_receipts_v1_operation_check,
 add constraint desk_tool_receipts_v1_operation_check check(operation in ('search_web','search_news','read_page','read_document','render_page','inspect_visual'));
alter table mizizi_private.desk_reference_leads_v1
 drop constraint desk_reference_leads_v1_kind_check,
 add constraint desk_reference_leads_v1_kind_check check(kind in ('reference','document','render','visual'));
create index mz_desk_receipt_parent on mizizi_private.desk_tool_receipts_v1(parent_receipt_id);
create unique index mz_desk_browser_reservation_once on mizizi_private.desk_tool_receipts_v1((provenance->'detail'->>'reservationId')) where operation='render_page';
create function mizizi_private.desk_visual_descriptor_valid_v1(v jsonb)
returns boolean language plpgsql immutable set search_path=pg_catalog as $visual$
begin
 if jsonb_typeof(v) is distinct from 'object' then return false;end if;
 if (select count(*) from jsonb_object_keys(v))<>4 or not(v ?& array['sha256','width','height','byteLength'])
 or coalesce(v->>'sha256','') !~ '^[0-9a-f]{64}$'
 or coalesce(v->>'width','') !~ '^[1-9][0-9]{0,3}$'
 or coalesce(v->>'height','') !~ '^[1-9][0-9]{0,3}$'
 or coalesce(v->>'byteLength','') !~ '^[1-9][0-9]{0,6}$' then return false;end if;
 return (v->>'width')::integer<=1400 and (v->>'height')::integer<=1400
 and (v->>'width')::integer*(v->>'height')::integer<=1500000
 and (v->>'byteLength')::integer between 33 and 2000000;
end $visual$;
revoke all on function mizizi_private.desk_visual_descriptor_valid_v1(jsonb) from public,anon,authenticated,service_role,mizizi_executor;

create or replace function public.mizizi_read_desk_custody_policy_v1(p_scope jsonb,p_host text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $read$
declare c jsonb;p mizizi_private.desk_custody_policy_versions_v1;
begin
 perform pg_advisory_xact_lock(214781521,61431);
 c:=mizizi_private.desk_custody_context_v1(p_scope);
 if c is null then return null;end if;
 p:=mizizi_private.current_desk_custody_policy_v1((p_scope->>'workspaceId')::uuid,p_host);
 if not mizizi_private.desk_custody_policy_live_v1(p) then return null;end if;
 return jsonb_build_object('host',p.host,'revision',p.revision,'sourceFamily',p.source_family,
 'authorityRef',p.authority_ref,'originKey',p.origin_key,'lineageKey',p.lineage_key,'useBasis',p.use_basis,
 'privateResearchAllowed',p.private_research_allowed,'metadataRetentionAllowed',p.metadata_retention_allowed,
 'excerptRetentionAllowed',p.excerpt_retention_allowed,'externalModelProcessingAllowed',p.external_model_processing_allowed,
 'browserRenderAllowed',p.browser_render_allowed,'visualProcessingAllowed',p.visual_processing_allowed,
 'validUntil',p.valid_until);
end $read$;

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
  p:=mizizi_private.current_desk_custody_policy_v1(ancestor.workspace_id,ancestor.host);
  if not mizizi_private.desk_custody_policy_live_v1(p) or p.revision is distinct from ancestor.policy_revision
   or (ancestor.source_id is not null and not p.excerpt_retention_allowed)
   or (ancestor.operation='render_page' and not p.browser_render_allowed)
   or (ancestor.operation='inspect_visual' and not p.visual_processing_allowed)
   or (ancestor.operation='render_page' and ancestor.provenance->'detail'->'visual'<>'null'::jsonb and not p.visual_processing_allowed)
   then return false;end if;
  if ancestor.parent_receipt_id is null then return true;end if;
  select * into ancestor from mizizi_private.desk_tool_receipts_v1 where id=ancestor.parent_receipt_id;
 end loop;
end $current$;

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
 clean_provenance jsonb;
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
 or jsonb_typeof(result) is distinct from 'object' or coalesce(op,'') not in ('search_web','search_news','read_page','read_document','render_page','inspect_visual')
 or jsonb_typeof(call_body->'input') is distinct from 'object'
 or (select count(*) from jsonb_object_keys(x))<>2 or (select count(*) from jsonb_object_keys(call_body))<>2
 or (select count(*) from jsonb_object_keys(call_body->'input'))<>(case op when 'read_document' then 3 when 'inspect_visual' then 2 else 1 end)
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
  if p.source_family<>'brave_discovery' or jsonb_array_length(result->'sources')<>0
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
   or coalesce(lead->>'kind','') not in ('reference','document','render','visual') or jsonb_typeof(lead->'label') is distinct from 'string'
   or length(btrim(lead->>'label')) not between 1 and 500 then return null;end if;
  select value into binding from jsonb_array_elements(p_lead_bindings) where value->>'id'=lead->>'id';
  if not found or jsonb_typeof(binding) is distinct from 'object'
   or (select count(*) from jsonb_object_keys(binding))<>2
   or mizizi_private.desk_custody_url_host_v1(binding->>'url') is null then return null;end if;
  if lead->>'kind'<>'reference' then
   if binding->>'url' is distinct from p_provenance->>'finalUrl' then return null;end if;
   if lead->>'kind'='document' then
    if op<>'read_page' or p_provenance->>'contentType'<>'application/pdf' or p_provenance->>'documentPages' is null then return null;end if;
   elsif lead->>'kind'='render' then
    if op<>'read_page' or not p.browser_render_allowed or p_provenance->'renderRequired' is distinct from 'true'::jsonb then return null;end if;
   elsif lead->>'kind'='visual' then
    if op<>'render_page' or not p.visual_processing_allowed or not mizizi_private.desk_visual_descriptor_valid_v1(detail->'visual') then return null;end if;
   else return null;end if;
  end if;
 end loop;
 if p.valid_until<=clock_timestamp() or (s->>'leaseExpiresAt')::timestamptz<=clock_timestamp() then return null;end if;
 insert into mizizi_private.desk_tool_receipts_v1(id,job_id,case_id,workspace_id,expected_revision,worker_id,
 lease_expires_at,membership_sha256,observation_sha256,operation,call_sha256,result_sha256,host,policy_revision,result_text,provenance,source_id,parent_receipt_id)
 values(rid,(s->>'jobId')::uuid,(s->>'caseId')::uuid,(s->>'workspaceId')::uuid,(s->>'expectedRevision')::integer,s->>'workerId',
 (s->>'leaseExpiresAt')::timestamptz,c->>'membershipSha256',c->>'observationSha256',op,p_call_sha256,p_result_sha256,p.host,p.revision,p_result_text,clean_provenance,source_id,parent_id);
 insert into mizizi_private.desk_reference_leads_v1(id,receipt_id,url,kind,label)
 select (l->>'id')::uuid,rid,b->>'url',l->>'kind',l->>'label'
 from jsonb_array_elements(result->'leads') l join jsonb_array_elements(p_lead_bindings) b on l->>'id'=b->>'id';
 return jsonb_build_object('receiptId',rid,'resultSha256',p_result_sha256,'outcome','created');
end $append$;
commit;
