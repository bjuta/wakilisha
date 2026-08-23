# Mobile Account And Audio Hero Convergence Audit

## Scope

This follow-on candidate responds to visual acceptance of the Player mobile UX milestone. It does not reopen playback arbitration or previously closed Audio publication authority.

### Mobile chrome

- The mobile listener control, Search, Notifications, and section label float independently over the page. There is no full-width top-bar surface.
- The chrome uses the same scroll-direction contract as the mobile bottom navigation: downward scrolling hides it and upward scrolling restores it.
- The listener control opens a left account drawer instead of navigating directly to Profile.
- The drawer mirrors the shared desktop rail destinations and keeps Profile, Settings, Appearance, and Sign In as truthful account actions.

### Player chrome

- The expanded Player close and More controls are independent floating controls rather than children of a top container.
- Mobile Player top chrome follows the same scroll-direction behavior as the mobile shell.
- More remains a real action sheet. Internal playback diagnostics are not exposed as user-facing menu content.
- Queue mutation and playback arbitration are unchanged from the already tested candidate.

### Audio hero convergence

- `AudioHero` is the shared public Audio hero primitive.
- The Audio index and Audio detail listening surface consume the same primitive.
- Standalone Audio and Show Episode pages therefore share one hero grammar because both use `PublicAudioListeningSurface`.
- The detail hero preserves existing Listen, Continue, Open Player, Show navigation, Chapters, Transcript, and trust authority.

### Public Audio index authority

The repository previously had public readers for one Audio publication and one Show but no public directory reader. The Audio index must not read `audio.*` tables directly from the browser.

Migration `20260823160231_public_audio_index_authority.sql` adds `public.get_public_audio_index(integer)`. The function is `SECURITY DEFINER`, resolves records through the existing governed `get_public_audio_publication` and `get_public_show` readers, and grants execution only through the public application roles. It does not grant direct table reads.

Permanent verifier: `PUBLIC_AUDIO_INDEX_AUTHORITY_PASS`.

## Deployment State

- SQL migration: preview only
- Production SQL: not applied
- Edge function: no
- Readdy: no
- Frontend production deploy: no
- PR: not created
