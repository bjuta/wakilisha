-- Read-only structural verifier after target migration is applied to a clean
-- disposable preview. Does not exercise provider HTTP or mutate capture rows.
begin transaction read only;

do $wk_verify_chart_receipts$
declare
  v_name text;
  v_count integer;
  v_guard regprocedure;
  v_jobs integer:=0;
begin
  if (select count(*) from supabase_migrations.schema_migrations) <> 232
     or (select max(version) from supabase_migrations.schema_migrations)<>'20261019152307'
  then
    raise exception 'STOP: expected exactly 232 migrations at CLI-minted WK100 receipt head';
  end if;
  foreach v_name in array array[
    'wk_chart_capture_contracts_v1','wk_chart_capture_attempts_v1',
    'wk_chart_capture_rows_v1','wk_chart_weekly_freezes_v1'] loop
    if to_regclass(format('public.%I',v_name)) is null then
      raise exception 'STOP: missing table %',v_name;
    end if;
    if not (select c.relrowsecurity from pg_class c
            where c.oid=format('public.%I',v_name)::regclass)
       or exists(select 1 from pg_policies p
                 where p.schemaname='public' and p.tablename=v_name)
       or has_table_privilege('anon',format('public.%I',v_name),'SELECT')
       or has_table_privilege('authenticated',format('public.%I',v_name),'SELECT')
       or has_table_privilege('authenticated',format('public.%I',v_name),'INSERT')
       or has_table_privilege('service_role',format('public.%I',v_name),'UPDATE')
       or has_table_privilege('service_role',format('public.%I',v_name),'DELETE')
       or not has_table_privilege('service_role',format('public.%I',v_name),'INSERT')
       or not has_table_privilege('service_role',format('public.%I',v_name),'SELECT')
    then raise exception 'STOP: exposed or unwritable capture table %',v_name;
    end if;
    select count(*) into v_count
    from pg_trigger
    where tgrelid=format('public.%I',v_name)::regclass
      and tgname=regexp_replace(v_name,'_v1$','')||'_immutable' and not tgisinternal and tgenabled='O';
    if v_count<>1 then
      raise exception 'STOP: immutable trigger absent for %',v_name;
    end if;
  end loop;

  if to_regprocedure('private.wk_chart_capture_block_mutation_v1()') is null
     or to_regprocedure('private.wk_chart_capture_validate_attempt_v1()') is null
     or to_regprocedure('private.wk_chart_capture_validate_row_v1()') is null
     or to_regprocedure('private.wk_chart_capture_validate_freeze_v1()') is null
     or not exists(select 1 from pg_trigger
         where tgrelid='public.wk_chart_capture_attempts_v1'::regclass
           and tgname='wk_chart_capture_attempts_validate' and tgenabled='O')
     or not exists(select 1 from pg_trigger
         where tgrelid='public.wk_chart_capture_rows_v1'::regclass
           and tgname='wk_chart_capture_rows_validate' and tgenabled='O')
     or not exists(select 1 from pg_trigger
         where tgrelid='public.wk_chart_weekly_freezes_v1'::regclass
           and tgname='wk_chart_weekly_freezes_validate' and tgenabled='O')
  then raise exception 'STOP: missing source-native row or weekly freeze guards';
  end if;

  select 'private.wk_chart_capture_validate_row_v1()'::regprocedure into v_guard;
  if has_function_privilege('anon',v_guard,'EXECUTE')
     or has_function_privilege('authenticated',v_guard,'EXECUTE')
     or has_function_privilege('service_role',v_guard,'EXECUTE')
     or not (select prosecdef from pg_proc where oid=v_guard)
  then raise exception 'STOP: source row trigger helper privilege drift';
  end if;
  select 'private.wk_chart_capture_validate_freeze_v1()'::regprocedure into v_guard;
  if has_function_privilege('anon',v_guard,'EXECUTE')
     or has_function_privilege('authenticated',v_guard,'EXECUTE')
     or has_function_privilege('service_role',v_guard,'EXECUTE')
     or not (select prosecdef from pg_proc where oid=v_guard)
  then raise exception 'STOP: freeze trigger helper privilege drift';
  end if;

  if (select count(*) from public.wk_chart_capture_contracts_v1)<>0
     or (select count(*) from public.wk_chart_capture_attempts_v1)<>0
     or (select count(*) from public.wk_chart_capture_rows_v1)<>0
     or (select count(*) from public.wk_chart_weekly_freezes_v1)<>0
  then raise exception 'STOP: fresh receipt preview unexpectedly prepopulated';
  end if;
  if to_regclass('cron.job') is not null then
    execute 'select count(*) from cron.job where active and ' ||
      '(jobname ilike ''%chart%'' or command ilike ''%wk_chart_capture%'')'
      into v_jobs;
  end if;
  if v_jobs<>0 then raise exception 'STOP: chart scheduler was unexpectedly armed';
  end if;
end;
$wk_verify_chart_receipts$;

select jsonb_build_object(
  'result','PASS',
  'migration_head',(select max(version) from supabase_migrations.schema_migrations),
  'contract_rows',(select count(*) from public.wk_chart_capture_contracts_v1),
  'capture_attempts',(select count(*) from public.wk_chart_capture_attempts_v1),
  'source_rows',(select count(*) from public.wk_chart_capture_rows_v1),
  'weekly_freezes',(select count(*) from public.wk_chart_weekly_freezes_v1),
  'chart_cron_jobs_checked',to_regclass('cron.job') is not null,
  'published_historical_editions',(select count(*) from public.wk_chart_editions_v2 where status='published')
) as wk_chart_receipt_schema_acceptance;
rollback;
