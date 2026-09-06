# Phase 8B Messages Authority and Product Contract

**Status:** Design candidate — documentation only  
**Date:** 6 September 2026  
**Opening accepted main:** `c176841c3a4ebd5c8d7ccb762c07febed8ed308d`  
**Current numbered work:** Phase 8B — Field Triage and Governed Promotion

## Purpose

Phase 8B requires contributor communication, private newsroom triage, safety decisions, immutable intake history, and governed promotion into ordinary canonical workflows.

Messages is the missing communication and workflow fabric needed to support that outcome without making Field Submission, Community, Article, Media, Registry, or Notifications own private messaging.

This contract defines Messages as a first-class WAKILISHA authority and product surface while preserving the programme rule of one authority per object.

It does not create schema, modify runtime behavior, deploy an Edge Function, change frontend code, or promote a Field Submission.

No Messages SQL should be written until this contract is accepted.

## Governing authority

This contract compounds:

- `docs/roadmap/phase-8-to-16-programme-reconciliation.md`;
- `docs/engineering/primitive-compounding-contract.md`;
- `docs/engineering/admin-studio-convergence-audit.md`;
- `docs/engineering/phase-1b-command-job-outbox-audit.md`;
- accepted shared Resource identity, Resource Version, lifecycle, and review-event authority;
- accepted Media identity, immutable file, upload, governance, protected-delivery, and processing authority;
- accepted role and capability authority;
- accepted Trust, Source, Citation, Corrections, and provenance authority;
- accepted Field Submission authority from Phase 8A;
- accepted Registry and MIZIZI authority.

Phase 8B remains bound by the programme requirements that Field triage must not create a second review system and that the original Field file remains governed Media before promotion.

## Product position

Messages is WAKILISHA's secure human/system communication and workflow fabric.

It connects:

- people to people;
- contributors to WAKILISHA staff;
- system actors to authorized humans;
- Resources to conversations;
- exact Resource Versions to review conversations;
- canonical workflow events to conversation projections.

Messages does not become the authority for the objects or actions it references.

A Message may reference an Article version and present `Approve`, but Article/Resource review authority performs the approval. A Message saying "approve" has no canonical effect.

Message content is untrusted input. Text, links, Media, Resource cards, external content, and future AI-generated content cannot confer authority.

## Repository authority audit

### Reuse unchanged

Messages must reuse the following established authorities rather than creating substitutes.

#### Resource and review

Reuse:

- canonical `editorial.resources` identity;
- immutable Resource Versions;
- shared lifecycle/review-event meaning;
- exact-version review targeting;
- canonical domain commands for submit, request changes, approve, reject, and other governed actions.

Messages may project workflow state. It does not create `message_review_events` or domain-specific approval authority.

#### Command, job, and outbox

Reuse:

- `platform_private.command_types`;
- command receipts;
- principal-scoped idempotency;
- durable jobs;
- worker leases, retries, and dead letters;
- transactional outbox.

Messages must not create another generic server job queue or delivery orchestration system.

#### Media

Reuse canonical Media for:

- logical Media identity;
- exact immutable files;
- SHA-256 identity;
- revisions and variants;
- governance;
- source protection;
- embargo;
- preservation and retention;
- protected delivery.

A Message that shares footage references canonical Media. It does not duplicate the upload or create a message-owned file authority.

Conversation membership alone never grants Media access.

#### Admin interaction primitives

Where meanings overlap, reuse canonical primitives including:

- `AdminRecordHeader`;
- `AdminRecordActions`;
- `AdminStatusBadge`;
- `AdminSaveState`;
- `AdminWorkspaceSection`;
- `AdminCollectionHeader`;
- `AdminModeComposer`;
- `EditorialWorkflowRail`;
- `EditorialDecisionWorkspace`;
- `EditorialTextDiff`.

Messages may create new candidate interaction primitives only for genuinely new Messages semantics.

#### MIZIZI

MIZIZI remains the permanent Registry data-hygiene agent with stable agent key `mizizi`.

Messages does not give MIZIZI new Registry authority. It provides a governed communication surface through which MIZIZI may send permitted operational updates to authorized recipients.

### Existing semantics that may inform but do not own Messages

Community block/report behavior provides useful product semantics, but Community's Post/person/Artist-oriented storage is not private Messages moderation authority.

Existing notifications may alert a user that a private Message exists, but notification payloads must not become the Message body store and must not leak sensitive Field or conversation content.

The existing Registry review system remains Registry-owned and is not replaced by Messages.

### Genuinely missing authority

The repository audit identifies these missing platform concepts:

1. Conversation and Message authority;
2. Message delivery/read receipt authority;
3. Messages mailbox routing and first-contact permission authority;
4. accountable System Actor identity distinct from the coarse service credential;
5. a Messages audience/deployment control capable of later progression to public use;
6. private Messages Safety Case and quarantine authority;
7. legal request, preservation, and scoped disclosure-production authority.

These concepts must remain separate where their ownership differs. They must not be collapsed into one giant Messages table.

## Canonical Messages primitive family

Exact table names are deferred to schema design. The semantic family is locked as follows.

### Conversation

A Conversation owns private communication context.

It preserves at minimum:

- stable identity;
- participant membership;
- security classification;
- status;
- creation time;
- last meaningful activity time;
- correlation/provenance where created from another governed workflow.

Initial security classifications:

- `standard`;
- `restricted`;
- `confidential`.

A conversation that references protected context may not be classified less restrictively than that context permits.

### Participant

A participant identifies who is permitted to take part in a Conversation and in what accountable capacity.

Participant/actor kinds must support at least:

- human;
- system;
- automation.

A future AI/service actor may use the same accountable actor substrate but receives only explicit delegated permissions.

### Message

A Message is an immutable communication identity owned by one Conversation.

It preserves at minimum:

- stable identity;
- Conversation identity;
- accountable sender identity;
- body or typed non-body presentation;
- authoritative server acceptance timestamp;
- creation provenance/correlation where applicable.

If editing or withdrawal is later introduced, it must be modeled explicitly and must not silently rewrite historical meaning.

### Timestamps and receipts

Timestamps are first-class authority.

Server time, not the sender device clock, owns authoritative chronology.

The design must distinguish where applicable:

- `created_at` or sender-origin time where preserved;
- `accepted_at`;
- `delivered_at`;
- `read_at`;
- request accepted/declined time;
- spam classification time;
- quarantine time;
- canonical workflow-event time.

For workflow projections, the canonical workflow event timestamp remains authoritative.

### Resource reference

A Message may reference a canonical Resource and, where exact review state matters, a canonical Resource Version.

Conceptually:

```text
resource_id
resource_kind
resource_version_id?
presentation_kind
```

Messages does not copy Resource content as new authority.

### Workflow projection

Messages may present actions such as:

- open;
- compare versions;
- submit for review;
- request changes;
- approve.

The available action is a typed intent into the target Resource's existing command/capability/concurrency/idempotency authority.

There must be no `messages_approve_article()`-style competing workflow command.

### Media reference

A Message may reference canonical Media.

Access requires both:

1. permission to the Conversation; and
2. permission to the underlying Media/Resource.

Sharing or forwarding a reference never elevates underlying access.

## Mailbox and delivery-classification contract

Messages must prefer classification and user control over premature deletion.

Initial user mailbox semantics are:

### Inbox

For correspondence the recipient has permitted through policy, accepted relationship, existing conversation, staff/system rule, or another governed eligibility rule.

### Requests

For otherwise valid first-contact Messages from senders the user has not yet approved for ordinary Inbox delivery.

The recipient may review, accept, decline, block, or report the request.

Accepting a Message Request creates messaging permission for the relevant relationship/conversation. It does not silently create an unrelated Community follow or other social relationship.

### Spam

For suspected unsolicited, bulk, deceptive, repetitive, low-trust, or otherwise unwanted Messages that are still safe and lawful enough to be delivered into a user-controlled Spam folder.

Spam classification is not deletion and is not proof of a policy violation.

A user may inspect, restore, block, or report Spam at their discretion.

### Archive

Archive is user organization. It is not enforcement and does not change sender authority.

### Platform quarantine is not a mailbox folder

High-confidence severe or prohibited material must not be delivered merely so the recipient can inspect it in Spam.

Platform quarantine is a separate Trust & Safety disposition that can stop delivery, download, forwarding, or further propagation while preserving governed evidence.

The required conceptual split is:

```text
safe ordinary delivery
    -> Inbox / Requests / Spam / Archive

severe platform-safety condition
    -> Safety Case / Quarantine / investigation / disposition
```

## User messaging preferences

Each user must have a server-enforced Messages privacy policy accessible from Profile settings through a custom WAKILISHA interaction surface.

The policy must be capable of expressing who may contact the user, including categories such as:

- existing approved conversations/relationships;
- WAKILISHA staff;
- verified System Actors;
- contributors;
- members;
- eventually the broader WAKILISHA public when enabled.

The policy must also support first-contact behavior, including whether an otherwise eligible unapproved sender:

- reaches Requests;
- is rejected.

Where useful, policy may separately control higher-risk first-contact capabilities such as links, Media, or Resource references.

These settings are authorization inputs. Frontend visibility alone is never sufficient enforcement.

## Audience progression

Messages must be architected once so broader WAKILISHA public use can be enabled later without rewriting its core schema.

Initial deployment may remain narrow while the control plane supports progressive audience modes conceptually:

```text
internal
-> contributors
-> members
-> public
```

This is not a single dangerous global DM boolean.

Audience mode works together with user privacy preferences, sender capabilities, recipient eligibility, first-contact routing, and abuse controls.

Changing platform audience mode must never weaken existing Conversation membership, classification, Resource access, or user-specific privacy choices.

## System Actor contract

The current service credential is too coarse to provide durable accountability for MIZIZI and future system participants.

Phase 8B therefore requires an accountable System Actor primitive.

A System Actor must preserve at minimum:

- stable actor key;
- label;
- actor kind;
- status;
- capability profile;
- allowed message purposes;
- recipient scope;
- Resource/action scope where relevant.

The executing service credential and accountable actor identity remain distinct.

MIZIZI is the first real proof with accountable identity conceptually `system:mizizi`.

There is no god-mode system principal.

A System Actor may send a Message only through an explicitly authorized governed path. A Message sent by a System Actor cannot grant that actor additional authority.

## MIZIZI standup proof

MIZIZI should become the first system-to-human Messages consumer.

Its daily operational update should reuse actual governed run evidence such as scans, repairs, review escalations, observations, stale findings, and items requiring attention.

Scheduling and durable delivery work must reuse existing jobs and transactional outbox.

Messages provides the delivery surface; it does not create another scheduler.

A compact presentation may resemble:

```text
MIZIZI
09:00

Yesterday
Tracks scanned 14,280
Repairs applied 31
Sent to review 4
Observations 89
Stale candidates 0

2 items need you.
[Open review]
```

The UI should remain quiet and operational rather than explanatory.

## Field contact integration

Phase 8B must extend Field contributor communication without making Field Submission own messaging.

The Field contact choice should converge on:

```text
Messages
Email
Phone
Do not contact me
```

Phone must reuse/generalize the existing WAKILISHA custom international phone/calling-code interaction rather than creating another country-phone implementation.

Contact permission and contact point are distinct concepts.

A conceptual separation is:

```text
follow_up_permission = allowed | not_allowed
preferred_contact_channel = messages | email | phone
contact_point_id = nullable
```

Messages requires no duplicated raw email or phone PII.

Raw contact PII should not be copied into ordinary Field review snapshots or projections.

## Trust & Safety boundary

Messages delivery classification and Trust & Safety enforcement are related but different.

Trust & Safety must support graduated dispositions for ordinary abuse while permitting severe categories to bypass the ordinary ladder.

Potential controls include:

- warnings;
- challenge/friction;
- temporary messaging limits;
- link/attachment restrictions;
- conversation-start restrictions;
- suspension;
- removal;
- appeal/reinstatement where permitted.

Reports are signals, not verdicts.

Detection should consider overlapping signals rather than IP alone, including:

- account behavior;
- conversation and recipient fan-out;
- session/device risk;
- network risk groups;
- duplicate/near-duplicate content;
- repeated unwanted contact;
- URL/domain risk;
- block/report history;
- attachment safety;
- coordinated graph behavior.

For severe Media, canonical exact Media identity should pass through an isolated untrusted-processing boundary before normal delivery where appropriate.

Known-illegal-content and specialist safety classification should use appropriate specialist services/providers rather than a homemade classifier presented as sufficient authority.

## Safety Case boundary

Private-message safety cases are genuinely missing and must not be stuffed into Community storage.

A Safety Case conceptually binds:

- target Message/Media identity;
- detection source;
- policy category;
- confidence;
- disposition;
- timestamps;
- reviewer/escalation state;
- reporting state;
- preservation state where required.

Safety Case is peer authority. It does not own the Message or Media it evaluates.

High-confidence severe containment must be capable of halting delivery/forwarding/download, constraining related messaging activity where warranted, locating exact matching Media identities, preserving governed evidence, and scheduling required reporting without destructive deletion.

## Legal request and disclosure boundary

Messages must not create an unrestricted administrator data-dump path.

A separate Legal Request Case and Legal Disclosure Package authority is required for lawful preservation and production.

Preservation and disclosure are separate operations.

Potentially producible material should be classified as:

- `RESPONSIVE`;
- `ELEVATED REVIEW`;
- `EXCLUDED`.

Final legal entitlement is not decided by software alone. Jurisdiction, process, scope, notice restrictions, emergency rules, and reporting obligations require policy/counsel authority appropriate to the relevant jurisdiction.

A disclosure production must be exact and auditable, including where applicable:

- production ID;
- request/case ID;
- generation timestamp;
- approval identities;
- exact object manifest;
- per-object SHA-256;
- manifest SHA-256;
- scope statement;
- documented omissions/exceptions;
- signed production where the platform later supports signing.

Adjacent conversations and unrelated protected Resources must not leak into a scoped production.

## Super Admin Messages Control Center

Messages requires a first-class operator surface at `/admin/messages`.

This control center is restricted to the Super Admin role and users explicitly assigned that role.

Ordinary administrators, editors, reviewers, contributors, moderators, or staff do not gain access merely because they have another administrative capability.

The backend authority must enforce the same boundary. Route hiding or navigation hiding is not access control.

The Control Center information architecture is:

```text
Messages
├── Inbox
├── Safety
├── Agents
├── Operations
├── Legal
└── Settings
```

### Inbox

Super Admin operational conversation surface, subject to underlying Conversation/Resource protections.

### Safety

Safety Cases, quarantines, reports, enforcement, appeals, and protected evidence inspection.

Known or suspected severe material must not auto-render merely because the viewer is Super Admin. Restricted evidence inspection remains deliberate and audited.

### Agents

System Actor identity, health, permitted messaging scope, recent work, failures, scheduled standups, and disable/kill controls.

Disabling an actor's messaging capability should not implicitly disable unrelated domain authority unless explicitly designed to do so.

### Operations

Delivery health, jobs, outbox, retry/dead-letter state, rate pressure, abuse clusters, scanner health, queue health, and latency.

### Legal

Legal Request Cases, preservation, scoped review, production manifests, approvals, and production history.

### Settings

Audience mode, platform messaging eligibility, sender capability policy, and other system-level Messages controls.

## Super Admin visibility does not mean ambient private-content exposure

The Super Admin role controls the system, but WAKILISHA should still preserve deliberate access boundaries for restricted sources, quarantined evidence, legal-case material, and other exceptionally sensitive content.

Sensitive content should not be globally preloaded or indexed into ordinary administrative search simply because the operator has broad authority.

Every high-risk access should remain attributable and auditable.

## WAKILISHA interaction contract

The visible Messages product should use WAKILISHA's own interaction language rather than expose raw browser chrome as the product design.

Custom product interaction does not mean abandoning semantic HTML or accessibility.

Keyboard behavior, focus management, accessible names, reduced-motion behavior, appropriate ARIA semantics, and mobile ergonomics remain required.

Potential new candidate primitives include:

- `WkConversationList`;
- `WkMessageBubble`;
- `WkMessageComposer`;
- `WkMessageTimestamp`;
- `WkMailboxTabs`;
- `WkMessageRequest`;
- `WkParticipantPicker`;
- `WkResourceMessageCard`;
- `WkWorkflowMessageCard`;
- `WkMessagingPrivacyControl`;
- `WkSafetyBadge`;
- `WkEvidenceCard`;
- `WkTimeline`.

These are candidates only when implemented for a real consumer. They must follow the Primitive Compounding Contract and may not be declared canonical by prediction.

Avoid exposing default browser-looking `<select>`, date controls, raw checkbox matrices, `window.confirm()`, or browser file-input presentation when a governed WAKILISHA interaction is required.

The underlying semantic element may still be native where that is the correct accessible implementation.

## Privacy and encryption posture

Messages must not claim iMessage-style end-to-end encryption unless WAKILISHA actually implements a trusted-device/key-distribution design compatible with its product requirements.

Initial architecture should target high-assurance service-side protection, including:

- TLS in transit;
- encryption at rest;
- narrow decrypt authority;
- key rotation;
- audited sensitive access;
- envelope/per-security-domain keying where selected during implementation;
- no secrets or key material exposed through ordinary application reads.

A future sealed client-held-key conversation mode, if ever required for extreme source protection, would be a distinct security product with different tradeoffs. It is not implied by this contract.

## Six-phase implementation plan

The implementation programme is deliberately six serious phases. Individual PRs remain the smallest independently reviewable, deployable, reversible, and provable milestones; PR count does not redefine the programme.

### 8B.1 — Authority & Product Contract

This document.

Exit:

- existing versus missing authority is explicit;
- ownership boundaries are accepted;
- mailbox, privacy, Super Admin, System Actor, Safety, Legal, and interaction contracts are locked enough to begin schema design;
- no SQL has been created.

### 8B.2 — Messages Core

Implement the minimum generic authority for:

- Conversation;
- Participant;
- Message;
- timestamps/receipts;
- Inbox/Requests/Spam/Archive routing;
- user messaging preferences;
- RLS/capability enforcement;
- command/idempotency/outbox integration;
- Resource/Version references.

Exit:

Two authorized controlled users communicate through each ordinary mailbox state, permissions are server-enforced, direct-table mutation is denied, and no Message can mutate a Resource by itself.

### 8B.3 — Product + Super Admin Control Center

Implement the user Messages surfaces, Profile messaging privacy settings, and `/admin/messages` Control Center using WAKILISHA interaction primitives.

Exit:

The complete narrow Messages product is usable on supported desktop/mobile surfaces, the Super Admin boundary is proven server-side, and ordinary administrative roles cannot access the Control Center.

### 8B.4 — System Actors + Real Verticals

Prove the shared authority through:

1. MIZIZI -> Super Admin governed daily standup;
2. Field contributor <-> newsroom Messages;
3. at least one exact-version editorial Resource review projection/action through Messages.

Exit:

Human-to-human, system-to-human, and Resource/workflow communication all use the same Messages authority without copying Registry, Field, Resource, or review authority.

### 8B.5 — Trust, Safety & Legal

Add Safety Cases, quarantine, graduated enforcement, appeals/recovery, severe-Media safety boundaries, legal preservation, scoped disclosure, and corresponding Super Admin operations.

Exit:

Ordinary uncertainty routes through Requests/Spam rather than destructive deletion, severe synthetic safety conditions are contained before recipient exposure where the scenario is designed to detect them, and scoped legal production cannot leak adjacent private data.

### 8B.6 — Antifragile Acceptance + Phase Closure

Run adversarial controlled acceptance representing up to one million potential hostile actors with inert/synthetic prohibited-content signals rather than real harmful material.

Test at minimum:

- mass unsolicited DM attempts;
- account-creation swarms;
- phishing and rotating domains;
- duplicate and near-duplicate content;
- Unicode/obfuscation;
- AI-generated unique spam;
- slow-and-low fan-out;
- compromised established accounts;
- malicious-attachment synthetic signals;
- recipient enumeration;
- block evasion;
- coordinated report brigading;
- prompt injection in Message/Resource content;
- fake workflow-action text;
- System Actor impersonation;
- load intended to starve priority Field/editorial traffic.

Exit must prove:

- Inbox/Requests/Spam remain operational under hostile load;
- bounded abuse blast radius;
- no Message or AI content confers authority;
- zero fake-message workflow approval;
- zero restricted Field/Media leaks in the controlled acceptance;
- no System Actor can impersonate another actor;
- priority workflow traffic remains serviceable;
- moderation queues remain bounded through clustering/deduplication strategies selected during implementation;
- synthetic mandatory-reporting paths are idempotent where such adapters are enabled;
- quarantine prevents delivery while preserving governed evidence;
- one scoped legal production cannot leak adjacent conversations;
- retries do not create duplicate Messages/reports or orphan Media;
- false-positive appeal/reinstatement preserves history;
- the system recovers after hostile load stops.

The original Phase 8B programme exit remains binding: one Field Submission must enter private review, receive a safety decision, and produce one safe canonical draft or reviewed evidence target without losing original Media identity or provenance.

## First promotion target

The first Phase 8B promotion proof should prefer canonical Source rather than invent a new reviewed Field-content object.

Source already has stable identity, immutable versions, review semantics, and an internal/non-public posture suitable for evidence promotion.

The first vertical should therefore aim conceptually for:

```text
accepted Field Submission
-> private newsroom triage
-> exact immutable Field review snapshot
-> shared review lifecycle
-> safety/verification decision
-> canonical Media governance preserved/advanced
-> canonical internal Source + immutable Source version
-> append-only Field promotion provenance
```

The original `field_original` remains unchanged canonical Media.

## Non-goals

Phase 8B must not build:

- a Slack clone;
- public group chat;
- channels;
- calls or voice chat;
- presence/typing infrastructure;
- reactions merely for parity with consumer messengers;
- a second Resource review system;
- a second Media store or upload system;
- a second notification queue;
- a second generic job/outbox system;
- a generic administrator private-data export;
- an omnipotent System Actor;
- a universal AI authority;
- a new Community moderation database disguised as Messages;
- a claim of end-to-end encryption that the architecture does not actually provide.

The core schema may be future-facing enough to support wider public messaging, but speculative social features are not implementation requirements for Phase 8B.

## Primitive impact declaration

### Reused authority/foundation primitives

- Resource identity and exact Resource Versions;
- shared lifecycle/review events;
- capability authority;
- command receipts, idempotency, jobs, and transactional outbox;
- Media identity/governance/protected delivery;
- Trust/Source/Citation/Corrections/provenance;
- Field Submission;
- Registry and MIZIZI authority.

### Reused canonical interaction/presentation primitives

- existing Admin and Editorial canonical primitives where their semantics match.

### New authority primitives requiring implementation proof

- Conversation;
- Participant;
- Message;
- Message Receipt;
- mailbox/first-contact policy;
- System Actor;
- Safety Case;
- Legal Request Case and Disclosure Package;
- Messages audience/deployment control.

### New interaction candidates

Only those Messages-specific interaction primitives actually implemented for real product surfaces should be registered as candidates.

## 8B.1 acceptance gate

This documentation phase is ready to close only when:

- the design is reviewed against exact accepted main;
- no existing authority is silently duplicated;
- the six-phase implementation plan is accepted;
- user Inbox/Requests/Spam/Archive semantics are accepted;
- user messaging privacy controls are accepted;
- Super Admin-only Control Center access is accepted;
- System Actor accountability is accepted;
- Safety Case versus Spam separation is accepted;
- Legal preservation/disclosure remains separate authority;
- WAKILISHA custom interaction rules are accepted;
- no SQL, Edge Function, or frontend implementation is included in the documentation candidate.

Only then may Phase 8B.2 Messages Core schema design begin.
