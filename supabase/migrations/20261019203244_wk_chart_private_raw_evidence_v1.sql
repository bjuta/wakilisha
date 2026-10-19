-- CLI-minted migration path from accepted Mac, Supabase CLI 2.107.0:
-- supabase/migrations/20261019203244_wk_chart_private_raw_evidence_v1.sql
-- Private raw source-response Storage boundary, without admitted collectors.
-- Creates one private bucket and no Storage policies, objects, cron or jobs.
-- Existing public media buckets and WK100 capture receipts are untouched.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $wk_raw_bucket_preflight$
declare
  v_count integer;
  v_head text;
  v_object_policies integer;
begin
  select count(*),max(version) into v_count,v_head
    from supabase_migrations.schema_migrations;
  if v_count <> 232 or v_head <> '20261019152307'
     or to_regclass('storage.buckets') is null
     or to_regclass('storage.objects') is null
     or to_regclass('public.wk_chart_capture_attempts_v1') is null
     or to_regrole('service_role') is null
  then
    raise exception 'STOP_WK100_RAW_BUCKET_EXPECTS_EXACT_ACCEPTED_232_BASELINE';
  end if;
  if exists(select 1 from storage.buckets where id='wk-chart-raw-evidence-v1')
     or exists(select 1 from storage.objects where bucket_id='wk-chart-raw-evidence-v1')
  then
    raise exception 'STOP_WK100_RAW_BUCKET_ALREADY_EXISTS_OR_HAS_OBJECTS';
  end if;
  if not (select c.relrowsecurity from pg_class c
     where c.oid='storage.objects'::regclass)
     or not (select c.relrowsecurity from pg_class c
     where c.oid='storage.buckets'::regclass)
  then
    raise exception 'STOP_WK100_STORAGE_RLS_DISABLED';
  end if;

  -- The current 12 provider-media policies are each authenticated-only and
  -- scoped to the pre-existing buckets. Any catalog drift needs fresh review
  -- before this new bucket can be safely admitted.
  select count(*) into v_object_policies from pg_policies
    where schemaname='storage' and tablename='objects';
  if v_object_policies <> 12 or exists (
    select 1 from pg_policies p
    where p.schemaname='storage' and p.tablename='objects'
      and (p.roles <> array['authenticated']::name[]
        or p.policyname not in (
          'article-media authenticated delete',
          'article-media authenticated insert',
          'article-media authenticated update',
          'avatars_authenticated_delete_own',
          'avatars_authenticated_insert_own',
          'avatars_authenticated_update_own',
          'cms-media authenticated delete',
          'cms-media authenticated insert',
          'cms-media authenticated update',
          'profile_covers_authenticated_delete_own',
          'profile_covers_authenticated_insert_own',
          'profile_covers_authenticated_update_own'
        )
        or coalesce(p.qual,'') !~ 'bucket_id'
          and coalesce(p.with_check,'') !~ 'bucket_id'
        or coalesce(p.qual,'') ~* 'wk-chart-raw-evidence-v1'
        or coalesce(p.with_check,'') ~* 'wk-chart-raw-evidence-v1')
  ) then
    raise exception 'STOP_WK100_STORAGE_POLICY_SCOPE_DRIFT';
  end if;
  -- Pin the *exact* accepted expressions, not just a bucket_id substring.
  -- This rules out an OR TRUE/open-ended policy smuggled into a known name.
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
  ) then
    raise exception 'STOP_WK100_STORAGE_POLICY_EXPRESSION_DRIFT';
  end if;
end;
$wk_raw_bucket_preflight$;

insert into storage.buckets (
  id,name,public,file_size_limit,allowed_mime_types,
  versioning_status
) values (
  'wk-chart-raw-evidence-v1',
  'wk-chart-raw-evidence-v1',
  false,
  4194304,
  array['application/json','text/html','text/csv','application/octet-stream']::text[],
  'DISABLED'
);

-- Deliberately no storage.objects/storage.buckets policies or other grants.
-- Ordinary clients have no policy through which to access this bucket.
-- The future server-only uploader must use create-only, never upsert, and
-- independently download/rehash bytes BEFORE claiming a successful receipt.
-- No automatic retention, GC or public/signed download path is enabled here.
do $wk_raw_bucket_postflight$
declare v_bucket storage.buckets%rowtype;
begin
  select * into strict v_bucket from storage.buckets
    where id='wk-chart-raw-evidence-v1';
  if v_bucket.name <> 'wk-chart-raw-evidence-v1'
     or v_bucket.public is distinct from false
     or v_bucket.file_size_limit <> 4194304
     or v_bucket.allowed_mime_types is distinct from
       array['application/json','text/html','text/csv','application/octet-stream']::text[]
     or v_bucket.versioning_status <> 'DISABLED'
     or v_bucket.lifecycle_configuration is not null
     or exists (select 1 from storage.objects
       where bucket_id='wk-chart-raw-evidence-v1')
     or exists (select 1 from pg_policies
       where schemaname='storage' and tablename in ('objects','buckets')
         and policyname like 'wk_chart_raw_%')
  then
    raise exception 'STOP_WK100_RAW_BUCKET_POSTFLIGHT';
  end if;
  raise notice 'WK100_RAW_EVIDENCE_PRIVATE_BUCKET_NO_OBJECTS_NO_SCHEDULE=PASS';
end;
$wk_raw_bucket_postflight$;
commit;
