-- Issue #1441. CLI 2.107.0 mint #45848653637.
-- Independent exact envelope/tool authority. No grant seeded. Only policy
-- digests are stored, never prompts, images, private questions or tool inputs.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
do $guard$
begin
 if current_user<>'postgres'
 or to_regclass('mizizi_private.desk_model_authority_versions_v1') is not null
 or to_regprocedure('mizizi_private.desk_custody_context_v1(jsonb)') is null
 or has_schema_privilege('service_role','mizizi_private','USAGE')
 then raise exception 'STOP_DESK_MODEL_AUTHORITY_PREIMAGE';end if;
end $guard$;
create table mizizi_private.desk_model_authority_versions_v1(
 workspace_id uuid not null,case_id uuid not null,
 operation text not null check(operation in ('model_disclose','tool_execute')),
 binding_sha256 text not null check(binding_sha256 ~ '^[0-9a-f]{64}$'),
 revision integer not null check(revision>=1),
 enabled boolean not null default false,
 authority_ref text not null check(length(btrim(authority_ref)) between 8 and 500),
 valid_until timestamptz not null,
 recorded_at timestamptz not null default clock_timestamp(),
 primary key(workspace_id,case_id,operation,binding_sha256,revision)
);
alter table mizizi_private.desk_model_authority_versions_v1 enable row level security;
alter table mizizi_private.desk_model_authority_versions_v1 force row level security;
revoke all on mizizi_private.desk_model_authority_versions_v1 from public,anon,authenticated,service_role,mizizi_executor;
create function mizizi_private.guard_desk_model_authority_v1()
returns trigger language plpgsql set search_path=pg_catalog as $guard$
declare prev integer;
begin
 if tg_op<>'INSERT' then raise exception 'Desk model authority history immutable' using errcode='55000';end if;
 perform pg_advisory_xact_lock(214781521,61431);
 select max(revision) into prev from mizizi_private.desk_model_authority_versions_v1
 where workspace_id=new.workspace_id and case_id=new.case_id and operation=new.operation and binding_sha256=new.binding_sha256;
 if new.revision<>coalesce(prev,0)+1 then raise exception 'Desk model authority revision conflict' using errcode='PT409';end if;
 new.recorded_at:=clock_timestamp();return new;
end $guard$;
create trigger mz_desk_model_authority_guard before insert or update or delete on
 mizizi_private.desk_model_authority_versions_v1 for each row execute function mizizi_private.guard_desk_model_authority_v1();
revoke all on function mizizi_private.guard_desk_model_authority_v1() from public,anon,authenticated,service_role,mizizi_executor;

create function public.mizizi_authorize_desk_model_operation_v1(
 p_scope jsonb,p_operation text,p_binding_text text,p_binding_sha256 text
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $authorize$
declare c jsonb;b jsonb;t jsonb;i jsonb;op text;item jsonb;rid uuid;sid uuid;
 p mizizi_private.desk_model_authority_versions_v1;
 r mizizi_private.desk_tool_receipts_v1;l mizizi_private.desk_reference_leads_v1;
 receipt_ids uuid[]:=array[]::uuid[];source_ids uuid[]:=array[]::uuid[];seen_sources uuid[]:=array[]::uuid[];
 expiry timestamptz;receipt_expiry timestamptz;
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
 if not found or not p.enabled then return null;end if;
 expiry:=least(p.valid_until,(c->>'leaseExpiresAt')::timestamptz);
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
  if op in ('search_web','search_news') then
   if (select count(*) from jsonb_object_keys(i))<>1 or jsonb_typeof(i->'query') is distinct from 'string'
    or length(btrim(i->>'query')) not between 3 and 300 then return null;end if;
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
 return jsonb_build_object('operation',p_operation,'bindingSha256',p_binding_sha256,
  'policyRef','desk-model:'||p_binding_sha256||':'||p.revision::text,'validUntil',expiry,'allowed',true);
end $authorize$;
revoke all on function public.mizizi_authorize_desk_model_operation_v1(jsonb,text,text,text) from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_authorize_desk_model_operation_v1(jsonb,text,text,text) to service_role;
do $acl$
begin
 if has_function_privilege('anon','public.mizizi_authorize_desk_model_operation_v1(jsonb,text,text,text)','EXECUTE')
 or has_function_privilege('authenticated','public.mizizi_authorize_desk_model_operation_v1(jsonb,text,text,text)','EXECUTE')
 or has_function_privilege('mizizi_executor','public.mizizi_authorize_desk_model_operation_v1(jsonb,text,text,text)','EXECUTE')
 or has_table_privilege('service_role','mizizi_private.desk_model_authority_versions_v1','INSERT')
 or has_schema_privilege('service_role','mizizi_private','USAGE')
 then raise exception 'STOP_DESK_MODEL_AUTHORITY_ACL';end if;
end $acl$;
commit;
