# Phase 8B Slice State and 8B.4 Opening Record

**Status:** Current numbered Messages authority  
**Date:** 7 September 2026  
**Accepted main at opening:** `bf7ec8486a93586f073519300912c592c60e97c9`  
**Current numbered work:** Phase 8B.4, System Actors + Real Verticals

## Purpose

This record reconciles the accepted Phase 8B Messages programme after the Production closure of Phase 8B.3 and opens the next numbered Messages slice.

It is append-only current-state authority. It does not rewrite the dated historical meaning of:

- `docs/roadmap/phase-8-to-16-programme-reconciliation.md`, whose 4 September 2026 header correctly recorded Phase 8A as current at that time;
- `docs/engineering/phase-8b-messages-authority-and-product-contract.md`, whose 6 September 2026 header records the design-candidate state before implementation;
- `docs/engineering/phase-8b-messages-core-schema-design.md`, whose header records the pre-SQL design-candidate state.

Where those historical headers differ from this record about current numbered work, this record is newer authority.

## Audit basis

The slice-state audit used repository and Production authority, not planning intent alone.

Evidence includes:

- merged Phase 8B.1 contract PR #841;
- merged Phase 8B.2 design PR #842;
- merged Phase 8B.2 core foundation PR #843;
- merged Phase 8B.2 user commands and reads PR #844;
- merged Phase 8B.3 product and Control Center PR #845;
- merged Phase 8B.3 Production closure PR #846;
- permanent Phase 8B.2 SQL verifiers;
- Phase 8B.3 permanent verifier and replay-proof family;
- Production migration authority at 102 migrations with head `20260907003000`;
- exact merged-main Lightsail deployment parity;
- Production HTTPS smoke;
- Preview-to-Production migration parity before Preview deletion.

## Slice state

### 8B.1, Authority and Product Contract

**State: CLOSED**

PR #841 merged the documentation-only authority and product contract at merge commit:

```text
f7f8e45a655e40e184fa42b93bd521207e9b7766
```

The contract established the ownership boundaries required before schema work, including:

- Conversation, Participant, Message, receipt, and timestamp meaning;
- Inbox, Requests, Spam, and Archive semantics;
- server-enforced user messaging preferences;
- progressive Messages audience authority;
- accountable System Actor requirements;
- MIZIZI as the first intended system-to-human proof;
- Field contact integration without Field-owned messaging;
- Safety and Legal as peer authorities;
- Super Admin-only Control Center requirements;
- the six-slice Phase 8B Messages programme.

Its exit condition was acceptance sufficient to begin 8B.2 schema design. That happened immediately through merged PR #842.

No further 8B.1 work is open.

### 8B.2, Messages Core

**State: IMPLEMENTATION COMPLETE; CORE AUTHORITY ACCEPTED**

The design, structural foundation, and governed user command/read surface merged through PRs #842, #843, and #844.

Accepted merge sequence:

```text
PR #842 -> 9778c150b8fca83ca7363348c65489910ccc42a4
PR #843 -> 9f21d99778d7e961b427b564872f636275ec9367
PR #844 -> 22faadedc97efe25457d3249efdd95330c85d287
```

The implemented core includes:

- private `messaging` schema;
- Conversation, Participant, Message, and Message Receipt authority;
- participant-owned mailbox state;
- immutable Resource and exact Resource Version references;
- server-enforced sender policies and sender approvals;
- internal audience policy;
- `super_admin` role and `manage_messages_control_center` capability foundation;
- seven durable Messages command types;
- authenticated start, send, request, mailbox, preference, read, and conversation RPCs;
- no anonymous execution of the user Messages RPC family;
- no direct browser table privileges on canonical Messages tables.

Permanent structural verification remains authoritative through:

```text
scripts/control-plane/verify-phase-8b-messages-core-foundation.sql
scripts/control-plane/verify-phase-8b-messages-user-commands-reads.sql
```

Those verifiers prove, among other invariants:

- RLS remains enabled on canonical Messages tables;
- browser roles do not receive direct Messages table privileges;
- Messages and Resource references remain immutable;
- the command set is exact;
- the required authenticated RPC set exists;
- anonymous execution remains denied;
- the runtime audience remains governed rather than inferred from frontend visibility.

The original 8B.2 programme wording also called for controlled users to communicate through each ordinary mailbox state. The repository does not contain a dedicated standalone 8B.2 closure document enumerating that runtime exercise state by state.

That documentation gap is recorded rather than backfilled with invented evidence.

It does not reopen the 8B.2 implementation slice. The later 8B.3 Preview product acceptance successfully exercised the same accepted core through real two-user send/reply, recipient discovery, request/product routing, notification integration, privacy enforcement, and role-boundary behavior before Production promotion.

No new 8B.2 implementation branch is required unless a concrete regression is observed.

### 8B.3, Product + Super Admin Control Center

**State: CLOSED IN PRODUCTION**

PR #845 merged the Phase 8B.3 implementation at:

```text
73d41bc33d9d4cefb09dce41c594f3567aa70258
```

The complete Production closure is recorded in:

```text
docs/engineering/phase-8b3-messages-product-control-center-production-closure-record.md
```

Accepted Production state:

```text
Production migrations: 102
Production migration head: 20260907003000
Permanent verifiers: PASS
Replay proofs: PASS
Edge Function deployment: NOT REQUIRED
Merged-main frontend build: PASS
Lightsail deployment: PASS
Build parity: PASS
Nginx validation: PASS
Production HTTPS smoke: PASS
Rollback backup: PRESERVED
Disposable Preview: DELETED
```

PR #846 merged that closure record at:

```text
bf7ec8486a93586f073519300912c592c60e97c9
```

No further 8B.3 work is open unless a new Production defect is observed.

## Current programme position

Phase 8B as a whole is **not closed**.

The remaining accepted Messages slices are:

```text
8B.4 System Actors + Real Verticals
8B.5 Trust, Safety & Legal
8B.6 Antifragile Acceptance + Phase Closure
```

The current numbered slice is therefore:

```text
Phase 8B.4, System Actors + Real Verticals
```

## 8B.4 binding scope

8B.4 must prove that the shared Messages authority works for real consumers beyond ordinary human direct messaging.

The accepted contract requires three real vertical proofs.

### 1. MIZIZI to Super Admin

MIZIZI becomes the first accountable system-to-human Messages consumer.

The proof must use real governed MIZIZI operational evidence rather than invented standup statistics.

Messages owns delivery and conversation history.

Registry and MIZIZI retain their existing Registry authority.

Scheduling, retries, durable work, and delivery orchestration must reuse the existing job and transactional-outbox substrate.

### 2. Field contributor to newsroom

Field contributor communication must converge on the same Messages authority without creating Field-owned conversation or Message storage.

The vertical must preserve the existing Field Submission, contact-permission, Media, provenance, privacy, and protected-source boundaries.

Raw contact PII must not be copied into ordinary Message or Field review projections merely to make the integration convenient.

### 3. Exact-version editorial workflow projection

At least one editorial Resource workflow must appear through Messages against an exact canonical Resource Version.

Messages may project the state and present an action.

The target Resource's existing review command remains the mutation authority.

No Message text, system actor, or Messages-owned command may confer or simulate canonical approval authority.

## 8B.4 exit gate

8B.4 closes only when all of the following are proven through the same Messages authority:

1. human-to-human communication remains intact;
2. MIZIZI sends one governed system-to-human operational Message to an authorized Super Admin recipient;
3. one Field contributor and newsroom recipient communicate through Messages while Field and Media authority remain intact;
4. one exact-version editorial Resource review projection/action routes through the target Resource's existing authority;
5. the executing service credential is distinguishable from the accountable System Actor identity;
6. System Actor scope cannot exceed its explicit capabilities, allowed purposes, recipient scope, or Resource/action scope;
7. no duplicate scheduler, generic job queue, notification queue, review system, Media store, or Resource mutation authority is introduced.

## Immediate next engineering move

The first 8B.4 implementation action is **read-only authority audit**, not schema creation.

Audit the current repository for:

- existing MIZIZI run identity, run evidence, scheduling, and operator surfaces;
- existing durable jobs, worker leases, retries, dead letters, and transactional outbox paths that can carry system Messages;
- current service-principal and audit identity semantics;
- existing Field contact preference and contributor identity authority;
- existing Field-to-newsroom review surfaces;
- current exact Resource Version review commands and capability checks suitable for a Messages projection;
- existing notification projection behavior that must remain separate from Message-body authority;
- any already-existing actor/accountability primitive that can satisfy part of the System Actor contract without duplication.

The audit must produce a reuse-versus-missing-authority map before any 8B.4 SQL is proposed.

## What not to do

Do not begin 8B.5 Safety or Legal implementation during 8B.4.

Do not broaden Messages audience beyond the accepted current policy merely to create test recipients.

Do not create a second scheduler, job queue, outbox, notification store, review system, Media authority, Field messaging store, or generic universal actor abstraction.

Do not make MIZIZI a god-mode service principal.

Do not let Message text or AI-generated content confer workflow authority.

## Deployment classification

This opening record is documentation only.

```text
SQL migration needed: No
Supabase Edge Function deploy needed: No
Frontend deploy needed: No
Production activation needed: No
```

The next implementation PR is not authorized until the 8B.4 read-only authority audit identifies the smallest missing authority required for the three real vertical proofs.
