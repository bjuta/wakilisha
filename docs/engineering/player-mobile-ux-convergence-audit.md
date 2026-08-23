# Player and Mobile Media UX Convergence

Date: 2026-08-23

## Scope

This pass borrows interaction patterns from the supplied mobile media references without cloning another product. It keeps WAKILISHA identity, tokens, language, authority, and playback semantics.

The current production player already has the correct media split and the global playback arbiter. This pass does not reopen either authority.

## Patterns Adopted

1. Mobile app chrome places the listener at the top left, keeps the current section centered, and keeps Search plus Notifications close at hand.
2. The expanded player keeps a dedicated dismiss action on the left and makes the top-right ellipsis open real contextual actions.
3. Now Playing gives artwork, title, creator, progress, and primary transport the strongest visual hierarchy.
4. Secondary actions are reduced to the actions most useful during playback. Less frequent actions move into More.
5. Queue becomes a managed listening surface with Now Playing, Up Next, played history, reorder controls, removal, and Clear Up Next.
6. Shuffle and Repeat move into the Music Queue surface, where play-order controls belong.
7. Lyrics and Transcript use the same timed-text presentation mechanics while remaining separate domains.
8. Queue, Lyrics, Transcript, Chapters, and More use one responsive sheet grammar. Mobile uses a bottom sheet. Desktop uses a right-side panel.

## Authority Boundaries

No database migration is required.

Queue edits are local playback-session state only. They do not mutate Playlist order, Registry Track authority, listening history authority, or editorial publication state.

The More sheet exposes only actions already backed by existing capabilities and authority. It does not add Sleep Timer, output routing, hard delete, Audio playlist membership, or other unproven actions.

Music keeps Track controls. Spoken Audio keeps time-first controls. The UI does not project Track-only actions onto Audio.

## Explicit Non-Scope

- No playback-engine changes.
- No Apple Music authorization changes.
- No Supabase authority changes.
- No new persistent queue storage.
- No new social or contribution authority.
- No redesign of the desktop Music landing page.
- No removal of the hidden legacy MobileFullPlayer in this pass.

## Acceptance

The candidate must prove:

- top-right player ellipsis opens More;
- mobile app chrome shows the listener at top left on app-like routes;
- Queue shows Now Playing and Up Next;
- queued Tracks can move earlier, move later, or be removed;
- Clear Up Next preserves the current Track;
- Shuffle blocks manual reorder rather than lying about order;
- Lyrics and Transcript remain timed and seekable;
- Music uses Previous and Next;
- spoken Audio uses back and forward by seconds;
- focused player tests, public route audit, diff hygiene, and `build:app` pass before commit.
