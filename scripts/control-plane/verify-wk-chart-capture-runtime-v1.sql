-- Production/Preview read-only final verification. No source activation.
begin transaction read only;
set local statement_timeout='40s';
do $verify$
declare v_head text; v_count integer;v_name text;v_active boolean;
begin
 select count(*),max(version) into v_count,v_head from supabase_migrations.schema_migrations;
 if v_count<>234 or (select count(*) from supabase_migrations.schema_migrations
   where version=v_head and name='wk_chart_capture_runtime_v1')<>1 then
   raise exception 'WK100 capture runtime expected exactly 234 migration records';
 end if;
 if (select count(*) from storage.buckets where id='wk-chart-raw-evidence-v1' and public=false)<>1
   or (select count(*) from pg_policies where schemaname='storage' and tablename='objects')<>12
   or (select count(*) from public.wk_chart_capture_contracts_v1)<>0
   or (select count(*) from public.wk_chart_capture_attempts_v1)<>0
   or (select count(*) from public.wk_chart_capture_rows_v1)<>0
   or (select count(*) from public.wk_chart_weekly_freezes_v1)<>0
   or (select count(*) from private.wk_chart_runtime_reservations_v1)<>0
   or (select count(*) from storage.objects where bucket_id='wk-chart-raw-evidence-v1')<>0
 then raise exception 'WK100 capture runtime must remain empty and private until source admission'; end if;
 if (select relrowsecurity from pg_class where oid='private.wk_chart_runtime_reservations_v1'::regclass) is distinct from true
   or has_table_privilege('anon','private.wk_chart_runtime_reservations_v1','SELECT')
   or has_table_privilege('authenticated','private.wk_chart_runtime_reservations_v1','INSERT')
   or has_table_privilege('service_role','private.wk_chart_runtime_reservations_v1','SELECT')
 then raise exception 'WK100 reservation table leaked authority'; end if;
 foreach v_name in array array['wk_chart_runtime_reserve_v1','wk_chart_runtime_advance_v1',
   'wk_chart_runtime_commit_v1','wk_chart_runtime_fail_v1'] loop
   if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname=v_name and p.prosecdef)
   then raise exception 'WK100 runtime RPC not private-definer: %',v_name; end if;
 end loop;
 if has_function_privilege('anon','public.wk_chart_runtime_reserve_v1(uuid,date,timestamptz,smallint)','EXECUTE')
  or has_function_privilege('authenticated','public.wk_chart_runtime_commit_v1(uuid,uuid,text,jsonb,text,timestamptz,timestamptz,text,text)','EXECUTE')
  or not has_function_privilege('service_role','public.wk_chart_runtime_commit_v1(uuid,uuid,text,jsonb,text,timestamptz,timestamptz,text,text)','EXECUTE')
 then raise exception 'WK100 runtime RPC grants drift';end if;
 if to_regclass('cron.job') is not null then
   execute 'select exists(select 1 from cron.job where active and (jobname ilike ''%wk_chart%'' or command ilike ''%wk_chart_runtime%'' or command ilike ''%wk-chart-capture%''))' into v_active;
   if v_active then raise exception 'WK100 candidate runtime must not activate a scheduled job'; end if;
 end if;
end; $verify$;
select jsonb_build_object('result','PASS',
 'migration_count',(select count(*) from supabase_migrations.schema_migrations),
 'head',(select max(version) from supabase_migrations.schema_migrations),
 'candidate_contracts',(select count(*) from public.wk_chart_capture_contracts_v1),
 'reservations',(select count(*) from private.wk_chart_runtime_reservations_v1),
 'capture_receipts',(select count(*) from public.wk_chart_capture_attempts_v1),
 'private_objects',(select count(*) from storage.objects where bucket_id='wk-chart-raw-evidence-v1'),
 'published_historical_editions',(select count(*) from public.wk_chart_editions_v2 where status='published'),
 'no_activation',true) as wk100_capture_runtime_verification;
rollback;
