# Phase 8B.5 Candidate A Safety Case and Quarantine Schema/Command Design

**Status:** Design candidate, documentation only  
**Date:** 7 September 2026  
**Parent:** #868  
**Candidate:** #869  
**Accepted audit merge:** `de2d47ca0030d8e880a0136db4b1cdea8ae3388a`

## Purpose

Lock the smallest database, command, read, and operator contract for Phase 8B.5 Candidate A before SQL.

Candidate A adds private Messages Safety Case and quarantine authority while preserving canonical Message, Media, Community, command/job/outbox, and Super Admin boundaries.

This design does not implement Candidate B enforcement/recovery or Candidate C Legal authority.

## Governing authority

This design compounds:

- `docs/engineering/phase-8b-messages-authority-and-product-contract.md`;
- `docs/engineering/phase-8b5-candidate-a-safety-case-quarantine-authority-audit.md`;
- accepted Phase 8B Messages core and user-command authority;
- accepted Super Admin Messages control-center authority;
- accepted Community Block/Report semantics;
- canonical Media file identity and governance authority;
- existing command receipts, durable jobs, retries, dead letters, and transactional outbox.

## Locked ownership boundaries

Candidate A owns private Messages safety cases and quarantine state.

It does not own or duplicate:

- Message identity or Message body;
- Conversation membership;
- mailbox organization;
- Community Block/Report storage;
- Media files, SHA-256 identity, revisions, variants, governance, or protected delivery;
- generic command receipts;
- generic jobs, retries, dead letters, or transactional outbox;
- account-wide enforcement or appeal state;
- Legal preservation or disclosure production.

## Schema

Candidate A adds exactly four peer-authority tables in `messaging`.

### `messaging.safety_cases`

One row is the stable identity and current summary of a private Messages safety case.

Required columns:

```text
id uuid primary key
case_kind text not null default 'message_safety'
status text not null
policy_category text not null
severity text not null
confidence numeric(5,4) null
current_disposition text not null
source_kind text not null
source_ref text null
created_by_user_id uuid null
created_at timestamptz not null
updated_at timestamptz not null
reviewed_by_user_id uuid null
review_started_at timestamptz null
resolved_by_user_id uuid null
resolved_at timestamptz null
resolution_note text null
```

Locked values for Candidate A:

```text
case_kind: message_safety
status: open | under_review | resolved
severity: low | medium | high | severe
current_disposition: pending | no_action | quarantine
source_kind: user_report | staff | automated_signal
```

`automated_signal` is schema-compatible for later use. Candidate A does not add a classifier or automated verdict pipeline.

`confidence`, when present, is bounded from 0 through 1. It is evidence metadata, not authority to punish or quarantine automatically.

`resolution_note` is bounded text and must never become a copy of Message content.

### `messaging.safety_case_targets`

This table binds a Safety Case to exact canonical evidence targets.

Required columns:

```text
id uuid primary key
safety_case_id uuid not null
message_id uuid null
media_file_object_id uuid null
linked_at timestamptz not null
```

Invariants:

- exactly one of `message_id` or `media_file_object_id` is non-null;
- `message_id` references `messaging.messages(id)`;
- `media_file_object_id` references canonical `media.file_objects(id)`;
- the same exact target may appear only once within one Safety Case;
- target rows are immutable after insert;
- no Message body, Media bytes, SHA-256 value, storage key, or derivative payload is copied into this table.

A Message target and a Media target are separate links even when the Media was shared through that Message.

### `messaging.safety_case_events`

This append-only ledger records authoritative case chronology and deliberate evidence access.

Required columns:

```text
id uuid primary key
safety_case_id uuid not null
event_kind text not null
actor_kind text not null
actor_user_id uuid null
actor_person_resource_id uuid null
actor_key text null
command_receipt_id uuid null
occurred_at timestamptz not null
metadata jsonb not null default '{}'
```

Candidate A event kinds:

```text
opened
signal_added
review_started
quarantined
released
resolved
evidence_viewed
```

Actor shape must be accountable. Human events bind to the canonical user/Person where available. System/automation events bind to an accountable actor key and may not masquerade as a human.

`metadata` is bounded and typed by event kind. It must not contain Message bodies, Media bytes, unrestricted private payloads, access tokens, or secrets.

Rows are immutable after insert.

### `messaging.message_quarantine`

This table owns current and historical quarantine placement for exact Messages.

Required columns:

```text
id uuid primary key
message_id uuid not null
safety_case_id uuid not null
status text not null
policy_category text not null
placed_at timestamptz not null
placed_by_user_id uuid not null
released_at timestamptz null
released_by_user_id uuid null
release_note text null
command_receipt_id uuid null
```

Locked values:

```text
status: active | released
```

Invariants:

- at most one active quarantine row per Message;
- quarantine must reference a Safety Case that targets the same Message;
- released rows remain historical evidence and are never deleted to represent release;
- active rows have no release actor/time;
- released rows have both release actor and release time;
- quarantine does not mutate or delete the canonical Message row.

## Direct table access

All four tables:

- enable RLS;
- revoke direct table access from `public`, `anon`, `authenticated`, and `service_role` unless an existing tightly scoped internal runtime primitive requires otherwise;
- expose browser behavior only through governed RPCs;
- do not rely on frontend route hiding for authorization.

The existing `manage_messages_control_center` capability remains the Candidate A Super Admin gate. Candidate A does not create another Safety administrator role or parallel control-center capability.

## Command receipt contract

Candidate A reuses `platform_private.command_types`, `platform_private.command_receipts`, `platform_private.begin_authenticated_resource_command(...)`, the existing request fingerprint authority, and `platform_private.complete_resource_command(...)`.

New command types:

```text
messages.safety.report
messages.safety.review.start
messages.safety.quarantine.update
messages.safety.resolve
messages.safety.evidence.inspect
```

Each command has the existing accepted/succeeded/failed/retry event naming pattern and preserves principal-scoped idempotency.

No new receipt table or idempotency ledger is permitted.

## Public command and read contract

### Participant report

```text
public.report_message_safety_v1(
  p_message_id uuid,
  p_policy_category text,
  p_note text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
```

Rules:

1. caller must resolve through `messaging.current_human_identity()`;
2. caller must be an active participant in the Message's Conversation;
3. caller cannot use report count or severity input to create an automatic platform verdict;
4. Candidate A accepts a bounded policy category and bounded optional note;
5. the command creates or replays one Safety Case, one exact Message target, and one `opened` event;
6. it does not alter Message body, Message sender, Message chronology, Community report rows, Community block rows, or canonical Media;
7. replay returns the original case identity without duplicate targets/events.

Candidate A initially creates user-report cases with:

```text
status = open
current_disposition = pending
source_kind = user_report
```

The participant cannot directly set quarantine, `severe`, or a final resolution through this command.

### Super Admin case list

```text
public.list_messages_safety_cases_v1(
  p_status text default null,
  p_before_updated_at timestamptz default null,
  p_before_case_id uuid default null,
  p_limit integer default 50
)
```

Requires `manage_messages_control_center`.

Returns operational case summary only. It must not return Message body, Media bytes, raw file paths, private Conversation history, or hidden unrelated context.

Expected summary includes:

```text
case_id
status
policy_category
severity
current_disposition
source_kind
created_at
updated_at
message_target_count
media_target_count
active_quarantine_count
```

### Super Admin case detail

```text
public.get_messages_safety_case_v1(
  p_case_id uuid
)
```

Requires `manage_messages_control_center`.

Returns:

- case summary;
- exact target identifiers and safe presentation metadata;
- case event chronology excluding Message body and Media payload;
- quarantine state.

It does not constitute evidence inspection.

### Start review

```text
public.start_messages_safety_review_v1(
  p_case_id uuid,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
```

Requires `manage_messages_control_center`.

Transitions `open` to `under_review`, records reviewer identity/time, appends `review_started`, and is idempotent.

It cannot reopen a resolved case in Candidate A.

### Quarantine update

```text
public.set_message_quarantine_v1(
  p_case_id uuid,
  p_message_id uuid,
  p_quarantined boolean,
  p_reason text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
```

Requires `manage_messages_control_center`.

Rules:

- case must target the exact Message;
- active quarantine creates one historical placement row and appends `quarantined`;
- repeated equivalent requests replay safely;
- release changes the active placement to `released`, preserves the row, and appends `released`;
- the command never deletes or rewrites the Message;
- quarantine does not silently suspend the sender or alter unrelated Conversations;
- active quarantine must be visible in case operations but hidden from ordinary user projections.

### Resolve case

```text
public.resolve_message_safety_case_v1(
  p_case_id uuid,
  p_disposition text,
  p_resolution_note text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
```

Requires `manage_messages_control_center`.

Candidate A permits final disposition:

```text
no_action | quarantine
```

Rules:

- resolution records exact reviewer/time and appends `resolved`;
- `no_action` requires no active quarantine owned by the case;
- `quarantine` requires at least one active quarantine target owned by the case;
- resolution cannot delete evidence or Message rows;
- Candidate A does not add sender suspension, strike counts, appeal state, or reinstatement.

### Deliberate evidence inspection

```text
public.inspect_message_safety_evidence_v1(
  p_case_id uuid,
  p_message_id uuid,
  p_reason text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
```

Requires `manage_messages_control_center`.

The function must:

1. prove the Safety Case targets the exact Message;
2. require a bounded non-empty inspection reason;
3. create/replay the command receipt;
4. append one immutable `evidence_viewed` event before returning evidence;
5. return only the exact targeted Message evidence needed for Candidate A;
6. never expose adjacent Messages merely because they share the Conversation;
7. never expose an attached or related Media file unless the case separately targets that canonical Media identity and a later governed Media evidence path permits it.

The return may include the exact Message body, accepted timestamp, accountable sender presentation, and Conversation identifier. It must not return unrelated Conversation history.

## Quarantine projection rule

An active `messaging.message_quarantine` row changes ordinary Messages delivery/read projection, not canonical Message storage.

The existing user-facing read authority must be updated so active-quarantine Messages are excluded from:

- latest Message previews;
- Conversation Message lists;
- unread counts;
- mark-read mutation targets;
- recipient delivery/read projection.

The Conversation itself remains available when other deliverable content or membership still makes it visible.

A released quarantine restores ordinary projection eligibility subject to all other existing Messages rules.

This rule must be implemented in the existing Messages read/receipt functions. Candidate A must not create a second user inbox/read stack.

## Message send boundary

Candidate A does not add a new send path.

New Messages continue through the accepted send commands. A Message may be accepted into canonical immutable storage and later quarantined by Safety authority. Candidate A does not use destructive pre-send deletion as its containment model.

Candidate B may add isolated attachment/Media scanning boundaries where required. Candidate A only establishes the exact peer authority needed to contain an already identified Message.

## Media boundary

Candidate A may bind a case target to `media.file_objects(id)` because that row is the canonical exact file identity.

Candidate A does not:

- copy `sha256` into Safety tables;
- copy file bytes or storage paths;
- create another Media revision or variant model;
- grant access to a file merely because a Safety Case exists;
- implement specialist classifier/provider integration.

Evidence access to canonical Media remains governed by Media authority. Candidate B owns the severe-Media processing and provider boundary.

## Community boundary

`public.community_blocks` and `public.community_reports` remain Community-owned.

Candidate A may reuse compatible policy-category vocabulary and interaction meaning where useful, but:

- `report_message_safety_v1` writes no Community report row;
- quarantine writes no Community block row;
- a Community report does not automatically create a private Messages verdict;
- a private Messages Safety Case does not automatically mutate Community state.

## Super Admin product shape

Candidate A extends the existing `/admin/messages` page. It does not add another Admin route.

The page gains a Safety mode/section with:

- case queue;
- status, category, severity, disposition, source, and updated time;
- exact case detail;
- explicit `Start Review`;
- explicit `Inspect Evidence` with reason collection;
- explicit `Quarantine Message` / `Release Message`;
- explicit case resolution.

No Message body auto-renders in the list or case detail. Evidence content appears only after the explicit governed inspection command succeeds.

Existing aggregates and System Actor operations remain intact.

Because Candidate A compounds `/admin/messages`, it must not change Admin route-count authority.

## Service layer

Extend `src/services/messages.ts` with typed Safety operations. Do not introduce a second Messages client.

Expected types:

```text
MessagesSafetyCaseSummary
MessagesSafetyCaseDetail
MessagesSafetyCaseEvent
MessagesSafetyTarget
MessagesQuarantineState
MessagesSafetyEvidence
```

Expected functions mirror the governed RPCs above.

Frontend-generated idempotency keys continue through the existing `actionKey(...)` pattern.

## CI and verifier consolidation

Candidate A extends existing Messages control-plane verification rather than creating a redundant generic safety test family.

The permanent verifier must prove at minimum:

1. all four Safety tables exist with RLS enabled;
2. browser roles lack direct table grants;
3. all five new command types exist and are enabled;
4. participant-only reporting boundary;
5. exact Message target binding;
6. idempotent report replay;
7. report does not create Community report/block rows;
8. Super Admin case reads return no Message body;
9. ordinary administrator is denied Safety operations;
10. evidence inspection requires explicit reason and logs `evidence_viewed` before evidence return;
11. evidence return is exact-target only;
12. quarantine hides the Message from ordinary list/detail/unread/read projection;
13. canonical Message row/body remains unchanged;
14. quarantine release restores ordinary projection eligibility;
15. quarantine history remains preserved;
16. case resolution state/quarantine invariants hold;
17. no Safety table duplicates Media SHA-256 or binary/storage authority;
18. migration replay remains deterministic.

Where a TypeScript contract already owns `/admin/messages` and `src/services/messages.ts`, extend it rather than adding a parallel UI-contract test file.

## Controlled acceptance

Before Production closure, Candidate A must prove with a controlled non-Production runtime:

```text
participant reports exact Message
-> one open Safety Case
-> Super Admin queue shows safe summary only
-> unauthorized operator denied
-> explicit evidence inspection records immutable access event
-> exact Message evidence appears only after inspection
-> quarantine removes Message from ordinary delivery/read projections
-> canonical Message remains intact
-> release restores ordinary eligibility
-> no Community moderation row created
```

Acceptance must preserve a state ledger for every created case/quarantine row and must not use the Production database as disposable test state.

## Exit gate

Candidate A can close only when:

- schema/command migration is replay-safe;
- existing Messages authority remains intact;
- CI and build are green;
- controlled runtime acceptance proves the boundaries above;
- Production deployment and rollback authority are verified;
- Production closure is documented;
- #869 closes before Candidate B #870 begins.

## Explicit non-goals

Candidate A does not implement:

- account strikes;
- temporary messaging limits;
- sender suspension/removal;
- appeal or reinstatement;
- severe-content provider integration;
- exact-match cross-platform Media detection;
- Legal Request Cases;
- preservation holds;
- disclosure packages;
- public Messages rollout;
- Phase 8B.6 adversarial closure testing.
