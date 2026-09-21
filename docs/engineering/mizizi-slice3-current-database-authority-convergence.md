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

## Tranche A implementation status — 21 September 2026

Implementation branch:

`fix/mizizi-slice3-tranche-a-stale-authority-repair`

Candidate migrations:

- `20260921170000_registry_reviewed_artist_identity_composition_v1.sql`;
- `20260921171000_registry_chart_artist_resolution_rebase_v1.sql`.

Current disposable Preview:

- project ref: `qjqtscxezmijkioxwazy`;
- branch id: `b3188255-79cf-44ca-bf08-7febca89c301`;
- exact Production baseline remains 166 / `20260921153000`;
- corrected candidate replay reaches 168 / `20260921171000`;
- permanent Artist and Chart SQL verifiers pass on the corrected final Preview;
- no Production SQL, Edge, or frontend deployment has occurred.

Real JWT/PostgREST behavior acceptance:

- applicant password login through Supabase Auth: PASS;
- reviewer password login through Supabase Auth: PASS;
- current V3 Artist Claim submission: PASS;
- reviewer Claim approval through PostgREST: PASS;
- Missing Artist Intake acceptance through PostgREST: PASS;
- reviewed Artist creation preserves `create_from_artist_claim / applied`
  provenance: PASS;
- active Artist representation: PASS;
- Missing Artist alias state `manual / active`: PASS;
- typed relationship endpoint resolution: PASS;
- merged review state: PASS;
- exactly one governed `registry.artist.create/v1` execution per accepted flow:
  PASS;
- Registry Artist Resource identity/lifecycle convergence: PASS;
- Top Songs presentation mutation: zero rows;
- exact execution grants at rest: 0.

Behavior acceptance exposed one real candidate defect:

- `accept_registry_missing_artist_intake` wrote the new Registry Artist UUID
  into legacy `contributor_submissions.entity_id`, whose foreign key targets
  `cultural_entities(id)`;
- the function now leaves that legacy field untouched and merges the submission
  through Registry Artist, alias, typed relationship, audit, and review
  authority instead;
- the permanent Missing Artist Intake verifier now rejects any return of the
  stale `entity_id=v_artist_id` write.

Replay authority is intentionally open:

- the `20260921170000` migration bytes changed after the behavior defect was
  found;
- its previously committed replay receipt is therefore stale and fails the
  migration replay contract by SHA-256;
- the prior schema seal also points to the superseded replay authority;
- a fresh clean replay must directly prove the corrected `170000` state and
  then the `171000` state before either receipt or the schema seal is
  refreshed;
- a later final-state observation must not substitute for that earlier gate.

PR #1006 must not merge until that replay authority is truthfully resealed and
the protected CI suite passes.

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
