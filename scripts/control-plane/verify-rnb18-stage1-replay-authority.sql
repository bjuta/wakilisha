-- WAKILISHA RNB18 Stage 1, independent read-only clean Preview/Production postflight.
-- A fresh branch must have zero archived rows/receipts; Production has the
-- immutable 2,904-row sealed historical receipt. Reject intermediate states.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '120s';

DO $wk_rnb18_verify$
DECLARE
  v_rows regclass := to_regclass('platform_private.wk_chart_rnb18_retirement_rows_20261030');
  v_receipt regclass := to_regclass('platform_private.wk_chart_rnb18_retirement_receipt_20261030');
  v_fn oid := to_regprocedure('platform_private.wk_chart_rnb18_archive_immutable_20261030()');
  v_rel record;
  v_function record;
  v_status text;
  v_rows_count bigint;
  v_receipt_count bigint;
  v_bad_hashes bigint;
  v_digest text;
  v_sealed text;
BEGIN
  IF v_rows IS NULL OR v_receipt IS NULL OR v_fn IS NULL THEN
    RAISE EXCEPTION 'WK_RNB18_VERIFY_MISSING_ARCHIVE_AUTHORITY';
  END IF;
  FOR v_rel IN
    SELECT c.oid, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity,
           pg_get_userbyid(c.relowner) AS owner_name, c.relacl::text AS acl
      FROM pg_class c WHERE c.oid IN (v_rows, v_receipt)
  LOOP
    IF v_rel.relkind IS DISTINCT FROM 'r'
       OR v_rel.relrowsecurity IS DISTINCT FROM true
       OR v_rel.relforcerowsecurity IS DISTINCT FROM false
       OR v_rel.owner_name IS DISTINCT FROM 'postgres'
       OR v_rel.acl IS DISTINCT FROM '{postgres=arwdDxtm/postgres}' THEN
      RAISE EXCEPTION 'WK_RNB18_VERIFY_RELATION_AUTHORITY_DRIFT:%', v_rel.relname;
    END IF;
  END LOOP;
  IF (SELECT COUNT(*) FROM pg_class WHERE oid IN (v_rows, v_receipt)) <> 2 THEN
    RAISE EXCEPTION 'WK_RNB18_VERIFY_ARCHIVE_TABLE_COUNT_DRIFT';
  END IF;
  SELECT pg_get_userbyid(p.proowner) AS owner_name, p.prosecdef,
         p.proacl::text AS acl, p.proconfig,
         btrim(regexp_replace(p.prosrc, '[[:space:]]+', ' ', 'g')) AS body,
         p.prorettype = 'trigger'::regtype AS returns_trigger
    INTO v_function FROM pg_proc p WHERE p.oid = v_fn;
  IF v_function.owner_name IS DISTINCT FROM 'postgres'
     OR v_function.prosecdef IS DISTINCT FROM false
     OR v_function.acl IS DISTINCT FROM '{postgres=X/postgres}'
     OR v_function.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
     OR v_function.body IS DISTINCT FROM 'begin raise exception ''rnb18_archive_immutable''; end'
     OR v_function.returns_trigger IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'WK_RNB18_VERIFY_IMMUTABILITY_FUNCTION_DRIFT';
  END IF;
  IF (SELECT COUNT(*) FROM pg_trigger t WHERE t.tgrelid IN (v_rows, v_receipt)
       AND NOT t.tgisinternal) <> 4
     OR (SELECT COUNT(*) FROM pg_trigger t
          WHERE t.tgrelid = v_rows AND NOT t.tgisinternal
            AND t.tgenabled = 'O' AND t.tgfoid = v_fn
            AND t.tgname IN ('trg_wk_rnb18_rows_immutable_update_delete',
                              'trg_wk_rnb18_rows_immutable_truncate')) <> 2
     OR (SELECT COUNT(*) FROM pg_trigger t
          WHERE t.tgrelid = v_receipt AND NOT t.tgisinternal
            AND t.tgenabled = 'O' AND t.tgfoid = v_fn
            AND t.tgname IN ('trg_wk_rnb18_receipt_immutable_update_delete',
                              'trg_wk_rnb18_receipt_immutable_truncate')) <> 2 THEN
    RAISE EXCEPTION 'WK_RNB18_VERIFY_IMMUTABILITY_TRIGGER_DRIFT';
  END IF;
  SELECT pg_get_constraintdef(c.oid,true) INTO v_status
    FROM pg_constraint c
    WHERE c.conrelid = to_regclass('public.chart_ingest_runs')
      AND c.conname='chart_ingest_runs_status_check' AND c.contype='c';
  IF v_status IS NULL OR position('''retired''::text' IN v_status) = 0 THEN
    RAISE EXCEPTION 'WK_RNB18_VERIFY_RETIRED_RUN_STATUS_MISSING';
  END IF;
  SELECT COUNT(*),
         encode(extensions.digest(string_agg(object_kind||':'||row_key||':'||
           payload_sha256,E'\n' ORDER BY object_kind,row_key),'sha256'),'hex')
    INTO v_rows_count, v_digest
    FROM platform_private.wk_chart_rnb18_retirement_rows_20261030;
  SELECT COUNT(*) INTO v_receipt_count
    FROM platform_private.wk_chart_rnb18_retirement_receipt_20261030;
  IF v_rows_count = 0 AND v_receipt_count = 0 THEN
    RAISE NOTICE 'WK_RNB18_STAGE1_EMPTY_PREVIEW_ARCHIVE_PASS';
  ELSIF v_rows_count = 2904 AND v_receipt_count = 1 THEN
    SELECT COUNT(*) INTO v_bad_hashes
      FROM platform_private.wk_chart_rnb18_retirement_rows_20261030
     WHERE payload_sha256 <> encode(extensions.digest(payload::text,'sha256'),'hex');
    SELECT archive_sha256 INTO v_sealed
      FROM platform_private.wk_chart_rnb18_retirement_receipt_20261030
     WHERE batch_key='rnb18-20261030' AND issue_number=1326
       AND edition_count=18 AND entry_count=1800 AND archived_row_count=2904;
    IF v_bad_hashes <> 0 OR v_sealed IS NULL OR v_sealed <> v_digest THEN
      RAISE EXCEPTION 'WK_RNB18_VERIFY_PRODUCTION_ARCHIVE_SEAL_DRIFT';
    END IF;
    RAISE NOTICE 'WK_RNB18_STAGE1_SEALED_PRODUCTION_ARCHIVE_PASS';
  ELSE
    RAISE EXCEPTION 'WK_RNB18_VERIFY_UNEXPECTED_ARCHIVE_CARDINALITY:%,%',v_rows_count,v_receipt_count;
  END IF;
  RAISE NOTICE 'WK_RNB18_STAGE1_READ_ONLY_POSTFLIGHT_PASS';
END
$wk_rnb18_verify$;
ROLLBACK;
