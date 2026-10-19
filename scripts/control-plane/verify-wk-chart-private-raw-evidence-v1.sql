-- Read-only verifier of the candidate private Storage boundary.
-- Requires exact migration 233. No storage upload or source collection.
begin transaction read only;
set local statement_timeout='30s';
do $wk_verify_private_raw_bucket$
declare
  v_bucket storage.buckets%rowtype;
  v_name text;
begin
  if (select count(*) from supabase_migrations.schema_migrations)<>233
    or (select max(version) from supabase_migrations.schema_migrations)<>'20261019203244'
    or (select count(*) from supabase_migrations.schema_migrations
        where version='20261019203244' and name='wk_chart_private_raw_evidence_v1')<>1
  then raise exception 'STOP_WK100_EXPECTED_233_RAW_BUCKET_MIGRATION_HEAD'; end if;
  select * into strict v_bucket from storage.buckets
    where id='wk-chart-raw-evidence-v1';
  if v_bucket.name <> 'wk-chart-raw-evidence-v1'
    or v_bucket.public is distinct from false
    or v_bucket.file_size_limit <> 4194304
    or v_bucket.allowed_mime_types is distinct from
       array['application/json','text/html','text/csv','application/octet-stream']::text[]
    or v_bucket.versioning_status <> 'DISABLED'
    or v_bucket.lifecycle_configuration is not null
    or (select count(*) from storage.objects
        where bucket_id='wk-chart-raw-evidence-v1')<>0
  then raise exception 'STOP_WK100_PRIVATE_BUCKET_METADATA_OR_OBJECT_DRIFT'; end if;
  if not (select c.relrowsecurity from pg_class c
    where c.oid='storage.objects'::regclass)
    or not (select c.relrowsecurity from pg_class c
    where c.oid='storage.buckets'::regclass)
    or (select count(*) from pg_policies
      where schemaname='storage' and tablename='objects')<>12
    or exists(select 1 from pg_policies
      where schemaname='storage' and tablename='objects'
      and (roles<>array['authenticated']::name[]
        or coalesce(qual,'') ~* 'wk-chart-raw-evidence-v1'
        or coalesce(with_check,'') ~* 'wk-chart-raw-evidence-v1'))
  then raise exception 'STOP_WK100_STORAGE_RLS_OR_GLOBAL_POLICY_DRIFT'; end if;
  if exists (
    select 1 from pg_policies p
    cross join lateral (
      select case
        when p.policyname like 'article-media %'
          then '(bucket_id = ''article-media''::text)'
        when p.policyname like 'avatars_authenticated_%'
          then '((bucket_id = ''avatars''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))'
        when p.policyname like 'cms-media %'
          then '(bucket_id = ''cms-media''::text)'
        when p.policyname like 'profile_covers_authenticated_%'
          then '((bucket_id = ''profile-covers''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))'
        else null
      end as expected_predicate
    ) e
    where p.schemaname='storage' and p.tablename='objects'
      and (e.expected_predicate is null
        or (p.qual is not null and p.qual <> e.expected_predicate)
        or (p.with_check is not null and p.with_check <> e.expected_predicate))
  ) then raise exception 'STOP_WK100_STORAGE_POLICY_EXPRESSION_DRIFT'; end if;
  -- Retain the 232 receipt substrate's access restriction and emptiness.
  foreach v_name in array array[
    'wk_chart_capture_contracts_v1','wk_chart_capture_attempts_v1',
    'wk_chart_capture_rows_v1','wk_chart_weekly_freezes_v1'] loop
    if not (select c.relrowsecurity from pg_class c
      where c.oid=format('public.%I',v_name)::regclass)
      or has_table_privilege('anon',format('public.%I',v_name),'SELECT')
      or has_table_privilege('authenticated',format('public.%I',v_name),'SELECT')
      or has_table_privilege('service_role',format('public.%I',v_name),'UPDATE')
    then raise exception 'STOP_WK100_RECEIPT_ACCESS_REGRESSION: %',v_name; end if;
  end loop;
  if exists(select 1 from public.wk_chart_capture_contracts_v1)
     or exists(select 1 from public.wk_chart_capture_attempts_v1)
     or exists(select 1 from public.wk_chart_capture_rows_v1)
     or exists(select 1 from public.wk_chart_weekly_freezes_v1)
  then raise exception 'STOP_WK100_RAW_BUCKET_MIGRATION_INSERTED_RECEIPTS'; end if;
  -- Preview branches without data have 0 published editions; Production has
  -- 18 historical editions. Reconcile target counts against its own baseline.
  if to_regclass('cron.job') is not null then
    if exists(select 1 from cron.job
      where active and (jobname ilike '%chart%'
       or command ilike '%wk_chart_capture%'
       or command ilike '%wk-chart-raw-evidence%'))
    then raise exception 'STOP_WK100_CHART_JOB_UNEXPECTEDLY_ENABLED'; end if;
  end if;
end;
$wk_verify_private_raw_bucket$;
select jsonb_build_object(
  'result','PASS',
  'migration_head',(select max(version) from supabase_migrations.schema_migrations),
  'private_bucket','wk-chart-raw-evidence-v1',
  'bucket_public',(select public from storage.buckets where id='wk-chart-raw-evidence-v1'),
  'object_count',(select count(*) from storage.objects where bucket_id='wk-chart-raw-evidence-v1'),
  'published_historical_editions',(select count(*) from public.wk_chart_editions_v2 where status='published'),
  'chart_cron_catalog_available',to_regclass('cron.job') is not null
) as wk_chart_private_raw_evidence_acceptance;
rollback;
