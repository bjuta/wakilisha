-- WK100 PG239: forward-only hosted research-ledger security postflight.
-- Read only. Execute only on a fresh Preview after the forward-only migration replay. Do NOT treat prior PG239 evidence as acceptance of reordered files.
-- Does not prove Edge gateway, signed JWT, Storage, or Admin browser behavior.
WITH expected_tables(name) AS (
  VALUES
    ('wk100_research_observation_reservations_v1'),
    ('wk100_research_observation_rows_v1'),
    ('wk100_research_observation_verified_v1'),
    ('wk100_html_research_reservations_v1'),
    ('wk100_html_research_rows_v1'),
    ('wk100_html_research_verified_v1')
), protected_tables AS (
  SELECT c.oid, c.relname, c.relrowsecurity,
    has_table_privilege('anon',c.oid,'SELECT') AS anon_read,
    has_table_privilege('authenticated',c.oid,'SELECT') AS user_read,
    has_table_privilege('service_role',c.oid,'SELECT') AS service_read,
    (SELECT count(*) FROM pg_catalog.pg_trigger t
     WHERE t.tgrelid=c.oid AND NOT t.tgisinternal
       AND t.tgenabled='O' AND t.tgtype=27) AS update_delete_guards,
    (SELECT count(*) FROM pg_catalog.pg_trigger t
     WHERE t.tgrelid=c.oid AND NOT t.tgisinternal
       AND t.tgenabled='O' AND t.tgtype=34) AS truncate_guards
  FROM expected_tables e
  JOIN pg_catalog.pg_class c ON c.relname=e.name AND c.relkind='r'
  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    AND n.nspname='platform_private'
), governed_rpcs AS (
  SELECT p.proname, p.prosecdef, p.proconfig,
    has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
    has_function_privilege('authenticated',p.oid,'EXECUTE') AS user_execute,
    has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute,
    position('manage_charts' in pg_catalog.pg_get_functiondef(p.oid))>0
      AS charts_guard,
    position('manage_ingest' in pg_catalog.pg_get_functiondef(p.oid))>0
      AS ingest_guard
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN (
    'wk100_reserve_research_observation_v1',
    'wk100_finalize_research_observation_v1',
    'wk100_reserve_html_research_observation_v1',
    'wk100_finalize_html_research_observation_v1'
  )
), ledger AS (
  SELECT count(*) AS total, count(DISTINCT version) AS distinct_count,
    max(version) AS head,
    count(*) FILTER (WHERE version='20261102084046') AS filters_version,
    count(*) FILTER (WHERE version='20261102084049') AS csv_version,
    count(*) FILTER (WHERE version='20261102084052') AS html_version,
    count(*) FILTER (WHERE version='20261101210335') AS rnb18_forward,
    count(*) FILTER (WHERE version='20261030062819') AS retired_old
  FROM supabase_migrations.schema_migrations
)
SELECT
  CASE WHEN
    (SELECT total=239 AND distinct_count=239 AND head='20261102084052'
      AND filters_version=1 AND csv_version=1 AND html_version=1
      AND rnb18_forward=1 AND retired_old=0 FROM ledger)
    AND (SELECT count(*)=6 AND bool_and(relrowsecurity
      AND NOT anon_read AND NOT user_read AND NOT service_read
      AND update_delete_guards=1 AND truncate_guards=1)
      FROM protected_tables)
    AND (SELECT count(*)=4 AND bool_and(prosecdef
      AND proconfig=ARRAY['search_path=pg_catalog']::text[]
      AND NOT anon_execute AND
      (CASE WHEN proname LIKE 'wk100_reserve_%'
        THEN user_execute AND NOT service_execute AND charts_guard AND ingest_guard
        ELSE NOT user_execute AND service_execute END))
      FROM governed_rpcs)
  THEN 'WK100_HOSTED_PG239_READONLY_SECURITY=PASS'
  ELSE 'WK100_HOSTED_PG239_READONLY_SECURITY=FAIL'
  END AS acceptance;
