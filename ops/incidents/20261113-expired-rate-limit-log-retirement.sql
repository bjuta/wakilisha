-- SEV-1 narrow one-time retirement of expired request-rate event rows.
-- This table is NOT the Registry, an audit journal, or a content authority.
-- Run only after independently confirming Production public-content-read v119
-- no longer writes rate_limit_log, and that worker backpressure is active.
-- Historically this store held estimated ~1.52M rows, occupied ~311 MB,
-- and a 0.15% SYSTEM sample was entirely public:* (2026-11-13).
-- Admin and Briefing still use 60-second counters; do not run if either
-- has inserted anything since the last PostgreSQL start.
--
-- Fail-fast: transaction, NOWAIT lock, no scan/delete/reindex of 1.5M rows.
-- Deliberately CONTINUE IDENTITY; no effect on unrelated tables.
BEGIN;
SET LOCAL lock_timeout = '750ms';
SET LOCAL statement_timeout = '5000ms';

-- Hold the exclusive lock BEFORE checking insert counters; do not allow
-- a new Admin/Briefing rate-limit record to arrive between proof and TRUNCATE.
LOCK TABLE public.rate_limit_log IN ACCESS EXCLUSIVE MODE NOWAIT;

DO $wk$
DECLARE
  inserted_since_start bigint;
BEGIN
  IF pg_postmaster_start_time() > now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'STOP: PostgreSQL restarted too recently';
  END IF;
  IF to_regclass('public.rate_limit_log') IS NULL THEN
    RAISE EXCEPTION 'STOP: expected ephemeral limiter table absent';
  END IF;
  SELECT coalesce(n_tup_ins, 0)
  INTO inserted_since_start
  FROM pg_stat_user_tables
  WHERE relid = 'public.rate_limit_log'::regclass;
  IF inserted_since_start IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'STOP: active rate limiter has inserted % rows since restart', inserted_since_start;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE confrelid = 'public.rate_limit_log'::regclass
      OR (conrelid = 'public.rate_limit_log'::regclass AND contype='f')
  ) THEN
    RAISE EXCEPTION 'STOP: rate-limit table has dependent keys';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.rate_limit_log'::regclass
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'STOP: custom rate-limit table trigger discovered';
  END IF;
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE command ILIKE '%rate_limit_log%'
  ) THEN
    RAISE EXCEPTION 'STOP: rate-limit scheduled job discovered';
  END IF;
END
$wk$;

TRUNCATE TABLE public.rate_limit_log CONTINUE IDENTITY;
COMMIT;

-- Separate read-only postcondition:
-- SELECT pg_size_pretty(pg_total_relation_size('public.rate_limit_log')) AS
--   post_retirement_bytes;
