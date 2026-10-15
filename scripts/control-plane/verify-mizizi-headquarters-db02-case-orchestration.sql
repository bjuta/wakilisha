-- Independent, read-only acceptance of MIZIZI Headquarters DB02.
-- Run only on the isolated Preview after canonical CLI migration application.

do $db02_verify$
declare
  r record;
  v_workspace_id uuid;
begin
  if (select count(*) from supabase_migrations.schema_migrations) < 218
     or (select max(version) from supabase_migrations.schema_migrations) < '20261010091606'
     or (select count(*) from supabase_migrations.schema_migrations
         where version='20261010091606' and name='mizizi_case_orchestration_links_v1') <> 1 then
    raise exception 'DB02 verifier: incorrect isolated Preview migration ledger';
  end if;
  select id into strict v_workspace_id from mizizi_private.workspaces
    where workspace_key='wakilisha-internal';
  if (select count(*) from mizizi_private.cases) <> 0
     or (select count(*) from mizizi_private.case_events) <> 0
     or (select count(*) from mizizi_private.case_dependencies) <> 0
     or (select count(*) from mizizi_private.case_receipt_links) <> 0 then
    raise exception 'DB02 verifier: case fixtures/data must not persist';
  end if;
  for r in
    select c.oid, c.relname,c.relrowsecurity,c.relforcerowsecurity,
      (select count(*) from pg_policy where polrelid=c.oid) as policy_count
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='mizizi_private' and c.relname in
      ('cases','case_events','case_dependencies','case_receipt_links')
        and c.relkind='r'
  loop
    if not r.relrowsecurity or not r.relforcerowsecurity or r.policy_count <> 0 then
      raise exception 'DB02 verifier: RLS policy/force violation %',r.relname;
    end if;
    if has_table_privilege('anon',r.oid,'SELECT')
       or has_table_privilege('authenticated',r.oid,'SELECT')
       or has_table_privilege('service_role',r.oid,'SELECT')
       or has_table_privilege('mizizi_executor',r.oid,'SELECT')
       or has_table_privilege('anon',r.oid,'INSERT')
       or has_table_privilege('authenticated',r.oid,'INSERT')
       or has_table_privilege('service_role',r.oid,'INSERT')
       or has_table_privilege('mizizi_executor',r.oid,'INSERT')
       or has_table_privilege('authenticated',r.oid,'UPDATE')
       or has_table_privilege('authenticated',r.oid,'DELETE') then
      raise exception 'DB02 verifier: direct role permissions exposed %',r.relname;
    end if;
  end loop;
  -- Independently verify that the loop covered all four expected tables.
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='mizizi_private' and c.relname in
        ('cases','case_events','case_dependencies','case_receipt_links')
        and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity) <> 4 then
    raise exception 'DB02 verifier: four protected tables not present';
  end if;
  if (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='mizizi_private' and c.relname in
        ('cases','case_events','case_dependencies','case_receipt_links')
        and t.tgenabled='O' and not t.tgisinternal
        and t.tgname in (
          'mizizi_case_revision_guard','mizizi_cases_journal',
          'mizizi_case_events_immutable','mizizi_case_dependencies_immutable',
          'mizizi_case_receipt_links_immutable','mizizi_case_dependency_cycle_guard',
          'mizizi_case_receipt_link_authority_guard'
        )) <> 7 then
    raise exception 'DB02 verifier: missing immutability/journal/cycle/receipt triggers';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='mizizi_private' and p.proname in (
        'guard_case_revision_v1','journal_case_revision_v1',
        'block_case_history_mutation_v1','prevent_case_dependency_cycle_v1',
        'assert_case_receipt_authority_v1'
      ) and not p.prosecdef
        and p.proconfig @> array['search_path=pg_catalog']::text[]
        and not has_function_privilege('anon',p.oid,'EXECUTE')
        and not has_function_privilege('authenticated',p.oid,'EXECUTE')
        and not has_function_privilege('service_role',p.oid,'EXECUTE')
        and not has_function_privilege('mizizi_executor',p.oid,'EXECUTE')
     ) <> 5 then
    raise exception 'DB02 verifier: function ownership/execute/search_path mismatch';
  end if;
  if (select count(*) from pg_constraint
      where conrelid='mizizi_private.cases'::regclass
        and conname='mizizi_cases_workspace_key_unique' and contype='u') <> 1
     or (select count(*) from pg_constraint
      where conrelid='mizizi_private.case_dependencies'::regclass
        and conname='mizizi_case_dependencies_source_fk' and contype='f') <> 1
     or (select count(*) from pg_constraint
      where conrelid='mizizi_private.case_dependencies'::regclass
        and conname='mizizi_case_dependencies_target_fk' and contype='f') <> 1
     or (select count(*) from pg_constraint
      where conrelid='mizizi_private.case_receipt_links'::regclass
        and conname='mizizi_case_receipt_links_pair_check' and contype='c') <> 1 then
    raise exception 'DB02 verifier: workspace/idempotency/typed FK constraint missing';
  end if;
  if (select count(*) from platform_private.registry_execution_grants where status='active') <> 0
     or (select count(*) from platform_private.system_actor_capability_grants
         where status='active' and revoked_at is null and expires_at>now()) <> 0 then
    raise exception 'DB02 verifier: active Registry authority present';
  end if;
  raise notice 'MIZIZI_DB02_PERMANENT_VERIFIER=PASS';
end;
$db02_verify$;
select 'MIZIZI_DB02_PERMANENT_VERIFIER=PASS' as verifier_marker;
