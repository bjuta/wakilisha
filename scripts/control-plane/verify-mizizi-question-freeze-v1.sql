-- Read-only proof of QV2 authenticated freeze authority, no fixture or mutation.
do $v$
declare p regprocedure;src text; t regclass;
begin
 p:=to_regprocedure('public.admin_mizizi_freeze_case_question_v1(uuid,integer,uuid,integer,text,jsonb,text)');
 t:=to_regclass('mizizi_private.case_question_versions');
 if p is null or t is null then
  raise exception 'STOP_MZ_QV2_FUNCTION_OR_LEDGER_MISSING';end if;
 if not exists(select 1 from pg_proc f where f.oid=p
    and f.prosecdef and f.provolatile='v'
    and f.proowner='postgres'::regrole
    and f.proconfig @> ARRAY['search_path=pg_catalog']::text[])
 then raise exception 'STOP_MZ_QV2_FUNCTION_SECURITY_DRIFT';end if;
 if has_function_privilege('anon',p,'EXECUTE')
  or has_function_privilege('service_role',p,'EXECUTE')
  or has_function_privilege('mizizi_executor',p,'EXECUTE')
  or not has_function_privilege('authenticated',p,'EXECUTE')
  or has_table_privilege('authenticated',t,'INSERT')
  or has_table_privilege('service_role',t,'INSERT')
 then raise exception 'STOP_MZ_QV2_GRANTS_LEAK';end if;
 if not exists(select 1 from pg_class c where c.oid=t
   and c.relrowsecurity and c.relforcerowsecurity)
 then raise exception 'STOP_MZ_QV2_FORCED_RLS_LOST';end if;
 select pg_get_functiondef(p) into src;
 if position('assert_headquarters_operator_v1(''steward'')' in src)=0
  or position('assert_registry_admission_not_held_v1' in src)=0
  or position('case_question_versions' in src)=0
  or position('for update' in lower(src))=0
  or position('PT409' in src)=0
  or position('outcome' in src)=0
 then raise exception 'STOP_MZ_QV2_AUTHORITY_GUARD_DRIFT';end if;
 raise notice 'WK_MIZIZI_QV2_AUTHENTICATED_STEWARD_HOLD_AND_IMMUTABLE_FREEZE=PASS';
end;
$v$;
