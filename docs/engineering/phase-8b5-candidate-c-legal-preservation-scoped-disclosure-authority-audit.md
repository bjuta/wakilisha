# Phase 8B.5 Candidate C: Legal Preservation and Scoped Disclosure Authority Audit

**Status:** Authority audit, documentation only  
**Date:** 9 September 2026  
**Accepted main at opening:** `63779b99ac5bf340207ed38df399e5560bee8784`  
**Parent issue:** #868  
**Candidate issue:** #871

## Purpose

Candidate A and Candidate B are closed in Production. Candidate C is the final contained Phase 8B.5 vertical: Legal Request Case identity, preservation scope, human review classification, and exact scoped disclosure production.

This audit answers one question before any Candidate C SQL or runtime work:

> Which existing WAKILISHA authorities already own the objects, immutability, hashes, authorization, jobs, and audit primitives Candidate C needs, and what genuinely missing peer authority must Legal add?

Candidate C must not create a broad administrator export endpoint, a second Message or Media store, a second generic job system, or software that decides legal entitlement by itself.

## Governing authority

Candidate C remains bound by:

- `docs/engineering/phase-8b-messages-authority-and-product-contract.md`;
- `docs/engineering/phase-8b-messages-core-schema-design.md`;
- accepted Phase 8B.2 Messages core authority;
- accepted Phase 8B.3 Super Admin Messages control authority;
- accepted Phase 8B.4 System Actor and real-vertical authority;
- accepted Phase 8B.5 Candidate A Safety Case, quarantine, and deliberate evidence-inspection authority;
- accepted Phase 8B.5 Candidate B enforcement, recovery, and severe Media authority;
- canonical Media identity, immutable file, SHA-256, governance, preservation, retention, and protected-delivery authority;
- canonical Resource and exact Resource Version authority;
- accepted command receipt, durable job, retry, dead-letter, and transactional outbox authority;
- accepted role/capability and server-side authorization authority.

The governing Messages contract requires a separate Legal Request Case and Legal Disclosure Package authority. It explicitly requires preservation and disclosure to remain separate operations and forbids an unrestricted administrator data-dump path.

## Repository and Production authority audit

### 1. Legal Request Case and disclosure-package authority do not exist yet

The accepted Production schema has no current Legal Request Case table, disclosure package table, legal preservation-scope table, or legal manifest authority.

The existing legal references in the Messages programme are design boundaries and exclusions, not hidden runtime implementations.

### Decision

Candidate C needs a new peer Legal authority.

It must remain separate from `messaging.safety_cases`. Safety Case history may be relevant context, but a Safety Case is not a lawful-request record and cannot become the disclosure-production owner.

## 2. Canonical Messages already preserve exact immutable communication identity

Messages already owns:

```text
messaging.conversations
messaging.conversation_participants
messaging.messages
messaging.message_resource_references
```

`messaging.messages` rejects update and delete. `messaging.message_resource_references` is also immutable.

The Message row already preserves exact Conversation identity, sender participant identity, Message kind, body, authoritative server acceptance time, correlation, and command provenance.

### Decision

Legal preservation must reference canonical Message identity. It must not copy Message bodies into a second canonical legal-message table merely to claim they are preserved.

A Legal hold is still required as explicit case-bound state even where the underlying object is already immutable. The hold records why the object is in scope, when the preservation duty was applied, and when it may later be released.

Candidate C must not weaken Message immutability to implement preservation.

## 3. Conversation scope cannot become an adjacent-conversation export shortcut

A Conversation is useful as a request-scope boundary, but the governing contract forbids unrelated conversations from leaking into production.

A broad Conversation reference therefore cannot be treated as a disclosure manifest entry that silently means "dump everything reachable from here".

### Decision

Candidate C may accept a narrowly defined Conversation scope with explicit time or object boundaries, but it must materialize that scope into exact object identities before review or production.

Every disclosed Message must be represented by its own exact preserved-object identity. Production generation must never query "all current related data" at generation time without first proving that each emitted object belongs to the case's materialized scope.

## 4. Canonical Media already owns immutable file identity and SHA-256

Media already owns:

```text
media.assets
media.asset_revisions
media.file_objects
media.asset_governance_versions
media.usage_links
```

`media.file_objects` is immutable and already carries exact `sha256`, `byte_size`, MIME type, verification state, storage identity, and creation provenance.

Media governance also has archival `preservation_state` and `retention_state` semantics.

### Decision

Candidate C must reuse exact `media.file_objects.id` and its verified SHA-256 for source file identity.

Candidate C must not create `legal_files`, `disclosure_blobs`, or another generic binary store.

Media's archival `preservation_state` must not be overloaded to mean "subject to Legal Request Case X". Archival preservation and legal hold are different authorities. Legal needs a case-bound preservation ledger that references canonical Media.

If Candidate C materializes a final archive, manifest document, or other binary disclosure artifact, that artifact should be registered as a canonical restricted Media document and exact `media.file_objects` identity, then referenced from the Legal Disclosure Package. Legal owns the package decision and manifest. Media continues to own the bytes.

## 5. Exact Resource Version authority already exists

The shared Resource Version family already provides:

```text
editorial.resources
editorial.resource_versions
```

Typed domains remain authoritative for their immutable payloads. `editorial.resource_versions` registers exact version UUIDs additively and preserves a 64-character content fingerprint where the domain supplies one.

Messages Resource references can already bind an exact `resource_version_id`.

### Decision

A Legal case that includes governed editorial material must bind the exact Resource Version, not a moving `current_*_version_id` pointer.

Candidate C must not copy Article, Playlist, Audio, Video, Field, or Registry version payloads into a new Legal content authority.

The existing domain `content_fingerprint` is valuable source-integrity evidence, but it is not automatically the disclosure object's SHA-256. The disclosure object hash must describe the exact bytes emitted in the package.

## 6. Existing Media preservation is reusable substrate, not Legal case state

Current Media preservation values include:

```text
unassessed
working_copy
preservation_candidate
preserved
at_risk
lost
```

These values describe Media stewardship. They do not identify a legal request, requesting authority, scope, notice restriction, approval, or hold release.

### Decision

Do not add legal case identifiers to `media.asset_governance_versions` and do not repurpose `preservation_state` as a legal-hold state machine.

Legal preservation must be a peer reference layer. Where future retention or deletion commands could affect a held object, those commands must consult the Legal hold helper before deletion becomes possible. Candidate C does not need to invent deletion paths for objects that are currently immutable.

## 7. Existing command, job, retry, dead-letter, and outbox authority is sufficient

Production already has:

```text
platform_private.command_types
platform_private.command_receipts
platform_private.jobs
platform_private.outbox_events
```

The accepted worker model already owns leases, retries, attempt limits, failure state, and `dead_letter` handling.

### Decision

Candidate C must not create `legal_jobs`, `disclosure_queue`, a second retry table, or a second outbox.

Legal mutations must use principal-scoped command receipts and idempotency. Any potentially expensive disclosure materialization or package generation must use the existing durable job family.

The eventual execution runtime must reuse an accepted worker/runtime authority. Candidate C must not introduce a new Edge Function merely because generation is asynchronous.

## 8. Safety evidence inspection proves the correct private-content access pattern

Candidate A already established a deliberately separate evidence-inspection RPC. Browsing a Safety Case does not auto-render private Message content. Successful evidence inspection records an append-only `evidence_viewed` event and idempotent replay does not duplicate that audit event.

### Decision

Legal must follow the same access shape without reusing the Safety Case itself.

Legal case queue/detail reads expose safe metadata. Exact private content requires a separate case-scoped evidence-inspection read with a human-entered purpose and an append-only Legal event.

Super Admin role membership is necessary but not sufficient to auto-render every private Message or restricted Media object.

## 9. The generic admin audit log is useful telemetry, but not canonical Legal history

`public.admin_audit_events` exists and is RLS-protected, but it is a broad platform audit table rather than an immutable Legal case ledger. It has no immutable-row trigger and its schema is oriented toward generic target-user/table audit events.

### Decision

Candidate C may continue emitting generic admin audit telemetry where existing conventions require it, but canonical Legal history must live in an append-only Legal case event ledger.

Do not put Legal Request Case state or disclosure approvals into `public.admin_audit_events` as their sole authority.

## 10. Super Admin Messages control authority exists, Legal capabilities do not

Production currently has one Messages control capability:

```text
manage_messages_control_center
```

It is assigned to `super_admin`.

`/admin/messages` already states the correct private-content boundary: operational aggregates do not grant ambient conversation access, and governed Safety or Legal authority must permit private-content inspection.

The current page has Safety and Agent operations but no Candidate C Legal product yet.

### Decision

Candidate C extends `/admin/messages`. It does not create `/admin/legal` or a parallel operator application.

The implementation should add narrow Legal capabilities even though only `super_admin` receives them initially:

```text
view_messages_legal_cases
inspect_messages_legal_evidence
manage_messages_legal_cases
approve_messages_legal_disclosure
```

This keeps queue visibility, restricted evidence inspection, case mutation, and disclosure approval separable without widening any ordinary Administrator role.

## 11. Final legal entitlement must remain a human decision

Software can validate scope, object identity, hashes, approvals, and package integrity. It cannot decide whether a request is legally sufficient across jurisdictions, process types, emergency rules, notice restrictions, or protected classes of material.

### Decision

Candidate C records human decisions and their basis. It does not calculate a legal-entitlement verdict from request metadata.

A disclosure package cannot be generated merely because a case exists. It requires explicit recorded approval authority appropriate to the accepted product policy.

## Smallest serious Candidate C model

The audit recommends one Legal peer family inside the existing Messages authority boundary. Exact DDL names remain subject to the schema/command design gate, but the semantic ownership is locked as follows.

### `messaging.legal_request_cases`

Owns stable Legal Request Case identity and current lifecycle state.

Minimum authority:

```text
id
request_reference
request_kind
status
requesting_authority
jurisdiction_or_process
received_at
scope_statement
notice_restriction_state
assigned_user_id
opened_by_user_id
opened_at
closed_by_user_id
closed_at
closure_note
revision
```

`jurisdiction_or_process` is recorded context, not an automatic entitlement rule.

### `messaging.legal_preservation_scopes`

Owns the requested preservation boundary before exact object materialization.

Initial supported scope kinds should be finite and explicit, for example:

```text
exact_message
conversation_window
exact_media_file
exact_resource_version
```

A scope row may store only fields meaningful to its finite kind, such as an exact Message UUID, exact Conversation UUID plus accepted-time bounds, exact Media file UUID, or exact Resource Version UUID.

Do not store arbitrary SQL, free-form query fragments, or an unrestricted JSON selector that can later widen production.

### `messaging.legal_preserved_objects`

Owns the exact materialized object set held by one Legal Request Case.

Minimum authority:

```text
id
legal_request_case_id
preservation_scope_id
object_kind
message_id nullable
media_file_object_id nullable
resource_version_id nullable
preservation_status
response_classification
classification_reason
preserved_at
preserved_by_user_id
released_at nullable
released_by_user_id nullable
release_reason nullable
revision
```

Exactly one canonical object identity is present per row.

Initial response classification is exactly:

```text
responsive
elevated_review
excluded
```

This table references canonical objects. It does not copy Message bodies, Media bytes, or Resource payloads.

### `messaging.legal_disclosure_packages`

Owns one exact production identity and its frozen manifest authority.

Minimum authority:

```text
id
legal_request_case_id
production_reference
status
scope_statement
documented_omissions
requested_at
requested_by_user_id
generated_at nullable
manifest_json nullable
manifest_sha256 nullable
package_file_object_id nullable
released_at nullable
released_by_user_id nullable
revision
```

A package is not mutable after successful generation. Corrections require a new package/production identity, not silent replacement.

### `messaging.legal_disclosure_objects`

Owns the ordered, immutable manifest entries for one generated package.

Minimum authority:

```text
id
legal_disclosure_package_id
legal_preserved_object_id
manifest_order
object_kind
source_object_id
object_sha256
object_byte_size
source_fingerprint nullable
classification
inclusion_basis
omission_note nullable
created_at
```

Every included object must come from `legal_preserved_objects` for the same case.

`excluded` objects can never become package entries. `elevated_review` objects require a specific recorded approval before inclusion. `responsive` is the ordinary eligible class, but final package approval is still required.

### `messaging.legal_case_events`

Append-only Legal history.

Initial event meanings should include:

```text
request_opened
review_started
scope_added
scope_removed
preservation_applied
preservation_released
classification_changed
evidence_viewed
approval_recorded
approval_revoked
disclosure_requested
disclosure_generation_started
disclosure_generated
disclosure_failed
disclosure_released
disclosure_voided
case_closed
```

The event row records accountable actor identity, timestamp, command receipt where applicable, and narrow metadata. Private Message bodies and Media bytes do not belong in event metadata.

## Hash and manifest contract

Candidate C must distinguish source identity from production identity.

### Media source objects

For a verified `media.file_objects` source, canonical source SHA-256 and byte size already exist and must be reused as source-integrity evidence.

If the package emits the exact original file bytes unchanged, the emitted object SHA-256 must equal the canonical Media SHA-256.

If the package emits a derived representation, its disclosure-object SHA-256 describes those emitted bytes and must not pretend to be the source file hash.

### Message source objects

Messages do not currently carry a row-level SHA-256, and Candidate C does not need to mutate `messaging.messages` to add one.

The package generator must define one deterministic canonical Message disclosure representation containing only the exact approved fields and exact approved Resource references. The SHA-256 is calculated over the exact bytes emitted for that representation and stored in the immutable package manifest entry.

### Resource Version source objects

`editorial.resource_versions.content_fingerprint` remains source-integrity evidence. The package object's SHA-256 is calculated over the exact bytes emitted for the disclosure representation.

### Manifest hash

The manifest must have one deterministic serialization contract with stable key names and stable object ordering. `manifest_sha256` is calculated over those exact manifest bytes.

The package record stores the frozen manifest and hash together. Regeneration that changes any object, order, omission, approval projection, or scope statement produces a new production identity rather than rewriting the old package.

## Preservation does not equal disclosure

The core Candidate C state machine must keep these operations distinct:

```text
request accepted for review
-> preservation scope recorded
-> exact objects materialized and held
-> object-by-object response classification
-> evidence review where authorized
-> disclosure approval recorded
-> exact package generation
-> controlled release
```

Applying a preservation hold must never expose Message content to the requester or operator automatically.

Removing a hold must never delete the canonical object. It only ends this Legal case's preservation obligation where policy permits.

## Scope materialization and leak prevention

The implementation must have one reusable server-side scope validator/materializer.

For every package object, generation must prove all of the following:

1. the package belongs to the Legal Request Case;
2. the preserved object belongs to that same case;
3. the object was materialized from one accepted scope row;
4. the exact canonical object still exists;
5. the object classification permits inclusion;
6. any elevated-review inclusion has its explicit approval event;
7. the operator/package has authority to inspect the underlying protected object;
8. the output representation is generated from that exact object identity, not a moving current pointer.

No join may expand from an in-scope Message into other Messages merely because they share a Conversation. No Resource or Media relationship may widen scope merely because it is reachable from an included object.

## Candidate C command boundary

All browser mutations must be RPC/command driven and idempotent.

The schema design should lock commands for these semantic actions:

```text
open legal request case
start legal review
add/remove preservation scope
materialize/apply preservation
release preservation
classify exact preserved object
record/revoke disclosure approval
request disclosure generation
void disclosure package
close legal request case
```

Commands that modify case, scope, object classification, preservation, approval, or package state require revision/concurrency protection appropriate to the object being changed.

Disclosure generation should enqueue one existing durable job type, not run an unbounded browser request.

## Candidate C read boundary

Safe Super Admin queue/detail reads may expose:

```text
case identity
request reference
requesting authority
received time
status
scope summary
counts by classification
preservation counts
approval state
package state
manifest/package hashes
```

They must not auto-render Message bodies, restricted Media, or protected Resource payloads.

Restricted evidence inspection must be a separate read requiring:

```text
legal_request_case_id
legal_preserved_object_id
human purpose/reason
```

A successful non-replay inspection appends exactly one `evidence_viewed` Legal event.

Package artifact access must also be Legal-case scoped. Possessing `super_admin` or a Media Library capability alone must not bypass the Legal package gate.

## Super Admin product shape

Candidate C extends the existing `/admin/messages` control center with a Legal section or panel.

Minimum product flow:

```text
Legal Request Cases
-> open safe case summary
-> define preservation scope
-> materialize exact held objects
-> classify Responsive / Elevated Review / Excluded
-> deliberately inspect exact evidence when required
-> record approval
-> request production
-> review exact manifest and SHA-256
-> controlled release
```

The UI must show counts and safe identifiers before private content. Restricted content remains opt-in and purpose-recorded.

## What Candidate C must not touch

- canonical Message body immutability;
- Message mailbox semantics;
- Safety Case identity or Safety event history;
- Candidate B enforcement/appeal ledgers;
- Community moderation storage;
- Media binary ownership or immutable file authority;
- Media archival preservation semantics as a substitute for legal hold;
- Resource domain content/version ownership;
- generic command/job/outbox infrastructure;
- public Messages audience mode;
- broad Administrator access;
- unrestricted data export;
- automatic legal-entitlement decisions;
- Phase 8B.6 antifragile programme closure.

## Required implementation sequence

Candidate C should proceed as one contained vertical after this audit is accepted:

1. lock exact schema, capability, command, read, hash, and deterministic manifest design;
2. add one migration for Legal Request Case, exact scopes, preserved objects, append-only events, disclosure package/manifest authority, capabilities, commands, and reads;
3. add one permanent rollback-only Candidate C verifier;
4. extend the existing Messages service and `/admin/messages` with Legal operations;
5. reuse the existing job/outbox/dead-letter family for disclosure generation;
6. run migration replay, generated-type seal, existing Messages/Safety contracts, focused Legal contracts, complete frontend build, and a disposable Preview;
7. prove unauthorized read denial, preservation-without-disclosure, exact scope materialization, adjacent-conversation non-leakage, protected-Resource non-leakage, elevated-review approval gating, exact per-object hashes, deterministic manifest hash, idempotent replay, and rollback residue;
8. promote only the exact merged-main migration to Production after Preview acceptance;
9. deploy the exact merged-main frontend if Candidate C changes the product surface;
10. perform a controlled Production Legal case/package canary using non-sensitive test content;
11. record Production closure before Phase 8B.6 begins.

## Exit gate for Candidate C

Candidate C is complete only when all of the following are proved:

```text
Legal Request Case is separate from Safety Case: PASS
Preservation is separate from disclosure: PASS
Preservation scope materializes exact canonical object identities: PASS
Canonical Message rows remain immutable: PASS
Canonical Media file identity and SHA-256 remain authoritative: PASS
Media archival preservation is not overloaded as Legal hold: PASS
Exact Resource Version identity is used where Resource content is in scope: PASS
Ordinary Administrator cannot access Legal operations: PASS
Super Admin case browsing does not auto-render restricted content: PASS
Explicit Legal evidence inspection is authorized and audited: PASS
Responsive / Elevated Review / Excluded classification is enforced: PASS
Excluded objects cannot enter a package: PASS
Elevated Review objects cannot enter a package without explicit approval: PASS
Adjacent Conversations do not leak into scoped production: PASS
Unrelated protected Resources do not leak into scoped production: PASS
Per-object SHA-256 matches exact emitted bytes: PASS
Manifest SHA-256 matches deterministic exact manifest bytes: PASS
Disclosure generation is idempotent and uses existing durable jobs: PASS
Package history is immutable after generation: PASS
Final legal entitlement remains a recorded human decision: PASS
Rollback verifier: PASS
Critical Control Plane: PASS
Production acceptance: PASS
```

## Audit conclusion

Candidate C does not need a new Message store, Media store, Resource store, export service, generic audit system, scheduler, job queue, or operator application.

It needs one missing peer authority: a Legal Request Case family that records explicit preservation scopes, materializes exact canonical objects, classifies each object for response, records human approvals and append-only events, and produces an immutable, deterministic disclosure manifest with per-object and manifest SHA-256 values.

That is the smallest serious implementation surface for #871.