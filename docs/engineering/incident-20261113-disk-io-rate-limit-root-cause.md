# SEV-1 2026-11-13: Disk I/O root-cause evidence and safe rate-limit retirement

## Proven in Production (read-only)

Project `pgzizndxdyhqmtyywjmt`, PostgreSQL 17.

- The actual database is **834 MB**. PostgreSQL `shared_buffers` is 224 MB.
- `public.rate_limit_log` physically occupies **311 MB**: 121 MB heap, 61 MB primary-key index and 129 MB `(bucket_key,created_at)` index. This is 37.3% of the database.
- Planner estimate `pg_class.reltuples`: **1,524,511** rows. This is an *estimate*, not a full `count(*)`.
- `TABLESAMPLE SYSTEM(0.15)` sampled 2,112 rows, all with `public:`-prefixed bucket keys; another 0.15% sample yielded 1,663 records, none from the last 24 hours. Samples are not exhaustive.
- `cron.job`: **no** command referencing `rate_limit_log`. Table has no referencing or outward foreign key, no custom trigger, and no `pg_proc.prosrc` match.
- The previous `public-content-read` v118 executed one `rate_limit_log` exact-count query **and** one attempted INSERT on every public request. Deployed v119 removes both operations and was independently read back `ACTIVE`. Two smaller consumers remain: `admin-router` and `briefing-handler`. They use a 60-second window; do not remove their limiter or bypass authorization.
- `public.analytics_events` occupies **181 MB**, ~21.7% of the database. It is a governed analytics ledger and **must not** be truncated as part of this fix.
- The two operational tables are **492 MB / 59%** of all database storage. Disk size is not synonymous with disk I/O, but the earlier per-request rate-limit IO and substantial index-maintenance footprint are an evidence-backed code defect.
- PostgreSQL restarted at **2026-11-13T18:07:59Z**; `pg_stat_statements` reset at 18:07:58Z. Current query rankings cannot prove which SQL statement exhausted the **earlier** I/O budget.
- `pg_stat_wal` reported just 185 kB WAL since 18:08, and `pg_stat_database` 36 MB buffer misses and 7 GB cache hits at diagnostic time. These are after-reset counters, not a historical incident measurement.

## Completed structural containment

1. `public-content-read` v119 removes the `rate_limit_log` query/insert path; this prevents the main table from growing per public request. Source branch `fix/incident-20261113-public-read-admission-v119`.
2. Media Processor and Legal Disclosure Worker backpressure deployed successfully, independently operator-verified by exact Git blobs and active service status. PR #1370.
3. Public Discography same-request coalescing and removal of unique timestamp query parameter are prepared on `fix/incident-20261113-public-discography-request-coalescing`, **not yet deployed**.
4. A separate offline SEO build path is prepared but **not accepted or deployed**.

## Proposed one-time physical retirement — BLOCKED pending explicit owner approval

`ops/incidents/20261113-expired-rate-limit-log-retirement.sql` is **destructive**, and must **not** be applied automatically, as part of a build, by a generic migration, or by unattended infrastructure.

The transaction fails closed unless PostgreSQL has been up for at least five minutes, the table has received **zero inserts since restart**, no FKs/triggers/cron uses it, and a short `ACCESS EXCLUSIVE NOWAIT` lock is available. It then executes `TRUNCATE ... CONTINUE IDENTITY`, reclaiming allocated table and index pages without row-by-row DELETE/WAL amplification. It retains the table, indexes and future Admin/Briefing schema. This wipes the expired historical request-rate rows and any currently live rate-limit counters; **this is why owner approval is required**.

A one-time TRUNCATE cannot replenish a previously depleted burst I/O credit balance. Its purpose is to reclaim unused physical space and eliminate old index/tree baggage *after the hot write path is already removed*.

After approval and execution, independently verify: `pg_total_relation_size('public.rate_limit_log')` near-empty, `exists(select 1 from public.rate_limit_log limit 1)=false`, successful Admin/Briefing authorization, and I/O/503 stability. Do not call the incident closed until the actual Disk I/O balance and application availability have recovered.

## Non-negotiable scope

- No compute upgrade.
- No destructive SQL without explicit approval.
- No mass DELETE/VACUUM FULL/REINDEX on the hot table during the incident.
- No Registry, Person, canonical music identity, WK100 period, source-evidence, or governed analytics deletion.
- No modification of the founder's dirty WK100 checkout.
