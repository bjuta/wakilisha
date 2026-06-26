# WordPress to React Cutover Rehearsal Checklist

This is a rehearsal document only. It must not be treated as approval to change DNS, IP routing, or Cloudflare production redirects.

Use 302 temporary redirects first. Do not use 301 until the new React surface has been observed in production and analytics/search behavior is stable.

## Current cutover posture

- Production domain: https://wakilisha.africa
- Clean media origin: https://media.wakilisha.africa
- Temporary redirect status: 302
- Draft redirect rows currently planned: 1171
- Unresolved/manual/product/runtime rows still requiring decision or smoke test: 64

## Source reports included

| Report | Present |
|---|---|
| reports/wordpress-cutover-redirect-plan.json | yes |
| reports/wordpress-tag-archive-cutover-policy.json | yes |
| reports/wordpress-author-static-cutover-policy.json | yes |
| reports/wordpress-remaining-blocker-cutover-policy.json | yes |
| reports/lightsail-media-cutover-status.md | yes |
| reports/lightsail-clean-media-url-manifest.txt | yes |
| reports/wordpress-live-media-url-manifest.txt | yes |

## Planning summary

| Workstream | Ready redirects | Manual review | Product decision | Runtime verification | Notes |
|---|---:|---:|---:|---:|---|
| Base redirect plan | 325 | 910 | 0 | 0 | Safe article/artist redirects only. |
| Tag archives | 846 | 2 | 0 | 0 | Search replaces old WordPress tag archives. |
| Author/static routes | 0 | 34 | 6 | 0 | No safe redirects yet. Author slugs need mapping. |
| Remaining blockers | 0 | 17 | 2 | 3 | Sections, charts, WooCommerce, missing article. |

## Go/no-go checklist

- [ ] React production build passes with no hard SEO audit failures.
- [ ] Old WordPress media URLs redirect to the clean media origin with final 200 responses.
- [ ] Clean media origin serves `/uploads/...` URLs directly.
- [ ] WordPress security endpoints remain blocked: `/wp-login.php`, `/xmlrpc.php`, `/wp-json/`.
- [ ] All safe article/artist redirects are still 302, not 301.
- [ ] Tag archive redirect policy is accepted: `/tag/<slug>/` to `/search?tag=<label>`.
- [ ] The 2 malformed tag routes are explicitly retired, fixed, or manually mapped.
- [ ] Author archive decision is made: map author slugs, redirect to magazine, or retire.
- [ ] Static/account route decision is made for account, library, top 10, settings, order tracking.
- [ ] Legacy section archive decision is made for 16 old WordPress sections.
- [ ] WooCommerce cart/checkout decision is made: retire, rebuild, redirect, or preserve legacy store path.
- [ ] `/claim-your-name/` decision is made: import, redirect, preserve static HTML, or intentional 404.
- [ ] Chart runtime routes pass smoke tests on the React preview/cutover origin.
- [ ] Rollback path is confirmed before IP/DNS switch.

## Pre-cutover terminal checks

```bash
cd ~/Desktop/wakilisha-supabase-deploy

git checkout main
git pull origin main
git status --short

npm run build

node scripts/audit/wordpress-cutover-redirect-plan.mjs
node scripts/audit/wordpress-tag-archive-cutover-policy.mjs
node scripts/audit/wordpress-author-static-cutover-policy.mjs
node scripts/audit/wordpress-remaining-blocker-cutover-policy.mjs
node scripts/audit/wordpress-cutover-rehearsal-checklist.mjs

git diff --check
```

## Media checks

```bash
curl -I -L https://media.wakilisha.africa/uploads/2025/07/wakilisha-logo_black_v2-2026.png
curl -I -L https://wakilisha.africa/wp-content/uploads/2025/07/wakilisha-logo_black_v2-2026.png
```

Expected result: clean media URL returns 200, old WordPress upload URL redirects to clean media origin and ends at 200.

## Security endpoint checks

```bash
curl -I https://wakilisha.africa/wp-login.php
curl -I https://wakilisha.africa/xmlrpc.php
curl -I https://wakilisha.africa/wp-json/
curl -I https://wakilisha.africa/.env
curl -I https://wakilisha.africa/.git/config
```

Expected result: blocked, redirected to safe 404, or otherwise unavailable. None should expose WordPress/admin/private content.

## Runtime chart smoke tests

Run these against the React preview/cutover origin, not the old WordPress origin.

| Path | Expected |
|---|---|
| `/charts/top-100/ke/2026-01-26` | React chart page renders without legacy WordPress dependency. |
| `/charts/top-gengetone/ke/2026-01-26` | React chart page renders without legacy WordPress dependency. |
| `/charts/top-rnb/ke/2026-01-26` | React chart page renders without legacy WordPress dependency. |

## Decisions still required before cutover

### Malformed tag routes

- `/tag/abas-k%eb%ab%bf/` → proposed `/search?tag=abas%20k%EB%AB%BF`: Encoded tag slug needs manual review before redirecting.
- `/tag/abbas-k%eb%ab%bf/` → proposed `/search?tag=abbas%20k%EB%AB%BF`: Encoded tag slug needs manual review before redirecting.

### Author/static routes

- Manual review rows: 34
- Product decision rows: 6

Author archives should not be automatically redirected until WordPress username slugs are mapped to real React author slugs.

### Remaining blockers

- Legacy section archive rows: 16
- Missing article rows: 1
- WooCommerce rows: 2
- Chart runtime rows: 3

## Redirect application rule

Do not apply redirect rules directly from the CSV files without a final rehearsal pass.

Initial production redirect status must be 302 temporary redirects only.

Eligible redirect sources after decision approval:

- `reports/wordpress-cutover-draft-redirect-rules.txt`
- `reports/wordpress-tag-archive-draft-redirect-rules.txt`
- no author/static redirects yet
- no remaining-blocker redirects yet

## Rollback plan

- [ ] Record the current Lightsail/Cloudflare DNS/IP state before cutover.
- [ ] Keep the old WordPress origin reachable until React cutover has passed smoke tests.
- [ ] Keep media origin independent from the app origin.
- [ ] If React fails core smoke tests, point DNS/IP back to old WordPress origin.
- [ ] If media fails, disable the upload redirect and restore old WordPress upload handling.
- [ ] If redirects loop or break SEO paths, disable new redirect rules and keep only security/media rules.

## Deployment checklist

```text
SQL migration needed: No
Supabase Edge Function deploy needed: No
Readdy Finish update needed: No
Frontend deploy needed: No
Cloudflare/DNS change needed: No
This is a planning artifact only.
```

## Media import boundary

This plan is about URL routing only.

Do not import provider-hosted artist images such as Spotify CDN images by default.

Only old WordPress upload media under /wp-content/uploads/ belongs in the media mirror/rewrite workstream.
