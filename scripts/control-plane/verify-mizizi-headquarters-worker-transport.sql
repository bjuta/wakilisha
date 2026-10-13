-- Independent, durable read-only SQL verifier for CLI-minted MIZIZI worker transport.
-- Does not mint cases, mutate Registry authority, claim jobs, or assume an empty Preview.
do $wk_worker_transport_verifier$
declare
  v_version_count bigint;
  v_name text;
  v_object regprocedure;
  v_wrappers integer := 0;
  v_verified_checks integer := 0;
  v_acl_checks boolean[];
begin
  select count(*) into v_version_count
    from supabase_migrations.schema_migrations
   where version = '20261013071022'
     and name = 'mizizi_case_research_worker_transport_v1';
  if v_version_count <> 1 then
    raise exception 'MIZIZI worker transport: canonical migration ledger mismatch';
  end if;

  if has_schema_privilege('service_role','mizizi_private','USAGE')
     or has_schema_privilege('anon','mizizi_private','USAGE')
     or has_schema_privilege('authenticated','mizizi_private','USAGE') then
    raise exception 'MIZIZI worker transport: sealed private schema widened';
  end if;

  for v_name in select unnest(array[
    'mizizi_claim_case_research_jobs_v1(text,integer,integer)',
    'mizizi_recover_expired_case_research_jobs_v1(integer,integer)',
    'mizizi_complete_case_research_job_v1(uuid,text,jsonb)',
    'mizizi_fail_case_research_job_v1(uuid,text,text,boolean,integer)'
  ]) loop
    v_object := to_regprocedure('public.' || v_name);
    if v_object is null then
      raise exception 'MIZIZI worker transport: missing scoped RPC %',v_name;
    end if;
    if not exists (
      select 1
        from pg_proc as fn
        join pg_namespace as ns on ns.oid=fn.pronamespace
       where fn.oid=v_object
         and ns.nspname='public'
         and fn.prosecdef
         and fn.proowner='postgres'::regrole
         and fn.proconfig @> array['search_path=pg_catalog']::text[]
    ) then
      raise exception 'MIZIZI worker transport: definer, owner, or path drift for %',v_name;
    end if;
    if not has_function_privilege('service_role',v_object,'EXECUTE')
       or has_function_privilege('anon',v_object,'EXECUTE')
       or has_function_privilege('authenticated',v_object,'EXECUTE')
       or has_function_privilege('mizizi_executor',v_object,'EXECUTE') then
      raise exception 'MIZIZI worker transport: function ACL drift for %',v_name;
    end if;
    v_wrappers := v_wrappers+1;
  end loop;
  if v_wrappers<>4 then raise exception 'MIZIZI worker transport: wrapper cardinality drift'; end if;

  -- The existing private service-role functions are deliberately unreachable
  -- without schema USAGE. No new schema grants or generic queue RPCs.
  if not has_function_privilege('service_role',
       'mizizi_private.claim_case_research_jobs_v1(text,integer,integer)','EXECUTE')
     or not has_function_privilege('service_role',
       'mizizi_private.recover_expired_case_research_jobs_v1(integer,integer)','EXECUTE')
  then
    raise exception 'MIZIZI worker transport: original private job authority drift';
  end if;

  if (select count(*) from pg_proc as fn join pg_namespace as ns
       on ns.oid=fn.pronamespace
      where ns.nspname='public' and fn.proname in (
        'mizizi_claim_case_research_jobs_v1',
        'mizizi_recover_expired_case_research_jobs_v1',
        'mizizi_complete_case_research_job_v1',
        'mizizi_fail_case_research_job_v1'))<>4 then
    raise exception 'MIZIZI worker transport: overload or duplicate interface drift';
  end if;
  raise notice 'MIZIZI_WORKER_TRANSPORT_INDEPENDENT_VERIFIER=PASS';
end;
$wk_worker_transport_verifier$;
select 'MIZIZI_WORKER_TRANSPORT_INDEPENDENT_VERIFIER=PASS' as marker;
