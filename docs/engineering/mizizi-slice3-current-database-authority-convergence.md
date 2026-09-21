# MIZIZI Slice 3 — Current Database Authority Convergence

Status: **in progress — Track Intake tranche Production accepted**

Current authority checkpoint:

- last runtime-bearing merged main / deployed frontend authority: `dcdbe948b6dc5edc2cd31133939e45e152db7b57`;
- living documentation authority: this file on protected `main` (do not pin a self-expiring docs-only head);
- Production project: `pgzizndxdyhqmtyywjmt`;
- Production status: `ACTIVE_HEALTHY`;
- Production branch status: `FUNCTIONS_DEPLOYED`;
- Production migration count: **166**;
- Production migration head:
  `20260921153000_registry_track_intake_legacy_writer_retirement_v1`;
- machine privileged-writer manifest entries: **54**;
- classified database-function writers: **41**;
- permanent canonical writer discovery:
  `REGISTRY_CANONICAL_WRITER_INVENTORY_PASS`.

This document is the living current-state companion to
`mizizi-slice3-final-live-writer-authority-audit.md`.

The September 20 audit remains historical evidence. Do not rewrite its original
findings to pretend they were made against today's runtime. Current closure and
remaining-work truth belongs here and in dated amendments to the audit.

## Production-accepted convergence since the September 20 audit

The following major roads are no longer open Slice 3 debt:

- Admin Registry direct service-role canonical DML convergence;
- Provider Intake legacy direct Release mutation convergence/fail-close;
- Chart Playback provider persistence convergence;
- generic Track provider-link admission convergence;
- Track Intake create/enrichment convergence.

### Track Intake Production closure

PR #1001, `fix: converge Track Intake onto governed Registry authority`, is
merged to protected main.

Merged main:

`dcdbe948b6dc5edc2cd31133939e45e152db7b57`

Production now uses:

1. Track Create V2 identity authority for new Tracks;
2. source-credit-scoped reviewed Artist-credit reconciliation;
3. provider-neutral reviewed Track profile admission;
4. provider-neutral reviewed Release profile admission where applicable;
5. governed canonical Track provider-link admission;
6. exact Track activation after complete reviewed-credit-set proof;
7. workflow-only finalization with no canonical Registry DML.

Retired Track Intake alternate writers:

- `admin_create_registry_track_from_intake_enriched(uuid,text,text)`;
- `admin_resolve_registry_track_intake_enriched(uuid,uuid,text,boolean)`;
- `admin_resolve_registry_track_intake(uuid,uuid,text)`;
- `sync_registry_track_intake_artist_credits(uuid,uuid)`.

Acceptance completed:

- consolidated real-user/JWT Preview acceptance;
- exact operation/grant/write-event receipt audit;
- clean repository-versioned Preview replay from Production baseline;
- seven migration replay proofs;
- schema seal and migration replay contract;
- PR CI green;
- Production SQL promotion;
- ten permanent Production verifiers green;
- generated canonical writer inventory green;
- protected-main Critical Control Plane #1397 green;
- exact merged-main Production frontend deployment green;
- direct-origin and public HTTPS smoke green;
- clean Preview deleted after Production acceptance.

## Current machine-classified Slice 3 debt

The privileged-writer manifest now contains **11** entries still classified as
`keep_converge`, `retire_or_internalize`, or `candidate_retire`.

### Existing-primitive convergence roads

These should be completed before the high-blast repair/merge family because
accepted typed primitives already exist for most of their canonical writes.

1. Artist Claim creation family
   - `community_admin_decide_artist_claim(...)`
   - `community_admin_resolve_artist_claim_existing(...)`
   - preserve claim review/representation semantics;
   - route new canonical Artist creation through `registry.artist.create`.

2. Missing Artist Intake
   - `accept_registry_missing_artist_intake(...)`
   - route Artist creation through `registry.artist.create`;
   - preserve accepted typed relationship endpoint resolution.

3. Chart Artist resolution
   - `admin_apply_chart_artist_resolution_decision(...)`
   - converge Track↔Artist mutation onto accepted reviewed credit
     admission/reconciliation/set authority.

4. Artist creation for decouple
   - `admin_create_registry_artist_for_decouple(...)`
   - replace direct canonical Artist creation with `registry.artist.create`;
   - preserve both Chart-resolution and Artist-alias decouple callers.

5. Chart Artist alias resolution
   - `admin_resolve_chart_artist_alias(...)`
   - preserve alias-resolution semantics while moving canonical credit mutation
     behind typed/journaled authority.

### High-blast / retirement roads after the existing-primitive block

- `admin_apply_registry_track_duplicate_repair(...)`
  - dedicated exact high-risk Track repair operation;
- `admin_apply_artist_decouple_decision(...)`
  - dedicated exact Artist decouple operation;
- `admin_safe_merge_registry_artists(...)`
  - dedicated exact high-risk Artist merge operation;
- `admin_decouple_registry_artist(...)`
  - internalize after the reviewed product command owns exact authority;
- `admin_merge_registry_artists(...)`
  - candidate retirement after dependency, bounded traffic, rollback, and
    permanent negative proof.

## Next five jobs

The next five engineering jobs, in current Slice 3 order, are:

1. **Artist Claim canonical-creation convergence**
   - freeze current claim-review semantics and callers;
   - compose accepted Artist-create authority;
   - keep existing-Artist claim resolution semantics intact.

2. **Missing Artist Intake convergence**
   - freeze current knowledge-review workflow;
   - compose typed Artist create + typed relationship endpoint resolution.

3. **Chart Artist resolution convergence**
   - freeze reviewed resolution semantics;
   - replace direct `registry_track_artists` mutation with exact reviewed
     Track↔Artist authority.

4. **Decouple Artist-creation convergence**
   - converge `admin_create_registry_artist_for_decouple(...)` onto
     `registry.artist.create`;
   - do not redesign the later high-blast decouple operation in this job.

5. **Chart Artist alias-resolution convergence**
   - preserve alias semantics;
   - move canonical credit mutation onto typed/journaled authority.

After those five, enter the dedicated high-blast Track duplicate repair / Artist
decouple / Artist merge block and finally the manual-merge retirement proof.

## Slice 3 exit gate

#962 remains open.

Slice 3 closes only when a fresh Production audit proves:

- no unknown canonical Registry writer;
- no Slice-3-owned `keep_converge`, `retire_or_internalize`, or
  `candidate_retire` debt remains;
- accepted human commands compose typed authority;
- private executors do not leak `anon`, `authenticated`, or
  `service_role` execution;
- ordinary browser canonical DML remains zero;
- MIZIZI standing/exact grants at rest remain within the accepted zero-state
  contract;
- no autonomous MIZIZI schedule exists;
- repository, migration ledger, runtime deployment, and Production verifier
  evidence agree.

Slice 4 #991 remains blocked until this exit gate passes.

The broader Supabase advisor/security programme remains owned separately by
#992 and must not be folded into Slice 3 without an exact writer-road reason.

## Current deployment classification

The current Production state is already accepted. This documentation checkpoint
requires no SQL, Edge Function, frontend, Finish, or other Production runtime
mutation.

The next mutation-bearing implementation job is:

**Artist Claim canonical-creation convergence**.
