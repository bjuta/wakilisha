# Phase 1B Command, Job, and Transactional Outbox Audit

## Status

Phase: Phase 1, PR 1B

Audit status: Complete

Implementation status: Deployed and permanently verified in production

Production changed: Yes

## Objective

Add one durable orchestration boundary above the Phase 1A resource identity
layer.

A supported resource command must be accepted exactly once for one principal
and idempotency key, create durable work, and create an event for downstream
delivery in the same database transaction.

The first proof command is:

- `resource.reconcile_identity`

The command requests verification of an existing Phase 1A resource, its typed
binding, lifecycle state, visibility, and canonical route state.

It does not directly rewrite canonical Article, Playlist, or Registry content.

## Phase 1A dependency

Phase 1B depends on the production authorities created by Phase 1A:

- `editorial.resource_kinds`
- `editorial.resources`
- `editorial.article_resources`
- `editorial.playlist_resources`
- `editorial.registry_artist_resources`
- `editorial.resource_aliases`
- `public.wk_resource_index`

Phase 1B must reference `editorial.resources.id`.

It must not identify resources through:

- slug text
- table name text
- entity type text
- arbitrary JSON identifiers

## Scope

Phase 1B creates:

- a private platform orchestration schema
- a controlled command-type registry
- command receipts
- idempotency enforcement
- durable jobs
- worker leases
- retry and dead-letter states
- a transactional outbox
- a narrow authenticated command RPC
- service-role worker functions
- one three-resource rollback rehearsal
- one permanent production proof command after deployment

## Explicit exclusions

Phase 1B does not create:

- a generic resource mutation RPC
- a browser-accessible job table
- a browser-accessible outbox table
- an Edge Function worker
- a scheduled worker
- webhook delivery
- email delivery
- search indexing
- canonical content mutation
- resource publishing
- route mutation
- alias replacement
- bulk resource backfills
- Sources
- Citations
- Credits
- Corrections
- Provenance
- Inquiry Mode
- new Institute workspaces

Worker execution and downstream delivery are later vertical slices.

## Internal schema

The orchestration authorities will live in:

- `platform_private`

The schema must not be exposed as a general PostgREST data surface.

Required rules:

- revoke access from `public`
- no table grants to `anon`
- no table grants to `authenticated`
- no direct browser writes
- service-role access only for worker operations
- authenticated access only through an explicitly granted public RPC
- every security-definer function uses a fixed search path
- every privileged function performs its own role or capability check

## Controlled command types

Create:

- `platform_private.command_types`

Initial registered command:

- command type: `resource.reconcile_identity`
- job type: `resource.identity_reconciliation`
- accepted event: `resource.command.accepted`
- success event: `resource.command.succeeded`
- failure event: `resource.command.failed`

Do not pre-register speculative future commands.

## Command receipts

Create:

- `platform_private.command_receipts`

A command receipt records:

- stable receipt UUID
- controlled command type
- target Phase 1A resource UUID
- principal key
- authenticated actor UUID where available
- caller-supplied idempotency key
- deterministic request fingerprint
- accepted request payload
- receipt status
- result payload
- error code
- error message
- accepted time
- completion time
- creation time
- update time

Initial receipt states:

- `accepted`
- `succeeded`
- `failed`
- `rejected`

The receipt is the durable answer to:

- did WAKILISHA accept this command?
- who requested it?
- which resource did it target?
- was this request a replay?
- what work and events belong to it?
- how did it finish?

## Idempotency contract

Idempotency is scoped by:

- principal key
- command type
- idempotency key

The same key with the same request fingerprint returns the original receipt,
job, and outbox event.

The same key with a different request fingerprint is rejected.

The fingerprint must include:

- command type
- resource ID
- normalized reason
- normalized metadata

The database, not the frontend, owns the uniqueness guarantee.

Idempotency keys must:

- be between 8 and 128 characters
- begin with an alphanumeric character
- contain only letters, numbers, period, underscore, colon, and hyphen

## Principal identity

Authenticated principals use:

- `user:<auth.uid()>`

Service-role principals use:

- `service:service_role`

The caller cannot supply or override the principal key.

The caller cannot supply or override the actor UUID.

## Permission contract

The submission RPC is not anonymous.

Initial permission mapping:

### Article resource

Allowed when the caller is:

- an administrator
- assigned `edit_others_articles`

### Playlist resource

Allowed when the caller is:

- an administrator
- assigned `institute_write`
- assigned `institute_admin`

### Registry artist resource

Allowed when the caller is:

- an administrator
- assigned `manage_registry`

### Service role

The service role may submit the command for internal orchestration.

No other resource kinds are accepted in Phase 1B.

## Durable jobs

Create:

- `platform_private.jobs`

A job records:

- stable job UUID
- command receipt UUID
- stable job key within the command
- controlled job type
- resource UUID
- job status
- priority
- availability time
- attempt count
- maximum attempts
- worker lock identity
- lock time
- lease expiry
- input payload
- result payload
- last error
- start time
- finish time
- creation time
- update time

Initial job states:

- `queued`
- `running`
- `retry_wait`
- `succeeded`
- `dead_letter`
- `cancelled`

The first command creates one job with job key:

- `primary`

The database enforces one job per receipt and job key.

## Worker claim contract

A service-role worker may atomically claim available jobs.

The claim function must:

- use `for update skip locked`
- claim only `queued` or `retry_wait` jobs
- require `available_at <= now()`
- reject expired or malformed worker identifiers
- increment the attempt count
- record the worker identity
- record the lock time
- record a lease expiry
- return the claimed job payload

Two workers must not claim the same job concurrently.

A worker may complete or fail only a job currently leased to that worker.

## Job completion contract

Successful completion must atomically:

- mark the job `succeeded`
- store the result
- clear the lease
- mark the command receipt `succeeded`
- store the command result
- create one `resource.command.succeeded` outbox event

## Job failure contract

A retryable failure must atomically:

- move the job to `retry_wait`
- store the error
- clear the lease
- set the next availability time
- retain the command receipt as `accepted`
- create a unique retry-scheduled outbox event

A terminal failure must atomically:

- move the job to `dead_letter`
- store the error
- clear the lease
- mark the command receipt `failed`
- store the command error
- create one `resource.command.failed` outbox event

Maximum attempts are enforced by the database.

## Transactional outbox

Create:

- `platform_private.outbox_events`

An outbox event records:

- stable event UUID
- unique event key
- command receipt UUID
- optional job UUID
- aggregate type
- aggregate UUID
- controlled event type
- event version
- payload
- headers
- delivery status
- availability time
- attempt count
- maximum attempts
- claim identity
- claim time
- lease expiry
- publication time
- last error
- creation time
- update time

Initial delivery states:

- `pending`
- `claimed`
- `retry_wait`
- `published`
- `dead_letter`

The first aggregate type is:

- `resource`

The aggregate UUID is the Phase 1A resource ID.

## Outbox delivery contract

A service-role dispatcher may atomically claim available events.

The claim function must:

- use `for update skip locked`
- claim only `pending` or `retry_wait` events
- require `available_at <= now()`
- increment the attempt count
- create a delivery lease
- prevent concurrent duplicate claims

Successful publication marks the event `published`.

Retryable delivery failure moves the event to `retry_wait`.

Terminal delivery failure moves the event to `dead_letter`.

Phase 1B does not implement the external dispatcher.

## Submission RPC

Create one public RPC:

- `public.submit_resource_reconciliation_command`

Inputs:

- `p_resource_id uuid`
- `p_idempotency_key text`
- `p_reason text default null`
- `p_metadata jsonb default '{}'`

Output:

- command receipt ID
- job ID
- accepted outbox event ID
- receipt status
- whether the response is an idempotent replay

The function must:

1. require an authenticated or service-role caller
2. validate the idempotency key
3. validate metadata as a bounded JSON object
4. load the Phase 1A resource
5. enforce the resource-kind capability mapping
6. calculate the deterministic request fingerprint
7. insert or replay the command receipt
8. reject mismatched reuse of an idempotency key
9. insert one durable job
10. insert one accepted outbox event
11. return all three identities

Steps 7 through 10 must occur in one transaction.

## Security boundary

Tables in `platform_private` must have RLS enabled even though they are not
direct browser tables.

No policies are created for `anon` or `authenticated`.

Required grants:

- authenticated may execute only the submission RPC
- service role may execute submission and worker functions
- anon may execute none of them
- public may execute none of them

The submission RPC must not rely on caller-provided capability claims.

It must use the existing WAKILISHA capability helpers.

## First proof slice

Use the three live Phase 1A resources:

- Article: `the-rise-of-music-playlists`
- Playlist: `between-2018-and-2024-in-what-ways-did-sheng-function-inside-kenyan-gengeton-2`
- Registry artist: `khaligraph-jones`

Rollback rehearsal must prove:

- an authorized Article command creates one receipt, one job, and one event
- an authorized Playlist command creates one receipt, one job, and one event
- an authorized Registry artist command creates one receipt, one job, and one event
- replay with the same request returns the same three IDs
- replay does not create duplicate rows
- reuse with changed metadata fails
- unauthorized submission fails
- anon execution fails
- one worker claims one job
- a second worker cannot claim the same job
- completion creates exactly one success event
- retryable failure schedules another attempt
- terminal failure dead-letters the job and fails the receipt
- outbox events can be claimed only once per active lease
- all rehearsal rows disappear on rollback

## Required structural tests

- command types are controlled by a foreign key
- jobs reference command receipts
- jobs reference Phase 1A resources
- outbox events reference command receipts
- outbox events reference Phase 1A resources
- event keys are globally unique
- idempotency uniqueness is enforced by the database
- request fingerprints cannot be changed silently
- job resource IDs match their command receipt resource IDs
- outbox aggregate IDs match their command receipt resource IDs
- all private tables have RLS enabled
- no authenticated direct table privileges exist
- security-definer functions have fixed search paths
- anon has no execute privilege
- authenticated has no worker execute privilege

## Exit gate

Phase 1B closes only when:

- the migration passes static inspection
- the full foundation passes a rollback-only production-schema rehearsal
- the migration is merged through a reviewed PR
- the migration is applied to production
- one production proof command is accepted
- its receipt, job, and accepted event exist atomically
- replay returns the same identities
- mismatched replay is rejected
- no browser role has direct access to private orchestration tables
- no preview branch remains active
- no unplanned Edge Function or frontend deployment is required

## Phase 1B final validation record

Validation date: July 15, 2026

Validated branch:

- `feature/phase-1b-command-job-outbox`

Validated migration:

- `20260715143000_phase_1b_command_job_outbox_foundation.sql`

Validation environment:

- the real WAKILISHA production schema
- the three live Phase 1A proof resources
- one rollback-only database transaction
- no preview branch
- no billable rehearsal environment

Validated command contract:

- controlled command type `resource.reconcile_identity`
- deterministic request fingerprint
- principal-scoped idempotency
- identical replay returns the original receipt, job, and event
- mismatched replay is rejected
- no anonymous submission
- capability mapping remains resource-kind specific

Validated job contract:

- durable command-linked jobs
- atomic worker claims using `for update skip locked`
- active worker leases
- successful completion
- retry scheduling
- terminal dead-letter handling
- receipt completion follows terminal job state

Validated outbox contract:

- accepted events are created in the command transaction
- success, retry, and failure events follow job transitions
- atomic dispatcher claims use `for update skip locked`
- publication, retry, and dead-letter states passed
- active leases prevent duplicate delivery claims

Validated security contract:

- private orchestration tables have RLS enabled
- browser roles have no direct table privileges
- authenticated callers can execute only the submission RPC
- worker and dispatcher functions are service-role only
- privileged functions are security definer with fixed search paths
- accepted command, job, and event bodies are immutable
- fingerprint hashing explicitly uses `extensions.digest`

Rollback result:

- all command receipts rolled back
- all jobs rolled back
- all outbox events rolled back
- `platform_private` did not persist
- production migration history did not change
- the three Phase 1A proof resources remained unchanged

Scope boundary:

- no Edge Function worker
- no scheduled worker
- no external dispatcher
- no frontend implementation
- no canonical content mutation
- no route or alias mutation

## Phase 1B production closure record

Closure date: July 15, 2026

Merge record:

- pull request `#458`
- merge commit `a350caaf78564a630e398e0975c1c67c8cca900a`

Production migration:

- `20260715143000_phase_1b_command_job_outbox_foundation.sql`
- recorded in production migration history
- four private orchestration tables present
- row-level security enabled on all four tables
- one public submission RPC present
- six service-role worker functions present

Permanent production proof:

- command receipt `3ea7dcab-81d7-4e9d-a733-390ab0045171`
- durable job `a1ed0228-185a-4d7e-89cf-342ff13fdcc3`
- accepted event `32f029d8-3516-41d8-a804-e198388a3bda`
- receipt state `accepted`
- job state `queued`
- job attempt count `0`
- accepted event state `pending`
- principal `service:service_role`
- idempotency key `phase1b-production-article-proof-20260715`

Permanent proof result:

- one receipt exists
- one job exists
- one accepted event exists
- idempotent replay returned the same three identities
- replay created no duplicate rows
- direct production verification passed

Intentional retained state:

- the proof job remains queued
- the accepted outbox event remains pending
- Phase 1B does not deploy a worker or dispatcher
- later vertical slices may claim this durable work through the Phase 1B contract

Exit gate:

- every Phase 1B closure condition has passed
- Phase 2A may begin from this production baseline
