#!/usr/bin/env bash
# Disposable genuine PostgreSQL 17 test. No remote Supabase connection.
set -euo pipefail

DB=wk_rnb18_stage1_pg_disposable
SQL=scripts/acceptance/rnb18-stage1-replay-repair-v4-CANDIDATE.sql
EXPECTED=37d7eb5483ad883209ef9a10d5b3df48357de04c65c17ddaef81975b1ca7e6a5

cleanup() { docker rm -f "$DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT

test -f "$SQL"
test "$(sha256sum "$SQL" | awk '{print $1}')" = "$EXPECTED"
test ! -e supabase/.temp/project-ref
test -z "$(printenv SUPABASE_ACCESS_TOKEN || true)"
test -z "$(printenv SUPABASE_PROJECT_REF || true)"
echo RNB18_DISPOSABLE_NO_REMOTE_TARGET=PASS

docker pull postgres:17.6-alpine >/dev/null
docker run --rm -d --network none --name "$DB" \
 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17.6-alpine >/dev/null
for i in $(seq 1 60); do
  if docker exec "$DB" pg_isready -q -U postgres -d postgres; then break; fi
  sleep 1
done
docker exec "$DB" pg_isready -q -U postgres -d postgres

# Minimal exact chart-ingest status baseline, no archived charts, no historical fixtures.
docker exec -i "$DB" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA platform_private AUTHORIZATION postgres;
CREATE SCHEMA extensions AUTHORIZATION postgres;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE TABLE public.chart_ingest_runs (
 status text NOT NULL,
 CONSTRAINT chart_ingest_runs_status_check CHECK (status = ANY (ARRAY[
 'draft','queued','running','preflight_passed','fetching','normalizing',
 'scoring','reviewing','commit_pending','dry_run_complete','ready_to_commit',
 'committing','committed','needs_review','publishing','published',
 'failed','cancelled','source_fetch_failed'
 ]::text[]))
);
SQL

# Actual candidate DDL, including its own exact PostgreSQL catalog assertions.
docker exec -i "$DB" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < "$SQL"
echo RNB18_FRESH_POSTGRES_DDL=PASS

docker exec -i "$DB" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
DO $audit$
BEGIN
 IF EXISTS (SELECT 1 FROM platform_private.wk_chart_rnb18_retirement_rows_20261030)
  OR EXISTS (SELECT 1 FROM platform_private.wk_chart_rnb18_retirement_receipt_20261030)
 THEN RAISE EXCEPTION 'Unexpected historical archive payload'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conrelid='public.chart_ingest_runs'::regclass
   AND conname='chart_ingest_runs_status_check'
   AND position('''retired''::text' IN pg_get_constraintdef(oid,true))>0
 ) THEN RAISE EXCEPTION 'Retired status not admitted'; END IF;
 IF has_table_privilege('anon','platform_private.wk_chart_rnb18_retirement_rows_20261030','SELECT')
  OR has_table_privilege('authenticated','platform_private.wk_chart_rnb18_retirement_rows_20261030','SELECT')
  OR has_table_privilege('service_role','platform_private.wk_chart_rnb18_retirement_rows_20261030','SELECT')
  OR has_table_privilege('anon','platform_private.wk_chart_rnb18_retirement_receipt_20261030','INSERT')
  OR has_table_privilege('authenticated','platform_private.wk_chart_rnb18_retirement_receipt_20261030','INSERT')
  OR has_table_privilege('service_role','platform_private.wk_chart_rnb18_retirement_receipt_20261030','INSERT')
 THEN RAISE EXCEPTION 'Archive privileges too broad'; END IF;
 RAISE NOTICE 'RNB18_FRESH_EMPTY_AND_ROLE_DENIAL=PASS';
END
$audit$;

-- Probe both archive immutability contracts in a transaction, then roll back.
BEGIN;
INSERT INTO platform_private.wk_chart_rnb18_retirement_rows_20261030
(object_kind,row_key,payload,payload_sha256)
VALUES('probe','probe','{}',repeat('0',64));
INSERT INTO platform_private.wk_chart_rnb18_retirement_receipt_20261030
(batch_key,issue_number,edition_count,entry_count,archived_row_count,archive_sha256,notes)
VALUES('probe',0,0,0,0,repeat('0',64),'rollback-only test');
DO $proof$
DECLARE tbl text;
BEGIN
 FOR tbl IN SELECT unnest(ARRAY[
   'platform_private.wk_chart_rnb18_retirement_rows_20261030',
   'platform_private.wk_chart_rnb18_retirement_receipt_20261030'
 ]) LOOP
  BEGIN
   EXECUTE 'UPDATE '||tbl||' SET archived_at=clock_timestamp()';
   RAISE EXCEPTION 'Expected immutability error on UPDATE';
  EXCEPTION WHEN OTHERS THEN
   IF SQLERRM<>'rnb18_archive_immutable' THEN RAISE; END IF;
  END;
  BEGIN
   EXECUTE 'DELETE FROM '||tbl;
   RAISE EXCEPTION 'Expected immutability error on DELETE';
  EXCEPTION WHEN OTHERS THEN
   IF SQLERRM<>'rnb18_archive_immutable' THEN RAISE; END IF;
  END;
  BEGIN
   EXECUTE 'TRUNCATE '||tbl;
   RAISE EXCEPTION 'Expected immutability error on TRUNCATE';
  EXCEPTION WHEN OTHERS THEN
   IF SQLERRM<>'rnb18_archive_immutable' THEN RAISE; END IF;
  END;
 END LOOP;
 RAISE NOTICE 'RNB18_UPDATE_DELETE_TRUNCATE_DENIAL=PASS';
END
$proof$;
ROLLBACK;
DO $clean$
BEGIN
 IF EXISTS (SELECT 1 FROM platform_private.wk_chart_rnb18_retirement_rows_20261030)
  OR EXISTS (SELECT 1 FROM platform_private.wk_chart_rnb18_retirement_receipt_20261030)
 THEN RAISE EXCEPTION 'Rollback left synthetic probe data'; END IF;
 RAISE NOTICE 'RNB18_PROBE_ROLLBACK_EMPTY=PASS';
END
$clean$;
SQL
echo RNB18_STAGE1_FRESH_POSTGRES_ACCEPTANCE=PASS
