# Phase 8A Field Submission Threat Model and Schema Design

Date: 4 September 2026

## Status

Design authority proposed for acceptance.

Opening accepted main:

`a19afb03deeef2a1190a502f54fa07c547926be3`

Current numbered programme:

**Phase 8A: Safe mobile intake.**

This document converts the accepted Phase 8A read-only authority audit into a concrete Field Submission, permission, Media binding, capability reissue, local durability, safety, and receipt contract.

No Phase 8A SQL may be written until this design is reviewed, merged, and accepted.

This design does not change runtime behavior, deploy an Edge Function, create a Supabase preview, or start production mutation.

## Locked inputs

This design is constrained by:

- `docs/engineering/phase-8a-safe-mobile-intake-authority-audit.md`;
- `docs/roadmap/phase-8-to-16-programme-reconciliation.md`;
- `docs/engineering/primitive-compounding-contract.md`;
- `docs/engineering/wakilisha-cultural-operating-layer-doctrine.md`;
- the accepted Resource kernel closure;
- the accepted role and capability substrate;
- the accepted command, receipt, job, and outbox substrate;
- the accepted Media logical identity, immutable file, revision, usage, governance, and event authority;
- the accepted Phase 4B resumable Media transfer and receiver;
- the accepted Media processing authority;
- existing Trust, Corrections, Registry, and provenance authority.

The design must extend these authorities without replacing or duplicating them.

## Phase 8A product boundary

Phase 8A proves one safe contributor intake path.

The first real vertical proof is:

- authenticated contributor;
- mobile browser;
- one video file or mobile video recording;
- unreliable network;
- resumable transfer through existing Media upload sessions and receiver;
- private immutable original;
- Field Submission provenance and safety declarations;
- truthful contributor receipt;
- no publication.

Phase 8B owns newsroom triage, verification, redaction decisions, promotion, rejection, contributor follow-up, and publication workflow integration.

## Design decisions

The following decisions are locked for Phase 8A implementation.

1. Field Submission is a new private typed domain authority.
2. Field Submission receives stable Resource identity.
3. Field Submission does not receive a public route.
4. Field Submission does not create Resource Version snapshots in Phase 8A.
5. Field Submission intake lifecycle remains distinct from publication lifecycle.
6. The first runtime proof is authenticated only.
7. The first Media proof is video only.
8. Existing `media.upload_sessions` and the existing receiver remain transfer authority.
9. Existing `media.file_objects`, `media.assets`, and `media.asset_revisions` remain file and Media identity authority.
10. Existing `media.usage_links` remains the canonical Field Submission to Media relationship authority after a narrow semantic extension.
11. The generic public Media usage command remains unchanged because its public-safety rules are intentionally too strict for a protected field original.
12. A narrow private Field Media binding adapter may write canonical Media usage and Media events for `field_original` only.
13. Existing receiver code already supports safe per-session capability rotation when the same immutable session metadata is re-posted by the trusted control plane.
14. Browser durable storage must never persist the receiver capability token.
15. A new Field-specific Edge Function control plane is required. The existing administrative `media-upload-api` remains unchanged for Media Library authority.
16. The submitted original is preserved privately. It is not destructively rewritten merely to remove metadata.
17. No processing job is submitted automatically for the first Field original proof.
18. Contributor declarations are immutable historical intake facts after submission. They do not become automatic proof of canonical rights or consent.
19. Exact device geolocation is not collected in the first Phase 8A slice.
20. A successful receipt means WAKILISHA accepted the private submission and canonical Media original. It does not mean editorial approval, publication, or factual verification.

## Why Field Submission is a Resource

The Resource kernel already provides stable cross-system identity, owner identity, visibility, lifecycle position, command correlation, and durable command receipts.

Correction Case proves that a private institutional workflow can use stable Resource identity without a public route.

Field Submission needs the same stable cross-system properties:

- one canonical UUID;
- one owner;
- one durable command aggregate;
- one correlation anchor;
- one stable relationship target for Media usage;
- one safe internal link target;
- future Phase 8B relationship targets;
- no public route requirement.

Therefore Phase 8A adds:

`editorial.resource_kinds.kind = 'field_submission'`

Every server-side Field Submission also has one row in:

`editorial.resources`

with:

- `resource_kind = 'field_submission'`;
- `owner_id = authenticated contributor user id`;
- `visibility = 'private'`;
- `lifecycle_state = 'active'` while intake is active or submitted;
- `created_by = authenticated contributor user id`.

The domain row is the typed binding for the Resource.

## Resource kernel compatibility requirement

The current `editorial.assert_resource_binding_integrity()` helper enumerates supported Resource kinds and rejects an unknown kind.

The Phase 8A foundation migration must narrowly extend that helper so:

- `field_submission` resolves only to `editorial.field_submissions`;
- every `field_submission` Resource has exactly one Field Submission row;
- all existing Resource-kind branches retain identical behavior;
- no unrelated Resource kind or binding rule changes.

This is part of the Field Submission foundation, not optional cleanup.

## No Resource Version rows in Phase 8A

Field Submission has revisioned mutable intake state, but it is not a publication snapshot.

Phase 8A therefore does not create:

- `field_submission_versions`;
- `editorial.resource_versions` rows for declaration edits;
- submitted, approved, or published Resource pointers;
- Field-specific review-event tables.

The Field Submission row carries optimistic concurrency through `current_revision`.

Meaningful Field Submission transitions are preserved through append-only Field Submission events.

If Phase 8B later proves a need for immutable review snapshots, that extension must reuse the Resource kernel rather than invent a parallel version system.

## Field Submission lifecycle

Server lifecycle values are:

- `receiving`;
- `received`;
- `submitted`;
- `cancelled`;
- `expired`.

`draft_local` is a client-only state and must never be written as server authority.

### `receiving`

The Field Submission exists and may receive declaration edits and one or more Media intake attempts.

No receipt has been issued.

### `received`

At least one required Field original has been adopted as canonical private Media and attached to the submission, but final submission has not completed.

Declaration edits remain allowed.

### `submitted`

Required Media and required declarations are complete.

The submission is frozen for contributor editing.

A safe receipt may be issued.

### `cancelled`

The contributor cancelled before canonical submitted acceptance.

Any still-unverified current upload attempt must be cancelled through existing Media upload-session authority.

A verified canonical Media original must not be destructively deleted to simulate cancellation.

### `expired`

The Field Submission was abandoned according to a separately enforced server inactivity rule.

A single expired Media upload attempt does not automatically expire the Field Submission.

## Server lifecycle transition law

Allowed Phase 8A transitions are:

```text
receiving -> received
receiving -> cancelled
receiving -> expired
received -> submitted
received -> cancelled
received -> expired
```

No transition leaves `submitted`, `cancelled`, or `expired` during Phase 8A.

Phase 8B may introduce governed newsroom state without rewriting Phase 8A history.

Every state change must:

- require expected `current_revision`;
- increment `current_revision` exactly once;
- record actor and time;
- append one Field Submission event;
- complete or reject one platform command receipt where the transition is command-driven.

## Field Submission table

Create:

`editorial.field_submissions`

### Identity columns

- `resource_id uuid primary key`;
- `resource_kind text not null default 'field_submission'`;
- `submission_reference text not null unique`;
- `owner_user_id uuid not null`;
- `submitter_mode text not null default 'authenticated'`;
- `current_revision bigint not null default 1`;
- `submission_state text not null default 'receiving'`.

`resource_id` and `resource_kind` form the typed Resource binding.

`owner_user_id` must equal the Resource owner at creation and may never change.

`submission_reference` is a safe display reference. It must be generated with sufficient entropy and must not expose a sequential database identity.

A recommended format is:

`FS-YYYYMMDD-XXXXXXXXXX`

where the suffix is random, uppercase, non-secret display material.

The receipt reference is not an authorization token.

### Contributor identity and disclosure columns

- `newsroom_identity_mode text not null default 'standard'`;
- `public_attribution_preference text not null default 'do_not_name'`;
- `contact_preference text not null default 'account_contact'`.

Allowed `newsroom_identity_mode` values:

- `standard`;
- `restricted`.

Allowed `public_attribution_preference` values:

- `may_name`;
- `do_not_name`.

Allowed `contact_preference` values:

- `account_contact`;
- `no_follow_up`.

Phase 8A must not label authenticated `restricted` mode as anonymous.

`restricted` means fewer newsroom readers may resolve contributor identity.

`do_not_name` means the contributor does not authorize public naming through this intake declaration.

Neither setting creates technical anonymity.

### Rights declaration columns

- `rights_declaration text not null`;
- `rights_declaration_detail text`.

Allowed `rights_declaration` values:

- `owns_or_controls`;
- `authorized_by_rights_holder`;
- `uncertain`;
- `other`.

The optional detail is a contributor statement, not canonical rights proof.

### Consent declaration columns

- `consent_declaration text not null`;
- `consent_declaration_detail text`.

Allowed `consent_declaration` values:

- `granted`;
- `not_required`;
- `uncertain`;
- `not_obtained`.

The declaration is intake provenance. It does not directly set canonical Media consent to `granted`.

### Safety columns

- `declared_sensitivity text not null default 'none'`;
- `source_protection_request text not null default 'internal'`;
- `embargo_request_mode text not null default 'none'`;
- `requested_embargo_until timestamptz`;
- `location_mode text not null default 'not_collected'`;
- `location_description text`;
- `content_captured_at timestamptz`;
- `intake_notes text`.

`declared_sensitivity` reuses the existing Media vocabulary:

- `none`;
- `low`;
- `moderate`;
- `high`;
- `extreme`.

`source_protection_request` is limited to protected intake values:

- `internal`;
- `restricted`;
- `confidential`.

Field intake does not allow a contributor to make an original `public` or `public_redacted` at ingestion.

`embargo_request_mode` values:

- `none`;
- `until_review`;
- `until_time`.

`requested_embargo_until` is required only when mode is `until_time` and must be in the future when submitted.

`until_review` remains a Field Submission hold request because current Media embargo authority requires a concrete timestamp for active or scheduled embargo.

`location_mode` values in the first Phase 8A implementation:

- `not_collected`;
- `coarse_text`.

`location_description` is permitted only with `coarse_text`.

Phase 8A stores no latitude, longitude, altitude, GPS accuracy, or device location token.

### Lifecycle and audit columns

- `created_by uuid not null`;
- `updated_by uuid not null`;
- `created_at timestamptz not null default now()`;
- `updated_at timestamptz not null default now()`;
- `received_at timestamptz`;
- `submitted_at timestamptz`;
- `cancelled_at timestamptz`;
- `expired_at timestamptz`;
- `receipt_issued_at timestamptz`;
- `correlation_id uuid not null`.

The table must enforce lifecycle timestamp consistency.

## Field Submission mutation law

After creation, the contributor may edit only declaration fields while state is `receiving` or `received`.

The contributor may not mutate:

- `resource_id`;
- `resource_kind`;
- `submission_reference`;
- `owner_user_id`;
- `submitter_mode`;
- `created_by`;
- `created_at`;
- historical lifecycle timestamps directly;
- `current_revision` directly;
- `submission_state` directly.

All allowed edits occur through command functions.

After `submitted`, `cancelled`, or `expired`, no contributor declaration mutation is allowed.

## Declaration snapshot versus canonical Media governance

Field Submission preserves what the contributor declared at intake time.

Canonical Media governance remains the safety authority for the Media original.

The Field Submission declaration therefore must not be copied into Media governance as if it had been institutionally verified.

The first adoption maps declarations conservatively.

### Initial Field original Media governance

When a verified Field video is adopted as canonical Media, create or advance governance to:

- `rights_status = 'needs_clearance'`;
- `consent_status = 'unknown'`;
- `sensitivity = declared_sensitivity`;
- `source_protection_class = source_protection_request`;
- `preservation_state = 'preservation_candidate'`;
- `retention_state = 'retain'`;
- `public_safety_state = 'internal'`.

For a concrete future embargo timestamp, the adoption adapter may set the closest accepted Media embargo state that preserves the requested hold.

For `until_review`, the hold remains Field Submission authority for Phase 8A.

The adoption internal reason should identify the Field Submission safely by Resource id or display reference and state that governance was initialized from unverified intake declarations.

The adapter must not copy `intake_notes`, contact preference, restricted source identity details, or coarse location into Media public metadata.

## Media asset purpose

Phase 8A adds one Media asset purpose:

`field_original`

Meaning:

A protected original received through governed Field Submission intake.

This purpose must be added to the existing Media controlled vocabulary rather than represented only in compatibility metadata.

It does not make the Media public or publication-ready.

## Field Submission to Media relationship

Phase 8A extends canonical Media usage authority rather than creating a parallel Field Submission Media ownership table.

Add one usage role:

`field_original`

Required semantic match:

- `target_authority = 'editorial'`;
- `target_kind = 'field_submission'`;
- `usage_role = 'field_original'`;
- `resolution_mode = 'exact_revision'`;
- exact `asset_revision_id` is required.

The usage relationship remains in:

`media.usage_links`

The Phase 8A migration must narrowly extend:

- `media.usage_roles`;
- target-authority and target-kind constraints where required;
- `media.usage_role_matches_target(...)`;
- `media.validate_usage_target(...)`.

The existing meaning of every prior Media target and usage role must remain unchanged.

## Why generic `public.attach_media_usage` is not reused directly

The existing generic attach command requires:

- `manage_media_usage`;
- public-safe rights states;
- public-safe consent states;
- public or public-redacted source protection;
- approved public or approved redacted safety state.

Those checks are correct for ordinary publishable Media usage.

A protected Field original is intentionally not public-safe at intake.

Phase 8A therefore must not weaken generic attach rules.

Instead, create one private helper with exact Field semantics, for example:

`media.attach_protected_field_original_usage_v1(...)`

The exact name may be finalized in implementation, but the behavior is locked here.

The helper must:

1. accept a real authenticated actor id from a governed Field command;
2. require the actor owns the Field Submission or is an explicitly permitted Field intake operator;
3. require exact verified Media asset and revision identity;
4. require the Media asset purpose is `field_original`;
5. require current Media governance remains non-public;
6. require target `editorial/field_submission`;
7. require role `field_original`;
8. insert exactly one active `media.usage_links` row for the requested submission slot;
9. append canonical `media.events` usage history;
10. be idempotent for the same exact relationship;
11. reject conflicting duplicate active Field-original usage;
12. have no direct browser grant.

## Multiple Media and intake attempts

A Field Submission is not the file.

The schema must support a future submission containing more than one Media original without changing Field Submission identity.

Phase 8A first proof uses one slot, but the server model supports multiple slots and replacement attempts.

Create:

`editorial.field_submission_media_intakes`

### Columns

- `id uuid primary key`;
- `submission_resource_id uuid not null`;
- `slot_number integer not null`;
- `attempt_number integer not null`;
- `media_upload_session_id uuid not null unique`;
- `usage_link_id uuid unique`;
- `intake_state text not null`;
- `created_by uuid not null`;
- `created_at timestamptz not null default now()`;
- `updated_at timestamptz not null default now()`;
- `verified_at timestamptz`;
- `adopted_at timestamptz`;
- `cancelled_at timestamptz`;
- `expired_at timestamptz`;
- `superseded_at timestamptz`;
- `correlation_id uuid not null`.

### Intake states

- `active`;
- `verified`;
- `adopted`;
- `cancelled`;
- `expired`;
- `superseded`.

### Relationship rules

- `(submission_resource_id, slot_number, attempt_number)` is unique;
- `slot_number >= 1`;
- `attempt_number >= 1`;
- one Media upload session belongs to exactly one Field Media intake;
- `usage_link_id` is null until canonical adoption;
- an adopted intake cannot be cancelled or expired;
- one slot may have multiple attempts over time;
- only one attempt per slot may be `active`;
- only one attempt per slot may reach `adopted`;
- a Media upload-session expiry marks that attempt `expired`, not the Field Submission itself;
- a later retry creates a new Media upload session and increments `attempt_number` under the same Field Submission and slot.

The intake table must not copy:

- storage path;
- checksum;
- expected byte count;
- MIME type;
- original filename;
- file-object identity before verification.

Those values remain canonical in existing Media upload-session and file authority.

## Field Submission event authority

Create:

`editorial.field_submission_event_types`

and:

`editorial.field_submission_events`

Events are append-only.

### Initial event types

- `submission_created`;
- `declaration_updated`;
- `upload_session_attached`;
- `upload_resumed`;
- `media_verified`;
- `media_attached`;
- `submission_received`;
- `submission_finalized`;
- `receipt_issued`;
- `submission_cancelled`;
- `media_intake_expired`;
- `submission_expired`.

Do not record one Field event per Media part.

Media receiver and Media authority already own the low-level transfer facts.

### Field event columns

- `id uuid primary key`;
- `submission_resource_id uuid not null`;
- `event_type text not null`;
- `actor_user_id uuid`;
- `command_receipt_id uuid`;
- `media_intake_id uuid`;
- `reason text`;
- `prior_state jsonb`;
- `resulting_state jsonb`;
- `correlation_id uuid not null`;
- `created_at timestamptz not null default now()`.

The event table must reject update and delete through application roles.

## Capability model

Phase 8A introduces a dedicated contributor role rather than broadening general authenticated access.

Add role:

`field_contributor`

Recommended description:

Authenticated contributor permitted to create and resume only their own Field Submissions.

Add capabilities:

- `submit_field_capture`;
- `read_own_field_capture`;
- `view_field_intake`;
- `view_restricted_field_sources`.

### Initial role assignments

`field_contributor`:

- `submit_field_capture`;
- `read_own_field_capture`.

`administrator`:

- all four.

`editor`:

- `view_field_intake`;
- `view_restricted_field_sources`.

`reviewer`:

- `view_field_intake`.

No other role receives Field capabilities in Phase 8A unless a separate accepted design proves the need.

### Explicitly denied contributor authority

A `field_contributor` must not gain by implication:

- `manage_media_assets`;
- `manage_media_usage`;
- `view_media_records`;
- `review_media_governance`;
- Media Library access;
- private delivery for unrelated Media;
- newsroom Field queue access;
- restricted source identity access;
- another contributor's Field Submission;
- direct private-schema table mutation.

## Ownership law

A contributor command is authorized only when all of the following are true:

- `auth.uid()` is present;
- the user has `submit_field_capture` for mutation or `read_own_field_capture` for own read;
- `editorial.resources.owner_id = auth.uid()`;
- `editorial.field_submissions.owner_user_id = auth.uid()`;
- the Resource and typed binding agree;
- the requested Media intake belongs to the same Field Submission where applicable.

Ownership is checked server-side for every command and control action.

A client-supplied owner id is never authoritative.

## Restricted source identity read law

Internal Field reads have two views of contributor identity.

A reader with `view_field_intake` may see ordinary submission facts needed for newsroom awareness.

For `newsroom_identity_mode = 'restricted'`, that read must not expose direct contributor identity or account contact fields.

Only a reader with `view_restricted_field_sources` may resolve the authenticated contributor identity for a restricted submission.

The safe contributor receipt always remains available to the owning contributor regardless of newsroom identity mode.

Phase 8A stores no separate plaintext secret-source profile.

## Platform command vocabulary

Phase 8A reuses the existing command receipt substrate.

Add command types:

- `field.submission.create`;
- `field.submission.declarations.update`;
- `field.submission.media.start`;
- `field.submission.media.adopt`;
- `field.submission.finalize`;
- `field.submission.cancel`.

Every public Field mutation uses:

- authenticated principal context;
- capability check;
- Resource id where known;
- deterministic or caller-supplied idempotency key;
- request fingerprint;
- correlation id;
- optimistic concurrency where a Field Submission already exists;
- durable command receipt;
- idempotent replay result.

Phase 8A does not create a second command table.

## Field Submission creation command

Add a public authenticated command similar in contract shape to:

`public.create_field_submission_v1(...)`

### Required behavior

1. authenticate actor;
2. require `submit_field_capture`;
3. validate first declarations;
4. serialize by principal plus idempotency key;
5. look for an existing `field.submission.create` receipt before generating new Resource identity;
6. if an existing receipt has the same request fingerprint, return its original result;
7. if the key was reused for different input, reject;
8. generate one Resource id;
9. insert one private `editorial.resources` row;
10. insert one `editorial.field_submissions` row;
11. start the accepted Resource command receipt;
12. append `submission_created`;
13. complete the command receipt;
14. return only safe creation data.

### Safe creation result

Return at minimum:

- `command_receipt_id`;
- `receipt_status`;
- `submission_resource_id`;
- `submission_reference`;
- `current_revision`;
- `submission_state`;
- `created_at`;
- `idempotent_replay`.

Do not return storage paths, Media secrets, or internal source-protection details.

## Declaration update command

Add a command similar in contract shape to:

`public.update_field_submission_declarations_v1(...)`

It must:

- require owner and `submit_field_capture`;
- require expected `current_revision`;
- permit only allowlisted declaration fields;
- reject submitted, cancelled, or expired submissions;
- increment revision only when data actually changes;
- append `declaration_updated` when data changes;
- preserve prior Field events;
- return the current safe contributor state.

## Field Media upload-session command

Add a public authenticated command similar in contract shape to:

`public.create_field_media_upload_session_v1(...)`

This command is a narrow Field ingress adapter over existing Media upload-session authority.

### First-slice file contract

The first Phase 8A implementation accepts video only.

It must use the existing accepted v2 video rules:

- MIME begins with `video/`;
- extension is one of the existing supported video master extensions;
- expected bytes are greater than zero and no more than the accepted 2 GiB maximum;
- expected SHA-256 is lowercase and exact;
- upload-session TTL remains within the existing Media contract;
- storage root remains `masters/video/`.

Do not add image, document, archive, or audio support in the first implementation PR.

### Authorization

The command must:

- require Field owner;
- require state `receiving` or `received`;
- require `submit_field_capture`;
- require a valid slot number;
- create or idempotently reuse one Field Media intake attempt;
- create the underlying existing Media upload session without granting `manage_media_assets` to the contributor.

The underlying Media upload-session row remains owned by the authenticated actor.

### Least-privilege Media creation helper

Existing `create_media_upload_session_v2` requires broad `manage_media_assets` authority.

Phase 8A must not grant that capability to `field_contributor`.

Implementation should add one private Field-specific helper that preserves the same accepted Media upload-session validation and storage semantics while requiring Field Submission ownership instead of Media administration.

The helper must not modify `create_media_upload_session_v2` behavior or grants.

The helper must not create a second upload-session table.

## Field Edge Function control plane

Create one new Edge Function:

`field-intake-api`

Its responsibility is Field-specific authorization and orchestration around the existing receiver.

It is not another receiver.

Large file bytes must never pass through the Edge Function.

### Required control actions

The first implementation should expose bounded JSON actions equivalent to:

- create or replay Field Media upload session;
- reissue resume capability;
- query Field Media upload status;
- finalize Field Media upload session;
- cancel Field Media upload session.

Exact action names may be implementation-specific, but each action must be contract-tested.

### Required Edge Function authorization

Every action must:

1. require a valid authenticated Supabase user;
2. resolve the Field Submission server-side;
3. require submission ownership and Field capability;
4. resolve the bound Field Media intake server-side;
5. resolve the underlying Media upload session server-side;
6. reject any mismatch before contacting the receiver;
7. never accept a caller-supplied storage path as authority.

### Secret boundary

The Edge Function may use the existing receiver shared secret.

The browser must never receive that shared secret.

The browser receives only a per-session capability token scoped by the existing receiver.

### CORS boundary

Do not copy the administrative wildcard CORS policy automatically.

The Field endpoint must use an explicit allowlist appropriate to:

- production WAKILISHA origin;
- approved preview origin where required;
- approved local development origin where required.

Unexpected origins must not receive credentialed Field-control responses.

## Capability reissue contract

The existing receiver already contains the required token-rotation primitive.

When trusted control plane code posts an existing session id with the same immutable session metadata and a new `capability_token`:

- the receiver compares immutable session metadata;
- any mismatch is rejected;
- verified sessions remain verified;
- otherwise the receiver replaces the stored capability hash;
- accepted parts remain in place;
- the old capability stops authorizing future direct part requests.

Phase 8A reuses that behavior.

No receiver schema or protocol change is required for first-slice durable recovery.

### Reissue flow

On recovery:

1. browser authenticates normally;
2. browser sends Field Submission id and Field Media intake id to `field-intake-api`;
3. Edge Function verifies ownership and binding;
4. Edge Function loads exact existing Media upload-session metadata;
5. Edge Function generates a fresh random capability;
6. Edge Function re-posts the exact immutable session metadata and new capability to the existing receiver admin session endpoint;
7. receiver rotates the capability hash and preserves accepted parts;
8. Edge Function returns the new per-session capability and direct part-upload base URL;
9. browser keeps the new capability in memory only;
10. browser queries receiver status before uploading another part.

This is the accepted Phase 8A durable-resume security design.

## Capability storage prohibition

The following values must not be written to IndexedDB, localStorage, sessionStorage, URL query parameters, logs, analytics, crash telemetry, or persisted React state:

- receiver shared secret;
- per-session receiver capability token;
- signed private delivery URL;
- protected master storage path;
- Supabase service-role key;
- Edge Function server secrets.

The per-session receiver capability may exist only in live memory while an active browser upload is running.

## Receiver status authority

Before resuming an interrupted transfer, the client must query server and receiver status.

Local accepted-part state is advisory only.

The receiver's actual accepted-part summary is authoritative for:

- uploaded part count;
- uploaded byte count;
- missing parts;
- expired state;
- verified state.

The client must never blindly trust a local part bitmap after reload.

## Finalization and exact file authority

When all parts are present:

1. `field-intake-api` requests trusted receiver finalization;
2. receiver verifies exact expected byte count and exact full SHA-256;
3. existing Media session verification creates or reuses the canonical verified `media.file_objects` identity;
4. Field adoption command loads the verified session and exact file object;
5. Field adoption creates or idempotently reuses one canonical Media asset and revision;
6. Field adoption applies conservative Media governance;
7. Field adoption attaches `field_original` usage to the Field Submission;
8. Field Media intake becomes `adopted`;
9. Field Submission may advance to `received` if its required Media slot is satisfied.

No client code performs direct inserts across these canonical authorities.

## Field Media adoption command

Add a command similar in contract shape to:

`public.adopt_verified_field_media_upload_session_v1(...)`

It must:

- require Field owner and `submit_field_capture`;
- require expected Field `current_revision`;
- require the Field Media intake belongs to the submission;
- require the underlying upload session belongs to the same actor;
- require upload session state is verified;
- require exact canonical file object identity;
- require video master kind in first slice;
- idempotently create or reuse one Media asset;
- create or reuse exact first Media revision;
- set Media asset purpose `field_original`;
- create conservative governance;
- attach exact `field_original` Media usage;
- avoid Media processing submission;
- append both Media and Field events through their own authorities;
- return stable canonical ids;
- advance Field Submission to `received` when appropriate;
- be safely replayable.

### Adoption result

Return at minimum:

- Field command receipt id;
- Field Submission resource id;
- Field current revision;
- Field state;
- Field Media intake id;
- Media upload-session id;
- Media asset id;
- Media asset revision id;
- Media file-object id;
- Media usage-link id;
- idempotent replay flag.

Do not return protected Media URL or storage path.

## No automatic Media processing in first proof

Existing Media video processing can produce public-governed derivatives after later selection.

The first Field proof does not need those derivatives to prove intake.

Automatically starting processing would increase accidental exposure surface and conflate Phase 8A intake with Phase 8B safety review.

Therefore the first Field adoption command does not call `submit_media_processing_command_v1`.

The exact immutable original remains protected.

Phase 8B may start governed processing or redaction after newsroom review.

## Final submission command

Add a command similar in contract shape to:

`public.finalize_field_submission_v1(...)`

It must:

- require owner and `submit_field_capture`;
- require expected Field revision;
- require Field state `received`;
- require all first-slice declaration fields are valid;
- require at least one adopted required Media slot;
- require the active Field original usage points to exact verified canonical Media;
- freeze contributor-editable declaration fields;
- advance state to `submitted`;
- append `submission_finalized`;
- complete command receipt;
- issue or make available a safe contributor receipt.

Final submission does not create Article, Audio, Video publication, Source, Citation, Registry mutation, or public route.

## Cancellation command

Add a command similar in contract shape to:

`public.cancel_field_submission_v1(...)`

Before verified canonical adoption, cancellation should:

- require owner and expected revision;
- cancel the current unverified Media upload session through existing Media authority;
- remove partial receiver parts through existing cancellation behavior;
- mark active Field Media intake cancelled;
- advance Field Submission to `cancelled`;
- append a Field event;
- complete command receipt.

If canonical Media has already been adopted, the command must not delete immutable Media bytes.

A cancellation request after canonical adoption must either:

- be rejected in Phase 8A; or
- record a non-destructive cancellation state while preserving canonical Media and retention history.

The implementation contract should choose the stricter option for first slice: reject cancellation after adopted Media and instruct the user to submit a later governed withdrawal request once that workflow exists.

## Expiry model

Media upload-session expiry and Field Submission expiry are separate.

### Media intake attempt expiry

If an underlying Media upload session expires:

- partial server parts are removed by existing receiver behavior;
- Field Media intake becomes `expired`;
- append `media_intake_expired`;
- preserve Field Submission identity and declarations;
- permit a later attempt for the same slot.

### Field Submission expiry

Field Submission expiry is a later server inactivity rule.

The first schema may include the `expired` terminal state and timestamp without enabling an automatic expiry worker until an explicit inactivity duration is accepted.

Do not reuse the Media upload-session 24-hour TTL as the Field Submission lifetime.

## Safe contributor receipt

A receipt confirms intake, not publication.

The owning contributor read should expose only:

- `submission_reference`;
- `submission_state`;
- `created_at`;
- `submitted_at`;
- `receipt_issued_at`;
- safe Media count;
- safe file label if policy permits;
- a plain statement that the submission was received for review.

It must not expose:

- storage paths;
- receiver capability;
- private delivery URL;
- raw checksum unless explicitly needed for a user-facing integrity proof later;
- reviewer identity;
- newsroom notes;
- internal Media governance ids;
- restricted source-protection classification details beyond the contributor's own request;
- other contributors;
- exact location hidden from ordinary newsroom readers;
- future triage or verification conclusions before they exist.

The receipt reference is safe to copy into support communication, but it is not sufficient to authorize a read.

## Own-submission read

Add a public authenticated read similar in contract shape to:

`public.get_my_field_submission_v1(uuid)`

It must:

- require `read_own_field_capture`;
- require Resource owner matches `auth.uid()`;
- return only the contributor-safe Field Submission projection;
- return safe Field Media progress and state;
- never return capability tokens or storage paths;
- never require general Media read capability.

A list read for the contributor may be added only if the first UI needs it.

Do not add a broad generic Field Submission browser table policy.

## Newsroom read

Phase 8A may add the minimum internal read needed to prove access boundaries, but must not build the Phase 8B triage workspace.

An internal read should:

- require `view_field_intake`;
- expose submission reference, state, declarations needed for safety awareness, safe Media ids, and timestamps;
- redact contributor identity when `newsroom_identity_mode = 'restricted'` unless caller also has `view_restricted_field_sources`;
- never expose receiver capabilities or storage secrets;
- keep private Media delivery separate from ordinary read authority.

If no runtime newsroom surface consumes this read in 8A, a permanent read-only verifier may prove it without building UI.

## Direct table and RLS boundary

Canonical Field tables live in `editorial` and are not browser mutation surfaces.

Phase 8A must prove:

- `anon` cannot select, insert, update, or delete canonical Field tables;
- `authenticated` cannot directly insert, update, or delete canonical Field tables;
- contributor access occurs only through allowlisted public RPCs and Field Edge control actions;
- service role has only the grants required by trusted server operations;
- event history rejects update and delete;
- restricted source identity is not recoverable through a broad table grant;
- Media private-schema rules remain intact.

Do not solve Field access with permissive direct-table RLS writes.

## Threat model

The first Phase 8A slice explicitly considers the threats below.

### Threat: privilege escalation into Media administration

Attack:

A contributor calls existing Media admin functions or `media-upload-api` JSON actions directly.

Control:

- no `manage_media_assets` grant;
- no `manage_media_usage` grant;
- existing admin Edge control remains admin-only;
- Field-specific RPC and Edge Function check Field ownership;
- Field helper grants are narrow.

Acceptance:

Contributor attempts to create an unrelated Media upload session or list unrelated Media and receives denial.

### Threat: cross-submission access

Attack:

Contributor substitutes another Field Submission id or Field Media intake id.

Control:

- resolve owner from server authority;
- verify submission, intake, and Media session binding on every action;
- never trust caller-supplied owner id.

Acceptance:

Contributor A cannot read, resume, finalize, cancel, or adopt Contributor B's intake.

### Threat: receiver capability theft from durable browser storage

Attack:

A script, extension, shared device user, or later browser session extracts a long-lived receiver bearer token.

Control:

- capability token is memory-only;
- IndexedDB stores identifiers and file state, never token;
- fresh capability is reissued after authenticated recovery;
- reissue rotates receiver capability hash, invalidating the old token.

Acceptance:

Reload loses the token, authenticated reissue restores upload capability, and an old capability no longer uploads a part.

### Threat: replay creates duplicate Field or Media identity

Attack:

Network retry repeats create, start, adopt, or finalize commands.

Control:

- platform command receipts;
- deterministic request fingerprint;
- serialized create idempotency before Resource generation;
- Media upload-session idempotency;
- exact file identity;
- unique Field intake and usage constraints.

Acceptance:

Repeated requests return the same Field Submission, Media upload session, Media asset, Media revision, and Media usage identities.

### Threat: local queue points at a different file

Attack or accident:

After reload, the user selects another file with the same name.

Control:

- local queue stores exact expected byte size and SHA-256;
- restored file is re-hashed or cryptographically compared before resume;
- server session metadata must match;
- receiver rejects changed immutable metadata and changed accepted parts.

Acceptance:

Different bytes cannot resume into the prior session.

### Threat: malicious part replacement

Attack:

A caller overwrites an already accepted part with different bytes.

Control:

- receiver stores immutable accepted part;
- identical checksum and size replay is idempotent;
- different bytes return conflict;
- final full checksum is verified.

Acceptance:

Conflicting part replay fails and cannot alter final master.

### Threat: unsafe original becomes public by default

Attack or mistake:

Field upload is treated like ordinary publishable Media.

Control:

- protected master path;
- `field_original` purpose;
- internal public-safety state;
- protected source class;
- no automatic processing in first proof;
- no public Media usage path;
- no public route.

Acceptance:

Original URL is not publicly available, and no public derivative is selected.

### Threat: contributor rights declaration is mistaken for institutional clearance

Attack or mistake:

Contributor selects a favorable declaration and Media becomes publishable automatically.

Control:

- Field declaration remains a historical intake fact;
- initial Media rights are `needs_clearance`;
- initial Media consent is `unknown`;
- public safety remains `internal`;
- Phase 8B review is required before promotion.

Acceptance:

No Phase 8A path can produce `approved_public` from contributor declaration alone.

### Threat: sensitive source identity leaks to ordinary newsroom readers

Attack or mistake:

A restricted contributor appears in a general Field queue response.

Control:

- separate `newsroom_identity_mode`;
- ordinary Field read redacts restricted identity;
- dedicated `view_restricted_field_sources` capability is required to resolve it.

Acceptance:

Reviewer with `view_field_intake` but without restricted-source capability cannot resolve restricted contributor identity.

### Threat: public naming preference is confused with technical anonymity

Mistake:

`do_not_name` or `restricted` is described as anonymous.

Control:

- schema and UI vocabulary do not use anonymous for authenticated first slice;
- disclosure settings are explicit and separate.

Acceptance:

Receipt and form copy state what the preference does without promising anonymity.

### Threat: exact location leaks through intake fields

Attack or mistake:

Device GPS or raw coordinates are stored or returned when not needed.

Control:

- no geolocation permission request in first slice;
- no coordinate columns;
- only optional coarse text location;
- location is excluded from public projection.

Acceptance:

Schema and client contain no latitude or longitude field for first Phase 8A proof.

### Threat: embedded GPS or device metadata leaks later

Attack or mistake:

A protected evidentiary original is accidentally used as a public file.

Control:

- original remains protected;
- Phase 8A does not publish it;
- metadata stripping is a future safe-derivative decision;
- Phase 8B must explicitly review derivative safety before promotion.

Acceptance:

Field original is never selected as a public derivative during Phase 8A.

### Threat: destructive sanitization destroys evidentiary original

Mistake:

Client or server rewrites the submitted original before canonical verification.

Control:

- exact submitted bytes are hashed and preserved;
- no generic metadata rewrite occurs in first slice;
- high-risk pre-upload sanitization requires a separate design.

Acceptance:

Verified file-object checksum equals the exact selected file checksum.

### Threat: sensitive information enters logs or analytics

Mistake:

Edge, frontend, or receiver logs record capability tokens, disclosure declarations, source identity, contact details, or location.

Control:

- structured allowlisted logging;
- no request-body dumps;
- no capability token logging;
- no Field declaration analytics payloads;
- error messages use stable safe identifiers.

Acceptance:

Focused tests or static guards reject known sensitive log patterns where feasible.

### Threat: server expiry causes silent loss of Field Submission identity

Mistake:

Expired Media session is treated as a failed or deleted Field Submission.

Control:

- Media intake attempt and Field Submission have separate lifecycle;
- expired attempt can be replaced under same submission slot.

Acceptance:

One expired Media session can be replaced while `submission_resource_id` and safe receipt reference remain unchanged.

### Threat: verified Media is destructively cancelled

Mistake:

A cancellation path deletes canonical verified Media after adoption.

Control:

- receiver already rejects verified-session cancellation;
- Field cancel command rejects cancellation after adopted Media in first slice;
- later withdrawal uses governed retention, not destructive deletion.

Acceptance:

Adopted Media survives an attempted cancellation.

## Browser local durability contract

Phase 8A.4 introduces the first durable local Field queue.

Use IndexedDB rather than localStorage for structured queue state and local file bytes.

No Service Worker background-upload guarantee is made in the first slice.

### Durable local queue record

Store only what is required to recover the client workflow:

- queue record id;
- authenticated owner user id as local consistency check;
- Field Submission resource id;
- Field submission reference;
- Field Media intake id;
- Media upload-session id;
- slot number;
- attempt number;
- original local file name;
- MIME type;
- byte size;
- exact SHA-256;
- part size;
- total parts;
- last known uploaded parts and bytes as advisory state;
- local File or Blob where browser storage permits;
- local state and timestamps.

Do not store the receiver capability token.

### Recovery algorithm

On app start or Field Capture reopen:

1. load local queue records;
2. require an authenticated user;
3. ignore or quarantine local queue records whose local owner does not match current user;
4. call own Field Submission read;
5. if server state is terminal, reconcile and clean local state appropriately;
6. if intake is resumable, request a fresh capability from `field-intake-api`;
7. query authoritative receiver status;
8. verify local file bytes still match expected size and SHA-256;
9. resume only missing parts;
10. finalize exact Media session;
11. adopt Media idempotently;
12. finalize Field Submission when declarations are ready;
13. confirm receipt;
14. delete durable local file bytes after successful receipt;
15. retain only minimal safe local history if the product needs it.

### Storage eviction truth

Mobile browsers may evict IndexedDB data.

The product must not promise that local queued bytes survive every browser or device cleanup action.

If local file bytes are gone but server accepted parts remain:

- preserve the server Field Submission;
- explain that the user must reselect the exact original file to continue;
- verify exact size and SHA-256 before resuming;
- never attach a different file silently.

## Mobile network behavior

The client must distinguish:

- waiting for network;
- hashing;
- creating server intake;
- uploading;
- paused;
- verifying;
- received;
- submitting;
- submitted;
- failed recoverably;
- failed terminally;
- cancelled.

These are client workflow states, not all server lifecycle values.

Retry policy must:

- use bounded backoff;
- stop on authorization failure;
- stop on immutable metadata conflict;
- reauthorize after token loss or reload;
- query server state before retrying finalization;
- avoid duplicate canonical adoption.

## Capture-time hashing

Reuse the accepted `src/services/mediaHash` chunked SHA-256 implementation.

Do not add another hashing library unless real mobile proof demonstrates that the accepted implementation is inadequate.

The client must hash large video in bounded chunks and remain cancellable while hashing.

The exact full checksum becomes the upload-session expected checksum and local recovery identity.

## Client service boundary

Do not reuse `mediaService.uploadResumableMaster(...)` unchanged because that method is an administrative Media Library workflow that:

- calls the administrative `media-upload-api`;
- adopts through `adopt_verified_media_upload_session_v1`;
- submits Media processing;
- expects Media admin reads.

Phase 8A should extract or reuse only stable low-level transport mechanics where practical:

- file-kind validation;
- shared chunked hashing;
- part slicing;
- per-part SHA-256;
- deterministic part upload;
- progress calculation;
- abort handling.

Field authority, Field Edge control, Media adoption, receipt, and local durability remain Field-specific composition.

This follows the Primitive Compounding Contract: reuse learned interaction mechanics without flattening domain authority.

## First mobile UI contract

The first Field Capture UI should remain small.

It must support:

- choose or record video;
- explain that the file remains private while WAKILISHA reviews it;
- collect disclosure and attribution preferences;
- collect rights and consent declarations;
- collect sensitivity and source-protection request;
- collect embargo request;
- optionally collect coarse location text;
- show hashing and upload progress;
- show waiting, paused, resume, verifying, received, and submitted states truthfully;
- allow cancellation before canonical adoption;
- provide a safe receipt after final submission.

Do not build Phase 8B triage controls in the contributor UI.

## Public copy safety contract

User-facing copy must not promise:

- anonymity in authenticated first slice;
- guaranteed background upload;
- guaranteed persistence through browser storage eviction;
- publication;
- editorial acceptance;
- legal rights clearance;
- deletion after canonical adoption;
- exact location secrecy beyond the product controls actually implemented.

The form should use plain human labels rather than internal taxonomy names.

Exact copy is deferred to the frontend milestone and remains governed by the WAKILISHA Language and Tone Bible.

## Anonymous intake remains deferred

The Phase 8A programme requires an anonymous-intake policy where permitted.

The first implementation does not enable open anonymous large-file upload.

A future anonymous intake design must separately address:

- abuse and denial-of-service resistance;
- rate limiting outside database-backed request logs;
- proof-of-work or equivalent abuse friction if needed;
- temporary capability issuance without a user account;
- source contact separation;
- safe receipt recovery without exposing a bearer secret;
- malicious file and storage-cost controls;
- legal and safety handling;
- deletion and retention expectations;
- origin and device privacy.

No ordinary `anon` grant is added by the first Phase 8A implementation.

## Open file-kind expansion remains deferred

The first proof is Video because existing resumable v2 already supports Video without changing transfer semantics.

Do not broaden the accepted v2 function to image, PDF, or arbitrary files.

If later Phase 8A acceptance shows a real need for resumable images or documents, add a new forward versioned Media upload-session contract after a separate audit.

## Database migration decomposition

After this design merges, Phase 8A runtime work should be split into the smallest independently provable milestones.

### 8A.2A Field Submission identity foundation

One migration should establish only:

- Field capabilities and initial role assignments;
- `field_submission` Resource kind;
- `editorial.field_submissions`;
- Field event types and append-only events;
- Resource binding-integrity extension;
- own safe read and minimal internal read;
- creation, declaration update, finalization, and cancellation command skeletons where they do not require Media adoption;
- permanent read-only verifier.

No Media upload adapter should be hidden inside this foundation if it prevents independent proof.

### 8A.2B Field Media binding extension

A following narrow migration should establish:

- `field_original` Media asset purpose;
- `field_original` usage role;
- `field_submission` Media target support;
- `editorial.field_submission_media_intakes`;
- narrow protected Field usage helper;
- Field Media session creation authority;
- Field adoption command;
- permanent Media binding verifier.

This milestone should not change existing admin Media workflow behavior.

### 8A.3 Field Edge control

After database authority is accepted:

- add `field-intake-api`;
- reuse existing receiver;
- implement fresh capability reissue;
- do not deploy frontend yet;
- prove authenticated API behavior against a disposable preview where Edge preview testing is supported or against a controlled non-production target according to established deployment law.

### 8A.4 Local durability and contributor UI

Only after database and Edge control are accepted:

- implement IndexedDB queue;
- implement mobile contributor surface;
- run focused frontend tests;
- prove desktop compatibility where relevant;
- perform real mobile interruption acceptance after merged production activation.

## Migration replay requirement

Every Phase 8A SQL milestone follows normal WAKILISHA preview authority.

For the first Phase 8A SQL milestone:

1. exact clean branch from accepted main;
2. smallest SQL and verifier candidate;
3. focused static tests;
4. exact changed-file scope;
5. create one disposable Supabase preview;
6. prove the entire existing migration history replays cleanly before applying Phase 8A SQL;
7. if baseline replay fails, diagnose the historical replay defect separately;
8. only after healthy baseline apply Phase 8A SQL;
9. run permanent read-only verifier;
10. run transaction-scoped fixtures;
11. clean fixtures by rollback;
12. keep SQL byte-identical through promotion;
13. protected CI and build gates;
14. merge;
15. production SQL separately;
16. verify exact migration-history advance and zero pending migrations;
17. run merged production verifier independently;
18. only then deploy changed Edge or frontend surfaces.

Do not infer a Phase 8A failure from a preview that fails during baseline replay.

## Permanent verifier requirements

The Phase 8A Field Submission foundation verifier must prove at minimum:

- exact new Resource kind;
- exact Field capability rows and role assignments;
- no unintended capability grants;
- exact Field table columns, constraints, indexes, and foreign keys;
- Resource binding-integrity helper recognizes Field Submission and retains all predecessor branches;
- Field event history is append-only;
- no browser table mutation grants;
- own-read function does not expose another user's submission;
- restricted source identity read is capability-gated;
- Field create command uses platform command receipts;
- create replay returns same Resource identity;
- different request with same idempotency key is rejected;
- optimistic-concurrency stale declaration update is rejected;
- terminal Field states freeze contributor mutation;
- no Resource Version or public route is created.

The Field Media binding verifier must prove at minimum:

- `field_original` purpose and usage role exist exactly once;
- usage role matches only `editorial/field_submission`;
- all predecessor Media role matches remain unchanged;
- generic `public.attach_media_usage` retains existing public-safety checks;
- narrow protected Field helper has no browser grant;
- Field Media intake references existing `media.upload_sessions`;
- no storage path or checksum is duplicated into Field intake table;
- adoption requires exact verified file identity;
- adoption creates one Media asset and one exact revision;
- initial governance is conservative;
- no Media processing job is submitted by first-slice adoption;
- exact `field_original` Media usage is attached;
- replay does not duplicate Media identity or usage;
- contributor cannot attach unrelated Media;
- another contributor cannot adopt the intake.

## Transaction-scoped behavior fixtures

Fixtures should cover:

1. create Field Submission;
2. idempotent create replay;
3. conflicting create key reuse;
4. valid declaration update;
5. stale declaration update rejection;
6. cross-user read denial;
7. restricted source redaction;
8. Field Media session creation for valid Video;
9. unsupported MIME or extension rejection;
10. cross-submission Media session denial;
11. exact verified Media adoption;
12. conflicting file identity rejection;
13. conservative governance values;
14. no public-safe usage;
15. exact Field usage link;
16. duplicate adoption replay;
17. final submission and receipt;
18. post-submit mutation rejection;
19. pre-adoption cancellation;
20. post-adoption cancellation rejection;
21. expired Media attempt replacement under same Field Submission;
22. zero fixture residue after rollback.

## Edge Function contract tests

Focused tests for `field-intake-api` must prove:

- authentication required;
- Field capability required;
- ownership required;
- submission and Media intake binding required;
- caller cannot provide arbitrary storage path;
- capability is freshly generated;
- capability is never logged;
- existing receiver session metadata is re-posted exactly for reissue;
- immutable metadata mismatch is not retried as a new session;
- status queries use bound server identity;
- finalization cannot target another session;
- cancellation cannot target another session;
- CORS allowlist is explicit;
- large file bytes are never proxied through the Edge Function.

## Frontend contract tests

Focused tests for local durability must prove:

- receiver capability is absent from persisted queue schema;
- local queue survives React remount and page reload in supported browser test harness;
- recovery requests fresh server capability;
- server status is queried before resume;
- exact file checksum is checked before resume;
- only missing parts are uploaded;
- local bytes are removed after successful receipt;
- local owner mismatch blocks automatic recovery;
- safe receipt contains no internal or protected values;
- no background-upload claim is rendered;
- no anonymity claim is rendered in authenticated first slice.

## Production acceptance

Phase 8A does not close on schema existence.

The first real or controlled mobile Video proof must demonstrate:

1. exact merged-main deployment authority;
2. authenticated `field_contributor` account;
3. one Field Submission created exactly once;
4. one video selected or recorded on mobile;
5. exact SHA-256 calculated before transfer;
6. one existing Media upload session created through Field authority;
7. at least one part accepted;
8. intentional network loss or page interruption;
9. browser reload or equivalent process interruption;
10. receiver capability is absent from durable client storage;
11. authenticated capability reissue succeeds;
12. old capability no longer authorizes part upload;
13. receiver status is queried before resume;
14. previously accepted parts are not retransmitted unnecessarily;
15. exact final byte count and full SHA-256 verify;
16. exactly one verified canonical file object exists;
17. exactly one Field Media asset and exact first revision exist;
18. no automatic processing job was created;
19. Media governance is conservative and non-public;
20. exact `field_original` usage binds Media to Field Submission;
21. Field Submission reaches `received` then `submitted`;
22. safe receipt is readable by owner;
23. another contributor cannot read or resume it;
24. ordinary reviewer cannot resolve restricted contributor identity;
25. authorized restricted-source reader can resolve it where policy permits;
26. protected original is not public;
27. no Article, Audio, Video publication, Registry mutation, or public route was created;
28. production migration history and schema verifier remain exact;
29. Edge and frontend deployment residue is clean;
30. Phase 8B remains the next newsroom workflow milestone.

## Rollback law

### Before production SQL

Discard the branch or disposable preview.

### After additive Field SQL but before Edge or frontend activation

Leave unused additive authority in place unless a later forward migration removes it.

Do not destructively roll back accepted Field Submission or Media history.

### After Edge activation

If Field control has a runtime defect, revert only the changed Field Edge deployment to the last accepted version.

The existing administrative Media Edge path remains separate.

### After frontend activation

Revert only the frontend artifact to the last accepted build when needed.

Do not delete accepted canonical Media, Field Submission identity, or append-only history as part of frontend rollback.

## What Phase 8A implementation must not touch

Do not:

- mutate `create_media_upload_session_v1` semantics;
- mutate `create_media_upload_session_v2` semantics;
- grant `manage_media_assets` to Field contributors;
- grant `manage_media_usage` to Field contributors;
- weaken generic Media usage public-safety checks;
- create a second receiver;
- proxy large Video bytes through an Edge Function;
- create a second Media file, revision, governance, usage, or event authority;
- create Field Resource Version rows without a proven review snapshot need;
- create Field review tables in Phase 8A;
- create Article, Audio, or Video publication during intake;
- automatically process or publish the first Field original;
- collect device geolocation by default;
- persist receiver bearer capability;
- persist service secrets;
- describe authenticated restricted-source intake as anonymous;
- promise reliable background upload;
- promise durable local recovery when browser storage was evicted;
- destructively rewrite the evidentiary original to remove metadata;
- expose protected Media URL or storage path in contributor receipt;
- start Phase 8B triage UI inside the Phase 8A intake implementation.

## Primitive impact

### Reused authority primitives

- Resource identity;
- role and capability authority;
- command idempotency and durable receipts;
- correlation and optimistic concurrency;
- Media upload sessions;
- Media exact file identity;
- Media logical assets and revisions;
- Media governance;
- Media usage and events;
- existing receiver;
- existing processing authority, although not invoked by the first Field proof;
- Trust and provenance foundations for later Phase 8B use.

### New domain authority

- Field Submission;
- Field Submission Media intake workflow binding;
- Field Submission append-only event history.

### Narrow extensions

- `field_submission` Resource binding integrity;
- `field_original` Media asset purpose;
- `field_original` Media usage role;
- `editorial/field_submission` Media usage target support;
- Field-specific least-privilege Media session and adoption adapters.

### Candidate reusable interaction

The durable IndexedDB queue and capability-reissue composition remains Field-specific in Phase 8A.

Do not register a new canonical offline queue primitive after one consumer.

If a second real domain later proves the same semantics, review the stable residue under the Primitive Compounding Contract.

## Locked implementation order

After this document is accepted:

1. Phase 8A.2A Field Submission identity foundation design-to-SQL candidate;
2. one disposable preview with full baseline replay;
3. permanent Field Submission verifier and transaction fixtures;
4. protected CI and merge;
5. production Field Submission SQL and independent verification;
6. Phase 8A.2B Field Media binding and adoption candidate;
7. new disposable preview with full baseline replay;
8. permanent Media binding verifier and transaction fixtures;
9. protected CI and merge;
10. production Media binding SQL and independent verification;
11. Phase 8A.3 `field-intake-api` implementation and capability-reissue proof;
12. Phase 8A.4 IndexedDB durable queue and mobile contributor UI;
13. Phase 8A.5 safety and receipt product acceptance;
14. Phase 8A.6 real mobile weak-network production proof.

Do not skip the accepted-main, preview-replay, permanent-verifier, byte-identical SQL, protected-CI, production-history, and independent-verifier gates between SQL milestones.

## Design conclusion

Phase 8A needs a new Field Submission authority, not a new upload platform.

The Field Submission is a private Resource-owned intake aggregate with its own lifecycle, declarations, optimistic concurrency, receipt, and append-only history.

Its original Media remains canonical Media.

The Field contributor receives only Field-specific permissions.

The existing resumable receiver remains byte-transfer authority.

Durable mobile recovery uses authenticated capability reissue rather than durable bearer-token storage.

The existing receiver already supports capability rotation for an unchanged upload session, so the first durable-recovery implementation does not require a new receiver protocol.

The first proof is deliberately narrow: one authenticated contributor, one mobile Video, one interrupted transfer, one exact protected original, one Field Submission, and one truthful receipt.

Only after that proof should Phase 8A broaden file kinds or consider anonymous intake.
