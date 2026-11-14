# Governed SEO publication receipts: offline parity contract v1

**Work item:** #1377  
**Deployment authority:** none in this tranche  
**Existing Production build:** unchanged; PR #1376 remains the accepted code-only release

## Purpose

The current `wakilisha-accepted-prerender-index.json` proves static file integrity, not whether a publication, correction, withdrawal, visibility change or canonical route change occurred after capture. A timestamp on `seo-metadata-manifest.json` does not prove source freshness.

This tranche adds `scripts/seo/verify-governed-publication.mjs`, a **read-only, offline comparator and artifact audit**. Its presence does **not** make an arbitrary JSON file a valid source of publication authority. A future source collector must produce both receipts under separately verified, consistent, bounded, read-only source access.

## Inputs and trust boundary

Two JSON receipts, independently pinned by the release operator, have:

- `format: 1`, `origin: "https://wakilisha.africa"`, `complete: true`, an immutable transaction/source `sourceEpoch` digest, and a UTC `capturedAt`.
- Exact, complete `surfaces` for **static, magazine, artists, releases, tracks, genres, labels, guides, briefings, charts, playlists, people, organizations, taxonomy, and authors**. Each surface carries `complete: true`, the common `sourceEpoch`, `rowCount`, and an exact SHA-256 `digest` over its complete canonical input. Empty surfaces are explicitly represented.
- `routes` with canonical `path`, governed `source`, stable `subjectId`, immutable `revision` SHA-256, and `seoSha256` for the actual rendered SEO head block. Duplicate canonical paths, conflicting subject ownership, private paths and unknown sources fail closed.
- `retired` route receipts with exact previous path, source and subject, `eventSha256` and one of `withdrawn`, `private`, `superseded`, or `redirected`. Redirects must name an active target with the same source subject; nonredirect retirements cannot contain a target.

Do not populate source digests from merely the public route inventory. They must reflect the underlying canonical publication state, including visibility, relationships, metadata/credit updates, and withdrawals. Otherwise the contract cannot detect a source mutation. Both receipts must be generated from **complete source scans**, not page- or request-limited samples. The future collector must separately verify publication capability/identity and exact transaction consistency. A self-reported `complete: true` is not sufficient evidence of either.

**This version does not create or authenticate those receipts.** It does not sign receipts, fetch current production state, or generate publication snapshots. No automatic release may rely solely on receipt content, regardless of hashes.

## How to inspect without network calls

The verifier requires caller-pinned SHA-256 digests and files from a separately authorized source and accepted snapshot generation:

```bash
export WAKILISHA_ACCEPTED_PUBLICATION_SHA256="<exact-accepted-receipt-sha256>"
export WAKILISHA_CURRENT_PUBLICATION_SHA256="<exact-current-receipt-sha256>"

node scripts/seo/verify-governed-publication.mjs --plan \
  /absolute/accepted-publication.json \
  /absolute/current-publication.json \
  /absolute/accepted-snapshot

node scripts/seo/verify-governed-publication.mjs --verify \
  /absolute/accepted-publication.json \
  /absolute/current-publication.json \
  /absolute/accepted-snapshot
```

`--plan` refuses to approve snapshot reuse if any source surface digest/row count, route revision, SEO digest, publication membership, or governed retirement differs. Missing retirement evidence, path reuse, torn scans, replayed retired route history, changed state within one source epoch, an older supposedly current receipt, and tampered pinned receipts all fail closed.

`--verify` additionally checks each public route's actual HTML canonical/robots/JSON-LD SEO head digest and sitemap membership. It rejects unexpected public sitemap URLs or retired HTML/metadata/sitemap entries. Source scans and rendered output must agree.

Both modes have **zero Production HTTP/SQL/Edge requests** and cannot mutate files. A PASS is valid only for source receipts that have independent provenance and a verified publication epoch.

## Release boundaries

1. **Do not insert this into the default `npm run build` yet.** The current 3,328-route accepted snapshot has a v1 *file inventory*, not the independent v1 *publication source receipt* defined here. This tranche must not break its deployed code-only release.
2. The out-of-band, rate-limited publisher will first generate stable receipt pairs from canonical sources, then materialize new SEO output with explicit retirement/redirect behavior; it must validate a consistent source epoch before activation.
3. A withdrawn route that still resolves to an SPA fallback HTTP 200 is not yet a valid retirement. The future publication slice must configure and test exact public 410/308 behavior on the canonical frontend origin and public CDN, with rollback semantics.
4. Before merge or Production Finish of that future runtime: independently compare the latest source receipt; run the accepted snapshot seal/check, default build (zero source fetches), permanent SEO tests, direct-origin/browser SEO, and post-activation gateway workload review.
5. No SQL migration, Supabase Edge deploy, frontend deploy, or runtime source authority is conferred by this contract-only change.

## CI consolidation

The new scenarios extend `test/seo/public-vertical-seo-contract.test.ts`, which is already in the protected Critical suite. They add **four coherent contract cases**, not a new permanent test file or a new CI workflow. Existing SEO offline-build assertions remain authoritative for a separate invariant and are not duplicated.

Source fixture tests cover unchanged replay, new publication, corrected content, withdrawal, route move, incomplete/older source capture, forbidden paths, canonical-route ownership, tampering, sitemap/index parity, and retired HTML exclusion. They are contract tests, **not** live authorization or Source Registry acceptance tests.

## Remaining issue #1377 gates

This PR is only the receipt and pure comparison foundation. The following remain **open and must not be reported as complete**:

- Governed out-of-band read-only source collector with complete source epoch and verifiable receipt provenance.
- Bounded restartable materialization, replay/idempotent publication lineage, and immutable artifact pinning.
- Real withdrawal/redirect origin HTTP semantics and rollback behavior.
- Independent current-source acceptance, staging/preview verification, end-to-end browser and load acceptance.
