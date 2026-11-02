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
rollback;
