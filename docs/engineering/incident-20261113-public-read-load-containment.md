# 13 November 2026: Production public-read load containment

## Current Production authority

- `public-content-read` Edge Function **v119** ACTIVE on project `pgzizndxdyhqmtyywjmt` (deployed during this incident).
- v119 removes PostgreSQL `rate_limit_log` reads and writes from the public gateway; adds per-isolate rate admission, 6 concurrent gateway reads per isolate, and a 12-second downstream deadline.
- **Limitations:** per-isolate controls are not globally distributed admission; an Edge deadline does not replace PostgreSQL query plans or global workload budgeting.
- Read-only Production SQL connectivity returned `Connection terminated due to connection timeout` before and after the Edge deployment. The incident is **not closed**.
- No compute resize, SQL migration, or frontend deployment has been performed for this correction.

## Frontend build fix (branch, not deployed)

`npm run build` no longer calls live `seo-sitemap-admin` or `public-content-read` for prerender metadata. The prior build fetched individual Track, Release and Chart details and separate Magazine/Artist inventories during the build.

The new `scripts/seo/restore-accepted-prerender.mjs` restores **only** approved public HTML head metadata, canonical tags, JSON-LD, Magazine inline fallback and hero preload from a pinned copy of the last accepted Production frontend `dist` tree. It combines that SEO material with a fresh Vite application shell and its newly hashed JavaScript entry. The existing sitemap and prerender audits remain mandatory.

The snapshot uses an inventory of SHA-256 hashes for every `index.html` plus `seo-metadata-manifest.json`, `public-magazine-fallback.json` and `sitemap.xml`.

- `--seal` creates the inventory in a local **copy**, prints its SHA-256, and must not run on the live server.
- `--check` verifies the pin and every source file **before** Vite builds.
- `--restore` re-verifies and writes the fresh local `dist`.
- Missing, tampered, malformed or incomplete source artifacts fail closed.
- Neither the new restore script nor the new default build SEO steps performs any Production HTTP read.

### Important publication boundary

This is an incident-safe mechanism for **frontend code-only** releases. It is **not** permission to republish stale Registry data after a correction, withdrawal, new accepted relationship or chart publication.

For any content/publication change, the governed publication projection must be refreshed, reconciled with canonical state, and independently accepted first. Never seal an arbitrary or stale local build and call it an accepted Production snapshot. This does not create another Registry authority.

Do not merge or deploy this branch until the accepted Production snapshot and the following local tests are proven.

## Offline acceptance checklist

1. Retrieve the **currently deployed and accepted** public frontend files from the existing Lightsail origin, read-only, into a new local directory outside `dist`. Pull `index.html`, nested public `index.html` pages, `seo-metadata-manifest.json`, `public-magazine-fallback.json`, and `sitemap.xml`. Do not query the database or Edge Functions to recreate them.
2. Confirm there were no governed content changes requiring immediate purge or republication since that accepted frontend deployment. If there were, stop: the code-only bridge is not eligible.
3. In the incident branch, set `WAKILISHA_ACCEPTED_PRERENDER_DIR` to that directory; run `node scripts/seo/restore-accepted-prerender.mjs --seal` **once on the local copy**.
4. Set `WAKILISHA_ACCEPTED_PRERENDER_SHA256` to the printed 64-character digest.
5. Run `node scripts/seo/restore-accepted-prerender.mjs --check`, both existing focused tests, `npm run test:critical`, then `npm run build`.
6. Assert the generated sitemap and all canonical music-detail pages match the accepted snapshot, Magazine fallback is present, generated page bundles reference the new Vite asset, and all SEO audits pass.
7. Only afterward: create PR, review, merge; run the existing exact-merged-main Production deployment and independent HTTP/browser acceptance. Keep snapshot receipt and rollback artifact. A merge alone does not change the live frontend.
8. Recheck PostgreSQL connectivity, query costs, memory and I/O using bounded read-only observations after the incident has stabilized. Prior SQL connection timeouts must not be disguised as successful query analysis.

## No-touch scope

No WK100 collector, scoring, MIZIZI Registry mutation, Chart publication, auth policy, Admin/RLS schema, Supabase compute tier, or additional infrastructure is in scope.
