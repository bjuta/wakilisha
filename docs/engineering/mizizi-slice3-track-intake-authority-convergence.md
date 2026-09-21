# MIZIZI Slice 3 — Track Intake Canonical Authority Convergence

Date: 21 September 2026

Status: IMPLEMENTATION AUTHORITY FREEZE

Issue: #962

Base merged-main authority: `01c0e5404230dbf320c8cd1a8f46ef5d0c2743a8`

Branch: `fix/slice3-track-intake-create-authority`

## Decision

The coupled Track Intake canonicalization road must converge as one product workflow while preserving separately durable Registry operations.

Current public commands:

- `admin_create_registry_track_from_intake_enriched(uuid,text,text)`
- `admin_resolve_registry_track_intake_enriched(uuid,uuid,text,boolean)`

remain legitimate human-reviewed product actions, but their direct canonical Registry mutation must be retired.

The replacement keeps the same one-click admin experience while orchestration moves to separate caller-JWT RPC transactions.

## Why one replacement RPC is forbidden

PostgreSQL executes one RPC function call in one transaction.

If Track identity creation, Artist credits, enrichment, activation and workflow finalization were merely wrapped in one replacement SECURITY DEFINER function, a later failure would roll back earlier Registry operation journals and canonical receipts.

That would violate the accepted materialization doctrine:

- identity creation is independently durable;
- later fact failure does not erase proven identity history;
- every cultural fact transition retains its own exact grant, operation, canonical write event and verifier.

Therefore the frontend/service layer must orchestrate the governed steps across separate transactions.

## Accepted workflow

### New Track

1. validate the reviewed Track Intake suggestion and freeze the exact review snapshot;
2. execute `registry.track.create/v2` through a Track-Intake-specific caller-bound broker;
3. execute one `registry.track_artist_credit.admit/v1` per reviewed resolved Artist credit;
4. admit provider-neutral reviewed Track/Release enrichment through narrow typed operations;
5. activate the draft Track through `registry.track.activate/v1` only after required reviewed credits and enrichment preconditions pass;
6. finalize Track Intake workflow state and downstream playlist/contribution bookkeeping.

### Existing Track

1. validate the reviewed Track Intake suggestion and selected active Registry Track;
2. admit provider-neutral reviewed Track/Release enrichment through the same typed enrichment authority;
3. finalize Track Intake workflow state and downstream bookkeeping.

No identity creation or activation occurs for an existing active Track.

## Actor

New broker actor:

`registry_track_intake_admin`

Requirements:

- actor kind: automation transport identity;
- executor binding: PostgREST `authenticator`;
- required human capability: `manage_registry`;
- grants are caller-bound to `auth.uid()`;
- no standing MIZIZI grant;
- no `service_role` public execution.

The broker may issue only the operation versions explicitly listed in this design.

## Reused operations

Preserve the accepted operation family without rewriting established history:

- `registry.track.create/v1` remains frozen for existing Chart/Discography semantics;
- `registry.track.create/v2` is the Track Intake route-identity extension with an explicit evidence-bound reviewed slug;
- `registry.track_artist_credit.admit/v1` remains the accepted credit operation.

V2 is a versioned semantic extension of Track creation, not a new generic CRUD family.

Track Intake must not borrow the Chart actor or Discography actor.

## Credit provenance compatibility

The current shared materialization core writes Track↔Artist credit `source='chart_admission'` even though the executor accepts an actor key.

Track Intake must not rewrite the accepted Chart V1 executor merely to change provenance. Instead, a Track-Intake-specific executor will execute the same `registry.track_artist_credit.admit/v1` contract for the `registry_track_intake_admin` actor and persist `source='track_intake_review'`. Existing Chart receipts remain untouched.

## Artist-credit authority implementation

Track Intake reuses `registry.track_artist_credit.admit/v1` exactly rather than adding a new credit operation type.

Each reviewed source credit row gets its own deterministic future canonical credit UUID and its own caller-bound exact grant. The Track Intake executor preserves the accepted V1 plan/verifier contract while writing `source='track_intake_review'`; the existing Chart executor and historical `source='chart_admission'` receipts remain untouched.

The credit evidence trust class is `INTERNAL_FACT` because the relationship is a governed human review decision. The immutable review snapshot remains the source fingerprint. An identical retry re-enters the same succeeded operation; changed review state rejects the old grant with a non-retryable integrity error.

## Lifecycle operation

Add:

`registry.track.activate/v1`

This is required because `registry.track.create/v1` and `/v2` are deliberately draft-only and legacy Track Intake canonicalization intentionally produces an active Track.

Contract:

- subject: one existing Track;
- current status must be `draft`;
- final status: `active`;
- exact expected Track state fingerprint required;
- exact reviewed Track Intake evidence required;
- all reviewed Track Intake Artist credits must already exist, be active, and match the reviewed credit set;
- one Track row maximum;
- human approval required;
- independent verifier required;
- no enrichment fields or arbitrary metadata may be written by activation.

Activation is lifecycle authority, not identity creation or enrichment.

## Existing-Track reviewed-credit reconciliation

Existing canonical Tracks do not use the draft-Track credit-admit path and do not use Discography exact-set replacement. The accepted Discography exact-set operation is Apple Music-specific and complete-set replacement would be stronger than legacy Track Intake semantics.

Track Intake therefore adds `registry.track_artist_credit.reviewed_reconcile/v1`, a one-source-credit operation over an existing active Track. It binds the current Track state, current live/reviewable candidate relation state, the exact reviewed source credit, and the immutable review fingerprint.

The operation has three outcomes: insert one missing reviewed relation, update one unambiguous live/reviewable relation, or record a verified no-op when canonical semantic fields already match. It never deletes unrelated credits and never resurrects archived rows. Ambiguous live/reviewable matches fail closed for explicit cleanup. Changed review state receives a new exact operation through a review-bound idempotency hash.

This preserves interruption-resume behavior at one reviewed credit per transaction while keeping existing Track history intact.

## Track activation implementation

Track Intake adds `registry.track.activate/v1` as a distinct lifecycle operation backed by typed capability `activate_registry_track`.

Activation binds one existing draft Track through `registry_subject_state_fingerprint('track', id)`, the current immutable Track Intake review fingerprint, and an exact reviewed-vs-canonical Artist-credit-set fingerprint. The executor refuses activation unless every reviewed credit is resolved to an active Artist and the complete active canonical credit set exactly matches the reviewed set with `source='track_intake_review'`.

The mutation is one row and lifecycle-only: `status='draft' → 'active'` plus the normal `updated_at` timestamp. The executor proves all other Track columns are unchanged in the same transaction. The independent verifier then binds the active Track state to the operation's after-state fingerprint and one exact canonical `activate` write event.

## Provider-neutral enrichment

Existing operations:

- `registry.track.provider_profile.admit/v1`;
- `registry.release.provider_profile.admit/v1`;

must not be overloaded for generic Track Intake evidence. Their executor semantics are explicitly Apple-Music-shaped and stamp `source='apple_music_ingest'`.

Track Intake needs narrow provider-neutral reviewed operations.

### Track reviewed profile

Operation candidate:

`registry.track.reviewed_profile.admit/v1`

Allowed fields are limited to the current Track Intake reviewed contract:

- ISRC;
- duration_ms;
- artwork_url;
- preview_url;
- track_number;
- disc_number;
- explicit;
- reviewed genre observation.

The operation binds:

- exact current Track state fingerprint;
- exact accepted enrichment field set;
- overwrite decision;
- immutable Track Intake review fingerprint;
- caller identity;
- one Track target.

No arbitrary JSON patching.

### Track reviewed-profile implementation

The Track half is implemented as `registry.track.reviewed_profile.admit/v1` with typed capability `admit_registry_track_reviewed_profile`.

Its bounded field family is exactly the current Track Intake contract: ISRC, duration, Track artwork URL, preview URL, track number, disc number, explicit flag, and the reviewed genre observation stored under `metadata.provider_genre`. It accepts an existing draft or active Track so new-Track orchestration can enrich before activation while existing-Track resolution can enrich in place.

The operation binds the whole current Track state fingerprint plus the exact reviewed field-set fingerprint. Legacy overwrite semantics are preserved for ISRC, duration and artwork. A changed reviewed field set receives a new evidence assertion and a new review-fingerprint-scoped idempotency key; an identical review replays the same exact operation. The historical `track_intake_enriched_at` metadata timestamp is not recreated because operation/evidence timestamps now carry that provenance durably.

### Release reviewed profile

Operation candidate:

`registry.release.reviewed_profile.admit/v1`

Only executes when the canonical Track already points at an existing Release.

Allowed fields are limited to:

- release title / normalized title;
- release date and precision;
- artwork URL;
- UPC;
- existing Label linkage when an unambiguous reviewed label match already exists;
- label-name observation when no canonical Label match exists;
- imprint observation;
- copyright observation;
- reviewed genre observation.

It may not create a Release or Label.

### Release reviewed-profile implementation

The Release half is implemented as `registry.release.reviewed_profile.admit/v1` with typed capability `admit_registry_release_reviewed_profile`.

It only operates when the selected Track already points to an existing non-archived Release. It cannot create a Release or Label. Its bounded fields are release title/normalized title, release date + precision, artwork URL, UPC, existing Label linkage, label-name observation, imprint observation, copyright observation and reviewed genre observation.

Legacy overwrite semantics are preserved for release title and release date. Label linking is tightened to an exact, unambiguous active/draft Label match. The exact matching Label set is fingerprinted into the grant so a Label-catalog change invalidates a stale grant before execution. If no unique match exists, the reviewed label remains `metadata.label_name_observation` rather than creating or guessing canonical Label identity.

As with Track profile admission, the whole current Release state and exact review fingerprint are bound to the grant. Changed reviewed Release facts get a new exact operation. The obsolete `track_intake_enriched_at` metadata timestamp is not recreated.

## Provenance

The old creator copied:

- `track_intake_source_suggestion_id`;
- `track_intake_created_at`;
- `release_evidence`;

into `registry_tracks.metadata`.

Repository audit finds no live runtime consumer of those keys. Track Intake tables plus immutable Registry evidence are the durable provenance authority.

The converged path therefore does not recreate those historical metadata copies.

Historical rows remain untouched.

## Review fingerprint

Every step derives a deterministic Track Intake review fingerprint from the exact reviewed state needed by that step, including:

- suggestion identity and current review status;
- canonical Track selection where applicable;
- approved enrichment field set;
- reviewed Artist credit identities, roles and order;
- confirmed provider selections relevant to finalization;
- overwrite decision where applicable.

A later step must reject when reviewed state differs from the frozen evidence it is executing.

## Deterministic IDs

For idempotent resume:

- future Track UUID is deterministic from suggestion ID;
- future Track↔Artist credit UUID is deterministic from suggestion ID + reviewed credit-row identity;
- idempotency keys are scoped to suggestion + typed operation + exact target.

Retries of the same reviewed state return existing operation results.

Changed review state requires new evidence and cannot reuse an old exact grant.

## Finalization

Workflow finalization remains separate from canonical Registry mutation.

It may update the Track Intake suggestion, playlist/contribution workflow state and other non-Registry operational bookkeeping required by the existing product.

It must not directly mutate:

- `registry_tracks`;
- `registry_releases`;
- `registry_track_artists`;
- canonical provider-link Registry tables.

Confirmed provider identity copying must use an accepted typed provider-link authority or a separately proven non-canonical evidence-link boundary.

## Public compatibility retirement

The legacy public functions are retained only until the new frontend/service orchestration has passed real-JWT Preview acceptance.

After caller cutover:

- direct canonical DML is removed from both legacy definitions;
- public execution of superseded compatibility roads is revoked or the roads are dropped where dependency proof permits;
- permanent writer inventory is updated to the new governed surfaces.

## Acceptance

At minimum prove on a fresh Preview:

- real `registry_editor` JWT;
- new Track flow creates draft identity through `registry.track.create/v2`;
- every reviewed Artist credit is a separate verified exact operation;
- failure of a later credit leaves earlier identity/credit receipts durable;
- provider-neutral enrichment applies only reviewed allowed fields;
- stale review fingerprint rejects;
- overwrite=false conflict rejects;
- overwrite=true reviewed replacement succeeds where contract permits;
- activation rejects before required reviewed credits exist;
- activation succeeds exactly once after prerequisites;
- final Track is active;
- finalization succeeds without canonical Registry DML;
- identical retry is idempotent;
- existing-Track resolution performs no create/activation;
- anon and service_role cannot execute public human-review commands;
- private grant/executor/verifier functions remain externally inaccessible;
- canonical write events link to every Registry mutation operation;
- legacy direct-DML roads are no longer required by the product caller.

## Deployment order

1. install broker/evidence/review fingerprint + `registry.track.create/v2` foundation;
2. add the Track-Intake-specific executor for `registry.track_artist_credit.admit/v1` while preserving Chart V1 output;
3. add Track activation operation;
4. add provider-neutral Track/Release reviewed-profile operations;
5. add separate public step commands;
6. add frontend/service orchestration;
7. prove failure-resume and happy path with real JWT;
8. retire/internalize old direct-DML commands;
9. clean Preview replay + permanent verifiers;
10. PR only after all of the above are proven.
