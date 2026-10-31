-- WK100 Phase 2: permanent, read-only post-migration 236 contract verifier.
-- Operates only on database metadata. Does not create fixture data, score,
-- commit, publish, grant privileges, or alter user/Registry records.
WITH
candidate_fn AS (
  SELECT p.oid, p.prosecdef, p.proconfig,
         pg_catalog.pg_get_functiondef(p.oid) AS fn_text
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.proname='chart_apply_full_filter_decisions_v1'
    AND pg_catalog.pg_get_function_identity_arguments(p.oid)=
      'p_run_id text, p_expected_run_updated_at timestamp with time zone, p_policy jsonb, p_decisions jsonb'
),
origin_reset AS (
  SELECT p.oid, p.prosecdef
  FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='chart_reset_run_after_origin_resolution_v1'
    AND pg_catalog.pg_get_function_identity_arguments(p.oid)='p_run_id text'
),
rls AS (
  SELECT count(*) AS table_count, count(*) FILTER (WHERE c.relrowsecurity) AS protected_count
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p')
    AND c.relname IN ('chart_ingest_runs','chart_ingest_candidates','registry_track_provider_links')
),
policies AS (
  SELECT
    count(*) FILTER (WHERE policyname='registry_track_provider_links_public_matched_read'
      AND cmd='SELECT' AND 'anon'=ANY(roles)
      AND qual LIKE '%match_status%matched%') AS matched_public,
    count(*) FILTER (WHERE policyname='wk100_registry_track_provider_links_admin_review_read_v1'
      AND cmd='SELECT' AND 'authenticated'=ANY(roles)
      AND qual LIKE '%view_registry%') AS restricted_admin
  FROM pg_catalog.pg_policies
  WHERE schemaname='public' AND tablename='registry_track_provider_links'
)
SELECT CASE WHEN
  (SELECT count(*) FROM candidate_fn)=1
  AND (SELECT count(*) FROM candidate_fn
       WHERE NOT prosecdef
         AND NOT pg_catalog.has_function_privilege('anon',oid,'EXECUTE')
         AND pg_catalog.has_function_privilege('authenticated',oid,'EXECUTE')
         AND fn_text LIKE '%manage_ingest%'
         AND fn_text LIKE '%manage_charts%'
         AND fn_text LIKE '%view_charts_admin%'
         AND fn_text LIKE '%view_registry%'
         AND fn_text LIKE '%canScore%'
         AND fn_text LIKE '%canPublish%'
        )=1
  AND (SELECT count(*) FROM origin_reset
       WHERE prosecdef
         AND NOT pg_catalog.has_function_privilege('anon',oid,'EXECUTE')
         AND pg_catalog.has_function_privilege('authenticated',oid,'EXECUTE'))=1
  AND (SELECT table_count=3 AND protected_count=3 FROM rls)
  AND (SELECT matched_public=1 AND restricted_admin=1 FROM policies)
THEN 'WK100_PHASE2_READONLY_236_CONTRACT=PASS'
ELSE 'WK100_PHASE2_READONLY_236_CONTRACT=FAIL' END AS acceptance;
