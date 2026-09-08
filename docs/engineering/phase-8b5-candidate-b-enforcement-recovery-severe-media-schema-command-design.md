# Phase 8B.5 Candidate B: Enforcement, Recovery, and Severe Media Schema/Command Design

**Status:** Design candidate, documentation only  
**Date:** 8 September 2026  
**Parent:** #868  
**Candidate:** #870  
**Accepted audit merge:** `cd9e72c7b93dee87e920f001e920adc085940674`

## Purpose

Lock the exact database, command, read, enforcement, appeal, Media containment, and worker contract for Phase 8B.5 Candidate B before SQL.

Candidate B adds graduated Messages enforcement, user recovery where allowed, severe-category bypass, exact canonical Media matching and containment, and an isolated Media safety scan job contract. It compounds Candidate A Safety Case authority, canonical Message chronology, canonical Person/Auth identity, canonical Media identity and governance, and the existing command/job/outbox substrate.

This design does not implement Candidate C Legal authority, public Messages rollout, a new attachment product, a second moderation store, a second Media store, or another generic queue.

## Governing authority

This design compounds:

- `docs/engineering/phase-8b-messages-authority-and-product-contract.md`;
- `docs/engineering/phase-8b-messages-core-schema-design.md`;
- `docs/engineering/phase-8b5-candidate-a-safety-case-quarantine-schema-command-design.md`;
- `docs/engineering/phase-8b5-candidate-a-production-closure.md`;
- `docs/engineering/phase-8b5-candidate-b-enforcement-recovery-severe-media-authority-audit.md`;
- canonical Person/Auth identity authority;
- accepted Messages Conversation, participant, mailbox, Message, receipt, sender-policy, and Resource-reference authority;
- accepted Candidate A Safety Case, exact target, append-only event, evidence inspection, and Message quarantine authority;
- canonical Media file, SHA-256, revision, variant, governance, processing, and delivery authority;
- existing command receipts, jobs, worker leases, retry state, dead-letter state, and transactional outbox;
- existing `super_admin` and `manage_messages_control_center` authority;
- existing `/messages` and `/admin/messages` product surfaces.

## Locked ownership boundaries

Candidate B owns only three new peer states:

```text
messaging.safety_enforcements
messaging.safety_appeals
messaging.safety_media_containment
```

Candidate B extends, but does not replace:

```text
messaging.safety_cases
messaging.safety_case_events
messaging.safety_case_targets
messaging.message_quarantine
```

Candidate B does not own or duplicate:

- Auth account state;
- canonical Person identity;
- Message body or Message identity;
- Conversation membership;
- participant mailbox classification;
- Community Block/Report storage;
- Media bytes;
- Media SHA-256 authority;
- Media revisions or variants;
- Media asset governance;
- generic command receipts;
- generic jobs, leases, retries, dead letters, or outbox;
- Legal preservation or disclosure production.

## Candidate A extensions

### Safety Case disposition

Extend the existing `messaging.safety_cases.current_disposition` vocabulary from:

```text
pending
no_action
quarantine
```

to:

```text
pending
no_action
quarantine
enforced
```

The existing meaning of `no_action` and `quarantine` remains unchanged.

`enforced` is a historical case-level outcome. It is not the effective restriction ledger. Exact active restrictions remain in `messaging.safety_enforcements`.

A case may resolve as `enforced` only when at least one effective enforcement row owned by that case exists at resolution time.

A later appeal may reverse every enforcement while the case remains historically resolved as `enforced`. Recovery history belongs to the enforcement and appeal ledgers, not a rewrite of the original case outcome.

### Safety Case event vocabulary

Extend `messaging.safety_case_events.event_kind` with:

```text
assessment_updated
enforcement_applied
enforcement_released
enforcement_superseded
enforcement_expired
enforcement_reversed
appeal_submitted
appeal_review_started
appeal_resolved
media_contained
media_containment_released
```

Keep existing Candidate A event kinds unchanged:

```text
opened
signal_added
review_started
quarantined
released
resolved
evidence_viewed
```

`signal_added` remains the event kind for bounded provider/detection evidence.

No Candidate B event may store a Message body, Media bytes, Media SHA-256, storage credential, access token, unrestricted provider payload, or unrelated private content.

## `messaging.safety_enforcements`

### Purpose

Own accountable Messages-scoped enforcement history and the current effective restriction state for one canonical human subject.

### Columns

```text
id uuid primary key default gen_random_uuid()
safety_case_id uuid not null
source_message_id uuid not null
subject_user_id uuid not null
subject_person_resource_id uuid not null
enforcement_kind text not null
status text not null default 'active'
applied_at timestamptz not null default now()
applied_by_user_id uuid not null
effective_until timestamptz null
appeal_allowed boolean not null default false
public_reason text not null
internal_reason text not null
cooldown_seconds integer null
rate_limit_count integer null
rate_limit_window_seconds integer null
ended_at timestamptz null
ended_by_user_id uuid null
end_reason text null
superseded_by_enforcement_id uuid null
command_receipt_id uuid not null
revision bigint not null default 1
```

### Foreign keys

```text
safety_case_id -> messaging.safety_cases(id)
source_message_id -> messaging.messages(id)
subject_user_id -> auth.users(id)
subject_person_resource_id -> editorial.people(resource_id)
applied_by_user_id -> auth.users(id)
ended_by_user_id -> auth.users(id)
superseded_by_enforcement_id -> messaging.safety_enforcements(id)
command_receipt_id -> platform_private.command_receipts(id)
```

Use `ON UPDATE RESTRICT` for canonical identity links.

Historical enforcement rows must not disappear when a current Auth account changes state. Candidate B does not introduce destructive enforcement deletion.

### Enforcement vocabulary

```text
warning
send_cooldown
send_rate_limit
links_restricted
media_restricted
conversation_start_restricted
messaging_suspended
messaging_removed
```

### Status vocabulary

```text
active
released
expired
reversed
superseded
```

`active` is the only status that may be effective.

Effective state is always:

```text
status = 'active'
and (
  effective_until is null
  or effective_until > now()
)
```

Time passage makes an elapsed row ineffective even before a later governed mutation normalizes `status` to `expired`.

There is no expiry scheduler in Candidate B.

A later governed enforcement or appeal mutation may normalize a relevant elapsed row to `expired`, set `ended_at = effective_until`, and append `enforcement_expired`. Ordinary read/send paths do not mutate Safety history merely to observe time passage.

### Parameter shape

`warning`, `links_restricted`, `media_restricted`, `conversation_start_restricted`, `messaging_suspended`, and `messaging_removed` require:

```text
cooldown_seconds is null
rate_limit_count is null
rate_limit_window_seconds is null
```

`send_cooldown` requires:

```text
cooldown_seconds between 5 and 86400
rate_limit_count is null
rate_limit_window_seconds is null
```

`send_rate_limit` requires:

```text
rate_limit_count between 1 and 100
rate_limit_window_seconds between 60 and 86400
cooldown_seconds is null
```

All other parameter combinations are invalid.

### Text bounds

```text
public_reason: non-empty, maximum 500 bytes
internal_reason: non-empty, maximum 2000 bytes
end_reason: null or maximum 2000 bytes
```

`public_reason` is the only enforcement reason eligible for the sanctioned user's safe projection.

`internal_reason` never appears in ordinary user reads.

### Temporal and status shape

For `active` rows:

```text
ended_at is null
ended_by_user_id is null
end_reason is null
superseded_by_enforcement_id is null
```

For `released` and `reversed` rows:

```text
ended_at is not null
ended_by_user_id is not null
end_reason is not null
```

For `expired` rows:

```text
ended_at is not null
ended_at >= applied_at
ended_by_user_id may be null
end_reason may record normalization context
```

For `superseded` rows:

```text
ended_at is not null
ended_by_user_id is not null
end_reason is not null
superseded_by_enforcement_id is not null
```

Every row requires:

```text
revision >= 1
```

If `effective_until` is present, it must be later than `applied_at` when the row is created.

`messaging_removed` must use `effective_until is null`. Recovery happens through governed release/reversal, not a pretend removal expiry.

### Active uniqueness

Allow at most one active row for the same case, subject, and enforcement kind:

```text
unique (
  safety_case_id,
  subject_user_id,
  enforcement_kind
)
where status = 'active'
```

Different Safety Cases may own overlapping effective restrictions against the same subject.

This is intentional. Effective enforcement evaluates every active row rather than collapsing independent case authority into one mutable record.

### Subject derivation

The browser command never accepts `subject_user_id` or `subject_person_resource_id` as operator input.

For a Message-target enforcement action, server authority must:

1. prove `safety_case_id` targets `source_message_id` through `messaging.safety_case_targets`;
2. load the canonical Message;
3. load its canonical sender participant;
4. require sender `actor_kind = 'human'`;
5. require non-null sender `user_id` and `person_resource_id`;
6. bind the enforcement row to that exact derived pair.

A Media-only case cannot silently punish an arbitrary user.

## Graduated enforcement matrix

Candidate B does not add a strike counter and does not infer punishment from report counts.

The reviewed case severity sets the maximum action available to the Super Admin command.

### `low`

Permitted:

```text
warning
send_cooldown
send_rate_limit
```

### `medium`

Permitted:

```text
warning
send_cooldown
send_rate_limit
links_restricted
media_restricted
conversation_start_restricted
```

### `high`

Permitted:

```text
warning
send_cooldown
send_rate_limit
links_restricted
media_restricted
conversation_start_restricted
messaging_suspended
```

### `severe`

Permitted:

```text
warning
send_cooldown
send_rate_limit
links_restricted
media_restricted
conversation_start_restricted
messaging_suspended
messaging_removed
```

A severe reviewed case may apply any permitted severe action immediately. No warning, cooldown, prior strike count, or prior suspension is required.

That is the severe-category bypass.

The command remains a deliberate WAKILISHA decision. Provider output, report count, or confidence score cannot invoke it automatically.

## Multiple enforcement precedence

Every effective row is evaluated.

### Hard send/start denial

If any effective row is:

```text
messaging_removed
or
messaging_suspended
```

then:

```text
can_start = false
can_send = false
```

### Conversation start denial

If no hard denial exists but any effective row is:

```text
conversation_start_restricted
```

then:

```text
can_start = false
```

Existing permitted Conversation sends remain possible subject to every other rule.

### Content restrictions

If any effective row is:

```text
links_restricted
```

then link-bearing Message bodies are rejected.

If any effective row is:

```text
media_restricted
```

then canonical Media Resource references are rejected.

Candidate B does not create a binary attachment path.

### Cooldown

Every effective `send_cooldown` row is enforced.

The effective next-send time for a row is:

```text
latest accepted Message sent by the subject
+ cooldown_seconds
```

The sender may send only when every effective cooldown row permits it.

The user-safe projection may expose the maximum resulting next-send timestamp.

### Rate limit

Every effective `send_rate_limit` row is enforced independently.

For each row, count canonical accepted Messages sent by the subject with:

```text
accepted_at > now() - rate_limit_window_seconds
```

Reject when the count is already greater than or equal to `rate_limit_count`.

The sender may send only when every effective rate-limit row permits it.

Do not collapse differently sized windows into one derived counter.

### Warning

`warning` is accountable notice only. It does not deny Message acceptance by itself.

## Sender concurrency authority

Add one reusable transaction-scoped sender Safety lock:

```text
pg_advisory_xact_lock(
  hashtextextended(
    'messages-safety-subject:' || subject_user_id::text,
    0
  )
)
```

The common sender enforcement helper acquires this lock before cooldown/rate-limit evaluation.

The lock remains held through canonical Message acceptance because it is transaction-scoped.

All human send/start entry points must call the common helper before inserting a Message:

```text
public.start_message_conversation(...)
public.start_field_submission_message_v1(...)
public.send_message(...)
```

Existing idempotent replay returns the original accepted result before a new enforcement decision. A command already accepted before a later sanction does not become retroactively invalid.

New first-time commands must evaluate current enforcement.

Add the focused chronology index:

```text
messaging.messages(
  sender_participant_id,
  accepted_at desc,
  id desc
)
```

Do not add a mutable rate counter table.

## Canonical Media Resource-reference detection

Candidate B does not add `message_media_references`.

A Message Resource reference counts as a canonical Media reference for `media_restricted` when the referenced `editorial.resources` row has:

```text
resource_kind = 'media_asset'
```

The common enforcement helper inspects the submitted Resource-reference IDs through canonical Resource authority.

Underlying Resource access validation still runs through the existing Messages reference validator.

A future Message Media-reference command must call the same sender enforcement helper before acceptance.

## `messaging.safety_appeals`

### Purpose

Own one exact user appeal/recovery record for one exact enforcement row.

### Columns

```text
id uuid primary key default gen_random_uuid()
enforcement_id uuid not null unique
safety_case_id uuid not null
appellant_user_id uuid not null
appellant_person_resource_id uuid not null
status text not null default 'open'
appeal_reason text not null
submitted_at timestamptz not null default now()
review_started_at timestamptz null
reviewed_by_user_id uuid null
resolution text null
resolution_public_note text null
resolution_internal_note text null
resolved_at timestamptz null
resolved_by_user_id uuid null
submit_command_receipt_id uuid not null
review_command_receipt_id uuid null
resolution_command_receipt_id uuid null
revision bigint not null default 1
```

### Foreign keys

```text
enforcement_id -> messaging.safety_enforcements(id)
safety_case_id -> messaging.safety_cases(id)
appellant_user_id -> auth.users(id)
appellant_person_resource_id -> editorial.people(resource_id)
reviewed_by_user_id -> auth.users(id)
resolved_by_user_id -> auth.users(id)
submit_command_receipt_id -> platform_private.command_receipts(id)
review_command_receipt_id -> platform_private.command_receipts(id)
resolution_command_receipt_id -> platform_private.command_receipts(id)
```

### Status vocabulary

```text
open
under_review
resolved
```

### Resolution vocabulary

```text
upheld
modified
reversed
```

`resolution` is null until `status = 'resolved'`.

### Text bounds

```text
appeal_reason: non-empty, maximum 4000 bytes
resolution_public_note: null before resolution, non-empty and maximum 1000 bytes at resolution
resolution_internal_note: null before resolution, non-empty and maximum 4000 bytes at resolution
```

### Shape

`open` requires:

```text
review_started_at is null
reviewed_by_user_id is null
resolution is null
resolved_at is null
resolved_by_user_id is null
review_command_receipt_id is null
resolution_command_receipt_id is null
```

`under_review` requires:

```text
review_started_at is not null
reviewed_by_user_id is not null
resolution is null
resolved_at is null
resolved_by_user_id is null
review_command_receipt_id is not null
resolution_command_receipt_id is null
```

`resolved` requires:

```text
review_started_at is not null
reviewed_by_user_id is not null
resolution is not null
resolution_public_note is not null
resolution_internal_note is not null
resolved_at is not null
resolved_by_user_id is not null
resolution_command_receipt_id is not null
```

Every row requires `revision >= 1`.

### Appeal eligibility

Only the exact current canonical user/Person pair bound to the enforcement may submit the appeal.

The enforcement must have:

```text
appeal_allowed = true
```

The enforcement must not already be `released`, `reversed`, or `superseded`.

An elapsed `effective_until` makes the enforcement ineffective. A new appeal is rejected when no restriction remains effective.

One enforcement row receives at most one appeal. A modified appeal creates a new enforcement row, which may independently be appealable if the resolution permits it.

Submitting an appeal never changes enforcement state automatically.

## Appeal modification rules

`modified` must narrow the effective restriction. It may not increase severity under the appeal resolution path.

### Same-kind modification

Allowed for all kinds when the replacement term is no broader.

For finite `effective_until`:

```text
new effective_until <= old effective_until
```

If the old row has no `effective_until`, a finite replacement is narrower.

If the old row has a finite `effective_until`, a null replacement is invalid.

`appeal_allowed` may change from false to true. It may not change from true to false through `modified`.

For `send_cooldown`:

```text
new cooldown_seconds <= old cooldown_seconds
```

For `send_rate_limit`:

```text
new rate_limit_count >= old rate_limit_count
and
new rate_limit_window_seconds <= old rate_limit_window_seconds
```

### Cross-kind narrowing

Allowed:

```text
messaging_removed
  -> messaging_suspended
  -> conversation_start_restricted
  -> send_rate_limit
  -> send_cooldown
  -> warning
```

`messaging_removed` may choose any kind on that downward path.

`messaging_suspended` may choose any kind below it on that path.

`conversation_start_restricted` may choose `send_rate_limit`, `send_cooldown`, or `warning`.

`links_restricted` may change only to `links_restricted` or `warning`.

`media_restricted` may change only to `media_restricted` or `warning`.

`send_rate_limit` may change only to `send_rate_limit`, `send_cooldown`, or `warning`.

`send_cooldown` may change only to `send_cooldown` or `warning`.

`warning` may only remain `warning` with a shorter finite term where applicable.

This conservative relation prevents an appeal resolution from swapping one restriction for a different, potentially broader orthogonal restriction.

### Atomic replacement

A `modified` appeal resolution must atomically:

1. lock the appeal and current enforcement;
2. validate narrowing rules;
3. create the replacement enforcement row;
4. set the original enforcement to `superseded`;
5. bind `superseded_by_enforcement_id` to the replacement;
6. set original `ended_at`, `ended_by_user_id`, and `end_reason`;
7. resolve the appeal;
8. append `enforcement_superseded`, `enforcement_applied`, and `appeal_resolved` events;
9. complete the command receipt.

No history is edited in place.

### Reversal

A `reversed` appeal resolution must atomically set the enforcement to `reversed`, record accountable end fields, resolve the appeal, append `enforcement_reversed` and `appeal_resolved`, and complete the command receipt.

### Upheld

An `upheld` appeal resolution leaves enforcement state unchanged and appends `appeal_resolved`.

## `messaging.safety_media_containment`

### Purpose

Own historical exact-file Safety containment while canonical Media continues to own file identity, bytes, SHA-256, verification, revisions, variants, and asset governance.

### Columns

```text
id uuid primary key default gen_random_uuid()
media_file_object_id uuid not null
safety_case_id uuid not null
status text not null default 'active'
policy_category text not null
placed_at timestamptz not null default now()
placed_by_user_id uuid not null
released_at timestamptz null
released_by_user_id uuid null
release_note text null
command_receipt_id uuid not null
```

### Foreign keys

```text
media_file_object_id -> media.file_objects(id)
safety_case_id -> messaging.safety_cases(id)
placed_by_user_id -> auth.users(id)
released_by_user_id -> auth.users(id)
command_receipt_id -> platform_private.command_receipts(id)
```

### Status vocabulary

```text
active
released
```

### Shape

`active` requires:

```text
released_at is null
released_by_user_id is null
release_note is null
```

`released` requires:

```text
released_at is not null
released_by_user_id is not null
release_note is non-empty
```

`release_note` maximum: 2000 bytes.

`policy_category` uses the accepted Candidate A slug rule and maximum 64 bytes.

### Active uniqueness

At most one active containment row may exist per canonical file object:

```text
unique (media_file_object_id)
where status = 'active'
```

A second case may still target the file. It cannot steal or release another case's active containment row.

## Exact canonical Media match expansion

Applying severe Media containment requires:

1. case status `under_review`;
2. case severity `severe`;
3. the case already targets the supplied seed `media_file_object_id`;
4. the seed file is canonical and `verification_state = 'verified'`;
5. the seed has a valid canonical SHA-256 and non-null byte size.

The command then queries canonical `media.file_objects` for verified files with the same:

```text
sha256
byte_size
```

The existing `(sha256, byte_size)` Media index is reused.

For every current exact match:

- insert a missing immutable `messaging.safety_case_targets` Media target for the same case;
- create an active containment row when the file has no active containment;
- leave a pre-existing active containment owned by another case intact;
- do not copy SHA-256 into any Safety table or event metadata.

The command result may return counts and file-object IDs. It must not return SHA-256, storage paths, or provider credentials.

Release with the same seed releases only active containment rows owned by the supplied case whose canonical file identity still belongs to the same exact match set.

A containment owned by another case remains active.

Immutable Safety targets remain after release.

## Future exact-match fail-closed rule

A new verified canonical file with the same SHA-256 and byte size may appear after the original containment command.

The common containment predicate therefore evaluates canonical Media at read time.

`messaging.media_file_is_safety_contained(p_media_file_object_id uuid)` returns true when:

1. the requested canonical file is verified and has canonical SHA-256 plus byte size; and
2. any active `messaging.safety_media_containment` row references a verified canonical file with that same SHA-256 plus byte size.

This prevents future duplicate file rows from escaping an active exact-match containment without copying the hash into Safety storage.

Releasing the last active containment for that exact hash/size identity restores Safety eligibility. Ordinary Media governance must still pass independently.

The helper returns only a boolean. It never exposes Safety Case metadata to ordinary Media consumers.

## Media delivery convergence

Every current direct canonical file delivery path found by the audit must consult the common containment predicate.

### `public.resolve_media_asset_delivery(...)`

For canonical current/exact revision delivery, reject before returning when the resolved `media_file_object_id` is contained.

Legacy snapshot delivery has no canonical file-object identity and remains governed by its existing compatibility boundary. Candidate B does not invent a canonical file identity for legacy snapshot URLs.

### `public.get_media_private_delivery_target_v1(...)`

Reject a contained exact file before returning protected storage metadata.

### `audio.assert_publishable_version_media(...)`

The exact audio delivery variant file and exact Transcript original file must both fail publishability when contained.

This protects the primary Audio publication delivery path at its existing governance assertion.

### `public.get_public_audio_publication_m1(...)`

Keep the existing `audio.assert_publishable_version_media(...)` call.

Also require the directly selected waveform file and directly selected Transcript file to be uncontained before returning their delivery metadata.

### `public.get_public_video_caption_delivery_target(...)`

Reject the resolved caption file when contained.

### `public.get_public_video_transcript_delivery_target(...)`

Reject the resolved Transcript file when contained.

Candidate B must search the exact implementation branch again before migration freeze. If another current direct canonical file delivery resolver exists at that point, it must compound the same predicate before Preview acceptance.

Safety containment cannot make otherwise unauthorized Media deliverable.

Release restores only the Safety half of eligibility.

## Normal Media processing containment boundary

Candidate B must prevent normal Media processing from becoming an exact-file containment escape path.

Use the common containment predicate. Do not create another processing queue.

### New submissions

`public.submit_media_processing_command_v1(...)` must reject when its canonical source file is actively contained by exact identity.

### Worker claims

`public.claim_media_processing_jobs_v1(...)` must not claim a queued/retrying `media.process_revision` job whose `input_payload.source_file_object_id` is actively contained.

### Pending jobs when containment is applied

The Media containment command must cancel queued/retrying normal `media.process_revision` jobs whose canonical `source_file_object_id` is one of the newly contained exact matches.

Use existing `platform_private.jobs` and `platform_private.command_receipts` state:

```text
job.status = 'cancelled'
job.finished_at = now()
job.last_error = bounded Safety containment reason
receipt.status = 'failed'
receipt.error_code = 'safety_contained'
receipt.completed_at = now()
```

Insert the existing command failure outbox event type for that `media.process_revision` receipt with an idempotent event key.

Do not add a cancellation table.

### Already running normal Media jobs

Do not steal an active worker lease.

The existing output-registration paths must fail closed when their source job's canonical source file is contained:

```text
public.register_media_processing_outputs_v1(...)
public.register_media_processing_profile_outputs_v1(...)
public.register_audio_delivery_processing_outputs_v1(...)
```

`public.complete_media_processing_job_v1(...)` must also reject successful completion while the job source is contained.

The worker may then use the existing failure/retry boundary. Because the source remains contained, later claims remain blocked or the pending job is cancelled on the next governed containment convergence.

No contained source may register a new deliverable output through these normal processing paths.

## Provider scan command/job contract

Candidate B establishes an isolated Media safety scan job contract on the existing generic platform job substrate.

No external provider becomes platform authority in this design.

### Command/job type

```text
command_type = messages.safety.media.scan
job_type = messages.safety.media.scan
```

### Submission

Browser command:

```text
public.submit_messages_safety_media_scan_v1(
  p_case_id uuid,
  p_media_file_object_id uuid,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
```

Requires active Super Admin Messages authority.

The case must be `under_review` and must target the exact supplied canonical Media file.

The file must be verified.

Submission creates or replays:

- one existing command receipt;
- one existing platform job with `job_key = 'primary'`;
- one existing accepted outbox event.

The job input payload contains only bounded operational identity:

```text
safety_case_id
media_file_object_id
correlation_id
```

Do not copy Media bytes, SHA-256, storage path, or provider secret into Safety event rows.

The command receipt/job substrate may store exact operational IDs required to execute the job.

### Scoped claim API

```text
public.claim_messages_safety_media_scan_jobs_v1(
  p_worker_id text,
  p_limit integer default 1,
  p_lease_seconds integer default 900
)
```

Service role only.

It leases only:

```text
command_type = 'messages.safety.media.scan'
job_type = 'messages.safety.media.scan'
```

It must never call the unfiltered generic claim API in a way that could lease unrelated platform work.

Use existing job statuses, `FOR UPDATE SKIP LOCKED`, attempt counts, worker identity validation, and lease semantics.

Bounds:

```text
limit: 1 through 10
lease_seconds: 60 through 3600
```

### Worker target retrieval

```text
public.get_messages_safety_media_scan_target_v1(
  p_job_id uuid,
  p_worker_id text
)
```

Service role only.

The job must:

- be the exact Safety scan command/job type;
- have status `running`;
- be actively leased to `p_worker_id`;
- have an unexpired lease;
- still reference a Safety Case target for the exact file.

Return only the canonical worker retrieval facts needed to inspect the exact file:

```text
job_id
safety_case_id
media_file_object_id
storage_provider
storage_namespace
storage_path
mime_type
byte_size
sha256
verification_state
lease_expires_at
```

This service-role response is not Safety storage. SHA-256 remains read from canonical Media authority.

Do not return public delivery authorization, browser credentials, access tokens, or unrelated Media.

### Completion API

```text
public.complete_messages_safety_media_scan_job_v1(
  p_job_id uuid,
  p_worker_id text,
  p_result jsonb
)
```

Service role only.

Validate exact job type and active lease before accepting the result.

The accepted result object contains only:

```text
provider_key
provider_version
classification_label
confidence
provider_reference optional
scanned_at
```

Validation:

```text
provider_key: ^[a-z][a-z0-9_.:-]{1,99}$
provider_version: non-empty, maximum 200 bytes
classification_label: non-empty, maximum 200 bytes
confidence: numeric 0 through 1
provider_reference: null or maximum 500 bytes
scanned_at: valid timestamptz, not materially in the future
serialized result: maximum 12000 bytes
```

Reject unknown extra keys in the accepted sanitized object.

The completion transaction must:

1. validate result shape;
2. append one `messaging.safety_case_events.signal_added` event with bounded sanitized metadata;
3. call the existing generic job completion primitive;
4. store only the sanitized result in the job/receipt result payload;
5. emit the existing success outbox event.

The signal event may include:

```text
media_file_object_id
provider_key
provider_version
classification_label
confidence
provider_reference
scanned_at
```

It must not include Media SHA-256, bytes, storage path, secrets, raw provider response, or a human enforcement decision.

Completing a scan never changes case severity, case disposition, enforcement, Message quarantine, Media containment, Community state, or account state automatically.

### Failure API

```text
public.fail_messages_safety_media_scan_job_v1(
  p_job_id uuid,
  p_worker_id text,
  p_error text,
  p_retryable boolean default true,
  p_retry_delay_seconds integer default 60
)
```

Service role only.

Validate exact Safety scan job type, then delegate retry/dead-letter semantics to the existing generic job failure authority.

### Lease recovery API

```text
public.recover_expired_messages_safety_media_scan_jobs_v1(
  p_limit integer default 10,
  p_retry_delay_seconds integer default 30
)
```

Service role only.

Mirror the accepted Media processing lease-recovery semantics, scoped only to the Safety scan command/job type.

Use existing `retry_wait`, `dead_letter`, command receipt failure, and outbox event semantics.

No Candidate B scheduler is added.

## Browser command types

Add these command types using the existing `platform_private.command_types` table:

```text
messages.safety.assessment.update
messages.safety.enforcement.update
messages.safety.appeal.submit
messages.safety.appeal.review.start
messages.safety.appeal.resolve
messages.safety.media.containment.update
messages.safety.media.scan
```

Each uses the existing accepted/succeeded/failed/retry naming contract.

No new idempotency ledger is permitted.

## Assessment command

```text
public.update_messages_safety_assessment_v1(
  p_case_id uuid,
  p_policy_category text,
  p_severity text,
  p_confidence numeric,
  p_reason text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
```

Super Admin Messages authority only.

Rules:

- case must exist;
- case status must be `under_review`;
- case must not be resolved;
- policy category uses the accepted Candidate A slug rule;
- severity must be `low | medium | high | severe`;
- confidence may be null or 0 through 1;
- reason is non-empty and maximum 2000 bytes;
- mutation updates only reviewed assessment fields on the existing case;
- append one `assessment_updated` event;
- report count/provider signals are not inspected as automatic threshold authority;
- replay returns the original result without another event.

Only active Super Admin Messages authority may set `severe`.

No ordinary Administrator receives this path.

## Enforcement command

```text
public.set_messages_safety_enforcement_v1(
  p_case_id uuid,
  p_message_id uuid,
  p_enforcement_kind text,
  p_active boolean,
  p_effective_until timestamptz,
  p_appeal_allowed boolean,
  p_public_reason text,
  p_internal_reason text,
  p_cooldown_seconds integer,
  p_rate_limit_count integer,
  p_rate_limit_window_seconds integer,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
```

Super Admin Messages authority only.

### Apply

For `p_active = true`:

- case must be `under_review`;
- exact Message target must belong to the case;
- subject is derived from the exact Message sender;
- enforcement kind must be permitted by the reviewed case severity matrix;
- parameters must match kind shape and bounds;
- reasons must pass their separate public/internal bounds;
- caller does not supply subject IDs;
- acquire the subject Safety advisory lock;
- normalize any relevant elapsed same-case/same-kind active row if needed;
- if no active same-case/same-kind row exists, create one;
- if an active same-case/same-kind row exists with identical effective request shape, return `changed = false` and complete the command;
- if an active same-case/same-kind row exists with different shape, create the replacement row and supersede the old row atomically;
- append exact enforcement events;
- complete the command receipt.

No lower-step history is required for a severe case.

### Release

For `p_active = false`:

- exact case, Message, and derived subject must still agree;
- release only an active same-case/same-kind row;
- release may occur after the Safety Case resolved;
- set status `released` and accountable end fields;
- append `enforcement_released`;
- do not rewrite the Safety Case historical disposition;
- replay creates no duplicate event.

## Case resolution extension

Extend existing:

```text
public.resolve_message_safety_case_v1(...)
```

to accept:

```text
no_action
quarantine
enforced
```

Preserve Candidate A rules:

- `no_action` requires no active quarantine owned by the case;
- `quarantine` requires at least one active Message quarantine owned by the case.

Add:

- `enforced` requires at least one effective `messaging.safety_enforcements` row owned by the case at resolution time.

Resolution does not auto-create enforcement.

## User appeal command

```text
public.submit_messages_safety_appeal_v1(
  p_enforcement_id uuid,
  p_appeal_reason text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
```

Authenticated canonical human only.

Rules:

- resolve caller through `messaging.current_human_identity()`;
- exact caller user/Person pair must match the enforcement subject;
- `appeal_allowed = true`;
- enforcement must still be effective;
- one appeal maximum per enforcement row;
- create `open` appeal;
- append `appeal_submitted` to the originating Safety Case;
- do not release or narrow enforcement;
- result exposes no hidden Safety metadata;
- replay returns the original appeal.

## Appeal admin reads

Add:

```text
public.list_messages_safety_appeals_v1(
  p_status text default null,
  p_before_submitted_at timestamptz default null,
  p_before_appeal_id uuid default null,
  p_limit integer default 50
)
```

Super Admin Messages authority only.

Return bounded operational summary:

```text
appeal_id
enforcement_id
safety_case_id
status
enforcement_kind
submitted_at
review_started_at
resolved_at
resolution
```

Do not return Message body, Media bytes, storage paths, provider raw payloads, or unrelated case history.

## Appeal review start

```text
public.start_messages_safety_appeal_review_v1(
  p_appeal_id uuid,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
```

Super Admin Messages authority only.

Transitions `open -> under_review`, records reviewer/time/receipt, appends `appeal_review_started`, and replays safely.

A resolved appeal cannot restart review.

## Appeal resolution

```text
public.resolve_messages_safety_appeal_v1(
  p_appeal_id uuid,
  p_resolution text,
  p_resolution_public_note text,
  p_resolution_internal_note text,
  p_modified_enforcement_kind text default null,
  p_modified_effective_until timestamptz default null,
  p_modified_appeal_allowed boolean default null,
  p_modified_cooldown_seconds integer default null,
  p_modified_rate_limit_count integer default null,
  p_modified_rate_limit_window_seconds integer default null,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
```

Super Admin Messages authority only.

Rules:

- appeal must be `under_review`;
- resolution must be `upheld | modified | reversed`;
- resolution notes are required and separately bounded;
- `upheld` and `reversed` require every `p_modified_*` argument null;
- `modified` requires the replacement kind and exact parameter shape;
- apply the locked narrowing relation;
- mutation is atomic with enforcement state and Safety events;
- replay returns the original result without duplicate enforcement/event rows.

## Media containment command

```text
public.set_messages_safety_media_containment_v1(
  p_case_id uuid,
  p_media_file_object_id uuid,
  p_contained boolean,
  p_reason text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
```

Super Admin Messages authority only.

Apply requires an `under_review` `severe` case and exact existing Media target.

Apply performs exact verified SHA-256 plus byte-size expansion, immutable target insertion, containment convergence, pending normal Media-job cancellation, one bounded `media_contained` event, and idempotent command completion.

Release may occur on a resolved case. It releases only containment rows owned by that case across the exact match set and appends `media_containment_released`.

The command never changes Media bytes, file verification, SHA-256, storage path, asset revision, variant, or Media governance directly.

## Common sender enforcement helper

Add one internal authority helper with a shape equivalent to:

```text
messaging.assert_sender_safety_allows_v1(
  p_user_id uuid,
  p_person_resource_id uuid,
  p_operation text,
  p_body text,
  p_resource_references jsonb
)
```

Accepted operations:

```text
conversation_start
message_send
```

The helper:

1. proves the supplied user/Person pair still agrees with canonical identity;
2. acquires the sender Safety advisory lock;
3. loads every effective enforcement row for the subject;
4. applies hard denial;
5. applies Conversation-start restriction when relevant;
6. evaluates every cooldown/rate limit from canonical Message chronology;
7. rejects link content when restricted;
8. rejects canonical Media Resource references when restricted;
9. returns without exposing hidden Safety metadata when allowed.

Server error strings returned to ordinary clients must be safe and must not reveal case IDs, provider results, reviewer identity, or internal notes.

The helper is internal. Direct browser execution is revoked.

## Human send/start convergence

### Generic Conversation start

`public.start_message_conversation(...)` calls the common sender helper after first-time command receipt acceptance and before creating or reusing a Conversation for the new Message.

Existing recipient audience, block, sender approval, first-contact, recipient content policy, and Resource-reference validation remain authoritative.

### Field Conversation start

`public.start_field_submission_message_v1(...)` calls the same common sender helper.

Field follow-up permission and newsroom authority do not bypass Safety enforcement.

### Existing Conversation send

`public.send_message(...)` calls the same common sender helper before canonical Message insertion.

System/automation reply policy remains separate.

Candidate B does not apply the human sender enforcement helper to registered System Actor sending.

## User-safe enforcement read

Add:

```text
public.get_my_message_safety_state_v1()
```

Authenticated canonical human only.

Return only caller-owned safe state:

```text
enforcements: [
  enforcement_id
  enforcement_kind
  applied_at
  effective_until
  is_effective
  appeal_allowed
  public_reason
  appeal: {
    appeal_id
    status
    submitted_at
    review_started_at
    resolution
    resolution_public_note
    resolved_at
  } | null
]
can_start
can_send
links_allowed
media_allowed
next_send_at
```

Do not expose:

- Safety Case IDs unless a product requirement later proves they are needed;
- internal reason;
- case confidence;
- provider identity or result;
- reviewer identity;
- Message evidence;
- unrelated enforcement/case history;
- Media storage metadata.

Warnings may remain visible as accountable notice while effective.

## `get_my_message_access()` convergence

Extend the existing access projection with Safety-aware values.

At minimum:

```text
can_start
can_send
visible
```

must use the same effective enforcement semantics as the command helper.

Also return safe optional fields useful to the existing Messages frontend:

```text
links_allowed
media_allowed
send_limited_until
has_safety_state
```

A hard Messages sanction must not hide the Messages product entirely.

`visible` remains true when the user has existing Conversations, an effective enforcement, or an appeal state that the user is permitted to inspect.

This preserves access to the safe recovery surface.

## Existing Super Admin Safety reads

Extend:

```text
public.list_messages_safety_cases_v1(...)
```

with bounded counts:

```text
active_enforcement_count
open_appeal_count
active_media_containment_count
```

Extend:

```text
public.get_messages_safety_case_v1(...)
```

with case-scoped arrays:

```text
enforcements
appeals
media_containment
```

These admin reads may include internal enforcement/recovery notes because they already require Super Admin Messages authority.

They still must not auto-render Message body or Media bytes. Candidate A deliberate evidence inspection remains the only Message-body inspection path.

Provider signal metadata may appear only in the existing case event chronology and must remain bounded/sanitized.

## Product convergence

### `/admin/messages`

Extend the existing Safety section. Do not add another Admin route.

Candidate B adds:

- case assessment controls;
- graduated enforcement action controls;
- active/history enforcement presentation;
- appeal list/detail/review;
- exact Media target containment state;
- optional Safety scan submission only when a worker runtime is actually configured;
- provider signal summary from bounded events;
- no automatic evidence body rendering.

Continue to use shared WAKILISHA controls and the existing `Modal` primitive.

Ordinary Administrator remains denied by server authority.

### `/messages`

Extend the existing Messages product with a narrow Safety notice/recovery section when caller-safe state exists.

Suggested user-facing control labels:

```text
Messages Access
Appeal
Submit Appeal
```

Supporting copy must use `public_reason` and safe eligibility state only.

Do not expose internal Safety language, reviewer notes, provider results, or hidden case metadata.

Composer controls should reflect `links_allowed`, `media_allowed`, and temporary send timing, while server authority remains final.

No new Messages route is required.

## Direct table access

For all three new Candidate B tables:

- enable RLS;
- revoke direct table access from `public`, `anon`, `authenticated`, and `service_role`;
- expose browser behavior only through governed public RPCs;
- expose worker behavior only through service-role SECURITY DEFINER RPCs;
- do not rely on frontend route hiding for authorization.

Candidate B creates no new role and no new capability.

`manage_messages_control_center` remains the Super Admin gate.

## Command receipt resource binding

Continue the accepted Candidate A pattern.

Browser Safety commands use the authenticated actor's canonical Person Resource as `platform_private.begin_authenticated_resource_command(...)` resource authority because Safety Case IDs and Media file-object IDs are not generic editorial Resource IDs.

Every request fingerprint includes the exact Safety Case/Message/Media/enforcement/appeal IDs and bounded mutation inputs relevant to that command.

Receipt results must not duplicate Message body, Media SHA-256, storage paths, unrestricted provider payloads, or secrets.

## Replay semantics

Every Candidate B mutation is principal/idempotency scoped through the existing command receipt authority.

Replay returns the original accepted result.

Replay must not create duplicate:

- enforcement rows;
- appeal rows;
- Media containment rows;
- Safety events;
- scan jobs;
- exact-match targets;
- outbox events.

A fresh idempotency key does not bypass semantic uniqueness:

- one appeal maximum per exact enforcement row;
- one active same-case/same-subject/same-kind enforcement row;
- one active Media containment row per exact file object.

## Provider signal authority

Provider output is evidence only.

No provider completion path may directly call:

- enforcement update;
- case resolution;
- Message quarantine;
- Media containment;
- global account suspension;
- Community Block/Report mutation.

A reviewed human Super Admin command is required for those decisions.

`confidence` on the Safety Case is reviewed assessment state. Scan result confidence remains provider evidence until a Super Admin deliberately changes reviewed assessment.

## Community boundary

Candidate B writes no Messages enforcement, appeal, or Media containment state into:

```text
public.community_blocks
public.community_reports
```

Spam remains participant mailbox classification.

A Community report count is never an automatic Safety verdict.

## Global account boundary

Candidate B does not call ordinary Admin account suspension as its Messages enforcement primitive.

`messaging_suspended` and `messaging_removed` leave Auth account state, Person identity, unrelated roles/scopes, and non-Messages product authority intact.

A separate account-wide decision remains outside this candidate.

## Media governance boundary

Candidate B exact-file containment is independent of asset-level Media governance.

If an operator needs asset-wide public blocking, existing Media governance remains authoritative through its existing capability-gated mutation path.

Candidate B Safety commands do not directly update `media.asset_governance_versions`.

Safety containment can deny an exact file even while ordinary Media governance would otherwise permit it.

Safety release cannot override rights, consent, embargo, verification, publication, or access failure.

## Migration scope

Candidate B implementation should use one migration that contains only the locked runtime authority needed for #870:

1. Candidate A disposition/event constraint extensions;
2. three new `messaging` peer tables;
3. RLS/revoked grants/indexes;
4. new Candidate B command types;
5. common sender Safety helper;
6. sender chronology index;
7. exact Media containment predicate;
8. governed Candidate B browser RPCs;
9. service-role Safety scan worker RPCs;
10. existing Messages start/send/access convergence;
11. existing Candidate A case read/resolve convergence;
12. exact current Media delivery convergence;
13. normal Media processing containment convergence.

No Edge Function is required by the database design itself.

A later provider adapter may require runtime deployment, but it must not change these authority boundaries.

## Type generation

The Candidate B migration adds/changes public RPCs and therefore requires fresh generated `public,editorial` TypeScript types from the accepted disposable Preview.

Do not fabricate generated types from design text.

Seal the exact Preview migration count/head and generated type hash before runtime PR merge.

Candidate A remains migration 110 at head `20260907203000` before Candidate B.

Candidate B implementation should become migration count 111 with exactly one new migration head.

## Permanent verifier

Add one rollback-only Candidate B verifier owned by the Candidate B migration, for example:

```text
scripts/control-plane/verify-phase-8b5-candidate-b-enforcement-recovery-severe-media.sql
```

It must preserve Candidate A's permanent verifier and replay proof.

The Candidate B verifier must prove at minimum:

1. exactly three new Candidate B tables exist with RLS enabled;
2. browser/service roles have no direct table grants;
3. Candidate A four-table Safety authority remains intact;
4. `current_disposition` accepts `enforced` without breaking existing values;
5. new Safety event kinds exist without removing Candidate A kinds;
6. all seven Candidate B command types exist and are enabled;
7. ordinary Administrator is denied all Candidate B admin commands/reads;
8. participant cannot apply enforcement to themselves or another user by arbitrary ID;
9. exact Message target derives exact human sender;
10. graduated severity matrix rejects actions above reviewed severity;
11. severe case may directly apply suspension/removal without lower history;
12. warning does not block canonical send;
13. hard sanctions block start/send while preserving user-safe state;
14. Conversation-start restriction blocks generic and Field starts;
15. link restriction blocks link-bearing body;
16. Media restriction blocks canonical Media Resource references;
17. cooldown/rate limit read canonical Message chronology rather than a mutable counter table;
18. appeal can be created only by exact subject when allowed;
19. appeal submission does not lift enforcement;
20. upheld preserves enforcement;
21. reversed restores eligibility subject to other active restrictions;
22. modified appeal follows the narrowing relation and preserves original history;
23. one appeal maximum per enforcement;
24. exact Media containment requires reviewed severe case and exact Media target;
25. exact-match expansion uses canonical verified SHA-256/byte size and stores no SHA in Safety tables;
26. active containment uniqueness is preserved;
27. future equal-hash canonical files fail the common containment predicate while any exact-match containment remains active;
28. every locked direct Media delivery function checks containment;
29. normal Media processing submission/claim/output completion cannot bypass contained source;
30. queued/retrying normal Media jobs are cancelled through existing job/receipt/outbox state when containment applies;
31. Safety scan job uses existing job/outbox tables and scoped claim APIs;
32. Safety scan worker cannot lease unrelated job types;
33. scan target retrieval requires the exact active worker lease;
34. sanitized scan result appends `signal_added` and cannot create enforcement automatically;
35. provider raw payload/secrets are not persisted;
36. Community Block/Report rows remain unchanged;
37. canonical Message body and canonical Media file identity remain unchanged;
38. migration replay is deterministic.

The permanent verifier is not required to create a redundant UI test family.

## Concurrency acceptance

The sender advisory-lock invariant requires a real multi-session check on disposable Preview.

Run one controlled concurrency acceptance using two database/client sessions against the same subject:

```text
same subject under cooldown/rate limit
-> two sends released concurrently
-> first permitted acceptance commits
-> second observes canonical chronology after lock acquisition
-> second is denied when the effective restriction requires denial
```

This one-time Preview acceptance supplements the rollback-only verifier. It does not justify a new permanent generic test family by itself.

## Controlled non-Production acceptance ledger

Before Production, use a fresh disposable Preview and preserve exact created IDs in a state ledger.

Required flow:

```text
participant Message Safety Case exists
-> Super Admin starts review
-> assessment can set low/medium/high/severe only through governed command
-> low warning records action and send still succeeds
-> cooldown/rate-limit concurrency blocks the second disallowed send
-> medium link restriction blocks link-bearing send
-> medium Media restriction blocks canonical Media Resource reference
-> medium Conversation-start restriction blocks generic and Field starts
-> high temporary Messages suspension blocks start/send and preserves safe user read
-> severe case can apply Messages removal directly without lower history
-> exact subject can submit one allowed appeal
-> appeal submission leaves enforcement active
-> upheld appeal preserves enforcement
-> separate reversible fixture proves reversed appeal restores eligibility
-> modified appeal proves atomic narrower replacement
-> severe Media case targets one verified canonical file
-> containment expands current exact verified hash/size matches without storing SHA in Safety tables
-> future equal-hash fixture fails common containment predicate
-> every locked Media delivery resolver fails contained exact file
-> canonical Media bytes/identity/governance remain unchanged
-> containment release restores Safety eligibility only
-> normal Media processing cannot submit/claim/register/complete contained source
-> Safety scan job claims only exact job type
-> worker target retrieval requires active lease
-> sanitized signal completion appends one signal_added event
-> provider signal creates no automatic human punishment
-> Community Block/Report deltas remain zero
```

Rollback fixtures where possible. Where a disposable Preview acceptance requires committed job/lease state across sessions, record every created ID and delete the Preview after evidence capture.

Production is never disposable acceptance state.

## CI consolidation

Candidate B should reuse existing authoritative Messages and Media regression suites for changed functions and frontend paths.

Do not add a generic Safety UI test family merely to increase test count.

A narrow new owner is justified only when no accepted test can own a Candidate B invariant without mixing unrelated domains.

The Candidate B SQL verifier owns the new database invariants.

The complete application build remains required before runtime PR.

## Runtime implementation sequence

Proceed as one contained vertical after this design merges:

1. branch from exact protected main;
2. implement the one Candidate B migration and rollback-only verifier;
3. run static SQL review and local replay-compatible checks;
4. extend `src/services/messages.ts` rather than adding another Messages client;
5. extend `/admin/messages` and `/messages`, with no new route;
6. wire the common sender helper into generic start, Field start, send, and access projection;
7. wire the common Media containment predicate into every current exact delivery boundary found at implementation freeze;
8. wire normal Media processing containment convergence;
9. add the scoped Safety scan job RPC family on existing jobs/outbox;
10. run focused Messages/Media regressions and complete `npm run build`;
11. replay on a fresh disposable Preview;
12. run permanent verifier, generated types, schema seal, and controlled concurrency/behavior acceptance;
13. open the runtime PR only after Preview acceptance;
14. merge only with protected Critical Control Plane green;
15. promote exact merged-main SQL through the Production runbook;
16. deploy frontend only from exact merged main using complete Production build output;
17. run authenticated Production acceptance;
18. record Candidate B Production closure before Candidate C.

## What Candidate B must not touch

- Candidate C Legal Request, preservation package, or disclosure production;
- Phase 8B.6 final closure;
- Community moderation storage for private Messages enforcement/appeals;
- canonical Message body mutability;
- Message edit/delete semantics;
- canonical Media bytes, SHA-256 ownership, or file identity;
- a second Media governance model;
- global account suspension as ordinary Messages enforcement;
- public Messages audience expansion;
- a new binary attachment product;
- a new generic queue, retry engine, dead-letter table, or outbox;
- a new Admin route;
- another Safety Case/target/event family;
- MIZIZI/System Actor send authority unless a later accepted case explicitly targets it.

## Design exit gate

Candidate B SQL may begin only when this document is accepted with these locked decisions:

```text
New peer tables: exactly 3
New generic queue: NO
New Safety event ledger: NO
New account suspension primitive: NO
New Message send path: NO
New attachment store/product: NO
Candidate A current_disposition extension: enforced
Enforcement subject: derived from exact targeted Message sender
Graduation authority: reviewed severity matrix
Severe bypass: direct permitted action with no lower history requirement
Cooldown/rate counters: canonical Message chronology
Concurrency control: sender-scoped transaction advisory lock
Appeal count: one per exact enforcement row
Appeal modification: narrow-only atomic replacement
User-safe reason: separate from internal reason
Media exact matching: canonical verified SHA-256 + byte size at execution time
SHA copied into Safety tables: NO
Media containment: exact-file peer state plus dynamic exact-hash fail-closed predicate
Asset-level public block authority: existing Media governance
Direct Media delivery convergence: REQUIRED
Normal Media processing containment escape: BLOCKED
Safety scan storage: existing jobs/outbox
Safety scan worker: exact-type scoped service-role lease APIs
Provider result: bounded signal only
Automatic provider punishment: NO
Admin surface: existing /admin/messages
User recovery surface: existing /messages
Production mutation before Preview: NO
```

## Design conclusion

Candidate B needs three missing peer states and no parallel platform.

Messages-scoped enforcement is bound to exact canonical human Message evidence. Appeals preserve exact recovery history without rewriting the original case outcome. Severe Media handling binds to canonical verified files, uses canonical SHA-256 only at execution time, blocks every current exact-file delivery path, and reuses existing Media governance and processing authority.

All asynchronous scan work stays on the existing job, lease, retry, dead-letter, and outbox substrate. Provider output remains evidence until a governed WAKILISHA decision acts on it.

That is the smallest complete Candidate B contract for #870.