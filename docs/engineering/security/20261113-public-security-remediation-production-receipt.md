# Public Registry and anonymous RPC security remediation, 13 November 2026

**Authority:** WAKILISHA Supabase project `pgzizndxdyhqmtyywjmt`. Security investigation source is `docs/engineering/security/20261113-705-warnings-blast-radius-audit.md`. This document records already applied SQL and evidence, not a proposed migration.

## Live Production changes

Three atomic, source-hash-guarded migrations were applied from `fix/20261113-public-security-remediation` and reproduced exactly in this consolidated PR:

1. `20261113203121_public_registry_rpc_community_write_security_20261113`: five RLS public-read fences, 13 existing RPCs improved, and one scheduled guest-follow cleanup.
2. `20261113203242_public_release_getter_text_date_contract_20261113`: corrected pre-existing `get_releases_by_ids(uuid[])` text-returning Release date from a PostgreSQL date to `::text`. Original function had a runtime return type mismatch.
3. `20261113203414_public_registry_rpc_service_role_draft_parity_20261113`: preserved trusted service-role draft-read access on all six protected Registry read functions. The initial migration had restricted this internal access; the parity correction has been applied.

Every migration body is recorded under `ops/security` and `supabase/migrations` using its exact applied version. Rollback-only SQL rehearsals passed before each Production application. The first two initial rehearsals exposed a missing SQL function terminator and an overbroad postcondition query; both were corrected before application.

**Scope:** five Registry RLS public policies; six Registry lookup functions; analytics write; share recording; guest Follow intent; Community digest, replies, and private-profile stats. No change to existing function EXECUTE grants, security-definer ownership, Admin/MIZIZI governed permission model, Registry records, analytics history, or compute tier.

## Production acceptance already completed

| Boundary | Verified result |
| --- | --- |
| Anonymous direct SELECT of current draft Releases | 0 returned |
| Anonymous `get_releases_by_ids` and v2 with a known draft Release ID | 0 returned |
| Anonymous release artist/track link counts for a known draft Release | 0 |
| Anonymous direct SELECT of active Releases | 847 retained |
| Simulated authenticated nonadmin with no Registry-view permission | 0 direct draft and 0 v2 RPC draft, administrator gate false |
| Simulated administrator with active role | 1 draft returned via both table and v2 RPC, administrator gate true |
| Simulated PostgREST service-role claims | 1 draft returned by both Release RPC variants and direct table |
| Anonymous analytics with spoofed `p_user_id` | One transient row inside rollback transaction with `user_id IS NULL`; 0 spoofed actor rows; transaction rolled back |
| Anonymous analytics with an invalid URL | Rejected with SQLSTATE 22023 |
| Anonymous share RPC with an invalid platform | Rejected with SQLSTATE 22023 |
| Anonymous guest-follow intent with 49 raw elements | Rejected before array expansion with SQLSTATE 22023 |
| Anonymous Community digest with requested limit 999999 | 50 items returned |
| Anonymous replies with requested limit 999999 | Bounded query; 0 rows for nonexistent parent |
| Anonymous private-profile engagement counts | Returned comment/save/follow counts of 0 |
| New guest-follow expiry job | One active job, `wk_guest_follow_expiry_v1`, owned by `postgres`; 03:10 UTC daily; at most 500 expired intents per execution |
| Live database storage | Approximately 524 MB; no data cleanup executed by this deployment |

The SQL actor simulations are database-level role/claims acceptance, **not HTTP/browser/Edge or credential-authentication acceptance**. They ran under transaction rollback and did not persist test fixtures. The privacy check used an existing private profile and disclosed no identity or underlying counts in the acceptance record.

## What has been closed, and what has not

**Closed by verified code and SQL:** public exposure of draft Releases and links, missing status checks and unbounded inputs in selected public Registry RPCs, SQL-level analytics spoofing of supplied user IDs, malformed analytics and share payloads, unbounded Community aggregation, hidden-profile aggregate disclosure, and one guest-follow cleanup query per guest intent call.

**Remaining security limits requiring a separate evidence gate, not reasons to undo these fixes:**

- The public `track_analytics_event` and `increment_share_count` RPCs remain anonymously executable, with field budgets and attribution integrity but **without a distributed, identity-resistant request-frequency ceiling**. A determined actor can still manufacture event/share calls or generate write amplification. Avoid rebuilding the old one-request-one-row PostgreSQL rate limiter. A gateway-level admission mechanism or verified perimeter rate limit must be designed and accepted before claiming abuse resistance.
- Authenticated private/Media/Legal RPC functions remain in the 705-advisory inventory and need negative-actor tests before any grant-level modifications.
- No frontend browser acceptance was run against current public Release, Admin Discography, Community, sharing, analytics, or Follow journeys in this tool session. The server-side SQL acceptance is not equivalent to UX acceptance.
- The four extension warnings, one service-only dynamic-SQL search-path warning, and 700 overlapping authenticated/anonymous SECURITY DEFINER advisories remain, because grants are deliberate or require independent proof.
- Remaining I/O budget recovery and Memory Commitment SEVERE must be checked from platform observability before the broader incident is closed.

No user-owned WK100 checkout, WK100 evidence programme, Auth session or private Media asset was changed.

## Deployment and reconciliation

The current PR #1373 is the **single** review path for the earlier advisory optimizations, full 618-function audit, and these three applied Production migrations. Do not rerun already-applied migrations via another deploy. Compare the exact current Supabase migration history before any release.

Since this is a SQL-only correction, there is no frontend build/deployment to carry out as part of the applied change. Follow-up UI acceptance can be conducted without redeploying the frontend.
