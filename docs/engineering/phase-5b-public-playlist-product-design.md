# Phase 5B: Public Playlist Product

Date: 9 August 2026

## Status

Phase 5A is closed.

Phase 5B is active.

The authoritative programme requires:

- public collection and detail routes
- responsive playback
- citations
- provenance
- corrections
- scheduling
- SEO
- cached read model
- migration of useful existing drafts

The exit gate is one real Playlist reviewed and published end to end.

## Product standard

The public Playlist is a flagship WAKILISHA music product.

It must not feel like a database record rendered on a web page.

The public experience is built around:

1. cover
2. title
3. curator
4. curatorial proposition
5. immediate listening
6. ordered track composition

Institutional depth supports those goals without competing with them.

The intended standard is strong enough that the Playlist product can set a new
quality bar for future WAKILISHA public surfaces.

## One player

A Playlist never owns a player.

WAKILISHA owns one player and a Playlist feeds an ordered queue into it.

Public Playlist surfaces may:

- start playback
- start playback from a particular track
- show the current track
- show progress
- show play and pause state
- react visually to queue state

They must not create independent playback state or separate user-facing
provider players.

Provider integrations are playback engines behind the global WAKILISHA player.

Initial playback engines are:

- governed audio or Registry preview
- Apple Music through the existing MusicKit integration
- YouTube through the YouTube IFrame Player API
- SoundCloud through the SoundCloud Widget API

Spotify evidence may remain attached to a Playlist item. Where a governed audio
preview exists, the global player may use that preview. A provider identity does
not require WAKILISHA to expose that provider's own player.

The global player remains responsible for:

- current track
- queue
- play and pause
- next and previous
- seek
- volume
- shuffle
- repeat
- persistent playback across navigation
- listening history
- analytics
- desktop PlayerDock
- MobileFullPlayer

## Provider playback canvas

The global player may use provider SDKs and embedded playback engines, but
provider playback does not create a second WAKILISHA player.

WAKILISHA remains responsible for:

- queue state
- current track state
- play and pause controls
- seeking
- next and previous
- volume
- repeat and shuffle
- persistent playback
- listening history
- analytics

Provider rendering requirements are respected inside a global provider canvas.

For YouTube, the provider canvas must retain a compliant visible player viewport.
It must not use an invisible or zero-sized iframe. WAKILISHA controls remain the
primary playback controls.

When the full player is open, the provider canvas occupies the media presentation
area normally used by artwork.

When the global player is collapsed, provider playback that requires a visible
viewport must remain visibly represented without creating independent playback
state or provider-specific queue controls.

SoundCloud playback is controlled through its Widget API behind the same global
player state.

The provider canvas must remain part of the persistent player layer so route
navigation does not create a new playback session.

Phase 5B does not create a video-native WAKILISHA player. YouTube playback
uses the existing global player's media slot only because the provider requires
a visible embedded player. WAKILISHA continues to own queue state, transport,
seeking, volume, repeat, shuffle, listening history, and navigation persistence.

Video-specific presentation, video-native controls, picture-in-picture,
orientation behavior, and other dedicated video product work remain outside
Phase 5B and belong to the later Video phase.

## Normalized playback descriptor

The public Playlist read model exposes one normalized playback descriptor per
track.

The descriptor expresses:

- whether the item is playable
- which global-player engine should handle it
- provider identity where relevant
- provider URL where relevant
- provider object identity where relevant
- governed preview URL where available
- fallback preview URL where available

The public Playlist component does not interpret provider-specific database
fields directly.

## Public authority

Publication may only use the exact current approved Playlist version.

Publication creates a new immutable `published` Playlist version.

The published version receives:

- exact Playlist metadata
- exact cover asset and revision
- exact ordered items
- exact Playlist-item Resource identities
- exact Registry identities present at publication
- exact provider evidence present at publication
- copied version-bound Citations
- copied version-bound Credits
- publication actor and time
- command receipt
- content fingerprint

Later working edits do not mutate the published Playlist.

## Cached public read model

The browser must not reconstruct a public Playlist from editorial tables.

Publication materializes an immutable cached public snapshot.

The snapshot contains the public composition required to render the Playlist
quickly:

- Playlist identity
- slug
- title
- description
- curator
- governed cover delivery
- item count
- ordered track presentation
- Registry route identity
- normalized playback descriptors
- publication provenance

Shared Trust remains authoritative for governance-sensitive public presentation.

Public Credits, Citations, Sources, and Corrections are resolved server-side
against their current public-safe governance when the public detail RPC is
read.

This prevents a withdrawn Source or Credit from remaining exposed merely
because an older Playlist snapshot cached its display text.

## Registry links

Where a published item is matched to Registry, the public snapshot captures the
stable WAKILISHA route identity available at publication.

Provider identity does not replace Registry identity.

## Corrections

Public correction notes come from the shared Corrections authority.

Playlist does not create a second correction system.

A correction note may target the Playlist Resource or a Playlist-item Resource.

## Mobile

Mobile is a primary Playlist experience.

The mobile page is not a compressed desktop layout.

Playback must remain persistent through the global player and the ordered
tracklist must remain comfortable to browse and operate with one hand.

## M218 boundary

Migration 218 owns:

- governed Playlist publish command
- approved to published immutable version transition
- immutable cached publication snapshot
- normalized playback descriptor in that snapshot
- public collection read RPC
- public detail read RPC
- shared public Trust and correction projection
- public Resource pointer activation

M218 does not own:

- scheduling
- archive or restore commands
- public React routes
- visual design
- PlayerContext provider adapters
- SEO build integration

Those remain Phase 5B work after the publication contract is proven.

## Acceptance

M218 passes when:

1. only the exact current approved version can publish
2. stale Playlist revision is rejected
3. publishing is idempotent
4. publication creates one immutable published version
5. publication advances both Playlist and global Resource public pointers
6. publication creates one immutable cached snapshot
7. the public collection returns only published Playlists
8. the public detail route returns only the active published version
9. draft and approved-only work cannot leak publicly
10. public Trust respects current public-safe governance
11. public correction notes reuse shared Corrections
12. mixed provider items receive normalized global-player descriptors
13. no provider-specific user-facing player is introduced

## Playback acceptance checkpoint

Phase 5B playback runtime acceptance proved one global WAKILISHA player across preview audio, Apple Music, YouTube, and SoundCloud-backed Playlist items. Provider switching is exclusive, seeking is synchronized with WAKILISHA state, full-player expansion preserves playback, and navigation preserves the active queue and position.

Registry-backed tracks may carry Apple Music catalog identity independently of their primary Playlist playback engine. When Apple Music is connected, full Apple playback takes precedence over preview audio. Siaka was accepted as the real production-backed proof of this behavior through Registry Apple Music song identity `1882060090`.

The collapsed mobile player seek interaction remains deferred to dedicated player UI work. Full-player mobile seeking and playback correctness are accepted. Phase 5B does not add further interaction complexity to the collapsed mobile dock.
