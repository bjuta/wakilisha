# WordPress Cutover Decision Resolution Plan

This is a proposed resolution layer for the 64-row cutover decision register.

It does not approve DNS, Cloudflare, Supabase, frontend deploy, or production redirect changes.

## Summary

- Decision rows reviewed: 64
- Proposed extra redirect-shaped rows: 47
- Ready extra redirect rows: 47
- Approval-gated redirect rows: 0
- Intentional retire/404 rows: 17
- Manual decision rows remaining: 0
- Browser QA rows: 0
- High-risk rows: 0
- Medium-risk rows: 43
- Low-risk rows: 21

## Input reports

| Input | Present |
|---|---|
| reports/wordpress-cutover-decision-register.json | yes |
| reports/wordpress-temporary-redirect-bundle.json | yes |
| reports/wordpress-react-preview-smoke-report.json | yes |

## Resolution counts

- decommissioned_no_preserve: 15
- intentional_404: 2
- redirect_to_charts: 3
- redirect_to_magazine: 44

## Proposed extra redirects

These are not part of the validated 1,171-row redirect bundle. They reflect final product scope decisions for old WordPress routes.

| Source | Target | Status | Reason |
|---|---|---:|---|
| `/author/admin/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/frank/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/frank/page/2/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/frank/page/3/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/gatwiri_c/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/hafare/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/hafare/page/2/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/james/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/james/page/2/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/james/page/3/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/k_matiri/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/k_matiri/page/2/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/kendi/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/kendi/page/2/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/kiuta/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/michael/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/swambi/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/timo/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/vicmuia/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/wakilishaji/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/wakilishaji/page/2/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/wakilishaji/page/3/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/wakilishaji/page/4/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/wakilishaji/page/5/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/wakilishaji/page/6/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/wakilishaji/page/7/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/wakilishaji/page/8/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/author/wangari/` | `/magazine` | 302 | WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes. |
| `/news-resources/` | `/magazine` | 302 | Magazine is the closest current React destination. |
| `/album-reviews/` | `/magazine` | 302 | Legacy section archives do not need content migration. React/Supabase is the source of truth; /magazine is the safe public landing page. |
| `/art-design/` | `/magazine` | 302 | Legacy section archives do not need content migration. React/Supabase is the source of truth; /magazine is the safe public landing page. |
| `/art/` | `/magazine` | 302 | Legacy section archives do not need content migration. React/Supabase is the source of truth; /magazine is the safe public landing page. |
| `/blog-newspaper/` | `/magazine` | 302 | Legacy section archives do not need content migration. React/Supabase is the source of truth; /magazine is the safe public landing page. |
| `/film/` | `/magazine` | 302 | Legacy section archives do not need content migration. React/Supabase is the source of truth; /magazine is the safe public landing page. |
| `/journal/` | `/magazine` | 302 | Legacy section archives do not need content migration. React/Supabase is the source of truth; /magazine is the safe public landing page. |
| `/lifestyle/` | `/magazine` | 302 | Legacy section archives do not need content migration. React/Supabase is the source of truth; /magazine is the safe public landing page. |
| `/literature/` | `/magazine` | 302 | Legacy section archives do not need content migration. React/Supabase is the source of truth; /magazine is the safe public landing page. |
| `/literature/short-stories/` | `/magazine` | 302 | Legacy section archives do not need content migration. React/Supabase is the source of truth; /magazine is the safe public landing page. |
| `/opinion/` | `/magazine` | 302 | Legacy section archives do not need content migration. React/Supabase is the source of truth; /magazine is the safe public landing page. |
| `/plan/` | `/magazine` | 302 | Legacy section archives do not need content migration. React/Supabase is the source of truth; /magazine is the safe public landing page. |
| `/plan/archive/` | `/magazine` | 302 | Legacy section archives do not need content migration. React/Supabase is the source of truth; /magazine is the safe public landing page. |
| `/science-and-technology/` | `/magazine` | 302 | Legacy section archives do not need content migration. React/Supabase is the source of truth; /magazine is the safe public landing page. |
| `/short-stories/` | `/magazine` | 302 | Legacy section archives do not need content migration. React/Supabase is the source of truth; /magazine is the safe public landing page. |
| `/sports/` | `/magazine` | 302 | Legacy section archives do not need content migration. React/Supabase is the source of truth; /magazine is the safe public landing page. |
| `/charts/top-100/ke/2026-01-26/` | `/charts` | 302 | Old dated WordPress chart pages do not need preservation. React charts are the source of truth. |
| `/charts/top-gengetone/ke/2026-01-26/` | `/charts` | 302 | Old dated WordPress chart pages do not need preservation. React charts are the source of truth. |
| `/charts/top-rnb/ke/2026-01-26/` | `/charts` | 302 | Old dated WordPress chart pages do not need preservation. React charts are the source of truth. |

## Rows to retire or leave unredirected

| Source | Resolution | Risk | Reason |
|---|---|---|---|
| `/tag/abas-k%eb%ab%bf/` | intentional_404 | low | Malformed encoded tag slugs are not worth preserving and should not be bulk-mapped blindly. |
| `/tag/abbas-k%eb%ab%bf/` | intentional_404 | low | Malformed encoded tag slugs are not worth preserving and should not be bulk-mapped blindly. |
| `/corrections/` | decommissioned_no_preserve | low | Product decision locked: old WordPress page is no longer needed and should not block cutover. |
| `/events/` | decommissioned_no_preserve | low | Product decision locked: old WordPress page is no longer needed and should not block cutover. |
| `/faq/` | decommissioned_no_preserve | low | Product decision locked: old WordPress page is no longer needed and should not block cutover. |
| `/methodology/` | decommissioned_no_preserve | low | Product decision locked: old WordPress page is no longer needed and should not block cutover. |
| `/venues/` | decommissioned_no_preserve | low | Product decision locked: old WordPress page is no longer needed and should not block cutover. |
| `/account/` | decommissioned_no_preserve | low | Product decision locked: old WordPress page is no longer needed and should not block cutover. |
| `/my-account/` | decommissioned_no_preserve | low | Product decision locked: old WordPress page is no longer needed and should not block cutover. |
| `/my-library/` | decommissioned_no_preserve | low | Product decision locked: old WordPress page is no longer needed and should not block cutover. |
| `/my-top-10/` | decommissioned_no_preserve | low | Product decision locked: old WordPress page is no longer needed and should not block cutover. |
| `/order-tracking/` | decommissioned_no_preserve | low | Product decision locked: old WordPress page is no longer needed and should not block cutover. |
| `/settings/` | decommissioned_no_preserve | low | Product decision locked: old WordPress page is no longer needed and should not block cutover. |
| `/claim-your-name/` | decommissioned_no_preserve | low | Product decision locked: old WordPress page is no longer needed and should not block cutover. |
| `/music/` | decommissioned_no_preserve | low | Product decision locked: old WordPress page is no longer needed and should not block cutover. |
| `/cart/` | decommissioned_no_preserve | low | Product decision locked: old WordPress page is no longer needed and should not block cutover. |
| `/checkout/` | decommissioned_no_preserve | low | Product decision locked: old WordPress page is no longer needed and should not block cutover. |

## Browser QA rows

| Source | Target | Reason |
|---|---|---|

## Cutover interpretation

- The validated 1,171-row temporary redirect bundle remains the primary approved redirect artifact.
- This plan proposes extra handling for the 64 unresolved rows.
- Author archive URLs should not fake author profile matches. The safe fallback is `/magazine` if we choose to preserve them.
- Old account, store, static utility, music, and claim-your-name WordPress routes are intentionally decommissioned.
- Old dated WordPress chart routes redirect to `/charts`; historic WordPress chart pages are not preserved.
- Article content is not being migrated from WordPress here. React/Supabase is the source of truth; old article URLs are only preserved as redirects where React routes exist.

## Deployment checklist

```text
SQL migration needed: No
Supabase Edge Function deploy needed: No
Readdy Finish update needed: No
Frontend deploy needed: No
Cloudflare/DNS change needed: No
This is a decision-resolution planning artifact only.
```
