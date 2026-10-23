# Workbook P6-P8 social fidelity: October 23, 2026

## Authority
- Owner-provided `MIZIZI WAKILISHA Brand Workbook (2).html`, sections P6 Following, P7 Messages, P8 Notifications (desktop frame 1280px, phone frame 390px).
- Owner-provided live Following PDF from October 23, 2026, 13 pages. The screenshots expose tightly packed feed controls and spacing that differ from P6.
- Current product schema, authorization, read models, and accepted workflows control behavior. The workbook controls presentation, not fabricated data or privileges.
- Baseline main before the patch: `f91cb07cfb3da20a9ac7ecc8db60db965762a33e`.

## Exact visual treatment
P6: 600px primary timeline and right discovery rail; 44px avatar lane, 12px gutter, 3:2 photos, 1:1 Release covers, artist-only filter, spacious post actions with Lucide MessageCircle, Repeat2, Heart, Bookmark and Share2. Existing Post action and share services are reused. The desktop composer retains the question `What are you listening to?`; mobile keeps the actual floating composer. No fictional recommendations, verification badges, or counters.

P7: wider left conversation rows with actual per-thread unread counts, a right-aligned live conversation on desktop, a full-viewport conversation view on phone with back-to-list and the composer at the thumb edge. Received messages use the raised neutral surface and left clipped corner. Sent messages use the brand color and a right clipped corner. Actual accepted message dates establish day breaks; read receipt appears below the last sent message only if the server supplies `recipient_read_at`. Governed resource references remain inside the appropriate bubble. The global mini-player chrome and mobile top bar step aside only while a phone thread is open.

P8: 600px notification column, grouped genuine unread `New` then read `Earlier`, type-tinted event icon, actor, copy, timestamp at far edge, source-supported filters, and the `Tell me about` settings rail. Only existing notification preference RPC keys are editable. Event destination, read state and rights are unchanged.

## Deliberately deferred: no fake features
- The workbook shows a voice-note waveform and inline Recording card. Current `MessageRow` carries text plus `MessageResourceReference` with only `resource/version` presentations, and `sendMessage` has no authenticated media upload/transcode/playback model. Showing a working-looking mic or playable waveform without authorized storage, safety scans and playback is not acceptable. A separately approved media-message contract and acceptance suite is needed before voice notes can be sent or played.
- The workbook's verified badge is out of scope, as explicitly instructed.
- Workbook example people, posts, releases, counts, Pre-save actions and notifications are illustrative, not production data. No invented interactions, preferences, media, or Registry mutations.

## Gate and rollout
- Frontend+tests+documentation only; no SQL, migration, RLS, Supabase Edge or API shape modification.
- Protect exact-head Critical Core, Browser and aggregate checks. CI must include source integrity and real-browser responsive behavior; authenticated data parity requires live user acceptance.
- Release uses the existing Mac-side exact-merged-main production runner after merge, with no preview stage.
