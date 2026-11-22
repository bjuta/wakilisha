# Sharing publication integrity: 22 November 2026 incident and release contract

**Status: not Production accepted.** Source PR #1428, governed publication issue #1377 and in-progress source scan PR #1379. This record is an engineering gate, not a deployment authorization.

## Production incident and source of truth

The public `/magazine/album-review-alusa-continua` returned HTTP 200 but homepage social metadata (homepage title, description, canonical URL, SVG logo, `og:type=website`) to browser, X, and Facebook crawlers, including the tracked X URL. This is not a successful Article preview.

The Article was published at 2026-11-22 07:59:32 UTC and has public/published Resource state and an exact current published version. The title is **Album Review: Alusa Continua** and byline **Hafare Segelan**. The published Article version stores the selected hero URL:

`https://media.wakilisha.africa/uploads/1795281873445-46ece7ef-album-artwork_alusa-continua-by-bien_wakilis.webp`

A read-only Production media-registry check found the **same exact URL** in an active `registry_media_assets` record, width **2000**, height **2000**, file size **192192 bytes**, kind **image**, and alt text **Album Artwork Alusa Continua by Bien WAKILISHA**. The published Article Version has `hero_image_id IS NULL` even though its URL is present; do not infer a missing image, and do not silently backfill or rewrite a reviewed published version to populate the optional ID.

The control page `/magazine/top-10-kenyan-albums-2025` returned an Article-specific title, canonical URL, and uploaded artwork. The former prerender output has an unrelated defect: it declares 1200x630 for every `og:image`, including a portrait control image and the actual 2000x2000 selected Article artwork.

## Required contract

1. The immutable *current published version* and its canonical public route decide Article title, description, authorship, visibility, and selected image. Never substitute homepage branding or search results for published Article media.
2. Social metadata must be delivered in the **initial HTTP HTML response**, not only after React loads. The Article must use `og:type=article`, published headline and summary, correct `og:url`, and the exact selected image or a verified, traceable compatible rendition of that same asset. The alternate tracked URL must resolve to the same canonical metadata.
3. Social image format, content type, fetch success, file size, intrinsic dimensions, aspect ratio, and public crawler access must be verified. Unknown dimensions must be omitted, not fabricated. A derived JPEG/PNG rendition may be necessary for some consumers, but it must preserve the editor-selected artwork and avoid unapproved content replacement or destructive cropping.
4. The **governed** out-of-band source scanner, independently accepted publication receipt, bounded materialization, immutable artifact pin, freshness comparison, withdrawal/redirect enforcement, and atomic activation/rollback belong to #1377. Do not reintroduce the 13 November live API fan-out inside the normal Vite build. A code-only deploy must not reactivate stale published metadata.
5. Shared platform actions must send accurate canonical destinations: X, WhatsApp, Facebook, Telegram, LinkedIn, Reddit, Pinterest, Email, and Copy. Article headline must lead, track/release title must lead with artist context, and authored Post text must remain the message. Pinterest receives the public selected image URL explicitly. Messenger is withheld while the only existing URL requires invalid `app_id=0`.
6. The platform cannot assert a share succeeded solely because an outbound popup was requested; share-click telemetry and confirmed third-party posting are distinct events.

## Release acceptance

- **Current-source truth:** independently prove active Article identity, exact published version, media URL, image registration/dimensions, expected canonical route and public author, then compare against a current complete source receipt.
- **Publisher:** generate the new Article route and metadata, update sitemap and publication receipts under a stable epoch, preserve all other published routes, honor corrections/withdrawals, then approve and pin a new immutable artifact. Reject partial source scans or unexpected publication drift.
- **HTTP:** for canonical and UTM Article routes, compare direct Lightsail origin and public CDN response, X/Facebook/WhatsApp crawler classes and an ordinary browser. Require initial HTML `og:title`, `og:description`, `og:type`, `og:url`, `og:image`, `twitter:image`, canonical and Schema.org agreement; reject homepage fallback.
- **Media:** GET/HEAD the exact registered image as crawler, inspect response type/bytes, actual pixel geometry, caching and redirects. For a compatibility rendition, prove source media identity, rendition digest and preserved full composition.
- **Platform:** verify X, WhatsApp, Facebook, Telegram, LinkedIn, Reddit, Pinterest, Email, and Copy link payloads, the real native/mobile and desktop UI, and external cached previews after approved refresh. Do not pretend a source test proves third-party card caches.
- **Safety:** preserve zero source fetches from the default frontend build; run existing SEO and Workbook sharing contracts, protected Core/Browser and aggregate CI; ensure no unnecessary permanent CI growth.
- **Deployment:** exact accepted main; canonical Production frontend runner and independently accepted current snapshot, backup, stage hash and origin/public parity; Production Finish and rollback evidence. No database or Supabase Edge change is authorized by #1428. The separate operator Registry migration must remain untouched.

## Present implementation status

- PR #1428 updates client sharing presentation, canonical Article share URLs, explicit Pinterest media, retires invalid Messenger, and removes fabricated image dimensions from code that produces future metadata. The Article editor also preserves the exact registered Media ID with a newly selected featured-image URL through the existing authorized versioned save. It does **not** rewrite historical publication versions or implement publication snapshot regeneration.
- #1377 is the authoritative open publisher lifecycle. The unmerged #1379 source scan is evidence gathering, not approved publication authority.
- **Production remains affected.** No feature rollback, editorial mutation, SQL migration, Edge deployment, frontend activation, or Cloudflare rewrite has been performed under this record.
