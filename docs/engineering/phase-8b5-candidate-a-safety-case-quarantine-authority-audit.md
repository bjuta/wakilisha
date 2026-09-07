# Phase 8B.5 Candidate A: Safety Case and Quarantine Authority Audit

**Status:** Authority audit, documentation only  
**Date:** 7 September 2026  
**Accepted main at opening:** `748a9facfb2de8858877aba5a7c33258b295fbd5`  
**Parent issue:** #868  
**Candidate issue:** #869

## Purpose

Phase 8B.4 is closed in Production. Phase 8B.5 now begins with the smallest contained safety vertical: private Messages Safety Case identity, quarantine, and restricted evidence inspection.

This audit answers one question before any SQL or runtime work:

> Which existing WAKILISHA authorities already own the required primitives, and what genuinely missing peer authority must Candidate A add?

Candidate A must not create a second messaging system, a second Media system, a second Community moderation system, a second job queue, or a broad private-content inspection path.

## Governing authority

Candidate A remains bound by:

- `docs/engineering/phase-8b-messages-authority-and-product-contract.md`;
- `docs/engineering/phase-8b-messages-core-schema-design.md`;
- accepted Phase 8B.2 Messages core authority;
- accepted Phase 8B.3 Super Admin Messages control authority;
- accepted Phase 8B.4 System Actor and real-vertical authority;
- accepted Community Block and Report semantics;
- accepted Media identity, immutable-file, governance, and delivery authority;
- accepted command receipt, job, retry, dead-letter, and outbox authority;
- accepted role/capability and server-side authorization authority.

The governing Messages contract explicitly identifies private Messages Safety Case and quarantine authority as genuinely missing. It also requires Safety Case to remain peer authority rather than becoming the owner of Message or Media identity.

## Repository audit

### 1. Messages identity and mailbox authority already exist

The Phase 8B Messages foundation already owns:

- `messaging.conversations`;
- `messaging.conversation_participants`;
- `messaging.messages`;
- `messaging.message_receipts`;
- `messaging.message_resource_references`;
- `messaging.user_sender_policies`;
- `messaging.sender_approvals`;
- `messaging.runtime_policy`.

The existing participant row already owns user mailbox placement through:

```text
inbox
requests
spam
archived
```

It also owns first-contact state separately from mailbox placement.

Message rows and Message Resource references are explicitly immutable. Candidate A must preserve that rule.

### Decision

Safety Case and quarantine must reference canonical Message identity. They must not copy Message bodies into a second canonical store and must not mutate historical Message content.

Spam remains a user mailbox classification. Quarantine remains a platform safety disposition. They are not interchangeable.

## 2. Community Block and Report semantics are reusable, storage is not

Community already provides durable product semantics for:

- Person/Artist block state through `public.community_blocks`;
- canonical target resolution;
- active/revoked block state rather than destructive deletion;
- an existing `public.community_reports` ledger extended to Post reporting;
- report reasons and report actions;
- explicit separation between owner moderation, Block, and Report.

The accepted Messages contract already states that Community Block/Report behavior may inform Messages, but Community storage must not own private Messages moderation state.

### Decision

Candidate A reuses these semantics:

- Block is a user relationship control;
- Report is a signal;
- report count is not a verdict;
- revocation/history should be explicit where relevant;
- moderation action and user relationship action remain distinct.

Candidate A does not add Message targets to `public.community_reports` and does not add Conversation targets to `public.community_blocks`.

## 3. Canonical Media identity already exists

The Media authority already owns the canonical Media family, including:

- `media.assets`;
- `media.file_objects`;
- `media.asset_revisions`;
- exact immutable file identity;
- file verification and registered variants;
- Media governance and protected-delivery authority.

Phase 8A and later Media work already rely on exact canonical Media rather than copying uploaded bytes into downstream workflow stores.

### Decision

Candidate A does not create `safety_files`, `message_evidence_files`, or another binary store.

Where a Safety Case targets Media, it binds to canonical Media identity and exact file identity where required. Candidate A does not broaden ordinary Message attachment behavior merely to exercise this boundary.

Severe-Media processing/provider integration belongs to Candidate B. Candidate A only establishes the correct target and quarantine boundary.

## 4. Command, job, retry, and outbox authority already exists

WAKILISHA already has accepted platform authority for:

- principal-scoped command receipts and idempotency;
- durable jobs;
- worker leases;
- retries;
- dead letters;
- transactional outbox.

### Decision

Candidate A must not create a `safety_jobs` generic queue or a second retry/dead-letter system.

Any asynchronous report processing, containment propagation, evidence-preservation task, or later provider call must use the existing platform primitives.

## 5. Super Admin Messages access already exists, private-content access does not

`/admin/messages` already exists as the Super Admin-only Messages operator surface.

Its current implementation intentionally exposes operational aggregates and System Actor controls while stating that private conversation content remains participant-scoped unless later governed Safety or Legal authority permits access.

This is the exact opening point Candidate A needs.

### Decision

Candidate A extends `/admin/messages` with Safety operations. It does not create `/admin/safety` or another parallel operator product.

Super Admin status alone must not make every private Message body or restricted Media item auto-render.

Evidence inspection must be an explicit governed read that records who inspected what, when, and under which Safety Case.

## 6. Safety Case authority is genuinely missing

The current repository has canonical Message, mailbox, Community moderation, Media, authorization, and operational primitives, but no private Messages peer authority that can bind these together as an investigation/containment case.

Candidate A therefore needs a new peer safety authority.

## Smallest serious Candidate A model

The audit recommends one new `safety` schema with four narrowly owned tables.

### `safety.cases`

Owns stable Safety Case identity and current case state.

Minimum authority:

```text
id
case_kind
status
policy_category
severity
confidence
opened_source
opened_at
reviewer_user_id
reviewed_at
current_disposition
preservation_state
updated_at
revision
```

Initial `case_kind` is `messages`.

Candidate A should keep policy category values governed and finite. It should not hard-code provider-specific labels as canonical platform policy.

### `safety.case_targets`

Binds a Safety Case to exact canonical targets without copying them.

Minimum target kinds:

```text
message
media_asset
media_file
```

Message target identity must reference `messaging.messages.id`.

Media targets must reference canonical Media authority.

A case may bind more than one exact target when containment evidence requires it, but broad graph expansion must never happen implicitly.

### `safety.case_events`

Append-only case history for signals and accountable actions.

Candidate A event meanings should cover at minimum:

```text
reported
case_opened
review_started
disposition_changed
quarantine_applied
quarantine_released
evidence_inspected
preservation_changed
case_closed
```

This table is history, not a competing current-state table. Current case state remains on `safety.cases` where fast authorization checks require it.

### `safety.quarantines`

Owns active containment state against an exact target.

Minimum authority:

```text
id
case_id
target_id
status
scope
reason
applied_at
released_at
applied_by
released_by
revision
```

Initial quarantine scopes may include only meanings Candidate A can actually enforce. Do not define fictional controls for unsupported Message/Media behaviors.

## Candidate A command boundary

The smallest command surface is:

### User report command

A canonical authenticated command should report one Message into Safety authority.

Conceptual shape:

```text
report_message(message_id, reason, details?, idempotency_key)
```

Requirements:

- reporter must be an authorized participant in the Conversation;
- report creates a signal, not an automatic verdict;
- repeated replay with the same principal/idempotency key returns the same result;
- report must not reveal whether unrelated Safety Cases already exist;
- report payload must not duplicate the Message body.

### Super Admin Safety commands

Candidate A needs governed commands to:

- assign/start review;
- change case disposition;
- apply/release quarantine;
- change preservation state;
- close/reopen a case where allowed.

These commands must use optimistic revision checks and command receipts where mutation semantics require replay safety.

No direct browser writes to `safety.*` tables are permitted.

## Candidate A read boundary

The ordinary user Messages projection may expose only the user's own report receipt/state necessary for product feedback. It must not expose hidden case category, confidence, reviewer identity, internal notes, detection source, or other Safety metadata.

Super Admin reads must be case-scoped.

Recommended operator reads:

```text
list_messages_safety_cases(...)
get_messages_safety_case(case_id)
inspect_messages_safety_evidence(case_id, target_id, purpose)
```

`inspect_messages_safety_evidence(...)` is deliberately separate from ordinary case loading so restricted content does not auto-render while browsing a queue.

Successful inspection must append an `evidence_inspected` event.

## Quarantine enforcement boundary

Candidate A should enforce only the paths that exist today.

At minimum, an active Message quarantine must be capable of preventing ordinary delivery/read projection of the quarantined Message to a participant who has not already lawfully received it, subject to exact accepted semantics decided in schema design.

The implementation must not rewrite or delete the Message row.

Candidate A should not invent Message forwarding or Media attachment workflows merely to claim they are quarantined. Candidate B may extend containment when those surfaces and severe-Media processing are in scope.

## Authorization

Reuse `super_admin` and existing server-side Messages control authority.

Candidate A should add narrowly named Safety capabilities only if the existing single Messages control capability is too coarse for evidence inspection and containment mutations.

The audit recommends separating at least:

```text
view_messages_safety_cases
inspect_messages_safety_evidence
manage_messages_safety_cases
```

Only `super_admin` receives them initially.

This preserves future separation of queue visibility, restricted evidence access, and enforcement authority without granting any of them to ordinary Administrator by inheritance.

## What Candidate A must not touch

- canonical Message body immutability;
- user mailbox semantics except where quarantine blocks delivery;
- Community report/block storage;
- Registry/MIZIZI authority;
- Resource review commands;
- Media file ownership or binary storage;
- generic job/outbox infrastructure;
- public Messages audience mode;
- Candidate B graduated enforcement and severe provider integration;
- Candidate C Legal Request/disclosure authority;
- Phase 8B.6 final antifragile tests.

## Required implementation sequence

Candidate A should proceed in one contained implementation slice:

1. lock exact schema/command design from this audit;
2. add one migration for Safety Case, target, event, quarantine, capabilities, commands, and reads;
3. add permanent structural verifier and rollback-only behavior verifier;
4. extend the existing Messages service and `/admin/messages` Safety surface;
5. extend existing Messages/Community/security tests instead of creating redundant suites;
6. run replay, generated-type seal, focused tests, complete build, and disposable Preview;
7. perform controlled user-report, quarantine, unauthorized-read, evidence-inspection, replay/idempotency, and release behavior acceptance;
8. promote exact merged-main SQL only after Preview acceptance;
9. deploy exact merged-main frontend;
10. record Production closure before Candidate B begins.

## Exit gate for Candidate A

Candidate A is complete only when all of the following are proved:

```text
Message report creates governed Safety signal: PASS
Report does not become automatic verdict: PASS
Repeated report command is idempotent: PASS
Safety Case binds exact canonical Message identity: PASS
Quarantine preserves immutable Message history: PASS
Quarantine blocks the accepted delivery/read path: PASS
Ordinary participant cannot read hidden Safety metadata: PASS
Ordinary Administrator cannot access Safety operations: PASS
Super Admin case list does not auto-render restricted evidence: PASS
Explicit evidence inspection is authorized and audited: PASS
Quarantine release is accountable and revision-safe: PASS
Community moderation storage remains unchanged: PASS
Media binary authority remains canonical: PASS
Existing jobs/outbox authority is reused: PASS
Rollback verifier: PASS
Critical Control Plane: PASS
Production acceptance: PASS
```

## Audit conclusion

Candidate A does not need a new messaging core, Media store, moderation queue family, or operator application.

It needs one missing peer authority: a narrowly scoped `safety` case model that references canonical Message/Media identity, records accountable history, owns quarantine state, and grants restricted evidence access only through explicit server-enforced Safety commands and reads.

That is the smallest serious implementation surface for #869.