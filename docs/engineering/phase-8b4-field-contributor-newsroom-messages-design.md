# Phase 8B.4 Candidate B — Field Contributor <-> Newsroom Messages Design

**Status:** Locked design candidate — documentation only  
**Date:** 7 September 2026  
**Base main:** `f905f09a300b8954a7a13cbcfe940786a8f9eb6d`  
**Parent authority:** `docs/engineering/phase-8b-messages-authority-and-product-contract.md`  
**Audit authority:** `docs/engineering/phase-8b4-system-actors-real-verticals-authority-audit.md`  
**Tracker:** Issue #848

## Purpose

Candidate B proves the second required Phase 8B.4 vertical:

> an authorized WAKILISHA newsroom user can contact a Field contributor through canonical Messages, the contributor can reply through canonical Messages, and Field Submission remains the authority for the intake object, contact permission, sensitivity, provenance, and lifecycle.

This design creates no SQL, frontend code, Edge Function, Preview branch, Production mutation, or audience expansion.

## Locked constraints

Candidate B must:

- reuse `editorial.field_submissions` as Field authority;
- reuse `editorial.person_identity_links` to resolve the contributor's canonical Person from `owner_user_id`;
- reuse existing Field capabilities including `view_field_intake` to prove newsroom authority;
- reuse `messaging.conversations`, `messaging.conversation_participants`, `messaging.messages`, receipts, sender policies, notifications, and Resource references;
- preserve `messaging.runtime_policy.audience_mode = internal` during the first Field proof;
- create no Field-owned conversation, inbox, thread, message, or staff-routing store;
- copy no raw Field notes, protected source data, email, phone, or other contact PII into Messages;
- keep Conversation access independent from Field Submission Resource access;
- keep Message text non-authoritative for Field workflow mutations.

## Current Production authority

Production is at 104 migrations with head `20260907061830`.

Current `editorial.field_submissions` owns:

- `resource_id` and `resource_kind = field_submission`;
- `owner_user_id`;
- `current_revision`;
- `submission_state`;
- `newsroom_identity_mode`;
- `public_attribution_preference`;
- `contact_preference`;
- rights and consent declarations;
- sensitivity and source-protection requests;
- embargo, location, capture time, notes, provenance, and lifecycle timestamps.

Current contact preference is constrained to:

```text
account_contact | no_follow_up
```

This is too coarse for the accepted Messages contract because it combines permission to follow up with preferred channel.

Current Messages runtime policy is:

```text
audience_mode = internal
revision = 1
```

Candidate B must not globally change that to `contributors` merely to prove one governed Field conversation.

## Contact-policy convergence

The Field contact contract is separated into these meanings:

```text
follow_up_permission = allowed | not_allowed
preferred_contact_channel = messages | email | phone | null
contact_point_id = nullable
```

Exact implementation names may differ only if required by existing naming conventions, but the semantics above are binding.

### Compatibility rule

Existing `contact_preference` rows must not be reinterpreted unsafely.

Migration behavior must preserve meaning:

- `no_follow_up` maps to `follow_up_permission = not_allowed` and no preferred channel;
- `account_contact` proves that follow-up was permitted, but does **not** prove the contributor chose Messages, email, or phone after the new contract exists.

Therefore an existing `account_contact` row may map to `follow_up_permission = allowed` with `preferred_contact_channel = null` until the contributor explicitly chooses a channel or until a separately proven legacy contact-selection authority exists.

Do not silently map every legacy `account_contact` row to Messages.

### First implementation channel

Candidate B may implement the product path for `messages` first while preserving the enum/contract for future `email` and `phone` convergence.

If no canonical contact-point authority exists yet, `contact_point_id` remains nullable and Candidate B must not invent a new generic PII store solely to satisfy this vertical.

Messages needs no raw contact point because the contributor is an authenticated user already linked to a canonical Person.

## Governed Field -> Messages bridge

Candidate B requires one narrow authenticated command owned at the Field/Messages integration boundary.

Conceptually it accepts:

```text
p_submission_resource_id
p_expected_submission_revision
p_body
p_idempotency_key
p_correlation_id
p_client_created_at
```

The command name should follow existing versioned Field command naming, for example `start_field_submission_message_v1`, unless the implementation audit finds a stronger existing convention.

The command must perform all checks server-side in one transaction.

### Newsroom caller checks

The caller must:

1. be authenticated;
2. have the existing capability required to view Field intake, including `view_field_intake` under current role/capability authority;
3. be authorized to inspect the target Field Submission under its existing sensitivity/source-protection constraints;
4. provide the current expected Field Submission revision so stale UI cannot silently start contact against a changed intake state.

The bridge does not create a new newsroom role or routing table.

### Field Submission checks

The target must:

- exist as `resource_kind = field_submission`;
- be in a state where newsroom follow-up is meaningful;
- have `follow_up_permission = allowed`;
- have `preferred_contact_channel = messages` for new-contract rows;
- have an active authenticated owner identity that resolves to one active canonical Person link.

If identity is missing, ambiguous, retired, or no longer active, fail closed.

### Narrow audience exception

Because global Messages audience remains `internal`, the contributor must not gain ordinary contributor-wide Messages eligibility from this command.

The bridge may create or continue a canonical Conversation only when all of these are true:

- the target is the owner of the exact authorized Field Submission;
- the Field contact policy explicitly permits Messages follow-up;
- the initiating user has Field newsroom authority;
- the Conversation is correlated to that Field Submission;
- the contributor's participation is limited to that canonical Conversation under normal Messages participant rules.

This is a workflow-scoped eligibility grant, not a global Messages audience change.

It must not make the contributor discoverable through ordinary `search_message_recipients` while `audience_mode = internal` unless separate audience policy later allows that.

It must not permit arbitrary staff to use this bridge to contact arbitrary contributors.

## Conversation and Resource-reference behavior

The bridge must reuse `public.start_message_conversation` semantics where possible, but may not call a human-product RPC in a way that bypasses its audience checks.

The implementation may either:

- extract/reuse an internal private Messages helper shared by ordinary and Field-governed starts; or
- implement the narrow Field bridge against the same canonical tables and command-receipt invariants if extraction would create more risk.

Whichever path is smaller, the resulting Conversation and Message must be ordinary canonical Messages objects.

The first Message must attach an immutable Resource reference to the existing Field Submission:

```text
resource_id = field submission resource_id
resource_version_id = null unless an exact immutable Field review snapshot exists and is intentionally referenced
presentation_kind = resource
```

The Message body must not duplicate protected `intake_notes`, source-protection details, raw contact data, or other sensitive Field contents.

A suitable ordinary body is operational, for example asking the contributor for follow-up information without restating protected submission data.

## Contributor reply behavior

After the governed Conversation exists, the contributor replies through ordinary `public.send_message` and the ordinary Messages UI.

The implementation must prove that the workflow-scoped Conversation remains usable even though global audience mode is still `internal`.

This must not broaden recipient search or permit the contributor to start unrelated new Conversations unless the general Messages audience later permits it.

## Resource-access boundary

Conversation membership does not grant Field Submission access.

The contributor may already own their own Field Submission through Field authority, while the newsroom user may have `view_field_intake`; those are separate Resource permissions.

Any Messages Resource card must re-evaluate the underlying Field Resource permission at render/open time.

Required negative acceptance:

- a user who can read the Conversation but lacks Field Resource permission cannot use the Message reference to gain Field intake access;
- a user who lacks `view_field_intake` cannot invoke the newsroom bridge merely because they can use Messages generally.

## Notifications

Reuse `public.community_notifications` and the accepted Messages notification bridge.

Do not include:

- Message body;
- Field intake notes;
- source-protection details;
- raw email or phone;
- protected Field metadata.

Notification routing remains `/messages` with safe sender presentation and canonical identifiers only.

## Field UI convergence

The Field contributor form must move away from the single `account_contact | no_follow_up` choice and present the accepted product choices:

```text
Messages
Email
Phone
Do not contact me
```

Candidate B's runtime implementation may enable only Messages and Do not contact me if email/phone contact-point authority is not yet safely available. Disabled/unavailable options must not fabricate persistence semantics.

The interaction must use WAKILISHA custom controls and preserve accessibility, keyboard, mobile, and reduced-motion behavior.

The existing international phone/calling-code interaction must be reused when Phone becomes active; no duplicate country/phone control may be built.

## Newsroom UI convergence

The existing Field intake/review surface should expose a narrow action such as `Message contributor` only when server-returned authority says contact is permitted through Messages.

The frontend must not infer permission merely from a visible legacy field.

The action should:

1. call the governed Field -> Messages bridge;
2. receive/open the canonical Conversation ID;
3. route to `/messages` for the actual conversation.

There is no Field-owned chat panel.

## Idempotency and concurrency

The bridge must reuse `platform_private.command_types` and command receipts.

The durable target is the existing Field Submission Resource and/or canonical Conversation according to the existing receipt helper contract.

Replay with the same principal, idempotency key, and canonical payload must return the original Conversation/Message result and create no duplicate Conversation, participant, Message, Resource reference, or notification.

A changed payload with the same idempotency key must fail closed.

A stale `p_expected_submission_revision` must fail closed before creating Messages state.

## Direct mutation and privilege boundaries

Candidate B must preserve:

- no direct authenticated inserts/updates into `messaging.*` canonical tables;
- no direct contributor mutation of Field newsroom state;
- no service-role shortcut that bypasses user/capability checks;
- no public/anonymous execute grant on the bridge;
- no grant that turns `view_field_intake` into ambient Messages access for unrelated contributors.

## Permanent verifier

The implementation PR must include a rollback-only permanent verifier covering at minimum:

1. authorized newsroom user + submitted Field Submission + Messages follow-up allowed;
2. owner user resolves through active `editorial.person_identity_links`;
3. governed bridge creates one canonical Conversation and first Message;
4. first Message contains the exact Field Submission Resource reference and no copied protected Field content;
5. replay with same idempotency key returns the same result with no duplicates;
6. contributor can read and reply in that Conversation while global `audience_mode` remains `internal`;
7. contributor cannot use the bridge as newsroom caller;
8. staff user without `view_field_intake` is denied;
9. `follow_up_permission = not_allowed` is denied;
10. preferred channel other than `messages` is denied;
11. stale Field revision is denied;
12. retired/ambiguous Person identity link is denied;
13. Conversation membership alone cannot expose a restricted Field Submission to a user lacking underlying Resource permission;
14. ordinary recipient search remains unchanged by the Field workflow-scoped exception;
15. fixture persistence is rollback-only.

## Implementation scope

One serious implementation PR should normally contain:

- the Field contact-policy convergence migration;
- the governed Field -> Messages bridge command;
- any minimal private Messages helper extraction required to preserve invariants;
- permanent rollback verifier;
- generated Preview schema seal/types;
- Field contributor contact-choice UI convergence;
- newsroom `Message contributor` action;
- routing into the existing `/messages` product;
- targeted automated tests.

Do not split this into micro-PRs unless an independently deployable safety boundary appears during implementation.

## Explicit non-goals

Candidate B does not implement:

- global `contributors` Messages audience;
- email delivery;
- phone/SMS delivery;
- a generic contact-point service unless separately justified by existing authority;
- newsroom assignment/routing infrastructure;
- Field-owned conversations/messages;
- exact-version editorial review cards;
- MIZIZI standup scheduling;
- Phase 8B.5 Safety or Legal authority.

## Acceptance sequence

1. merge this design after protected `critical` passes;
2. create a fresh disposable Supabase Preview from exact merged `main`;
3. prove Preview migration parity with Production before Candidate B SQL;
4. apply Candidate B migration only to Preview;
5. run permanent rollback verifier on Preview;
6. run frontend/type/build and targeted product tests;
7. controlled Preview browser acceptance for newsroom -> contributor -> newsroom;
8. merge implementation PR only when protected CI is green;
9. Production SQL promotion using repository-authoritative migration path;
10. Production permanent verifier;
11. exact merged-main frontend deployment to Lightsail if frontend changed;
12. authenticated Production browser acceptance;
13. Production schema reseal;
14. delete disposable Preview;
15. write Candidate B Production closure record.

## Deployment classification

For this design PR:

```text
SQL migration: No
Supabase Edge Function: No
Frontend deploy: No
Production mutation: No
Preview branch: No
```

For the later implementation PR, current evidence indicates:

```text
SQL migration: Yes
Supabase Edge Function: No, unless a real implementation dependency proves otherwise
Frontend update: Yes
Frontend deploy after merge: Yes
Preview: Yes
Production SQL: Yes after merge and Preview acceptance
```

## Exit gate

Candidate B is complete only when a real controlled Field contributor and an authorized newsroom user communicate both directions through canonical Messages, Field contact permission is enforced server-side, the Field Submission is referenced rather than copied, global Messages audience remains unchanged unless separately approved, and no new Field messaging authority exists.
