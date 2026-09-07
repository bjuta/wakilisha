# Phase 8B.4 Candidate C - Exact-version Playlist Review Through Messages

**Status:** Design locked for implementation  
**Date:** 7 September 2026  
**Base main:** `b6e3a3db8f55b2ea782536b2b763aa3207b11382`  
**Parent authority:** `docs/engineering/phase-8b-messages-authority-and-product-contract.md`  
**Opening record:** `docs/engineering/phase-8b-slice-state-and-8b4-opening-record.md`  
**8B.4 authority audit:** `docs/engineering/phase-8b4-system-actors-real-verticals-authority-audit.md`  
**Tracker:** Issue #848

## 1. Candidate C objective

Candidate C closes the third and final real-vertical proof required by Phase 8B.4:

> one exact-version editorial Resource review projection/action routes through Messages while the owning Resource's existing review command remains the sole mutation authority.

The implementation must prove that a Message can carry an immutable exact Resource Version reference, project the current owning-workflow review state to an authorized user, and offer the owning workflow's existing review action without creating a Messages-owned review system.

Candidate C does **not** create generic workflow cards, a universal approval API, a second review queue, a new publication workflow, or a Messages-specific editorial command family.

## 2. Locked first proof target: Playlist

The first Candidate C target is **Playlist review**.

This target is chosen because the accepted 8B.4 authority audit explicitly recommends Audio, Video, or Playlist as the smallest correct first proof. Their review commands already require both:

```text
exact submitted_version_id
expected authority_revision
```

That gives the owning workflow server-enforced stale-card rejection.

Production currently exposes:

```text
public.review_playlist(
  p_playlist_id uuid,
  p_expected_authority_revision bigint,
  p_submitted_version_id uuid,
  p_decision text,
  p_idempotency_key text,
  p_note text,
  p_correlation_id uuid
)
```

Supported review decisions are:

```text
start_review
request_changes
approve
```

The command already enforces:

- authenticated caller;
- administrator or `manage_review_queue` capability;
- exact Playlist identity;
- exact submitted Resource Version identity;
- expected authority revision;
- current submitted-version equality;
- valid review transition;
- required note for `request_changes`;
- target-domain command receipt/idempotency authority;
- canonical shared Resource review and lifecycle events;
- approved-version snapshot creation on approval.

Messages must call this existing command. It must not reimplement any of these rules.

## 3. Why Article is not Candidate C's first proof

Article review remains a valid future Messages projection target, but it is not the smallest independently safe Candidate C proof.

Current Article review RPCs accept an explicit version id, but the accepted Audio/Video/Playlist review contracts already combine exact submitted-version identity with an explicit authority-revision concurrency token.

Candidate C therefore compounds the stronger existing Playlist command rather than modifying Article review authority merely to satisfy the Messages proof.

## 4. Existing Messages authority already sufficient for storage

No new workflow-card storage is required.

Canonical Messages already owns immutable typed Resource references in:

```text
messaging.message_resource_references
```

with:

```text
resource_id
resource_version_id
presentation_kind = resource | version
```

`messaging.validate_resource_references(...)` already requires:

- at most four references;
- `presentation_kind='resource'` only with null version;
- `presentation_kind='version'` only with non-null exact version;
- sender Resource access through `messaging.can_user_reference_resource(...)`.

Conversation reads already re-evaluate `messaging.can_user_reference_resource(...)` for the current viewer before projecting each reference.

Therefore Conversation membership must continue to grant **zero** underlying Playlist/Resource authority.

## 5. Current missing authority

Candidate C has one narrow backend permission/projection gap and one product gap.

### 5.1 Playlist review participation is not yet available to Messages by arbitrary user id

Current Playlist review participation is authenticated-current-user shaped:

```text
editorial.current_user_can_participate_playlist_review(resource_id)
```

Its accepted semantics are:

```text
can edit Playlist
OR administrator
OR view_review_queue
OR manage_review_queue
```

Current `messaging.can_user_reference_resource(user_id, resource_id, version_id)` cannot reuse that helper because it evaluates an arbitrary viewer/sender user id rather than only `auth.uid()`.

Candidate C will add one user-id-level Playlist review participation helper with the **same semantics** as the existing current-user helper. The current-user helper should delegate to that user-id-level authority so the rule is not duplicated permanently.

The Messages Resource-reference permission will then extend only for:

```text
resource_kind='playlist'
AND exact version belongs to that Resource
AND user has Playlist review participation authority
```

This does not grant review-action authority. It grants only permission to reference/read the governed Playlist version identity.

### 5.2 Messages has no safe Playlist exact-version projection

The existing full Playlist review workspace is intentionally Playlist-editor shaped and includes more domain detail than Messages needs.

Candidate C will add one narrow authenticated read projection for an exact Playlist Resource/version pair. Conceptual contract:

```text
public.get_message_playlist_review_projection_v1(
  p_resource_id uuid,
  p_resource_version_id uuid
) -> jsonb
```

The exact implementation may return a table instead of jsonb if repository conventions make that materially simpler, but the projected fields are locked to the minimum useful workflow metadata:

```text
resource_id
resource_version_id
playlist_id
title
slug
version_number
version_kind
playlist_status
authority_revision
current_submitted_version_id
is_current_submitted
can_participate_review
can_manage_review
allowed_review_actions
```

It must not project:

- Playlist item contents merely for Message display;
- private notes;
- Registry match internals;
- Media governance details;
- Discovery metadata;
- publication controls;
- arbitrary lifecycle mutation authority.

The projection must independently recheck current Playlist review participation for the authenticated viewer.

## 6. Existing owning-workflow read and action authority remains canonical

The full Playlist editor already uses:

```text
public.get_playlist_review_workspace(playlist_id)
```

and its existing frontend service:

```text
fetchPlaylistDetail(...)
reviewPlaylist(...)
```

The existing `reviewPlaylist(...)` service already sends:

```text
playlist_id
submitted_version_id
expected_authority_revision
decision
note
new target-domain idempotency key
correlation id
```

Candidate C may extend the service only enough to accept an optional correlation id supplied by Messages. It must continue to invoke `public.review_playlist(...)` directly.

No function with semantics such as the following is permitted:

```text
messages.approve_resource(...)
messages.request_resource_changes(...)
messages.review_playlist(...)
messages.perform_workflow_action(...)
```

## 7. Message-card state and action policy

The Message card must mirror the existing Playlist review decision workspace, not the broader set of transitions the raw RPC can technically validate.

Locked action policy:

```text
ready_for_review
  -> Start Review

in_review
  -> Request Changes
  -> Approve

all other states
  -> no review action
```

Candidate C explicitly does **not** surface Publish in Messages.

Publication remains in the Playlist workspace and is outside the proof required to close 8B.4.

### Request Changes note

`Request Changes` requires a note because the existing Playlist review command requires one.

Messages may present a small action dialog/composer for that note, but the note is passed directly to the Playlist command. Messages does not store a parallel review-decision record.

## 8. Stale-card contract

A Message is immutable historical context. A Message card is not immutable workflow authority.

Every card render must resolve current owning-workflow state again.

The exact reference in the Message remains:

```text
resource_id = exact Playlist Resource
resource_version_id = exact submitted Playlist version
presentation_kind = version
```

Before rendering an action, the projection must determine whether that exact version is still the Resource's `current_submitted_version_id` and return the current Playlist `authority_revision`.

Before mutation, `public.review_playlist(...)` rechecks both values again.

Therefore:

```text
Message references Version N
-> Playlist changes / new submission / review transition occurs
-> old Message remains historical
-> card refreshes as stale/non-actionable
-> stale action cannot mutate current Playlist state
```

If a user clicks while state changes concurrently, the Playlist command's existing rejected command receipt is authoritative. The UI must refresh the card and show the domain rejection rather than retrying against a newer version automatically.

A stale Message is never approval authority.

## 9. Product entry path: exact version into Messages

Candidate C must expose existing Message Resource-reference support through a deliberate Playlist workflow entry point.

### Playlist workspace

When a Playlist has `currentSubmittedVersionId` and the current user may participate in review, the Playlist review workspace gains one secondary action:

```text
Discuss in Messages
```

This action carries only URL intent to Messages:

```text
/messages?resource=<resource_id>&version=<submitted_version_id>&presentation=version&workflow=playlist-review
```

The query string is not authority. Messages must resolve and validate the exact version through the new authenticated projection before allowing it to be attached.

### Messages New Message flow

When the validated workflow intent is present:

- New Message opens with one governed Playlist Version attachment;
- existing recipient discovery remains authoritative;
- no automatic reviewer assignment table is introduced;
- the user writes ordinary Message body text;
- `start_message_conversation(...)` receives the exact version reference through the existing `p_resource_references` argument.

The ordinary Messages service helpers will be extended to accept optional governed Resource references rather than hard-coding `[]`.

Existing ordinary Messages without attachments remain unchanged.

### Existing Conversation send

`sendMessage(...)` may accept the same optional references so a reviewer can attach the exact version to an existing authorized Conversation. Candidate C does not require a second send command.

## 10. Messages card presentation

The existing `GovernedResourceReferenceCard` becomes a small resolver host rather than a Field-only component.

Resolution order is narrow and typed:

1. Field `presentation_kind='resource'` continues using the accepted Candidate B Field projection;
2. Playlist `presentation_kind='version'` attempts the Candidate C Playlist review projection;
3. unknown or unsupported governed references retain the generic governed-reference presentation.

Authorized Playlist projection example:

```text
PLAYLIST REVIEW
Top 50 Kenyan Songs Of 2025
Version 7
In review

[Open Playlist]
[Request Changes] [Approve]
```

The exact UI copy may be refined during implementation, but it must remain WAKILISHA product copy and must not expose internal governance jargon to ordinary users.

`Open Playlist` routes to the existing owning workspace:

```text
/admin/content/playlists/<playlist_id>
```

No duplicate Playlist detail surface is created in Messages.

## 11. Permission behavior

### Sender reference permission

A user may attach the exact Playlist version only if current Playlist review-participation authority permits that user to access the underlying Playlist Resource/version.

### Recipient/viewer permission

Conversation reads continue to re-evaluate Resource access for each viewer.

A Conversation participant who lacks Playlist review participation receives **no protected version reference projection** from the canonical Messages read.

Conversation membership therefore cannot reveal:

- exact unpublished Playlist version identity;
- Playlist title/status through the Candidate C projection;
- review controls.

### Action permission

Even an authorized review participant sees review-action controls only when the fresh projection says:

```text
can_manage_review=true
```

The target `review_playlist` command independently rechecks administrator / `manage_review_queue` authority again at mutation time.

## 12. Candidate C acceptance matrix

### Structural / permanent verifier

The permanent Candidate C verifier must prove at minimum:

1. exact-version Message references remain immutable;
2. Playlist user-id review participation helper matches current-user Playlist participation semantics;
3. `messaging.can_user_reference_resource(...)` allows exact Playlist versions only to authorized Playlist review participants;
4. unauthorized Conversation participant cannot receive the protected Playlist version reference;
5. safe Playlist Message projection returns only the locked minimum fields;
6. projection binds exact Resource -> Playlist -> exact Resource Version;
7. projection reports `is_current_submitted=false` when the Message version is superseded;
8. `can_manage_review` is independent from Conversation membership;
9. no browser direct table grants are introduced;
10. anonymous execution is denied;
11. no Messages-owned review mutation function exists;
12. global Messages audience remains unchanged.

### Behavioral rollback proof

A rollback-only fixture must prove:

1. create Playlist Resource + exact submitted version;
2. attach that exact version to a canonical Message;
3. authorized reviewer can resolve the card;
4. unauthorized Conversation participant cannot resolve the protected reference;
5. `Start Review` routes through `public.review_playlist` and advances authority revision;
6. exact same Message/version projection refreshes to current review state;
7. stale expected authority revision is rejected by Playlist command authority;
8. superseded submitted version is rejected by Playlist command authority;
9. `Request Changes` without note is rejected;
10. action receipt is the existing Playlist command type/receipt authority;
11. no Messages table stores Playlist review state or decision authority;
12. fixture rolls back completely.

### Preview product acceptance

Controlled Preview browser acceptance must prove:

```text
Playlist workspace -> Discuss in Messages: PASS
exact Version attachment shown before send: PASS
Message persists exact Resource Version ref: PASS
reviewer card title/version/status projection: PASS
Open Playlist exact destination: PASS
Start Review through existing Playlist authority: PASS
card refreshes to in_review: PASS
Request Changes requires note: PASS
Approve through existing Playlist authority: PASS
stale/superseded card loses actions: PASS
unauthorized participant cannot open/act: PASS
ordinary Messages regression: PASS
```

Candidate C implementation PR must not merge before this controlled Preview acceptance is complete.

### Production acceptance

Production must prove one real Playlist exact-version workflow through Messages against a real submitted Playlist version.

Current Production inventory has no currently reviewable Playlist despite one historical submitted pointer remaining on a published Playlist. That historical published item must **not** be mutated merely to manufacture acceptance.

Production acceptance will therefore use one real controlled Playlist submission through the existing Playlist product workflow after Candidate C is deployed.

The current Production account inventory has only one staff-category user. Before live two-human acceptance, a second real account may receive an existing staff role only if explicitly approved for the controlled test. No new role/capability schema is justified for Candidate C.

After acceptance, any temporary role assignment must be reviewed and either retained as intentional account authority or removed explicitly.

## 13. CI consolidation

Candidate C does not justify test-file sprawl.

Implementation should extend existing contracts where possible:

```text
test/playlists/playlist-admin-contract.test.ts
existing Messages product/contract test
existing control-plane Messages verifier/test
```

A new permanent verifier file is justified only for the cross-domain runtime invariants that do not belong cleanly in an existing verifier. If created, it must replace the need for multiple one-off tests rather than add parallel coverage.

## 14. Deployment classification

Candidate C implementation classification:

```text
SQL migration needed: YES, expected one narrow forward migration
Supabase Edge Function deploy needed: NO
Frontend update needed: YES
Frontend deploy needed: YES
Production activation needed: YES after Preview acceptance
Implementation PR needed: YES after local + Preview proof
```

The SQL migration is expected to contain only the missing read/permission convergence required for Playlist exact-version Messages projection. It must not alter `public.review_playlist(...)` unless implementation audit discovers a concrete incompatibility with the locked existing command contract.

## 15. Implementation scope ceiling

The implementation candidate should remain compact:

```text
1 SQL migration
1 permanent verifier or consolidation into existing verifier
Messages service optional Resource references
Playlist review Message-entry link/action
Playlist Messages projection service
Messages exact-version card/action UI
targeted consolidated tests
schema/replay seal
```

No Edge Function should be added.

No second Preview should be created concurrently.

No Production change occurs until the disposable Candidate C Preview passes backend, browser, stale-card, and permission-negative acceptance.

## 16. Exit decision

Candidate C is complete only when the exact-version Playlist review action is proven through canonical Messages and the actual mutation is independently attributable to the existing Playlist review command.

At that point all three required 8B.4 verticals are proven:

```text
MIZIZI -> Super Admin: closed in Production
Field contributor <-> newsroom: closed in Production
exact-version editorial review through Messages: Candidate C
```

Candidate C closure therefore closes Phase 8B.4 and hands the programme to Phase 8B.5 Trust, Safety & Legal.