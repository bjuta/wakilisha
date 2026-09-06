# Phase 8B.2 Messages Core Schema Design

**Status:** Design candidate — documentation only  
**Date:** 6 September 2026  
**Accepted base:** `f7f8e45a655e40e184fa42b93bd521207e9b7766`  
**Parent contract:** `docs/engineering/phase-8b-messages-authority-and-product-contract.md`

## Purpose

Lock the minimum database and command contract for Phase 8B.2 Messages Core before SQL.

This design is intentionally narrower than the complete Messages programme. It establishes the reusable communication authority required by later user product, Super Admin, MIZIZI, Field, editorial workflow, Safety, and Legal consumers without implementing those later consumers prematurely.

No SQL, frontend, Edge Function, production mutation, Safety Case, Legal Case, or System Actor registry is created by this candidate.

## Repository findings that bind this design

### Existing authorization authority is sufficient

The repository already owns:

- `public.role_definitions`;
- `public.capability_definitions`;
- `public.role_capabilities`;
- `public.user_role_assignments`;
- active/expiry semantics on role assignments;
- `public.current_user_has_capability(text)`;
- governed administrator/user-management patterns.

Therefore Messages must not create another role-membership or permission-assignment system.

### Super Admin is genuinely missing

No `super_admin` role exists on the accepted base.

The Messages programme therefore requires one new role definition, but role assignment must reuse `public.user_role_assignments`.

The migration must **not** promote every existing `administrator` automatically.

`super_admin` is an explicit high-privilege assignment.

Because existing capability authority has no role inheritance primitive, the initial SQL should preserve a simple invariant:

- `super_admin` receives all capabilities held by `administrator` at the point of creation;
- it additionally receives the Messages Control Center capability;
- acceptance verifies that every current `administrator` capability is also held by `super_admin`;
- later capability migrations that extend `administrator` must consciously preserve that invariant until a separate role-hierarchy primitive is ever justified.

No existing user identity is assigned `super_admin` by the schema migration itself unless a separately governed assignment action identifies the exact intended user.

### Existing Community blocks/reports are not Messages storage

`public.community_blocks` proves useful block semantics, including active/revoked state and user-owned mutation, but its target vocabulary is currently Community-specific (`person`, `artist`).

Messages may consult compatible active Community Person blocks where appropriate, but must not overload Community tables with Conversation, Message, request, spam, or private-message report state.

### Dedicated private schemas are an accepted pattern

Video and Audio already establish domain-owned private schemas with public RPC boundaries.

Messages should follow that pattern rather than exposing canonical private-message tables as direct browser-write surfaces.

## Schema ownership

Create a dedicated schema:

```text
messaging
```

Canonical Messages storage belongs there.

The schema is not direct browser API authority. Browser-facing mutations are narrow authenticated `public.*` RPCs. Reads are narrow participant-safe projections/RPCs and, only where deliberately useful, RLS-protected read surfaces.

Default posture:

- revoke direct table mutation from `public`, `anon`, and `authenticated`;
- no client may insert/update/delete canonical Messages rows directly;
- `service_role` access remains implementation infrastructure, not user authority;
- authenticated commands establish caller identity from `auth.uid()` and existing Person identity authority.

## Core tables

Exact indexes and implementation syntax belong to the migration candidate. The semantic shapes below are locked.

### `messaging.conversations`

Owns one private communication context.

Minimum shape:

```text
id uuid PK
conversation_kind text
security_classification text
status text
created_by_participant_id uuid nullable during atomic creation
created_at timestamptz
last_activity_at timestamptz
correlation_id uuid nullable
```

Initial vocabulary:

```text
conversation_kind: direct
security_classification: standard | restricted | confidential
status: active | closed
```

Phase 8B.2 implements direct conversations only.

The table must not prevent a later group-conversation extension, but groups are not a Phase 8B.2 product requirement.

Security classification may be raised but must never be silently lowered by an ordinary message command.

### `messaging.conversation_participants`

Owns membership **and the participant-specific mailbox state**.

Minimum shape:

```text
id uuid PK
conversation_id uuid FK
actor_kind text
person_resource_id uuid nullable
user_id uuid nullable
actor_key text nullable
membership_status text
mailbox_folder text
first_contact_state text
joined_at timestamptz
left_at timestamptz nullable
mailbox_updated_at timestamptz
```

Initial actor vocabulary:

```text
human | system | automation
```

Phase 8B.2 may create only `human` participant rows through public user commands.

Human shape:

- canonical `person_resource_id` identifies the durable person;
- current `user_id` authorizes the active account and may later become null through governed account-retirement convergence while historical Person identity remains intact;
- `actor_key` is null.

Future System Actor shape:

- `actor_key` is reserved for the later accountable System Actor registry;
- no unregistered system actor may be inserted in Phase 8B.2.

Initial membership vocabulary:

```text
active | left
```

Initial mailbox vocabulary:

```text
inbox | requests | spam | archived
```

Initial first-contact vocabulary:

```text
not_applicable | pending | accepted | declined
```

**Mailbox placement belongs to the participant, not the Message or Conversation globally.**

One recipient moving a Conversation to Spam or Archive must not alter another participant's mailbox.

A pending first-contact recipient is normally in `requests` unless a later trusted-sender or safety rule routes it differently.

### `messaging.messages`

Owns immutable communication identity.

Minimum shape:

```text
id uuid PK
conversation_id uuid FK
sender_participant_id uuid FK
message_kind text
body text nullable
accepted_at timestamptz
client_created_at timestamptz nullable
correlation_id uuid nullable
command_receipt_id uuid nullable
```

Initial message vocabulary:

```text
text | system_event
```

Phase 8B.2 public user send creates `text` only.

`accepted_at` is authoritative chronology.

`client_created_at`, if supplied, is informational only and cannot order canonical workflow/history.

Ordinary Phase 8B.2 product behavior has **no destructive Message delete command and no edit command**.

Body limits must be explicit and bounded in SQL. The initial candidate should use a conservative limit suitable for messaging rather than article-sized text.

A Message cannot contain executable workflow authority.

### `messaging.message_receipts`

Owns recipient-specific delivery/read state.

Minimum shape:

```text
message_id uuid FK
participant_id uuid FK
delivery_state text
delivered_at timestamptz nullable
read_at timestamptz nullable
PRIMARY KEY (message_id, participant_id)
```

Initial delivery vocabulary:

```text
pending | delivered
```

The later Safety phase may extend delivery disposition for quarantine/withholding. Phase 8B.2 must not invent Safety Case state here.

Rules:

- sender does not create a recipient receipt for a participant that was not active at send acceptance;
- `delivered_at` is server authority;
- `read_at` is monotonic: once set, ordinary product commands do not unset it;
- read state may be stored even when sender-facing read-receipt visibility is disabled;
- sender-facing projections must honor the recipient's privacy preference.

### `messaging.message_resource_references`

Owns an immutable typed reference from one Message to canonical Resource authority.

Minimum shape:

```text
id uuid PK
message_id uuid FK
resource_id uuid FK -> editorial.resources
resource_version_id uuid nullable FK -> editorial.resource_versions
presentation_kind text
created_at timestamptz
```

Rules:

- exact `resource_version_id` is required when the presentation claims an exact review/version state;
- the referenced version must belong to the referenced Resource;
- no Resource content is copied into Messages as new authority;
- send acceptance must validate sender access to the referenced Resource/version;
- recipient rendering must re-evaluate the recipient's underlying Resource access at read time;
- Conversation membership never grants Resource access;
- forwarding/re-sharing never elevates Resource access.

Initial presentation vocabulary may be intentionally small:

```text
resource | version
```

Workflow actions remain target-domain commands, not Message commands.

### `messaging.user_sender_policies`

Owns user-specific DM eligibility/preferences without adding messaging policy columns to general profile identity.

One row per recipient user + sender category.

Minimum shape:

```text
user_id uuid FK
sender_category text
first_contact_disposition text
allow_links boolean
allow_media boolean
allow_resource_references boolean
updated_at timestamptz
revision bigint
PRIMARY KEY (user_id, sender_category)
```

Initial sender-category vocabulary must support future expansion without schema rewrite:

```text
staff
system
contributors
members
public
```

`public` existing in vocabulary does **not** mean public messaging is enabled.

Initial disposition vocabulary:

```text
inbox | requests | reject
```

Rules:

- user policy is server-enforced authorization/routing input;
- no raw phone/email PII belongs here;
- `revision` supports optimistic concurrency for Profile settings;
- a platform audience restriction can make a user preference ineligible, but platform expansion cannot silently broaden a user's own preference.

### `messaging.sender_approvals`

Owns explicit recipient approval of a sender for ordinary future Inbox delivery.

Minimum shape:

```text
id uuid PK
recipient_person_resource_id uuid
recipient_user_id uuid
sender_actor_kind text
sender_person_resource_id uuid nullable
sender_actor_key text nullable
status text
approved_at timestamptz
revoked_at timestamptz nullable
created_from_conversation_id uuid nullable
updated_at timestamptz
```

Initial status:

```text
active | revoked
```

Rules:

- accepting a Message Request may create/reactivate sender approval;
- approval is messaging-specific and does not create a Community follow;
- declining one request does not automatically create a punitive sender record;
- blocking remains stronger than sender approval and wins during eligibility checks;
- approval may be revoked without deleting historical Conversations or Messages.

### `messaging.runtime_policy`

Owns the Messages deployment/audience mode.

This is a Messages product-control primitive, not a generic sitewide feature-flag framework.

Singleton semantic shape:

```text
audience_mode text
revision bigint
updated_by uuid nullable
updated_at timestamptz
```

Initial audience vocabulary:

```text
internal | contributors | members | public
```

Initial production value for the first Phase 8B.2 deployment must remain the narrowest mode justified by acceptance; schema support for later modes does not enable them automatically.

Changing audience mode requires optimistic concurrency and later Super Admin authority. Phase 8B.2 may establish the row and read helper while the product control surface lands in Phase 8B.3.

## Super Admin authorization foundation

Phase 8B.2 should create:

```text
role: super_admin
capability: manage_messages_control_center
```

`manage_messages_control_center` must be mapped only to `super_admin` in this phase.

No `administrator`, `editor`, `reviewer`, moderator-like role, or contributor role receives it.

The Messages core migration must not assign any user to `super_admin` automatically.

An exact separately governed role-assignment action may be performed later against the intended identity.

Backend Control Center reads/actions introduced in Phase 8B.3 must require `manage_messages_control_center`; they must not rely on `current_user_is_administrator()`.

## Person identity resolution

Human messaging identity should compound canonical Person identity.

A public start/send command should resolve the authenticated user's active canonical Person identity using existing Person identity-link authority.

Messages must not invent a second public-profile identity key as its durable sender identity.

Historical Messages reference participant identity, which preserves the canonical Person even if the current Auth account is later retired.

Account retirement integration must be acceptance-tested before public rollout so account deletion does not orphan immutable conversation history.

## First-contact routing algorithm

For a new direct human-to-human Conversation, server authority should resolve routing in this order:

1. authenticate and resolve sender + recipient canonical identities;
2. reject self-targeting;
3. reject inactive/retired/ineligible target accounts;
4. enforce platform `audience_mode`;
5. enforce active block authority where compatible;
6. check active `sender_approvals`;
7. resolve recipient `user_sender_policies` for the sender category;
8. apply the strictest relevant attachment/reference restriction;
9. create recipient participant mailbox state:
   - approved/explicit Inbox policy -> `inbox`;
   - allowed unknown first contact -> `requests` + `pending`;
   - policy reject -> command rejection;
10. create Message and recipient receipt transactionally;
11. emit the minimal safe outbox event needed for downstream notification/delivery work.

Phase 8B.2 does not run Safety scoring. Phase 8B.5 may later route otherwise deliverable traffic to Spam or quarantine based on governed safety decisions.

## Spam and Archive commands

Spam and Archive are participant mailbox operations.

Moving a Conversation to `spam`:

- does not delete the Conversation;
- does not delete Messages;
- does not automatically punish the sender;
- does not alter another participant's mailbox;
- may later become one safety signal among many.

Restoring Spam to Inbox is allowed for the owning recipient subject to block/eligibility rules.

Archive is organizational only.

A blocked sender may not use Archive/Spam restoration to bypass the block.

## Request acceptance and decline

### Accept

Accepting a pending request must atomically:

- verify the caller owns the pending recipient participant row;
- set first-contact state to `accepted`;
- move the participant mailbox to `inbox` unless the user explicitly moved it elsewhere after acceptance;
- create/reactivate a sender approval;
- preserve all original Message timestamps and identities;
- emit a minimal event/outbox record where downstream notification requires it.

### Decline

Declining must:

- set first-contact state to `declined`;
- remove the Conversation from ordinary Requests presentation;
- preserve historical Message identity;
- not create an enforcement violation by itself;
- not create a Community block unless the user separately chooses Block.

The exact post-decline mailbox presentation may be hidden/archived while the underlying governed history remains intact.

## Read receipts

Read chronology is useful, but recipient privacy remains separate.

The preference authority should include sender-facing read-receipt visibility, either as a dedicated user preference row/field or an adjacent Messages preference primitive during implementation.

The canonical database may know `read_at` for mailbox state while sender-facing reads return it only when policy permits.

Mark-read should be a narrow monotonic authenticated RPC rather than a heavyweight durable job:

```text
read_at := coalesce(read_at, server_now)
```

Repeated calls are naturally idempotent.

## Command contract

Durable semantic mutations should reuse the accepted command-receipt/idempotency substrate.

Initial command types:

```text
messages.conversation.start
messages.message.send
messages.request.accept
messages.request.decline
messages.mailbox.move
messages.sender_approval.revoke
messages.preferences.update
```

The migration may split implementation candidates if needed, but no parallel command framework is allowed.

`messages.read.mark` may be implemented as a narrow naturally-idempotent RPC rather than a durable command receipt because it is high-frequency monotonic receipt state, not a workflow decision.

### `messages.conversation.start`

Must be idempotent by authenticated principal + idempotency key + deterministic request fingerprint.

It atomically creates:

- Conversation;
- sender participant;
- recipient participant with server-resolved mailbox/request state;
- first Message;
- recipient receipt;
- optional Resource reference(s);
- minimal transactional outbox event.

Replay must return the original accepted result rather than creating a second Conversation.

### `messages.message.send`

Must verify:

- active sender membership;
- active Conversation;
- current block/eligibility state;
- body/reference shape;
- referenced Resource access;
- any Conversation classification constraints;
- idempotency.

It atomically creates one Message plus recipient receipt rows and the minimal outbox event.

A sender who loses authority after joining cannot rely on stale client state to continue sending.

### Preference mutation

Preference updates require an expected revision.

A stale Profile settings screen must receive an explicit revision-changed rejection rather than overwrite newer choices.

## Read surfaces

Phase 8B.2 should expose narrow server projections rather than raw canonical rows.

Required logical reads:

```text
list_my_message_conversations(folder, cursor, limit)
get_my_message_conversation(conversation_id, cursor, limit)
get_my_message_preferences()
get_my_message_unread_counts()
```

Names may be adjusted to repository convention in SQL, but semantics are binding.

Reads must:

- require active authenticated identity;
- prove caller participation;
- return only caller-owned mailbox state;
- redact sender-facing `read_at` when recipient policy hides receipts;
- never resolve restricted Resource/Media content without underlying authority;
- paginate deterministically by authoritative server timestamps plus stable IDs;
- avoid exposing hidden Safety/Legal metadata in ordinary user projections.

Super Admin read surfaces are **not** part of Phase 8B.2 and land in Phase 8B.3 under the dedicated capability.

## Notifications boundary

Messages may emit minimal outbox data sufficient for the existing notification infrastructure to tell a recipient that a private Message exists.

Ordinary notification payloads must not contain:

- private Message body;
- restricted Field identity;
- protected Media details;
- confidential Resource content.

The notification system is a delivery/projection consumer, not the Message store.

## What Phase 8B.2 deliberately does not implement

- System Actor registry or MIZIZI sender rows;
- Messages user interface;
- `/admin/messages`;
- Safety Case;
- quarantine;
- illegal-content/media classifier integration;
- legal preservation/disclosure;
- public member-to-member rollout;
- group conversations/channels;
- message editing/deletion;
- reactions;
- typing/presence;
- voice/calls;
- Message-owned file uploads;
- duplicate workflow/review authority.

## Proposed SQL candidate sequence inside Phase 8B.2

These are implementation candidates, not new programme phases.

### Candidate A — Identity, policy, and core tables

Create:

- `messaging` schema;
- `super_admin` role definition and Control Center capability without user assignment;
- Conversation;
- Participant;
- Message;
- Message Receipt;
- user sender policy;
- sender approval;
- runtime audience policy;
- Resource reference tables;
- constraints/indexes/RLS/revokes;
- permanent read-only verifier.

No public write RPC yet if keeping this candidate maximally structural.

### Candidate B — Governed user commands and reads

Add:

- start Conversation;
- send Message;
- accept/decline Request;
- mailbox move;
- revoke sender approval;
- preference update;
- mark read;
- participant-safe reads/unread counts;
- command types/receipts/outbox integration;
- permanent command/RLS verifier.

### Candidate C — Controlled acceptance fixture

Prove with synthetic authenticated users:

- approved -> Inbox;
- unknown allowed -> Requests;
- accepted Request -> Inbox + sender approval;
- declined Request preserves history;
- Spam move/restore is recipient-specific;
- Archive is recipient-specific;
- block prevents new delivery;
- hidden read receipts remain hidden to sender;
- direct table mutation denied;
- idempotent start/send replay returns exact original objects;
- unauthorized conversation read denied;
- unauthorized Resource reference denied;
- administrator without `super_admin` cannot access future Control Center authority;
- no user was automatically assigned `super_admin`.

## Phase 8B.2 design acceptance gate

This schema design is ready for SQL only when review confirms:

- Messages has a dedicated private schema;
- existing role assignment and capability authority is reused;
- `super_admin` is explicit and not automatically assigned;
- Control Center authority is not inherited merely from `administrator`;
- canonical Person identity is used for human participants;
- participant mailbox state is per recipient;
- Inbox/Requests/Spam/Archive never become Message deletion semantics;
- platform quarantine remains outside ordinary mailbox state;
- Messages are immutable in the initial core;
- receipts are per recipient and server timestamps are authoritative;
- Resource references never copy or elevate Resource authority;
- user sender policy is server-enforced and future-public capable;
- accepted first contact creates messaging-specific sender approval, not Community follow;
- durable sends/start operations reuse command receipts/idempotency/outbox;
- mark-read remains a narrow monotonic mutation;
- System Actors, Safety, Legal, and UI remain deferred to their accepted programme phases.

Once merged, Candidate A SQL may begin from the exact resulting main SHA.
