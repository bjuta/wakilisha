-- Run only against an isolated target to verify this candidate authority.
-- Read-only checks; do not seed fixtures or mutate Production.
begin read only;
set local statement_timeout = '30s';
do $verify$
begin
  if to_regclass('platform_private.wk100_source_proposals_v1') is null
     or to_regprocedure('public.wk100_submit_source_proposal_v1(jsonb,integer)') is null
     or to_regprocedure('public.wk100_list_source_proposals_v1()') is null
     or not (select relrowsecurity from pg_class
       where oid='platform_private.wk100_source_proposals_v1'::regclass)
     or has_table_privilege('anon','platform_private.wk100_source_proposals_v1','SELECT')
     or has_table_privilege('authenticated','platform_private.wk100_source_proposals_v1','INSERT')
     or has_table_privilege('service_role','platform_private.wk100_source_proposals_v1','INSERT')
     or has_function_privilege('anon','public.wk100_submit_source_proposal_v1(jsonb,integer)','EXECUTE')
     or not has_function_privilege('authenticated','public.wk100_submit_source_proposal_v1(jsonb,integer)','EXECUTE')
     or (select count(*) from pg_trigger where tgrelid='platform_private.wk100_source_proposals_v1'::regclass
       and not tgisinternal and tgenabled='O')<>2
  then raise exception 'WK100_SOURCE_PROPOSAL_READONLY_AUTHORITY_FAIL'; end if;
  raise notice 'WK100_SOURCE_PROPOSAL_READONLY_AUTHORITY_PASS';
end;
$verify$;
-- Where the separately governed method migration exists, prove its private
-- authority in the same read-only source verifier. Earlier baselines remain
-- valid for the proposal-only precursor.
do $method_verify$
begin
  if to_regclass('platform_private.wk100_source_method_decisions_v1') is null then
    raise notice 'WK100_SOURCE_METHOD_NOT_YET_INSTALLED';
    return;
  end if;
  if to_regclass('platform_private.wk100_capture_contract_enrollments_v1') is null
    or to_regprocedure('public.wk100_review_source_method_v1(jsonb,integer)') is null
    or to_regprocedure('public.wk100_list_source_method_decisions_v1()') is null
    or to_regprocedure('public.wk100_enroll_source_capture_contract_v1(text,text,text,integer,integer)') is null
    or to_regprocedure('public.wk100_service_admitted_methods_v1()') is null
    or to_regprocedure('public.wk100_service_capture_method_allowed_v1(text,text,text,text,text)') is null
    or not (select relrowsecurity from pg_class
      where oid='platform_private.wk100_source_method_decisions_v1'::regclass)
    or not (select relrowsecurity from pg_class
      where oid='platform_private.wk100_capture_contract_enrollments_v1'::regclass)
    or has_table_privilege('anon','platform_private.wk100_source_method_decisions_v1','SELECT')
    or has_table_privilege('authenticated','platform_private.wk100_source_method_decisions_v1','INSERT')
    or has_table_privilege('service_role','platform_private.wk100_source_method_decisions_v1','INSERT')
    or has_table_privilege('authenticated','platform_private.wk100_capture_contract_enrollments_v1','SELECT')
    or has_table_privilege('service_role','public.wk_chart_capture_contracts_v1','INSERT')
    or has_function_privilege('anon','public.wk100_review_source_method_v1(jsonb,integer)','EXECUTE')
    or has_function_privilege('anon','public.wk100_enroll_source_capture_contract_v1(text,text,text,integer,integer)','EXECUTE')
    or has_function_privilege('authenticated','public.wk100_service_admitted_methods_v1()','EXECUTE')
    or not has_function_privilege('authenticated','public.wk100_review_source_method_v1(jsonb,integer)','EXECUTE')
    or not has_function_privilege('authenticated','public.wk100_enroll_source_capture_contract_v1(text,text,text,integer,integer)','EXECUTE')
    or not has_function_privilege('service_role','public.wk100_service_admitted_methods_v1()','EXECUTE')
    or not has_function_privilege('service_role','public.wk100_service_capture_method_allowed_v1(text,text,text,text,text)','EXECUTE')
    or (select count(*) from pg_trigger
       where tgrelid='platform_private.wk100_source_method_decisions_v1'::regclass
         and not tgisinternal and tgenabled='O')<>2
    or (select count(*) from pg_trigger
       where tgrelid='platform_private.wk100_capture_contract_enrollments_v1'::regclass
         and not tgisinternal and tgenabled='O')<>2
  then raise exception 'WK100_SOURCE_METHOD_READONLY_AUTHORITY_FAIL'; end if;
  raise notice 'WK100_SOURCE_METHOD_READONLY_AUTHORITY_PASS';
end;
$method_verify$;
rollback;
