-- Permanent read-only SQL verifier. Does not create jobs or grant access.
do $verify$
declare
 p oid;
 q oid;
 source text;
begin
 p:=to_regprocedure('mizizi_private.claim_case_research_jobs_v1(text,integer,integer)');
 q:=to_regprocedure('mizizi_private.recover_expired_case_research_jobs_v1(integer,integer)');
 if p is null or q is null then raise exception 'MIZIZI research recovery functions missing'; end if;
 if not exists (select 1 from supabase_migrations.schema_migrations where version='20261010174145') then
   raise exception 'MIZIZI canonical recovery migration absent';
 end if;
 if not exists (select 1 from pg_proc where oid=p and prosecdef and proconfig=array['search_path=pg_catalog']::text[])
    or not exists (select 1 from pg_proc where oid=q and prosecdef and proconfig=array['search_path=pg_catalog']::text[]) then
   raise exception 'MIZIZI recovery functions are not securely scoped';
 end if;
 if not has_function_privilege('service_role',p,'EXECUTE') or not has_function_privilege('service_role',q,'EXECUTE')
    or has_function_privilege('anon',p,'EXECUTE') or has_function_privilege('anon',q,'EXECUTE')
    or has_function_privilege('authenticated',p,'EXECUTE') or has_function_privilege('authenticated',q,'EXECUTE')
    or has_function_privilege('mizizi_executor',p,'EXECUTE') or has_function_privilege('mizizi_executor',q,'EXECUTE') then
   raise exception 'MIZIZI research recovery execution ACL mismatch';
 end if;
 select pg_get_functiondef(p) into source;
 if position('mizizi.case_research_v1' in source)=0
    or position('for update of j skip locked' in lower(source))=0
    or position('platform_private.jobs' in source)=0
    or position('mizizi_private.case_resource_bindings' in source)=0
    or position('platform_private.command_receipts' in source)=0 then
   raise exception 'MIZIZI claim scope/fingerprint integrity changed';
 end if;
 select pg_get_functiondef(q) into source;
 if position('mizizi.case_research_v1' in source)=0
    or position('for update skip locked' in lower(source))=0
    or position('dead_letter' in source)=0 or position('retry_wait' in source)=0
    or position('platform_private.outbox_events' in source)=0
    or position('platform_private.command_receipts' in source)=0 then
   raise exception 'MIZIZI recovery receipt/outbox semantics changed';
 end if;
 raise notice 'MIZIZI_RESEARCH_LEASE_RECOVERY_SCHEMA_VERIFIER=PASS';
end;
$verify$;
select 'MIZIZI_RESEARCH_LEASE_RECOVERY_SCHEMA_VERIFIER=PASS' as marker;
