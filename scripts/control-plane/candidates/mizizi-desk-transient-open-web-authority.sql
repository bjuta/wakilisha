-- UNSEALED forward candidate for the existing Slice 1 authority correction.
-- Do not execute on hosted databases. Mint via pinned CLI and qualify first.
-- This changes transient access only; receipt admission/disclosure remains closed.
-- Exact deployed migration-306 preimages; abort on unexpected drift.
do $wk_preimage$
begin
 if pg_get_functiondef('public.mizizi_authorize_desk_access_v1(jsonb,text,text,text)'::regprocedure) is distinct from $wk_exact$CREATE OR REPLACE FUNCTION public.mizizi_authorize_desk_access_v1(p_scope jsonb, p_operation text, p_binding_text text, p_binding_sha256 text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
end $function$
$wk_exact$ then raise exception 'MIZIZI_TRANSIENT_PREIMAGE_CHANGED: mizizi_authorize_desk_access_v1';end if;
 if pg_get_functiondef('public.mizizi_read_desk_operational_policy_v1(jsonb)'::regprocedure) is distinct from $wk_exact$CREATE OR REPLACE FUNCTION public.mizizi_read_desk_operational_policy_v1(p_scope jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
  'publicOpeningBatchAllowed',o.public_opening_batch_allowed,'publicRetainedBatchAllowed',o.public_retained_batch_allowed,
  'adaptiveFollowupsAllowed',o.adaptive_followups_allowed,'publicQueryTerms',to_jsonb(o.public_query_terms),
  'validUntil',least(o.valid_until,(c->>'leaseExpiresAt')::timestamptz));
end $function$
$wk_exact$ then raise exception 'MIZIZI_TRANSIENT_PREIMAGE_CHANGED: mizizi_read_desk_operational_policy_v1';end if;
 if pg_get_functiondef('mizizi_private.desk_operational_receipt_current_v1(mizizi_private.desk_tool_receipts_v1,jsonb)'::regprocedure) is distinct from $wk_exact$CREATE OR REPLACE FUNCTION mizizi_private.desk_operational_receipt_current_v1(r mizizi_private.desk_tool_receipts_v1, c jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
end $function$
$wk_exact$ then raise exception 'MIZIZI_TRANSIENT_PREIMAGE_CHANGED: desk_operational_receipt_current_v1';end if;
end $wk_preimage$;

-- Historical immutable policy rows retain their original authority. New
-- sessions default to transient consultation without a host allowlist.
alter table mizizi_private.desk_operational_policy_versions_v1 add column public_web_transient_allowed boolean not null default false;
alter table mizizi_private.desk_operational_policy_versions_v1 alter column public_web_transient_allowed set default true;

CREATE OR REPLACE FUNCTION public.mizizi_read_desk_operational_policy_v1(p_scope jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
  'publicWebTransientAllowed',o.public_web_transient_allowed,
  'publicOpeningBatchAllowed',o.public_opening_batch_allowed,'publicRetainedBatchAllowed',o.public_retained_batch_allowed,
  'adaptiveFollowupsAllowed',o.adaptive_followups_allowed,'publicQueryTerms',to_jsonb(o.public_query_terms),
  'validUntil',least(o.valid_until,(c->>'leaseExpiresAt')::timestamptz));
end $function$;

CREATE OR REPLACE FUNCTION public.mizizi_authorize_desk_access_v1(p_scope jsonb, p_operation text, p_binding_text text, p_binding_sha256 text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare c jsonb;b jsonb;d jsonb;u text;h text;urlhash text;
 p mizizi_private.desk_access_policy_versions_v1;
 custody mizizi_private.desk_custody_policy_versions_v1;
 expiry timestamptz;o mizizi_private.desk_operational_policy_versions_v1;callhash text;hophash text;
 transient_access boolean:=false; custody_revision integer;
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
 select * into p from mizizi_private.desk_access_policy_versions_v1
 where workspace_id=(c->>'workspaceId')::uuid and host=h and url_sha256=urlhash and operation=p_operation
 order by revision desc limit 1;
 o:=mizizi_private.current_desk_operational_policy_v1(c);
 -- Transient session authority never grants external disclosure or retention.
 -- Explicit access decisions take precedence; no legacy grant is rewritten.
 transient_access:=coalesce(mizizi_private.desk_operational_policy_live_v1(o,c)
  and o.public_web_transient_allowed and p.revision is null
  and p_operation in ('native_acquire','native_text','browser_request','browser_render','browser_text')
  and not (p_operation='browser_render' and d->'visual'='true'::jsonb)
  and (custody.revision is null or (custody.enabled and custody.private_research_allowed
   and custody.valid_until>clock_timestamp())),false);
 if not transient_access then
  if not mizizi_private.desk_custody_policy_live_v1(custody) or custody.source_family<>'public_web' then return null;end if;
  if p_operation in ('browser_text','browser_visual','browser_render','browser_request') and not custody.browser_render_allowed then return null;end if;
  if (p_operation in ('pdf_visual','browser_visual') or (p_operation='browser_render' and d->'visual'='true'::jsonb))
   and (not custody.visual_processing_allowed or not custody.excerpt_retention_allowed) then return null;end if;
  if (p.revision is null and o.revision is null)
   or (p.revision is not null and (not p.enabled or p.custody_revision is distinct from custody.revision)) then return null;end if;
 end if;
 custody_revision:=case when transient_access then null else custody.revision end;
 if o.revision is not null then
  if not mizizi_private.desk_operational_policy_live_v1(o,c)
   or (not transient_access and not mizizi_private.desk_operational_url_allowed_v1(o,h,u,p_operation,custody.revision))
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
   (p_scope->>'leaseExpiresAt')::timestamptz,callhash,p_operation,p_binding_sha256,o.revision,h,urlhash,custody_revision,p.revision,
   hophash,d->>'sha256',case when p_operation='native_text' then (d->>'pageStart')::integer end,
   case when p_operation='native_text' then (d->>'pageEnd')::integer end,expiry)
  on conflict do nothing;
  if not exists(select 1 from mizizi_private.desk_operational_call_proofs_v1 q where q.job_id=(p_scope->>'jobId')::uuid
   and q.lease_expires_at=(p_scope->>'leaseExpiresAt')::timestamptz and q.operation=p_operation
   and q.binding_sha256=p_binding_sha256 and q.standing_revision=o.revision and q.exact_revision is not distinct from p.revision
   and q.custody_revision is not distinct from custody_revision
   and q.valid_until>clock_timestamp()) then return null;end if;
 end if;
 return jsonb_build_object('operation',p_operation,'bindingSha256',p_binding_sha256,'urlSha256',urlhash,
  'policyRef','desk-access:'||urlhash||':'||p_operation||':'||coalesce(p.revision,0)::text||':'||coalesce(custody_revision::text,'transient')||
   case when o.revision is null then '' else ':standing:'||o.revision::text end,
  'validUntil',expiry,'allowed',true);
end $function$;

CREATE OR REPLACE FUNCTION mizizi_private.desk_operational_receipt_current_v1(r mizizi_private.desk_tool_receipts_v1, c jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
  if g.standing_revision is distinct from o.revision then return false;end if;
  if g.custody_revision is null then
   -- This proves access only. The enclosing custody receipt check still
   -- requires current positive retained-source/disclosure authority.
   if not o.public_web_transient_allowed or g.exact_revision is not null
    or g.operation not in ('native_acquire','native_text','browser_request','browser_render','browser_text')
    or (cp.revision is not null and (not cp.enabled or not cp.private_research_allowed
      or cp.valid_until<=clock_timestamp())) then return false;end if;
  elsif not mizizi_private.desk_custody_policy_live_v1(cp)
   or cp.revision is distinct from g.custody_revision then return false;end if;
  select * into p from mizizi_private.desk_access_policy_versions_v1
   where workspace_id=r.workspace_id and host=g.host and url_sha256=g.url_sha256 and operation=g.operation
   order by revision desc limit 1;
  if p.revision is distinct from g.exact_revision
   or (p.revision is not null and (not p.enabled or p.custody_revision is distinct from cp.revision or p.valid_until<=clock_timestamp()))
   then return false;end if;
 end loop;
 return true;
end $function$;
