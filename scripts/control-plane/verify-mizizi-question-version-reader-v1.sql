-- Read-only invariant verifier for CLI-minted MIZIZI question v1 reader.
-- No test fixtures, INSERTs, role changes or Production mutation.
do $verify$
declare t regclass; p regprocedure; src text;
begin
 t:=to_regclass('mizizi_private.case_question_versions');
 p:=to_regprocedure('public.admin_mizizi_case_questions_v1(uuid,integer)');
 if t is null or p is null
 then raise exception 'STOP_MZ_QV1_TABLE_OR_RPC_MISSING'; end if;
 if not exists(select 1 from pg_class c where c.oid=t
    and c.relrowsecurity and c.relforcerowsecurity
    and c.relowner='postgres'::regrole)
 then raise exception 'STOP_MZ_QV1_RLS_OR_OWNER_DRIFT'; end if;
 if exists(select 1 from (values('anon'),('authenticated'),('service_role'),('mizizi_executor')) x(role_name)
   where has_table_privilege(x.role_name,t,'SELECT')
      or has_table_privilege(x.role_name,t,'INSERT')
      or has_table_privilege(x.role_name,t,'UPDATE')
      or has_table_privilege(x.role_name,t,'DELETE'))
 then raise exception 'STOP_MZ_QV1_TABLE_GRANT_LEAK'; end if;
 if not exists (select 1 from pg_trigger x where x.tgrelid=t
   and x.tgname='mz_qv1_freeze_before_insert' and x.tgenabled='O'
   and not x.tgisinternal)
 or not exists (select 1 from pg_trigger x where x.tgrelid=t
   and x.tgname='mz_qv1_immutable' and x.tgenabled='O'
   and not x.tgisinternal)
 then raise exception 'STOP_MZ_QV1_FINGERPRINT_OR_IMMUTABILITY_TRIGGERS'; end if;
 if not exists (select 1 from pg_proc f where f.oid=p
    and f.prosecdef and f.proowner='postgres'::regrole
    and f.proconfig @> ARRAY['search_path=pg_catalog']::text[])
 then raise exception 'STOP_MZ_QV1_RPC_SECURITY_DRIFT'; end if;
 if has_function_privilege('anon',p,'EXECUTE')
    or has_function_privilege('service_role',p,'EXECUTE')
    or has_function_privilege('mizizi_executor',p,'EXECUTE')
    or not has_function_privilege('authenticated',p,'EXECUTE')
 then raise exception 'STOP_MZ_QV1_RPC_GRANT_DRIFT'; end if;
 select pg_get_functiondef(p) into src;
 if position('mizizi_private.assert_headquarters_operator_v1' in src)=0
    or position('mizizi_private.case_question_versions' in src)=0
    or position('PT409' in src)=0
    or position('''sources'',''[]''::jsonb' in src)=0
    or position('''assessments'',''[]''::jsonb' in src)=0
 then raise exception 'STOP_MZ_QV1_SOURCE_OR_STALE_BOUNDARY_DRIFT'; end if;
 raise notice 'WK_MZ_QV1_PRIVATE_IMMUTABLE_QUESTION_AND_AUTHENTICATED_READER=PASS';
end;
$verify$;
