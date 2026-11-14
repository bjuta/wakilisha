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

## Gate B: bounded out-of-band source evidence scan

The next stage is scripts/seo/collect-governed-publication-source.mjs. This is a **pre-publication source evidence collector**, not a complete v1 receipt generator, static HTML renderer, approval mechanism, or Production deployment. Its output explicitly records publicationReceipt=false and publicationActivationAuthority=false. The scan does not satisfy the v1 route and SEO receipt contract on its own.

**Scope.** The existing package.json already pins pg 8.11.5. This command must run only out of band from the frontend build, in an explicitly authorized maintenance environment. Its --inventory mode requires no credentials or network. Its --collect mode needs an explicit *private* environment configuration and a new, absolute evidence file path. Never put database credentials in PRs, logs, command transcripts or chat.

Connection environment:

- WAKILISHA_SEO_SOURCE_PROJECT_REF: pgzizndxdyhqmtyywjmt
- WAKILISHA_SEO_SOURCE_DB_HOST: db.pgzizndxdyhqmtyywjmt.supabase.co
- WAKILISHA_SEO_SOURCE_DB_ROLE: supabase_read_only_user
- WAKILISHA_SEO_SOURCE_DATABASE_URL: exact TLS PostgreSQL URI for that host and approved role, with password supplied by the accepted private secret process; no connection string overrides
- WAKILISHA_SEO_SOURCE_DB_CA_FILE: absolute path to the project's verified PEM **database root CA**, downloaded through the authenticated Supabase Dashboard → Database Settings → SSL Configuration → Download Certificate. Never retrieve CA trust from the unverified TCP endpoint or use TLS verification bypasses.

**TLS trust (verified after the network incident):** The collector now fails closed without a valid, non-symlink project CA PEM, checks that its X.509 certificate is a current CA, and configures the direct PostgreSQL driver with `ssl: { rejectUnauthorized: true, ca: <approved certificate>, servername: db.pgzizndxdyhqmtyywjmt.supabase.co }`. Transport may use the already approved Lightsail SSH forward, but TLS must continue to validate the *original database hostname*, not `127.0.0.1`. Supabase documentation explicitly requires the Dashboard certificate for verified PostgreSQL TLS. A private reader URI remains a separate requirement. No permission change, SQL mutation, or paid IPv4 add-on is part of this work.

**Read-only role evidence.** On November 14, the database role catalog established that supabase_read_only_user is login-enabled, BYPASSRLS, non-superuser, not CREATEROLE/CREATEDB, with SELECT on all 229 Public and 92 Editorial tables and no table-level write grants. That is a metadata check, not proof that the credential, direct-host connectivity, or a live collector run is available. The collector independently verifies transaction mode, role, BYPASSRLS, selected table privileges and zero DML grants at runtime. No role creation or SQL migration is proposed here.

**Operator syntax after connection authority approval:**

    node scripts/seo/collect-governed-publication-source.mjs --inventory
    node scripts/seo/collect-governed-publication-source.mjs --collect /absolute/private/unique-source-evidence.json

The approved role connects over TLS with peer validation. A single PostgreSQL REPEATABLE READ READ ONLY transaction covers the complete allowlisted scan. The fixed inventory contains **40 existing source tables and 383 selected columns**, plus three static route/code authority files. It includes Registry relationships and credits, SEO overrides, Magazine publication and featured guides, public Resource Index, People/Organization identity links, Playlist publication versions and lifecycle, Chart editions/entries/aliases, and image references. Both public and nonpublic source states are fingerprinted conservatively so withdrawals and status changes are not concealed by published-only filters.

Each source query pages 250 rows with fixed ordering. Limits: 20,000 rows per table, 100,000 total rows, 600 source queries, 90-second wall-clock budget, query/lock/connection timeouts. A missing/invalid table, unexpected role, RLS-filtered read, write grant, incomplete page, content tamper, or transaction identity change **fails closed**. The scan commits only a read-only transaction and writes a new mode-0600 output JSON exclusively after success. Individual source rows, content bodies and credentials are never written to this evidence file. Source surfaces are deterministically hashed and a sourceEpoch digest changes when relevant scanned source content changes or disappears.

**No false authority:** The result is kind=wakilisha-governed-source-scan, not a source-signed publication receipt. The separate governed publisher must still establish independent executor provenance, exact publication route inclusion/exclusion and retirement events, renderer digest binding, accepted immutable snapshot, redirect/410/308 behavior, and a complete preview/Production release gate. Hashes and database role declarations alone cannot authenticate an arbitrary uploaded receipt. Overinclusive draft changes may intentionally invalidate a scan until a narrower canonical projection has been reviewed.

**Acceptance so far:** local Node mock harness 13/13 PASS; JavaScript syntax PASS; exact GitHub source blob matches local tested bytes. Independent read-only schema audit: 40/40 tables and 383/383 selected columns present, the existing role can SELECT every one, and has zero table DML grants. Two consolidated permanent contract cases extend the existing test/seo/public-vertical-seo-contract.test.ts; no new workflow or permanent standalone test file. Live Production SQL transaction acceptance, real client connectivity, and end-to-end publication are **not yet accepted**.

**What must not change in this stage:** the full frontend build, accepted SEO snapshot validator, Lightsail runner, Supabase SQL, Supabase Edge, Registry writers, and current deployed #1376 frontend release. Issue #1377 stays open until the complete publication/withdrawal lifecycle is proven and released.

**Governed source correction (14 November 2026):** The initial inventory mistakenly listed two filtered API views as physical source tables: public.wk_guides and public.wk_resource_index. Both views filter or assemble the underlying publication state, so they cannot independently prove withdrawal/correction coverage. They have been replaced by the actual physical authorities: public.guides and editorial.resources, editorial.resource_aliases, editorial.article_resources, and editorial.registry_artist_resources. The updated inventory consists of **40/40 physical tables, 383/383 selected columns and 40/40 declared unique keys**. Independent read-only Production catalog checks confirmed all selected columns, SELECT access for the exact reader role, and **zero table-level write privileges**. No indexes, view definitions, migrations, SQL mutations or Production frontend changes were made. The former two-view count/distinct compatibility exemption is no longer required; future sources without declared unique keys remain subject to an explicit reviewed cardinality gate. Current source authority is still marked `review-required` until an approved direct client scan is accepted.
