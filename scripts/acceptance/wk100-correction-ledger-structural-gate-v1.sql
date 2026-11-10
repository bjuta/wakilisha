-- WAKILISHA 100 W5C: read-only structural gate after isolated migration replay.
-- Run only on an accepted disposable/preproduction database after applying the
-- exact CLI-minted migration. This does NOT authorize Production deployment.
do $check$
declare
  v_required_tables integer;
  v_triggers integer;
  v_definer integer;
begin
  select count(*) into v_required_tables
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='platform_private' and c.relname in (
    'wk100_correction_cases_v1','wk100_correction_events_v1')
    and c.relrowsecurity;
  if v_required_tables<>2 then
    raise exception 'WK100 W5C private tables or RLS missing';
  end if;
  if has_table_privilege('authenticated',
     'platform_private.wk100_correction_cases_v1','INSERT')
     or has_table_privilege('authenticated',
     'platform_private.wk100_correction_cases_v1','UPDATE')
     or has_table_privilege('authenticated',
     'platform_private.wk100_correction_events_v1','INSERT')
     or has_table_privilege('service_role',
     'platform_private.wk100_correction_events_v1','INSERT')
     or has_table_privilege('anon',
     'platform_private.wk100_correction_cases_v1','SELECT') then
    raise exception 'WK100 W5C private table grants unsafe';
  end if;
  if not has_function_privilege('authenticated',
      'public.wk100_record_correction_decision_v1(jsonb)','EXECUTE')
     or not has_function_privilege('authenticated',
      'public.wk100_read_correction_cases_v1(date,uuid,uuid)','EXECUTE')
     or has_function_privilege('anon',
      'public.wk100_record_correction_decision_v1(jsonb)','EXECUTE')
     or has_function_privilege('service_role',
      'public.wk100_record_correction_decision_v1(jsonb)','EXECUTE')
     or has_function_privilege('anon',
      'public.wk100_read_correction_cases_v1(date,uuid,uuid)','EXECUTE') then
    raise exception 'WK100 W5C RPC grants unsafe';
  end if;
  select count(*) into v_triggers
  from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='platform_private' and not t.tgisinternal
    and t.tgname in (
      'wk100_correction_events_no_update_delete_v1',
      'wk100_correction_events_no_truncate_v1',
      'wk100_correction_cases_update_guard_v1',
      'wk100_correction_cases_delete_guard_v1',
      'wk100_correction_cases_truncate_guard_v1');
  if v_triggers<>5 then
    raise exception 'WK100 W5C immutability triggers missing';
  end if;
  select count(*) into v_definer
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in (
    'wk100_record_correction_decision_v1','wk100_read_correction_cases_v1')
    and p.prosecdef and 'search_path=pg_catalog'=any(p.proconfig);
  if v_definer<>2 then
    raise exception 'WK100 W5C secured RPC bodies missing';
  end if;
  raise notice 'WK100_CORRECTION_LEDGER_STRUCTURAL_GATE=PASS';
end
$check$;
