# Supabase advisors: classified Production baseline and first verified remediations

Date: 2026-11-13 UTC. Database: WAKILISHA, `pgzizndxdyhqmtyywjmt`.

## Baseline authority

Operator export `Pasted text.txt`: **802** unique, all WARN and SECURITY, observed at 19:16:33 UTC:
- 618 authenticated-executable SECURITY DEFINER functions
- 97 mutable-function search paths
- 82 anon-executable SECURITY DEFINER functions
- 4 extensions in `public`
- 1 unconditional `share_events` INSERT RLS policy

Independent live Supabase MCP advisors, before mutation:
- Security: **801 WARN + 199 INFO = 1,000**. The unrestricted `share_events` policy was present in PostgreSQL but not returned by the live advisor.
- Performance: **251 WARN + 1,213 INFO = 1,464**.
- Health: 0 advisor entries.
- Combined live baseline: **2,464** findings (not independent vulnerabilities).

Performance breakdown: 684 unused-index INFO; 499 unindexed-FK INFO; 161 multiple permissive policies WARN; 88 RLS InitPlan WARN; 29 no-primary-key INFO; two duplicate-index WARN; one absolute Auth connection count INFO.

## Independent privilege truth

The live `public` schema contained **755** SECURITY DEFINER routines, **82** callable by `anon`, **618** by `authenticated`, and **137** private to service/internal roles. Exactly **34** had no function-level `proconfig` search path; **16** were anonymously callable. Neither `anon` nor `authenticated` had CREATE rights on `public`, `auth`, `editorial`, `extensions`, or `media` schemas.

A lexical scan of authenticated privileged bodies found **279** without a simple explicit `auth.uid()`/role/capability token. **This is NOT proof of 279 vulnerabilities**: multiple `admin_*` functions delegate checks to private gate functions such as `platform_private.registry_*_admin_current_user_v1()`. Review authorization call graphs, role tests, and direct RPC exposure before revoking any grant.

## Applied and verified Production corrections

1. **20261113193358** `security_advisors_anon_definer_search_path_cohort_a_20261113`
   - Atomic guarded `ALTER FUNCTION` for 16 unpinned anonymous SECURITY DEFINER functions. Pinned `search_path=pg_catalog, public, pg_temp`; `pg_temp` explicitly last.
   - `ROLLBACK` rehearsal passed before applying the exact SQL. Postcondition: **16 pinned, 0 remaining anonymous unpinned, 18 other unpinned privileged functions**. Mutating routines' bodies, grants, and policies unchanged. Search-path WARN **97 -> 81**.

2. **20261113193630** `advisors_editorial_rls_initplan_cohort_a_20261113`
   - Two read-only Editorial reference-table policies now use `(SELECT auth.uid()) IS NOT NULL` rather than per-row `auth.uid()`.
   - Guarded rollback test and post-apply SQL verified identical role `authenticated`, command `SELECT`, and access predicate. RLS InitPlan WARN **88 -> 86**.

3. **20261113193740** `advisors_remove_redundant_share_events_insert_policy_20261113`
   - Removed a dormant permissive `WITH CHECK(true)` INSERT policy on `public.share_events`.
   - Before and after, `anon` and `authenticated` **do not have table-level INSERT**. Service role retains INSERT; the privileged recording RPC and existing user-facing share feature remain intact.
   - A guarded rollback test preceded migration; PostgreSQL confirmed the policy absent after apply. The warning appeared in uploaded export but was already absent from the current MCP advisory output.

4. **20261113194113** `advisors_editorial_rls_initplan_cohort_b_20261113`
   - Six additional Editorial reference-table authenticated SELECT policies, all originally exactly `auth.uid() IS NOT NULL`, now use the statement-scoped `(SELECT auth.uid()) IS NOT NULL`.
   - Fail-closed rollback trial PASS; applied migration PASS; live `pg_policies` confirms original roles/commands and optimized clauses.
   - RLS InitPlan WARN **86 -> 80** (eight total optimized).

All four applied SQL bodies are reconciled to exact migration filenames in isolated GitHub branches. **No compute, WK100, Registry, data rows, app deployment, or user session mutation** was performed in these changes.

## Current Production advisory balance

- Security: **785 WARN + 199 INFO = 984**. The 785 consist of 618 authenticated definer, 82 anonymous definer, 81 mutable search paths, and four public extensions.
- Performance: **243 WARN** after eight RLS changes; informational items fluctuate (e.g., unused-index count changed from 684 to 683 because counters only cover the period after PostgreSQL restarted). Do not count such fluctuations as fixes.

## Prioritized remaining engineering queue

**P0, security exposure:** audit the 82 intentionally/possibly anonymous privileged RPCs (public-read output filtering, ownership, hidden fields, rate limits) and the 618 authenticated functions (capability checks, private gate delegation, PUBLIC-inherited grants). Prioritize mutation/admin verbs, dynamic SQL, identity changes, withdrawals, DMs and Legal disclosure. Build privilege and negative actor tests before any revocations.

**P1, safe search paths:** finish the 18 other unpinned privileged functions in family-specific cohorts after resolving unqualified relation/function names. One is `public.exec_sql(text)`, restricted to service role but dynamically executes SQL; it requires explicit dependency and retirement review, NOT blind search-path alteration. Review the remaining ~63 invoker warnings separately.

**P1, query performance:** fix the remaining 80 InitPlan policy warnings using exact policy predicates and member/nonmember acceptance; then audit 161 multiple-permissive-policy warnings for equivalent authorization consolidation. These are not blanket rewrite targets.

**P2, indexes and physical footprint:** review two duplicate-index pairs for constraint ownership and usage first. Do not drop the 683+ 'unused' indexes based on just-resetted statistics, or auto-create 499 missing FK indexes; both increase change and IO risk.

**P2, extension/metadata hygiene:** four public-schema extensions may have dependency-heavy relocations. The 199 RLS-with-no-policy findings need deliberate classification: some schemas intentionally have service-only / deny-all behavior. Twenty-nine tables missing PKs may be staging/raw ingestion contracts.

## Operational post-incident boundary

2026-11-13 dashboard screenshot, last-30-minute view ending 22:17 EAT, showed 3 IOPS, 36.8 KB/s throughput, 3 current database connections, 6.88% CPU, 385.7 MB memory *usage*, and memory commitment SEVERE at 1.18 GB. Database-size panel: 0.53 GB used of 2 GB provisioned. Direct read-only PostgreSQL: 523 MB database size, 99.83% cache hit ratio, 0 temp files, ~293 KB WAL since the 18:08 UTC reset. This is evidence of low current workload, **not proof of replenished Disk I/O credits** or cleared memory commitment.

**Open incident until** disk burst balance and memory commitment recover and representative authenticated/public app acceptance is healthy. No compute upgrade. No CI-intensive stress on a recovering Production database. Never touch the owner's dirty WK100 checkout.

## Source authority

Operator screenshot `screencapture-supabase-dashboard-project-pgzizndxdyhqmtyywjmt-observability-database-2026-11-13-22_18_04.pdf` and the uploaded `Pasted text.txt`; independently verified through Supabase `get_advisors`, `execute_sql`, `apply_migration`, and `list_migrations`.

Supabase documentation: https://supabase.com/docs/guides/observability/advisors ; https://supabase.com/docs/guides/database/functions ; https://supabase.com/docs/guides/database/postgres/row-level-security


## Consolidated remediation result, 13 November 2026

The owner requested one closure pass without repeated prompts, scripts or PR fragmentation. The original 802 WARN export was corroborated by live Supabase Security + Performance Advisor metadata.

### Six applied, independently verified migration records

1. `20261113193358_security_advisors_anon_definer_search_path_cohort_a_20261113`: pin 16 anonymous SECURITY DEFINER paths.
2. `20261113193630_advisors_editorial_rls_initplan_cohort_a_20261113`: fix two Editorial InitPlan policies.
3. `20261113193740_advisors_remove_redundant_share_events_insert_policy_20261113`: remove redundant unrestricted share-event INSERT policy; public roles had no direct INSERT grant before or after.
4. `20261113194113_advisors_editorial_rls_initplan_cohort_b_20261113`: fix six Editorial InitPlan policies.
5. `20261113195717_advisors_rls_initplan_all_remaining_80_20261113`: one fail-closed exact snapshot of 80 policies, 51 `auth.uid()` and 29 `auth.role()`, adjusting only per-row execution to `(SELECT ...)`. Verified **80 → 0** RLS InitPlan warnings.
6. `20261113200036_advisors_remaining_80_function_search_path_20261113`: one exact pg_proc snapshot guarded by body hashes, EXECUTE grants, config and security mode. Pins 80 functions with `pg_catalog, public, pg_temp` and preserves prior `row_security` / timeout options. Verified **81 → 1** mutable search-path warnings; 82 anon and 618 authenticated definer grants retained.

All six SQL migrations have exact migration-history versions in live Production and matching files in this consolidated GitHub PR. Dry-run transaction ROLLBACK rehearsals passed for all DDL batches; no table data changes.

### Final live advisory breakdown

**Security: 705 WARN and 199 INFO = 904:**
- 618 authenticated-callable SECURITY DEFINER functions
- 82 anonymous-callable SECURITY DEFINER functions
- 1 mutable search path (`public.exec_sql(text)`, service-only dynamic executor, intentionally excluded from automated rewrites)
- 4 extensions in public
- 199 tables with RLS enabled but no explicit policy (INFO; requires intended deny-all/service-only classification)

**Performance: 163 WARN and 1,209 INFO = 1,372:**
- 161 multiple permissive RLS policies (may represent intentional OR authorization)
- 2 identical index pairs, subject to constraint ownership and legacy scripts
- 499 foreign keys without covering index (does not imply each needs an index)
- 680 indices with no recent recorded usage after 18:08 UTC PostgreSQL stats reset (not valid proof of redundancy)
- 29 tables lacking PK (many raw/staging)
- 1 absolute Auth connection setting recommendation

These are *findings*, not 2,276 confirmed vulnerabilities or functional defects. Merely suppressing warnings or revoking all public RPCs would break intentional music, community, publication and administration behavior.

### High-priority exposure classification from catalog

All 82 anonymous-executable privileged `public` routines were scanned for mutation-like statements. Four had direct mutation-like tokens:
- `community_create_guest_follow_intent(uuid[])`: intentional guest-follow conversion contract, bounded to 1–24 artists and a private state path
- `increment_share_count(text,text,text,text)`: anonymous share counter and individual share-event write
- `track_analytics_event(text,text,text,text,text,jsonb,text,uuid,text)`: intentionally public analytics INSERT, takes user-provided context and IDs
- `resolve_media_asset_delivery(uuid,uuid,uuid,text)`: governed media delivery resolver; a mutation-like lexical token alone is NOT proof it writes data

The other anonymous functions still need code-path security review before a clean waiver can be claimed. Lexical detection cannot establish safe authorization, sensitive output, rate limits, or absence of SQL injection.

The broad authenticated-definer class is mostly built-in product RPCs. Admin Registry operations frequently call private gate functions (e.g. `platform_private.registry_*_admin_current_user_v1()`), so source-text search alone must not be used to revoke their grants.

`public.exec_sql(text)` is a `postgres`-owned SECURITY DEFINER dynamic SQL executor with no pinned path, but `anon` and `authenticated` do not hold EXECUTE. It is an operational exception requiring dependency mapping; changing its path or deleting it blindly could break service-role migrations.

### Operational closure boundary

The original dashboard showed 3 IOPS, 36.8 KB/s, 6.88% CPU and 385.7 MB working memory; 1.18 GB memory commitment still marked SEVERE. Live SQL is responsive, project is ACTIVE_HEALTHY, and allocated database size ~523–524 MB after the ~311 MiB rate_limit_log retirement. These do NOT prove remaining Disk I/O burst credits or memory-commitment recovery.

No compute upgrades, Registry edits, WK100 changes or destructive analytics cleanup were authorized. No additional rollback/merge action is implied by this report.

### Required post-merge review, not automatic warning suppression

Only merge after the normal repo checks and confirming the six migration file hashes match the already-applied migration source. Longer-term review of 700 callable privileged interfaces and 161 OR-combined RLS policies is security-engineering work; it cannot truthfully be declared verified safe using advisory counts alone. Avoid another barrage of micro-PRs; organize this as a single governed authorization audit if further exposure is found.

