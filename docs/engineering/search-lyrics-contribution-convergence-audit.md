# Search And Lyrics Contribution Convergence

## Scope

This correction keeps the existing Player, Search, Registry Track, and published Lyrics authorities intact while removing unnecessary interaction friction.

Search now begins as the search field itself. Quick-result structure and the full-search action appear only after the listener enters a query.

Missing Lyrics remain an action, not a disabled capability. Music Tracks with canonical Track routing can open the existing contribution path from the Player when published Lyrics are absent.

## Contribution Authority

The previous public contribution surface ended in a local submitted state and analytics event. It did not create a durable Lyrics submission.

`editorial.track_lyrics_contributions` now owns listener submissions separately from immutable published Lyrics versions. Authenticated listeners may submit plain or timed line payloads through `submit_track_lyrics_contribution`. Browser roles have no direct table access.

Admin review can read contributions for one Registry Track, reject a submission, or promote it into the existing working Lyrics draft. Promotion does not publish. The existing explicit `publish_track_lyrics_version` command remains the only path from a working version to public Lyrics.

## Public UX

The public contribution page defaults to plain text. A listener can paste or type Lyrics with one line per row and optionally provide a source. Timing is not required by the public workflow.

This leaves timing as editorial enhancement rather than contribution friction while preserving the underlying line-timing model for future use.
