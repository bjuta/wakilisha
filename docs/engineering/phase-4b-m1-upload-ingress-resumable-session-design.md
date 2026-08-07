# Phase 4B M1 upload ingress and resumable session design

Date: 7 August 2026

## Status

Implementation design locked for the first PR 4B proof.

## Scope

M1 proves one protected audio master larger than the accepted 25 MiB
single-request upload path can:

- receive an authenticated upload session
- transfer in fixed-size resumable parts
- survive an intentional interruption
- resume without replacing completed parts
- verify every part checksum
- verify final byte count and SHA-256
- finalize to an immutable protected storage path
- register exactly one verified canonical `media.file_objects` row
- retry final verification without creating a duplicate file object
- cancel a partial session and remove partial bytes

M1 does not create audio derivatives, Media variants, or a logical Audio
publication.

## Existing path preserved

The Phase 4A image and PDF path remains:

Browser/admin UI -> `media-upload-api` -> protected receiver `/upload` ->
canonical Media write authority.

Its 25 MiB limit remains unchanged.

M1 adds a separate resumable path for large audio masters.

## Control plane

`media.upload_sessions` owns durable upload intent and canonical completion
state.

The authenticated control plane owns:

- actor identity
- idempotency key
- original filename
- MIME type
- expected byte count
- expected SHA-256
- immutable storage path allocation
- fixed part size
- expiry
- cancellation
- final canonical file-object identity

Direct table access is not granted to application roles.

Authenticated administrators create and inspect their own sessions through
security-definer functions.

Only service-role verification may convert receiver checksum evidence into a
verified canonical file object.

## Data plane

Large master bytes do not pass through the Edge Function.

The Edge Function creates a random per-session capability and sends its hash to
the receiver using the existing protected receiver secret.

The browser receives only the per-session capability.

It never receives `MEDIA_UPLOAD_RECEIVER_SECRET`.

Each part upload requires:

- the session capability in `Authorization`
- an exact `Content-Length`
- `X-Part-SHA256`
- the expected part number

The receiver writes each part to a unique temporary path, verifies its SHA-256,
fsyncs it, and then atomically activates the part.

A retry of an already accepted part succeeds only when its byte count and
checksum are identical.

## Receiver state semantics

The receiver exposes:

- `created`: no accepted parts
- `active`: a part is currently being written
- `interrupted`: at least one part exists but the complete set does not
- `unverified`: all parts exist but the full master is not finalized
- `verified`: the final master matched expected bytes and SHA-256
- `failed`: terminal full-master verification failure
- `expired`: session expiry passed before verification and partial bytes are removed

The database separately records durable control-plane state:

- `created`
- `verified`
- `failed`
- `cancelled`
- `expired`

Receiver state explains transfer progress. Database state explains authority.

## Immutable finalization

Masters use the protected storage namespace:

`masters/audio/YYYY/MM/<upload-session-id>.<extension>`

The Media origin explicitly denies public `/masters/*` requests.

The receiver assembles accepted parts into a staging file and verifies the
whole-file byte count and SHA-256.

It never uses `os.replace()` to overwrite a final master.

Final activation uses a same-filesystem hard link. If the destination already
exists, finalization fails rather than replacing it.

The canonical file object records a private delivery placeholder under
`/__private/media-master/<session-id>` until signed private delivery is built in
a later PR 4B slice.

## Canonical completion boundary

M1 reuses `media.insert_verified_file_object_v2`.

That existing function already:

- requires a known storage provider
- requires immutable storage path and delivery URL
- requires SHA-256, byte count, and MIME type
- rejects an already registered storage locator
- inserts a verified `media.file_objects` row
- records file registration and verification events

The new service-role upload-session verifier calls that function exactly once
inside the same transaction that marks the session verified.

A retry returns the existing `file_object_id` from the locked session.

M1 deliberately does not call `create_media_asset_write_v2` yet. Logical Media
identity and revision attachment belong to the processing and publication work
that follows protected master acceptance.

## Infrastructure authority

M1 brings these production runtime surfaces into the repository:

- Media receiver source
- Media receiver systemd unit
- Media-origin Nginx server contract

Future production changes must compare the live files against these retained
contracts before deployment.

## Rollback

Before production deployment:

- back up live receiver source
- back up live systemd unit
- back up live Media Nginx configuration

Database migration is additive.

The existing Phase 4A `/upload` route remains available throughout the M1
proof.

If resumable ingress fails, restore the three infrastructure files and reload
only the affected service and Nginx. Existing image and PDF upload behavior
must continue unchanged.

## Acceptance proof

M1 is accepted only after a real WAV master larger than 25 MiB proves:

1. session creation
2. at least one accepted part
3. intentional stop
4. `interrupted` status
5. resume with the same session
6. all parts accepted exactly once
7. `unverified` status before finalization
8. exact final byte count
9. exact final SHA-256
10. protected final master exists
11. public master URL does not serve the original
12. exactly one canonical verified file object exists
13. retrying verification returns the same file object
14. zero Media revisions are created by M1 completion
15. a second partial session can be cancelled and its partial files removed
16. an expired session is reconciled and its partial files removed
17. the existing Phase 4A image upload path remains healthy

## Production acceptance, 2026-08-07

M1 was deployed and accepted against production on 2026-08-07.

### Production authority

- Database migration: `20260807103000_phase_4b_m1_upload_sessions.sql`
- Authoritative migration count: `200`
- Edge Function: `media-upload-api` version `19`
- Receiver SHA256: `36940079e9acfca02d4ad9997bc1e50fba54a30b18d9d43599b195098754b674`
- systemd SHA256: `9b646bee324c90a49f9de5174f7e9db021af34f3ede31c5c659404daedae3648`
- Nginx SHA256: `c24dd4392da0359cc7ab82ef04e5d6c71a13abacb96e29e64c2b24f08bb5e381`
- Initial runtime release: `phase4b-m1-resumable-runtime-20260807T111522Z`
- Receiver recovery release: `phase4b-m1-cross-mount-finalize-20260807T114020Z`
- Initial runtime rollback: `/opt/wakilisha-media-receiver-backups/phase4b-m1-resumable-runtime-20260807T111522Z`
- Nginx rollback: `/etc/nginx/wakilisha-backups/phase4b-m1-resumable-runtime-20260807T111522Z`
- Receiver recovery rollback: `/opt/wakilisha-media-receiver-backups/phase4b-m1-cross-mount-finalize-20260807T114020Z`

### Accepted master

- Upload session: `bda7bf24-8021-4d05-bd15-ef3d4b4a5e84`
- Canonical file object: `b4d803ad-dfa2-4109-8508-88fb1488fc55`
- Storage path: `masters/audio/2026/08/bda7bf24-8021-4d05-bd15-ef3d4b4a5e84.wav`
- Byte size: `31752044`
- SHA256: `38c088cbf6fc557e18b63f7837370c6aaf762c38393f266e41a39266113429b4`
- Media revisions created: `0`
- Public master delivery: HTTP `404`

### Acceptance proof

The production acceptance proved all of the following:

1. A valid audio master larger than 25 MiB can create a governed resumable upload session.
2. Master bytes travel directly to Media ingress rather than through the Edge Function.
3. An upload interrupted after one completed part reports `interrupted`.
4. Re-sending an already accepted part is idempotent.
5. The same upload session resumes and completes with exact byte count and SHA256.
6. Receiver finalization preserves the original master and removes completed part files.
7. A control-plane interruption after receiver verification can recover through the normal Edge finalizer without re-uploading the master.
8. Repeated finalization returns the same canonical file object.
9. Exactly one immutable canonical `media.file_objects` row exists for the master.
10. No `media.asset_revisions` row is created by M1.
11. The protected master is not publicly reachable.
12. A second claim on the immutable master destination is rejected.
13. Cancellation removes partial bytes and persists durable `cancelled` state.
14. Expiry removes partial bytes and reconciles durable `expired` state.
15. The Phase 4A image upload path remains healthy and publicly serves a newly uploaded image.

Acceptance support sessions:

- Cancellation session: `3fa427f3-250f-420f-8a3a-ec60bfc011d7`
- Expiry session: `e078eaf1-acc0-4720-9c30-73c85c821893`

Final acceptance marker:

`PHASE_4B_M1_RESUMABLE_MASTER_ACCEPTANCE_PASS`

### Production defect discovered and corrected during acceptance

The first finalization attempt failed with Linux `EXDEV` because the systemd sandbox exposes `/opt/wakilisha-media` and `/opt/wakilisha-media-upload-sessions` as separate writable mounts. A hard link cannot cross those mounts.

The receiver was corrected to keep resumable part files in the private session root while assembling the verified staging master beside its final protected destination under `/opt/wakilisha-media/masters/...`. Immutable activation still uses a same-mount hard link, so the no-overwrite guarantee is preserved.

The original four uploaded parts were retained and used to recover the same 31,752,044-byte acceptance master. The master was not re-uploaded.
