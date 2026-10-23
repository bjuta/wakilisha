# October 23: Mobile chrome, social brand fidelity and private DM media

## Proven deployed baseline
- Owner screenshots show invisible white-on-white mobile nav controls in light mode, partly obscured Following records, unwanted Post action separator, cramped expanded Player controls, repeated author on the mobile Magazine hero, and no theme-aware wordmark in three social routes.
- Last accepted Production deployment: 60e0d727eb7931efc6a59a38ade3d2a9354a430b, with Gate D, immutable bundle parity, and public HTTPS success in the owner's supplied log.
- Use canonical /assets/logos/wakilisha-logo-dark.svg (white SVG paths, for dark surfaces) and /assets/logos/wakilisha-logo-light.svg (dark SVG paths, for light surfaces), selected by the actual ThemeProvider.

## Visual corrections
1. Mobile Menu/Search now occupy a legible surface with theme-token ink. Preserve the sole start-edge menu, global search, safe-area and hide-on-scroll behavior.
2. Following, Messages and Notifications use the same theme-aware, branded logo row, inside their authentic page sections.
3. Following and Notifications reserve the real 56px global mobile header; mobile section tabs remain in document flow to avoid clipping actors and content. Following's Post actions retain generous spacing without a separator.
4. Mobile Player top bar is a real three-lane control (close, truncatable title, ellipsis) occupying reserved layout height and using theme-token contrast in both palettes.
5. Article author is shown once, in the proper author/date/action byline below the mobile hero; structured author metadata is untouched.

## Media in DMs: supported reuse only below private authority
The existing `supabase/functions/media-upload-api/index.ts` permits ordinary authenticated users to upload **profile images only**. Audio/video resumable sessions require **admin** authorization. Its regular upload response exposes a public delivery URL. Neither interface can safely be used directly to send private DMs.

`src/services/messages.ts` sends a text body and optional governed resource/version references. It has no authorized voice-note/video-attachment command or conversation-scoped asset read permissions. We can reuse the existing receiver's blob transport, hashing, transcoding, waveform and delivery mechanics **behind a new private DM media authority**. A proper minimal slice must:
- start an upload only for a conversation participant with an active send permission; reject rejected/blocked/declined and unapproved request paths;
- store encrypted or otherwise access-controlled originals and derivatives in private namespaces with nonenumerable object keys and no public CDN path; enforce bounded MIME, size, duration, codec and integrity checks;
- run content scanning and moderation before message attachment admission; preserve Spam/Requests, retention, account retirement, legal preservation, reports, and participant-safe read receipts;
- bind one reviewed upload receipt to one immutable message attachment; prevent attaching another user’s files, cross-thread replay and arbitrary public URLs;
- return short-lived authenticated playback URLs only to authorized participants on every read, with `Cache-Control: private, no-store` semantics and reliable revocation;
- render duration, waveform and optional video poster or player using only server-verified media metadata, with accessible controls and a text fallback;
- test third-party denial, expired/revoked access, cross-thread references, malicious/oversized formats, mobile Safari/Chrome capture and replay and real sender-to-recipient delivery.

### Release boundaries
The UI fix does not pretend private media messages are already supported. It neither changes admin Media rights nor exposes audio/video upload in the Message composer. A dedicated governed data / Media / Messages slice is required before shipping a microphone or video action.

No SQL, Edge, Media origin or Registry writes are introduced in this visual patch. Protected Critical Core, Browser and aggregate checks must pass before merging. Production activation uses the accepted exact-merged-main runner, not a Preview deployment.
