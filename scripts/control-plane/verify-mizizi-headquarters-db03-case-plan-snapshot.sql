-- Independent permanent DB03 Preview verifier, read-only. No production mutation.
do $db03_verify$
declare r record;
begin
 if (select count(*) from supabase_migrations.schema_migrations)<>219
    or (select max(version) from supabase_migrations.schema_migrations)<>'20261010093509'
    or (select count(*) from supabase_migrations.schema_migrations where version='20261010093509' and name='mizizi_case_plan_snapshot_v1')<>1 then
   raise exception 'DB03 verifier: migration ledger mismatch';
 end if;
 if (select count(*) from mizizi_private.workspaces where workspace_key='wakilisha-internal')<>1
   or (select count(*) from mizizi_private.cases)<>0
   or (select count(*) from mizizi_private.case_snapshots)<>0
   or (select count(*) from mizizi_private.plan_versions)<>0
   or (select count(*) from mizizi_private.case_events)<>0 then
   raise exception 'DB03 verifier: leaked fixtures or unexpected headquarters records';
 end if;
 if to_regclass('mizizi_private.stage_leases') is not null then
   raise exception 'DB03 verifier: parallel stage-lease store prohibited; reuse platform_private.jobs';
 end if;
 if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='mizizi_private' and c.relname in ('case_snapshots','plan_versions')
      and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity)<>2 then
    raise exception 'DB03 verifier: private RLS/force RLS missing';
 end if;
 for r in select c.oid,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='mizizi_private' and c.relname in ('case_snapshots','plan_versions') and c.relkind='r'
 loop
   if (select count(*) from pg_policy where polrelid=r.oid)<>0
    or has_table_privilege('anon',r.oid,'SELECT') or has_table_privilege('anon',r.oid,'INSERT')
    or has_table_privilege('authenticated',r.oid,'SELECT') or has_table_privilege('authenticated',r.oid,'INSERT')
    or has_table_privilege('authenticated',r.oid,'UPDATE') or has_table_privilege('authenticated',r.oid,'DELETE')
    or has_table_privilege('service_role',r.oid,'SELECT') or has_table_privilege('service_role',r.oid,'INSERT')
    or has_table_privilege('mizizi_executor',r.oid,'SELECT') or has_table_privilege('mizizi_executor',r.oid,'INSERT') then
     raise exception 'DB03 verifier: direct table authority exposed %',r.relname;
   end if;
 end loop;
 if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='mizizi_private' and p.proname in ('freeze_case_snapshot_v1','assert_frozen_plan_v1','block_frozen_plan_change_v1')
    and not p.prosecdef and p.proconfig @> array['search_path=pg_catalog']::text[]
    and not has_function_privilege('anon',p.oid,'EXECUTE')
    and not has_function_privilege('authenticated',p.oid,'EXECUTE')
    and not has_function_privilege('service_role',p.oid,'EXECUTE')
    and not has_function_privilege('mizizi_executor',p.oid,'EXECUTE'))<>3 then
   raise exception 'DB03 verifier: private hardened trigger functions mismatched';
 end if;
 if (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid
    where c.oid in ('mizizi_private.case_snapshots'::regclass,'mizizi_private.plan_versions'::regclass)
     and not t.tgisinternal and t.tgenabled='O' and t.tgname in
      ('mizizi_freeze_case_snapshot','mizizi_case_snapshots_immutable','mizizi_assert_frozen_plan','mizizi_plan_versions_immutable'))<>4 then
   raise exception 'DB03 verifier: four immutable/frozen triggers missing';
 end if;
 if not exists(select 1 from pg_constraint where conrelid='mizizi_private.cases'::regclass
    and conname='mizizi_cases_active_plan_version_fk' and contype='f')
   or not exists(select 1 from pg_constraint where conrelid='mizizi_private.plan_versions'::regclass
    and conname='mizizi_plan_versions_snapshot_fk' and contype='f')
   or not exists(select 1 from pg_constraint where conrelid='mizizi_private.plan_versions'::regclass
    and conname='mizizi_plan_versions_scope_version_unique' and contype='u')
   or not exists(select 1 from pg_constraint where conrelid='mizizi_private.case_snapshots'::regclass
    and conname='mizizi_case_snapshots_scope_id_unique' and contype='u') then
   raise exception 'DB03 verifier: FK/version/snapshot uniqueness missing';
 end if;
 if (select count(*) from platform_private.registry_execution_grants where status='active')<>0
   or (select count(*) from platform_private.system_actor_capability_grants
      where status='active' and revoked_at is null and expires_at>now())<>0 then
   raise exception 'DB03 verifier: standing Registry grant present';
 end if;
 raise notice 'MIZIZI_DB03_PERMANENT_VERIFIER=PASS';
end;
$db03_verify$;
select 'MIZIZI_DB03_PERMANENT_VERIFIER=PASS' as verifier_marker;
