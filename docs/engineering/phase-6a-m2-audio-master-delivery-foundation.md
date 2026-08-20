# Phase 6A M2: Audio Master and Full-Length Delivery Foundation

Date: 20 August 2026

## Status

Local candidate contract.

M2 starts from accepted Phase 6A M1 production authority and the accepted Phase 4 Media processing system.

## Objective

Give an Audio Episode or Standalone Audio publication an exact immutable Media master and a governed full-length delivery derivative without creating a second Media system or beginning the Audio Review/publication lifecycle early.

M2 establishes:

- one governed current Audio master attachment per playable Audio publication
- exact Media asset revision binding, never a moving current-revision reference
- Audio working-version fingerprints that include exact master identity
- immutable Audio version snapshots that preserve exact master identity
- immutable Audio version snapshots that preserve the selected full-length delivery variant when one exists
- one new full-length Media variant role
- one new additive Audio publication processing profile
- one processing submission adapter that reuses the accepted Media command receipt, job, outbox, lease, retry, dead-letter, variant, and CDN authorities
- one service-role output-registration adapter for the new profile

## Why M2 comes before Review

A submitted or approved Audio version must eventually identify exactly what was heard.

M1 versions currently preserve editorial metadata but intentionally have no Media dependency. Review should not be built on top of a publication whose master can drift or whose only playable derivative is a 30-second preview.

M2 therefore closes the file identity boundary first.

## Existing Media authority remains authoritative

M2 does not create another:

- uploader
- storage namespace
- Media asset identity
- Media revision model
- processing queue
- processing worker
- retry ledger
- outbox
- variant table
- variant-selection table
- delivery origin

The existing Phase 4 Media system remains the authority for all of those concerns.

## Preserve `audio-v1`

The accepted Phase 4 processing profile `audio-v1` is an immutable transformation contract.

It continues to produce exactly:

- `audio_preview`, first 30 seconds, MP3 128 kbps
- `waveform_data`, bounded peak-envelope JSON

M2 does not change that profile or broaden the accepted v1 submission/output RPCs.

## Full-length processing profile

M2 adds:

`audio-publication-v1`

It produces exactly one governed derivative:

`audio_delivery`

The first contract is:

- full-length source duration
- MP3
- `audio/mpeg`
- stereo
- 128 kbps
- stripped source metadata
- deterministic immutable derivative path
- no 30-second duration cap
- public immutable delivery through `media.wakilisha.africa`

The profile reuses the same `media.process_revision` command type and job type so claim, lease renewal, retry, dead-letter, completion, and failure behavior remain Phase 4 authority.

## Audio master attachment

M2 adds Media usage role:

`audio_master`

The relationship is stored in canonical `media.usage_links` because Media already owns exact asset revision usage.

The current Audio publication master uses:

- `target_authority = 'editorial'`
- `target_kind = 'audio_publication'`
- `target_id = audio.publications.id`
- `usage_role = 'audio_master'`
- `resolution_mode = 'exact_revision'`
- no target version identity

The attachment must point to:

- an active Media asset
- `asset_kind = 'audio'`
- an exact revision belonging to that asset
- a verified original file object
- a protected Lightsail master under `masters/audio/`

Draft master attachment does not require final public rights approval. Rights, consent, embargo, and public-safety approval remain publication/review concerns. Requiring them here would incorrectly turn internal editing into public Media governance.

## One writer for Audio master placement

Generic `public.attach_media_usage()` is not broadened in M2.

The `audio_master` role is guarded so it can be changed only through:

`public.set_audio_publication_master(...)`

That command:

- requires Audio edit authority
- accepts the expected Audio authority revision
- is idempotent
- supports setting, replacing, and clearing the current master
- archives the prior usage instead of deleting history
- records Media usage events
- increments Audio publication authority revision only when the master actually changes
- rejects master mutation outside `draft` and `changes_requested`

The generic Media usage API continues to know only its accepted target vocabulary.

## Working-version law

M2 adds nullable immutable Media snapshot fields to `audio.publication_versions`:

- `master_media_asset_id`
- `master_media_revision_id`
- `audio_delivery_variant_id`

Existing M1 versions remain valid with all three fields null.

`audio.publication_content_fingerprint()` now includes the current exact master asset, exact master revision, and currently selected `audio_delivery` variant.

Consequences:

- attaching or replacing a master changes the working fingerprint
- clearing a master changes the working fingerprint
- producing or advancing the selected full-length delivery variant changes the working fingerprint
- an unchanged master and unchanged delivery selection still reuse the current working snapshot

`audio.insert_current_publication_snapshot()` copies those exact identities into the immutable version row.

A delivery variant is allowed to be null in M2 because master attachment and asynchronous processing are separate operations. A later Review milestone must require a valid full-length delivery before submission or approval.

## Processing submission boundary

M2 adds:

`public.submit_audio_delivery_processing_v1(...)`

It is an additive adapter rather than a replacement for `submit_media_processing_command_v1`.

It:

- requires administrator or `manage_media_assets`
- accepts one exact Audio Media asset revision
- requires that revision to be actively attached as an `audio_master` to at least one Audio publication
- records profile `audio-publication-v1`
- writes the existing `media.process_revision` command receipt and durable job authority
- preserves existing idempotency and accepted-event behavior

The Audio Editor can later wrap this Media capability with an Audio-owned product flow if ordinary Audio editors need to request processing without global Media-management capability. M2 does not weaken Media permissions pre-emptively.

## Output registration boundary

M2 adds a service-role-only registration adapter for `audio-publication-v1`.

It accepts exactly one `audio_delivery` output and verifies:

- the active worker lease
- immutable source identity
- exact deterministic protected and public paths
- MP3 MIME and transformation contract
- SHA-256 and byte size
- generator identity
- the exact Media asset revision

It then reuses canonical Media file-object, variant, variant-selection, and Media event tables.

## Explicit non-goals

M2 does not:

- modify `audio-v1`
- modify the Phase 4 preview/waveform contract
- create Audio Review or publication commands
- create stable RSS GUID or enclosure identity
- attach Sources, Citations, or Credits
- attach transcript or caption Media
- create Chapters
- build the Audio Editor
- create public Audio routes
- alter the global player
- create RSS
- create public Audio SEO
- backfill the four Phase 4 technical Audio fixtures into Audio publications

## Local acceptance

The local candidate must prove:

1. M1 focused contracts still pass.
2. Phase 4 durable Media processing contracts still pass.
3. `audio-v1` remains a two-output 30-second preview contract.
4. `audio-publication-v1` is additive and full length.
5. generic Media usage target validation is not broadened to Audio.
6. Audio master placement is governed by an Audio command.
7. Audio version fingerprint and snapshot semantics include exact master and delivery identity.
8. the permanent M2 verifier is read-only.
9. Python worker syntax passes.
10. `git diff --check` passes.

## Preview acceptance

A fresh disposable Supabase preview must first prove the complete accepted baseline replays before M2 is applied.

After M2, preview behavior must prove at minimum:

1. Episode creation still creates working Version 1 with null Media snapshot fields.
2. an exact verified Audio master can be attached idempotently.
3. duplicate replay creates no duplicate usage or receipt.
4. stale Audio revision rejects master replacement without changing usage.
5. replacing the master archives the prior usage and increments Audio authority revision exactly once.
6. generic Media attachment cannot create or mutate `audio_master` usage.
7. snapshot after master attachment creates a new immutable working version carrying exact asset and revision identity.
8. unchanged snapshot reuses that version.
9. a new `audio-publication-v1` processing command creates one ordinary `media.process_revision` durable job.
10. the Media worker creates one full-length `audio_delivery` derivative.
11. output registration is idempotent and selects the immutable delivery variant.
12. snapshot after delivery selection creates the next working version and freezes the exact delivery variant.
13. old `audio-v1` processing still produces only preview and waveform.
14. Audio version rows remain immutable.
15. Audio generic Article-version pointers remain null.
16. the permanent M2 and M1 verifiers pass.
17. preview fixtures are removed before preview deletion.

## Following work

Once M2 is proven in production, the next coherent dependency is Audio Review and publication lifecycle, including stable publication identity requirements. That later milestone can require a master and full-length delivery because M2 makes both identities durable first.
