# Phase 8B.5 Candidate C: Legal Preservation and Scoped Disclosure Schema and Command Design

**Status:** Design authority, documentation only  
**Date:** 9 September 2026  
**Accepted main at opening:** `014805bfc767094ba30cea38a5b52303c722b7af`  
**Parent issue:** #868  
**Candidate issue:** #871

## Purpose

This document locks the exact implementation boundary for Phase 8B.5 Candidate C before any Candidate C SQL, runtime, Edge Function, frontend, or Production mutation.

Candidate C adds Legal Request Case identity, case-bound preservation, exact scoped review, explicit disclosure approval, deterministic production generation, exact object hashes, exact manifest hashing, controlled release, and append-only Legal history without creating a broad private-data export path.

This design compounds the accepted Candidate C authority audit and the existing Messages, Media, Resource Version, command/job/outbox, and Super Admin authorities.

## Governing requirements

Candidate C must prove all of the following:

- Legal Request Case is separate from Safety Case;
- preservation is separate from disclosure;
- preserved material is classified as `responsive`, `elevated_review`, or `excluded` before production;
- software records human legal decisions but does not determine legal entitlement by itself;
- every production has an exact identity, exact scope statement, explicit approvals, exact ordered object manifest, per-object SHA-256, manifest SHA-256, and documented omissions;
- adjacent Conversations do not leak merely because one Conversation is in scope;
- a Message Resource reference does not silently widen scope into a protected Resource;
- canonical Message, Media, and Resource Version identity remains authoritative;
- private content does not auto-render because an operator is Super Admin;
- no generic legal export endpoint exists;
- no second scheduler, queue, retry ledger, dead-letter store, or transactional outbox is introduced;
- required mutations are idempotent and accountable;
- disclosure generation is retryable and resumable through accepted shared jobs;
- generated disclosure bytes are registered as canonical restricted Media rather than becoming Legal-owned binary storage.

## Runtime authority finding

The repository and accepted Production history establish one suitable asynchronous file-producing runtime pattern: repository-owned systemd workers on the Production Lightsail Media host using service-role RPC, filtered durable-job claims, leases, retries, dead-letter handling, local protected Media access, deterministic staging, exact byte hashing, and canonical Media registration.

The accepted Media processor is intentionally scoped to `media.process_revision` and its design explicitly says it polls only that job type. Candidate C must not turn the Media processor into a generic privileged worker.

Candidate C therefore reuses the accepted **worker/runtime pattern and host**, not the Media processor's domain responsibility.

Implementation authority is locked as:

```text
platform_private.jobs
    -> filtered service-role claim
    -> repository-owned Candidate C Legal disclosure worker
    -> deterministic package bytes
    -> exact SHA-256
    -> canonical restricted Media document
    -> service-role completion adapter
    -> existing command receipt + outbox completion
```

Implementation files will be:

```text
ops/legal-disclosure-worker/worker.py
ops/systemd/wakilisha-legal-disclosure-worker.service
```

The worker runs on the same accepted Production Lightsail operational substrate as the Media processor. It does not create another queue or scheduler.

Candidate C does **not** add an Edge Function to execute asynchronous generation.

A narrow extension of the existing `media-upload-api` Edge Function is permitted only for case-authorized signed private delivery of a generated Legal package because that Edge Function already owns the Media private-delivery HMAC bridge. That extension must use a Legal-specific server authorization RPC and must not reuse broad Media administrator delivery authority.

## Schema family

Candidate C stays inside the existing Messages authority boundary and uses the `messaging` schema.

Add exactly these six Legal tables:

```text
messaging.legal_request_cases
messaging.legal_preservation_scopes
messaging.legal_preserved_objects
messaging.legal_disclosure_packages
messaging.legal_disclosure_approvals
messaging.legal_disclosure_objects
messaging.legal_case_events
```

The list contains seven tables because approvals are promoted to explicit authority rather than being inferred from event history. The Candidate C authority audit described the first five semantic owners plus the event ledger; this design adds the narrow approval ledger because approval is a required production authority, can be revoked before generation, and must be independently queryable without reconstructing current authorization from event chronology.

No other generic Legal table family is authorized in Candidate C.

## `messaging.legal_request_cases`

### Ownership

Owns stable Legal Request Case identity and current case lifecycle only.

It does not own Message content, Media bytes, Resource content, Safety decisions, or disclosure object bytes.

### Columns

```text
id uuid primary key
request_reference text not null
request_kind text not null
status text not null
requesting_authority text not null
jurisdiction_or_process text not null
received_at timestamptz not null
scope_statement text not null
notice_restriction_state text not null
assigned_user_id uuid null
opened_by_user_id uuid not null
opened_at timestamptz not null
closed_by_user_id uuid null
closed_at timestamptz null
closure_note text null
revision bigint not null default 1
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

### Controlled values

`request_kind`:

```text
preservation
disclosure
emergency
other
```

These are broad intake classes only. They are not software legal-entitlement decisions.

`status`:

```text
open
under_review
closed
```

Preservation and disclosure progress stay on their own peer records rather than expanding case status into a second workflow engine.

`notice_restriction_state`:

```text
none
restricted
unknown
```

### Constraints

- `request_reference`, `requesting_authority`, `jurisdiction_or_process`, and `scope_statement` must be non-blank;
- `request_reference` maximum 240 UTF-8 bytes;
- `requesting_authority` maximum 500 UTF-8 bytes;
- `jurisdiction_or_process` maximum 500 UTF-8 bytes;
- `scope_statement` maximum 8 KB;
- `closure_note` maximum 8 KB;
- `revision >= 1`;
- open/under-review rows have no close actor/time;
- closed rows have `closed_by_user_id`, `closed_at`, and a non-blank closure note;
- `assigned_user_id`, actor columns, and human accountability use existing `auth.users` identity semantics;
- no request reference is treated as globally public or exposed through ordinary Messages reads.

Do not add a unique constraint on `request_reference` alone. Different requesting authorities may lawfully use the same external reference. Add a normalized uniqueness boundary on `(lower(requesting_authority), lower(request_reference))` if and only if implementation replay proves the normalization is safe; otherwise rely on idempotent case-open command identity.

### Indexes

At minimum:

```text
(status, received_at desc)
(assigned_user_id, status, received_at desc) where assigned_user_id is not null
(lower(requesting_authority), lower(request_reference))
```

## `messaging.legal_preservation_scopes`

### Ownership

Owns one explicit finite preservation boundary requested under one Legal Request Case.

A scope is not itself a disclosure manifest entry. It must materialize to exact canonical object identities before review or production.

### Columns

```text
id uuid primary key
legal_request_case_id uuid not null
scope_kind text not null
status text not null default 'active'
message_id uuid null
conversation_id uuid null
accepted_from timestamptz null
accepted_until timestamptz null
media_file_object_id uuid null
resource_version_id uuid null
scope_note text null
created_by_user_id uuid not null
created_at timestamptz not null default now()
released_by_user_id uuid null
released_at timestamptz null
release_reason text null
revision bigint not null default 1
```

### Scope kinds

Exactly:

```text
exact_message
conversation_window
exact_media_file
exact_resource_version
```

### Shape constraints

`exact_message`:

```text
message_id != null
all other target columns = null
```

`conversation_window`:

```text
conversation_id != null
accepted_from != null
accepted_until != null
accepted_from < accepted_until
all exact-object target columns = null
```

Conversation windows use the half-open boundary:

```text
message.accepted_at >= accepted_from
and message.accepted_at < accepted_until
```

This eliminates ambiguous inclusive end timestamps and makes repeated materialization deterministic.

`exact_media_file`:

```text
media_file_object_id != null
all other target columns = null
```

`exact_resource_version`:

```text
resource_version_id != null
all other target columns = null
```

### Lifecycle

`status`:

```text
active
released
```

No browser or runtime role may delete a scope row.

Releasing scope ends that scope's active Legal preservation authority. It does not delete canonical objects and does not automatically release a preserved object that remains held by another active Legal Request Case.

Identity columns are immutable after insertion. Only release state and revision may move through the governed release command.

## `messaging.legal_preserved_objects`

### Ownership

Owns the exact object set materially held by a Legal Request Case and the current human response classification for each held object.

It references canonical objects. It does not copy their payloads.

### Columns

```text
id uuid primary key
legal_request_case_id uuid not null
materialized_from_scope_id uuid not null
object_kind text not null
message_id uuid null
media_file_object_id uuid null
resource_version_id uuid null
preservation_status text not null default 'held'
response_classification text not null default 'unclassified'
classification_reason text null
preserved_by_user_id uuid not null
preserved_at timestamptz not null default now()
classified_by_user_id uuid null
classified_at timestamptz null
released_by_user_id uuid null
released_at timestamptz null
release_reason text null
revision bigint not null default 1
```

### Object kinds

Exactly:

```text
message
media_file
resource_version
```

Exactly one canonical target column is non-null and must correspond to `object_kind`.

### Preservation status

```text
held
released
```

### Response classification

```text
unclassified
responsive
elevated_review
excluded
```

The required final legal review vocabulary remains exactly:

```text
responsive
elevated_review
excluded
```

`unclassified` is only the pre-review state. A package cannot select an unclassified object.

`classification_reason` is required for every non-`unclassified` classification and is bounded to 8 KB.

### Identity and uniqueness

Within one Legal Request Case, one canonical object must have at most one preserved-object identity even if multiple active scopes happen to reach it.

Use partial unique indexes:

```text
(legal_request_case_id, message_id) where message_id is not null
(legal_request_case_id, media_file_object_id) where media_file_object_id is not null
(legal_request_case_id, resource_version_id) where resource_version_id is not null
```

Repeated materialization reuses the existing preserved-object row. It may append a narrow event indicating that an additional scope also reached the object, but it must not create a duplicate preserved identity.

### Release semantics

Releasing one preserved object ends this case's hold on that exact object only.

The release command must refuse release when:

- an active package selection for the same case still references the object;
- an active scope in this case still requires the object unless the operator explicitly releases that scope first;
- another accepted future retention authority forbids release.

Releasing a Legal hold never deletes or mutates the canonical Message, Media file, or Resource Version.

## `messaging.legal_disclosure_packages`

### Ownership

Owns one explicit production identity, its exact selection fingerprint, frozen manifest, generated artifact identity, release state, and documented omissions.

A generated package is never regenerated in place. Corrections require a new production identity.

### Columns

```text
id uuid primary key
legal_request_case_id uuid not null
production_reference text not null
status text not null default 'draft'
scope_statement text not null
documented_omissions text[] not null default '{}'
selection_fingerprint text not null
manifest_version text not null default 'wk-legal-disclosure-manifest-v1'
archive_version text not null default 'wk-legal-disclosure-zip-v1'
requested_by_user_id uuid not null
requested_at timestamptz not null default now()
generation_job_id uuid null
generated_at timestamptz null
manifest_text text null
manifest_sha256 text null
package_asset_id uuid null
package_asset_revision_id uuid null
package_file_object_id uuid null
package_sha256 text null
package_byte_size bigint null
released_by_user_id uuid null
released_at timestamptz null
voided_by_user_id uuid null
voided_at timestamptz null
void_reason text null
failure_summary text null
revision bigint not null default 1
```

### Status

Exactly:

```text
draft
approved
queued
generating
generated
released
failed
voided
```

### Constraints

- `production_reference`, `scope_statement`, and `selection_fingerprint` are non-blank;
- `selection_fingerprint` is exactly 64 lowercase hex characters;
- `manifest_sha256` and `package_sha256`, when set, are exactly 64 lowercase hex characters;
- `package_byte_size`, when set, is non-negative;
- `documented_omissions` contains only non-blank entries, each no larger than 4 KB;
- `manifest_text` is null before generation and non-null only when the package has been generated or released;
- generated/released rows have all manifest and canonical package Media identity fields;
- released rows have release actor/time;
- voided rows have void actor/time/reason;
- the package cannot transition from generated/released back to a mutable draft;
- `production_reference` is unique per Legal Request Case;
- `generation_job_id` references the existing shared job authority, not a Legal queue.

### Selection fingerprint

The selection fingerprint binds approval to the exact intended package before expensive generation.

It is SHA-256 over deterministic UTF-8 JSON containing only:

```json
{
  "schema":"wk-legal-disclosure-selection-v1",
  "legal_request_case_id":"<uuid>",
  "legal_disclosure_package_id":"<uuid>",
  "scope_statement":"<exact string>",
  "documented_omissions":["..."],
  "objects":[
    {
      "manifest_order":1,
      "legal_preserved_object_id":"<uuid>",
      "object_kind":"message|media_file|resource_version",
      "response_classification":"responsive|elevated_review"
    }
  ]
}
```

Object order is ascending `manifest_order`.

The deterministic JSON serialization contract is defined later in this document.

Any change to selection, scope statement, documented omission, object order, or selected object's classification requires a new package selection fingerprint and invalidates prior package-level approval.

## `messaging.legal_disclosure_approvals`

### Ownership

Owns explicit, revocable human approval authority for one package selection.

Approval is not inferred from Super Admin role membership and is not inferred from case status.

### Columns

```text
id uuid primary key
legal_disclosure_package_id uuid not null
legal_preserved_object_id uuid null
approval_scope text not null
status text not null default 'active'
selection_fingerprint text not null
approval_reason text not null
approved_by_user_id uuid not null
approved_at timestamptz not null default now()
revoked_by_user_id uuid null
revoked_at timestamptz null
revocation_reason text null
revision bigint not null default 1
```

### Approval scopes

Exactly:

```text
package
elevated_object
```

`package` approval requires `legal_preserved_object_id is null`.

`elevated_object` approval requires a preserved object belonging to the same case/package and currently classified `elevated_review`.

### Lifecycle

`status`:

```text
active
revoked
```

At most one active package approval exists per package.

At most one active elevated-object approval exists per `(package, preserved_object)`.

Every approval records the exact package `selection_fingerprint` it approved.

Changing package selection makes existing approvals stale automatically because the fingerprint no longer matches, even before explicit revocation.

Generation requires:

- one active package approval with exact fingerprint match;
- one active exact-fingerprint elevated-object approval for every selected `elevated_review` object;
- no selected `excluded` or `unclassified` object.

## `messaging.legal_disclosure_objects`

### Ownership

Owns the exact ordered package selection and, after generation, the immutable manifest object entries.

### Columns

```text
id uuid primary key
legal_disclosure_package_id uuid not null
legal_preserved_object_id uuid not null
manifest_order integer not null
object_kind text not null
response_classification text not null
source_object_id uuid not null
source_fingerprint text null
output_path text null
output_mime_type text null
object_sha256 text null
object_byte_size bigint null
created_at timestamptz not null default now()
finalized_at timestamptz null
```

### Selection phase

Before generation, immutable identity fields are:

```text
legal_disclosure_package_id
legal_preserved_object_id
manifest_order
object_kind
response_classification
source_object_id
source_fingerprint
```

The operator never supplies `source_object_id` or source fingerprint as arbitrary text. The server resolves them from the canonical preserved object.

`manifest_order` is unique per package and starts at 1 with no gaps after package preparation.

The same preserved object may appear only once per package.

### Generation phase

Only the service-role Legal generation completion adapter may set:

```text
output_path
output_mime_type
object_sha256
object_byte_size
finalized_at
```

It may not change package identity, preserved-object identity, order, object kind, source identity, classification, or source fingerprint.

After `finalized_at` is set, the entire row is immutable.

Object SHA-256 is always the hash of exact emitted object bytes, never merely a database-row fingerprint.

## `messaging.legal_case_events`

### Ownership

Append-only canonical Legal history.

### Columns

```text
id uuid primary key
legal_request_case_id uuid not null
legal_disclosure_package_id uuid null
legal_preserved_object_id uuid null
event_kind text not null
actor_kind text not null
actor_user_id uuid null
actor_person_resource_id uuid null
actor_key text null
command_receipt_id uuid null
occurred_at timestamptz not null default now()
metadata jsonb not null default '{}'
```

### Event kinds

Exactly:

```text
request_opened
review_started
scope_added
scope_released
preservation_applied
preservation_released
classification_changed
evidence_viewed
disclosure_prepared
approval_recorded
approval_revoked
disclosure_queued
disclosure_generation_started
disclosure_generated
disclosure_failed
disclosure_released
disclosure_voided
case_closed
```

No update or delete is permitted after insert.

`metadata` is bounded to 16 KB and must never contain raw Message body, raw Media bytes, a broad private object dump, service secrets, or a signed private-delivery URL.

## Foreign-key boundaries

Candidate C uses exact foreign keys to accepted authority:

```text
message_id -> messaging.messages(id)
conversation_id -> messaging.conversations(id)
media_file_object_id -> media.file_objects(id)
resource_version_id -> editorial.resource_versions(id)
package_asset_id -> media.assets(id)
package_asset_revision_id -> media.asset_revisions(id)
package_file_object_id -> media.file_objects(id)
command_receipt_id -> platform_private.command_receipts(id)
generation_job_id -> platform_private.jobs(id)
```

Use `on update restrict` throughout.

Canonical object identity and Legal history must not disappear through cascades. Use `on delete restrict` for Legal case, scope, preserved object, package, approval, disclosure-object, Message, Media, Resource Version, command receipt, and job references wherever accepted account-retirement behavior does not require a historical human UUID snapshot.

For human user identity, follow accepted project semantics where account retirement may require `on delete set null` while preserving the historical event actor's Person Resource identity or textual actor key.

## RLS and direct grants

Enable RLS on every Candidate C table.

Revoke direct table privileges from:

```text
public
anon
authenticated
service_role
```

Browser and worker access occurs only through narrow security-definer RPCs.

Candidate C must preserve the established rule that the service role is an execution credential, not an ambient legal-decision principal.

The service worker may complete only a job actively leased to its worker id and may only read the package source descriptors bound to that job.

## Capabilities

Add exactly these capabilities:

```text
view_messages_legal_cases
inspect_messages_legal_evidence
manage_messages_legal_cases
approve_messages_legal_disclosure
```

Initial assignment is only to `super_admin`.

Do not inherit these capabilities into Administrator, Editor, Reviewer, Contributor, Moderator, or other ordinary roles.

`manage_messages_control_center` remains the outer Super Admin Messages gate. Candidate C RPCs additionally require the narrow Legal capability appropriate to the action.

## Human authorization helper

Reuse:

```text
messaging.current_messages_super_admin()
public.current_user_has_capability(...)
```

Do not invent another role system.

Each Legal RPC must first resolve the current authenticated human through established Messages identity and Super Admin authority, then check the narrow Legal capability.

## Command resource identity

`platform_private.begin_authenticated_resource_command(...)` requires an existing `editorial.resources` id.

Candidate C follows Candidate A/B and uses the acting Super Admin's canonical `person_resource_id` as command `resource_id` for Legal operator commands.

A Legal Request Case does not become an Editorial Resource merely to satisfy orchestration identity.

## Command types

Register these command types in `platform_private.command_types`.

### Synchronous commands

```text
messages.legal.case.open
messages.legal.review.start
messages.legal.scope.update
messages.legal.preservation.materialize
messages.legal.preservation.release
messages.legal.classification.update
messages.legal.evidence.inspect
messages.legal.disclosure.prepare
messages.legal.disclosure.approval.update
messages.legal.disclosure.release
messages.legal.disclosure.void
messages.legal.case.close
```

Each uses job type:

```text
<command_type>.sync
```

and exact accepted/succeeded/failed/retry event names following the established command naming convention.

Synchronous commands complete their command receipt transactionally in the RPC and do not create a durable job.

### Asynchronous generation command

```text
command_type: messages.legal.disclosure.generate
job_type:     messages.legal.disclosure.generate
```

Events:

```text
messages.legal.disclosure.generate.accepted
messages.legal.disclosure.generate.succeeded
messages.legal.disclosure.generate.failed
messages.legal.disclosure.generate.retry_scheduled
```

The generation command creates exactly one shared durable job for the exact package and selection fingerprint.

## Public RPC surface

All browser mutation RPCs are authenticated and Super Admin Legal-capability guarded.

Exact implementation names:

```text
public.open_messages_legal_request_case_v1(...)
public.start_messages_legal_review_v1(...)
public.update_messages_legal_scope_v1(...)
public.materialize_messages_legal_preservation_v1(...)
public.release_messages_legal_preservation_v1(...)
public.classify_messages_legal_object_v1(...)
public.inspect_message_legal_evidence_v1(...)
public.prepare_messages_legal_disclosure_v1(...)
public.update_messages_legal_disclosure_approval_v1(...)
public.submit_messages_legal_disclosure_generation_v1(...)
public.release_messages_legal_disclosure_v1(...)
public.void_messages_legal_disclosure_v1(...)
public.close_messages_legal_request_case_v1(...)
```

Each mutating RPC accepts:

- exact target ids;
- expected revision where current-state mutation occurs;
- `p_idempotency_key text`;
- optional `p_correlation_id uuid`;
- bounded reason/purpose text where a human basis is required.

No RPC accepts arbitrary SQL, a table name, a column name, an unrestricted selector JSON object, or a free-form query expression.

## Read RPC surface

Safe metadata reads:

```text
public.list_messages_legal_cases_v1(...)
public.get_messages_legal_case_v1(p_case_id uuid)
public.list_messages_legal_preserved_objects_v1(p_case_id uuid,...)
public.get_messages_legal_disclosure_package_v1(p_package_id uuid)
```

These reads must not return raw Message body, signed Media URL, raw Media bytes, or unrelated Resource payload.

## Deliberate evidence inspection

Exact private Message evidence inspection uses:

```text
public.inspect_message_legal_evidence_v1(
  p_case_id uuid,
  p_preserved_object_id uuid,
  p_purpose text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
```

It must:

1. require `inspect_messages_legal_evidence`;
2. require a non-blank bounded human purpose;
3. require the preserved object belongs to the exact case and remains held;
4. create/replay the standard command receipt for `messages.legal.evidence.inspect`;
5. append exactly one immutable `evidence_viewed` event on first execution;
6. return only the exact target evidence;
7. never return adjacent Conversation history;
8. never auto-expand a Message Resource reference;
9. never duplicate the audit event on idempotent replay.

For a Message target, exact evidence may include the canonical Message fields required by Legal review.

For Media and Resource Version targets, the ordinary case detail remains metadata-only. Protected byte delivery or typed Resource payload exposure requires its own exact case-bound path and audit event.

## Scope materialization

`public.materialize_messages_legal_preservation_v1(...)` is the only browser command that expands a scope into exact Legal preserved-object identities.

### `exact_message`

Materializes one `messaging.messages.id` only.

It does not materialize:

- other Messages in the Conversation;
- Message sender history;
- Message Resource references;
- Media reachable through other domain relationships.

### `conversation_window`

Materializes exactly the Messages whose:

```text
conversation_id = scope.conversation_id
accepted_at >= scope.accepted_from
accepted_at < scope.accepted_until
```

It does not materialize participants as disclosure objects and does not expand to adjacent Conversations.

Materialization order is not package order. It only creates held exact objects.

### `exact_media_file`

Materializes one canonical `media.file_objects.id`.

The source may be held regardless of storage provider when canonical identity exists. Production generation has a narrower v1 byte-emission boundary described below.

### `exact_resource_version`

Materializes one canonical `editorial.resource_versions.id`.

The moving parent Resource is not substituted for the exact version.

## Preservation versus disclosure

Applying a hold never creates a package.

The required sequence is:

```text
case opened
-> review started
-> finite scope added
-> exact objects materialized and held
-> object-by-object classification
-> deliberate evidence review where required
-> exact package selection prepared
-> elevated-object approvals recorded where required
-> package approval recorded
-> generation queued
-> exact bytes generated
-> package integrity verified
-> controlled release
```

No skipped path is accepted.

## Classification command

`public.classify_messages_legal_object_v1(...)` requires:

- exact case id;
- exact preserved object id;
- expected preserved-object revision;
- target classification `responsive`, `elevated_review`, or `excluded`;
- non-blank classification reason;
- idempotency key.

A classification change after a package has been prepared does not mutate the package selection silently.

Any prepared package whose selection fingerprint no longer matches current selected-object classification becomes ineligible for approval or generation. The operator creates a corrected new package selection or explicitly voids the stale package.

## Disclosure preparation

`public.prepare_messages_legal_disclosure_v1(...)` creates one draft package and exact ordered selection rows.

Input includes:

```text
case_id
production_reference
scope_statement
documented_omissions[]
ordered preserved_object_ids[]
idempotency_key
correlation_id
```

The server validates every selected id.

Rules:

- every object belongs to the exact case;
- every object remains held;
- no selected object is `unclassified`;
- no selected object is `excluded`;
- `responsive` is eligible for ordinary package approval;
- `elevated_review` is eligible only if an exact elevated-object approval is later recorded;
- duplicates are rejected;
- order is preserved exactly;
- source identity and source fingerprint come from canonical authority, not the browser;
- the server computes the selection fingerprint;
- package starts `draft`;
- no raw object bytes are generated in this command.

## Approval command

`public.update_messages_legal_disclosure_approval_v1(...)` supports only:

```text
record package approval
record elevated-object approval
revoke package approval
revoke elevated-object approval
```

Every approval requires:

- `approve_messages_legal_disclosure`;
- exact package id;
- exact current selection fingerprint;
- non-blank human reason;
- idempotency key.

Recording package approval transitions package `draft -> approved` only when package selection remains valid.

Revoking package approval before generation transitions `approved -> draft` if no generation is queued.

Once generation starts, approval cannot be silently revoked to rewrite an in-flight package. The operator must allow the job to fail/finish and then void the package, or use a specifically verified cancellation path if one is added during implementation without mutating generated history.

## Generation submission

`public.submit_messages_legal_disclosure_generation_v1(...)` requires:

- package status `approved`;
- active package approval matching selection fingerprint;
- active matching elevated-object approval for every selected `elevated_review` object;
- no selected object released, excluded, or reclassified since preparation;
- no stale selection fingerprint;
- exact command idempotency.

It creates one `platform_private.jobs` row:

```text
command_type = messages.legal.disclosure.generate
job_type = messages.legal.disclosure.generate
job_key = primary
max_attempts = 4
```

`input_payload` contains only bounded identifiers and immutable selection fingerprint:

```json
{
  "legal_request_case_id":"<uuid>",
  "legal_disclosure_package_id":"<uuid>",
  "selection_fingerprint":"<sha256>",
  "correlation_id":"<uuid>"
}
```

Do not put Message bodies, Media storage secrets, signed URLs, or Resource payloads into the shared job row.

Package status becomes `queued`, and `generation_job_id` records the shared job identity.

## Legal disclosure worker

### Runtime

Add repository-owned:

```text
ops/legal-disclosure-worker/worker.py
ops/systemd/wakilisha-legal-disclosure-worker.service
```

The worker:

- runs as `www-data`;
- uses the existing Supabase URL and service-role credential from a root-owned environment file;
- has no direct Postgres password;
- claims only `messages.legal.disclosure.generate` jobs;
- uses a stable worker id such as `legal-disclosure:<hostname>`;
- processes one package at a time;
- uses shared leases, retry, dead-letter, and outbox authority;
- reads only source descriptors authorized by the active leased package job;
- reads protected local Lightsail Media bytes only when the exact preserved object and selected package authorize those bytes;
- writes temporary package content only under a private Candidate C staging root;
- writes final archive bytes only under the dedicated protected Legal disclosure Media tree;
- fsyncs generated content before immutable activation;
- calculates exact SHA-256 and byte size before canonical registration;
- never edits a generated package in place;
- never modifies canonical source bytes;
- never calls the generic unfiltered `platform_private.claim_jobs()` function.

### Systemd boundary

Use the accepted worker hardening pattern:

```text
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
Restart=always
one worker process
bounded memory
bounded CPU
UMask=0027
root-owned mode-0600 environment file
```

Candidate C staging root:

```text
/opt/wakilisha-legal-disclosure-processing
```

Protected final package root:

```text
/opt/wakilisha-media/private-files/legal-disclosures
```

The service receives write authority only for those two roots. Existing protected Media source trees are read-only to the worker.

## Worker RPC surface

Service-role only:

```text
public.claim_messages_legal_disclosure_jobs_v1(
  p_worker_id text,
  p_limit integer default 1,
  p_lease_seconds integer default 900
)

public.renew_messages_legal_disclosure_lease_v1(
  p_job_id uuid,
  p_worker_id text,
  p_lease_seconds integer default 900
)

public.get_messages_legal_disclosure_source_v1(
  p_job_id uuid,
  p_worker_id text,
  p_legal_disclosure_object_id uuid
)

public.complete_messages_legal_disclosure_job_v1(
  p_job_id uuid,
  p_worker_id text,
  p_result jsonb
)

public.fail_messages_legal_disclosure_job_v1(
  p_job_id uuid,
  p_worker_id text,
  p_error text,
  p_retryable boolean default true,
  p_retry_delay_seconds integer default 60
)

public.recover_expired_messages_legal_disclosure_jobs_v1(...)
```

Every worker RPC verifies service role and exact active lease ownership.

The source RPC additionally proves:

- job belongs to the package;
- package still has the same selection fingerprint;
- disclosure object belongs to that package;
- preserved object belongs to the same Legal Request Case;
- source object still exists;
- source object remains held;
- classification still permits selection;
- required approvals remain bound to the exact selection.

The worker cannot ask the source RPC for an arbitrary Message, Media file, or Resource Version id.

## Worker source descriptors

### Message source

The source RPC returns only exact fields for the selected Message and exact separately authorized Resource references.

Candidate C Message disclosure representation v1 is canonical JSON with:

```json
{
  "schema":"wk-legal-message-v1",
  "message_id":"<uuid>",
  "conversation_id":"<uuid>",
  "sender_participant_id":"<uuid>",
  "message_kind":"<text>",
  "body":"<exact body>",
  "accepted_at":"<UTC RFC3339>",
  "client_created_at":"<UTC RFC3339|null>",
  "correlation_id":"<uuid|null>",
  "command_receipt_id":"<uuid|null>",
  "resource_references":[...]
}
```

Resource references are included only when:

- the Message reference has an exact non-null `resource_version_id`;
- that exact Resource Version is separately held by the same case;
- that preserved Resource Version is separately selected in the same package;
- its classification permits inclusion.

A moving Resource-only reference with no exact version is not embedded into the disclosure representation. If materially relevant, it must be separately scoped and resolved through a future accepted exact-version path. The omission belongs in `documented_omissions` where appropriate.

No adjacent Message appears in this representation.

### Media source

Candidate C v1 may preserve any canonical Media file identity, but exact-byte production is permitted only when all of these hold:

- `verification_state = 'verified'`;
- `sha256` is a valid 64-character lowercase checksum;
- `byte_size` is non-null;
- storage provider is the accepted local protected `lightsail_media` authority;
- storage path is under an accepted protected root;
- the exact local file's byte size and SHA-256 match canonical Media authority immediately before packaging.

If a selected preserved Media file uses another provider, generation must not silently fetch or widen network authority. It fails the object/package with an explicit unsupported-source-provider reason unless the object is removed from a new package and recorded as a documented omission.

This is a deliberate Candidate C v1 runtime boundary, not a claim that other canonical Media cannot be legally preserved.

The emitted object bytes are exactly the canonical Media bytes. Therefore:

```text
object_sha256 = media.file_objects.sha256
object_byte_size = media.file_objects.byte_size
```

Any mismatch is terminal integrity failure.

### Resource Version source

The source RPC returns the exact shared immutable Resource Version identity and a versioned, allowlisted typed snapshot descriptor where Candidate C has an explicit adapter.

The shared identity fields are:

```json
{
  "id":"<uuid>",
  "resource_id":"<uuid>",
  "resource_kind":"<text>",
  "version_type":"<text>",
  "version_kind":"<text>",
  "version_number":1,
  "content_fingerprint":"<64 hex>",
  "registered_at":"<UTC RFC3339>"
}
```

Candidate C must not perform a generic `select * from arbitrary_table` operation based on Resource kind.

Each typed Resource disclosure adapter must be explicitly coded, field-allowlisted, deterministic, and separately testable.

An exact Resource Version whose typed payload adapter is unsupported remains preservable but cannot be silently represented as full domain content. Package generation either emits the explicitly documented shared identity representation or the operator records a documented omission, according to the package's accepted scope statement.

The implementation and acceptance verifier must state which typed Resource kinds are supported in Candidate C v1 rather than implying universal domain export.

## Deterministic JSON serialization

Candidate C uses one serialization contract for selection fingerprints, Message objects, Resource Version JSON objects, and `manifest.json`.

Version:

```text
wk-legal-json-v1
```

Rules:

1. UTF-8, no BOM;
2. object keys sorted lexicographically by Unicode code point;
3. array order preserved exactly;
4. separators are `,` and `:` with no insignificant whitespace;
5. strings use JSON escaping;
6. timestamps are UTC RFC3339 strings with `Z`;
7. integers remain base-10 JSON integers;
8. no floats are permitted in Candidate C canonical structures;
9. no trailing newline;
10. SHA-256 is calculated over these exact UTF-8 bytes.

The Python worker implementation must use a single helper for this contract, not multiple ad hoc `json.dumps` call sites.

## Object output paths

Archive object filenames never use user-supplied names.

Use deterministic package-internal paths:

```text
objects/000001-message-<preserved-object-uuid>.json
objects/000002-media-file-<preserved-object-uuid>.bin
objects/000003-resource-version-<preserved-object-uuid>.json
```

`original_filename`, MIME type, canonical object id, and source identity live in the manifest, not in an untrusted archive path.

## Manifest contract

`manifest.json` uses canonical JSON `wk-legal-json-v1`.

Top-level shape:

```json
{
  "schema":"wk-legal-disclosure-manifest-v1",
  "production_id":"<package uuid>",
  "production_reference":"<text>",
  "legal_request_case_id":"<uuid>",
  "generated_at":"<UTC RFC3339>",
  "scope_statement":"<exact approved string>",
  "documented_omissions":["..."],
  "approvals":[
    {
      "approval_id":"<uuid>",
      "approval_scope":"package|elevated_object",
      "legal_preserved_object_id":"<uuid|null>",
      "approved_by_user_id":"<uuid>",
      "approved_at":"<UTC RFC3339>",
      "selection_fingerprint":"<sha256>"
    }
  ],
  "objects":[
    {
      "manifest_order":1,
      "legal_disclosure_object_id":"<uuid>",
      "legal_preserved_object_id":"<uuid>",
      "object_kind":"message|media_file|resource_version",
      "source_object_id":"<uuid>",
      "source_fingerprint":"<text|null>",
      "response_classification":"responsive|elevated_review",
      "output_path":"objects/...",
      "output_mime_type":"application/json|...",
      "object_sha256":"<sha256>",
      "object_byte_size":123
    }
  ]
}
```

Approval array order is deterministic:

1. package approval;
2. elevated-object approvals in ascending selected object `manifest_order`.

Object array order is ascending `manifest_order`.

`manifest_sha256` is SHA-256 of exact canonical `manifest.json` bytes.

The manifest does not include the final ZIP hash because doing so would be circular. The package record and canonical Media file object preserve the final archive SHA-256 and byte size separately.

## Deterministic archive contract

Archive version:

```text
wk-legal-disclosure-zip-v1
```

Format: ZIP with stored entries, no compression.

Determinism rules:

- write object entries in ascending manifest order;
- write `manifest.json` last;
- every ZIP entry timestamp fixed to `1980-01-01T00:00:00` as required by ZIP format;
- no platform-specific UID/GID metadata;
- fixed file mode metadata;
- no extra fields;
- no archive comment;
- `ZIP_STORED` only;
- deterministic internal paths from the contract above;
- fsync complete archive before hashing and immutable activation.

The package worker calculates:

```text
package_sha256
package_byte_size
```

over the exact completed ZIP bytes.

The same exact source state and archive-version implementation must reproduce the same bytes. A different archive version requires a new production identity, not silent replacement.

## Canonical Media registration for generated package

Add Media asset purpose:

```text
legal_disclosure
```

using existing `media.asset_purposes` controlled vocabulary.

Reuse existing enabled Media asset kind:

```text
document
```

The completion adapter creates one restricted canonical Media document asset/revision for the generated package and registers the exact verified archive file object.

Legal owns production identity and disclosure approval. Media owns generated bytes.

Package Media governance must remain non-public and at least `restricted` source protection. It must never become public merely because a Media administrator can normally manage assets.

Protected storage path:

```text
private-files/legal-disclosures/<case-uuid>/<package-uuid>/production.zip
```

The worker must never overwrite an existing immutable path.

If the path exists:

- exact byte size and SHA-256 match: reuse only through verified idempotent completion;
- mismatch: terminal immutable-path collision.

## Completion adapter

`public.complete_messages_legal_disclosure_job_v1(...)` is the only service-role adapter that converts successful worker output into canonical package authority.

It must:

1. verify active leased job and worker id;
2. verify package/job/selection fingerprint identity;
3. verify all disclosure-object rows are selected and still authorized;
4. verify every returned object hash/size/output path against bounded result shape;
5. verify manifest canonical serialization and SHA-256;
6. verify final archive path is the deterministic Candidate C path;
7. register or idempotently resolve exact canonical Media file identity;
8. create or idempotently resolve the restricted `document` + `legal_disclosure` Media asset/revision;
9. freeze manifest text and manifest SHA-256 on package;
10. freeze package Media ids, SHA-256, and byte size;
11. finalize disclosure-object rows without changing selection identity;
12. set package `generated` and `generated_at`;
13. append `disclosure_generated` Legal event;
14. complete the existing shared job and command receipt through shared authority;
15. emit the registered command success outbox event.

It does not accept arbitrary Media paths or arbitrary canonical object ids from the worker. All identities must resolve from the leased package and deterministic path contract.

## Failure and retry

`public.fail_messages_legal_disclosure_job_v1(...)` delegates retry and terminal state to existing `platform_private.fail_job(...)` authority.

Retryable examples:

- transient Supabase RPC/network failure;
- temporary filesystem pressure;
- worker interruption;
- expired worker lease;
- temporary read failure for an otherwise valid protected local file.

Terminal examples:

- package approval/fingerprint no longer valid;
- selected object no longer held;
- canonical source object missing;
- Media source checksum or byte size mismatch;
- unsupported Media storage provider in Candidate C v1;
- unsupported required typed Resource adapter where omission is not allowed by package scope;
- deterministic output path collision with different bytes;
- malformed source descriptor;
- manifest/hash mismatch;
- exhausted maximum attempts.

A failed generation does not mutate source objects and does not release preservation holds.

Package status becomes `failed` on terminal job failure, with a bounded `failure_summary` and append-only `disclosure_failed` event.

A new attempt after terminal correction requires a new package identity unless the failure was purely operational and the exact immutable package selection remains unchanged under an explicitly verified recovery path.

## Expired lease recovery

Candidate C must implement a filtered expired-lease recovery RPC for `messages.legal.disclosure.generate` only.

It must never steal an unexpired lease and must preserve existing attempt counts and shared retry/dead-letter semantics.

Do not call a generic recovery helper that can alter unrelated jobs without job-type filtering.

## Controlled package release

Generation is not release.

`public.release_messages_legal_disclosure_v1(...)` requires:

- package status `generated`;
- exact current package revision;
- `approve_messages_legal_disclosure`;
- active package approval matching the generated selection fingerprint;
- generated manifest hash and package canonical Media identity;
- non-blank release basis/reason;
- idempotency key.

It transitions:

```text
generated -> released
```

and appends `disclosure_released`.

Release does not make the Media asset public.

## Signed private delivery of released package

The existing `media-upload-api` already owns the private Media HMAC bridge. Candidate C may extend it with one Legal-specific operation for generated/released package delivery.

The new operation must call a Legal authorization RPC such as:

```text
public.get_messages_legal_disclosure_delivery_target_v1(
  p_package_id uuid,
  p_purpose text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
```

That RPC must:

- require authenticated Super Admin;
- require `inspect_messages_legal_evidence` or the narrower accepted Legal release capability decided in implementation without broadening ordinary Media capability;
- require package status `released`;
- resolve only that package's canonical `package_file_object_id`;
- require the deterministic Legal protected storage prefix;
- append an immutable Legal delivery/evidence audit event before returning the target descriptor;
- never return another Media file through caller-supplied file id;
- never allow generic `manage_media_assets` alone to retrieve a Legal package.

The Edge Function reuses its existing HMAC implementation and short TTL. The signed URL itself is never stored in Legal event metadata.

The existing generic Media private-delivery authorization must not be widened to make Legal packages ambiently downloadable by ordinary Media administrators.

## Package voiding

`public.void_messages_legal_disclosure_v1(...)` records that a package must not be released or relied on.

Allowed from:

```text
draft
approved
failed
generated
```

A released package cannot be erased. If later invalidated, append a void/supersession record under an explicit follow-up authority rather than rewriting history. Candidate C v1 may refuse voiding `released` packages and require a new corrective package.

Voiding never deletes canonical generated Media bytes, disclosure object rows, manifest, approvals, or events.

## Case closure

`public.close_messages_legal_request_case_v1(...)` requires:

- case under review;
- no package currently queued/generating;
- explicit closure note;
- expected case revision;
- idempotency key.

Case closure does not silently release Legal holds.

If holds remain active, closure must either be refused or require the operator to resolve them first. Candidate C chooses the safer rule: **refuse closure while any preserved object remains `held`**.

## No automatic legal entitlement

No function may compute or return a canonical value such as:

```text
request_is_valid = true
legally_required = true
disclosure_required = true
```

from jurisdiction, request kind, requesting authority, emergency flag, report count, or other machine inputs.

Software validates identity, scope, authorization, completeness, hashes, and workflow invariants. Human/legal policy authority records the actual decision basis through classification and approval commands.

## Frontend boundary

Extend existing `/admin/messages` with a `Legal` operating section.

Do not create `/admin/legal`.

The Legal surface provides:

- safe Legal Request Case queue;
- case metadata and lifecycle;
- preservation scopes;
- exact preserved-object list;
- classification controls;
- deliberate evidence inspection;
- disclosure package preparation;
- elevated-object approvals;
- package approval;
- generation job state;
- manifest integrity summary;
- generated package release;
- controlled package delivery;
- append-only event history.

Private Message body, restricted Media, and Resource payload do not auto-render in the case queue or detail.

The UI must use WAKILISHA custom controls and existing Admin interaction primitives rather than native browser prompt/confirm UX.

No ordinary `/messages` user surface changes are required for Candidate C.

## Ordinary Messages privacy boundary

Candidate C adds no Legal metadata to ordinary participant Messages projections.

Participants do not receive:

- request reference;
- requesting authority;
- case status;
- preservation status;
- response classification;
- Legal reviewer identity;
- package status;
- approval state;
- manifest hash;
- package URL.

Any future notice-to-user product is a separate policy/product decision and is not implied by Candidate C.

## Immutability guards

Add explicit no-delete guards for all Candidate C tables.

Append-only:

```text
legal_case_events
```

Immutable after finalization:

```text
legal_disclosure_objects
legal_disclosure_packages generated identity fields
```

Scope target identity and preserved-object canonical target identity are immutable from insertion.

Generated manifest, manifest hash, package Media identity, package hash, and byte size cannot be modified once package status reaches `generated`.

## Optimistic concurrency

Current-state mutation tables use `revision bigint`.

Every governed browser mutation checks exact expected revision and increments revision by one on success.

Idempotent replay returns the existing successful result and does not increment revision again.

A stale revision returns a deterministic concurrency failure rather than overwriting newer Legal state.

## Advisory locking

Use transaction-scoped advisory locks where concurrent commands could create duplicate or contradictory state.

Required lock identities include at minimum:

```text
legal case mutation by case id
legal preserved object materialization by case + canonical object identity
legal package preparation/generation by package id
legal approval mutation by package + approval scope + optional object id
```

Do not use global locks.

## Generic admin audit

Candidate C may emit `public.admin_audit_events` telemetry when existing admin conventions call for it, but canonical Legal history remains `messaging.legal_case_events`.

A generic admin audit row cannot substitute for a Legal event or approval.

## Structural verifier requirements

Permanent verifier must prove at minimum:

- exact Candidate C tables exist;
- all Candidate C tables have RLS enabled;
- direct runtime grants are zero;
- all expected constraints and indexes exist;
- no broad Legal export RPC exists;
- capabilities exist and are assigned only to Super Admin initially;
- exact command types and event mappings are enabled;
- worker RPCs are service-role only;
- human Legal RPCs require current Messages Super Admin and narrow capabilities;
- scope shape constraints are exact;
- one preserved identity per case/canonical object is enforced;
- generated package fields are immutable;
- event ledger is append-only;
- Legal tables do not duplicate Message body, Media storage bytes, or Resource payload columns;
- Media asset purpose `legal_disclosure` exists and asset kind `document` is reused;
- package Media private path is not exposed through broad generic admin authority;
- existing shared job/outbox tables remain the only queue/outbox authority.

## Rollback-only behavior verifier

The permanent verifier must use a transaction and end with rollback.

It must prove at minimum:

```text
Legal Request Case opens idempotently: PASS
Safety Case remains separate authority: PASS
Conversation-window scope materializes only exact bounded Messages: PASS
Adjacent Conversation Message exclusion: PASS
Exact Message scope does not expand Resource references: PASS
Exact Resource Version must be separately scoped: PASS
Exact Media file hold references canonical Media identity: PASS
Preservation does not create disclosure package: PASS
Ordinary Administrator Legal access denied: PASS
Super Admin metadata list does not auto-render Message body: PASS
Deliberate evidence inspection is purpose-bound and audited: PASS
Evidence inspection replay does not duplicate audit event: PASS
Classification requires human reason: PASS
Excluded object cannot enter package: PASS
Unclassified object cannot enter package: PASS
Elevated object requires exact elevated approval: PASS
Package requires exact package approval: PASS
Approval fingerprint staleness blocks generation: PASS
Generation submission is idempotent: PASS
Generation uses shared durable job authority: PASS
Filtered Legal worker claim does not claim unrelated jobs: PASS
Expired Legal lease recovery is scoped and resumable: PASS
Message object bytes are deterministic: PASS
Media exact-byte SHA equals canonical Media SHA: PASS
Manifest object order is deterministic: PASS
Manifest SHA verifies exact manifest bytes: PASS
Archive SHA verifies exact archive bytes: PASS
Generated package registers canonical restricted Media: PASS
Generated package remains private: PASS
Generation does not release package: PASS
Release is explicit and accountable: PASS
Generated package cannot be silently rewritten: PASS
Void preserves immutable history: PASS
Case cannot close with active holds: PASS
Verifier fixture rows roll back completely: PASS
```

## Repository contract tests

Extend existing Messages test authority rather than creating a disconnected Legal suite family.

Tests must cover:

- migration DDL contract;
- function signatures;
- security-definer search paths;
- capability assignment;
- no direct browser writes;
- exact command registration;
- no parallel queue/outbox;
- no unrestricted selector or export API;
- deterministic serialization helpers;
- deterministic ZIP settings;
- worker filtered claim function names;
- worker service-role-only RPC use;
- systemd hardening;
- package path restrictions;
- existing Media private-delivery guard preservation;
- `/admin/messages` Legal surface presence and no ordinary user Legal leakage.

## Implementation migration

Candidate C implementation uses one numbered migration for the complete database authority:

```text
supabase/migrations/<timestamp>_phase_8b5_candidate_c_legal_preservation_scoped_disclosure.sql
```

It contains:

- Media `legal_disclosure` asset purpose;
- Legal capabilities and Super Admin assignments;
- seven Legal tables;
- constraints, indexes, RLS, grants, and immutability guards;
- command type registrations;
- human Legal command/read RPCs;
- scope materialization;
- deliberate evidence inspection;
- package selection/fingerprint logic;
- approval authority;
- generation submission;
- filtered claim/renew/recover worker RPCs;
- source descriptor RPC;
- service-role generation completion/failure adapters;
- Legal package private-delivery target RPC.

Do not split the database authority across ad hoc hot-fix migrations merely to accelerate Preview.

## Generated types

After migration replay, regenerate `src/types/database.types.ts` through the established repository process and seal the exact generated diff.

No hand-written approximation of new table/RPC types is accepted where generated Supabase types already own the contract.

## Expected implementation file surface

The contained Candidate C implementation should remain close to:

```text
supabase/migrations/<candidate-c>.sql
scripts/control-plane/verify-phase-8b5-candidate-c-legal-preservation-scoped-disclosure.sql
src/types/database.types.ts
src/services/messages.ts
src/pages/admin/messages/page.tsx
src/pages/admin/messages/MessagesLegalPanel.tsx
supabase/functions/media-upload-api/index.ts
ops/legal-disclosure-worker/worker.py
ops/systemd/wakilisha-legal-disclosure-worker.service
test/... existing Messages/Media contract files
```

A different file shape requires a real implementation reason, not convenience.

## No new Edge Function runtime

Candidate C generation runs in the repository-owned systemd Legal worker.

The existing `media-upload-api` may receive a small Legal private-delivery action because it already owns HMAC-signed protected Media delivery. This is an extension of existing Media delivery authority, not a new worker, queue, scheduler, or generic export endpoint.

## Preview gate

Before any Production mutation:

1. clean exact accepted main;
2. contained implementation branch;
3. repository migration replay PASS;
4. generated types sealed;
5. full permanent verifier PASS on disposable Preview;
6. focused Messages/Media/Legal contract tests PASS;
7. complete application build PASS;
8. Legal worker static/contract tests PASS;
9. systemd contract PASS;
10. existing `media-upload-api` contract tests PASS;
11. Preview behavioral acceptance of scope leak prevention, approvals, deterministic generation, hashes, private package delivery, retries, and rollback PASS;
12. required Critical Control Plane PASS;
13. exact branch diff audited before PR.

Preview-only hot repair cannot become Production migration or runtime authority.

## Production promotion gate

After merge:

1. exact merged-main migration identity confirmed;
2. Production SQL promoted through established migration workflow;
3. Production rollback-only verifier PASS;
4. exact merged-main Legal worker deployed through established Lightsail/systemd workflow;
5. existing Media delivery Edge Function deployed only if its Candidate C action changed;
6. exact merged-main frontend deployed through established frontend workflow;
7. controlled Production canary creates one Legal Request Case and exact preservation scope;
8. exact object classification and approval proof;
9. one generated package proves per-object SHA-256, manifest SHA-256, package SHA-256, canonical restricted Media registration, and no adjacent scope leakage;
10. explicit release and short-lived case-authorized delivery proof;
11. retry/lease/dead-letter proof without source mutation;
12. post-acceptance residue audit;
13. Candidate C closure documentation;
14. close #871 only after all Production gates pass.

## Candidate C non-goals

Candidate C does not:

- decide legal entitlement automatically;
- create a generic administrator export endpoint;
- expose Legal metadata to ordinary Messages users;
- redesign Safety Case;
- alter Candidate B enforcement semantics;
- create a second job queue, retry ledger, dead-letter system, scheduler, or outbox;
- create a new generic binary store;
- make Media legal-hold state equal Media archival preservation state;
- make Super Admin role an ambient private-content reader;
- support arbitrary SQL/query selectors;
- auto-expand graph relationships from an in-scope object;
- promise typed disclosure export for every Resource kind without an explicit adapter;
- broaden public Messages audience;
- perform Phase 8B.6 antifragile closure.

## Locked implementation sequence

Candidate C implementation proceeds as one contained serious slice:

1. database authority and exact command registrations;
2. permanent rollback-only verifier;
3. generated type seal;
4. Legal disclosure worker and systemd service;
5. existing Media private-delivery bridge extension;
6. Messages service and `/admin/messages` Legal UI;
7. focused contract tests;
8. complete build;
9. disposable Preview migration and behavior acceptance;
10. deterministic generation/hash/retry acceptance on Preview;
11. Critical Control Plane;
12. one implementation PR;
13. exact merged-main Production SQL;
14. Production verifier;
15. worker/Edge Function/frontend deployment as classified;
16. controlled Production Legal canary;
17. closure record and #871 closeout.

## Design conclusion

Candidate C does not need a new Legal application, generic export engine, private-data warehouse, queue, scheduler, or binary store.

It needs one narrow Legal peer authority that binds lawful-request metadata to finite preservation scopes, materializes those scopes into exact canonical objects, requires human classification and exact-fingerprint approvals, produces deterministic auditable bytes through the accepted durable-worker pattern, registers the final package as restricted canonical Media, and releases it only through case-bound authorization.

The accepted runtime decision is now explicit: **a dedicated repository-owned Legal disclosure systemd worker on the existing Production Lightsail worker substrate, using the existing shared durable job authority.** The accepted Media processor remains Media-only.

No Candidate C implementation SQL should be written until this design is accepted.