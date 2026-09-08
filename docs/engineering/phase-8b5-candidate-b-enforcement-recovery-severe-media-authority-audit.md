# Phase 8B.5 Candidate B: Enforcement, Recovery, and Severe Media Authority Audit

**Status:** Authority audit, documentation only  
**Date:** 8 September 2026  
**Accepted main at opening:** `4bd21dc01078419eb2995d345b6067438dcf23e9`  
**Parent issue:** #868  
**Candidate issue:** #870

## Purpose

Candidate A is closed in Production. Candidate B now owns the next contained Trust and Safety vertical: graduated Messages enforcement, recovery where policy permits, severe-category bypass, and the exact canonical Media safety boundary.

This audit answers one question before any Candidate B SQL or runtime work:

> Which accepted WAKILISHA authorities already own the required behavior, and what genuinely missing peer state must Candidate B add without creating another moderation, account-access, Media, queue, or delivery system?

The audit used repository authority at exact protected `main` plus read-only Production schema/function inspection. It made no Production mutation.

## Governing authority

Candidate B remains bound by:

- `docs/engineering/phase-8b-messages-authority-and-product-contract.md`;
- `docs/engineering/phase-8b-messages-core-schema-design.md`;
- `docs/engineering/phase-8b5-candidate-a-safety-case-quarantine-schema-command-design.md`;
- `docs/engineering/phase-8b5-candidate-a-production-closure.md`;
- accepted canonical Person/Auth identity authority;
- accepted Messages Conversation, Message, mailbox, sender-policy, and delivery authority;
- accepted Candidate A Safety Case, exact target, event, evidence, and quarantine authority;
- accepted canonical Media file identity, SHA-256 identity, revision, governance, processing, preservation, and delivery authority;
- accepted Community Block and Report semantics;
- accepted command receipts, durable jobs, worker leases, retries, dead-letter state, and transactional outbox;
- accepted Super Admin `manage_messages_control_center` capability and `/admin/messages` product surface.

Candidate B must not reinterpret reports, detection counts, or provider outputs as automatic verdicts. A governed WAKILISHA command remains the authority for enforcement and containment.

## Repository and live-authority findings

### 1. Candidate A already owns the Safety Case and exact-target spine

Production already has:

```text
messaging.safety_cases
messaging.safety_case_targets
messaging.safety_case_events
messaging.message_quarantine
```

`messaging.safety_case_targets` already supports exactly one canonical target per row:

```text
message_id
or
media_file_object_id
```

The Media target is `media.file_objects(id)`. Candidate A deliberately does not copy Media SHA-256, bytes, storage path, or derivatives into Safety storage.

`messaging.safety_case_events` is append-only and already records accountable human, system, or automation actors. Its metadata is bounded. Candidate A event vocabulary already includes `signal_added`, which was reserved for later evidence/detection work.

### Decision

Candidate B must extend this spine. It must not create `safety_cases_v2`, another target table, another generic event ledger, or another quarantine family.

New enforcement, appeal, severe-Media, and provider chronology should append to the existing Safety Case event ledger.

### 2. Candidate A case summary cannot represent Candidate B enforcement yet

Current `messaging.safety_cases.current_disposition` accepts only:

```text
pending
no_action
quarantine
```

A resolved Candidate A case may finish only as `no_action` or `quarantine`.

Candidate B needs multiple possible effective restrictions at once. A single case summary field cannot safely become the canonical store for warning, cooldown, link restriction, conversation-start restriction, suspension, and recovery state.

### Decision

Keep `current_disposition` as a case-level summary, not the enforcement ledger.

Candidate B should add one new summary value:

```text
enforced
```

The exact active restrictions belong in a dedicated enforcement peer table. Existing `no_action` and `quarantine` cases remain valid.

A case may resolve as `enforced` even when Message quarantine is also present. Quarantine state remains separately visible through `messaging.message_quarantine`.

### 3. Safety severity and source fields were already reserved for Candidate B

`messaging.safety_cases` already owns:

```text
severity: low | medium | high | severe
confidence: 0 through 1, nullable
source_kind: user_report | staff | automated_signal
```

User reports currently open at `low` severity. Candidate A has no governed command that changes assessment fields.

### Decision

Candidate B needs a narrow Super Admin assessment mutation over the existing case row. It should be the only browser-facing path that changes case severity and reviewed policy assessment.

Provider confidence remains evidence metadata. It may inform an operator assessment but must not automatically become a platform enforcement decision.

A severe reviewed case may bypass lower enforcement steps. SQL must not require a warning or cooldown before a severe suspension/removal action.

### 4. Global account suspension exists, but it is the wrong authority for Messages sanctions

WAKILISHA already has the Admin Users action `suspend_user_access_admin(...)`.

That authority changes broad account state, including:

- `public.user_profiles.status`;
- active role assignments;
- active access scopes;
- generic Admin user-access audit state.

The current Messages identity helpers require `public.user_profiles.status = 'active'`. Using global suspension for an ordinary Messages sanction would therefore affect unrelated product authority and could also prevent the sanctioned user from reaching a Messages appeal/recovery surface.

### Decision

Candidate B must not use global Admin account suspension as its normal Messages enforcement primitive.

`messaging_suspended` and `messaging_removed` are Messages-scoped sanctions. They preserve Auth account identity, Person identity, unrelated roles/scopes, immutable Message history, and the user's ability to receive the safe enforcement/appeal state needed for recovery.

The existing global account-suspension path remains separate authority for genuinely account-wide decisions outside this candidate.

### 5. The existing Messages send/start paths are the correct enforcement points

Current human Messages authority already rechecks server state on every accepted action.

The relevant live paths are:

```text
public.start_message_conversation(...)
public.start_field_submission_message_v1(...)
public.send_message(...)
public.get_my_message_access()
```

They already compound:

- active canonical Person/Auth identity;
- platform audience mode;
- active Person blocks;
- Conversation membership;
- first-contact state;
- recipient sender policies;
- exact Resource-reference access;
- idempotent command receipts.

`public.start_field_submission_message_v1` is a governed audience exception and therefore must not become an enforcement bypass.

### Decision

Candidate B must add one reusable server-side sender enforcement helper and call it from every human start/send entry point, including Field follow-up.

Do not create a second send path.

`get_my_message_access()` must reflect the same effective enforcement state so frontend controls do not advertise actions that the server will reject.

System Actor send authority remains separate unless a later case explicitly governs a System Actor. Candidate B's initial human enforcement model must not accidentally disable MIZIZI or other registered System Actors.

### 6. Recipient policy already owns content preference, not sender punishment

`messaging.user_sender_policies` already contains:

```text
first_contact_disposition
allow_links
allow_media
allow_resource_references
show_read_receipts
```

`messaging.recipient_content_allows(...)` currently enforces link and Resource-reference recipient policy. It does not currently enforce `allow_media` because Messages has no separate canonical attachment table or binary attachment send path.

### Decision

Do not store platform sanctions in recipient policy rows.

Candidate B link/media restrictions are sender enforcement, independent of each recipient's preferences. The server must apply the strictest combination:

1. sender Safety enforcement;
2. recipient content policy;
3. underlying Resource/Media access.

Candidate B must not add a new user-facing attachment composer or a second Media-reference store merely to exercise `media_restricted`.

The current Resource-reference path can already identify an `editorial.resources.resource_kind = 'media_asset'` reference. Candidate B may treat such a reference as a canonical Media share for enforcement purposes without inventing attachment storage.

### 7. Spam remains mailbox classification, not enforcement

The accepted participant mailbox vocabulary remains:

```text
inbox
requests
spam
archived
```

Candidate A added platform quarantine separately.

### Decision

Candidate B must preserve the distinction:

- Spam is participant-owned mailbox classification;
- quarantine is exact Message containment;
- enforcement is platform action against a sender's Messages authority.

Moving a Conversation to Spam does not create a strike, warning, suspension, or case disposition by itself.

### 8. One scoped human enforcement ledger is genuinely missing

There is currently no Messages-specific table that can answer:

- which user/Person is currently restricted;
- which exact Safety Case authorized the restriction;
- what restriction is active;
- whether it is temporary or indefinite;
- whether appeal is allowed;
- when and by whom it was applied/released/reversed.

### Decision

Candidate B needs one new peer table in `messaging`:

```text
messaging.safety_enforcements
```

It should bind each enforcement to:

```text
safety_case_id
subject_user_id
subject_person_resource_id
enforcement_kind
status
applied_at
applied_by_user_id
effective_until nullable
appeal_allowed
released_or_reversed_at nullable
released_or_reversed_by_user_id nullable
reason / recovery note
command_receipt_id
revision
```

Exact names belong to schema design, but ownership does not.

The minimum enforcement vocabulary should map directly to #870 without pretending unsupported systems exist:

```text
warning
send_cooldown
send_rate_limit
links_restricted
media_restricted
conversation_start_restricted
messaging_suspended
messaging_removed
```

Interpretation:

- `warning`: accountable notice, no automatic hard send denial;
- `send_cooldown`: friction through a minimum server-enforced interval between sends;
- `send_rate_limit`: temporary message-count limit within a bounded server window;
- `links_restricted`: sender cannot send link-bearing Message content;
- `media_restricted`: sender cannot send/reference canonical Media through supported Messages reference surfaces;
- `conversation_start_restricted`: sender may not create new Conversations but may retain allowed existing-conversation behavior;
- `messaging_suspended`: temporary or manually released Messages send/start suspension;
- `messaging_removed`: indefinite Messages participation restriction until governed reinstatement.

`messaging_removed` is not Auth deletion, Person deletion, or global account suspension.

Candidate B does not need a strike-counter table. The case/event/enforcement history is the reviewable record. Any future policy ladder may read that history, but counts do not become verdicts automatically.

### 9. Cooldown and rate limits do not need a second counter system

Canonical `messaging.messages.accepted_at` already owns accepted Message chronology.

### Decision

For `send_cooldown` and `send_rate_limit`, the server should derive current usage from canonical accepted Messages under a sender-scoped transaction/advisory lock.

Do not add a mutable Safety message counter that can drift from canonical Message history.

The exact schema design may add focused indexes needed for bounded accepted-message lookups.

Concurrency acceptance must prove that simultaneous sends cannot both bypass a cooldown/rate limit.

### 10. Enforcement subject must be derived from exact case evidence

An operator action should not accept an arbitrary unrelated user ID when the case already targets exact Message evidence.

### Decision

For Message-target cases, the enforcement command should take the exact case and exact targeted Message, then derive the accountable human sender through canonical Conversation participant identity.

The command must prove:

- the Safety Case targets that Message;
- the Message sender is a human Person/Auth-backed participant;
- the derived Person/user pair is active enough to bind durable enforcement history.

A Media-only case cannot silently punish an arbitrary user without a separately proven human target.

### 11. Appeal/recovery state is genuinely missing

Candidate A intentionally stopped before appeal/reinstatement. No current Messages table owns an appeal lifecycle.

### Decision

Candidate B needs one new peer table:

```text
messaging.safety_appeals
```

Each appeal should bind to one exact `safety_enforcements` row and preserve:

```text
id
enforcement_id
safety_case_id
appellant_user_id
appellant_person_resource_id
status
appeal_reason
submitted_at
review_started_at / reviewer
resolution
resolution_note
resolved_at / resolver
command_receipt_id
revision
```

Initial lifecycle should support:

```text
open
under_review
resolved
```

Initial resolution meanings should support at least:

```text
upheld
modified
reversed
```

Only the exact enforcement subject may submit the appeal, and only when `appeal_allowed` is true.

Submitting an appeal does not automatically lift enforcement.

`reversed` must produce an accountable enforcement release/reversal. `modified` must atomically replace or narrow the effective restriction rather than editing history in place.

No new scheduler is required for expiry. Enforcement reads treat elapsed `effective_until` as ineffective, and the next governed mutation may normalize an elapsed active row to `expired` transactionally.

### 12. Existing Safety events should own Candidate B chronology

Current Candidate A event kinds are:

```text
opened
signal_added
review_started
quarantined
released
resolved
evidence_viewed
```

The rows are immutable.

### Decision

Extend the existing event vocabulary rather than adding another audit table.

Candidate B needs event meanings for at least:

```text
assessment_updated
enforcement_applied
enforcement_released
enforcement_expired
enforcement_reversed
appeal_submitted
appeal_review_started
appeal_resolved
media_contained
media_containment_released
```

`signal_added` should remain the canonical case event for provider/detection evidence.

`public.admin_audit_events` remains generic Admin operations history. It is not Candidate B's canonical Safety chronology.

### 13. Case resolution should stay historical even after recovery

An appeal may reverse an enforcement after the originating Safety Case has already resolved.

### Decision

Candidate B should allow appeal/recovery events against a resolved Safety Case without rewriting the case's historical initial outcome.

A case resolved as `enforced` may later have all restrictions reversed. The appeal and enforcement ledgers show that recovery accurately. Do not rewrite history to pretend the original decision never occurred.

### 14. Canonical Media already owns exact file identity and SHA-256 matching authority

Production `media.file_objects` already owns:

```text
id
sha256
byte_size
mime_type
storage provider / namespace / path
delivery URL
verification_state
verification actor/time
```

Verified files require canonical SHA-256 and byte-size evidence.

Candidate A already targets `media.file_objects(id)` directly from Safety Case authority.

### Decision

Candidate B severe-Media exact matching must query canonical verified `media.file_objects.sha256` at execution time.

Do not copy SHA-256 into Safety tables.

A governed exact-match operation may add additional immutable `safety_case_targets` rows for verified file objects whose canonical SHA-256 equals the seed file's canonical SHA-256. The match itself is an identity fact, not an enforcement verdict.

Provider labels and similarity scores must not replace exact canonical SHA matching where exact match is claimed.

### 15. Asset governance already blocks ordinary public Media delivery

`media.asset_governance_versions.public_safety_state` already supports:

```text
internal
review_required
approved_public
approved_redacted
blocked
```

`public.resolve_media_asset_delivery(...)` re-evaluates current governance before ordinary public Media delivery.

### Decision

Candidate B must not invent a second asset-governance model.

Where a severe decision requires asset-wide public blocking, existing Media governance remains the canonical asset-level authority and should be changed only through a narrowly governed Media mutation that preserves current governance history and capability boundaries.

Messages Safety authority must not silently bypass `review_media_governance` by directly updating Media governance rows.

### 16. Exact file containment is still missing

Asset-level governance alone is not enough for a severe exact file boundary.

One verified `media.file_objects` row may be bound through multiple revisions/variants, and future bindings must not make a known contained file deliverable again.

Candidate A has exact Message quarantine but no exact Media-file containment state.

### Decision

Candidate B needs one narrow peer table:

```text
messaging.safety_media_containment
```

It should mirror the historical, non-destructive shape of Message quarantine while referencing canonical `media.file_objects(id)`:

```text
id
media_file_object_id
safety_case_id
status
policy_category
placed_at
placed_by_user_id
released_at nullable
released_by_user_id nullable
release_note nullable
command_receipt_id
```

Initial status:

```text
active
released
```

At most one active containment row may exist per exact file object.

Containment does not mutate file bytes, SHA-256 identity, storage path, or verification history.

### 17. File containment must converge on every real delivery boundary

The live repository has multiple direct Media delivery resolvers. They do not all flow through one function today.

The audit found at least these current file-object delivery boundaries:

```text
public.resolve_media_asset_delivery(...)
public.get_media_private_delivery_target_v1(...)
public.get_public_audio_publication_m1(...)
public.get_public_video_caption_delivery_target(...)
public.get_public_video_transcript_delivery_target(...)
```

Audio publication delivery also resolves waveform and transcript file objects directly. Video caption/transcript delivery resolves protected file objects directly after publication checks.

### Decision

Candidate B must introduce one stable exact-file containment predicate/helper and compound it into every current direct file-delivery path that can return a contained file.

The helper returns only containment eligibility. It does not reveal Safety Case metadata to ordinary Media consumers.

A contained exact file must fail closed for ordinary public/private delivery even if its asset governance otherwise remains approved.

Releasing containment restores ordinary delivery only if all existing Media governance, rights, consent, publication, verification, and access rules also pass.

### 18. Normal Media processing must not become a severe-file escape path

Existing Media processing already uses:

```text
platform_private.command_receipts
platform_private.jobs
platform_private.outbox_events
```

`media.process_revision` carries exact source file identity, canonical SHA-256, byte size, MIME type, and profile version. Generic jobs already support worker leases, retry state, `dead_letter`, and `cancelled` status.

The current Media worker claim functions are intentionally scoped to `media.process_revision`.

### Decision

Candidate B must reuse the generic job substrate, not overload `media.process_revision` and not create a `safety_jobs` table.

A specialist Safety worker must never call the unfiltered generic `platform_private.claim_jobs(...)`, because it could lease unrelated platform jobs.

If Candidate B submits asynchronous Media safety analysis, it should add a new command/job type such as:

```text
messages.safety.media.scan
```

and a narrow service-role claim/complete/fail wrapper that validates that exact command/job type before delegating completion/failure to the existing generic job functions.

Normal Media processing submission/claim must reject or stop newly processing an actively contained source file. Candidate B design must also define how already queued/running normal processing jobs are cancelled or prevented from registering deliverable outputs without inventing another queue.

### 19. Provider output is a signal, not platform authority

The governing contract permits specialist providers but rejects unreviewable external verdicts.

### Decision

Provider adapters may return bounded evidence such as:

```text
provider key
provider/model version
classification label
confidence
provider reference
scan timestamp
```

Candidate B should sanitize this into `safety_case_events.signal_added` and bounded job result payloads. Do not persist provider secrets, access tokens, unrestricted raw payloads, or copied Media bytes in Safety tables.

Initial Candidate B enforcement must remain a WAKILISHA command decision.

A `severe` reviewed case may jump directly to suspension/removal or exact Media containment without prior warning/cooldown. That is the severe bypass. It does not mean a provider response may directly suspend a user.

### 20. Untrusted severe processing needs a separate job type, not a separate Media store

Candidate B has no reason to duplicate Media bytes.

### Decision

A Safety scan job should operate against an exact canonical `media_file_object_id` and a capability-limited internal retrieval path. Its output is a signal event.

Do not copy the file into `messaging` storage merely for scanning.

Do not use ordinary public delivery URLs as the worker authorization model.

The schema/command design must lock the exact worker retrieval contract before any provider runtime is implemented.

### 21. No current user attachment product should be invented in Candidate B

The accepted Messages contract allows future canonical Media references, and recipient policy already has `allow_media`, but current runtime has no `message_media_references` table or binary attachment composer.

### Decision

Candidate B must not expand product scope by creating attachments just to demonstrate `media_restricted`.

The sanction must be real against supported paths today:

- reject link-bearing content for `links_restricted`;
- reject canonical Media Resource references for `media_restricted`;
- require any future Message Media-reference command to call the same sender enforcement helper.

The exit gate must not claim binary attachment enforcement on a product surface that does not exist.

### 22. Community storage remains out of scope

`public.community_blocks` and `public.community_reports` remain Community-owned.

Candidate A already proved private Message reporting/quarantine does not write either table.

### Decision

Candidate B may read compatible block/report signals where policy requires, but it must not write Messages strikes, enforcement, appeal, or severe Media containment into Community tables.

Block/report counts remain signals only.

### 23. `/admin/messages` remains the operator surface

Candidate A already added Safety Case queue/detail, explicit evidence inspection, quarantine/release, and resolution to `/admin/messages`.

### Decision

Candidate B extends that same Safety section with:

- governed case assessment;
- graduated enforcement actions;
- effective restriction history;
- appeal queue/detail and review;
- exact Media target and containment state;
- provider/detection signal summaries without auto-rendering restricted evidence.

Do not create `/admin/safety` or a parallel moderation product.

Ordinary Administrator remains denied. Candidate B continues to reuse `manage_messages_control_center` unless schema design proves a concrete least-privilege requirement that cannot be represented safely with the existing gate.

### 24. The user needs a safe enforcement/recovery surface

A sanctioned user must not receive internal detection metadata, reviewer notes, unrelated cases, or provider payloads.

### Decision

Extend the existing Messages product with a narrow safe enforcement read. It may expose only what the sanctioned user needs to understand current Messages eligibility and, where permitted, appeal:

```text
enforcement_id
action kind
safe user-facing reason/category
effective_until
appeal_allowed
appeal state
```

`get_my_message_access()` should continue to answer operational booleans such as `can_start` and `can_send`, now constrained by effective enforcement.

The appeal command resolves the caller through canonical Person/Auth identity and proves they own the exact enforcement row.

Do not expose hidden Safety confidence, provider source, evidence body, internal notes, or unrelated case history.

## Smallest serious Candidate B model

The audit recommends exactly three new peer tables and extensions to accepted Candidate A rows/functions:

```text
messaging.safety_enforcements
messaging.safety_appeals
messaging.safety_media_containment
```

No fourth generic ledger is justified because `messaging.safety_case_events` already owns immutable chronology.

No new generic queue is justified because `platform_private.jobs` and `platform_private.outbox_events` already own durable asynchronous work.

No new account-access table is justified because Candidate B enforcement is Messages-scoped, not global Auth authority.

No new Media identity table is justified because `media.file_objects` already owns exact file identity and SHA-256.

## Candidate B command boundary

Exact signatures belong to the schema/command design, but the smallest command vocabulary should cover these meanings:

```text
messages.safety.assessment.update
messages.safety.enforcement.update
messages.safety.appeal.submit
messages.safety.appeal.review.start
messages.safety.appeal.resolve
messages.safety.media.containment.update
messages.safety.media.scan
```

### Assessment update

Super Admin only.

Updates reviewed Safety Case assessment fields such as severity and bounded confidence/assessment state. It appends `assessment_updated` and cannot turn raw report count into enforcement.

### Enforcement update

Super Admin only.

Takes exact case + exact Message target + enforcement kind + bounded parameters + reason. It derives the human sender from canonical Message/participant identity and creates/releases/replaces one effective enforcement row idempotently.

Hard enforcement application requires a case that has entered review. Severe cases may apply the selected action directly without lower-step prerequisites.

### Appeal submit

Exact enforcement subject only.

Creates one active appeal where policy permits. It never auto-releases enforcement.

### Appeal review start / resolve

Super Admin only.

Resolution is accountable and idempotent. Reversal/reinstatement changes effective enforcement state atomically and appends the matching Safety events.

### Media containment update

Super Admin only in the initial candidate.

Requires the case to target the exact canonical Media file. Apply/release is idempotent and non-destructive.

### Media scan

Super Admin submission plus service-role worker execution.

Requires an exact canonical Media file target. It creates one job on the existing platform queue and records bounded signal evidence. It cannot directly create a human punishment.

## Server enforcement order

For human Message start/send, Candidate B should preserve existing authority and insert sender Safety evaluation before accepting new communication.

Recommended order:

1. authenticate and resolve canonical Person/Auth identity;
2. load effective sender Safety enforcement under a sender-scoped lock when rate/cooldown checks apply;
3. reject `messaging_suspended` / `messaging_removed` hard send authority;
4. reject new Conversation start when `conversation_start_restricted` applies;
5. enforce cooldown/rate limit from canonical accepted Message chronology;
6. reject link-bearing content when `links_restricted` applies;
7. reject canonical Media Resource references when `media_restricted` applies;
8. continue existing audience, block, membership, first-contact, recipient-policy, and Resource-access checks;
9. write the canonical Message/Conversation/receipt transactionally.

A warning does not block the send path by itself.

Field workflow exceptions remain subject to Safety enforcement.

## Media containment order

For any delivery resolver that is about to return a canonical file object:

1. resolve ordinary Media identity/governance/access as it does today;
2. identify the exact resolved `media_file_object_id`;
3. fail closed when active Safety Media containment exists;
4. return content only if both Media authority and Safety containment permit it.

Safety containment cannot make an otherwise unauthorized Media item deliverable.

## Required schema/command design decisions before SQL

The next design document must lock, at minimum:

1. exact `safety_enforcements` columns, constraints, status vocabulary, and per-kind parameter shape;
2. exact enforcement precedence when multiple active rows overlap;
3. exact expiry semantics without a new scheduler;
4. exact concurrency lock/index strategy for cooldown/rate limits;
5. exact `current_disposition = enforced` resolution invariant;
6. exact assessment mutation fields and who may set `severe`;
7. exact appeal lifecycle, single-active-appeal rule, modification/reversal transaction semantics, and appeal eligibility;
8. exact user-facing safe enforcement projection;
9. exact Message target-to-human derivation for enforcement;
10. exact Media containment table and active uniqueness;
11. exact canonical SHA match expansion rules and verified-file requirement;
12. exact delivery functions that must consult Media containment;
13. exact behavior for normal Media processing jobs when a source becomes contained;
14. exact Safety scan job type, scoped worker claim/complete/fail APIs, and worker retrieval boundary;
15. exact provider signal payload limits and redaction rules;
16. exact command receipts, event kinds, and replay semantics;
17. exact verifier ownership and Preview acceptance ledger.

No SQL should land before these are locked.

## CI and verifier consolidation

Candidate B should preserve Candidate A's accepted verification authority while adding one Candidate B migration-specific rollback verifier for the new schema/behavior and replay proof.

Do not rewrite the Candidate A replay proof to point at Candidate B state.

The Candidate B verifier must exercise the new enforcement/appeal/media-containment invariants and reuse existing Messages regression suites for affected send/start/product behavior.

Do not add a generic Safety UI test family merely to increase test count. Extend an authoritative existing test where ownership is clear, or add one narrow owner only when no accepted test owns the invariant.

## Controlled non-Production acceptance

Candidate B must prove on a disposable Preview before Production:

```text
reviewed Message Safety Case derives exact sender
-> warning records accountable action without blocking send
-> cooldown or rate limit blocks concurrent/early send correctly
-> link restriction blocks link-bearing send
-> Media restriction blocks canonical Media Resource reference
-> conversation-start restriction blocks generic and Field starts
-> temporary suspension blocks send/start but preserves safe enforcement read
-> severe reviewed case can apply suspension/removal without lower ladder
-> appeal can be submitted only by exact subject when allowed
-> appeal does not auto-lift enforcement
-> upheld appeal preserves enforcement
-> reversed appeal restores allowed Messages authority
-> exact canonical Media target matches by canonical verified SHA-256
-> exact-match expansion copies no SHA into Safety storage
-> Media containment blocks every accepted delivery resolver for that exact file
-> Media containment preserves canonical file bytes/identity/history
-> release restores delivery only when ordinary Media governance still permits it
-> Safety scan job uses existing jobs/outbox/retry/dead-letter substrate
-> provider signal records bounded evidence but does not create automatic human punishment
-> Community block/report storage remains unchanged
```

Acceptance must preserve a state ledger and must not use Production as disposable test state.

## What Candidate B must not touch

- Candidate C Legal Request, preservation package, or disclosure authority;
- Phase 8B.6 final antifragile closure;
- Community moderation storage for Messages enforcement/appeals;
- canonical Message body mutability;
- Message deletion/edit semantics;
- canonical Media bytes, SHA-256 ownership, or file identity;
- global Admin user suspension as normal Messages enforcement;
- public Messages audience expansion;
- a new attachment product;
- a new generic job queue, retry engine, dead-letter table, or outbox;
- a new Admin route;
- a new Safety Case or event system;
- MIZIZI/System Actor authority unless explicitly targeted by a later accepted design.

## Recommended implementation sequence

Candidate B should proceed in one serious but contained vertical:

1. lock exact schema/command design from this audit;
2. implement one replay-safe migration for enforcement, appeals, Media containment, Candidate A extensions, command types, helper predicates, and governed RPCs;
3. add one Candidate B rollback-only verifier tied to that migration;
4. extend the existing Messages service, `/messages`, and `/admin/messages` surfaces without a second client/route;
5. wire the common enforcement helper into generic start, Field start, send, and access projection;
6. wire the common exact-file containment predicate into all current delivery resolvers found by the audit;
7. if provider scanning is implemented in this slice, use one new Safety job type on the existing jobs/outbox substrate with a scoped worker API;
8. run local Messages/Media regressions and the complete Production build contract;
9. replay on a fresh disposable Preview, generate schema seal/types, and run controlled behavior acceptance with a state ledger;
10. open the runtime PR only after Preview acceptance;
11. promote exact merged-main SQL, then frontend/runtime surfaces, through the Production runbook;
12. record Production closure before Candidate C begins.

## Audit exit gate

The authority audit is complete when the following are accepted as the Candidate B design basis:

```text
Reuse Candidate A Safety Case/target/event/quarantine spine: YES
Use global account suspension for ordinary Messages sanctions: NO
Add Messages-scoped enforcement ledger: YES
Add dedicated appeal/recovery state: YES
Use existing Safety events for chronology: YES
Use canonical Message sender identity as enforcement subject: YES
Use canonical Message chronology for cooldown/rate limits: YES
Add strike counter system: NO
Add new Message send path: NO
Add new attachment product: NO
Use canonical Media file_object + SHA-256 for exact matching: YES
Copy Media SHA/bytes into Safety tables: NO
Add exact Media-file containment peer state: YES
Reuse existing Media governance for asset-level public blocking: YES
Bypass Media governance capability with direct Safety writes: NO
Reuse existing jobs/outbox/retry/dead-letter substrate: YES
Let provider output become automatic human verdict: NO
Allow severe reviewed cases to bypass lower enforcement steps: YES
Extend /admin/messages rather than new Admin route: YES
Preserve user-safe appeal access without broad Safety metadata: YES
Production mutation during audit: NO
```

## Audit conclusion

Candidate B does not need a second moderation system, account-access system, Media identity model, message counter, attachment product, operator route, or queue.

The smallest serious missing authority is three peer states around Candidate A's accepted Safety Case spine:

1. Messages-scoped human enforcement history/effective state;
2. exact enforcement appeal/recovery state;
3. exact canonical Media-file containment state.

Everything else should compound existing authority: Candidate A events and targets, canonical Message chronology, Person/Auth identity, Media file/SHA/governance/delivery, command receipts, jobs, retries, dead-letter state, outbox, and the existing Messages product surfaces.

That is the correct design basis for #870.