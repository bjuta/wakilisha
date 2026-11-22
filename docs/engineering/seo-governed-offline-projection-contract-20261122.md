# Governed offline SEO projection contract

**Issue:** #1377. **Status:** source-only implementation candidate. **Deployment authority:** NONE.
**Incident:** Article /magazine/album-review-alusa-continua became public on 22 Nov 2026, yet social crawlers received homepage metadata rather than the published Article title and selected artwork.

## Why this changes the publisher, not a single link

The default Production `npm run build` restores a separately accepted static SEO artifact, with no live publication reads. This is intentional after the 13 November runaway API-read incident. The older `seo:prerender` fetches public metadata and separate release/track/chart details with bounded concurrency but per-entity calls and error suppression; it must not return to the default build or become an ungoverned replacement snapshot.

`npm run seo:governed:candidate` is a new *opt-in* offline mode of the **existing canonical metadata renderer**. The renderer makes zero database/HTTP calls in this mode and does not invent Article images. It uses the exact published Article `heroUrl` as its first social-media image authority and retains existing page-specific JSON-LD and image preload contracts.

## Input and pinning

The runtime requires:
- `WAKILISHA_GOVERNED_SEO_PROJECTION`: independently produced absolute JSON source-projection file
- `WAKILISHA_GOVERNED_SEO_PROJECTION_SHA256`: independently accepted SHA-256 of those exact bytes
- `WAKILISHA_APPROVED_SOURCE_EPOCH`: independently accepted 64-hex current source epoch
- `WAKILISHA_APPROVED_SOURCE_SCAN_SHA256`: independently accepted 64-hex scan digest

Projection format: `format=1`, `origin=https://wakilisha.africa`, `complete=true`, exact `sourceEpoch`, `sourceScanSha256`, `metadata` (full canonical SEO source route map), `articles` (complete public Article list including the selected published `heroUrl`, author and publication dates), `artists`, `releases`, `tracks`, `charts`, and `nonCanonicalPaths`. Other route classes can be carried by `metadata`. Article identities and public featured image origins are validated before rendering; malformed routes, missing Article metadata, invalid pins, or partial source projection fail closed.

The originating capture must be from a separately authenticated, consistent and bounded read-only Production source epoch. **These fields and checksums are necessary input-integrity checks, not authentication of source provenance.** A self-asserted `complete=true` or locally generated SHA is insufficient. The managed scan adapter in draft PR #1379 is still scan evidence, not the complete route/source-binding receipt or a publisher.

## Critical read-only Magazine source boundary

The public `public-content-read/magazine` GET handler invokes `publish_due_article_publications` before returning stories. **It must never be used for a governed supposedly read-only source capture.** The source assembler instead emits an explicit single-statement `SELECT` against `public.wk_article_publication_snapshots WHERE is_active=true AND wp_status='publish'`, capped at 501 rows and admitting at most 500 active published Article records. It returns only public identity, title, author, published description/date and the exact selected `hero_image_url` (no content HTML or unpublished versions).

Emit the SQL through `node scripts/seo/assemble-governed-publication-projection.mjs --emit-magazine-sql /absolute/newfile.sql`. An authenticated operator must execute this via the independently accepted Supabase CLI v3 managed `--read-only --remote=pgzizndxdyhqmtyywjmt` path, not the connected `execute_sql` action (which previously ran as `postgres` and `transaction_read_only=off`). The result includes the server role, read-only status, server timestamp, row count and the exact source snapshot IDs. The assembler rejects any other role or execution class, stale capture outside the first/second managed source epochs, duplicate/invalid identities, wrong images and missing authoritative route metadata.

The SQL has passed read-only **EXPLAIN without ANALYZE** on Production (project `pgzizndxdyhqmtyywjmt`), without executing its full source read or attempting to establish managed-reader provenance. This is a syntax/plan preflight only, **not** the accepted live capture or publication receipt.

## Candidate-generation invocation after independent source approval

From an isolated clean exact-main build worktree:
1. Obtain independently approved source receipt and route/source metadata projection for one stable epoch; verify complete public membership, corrections, retirements, source model and selected Media.
2. Supply the externally pinned projection path and hashes above. Run `npm run build:app` only to generate a fresh Vite application shell.
3. Run `npm run seo:governed:candidate` to generate the SEO candidate **without network reads**. The operation writes only to the working `dist`, not Production.
4. Independently prove candidate route/sitemap/media/JSON-LD parity and all source changes, withdrawals and redirects. Use `scripts/seo/verify-governed-publication.mjs` with authenticated complete source receipts. A checksum or synthetic receipt alone cannot satisfy this gate.
5. An approved immutable snapshot must include the correct Magazine fallback and exact retirement/redirect origin behavior, be accepted and sealed separately, then be used by the unchanged canonical frontend Production runner with staged/live byte identity, rollback, direct-origin/CDN and real social-preview acceptance.

**Current blocker:** the repository has no accepted end-to-end collector of a complete current route projection with independent provenance, no governed candidate-to-immutable-artifact promotion, and no origin 410/308 retirement activation. This branch does not claim those are present or deployable. The code remains gated behind an explicit opt-in mode, not wired to default builds.

## Permanent acceptance proof

Extend `test/seo/public-vertical-seo-contract.test.ts` rather than creating new permanent tests. For the Alusa Continua fixture, assert that the initial HTML, `og:image`, X image, JSON-LD Article and LCP preload derive from the exact published selected WebP even when generic site metadata supplies a conflicting image. Reject missing and unpinned inputs, mismatched source epochs, invalid routes and private/draft Article publication. Then prove real current source, artifact, Lightsail activation and external-preview behavior separately.

**Deployment:** SQL NO; Supabase Edge NO; Production frontend NO. Registry uncommitted local work untouched. Keep #1377 open.
