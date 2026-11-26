-- Issue #1441. CLI 2.107.0 mint #45846011806.
-- Independent exact URL/operation policy; no enabled grant seeded.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
do $guard$
begin
 if current_user<>'postgres'
 or to_regclass('mizizi_private.desk_access_policy_versions_v1') is not null
 or to_regprocedure('mizizi_private.desk_custody_context_v1(jsonb)') is null
 or has_schema_privilege('service_role','mizizi_private','USAGE')
 then raise exception 'STOP_DESK_ACCESS_PREIMAGE';end if;
end $guard$;
create table mizizi_private.desk_access_policy_versions_v1(
 workspace_id uuid not null,host text not null,
 url_sha256 text not null check(url_sha256 ~ '^[0-9a-f]{64}$'),
 operation text not null check(operation in ('native_acquire','native_text','browser_text','pdf_visual','browser_visual','browser_render','browser_request')),
 revision integer not null check(revision>=1),custody_revision integer not null,
 enabled boolean not null default false,
 authority_ref text not null check(length(btrim(authority_ref)) between 8 and 500),
 valid_until timestamptz not null,
 recorded_at timestamptz not null default clock_timestamp(),
 primary key(workspace_id,host,url_sha256,operation,revision),
 foreign key(workspace_id,host,custody_revision)
 references mizizi_private.desk_custody_policy_versions_v1(workspace_id,host,revision)
);
alter table mizizi_private.desk_access_policy_versions_v1 enable row level security;
alter table mizizi_private.desk_access_policy_versions_v1 force row level security;
revoke all on mizizi_private.desk_access_policy_versions_v1 from public,anon,authenticated,service_role,mizizi_executor;
create function mizizi_private.guard_desk_access_policy_v1()
returns trigger language plpgsql set search_path=pg_catalog as $guard$
declare prev integer;
begin
 if tg_op<>'INSERT' then raise exception 'Desk access policy history immutable' using errcode='55000';end if;
 perform pg_advisory_xact_lock(214781521,61431);
 select max(revision) into prev from mizizi_private.desk_access_policy_versions_v1
 where workspace_id=new.workspace_id and host=new.host and url_sha256=new.url_sha256 and operation=new.operation;
 if new.revision<>coalesce(prev,0)+1 then raise exception 'Desk access revision conflict' using errcode='PT409';end if;
 new.recorded_at:=clock_timestamp();return new;
end $guard$;
create trigger mz_desk_access_policy_guard before insert or update or delete on
 mizizi_private.desk_access_policy_versions_v1 for each row execute function mizizi_private.guard_desk_access_policy_v1();
revoke all on function mizizi_private.guard_desk_access_policy_v1() from public,anon,authenticated,service_role,mizizi_executor;

create function public.mizizi_authorize_desk_access_v1(
 p_scope jsonb,p_operation text,p_binding_text text,p_binding_sha256 text
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $authorize$
declare c jsonb;b jsonb;d jsonb;u text;h text;urlhash text;
 p mizizi_private.desk_access_policy_versions_v1;
 custody mizizi_private.desk_custody_policy_versions_v1;
 expiry timestamptz;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service-role required' using errcode='42501';end if;
 if p_binding_text is null or octet_length(p_binding_text) not between 1 and 8192
 or p_binding_sha256 is null or p_binding_sha256<>encode(sha256(convert_to(p_binding_text,'UTF8')),'hex')
 or coalesce(p_operation,'') not in ('native_acquire','native_text','browser_text','pdf_visual','browser_visual','browser_render','browser_request')
 then raise exception 'Invalid desk access binding' using errcode='22023';end if;
 b:=p_binding_text::jsonb;d:=b->'descriptor';u:=b->>'url';
 if jsonb_typeof(b) is distinct from 'object' or jsonb_typeof(d) is distinct from 'object'
 then raise exception 'Invalid desk access object' using errcode='22023';end if;
 if (select count(*) from jsonb_object_keys(b))<>2 or not(b ?& array['url','descriptor'])
 or jsonb_typeof(b->'url') is distinct from 'string'
 then raise exception 'Invalid desk access shape' using errcode='22023';end if;
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
 if not found or not p.enabled or p.custody_revision is distinct from custody.revision then return null;end if;
 expiry:=least(p.valid_until,custody.valid_until,(c->>'leaseExpiresAt')::timestamptz);
 if expiry<=clock_timestamp() then return null;end if;
 return jsonb_build_object('operation',p_operation,'bindingSha256',p_binding_sha256,'urlSha256',urlhash,
  'policyRef','desk-access:'||urlhash||':'||p_operation||':'||p.revision::text||':'||custody.revision::text,
  'validUntil',expiry,'allowed',true);
end $authorize$;
revoke all on function public.mizizi_authorize_desk_access_v1(jsonb,text,text,text) from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_authorize_desk_access_v1(jsonb,text,text,text) to service_role;
do $acl$
begin
 if has_function_privilege('anon','public.mizizi_authorize_desk_access_v1(jsonb,text,text,text)','EXECUTE')
 or has_function_privilege('authenticated','public.mizizi_authorize_desk_access_v1(jsonb,text,text,text)','EXECUTE')
 or has_function_privilege('mizizi_executor','public.mizizi_authorize_desk_access_v1(jsonb,text,text,text)','EXECUTE')
 or has_table_privilege('service_role','mizizi_private.desk_access_policy_versions_v1','INSERT')
 or has_schema_privilege('service_role','mizizi_private','USAGE')
 then raise exception 'STOP_DESK_ACCESS_ACL';end if;
end $acl$;
commit;
