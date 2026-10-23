# October 23: Mobile chrome, social brand fidelity and private DM media

## Proven deployed baseline
- Owner screenshots show invisible white-on-white mobile nav controls in light mode, partly obscured Following records, unwanted Post action separator, cramped expanded Player controls, repeated author on the mobile Magazine hero, and no theme-aware wordmark in three social routes.
- Last accepted Production deployment: 60e0d727eb7931efc6a59a38ade3d2a9354a430b, with Gate D, immutable bundle parity, and public HTTPS success in the owner's supplied log.
- Use canonical /assets/logos/wakilisha-logo-dark.svg (white SVG paths, for dark surfaces) and /assets/logos/wakilisha-logo-light.svg (dark SVG paths, for light surfaces), selected by the actual ThemeProvider.

## Visual corrections
1. Mobile Menu/Search now occupy a legible surface with theme-token ink. Preserve the sole start-edge menu, global search, safe-area and hide-on-scroll behavior.
2. Following, Messages and Notifications place the theme-aware wordmark in the existing mobile nav bar, between Menu and Search. There is no page-level brand row or desktop duplicate.
3. Following and Notifications reserve the real 56px global mobile header; mobile section tabs remain in document flow to avoid clipping actors and content. The desktop feed starts directly beside the sidebar, and Post actions keep their spacing without a separator.
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

## October 23 workbook correction
PR #1291 accidentally placed an extra WAKILISHA wordmark row inside the Following, Notifications and Messages pages. This corrective release removes those rows on all breakpoints, and instead shows one wordmark inside the existing mobile app bar. Messages also removes the extra 56px list padding.

The Notifications heading no longer displays the aggregate unread total. Conversation-specific unread numbers are sourced from the existing Messages API and associated with the matching conversation ID in each DM notification. The first notification for each conversation displays that number, and the link opens the corresponding conversation. Mark All Read still changes Notification read state, never DM read receipts.

Magazine article routes return the same nav bar to transparent, white-on-hero overlay styling while the hero remains behind it. It becomes a contrast-safe solid surface once the hero scrolls away. No negative article offset, extra nav, or desktop logo is introduced.


## October 23 decision: transparent mobile navigation becomes the global default

The single `MobileTopBar` is now a **transparent overlay on every ordinary mobile route** (not a new header and never a desktop header). Its Menu and Search icons invert against the actual underlying surface using per-control difference blending, not a white/black recolouring of the official WAKILISHA SVG. Social routes retain the canonical, theme-selected wordmark in the same existing mobile bar only. The user's established scroll direction behavior remains unchanged: hide on downward intent, reveal on upward intent.

Hero-bearing mobile page compositions start at the viewport's top edge, underneath that bar: Magazine cover and article, Music, Video, Audio, Podcast lead artwork, Charts directory and edition, and artist profiles. The former first-row filter and search controls on Video now follow its published feature; on Audio the published lead feature precedes the title/discovery row only on mobile. Old negative top pulls in Charts directory and artist hero were removed for mobile only. Desktop keeps the sidebar and the accepted existing composition, including desktop content order.

Text-first mobile routes reserve one actual safe-area-aware 56px bar height so their first controls cannot be hidden. Following, Notifications and the Messages list continue to manage their own existing single reservation, and a selected DM retains its dedicated conversation header rather than stacking a second global bar on top of it. Auth remains shellless. No route, data, entitlement, theme SVG, message authorization, SQL schema, Edge Function or deployment procedure was changed.

**Acceptance**: extend the existing source contracts and real-browser suite, including Magazine, Charts, Video, Audio, Podcasts and Music at mobile width, checking a fully transparent computed nav background, a real hero at viewport y=0 when published and no additional desktop mobile bar. This is frontend-only; Production still requires the established exact-merged-main Mac activation and live visual acceptance.
