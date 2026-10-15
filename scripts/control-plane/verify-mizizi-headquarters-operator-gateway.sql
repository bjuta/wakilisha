-- Independent Preview verifier candidate. Read-only, no bootstrap or fixtures.
do $wk_operator_verifier$
declare sig text; o oid;
begin
 if (select count(*) from supabase_migrations.schema_migrations)<225
 then raise exception 'Operator gateway baseline migration history is missing'; end if;
 if (select count(*) from mizizi_private.workspaces
      where workspace_key='wakilisha-internal' and workspace_kind='internal' and status='active')<>1
 then raise exception 'Internal workspace authority drift'; end if;
 foreach sig in array array[
  'public.admin_mizizi_bootstrap_internal_owner_v1(text)',
  'public.admin_mizizi_cases_v1(integer,timestamp with time zone,uuid)',
  'public.admin_mizizi_case_events_v1(uuid,integer)',
  'public.admin_mizizi_begin_case_research_v1(uuid,integer,text)',
  'public.admin_mizizi_hold_workspace_writes_v1(text,text,timestamp with time zone)',
  'public.admin_mizizi_release_workspace_hold_v1(uuid,integer,text)',
  'public.admin_mizizi_list_workspace_holds_v1(integer)'
 ] loop
  o := to_regprocedure(sig);
  if o is null then raise exception 'Missing reviewed operator RPC: %',sig; end if;
  if not exists(select 1 from pg_proc p where p.oid=o
        and p.prosecdef and pg_get_userbyid(p.proowner)='postgres'
        and p.proconfig @> array['search_path=pg_catalog']::text[])
  then raise exception 'Operator RPC owner/security/search path drift: %',sig; end if;
  if not has_function_privilege('authenticated',o,'EXECUTE')
   or has_function_privilege('anon',o,'EXECUTE')
   or has_function_privilege('service_role',o,'EXECUTE')
   or has_function_privilege('mizizi_executor',o,'EXECUTE')
  then raise exception 'Operator RPC access boundary leaked: %',sig; end if;
 end loop;
 if to_regprocedure('mizizi_private.assert_headquarters_operator_v1(text)') is null
 then raise exception 'Operator membership guard missing'; end if;
 if not exists (select 1 from pg_proc p
   where p.oid='mizizi_private.assert_headquarters_operator_v1(text)'::regprocedure
     and p.prosecdef and pg_get_userbyid(p.proowner)='postgres'
     and p.proconfig @> array['search_path=pg_catalog']::text[])
 then raise exception 'Operator identity assertion owner/search path drift'; end if;
 if to_regprocedure('public.current_user_has_capability(text)') is null
   or to_regprocedure('mizizi_private.assert_registry_admission_not_held_v1(text,integer)') is null
 then raise exception 'Governed capability or Registry Hold Writes authority missing'; end if;
 if not exists (select 1 from pg_trigger t where t.tgrelid='mizizi_private.cases'::regclass
   and t.tgname='mizizi_cases_journal' and t.tgenabled='O')
   or not exists (select 1 from pg_trigger t where t.tgrelid='mizizi_private.write_holds'::regclass
   and t.tgname='wk_db05_hold_history' and t.tgenabled='O')
   or not exists (select 1 from pg_trigger t where t.tgrelid='platform_private.registry_execution_grants'::regclass
   and t.tgname='wk_db05_registry_grant_admission_hold' and t.tgenabled='O')
   or not exists (select 1 from pg_trigger t where t.tgrelid='platform_private.registry_mutation_operations'::regclass
   and t.tgname='wk_db05_registry_operation_admission_hold' and t.tgenabled='O')
 then raise exception 'Governed case/hold append-only and Registry enforcement triggers drifted'; end if;
 if has_function_privilege('anon','mizizi_private.assert_headquarters_operator_v1(text)','EXECUTE')
    or has_function_privilege('authenticated','mizizi_private.assert_headquarters_operator_v1(text)','EXECUTE')
    or has_function_privilege('service_role','mizizi_private.assert_headquarters_operator_v1(text)','EXECUTE')
    or has_function_privilege('mizizi_executor','mizizi_private.assert_headquarters_operator_v1(text)','EXECUTE')
 then raise exception 'Private operator guard must not be client-callable'; end if;
 if has_table_privilege('authenticated','mizizi_private.cases','SELECT')
    or has_table_privilege('service_role','mizizi_private.cases','SELECT')
    or has_table_privilege('authenticated','mizizi_private.write_holds','INSERT')
    or has_table_privilege('service_role','mizizi_private.write_holds','INSERT')
 then raise exception 'Operator API must not grant private table access'; end if;
 raise notice 'MIZIZI_HEADQUARTERS_OPERATOR_GATEWAY_VERIFIER=PASS';
end;
$wk_operator_verifier$;
