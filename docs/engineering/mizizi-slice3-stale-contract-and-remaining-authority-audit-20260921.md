# MIZIZI Slice 3 — Stale Contract and Remaining Authority Audit

Date: **21 September 2026**

Status: **READ-ONLY AUDIT COMPLETE — IMPLEMENTATION NOT YET AUTHORIZED**

Programme issue: **#962 — MIZIZI Slice 3: Obsolete Authority Retirement & Bypass Closure**

Current protected-main authority at audit freeze:

`47bad869e03c3b0d3ba15a473aee76c62dbb98e5`

Last runtime-bearing merged-main / deployed frontend authority:

`dcdbe948b6dc5edc2cd31133939e45e152db7b57`

Production:

- project: `pgzizndxdyhqmtyywjmt`;
- status: `ACTIVE_HEALTHY`;
- branch status: `FUNCTIONS_DEPLOYED`;
- migration count: **166**;
- migration head:
  `20260921153000_registry_track_intake_legacy_writer_retirement_v1`;
- generated canonical writer inventory:
  `REGISTRY_CANONICAL_WRITER_INVENTORY_PASS`.

This audit is a forward-looking current-state authority record. It does **not**
rewrite historical PRs, migrations, replay proofs, closure records, or
acceptance evidence to pretend later architecture existed earlier.

A historical closure may have been correct when accepted and still contain an
implementation assumption that is stale today. In that case the historical
record remains immutable and a forward migration/verifier must supersede the
stale assumption explicitly.

## 1. Why this audit exists

The remaining Slice 3 work was previously described primarily as eleven
machine-classified database-function writer debts.

That description is necessary but insufficient.

The correct closure question is not:

> How do we modernize all eleven old functions?

It is:

> Which old behaviors are still legitimate under the current Registry,
> identity, projection, review, evidence, and MIZIZI authority model; which
> implementations are stale; which bypasses sit outside the function manifest;
> and which roads should be retired instead of converged?

This audit therefore classifies each remaining road into one of four outcomes:

1. **CURRENT / CONVERGE** — behavior remains legitimate; mutation authority must
   be moved onto accepted governed authority.
2. **CURRENT / REBASE** — domain behavior remains legitimate, but an older
   implementation or data model has been superseded and must be rebuilt against
   current authority.
3. **STALE / RETIRE OR FAIL-CLOSE** — the old surface no longer deserves a
   modernized mutation implementation.
4. **CURRENT HIGH-BLAST / INTERNALIZE** — the mature mutation algorithm remains
   useful, but it must become a private implementation behind an exact reviewed
   command rather than remain ambient authority.

The audit also tests closed work for stale assumptions that could produce later
failures if merely preserved.

## 2. Historical evidence rule

Historical evidence remains historical.

Do not modify old replay-proof JSON, old migration bytes, old PR descriptions,
or dated closure records to make them describe today's architecture.

The accepted forward pattern is:

```text
historical contract accepted at time T
→ later authority supersedes one implementation assumption
→ dated audit identifies the stale assumption
→ new migration/verifier supersedes that assumption
→ historical evidence remains unchanged
```

## 3. Primitive and kernel rule

The shared Registry governance kernel is **not** opened merely to accommodate
legacy functions.

The following remain frozen unless a separately reviewed gap proves otherwise:

- exact execution-grant semantics;
- mutation-operation journal schema/lifecycle;
- target/state fingerprint semantics;
- shared evidence assertion semantics;
- canonical operation/write-event linkage;
- shared review authority;
- MIZIZI executor security model;
- generic capability semantics.

The implementation target remains:

```text
kernel delta = 0
```

Existing typed authority should be composed where semantics match. Domain
workflow remains domain-specific. A new shared primitive is not justified
merely because several legacy functions happen to contain similar SQL.

## 4. Current machine-classified debt

The privileged-writer manifest currently has **11** entries with Slice 3 debt
dispositions:

- 9 `keep_converge`;
- 1 `retire_or_internalize`;
- 1 `candidate_retire`.

Those eleven remain useful machine inventory, but the stale-contract audit
changes how several should be resolved.

## 5. Current Production cross-system health

The later closed foundations that constrain the remaining work are currently
healthy.

Read-only Production proof found:

- Registry Artists missing Resource identity: **0**;
- Registry Artist ↔ Resource lifecycle mismatches: **0**;
- successful Artist merge events: **4**;
- matching Artist merge lineage rows: **4**;
- Artist split events: **2**;
- matching Artist split lineage rows: **2**;
- duplicate-Track source identities represented by successful repair events:
  **196**;
- matching Track supersession lineage rows: **196**;
- ordinary Artist aliases incorrectly promoted to identity lineage: **0**.

Therefore Resource identity and Identity + Projection Lineage are **not being
reopened as broken foundations**.

They are current invariants that every remaining merge, split, duplicate repair,
and identity-resolution change must preserve.

## 6. Stale-contract findings

### 6.1 Artist Studio: current behavior, stale structural assertion

The Artist Studio / Artist Claim product contract remains legitimate.

Current product code still uses:

- `community_submit_new_artist_claim_v3`;
- `community_admin_decide_artist_claim(...)`;
- `community_admin_resolve_artist_claim_existing(...)`.

Production currently has zero Artist Claim rows, so there is no live queue to
migrate, but the product capability remains exposed and current.

The old permanent structural verifier
`verify-artist-studio-registry-entry-convergence.sql` explicitly asserts that
`community_admin_decide_artist_claim(...)` itself contains a direct
`INSERT INTO public.registry_artists`.

That is now a stale implementation assertion because later Registry governance
established `registry.artist.create/v1` as the canonical Artist identity
creation primitive.

The **behavioral** verifier remains valuable and current. It proves that a
verified proposed-Artist claim results in:

- one deterministic Registry Artist;
- expected active lifecycle result;
- accepted proposal linkage;
- active representation;
- correct Artist Studio permissions;
- public identity behavior;
- canonical provenance/write evidence;
- no duplicate identity creation before review.

Disposition:

**CURRENT / REBASE**

Action:

- preserve Claim review, representation, permissions, duplicate-resolution and
  final lifecycle semantics;
- replace direct canonical Artist identity creation with accepted typed creation
  authority;
- do not force a generic Artist lifecycle primitive merely because
  `registry.artist.create/v1` is draft-first;
- keep Claim-specific reviewed activation as a domain consequence unless a
  separately proven reusable lifecycle invariant exists;
- supersede the stale structural direct-insert assertion with a current
  authority assertion;
- retain the existing behavioral contract as a regression gate.

Historical September 3 acceptance remains valid historical evidence and is not
rewritten.

### 6.2 Missing Artist Intake: live workflow, stale implementation, currently
schema-incompatible

This workflow is still operationally relevant.

Production currently has:

- **21** missing-Artist queue rows in `needs_intake`;
- **2** rows in `intake_in_progress`;
- **49** unresolved Artist relationship endpoints;
- **0** Artists successfully created with
  `metadata.created_from='missing_artist_intake'`;
- **0** missing-Artist submissions completed as merged.

The old acceptance function still directly:

- inserts `registry_artists` as `needs_review`;
- updates/inserts `registry_artist_aliases`;
- resolves legacy relationship endpoints through
  `resolve_registry_relationship_endpoint(...)`;
- completes contributor-submission/review state.

A concrete latent runtime break now exists:

Production's `registry_artist_aliases_source_check` allows only:

- `manual`;
- `similarity_match`;
- `ingest_review`.

The current `accept_registry_missing_artist_intake(...)` writes:

`source='manual_intake'`.

Therefore the legacy acceptance implementation is incompatible with the current
live alias schema. Existing observational verification scripts did not detect
this because they report counts/privileges instead of exercising the full
acceptance mutation.

Disposition:

**CURRENT / REBASE + REPAIR**

Action:

- keep the missing-endpoint review workflow;
- create canonical Artist identity through accepted governed Artist creation;
- preserve the legitimate `needs_review` workflow result without weakening
  Artist creation semantics;
- move alias admission behind bounded current authority;
- retain typed `resolve_registry_relationship_endpoint(...)` behavior;
- replace weak observational acceptance verification with a transactional
  behavioral proof that exercises creation, alias handling, endpoint
  resolution, submission completion, and rollback cleanliness.

### 6.3 Missing Artist Intake does not reopen Top Songs presentation authority

Some unresolved Artist endpoints belong to historical
`popular_track/top_song` relationships.

Top Songs D1 subsequently separated editorial presentation from evidence-backed
relationship truth:

- `artist_top_song_curations` is current presentation authority;
- historical `registry_entity_relationships` are preserved as relationship
  truth/lineage;
- the public Artist Top Songs list is not rebuilt from newly-resolved legacy
  `popular_track/top_song` relationships.

Therefore resolving a legacy relationship endpoint does **not** automatically
republish it as a Top Song.

Required regression invariant:

> Missing Artist Intake endpoint resolution may improve typed relationship
> identity but must not create or modify Artist Top Songs presentation unless the
> dedicated Top Songs authority is invoked separately.

### 6.4 Chart Artist Resolution: current workflow, stale identity model

The June-era Chart Artist Resolution product still exists and can create new
resolution decisions through
`admin_upsert_chart_artist_resolution_decision(...)`.

The workflow is therefore not dead solely because the 58 current decision rows
are all already resolved.

However, its current UI/model is stale relative to the accepted September Chart
authority.

Production Chart state:

- Chart entries: **1,800**;
- entries missing canonical Track: **0**;
- entries missing `artist_slug`: **0**;
- entries with `canonical_artist_id IS NULL`: about **1,700**.

The accepted current read authority
`chart_get_entry_registry_identity_v1(...)` derives current Artist identity
through:

```text
Chart entry
→ canonical Track
→ Registry Track↔Artist primary credit
→ canonical Artist slug
```

It does not require `wk_chart_entries_v2.canonical_artist_id` to be populated.

Against the exact accepted read semantics:

- 1,697 Chart rows currently have `artist_slug` matching the derived primary
  Artist slug;
- 91 have a slug mismatch requiring current projection review;
- 12 have no derived primary credit;
- 1,688 have a null legacy `canonical_artist_id` while a primary Track credit
  exists.

The old page currently labels a null `canonical_artist_id` as
`missing_canonical_artist`, creating a mass false-positive condition.

The old apply function also:

- directly inserts `registry_track_artists`;
- writes legacy Chart-specific credit source metadata;
- directly sets `wk_chart_entries_v2.canonical_artist_id`;
- directly edits Chart Artist projection fields.

Disposition:

**CURRENT / REBASE**

Action:

- stop treating `wk_chart_entries_v2.canonical_artist_id` as current Artist
  authority;
- base the UI's current identity state on the canonical Track's accepted
  Track↔Artist credits;
- make resolution decisions address real missing/ambiguous credit identity,
  not projection NULLs;
- route consequential Track↔Artist mutation through accepted reviewed credit
  authority;
- update Chart projection only as rebuildable projection;
- preserve historical Chart observation separately from current canonical
  identity.

### 6.5 Artist creation for decouple: current helper, obsolete implementation

`admin_create_registry_artist_for_decouple(...)` has two current callers:

- Chart Artist Resolution;
- Artist decouple.

Both current callers request `needs_review`.

The helper directly inserts a Registry Artist.

Disposition:

**CURRENT / REBASE AS THIN COMPOSITION**

Action:

- do not preserve a second Artist creation implementation;
- compose accepted `registry.artist.create` identity creation;
- apply only the domain-required reviewed lifecycle consequence;
- keep it narrow or replace the two call sites with a single current bounded
  command;
- introduce no generic lifecycle framework unless independent evidence proves
  recurrence.

### 6.6 Chart Artist alias resolution: stale monolith

`admin_resolve_chart_artist_alias(...)` currently performs four semantically
different jobs:

1. upserts an Artist alias;
2. bulk repairs Chart `artist_slug`;
3. rewrites canonical `registry_track_artists` based on alias slug;
4. tags non-active duplicate-looking Artists in metadata.

Later accepted architecture separated these concerns:

- Chart Artist projection is rebuildable from canonical Track credit;
- Track↔Artist credit mutation has typed governed authority;
- ordinary aliases are explicitly **not** identity lineage;
- true identity merge/split has dedicated lineage semantics.

Disposition:

**STALE MONOLITH / SPLIT AND RETIRE**

Action:

- replace the monolithic function with bounded alias decision authority;
- route any genuine Track-credit correction through current Track↔Artist
  authority;
- use current Chart projection synchronization rather than bulk alias-driven
  canonical mutation;
- route real duplicate Artist identity through reviewed merge/lineage authority
  instead of metadata tagging;
- retire the monolithic writer after caller cutover.

### 6.7 Direct browser Artist-alias mutation is an unclassified current bypass

The existing writer scanner discovers callable **functions** that mutate
`registry_artist_aliases`, but it does not prove table-level browser grants are
zero.

Current product code contains:

```text
src/pages/admin/registry/artist-aliases/page.tsx
→ supabase.from("registry_artist_aliases").delete().eq("id", id)
```

Production currently grants `authenticated`:

- INSERT: **true**;
- UPDATE: **true**;
- DELETE: **true**

on `registry_artist_aliases`, controlled by RLS.

No current Edge Function writer to `registry_artist_aliases` was found;
`public-content-read` only reads active aliases.

This is a real current identity-supporting browser DML bypass.

Hard deletion is also inconsistent with the standing preservation rule that
historical aliases and old values remain evidence.

Disposition:

**NEWLY DISCOVERED SLICE 3 BYPASS**

Action:

- replace physical browser alias delete with a bounded reviewed alias-state
  command;
- preserve historical alias evidence;
- revoke authenticated direct INSERT/UPDATE/DELETE after caller cutover;
- review service-role alias DML separately and retain only a demonstrated
  runtime dependency;
- extend the permanent exit verifier so table-level mutation grants cannot hide
  outside the function-writer inventory.

### 6.8 Admin Label and Genre detail pages contain stale direct writes but
Production already fails them closed

Current source still attempts:

- direct `registry_labels` UPDATE to archive a Label;
- direct `registry_genres` UPDATE to archive a Genre.

Later Admin Registry convergence already provides:

- `admin_patch_registry_label_profile_v1(...)`;
- `admin_patch_registry_genre_profile_v1(...)`.

Production authenticated table UPDATE privilege for both tables is currently
**false**.

So these source paths are stale but already fail closed.

Disposition:

**STALE CALLER / REMOVE OR REBASE**

Action:

- route those UI actions through the accepted Admin Registry profile commands;
- remove stale direct-table mutation code;
- keep authenticated Label/Genre direct mutation grants at zero.

No new primitive is required.

### 6.9 Track provider-link table grants are stale after governed provider-link
convergence

Production currently grants authenticated INSERT/UPDATE/DELETE on
`registry_track_provider_links`.

No current `src/` product writer to that table was found.

Later work has already accepted governed canonical provider-link admission,
including the Track Intake path.

Therefore the old table-level browser mutation grant is no longer justified by
current product code.

Disposition:

**STALE GRANT / RETIRE AFTER NEGATIVE CALLER PROOF**

Action:

- confirm no supported external/browser client depends on direct table DML;
- revoke authenticated direct INSERT/UPDATE/DELETE;
- preserve SELECT needed by current reads;
- require provider-link writes to use accepted governed authority.

### 6.10 Registry relationship-evidence table grants require closure review

Production currently grants authenticated:

- INSERT on `registry_relationship_evidence`;
- DELETE on `registry_relationship_evidence`;

through Institute management RLS.

Current repository product code was not found performing direct table mutation.

Typed SECURITY DEFINER relationship commands already own creation/review/merge
flows and attach/move relationship evidence through those reviewed operations.

Disposition:

**STALE-GRANT CANDIDATE — VERIFY THEN CONTRACT**

Action:

- freeze any legitimate non-product/external dependency;
- if none exists, revoke direct authenticated relationship-evidence mutation
  and keep evidence mutation behind typed relationship/review authority;
- do not delete historical evidence while contracting mutation authority.

This is part of #962 only because it is a current core Registry relationship
write road; broader Evidence redesign remains out of scope.

## 7. High-blast operations

### 7.1 Track duplicate repair

`admin_apply_registry_track_duplicate_repair(...)` remains a real Admin repair
capability.

Its algorithm currently reconciles/moves:

- Chart canonical Track projection;
- provider links;
- Track↔Artist credits;
- Release↔Track memberships;
- duplicate Track lifecycle;
- `registry_track_resolution_events`.

The accepted Identity Lineage contract already derives Track supersession from
successful `track_duplicate_repair` events, and current Production lineage is
complete for all 196 historical duplicate source identities.

Disposition:

**CURRENT HIGH-BLAST / INTERNALIZE**

Action:

- do not rewrite the mature multi-table repair algorithm into a speculative
  generic framework;
- place an immutable reviewed repair plan, expected-state fingerprint,
  short-lived exact grant, operation journal, row budget, and independent
  postcondition verifier in front of it;
- make the mutation engine private/non-product-executable;
- preserve the accepted `registry_track_resolution_events` event contract;
- verify Chart current identity after repair through canonical Track and current
  primary Artist credit.

This function is **not** the MIZIZI URL-cleanup target. It is only remaining
authority debt that must be closed before returning to that work.

### 7.2 Artist decouple

The current product uses:

`admin_apply_artist_decouple_decision(...)`

which delegates to:

`admin_decouple_registry_artist(...)`.

The lower-level mutator currently moves Track/Release Artist credits, updates
Chart projections, blocks the combined alias, optionally archives the source,
and emits `registry_audit_log.action='artist_credit_decoupled'`.

Identity Lineage already derives Artist split history from that event contract.
Current Production split lineage is complete.

Disposition:

- reviewed apply command: **CURRENT HIGH-BLAST / CONVERGE**;
- low-level mutator: **INTERNALIZE**.

Action:

- preserve the reviewed decision semantics;
- bind execution to exact frozen replacements and current state;
- make the low-level mutator private;
- preserve the accepted split-event/lineage contract;
- independently verify resulting Track/Release credits and current Chart
  projection against canonical credits.

### 7.3 Safe Artist merge

`admin_safe_merge_registry_artists(...)` is still called by the current Artist
Aliases admin product.

It updates aliases, Track credits, Release credits, Chart projections and source
Artist lifecycle, then writes `registry_artist_resolution_events` with
`action='artist_merge'`.

Identity Lineage already consumes that event contract. Current Production merge
lineage is complete.

Disposition:

**CURRENT HIGH-BLAST / INTERNALIZE**

Action:

- retain the mature repair algorithm unless a correctness defect is proven;
- bind it to immutable reviewed source/canonical identities, expected-state
  fingerprint and exact grant;
- make the mutation implementation private;
- independently verify credit/membership/projection/lineage postconditions;
- preserve the accepted Artist merge event contract.

### 7.4 Old manual Artist merge

`admin_merge_registry_artists(...)` has:

- no current `src/` caller found;
- no current database-function caller found.

PostgreSQL function-call counters cannot be used as traffic evidence because
Production has `track_functions=none`.

Disposition:

**CANDIDATE RETIRE**

Action:

- complete bounded external/runtime traffic evidence where available;
- preserve rollback source;
- retire executable authority if no dependency appears;
- add a permanent negative verifier proving it cannot be used as alternate
  canonical merge authority.

## 8. Current table-level browser mutation matrix

At audit time the 12 Registry tables covered by the canonical writer scanner
have the following authenticated mutation authority:

| Table | INSERT | UPDATE | DELETE | Audit decision |
|---|---:|---:|---:|---|
| `registry_artists` | no | no | no | keep zero |
| `registry_tracks` | no | no | no | keep zero |
| `registry_releases` | no | no | no | keep zero |
| `registry_track_artists` | no | no | no | keep zero |
| `registry_release_artists` | no | no | no | keep zero |
| `registry_release_tracks` | no | no | no | keep zero |
| `registry_artist_aliases` | **yes** | **yes** | **yes** | contract to zero |
| `registry_entity_relationships` | no | no | no | keep zero |
| `registry_relationship_evidence` | **yes** | no | **yes** | verify dependency, then contract if none |
| `registry_track_provider_links` | **yes** | **yes** | **yes** | contract to zero |
| `registry_labels` | no | no | no | keep zero; remove stale UI update |
| `registry_genres` | no | no | no | keep zero; remove stale UI update |

The final Slice 3 verifier must explicitly cover table grants as well as
callable mutation functions.

## 9. Corrected road classification

| Road | Classification | Closure action |
|---|---|---|
| Artist Claim creation | CURRENT / REBASE | governed Artist create + preserve Claim-specific reviewed lifecycle and representation |
| Existing-Artist Claim resolution | CURRENT / REBASE WITH CLAIM | preserve binding/representation semantics |
| Missing Artist Intake | CURRENT / REBASE + REPAIR | fix live schema incompatibility; governed create + alias + typed endpoint resolution |
| Chart Artist Resolution | CURRENT / REBASE | derive current identity from canonical Track credits; mutate credits through current authority |
| Artist creation for decouple | CURRENT / THIN COMPOSITION | remove second creation algorithm |
| Chart Artist alias resolution | STALE MONOLITH | split alias decision, credit correction, projection repair, duplicate identity semantics; retire old writer |
| Browser alias DML | CURRENT BYPASS | bounded alias state command + grant contraction |
| Label/Genre direct UI archive | STALE FAIL-CLOSED CALLERS | route to accepted admin profile commands |
| Track provider-link table DML grants | STALE GRANT | revoke after negative caller proof |
| Relationship-evidence direct DML grants | STALE-GRANT CANDIDATE | prove dependency, then revoke if none |
| Track duplicate repair | HIGH-BLAST / INTERNALIZE | exact reviewed operation around mature engine |
| Artist decouple apply | HIGH-BLAST / CONVERGE | exact reviewed operation |
| Low-level Artist decouple | INTERNALIZE | private engine only |
| Safe Artist merge | HIGH-BLAST / INTERNALIZE | exact reviewed operation around mature engine |
| Old manual Artist merge | RETIRE CANDIDATE | retire after dependency/traffic/rollback proof |

The programme is therefore **not eleven independent modernization jobs**.

## 10. Corrected implementation shape

Implementation should be staged by rollback boundary, not legacy function name.

### Tranche A — stale low/medium authority and caller repair

Scope:

- Artist Claim current-authority rebase;
- Missing Artist Intake runtime repair/rebase;
- Chart Artist Resolution current identity-model rebase;
- Artist creation helper convergence;
- split/replace `admin_resolve_chart_artist_alias(...)`;
- remove direct browser alias DELETE;
- introduce the smallest bounded alias admission/state authority actually needed;
- revoke authenticated alias mutation grants after caller cutover;
- remove/rebase stale Label and Genre direct archive callers;
- revoke authenticated provider-link DML after negative caller proof;
- decide and, if safe, contract relationship-evidence direct mutation grants;
- update permanent writer/grant verification.

Primitive rule:

- reuse existing Artist create, Track↔Artist credit, relationship endpoint,
  evidence, review, operation, grant, fingerprint, journal and verifier
  substrate;
- no new generic Registry mutation framework;
- no broad Artist lifecycle primitive merely for migration convenience;
- no generic alias framework unless the final implementation proves one narrow
  invariant is genuinely shared.

### Tranche B — high-blast exact containment and retirement

Scope:

- Track duplicate repair exact reviewed operation;
- Artist decouple exact reviewed operation;
- internalize low-level decouple;
- safe Artist merge exact reviewed operation;
- retire old manual Artist merge after proof;
- preserve identity-lineage event contracts;
- add current postcondition verification against Resource identity and Chart
  projection authority.

Do **not** rewrite mature repair algorithms merely to make them look like newer
code.

## 11. Preview, replay, and Mac use

Each tranche should use one coherent clean Preview/replay cycle, not one Preview
per function.

Native repository-versioned migration application remains required where the
repo migration authority requires `supabase db push --linked`. Connector/API
migration helpers must not be substituted for repository migration promotion.

Everything around that native apply should remain remotely prepared and
verified where possible.

Target Mac involvement:

- one deterministic native replay/apply command per coherent tranche;
- no exploratory Mac debugging loop;
- no repeated per-function migration sessions.

Existing replay/promotion scripts must be extended/consolidated before adding
new permanent tooling.

## 12. Permanent regression gates

Slice 3 must not close merely because the writer manifest reaches zero debt.

Current closure must mechanically prove:

1. no unclassified callable Registry mutation function;
2. zero remaining Slice-3 `keep_converge`,
   `retire_or_internalize`, or `candidate_retire` entries;
3. authenticated direct INSERT/UPDATE/DELETE is zero for canonical Registry
   mutation tables unless an explicitly documented non-canonical evidence
   exception survives this audit;
4. no stale `src/` direct-DML caller remains for a table whose grants are
   denied;
5. Artist Claim behavioral acceptance remains intact while direct identity
   creation is governed;
6. Missing Artist Intake can transactionally create/reuse identity, admit alias,
   resolve exact endpoints, complete review state, and roll back cleanly;
7. Missing Artist Intake cannot mutate Artist Top Songs presentation authority;
8. Chart Artist Resolution does not treat legacy
   `wk_chart_entries_v2.canonical_artist_id` NULLs as unresolved canonical
   Artist identity;
9. current Chart identity is consistent with canonical Track + primary
   Track↔Artist credit after resolution/merge/split/duplicate repair;
10. ordinary Artist aliases do not become identity lineage;
11. Artist merge/split and Track supersession event-to-lineage parity remains
    complete;
12. Registry Artist Resource identity/lifecycle parity remains complete;
13. private high-blast engines are not executable by `anon`,
    `authenticated`, or `service_role` unless a narrowly documented
    transport requirement proves otherwise;
14. exact grants return to zero at rest;
15. MIZIZI retains no standing autonomous Registry mutation authority.

## 13. Historical work that is reopened versus merely constrained

This audit does **not** declare entire closed programmes invalid.

It identifies specific stale current contracts:

- Artist Studio structural direct-insert assertion;
- Missing Artist Intake acceptance implementation and verifier;
- June Chart Artist Resolution identity assumptions;
- Chart alias monolith;
- direct alias table mutation;
- stale Label/Genre UI mutation callers;
- stale provider-link table grants;
- potentially stale direct relationship-evidence grants.

Later foundations that remain healthy are constraints, not reopen targets:

- Resource identity;
- Identity + Projection Lineage;
- Top Songs D1 presentation authority;
- governed Chart materialization;
- Track Intake convergence;
- shared review/evidence/exact-grant kernel.

## 14. Return to the actual MIZIZI cleanup work

Slice 3 is a blocker, not the product destination.

Current Production URL-hygiene backlog remains:

- active Tracks: **2,101**;
- open MIZIZI Track slug review cases: **66**;
- active Releases: **841**;
- active Release slugs carrying provider packaging
  `-(single|ep|album)`: **739**;
- active Release titles carrying provider packaging: **738**.

Already accepted governed operations include:

- `registry.track_slug.canonicalize/v1`;
- `registry.release_slug.canonicalize/v1`;
- `registry.release_taxonomy.repair/v1`;
- `registry.chart_track_slug.synchronize/v1`.

After #962 closes, work returns immediately to canonical Track/Release URL
identity cleanup, including removing non-identity/provider/credit noise while
preserving redirects, provenance and culturally meaningful titles/version
labels.

Track duplicate repair is not that URL-cleanup programme.

## 15. Deployment classification

This audit itself authorizes **no Production mutation**.

- SQL migration needed now: **No**
- Edge Function deploy needed now: **No**
- frontend deploy needed now: **No**
- Production Finish needed now: **No**
- Preview needed for this audit: **No**
- Mac needed for this audit: **No**
- Production mutation authorized by this audit: **No**

The next mutation-bearing work must begin only after this audit is accepted as
the current #962 planning authority.
