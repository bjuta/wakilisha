# PR 4B upload and processing authority audit

Date: 7 August 2026

## Status

Authority audit complete.

The first implementation boundary is locked.

## Starting baseline

The audit started from:

`85e12da3 Close Phase 4A and open PR 4B (#581)`

No repository change was made during the audit.

## Existing upload path

The current narrow path is browser to `media-upload-api`, then to the protected
Lightsail Media receiver, then to `/opt/wakilisha-media/uploads`, and finally
through the canonical Media command boundary into immutable Media file,
revision, and variant authority.

The live `media-upload-api` is version 18.

It performs explicit Bearer-token user authentication even though the function
deployment has `verify_jwt=false`.

## Current transfer limitations

The current bridge:

- accepts images and PDFs
- limits one file to 25 MiB
- parses `FormData`
- materializes the complete file with `arrayBuffer()`
- calculates SHA-256 after the complete file is in Edge Function memory
- forwards the complete byte buffer to the Lightsail receiver
- rejects an existing storage path
- allocates a new immutable storage path
- verifies one 640px responsive image derivative

This remains the accepted Phase 4A narrow image path.

It is not the PR 4B large-master architecture.

## Production ingress

The audited Media ingress uses:

- Nginx `client_max_body_size 30m`
- `proxy_request_buffering on`
- receiver target `127.0.0.1:4017`
- active `wakilisha-media-receiver.service`
- receiver process `/opt/wakilisha-media-receiver/server.py`

At audit time the host had about 50 GiB free.

## Resumable transfer

No dedicated Media resumable-upload, multipart-upload, TUS, upload-session, or
chunk-resume implementation was found.

Generic `CHUNK_SIZE` matches were unrelated application batch loops.

## Processing

No obvious FFmpeg, Sharp, TUS, or dedicated audio/video processing dependency
was present in `package.json`.

The current Nginx image derivative path is not a general durable processing
worker.

## Existing durable job authority

PR 4B must reuse `platform_private.jobs` and `platform_private.outbox_events`.

The existing substrate already supplies:

- durable jobs
- attempt counts
- maximum attempts
- retry-wait state
- leases and lease expiry
- dead-letter state
- cancellation state
- transactional outbox delivery
- idempotency
- correlation identity
- job claim, completion, and failure helpers

PR 4B must not create a second queue, retry ledger, outbox, or dead-letter
system.

## Existing Media authority

PR 4B inherits:

- `media.assets`
- `media.file_objects`
- `media.asset_revisions`
- `media.variants`
- `media.variant_selections`
- `media.asset_governance_versions`
- `media.usage_links`
- `media.events`

Existing writes already complete through governed commands including
`create_media_asset_write_v2` and `replace_media_asset_file_v2`.

## Infrastructure authority requirement

The audit exposed that important Media behavior existed in host-managed Nginx
and receiver configuration outside ordinary repository diffs.

Before PR 4B materially changes the receiver or upload ingress, those runtime
surfaces must have a repository-owned or repository-verifiable deployment and
drift contract.

Future acceptance must be able to prove:

- expected Nginx Media ingress
- expected receiver service
- expected receiver implementation
- expected upload limits
- expected authentication boundary
- expected storage root
- expected rollback configuration
- production drift from the expected configuration

## Locked architecture boundary

Large Media masters must not be relayed through the existing whole-file
in-memory Edge Function path.

PR 4B separates the control plane from the byte-transfer data plane.

The control plane owns authenticated upload-session creation, authorization,
expected file metadata, expected byte size, expected checksum where available,
immutable target allocation, expiry, session state, idempotency, correlation,
and completion authorization.

The data plane owns direct transfer to Media ingress, resumable or multipart
transfer, interrupted-transfer continuation, received-byte accounting, and
temporary partial-object handling.

Canonical completion occurs only after exact-byte verification.

## First implementation slice

**PR 4B M1: upload ingress authority and resumable-session proof.**

The proof must:

1. preserve the existing Phase 4A image-upload path
2. create one authenticated governed upload session
3. allocate one immutable destination for an audio master larger than 25 MiB
4. transfer master bytes directly to the Media ingress
5. interrupt the transfer after at least one completed part
6. resume the same session
7. avoid duplicate masters and revisions
8. verify exact received byte count
9. verify SHA-256 before canonical completion
10. register exactly one immutable canonical Media file object
11. preserve the original master
12. expose active, interrupted, unverified, verified, failed, expired, and
    cancelled outcomes
13. remove or reconcile partial data after abort or expiry
14. provide a safe rollback path

Audio derivatives are not part of M1.

## Immediate non-goals

M1 does not:

- alter the accepted Phase 4A image upload path
- install speculative audio/video processors
- build a second Media authority
- build another jobs or outbox system
- use WordPress paths or services
- delete the preserved legacy Media rollback mirror
- build Audio or Video publication domains
- build transcripts, captions, waveforms, thumbnails, or renditions

## Next engineering action

Design the repository-owned M1 schema, commands, receiver contract, Nginx
contract, verifier, rollback, and interrupted-upload acceptance proof before
changing production.
