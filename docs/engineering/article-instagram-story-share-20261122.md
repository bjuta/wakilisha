# Article Instagram Story share: full-bleed export contract

**Scope:** public published WAKILISHA Magazine Articles, shared desktop/mobile UI.
**Branch:** feat/article-instagram-story-fullbleed.
**Status:** Original full-bleed Story renderer deployed 22 November 2026. Share destination integration is a subsequent frontend-only correction until separately released.

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

Choosing Instagram opens the preparation view, **not** an external Instagram URL. The share count increments only after a successful native OS file handoff, not when tapping the tile, cancelling the OS chooser, downloading the JPEG or copying a link. This is an OS handoff count, not proof of Instagram publication. The human instructions explicitly require adding the Link sticker in Instagram.

This is independent of the ongoing #1377 SEO publication snapshot lifecycle and #1428 external social metadata acceptance. Passing the Story image renderer must not be treated as evidence that social crawlers see current Open Graph metadata. Do not deploy during that unresolved production gate without separate approval.

## Acceptance and release

1. Extend existing Workbook share contract. Check full-bleed crop geometry, output dimensions, real public SVG logo loading and drawing, brand font/color usage, published-only gating, metadata propagation, image/URL handling, and honest Instagram behavior. Avoid adding a separate permanent CI suite.
2. Verify rendered 1080 × 1920 JPEG from a real published Article with square, portrait, and landscape hero images and both short and long titles. Compare each preview pixel-for-pixel with the downloaded image.
3. On real iOS Safari and Android Chrome, verify download, OS share availability/fallback, clipboard access, Link sticker workflow, and no false claims of publishing.
4. On desktop, verify preview, download, and copied link. Confirm keyboard support, close/reopen behavior, image load failures, and no object URL leaks.
5. Run focused existing tests, app build, applicable protected Core/Browser CI, and changed-file copy checks. Accept and document any real-device limitations rather than simulating them.

**Deployment:** SQL NO. Supabase Edge NO. Frontend YES only after accepted PR and Production release gates. Production Finish update YES when the frontend is activated. PR now for CI/preview only; no production changes. Rollback: revert the feature PR and redeploy the accepted frontend. Do not touch Registry or publication snapshot infrastructure.
