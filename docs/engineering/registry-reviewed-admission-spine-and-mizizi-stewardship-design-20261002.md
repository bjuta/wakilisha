# Registry Reviewed Admission Spine and MIZIZI Stewardship Expansion

Date: 2 October 2026

Status: **PRODUCTION-DEPLOYED BASELINE — RETRY-AUTHORITY FOLLOW-UP PREVIEW-ACCEPTED**

Initial implementation branch: `fix/discography-review-publication-convergence`

Initial canonical forward migration authority:
`supabase/migrations/20261002162223_discography_review_publication_convergence_v1.sql`

4 October 2026 follow-up branch:
`fix/discography-atomic-admission-slug-collision`

Follow-up canonical migration authority:
`supabase/migrations/20261004072423_discography_atomic_reviewed_admission_collision_recovery_v1.sql`

Base protected-main authority:
`3b952c00ea7f59c3c2a2ef76258709f20e7cbeea`

Companion authorities:

- `docs/engineering/mizizi-slice2-registry-materialization-primitives-design.md`
- `docs/engineering/mizizi-slice2-discography-exact-set-authority-design.md`
- `docs/engineering/mizizi-slice3-track-intake-authority-convergence.md`
- `docs/registry/MIZIZI_CULTURAL_DATA_STEWARD.md`
- `docs/engineering/mizizi-registry-authority-ledger.md`

## 1. Decision

WAKILISHA will converge reviewed provider ingestion onto a reusable **Reviewed Registry Admission Spine**.

The spine is not a generic CRUD framework and does not erase domain semantics.

It standardizes the governance mechanics that now recur across Discography, Track Intake, Charts, provider enrichment, future label/distributor catalogue ingestion, and later Recording/Work ingestion:

`observe → review → freeze → execute typed operations → verify terminal invariants → finalize`

The governing principle remains:

> **Do not primitive the culture. Primitive the governance.**

Provider adapters, cultural interpretation, identity resolution rules, credit semantics, rights semantics, and domain-specific frozen-plan builders remain domain-owned.

Evidence lineage, exhaustive review, exact grants, lifecycle transitions, terminal verification, receipts, kill switches, and stewardship become shared Registry governance primitives.

## 2. Incident that earned this abstraction

A real Production Discography ingest on 2 October 2026 exposed three failures that were individually internally consistent but collectively violated the product contract.

### 2.1 Observation succeeded

The immutable Apple Music provider snapshot captured rich source evidence including:

- provider Release and Track identifiers;
- Release title and provider Release type;
- UPC;
- release date;
- label;
- genre names;
- artwork and provider URLs;
- Track title and sequence;
- ISRC;
- duration;
- explicit flag;
- preview URL;
- related Artist/provider identifiers.

The evidence-capture layer therefore did not lose the provider observation.

### 2.2 Human review was syntactically present but semantically hollow

The Admin Discography drawer initialized every observed Release to an accepting action:

- existing match → `merge`;
- new match → `canonicalize`.

The real reviewed plan recorded all seven observed Releases as `canonicalize` and none as `ignore`, despite the administrator not having explicitly decided those seven outcomes one by one.

A backend `approved=true` guard is not meaningful human review when the client pre-approves the candidate set.

### 2.3 Apply succeeded without achieving the product terminal state

The governed execution chain successfully created draft Release/Track identities, provider facts, exact Release membership and credit relationships, and a verifier-passed parent Discography receipt.

However, newly created Tracks remained `draft`.

The Release page therefore had zero resolvable active Track members and correctly returned:

`release_has_no_dedicated_public_page`

Editorial Track/Release insertion also correctly excluded the newly ingested rows because those search surfaces use active Registry identities.

The downstream readers were not the defect.

The defect was that the ingest workflow declared success before its admitted Registry state reached the lifecycle state the product expected.

### 2.4 Release identity creation still admitted provider packaging into canonical slugs

Release Create V1 derived its slug from the raw title plus Artist slug.

A provider title such as:

`60 seconds (RB60s) - EP`

therefore generated:

`60-seconds-rb60s-ep-sofresh-254`

even though WAKILISHA had already earned deterministic MIZIZI knowledge that provider packaging such as `- EP`, `- Single`, and `- Album` does not belong in canonical Release URL identity when the structural Release type proves the packaging.

Historical cleanup authority had not yet been fed back into the creation boundary.

## 3. Binding product contract: Apply means active ingest

The current Discography product has one ingestion mode:

**Apply = admit the reviewed selection into active Registry truth.**

For this workflow:

- draft may exist as an internal materialization state between identity creation and lifecycle activation;
- draft is not a successful terminal outcome;
- accepted new Releases must finish active;
- accepted new Tracks must finish active;
- accepted existing identities remain governed by the exact reviewed changes;
- rejected/left candidates must not be canonically mutated merely because they appeared in provider evidence.

If WAKILISHA later wants an **Ingest to Draft** product mode, that must be introduced as a separate explicit control with a separately frozen terminal-state policy.

The system must never infer draft mode from an incomplete workflow.

## 4. Primitive A — immutable provider observation

Provider observation is evidence, not truth.

A provider adapter may capture all source facts needed for later review, but recording the observation must not imply canonical admission.

The observation primitive must preserve:

- provider/source identity;
- acquisition timestamp;
- source payload fingerprint;
- normalized observation required by the domain;
- immutable evidence lineage;
- the exact principal/workflow that acquired the observation where applicable.

Provider-specific payload interpretation stays in provider/domain adapters.

The shared primitive is immutability and provenance, not one universal provider schema.

## 5. Primitive B — exhaustive reviewed decision set

Every candidate in a reviewed observation must receive exactly one explicit decision before an Apply workflow can execute.

For Discography the decision vocabulary is:

- **Merge** — admit the provider Release into one exact existing canonical Release;
- **Add** — create/admit one new canonical Release;
- **Leave** — retain the provider observation as evidence but perform no canonical admission for that Release.

No decision is selected by default.

Unset is not Leave.

Missing candidates are not silently skipped.

Duplicate decisions for one candidate are invalid.

A review is executable only when the decision set is an exact partition of the observed candidate set.

**Leave all** is a valid review and must produce zero canonical music mutations while retaining the evidence and review receipt.

The reusable primitive is exhaustive decision-set integrity. The allowed decision vocabulary remains domain-specific.

## 6. Primitive C — canonical identity derivation

Provider presentation text and canonical Registry identity must be separate concepts.

Canonical identity derivation must be shared by:

- preview;
- collision detection;
- creation planning;
- creation execution verification;
- MIZIZI analysis;
- public routing identity;
- future reconciliation.

There must not be one cleanup rule in TypeScript, another in SQL, and a third in a later repair runner.

### Release packaging rule

Where provider evidence structurally proves Release type, canonical Release URL identity may strip matching provider packaging suffixes such as:

- `- Single`;
- `- EP`;
- `- Album`;
- other packaging classes only where the accepted rule explicitly supports them.

The original provider title remains preserved as evidence and may remain the canonical display title unless separate reviewed title authority justifies changing the title itself.

Slug identity cleanup does not authorize culturally meaningful title rewriting.

### Artist-scoped Release slug invariant

The live Registry schema does **not** impose global uniqueness on `registry_releases.slug`, and the canonical public Release route already carries Artist scope:

`/releases/{artist-slug}/{release-slug}`

Therefore canonical Release slug identity must not redundantly append the Artist slug inside `release-slug`.

For a structurally proven provider title:

`60 seconds (RB60s) - EP`

the canonical Release slug candidate is:

`60-seconds-rb60s`

not:

`60-seconds-rb60s-ep-sofresh-254`

and not:

`60-seconds-rb60s-sofresh-254`.

Collision analysis for title-derived Release slugs is Artist-scoped. The same clean Release slug may legitimately exist for different primary Artists.

UPC/provider identity and exact Artist-scoped Release relationships remain stronger identity evidence than slug alone.

This converges new creation with the historical MIZIZI Release-slug stewardship direction rather than creating a second URL grammar.

### Artist-scoped Track slug invariant

The same route-scoping rule applies to Tracks.

Canonical public Track routes are Artist-scoped:

`/tracks/{artist-slug}/{track-slug}`

Discography must therefore not create Track slugs that redundantly append the Artist slug inside `track-slug`.

The affected 2 October ingest proved the current stale path still produced values such as:

- `jiji-sofresh-254`;
- `sheng-sofresh-254`;
- `254-sofresh-254`;
- `nairobi-a-z-sofresh-254`.

For the reviewed admission path, the canonical Track slug candidate is the clean recording-title identity within Artist scope, subject to the existing Track collision/recording-identity rules.

This does not authorize collapsing genuinely distinct recordings that share a title. ISRC, reviewed credits, recording identity evidence, and collision policy continue to control identity resolution.

The first Discography consumer must therefore converge both new Release and new Track slug creation onto the already-earned artist-scoped public-identity model before activation.

## 7. Primitive D — frozen typed admission plan

A reviewed domain workflow converts one immutable observation plus one exhaustive review decision set into one immutable typed operation graph.

The frozen plan binds:

- observation/evidence identity;
- reviewer/principal;
- review decisions;
- exact canonical subjects;
- exact operation ordering/dependencies;
- expected current-state fingerprints;
- exact relation sets;
- lifecycle target;
- idempotency keys;
- operation-family/ruleset versions;
- terminal postconditions.

Discography remains responsible for constructing a Discography plan.

Track Intake remains responsible for constructing a Track Intake plan.

The shared primitive is the frozen graph and its integrity rules.

This is not a universal business-rules engine.

## 8. Primitive E — Registry lifecycle transition core

Lifecycle transitions recur enough to justify a shared internal primitive.

Public/domain commands remain typed and semantic, for example:

- `registry.track.activate/v1`;
- `registry.release.activate/v1`;
- future typed lifecycle commands only when their domain need is proven.

Those commands should compose one shared internal lifecycle executor/verifier contract that proves:

1. the exact allowed before-state;
2. the exact requested after-state;
3. one exact subject;
4. the evidence and reviewer lineage;
5. the expected-state fingerprint;
6. no unrelated canonical field mutation;
7. exact affected-row budget;
8. one canonical write event;
9. independent after-state verification;
10. semantic idempotency.

Do not expose a vague arbitrary `registry.entity.set_status` mutation API.

Primitive the lifecycle governance mechanics while preserving entity-specific typed commands and preconditions.

## 9. Primitive F — terminal workflow invariant verifier

A workflow receipt must mean more than "every SQL child returned success."

Before a parent workflow may finalize, it must verify the declared terminal product invariants.

For current active Discography ingest, those invariants include at minimum:

- every Add decision has one exact canonical Release identity;
- every accepted Track identity exists;
- accepted Release↔Track membership matches the reviewed exact set;
- required reviewed Artist credits are present;
- provider facts admitted by the plan match the frozen evidence;
- every accepted new Track is active;
- every accepted new Release is active;
- every Leave decision produced no canonical admission for that candidate;
- no unreviewed observation escaped into canonical truth;
- no expected child operation remains unverified;
- accepted active Track/Release identities satisfy the ordinary downstream Registry search contract;
- public Release topology is resolvable where the accepted taxonomy grants a dedicated Release page.

The terminal verifier is allowed to reject parent finalization even when all lower-level mutation operations independently succeeded.

This is intentional.

A valid identity creation is durable history; an incomplete workflow is still an incomplete workflow.

## 10. Downstream systems remain strict

Public readers and editorial selectors must not compensate for incomplete Registry admission.

Do not:

- expose draft Tracks publicly to hide ingestion failure;
- make editorial insert search include unfinished draft identities;
- treat a draft Release as active merely because provider metadata exists;
- synthesize lifecycle completion in a read path.

Downstream surfaces should continue to consume the canonical lifecycle contract.

The ingestion/finalization path owns convergence to that contract.

## 11. MIZIZI becomes the standing Registry integrity steward

MIZIZI's mandate expands from bounded data-hygiene rules into a permanent Registry stewardship control plane.

MIZIZI is not a competing source of truth.

MIZIZI is the entity responsible for continuously asking:

> Does current Registry state still satisfy WAKILISHA's accepted identity, evidence, relationship, lifecycle, provenance, and public-integrity contracts?

MIZIZI should become maximally powerful in **observation, diagnosis, planning, verification, and orchestration**.

Canonical mutation remains typed and governed.

## 12. MIZIZI standing powers

The following powers should be available to MIZIZI continuously without a bespoke project for each audit:

### 12.1 Corpus-wide read authority

MIZIZI may inspect all canonical Registry state, relationship state, evidence/provenance state, operation journals, review state, projection state, and public-integrity projections necessary to assess accepted rules.

This is read authority, not arbitrary write authority.

### 12.2 Continuous invariant audit

MIZIZI may execute all accepted deterministic audit rules over the full corpus and over changed entities after relevant operations.

Examples include:

- identity slug integrity;
- Release taxonomy;
- Release/Track lifecycle consistency;
- orphan/dangling relationships;
- exact-set relationship drift;
- provider-link integrity;
- public-route resolvability;
- canonical/public projection drift;
- contributor/provenance integrity;
- duplicate/collision risk;
- writer-authority drift.

### 12.3 Finding classification

Every finding should be machine-classified as one of:

- `observe`;
- `review`;
- `auto_fix_candidate`;
- `workflow_blocker`.

The classification must name:

- rule ID/version;
- entity/subject;
- current state;
- proposed/expected state where applicable;
- evidence;
- confidence;
- blast radius;
- mutation family if one exists;
- verifier required;
- reason the finding is or is not autonomously actionable.

### 12.4 Review materialization

MIZIZI may create bounded review work from already-classified `review` findings without mutating canonical Registry truth.

Review creation must be idempotent and preserve evidence lineage.

### 12.5 Admission/finalization sentry

MIZIZI should be callable as a deterministic pre-finalization and post-execution sentry.

A domain workflow may ask MIZIZI to evaluate the frozen plan/result against accepted cross-cutting Registry invariants.

MIZIZI may block finalization when it detects an accepted invariant violation.

This gives MIZIZI real stewardship power without giving it permission to rewrite the Registry arbitrarily.

### 12.6 Repair planning

MIZIZI may compile exact repair plans from deterministic findings using existing typed operation families.

A repair plan must be:

- explicit;
- fingerprinted;
- target-bounded;
- evidence-bound;
- verifier-bound;
- idempotent;
- kill-switchable.

Planning does not itself authorize execution.

### 12.7 Authority drift monitoring

MIZIZI should continuously inspect the machine-readable privileged-writer manifest and Registry operation vocabulary.

A new privileged writer, unclassified mutation road, unexpected browser/service-role path, missing verifier, or reintroduced retired authority should become a control-plane failure rather than institutional memory.

## 13. MIZIZI earned mutation autonomy

MIZIZI may autonomously execute only operation families whose autonomy has been explicitly earned.

An operation family may become MIZIZI-autonomous only when all of the following are true:

- the rule is deterministic;
- the evidence contract is explicit;
- ambiguity is fail-closed;
- target scope is bounded;
- collision/state locking is implemented;
- semantic idempotency is implemented;
- a typed operation exists;
- an independent verifier exists;
- canonical write causality is exact;
- rollback/reconciliation behavior is understood;
- Preview/Production acceptance has proven the family;
- the operation can be independently disabled;
- the accepted autonomy policy names the exact rule/operation version.

Even then:

- standing broad table-write authority is forbidden;
- arbitrary SQL is forbidden;
- mutation must use the typed operation surface;
- mutation windows may be JIT/bounded;
- no stale grant may remain usable at rest.

MIZIZI should have maximum **capability to request and orchestrate safe authority**, not maximum ambient database privilege.

## 14. Things MIZIZI must never do autonomously

MIZIZI must not:

- invent cultural facts;
- infer creator rights, ownership, splits, or legal authority from weak evidence;
- silently choose among genuinely ambiguous identities;
- overwrite disputed human assertions;
- rewrite culturally meaningful titles merely because provider packaging looks noisy;
- create a new mutation family and self-authorize it;
- bypass human review for a rule that has not earned autonomy;
- use service-role breadth as a substitute for typed authority;
- mutate canonical tables directly outside the accepted Registry command/control plane.

High blast-radius or culturally ambiguous findings become review work.

## 15. MIZIZI and human authority

The long-term operating model is:

- humans decide ambiguous cultural meaning;
- domain workflows capture explicit product decisions;
- typed Registry commands own canonical state transitions;
- independent verifiers prove the transitions;
- MIZIZI watches the whole system, detects drift, blocks invalid finalization, proposes/executes earned repairs, and keeps the Registry within accepted invariants.

Admin should increasingly become the exception handler, not the person manually repairing deterministic integrity defects.

MIZIZI should increasingly become the system that notices, explains, plans, and safely resolves those defects.

## 16. First implementation consumer: Discography

The already-minted migration

`20261002162223_discography_review_publication_convergence_v1.sql`

is the first implementation consumer of this design.

This migration/branch should implement only the primitive surface already earned by the incident and existing repetition:

1. exhaustive Discography review-set validation;
2. no default Admin selection;
3. explicit Merge / Add / Leave decisions for every observed Release;
4. clean canonical Release identity derivation using accepted packaging semantics;
5. shared internal lifecycle transition core where practical without breaking existing Track Intake authority;
6. `registry.release.activate/v1`;
7. Discography composition of existing `registry.track.activate/v1`;
8. active-ingest terminal policy;
9. parent Discography finalization that fails closed unless terminal invariants pass;
10. permanent end-to-end acceptance proving accepted provider recordings become active and ordinary downstream Registry consumers can immediately resolve them;
11. governed reconciliation of the real 2 October 2026 affected ingest from preserved evidence and explicit fresh review.

It must not:

- weaken public/editorial readers;
- hand-update the affected Production rows;
- create a second parallel Track activation concept;
- rewrite Track Intake in the same change merely to make the abstraction look broad;
- run a corpus-wide historical cleanup unrelated to the affected ingest;
- change the accepted migration filename.

## 17. Next convergence consumers

After the Discography consumer is Production accepted, converge additional workflows only where the shared primitive removes real duplication.

Priority order:

1. Track Intake lifecycle/finalization internals;
2. Chart/provider reviewed admission where human decisions are required;
3. Artist/provider enrichment review-set integrity;
4. future label/distributor catalogue ingestion;
5. Recording/Work contributor/provenance ingestion where the evidence/review mechanics match.

Each convergence is a guarded consumer migration, not a big-bang framework rewrite.

## 18. Today’s affected ingest

The 2 October 2026 provider snapshot is evidence and must be preserved.

The auto-filled review decisions are not sufficient human authority to activate all observed Releases.

The corrected workflow must allow the administrator to reopen/review the affected observed Releases and explicitly choose Merge / Add / Leave.

For accepted items:

- reuse unambiguous already-created draft identities where exact provider/Registry identity proves they are the same;
- do not create duplicates;
- canonicalize dirty Release URL identity through governed authority;
- preserve original provider title evidence;
- complete required relationships/provider facts;
- activate accepted Releases and Tracks;
- verify terminal invariants;
- make the accepted active identities available to normal public/editorial consumers.

For Leave decisions:

- retain the observation/evidence;
- do not activate or otherwise promote the candidate merely because a draft shell was previously created by the defective run;
- any already-created draft shell requires an explicit reconciliation disposition rather than silent deletion.

## 19. Acceptance contract

This design cannot close on unit tests alone.

Preview acceptance must prove at least:

- observation captures the complete bounded provider metadata contract;
- UI starts with every Release undecided;
- Apply is disabled while any observed Release is undecided;
- Leave all is valid and creates no canonical music mutation;
- partial/missing backend decisions fail closed;
- duplicate decisions fail closed;
- Add produces clean canonical Release identity;
- provider title evidence remains preserved;
- accepted new Tracks transition draft → active through typed authority;
- accepted new Releases transition draft → active through typed authority;
- unrelated canonical fields remain unchanged during lifecycle transition;
- exact Release membership and Artist credits match the frozen review;
- rejected candidates are not admitted;
- parent apply cannot pass before all required child verifiers pass;
- parent apply cannot pass when an accepted subject remains draft;
- ordinary editorial Track search resolves an accepted active Track;
- ordinary editorial Release search resolves an accepted active Release;
- public Release route succeeds for an accepted EP/Album with resolvable active Track membership;
- Single behavior continues to resolve under the accepted public Single policy;
- dirty provider-packaged Release slug is not newly created;
- idempotent replay does not duplicate identities, relationships, evidence, or lifecycle events;
- zero active exact execution grants remain at rest;
- MIZIZI pre/post sentry produces no blocker for the accepted fixture;
- rollback fixtures leave no canonical residue.

Production acceptance must include one real provider-reviewed ingest, not synthetic proof only.

## 20. Non-goals

This design does not authorize:

- generic arbitrary workflow engines;
- generic Registry CRUD;
- broad standing MIZIZI write access;
- automatic title rewriting;
- automatic rights/provenance inference;
- replacement of domain-specific provider adapters;
- replacement of domain-specific cultural review;
- weakening downstream lifecycle filters;
- reopening already accepted historical MIZIZI operations.

## 21. Architectural summary

WAKILISHA should not have separate meanings of "reviewed", "applied", "active", and "successful" for every ingestion surface.

The durable split is:

- **domain-specific evidence and cultural decisions**;
- **shared governance mechanics**;
- **typed canonical state transitions**;
- **terminal product invariants**;
- **MIZIZI as the permanent cross-cutting steward**.

The desired steady state is:

`provider/source evidence`

→ immutable observation

→ exhaustive human/domain review where required

→ frozen exact plan

→ typed Registry operations

→ independently verified lifecycle/relationship state

→ MIZIZI invariant clearance

→ finalized workflow receipt

→ ordinary public/editorial consumers require no repair knowledge.

That is the direction for ten-year Registry infrastructure.


## 22. 4 October Production acceptance correction

The first real explicit SoFresh 254 re-review proved the baseline spine worked far enough to expose a deeper orchestration edge case rather than hiding it.

The administrator explicitly reviewed all seven observed Releases as:

- 6 Merge;
- 0 Add;
- 1 Leave.

The accepted `60 seconds (RB60s) - EP` identity successfully converged to the clean Artist-scoped slug `60-seconds-rb60s`, its four Tracks became active, and the one Left Release remained draft.

The same Apply exposed two additional invariants that are now binding.

### 22.1 Sibling Release collision rule

Two genuinely distinct SoFresh 254 Releases exist:

- `254 Riddim` — Album;
- `254 Riddim - Single` — Single.

Both normalize to the clean base slug `254-riddim`.

Provider packaging is still not canonical identity noise by default. However, structural type becomes a legitimate **disambiguator only when the clean Artist-scoped base is already occupied by a distinct sibling identity**.

The durable allocation rule is therefore:

1. preserve an already-owned clean base route when it is an exact existing sibling identity;
2. for a new collision group with no existing base owner, deterministically choose one base owner from the reviewed accepted set;
3. use structural `-album`, `-ep`, or `-single` only when required to distinguish a genuine sibling;
4. if type still collides, use release date;
5. if date still collides, use the immutable provider Album identifier as the final deterministic fallback;
6. never reintroduce Artist-name suffix noise as a collision workaround.

For the real Production pair, the already-active Single keeps `254-riddim` and the Album recovery target is `254-riddim-album`.

### 22.2 Apply must be atomic across canonical children and parent finalization

The first implementation caught each child exception independently and continued later children.

That allowed later lifecycle operations to activate accepted Tracks/Releases even after one earlier Release identity-reconciliation child failed. Because the error list was then non-empty, the parent `registry.discography.apply` operation was not created, so the MIZIZI terminal sentry never received a parent finalization opportunity.

That is not an acceptable reviewed-admission contract.

The corrected contract is:

- immutable observation and exhaustive reviewed plan may survive a failed Apply;
- every canonical mutation child, exact grant, operation receipt, write event, lifecycle transition, and parent finalization must execute inside one savepoint-bounded canonical admission transaction;
- the first child failure aborts the canonical batch;
- a MIZIZI parent veto aborts the canonical batch;
- the caller receives one bounded error receipt;
- no partial canonical music state or mutation-operation residue may escape the failed Apply;
- Retry must always use a fresh planner-version fingerprint when the planner policy changed.

### 22.3 Active dirty Release recovery is typed authority

A partially activated Release from the defective run cannot be repaired by pretending it is still a draft.

The follow-up introduces a dedicated human-reviewed typed operation:

`registry.release.identity.reconcile/v1`

with capability:

`reconcile_registry_release_identity`

It may reconcile one exact active Release slug while preserving lifecycle state, only when:

- the current user holds `manage_registry`;
- immutable provider evidence and reviewed-plan authority are exact;
- the target state fingerprint is current;
- the new Artist-scoped slug is deterministic under the reviewed collision allocator;
- the target is one exact Release;
- the independent verifier proves the final active identity and canonical write causality.

MIZIZI does not receive standing mutation authority for this operation. It remains the terminal invariant steward and may block parent finalization.

### 22.4 Follow-up acceptance additions

The follow-up cannot close unless Preview proves all of the following in rollback-only behavioral acceptance:

- two reviewed sibling Releases sharing one clean base receive distinct deterministic Artist-scoped slugs;
- a real active dirty Release can recover through `registry.release.identity.reconcile/v1`;
- the existing clean sibling route is preserved;
- a late identity collision after plan freeze causes Apply failure;
- all earlier canonical children from that failed Apply are rolled back;
- the immutable reviewed plan remains preserved;
- no mutation-operation receipts from the failed canonical batch remain;
- MIZIZI finalization remains reachable only after every canonical child verifier has passed.

## 23. 4 October reviewed Retry authority correction

Production acceptance of the atomic/collision follow-up reached the corrected
planner and created a fresh planner-v3 / `active_ingest_v2` immutable review
plan for the preserved SoFresh 254 decision set. Canonical Apply then stopped
before mutation because the shared Registry review seal attempted to append a
second approved decision directly onto an already-effective review case.

The failure proved a separate retry-authority invariant:

- a planner-version retry must not erase or mutate the original human decision;
- a fresh exact grant for the same human, evidence assertion, typed operation,
  and exact subject may replace the prior approval only after the prior exact
  grant is terminal;
- replacement uses the existing append-only review lifecycle:
  `decision → supersede → reopen → decision`;
- a prior active grant may never be superseded by this retry path;
- reviewer principal, evidence assertion, actor, operation key/version, and
  exact target authority must remain matched;
- no client role receives direct authority over the private review seal.

The correction is branch:

`fix/discography-review-retry-authority`

with canonical generated migration:

`20261004100745_discography_review_retry_authority_v1.sql`

The migration narrows the existing
`platform_private.seal_registry_execution_grant_review_v1()` trigger function.
For `registry_discography_admin` reviewed-plan retries only, an already-effective
approved case may advance through `supersede → reopen` before the new exact
approval is sealed when the bound prior grant is terminal and the same human,
evidence, actor, and typed operation authority still match.

### 23.1 Preview acceptance

A fresh disposable Preview branch was created from Production and rebased until
its baseline ledger reached exactly 200 migrations with head
`20261004072423_discography_atomic_reviewed_admission_collision_recovery_v1`.

The canonical repository migration replay then proved:

- native pre-apply migration list: only
  `20261004100745_discography_review_retry_authority_v1.sql` pending;
- native `supabase db push --dry-run --linked`: exactly that file pending;
- native `supabase db push --linked`: PASS;
- native post-apply dry-run: remote database up to date;
- final Preview ledger: local and remote both
  `20261004100745_discography_review_retry_authority_v1`;
- `MIZIZI_SHARED_REVIEW_AUTHORITY_PASS`;
- `REGISTRY_DISCOGRAPHY_AUTHORITY_V1_PASS`;
- `DISCOGRAPHY_RETRY_REVIEW_SEAL_PASS`.

Rollback-only behavioral acceptance then exercised the real shared review
relations and trigger path:

1. one exact human-approved Discography grant sealed the first decision;
2. that grant became terminal (`consumed`);
3. a second exact grant for the same human/evidence/operation/subject was
   issued with a new reviewed-plan identity;
4. the case history converged exactly to
   `decision → supersede → reopen → decision`;
5. the second decision became the one effective approval;
6. the first approval remained immutable historical causality and was no
   longer effective;
7. rollback left zero surviving auth-user, evidence, or execution-grant
   fixtures.

This closes the review-authority defect discovered by the real SoFresh 254
retry without widening MIZIZI, client, or ambient Registry mutation authority.
