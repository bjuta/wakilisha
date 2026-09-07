# Phase 8B.4 Candidate A - Accountable System Actor + Governed System Messages Design

**Status:** Locked design candidate - documentation only  
**Date:** 7 September 2026  
**Design base main:** `56889b0e082d3eb779b213f96d34c9498206747f`  
**Parent audit:** `docs/engineering/phase-8b4-system-actors-real-verticals-authority-audit.md`  
**Current slice:** Phase 8B.4 - System Actors + Real Verticals  
**Candidate:** A - System Actor accountability + governed System Messages

## Purpose

This document locks the smallest implementation candidate that closes the accountability gap identified by the accepted Phase 8B.4 read-only audit.

Candidate A establishes one real accountable System Actor, `mizizi`, and allows that actor to send a governed Message to an authorized human through the existing Messages authority.

It does not yet schedule the daily MIZIZI standup, change Field contact semantics, add Resource workflow cards, broaden the Messages audience, or start Safety/Legal work.

No SQL or runtime mutation is authorized until this design is accepted.

## Binding architectural decision

Candidate A reuses:

- `messaging.conversations`;
- `messaging.conversation_participants`;
- `messaging.messages`;
- `messaging.message_receipts`;
- `messaging.sender_approvals`;
- `messaging.user_sender_policies` including sender category `system`;
- `platform_private.command_types`;
- `platform_private.command_receipts`;
- existing command fingerprint/completion helpers;
- existing Notifications authority in `public.community_notifications`;
- the existing Super Admin Messages Control Center;
- the accepted MIZIZI production control plane and its JIT PostgreSQL execution path.

Candidate A adds only the missing accountable System Actor authority and narrow adapters needed to use those existing primitives safely.

It must not create:

- another Message store;
- another receipt/idempotency store;
- another scheduler or jobs queue;
- another outbox;
- another Notifications table;
- a fake Auth user or Person for MIZIZI;
- a generic `send_message_as_any_actor` function;
- a generic agent framework;
- new MIZIZI Registry mutation authority.

## 1. Accountable principal model

Current command receipts preserve only:

```text
user:<uuid>
service:service_role
```

The coarse service principal is not sufficient as durable MIZIZI identity.

Candidate A therefore extends the accepted `platform_private.command_receipts.principal_key` grammar to support:

```text
system:<actor_key>
```

The first real value is:

```text
system:mizizi
```

`actor_user_id` remains `NULL` for System Actor receipts.

This is an extension of the existing receipt authority, not a replacement.

### Execution credential remains separate

The accountable principal and executing database credential are different facts.

The current accepted MIZIZI production control plane obtains a temporary JIT PostgreSQL session and proves:

```text
current_user = postgres
current_database() = postgres
```

Candidate A preserves that deployment/runtime path.

The System Actor registry records an explicit executor binding for MIZIZI:

```text
actor_key: mizizi
executor_principal_key: database:postgres
```

A receipt records `system:mizizi` as the accountable command principal while the request/audit context preserves the executor binding used to authorize execution.

The shared JIT/database credential does not become the actor identity.

## 2. Private System Actor tables

System Actor authority belongs in `platform_private`, not in Auth, People, Community, Registry, or a new Messages-owned identity directory.

### `platform_private.system_actors`

Minimum shape:

```text
actor_key text primary key
label text not null
actor_kind text not null
status text not null
created_at timestamptz not null
updated_at timestamptz not null
```

Locked checks:

```text
actor_key = same bounded actor-key grammar already accepted by Messages
actor_kind in (system, automation)
status in (active, disabled)
```

No direct table privilege is granted to `public`, `anon`, `authenticated`, or `service_role`.

### `platform_private.system_actor_executor_bindings`

Minimum shape:

```text
actor_key text not null
executor_principal_key text not null
status text not null
created_at timestamptz not null
updated_at timestamptz not null
primary key (actor_key, executor_principal_key)
```

The row must reference an existing System Actor.

Initial supported executor grammar is deliberately narrow:

```text
database:postgres
```

Candidate A does not create a generic service-account registry or secret store.

### `platform_private.system_actor_message_policies`

Messages permission is separate from overall actor identity so the Super Admin can disable an actor's Messages capability without disabling unrelated domain authority.

Minimum shape:

```text
actor_key text primary key
messages_enabled boolean not null
allowed_purposes text[] not null
recipient_scope_kind text not null
allow_human_reply boolean not null
allow_links boolean not null
allow_resource_references boolean not null
allowed_resource_kinds text[] not null
allowed_action_keys text[] not null
revision bigint not null
updated_at timestamptz not null
```

Candidate A locks the first recipient scope to:

```text
super_admin_only
```

Scope broadening is not an ordinary UI edit in Candidate A. It requires a reviewed migration/configuration change.

This prevents the Agents surface from becoming a generic privilege editor.

## 3. Governed MIZIZI seed

The migration candidate must seed exactly one System Actor:

```text
actor_key: mizizi
label: MIZIZI Cultural Data Steward
actor_kind: system
status: active
```

Executor binding:

```text
executor_principal_key: database:postgres
status: active
```

Messages policy:

```text
messages_enabled: true
allowed_purposes: [operational_update]
recipient_scope_kind: super_admin_only
allow_human_reply: false
allow_links: false
allow_resource_references: false
allowed_resource_kinds: []
allowed_action_keys: []
revision: 1
```

This Messages policy does not grant MIZIZI any new Registry permission.

Candidate B may later use the `operational_update` purpose for the real standup derived from existing MIZIZI evidence.

## 4. Executor context boundary

Candidate A adds one private helper that resolves the trusted execution context.

Conceptually:

```text
platform_private.system_actor_executor_context()
```

For Candidate A it accepts only the existing direct JIT database control-plane context that resolves to:

```text
executor_principal_key = database:postgres
```

The helper must reject browser/authenticated contexts and ordinary `service_role` execution for System Actor send.

The exact implementation may use the stable direct-database session identity available to the accepted MIZIZI production control plane, including `session_user/current_user` checks as appropriate for a SECURITY DEFINER boundary.

No caller-supplied executor key may be trusted as authority.

## 5. System Actor command receipt helper

Candidate A adds a private helper conceptually:

```text
platform_private.begin_system_actor_resource_command(
  actor_key,
  command_type,
  resource_id,
  idempotency_key,
  request_payload
)
```

It must:

1. resolve the real executor context;
2. require an active actor record;
3. require an active actor/executor binding;
4. require the System Actor Messages policy to be enabled for the requested purpose;
5. derive durable principal key `system:<actor_key>` internally;
6. use the existing command request fingerprint authority;
7. write/replay the existing `platform_private.command_receipts` row;
8. keep `actor_user_id` null;
9. preserve the executor principal inside the immutable request/audit payload;
10. retain the existing same-principal + command + idempotency replay semantics.

The helper must not accept a caller-supplied `principal_key`.

## 6. One narrow System Actor Message command

Candidate A registers one new command type:

```text
messages.system.send
```

with the existing controlled command vocabulary pattern and a synchronous job/event naming family.

The internal command is conceptually:

```text
messaging.send_system_message(
  actor_key,
  purpose_key,
  recipient_person_resource_id,
  body,
  resource_references,
  idempotency_key,
  correlation_id,
  client_created_at
)
```

This function is server/control-plane only.

It receives no execute grant for:

```text
public
anon
authenticated
service_role
```

The accepted JIT PostgreSQL control plane remains the initial execution authority.

### Receipt target

The existing shared receipt table requires an `editorial.resources` target.

For this command, the target is the canonical recipient Person Resource identified by `recipient_person_resource_id`.

The actor itself is preserved by the receipt principal `system:mizizi` and the registered actor authority; no fake System Actor Person Resource is created merely to satisfy receipt storage.

## 7. System send authorization sequence

The command must fail closed in this order before inserting a Message:

1. validate actor key and purpose syntax;
2. resolve the real executor context;
3. require active System Actor;
4. require active executor binding;
5. require Messages policy enabled;
6. require `purpose_key` in the actor's permitted purposes;
7. resolve the recipient through the existing canonical Person/Auth link;
8. enforce `recipient_scope_kind = super_admin_only` using current active role authority;
9. enforce the recipient's existing `system` sender policy;
10. enforce actor outbound-content policy;
11. enforce recipient inbound-content policy;
12. begin/replay the existing actor-scoped command receipt;
13. create or reuse the canonical direct Conversation;
14. append one canonical Message;
15. complete the existing command receipt.

No Message text may confer additional authority.

## 8. First-contact and approval reuse

`messaging.sender_approvals` already supports:

```text
sender_actor_kind in (system, automation)
sender_actor_key
```

Candidate A must reuse this shape.

For a new System/Human direct Conversation:

- active actor-key approval routes to Inbox/accepted;
- recipient `system` policy `inbox` routes to Inbox/accepted;
- recipient `system` policy `requests` routes to Requests/pending;
- recipient `system` policy `reject` rejects the command;
- no MIZIZI-specific preference is created.

The System participant uses:

```text
actor_kind = system
actor_key = mizizi
person_resource_id = null
user_id = null
membership_status = active
first_contact_state = not_applicable
```

The human participant remains canonical Person/Auth-backed authority.

### Request acceptance extension

The existing `public.accept_message_request` currently materializes approval only for a human counterpart.

Candidate A must extend it without changing the existing human behavior:

- human counterpart -> existing `sender_person_resource_id` approval path;
- system/automation counterpart -> existing `sender_actor_key` approval path.

No new approval table or command family is required.

## 9. Direct Conversation identity and concurrency

System/Human direct conversations use the existing `messaging.conversations` table.

Candidate A must use a deterministic advisory-lock key derived from:

```text
actor_key + recipient_person_resource_id
```

so concurrent first sends cannot manufacture duplicate active direct Conversations.

The command reuses an existing active direct Conversation only when its active participant set resolves to exactly:

- the requested System Actor key; and
- the requested human Person.

No cross-actor or cross-recipient Conversation reuse is permitted.

## 10. Message content boundary

Candidate A MIZIZI policy intentionally permits only body text for the `operational_update` proof.

It does not permit:

- links;
- Media;
- Resource references;
- Resource actions.

Therefore any non-empty `resource_references` input must fail for MIZIZI in Candidate A even though core Messages storage already supports references.

This preserves the accepted future scope without prematurely granting MIZIZI Resource access.

## 11. Human reply boundary

MIZIZI's Candidate A policy sets:

```text
allow_human_reply = false
```

The existing human `send_message` command must therefore fail closed when the only active counterpart is a System Actor whose policy does not allow human reply.

The user product must not present an enabled composer for such a Conversation.

Candidate A does not invent an inbound agent queue or make human replies disappear into a Conversation that no actor consumes.

A later reviewed design may enable replies for a System Actor with an explicit inbound-processing authority.

## 12. System-aware read projection

The current Messages participant schema is already mixed-actor capable, but current user reads/projected TypeScript types remain Person-shaped.

Candidate A extends the existing read projection to expose an actor shape:

```text
actor_kind
person_resource_id nullable
actor_key nullable
presentation
```

System presentation is resolved only from `platform_private.system_actors` through a safe SECURITY DEFINER projection helper.

Minimum safe presentation:

```text
display_name
actor_key
actor_kind
```

No secret, executor credential, private policy internals, or unrelated MIZIZI domain data is exposed.

### Conversation summary

`other_participant` must support both:

- canonical human Person presentation; and
- registered System Actor presentation.

### Conversation detail

Participant and Message sender projection must expose enough actor identity to render a System Message without manufacturing a Person.

The frontend must render:

```text
MIZIZI
```

from the registered actor label, not `Someone`, not a fake username, and not a fake Auth user.

## 13. Notification bridge extension

Candidate A reuses the Phase 8B.3 `public.community_notifications` bridge.

For a System Actor sender:

```text
actor_id = null
notification_type = direct_message
entity_type = direct_message
canonical_path = /messages
```

Metadata may include only safe routing/presentation fields such as:

```text
conversation_id
message_id
sender_actor_kind
sender_actor_key
sender_display_name
```

It must not include:

- Message body;
- MIZIZI Registry evidence payloads;
- protected Field data;
- executor credential data.

The existing Inbox/Archive + accepted/not-applicable recipient eligibility and Message-identity deduplication remain unchanged.

No agent-notifications table is created.

## 14. Super Admin Agents control

Candidate A extends the existing `/admin/messages` Control Center rather than creating `/admin/agents`.

Minimum Agents presentation:

- actor label/key;
- actor identity status;
- Messages enabled/disabled status;
- permitted Message purpose(s);
- recipient scope label;
- most recent System Message timestamp if one exists.

Candidate A adds a Super Admin-only read projection for this safe status.

### Messages kill control

The only mutable control required in Candidate A is:

```text
Messages enabled / disabled
```

The control updates `platform_private.system_actor_message_policies.messages_enabled` with expected-revision concurrency and existing authenticated command-receipt/idempotency authority.

It does **not** change `platform_private.system_actors.status` and does not disable MIZIZI Registry authority.

Purpose and recipient-scope expansion remain reviewed migration/configuration changes in Candidate A.

## 15. Privilege posture

Candidate A must preserve these boundaries:

- System Actor tables: no direct browser/authenticated/service-role table access;
- System send command: no browser/authenticated/service-role execute grant;
- executor/begin helpers: private;
- System presentation helper: private, used only by safe read projections;
- Super Admin Agents reads/kill command: authenticated entrypoints with existing Super Admin Messages Control Center capability enforcement;
- ordinary Administrator remains denied the Agents control surface;
- MIZIZI receives no human role assignment, Auth row, Person link, or Super Admin capability.

## 16. Permanent verifier requirements

The implementation PR must add one permanent read-only verifier covering at least:

### Structural

- all three System Actor tables exist with exact constraints/indexes;
- no forbidden direct privileges;
- MIZIZI seed is exact;
- only the intended executor binding exists for MIZIZI;
- MIZIZI Messages policy is exact;
- receipt principal constraint accepts `system:mizizi` without weakening user/service validation;
- new command type exists exactly once;
- internal System send/helper functions have the required SECURITY DEFINER/search-path posture and privilege revokes.

### Behavioral fixture

Inside a transaction that rolls back all fixture state:

1. unregistered actor key cannot send;
2. wrong executor binding cannot send;
3. disabled actor identity cannot send;
4. Messages-disabled actor cannot send;
5. unpermitted purpose cannot send;
6. non-Super-Admin recipient cannot receive under `super_admin_only`;
7. recipient `system=reject` policy fails closed;
8. recipient `system=requests` produces Requests/pending;
9. accepting that request creates actor-key sender approval through the existing table;
10. recipient `system=inbox` produces Inbox/accepted;
11. same idempotency key + same request replays one receipt/one Message;
12. same idempotency key + different request is rejected;
13. concurrent-equivalent direct-pair logic resolves one active Conversation;
14. System Message receipt principal is `system:mizizi` and `actor_user_id` is null;
15. user read projection renders MIZIZI as a System Actor;
16. no fake Person/Auth identity exists for MIZIZI;
17. notification row uses `actor_id is null`, routes to `/messages`, and contains no Message body;
18. human reply is rejected while `allow_human_reply=false`;
19. Super Admin Messages kill control disables only the Messages policy;
20. MIZIZI Registry review/write authority rows remain untouched by Messages disablement.

The verifier must prove cleanup/rollback of all fixture rows.

## 17. Replay proof

The implementation migration must have a retained replay proof using the established WAKILISHA migration-proof contract.

The replay must prove:

- fresh application succeeds;
- permanent verifier passes;
- replay fails closed or is proven safely idempotent according to the repository migration contract;
- no unrelated schema/data drift is introduced.

## 18. Candidate A product acceptance

Before Candidate A can be called accepted, a controlled Preview must prove:

- MIZIZI appears as a System Actor in Messages;
- one governed System Message reaches an eligible Super Admin through the canonical Conversation/Message tables;
- the existing notification bell/feed surfaces that Message safely;
- notification click opens the correct Conversation;
- disabled MIZIZI Messages permission stops a subsequent send;
- re-enabling restores only Messages permission;
- ordinary Administrator cannot access the Agents control;
- no browser client can call the System send boundary;
- no duplicate Message appears on idempotent replay.

The Message body may use controlled fixture text for Candidate A. The real MIZIZI evidence-derived standup remains Candidate B.

## 19. Explicit Candidate A exclusions

Candidate A does not implement:

- scheduled MIZIZI standups;
- Field contact-policy convergence;
- Field contributor/newsroom vertical;
- Resource/version Message cards;
- editorial approve/request-changes projection;
- Media in System Messages;
- links in MIZIZI Messages;
- human replies to MIZIZI;
- Safety Case/quarantine;
- Legal preservation/disclosure;
- broader Messages audience modes;
- generic agent/plugin execution.

## 20. Implementation surface classification

For the future Candidate A implementation PR, the expected affected surfaces are:

```text
SQL migration: YES
Permanent SQL verifier: YES
Replay proof: YES
Frontend: YES
Supabase Edge Function: NO
New scheduler/workflow: NO
New jobs/outbox authority: NO
Preview acceptance: YES
Production promotion: only after Preview acceptance
```

For **this design PR**:

```text
SQL migration needed: NO
Supabase Edge Function deploy needed: NO
Frontend deploy needed: NO
Production activation needed: NO
Preview needed: NO
```

## Exit from design into implementation

Candidate A implementation may begin only after this design is merged to `main` and protected CI is green.

The implementation must remain one coherent Candidate A body of work: accountable System Actor identity, governed System send, system-aware read/notification projection, and minimum Super Admin Messages control. It must not absorb Candidate B or Candidate C work.