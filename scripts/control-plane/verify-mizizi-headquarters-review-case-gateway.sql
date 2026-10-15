-- Independent DB02 case-command gateway verifier. Read-only.
do $verify$
declare
  v_def text;
  v_owner text;
  v_secdef boolean;
  v_search_path text[];
  v_rolbypassrls boolean;
begin
  if to_regprocedure('mizizi_private.admit_review_case_gateway_v1(uuid,text,jsonb)') is null then
    raise exception 'MIZIZI gateway verifier: function missing';
  end if;
  select pg_get_functiondef(p.oid), pg_get_userbyid(p.proowner), p.prosecdef, p.proconfig
    into strict v_def,v_owner,v_secdef,v_search_path
  from pg_proc p
  where p.oid='mizizi_private.admit_review_case_gateway_v1(uuid,text,jsonb)'::regprocedure;
  if not v_secdef or v_owner <> 'postgres'
     or v_search_path <> array['search_path=pg_catalog']::text[]
     or position('perform mizizi_private.assert_executor_v1()' in v_def)=0
     or position($needle$session_user <> 'mizizi_executor'$needle$ in v_def)=0
     or position('queue_registry_review_v1' in v_def)=0
     or position('queue_public_music_identity_review_v1' in v_def)=0
     or position('case_receipt_links' in v_def)=0
     or position('for update' in lower(v_def))=0
  then
    raise exception 'MIZIZI gateway verifier: security or typed orchestration contract drift';
  end if;
  select rolbypassrls into strict v_rolbypassrls from pg_roles where rolname='postgres';
  if not v_rolbypassrls then
    raise exception 'MIZIZI gateway verifier: SECURITY DEFINER owner cannot satisfy FORCE RLS';
  end if;
  if not has_function_privilege('mizizi_executor', 'mizizi_private.admit_review_case_gateway_v1(uuid,text,jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'mizizi_private.admit_review_case_gateway_v1(uuid,text,jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'mizizi_private.admit_review_case_gateway_v1(uuid,text,jsonb)', 'EXECUTE')
     or has_function_privilege('service_role', 'mizizi_private.admit_review_case_gateway_v1(uuid,text,jsonb)', 'EXECUTE')
  then
    raise exception 'MIZIZI gateway verifier: exact-call grants drift';
  end if;
  if has_table_privilege('mizizi_executor','mizizi_private.cases','INSERT')
     or has_table_privilege('mizizi_executor','mizizi_private.cases','UPDATE')
     or has_table_privilege('mizizi_executor','mizizi_private.case_receipt_links','INSERT')
     or has_table_privilege('authenticated','mizizi_private.cases','SELECT')
     or has_table_privilege('service_role','mizizi_private.cases','SELECT')
  then
    raise exception 'MIZIZI gateway verifier: direct case table DML/read grant escaped';
  end if;
  if (select count(*) from mizizi_private.cases) <> 0
     or (select count(*) from mizizi_private.case_receipt_links) <> 0 then
    raise exception 'MIZIZI gateway verifier: unexpected persistent case/receipt data in clean Preview';
  end if;
  if (select count(*) from supabase_migrations.schema_migrations
      where version in ('20261010082702','20261010091606','20261010093509','20261010100017'))<>4 then
    raise exception 'MIZIZI gateway verifier: accepted foundation history drift';
  end if;
end;
$verify$;
select 'MIZIZI_CASE_GATEWAY_INDEPENDENT_VERIFIER=PASS' as marker;
