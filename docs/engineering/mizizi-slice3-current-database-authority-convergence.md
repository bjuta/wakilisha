# MIZIZI Slice 3 — Current Database Authority Convergence

Status: **in progress — Track Intake and Top Songs D1/D2 tranches Production accepted**

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

The current stale-contract and remaining-authority audit is:

`docs/engineering/mizizi-slice3-stale-contract-and-remaining-authority-audit-20260921.md`.

That dated audit supersedes the earlier five-job implementation queue below as
the current planning authority for #962.

The September 20 audit remains historical evidence. Do not rewrite its original
findings to pretend they were made against today's runtime. Historical replay
proofs, PRs, migrations, and closure records remain immutable. Current closure
and remaining-work truth belongs here and in dated forward amendments.

## Production-accepted convergence since the September 20 audit

The following major roads are no longer open Slice 3 debt:

- Admin Registry direct service-role canonical DML convergence;
- Provider Intake legacy direct Release mutation convergence/fail-close;
- Chart Playback provider persistence convergence;
- generic Track provider-link admission convergence;
- Track Intake create/enrichment convergence;
- Artist Top Songs D1 presentation authority + service-role boundary repair;
- `admin-registry-api` D2 retirement.

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

## Current remaining-work authority after stale-contract audit

The privileged-writer manifest still contains **11** entries classified as
`keep_converge`, `retire_or_internalize`, or `candidate_retire`, but the
21 September stale-contract audit proves that they are **not eleven independent
modernization jobs**.

The current classifications are:

1. **Artist Claim family — CURRENT / REBASE**
   - preserve Claim review, representation, permissions, duplicate-resolution
     and final lifecycle semantics;
   - replace the stale structural assumption that the Claim RPC itself must
     directly insert the Registry Artist;
   - reuse governed Artist identity creation without weakening the draft-first
     shared primitive;
   - preserve the strong existing behavioral acceptance contract.

2. **Missing Artist Intake — CURRENT / REBASE + REPAIR**
   - Production has 21 `needs_intake`, 2 `intake_in_progress`, and 49
     unresolved Artist relationship endpoints;
   - the current acceptance RPC is stale against the live alias schema because
     it writes `source='manual_intake'` while Production allows only
     `manual`, `similarity_match`, and `ingest_review`;
   - route identity creation and alias mutation through current authority while
     preserving typed endpoint resolution and review semantics;
   - prove that resolving historical `popular_track/top_song` endpoints cannot
     mutate Top Songs presentation authority.

3. **Chart Artist Resolution — CURRENT / REBASE**
   - the workflow can still create new decisions;
   - the June-era UI incorrectly treats
     `wk_chart_entries_v2.canonical_artist_id IS NULL` as missing canonical
     Artist identity;
   - current accepted identity derives from canonical Track + primary
     Track↔Artist credit;
   - rebase the UI and apply path onto current Track-credit authority and
     rebuildable Chart projection.

4. **Artist creation for decouple — CURRENT / THIN COMPOSITION**
   - remove the second direct Artist-creation algorithm;
   - compose current Artist identity authority and only the domain-required
     reviewed lifecycle consequence.

5. **Chart Artist alias resolution — STALE MONOLITH**
   - split alias decision, Track-credit correction, Chart projection repair,
     and true duplicate-identity handling;
   - retire `admin_resolve_chart_artist_alias(...)` after caller cutover.

6. **Track duplicate repair — CURRENT HIGH-BLAST / INTERNALIZE**
   - retain the mature repair algorithm;
   - place exact reviewed plan/grant/journal/verifier authority around it;
   - preserve `registry_track_resolution_events` and current identity-lineage
     semantics.

7. **Artist decouple — CURRENT HIGH-BLAST / CONVERGE**
   - keep the reviewed product command;
   - internalize `admin_decouple_registry_artist(...)`;
   - preserve split-event and lineage semantics.

8. **Safe Artist merge — CURRENT HIGH-BLAST / INTERNALIZE**
   - retain the mature algorithm behind exact reviewed authority;
   - preserve `registry_artist_resolution_events action='artist_merge'` and
     lineage semantics.

9. **Old manual Artist merge — CANDIDATE RETIRE**
   - no current source or database-function caller was found;
   - retire only after bounded external/runtime dependency proof and rollback
     preservation.

### Newly discovered bypass/stale-caller work inside #962

The stale-contract audit also found current authority debt outside the eleven
database-function manifest entries:

- `registry_artist_aliases` still grants authenticated
  INSERT/UPDATE/DELETE and the current Artist Aliases UI directly deletes alias
  rows;
- `registry_track_provider_links` still grants authenticated
  INSERT/UPDATE/DELETE even though governed provider-link admission is now
  Production accepted and no current `src/` direct writer was found;
- `registry_relationship_evidence` still grants authenticated INSERT/DELETE;
  current typed relationship commands already own reviewed evidence attachment,
  so this grant needs explicit dependency proof or contraction;
- Label and Genre detail pages still contain direct archive UPDATE calls even
  though Production table UPDATE is already denied and accepted
  `admin_patch_registry_*_profile_v1` commands exist.

These are not reasons to reopen the shared Registry kernel. They are stale
caller/grant cleanup required to make the final Slice 3 bypass claim true.

### Corrected implementation shape

Work is grouped by rollback authority, not legacy function name.

**Tranche A — stale low/medium authority and caller repair**

- Artist Claim rebase;
- Missing Artist Intake repair/rebase;
- Chart Artist Resolution current-model rebase;
- Artist creation helper convergence;
- split/retire the Chart Artist alias monolith;
- bounded alias state/admission authority and browser alias-DML revocation;
- stale Label/Genre UI caller removal/rebase;
- provider-link direct authenticated DML contraction after negative caller proof;
- relationship-evidence grant decision/contraction after dependency proof;
- consolidated current writer + direct-table-grant verification.

**Tranche B — high-blast exact containment and retirement**

- Track duplicate repair exact reviewed authority around the mature engine;
- Artist decouple exact reviewed authority + low-level internalization;
- safe Artist merge exact reviewed authority around the mature engine;
- old manual Artist merge retirement after proof;
- current Resource, lineage, and Chart-projection postcondition verification.

The shared grant/journal/evidence/fingerprint/review kernel remains frozen.
A kernel change is a separate stop-and-review decision, not an implementation
convenience.

## Tranche A Production acceptance — 21 September 2026

Implementation PR:

- PR #1006: `fix: converge Slice 3 stale Artist and Chart authority`;
- candidate head: `bd027bd07419f00c91d604f625ec11a17cbe9e99`;
- merged main: `9a163ddb9382287fa961e37d44f6f04806bf640d`.

Production migrations:

- `20260921170000_registry_reviewed_artist_identity_composition_v1.sql`;
- `20260921171000_registry_chart_artist_resolution_rebase_v1.sql`;
- Production migration count: 168;
- Production migration head: `20260921171000`;
- canonical post-promotion migration dry-run: zero pending;
- permanent Artist convergence verifier: PASS;
- permanent Chart materialization/runtime verifier: PASS.

The canonical repository promotion applied the two repository migrations from exact
merged `main`. The promotion then stopped at post-apply generated-type equality
because the committed schema seal still described the accepted disposable
Preview. No migration was rerun. Production was inspected in place, both
permanent SQL verifiers passed, and `schema:generate` regenerated the exact
`public,editorial` type baseline from Production.

Production schema seal:

- mode: `production`;
- source project: `pgzizndxdyhqmtyywjmt`;
- migration head: `20260921171000`;
- generated type SHA-256:
  `472186569827cdfe3d5a72b46a546db605839934abeaa8028d9e3233f911dc46`;
- `schema:verify`: PASS;
- repository/Production migration versions: exact;
- pending migrations: 0.

Frontend acceptance:

- exact deployed main:
  `9a163ddb9382287fa961e37d44f6f04806bf640d`;
- Production environment authority reused the retained local `.env` and
  `.env.local` split;
- protected Critical suite: 365 / 365 PASS;
- complete Production build: PASS;
- GA4 build-output audit: PASS;
- Preview Supabase ref in built artifact: no;
- Production Supabase ref in built artifact: yes;
- local/live index SHA-256:
  `e9b9e62992b34b78825e5045cd0e77806900ab75ebf852d7c4f94b87cd834084`;
- local/live entry:
  `assets/index-DG1JgV36.js`;
- local/live entry SHA-256:
  `5b409c8f8c0fc33c41b38e88407f56549956cc57fac9ca9a11648eb1956ee047`;
- local/live file count: 3794.

The first post-activation smoke returned HTTP 500. The deployed bytes were
already exact. Diagnosis proved the activation had preserved restrictive local
filesystem modes into the live web root:

- live directories: 3569 at `700`;
- live files: 3794 at `600`;
- preserved rollback directories: 3569 at `755`;
- preserved rollback files: 3794 at `644`;
- Nginx error authority: permission denied on the live root and
  `index.html`, followed by the SPA fallback redirect cycle.

The stopped deployment was recovered surgically without content rollback or
redeployment:

- live directories normalized to `755`;
- live files normalized to `644`;
- index SHA unchanged;
- entry SHA unchanged;
- file count unchanged at 3794;
- direct origin `/`: 200;
- direct origin `/messages`: 200;
- direct origin `/admin/messages`: 200;
- public HTTPS `/`: 200;
- public HTTPS `/messages`: 200;
- public HTTPS `/admin/messages`: 200;
- preserved remote stage cleaned after acceptance.

The canonical versioned frontend deployment template is now hardened to
normalize and assert the same `755` directory / `644` file web-serving mode
contract on both remote stage and live activation state. The wrapper self-test
also requires those mode-contract markers.

Disposable Preview cleanup:

- Preview project ref: `qjqtscxezmijkioxwazy`;
- Preview branch id: `b3188255-79cf-44ca-bf08-7febca89c301`;
- deleted after Production SQL, schema, frontend, and HTTP acceptance;
- only the default Production branch remains.

This closes the PR #1006 stale Artist + Chart authority block in Production.
It does **not** close whole Slice 3. #962 remains open for the remaining
Tranche B and separately active Slice-3-owned bypass/presentation work,
including the current Top Songs D1 candidate.

## Slice 3 exit gate

#962 remains open.

Slice 3 closes only when a fresh Production audit proves:

- no unknown canonical Registry writer;
- no Slice-3-owned `keep_converge`, `retire_or_internalize`, or
  `candidate_retire` debt remains;
- accepted human commands compose typed authority;
- private executors do not leak `anon`, `authenticated`, or
  `service_role` execution;
- authenticated direct INSERT/UPDATE/DELETE is mechanically zero across the
  canonical Registry mutation table set unless an explicitly documented
  evidence-only exception survives the stale-contract audit;
- no stale product direct-DML caller remains against a table whose write grants
  are denied;
- Artist Claim, Missing Artist Intake, Chart identity, Top Songs presentation,
  Resource identity, and Identity/Projection Lineage regression contracts pass;
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

The next mutation-bearing implementation block is:

**Tranche A — stale low/medium authority and caller repair**, as frozen in
`mizizi-slice3-stale-contract-and-remaining-authority-audit-20260921.md`.

No implementation begins from the obsolete five-job queue without first
respecting that audit's reclassifications.
