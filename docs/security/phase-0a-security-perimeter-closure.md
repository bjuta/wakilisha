# Phase 0A Security Perimeter Closure

Phase 0A is closed for the WAKILISHA database and API perimeter.

## Exit gates

- No unclassified anonymous `SECURITY DEFINER` RPC remains.
- Anonymous privileged commands are blocked. Anonymous execution is limited to reviewed public reads and bounded telemetry contracts.
- Internal trigger functions are not directly callable through the Data API.
- Authenticated privileged commands either enforce actor identity, check a capability or administrator role, or are restricted to `service_role`.
- Anonymous storage upload policies are absent.
- Broad authenticated write policies on GSC, registry review, registry media, and featured-guide administration were replaced with administrator or capability-scoped policies.
- New functions created by `postgres` in `public` no longer inherit execution for `PUBLIC`, `anon`, or `authenticated`.
- Supabase Security Advisor reports no `ERROR` findings.
- `scripts/security/verify-phase-0a-security-perimeter.sql` returns zero rows in production.

## Reviewed public contracts

Anonymous `SECURITY DEFINER` execution remains only where the public application requires a stable read model or a bounded telemetry write. These functions are registered in `private.phase_0a_rpc_classification` as `public_read` or `public_bounded_write`.

The remaining `share_events` anonymous insert policy is intentional telemetry intake. It carries no editorial or administrative authority and remains visible as an accepted advisor warning.

## Accepted migration debt

The following advisor warnings are recorded but do not represent an open Phase 0A privilege boundary:

- Legacy functions with mutable `search_path`. Their API grants are now bounded; function-by-function search-path normalization remains migration debt.
- Extensions currently installed in `public`: `pg_net`, `pg_trgm`, `fuzzystrmatch`, and `vector`. Moving extensions requires a dependency-aware maintenance migration.
- RLS-enabled tables with no policies. These tables are closed to Data API roles and are internal by default.
- Reviewed public-read and actor/capability-scoped authenticated `SECURITY DEFINER` functions, which the advisor flags by design.

## Platform control outside the database connector

Supabase leaked-password protection remains disabled and requires a manual Auth configuration change. It is tracked in GitHub issue #451. This is a platform configuration follow-up, not an open database permission boundary.

## Production migrations

- `20260714192302_phase_0a_close_security_perimeter.sql`
- `20260714192420_phase_0a_enforce_community_actor_identity.sql`
- `20260714192534_phase_0a_repair_permissive_policies_and_bucket_listing.sql`
- `20260714192659_phase_0a_lock_import_run_mutators_to_service_role.sql`

## Programme transition

With the database and API perimeter gates satisfied, the programme advances to Phase 0B: Engineering Control Plane.
