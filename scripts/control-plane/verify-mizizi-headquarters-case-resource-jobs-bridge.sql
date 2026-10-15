-- Read-only, independent MIZIZI Headquarters Slice 1 case Resource/jobs verifier.
-- Run against the isolated canonical Preview AFTER CLI migration application.
-- It does not prove positive JIT admission or worker resume; test those separately.
do $verify$
declare
  v_proc oid;
  v_kind record;
  v_count bigint;
  v_def text;
begin
  if (select count(*) from supabase_migrations.schema_migrations) < 222
     or not exists (select 1 from supabase_migrations.schema_migrations
       where name='mizizi_case_resource_jobs_bridge_v1') then
    raise exception 'MIZIZI shared jobs: expected CLI-minted canonical migration missing';
  end if;
  if (select count(*) from editorial.resource_kinds where kind='mizizi_case'
    and enabled=false and label='MIZIZI internal case')<>1 then
    raise exception 'MIZIZI shared jobs: exact private Resource kind missing';
  end if;
  if to_regclass('mizizi_private.case_resource_bindings') is null
     or (select count(*) from pg_class
       where oid='mizizi_private.case_resource_bindings'::regclass
       and relrowsecurity and relforcerowsecurity)<>1
     or (select count(*) from pg_policy
       where polrelid='mizizi_private.case_resource_bindings'::regclass)<>0 then
    raise exception 'MIZIZI shared jobs: private bindings absent or RLS exposed';
  end if;
  if exists (select 1 from (values ('anon'),('authenticated'),('service_role'),('mizizi_executor')) as r(role_name)
    where has_table_privilege(r.role_name,'mizizi_private.case_resource_bindings','SELECT')
       or has_table_privilege(r.role_name,'mizizi_private.case_resource_bindings','INSERT')
       or has_table_privilege(r.role_name,'mizizi_private.case_resource_bindings','UPDATE')
       or has_table_privilege(r.role_name,'mizizi_private.case_resource_bindings','DELETE')) then
    raise exception 'MIZIZI shared jobs: raw binding table authority escaped';
  end if;
  if not exists (select 1 from pg_constraint where conrelid='mizizi_private.case_resource_bindings'::regclass
         and conname='wk_case_resource_binding_case_fk' and contype='f')
     or not exists (select 1 from pg_constraint where conrelid='mizizi_private.case_resource_bindings'::regclass
         and conname='wk_case_resource_binding_resource_fk' and contype='f')
     or not exists (select 1 from pg_constraint where conrelid='mizizi_private.case_resource_bindings'::regclass
         and conname='wk_case_resource_binding_identity_check' and contype='c')
     or not exists (select 1 from pg_indexes where schemaname='platform_private'
         and tablename='jobs' and indexname='wk_mizizi_case_research_stage_unique') then
    raise exception 'MIZIZI shared jobs: missing typed FK, identical UUID or job idempotency boundary';
  end if;
  if (select count(*) from pg_trigger where not tgisinternal and tgenabled='O'
      and tgname in ('wk_mizizi_case_resource_identity_guard',
      'wk_mizizi_case_resource_bindings_immutable',
      'wk_mizizi_case_resource_binding_integrity'))<>3 then
    raise exception 'MIZIZI shared jobs: immutable Resource/typed binding triggers absent';
  end if;
  select pg_get_functiondef('editorial.assert_resource_binding_integrity()'::regprocedure) into v_def;
  if position('mizizi_private.case_resource_bindings' in v_def)=0
     or position('editorial.field_submissions' in v_def)=0
     or position('SECURITY DEFINER' in v_def)=0 then
    raise exception 'MIZIZI shared jobs: editorial typed Resource validator drift';
  end if;
  if (select count(*) from platform_private.command_types where
      command_type='mizizi.case_research_v1' and job_type='mizizi.case_research_v1'
      and accepted_event_type='mizizi.case_research_v1.accepted'
      and success_event_type='mizizi.case_research_v1.succeeded'
      and failure_event_type='mizizi.case_research_v1.failed'
      and retry_event_type='mizizi.case_research_v1.retry_scheduled'
      and enabled)<>1 then
    raise exception 'MIZIZI shared jobs: shared command/event type not registered';
  end if;
  v_proc:=to_regprocedure('mizizi_private.admit_case_research_job_v1(uuid,uuid,integer,text,text,text,text)');
  if v_proc is null then
    raise exception 'MIZIZI shared jobs: trusted admission RPC missing';
  end if;
  if not exists (select 1 from pg_proc where oid=v_proc and prosecdef
    and proconfig=array['search_path=pg_catalog']::text[])
    or not has_function_privilege('mizizi_executor',v_proc,'EXECUTE')
    or has_function_privilege('anon',v_proc,'EXECUTE')
    or has_function_privilege('authenticated',v_proc,'EXECUTE')
    or has_function_privilege('service_role',v_proc,'EXECUTE') then
    raise exception 'MIZIZI shared jobs: executor-only RPC privilege/search_path drift';
  end if;
  select pg_get_functiondef(v_proc) into v_def;
  if position('perform mizizi_private.assert_executor_v1()' in v_def)=0
     or position($literal$session_user <> 'mizizi_executor'$literal$ in v_def)=0
     or position('for update' in lower(v_def))=0
     or position('platform_private.command_receipts' in v_def)=0
     or position('platform_private.jobs' in v_def)=0
     or position('platform_private.outbox_events' in v_def)=0
     or position('mizizi_private.case_receipt_links' in v_def)=0 then
    raise exception 'MIZIZI shared jobs: trusted transaction command contract changed';
  end if;
  if (select count(*) from mizizi_private.case_resource_bindings)<>0
     or (select count(*) from editorial.resources where resource_kind='mizizi_case')<>0
     or (select count(*) from platform_private.jobs where command_type='mizizi.case_research_v1')<>0
     or (select count(*) from platform_private.command_receipts where command_type='mizizi.case_research_v1')<>0
     or (select count(*) from platform_private.outbox_events where command_type='mizizi.case_research_v1')<>0 then
    raise exception 'MIZIZI shared jobs: dirty isolated Preview or unexpected job admission';
  end if;
  raise notice 'MIZIZI_CASE_SHARED_JOBS_SCHEMA_VERIFIER=PASS';
end;
$verify$;
select 'MIZIZI_CASE_SHARED_JOBS_SCHEMA_VERIFIER=PASS' as marker;
