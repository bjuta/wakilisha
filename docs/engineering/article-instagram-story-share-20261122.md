# Article Instagram Story share: full-bleed export contract

**Scope:** public published WAKILISHA Magazine Articles, shared desktop/mobile UI.
**Branch:** feat/article-instagram-story-fullbleed.
**Status:** Original Story renderer and unified share destination are deployed. Backend allowlist and image-handoff counting shipped in #1437. iOS post-handoff counting is a documented outstanding defect and this follow-up candidate changes the frontend only; real-device acceptance is not yet complete.

## Design authority

The current Article hero is the reference. Use the exact editor-selected featured image, full-bleed at 1080 × 1920 with object-fit: cover and a dark photographic text scrim. Use the existing CSS variables for Figtree display/body fonts and brand green (#85C441), and match the Article hero's heavy white, tight-spaced editorial headline. The header must draw the site's existing `public/assets/logos/wakilisha-logo-dark.svg` directly onto the canvas, not recreate the brand in Figtree text or invent a standalone symbol. Keep the green `MAGAZINE` descriptor beneath the actual SVG logo, and keep the category, credited author, and stored reading time over the artwork. The export has no white frame, separate card, watermark substitution, or fabricated text. Preserve safe room near the top and bottom for Instagram interface controls.

The rendered JPEG is both the in-app preview and the outgoing file, so the preview cannot diverge from the actual saved/shareable image. Source image read access must pass cross-origin canvas rules; never replace a selected published image with an unrelated fallback or export a tainted canvas.

## Sharing boundary

A public website can prepare an image for the OS share chooser or download. It cannot guarantee Instagram appears as a target, auto-open the Story composer, publish to a personal Story, or place a clickable Instagram Link sticker. The UI therefore offers:
- Share Image, using the native OS file share surface when supported.
- Save Image, as a user-controlled download.
- Copy Article Link, with a tracked URL derived from the same canonical Article route, to paste into Instagram's Link sticker.

A domain printed on an image is not a clickable link; tell the reader to add the sticker. A native share dismissal/cancellation must never be reported as a published Instagram Story. Count and analytics semantics distinguish a client handoff/download/copy from an actual third-party post.

## Authority, security, and scope

The existing immutable published Article read model supplies headline, selected artwork, section, author, reading time, public route, and published snapshot ID. Story export does not load private media, use a draft-preview nonce, query the editor state, mutate Article content, or depend on a database write. The Story option is hidden when the public published snapshot or required metadata is missing. It uses the existing Community Action Sheet -> Share Sheet route on desktop and mobile. Unrelated media sharing platforms remain unchanged.

### Unified share destinations

Instagram is registered as one destination in the existing four-column `SHARE_PLATFORMS` grid, displayed next to Copy, X, WhatsApp, and the other destinations. It is **not** a standalone full-width button or a second share infrastructure. Its visual tile uses the platform's brand gradient and the existing Remixicon Instagram glyph. Share destinations use native inline SVG paths extracted from WAKILISHA's already bundled and licensed icon asset so their symbols remain visible on mobile WebKit, rather than depending on the mask-based `ri-*` compatibility sprite. No global icon infrastructure is replaced.

Only a published Article with selected artwork, published snapshot identity, author, section, and positive reading time can display the Instagram destination. Choosing it opens a second view **inside the same desktop popover or mobile bottom sheet**, with Back to Share Options, the exact exported-image preview, Share Image, Save Image, and Copy Article Link. Back, closing the host sheet, and unmounting must revoke the generated object URL and reset the destination. No eager canvas rendering occurs before selecting Instagram.

Choosing Instagram opens the preparation view, **not** an external Instagram URL. The share count uses the **same share-intent definition as X, WhatsApp, and the other grid destinations**: selecting a destination initiates exactly one persisted counter request while the browser is still in the foreground. Saving the JPEG, invoking the native file chooser, returning from the OS chooser, or copying a link inside the preparation view does not issue a second count. A counter failure must not be disguised by an optimistic badge; the Instagram detail shows a nonblocking warning. One destination selection is one recorded intent, **not** independent proof of a completed Instagram Story, and a cancelled downstream chooser does not retroactively withdraw that intent. The human instructions explicitly require adding the Link sticker in Instagram.

### iOS observed production failure and correction (23 November 2026)

Following protected #1437 and successful canonical frontend activation, the operator reported repeated physical-iPhone shares without any increment. Independent read-only production records confirmed **zero** `instagram_story` rows in both `public.share_counts` and `public.share_events`. The Supabase gateway showed a real iPhone Chrome `OPTIONS /rest/v1/rpc/increment_share_count` response (HTTP 200, `2026-11-23T07:01:32Z`) **with no following POST**, while earlier X clicks had complete POST 200 and durable rows. Installed four-argument RPC and its `anon`/`authenticated` EXECUTE privileges were verified correct, with the one-platform migration applied exactly once.

The previous frontend deferred the Instagram `incrementShareCount` call until after `navigator.share` resolved or after the browser clicked an image download anchor, allowing the OS handoff to interrupt request delivery. A mocked test that resolved `navigator.share` before incrementing did not represent the observed mobile lifecycle. The correction starts the **existing** RPC at the first Instagram destination tap, when the webpage is active and before local Story image generation or native sharing begins. It does not add a new API, change the DB schema or replay user actions. The permanent interaction tests now require the call to start before the native chooser, no extra Save Image/native post-handoff call, visible error state, and desktop/mobile parity.

**Production acceptance remains open until a genuine iPhone destination selection creates a `POST` with a persisted matching `share_counts` + `share_events` record and the count survives closing/reopening the sheet.** A passing unit test or HTTP site-health smoke alone does not prove this mobile-network path.

This is independent of the ongoing #1377 SEO publication snapshot lifecycle and #1428 external social metadata acceptance. Passing the Story image renderer must not be treated as evidence that social crawlers see current Open Graph metadata. Do not deploy during that unresolved production gate without separate approval.

## Acceptance and release

1. Extend existing Workbook share contract. Check full-bleed crop geometry, output dimensions, real public SVG logo loading and drawing, brand font/color usage, published-only gating, metadata propagation, image/URL handling, and honest Instagram behavior. Avoid adding a separate permanent CI suite.
2. Verify rendered 1080 × 1920 JPEG from a real published Article with square, portrait, and landscape hero images and both short and long titles. Compare each preview pixel-for-pixel with the downloaded image.
3. On real iOS Safari and Android Chrome, verify download, OS share availability/fallback, clipboard access, Link sticker workflow, and no false claims of publishing.
4. On desktop, verify preview, download, and copied link. Confirm keyboard support, close/reopen behavior, image load failures, and no object URL leaks.
5. Run focused existing tests, app build, applicable protected Core/Browser CI, and changed-file copy checks. Accept and document any real-device limitations rather than simulating them.

**Current follow-up deployment boundary:** No new SQL or Supabase Edge changes. Frontend-only promotion after accepted protected PR gates using the current sealed Article SEO snapshot and canonical release runner. The existing 275-migration production database and dirty Discography worktree are preserved. Rollback: deploy the immediately previous accepted frontend build. Do not treat rollout as real-device share-count acceptance until live gateway and read-only event evidence pass.
