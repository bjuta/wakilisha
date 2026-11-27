-- CLI 2.107.0 mint #46019433624; issue #1441. No policies or entitlements seeded.
-- Preserve the existing receipt, grants and quota contracts. Only a consumed
-- pinned public discovery request can admit an explicit unavailable outcome.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
do $guard$
begin
 if current_user<>'postgres'
 or to_regprocedure('public.mizizi_record_desk_tool_receipt_v1(text,text,text,text,text,integer,jsonb,jsonb)') is null
 or to_regprocedure('mizizi_private.qualify_desk_search_request_v1(text,text,text)') is null
 or to_regprocedure('public.mizizi_consume_desk_search_v1(uuid,text,text)') is null
 or position('result ? ''unavailable''' in (select prosrc from pg_proc where oid='public.mizizi_record_desk_tool_receipt_v1(text,text,text,text,text,integer,jsonb,jsonb)'::regprocedure))>0
 then raise exception 'STOP_UNAVAILABLE_TOOL_PREIMAGE';end if;
end $guard$;
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
 or (select count(*) from jsonb_object_keys(result))<>(case when result ? 'unavailable' then 5 else 4 end)
 or not(result ?& array['receiptId','leads','sources','visual'])
 or (op<>'inspect_visual' and result->'visual'<>'null'::jsonb)
 or (op='inspect_visual' and jsonb_typeof(result->'visual') is distinct from 'object')
 or coalesce(result->>'receiptId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 or jsonb_typeof(result->'leads') is distinct from 'array' or jsonb_array_length(result->'leads')<>jsonb_array_length(p_lead_bindings)
 or jsonb_typeof(result->'sources') is distinct from 'array' or jsonb_array_length(result->'sources')>1
 then raise exception 'Invalid custody projection' using errcode='22023';end if;
 -- A non-successful public discovery attempt is a checked operational
 -- receipt, not an empty successful search, source, or new entitlement.
 if result ? 'unavailable' then
  if jsonb_typeof(result->'unavailable') is distinct from 'object' then return null;end if;
  if op not in ('search_web','search_news') or p_host='api.search.brave.com'
   or (select count(*) from jsonb_object_keys(result->'unavailable'))<>2
   or coalesce(result->'unavailable'->>'code','') !~ '^MIZIZI_DESK_NATIVE_SOURCE_UNAVAILABLE_HTTP_(404|408|410|429|500|502|503|504)$'
   or result->'unavailable'->>'host' is distinct from p_host
   or jsonb_typeof(result->'unavailable'->'code') is distinct from 'string'
   or jsonb_typeof(result->'unavailable'->'host') is distinct from 'string'
   or result->'leads' is distinct from '[]'::jsonb or result->'sources' is distinct from '[]'::jsonb
   or result->'visual' is distinct from 'null'::jsonb or p_lead_bindings is distinct from '[]'::jsonb
  then return null;end if;
 end if;
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
  or exists(select 1 from mizizi_private.desk_tool_receipts_v1 x where x.job_id=(scope->>'jobId')::uuid
   and x.lease_expires_at=(scope->>'leaseExpiresAt')::timestamptz and x.host=provider_host_name
   and x.operation in ('search_web','search_news') and x.result_text::jsonb ? 'unavailable')
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

create or replace function public.mizizi_consume_desk_search_v1(p_reservation_id uuid,p_request_sha256 text,p_account_fingerprint text)
returns boolean language plpgsql security definer set search_path=pg_catalog as $consume$
declare p mizizi_private.desk_search_policy_versions_v1%rowtype;
 r mizizi_private.desk_search_reservations_v1%rowtype; ctx jsonb; t timestamptz; provider_name text;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service-role required' using errcode='42501';end if;
 if p_reservation_id is null or p_request_sha256 is null or p_request_sha256 !~ '^[a-f0-9]{64}$'
  or p_account_fingerprint is null or p_account_fingerprint !~ '^[a-f0-9]{64}$'
 then raise exception 'Invalid search reservation' using errcode='22023';end if;
 perform pg_advisory_xact_lock(214781521,61429);
 select * into r from mizizi_private.desk_search_reservations_v1
  where id=p_reservation_id and request_sha256=p_request_sha256 for update;
 if not found or r.consumed_at is not null or r.valid_until<=clock_timestamp() then return false;end if;
 select provider into provider_name from mizizi_private.desk_search_policy_versions_v1 where revision=r.policy_revision;
 select * into p from mizizi_private.desk_search_policy_versions_v1 where provider=provider_name order by revision desc limit 1;
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
 if exists(select 1 from mizizi_private.desk_tool_receipts_v1 x where x.job_id=r.job_id
  and x.lease_expires_at=r.lease_expires_at and x.host=p.provider_host
  and x.operation in ('search_web','search_news') and x.result_text::jsonb ? 'unavailable') then return false;end if;
 t:=clock_timestamp();
 if t>=r.valid_until or t>=p.valid_until or t>=p.allowance_end or (p.min_interval_ms>0 and exists(
  select 1 from mizizi_private.desk_search_reservations_v1 rr join mizizi_private.desk_search_policy_versions_v1 v on v.revision=rr.policy_revision
  where v.provider=p.provider and rr.consumed_at>t-p.min_interval_ms*interval '1 millisecond')) then return false;end if;
 update mizizi_private.desk_search_reservations_v1 set consumed_at=t where id=r.id and consumed_at is null;
 return found;
end $consume$;

do $guard$
begin
 if has_function_privilege('authenticated','public.mizizi_record_desk_tool_receipt_v1(text,text,text,text,text,integer,jsonb,jsonb)','EXECUTE')
 or not has_function_privilege('service_role','public.mizizi_record_desk_tool_receipt_v1(text,text,text,text,text,integer,jsonb,jsonb)','EXECUTE')
 or has_table_privilege('service_role','mizizi_private.desk_tool_receipts_v1','INSERT')
 then raise exception 'STOP_UNAVAILABLE_TOOL_ACL';end if;
end $guard$;
commit;
