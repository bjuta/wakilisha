-- Issue #1441, Slice 1. CLI 2.107.0 mint #45834826655.
-- Pre-canonical research custody only. No Registry assertion, identity decision,
-- provider grant, enabled policy, raw archived body or publication.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
do $guard$
begin
 if current_user<>'postgres'
 or to_regprocedure('mizizi_private.read_leased_chart_research_context_v1(uuid,text)') is null
 or to_regclass('mizizi_private.desk_resource_reservations_v1') is null
 or to_regclass('mizizi_private.desk_search_reservations_v1') is null
 or to_regclass('mizizi_private.desk_custody_policy_versions_v1') is not null
 or to_regclass('mizizi_private.desk_tool_receipts_v1') is not null
 or to_regclass('mizizi_private.desk_reference_leads_v1') is not null
 or has_schema_privilege('service_role','mizizi_private','USAGE')
 or has_schema_privilege('authenticated','mizizi_private','USAGE')
 then raise exception 'STOP_MIZIZI_DESK_CUSTODY_PREIMAGE';end if;
end $guard$;
-- Standing, exact source-family policy, not a grant issued by the investigator.
-- The owner must independently review access/robots/terms, metadata/excerpt
-- retention, disclosure and conservative common origin/lineage. Same host
-- does not imply independent sources; no automatic cross-family independence.
create table mizizi_private.desk_custody_policy_versions_v1(
 workspace_id uuid not null,
 host text not null check(length(host) between 4 and 253 and host ~ '^[a-z0-9][a-z0-9.-]*[a-z0-9]$'),
 revision integer not null check(revision>=1),
 enabled boolean not null default false,
 source_family text not null check(source_family in ('brave_discovery','public_web')),
 authority_ref text not null check(length(btrim(authority_ref)) between 8 and 500),
 origin_key text not null check(length(btrim(origin_key)) between 8 and 500),
 lineage_key text not null check(length(btrim(lineage_key)) between 8 and 500),
 use_basis text not null check(use_basis in ('first_party','documented_consent','documented_contract','open_license')),
 private_research_allowed boolean not null default false,
 metadata_retention_allowed boolean not null default false,
 excerpt_retention_allowed boolean not null default false,
 external_model_processing_allowed boolean not null default false,
 valid_until timestamptz not null,
 recorded_at timestamptz not null default clock_timestamp(),
 primary key(workspace_id,host,revision),
 check((source_family='brave_discovery')=(host='api.search.brave.com')),
 check(source_family<>'brave_discovery' or not excerpt_retention_allowed),
 check(not enabled or (private_research_allowed and metadata_retention_allowed))
);
create table mizizi_private.desk_tool_receipts_v1(
 id uuid primary key,
 job_id uuid not null,case_id uuid not null,workspace_id uuid not null,
 expected_revision integer not null check(expected_revision>=1),
 worker_id text not null,
 lease_expires_at timestamptz not null,
 membership_sha256 text not null check(membership_sha256 ~ '^[a-f0-9]{64}$'),
 observation_sha256 text not null check(observation_sha256 ~ '^[a-f0-9]{64}$'),
 operation text not null check(operation in ('search_web','search_news','read_page')),
 call_sha256 text not null check(call_sha256 ~ '^[a-f0-9]{64}$'),
 result_sha256 text not null check(result_sha256 ~ '^[a-f0-9]{64}$'),
 host text not null,policy_revision integer not null,
 result_text text not null check(octet_length(result_text) between 1 and 30000),
 provenance jsonb not null check(jsonb_typeof(provenance)='object'),
 source_id uuid unique,
 recorded_at timestamptz not null default clock_timestamp(),
 foreign key(workspace_id,host,policy_revision)
 references mizizi_private.desk_custody_policy_versions_v1(workspace_id,host,revision),
 unique(job_id,lease_expires_at,call_sha256),
 check(source_id is null or source_id=id)
);
create index mz_desk_tool_receipts_case on mizizi_private.desk_tool_receipts_v1(case_id,recorded_at);
create table mizizi_private.desk_reference_leads_v1(
 id uuid primary key,
 receipt_id uuid not null references mizizi_private.desk_tool_receipts_v1(id),
 url text not null check(octet_length(url) between 9 and 2048),
 kind text not null check(kind='reference'),
 label text not null check(length(btrim(label)) between 1 and 500)
);
create index mz_desk_reference_receipt on mizizi_private.desk_reference_leads_v1(receipt_id);
alter table mizizi_private.desk_custody_policy_versions_v1 enable row level security;
alter table mizizi_private.desk_custody_policy_versions_v1 force row level security;
alter table mizizi_private.desk_tool_receipts_v1 enable row level security;
alter table mizizi_private.desk_tool_receipts_v1 force row level security;
alter table mizizi_private.desk_reference_leads_v1 enable row level security;
alter table mizizi_private.desk_reference_leads_v1 force row level security;
revoke all on mizizi_private.desk_custody_policy_versions_v1,mizizi_private.desk_tool_receipts_v1,
 mizizi_private.desk_reference_leads_v1 from public,anon,authenticated,service_role,mizizi_executor;

create function mizizi_private.guard_desk_custody_policy_v1()
returns trigger language plpgsql set search_path=pg_catalog as $policy$
declare last_revision integer;
begin
 if tg_op<>'INSERT' then raise exception 'Desk custody policy history immutable' using errcode='55000';end if;
 perform pg_advisory_xact_lock(214781521,61431);
 select max(revision) into last_revision from mizizi_private.desk_custody_policy_versions_v1
 where workspace_id=new.workspace_id and host=new.host;
 if new.revision<>coalesce(last_revision,0)+1 then raise exception 'Custody policy revision conflict' using errcode='PT409';end if;
 new.recorded_at:=clock_timestamp();return new;
end $policy$;
create trigger mz_desk_custody_policy_guard before insert or update or delete on
 mizizi_private.desk_custody_policy_versions_v1 for each row execute function mizizi_private.guard_desk_custody_policy_v1();
create trigger mz_desk_tool_receipt_immutable before update or delete on
 mizizi_private.desk_tool_receipts_v1 for each row execute function mizizi_private.guard_desk_resource_event_v1();
create trigger mz_desk_reference_lead_immutable before update or delete on
 mizizi_private.desk_reference_leads_v1 for each row execute function mizizi_private.guard_desk_resource_event_v1();

-- DB parsing is a custody-boundary sanity check, not the runtime's actual
-- DNS, URL, terms or egress policy. Accept only canonical HTTPS named hosts;
-- runtime still rejects unsafe URLs and every unsafe redirect/peer.
create function mizizi_private.desk_custody_url_host_v1(p_url text)
returns text language plpgsql immutable set search_path=pg_catalog as $url$
declare h text;
begin
 if p_url is null or octet_length(p_url) not between 9 and 2048 or p_url ~ '[[:cntrl:][:space:]#]'
 or position(chr(92) in p_url)>0 then return null;end if;
 h:=substring(p_url from '^https://([a-z0-9][a-z0-9.-]*[a-z0-9])(?:/|[?]|$)');
 if h is null or length(h)>253 or h !~ '[.]' or h ~ '^[0-9]' or h ~ '[.][.]'
 or h ~ '(^|[.])(localhost|local|internal|test|invalid|example|onion|home|lan|arpa)$'
 or p_url ~* '[?&][^=&]*(token|signature|password|passwd|secret|credential|session|api[-_]?key|authorization|x-amz-|x-goog-)[^=&]*='
 or p_url ~* '[?&](sig|auth|key)=' then return null;end if;
 return h;
end $url$;

create function mizizi_private.desk_custody_context_v1(p_scope jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $scope$
declare c jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service-role required' using errcode='42501';end if;
 if jsonb_typeof(p_scope) is distinct from 'object' then raise exception 'Invalid custody scope' using errcode='22023';end if;
 if (select count(*) from jsonb_object_keys(p_scope))<>6
 or not(p_scope ?& array['jobId','caseId','workspaceId','expectedRevision','workerId','leaseExpiresAt'])
 or coalesce(p_scope->>'jobId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 or coalesce(p_scope->>'caseId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 or coalesce(p_scope->>'workspaceId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 or coalesce(p_scope->>'expectedRevision','') !~ '^[1-9][0-9]{0,8}$'
 or coalesce(p_scope->>'workerId','') !~ '^mizizi-chart:[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 or coalesce(p_scope->>'leaseExpiresAt','') !~ '^.{20,40}$'
 then raise exception 'Invalid custody scope' using errcode='22023';end if;
 c:=mizizi_private.read_leased_chart_research_context_v1((p_scope->>'jobId')::uuid,p_scope->>'workerId');
 if c->>'caseId' is distinct from p_scope->>'caseId'
 or c->>'workspaceId' is distinct from p_scope->>'workspaceId'
 or c->>'expectedRevision' is distinct from p_scope->>'expectedRevision'
 or (c->>'leaseExpiresAt')::timestamptz is distinct from (p_scope->>'leaseExpiresAt')::timestamptz
 then return null;end if;
 return c;
end $scope$;

create function mizizi_private.current_desk_custody_policy_v1(p_workspace uuid,p_host text)
returns mizizi_private.desk_custody_policy_versions_v1 language sql security definer set search_path=pg_catalog as $policy$
 select p from mizizi_private.desk_custody_policy_versions_v1 p
 where p.workspace_id=p_workspace and p.host=p_host order by p.revision desc limit 1;
$policy$;
create function mizizi_private.desk_custody_policy_live_v1(p mizizi_private.desk_custody_policy_versions_v1)
returns boolean language sql stable set search_path=pg_catalog as $live$
 select coalesce(p.enabled and p.private_research_allowed and p.metadata_retention_allowed
 and p.external_model_processing_allowed and p.valid_until>clock_timestamp(),false);
$live$;
-- Model-facing tool receipts require BOTH metadata/excerpt retention and
-- model-use permission. Human-only custody is intentionally not supported by
-- this bridge; never hide a denied source inside a model result.
create function public.mizizi_read_desk_custody_policy_v1(p_scope jsonb,p_host text)
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
 'validUntil',p.valid_until);
end $read$;

create function mizizi_private.desk_custody_receipt_current_v1(r mizizi_private.desk_tool_receipts_v1,c jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog as $current$
declare p mizizi_private.desk_custody_policy_versions_v1;
begin
 if r.id is null or c is null or r.case_id::text is distinct from c->>'caseId'
 or r.workspace_id::text is distinct from c->>'workspaceId'
 or r.membership_sha256 is distinct from c->>'membershipSha256'
 or r.observation_sha256 is distinct from c->>'observationSha256' then return false;end if;
 p:=mizizi_private.current_desk_custody_policy_v1(r.workspace_id,r.host);
 return mizizi_private.desk_custody_policy_live_v1(p) and p.revision=r.policy_revision
 and (r.source_id is null or p.excerpt_retention_allowed);
end $current$;

-- Store exact projection and opaque lead mappings in one transaction. No
-- arbitrary provider response, full HTML, PDF, screenshot, secret or query
-- text is retained. Source excerpts are bounded and require source-family
-- retention plus disclosure permission; separate envelope policy still applies.
create function public.mizizi_record_desk_tool_receipt_v1(
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
 or jsonb_typeof(result) is distinct from 'object' or coalesce(op,'') not in ('search_web','search_news','read_page')
 or jsonb_typeof(call_body->'input') is distinct from 'object'
 or (select count(*) from jsonb_object_keys(x))<>2 or (select count(*) from jsonb_object_keys(call_body))<>2
 or (select count(*) from jsonb_object_keys(call_body->'input'))<>1
 or (select count(*) from jsonb_object_keys(result))<>4
 or not(result ?& array['receiptId','leads','sources','visual']) or result->'visual'<>'null'::jsonb
 or coalesce(result->>'receiptId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 or jsonb_typeof(result->'leads') is distinct from 'array' or jsonb_array_length(result->'leads')<>jsonb_array_length(p_lead_bindings)
 or jsonb_typeof(result->'sources') is distinct from 'array' or jsonb_array_length(result->'sources')>1
 then raise exception 'Invalid custody projection' using errcode='22023';end if;
 rid:=(result->>'receiptId')::uuid;
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
   and previous.host=p_host and previous.policy_revision=p_policy_revision and previous.provenance=(p_provenance-'requestText')
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
 else
  if p.source_family<>'public_web' or not(call_body->'input' ? 'lead_id')
   or coalesce(call_body->'input'->>'lead_id','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or not(p_provenance ?& array['requestedUrl','finalUrl','sourceSha256','projectionSha256','contentType','retrievedAt','byteLength','hopSha256','locator'])
   or (select count(*) from jsonb_object_keys(p_provenance))<>9
   or mizizi_private.desk_custody_url_host_v1(p_provenance->>'finalUrl') is distinct from p.host
   or coalesce(p_provenance->>'sourceSha256','') !~ '^[0-9a-f]{64}$'
   or coalesce(p_provenance->>'projectionSha256','') !~ '^[0-9a-f]{64}$'
   or coalesce(p_provenance->>'contentType','') not in ('text/html','application/xhtml+xml','text/plain','application/pdf')
   or coalesce(p_provenance->>'byteLength','') !~ '^[1-9][0-9]{0,6}$'
   or (p_provenance->>'byteLength')::integer>2000000
   or coalesce(p_provenance->>'locator','') !~ '^(article_text|plain_text|pdf_page:[1-9][0-9]{0,4}|no_text)$'
   or jsonb_typeof(p_provenance->'hopSha256') is distinct from 'array'
   or jsonb_array_length(p_provenance->'hopSha256') not between 1 and 4
  then return null;end if;
  observed:=(p_provenance->>'retrievedAt')::timestamptz;
  if observed is null or observed>clock_timestamp() then return null;end if;
  select * into parent_lead from mizizi_private.desk_reference_leads_v1 where id=(call_body->'input'->>'lead_id')::uuid;
  if not found or parent_lead.url is distinct from p_provenance->>'requestedUrl' then return null;end if;
  select * into parent_receipt from mizizi_private.desk_tool_receipts_v1 where id=parent_lead.receipt_id;
  if not mizizi_private.desk_custody_receipt_current_v1(parent_receipt,c) then return null;end if;
  for hop in select jsonb_array_elements_text(p_provenance->'hopSha256') loop
   if hop !~ '^[0-9a-f]{64}$' then return null;end if;
   select * into native_r from mizizi_private.desk_resource_reservations_v1
   where resource='native_https' and request_sha256=hop and job_id=(s->>'jobId')::uuid
   and case_id=(s->>'caseId')::uuid and workspace_id=(s->>'workspaceId')::uuid
   and expected_revision=(s->>'expectedRevision')::integer and worker_id=s->>'workerId'
   and lease_expires_at=(s->>'leaseExpiresAt')::timestamptz and consumed_at is not null;
   if not found or native_r.membership_sha256<>c->>'membershipSha256' or native_r.observation_sha256<>c->>'observationSha256'
   then return null;end if;
  end loop;
  if jsonb_array_length(result->'sources')=1 then
   if not p.excerpt_retention_allowed or p_provenance->>'locator'='no_text' then return null;end if;
   src:=result->'sources'->0;authsrc:=src->'source';source_id:=rid;
   if jsonb_typeof(src) is distinct from 'object' or (select count(*) from jsonb_object_keys(src))<>3
   or jsonb_typeof(authsrc) is distinct from 'object' or (select count(*) from jsonb_object_keys(authsrc))<>14
   or jsonb_typeof(src->'excerpt') is distinct from 'string' or length(btrim(src->>'excerpt')) not between 1 and 4000
   or src->>'citation' is distinct from (p_provenance->>'finalUrl')||'#'||(p_provenance->>'locator')
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
   or lead->>'kind' is distinct from 'reference' or jsonb_typeof(lead->'label') is distinct from 'string'
   or length(btrim(lead->>'label')) not between 1 and 500 then return null;end if;
  select value into binding from jsonb_array_elements(p_lead_bindings) where value->>'id'=lead->>'id';
  if not found or jsonb_typeof(binding) is distinct from 'object'
   or (select count(*) from jsonb_object_keys(binding))<>2
   or mizizi_private.desk_custody_url_host_v1(binding->>'url') is null then return null;end if;
 end loop;
 if p.valid_until<=clock_timestamp() or (s->>'leaseExpiresAt')::timestamptz<=clock_timestamp() then return null;end if;
 insert into mizizi_private.desk_tool_receipts_v1(id,job_id,case_id,workspace_id,expected_revision,worker_id,
 lease_expires_at,membership_sha256,observation_sha256,operation,call_sha256,result_sha256,host,policy_revision,result_text,provenance,source_id)
 values(rid,(s->>'jobId')::uuid,(s->>'caseId')::uuid,(s->>'workspaceId')::uuid,(s->>'expectedRevision')::integer,s->>'workerId',
 (s->>'leaseExpiresAt')::timestamptz,c->>'membershipSha256',c->>'observationSha256',op,p_call_sha256,p_result_sha256,p.host,p.revision,p_result_text,p_provenance-'requestText',source_id);
 insert into mizizi_private.desk_reference_leads_v1(id,receipt_id,url,kind,label)
 select (l->>'id')::uuid,rid,b->>'url',l->>'kind',l->>'label'
 from jsonb_array_elements(result->'leads') l join jsonb_array_elements(p_lead_bindings) b on l->>'id'=b->>'id';
 return jsonb_build_object('receiptId',rid,'resultSha256',p_result_sha256,'outcome','created');
end $append$;

create function public.mizizi_read_desk_tool_receipt_v1(p_scope jsonb,p_receipt_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $read$
declare c jsonb;r mizizi_private.desk_tool_receipts_v1;
begin
 perform pg_advisory_xact_lock(214781521,61431);
 c:=mizizi_private.desk_custody_context_v1(p_scope);
 select * into r from mizizi_private.desk_tool_receipts_v1 where id=p_receipt_id;
 if not mizizi_private.desk_custody_receipt_current_v1(r,c) then return null;end if;
 return jsonb_build_object('receiptId',r.id,'callSha256',r.call_sha256,'resultSha256',r.result_sha256,
 'resultText',r.result_text,'provenance',r.provenance);
end $read$;
create function public.mizizi_resolve_desk_reference_lead_v1(p_scope jsonb,p_lead_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $resolve$
declare c jsonb;r mizizi_private.desk_tool_receipts_v1;l mizizi_private.desk_reference_leads_v1;
begin
 perform pg_advisory_xact_lock(214781521,61431);
 c:=mizizi_private.desk_custody_context_v1(p_scope);
 select * into l from mizizi_private.desk_reference_leads_v1 where id=p_lead_id;
 if not found then return null;end if;
 select * into r from mizizi_private.desk_tool_receipts_v1 where id=l.receipt_id;
 if not mizizi_private.desk_custody_receipt_current_v1(r,c) then return null;end if;
 return jsonb_build_object('id',l.id,'url',l.url,'kind',l.kind,'label',l.label,'receiptId',r.id);
end $resolve$;
revoke all on function mizizi_private.guard_desk_custody_policy_v1(),mizizi_private.desk_custody_url_host_v1(text),
 mizizi_private.desk_custody_context_v1(jsonb),mizizi_private.current_desk_custody_policy_v1(uuid,text),
 mizizi_private.desk_custody_policy_live_v1(mizizi_private.desk_custody_policy_versions_v1),
 mizizi_private.desk_custody_receipt_current_v1(mizizi_private.desk_tool_receipts_v1,jsonb)
 from public,anon,authenticated,service_role,mizizi_executor;
revoke all on function public.mizizi_read_desk_custody_policy_v1(jsonb,text),
 public.mizizi_record_desk_tool_receipt_v1(text,text,text,text,text,integer,jsonb,jsonb),
 public.mizizi_read_desk_tool_receipt_v1(jsonb,uuid),public.mizizi_resolve_desk_reference_lead_v1(jsonb,uuid)
 from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_read_desk_custody_policy_v1(jsonb,text),
 public.mizizi_record_desk_tool_receipt_v1(text,text,text,text,text,integer,jsonb,jsonb),
 public.mizizi_read_desk_tool_receipt_v1(jsonb,uuid),public.mizizi_resolve_desk_reference_lead_v1(jsonb,uuid) to service_role;
comment on table mizizi_private.desk_tool_receipts_v1 is 'Private pre-canonical case tool projections, not Registry assertions or independent identity proof.';
commit;
