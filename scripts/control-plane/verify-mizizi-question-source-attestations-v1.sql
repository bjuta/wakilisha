-- QV3 read-only authority verifier. No case/source fixture and no writes.
do $verify$
declare
 t regclass:=to_regclass('mizizi_private.question_source_attestation_events');
 w regprocedure:=to_regprocedure('public.admin_mizizi_attest_question_source_v1(uuid,integer,uuid,integer,uuid,uuid,uuid,text,text,text,text,text,text,text)');
 r regprocedure:=to_regprocedure('public.admin_mizizi_question_source_attestations_v1(uuid,integer,uuid,integer)');
 src text;
begin
 if t is null or w is null or r is null then
  raise exception 'STOP_MZ_QV3_AUTHORITY_MISSING';end if;
 if not exists(select 1 from pg_class c where c.oid=t
   and c.relrowsecurity and c.relforcerowsecurity)
 then raise exception 'STOP_MZ_QV3_RLS_DRIFT';end if;
 if has_table_privilege('authenticated',t,'INSERT')
  or has_table_privilege('authenticated',t,'SELECT')
  or has_table_privilege('service_role',t,'INSERT')
  or has_table_privilege('mizizi_executor',t,'INSERT')
  or has_table_privilege('anon',t,'SELECT')
 then raise exception 'STOP_MZ_QV3_TABLE_GRANT_DRIFT';end if;
 if has_function_privilege('anon',w,'EXECUTE')
  or has_function_privilege('service_role',w,'EXECUTE')
  or has_function_privilege('mizizi_executor',w,'EXECUTE')
  or has_function_privilege('anon',r,'EXECUTE')
  or has_function_privilege('service_role',r,'EXECUTE')
  or not has_function_privilege('authenticated',w,'EXECUTE')
  or not has_function_privilege('authenticated',r,'EXECUTE')
 then raise exception 'STOP_MZ_QV3_RPC_GRANT_DRIFT';end if;
 if not exists(select 1 from pg_proc p where p.oid=w
   and p.prosecdef and p.provolatile='v'
   and p.proowner='postgres'::regrole
   and p.proconfig @> ARRAY['search_path=pg_catalog']::text[])
  or not exists(select 1 from pg_proc p where p.oid=r
   and p.prosecdef and p.provolatile='s'
   and p.proowner='postgres'::regrole
   and p.proconfig @> ARRAY['search_path=pg_catalog']::text[])
 then raise exception 'STOP_MZ_QV3_RPC_SECURITY_DRIFT';end if;
 if not exists(select 1 from pg_trigger g where g.tgrelid=t
   and g.tgname='mz_qv3_immutable' and not g.tgisinternal)
  or not exists(select 1 from pg_trigger g where g.tgrelid=t
   and g.tgname='mz_qv3_seal' and not g.tgisinternal)
 then raise exception 'STOP_MZ_QV3_IMMUTABILITY_DRIFT';end if;
 select pg_get_functiondef(w) into src;
 if position('assert_headquarters_operator_v1(''reviewer'')' in src)=0
  or position('assert_registry_admission_not_held_v1' in src)=0
  or position('source_registry_links' in src)=0
  or position('current_approved_version_id' in src)=0
  or position('registry_evidence_assertions' in src)=0
  or position('frozen_by_user_id' in src)=0
  or position('PT409' in src)=0
  or position('for update' in lower(src))=0
 then raise exception 'STOP_MZ_QV3_REVIEW_AUTHORITY_DRIFT';end if;
 select pg_get_functiondef(r) into src;
 if position('independentlyVerifiedFamilies' in src)=0
  or position('achAssessmentsAllowed' in src)=0
  or position('current_approved_version_id' in src)=0
 then raise exception 'STOP_MZ_QV3_TRUTHFUL_READ_DRIFT';end if;
 raise notice 'WK_MIZIZI_QV3_HUMAN_SOURCE_ATTESTATION_AND_REVOCATION_AUTHORITY=PASS';
end;
$verify$;
