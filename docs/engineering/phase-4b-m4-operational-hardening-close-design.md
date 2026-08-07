# Phase 4B M4: Operational Hardening + Acceptance + CLOSE

Date: 7 August 2026

## Status

Implementation boundary locked after the production M4 operational audit and
remaining-capability audit.

M4 starts from closed M3 main:

`1c9abde339b97231436820dc1a9273e70c907a15`

M1, M2, and M3 remain closed.

## Objective

Finish the remaining Phase 4B upload and processing contract without reopening
Media identity, inventing another queue, or pulling later Audio and Video
publication authority into the Media platform.

M4 owns:

1. transcript and caption file support in canonical Media
2. short-lived signed delivery for protected Media files
3. filesystem and database reconciliation
4. bounded orphan and terminal-work cleanup
5. scheduled maintenance
6. operational proof of failed-processing recovery
7. public CDN activation and proof
8. final Phase 4B acceptance and closure

## Transcript and caption boundary

The Phase 4 programme lists transcripts and captions in PR 4B.

The authoritative programme also assigns the later Audio and Video phases the
editorial and public behaviour around transcripts and captions, including
review, correction, navigation, accessibility, and publication.

M4 therefore does not install a speech-to-text engine and does not create
machine-generated transcript content.

M4 makes transcript and caption files first-class Media kinds.

Supported initial files:

Transcript:

- `.txt`
- `text/plain`

Caption:

- `.vtt`
- `.srt`
- `text/vtt`
- `application/x-subrip`
- `text/plain` where the extension is authoritative

These use the existing bounded upload lane and canonical Media write authority.

They are stored under protected paths:

- `private-files/transcripts/`
- `private-files/captions/`

Direct requests to these paths remain HTTP 404.

Later Audio and Video domain work may attach, review, version, correct, and
publish these governed Media records.

## Signed private delivery

Protected Media bytes must not be proxied through a Supabase Edge Function.

M4 adds a short-lived signed delivery control plane.

Flow:

1. authenticated administrator requests a private delivery URL
2. canonical SQL authority verifies the requested file object belongs to Media
3. only verified protected paths are eligible
4. the Edge Function signs the exact storage path and expiry
5. Nginx sends an internal authorization subrequest to the local receiver
6. the receiver verifies HMAC, path, and expiry
7. Nginx serves the file directly from local storage
8. the response is private and `no-store`

Eligible roots:

- `masters/`
- `derived-objects/`
- `private-files/transcripts/`
- `private-files/captions/`

Direct access to those storage roots remains blocked.

Signed URL maximum lifetime is 15 minutes.

The signing secret is shared only by:

- `media-upload-api`
- the local Media receiver

The secret is not stored in the repository and is never returned to the
browser.

## Failed-processing recovery

M3 already implements the correct recovery boundary.

`mediaService.retryProcessing()` submits a fresh governed
`media.process_revision` command against the existing immutable revision and
master.

M4 does not revive or rewrite dead-letter rows.

Dead-letter jobs remain inspectable history.

## Maintenance and reconciliation

M4 adds one repository-owned maintenance process.

It reads a service-role-only maintenance manifest from canonical database
authority and reconciles it against Lightsail filesystem state.

It verifies:

- canonical protected files exist
- canonical file byte sizes match
- optional explicit SHA-256 verification
- selected public derivative links point to the canonical derivative bytes
- upload-session terminal state is consistent
- processing staging belongs to known Media jobs

It never treats the inherited Phase 4A `/uploads` tree as orphaned merely
because historical compatibility assets lack canonical file objects.

Deletion is limited to provably disposable state:

- terminal upload-session manifest directories older than retention
- terminal Media processing staging directories older than retention
- unknown upload or processing directories older than retention
- unregistered files under Phase 4B protected roots older than retention
- unselected public derivative links older than retention

Canonical file objects are never deleted by the maintenance runner.

Database job, receipt, event, upload-session, and dead-letter history is never
deleted by the maintenance runner.

## Maintenance schedule

Systemd runs maintenance once per day with a persistent timer.

The service executes as `www-data` and reuses the root-owned Media processor
environment file for Supabase service-role access.

Default retention:

- terminal upload-session manifests: 24 hours
- terminal processing staging: 1 hour
- unknown ephemeral directories: 24 hours
- unregistered protected files: 24 hours
- unselected public derivative links: 24 hours

## Public CDN boundary

The pre-activation M4 audit proved `media.wakilisha.africa` resolved directly
to the Lightsail origin.

The origin already sends immutable one-year cache headers for public Media.

Production acceptance on 8 August 2026 proved the hostname is proxied through
Cloudflare and public immutable Media is served through Cloudflare cache while
protected Media remains outside the public cache.

Cloudflare must:

- proxy `media.wakilisha.africa`
- use Full (strict) TLS
- cache public immutable `/derivatives/` and `/uploads/` responses
- bypass cache for `/__admin/`
- bypass cache for `/__private/`
- bypass cache for `/masters/`
- bypass cache for `/derived-objects/`
- bypass cache for `/private-files/`

The existing upload/session paths must still work through the proxied hostname.

## Exit gates

M4 and Phase 4B may close only after production proves:

1. M1, M2, and M3 remain accepted
2. transcript file upload creates one verified canonical Media file/revision
3. caption file upload creates one verified canonical Media file/revision
4. direct transcript and caption storage paths return HTTP 404
5. a signed private URL returns the exact protected bytes before expiry
6. the same signed URL fails after expiry
7. malformed or tampered signed URLs fail
8. direct masters remain HTTP 404
9. direct canonical derivatives remain HTTP 404
10. public selected derivatives remain HTTP 200
11. maintenance dry-run reports no canonical corruption
12. maintenance removes the preserved stale M2 processing staging directory
    without deleting the dead-letter job
13. terminal upload-session manifests are governed by retention
14. no canonical master or derivative is removed
15. failed-processing retry reuses the existing immutable master
16. receiver, processor, and maintenance services/timer are healthy
17. public Media is served through Cloudflare
18. upload and resumable transfer still work through the CDN-proxied hostname
19. schema, generated types, and control-plane verification are green
20. the final Phase 4B closure record is merged on green main

## Non-goals

M4 does not:

- generate transcripts with speech recognition
- create Audio publication authority
- create Video publication authority
- publish transcript or caption content
- build transcript correction UI
- build caption editing UI
- replace the existing shared jobs or outbox
- mutate preserved dead-letter evidence
- bulk-create revisions for inherited Phase 4A compatibility assets
- clean the inherited `/uploads` corpus as orphaned Media
- reopen Phase 4A, M1, M2, or M3

## Production acceptance correction: canonical text asset kinds

The first live M4 transcript acceptance reached canonical
`create_media_asset_write_v2` and stopped with:

`Unknown or disabled Media asset kind`

The failure occurred after the protected transcript bytes had been accepted by
the narrow upload lane but before canonical Media asset/file/revision creation.

Production inspection proved `public.create_media_asset(...)` validates
`p_asset_kind` against the enabled `media.asset_kinds` registry. Migration 206
had widened only the compatibility `registry_media_assets.file_kind` check and
therefore did not yet extend the canonical kind registry.

The correction is forward migration 207:

`20260807194500_phase_4b_m4_text_asset_kind_registry.sql`

It adds enabled canonical `transcript` and `caption` Media asset kinds without
editing or reapplying migration 206.

The failed acceptance upload has no canonical Media asset or file object. The
known proof orphan is removed surgically before acceptance resumes. No
canonical Media bytes are removed.

The shared Media Library also exposes Transcript and Caption in its file-kind
filter while preserving picker defaults as image/document unless a consumer
explicitly opts into other kinds.

## Production live acceptance and closure

Production live acceptance completed on 8 August 2026.

The accepted production state proved:

- authoritative migrations 206 and 207 are live
- transcript and caption are enabled canonical Media asset kinds
- transcript and caption protected-original delivery works
- direct protected storage roots remain unavailable
- fresh signed private delivery succeeds
- expired and tampered signed private delivery fails
- Media receiver, processor, and maintenance runtime are healthy
- the daily maintenance timer is enabled
- maintenance reconciliation converges without canonical or ambiguous orphan drift
- `media.wakilisha.africa` is proxied through Cloudflare with Full (strict) TLS
- public immutable Media produces a cold Cloudflare cache MISS followed by a HIT
- protected delivery remains outside the public cache
- image, PDF, and transcript uploads remain healthy after proxy activation
- resumable audio upload pauses and resumes from accepted parts
- audio processing reaches ready and the governed preview plays
- resumable video upload and processing reach ready and the governed preview plays
- browser Media acceptance remains green after CDN activation

`PHASE_4B_M4_LIVE_ACCEPTANCE_PASS`

M4 implementation and live acceptance are complete. Phase 4B is ready to close
when this repository closure record merges on green main.
