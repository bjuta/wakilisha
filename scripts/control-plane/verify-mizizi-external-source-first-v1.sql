-- Read-only authority verification for Slice 2 source-first Work intake.
-- Never invokes admission, creates a case, edits Registry, or asserts evidence truth.
do $verify$
declare v_fn regprocedure:='mizizi_private.admit_external_wikidata_research_v1(uuid,text,bigint,text,text)'::regprocedure;
v_def text;
begin
 if (select count(*) from supabase_migrations.schema_migrations)<>233
  or (select max(version) from supabase_migrations.schema_migrations)<>'20261016092731'
 then raise exception 'STOP_MIZIZI_DB05_EXACT_PREVIEW_REPLAY';end if;
 v_def:=pg_get_functiondef(v_fn::oid);
 if position('mizizi_private.assert_executor_v1()' in v_def)=0
  or position($q$session_user<>'mizizi_executor'$q$ in v_def)=0
  or position('mizizi_private.cases' in v_def)=0
  or position('mizizi:external:v1:' in v_def)=0
  or position($q$'not_planned'$q$ in v_def)=0
  or position('on conflict on constraint mizizi_cases_workspace_key_unique do nothing' in v_def)=0
 then raise exception 'STOP_MIZIZI_DB05_GATEWAY_SOURCE_CHANGED';end if;
 if has_function_privilege('anon',v_fn,'EXECUTE')
  or has_function_privilege('authenticated',v_fn,'EXECUTE')
  or has_function_privilege('service_role',v_fn,'EXECUTE')
  or not has_function_privilege('mizizi_executor',v_fn,'EXECUTE')
  or has_table_privilege('mizizi_executor','public.registry_tracks','INSERT')
  or has_table_privilege('mizizi_executor','public.registry_tracks','UPDATE')
  or has_table_privilege('mizizi_executor','mizizi_private.cases','INSERT')
  or has_table_privilege('service_role','mizizi_private.cases','INSERT')
 then raise exception 'STOP_MIZIZI_DB05_PRIVATE_AUTHORITY_WIDENED';end if;
 raise notice 'MIZIZI_DB05_SOURCE_FIRST_AUTHORITY_AND_REGISTRY_ISOLATION=PASS';
end $verify$;
select 'MIZIZI_DB05_READ_ONLY_VERIFIER=PASS' as result;
