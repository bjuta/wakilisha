-- Permanent read-only verifier for 227 nonretryable, HTTP 409 logical CAS.
-- May run on disposable local or reviewed Preview AFTER 227 is applied.
-- No provider secrets, grants, user sessions, DML or hosted mutation.
do $wk_verify_stale_http$
declare n integer; head text; v_signature text; fn regprocedure;
begin
 select count(*),max(version) into n,head
 from supabase_migrations.schema_migrations;
 if n<227 or head<'20261013190100'
   or (select count(*) from supabase_migrations.schema_migrations sm
      where sm.version='20261013190100' and
       sm.name='mizizi_headquarters_stale_conflict_http_v1')<>1
 then raise exception 'MIZIZI 227 verifier migration ledger mismatch'; end if;
 foreach v_signature in array array[
  'admin_mizizi_begin_case_research_v1(uuid,integer,text)',
  'admin_mizizi_release_workspace_hold_v1(uuid,integer,text)'
 ] loop
  fn:=to_regprocedure('public.'||v_signature);
  if fn is null or not exists(select 1 from pg_proc p where p.oid=fn
    and p.prosecdef and p.proowner='postgres'::regrole
    and p.proconfig @> array['search_path=pg_catalog']::text[]
    and pg_get_functiondef(p.oid) like '%PT409%'
    and pg_get_functiondef(p.oid) not like '%40001%')
    or has_function_privilege('anon',fn,'EXECUTE')
    or has_function_privilege('service_role',fn,'EXECUTE')
    or has_function_privilege('mizizi_executor',fn,'EXECUTE')
    or not has_function_privilege('authenticated',fn,'EXECUTE')
  then raise exception 'MIZIZI 227 stale conflict endpoint or ACL drift: %',v_signature; end if;
 end loop;
 raise notice 'WK_227_NONRETRYABLE_HTTP409_CAS_ACL_VERIFIED=PASS';
end $wk_verify_stale_http$;
select 'WK_227_NONRETRYABLE_HTTP409_CAS_ACL_VERIFIED=PASS' as marker;
