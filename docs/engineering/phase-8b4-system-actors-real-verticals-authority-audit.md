# Phase 8B.4 System Actors + Real Verticals — Read-Only Authority Audit

**Status:** Audit complete — implementation authority still requires a locked design candidate  
**Date:** 7 September 2026  
**Audited main:** `8c0086f141e5eb0a6705502c923381c27b037794`  
**Production migration count:** `102`  
**Production migration head:** `20260907003000`  
**Parent authority:** `docs/engineering/phase-8b-messages-authority-and-product-contract.md`  
**Current slice:** Phase 8B.4 — System Actors + Real Verticals

## Purpose

This audit is the required first engineering move for Phase 8B.4.

It answers one question before any new SQL is permitted:

> Which existing WAKILISHA authorities already solve the three required 8B.4 verticals, which surfaces need narrow extension, and which authority is genuinely missing?

The three required 8B.4 proofs remain:

1. MIZIZI -> Super Admin through governed Messages using real MIZIZI operational evidence;
2. Field contributor <-> newsroom through the same Messages authority without Field-owned messaging;
3. at least one exact Resource Version editorial review projection/action through Messages while the target Resource's existing review command remains mutation authority.

This document creates no schema, no runtime behavior, no Edge Function, no frontend mutation, no Production mutation, and no Preview branch.

## Audit method

The audit reconciled:

- the accepted Phase 8B Messages authority/product contract;
- the accepted Phase 8B.2 Messages schema and command/read implementation;
- the Production-closed Phase 8B.3 user product and Super Admin Control Center;
- current Messages service and user UI;
- MIZIZI agent code, production control-plane records, Registry review items, and canonical write events;
- Phase 8A Field Submission schema, events, capability model, service, and UI;
- shared Phase 1B command/job/outbox authority;
- current Notifications authority and Messages notification bridge;
- current exact-version editorial review RPCs;
- a read-only Production schema/runtime inspection at migration head `20260907003000`.

## Executive decision

Phase 8B.4 does **not** need a new messaging system, scheduler, notification store, workflow engine, Field inbox, MIZIZI run database, Media authority, review system, or generic agent framework.

The existing platform already owns almost all required machinery.

The genuinely missing authority is narrow:

1. an accountable System Actor registry/profile with explicit scope;
2. a governed System Actor -> Messages send path that reuses command receipts, jobs/outbox where needed, and existing Conversation/Message storage;
3. system-aware Messages read/presentation and notification projection;
4. Field contact-choice convergence from the current combined preference into explicit follow-up permission/channel semantics;
5. product presentation/actions for existing Message Resource references, including exact Resource Versions.

Everything else should be reuse or a small extension of accepted authority.

## Reuse / extend / missing map

| Concern | Current authority | Decision |
| --- | --- | --- |
| Conversation / Message identity | `messaging.conversations`, participants, Messages, receipts | **REUSE** |
| Human participant identity | canonical Person + current Auth user | **REUSE** |
| System participant shape | `actor_kind = system|automation`, `actor_key` already supported | **REUSE + EXTEND** |
| Accountable System Actor registry | no Production table/registry found | **MISSING** |
| User policy for System senders | sender category `system` already exists | **REUSE** |
| Idempotent commands | `platform_private.command_types`, command receipts | **REUSE** |
| Durable work | `platform_private.jobs` | **REUSE** |
| Event delivery | `platform_private.outbox_events` | **REUSE** |
| Scheduler/orchestration | established shared job/control-plane authority | **REUSE — DO NOT REBUILD** |
| MIZIZI identity | stable key `mizizi`, label, ruleset | **REUSE** |
| MIZIZI governed evidence | Registry review items + canonical write events + production control-plane evidence | **REUSE** |
| Sitewide notifications | `public.community_notifications` + canonical notification reads | **REUSE + EXTEND** |
| Field Submission identity/provenance | `editorial.field_submissions` + immutable Field events | **REUSE** |
| Field contact policy | current `account_contact | no_follow_up` | **EXTEND** |
| Newsroom authorization | existing Field capabilities / role assignments | **REUSE** |
| Field-owned private communication store | none | **DO NOT CREATE** |
| Message Resource references | `messaging.message_resource_references` | **REUSE** |
| Exact-version review commands | existing Audio/Video/Playlist/Source RPCs | **REUSE UNCHANGED** |
| Message workflow cards/actions | no current user UI projection | **MISSING PRODUCT PRESENTATION** |
| Safety / quarantine | future Phase 8B.5 | **OUT OF SCOPE** |
| Legal preservation/disclosure | later authority | **OUT OF SCOPE** |

## 1. Messages core already has the correct system-participant shape

Production `messaging.conversation_participants` already supports:

```text
actor_kind = human | system | automation
```

For system/automation participants, Production requires:

- `person_resource_id is null`;
- `user_id is null`;
- non-null `actor_key`;
- actor keys matching the established bounded key format.

The schema also has a conversation-scoped unique key over system/automation participants.

This is important: **8B.4 must not redesign Conversation participants.**

The core deliberately anticipated System Actors.

### Existing user policy also anticipated System Actors

Messages user sender policies already include:

```text
staff
system
contributors
members
public
```

Therefore a user already has a server-side policy slot for the `system` sender category.

8B.4 must reuse that policy rather than add `allow_mizizi_dm`, `allow_agent_messages`, or another special-case recipient preference.

## 2. The accountable System Actor registry is genuinely missing

A read-only Production inspection found no current table corresponding to an accountable System Actor, service-principal, or agent registry.

That matches the accepted Phase 8B contract: current service credentials are too coarse to serve as durable actor identity.

### What the missing primitive must own

The next design candidate should lock the minimum actor profile required by the accepted contract:

- stable actor key;
- label;
- actor kind;
- status;
- capability/scope profile;
- permitted Message purposes;
- recipient scope;
- Resource/action scope where applicable.

The executing service credential remains separate from accountable actor identity.

### What it must not become

The System Actor primitive must not become:

- a second user directory;
- a generic role system;
- a generic service-account secret store;
- a second jobs/scheduler framework;
- a replacement for MIZIZI domain authority;
- a universal autonomous-action permission bypass.

MIZIZI remains `mizizi`; the new actor record merely makes that identity explicit and governable when MIZIZI participates in Messages.

## 3. MIZIZI already owns real evidence and must not be duplicated

Current repository/runtime authority already gives MIZIZI:

```text
agent key: mizizi
label: MIZIZI Cultural Data Steward
ruleset version: 1.1.0
```

Its run code already distinguishes:

```text
audit | apply
```

and accumulates operational statistics including:

```text
findings
applied
queued
observed
stale
rowsScanned
byRule
```

MIZIZI also already writes canonical downstream evidence rather than hiding mutations inside the agent process:

- `public.registry_review_items` for review escalation;
- `public.registry_canonical_write_events` for canonical Registry writes with actor `mizizi`.

The current Production inspection found:

```text
MIZIZI review items: 66
MIZIZI canonical write events: 472
```

Those numbers are evidence that the required first System Actor proof can be grounded in real governed data.

### Existing production control plane remains authority

MIZIZI production application already uses governed control-plane workflows and accepted production closure records.

8B.4 must not create a `messaging.mizizi_runs` table simply to manufacture a standup source.

The System Actor Message may summarize evidence from the real Registry/control-plane authorities and carry correlation/provenance sufficient to explain where its figures came from.

If the later design determines one small durable correlation record is required for a scheduled standup execution, that record must be a platform orchestration/accountability record — not a new copy of Registry findings or MIZIZI domain history.

## 4. Shared command/job/outbox authority is already sufficient

Production contains the established platform tables:

```text
platform_private.command_types
platform_private.command_receipts
platform_private.jobs
platform_private.outbox_events
```

The Phase 1B contract already owns:

- principal-scoped command idempotency;
- durable jobs;
- worker leases;
- retries;
- dead-letter handling;
- transactional outbox.

Therefore:

- a System Actor send is a governed command, not a direct table insert from arbitrary runtime code;
- scheduled standup work reuses durable jobs/control-plane scheduling;
- downstream delivery/notification work reuses outbox/notification authority where asynchronous delivery is required;
- Messages must not add `message_jobs`, `agent_jobs`, `message_outbox`, or another retry queue.

## 5. Current Messages commands and reads are human-product shaped

The existing public Messages command surface is intentionally human-to-human.

User product commands resolve the authenticated human identity and create human participants.

That remains correct and should not be weakened to let a service credential impersonate a human.

### Required extension

8B.4 needs a **separate narrow governed System Actor command boundary**.

That command must:

- identify the accountable actor by registered actor key;
- verify actor status and permitted purpose;
- verify recipient scope;
- enforce the recipient's existing `system` sender policy;
- preserve Conversation/Message immutability;
- use command receipt/idempotency authority;
- create/continue the canonical Messages Conversation;
- emit only the existing safe delivery/notification projection;
- never confer target-domain mutation authority.

It must not be a generic `send_message_as_any_actor` escape hatch.

## 6. System-aware Messages presentation is missing

The database participant model supports system actors, but the current user read/product layer still assumes human counterpart presentation.

Current conversation detail reads project human participants through canonical Person presentation, and the frontend service types model counterpart identity around Person presentation.

That was correct for 8B.3 but is insufficient for MIZIZI.

### Required extension

The read projection should expose an accountable sender/counterpart shape such as:

```text
actor_kind
person_resource_id?
actor_key?
presentation
```

where system presentation comes only from the registered System Actor authority.

The user UI should then render MIZIZI as MIZIZI — not as a fake Auth user, fake Person, or anonymous `Someone`.

## 7. The current notification bridge must be extended, not replaced

Phase 8B.3 correctly reuses `public.community_notifications` as the sitewide notification bell/feed authority.

The bridge intentionally:

- avoids copying Message body content into notification metadata;
- routes to `/messages`;
- deduplicates by Message identity;
- notifies only eligible recipients.

That privacy posture remains binding.

### Current system-sender gap

The current notification trigger resolves only an active **human** sender with a non-null `user_id`.

If the sender is a System Actor, the function returns without creating a notification.

Production `community_notifications.actor_id` is nullable, but when present it references `auth.users(id)`.

Therefore a System Actor must **not** be represented by a fake `actor_id`.

### Required extension

For System Actor Messages, reuse the same notification row with:

- `actor_id = null`;
- the same canonical `/messages` routing identifiers;
- safe System Actor presentation metadata derived from the actor registry;
- no Message body;
- no protected Registry/Field content.

No second agent-notifications table is justified.

## 8. Field Submission authority is reusable, but contact semantics are still too coarse

Production Field authority lives in:

```text
editorial.field_submissions
editorial.field_submission_events
editorial.field_submission_media_intakes
```

A Field Submission already preserves:

- owner user identity;
- newsroom identity mode;
- public attribution preference;
- contact preference;
- rights/consent declarations;
- sensitivity;
- immutable event history.

Field review authorization already reuses existing roles/capabilities, including `view_field_intake` for appropriate newsroom roles.

### Current contact contract

Production currently constrains Field contact preference to:

```text
account_contact | no_follow_up
```

This combines two meanings that the accepted Phase 8B contract now separates:

1. may WAKILISHA follow up?;
2. if yes, which contact channel is preferred?

The accepted target semantics are conceptually:

```text
follow_up_permission = allowed | not_allowed
preferred_contact_channel = messages | email | phone
contact_point_id = nullable
```

The exact SQL names remain for the next locked design candidate.

### Field-to-Messages integration rule

Field must not create a private-message table or Field-owned conversation authority.

For the first controlled vertical:

- an authorized newsroom user opens the existing Field Submission;
- the user's existing Field capability proves newsroom authority;
- the contributor's `owner_user_id` / canonical Person link identifies the human participant;
- contact permission is enforced;
- if Messages is the permitted/preferred path, the action starts or opens a canonical Messages Conversation;
- the first/appropriate Message references the existing Field Submission Resource rather than copying its sensitive contents;
- the contributor replies through ordinary Messages.

This requires no automatic newsroom-routing table for the first proof.

If later operational scale requires assignment/routing, that must reuse or extend newsroom workflow assignment authority rather than become a Messages-owned staff directory.

## 9. Existing Message Resource references already provide the correct provenance bridge

`messaging.message_resource_references` already owns immutable typed references:

```text
resource_id
resource_version_id?
presentation_kind = resource | version
```

The accepted contract requires exact version identity when a Message claims an exact review state.

This is the correct bridge for both:

- a Field Submission reference;
- an exact editorial Resource Version review card.

### Current product gap

The TypeScript Messages service already models `resource_references` on Message rows, but ordinary send/start helpers currently pass empty reference arrays, and the current Messages page does not present Resource-reference cards/actions.

Therefore 8B.4 does **not** need another schema for workflow cards.

It needs to expose the existing reference capability through governed product paths.

## 10. Exact-version review mutation authority already exists

Production already exposes exact-version-aware review RPCs including:

```text
review_audio_publication(
  p_publication_id,
  p_expected_authority_revision,
  p_submitted_version_id,
  p_decision,
  p_idempotency_key,
  p_note,
  p_correlation_id
)

review_video_publication(... p_submitted_version_id ...)
review_playlist(... p_submitted_version_id ...)
review_source_version(p_source_id, p_source_version_id, ...)
```

These are `SECURITY DEFINER` target-domain commands with their own authority checks.

### Binding decision

Messages must not add:

```text
messages.approve_resource
messages.request_resource_changes
messages.review_article
```

or any equivalent competing workflow authority.

The Message UI may project an exact-version card and action, but clicking that action must call the target domain's existing command with:

- the exact referenced Resource/version;
- the current expected revision/concurrency token;
- the current authenticated user's capability;
- a new target-domain idempotency key;
- correlation back to the Message/Conversation where useful.

If current state no longer matches the projected card, the target command must reject or the UI must refresh. A stale Message is never mutation authority.

### Recommended first proof target

Audio, Video, and Playlist all have strong exact submitted-version + expected-authority-revision review contracts.

The implementation design may choose whichever produces the smallest independently provable vertical; it must not create a generic workflow abstraction first.

## 11. Resource access remains independent from Conversation access

The accepted Messages contract remains binding:

- sender access must be checked when sharing a Resource/version;
- recipient access must be re-evaluated when rendering/acting;
- Conversation membership does not grant Resource access;
- forwarding/re-sharing does not elevate Resource access.

This is especially important for restricted Field Submissions and unpublished editorial versions.

8B.4 acceptance must contain a negative test proving that a participant who can read the Conversation but lacks underlying Resource permission cannot open or act on the referenced Resource/version.

## 12. Super Admin Control Center extension

The Phase 8B contract already reserves an `Agents` area under `/admin/messages`.

8B.3 shipped the Super Admin-only Control Center and its server-enforced capability boundary.

8B.4 should extend that existing surface for the real MIZIZI proof rather than create `/admin/agents` as a parallel control plane.

Minimum useful 8B.4 presentation may include:

- MIZIZI actor identity/status;
- permitted messaging purpose/scope;
- most recent governed Message/standup result;
- recent failures if available through reused job/control-plane authority;
- an explicit disable/kill control only for MIZIZI's **Messages permission**, unless a separate domain-authorized action is deliberately invoked.

Disabling MIZIZI messaging must not silently disable Registry authority.

## 13. Things this audit explicitly rejects

Phase 8B.4 must not introduce:

- a second message store;
- a second notification store;
- a second generic scheduler;
- a second jobs queue;
- a second outbox;
- a second Resource review system;
- a Field-specific messaging table;
- copied Field email/phone PII inside Messages;
- copied Resource content as Message authority;
- a fake Auth user for MIZIZI;
- a fake Person for MIZIZI;
- a god-mode service principal;
- Safety Case/quarantine work from Phase 8B.5;
- Legal preservation/disclosure work from later authority;
- public Messages audience expansion merely to create test identities.

## 14. Minimal implementation sequence

This audit recommends **three serious implementation candidates**, not a proliferation of micro-phases.

### Candidate A — System Actor accountability + governed System Messages

Lock and implement the minimum missing System Actor authority and System Actor Messages path.

Expected scope:

- accountable actor registry/profile;
- seed/register `mizizi` through governed migration/config authority;
- narrow System Actor send command using existing command receipts;
- actor scope/purpose/recipient enforcement;
- system-aware conversation/detail projections;
- system-aware notification bridge;
- permanent verifier and replay proof.

No scheduled standup product yet beyond what is needed to prove the command safely.

### Candidate B — Real MIZIZI + Field verticals

Use Candidate A with existing domain authority.

Expected scope:

- real MIZIZI operational standup Message to the intended Super Admin using existing MIZIZI/Registry evidence;
- reuse existing jobs/control-plane scheduling rather than new scheduler authority;
- Field contact-policy convergence;
- authorized newsroom <-> contributor Messages action using the existing Field Submission Resource and existing Messages authority;
- no copied Field PII;
- negative restricted-Resource access tests.

### Candidate C — Exact-version workflow projection + 8B.4 acceptance

Expected scope:

- present existing Message Resource/version references in the user product;
- one exact-version review card/action using an existing target-domain review RPC unchanged;
- stale-state/concurrency negative test;
- unauthorized Resource access negative test;
- integrated acceptance across human-to-human, system-to-human, Field-to-newsroom, and exact-version workflow communication;
- Production promotion and closure only after real vertical proof.

Candidate boundaries may be adjusted if repository constraints make two candidates cleaner, but no implementation PR may mix in 8B.5 Safety or Legal authority.

## 15. Required acceptance matrix

### System Actor

- registered actor `mizizi` is active and explicitly scoped;
- service credential alone cannot send as arbitrary actor key;
- disabled/out-of-scope actor cannot send;
- recipient `system` sender policy is enforced;
- retry with the same idempotency key does not duplicate a Message;
- MIZIZI is rendered as a System Actor, not a Person/Auth user;
- notification uses existing notification authority and leaks no Message body.

### MIZIZI vertical

- one Message is derived from real governed MIZIZI evidence;
- evidence can be traced to existing Registry/control-plane authority;
- no duplicate MIZIZI run/history store is created;
- Super Admin receives and opens it through ordinary Messages.

### Field vertical

- `no_follow_up` / equivalent denied state prevents newsroom contact;
- permitted Messages contact starts/uses canonical Messages;
- Field Submission identity is referenced, not copied;
- restricted Field content remains protected by underlying Resource authority;
- contributor can reply through ordinary Messages;
- no Field-owned Conversation/Message rows exist.

### Exact-version workflow vertical

- Message references an exact canonical Resource Version;
- recipient must independently possess target Resource authority;
- projected action invokes the target domain's existing review RPC;
- stale expected revision fails closed;
- repeating the target-domain idempotency key does not duplicate the review decision;
- Message content alone cannot mutate Resource state.

## 16. Audit conclusion

Phase 8B.4 is ready for a **locked implementation design candidate**.

The audit did not find a need for broad infrastructure work.

The correct architecture is:

```text
existing MIZIZI evidence
        |
        v
accountable System Actor identity
        |
        v
existing Messages Conversation / Message
        |
        +--> existing Notifications projection
        |
        +--> existing Resource/version references
        |          |
        |          v
        |    existing domain review command
        |
        +--> existing Field Submission Resource

existing command receipts / jobs / outbox underneath
```

The implementation should remain narrow enough that every new row/function exists because one of the three required real verticals needs it.

## Deployment classification

```text
SQL migration needed for this audit PR: No
Supabase Edge Function deploy needed: No
Frontend deploy needed: No
Production activation needed: No
Preview needed for this audit PR: No
```

The next repository move after this audit is accepted is the Candidate A design/implementation boundary for accountable System Actors + governed System Messages.
