-- Read-only exact DB06 verifier. Intended only for isolated Preview after
-- native CLI application of 20261016114918_mizizi_research_job_retry_budget_v1.sql.
-- Safe against an occupied research case. No DML, grants, contact or job claim.
do $verify$
declare
  v_count integer;
  v_head text;
  v_default text;
  v_cap text;
  v_function text;
begin
  select count(*)::integer,max(version) into v_count,v_head
  from supabase_migrations.schema_migrations;
  if v_count<>234 or v_head<>'20261016114918' then
    raise exception 'STOP_MIZIZI_DB06_PREVIEW_HEAD_DRIFT';
  end if;
  select column_default into v_default from information_schema.columns
  where table_schema='platform_private' and table_name='jobs'
    and column_name='max_attempts';
  if v_default is distinct from '5' then
    raise exception 'STOP_MIZIZI_DB06_SHARED_JOB_DEFAULT_DRIFT';
  end if;
  select pg_get_constraintdef(c.oid) into v_cap
  from pg_constraint c
  where c.conrelid='platform_private.jobs'::regclass
    and c.conname='jobs_attempt_count_check';
  if v_cap is null or v_cap not like '%max_attempts <= 25%' then
    raise exception 'STOP_MIZIZI_DB06_SHARED_JOB_CAP_DRIFT';
  end if;
  if to_regprocedure(
    'mizizi_private.admit_case_research_job_v1(uuid,uuid,integer,text,text,text,text)'
  ) is null then
    raise exception 'STOP_MIZIZI_DB06_RESEARCH_ADMISSION_MISSING';
  end if;
  select pg_get_functiondef(to_regprocedure(
    'mizizi_private.admit_case_research_job_v1(uuid,uuid,integer,text,text,text,text)'
  )) into v_function;
  if position('''queued'',v_request,25' in
    regexp_replace(v_function,'[[:space:]]+','','g'))<=0
  then
    raise exception 'STOP_MIZIZI_DB06_RESEARCH_25_ADMISSION_DRIFT';
  end if;
  if not (select relrowsecurity and relforcerowsecurity
    from pg_class where oid='mizizi_private.research_passes'::regclass)
    or has_table_privilege('anon','mizizi_private.research_passes','SELECT')
    or has_table_privilege('authenticated','mizizi_private.research_passes','SELECT')
    or has_table_privilege('service_role','mizizi_private.research_passes','SELECT')
  then
    raise exception 'STOP_MIZIZI_DB06_RESEARCH_PASS_PRIVILEGE_DRIFT';
  end if;
  raise notice 'MIZIZI_DB06_READ_ONLY_INVARIANTS=PASS';
end $verify$;
select 'MIZIZI_DB06_PREVIEW_BUDGET_AND_AUTHORITY=PASS' as result;
