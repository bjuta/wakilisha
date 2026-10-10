-- Permanent independent acceptance contract for MIZIZI Headquarters DB05.
-- Read-only. Re-run after rollback fixture tests and after deploy promotion.
do $verify_db05$
declare
  v_item text;
  rel oid;
  fn regprocedure;
  tcount integer;
  head_version text;
  bad integer;
begin
 select count(*),max(version) into tcount,head_version from supabase_migrations.schema_migrations;
 if tcount<220 or head_version<'20261010100017' or
   (select count(*) from supabase_migrations.schema_migrations sm
      where sm.version='20261010100017' and sm.name='mizizi_license_hold_policy_v1')<>1 then
   raise exception 'DB05 VERIFY: exact Preview ledger mismatch: %/%',tcount,head_version;
 end if;
 foreach v_item in array array['stewardship_licenses','license_events','write_holds',
  'write_hold_events','policy_evaluations'] loop
   rel:=to_regclass('mizizi_private.'||v_item);
   if rel is null then raise exception 'DB05 VERIFY: missing %',v_item; end if;
   if not exists (select 1 from pg_class where oid=rel and relrowsecurity and relforcerowsecurity) then
     raise exception 'DB05 VERIFY: RLS and FORCE missing %',v_item;
   end if;
   if has_table_privilege('anon',rel,'SELECT') or has_table_privilege('anon',rel,'INSERT')
     or has_table_privilege('authenticated',rel,'SELECT') or has_table_privilege('authenticated',rel,'INSERT')
     or has_table_privilege('service_role',rel,'SELECT') or has_table_privilege('service_role',rel,'INSERT')
     or has_table_privilege('mizizi_executor',rel,'SELECT') or has_table_privilege('mizizi_executor',rel,'INSERT') then
     raise exception 'DB05 VERIFY: new private table exposed: %',v_item;
   end if;
   execute format('select count(*) from mizizi_private.%I',v_item) into bad;
   if bad<>0 then raise exception 'DB05 VERIFY: fixture/governance rows unexpectedly present in %',v_item; end if;
 end loop;
 foreach v_item in array array[
  'assert_registry_admission_not_held_v1(text,integer)',
  'guard_write_hold_lifecycle_v1()',
  'guard_stewardship_license_v1()',
  'append_db05_history_v1()',
  'block_db05_immutable_history_v1()',
  'enforce_registry_admission_hold_v1()'] loop
   fn:=to_regprocedure('mizizi_private.'||v_item);
   if fn is null then raise exception 'DB05 VERIFY: missing function %',v_item; end if;
   if exists (select 1 from pg_proc where oid=fn and (prosecdef or
     not ('search_path=pg_catalog'=any(proconfig)))) then
      raise exception 'DB05 VERIFY: function privileges/search path incorrect: %',v_item;
   end if;
   if has_function_privilege('anon',fn,'EXECUTE')
     or has_function_privilege('authenticated',fn,'EXECUTE')
     or has_function_privilege('service_role',fn,'EXECUTE')
     or has_function_privilege('mizizi_executor',fn,'EXECUTE') then
      raise exception 'DB05 VERIFY: private function is executable by API/worker: %',v_item;
   end if;
 end loop;
 foreach v_item in array array[
  'wk_db05_write_holds_guard','wk_db05_licenses_guard',
  'wk_db05_hold_history','wk_db05_license_history',
  'wk_db05_license_events_immutable','wk_db05_hold_events_immutable',
  'wk_db05_policy_evaluations_immutable','wk_db05_registry_grant_admission_hold',
  'wk_db05_registry_operation_admission_hold'] loop
   if not exists (select 1 from pg_trigger where tgname=v_item and tgenabled='O' and not tgisinternal) then
      raise exception 'DB05 VERIFY: mandatory hold/journal gateway trigger absent: %',v_item;
   end if;
 end loop;
 if not exists (select 1 from pg_trigger where tgname='registry_execution_grants_review_authority_guard' and tgenabled='O')
    or not exists (select 1 from pg_trigger where tgname='registry_execution_grants_target_fingerprint_guard' and tgenabled='O') then
   raise exception 'DB05 VERIFY: older Registry receipt/grant gates lost';
 end if;
 if (select count(*) from mizizi_private.workspaces)<>1
   or (select count(*) from platform_private.registry_execution_grants where status='active')<>0
   or (select count(*) from platform_private.system_actor_capability_grants
      where status='active' and revoked_at is null and expires_at>now())<>0 then
   raise exception 'DB05 VERIFY: workspace or active-grant contamination';
 end if;
 raise notice 'MIZIZI_DB05_PERMANENT_VERIFIER=PASS';
end;
$verify_db05$;
select 'MIZIZI_DB05_PERMANENT_VERIFIER=PASS' as verifier_marker;
