# WAKILISHA Migration Master Report

Generated at: 2026-05-30T17:45:58.900Z

## Acceptance Gate

- All CSVs load repeatedly: PASS
- Every main entity has canonical identity: PASS
- entity_relationships is no longer empty: PASS
- Every track has artist link or review reason: PASS
- Every release has tracklist or review reason: FAIL
- Old artist-genre links restored or flagged: PASS
- Chart entries linked or flagged: PASS
- Media assets linked or flagged: PASS
- Old routes resolved or flagged: PASS
- React page payloads possible: PASS

## Gate result: SOME CHECKS FAILED

## Relationship counts

- Total relationships: 20559
- Track artists: 7295
- Release tracks: 4293
- Artist genres: 131
- Playback sources: 9473
- Entity slugs: 0
- Chart entry tracks: 6332

## Relationship types

- track_artist: 7295
- release_track: 4293
- artist_genre: 131
- entity_media: 1094
- release_source: 1414
- chart_entry_track: 6332

## Review issue types

- track_artist_name_looks_combined: 1258
- possible_combined_artist_string: 641
- track_without_playable_metadata: 5547

## Graph coverage

- Tracks: 5549
- Tracks with artists: 5549
- Tracks without artists: 0
- Releases with tracklists: 559
- Releases without tracklists: -390
- Artists with genres: 131
- Chart entries linked: 6332
- Media assets linked: 1929
- Old routes resolved: 0
- Old routes unresolved: 0

## Route coverage

- Total old slugs: 0
- Active routes: 0
- Redirects: 0
- Retired: 0
- Duplicates: 0
- Flagged: 0
- Unresolved: 0

## Playback coverage

- Total tracks: 5549
- Tracks with preview: 1069
- Tracks with Apple ID: 7031
- Tracks with ISRC: 5549
- Tracks with artwork: 5549
- Tracks without playable: 4480

## Content classification

- Total: 1960
- Articles: 75
- Guides: 0
- Surface pages: 0
- App mounts: 0
- Taxonomy shells: 0
- Utility pages: 0
- Commerce pages: 0
- Retire: 0
- Review: 1920
