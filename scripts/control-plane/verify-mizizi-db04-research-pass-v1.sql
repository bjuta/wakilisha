-- Read-only isolated Preview verification after exact DB04 migration.
-- This does NOT assert any authentic source permissions or learning quality.
do $verify$
declare n integer;head text;
begin
 select count(*),max(version) into n,head from supabase_migrations.schema_migrations;
 if n<>232 or head<>'20261016064245' then
  raise exception 'STOP_DB04_PREVIEW_MIGRATION_HISTORY';
 end if;
 if to_regclass('mizizi_private.research_passes') is null
  or to_regprocedure('public.mizizi_append_research_pass_v1(uuid,text,text,text,text)') is null
  or to_regprocedure('public.mizizi_read_research_passes_v1(uuid,text)') is null
  or to_regprocedure('mizizi_private.admit_unfamiliar_track_investigation_v1(uuid,uuid,text)') is null
 then raise exception 'STOP_DB04_PREVIEW_CONTRACT_MISSING';end if;
 if (select count(*) from mizizi_private.research_passes)<>0
  or (select count(*) from mizizi_private.cases)<>0
  or (select count(*) from platform_private.jobs where command_type='mizizi.case_research_v1')<>0
 then raise exception 'STOP_DB04_PREVIEW_UNEXPECTED_OPERATING_FIXTURE';end if;
 if not (select relrowsecurity and relforcerowsecurity from pg_class
   where oid='mizizi_private.research_passes'::regclass)
  or has_table_privilege('anon','mizizi_private.research_passes','SELECT')
  or has_table_privilege('authenticated','mizizi_private.research_passes','SELECT')
  or has_table_privilege('service_role','mizizi_private.research_passes','SELECT')
  or not has_function_privilege('service_role',
   'public.mizizi_append_research_pass_v1(uuid,text,text,text,text)','EXECUTE')
  or has_function_privilege('authenticated',
   'public.mizizi_append_research_pass_v1(uuid,text,text,text,text)','EXECUTE')
  or has_function_privilege('service_role',
   'mizizi_private.admit_unfamiliar_track_investigation_v1(uuid,uuid,text)','EXECUTE')
  or not has_function_privilege('mizizi_executor',
   'mizizi_private.admit_unfamiliar_track_investigation_v1(uuid,uuid,text)','EXECUTE')
 then raise exception 'STOP_DB04_PREVIEW_PRIVILEGE_DRIFT';end if;
 raise notice 'MIZIZI_DB04_PREVIEW_RESEARCH_PASS_AUTHORITY=PASS';
end $verify$;
select 'MIZIZI_DB04_PREVIEW_NO_UNAUTHORIZED_MUTATIONS=PASS' as result;
