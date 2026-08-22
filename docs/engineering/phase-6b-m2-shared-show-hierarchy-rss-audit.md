# Phase 6B M2: Shared Show Hierarchy + Audio RSS

## Status

Candidate architecture. No preview or production mutation has occurred.

Accepted base: `f47d08049fafd852e7b3f5cf4cbaf3fc91e5fbd0`.

## Why M2 changed before preview

The first M2 candidate treated Show and Episode as Audio-owned public identity and proposed `/audio/shows/:showSlug` plus `/audio/:episodeSlug`.

That was rejected before preview for two reasons:

1. WAKILISHA public entity URLs describe cultural identity, not implementation buckets. Music already scopes child identity by its durable parent instead of repeating the child type inside the URL.
2. Show is expected to become a shared cultural identity used by a future Video vertical. A media-agnostic `/shows/...` URL backed by `audio.shows` would create a shared public name over Audio-specific authority.

The corrected public grammar is:

- `/shows/:showSlug`
- `/shows/:showSlug/:episodeSlug`
- `/shows/:showSlug/feed.xml`
- `/audio/:slug` for Standalone Audio only

The Show already establishes that its child is an Episode, so an `/episodes/` segment is redundant and is not canonical.

## Primitive boundary

M2 promotes only the reusable identity residue that is already clear:

### Shared Show identity

A durable WAKILISHA Show exists independently of any one delivery medium.

Audio is consumer one. A future Video vertical may bind to the same Show identity without creating another Show or changing the canonical URL.

### Shared Show Episode identity

A canonical child under a Show is also media-independent. The same Show Episode may later have Audio and Video renditions.

The public canonical path is therefore owned by Show Episode identity, not by the Audio publication:

`/shows/:showSlug/:episodeSlug`

### Not promoted in M2

Season remains Audio-specific context in M2. There is only one proven consumer and future Video season semantics have not yet been proven equivalent.

Audio publication/version, Media delivery, transcript, chapters, waveform, Trust, Review, RSS enclosure identity, and playback remain Audio-domain authority.

M2 does not create a generic media-content table, generic rendition lifecycle, second uploader, second Review system, or second Media authority.

## Existing Audio compatibility

Phase 6A created `audio.shows`, `audio.seasons`, and Audio Episode publications before the cross-media public requirement existed.

M2 does not destructively remove those governed Audio workspace identities. Instead:

- `editorial.shows` owns shared Show identity.
- `editorial.show_episodes` owns shared Show Episode identity.
- an Audio Show binds to one shared Show;
- an Audio Episode publication binds to one shared Show Episode;
- existing governed Audio commands remain the first writer and transactionally maintain the shared identity projection;
- public Show reads resolve through the shared identity and then attach the currently public-safe Audio rendition.

Future Video must bind to the shared identity rather than creating `video.shows` as a competing public authority.

## Production data fact

Immediately before this correction, production contained:

- 0 Audio Shows;
- 0 Audio Seasons;
- 0 Audio Episodes;
- 1 Standalone Audio publication.

This is therefore the correct migration window. No real episodic public identity needs to be rewritten.

## Canonical URL rules

### Show

`/shows/:showSlug`

### Show Episode

`/shows/:showSlug/:episodeSlug`

Season does not enter the canonical Episode path. Reorganizing a Show into seasons must not rewrite Episode URLs.

### Standalone Audio

`/audio/:slug`

The M1 route remains, but M2 makes the browser service accept only `publication_kind = standalone` at that route.

### RSS

`/shows/:showSlug/feed.xml`

RSS is an Audio delivery representation of the shared Show, not the Show identity itself.

### Enclosure

`/audio/enclosures/:publicationId.mp3`

The enclosure URL remains Audio transport identity. It is not a cultural entity URL and does not move under `/shows`.

## Authority rules

1. `show` and `show_episode` are new shared Resource kinds.
2. Their typed rows live in the shared `editorial` authority, not `audio`.
3. Browser roles receive no direct table access.
4. Audio Show/Episode creation transactionally establishes the shared identity when missing.
5. Audio metadata updates synchronize shared identity fields while the identity is private/internal.
6. Once a Show or Show Episode has a published Audio Episode, its canonical slug is frozen until governed redirect support exists.
7. Publishing an Audio Episode makes the shared Show and shared Show Episode publicly visible.
8. Public Show/Episode resolvers expose only identities with a current Audio rendition that still passes the exact M1 public-safety resolver.
9. Working/submitted/approved Audio state and raw metadata never enter public Show payloads.
10. Future Video is required to bind to the shared Show/Show Episode identity rather than recreate it.

## Public read shape

`public.get_public_show(text)` resolves shared Show identity and public-safe Show Episodes. Each Episode contains shared identity plus an `audio` rendition produced by the exact M1 Audio resolver.

`public.get_public_show_episode(text,text)` resolves one shared Show Episode and its current public-safe Audio rendition.

The shape deliberately leaves room for a future `video` rendition without changing Show/Episode identity or URLs.

## RSS rule

RSS is rendered from `public.get_public_show(text)`.

For each item:

- `<link>` uses `/shows/:showSlug/:episodeSlug`;
- GUID uses the immutable Phase 6A Audio publication GUID;
- enclosure uses the immutable branded Audio enclosure URL;
- the raw Media derivative URL is never substituted for enclosure identity.

## Primitive impact

Shared Show and Show Episode identity are authority-level reusable residue with Audio as the first real consumer.

They are not declared canonical across domains merely because Video is anticipated. The second real consumer must still prove semantic equivalence before maturity is promoted.

Public listening continues to reuse the existing WAKILISHA Player. `MediaTransport` and `MediaTimeline` remain Audio-editorial candidates and are not promoted by this milestone.

## Explicitly out of scope

- Video publication authority;
- generic media rendition lifecycle;
- shared Season authority;
- scheduling engine;
- public Audio search;
- Corrections UX;
- RSS directory submission automation;
- artwork authority;
- redirect/history support for public Show slugs;
- replacing the existing global Player.
