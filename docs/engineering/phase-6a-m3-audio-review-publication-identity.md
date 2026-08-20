# Phase 6A M3: Audio Review and Publication Identity

Date: 20 August 2026

## Status

Candidate authority closure slice prepared against accepted production M1/M2 contracts.

## Objective

Move an Audio Episode or Standalone Audio publication from an exact M2 working identity through typed Review into one immutable published version with a stable podcast GUID and stable enclosure identity.

M3 is intentionally the first of the final two Phase 6A closure commits.

## What M3 adds

- append-only typed Audio Review events
- governed submit-for-Review command
- governed start-review, request-changes, and approve decisions
- exact submitted -> approved -> published immutable version copying
- stale submitted-version rejection when Audio content or Media identity changes after submission
- publish capability adapter using the existing `publish_audio` capability
- last-moment Media public-safety validation before Review and before publish
- stable podcast GUID identity derived from permanent Audio publication UUID
- stable enclosure URL identity derived from permanent Audio publication UUID
- immutable publication snapshots binding the published version to the exact immutable CDN source URL, MIME type, byte size, SHA-256, and duration when known
- permanent read-only verification

## Fingerprint correction required by Review

M1 fingerprints included lifecycle `status` because Review did not exist yet.

M3 removes lifecycle status from `audio.publication_content_fingerprint()` while preserving:

- publication kind
- Show / Season / Episode identity
- slug
- title
- summary
- metadata
- exact master Media asset
- exact master Media revision
- exact selected `audio_delivery` variant

This means moving identical cultural content through `draft`, `ready_for_review`, `in_review`, `approved`, and `published` does not pretend the content itself changed.

Lifecycle state remains present in immutable version snapshots as audit context; it simply stops participating in the cultural-content fingerprint.

Existing M1/M2 snapshots remain immutable historical rows with their historical fingerprints.

## Review doctrine

M3 follows the proven Playlist pattern without pretending Review is one universal SQL command.

Audio keeps domain-specific Review functions while reusing:

- shared command receipts
- idempotency keys
- expected-revision concurrency
- shared Review capabilities
- immutable version doctrine
- transactional outbox events

Review always targets the exact current submitted Audio version.

If metadata or selected Media identity changes after submission, the current fingerprint no longer matches the submitted fingerprint and Review rejects the stale submission.

## Media publication gate

M2 deliberately allowed a draft working version to exist before full-length delivery or public rights approval.

M3 closes that boundary for Review/publication.

Before Audio enters Review, current Audio Media must have:

- an exact `audio_master` Media asset/revision
- a selected exact `audio_delivery` variant for that same revision
- verified `audio/mpeg` output
- non-zero byte size
- immutable Media CDN delivery URL
- active Media asset state
- current Media governance marked `approved_public` or `approved_redacted`
- consent `granted` or `not_required`
- rights not `restricted`
- embargo state `none` or `released`

Publish repeats the Media public-safety check against the exact approved version. A Media governance change after approval can therefore block publication rather than leaking an asset that is no longer public-safe.

## Stable GUID and enclosure identity

Podcast identity must not depend on mutable slugs or titles.

M3 therefore defines:

- GUID: `urn:uuid:<audio-publication-id>`
- stable enclosure URL: `https://wakilisha.africa/audio/enclosures/<audio-publication-id>.mp3`

Both derive only from permanent Audio publication UUID and are immutable once created.

The immutable publication snapshot separately records the exact Media CDN source URL and integrity metadata used by that published version.

M3 defines the feed identity contract; Phase 6B delivers the public RSS/feed route.

This separation lets the stable enclosure URL remain constant while the public delivery layer can resolve it against the approved immutable source contract.

## Public Audio boundary

Publishing in M3 means canonical Audio authority has a public version and publication snapshot.

M3 does not claim the public product exists yet.

The public show/episode routes, enclosure resolver, RSS XML, accessible playback, transcript navigation, SEO, search, and cached public read models remain Phase 6B.

## M3 does not:

- build the Audio Editor
- build public Audio routes
- generate or serve RSS XML
- attach Chapters or Transcripts
- add Audio Trust mutation adapters
- build scheduling
- build public Corrections presentation
- alter the global player
- create another Media processor or queue

## Acceptance target

Before M3 becomes the first closure commit, a disposable production-equivalent preview must prove:

1. accepted production baseline replays before M3 applies
2. exact M3 migration applies once
3. M1 and M2 permanent verifiers still pass
4. a draft with no public-safe full-length delivery cannot submit
5. a public-safe exact M2 master + delivery can submit idempotently
6. replay creates no duplicate submitted version, event, or receipt
7. stale expected Audio revision rejects submission without lifecycle change
8. post-submit content or Media drift prevents approval of the stale submitted version
9. start-review and request-changes transitions are append-only and auditable
10. approval creates an exact immutable copy of the submitted version
11. publication requires the exact current approved version
12. Media governance changed to non-public after approval blocks publication
13. first publish creates one stable feed identity and one immutable publication snapshot
14. published version freezes the exact approved Media identity
15. GUID and enclosure URL are independent of mutable slug/title
16. Article-only generic Resource version pointers remain null for Audio
17. idempotent publish replay creates no duplicate published version or publication snapshot
18. permanent M3 verifier passes read-only
19. focused M1/M2/M3 and critical regression suites remain green
20. production remains unchanged until preview seal and merged-main promotion

## Final Phase 6A closure commit after M3

The second and final permitted Phase 6A commit will close the internal product:

- Chapter authority
- Transcript Media attachment/version authority
- Audio-specific Citation and Credit adapters through shared Trust
- canonical Audio Editor workspace
- review/publish controls wired to M3
- final 6A production acceptance

After that, work moves immediately to Phase 6B public Audio.
