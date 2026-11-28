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
 transient_access boolean:=false; bound_custody_revision integer;
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
  -- Preserve an existing positive scoped grant and its receipt meaning.
  and not coalesce(mizizi_private.desk_custody_policy_live_v1(custody)
   and mizizi_private.desk_operational_url_allowed_v1(o,h,u,p_operation,custody.revision),false)
  and split_part(u,'?',1) ~ '^https://[a-z0-9.-]+(/[A-Za-z0-9_./~%:-]*)?$'
  and split_part(u,'?',1) !~* '%(2e|2f|5c|25)'
  and split_part(u,'?',1) !~ '/[.]{1,2}(/|$)'
  and h not in ('api.gdeltproject.org','api.tavily.com')
  and p_operation in ('native_acquire','native_text','browser_request','browser_render','browser_text')
  and not (p_operation='browser_render' and d->'visual'='true'::jsonb)
  and (custody.revision is null or (custody.enabled and custody.private_research_allowed
   and custody.valid_until>clock_timestamp()
   and (p_operation not in ('browser_request','browser_render','browser_text') or custody.browser_render_allowed))),false);
 if not transient_access then
  if not mizizi_private.desk_custody_policy_live_v1(custody) or custody.source_family<>'public_web' then return null;end if;
  if p_operation in ('browser_text','browser_visual','browser_render','browser_request') and not custody.browser_render_allowed then return null;end if;
  if (p_operation in ('pdf_visual','browser_visual') or (p_operation='browser_render' and d->'visual'='true'::jsonb))
   and (not custody.visual_processing_allowed or not custody.excerpt_retention_allowed) then return null;end if;
  if (p.revision is null and o.revision is null)
   or (p.revision is not null and (not p.enabled or p.custody_revision is distinct from custody.revision)) then return null;end if;
 end if;
 bound_custody_revision:=case when transient_access then null else custody.revision end;
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
   (p_scope->>'leaseExpiresAt')::timestamptz,callhash,p_operation,p_binding_sha256,o.revision,h,urlhash,bound_custody_revision,p.revision,
   hophash,d->>'sha256',case when p_operation='native_text' then (d->>'pageStart')::integer end,
   case when p_operation='native_text' then (d->>'pageEnd')::integer end,expiry)
  on conflict do nothing;
  if not exists(select 1 from mizizi_private.desk_operational_call_proofs_v1 q where q.job_id=(p_scope->>'jobId')::uuid
   and q.lease_expires_at=(p_scope->>'leaseExpiresAt')::timestamptz and q.operation=p_operation
   and q.binding_sha256=p_binding_sha256 and q.standing_revision=o.revision and q.exact_revision is not distinct from p.revision
   and q.custody_revision is not distinct from bound_custody_revision
   and q.valid_until>clock_timestamp()) then return null;end if;
 end if;
 return jsonb_build_object('operation',p_operation,'bindingSha256',p_binding_sha256,'urlSha256',urlhash,
  'policyRef','desk-access:'||urlhash||':'||p_operation||':'||coalesce(p.revision,0)::text||':'||coalesce(bound_custody_revision::text,'transient')||
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
      or cp.valid_until<=clock_timestamp()
      or (g.operation in ('browser_request','browser_render','browser_text') and not cp.browser_render_allowed))) then return false;end if;
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

-- Access-only receipts reuse the same immutable receipt and reference tables.
-- No source content or claim is admitted through this path.
do $wk_transient_receipt_preimage$
begin
 if pg_get_functiondef('public.mizizi_record_desk_tool_receipt_v1(text,text,text,text,text,integer,jsonb,jsonb)'::regprocedure) is distinct from $wk_exact$CREATE OR REPLACE FUNCTION public.mizizi_record_desk_tool_receipt_v1(p_call_text text, p_call_sha256 text, p_result_text text, p_result_sha256 text, p_host text, p_policy_revision integer, p_provenance jsonb, p_lead_bindings jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
end $function$
$wk_exact$ then raise exception 'MIZIZI_TRANSIENT_PREIMAGE_CHANGED: mizizi_record_desk_tool_receipt_v1';end if;
 if pg_get_functiondef('mizizi_private.desk_custody_receipt_current_v1(mizizi_private.desk_tool_receipts_v1,jsonb)'::regprocedure) is distinct from $wk_exact$CREATE OR REPLACE FUNCTION mizizi_private.desk_custody_receipt_current_v1(r mizizi_private.desk_tool_receipts_v1, c jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
end $function$
$wk_exact$ then raise exception 'MIZIZI_TRANSIENT_PREIMAGE_CHANGED: desk_custody_receipt_current_v1';end if;
end $wk_transient_receipt_preimage$;

alter table mizizi_private.desk_tool_receipts_v1 alter column policy_revision drop not null;
alter table mizizi_private.desk_tool_receipts_v1 add constraint desk_tool_receipts_transient_only_v1 check (policy_revision is not null or (operation in ('read_page','browse_page') and source_id is null and operational_revision is not null and parent_receipt_id is not null and (result_text::jsonb->'sources' is not distinct from '[]'::jsonb) and (result_text::jsonb->'visual' is not distinct from 'null'::jsonb)));

CREATE OR REPLACE FUNCTION mizizi_private.desk_custody_receipt_current_v1(r mizizi_private.desk_tool_receipts_v1, c jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
  if ancestor.policy_revision is null then
   -- Consultation receipts cannot become evidence or survive a newly
   -- issued host-specific custody decision without fresh authorization.
   if p.revision is not null or ancestor.operation not in ('read_page','browse_page') or ancestor.source_id is not null
    or ancestor.operational_revision is null or ancestor.parent_receipt_id is null
    or ancestor.result_text::jsonb->'sources' is distinct from '[]'::jsonb
    or ancestor.result_text::jsonb->'visual' is distinct from 'null'::jsonb
    or ancestor.result_text::jsonb ? 'consultation'
    or ancestor.provenance->>'locator' is distinct from 'no_text'
    or (ancestor.operation='read_page' and exists(select 1 from jsonb_array_elements(ancestor.result_text::jsonb->'leads') v
      where v->>'kind' is distinct from 'reference' or v->>'label' is distinct from 'Public reference (unverified)'))
    or (ancestor.operation='browse_page' and (
      ancestor.provenance->'detail'->'visual' is distinct from 'null'::jsonb
      or not coalesce(mizizi_private.desk_local_browser_receipt_available_v1(ancestor,c),false)
      or exists(select 1 from jsonb_array_elements(ancestor.result_text::jsonb->'leads') v
       where v->>'kind' is distinct from 'browser_action' or not exists(
        select 1 from jsonb_array_elements(ancestor.provenance->'detail'->'actionBindings') a
        where a->>'id'=v->>'id' and v->>'label'=case a->>'action'
         when 'expand' then 'Expand public section' when 'search' then 'Search public page'
         when 'follow' then 'Follow public reference' when 'scroll_down' then 'Scroll down' end))))
    then return false;end if;
  elsif not mizizi_private.desk_custody_policy_live_v1(p) or p.revision is distinct from ancestor.policy_revision
   or (ancestor.source_id is not null and not p.excerpt_retention_allowed)
   or (ancestor.result_text::jsonb ? 'consultation' and (p.excerpt_retention_allowed or not p.external_model_processing_allowed or ancestor.source_id is not null))
   or (ancestor.operation in ('render_page','browse_page') and not p.browser_render_allowed)
   or (ancestor.provenance->'detail' ? 'localBrowser' and (not p.browser_render_allowed or not mizizi_private.desk_local_browser_receipt_available_v1(ancestor,c)))
   or (ancestor.operation='inspect_visual' and not p.visual_processing_allowed)
   or (ancestor.operation='render_page' and ancestor.provenance->'detail'->'visual'<>'null'::jsonb and not p.visual_processing_allowed)
   then return false;end if;
  if ancestor.parent_receipt_id is null then return true;end if;
  select * into ancestor from mizizi_private.desk_tool_receipts_v1 where id=ancestor.parent_receipt_id;
 end loop;
end $function$;

CREATE OR REPLACE FUNCTION public.mizizi_record_desk_tool_receipt_v1(p_call_text text, p_call_sha256 text, p_result_text text, p_result_sha256 text, p_host text, p_policy_revision integer, p_provenance jsonb, p_lead_bindings jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare x jsonb;s jsonb;call_body jsonb;result jsonb;c jsonb;
 p mizizi_private.desk_custody_policy_versions_v1;
 r mizizi_private.desk_tool_receipts_v1;previous mizizi_private.desk_tool_receipts_v1;
 rid uuid;op text;lead jsonb;binding jsonb;src jsonb;authsrc jsonb;
 parent_lead mizizi_private.desk_reference_leads_v1;parent_receipt mizizi_private.desk_tool_receipts_v1;
 source_id uuid;search_r mizizi_private.desk_search_reservations_v1;
 native_r mizizi_private.desk_resource_reservations_v1;hop text;observed timestamptz;
 parent_id uuid; detail jsonb; browser_request jsonb; visual jsonb; page_start integer;page_end integer;
 clean_provenance jsonb;o mizizi_private.desk_operational_policy_versions_v1;hop_index integer;final_hash text;local_meta jsonb;local_action text;local_res mizizi_private.desk_resource_reservations_v1;parent_action jsonb;
 transient_receipt boolean:=false;
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
 or (select count(*) from jsonb_object_keys(result))<>(4+(case when result ? 'unavailable' then 1 else 0 end)+(case when result ? 'consultation' then 1 else 0 end))
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
   or result->'visual' is distinct from 'null'::jsonb or result ? 'consultation' or p_lead_bindings is distinct from '[]'::jsonb
  then return null;end if;
 end if;
 rid:=(result->>'receiptId')::uuid;
 clean_provenance:=p_provenance-'requestText';
 if op='render_page' then clean_provenance:=clean_provenance #- '{detail,requestText}';end if;
 perform pg_advisory_xact_lock(214781521,61431);
 c:=mizizi_private.desk_custody_context_v1(s);
 if c is null then return null;end if;
 p:=mizizi_private.current_desk_custody_policy_v1((s->>'workspaceId')::uuid,p_host);
 o:=mizizi_private.current_desk_operational_policy_v1(c);
 -- Consultation is not source-content custody. This branch requires a
 -- standing session and no existing source-specific custody decision.
 transient_receipt:=coalesce(p_policy_revision is null and p.revision is null
  and op in ('read_page','browse_page') and mizizi_private.desk_operational_policy_live_v1(o,c)
  and o.public_web_transient_allowed and p_host not in ('api.gdeltproject.org','api.tavily.com','api.search.brave.com'),false);
 if transient_receipt then
  if result ? 'consultation' or result->'sources' is distinct from '[]'::jsonb or result->'visual' is distinct from 'null'::jsonb
   or p_provenance->>'locator' is distinct from 'no_text'
   or (op='read_page' and (
    p_provenance->'documentPages' is distinct from 'null'::jsonb
    or p_provenance->'renderRequired' is distinct from 'false'::jsonb
    or exists(select 1 from jsonb_array_elements(result->'leads') v
     where v->>'kind' is distinct from 'reference' or v->>'label' is distinct from 'Public reference (unverified)')
    or exists(select 1 from jsonb_array_elements(p_lead_bindings) v where position('?' in coalesce(v->>'url',''))>0)))
   or (op='browse_page' and (
    p_provenance->'detail'->'visual' is distinct from 'null'::jsonb
    or exists(select 1 from jsonb_array_elements(result->'leads') v
     where v->>'kind' is distinct from 'browser_action' or not exists(
      select 1 from jsonb_array_elements(p_provenance->'detail'->'actionBindings') a
      where a->>'id'=v->>'id' and v->>'label'=case a->>'action'
       when 'expand' then 'Expand public section' when 'search' then 'Search public page'
       when 'follow' then 'Follow public reference' when 'scroll_down' then 'Scroll down' end))))
   then return null;end if;
 elsif not mizizi_private.desk_custody_policy_live_v1(p) or p.revision is distinct from p_policy_revision then return null;end if;
 if result ? 'consultation' then
  -- No publisher expression in the durable result. The current external
  -- processing permission is independent of the denied excerpt retention.
  if o.revision is null or not o.public_web_transient_allowed or p.excerpt_retention_allowed or not p.external_model_processing_allowed
   or op not in ('read_page','read_document','render_page','browse_page') or result ? 'unavailable'
   or result->'sources' is distinct from '[]'::jsonb or result->'visual' is distinct from 'null'::jsonb
   or jsonb_typeof(result->'consultation') is distinct from 'object'
   or (select count(*) from jsonb_object_keys(result->'consultation'))<>5
   or not(result->'consultation' ?& array['receiptId','textSha256','textBytes','citation','observedAt'])
   or result->'consultation'->>'receiptId' is distinct from rid::text
   or coalesce(result->'consultation'->>'textSha256','') !~ '^[a-f0-9]{64}$'
   or jsonb_typeof(result->'consultation'->'textBytes') is distinct from 'number'
   or coalesce(result->'consultation'->>'textBytes','') !~ '^[1-9][0-9]{0,4}$'
   or (result->'consultation'->>'textBytes')::integer>16000
   or coalesce(p_provenance->>'locator','no_text')='no_text'
   or result->'consultation'->>'citation' is distinct from ((p_provenance->>'finalUrl')||'#'||(p_provenance->>'locator'))
   or length(result->'consultation'->>'citation') not between 12 and 1000
   or (result->'consultation'->>'observedAt')::timestamptz is distinct from (p_provenance->>'retrievedAt')::timestamptz
  then return null;end if;
 end if;
 if o.revision is not null and (not mizizi_private.desk_operational_policy_live_v1(o,c) or not(op=any(o.tool_names))
 or not exists(select 1 from mizizi_private.desk_operational_call_proofs_v1 q where q.job_id=(s->>'jobId')::uuid
  and q.lease_expires_at=(s->>'leaseExpiresAt')::timestamptz and q.call_sha256=p_call_sha256 and q.operation='tool_execute'
  and q.standing_revision=o.revision and q.valid_until>clock_timestamp())) then return null;end if;
 -- Do not silently reuse a historical receipt for another call or policy.
 select * into previous from mizizi_private.desk_tool_receipts_v1
 where job_id=(s->>'jobId')::uuid and lease_expires_at=(s->>'leaseExpiresAt')::timestamptz and call_sha256=p_call_sha256;
 if found then
  if previous.id=rid and previous.result_sha256=p_result_sha256 and previous.result_text=p_result_text
   and previous.host=p_host and previous.policy_revision is not distinct from p_policy_revision and previous.provenance=clean_provenance
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
  if (not transient_receipt and p.source_family<>'public_web') or not(call_body->'input' ? 'lead_id')
   or coalesce(call_body->'input'->>'lead_id','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or not(p_provenance ?& array['requestedUrl','finalUrl','sourceSha256','projectionSha256','contentType','retrievedAt','byteLength','hopSha256','locator'])
   or ((select count(*) from jsonb_object_keys(p_provenance))<>9 and
    ((select count(*) from jsonb_object_keys(p_provenance))<>11 or not(p_provenance ?& array['documentPages','renderRequired'])))
   or (p_provenance ? 'documentPages' and p_provenance->'documentPages'<>'null'::jsonb and
    (coalesce(p_provenance->>'documentPages','') !~ '^[1-9][0-9]{0,4}$' or (p_provenance->>'documentPages')::integer>10000 or p_provenance->>'contentType'<>'application/pdf'))
   or (p_provenance ? 'renderRequired' and (jsonb_typeof(p_provenance->'renderRequired')<>'boolean'
    or (p_provenance->'renderRequired'='true'::jsonb and (p_provenance->>'contentType' not in ('text/html','application/xhtml+xml') or p_provenance->>'locator'<>'no_text'))))
   or mizizi_private.desk_custody_url_host_v1(p_provenance->>'finalUrl') is distinct from p_host
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
  if o.revision is null or (not transient_receipt and (not p.browser_render_allowed or p.source_family<>'public_web'))
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
   or mizizi_private.desk_custody_url_host_v1(p_provenance->>'finalUrl') is distinct from p_host
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
   and (not transient_receipt or q.custody_revision is null)
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
   and (not transient_receipt or q.custody_revision is null)
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
     and (hop_index<>jsonb_array_length(p_provenance->'hopSha256') or (q.url_sha256=final_hash
      and (not transient_receipt or q.custody_revision is null)))) then return null;end if;
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
    if op<>'browse_page' or local_meta is null or (not transient_receipt and not p.browser_render_allowed)
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
 if (not transient_receipt and p.valid_until<=clock_timestamp()) or (s->>'leaseExpiresAt')::timestamptz<=clock_timestamp()
  or (transient_receipt and not mizizi_private.desk_operational_policy_live_v1(o,c)) then return null;end if;
 if o.revision is not null then
  r.job_id:=(s->>'jobId')::uuid;r.case_id:=(s->>'caseId')::uuid;r.workspace_id:=(s->>'workspaceId')::uuid;
  r.worker_id:=s->>'workerId';r.lease_expires_at:=(s->>'leaseExpiresAt')::timestamptz;
  r.operation:=op;r.call_sha256:=p_call_sha256;r.operational_revision:=o.revision;
  if not mizizi_private.desk_operational_receipt_current_v1(r,c) then return null;end if;
 end if;
 insert into mizizi_private.desk_tool_receipts_v1(id,job_id,case_id,workspace_id,expected_revision,worker_id,
 lease_expires_at,membership_sha256,observation_sha256,operation,call_sha256,result_sha256,host,policy_revision,result_text,provenance,source_id,parent_receipt_id,operational_revision)
 values(rid,(s->>'jobId')::uuid,(s->>'caseId')::uuid,(s->>'workspaceId')::uuid,(s->>'expectedRevision')::integer,s->>'workerId',
 (s->>'leaseExpiresAt')::timestamptz,c->>'membershipSha256',c->>'observationSha256',op,p_call_sha256,p_result_sha256,p_host,p_policy_revision,p_result_text,clean_provenance,source_id,parent_id,o.revision);
 insert into mizizi_private.desk_reference_leads_v1(id,receipt_id,url,kind,label)
 select (l->>'id')::uuid,rid,b->>'url',l->>'kind',l->>'label'
 from jsonb_array_elements(result->'leads') l join jsonb_array_elements(p_lead_bindings) b on l->>'id'=b->>'id';
 return jsonb_build_object('receiptId',rid,'resultSha256',p_result_sha256,'outcome','created');
end $function$;

-- The same original-note store accepts MIZIZI-authored entries atomically
-- with the already-authorized immutable pass. No invented human actor.
do $wk_note_append_preimage$ begin
 if pg_get_functiondef('public.mizizi_append_research_pass_v1(uuid,text,text,text,text)'::regprocedure) is distinct from $wk_exact$CREATE OR REPLACE FUNCTION public.mizizi_append_research_pass_v1(p_job_id uuid, p_worker_id text, p_body_text text, p_fingerprint text, p_predecessor text)
 RETURNS TABLE(case_id uuid, ordinal integer, fingerprint text, outcome text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
 v_case_id uuid;
 v_workspace_id uuid;
 v_body jsonb;
 v_ordinal integer;
 v_last_ordinal integer;
 v_last_fingerprint text;
 v_existing text;
begin
 if coalesce(auth.role(),'')<>'service_role' then
  raise exception 'Service-role research authority required' using errcode='42501';
 end if;
 if p_job_id is null or p_worker_id is null or
    p_worker_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$' or
    p_body_text is null or octet_length(p_body_text)>32768 or
    (p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$')
 then raise exception 'Invalid bounded research-pass request' using errcode='22023';
 end if;
 if encode(sha256(convert_to(p_body_text,'UTF8')),'hex')<>p_fingerprint
 then raise exception 'Research-pass content fingerprint mismatch' using errcode='22023';
 end if;
 begin
  v_body:=p_body_text::jsonb;
 exception when others then
  raise exception 'Invalid research-pass JSON' using errcode='22023';
 end;
 if jsonb_typeof(v_body)<>'object'
    or v_body->>'contract' is distinct from 'mizizi.adaptive_investigation.v1'
    or v_body ? 'fingerprint'
    or jsonb_typeof(v_body->'sourceReceipts')<>'array'
    or jsonb_array_length(v_body->'sourceReceipts')>30
    or jsonb_typeof(v_body->'findings')<>'array'
    or jsonb_typeof(v_body->'proposedLeads')<>'array'
    or jsonb_typeof(v_body->'decision')<>'object'
 then
  raise exception 'Invalid research-pass contract' using errcode='22023';
 end if;
 begin
  v_ordinal:=(v_body->>'ordinal')::integer;
 exception when others then
  raise exception 'Research-pass ordinal is invalid' using errcode='22023';
 end;
 if (v_ordinal is null or v_ordinal not between 1 and 10000)
    or nullif(v_body->>'question','') is null
    or (v_body->>'predecessorFingerprint') is distinct from p_predecessor
 then raise exception 'Invalid research-pass identity' using errcode='22023';
 end if;
 if p_worker_id like 'mizizi-chart:%' then
  perform pg_advisory_xact_lock(214781521,61431);
 end if;
 -- Serialize appenders on the actual case row, and verify the worker's
 -- current lease and exact case revision inside this very transaction.
 select c.id,c.workspace_id into v_case_id,v_workspace_id
 from platform_private.jobs j
 join platform_private.command_receipts cr
  on cr.id=j.command_receipt_id
   and cr.resource_id=j.resource_id and cr.command_type=j.command_type
 join mizizi_private.case_resource_bindings b
  on b.resource_id=j.resource_id and b.case_id=j.resource_id
 join mizizi_private.cases c
  on c.id=b.case_id and c.workspace_id=b.workspace_id
 where j.id=p_job_id
  and j.command_type='mizizi.case_research_v1'
  and j.job_type='mizizi.case_research_v1'
  and j.status='running' and j.locked_by=p_worker_id
  and j.lease_expires_at>now() and cr.status='accepted'
  and (j.input_payload->>'case_id')::uuid=c.id
  and (j.input_payload->>'workspace_id')::uuid=c.workspace_id
  and j.input_payload->>'operation'='read_only_research'
  and c.case_state in ('open','in_progress')
  and c.current_stage='research'
  and c.revision=(j.input_payload->>'expected_case_revision')::integer
 for update of j,c;
 if v_case_id is null then
  raise exception 'Research pass is not authorized by a current job lease' using errcode='55000';
 end if;
 if exists (select 1 from mizizi_private.cases c where c.id=v_case_id and
   (c.claim_family_key='charts2_recording_investigation_v1' or exists (
    select 1 from mizizi_private.chart_candidate_subjects_v1 s where s.case_id=c.id)))
 then
   perform mizizi_private.assert_desk_journal_current_v1(p_job_id,p_worker_id,v_case_id,v_body);
 end if;
 if v_body->>'caseId' is distinct from v_case_id::text
    or v_body->>'workspaceId' is distinct from v_workspace_id::text
 then raise exception 'Research-pass workspace or case mismatch' using errcode='42501';
 end if;
 select p.fingerprint into v_existing
  from mizizi_private.research_passes p
 where p.case_id=v_case_id and p.ordinal=v_ordinal;
 if v_existing is not null then
  if v_existing<>p_fingerprint then
   raise exception 'Conflicting immutable pass ordinal' using errcode='55000';
  end if;
  return query select v_case_id,v_ordinal,p_fingerprint,'replayed'::text;
  return;
 end if;
 select p.ordinal,p.fingerprint into v_last_ordinal,v_last_fingerprint
 from mizizi_private.research_passes p
 where p.case_id=v_case_id order by p.ordinal desc limit 1;
 if v_ordinal<>coalesce(v_last_ordinal,0)+1
    or p_predecessor is distinct from v_last_fingerprint
 then raise exception 'Research-pass chain stale or out of order' using errcode='55000';
 end if;
 insert into mizizi_private.research_passes(
  case_id,workspace_id,job_id,ordinal,predecessor_fingerprint,fingerprint,body_text
 ) values(
  v_case_id,v_workspace_id,p_job_id,v_ordinal,p_predecessor,p_fingerprint,p_body_text
 );
 return query select v_case_id,v_ordinal,p_fingerprint,'created'::text;
end;
$function$
$wk_exact$
 then raise exception 'MIZIZI_AGENT_NOTE_APPEND_PREIMAGE_CHANGED';end if;
 if pg_get_functiondef('public.admin_mizizi_review_factual_note_v1(uuid,text,integer,text,boolean,text,timestamptz,text)'::regprocedure) is distinct from $wk_exact$CREATE OR REPLACE FUNCTION public.admin_mizizi_review_factual_note_v1(p_note_id uuid, p_note_sha256 text, p_expected_review_revision integer, p_decision text, p_model_processing_allowed boolean, p_review_ref text, p_valid_until timestamp with time zone, p_acknowledgement text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare actor uuid;n mizizi_private.desk_factual_notes_v1;c mizizi_private.cases%rowtype;
 prev mizizi_private.desk_factual_note_reviews_v1;d mizizi_private.desk_factual_note_reviews_v1;
begin
 actor:=mizizi_private.assert_headquarters_operator_v1('steward');
 if p_note_id is null or coalesce(p_note_sha256,'') !~ '^[a-f0-9]{64}$'
 or p_expected_review_revision is null or p_expected_review_revision<0
 or coalesce(p_decision,'') not in ('admitted','revoked') or p_model_processing_allowed is null
 or (p_decision='revoked' and p_model_processing_allowed)
 or p_review_ref is null or length(p_review_ref) not between 8 and 500 or btrim(p_review_ref)<>p_review_ref or p_review_ref ~ '[[:cntrl:]]'
 or p_valid_until is null or not isfinite(p_valid_until) or p_valid_until<=clock_timestamp() or p_valid_until>clock_timestamp()+interval '24 hours'
 or p_acknowledgement is distinct from (case when p_decision='admitted'
 then 'I independently reviewed this exact original note, consultation method, provenance and permitted use; this is not factual verification.'
 else 'I revoke this exact factual note admission.' end )
 then raise exception 'Invalid factual note review' using errcode='22023';end if;
 perform pg_advisory_xact_lock(214781521,61431);
 select * into n from mizizi_private.desk_factual_notes_v1 where note_id=p_note_id;
 if not found or n.note_sha256<>p_note_sha256 then raise exception 'Note unavailable' using errcode='42501';end if;
 perform mizizi_private.assert_chart_candidate_research_actor_v1(n.workspace_id,actor);
 select * into prev from mizizi_private.desk_factual_note_reviews_v1 where note_id=n.note_id order by revision desc limit 1;
 if coalesce(prev.revision,0)<>p_expected_review_revision then raise exception 'Factual note review revision conflict' using errcode='PT409';end if;
 if p_decision='admitted' then
  if actor=n.author_id then raise exception 'Independent note reviewer required' using errcode='42501';end if;
  perform mizizi_private.assert_chart_candidate_research_actor_v1(n.workspace_id,n.author_id);
  select * into c from mizizi_private.cases where id=n.case_id and workspace_id=n.workspace_id for update;
  if not found or c.revision<>n.expected_revision or c.case_state<>'in_progress' or c.current_stage<>'research'
  then raise exception 'Stale note case' using errcode='PT409';end if;
  perform mizizi_private.assert_chart_candidate_current_v1(n.case_id,n.workspace_id,null);
 elsif prev.revision is null or prev.decision<>'admitted' then
  raise exception 'No admitted note to revoke' using errcode='55000';
 end if;
 d.note_id:=n.note_id;d.revision:=p_expected_review_revision+1;d.reviewer_id:=actor;d.note_sha256:=n.note_sha256;
 d.decision:=p_decision;d.model_processing_allowed:=p_model_processing_allowed;d.review_ref:=p_review_ref;
 d.valid_until:=p_valid_until;d.recorded_at:=clock_timestamp();
 insert into mizizi_private.desk_factual_note_reviews_v1 select (d).*;
 return jsonb_build_object('contract','mizizi.factual_note_review.v1','noteId',n.note_id,'noteSha256',n.note_sha256,
  'reviewRevision',d.revision,'decision',d.decision,'reviewerId',actor,'modelProcessingAllowed',d.model_processing_allowed,
  'verified',false,'jobsDispatched',0);
end $function$
$wk_exact$
 then raise exception 'MIZIZI_AGENT_NOTE_REVIEW_PREIMAGE_CHANGED';end if;
end $wk_note_append_preimage$;
alter table mizizi_private.desk_factual_notes_v1
 alter column author_id drop not null,
 add column author_job_id uuid,
 add column author_worker_id text,
 add column origin_pass_fingerprint text,
 add column origin_claim_index integer,
 add column source_receipt_ids uuid[],
 drop constraint desk_factual_notes_v1_consultation_method_check,
 add constraint desk_factual_notes_v1_authorship_v1 check (
  (author_id is not null and consultation_method in ('manual_public_consultation','manual_first_party_consultation')
   and author_job_id is null and author_worker_id is null and origin_pass_fingerprint is null and origin_claim_index is null and source_receipt_ids is null)
  or (author_id is null and consultation_method='autonomous_authorized_consultation'
   and author_job_id is not null and author_worker_id is not null
   and author_worker_id ~ '^mizizi-chart:[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   and origin_pass_fingerprint is not null and origin_pass_fingerprint ~ '^[a-f0-9]{64}$'
   and origin_claim_index is not null and origin_claim_index between 0 and 19
   and source_receipt_ids is not null and cardinality(source_receipt_ids) between 1 and 12));
create unique index desk_factual_agent_note_pass_claim_v1 on mizizi_private.desk_factual_notes_v1(case_id,origin_pass_fingerprint,origin_claim_index)
 where author_job_id is not null;
create function mizizi_private.persist_desk_agent_notes_v1(p_job_id uuid,p_worker_id text,p_case_id uuid,p_fingerprint text,b jsonb)
returns void language plpgsql security definer set search_path=pg_catalog as $f$
declare c jsonb;o mizizi_private.desk_operational_policy_versions_v1;
 n mizizi_private.desk_factual_notes_v1;f jsonb;src jsonb;ref jsonb;sid uuid;
 r mizizi_private.desk_tool_receipts_v1;claim_index integer:=-1;ids uuid[];
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Agent notebook service authority required' using errcode='42501';end if;
 c:=mizizi_private.read_leased_chart_research_context_v1(p_job_id,p_worker_id);
 if c is null or c->>'caseId' is distinct from p_case_id::text then raise exception 'Agent notebook lease denied' using errcode='42501';end if;
 o:=mizizi_private.current_desk_operational_policy_v1(c);
 if o.revision is null or not mizizi_private.desk_operational_policy_live_v1(o,c)
  or b ? 'deskBatchReceipt' or b ? 'interruptionCode' or jsonb_array_length(b->'findings')>20
  or not exists(select 1 from mizizi_private.research_passes p where p.case_id=p_case_id and p.job_id=p_job_id
    and p.fingerprint=p_fingerprint and p.body_text::jsonb=b)
 then raise exception 'Agent notebook pass denied' using errcode='42501';end if;
 for f in select value from jsonb_array_elements(b->'findings') loop
  claim_index:=claim_index+1;
  if not(f ? 'fieldKey' or f ? 'noteKind') then continue;end if;
  if jsonb_typeof(f) is distinct from 'object' or (select count(*) from jsonb_object_keys(f))<>10
   or coalesce(f->>'fieldKey','') not in ('subject_version','release_date','performer','composition_credits','recording_production','label_distribution')
   or coalesce(f->>'noteKind','') not in ('direct_observation','attributed_claim','inference')
   or jsonb_typeof(f->'statement') is distinct from 'string' or length(f->>'statement') not between 8 and 1200
   or btrim(f->>'statement') is distinct from f->>'statement' or f->>'statement' ~ '[[:cntrl:]]'
   or jsonb_typeof(f->'sourceIds') is distinct from 'array' or jsonb_typeof(f->'consultationIds') is distinct from 'array'
   or jsonb_array_length((f->'sourceIds')||(f->'consultationIds')) not between 1 and 12
   or (select count(distinct v) from jsonb_array_elements_text((f->'sourceIds')||(f->'consultationIds')) v)<>jsonb_array_length((f->'sourceIds')||(f->'consultationIds'))
  then raise exception 'Agent notebook original note shape denied' using errcode='42501';end if;
  ids:=array[]::uuid[];n.source_locator:=null;n.observed_at:=null;
  for ref in select value from jsonb_array_elements((f->'sourceIds')||(f->'consultationIds')) loop
   if jsonb_typeof(ref) is distinct from 'string' or coalesce(ref#>>'{}','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
    then raise exception 'Agent notebook source identity denied' using errcode='42501';end if;
   sid:=(ref#>>'{}')::uuid;
   select * into r from mizizi_private.desk_tool_receipts_v1 where id=sid;
   if not found or r.job_id<>p_job_id or r.worker_id<>p_worker_id or r.lease_expires_at is distinct from (c->>'leaseExpiresAt')::timestamptz
    or not coalesce(mizizi_private.desk_custody_receipt_current_v1(r,c),false)
    or not exists(select 1 from jsonb_array_elements(b->'deskToolReceipts') d where d->>'receiptId'=sid::text
     and d->>'callSha256'=r.call_sha256 and d->>'resultSha256'=r.result_sha256)
    then raise exception 'Agent notebook source custody denied' using errcode='42501';end if;
   if f->'sourceIds' @> jsonb_build_array(sid::text) then
    if r.source_id is distinct from sid then raise exception 'Agent notebook retained source denied' using errcode='42501';end if;
    select value into src from jsonb_array_elements(b->'sourceReceipts') where value->>'sourceId'=sid::text;
    if not found or src->'modelDisclosed' is distinct from 'true'::jsonb
     or src->>'excerpt' is null or src->>'excerpt'='Visual derivative for examination; no textual claim is verified.'
     or (length(lower(regexp_replace(btrim(f->>'statement'),'[[:space:]]+',' ','g')))>=80
      and strpos(lower(regexp_replace(btrim(src->>'excerpt'),'[[:space:]]+',' ','g')),lower(regexp_replace(btrim(f->>'statement'),'[[:space:]]+',' ','g')))>0)
     then raise exception 'Agent notebook source or verbatim note denied' using errcode='42501';end if;
   else
    select value into src from jsonb_array_elements(b->'deskConsultationReceipts') where value->>'receiptId'=sid::text;
    if not found or r.source_id is not null or src is distinct from r.result_text::jsonb->'consultation'
     or f->'independentlyVerified' is distinct from 'false'::jsonb
     then raise exception 'Agent notebook transient consultation denied' using errcode='42501';end if;
   end if;
   if n.source_locator is null then n.source_locator:=src->>'citation';end if;
   n.observed_at:=greatest(n.observed_at,(src->>'observedAt')::timestamptz);
   ids:=array_append(ids,sid);
  end loop;
  n.note_id:=gen_random_uuid();n.case_id:=p_case_id;n.workspace_id:=(c->>'workspaceId')::uuid;
  n.expected_revision:=(c->>'expectedRevision')::integer;n.membership_sha256:=c->>'membershipSha256';
  n.observation_sha256:=c->>'observationSha256';n.author_id:=null;n.author_job_id:=p_job_id;n.author_worker_id:=p_worker_id;
  n.origin_pass_fingerprint:=p_fingerprint;n.origin_claim_index:=claim_index;n.source_receipt_ids:=ids;
  n.field_key:=f->>'fieldKey';n.note_kind:=f->>'noteKind';n.consultation_method:='autonomous_authorized_consultation';
  n.note_text:=f->>'statement';n.recorded_at:=clock_timestamp();
  n.note_sha256:=encode(sha256(convert_to(jsonb_build_array(n.case_id,n.workspace_id,n.expected_revision,n.membership_sha256,
   n.observation_sha256,n.author_job_id,n.author_worker_id,n.origin_pass_fingerprint,n.origin_claim_index,n.source_receipt_ids,
   n.field_key,n.note_kind,n.consultation_method,n.source_locator,n.note_text)::text,'UTF8')),'hex');
  insert into mizizi_private.desk_factual_notes_v1 select (n).*;
 end loop;
end $f$;
revoke all on function mizizi_private.persist_desk_agent_notes_v1(uuid,text,uuid,text,jsonb) from public,anon,authenticated,service_role,mizizi_executor;
CREATE OR REPLACE FUNCTION public.mizizi_append_research_pass_v1(p_job_id uuid, p_worker_id text, p_body_text text, p_fingerprint text, p_predecessor text)
 RETURNS TABLE(case_id uuid, ordinal integer, fingerprint text, outcome text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
 v_case_id uuid;
 v_workspace_id uuid;
 v_body jsonb;
 v_ordinal integer;
 v_last_ordinal integer;
 v_last_fingerprint text;
 v_existing text;
begin
 if coalesce(auth.role(),'')<>'service_role' then
  raise exception 'Service-role research authority required' using errcode='42501';
 end if;
 if p_job_id is null or p_worker_id is null or
    p_worker_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$' or
    p_body_text is null or octet_length(p_body_text)>32768 or
    (p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$')
 then raise exception 'Invalid bounded research-pass request' using errcode='22023';
 end if;
 if encode(sha256(convert_to(p_body_text,'UTF8')),'hex')<>p_fingerprint
 then raise exception 'Research-pass content fingerprint mismatch' using errcode='22023';
 end if;
 begin
  v_body:=p_body_text::jsonb;
 exception when others then
  raise exception 'Invalid research-pass JSON' using errcode='22023';
 end;
 if jsonb_typeof(v_body)<>'object'
    or v_body->>'contract' is distinct from 'mizizi.adaptive_investigation.v1'
    or v_body ? 'fingerprint'
    or jsonb_typeof(v_body->'sourceReceipts')<>'array'
    or jsonb_array_length(v_body->'sourceReceipts')>30
    or jsonb_typeof(v_body->'findings')<>'array'
    or jsonb_typeof(v_body->'proposedLeads')<>'array'
    or jsonb_typeof(v_body->'decision')<>'object'
 then
  raise exception 'Invalid research-pass contract' using errcode='22023';
 end if;
 begin
  v_ordinal:=(v_body->>'ordinal')::integer;
 exception when others then
  raise exception 'Research-pass ordinal is invalid' using errcode='22023';
 end;
 if (v_ordinal is null or v_ordinal not between 1 and 10000)
    or nullif(v_body->>'question','') is null
    or (v_body->>'predecessorFingerprint') is distinct from p_predecessor
 then raise exception 'Invalid research-pass identity' using errcode='22023';
 end if;
 if p_worker_id like 'mizizi-chart:%' then
  perform pg_advisory_xact_lock(214781521,61431);
 end if;
 -- Serialize appenders on the actual case row, and verify the worker's
 -- current lease and exact case revision inside this very transaction.
 select c.id,c.workspace_id into v_case_id,v_workspace_id
 from platform_private.jobs j
 join platform_private.command_receipts cr
  on cr.id=j.command_receipt_id
   and cr.resource_id=j.resource_id and cr.command_type=j.command_type
 join mizizi_private.case_resource_bindings b
  on b.resource_id=j.resource_id and b.case_id=j.resource_id
 join mizizi_private.cases c
  on c.id=b.case_id and c.workspace_id=b.workspace_id
 where j.id=p_job_id
  and j.command_type='mizizi.case_research_v1'
  and j.job_type='mizizi.case_research_v1'
  and j.status='running' and j.locked_by=p_worker_id
  and j.lease_expires_at>now() and cr.status='accepted'
  and (j.input_payload->>'case_id')::uuid=c.id
  and (j.input_payload->>'workspace_id')::uuid=c.workspace_id
  and j.input_payload->>'operation'='read_only_research'
  and c.case_state in ('open','in_progress')
  and c.current_stage='research'
  and c.revision=(j.input_payload->>'expected_case_revision')::integer
 for update of j,c;
 if v_case_id is null then
  raise exception 'Research pass is not authorized by a current job lease' using errcode='55000';
 end if;
 if exists (select 1 from mizizi_private.cases c where c.id=v_case_id and
   (c.claim_family_key='charts2_recording_investigation_v1' or exists (
    select 1 from mizizi_private.chart_candidate_subjects_v1 s where s.case_id=c.id)))
 then
   perform mizizi_private.assert_desk_journal_current_v1(p_job_id,p_worker_id,v_case_id,v_body);
 end if;
 if v_body->>'caseId' is distinct from v_case_id::text
    or v_body->>'workspaceId' is distinct from v_workspace_id::text
 then raise exception 'Research-pass workspace or case mismatch' using errcode='42501';
 end if;
 select p.fingerprint into v_existing
  from mizizi_private.research_passes p
 where p.case_id=v_case_id and p.ordinal=v_ordinal;
 if v_existing is not null then
  if v_existing<>p_fingerprint then
   raise exception 'Conflicting immutable pass ordinal' using errcode='55000';
  end if;
  return query select v_case_id,v_ordinal,p_fingerprint,'replayed'::text;
  return;
 end if;
 select p.ordinal,p.fingerprint into v_last_ordinal,v_last_fingerprint
 from mizizi_private.research_passes p
 where p.case_id=v_case_id order by p.ordinal desc limit 1;
 if v_ordinal<>coalesce(v_last_ordinal,0)+1
    or p_predecessor is distinct from v_last_fingerprint
 then raise exception 'Research-pass chain stale or out of order' using errcode='55000';
 end if;
 insert into mizizi_private.research_passes(
  case_id,workspace_id,job_id,ordinal,predecessor_fingerprint,fingerprint,body_text
 ) values(
  v_case_id,v_workspace_id,p_job_id,v_ordinal,p_predecessor,p_fingerprint,p_body_text
 );
 if exists(select 1 from jsonb_array_elements(v_body->'findings') f where f ? 'fieldKey' or f ? 'noteKind') then
  perform mizizi_private.persist_desk_agent_notes_v1(p_job_id,p_worker_id,v_case_id,p_fingerprint,v_body);
 end if;
 return query select v_case_id,v_ordinal,p_fingerprint,'created'::text;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_mizizi_review_factual_note_v1(p_note_id uuid, p_note_sha256 text, p_expected_review_revision integer, p_decision text, p_model_processing_allowed boolean, p_review_ref text, p_valid_until timestamp with time zone, p_acknowledgement text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare actor uuid;n mizizi_private.desk_factual_notes_v1;c mizizi_private.cases%rowtype;
 prev mizizi_private.desk_factual_note_reviews_v1;d mizizi_private.desk_factual_note_reviews_v1;
begin
 actor:=mizizi_private.assert_headquarters_operator_v1('steward');
 if p_note_id is null or coalesce(p_note_sha256,'') !~ '^[a-f0-9]{64}$'
 or p_expected_review_revision is null or p_expected_review_revision<0
 or coalesce(p_decision,'') not in ('admitted','revoked') or p_model_processing_allowed is null
 or (p_decision='revoked' and p_model_processing_allowed)
 or p_review_ref is null or length(p_review_ref) not between 8 and 500 or btrim(p_review_ref)<>p_review_ref or p_review_ref ~ '[[:cntrl:]]'
 or p_valid_until is null or not isfinite(p_valid_until) or p_valid_until<=clock_timestamp() or p_valid_until>clock_timestamp()+interval '24 hours'
 or p_acknowledgement is distinct from (case when p_decision='admitted'
 then 'I independently reviewed this exact original note, consultation method, provenance and permitted use; this is not factual verification.'
 else 'I revoke this exact factual note admission.' end )
 then raise exception 'Invalid factual note review' using errcode='22023';end if;
 perform pg_advisory_xact_lock(214781521,61431);
 select * into n from mizizi_private.desk_factual_notes_v1 where note_id=p_note_id;
 if not found or n.note_sha256<>p_note_sha256 then raise exception 'Note unavailable' using errcode='42501';end if;
 perform mizizi_private.assert_chart_candidate_research_actor_v1(n.workspace_id,actor);
 select * into prev from mizizi_private.desk_factual_note_reviews_v1 where note_id=n.note_id order by revision desc limit 1;
 if coalesce(prev.revision,0)<>p_expected_review_revision then raise exception 'Factual note review revision conflict' using errcode='PT409';end if;
 if p_decision='admitted' then
  if actor=n.author_id then raise exception 'Independent note reviewer required' using errcode='42501';end if;
  if n.author_id is not null then
   perform mizizi_private.assert_chart_candidate_research_actor_v1(n.workspace_id,n.author_id);
  elsif n.author_job_id is null or n.origin_pass_fingerprint is null then
   raise exception 'Agent note provenance required' using errcode='42501';
  end if;
  select * into c from mizizi_private.cases where id=n.case_id and workspace_id=n.workspace_id for update;
  if not found or c.revision<>n.expected_revision or c.case_state<>'in_progress' or c.current_stage<>'research'
  then raise exception 'Stale note case' using errcode='PT409';end if;
  perform mizizi_private.assert_chart_candidate_current_v1(n.case_id,n.workspace_id,null);
 elsif (prev.revision is null and n.author_job_id is null)
  or (prev.revision is not null and prev.decision<>'admitted') then
  raise exception 'No admitted or currently reusable agent note to revoke' using errcode='55000';
 end if;
 d.note_id:=n.note_id;d.revision:=p_expected_review_revision+1;d.reviewer_id:=actor;d.note_sha256:=n.note_sha256;
 d.decision:=p_decision;d.model_processing_allowed:=p_model_processing_allowed;d.review_ref:=p_review_ref;
 d.valid_until:=p_valid_until;d.recorded_at:=clock_timestamp();
 insert into mizizi_private.desk_factual_note_reviews_v1 select (d).*;
 return jsonb_build_object('contract','mizizi.factual_note_review.v1','noteId',n.note_id,'noteSha256',n.note_sha256,
  'reviewRevision',d.revision,'decision',d.decision,'reviewerId',actor,'modelProcessingAllowed',d.model_processing_allowed,
  'verified',false,'jobsDispatched',0);
end $function$;

-- Note recall shares the current custody and immutable journal authority.
-- The original pass is independently re-read; agent identity is a job, not
-- an authenticated human. No note becomes a canonical or source receipt.
do $wk_note_recall_preimage$ begin
 if pg_get_functiondef('public.mizizi_read_desk_factual_notes_v1(jsonb)'::regprocedure) is distinct from $wk_exact$CREATE OR REPLACE FUNCTION public.mizizi_read_desk_factual_notes_v1(p_scope jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare c jsonb;n mizizi_private.desk_factual_notes_v1;d mizizi_private.desk_factual_note_reviews_v1;
 items jsonb:='[]'::jsonb;body text;expiry timestamptz;
begin
 perform pg_advisory_xact_lock(214781521,61431);
 c:=mizizi_private.desk_custody_context_v1(p_scope);
 if c is null then return null;end if;
 for n in select x.* from mizizi_private.desk_factual_notes_v1 x
  where x.case_id=(c->>'caseId')::uuid and x.workspace_id=(c->>'workspaceId')::uuid
   and x.expected_revision=(c->>'expectedRevision')::integer
   and x.membership_sha256=c->>'membershipSha256' and x.observation_sha256=c->>'observationSha256'
  order by x.note_id
 loop
  select * into d from mizizi_private.desk_factual_note_reviews_v1 r where r.note_id=n.note_id order by r.revision desc limit 1;
  if not found or d.decision<>'admitted' or not d.model_processing_allowed or d.valid_until<=clock_timestamp()
   or d.note_sha256<>n.note_sha256 or d.reviewer_id=n.author_id then continue;end if;
  -- An expired or revoked actor invalidates this note rather than becoming
  -- permission to transmit it. Fail closed on any unexpected exception.
  begin
   perform mizizi_private.assert_chart_candidate_research_actor_v1(n.workspace_id,n.author_id);
   perform mizizi_private.assert_chart_candidate_research_actor_v1(n.workspace_id,d.reviewer_id);
  exception when insufficient_privilege then continue;end;
  if jsonb_array_length(items)>=12 then raise exception 'Factual note readback bound exceeded' using errcode='55000';end if;
  expiry:=least(d.valid_until,(c->>'leaseExpiresAt')::timestamptz);
  if expiry<=clock_timestamp() then return null;end if;
  items:=items||jsonb_build_array(jsonb_build_object(
   'noteId',n.note_id,'noteSha256',n.note_sha256,'reviewRevision',d.revision,
   'caseId',n.case_id,'workspaceId',n.workspace_id,'expectedRevision',n.expected_revision,
   'membershipSha256',n.membership_sha256,'observationSha256',n.observation_sha256,
   'authorId',n.author_id,'reviewerId',d.reviewer_id,'fieldKey',n.field_key,'noteKind',n.note_kind,
   'consultationMethod',n.consultation_method,'sourceLocator',n.source_locator,'noteText',n.note_text,
   'noteTextSha256',encode(sha256(convert_to(n.note_text,'UTF8')),'hex'),
   'locatorSha256',encode(sha256(convert_to(n.source_locator,'UTF8')),'hex'),
   'observedAt',n.observed_at,'reviewRef',d.review_ref,'validUntil',expiry,
   'representation','original_factual_note','verified',false,'modelUseEligible',true));
 end loop;
 if (c->>'leaseExpiresAt')::timestamptz<=clock_timestamp() then return null;end if;
 body:=jsonb_build_object('contract','mizizi.desk_factual_note_readback.v1',
  'scope',p_scope,'membershipSha256',c->>'membershipSha256','observationSha256',c->>'observationSha256',
  'notes',items)::text;
 return jsonb_build_object('bodyText',body,'bodySha256',encode(sha256(convert_to(body,'UTF8')),'hex'));
end $function$
$wk_exact$
 then raise exception 'MIZIZI_AGENT_NOTE_READ_PREIMAGE_CHANGED';end if;
 if pg_get_functiondef('mizizi_private.desk_factual_note_references_current_v1(jsonb,jsonb)'::regprocedure) is distinct from $wk_exact$CREATE OR REPLACE FUNCTION mizizi_private.desk_factual_note_references_current_v1(c jsonb, b jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare packet jsonb;notes jsonb;ref jsonb;ids uuid[]:=array[]::uuid[];nid uuid;
begin
 if jsonb_typeof(b->'factualNoteReferences') is distinct from 'array' or
 jsonb_array_length(b->'factualNoteReferences') not between 1 and 12 or b ? 'deskBatchReceipt' then return false;end if;
 packet:=public.mizizi_read_desk_factual_notes_v1(jsonb_build_object('jobId',c->'jobId','caseId',c->'caseId',
 'workspaceId',c->'workspaceId','expectedRevision',c->'expectedRevision','workerId',c->'workerId','leaseExpiresAt',c->'leaseExpiresAt'));
 if packet is null then return false;end if;
 notes:=(packet->>'bodyText')::jsonb->'notes';
 for ref in select value from jsonb_array_elements(b->'factualNoteReferences') loop
  if jsonb_typeof(ref) is distinct from 'object' or (select count(*) from jsonb_object_keys(ref))<>3
   or coalesce(ref->>'noteId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or coalesce(ref->>'noteSha256','') !~ '^[a-f0-9]{64}$' or jsonb_typeof(ref->'reviewRevision') is distinct from 'number'
   or coalesce(ref->>'reviewRevision','') !~ '^[1-9][0-9]{0,8}$' then return false;end if;
  nid:=(ref->>'noteId')::uuid;
  if nid=any(ids) or not exists(select 1 from jsonb_array_elements(notes) n where n->>'noteId'=ref->>'noteId'
   and n->>'noteSha256'=ref->>'noteSha256' and n->'reviewRevision'=ref->'reviewRevision') then return false;end if;
  -- Notes are context, not evidence citations, and cannot be treated as such.
  if exists(select 1 from jsonb_array_elements(b->'findings') f where f->'sourceIds' @> jsonb_build_array(nid::text))
   or exists(select 1 from jsonb_array_elements(b->'sourceReceipts') s where s->>'sourceId'=nid::text)
   then return false;end if;
  ids:=array_append(ids,nid);
 end loop;
 return true;
end $function$
$wk_exact$
 then raise exception 'MIZIZI_AGENT_NOTE_REFS_PREIMAGE_CHANGED';end if;
end $wk_note_recall_preimage$;
create function mizizi_private.desk_agent_note_current_v1(n mizizi_private.desk_factual_notes_v1,c jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare b jsonb;f jsonb;src jsonb;r mizizi_private.desk_tool_receipts_v1;sid uuid;
 locators jsonb:='[]'::jsonb;expiry timestamptz;observed timestamptz;
begin
 if c is null or n.author_id is not null or n.author_job_id is null
  or n.case_id::text is distinct from c->>'caseId' or n.workspace_id::text is distinct from c->>'workspaceId'
  or n.expected_revision is distinct from (c->>'expectedRevision')::integer
  or n.membership_sha256 is distinct from c->>'membershipSha256' or n.observation_sha256 is distinct from c->>'observationSha256'
  then return null;end if;
 select p.body_text::jsonb into b from mizizi_private.research_passes p where p.case_id=n.case_id
  and p.workspace_id=n.workspace_id and p.job_id=n.author_job_id and p.fingerprint=n.origin_pass_fingerprint
  and encode(sha256(convert_to(p.body_text,'UTF8')),'hex')=n.origin_pass_fingerprint;
 if not found then return null;end if;
 f:=b->'findings'->n.origin_claim_index;
 if f->>'statement' is distinct from n.note_text or f->>'fieldKey' is distinct from n.field_key
  or f->>'noteKind' is distinct from n.note_kind or ((f->'sourceIds')||(f->'consultationIds')) is distinct from to_jsonb(n.source_receipt_ids)
 then return null;end if;
 if n.note_sha256 is distinct from encode(sha256(convert_to(jsonb_build_array(n.case_id,n.workspace_id,n.expected_revision,n.membership_sha256,
   n.observation_sha256,n.author_job_id,n.author_worker_id,n.origin_pass_fingerprint,n.origin_claim_index,n.source_receipt_ids,
   n.field_key,n.note_kind,n.consultation_method,n.source_locator,n.note_text)::text,'UTF8')),'hex') then return null;end if;
 foreach sid in array n.source_receipt_ids loop
  select * into r from mizizi_private.desk_tool_receipts_v1 where id=sid;
  if not found or r.job_id is distinct from n.author_job_id or r.worker_id is distinct from n.author_worker_id
   or not coalesce(mizizi_private.desk_custody_receipt_current_v1(r,c),false)
   or not exists(select 1 from jsonb_array_elements(b->'deskToolReceipts') d where d->>'receiptId'=sid::text
    and d->>'callSha256'=r.call_sha256 and d->>'resultSha256'=r.result_sha256) then return null;end if;
  if f->'sourceIds' @> jsonb_build_array(sid::text) then
   if r.source_id is distinct from sid then return null;end if;
   select value into src from jsonb_array_elements(b->'sourceReceipts') where value->>'sourceId'=sid::text;
   if not found or src->'modelDisclosed' is distinct from 'true'::jsonb or src->>'citation' is null
    or src->>'excerpt' is null or src->>'excerpt'='Visual derivative for examination; no textual claim is verified.'
    or src->>'excerpt' is distinct from r.result_text::jsonb->'sources'->0->>'excerpt'
    or src->>'citation' is distinct from r.result_text::jsonb->'sources'->0->>'citation' then return null;end if;
   expiry:=least(expiry,(r.result_text::jsonb->'sources'->0->'source'->>'expiresAt')::timestamptz);
  else
   select value into src from jsonb_array_elements(b->'deskConsultationReceipts') where value->>'receiptId'=sid::text;
   if not found or r.source_id is not null or src is distinct from r.result_text::jsonb->'consultation' then return null;end if;
   expiry:=least(expiry,(select cp.valid_until from mizizi_private.desk_custody_policy_versions_v1 cp
    where cp.workspace_id=r.workspace_id and cp.host=r.host and cp.revision=r.policy_revision));
  end if;
  locators:=locators||jsonb_build_array(src->>'citation');
  observed:=greatest(observed,(src->>'observedAt')::timestamptz);
 end loop;
 if n.source_locator is distinct from locators->>0 or n.observed_at is distinct from observed
  or expiry is null or expiry<=clock_timestamp() then return null;end if;
 return jsonb_build_object('sourceLocators',locators,'validUntil',expiry);
end $f$;
revoke all on function mizizi_private.desk_agent_note_current_v1(mizizi_private.desk_factual_notes_v1,jsonb) from public,anon,authenticated,service_role,mizizi_executor;
CREATE FUNCTION mizizi_private.desk_factual_note_packet_v1(p_scope jsonb,p_note_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare c jsonb;n mizizi_private.desk_factual_notes_v1;d mizizi_private.desk_factual_note_reviews_v1;
 items jsonb:='[]'::jsonb;body text;expiry timestamptz;agent jsonb;agent_fields jsonb;
 o mizizi_private.desk_operational_policy_versions_v1;has_review boolean;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service-role required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(214781521,61431);
 c:=mizizi_private.desk_custody_context_v1(p_scope);
 if c is null then return null;end if;
 if p_note_ids is not null and (cardinality(p_note_ids) not between 1 and 12 or
  cardinality(p_note_ids)<>(select count(distinct v) from unnest(p_note_ids) v)) then return null;end if;
 o:=mizizi_private.current_desk_operational_policy_v1(c);
 for n in select x.* from mizizi_private.desk_factual_notes_v1 x
  where x.case_id=(c->>'caseId')::uuid and x.workspace_id=(c->>'workspaceId')::uuid
   and x.expected_revision=(c->>'expectedRevision')::integer
   and x.membership_sha256=c->>'membershipSha256' and x.observation_sha256=c->>'observationSha256'
   and (p_note_ids is null or x.note_id=any(p_note_ids))
  order by (x.author_id is null),case when x.author_id is not null then x.note_id end,x.recorded_at desc,x.note_id
 loop
  agent_fields:='{}'::jsonb;
  select * into d from mizizi_private.desk_factual_note_reviews_v1 r where r.note_id=n.note_id order by r.revision desc limit 1;
  has_review:=found;
  if n.author_id is not null then
   if not has_review or d.decision<>'admitted' or not d.model_processing_allowed or d.valid_until<=clock_timestamp()
    or d.note_sha256<>n.note_sha256 or d.reviewer_id=n.author_id then continue;end if;
   begin
    perform mizizi_private.assert_chart_candidate_research_actor_v1(n.workspace_id,n.author_id);
    perform mizizi_private.assert_chart_candidate_research_actor_v1(n.workspace_id,d.reviewer_id);
   exception when insufficient_privilege then continue;end;
   expiry:=least(d.valid_until,(c->>'leaseExpiresAt')::timestamptz);
  else
   -- A machine note is unverified original context. An independent standing
   -- session and current source rights govern reuse, not a fabricated review.
   if o.revision is null or not mizizi_private.desk_operational_policy_live_v1(o,c) then continue;end if;
   if has_review then
    if d.decision<>'admitted' or not d.model_processing_allowed or d.valid_until<=clock_timestamp() or d.note_sha256<>n.note_sha256 then continue;end if;
    begin perform mizizi_private.assert_chart_candidate_research_actor_v1(n.workspace_id,d.reviewer_id);
    exception when insufficient_privilege then continue;end;
   end if;
   agent:=mizizi_private.desk_agent_note_current_v1(n,c);
   if agent is null then continue;end if;
   expiry:=least(o.valid_until,(c->>'leaseExpiresAt')::timestamptz,(agent->>'validUntil')::timestamptz,
    case when has_review then d.valid_until end);
   agent_fields:=jsonb_build_object('authorJobId',n.author_job_id,'authorWorkerId',n.author_worker_id,
    'originPassFingerprint',n.origin_pass_fingerprint,'originClaimIndex',n.origin_claim_index,
    'sourceReceiptIds',to_jsonb(n.source_receipt_ids),'sourceLocators',agent->'sourceLocators',
    'modelUseRef','desk-standing:'||o.revision::text);
  end if;
  -- Bound only the selected context, never the durable corpus.
  if jsonb_array_length(items)>=12 then exit;end if;
  if expiry<=clock_timestamp() then return null;end if;
  items:=items||jsonb_build_array(jsonb_build_object(
   'noteId',n.note_id,'noteSha256',n.note_sha256,'reviewRevision',case when has_review then d.revision else 0 end,
   'caseId',n.case_id,'workspaceId',n.workspace_id,'expectedRevision',n.expected_revision,
   'membershipSha256',n.membership_sha256,'observationSha256',n.observation_sha256,
   'authorId',n.author_id,'reviewerId',d.reviewer_id,'fieldKey',n.field_key,'noteKind',n.note_kind,
   'consultationMethod',n.consultation_method,'sourceLocator',n.source_locator,'noteText',n.note_text,
   'noteTextSha256',encode(sha256(convert_to(n.note_text,'UTF8')),'hex'),
   'locatorSha256',encode(sha256(convert_to(n.source_locator,'UTF8')),'hex'),
   'observedAt',n.observed_at,'reviewRef',d.review_ref,'validUntil',expiry,
   'representation','original_factual_note','verified',false,'modelUseEligible',true)||agent_fields);
 end loop;
 if (c->>'leaseExpiresAt')::timestamptz<=clock_timestamp() then return null;end if;
 body:=jsonb_build_object('contract','mizizi.desk_factual_note_readback.v1',
  'scope',p_scope,'membershipSha256',c->>'membershipSha256','observationSha256',c->>'observationSha256',
  'notes',items)::text;
 return jsonb_build_object('bodyText',body,'bodySha256',encode(sha256(convert_to(body,'UTF8')),'hex'));
end $function$;

revoke all on function mizizi_private.desk_factual_note_packet_v1(jsonb,uuid[]) from public,anon,authenticated,service_role,mizizi_executor;
create or replace function public.mizizi_read_desk_factual_notes_v1(p_scope jsonb)
returns jsonb language sql security definer set search_path=pg_catalog as $f$
 select mizizi_private.desk_factual_note_packet_v1(p_scope,null::uuid[])
$f$;
-- Exact historical references can be checked without putting the whole
-- notebook into the current model context.
create function public.mizizi_read_desk_factual_notes_v1(p_scope jsonb,p_note_ids uuid[])
returns jsonb language sql security definer set search_path=pg_catalog as $f$
 select mizizi_private.desk_factual_note_packet_v1(p_scope,p_note_ids)
$f$;
revoke all on function public.mizizi_read_desk_factual_notes_v1(jsonb,uuid[]) from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_read_desk_factual_notes_v1(jsonb,uuid[]) to service_role;
CREATE OR REPLACE FUNCTION mizizi_private.desk_factual_note_references_current_v1(c jsonb, b jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare packet jsonb;notes jsonb;ref jsonb;ids uuid[]:=array[]::uuid[];nid uuid;requested uuid[];
begin
 if jsonb_typeof(b->'factualNoteReferences') is distinct from 'array' or
 jsonb_array_length(b->'factualNoteReferences') not between 1 and 12 or b ? 'deskBatchReceipt' then return false;end if;
 if exists(select 1 from jsonb_array_elements(b->'factualNoteReferences') v
  where coalesce(v->>'noteId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$') then return false;end if;
 select array_agg((v->>'noteId')::uuid) into requested from jsonb_array_elements(b->'factualNoteReferences') v;
 if cardinality(requested)<>(select count(distinct v) from unnest(requested) v) then return false;end if;
 packet:=mizizi_private.desk_factual_note_packet_v1(jsonb_build_object('jobId',c->'jobId','caseId',c->'caseId',
 'workspaceId',c->'workspaceId','expectedRevision',c->'expectedRevision','workerId',c->'workerId','leaseExpiresAt',c->'leaseExpiresAt'),requested);
 if packet is null then return false;end if;
 notes:=(packet->>'bodyText')::jsonb->'notes';
 for ref in select value from jsonb_array_elements(b->'factualNoteReferences') loop
  if jsonb_typeof(ref) is distinct from 'object' or (select count(*) from jsonb_object_keys(ref))<>3
   or coalesce(ref->>'noteId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or coalesce(ref->>'noteSha256','') !~ '^[a-f0-9]{64}$' or jsonb_typeof(ref->'reviewRevision') is distinct from 'number'
   or coalesce(ref->>'reviewRevision','') !~ '^(0|[1-9][0-9]{0,8})$' then return false;end if;
  nid:=(ref->>'noteId')::uuid;
  if nid=any(ids) or not exists(select 1 from jsonb_array_elements(notes) n where n->>'noteId'=ref->>'noteId'
   and n->>'noteSha256'=ref->>'noteSha256' and n->'reviewRevision'=ref->'reviewRevision') then return false;end if;
  -- Notes are context, not evidence citations, and cannot be treated as such.
  if exists(select 1 from jsonb_array_elements(b->'findings') f where f->'sourceIds' @> jsonb_build_array(nid::text))
   or exists(select 1 from jsonb_array_elements(b->'sourceReceipts') s where s->>'sourceId'=nid::text)
   then return false;end if;
  ids:=array_append(ids,nid);
 end loop;
 return true;
end $function$;


-- Exact journal extension: descriptors are immutable dependencies, not excerpts.
do $wk_consultation_journal_preimage$ begin
 if pg_get_functiondef('mizizi_private.assert_desk_journal_current_v1(uuid,text,uuid,jsonb)'::regprocedure) is distinct from $wk_exact$CREATE OR REPLACE FUNCTION mizizi_private.assert_desk_journal_current_v1(p_job_id uuid, p_worker_id text, p_case_id uuid, p_pending jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare c jsonb;b jsonb;ref jsonb;r mizizi_private.desk_tool_receipts_v1;
 s jsonb;a jsonb;seen uuid[];sid uuid;o mizizi_private.desk_operational_policy_versions_v1;deps uuid[];dep_sources uuid[];batch_bound boolean;
begin
 -- Same lock order as the existing custody RPCs: policy lock, then exact
 -- job/case locks. Public chart RPCs take the policy lock before row locks.
 perform pg_advisory_xact_lock(214781521,61431);
 c:=mizizi_private.read_leased_chart_research_context_v1(p_job_id,p_worker_id);
 if c is null or c->>'caseId' is distinct from p_case_id::text then
  raise exception 'Desk journal scope denied' using errcode='42501';end if;
 if p_pending is not null and not mizizi_private.desk_reopening_pending_pass_v1(p_job_id,p_case_id,p_pending) then
  raise exception 'Desk reopening event journal binding denied' using errcode='42501';end if;
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
  if b ? 'factualNoteReferences' and not coalesce(mizizi_private.desk_factual_note_references_current_v1(c||jsonb_build_object('workerId',p_worker_id),b),false) then
   raise exception 'Desk original factual note context denied' using errcode='42501';end if;
  batch_bound:=false;
  if b ? 'deskBatchReceipt' then
   batch_bound:=mizizi_private.desk_retained_batch_journal_current_v1(c,b);
   if not batch_bound then raise exception 'Desk batch journal binding denied' using errcode='42501';end if;
  end if;
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
    if o.revision is not null and p_pending is not null and b=p_pending and not batch_bound and
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
end $function$
$wk_exact$
 then raise exception 'MIZIZI_CONSULTATION_JOURNAL_PREIMAGE_CHANGED';end if;
end $wk_consultation_journal_preimage$;
CREATE OR REPLACE FUNCTION mizizi_private.assert_desk_journal_current_v1(p_job_id uuid, p_worker_id text, p_case_id uuid, p_pending jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare c jsonb;b jsonb;ref jsonb;r mizizi_private.desk_tool_receipts_v1;
 s jsonb;a jsonb;seen uuid[];sid uuid;o mizizi_private.desk_operational_policy_versions_v1;deps uuid[];dep_sources uuid[];batch_bound boolean;consultations jsonb;consultation_ids uuid[];finding jsonb;
begin
 -- Same lock order as the existing custody RPCs: policy lock, then exact
 -- job/case locks. Public chart RPCs take the policy lock before row locks.
 perform pg_advisory_xact_lock(214781521,61431);
 c:=mizizi_private.read_leased_chart_research_context_v1(p_job_id,p_worker_id);
 if c is null or c->>'caseId' is distinct from p_case_id::text then
  raise exception 'Desk journal scope denied' using errcode='42501';end if;
 if p_pending is not null and not mizizi_private.desk_reopening_pending_pass_v1(p_job_id,p_case_id,p_pending) then
  raise exception 'Desk reopening event journal binding denied' using errcode='42501';end if;
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
  if b ? 'factualNoteReferences' and not coalesce(mizizi_private.desk_factual_note_references_current_v1(c||jsonb_build_object('workerId',p_worker_id),b),false) then
   raise exception 'Desk original factual note context denied' using errcode='42501';end if;
  batch_bound:=false;
  if b ? 'deskBatchReceipt' then
   batch_bound:=mizizi_private.desk_retained_batch_journal_current_v1(c,b);
   if not batch_bound then raise exception 'Desk batch journal binding denied' using errcode='42501';end if;
  end if;
  consultations:='[]'::jsonb;consultation_ids:=array[]::uuid[];
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
    if o.revision is not null and p_pending is not null and b=p_pending and not batch_bound and
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
    if r.result_text::jsonb ? 'consultation' then
     consultations:=consultations||jsonb_build_array(r.result_text::jsonb->'consultation');
     consultation_ids:=array_append(consultation_ids,r.id);
    end if;
   end loop;
   if not(seen @> dep_sources and dep_sources @> seen) then
    raise exception 'Desk journal dependency source set denied' using errcode='42501';end if;
   if o.revision is not null and p_pending is not null and b=p_pending and exists(
    select 1 from mizizi_private.desk_tool_receipts_v1 q where q.job_id=p_job_id
     and q.lease_expires_at=(c->>'leaseExpiresAt')::timestamptz and not(q.id=any(deps))) then
    raise exception 'Desk journal missing lease dependency' using errcode='42501';end if;
  end if;
  if coalesce(b->'deskConsultationReceipts','[]'::jsonb) is distinct from consultations then
   raise exception 'Desk transient consultation dependency denied' using errcode='42501';end if;
  for finding in select value from jsonb_array_elements(b->'findings') loop
   if exists(select 1 from jsonb_array_elements_text(finding->'sourceIds') v where v=any(consultation_ids::text[])) then
    raise exception 'Desk consultation is not retained evidence' using errcode='42501';end if;
   if finding ? 'consultationIds' then
    if jsonb_typeof(finding->'consultationIds') is distinct from 'array' or exists(
     select 1 from jsonb_array_elements_text(finding->'consultationIds') v where not(v=any(consultation_ids::text[])))
     or (jsonb_array_length(finding->'consultationIds')>0 and
      (not(finding ? 'fieldKey' and finding ? 'noteKind') or finding->>'interpretation'='supported'
       or finding->'independentlyVerified' is distinct from 'false'::jsonb or finding->>'verificationRef' is not null))
    then raise exception 'Desk consultation cannot be an independent finding' using errcode='42501';end if;
   end if;
  end loop;
 end loop;
 if (c->>'leaseExpiresAt')::timestamptz<=clock_timestamp() then
  raise exception 'Desk journal lease expired' using errcode='55000';end if;
end $function$;
