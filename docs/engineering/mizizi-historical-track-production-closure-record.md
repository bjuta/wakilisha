# MIZIZI historical Track production closure record

Date: 2 September 2026

## Status

Accepted in production.

The historical MIZIZI Track identity apply is complete.

This closure is Track-only. It does not authorize or apply the separate historical Release taxonomy candidate set.

## Production authority

Production apply main:

`8d96a2805458e75d55b9ce69db841b05c74d7393`

Reviewed production trigger:

- PR #793, `Reauthorize MIZIZI Track apply after JIT readiness proof`
- trigger scope: `historical_track_only`
- accepted input fingerprint: `551b29431700536937c26ecb1e396c3cf9314edefd88c589284cf330c9d1bb9a`
- expected repairs: 440
- expected blocked reviews: 66
- expected MIZIZI redirects: 857

Governed production run:

- workflow: `MIZIZI Track Production Control Plane`
- run: #28
- run id: `33652839751`
- result: PASS
- evidence artifact id: `9856136486`
- evidence artifact SHA-256: `12ee7c1765ef32f2e9b4422b499796a66369562541e20251f4d93c6a2d5c41a1`

Protected push acceptance:

- `Critical Control Plane` run #887: PASS

## Control-plane repair sequence

The production mutation remained closed until the GitHub control plane could prove the same raw-Postgres runtime that had been accepted in disposable preview rehearsal.

Accepted control-plane repairs were:

- PR #790: production Supabase temporary-access/JIT contract
- PR #792: bounded JIT session-readiness gate

The accepted production path now:

1. runs only from the GitHub production control plane
2. requires a separately reviewed trigger manifest
3. uses the linked Supabase project authority
4. enables temporary database access only for the governed run
5. maps the repository platform identity to `postgres`
6. discovers the project pooler host from the linked Supabase CLI
7. uses the project-scoped `postgres.<project-ref>` identity with `jit=true`
8. proves a live `postgres@postgres` session before any baseline or mutation query
9. retries only bounded transient JIT-provider readiness failures
10. restores the JIT mapping and leaves production temporary access disabled at rest

No laptop database password, custom long-lived Postgres role, or ad hoc production credential became part of the accepted deployment surface.

## Accepted pre-apply audit

Fresh production audit before mutation:

- rule set: `1.1.0`
- mode: audit
- scope: Track
- active Tracks scanned: 2,101
- findings: 1,001
- `track_slug_identity_noise`: 506
- `track_title_credit_noise`: 492
- `track_slug_identity_mismatch`: 3
- automatic Track slug candidates: 506
- observe-only findings: 495
- applied: 0
- queued for review: 0

The audit reported:

`Audit mode completed. No Registry rows were changed.`

## Accepted production apply

The governed apply completed with:

- canonical Track repairs: 440
- blocked candidates queued for review: 66
- canonical write events: 440
- unique finding fingerprints: 440
- canonical event-to-Track slug matches: 440
- active Tracks after apply: 2,101

The apply runner reported 2,541 Track scans and 1,420 total findings because successful Track mutations update `updated_at`; keyset pagination can therefore encounter already-mutated Tracks again later in the same full scan. Rescanned repaired rows produced no second canonical write. Acceptance is bound to the 440 unique canonical events, 66 blocked review rows, final Registry state, and post-apply audit.

## Accepted blocked review set

Exactly 66 Tracks remain unchanged and are represented by 66 open `mizizi_data_hygiene` review items.

Reason split:

- current Community thread collision: 28
- Track identity collision: 26
- missing explicit primary-Artist scope: 6
- ambiguous current Community thread ownership: 6
- unexpected review class: 0

All 66 blocked Tracks still retain their pre-apply slug. No arbitrary numeric suffix or inferred identity was manufactured.

## Redirect and downstream impact

Accepted redirect state:

- total Track redirects: 1,148
- MIZIZI-created Track redirects: 857

Exact downstream impact recorded by the 440 canonical events:

- permanent redirects: 857
- chart rows repaired: 7
- Community save slug rows repaired: 3
- Community save URL rows repaired: 3
- Community thread rows repaired: 162

Post-apply pointer verification:

- chart mismatches: 0
- Community save mismatches: 0

Historical provider observations and other historical evidence remain unchanged.

## Accepted post-apply audit

Fresh post-apply Track audit:

- findings: 561
- `track_slug_identity_noise`: 66
- `track_title_credit_noise`: 492
- `track_slug_identity_mismatch`: 3
- applied: 0
- queued for review: 0
- observed findings: 495
- Tracks scanned: 2,101

The remaining 66 slug candidates are the exact blocked review set.

The post-apply audit reported:

`Audit mode completed. No Registry rows were changed.`

## Production database preservation

After the Track apply:

- active Tracks: 2,101
- migration count: 79
- migration head: `20260901170500_community_track_registry_identity.sql`

No repository migration was added or applied by this historical data mutation.

The disposable rehearsal preview no longer exists. Supabase branch inspection after closure shows only the production `main` branch.

Production temporary database access was restored to disabled at rest after the governed run.

## Explicit non-effects

This closure does not:

- run the historical Release taxonomy apply
- modify the 32 accepted Release taxonomy candidates
- delete or rewrite the 18 bad active Release-membership relationships across 13 active Releases
- change public Track route grammar
- add a SQL migration
- deploy a Supabase Edge Function
- deploy frontend assets
- require a Readdy Finish update
- reopen Phase 7A
- change Phase 7B as the current numbered programme phase

## Exit gates

Passed.

- Disposable preview rehearsal accepted.
- Exact production input fingerprint matched the accepted rehearsal authority.
- Fresh production pre-apply audit matched 1,001 / 506 / 495 / 2,101.
- Governed production mutation completed with exactly 440 repairs and 66 blocked reviews.
- Exactly 857 MIZIZI redirects were created.
- Downstream impact matched 857 / 7 / 3 / 3 / 162.
- Review reasons matched 28 / 26 / 6 / 6 with zero unexpected class.
- Canonical event-to-Track matches are 440 / 440.
- Blocked rows remain unchanged 66 / 66.
- Chart and Community save mismatches are zero.
- Fresh post-apply audit is 561 / 66 / 495 / 2,101 with no mutation.
- Migration history remains 79 through `20260901170500`.
- Critical Control Plane #887 passed.
- JIT mapping was restored and production temporary access is disabled at rest.
- Disposable rehearsal preview is absent.

Historical MIZIZI Track apply is closed.

Historical Release taxonomy apply remains a separate, unrun production mutation.
