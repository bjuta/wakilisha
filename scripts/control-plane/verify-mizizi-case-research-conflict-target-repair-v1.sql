-- Permanent independent read-only verifier for CLI-minted forward repair.
-- Do not mark PASS from presence/ACL alone: positive transaction tests remain separate.
do $verify_mizizi_conflict_repair$
declare
  v_definition text;
  v_expected_version text;
begin
  select max(version) into v_expected_version
    from supabase_migrations.schema_migrations
   where name='mizizi_case_research_conflict_target_repair_v1';
  if v_expected_version is null
    or (select count(*) from supabase_migrations.schema_migrations
        where name='mizizi_case_research_conflict_target_repair_v1')<>1 then
    raise exception 'MIZIZI conflict repair verifier: canonical CLI migration absent or duplicated';
  end if;
  select pg_get_functiondef('mizizi_private.admit_case_research_job_v1(uuid,uuid,integer,text,text,text,text)'::regprocedure)
    into strict v_definition;
  if position('on conflict on constraint case_resource_bindings_pkey do nothing' in v_definition)=0
    or position('on conflict on constraint jobs_receipt_job_key do nothing' in v_definition)=0
    or position('on conflict on constraint mizizi_case_receipt_links_unique' in v_definition)=0
    or position('on conflict (case_id) do nothing' in v_definition)<>0
    or position('on conflict (command_receipt_id,job_key) do nothing' in v_definition)<>0
    or has_function_privilege('anon','mizizi_private.admit_case_research_job_v1(uuid,uuid,integer,text,text,text,text)','EXECUTE')
    or has_function_privilege('authenticated','mizizi_private.admit_case_research_job_v1(uuid,uuid,integer,text,text,text,text)','EXECUTE')
    or has_function_privilege('service_role','mizizi_private.admit_case_research_job_v1(uuid,uuid,integer,text,text,text,text)','EXECUTE')
    or not has_function_privilege('mizizi_executor','mizizi_private.admit_case_research_job_v1(uuid,uuid,integer,text,text,text,text)','EXECUTE')
    or exists(select 1 from platform_private.registry_execution_grants where status='active') then
    raise exception 'MIZIZI conflict repair verifier: source, permissions or zero-grant contract failed';
  end if;
  raise notice 'MIZIZI_CASE_RESEARCH_CONFLICT_REPAIR_VERIFIER=PASS';
end;
$verify_mizizi_conflict_repair$;
select 'MIZIZI_CASE_RESEARCH_CONFLICT_REPAIR_VERIFIER=PASS' as marker;
