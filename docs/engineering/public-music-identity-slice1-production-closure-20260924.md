# Public Music Identity Slice 1 Production Closure

Date: 2026-09-24

Status: **Production accepted**

## 1. Scope

Public Music Identity Slice 1 converged public Track identity onto stable Artist-scoped human-readable URLs while keeping Registry UUID identity internal.

Accepted public music identity grammar:

- Track: `/tracks/{artistSlug}/{trackSlug}`
- Track lyrics contribution: `/tracks/{artistSlug}/{trackSlug}/lyrics/contribute`
- multi-track Release: `/releases/{artistSlug}/{releaseSlug}`

Retired public Track identity grammars:

- UUID-bearing Track routes
- Release-scoped Track routes such as `/releases/{artistSlug}/{releaseSlug}/{trackSlug}`

Release membership is context for a Track, not ownership of the Track's public URL. A Track therefore keeps the same canonical `/tracks/{artistSlug}/{trackSlug}` identity when it later becomes a member of an EP, Album, Deluxe edition, or another valid Release.

## 2. Merge authority

Primary implementation PR:

- PR #1070: `Public music identity: restore human Track routes`
- merged main: `8e6c1f6b5016a223eedcf27b375c8bf4dbee58d8`

Post-deploy SEO authority correction:

- PR #1071: `Public music identity: seal canonical Track SEO authority`
- corrected merged main: `3aa397f6582a537647be366f4b662054e442a46d`

Protected Critical Control Plane passed on the accepted hotfix head before merge.

## 3. Production defect discovered by live acceptance

The first frontend deployment itself passed artifact parity and public smoke, but live public-identity acceptance found that Production sitemap authority still advertised retired Release-scoped Track URLs.

The stale authority was isolated to `supabase/functions/seo-sitemap-admin/index.ts`.

The function still preferred Release membership when constructing Track sitemap entries and emitted paths shaped like:

`/releases/{artistSlug}/{releaseSlug}/{trackSlug}`

This was an SEO authority defect, not a router, Registry-data, SQL, or frontend deployment defect.

No rollback was required.

## 4. Accepted correction

PR #1071 made the smallest complete correction:

1. `seo-sitemap-admin` emits Track sitemap identity only as `/tracks/{artistSlug}/{trackSlug}`.
2. Tracks without resolvable Artist-scoped public identity fail closed.
3. prerender Track metadata accepts only exact Artist-scoped Track paths.
4. public sitemap generation rejects retired music identities.
5. prerender SEO audit fails if Registry Track or Release metadata uses noncanonical path ownership.
6. the Slice 1 route contract binds SEO authority to the same canonical Track grammar.

Production Edge authority after deployment:

- function: `seo-sitemap-admin`
- version: **53**
- status: **ACTIVE**
- `verify_jwt=false`, preserved from established Production configuration
- deployed v52 source was proven byte-for-byte equal to pre-hotfix main before replacement
- no unrelated Edge Function was deployed

## 5. Final Production deployment

Canonical Production frontend runner:

`scripts/deploy/production-frontend.sh`

Accepted deployed main:

`3aa397f6582a537647be366f4b662054e442a46d`

Production deployment gates passed:

- exact merged-main authority
- protected critical suite
- production build
- staged artifact parity
- rollback snapshot preservation
- frontend activation
- live artifact parity
- Nginx validation
- direct-origin smoke
- public HTTPS smoke

Final frontend artifact authority:

- local file count: **3,723**
- remote file count: **3,723**
- local index SHA-256: `d2acb56f993d2c0c532fa3e401faf035f5f2427c21ab7b1356390392a50ae217`
- remote index SHA-256: `d2acb56f993d2c0c532fa3e401faf035f5f2427c21ab7b1356390392a50ae217`
- local entry SHA-256: `b93784d094b83b4c4c6d97111cc316c22c5298bce9564684efd101d9131225cb`
- remote entry SHA-256: `b93784d094b83b4c4c6d97111cc316c22c5298bce9564684efd101d9131225cb`

Rollback snapshot was preserved at:

`/opt/wakilisha-react-backups/public-music-identity-slice1-seo-hotfix-20260924T191324Z-3aa397f6`

## 6. Final live public-identity acceptance

Generated canonical public music authority:

- canonical Track paths: **2,017**
- canonical Release paths: **155**
- Release-scoped Track paths: **0**
- UUID-bearing Track paths: **0**

Live canaries:

- canonical Track HTTP: **200**
- canonical Release HTTP: **200**

Final gate:

`PUBLIC_MUSIC_IDENTITY_SLICE1_PRODUCTION=PASS`

## 7. Permanent invariants

The following are now closure invariants:

1. Registry Track UUID is internal identity and does not belong in a public Track URL.
2. A Track has one stable Artist-scoped public URL independent of Release membership.
3. A Release owns only its collection URL, not child Track URL identity.
4. Singles route to their canonical Track identity.
5. EPs and Albums retain dedicated Release detail identity.
6. Release-scoped Track URLs are retired without redirects.
7. ambiguous or wrong-Artist Track identity fails closed.
8. SEO, prerender, sitemap, router, and public-reader authority must agree on the same Track grammar.
9. generated public artifacts must fail closed if retired Track identities reappear.

## 8. Deployment classification

- SQL migration: **No**
- Registry/data mutation: **No**
- Supabase Edge deployment: **Yes, seo-sitemap-admin only, v53**
- frontend Production deployment: **Yes**
- rollback used: **No**
- rollback snapshot preserved: **Yes**
- Production acceptance: **PASS**

Public Music Identity Slice 1 is closed.
