# MIZIZI Slice 3 — Current Database Authority Convergence

Status: **in progress**

Authority checkpoint: protected main `61ea528bc590c3d2f56694cbd7801b1234b2a7c7`

This document is the current-state companion to
`mizizi-slice3-final-live-writer-authority-audit.md`.

The earlier audit remains historical evidence and must not be rewritten to
pretend its September 20 snapshot is current. Since that snapshot:

- privileged-writer discovery has been expanded and mechanised;
- Chart Playback provider persistence has converged;
- Provider Intake legacy Release mutation has failed closed;
- Admin Registry direct service-role canonical DML has converged;
- Production is at 158 migrations / `20260920190646`;
- the canonical writer inventory verifier passes in Production.

## Current exit surface

The current writer manifest contains 50 accepted entries on the protected-main
checkpoint above, including 37 database-function writers. The permanent
Production discovery gate reports:

`REGISTRY_CANONICAL_WRITER_INVENTORY_PASS`

Slice 3 therefore no longer has unknown-writer discovery debt. Remaining work is
known database-function authority convergence.

At the checkpoint above, 14 live database-function writers remain classified
with one of:

- `keep_converge`;
- `retire_or_internalize`;
- `candidate_retire`.

## Existing-primitive convergence tranche

The first tranche is deliberately limited to roads that can compose accepted
typed authority without inventing a new high-blast operation family.

Current targets:

1. `registry_upsert_track_provider_link(...)`
2. `admin_resolve_registry_track_intake_enriched(...)`
3. `admin_create_registry_track_from_intake_enriched(...)`
4. `community_admin_decide_artist_claim(...)`
5. `community_admin_resolve_artist_claim_existing(...)`
6. `accept_registry_missing_artist_intake(...)`
7. `admin_apply_chart_artist_resolution_decision(...)`
8. `admin_create_registry_artist_for_decouple(...)`
9. `admin_resolve_chart_artist_alias(...)`

The first bounded sub-block is generic Track provider-link admission.

### Provider-link target authority

The accepted typed operation already exists:

`registry.track.provider_link.admit/v1`

Chart Playback remains independently bounded to the
`registry_chart_admission` actor and `manage_charts`. It is not broadened or
reused as a generic Registry transport.

The Registry-admin road instead uses a separate human exact-grant broker:

`registry_provider_link_admin`

with:

- real `auth.uid()`;
- current `manage_registry`;
- caller-bound `INTERNAL_FACT` evidence;
- one exact existing Track target;
- exact Track state fingerprint;
- exact pre-existing provider-link fingerprint, including the explicit
  `absent` state;
- `registry.track.provider_link.admit/v1`;
- one mutation operation;
- one causal canonical write event;
- an independent persisted-state verifier.

The legacy `registry_upsert_track_provider_link(...)` implementation is not
deleted in this sub-block. It becomes owner-internal implementation only:
`PUBLIC`, `anon`, `authenticated`, and `service_role` lose EXECUTE.
This preserves its established field validation/upsert behavior without
retaining it as a second API authority.

The app caller moves to:

`admin_admit_registry_track_provider_link_v1(...)`

Retries that already match the requested exact state return the current row
without minting another grant. A provider-link state change after grant issuance
fails closed with `WK_STALE_PROVIDER_LINK`.

## High-blast tranche after existing primitives

These remain separate because they require dedicated exact operation semantics:

- `admin_apply_registry_track_duplicate_repair(...)`;
- `admin_apply_artist_decouple_decision(...)`;
- `admin_safe_merge_registry_artists(...)`;
- lower-level `admin_decouple_registry_artist(...)` must be internalised.

## Retirement tranche

`admin_merge_registry_artists(...)` remains a candidate retirement road.

Retirement requires current dependency proof, bounded Production traffic proof,
rollback source, and permanent negative/reintroduction control before DROP.

## Slice 3 final exit gate

#962 does not close until a fresh Production audit proves all of the following:

- no unknown canonical Registry writer;
- no Slice-3-owned `keep_converge`, `retire_or_internalize`, or
  `candidate_retire` debt remains;
- accepted human commands compose typed authority;
- private executors do not leak `anon`, `authenticated`, or
  `service_role` execution;
- MIZIZI standing/exact grants at rest remain within the accepted zero-state
  contract;
- no autonomous MIZIZI schedule exists;
- repository, migration ledger, runtime deployment, and Production verifier
  evidence agree.

Slice 4 #991 remains blocked until that exit gate passes.
