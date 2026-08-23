# Player and Editorial Convergence Correction

Date: 2026-08-23

## Scope

This correction closes five regressions without creating parallel product systems:

1. One audible global playback session across HTML Audio, Apple Music, YouTube, and SoundCloud.
2. One public listening grammar with media-specific capabilities for Music and spoken Audio.
3. One shared desktop public shell with in-place Search.
4. One canonical Admin Record Actions rendering boundary whose consumers retain domain authority.
5. Durable Lyrics authority keyed to canonical Registry Track identity.

## Playback invariant

WAKILISHA owns one player. A new playback selection invalidates older startup work before the new engine becomes authoritative. Stale asynchronous provider completions cannot become audible or mutate the current playback state.

Music keeps sequence-first transport: Previous, Play/Pause, Next, Shuffle, Repeat, Queue, Lyrics, Save, Add to Playlist, Moments, Share, and Details where capability and authority exist.

Spoken Audio keeps time-first transport: back 15 seconds, Play/Pause, forward 15 seconds, Chapters, Transcript, playback speed, Queue when sequence context exists, Share, and Details. Track-only actions are not projected onto Audio.

## Lyrics authority

The former in-memory moderation placeholder is retired. Lyrics now use immutable versions attached to `registry_tracks`, optimistic authority revisions, explicit working and published pointers, capability-gated editorial writes, and a published-only anonymous read RPC.

This phase does not invent contribution voting, community moderation, translations, or a licensing workflow. Those require separate authority and product decisions.

## Audio record lifecycle

Audio Archive and Restore are reversible governed commands. Archive removes the public publication pointer, marks the Resource private/archived, preserves immutable Audio history, records an append-only lifecycle event, and uses command receipts. Restore returns the publication to Draft/Internal; it does not silently republish.

## Shared primitives

`AdminRecordActions` owns only action rendering semantics. Article, Playlist, and Audio continue to decide which actions are valid based on their own authority.

Lyrics and Transcript share timed-text parsing/navigation mechanics only. They remain distinct domains.

## Deployment

Both database changes were first applied and verified on disposable preview project `ryztjudjxakjnmwfklsq`, branch `d2d15da7-d8c5-4b56-9bb2-9b53f76f36ad`.

Preview migration head:

- `20260823123222_admin_audio_archive_restore_authority`
- `20260823133531_track_lyrics_authority`

Production remains unchanged until the combined two-commit candidate passes CI, merge, governed database promotion, frontend deployment, and production smoke.
