# Phase 8A Safe Mobile Intake Authority Audit

Date: 4 September 2026

## Status

Read-only repository authority audit complete.

Opening accepted main:

`f0f34a29d278e0194a31c8107b06c8da5ece2ad9`

Current numbered programme:

**Phase 8A: Safe mobile intake.**

This audit does not create schema, change runtime behavior, deploy an Edge Function, or start Phase 8A implementation.

The first implementation design may proceed only within the reuse, extension, safety, and non-goal boundaries recorded here.

## Governing authority

This audit is governed by:

- `docs/institute/two-workspace-pilot-audit-and-build-plan.md`
- `docs/roadmap/phase-8-to-16-programme-reconciliation.md`
- `docs/engineering/primitive-compounding-contract.md`
- `docs/engineering/wakilisha-cultural-operating-layer-doctrine.md`
- accepted Phase 1B command, job, and outbox authority
- accepted Phase 3 Trust, Corrections, and provenance authority
- accepted Phase 4A Media authority
- accepted Phase 4B Media upload and processing authority

Phase 8A must compound these systems.

It must not build a second Media, Trust, review, command, job, or publication platform.

## Phase 8A outcome

Phase 8A exists to prove safe mobile field intake under unreliable connectivity.

The required outcome remains:

1. a contributor selects or records field Media on mobile;
2. the intake survives a network interruption;
3. transfer resumes without duplicate canonical file identity;
4. the submitted original becomes protected governed Media;
5. contributor, rights, consent, sensitivity, embargo, and source-protection decisions remain attached to the intake;
6. unsafe location or device metadata is not accidentally exposed;
7. the contributor receives a truthful submission receipt;
8. no public publication occurs in Phase 8A.

Phase 8B owns newsroom triage and governed promotion.

## Audit classification

The current system separates into four classes for Phase 8A:

1. reuse unchanged;
2. extend narrowly;
3. build as genuinely new Field Capture authority;
4. do not touch.

## Reuse unchanged

### Media logical identity and exact file identity

Existing authority:

- `media.assets`
- `media.file_objects`
- `media.asset_revisions`
- `media.variants`
- `media.usage_links`
- `media.asset_governance_versions`
- `media.events`

Phase 4A already established the required distinction between:

- logical Media identity;
- exact immutable file bytes;
- replacement revisions;
- derivatives;
- usage;
- governance;
- append-only Media history.

Phase 8A must not create a Field Capture file table that competes with this authority.

The submitted file becomes canonical Media through existing Media authority.

### Media governance

Existing Media governance already owns:

- rights status and basis;
- rights holder;
- licence;
- consent status and scope;
- sensitivity;
- embargo;
- source-protection class;
- preservation state;
- retention state;
- public-safety state;
- internal reason;
- approving and creating actors.

Field Capture should collect enough intake facts to establish or propose the appropriate Media governance state.

It must not create parallel rights, consent, sensitivity, embargo, or source-protection truth.

Field-specific intake declarations may preserve what the contributor said at submission time.

Canonical Media governance owns the resulting Media safety state.

### Resumable Media transfer

Existing authority:

- `media.upload_sessions`
- `media-upload-api`
- protected Media receiver
- canonical verified `media.file_objects`

Phase 4B already proved:

- resumable fixed-size transfer;
- intentional interruption;
- resume with the same session;
- per-part checksum verification;
- full byte-count verification;
- full SHA-256 verification;
- immutable protected finalization;
- idempotent replay;
- cancellation;
- expiry;
- exactly one canonical verified file object.

Phase 8A must not build another chunking protocol, upload-session table, receiver, or file-finalization mechanism.

### Media processing

Existing processing authority already owns durable processing, retries, leases, dead-letter behavior, variants, and selected derivatives.

Phase 8A may invoke existing processing only where the accepted Media profile safely fits the field asset.

It must not create a Field Capture processing queue.

### Commands, receipts, jobs, and outbox

Existing authority:

- `platform_private.command_types`
- `platform_private.command_receipts`
- `platform_private.jobs`
- `platform_private.outbox_events`

Phase 8A commands must use the accepted idempotency, actor, correlation, receipt, job, and outbox laws.

Do not create a hidden Field Capture queue on the server.

The client-side offline queue is a different concern and is genuinely missing.

### Trust and provenance

Existing Trust, Source, Citation, Corrections, review-event, Registry, and domain histories remain authoritative for their own meanings.

Phase 8A should preserve submission provenance and correlation identifiers so Phase 8B can attach reviewed Sources, Citations, Corrections, or Registry evidence without copying evidence into a Field Capture silo.

## Existing Media limitations exposed by Phase 8A

### Resumable upload is currently an administrative workflow

The current `media-upload-api` requires authentication.

Its JSON control actions call `requireAdmin(isAdmin)` before resumable session operations.

The underlying `create_media_upload_session_v2` command also requires `manage_media_assets`.

This is correct for Media Library administration.

It is too broad for a field contributor.

Phase 8A must not give field contributors administrator status or `manage_media_assets`.

A narrow Field Capture ingress adapter is required.

### Ordinary non-admin upload is profile-image only

The existing form-data upload lane permits a non-admin authenticated user only when the target is that user's own profile-media path, and only for images.

It is not a general contributor-upload lane.

Phase 8A therefore needs an explicit intake authorization boundary.

### Resumable v2 supports audio and video only

The accepted `create_media_upload_session_v2` contract supports audio and video master MIME types and extensions.

It deliberately keeps the existing image and PDF lane separate.

Phase 8A must not silently broaden v2.

The first real Field Capture proof should prefer a video recording because it exercises the existing resumable authority without changing accepted Media type semantics.

If real field use proves that interrupted image or document transfer must also be resumable, add a forward versioned Media upload-session contract after that need is demonstrated.

### Durable cross-reload client recovery does not exist

The current Media Library stores resumable contexts in a React `useRef`.

The Phase 4B design explicitly states that the per-session receiver capability may be held only for the active workflow and that durable cross-browser recovery was not claimed without a safe capability-reissue contract.

Repository audit found no accepted IndexedDB queue and no Service Worker upload queue.

This is a genuine Phase 8A gap.

### Capability persistence is a security boundary

The current resume context contains a bearer capability token for one receiver session.

Phase 8A must not solve durable recovery merely by writing long-lived bearer capabilities into ordinary browser storage.

The preferred direction is a narrow server-authorized capability reissue or resume handshake bound to the Field Submission and the contributor's allowed intake identity.

Exact implementation remains subject to design and preview proof.

## Genuinely new Field Capture authority

### Field Submission

Phase 8A requires one stable private intake identity representing the submission workflow rather than the file.

The Field Submission concept should preserve, at minimum:

- stable submission identity;
- intake origin;
- submitter mode;
- authenticated actor where applicable;
- disclosure preference;
- optional safe contact channel where policy permits;
- contributor declaration timestamp;
- content or capture time where known;
- rights declaration;
- consent declaration;
- sensitivity declaration;
- embargo request;
- source-protection request;
- location-protection preference;
- intake notes;
- lifecycle state;
- current revision or optimistic-concurrency value;
- created time;
- correlation ID.

Exact table and schema names are not locked by this audit.

### Submission to Media binding

One submission may eventually contain more than one Media asset.

Phase 8A therefore must not model the submission itself as the file.

The design should reuse `media.usage_links` if its target and usage-role contract cleanly supports the Field Submission after a narrow audited extension.

If it does not, use the smallest explicit Field Submission to Media binding.

Do not duplicate Media URLs, checksums, rights truth, or storage paths into the Field Submission as parallel authority.

### Submission history

Field intake needs reconstructable history.

Events should cover meaningful transitions such as:

- submission created;
- file intake started;
- upload session attached;
- upload resumed;
- canonical Media attached;
- contributor declaration updated before final submission;
- submission finalized;
- receipt issued;
- intake cancelled or expired where applicable.

Do not copy low-level Media part-upload events into Field Submission history.

Media continues to own Media transfer and file history.

### Submission receipt

The contributor needs a truthful acknowledgement that WAKILISHA received the submission.

A receipt should contain only safe information.

For an authenticated contributor, it may expose a stable display reference and submission time through an authenticated read.

It must not expose:

- internal reviewer identity;
- sensitive source-protection classification;
- private evidence;
- protected Media URLs;
- storage paths;
- internal triage notes.

Any later anonymous receipt contract must use an opaque non-enumerable credential rather than a guessable submission identifier.

## Client-side weak-network durability

The offline or weak-network queue is genuinely missing.

The implementation design must prove mobile browser behavior before selecting its permanent local persistence mechanism.

Candidate browser mechanisms may include IndexedDB, Origin Private File System where supported, or a bounded combination.

The implementation must not assume that a React ref, page memory, or `localStorage` can safely hold large Media bytes.

Required behavior:

- persist enough local submission state to recover after page interruption;
- retain or recover the selected Media bytes where the browser safely permits it;
- distinguish waiting-for-network from terminal failure;
- resume from accepted server parts;
- avoid duplicate submission identity;
- avoid duplicate canonical Media identity;
- expire local sensitive material after successful governed intake;
- allow the contributor to cancel and remove queued local material;
- make storage limitations visible instead of falsely promising durability.

The first browser-support audit must include current iOS Safari and Android Chrome because mobile capture is the product requirement.

## Contributor identity and anonymous intake policy

### Authenticated intake is the first implementation proof

The existing command and Media systems are intentionally authenticated.

The safest first Phase 8A proof is therefore an authenticated contributor who does not receive broad Media-management capability.

Identity disclosure and authentication are separate questions.

An authenticated contributor may choose that their identity is:

- available to authorized newsroom staff;
- restricted to a smaller source-protection group;
- not projected publicly.

Do not confuse "not publicly named" with "technically anonymous."

### Open anonymous upload is not enabled by default

The existing platform command bus intentionally denies anonymous commands.

Phase 8A must not weaken that global rule.

The Phase 8A anonymous-intake policy is:

- no broad anonymous direct access to Media tables;
- no broad anonymous access to Media upload-session commands;
- no public receiver secret;
- no open unauthenticated large-file upload endpoint by default.

If a later Phase 8A slice enables true anonymous intake, it requires a separate narrow intake-capability design with:

- abuse and rate controls;
- bounded expiry;
- non-enumerable token identity;
- scoped upload rights;
- safe resume;
- no access to unrelated Media;
- protected receipt semantics;
- source-protection review.

That work is not required for the first authenticated weak-network exit proof.

## Location protection

Repository audit found no accepted Field Capture geolocation authority or location-protection implementation.

Phase 8A should therefore default to data minimization.

Initial rules:

- do not request device geolocation by default;
- do not infer exact location merely because the device can provide it;
- contributor-entered location is optional unless a named newsroom workflow requires it;
- exact sensitive location is private;
- public or editorial-safe place can later be a separate coarse value;
- no public response may expose raw coordinates from intake.

Exact location schema and encryption requirements remain subject to threat-model design.

## Device metadata and metadata stripping

Repository audit found no explicit accepted Field Capture EXIF, GPS, or general metadata-stripping authority.

Phase 8A must not destroy evidentiary originals casually.

Default rule:

- preserve the exact submitted original as protected Media when journalistic integrity requires original bytes;
- never expose the protected original as the public derivative merely because upload succeeded;
- public or editor-safe derivatives must be evaluated for metadata removal before publication;
- raw embedded GPS or device identifiers must be treated as sensitive.

For high-risk source modes, pre-upload sanitization may be evaluated separately because even private server storage of raw device metadata can create risk.

That choice requires an explicit threat model and must not be silently implemented as a generic image rewrite.

Phase 8B remains responsible for proving a safe derivative before promotion.

## Governance defaults for Field Capture

The current canonical Media creation command correctly starts new Media with conservative internal governance.

Field Capture should preserve or strengthen that posture.

A newly accepted field original should not become publicly safe automatically.

The expected starting posture is conceptually:

- internal;
- public safety not approved;
- rights and consent explicit from intake where known;
- sensitivity based on contributor declaration plus newsroom review;
- source protection at least as restrictive as the submission request;
- embargo preserved when requested and valid.

The exact command must create or advance governance through existing Media governance authority.

Do not copy these values into a second Field Capture governance table and let them drift.

## Phase 8A lifecycle boundary

A provisional Field Submission lifecycle should be designed around intake, not publication.

Candidate meaning:

```text
draft_local
-> receiving
-> received
-> submitted
-> cancelled
-> expired
```

Server authority should begin no earlier than the first successful server-side submission command.

Client-only states such as waiting for network should not be misrepresented as server lifecycle states.

Exact vocabulary is deferred to schema design.

Phase 8B will add newsroom triage meaning through a forward lifecycle or related review authority after the Phase 8A intake contract is accepted.

## Phase 8A permission boundary

Phase 8A needs narrower capabilities than Media administration.

The design should distinguish:

- submit field capture;
- read own submission receipt or safe status;
- newsroom field-intake read;
- newsroom source-protection read;
- later triage and promotion.

A field contributor must not gain:

- general Media Library read;
- `manage_media_assets`;
- governance-review authority;
- protected delivery for unrelated Media;
- newsroom notes;
- another contributor's submission.

Capabilities should use the existing role and capability system.

## What Phase 8A must not touch

Do not:

- reopen Phase 4A Media identity;
- mutate accepted `create_media_upload_session_v1` or v2 semantics;
- create a second Media receiver;
- create a second server job queue;
- create a Field Capture evidence warehouse;
- create a new Article, Audio, or Video publication system;
- publish field material;
- build Phase 8B triage UI inside the intake milestone;
- expose protected originals publicly;
- grant `manage_media_assets` to ordinary contributors;
- enable unrestricted anonymous uploads;
- store raw device location by default;
- claim cross-browser recovery until real mobile browsers prove it.

## Recommended implementation sequence

### 8A.1 Authority and threat-model design

Seal:

- Field Submission identity;
- submission lifecycle;
- contributor identity and disclosure modes;
- source-protection policy;
- location minimization;
- original versus safe-derivative policy;
- receipt contract;
- Media binding;
- permission model;
- capability-reissue strategy.

No schema before this design is accepted.

### 8A.2 Field Submission foundation

In one disposable Supabase preview:

- create the minimum private Field Submission authority;
- add narrow commands and reads;
- add append-only submission history;
- add capability definitions;
- prove RLS and direct-table denial;
- bind correlation and idempotency to existing platform command authority.

Do not implement public anonymous intake in this first schema slice.

### 8A.3 Authenticated resumable Field Media adapter

Add a forward adapter that:

- accepts a Field Submission;
- authorizes only the submission owner or permitted intake actor;
- reuses Media upload-session and receiver authority;
- supports safe capability reissue or resume without persisting a long-lived receiver bearer secret;
- adopts the verified exact file into canonical Media;
- applies conservative governance;
- attaches the resulting Media to the Field Submission;
- is idempotent.

Prefer video as the first real proof because current resumable v2 already supports Video.

### 8A.4 Mobile local durability

Implement the smallest proven mobile queue.

Prove:

- page interruption;
- network loss;
- app foreground/background transition where browser behavior permits;
- restored submission identity;
- restored Media transfer progress;
- accepted part reuse;
- cancellation;
- local cleanup after successful receipt.

Do not claim background upload if the mobile browser cannot provide it reliably.

### 8A.5 Safety and receipt UX

Implement:

- contributor disclosure choice;
- rights and consent declaration;
- sensitivity and source-protection choices;
- embargo request;
- location minimization;
- explicit upload and received states;
- safe receipt;
- clear failure and recovery language.

### 8A.6 Real acceptance

Use one real or controlled mobile video field recording.

Acceptance must prove:

1. exact accepted merged main;
2. mobile capture or file selection;
3. submission identity created exactly once;
4. intentional network loss after at least one accepted part;
5. local recovery after interruption;
6. server status query before resume;
7. completed parts are not re-uploaded;
8. exact final byte count and SHA-256;
9. exactly one verified canonical `media.file_objects` row;
10. exactly one logical Media asset and original revision;
11. protected original is not public;
12. conservative Media governance is active;
13. Field Submission points to the canonical Media identity;
14. contributor receipt is available;
15. another contributor cannot read the submission;
16. contributor cannot read unrelated Media;
17. retry is idempotent;
18. cancellation cleans local and partial server state;
19. no Article, Audio, or Video publication is created;
20. Phase 8B triage remains a separate next milestone.

## Preview and production law

Phase 8A will contain database and runtime work.

Therefore the normal WAKILISHA deployment sequence applies:

1. exact clean milestone branch from accepted main;
2. smallest candidate;
3. focused static tests;
4. exact changed-file scope;
5. one disposable Supabase preview;
6. full baseline migration replay;
7. only then new Phase 8A SQL;
8. permanent read-only verifier;
9. behavior fixtures;
10. preview cleanup;
11. byte-identical SQL promotion;
12. focused and Critical suites;
13. commit, push, PR, green CI, merge;
14. production SQL separately;
15. migration-history and zero-pending proof;
16. production verifier;
17. Edge Function or frontend activation only after database authority;
18. real mobile weak-network acceptance;
19. cleanup.

Do not rerun a mutating acceptance script after a partial stop.

Diagnose the stopped state and resume surgically.

## Primitive impact

### Reused foundations

- Resource and domain identity where applicable;
- command/idempotency/concurrency;
- jobs and outbox;
- Media identity;
- Media file objects;
- Media revisions;
- Media governance;
- Media upload sessions;
- Media processing;
- Trust and provenance;
- role and capability infrastructure.

### New domain authority

- Field Submission.

### Candidate reusable residue

Do not declare a new shared client offline-queue primitive before Phase 8A proves it in real mobile Field Capture.

If a later domain such as Commerce proves the same local durable-command semantics, review it for promotion under the Primitive Compounding Contract.

### Intentionally domain-specific

- source disclosure choices;
- field safety declarations;
- embargo request at intake;
- location-protection preference;
- newsroom-facing receipt and submission semantics.

## Audit conclusion

Phase 8A is not an upload-platform rebuild.

The server already knows how to preserve exact Media bytes, resume interrupted audio/video transfer, verify checksums, create immutable Media identity, govern rights and sensitivity, process derivatives, and operate idempotent commands and jobs.

The missing product is the safe contributor intake layer around that authority.

The core Phase 8A challenge is therefore:

> give a mobile contributor a durable, least-privilege, privacy-aware Field Submission that can survive a bad network and converge on existing canonical Media without exposing newsroom or Media-administration authority.

Implementation should begin with the Field Submission and threat-model design, then prove one authenticated mobile video vertical slice before broadening file kinds or anonymous intake.
