# WordPress Deprecation Audit

Generated: 2026-06-26T06:38:36.856Z

## Decision

Do not fully deprecate the old WordPress server until public redirects, media storage, and legacy import access are resolved.

Media storage direction: do not expand long-term media storage on Supabase Storage. Use AWS Lightsail-backed media storage/origin for imported and future media because Supabase storage is constrained.

## Summary Counts

| Bucket | Hits |
|---|---:|
| runtime_config_risk | 40 |
| public_route_redirect_risk | 6 |
| media_storage_risk | 145 |
| admin_runtime_import_risk | 198 |
| supabase_legacy_function_risk | 35 |
| migration_archive_reference | 91490 |
| docs_only_reference | 215 |
| needs_manual_review | 170 |

## Highest Priority Buckets

1. runtime_config_risk — env/config can route runtime code toward WordPress mode.
2. public_route_redirect_risk — old public URLs need permanent redirects or explicit blocks.
3. media_storage_risk — old wp-content/uploads URLs must move to Lightsail-backed media storage before WP shutdown.
4. admin_runtime_import_risk — admin import tools still reference WordPress and should be hidden behind a legacy flag.
5. supabase_legacy_function_risk — deployed legacy functions should be inventoried before disabling WordPress.

## runtime_config_risk

### Files by hit count

| File | Hits |
|---|---:|
| `docs/charts-api-env.md` | 31 |
| `.env.local.template` | 3 |
| `docs/public-charts-api-qa.md` | 2 |
| `scripts/dev/start-chart-v2-dev.ts` | 1 |
| `src/pages/admin/charts/ingest/components/ProviderHealthPanel.tsx` | 1 |
| `src/pages/admin/charts/public-api-qa/page.tsx` | 1 |
| `src/services/chartsIngestion/client.ts` | 1 |

### Sample hits

- `.env.local.template:11` — VITE_CHARTS_PUBLIC_MODE=wordpress
- `.env.local.template:31` — # Chart ingestion mode (mock | wordpress)
- `.env.local.template:33` — # WordPress base URL for v1 endpoints
- `docs/charts-api-env.md:12` — - `"wordpress"` — Routes all API calls to the WordPress REST API.
- `docs/charts-api-env.md:18` — # For testing against a real WordPress backend
- `docs/charts-api-env.md:19` — VITE_CHARTS_INGESTION_MODE=wordpress
- `docs/charts-api-env.md:25` — - `"wordpress"` — Routes all public API calls to the WordPress REST API.
- `docs/charts-api-env.md:32` — **The base URL for the WordPress REST API endpoints.**
- `docs/charts-api-env.md:33` — - Default: `/wp-json/wakilisha/v1`
- `docs/charts-api-env.md:34` — - When the React app is embedded in WordPress as a plugin, this can be relative.
- `docs/charts-api-env.md:38` — # WordPress-embedded (same origin)
- `docs/charts-api-env.md:39` — VITE_WAKILISHA_WP_API_BASE=/wp-json/wakilisha/v1
- `docs/charts-api-env.md:41` — # Standalone dev server pointing to local WordPress
- `docs/charts-api-env.md:42` — VITE_WAKILISHA_WP_API_BASE=http://localhost:8080/wp-json/wakilisha/v1
- `docs/charts-api-env.md:45` — VITE_WAKILISHA_WP_API_BASE=https://wakilisha.com/wp-json/wakilisha/v1
- `docs/charts-api-env.md:50` — ## WordPress Nonce
- `docs/charts-api-env.md:52` — The WordPress adapter automatically reads the REST nonce from the global window object:
- `docs/charts-api-env.md:58` — This must be injected by the WordPress plugin that embeds the React app. Example in PHP:
- `docs/charts-api-env.md:77` — ### Local Development (WordPress Mode)
- `docs/charts-api-env.md:79` — VITE_CHARTS_INGESTION_MODE=wordpress
- `docs/charts-api-env.md:80` — VITE_CHARTS_PUBLIC_MODE=wordpress
- `docs/charts-api-env.md:81` — VITE_WAKILISHA_WP_API_BASE=http://localhost:8080/wp-json/wakilisha/v1
- `docs/charts-api-env.md:86` — VITE_CHARTS_INGESTION_MODE=wordpress
- `docs/charts-api-env.md:87` — VITE_CHARTS_PUBLIC_MODE=wordpress
- `docs/charts-api-env.md:88` — VITE_WAKILISHA_WP_API_BASE=https://staging.wakilisha.com/wp-json/wakilisha/v1
- `docs/charts-api-env.md:93` — VITE_CHARTS_INGESTION_MODE=wordpress
- `docs/charts-api-env.md:94` — VITE_CHARTS_PUBLIC_MODE=wordpress
- `docs/charts-api-env.md:95` — VITE_WAKILISHA_WP_API_BASE=/wp-json/wakilisha/v1
- `docs/charts-api-env.md:102` — When the React app is served from a different origin than WordPress, the WordPress backend must send appropriate CORS headers:
- `docs/charts-api-env.md:105` — // In WordPress plugin
- `docs/charts-api-env.md:125` — 2. If `"wordpress"`, all admin ingestion calls route through `wpAdapter.ts`
- `docs/charts-api-env.md:134` — When in WordPress mode, the Integration Map page can test connectivity:
- `docs/charts-api-env.md:137` — GET /wp-json/wakilisha/v1/charts/health
- `docs/charts-api-env.md:156` — - **WordPress mode requires the plugin to be installed and activated.**
- `docs/public-charts-api-qa.md:46` — VITE_CHARTS_PUBLIC_MODE=wordpress
- `docs/public-charts-api-qa.md:47` — VITE_WAKILISHA_WP_API_BASE=https://your-wp-site.com/wp-json/wakilisha/v1
- `scripts/dev/start-chart-v2-dev.ts:221` — VITE_CHARTS_PUBLIC_MODE: "wordpress",
- `src/pages/admin/charts/ingest/components/ProviderHealthPanel.tsx:77` — envVars: mode === "wordpress" ? [] : ["VITE_CHARTS_INGESTION_MODE=wordpress"],
- `src/pages/admin/charts/public-api-qa/page.tsx:496` — <code className="font-mono text-[11px] bg-wk-surface-raised px-1 rounded">VITE_CHARTS_PUBLIC_MODE=wordpress</code> and{" "}
- `src/services/chartsIngestion/client.ts:96` — export const WP_API_BASE = "/legacy-import-only/wordpress-runtime-disabled";

## public_route_redirect_risk

### Files by hit count

| File | Hits |
|---|---:|
| `docs/cloudflare-waf-config.md` | 1 |
| `packages/db/migrations/003_seed_repaired_data.sql` | 1 |
| `packages/db/migrations/seed_chunks/054_content_route_classification.sql` | 1 |
| `packages/migration/reports/content-classification.json` | 1 |
| `src/pages/LegacyArticleRedirect.tsx` | 1 |
| `src/router/config.tsx` | 1 |

### Sample hits

- `docs/cloudflare-waf-config.md:162` — - [ ] WordPress paths (`/wp-admin`, `/wp-login.php`) return blocks or redirects
- `packages/db/migrations/003_seed_repaired_data.sql:24487` — ('fd3efe1c-678d-43a8-8fc5-7bd5b1eb7ff3', 'post', 'sample-page', 'Sample Page', 'article', null, 'review_or_retire', true, 'article_not_published', '{"id":"fd3efe1c-678d-43a8-8fc5-7bd5b1eb7ff3","source_wp_post_id":"2","document_type":"page","slug":"sample-page"
- `packages/db/migrations/seed_chunks/054_content_route_classification.sql:38` — ('fd3efe1c-678d-43a8-8fc5-7bd5b1eb7ff3', 'post', 'sample-page', 'Sample Page', 'article', null, 'review_or_retire', true, 'article_not_published', '''{"id":"fd3efe1c-678d-43a8-8fc5-7bd5b1eb7ff3","source_wp_post_id":"2","document_type":"page","slug":"sample-pag
- `packages/migration/reports/content-classification.json:738` — "content_html": "This is an example page. It's different from a blog post because it will stay in one place and will show up in your site navigation (in most themes). Most people start with an About page that introduces them to potential site visitors. It migh
- `src/pages/LegacyArticleRedirect.tsx:8` — * Catches old WordPress-style article URLs like /some-article-slug/
- `src/router/config.tsx:14` — // Admin Shell — WordPress-like production engine

## media_storage_risk

### Files by hit count

| File | Hits |
|---|---:|
| `supabase/functions/update-guide-pages/index.ts` | 28 |
| `supabase/functions/migrate-media-from-wp/index.ts` | 25 |
| `src/pages/guides/detail/data.ts` | 21 |
| `packages/migration/reports/track-playback-sources.full.json` | 12 |
| `scripts/charts/repaired-content-details-api.ts` | 9 |
| `src/services/wpImageRewrite.ts` | 9 |
| `packages/db/migrations/003_seed_repaired_data.sql` | 6 |
| `scripts/charts/repaired-content-api.ts` | 6 |
| `packages/db/migrations/seed_chunks/044_track_playback_sources.sql` | 4 |
| `packages/db/migrations/seed_chunks/052_track_playback_sources.sql` | 4 |
| `packages/migration/reports/content-classification.json` | 3 |
| `src/pages/guides/field-guide/page.tsx` | 3 |
| `src/pages/mobile/guides/page.tsx` | 3 |
| `packages/db/migrations/seed_chunks/054_content_route_classification.sql` | 2 |
| `src/pages/guides/detail/readingData.ts` | 2 |
| `supabase/functions/backfill-article-hero-storage/index.ts` | 2 |
| `supabase/functions/migrate-wp-images/index.ts` | 2 |
| `scripts/imports/process-wordpress-zips.ts` | 1 |
| `scripts/imports/stage-wordpress-records.ts` | 1 |
| `src/components/admin/media/MediaLibraryCore.tsx` | 1 |
| `src/pages/guides/detail/dakarData.ts` | 1 |

### Sample hits

- `packages/db/migrations/003_seed_repaired_data.sql:15195` — ('inauma', 'apple_music', '403', 'null', null, null, 'https://wakilisha.africa/wp-content/uploads/2026/01/Inauma-947503db39.jpg', null, 'wk_tracks.payload_extraction', '{"editablePayload":{"old_id":403,"old_table":"wp_wkcharts_tracks","release_id":"2026-04-06 
- `packages/db/migrations/003_seed_repaired_data.sql:15196` — ('katam', 'apple_music', '404', 'null', null, null, 'https://wakilisha.africa/wp-content/uploads/2026/01/Katam-fd83835635.jpeg', null, 'wk_tracks.payload_extraction', '{"editablePayload":{"old_id":404,"old_table":"wp_wkcharts_tracks","release_id":"2026-04-06 1
- `packages/db/migrations/003_seed_repaired_data.sql:15197` — ('lifestyle-405', 'apple_music', '405', 'ZA34K2301688', null, 647, 'https://wakilisha.africa/wp-content/uploads/2026/01/Lifestyle-2308c84aea.jpg', null, 'wk_tracks.payload_extraction', '{"editablePayload":{"old_id":405,"old_table":"wp_wkcharts_tracks","release
- `packages/db/migrations/003_seed_repaired_data.sql:15198` — ('mbwe-mbwe', 'apple_music', '406', 'USA2P2136606', null, 648, 'https://wakilisha.africa/wp-content/uploads/2026/01/Mbwe-Mbwe-34b4b21972.jpg', null, 'wk_tracks.payload_extraction', '{"editablePayload":{"old_id":406,"old_table":"wp_wkcharts_tracks","release_id"
- `packages/db/migrations/003_seed_repaired_data.sql:24457` — ('82cd52d0-7e0e-4708-b975-dd9584fb5f38', 'post', 'our-business', 'OUR BUSINESS', 'article', null, 'review_or_retire', true, 'article_not_published', '{"id":"82cd52d0-7e0e-4708-b975-dd9584fb5f38","source_wp_post_id":"21928","document_type":"page","slug":"our-bu
- `packages/db/migrations/003_seed_repaired_data.sql:24489` — ('4b8ec964-ea49-4d28-b0cf-5fd4571bcb5d', 'post', 'our-business-2-2', 'OUR BUSINESS', 'article', null, 'review_or_retire', true, 'article_not_published', '{"id":"4b8ec964-ea49-4d28-b0cf-5fd4571bcb5d","source_wp_post_id":"19722","document_type":"page","slug":"ou
- `packages/db/migrations/seed_chunks/044_track_playback_sources.sql:754` — ('inauma', 'apple_music', '403', 'null', null, null, 'https://wakilisha.africa/wp-content/uploads/2026/01/Inauma-947503db39.jpg', null, 'wk_tracks.payload_extraction', '''{"editablePayload":{"old_id":403,"old_table":"wp_wkcharts_tracks","release_id":"2026-04-0
- `packages/db/migrations/seed_chunks/044_track_playback_sources.sql:755` — ('katam', 'apple_music', '404', 'null', null, null, 'https://wakilisha.africa/wp-content/uploads/2026/01/Katam-fd83835635.jpeg', null, 'wk_tracks.payload_extraction', '''{"editablePayload":{"old_id":404,"old_table":"wp_wkcharts_tracks","release_id":"2026-04-06
- `packages/db/migrations/seed_chunks/044_track_playback_sources.sql:756` — ('lifestyle-405', 'apple_music', '405', 'ZA34K2301688', null, 647, 'https://wakilisha.africa/wp-content/uploads/2026/01/Lifestyle-2308c84aea.jpg', null, 'wk_tracks.payload_extraction', '''{"editablePayload":{"old_id":405,"old_table":"wp_wkcharts_tracks","relea
- `packages/db/migrations/seed_chunks/044_track_playback_sources.sql:757` — ('mbwe-mbwe', 'apple_music', '406', 'USA2P2136606', null, 648, 'https://wakilisha.africa/wp-content/uploads/2026/01/Mbwe-Mbwe-34b4b21972.jpg', null, 'wk_tracks.payload_extraction', '''{"editablePayload":{"old_id":406,"old_table":"wp_wkcharts_tracks","release_i
- `packages/db/migrations/seed_chunks/052_track_playback_sources.sql:371` — ('inauma', 'media_asset', null, null, null, null, 'https://wakilisha.africa/wp-content/uploads/2026/01/Inauma-947503db39.jpg', null, 'wk_media_assets', 'null', 0.5, true, 'media_asset_only_no_preview_url'),
- `packages/db/migrations/seed_chunks/052_track_playback_sources.sql:372` — ('katam', 'media_asset', null, null, null, null, 'https://wakilisha.africa/wp-content/uploads/2026/01/Katam-fd83835635.jpeg', null, 'wk_media_assets', 'null', 0.5, true, 'media_asset_only_no_preview_url'),
- `packages/db/migrations/seed_chunks/052_track_playback_sources.sql:374` — ('lifestyle-405', 'media_asset', null, null, null, null, 'https://wakilisha.africa/wp-content/uploads/2026/01/Lifestyle-2308c84aea.jpg', null, 'wk_media_assets', 'null', 0.5, true, 'media_asset_only_no_preview_url'),
- `packages/db/migrations/seed_chunks/052_track_playback_sources.sql:375` — ('mbwe-mbwe', 'media_asset', null, null, null, null, 'https://wakilisha.africa/wp-content/uploads/2026/01/Mbwe-Mbwe-34b4b21972.jpg', null, 'wk_media_assets', 'null', 0.5, true, 'media_asset_only_no_preview_url'),
- `packages/db/migrations/seed_chunks/054_content_route_classification.sql:8` — ('82cd52d0-7e0e-4708-b975-dd9584fb5f38', 'post', 'our-business', 'OUR BUSINESS', 'article', null, 'review_or_retire', true, 'article_not_published', '''{"id":"82cd52d0-7e0e-4708-b975-dd9584fb5f38","source_wp_post_id":"21928","document_type":"page","slug":"our-
- `packages/db/migrations/seed_chunks/054_content_route_classification.sql:40` — ('4b8ec964-ea49-4d28-b0cf-5fd4571bcb5d', 'post', 'our-business-2-2', 'OUR BUSINESS', 'article', null, 'review_or_retire', true, 'article_not_published', '''{"id":"4b8ec964-ea49-4d28-b0cf-5fd4571bcb5d","source_wp_post_id":"19722","document_type":"page","slug":"
- `packages/migration/reports/content-classification.json:18` — "content_html": "<!-- wp:heading {\"textAlign\":\"center\",\"level\":3,\"canvasClassName\":\"cnvs-block-core-heading-1611676855242\"} -->\n<h3 class=\"has-text-align-center\"><strong>OUR PURPOSE</strong></h3>\n<!-- /wp:heading -->\n\n<!-- wp:canvas/section {\"
- `packages/migration/reports/content-classification.json:786` — "content_html": "[vc_row full_width=\"stretch_row\" side_background_title_typo=\"null\"][vc_column width=\"5/12\"][ohio_heading subtitle_type_layout=\"top_subtitle\" module_type_layout=\"on_left\" title=\"T3VyJTIwbWFpbiUyMHB1cnBvc2UlMjBpcyUyMHRvJTIwZW52aXNpb24
- `packages/migration/reports/content-classification.json:789` — "immutable_payload": "{\"_page\":\"field_591ac509d1208gbgclrlcfpag\",\"_page_\":\"field_59390deb0171egrp\",\"psp_kw\":\"culture\",\"wpGuid\":\"https://ohio.colabr.io/?page_id=19722\",\"metaHash\":\"f7082eceba5fd942a24a1f8a1c4b7a0be45cc5b02c791c545ab5dd717e7b09
- `packages/migration/reports/track-playback-sources.full.json:32198` — "artwork_url": "https://wakilisha.africa/wp-content/uploads/2026/01/Inauma-947503db39.jpg",
- `packages/migration/reports/track-playback-sources.full.json:32216` — "artwork_url": "https://wakilisha.africa/wp-content/uploads/2026/01/Inauma-947503db39.jpg",
- `packages/migration/reports/track-playback-sources.full.json:32241` — "artwork_url": "https://wakilisha.africa/wp-content/uploads/2026/01/Katam-fd83835635.jpeg",
- `packages/migration/reports/track-playback-sources.full.json:32259` — "artwork_url": "https://wakilisha.africa/wp-content/uploads/2026/01/Katam-fd83835635.jpeg",
- `packages/migration/reports/track-playback-sources.full.json:32285` — "artwork_url": "https://wakilisha.africa/wp-content/uploads/2026/01/Lifestyle-2308c84aea.jpg",
- `packages/migration/reports/track-playback-sources.full.json:32303` — "artwork_url": "https://wakilisha.africa/wp-content/uploads/2026/01/Lifestyle-2308c84aea.jpg",
- `packages/migration/reports/track-playback-sources.full.json:32329` — "artwork_url": "https://wakilisha.africa/wp-content/uploads/2026/01/Mbwe-Mbwe-34b4b21972.jpg",
- `packages/migration/reports/track-playback-sources.full.json:32347` — "artwork_url": "https://wakilisha.africa/wp-content/uploads/2026/01/Mbwe-Mbwe-34b4b21972.jpg",
- `packages/migration/reports/track-playback-sources.full.json:304484` — "artwork_url": "https://wakilisha.africa/wp-content/uploads/2026/01/Inauma-947503db39.jpg",
- `packages/migration/reports/track-playback-sources.full.json:304493` — "artwork_url": "https://wakilisha.africa/wp-content/uploads/2026/01/Katam-fd83835635.jpeg",
- `packages/migration/reports/track-playback-sources.full.json:304511` — "artwork_url": "https://wakilisha.africa/wp-content/uploads/2026/01/Lifestyle-2308c84aea.jpg",
- `packages/migration/reports/track-playback-sources.full.json:304520` — "artwork_url": "https://wakilisha.africa/wp-content/uploads/2026/01/Mbwe-Mbwe-34b4b21972.jpg",
- `scripts/charts/repaired-content-api.ts:9` — .replace(/^http:\/\/18\.135\.76\.250\/wp-content\/uploads\//i, "https://pgzizndxdyhqmtyywjmt.supabase.co/storage/v1/object/public/article-media/wp-import/")
- `scripts/charts/repaired-content-api.ts:10` — .replace(/^https?:\/\/(?:www\.)?wakilisha\.africa\/wp-content\/uploads\//i, "https://pgzizndxdyhqmtyywjmt.supabase.co/storage/v1/object/public/article-media/wp-import/")
- `scripts/charts/repaired-content-api.ts:11` — .replace(/^https?:\/\/staging\.wakilisha\.africa\/wp-content\/uploads\//i, "https://pgzizndxdyhqmtyywjmt.supabase.co/storage/v1/object/public/article-media/wp-import/")
- `scripts/charts/repaired-content-api.ts:12` — .replace(/^\/wp-content\/uploads\//i, "https://pgzizndxdyhqmtyywjmt.supabase.co/storage/v1/object/public/article-media/wp-import/")
- `scripts/charts/repaired-content-api.ts:168` — return /(image\/thumb|\/image\/|cloudinary|images\.unsplash|cdn)/i.test(value) && !/\/wp-content\/uploads\/[^\s]+\.(mp4|m4v|mov|webm|mp3|m4a|wav)/i.test(value);
- `scripts/charts/repaired-content-api.ts:334` — return looksLikeImageUrl(url) && /\/wp-content\/uploads\//i.test(url);
- `scripts/charts/repaired-content-details-api.ts:12` — .replace(/^http:\/\/18\.135\.76\.250\/wp-content\/uploads\//i, ARTICLE_MEDIA_BASE)
- `scripts/charts/repaired-content-details-api.ts:13` — .replace(/^https?:\/\/(?:www\.)?wakilisha\.africa\/wp-content\/uploads\//i, ARTICLE_MEDIA_BASE)
- `scripts/charts/repaired-content-details-api.ts:14` — .replace(/^https?:\/\/staging\.wakilisha\.africa\/wp-content\/uploads\//i, ARTICLE_MEDIA_BASE)

## admin_runtime_import_risk

### Files by hit count

| File | Hits |
|---|---:|
| `src/pages/admin/imports/page.tsx` | 43 |
| `src/services/legacyImport/wordpress/types.ts` | 34 |
| `src/services/legacyImport/wordpress/client.ts` | 30 |
| `src/services/wordpressConnectService.ts` | 22 |
| `src/services/legacyImport/wordpress/mappings.ts` | 13 |
| `src/pages/admin/charts/ingest-health/page.tsx` | 11 |
| `src/pages/admin/charts/public-api-qa/page.tsx` | 8 |
| `src/pages/admin/media/migrate/page.tsx` | 8 |
| `src/pages/admin/registry/authors/page.tsx` | 8 |
| `src/pages/admin/review/queue/page.tsx` | 3 |
| `src/pages/admin/charts/ingest/components/ProviderHealthPanel.tsx` | 2 |
| `src/pages/admin/charts/integration-map/page.tsx` | 2 |
| `src/components/admin/MediaPickerModal.tsx` | 1 |
| `src/components/admin/media/MediaLibraryCore.tsx` | 1 |
| `src/pages/admin/AdminShell.tsx` | 1 |
| `src/pages/admin/charts/dashboard/page.tsx` | 1 |
| `src/pages/admin/charts/families/page.tsx` | 1 |
| `src/pages/admin/charts/ingest/components/IngestPageHeader.tsx` | 1 |
| `src/pages/admin/charts/ingest/detail/components/ApiContractDrawer.tsx` | 1 |
| `src/pages/admin/charts/ingest/detail/components/SimulationPanel.tsx` | 1 |
| `src/pages/admin/content/articles/detail/components/ArticleMetaPanel.tsx` | 1 |
| `src/pages/admin/imports/jobs/detail/page.tsx` | 1 |
| `src/pages/admin/imports/jobs/page.tsx` | 1 |
| `src/pages/admin/imports/scraper/page.tsx` | 1 |
| `src/pages/admin/settings/integrations/page.tsx` | 1 |
| `src/pages/admin/settings/navigation/page.tsx` | 1 |

### Sample hits

- `src/components/admin/MediaPickerModal.tsx:74` — sourceKind: "wordpress_database",
- `src/components/admin/media/MediaLibraryCore.tsx:430` — <option value="wordpress_database">WordPress</option>
- `src/pages/admin/AdminShell.tsx:70` — { path: "/admin/imports", label: "WordPress Import", icon: "Download", requiredCapability: "view_imports" },
- `src/pages/admin/charts/dashboard/page.tsx:88` — <strong>Mock mode active.</strong> All data is local. Switch to WordPress mode for live backend connectivity.
- `src/pages/admin/charts/families/page.tsx:197` — ? "Import chart data from WordPress to populate programs, or create a new ingest run."
- `src/pages/admin/charts/ingest-health/page.tsx:4` — testWordPressConnection,
- `src/pages/admin/charts/ingest-health/page.tsx:8` — WORDPRESS_CHART_ENDPOINTS,
- `src/pages/admin/charts/ingest-health/page.tsx:54` — const result = await testWordPressConnection();
- `src/pages/admin/charts/ingest-health/page.tsx:93` — ...Object.values(WORDPRESS_CHART_ENDPOINTS).map((e) => ({ key: e.key, path: e.path, method: e.method })),
- `src/pages/admin/charts/ingest-health/page.tsx:107` — const allEndpointCount = INGEST_STUDIO_WP_ENDPOINTS.length + Object.keys(WORDPRESS_CHART_ENDPOINTS).length;
- `src/pages/admin/charts/ingest-health/page.tsx:128` — {mode === "wordpress" && (
- `src/pages/admin/charts/ingest-health/page.tsx:147` — <AdminChartsStatusBadge status={mode === "wordpress" ? "ready" : "mocked"} />
- `src/pages/admin/charts/ingest-health/page.tsx:148` — <span className="text-[13px] font-semibold text-wk-text">{mode === "wordpress" ? "WordPress" : "Mock (Dev)"}</span>
- `src/pages/admin/charts/ingest-health/page.tsx:213` — <p><strong>Check:</strong> WordPress site is reachable from this origin</p>
- `src/pages/admin/charts/ingest-health/page.tsx:315` — {Object.values(WORDPRESS_CHART_ENDPOINTS).map((ep) => (
- `src/pages/admin/charts/ingest-health/page.tsx:409` — title={disabled ? "Probe only available in WordPress mode" : "Probe this endpoint"}
- `src/pages/admin/charts/ingest/components/IngestPageHeader.tsx:24` — {isMock ? "Mock Mode" : "WordPress Mode"}
- `src/pages/admin/charts/ingest/components/ProviderHealthPanel.tsx:75` — status: mode === "wordpress" ? "live" : "mocked" as const,
- `src/pages/admin/charts/ingest/components/ProviderHealthPanel.tsx:76` — message: mode === "mock" ? "Mock (dev) — switch to wordpress mode for production" : "WordPress mode — real backend active",
- `src/pages/admin/charts/ingest/detail/components/ApiContractDrawer.tsx:142` — Backend developer reference — exact payloads for WordPress wiring
- `src/pages/admin/charts/ingest/detail/components/SimulationPanel.tsx:60` — description: "Simulate WordPress edition creation 403 error",
- `src/pages/admin/charts/integration-map/page.tsx:10` — testWordPressConnection,
- `src/pages/admin/charts/integration-map/page.tsx:57` — const result = await testWordPressConnection();
- `src/pages/admin/charts/public-api-qa/page.tsx:30` — dataSource: "mock" | "wordpress" | "cache" | "—";
- `src/pages/admin/charts/public-api-qa/page.tsx:113` — return { dataSource: "wordpress" as const, resultCount: result.ok ? 1 : 0 };
- `src/pages/admin/charts/public-api-qa/page.tsx:123` — return { dataSource: "wordpress" as const, resultCount: result.families.length };
- `src/pages/admin/charts/public-api-qa/page.tsx:133` — return { dataSource: "wordpress" as const, resultCount: result ? 1 : 0 };
- `src/pages/admin/charts/public-api-qa/page.tsx:143` — return { dataSource: "wordpress" as const, resultCount: result ? 1 : 0 };
- `src/pages/admin/charts/public-api-qa/page.tsx:153` — return { dataSource: "wordpress" as const, resultCount: result.length };
- `src/pages/admin/charts/public-api-qa/page.tsx:456` — result.dataSource === "wordpress" ? "text-wk-success" :
- `src/pages/admin/charts/public-api-qa/page.tsx:495` — <strong className="text-wk-text">V1 WordPress mode:</strong> Set{" "}
- `src/pages/admin/content/articles/detail/components/ArticleMetaPanel.tsx:422` — PUBLISH PANEL (WordPress-style)
- `src/pages/admin/imports/jobs/detail/page.tsx:661` — These records were marked as <span className="font-semibold text-wk-warning">draft</span> in WordPress and stayed draft here.
- `src/pages/admin/imports/jobs/page.tsx:200` — <p className="mt-1 text-[12px] text-wk-text-muted">Start by connecting a WordPress site or uploading a ZIP export.</p>
- `src/pages/admin/imports/page.tsx:6` — pingWordPress,
- `src/pages/admin/imports/page.tsx:7` — discoverWordPress,
- `src/pages/admin/imports/page.tsx:16` — testWordPressDatabase,
- `src/pages/admin/imports/page.tsx:17` — stageWordPressDatabase,
- `src/pages/admin/imports/page.tsx:23` — } from "@/services/wordpressConnectService";
- `src/pages/admin/imports/page.tsx:27` — type ImportMethod = "wordpress" | "database" | "zip";

## supabase_legacy_function_risk

### Files by hit count

| File | Hits |
|---|---:|
| `supabase/functions/wp-db-stage/index.ts` | 13 |
| `supabase/functions/wp-connect-proxy/index.ts` | 11 |
| `supabase/functions/process-wp-import/index.ts` | 7 |
| `supabase/functions/create-wp-run/index.ts` | 2 |
| `supabase/functions/backfill-article-authors/index.ts` | 1 |
| `supabase/functions/backfill-article-hero-images/index.ts` | 1 |

### Sample hits

- `supabase/functions/backfill-article-authors/index.ts:109` — const url = `${WP_SITE_URL}/wp-json/wp/v2/posts?include=${idsParam}&per_page=${BATCH_SIZE}&_embed&_fields=id,author,_embedded`;
- `supabase/functions/backfill-article-hero-images/index.ts:79` — const wpUrl = `${WP_SITE}/wp-json/wp/v2/posts?slug=${encodeURIComponent(article.slug)}&_embed`;
- `supabase/functions/create-wp-run/index.ts:39` — source_kind: "wordpress_database_cli",
- `supabase/functions/create-wp-run/index.ts:41` — connection_type: "wordpress_database_cli",
- `supabase/functions/process-wp-import/index.ts:200` — ingestion_run_id: runId, source_kind: "wordpress_rest_api", source_file: sourceFile,
- `supabase/functions/process-wp-import/index.ts:281` — const countRes = await fetch(`${siteUrl}/wp-json/wp/v2/${restBase}?per_page=1&_embed`, { headers: { "Accept": "application/json", "User-Agent": "Wakilisha/1.0" } });
- `supabase/functions/process-wp-import/index.ts:286` — if (totalItems === 0 && typeDiags[postType].errorMessage) { stats.skipped++; if (isAggregate) typeDiags[postType].warning = `This post type is known to store data in postmeta, not as individual CPT posts. REST API only sees ${totalItems} items. Use the MySQL d
- `supabase/functions/process-wp-import/index.ts:289` — if (isAggregate && totalItems <= 5) typeDiags[postType].warning = `REST API only exposes ${totalItems} items for this post type. However, the actual track/release/label data is stored in WordPress postmeta, not as individual CPT posts. The MySQL direct-connect
- `supabase/functions/process-wp-import/index.ts:297` — const wpRes = await fetch(`${siteUrl}/wp-json/wp/v2/${restBase}?per_page=${API_PAGE_SIZE}&page=${page}&orderby=date&order=desc&_embed`, { headers: { "Accept": "application/json", "User-Agent": "Wakilisha/1.0" } });
- `supabase/functions/process-wp-import/index.ts:340` — staged_at: new Date().toISOString(), processor: "process-wp-import-v6", version: "6.0.0",
- `supabase/functions/process-wp-import/index.ts:356` — "v6: Records staged via WordPress REST API with post_author extraction from _embedded.author and proper caption handling.",
- `supabase/functions/wp-connect-proxy/index.ts:61` — `${baseUrl}/wp-json/`,
- `supabase/functions/wp-connect-proxy/index.ts:62` — `${baseUrl}/wp-json/wp/v2/types`,
- `supabase/functions/wp-connect-proxy/index.ts:102` — ? "WordPress REST API is accessible."
- `supabase/functions/wp-connect-proxy/index.ts:103` — : "WordPress REST API is not fully accessible. Check the site URL and ensure the REST API is enabled.",
- `supabase/functions/wp-connect-proxy/index.ts:122` — const siteRes = await fetchWithTimeout(`${baseUrl}/wp-json/`, {
- `supabase/functions/wp-connect-proxy/index.ts:137` — const typesRes = await fetchWithTimeout(`${baseUrl}/wp-json/wp/v2/types`, {
- `supabase/functions/wp-connect-proxy/index.ts:164` — const taxRes = await fetchWithTimeout(`${baseUrl}/wp-json/wp/v2/taxonomies`, {
- `supabase/functions/wp-connect-proxy/index.ts:199` — const res = await fetchWithTimeout(`${baseUrl}/wp-json/wp/v2/${restBase}?per_page=1`, {
- `supabase/functions/wp-connect-proxy/index.ts:210` — const sampleRes = await fetchWithTimeout(`${baseUrl}/wp-json/wp/v2/${restBase}?per_page=3&orderby=date&order=desc`, {
- `supabase/functions/wp-connect-proxy/index.ts:242` — const usersRes = await fetchWithTimeout(`${baseUrl}/wp-json/wp/v2/users?per_page=1`, {
- `supabase/functions/wp-connect-proxy/index.ts:250` — const sampleUsersRes = await fetchWithTimeout(`${baseUrl}/wp-json/wp/v2/users?per_page=3`, {
- `supabase/functions/wp-db-stage/index.ts:98` — ingestion_run_id: runId, source_kind: "wordpress_database", source_file: "mysql.wp_posts",
- `supabase/functions/wp-db-stage/index.ts:116` — ingestion_run_id: runId, source_kind: "wordpress_database", source_file: "mysql.wp_users",
- `supabase/functions/wp-db-stage/index.ts:133` — ingestion_run_id: runId, source_kind: "wordpress_database", source_file: "mysql.wp_terms",
- `supabase/functions/wp-db-stage/index.ts:147` — ingestion_run_id: runId, source_kind: "wordpress_database", source_file: file,
- `supabase/functions/wp-db-stage/index.ts:166` — ingestion_run_id: runId, source_kind: "wordpress_database", source_file: `mysql.wp_${cfg.table}`,
- `supabase/functions/wp-db-stage/index.ts:187` — ingestion_run_id: runId, source_kind: "wordpress_database", source_file: `mysql.wp_${rel.table}`,
- `supabase/functions/wp-db-stage/index.ts:235` — } catch (err) { failures.push(makeFailure(runId, "mysql.wp_posts", "fetch", err)); }
- `supabase/functions/wp-db-stage/index.ts:302` — source_name: `${host}/${database}`, source_kind: "wordpress_database_cli",
- `supabase/functions/wp-db-stage/index.ts:303` — source_manifest: { connection_type: "wordpress_database_cli", credentials_preview: { host, port: Number(port), user, database, prefix, password_persisted: false, password_stored: false }, created_at: new Date().toISOString(), status: "created_for_cli" },
- `supabase/functions/wp-db-stage/index.ts:307` — return jsonResponse({ success: true, runId: (run as { id: string }).id, message: "Run created. Run the CLI command on your WordPress server." });
- `supabase/functions/wp-db-stage/index.ts:319` — return jsonResponse({ success: false, accessible: false, error: connectErr instanceof Error ? connectErr.message : "Could not connect to MySQL", hint: host === "localhost" || host === "127.0.0.1" ? "The database is on localhost — run the CLI script directly on
- `supabase/functions/wp-db-stage/index.ts:329` — if (!runId) { await supabase.from("wk_ingestion_runs").insert({ id: effectiveRunId, source_name: `${host}/${database}`, source_kind: "wordpress_database", status: "staging", started_at: new Date().toISOString(), errors: [], warnings: ["v6 — post_author extract
- `supabase/functions/wp-db-stage/index.ts:336` — const summary = { staged_at: new Date().toISOString(), processor: "wp-db-stage", version: "6.0.0", records: result.records, failures: result.failures, counts_by_target_entity: result.counts, counts_by_status: result.statusCounts, postmeta_limit: maxPostmeta, p

## migration_archive_reference

### Files by hit count

| File | Hits |
|---|---:|
| `packages/db/migrations/003_seed_repaired_data.sql` | 21391 |
| `packages/migration/reports/track-playback-sources.full.json` | 7555 |
| `packages/migration/reports/track-artists.seed.json` | 7295 |
| `packages/migration/reports/chart-entry-tracks.seed.json` | 6332 |
| `packages/migration/reports/entity-relationships.full.json` | 6210 |
| `packages/migration/reports/entity-relationships.seed.json` | 6210 |
| `packages/migration/reports/release-tracks.seed.json` | 4293 |
| `packages/migration/reports/track-playback-sources.seed.json` | 2006 |
| `packages/migration/reports/relationship-review-queue.full.json` | 1899 |
| `packages/db/migrations/seed_chunks/023_entity_relationships.sql` | 1000 |
| `packages/db/migrations/seed_chunks/024_entity_relationships.sql` | 1000 |
| `packages/db/migrations/seed_chunks/025_entity_relationships.sql` | 1000 |
| `packages/db/migrations/seed_chunks/026_entity_relationships.sql` | 1000 |
| `packages/db/migrations/seed_chunks/027_entity_relationships.sql` | 1000 |
| `packages/db/migrations/seed_chunks/028_entity_relationships.sql` | 1000 |
| `packages/db/migrations/seed_chunks/030_track_artists.sql` | 1000 |
| `packages/db/migrations/seed_chunks/031_track_artists.sql` | 1000 |
| `packages/db/migrations/seed_chunks/032_track_artists.sql` | 1000 |
| `packages/db/migrations/seed_chunks/033_track_artists.sql` | 1000 |
| `packages/db/migrations/seed_chunks/034_track_artists.sql` | 1000 |
| `packages/db/migrations/seed_chunks/035_track_artists.sql` | 1000 |
| `packages/db/migrations/seed_chunks/036_track_artists.sql` | 1000 |
| `packages/db/migrations/seed_chunks/038_release_tracks.sql` | 1000 |
| `packages/db/migrations/seed_chunks/039_release_tracks.sql` | 1000 |
| `packages/db/migrations/seed_chunks/040_release_tracks.sql` | 1000 |
| `packages/db/migrations/seed_chunks/041_release_tracks.sql` | 1000 |
| `packages/db/migrations/seed_chunks/045_track_playback_sources.sql` | 1000 |
| `packages/db/migrations/seed_chunks/046_track_playback_sources.sql` | 1000 |
| `packages/db/migrations/seed_chunks/047_track_playback_sources.sql` | 1000 |
| `packages/db/migrations/seed_chunks/048_track_playback_sources.sql` | 1000 |

### Sample hits

- `database/migrations/20260603_001_wakilisha_runtime_schema.sql:6` — -- and legacy import mapping. WordPress is intentionally not part of runtime.
- `database/migrations/20260603_001_wakilisha_runtime_schema.sql:458` — -- Legacy import boundary: WordPress is import-only
- `database/migrations/20260603_001_wakilisha_runtime_schema.sql:463` — source_provider text NOT NULL DEFAULT 'wordpress' CHECK (source_provider IN ('wordpress', 'csv', 'manual', 'other')),
- `packages/db/migrations/001_staging_tables.sql:27` — -- This makes the importer resilient to CSV shape drift and old WordPress payload changes.
- `packages/db/migrations/003_seed_repaired_data.sql:12` — ('track', '2309', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:13` — ('track', '2311', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:14` — ('track', '2312', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:15` — ('track', '2313', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:16` — ('track', '2314', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:17` — ('track', '2315', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:18` — ('track', '2316', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:19` — ('track', '2317', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:20` — ('track', '2318', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:21` — ('track', '2319', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:22` — ('track', '2320', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:23` — ('track', '2321', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:24` — ('track', '2322', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:25` — ('track', '2323', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:26` — ('track', '2324', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:27` — ('track', '2325', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:28` — ('track', '2326', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:29` — ('track', '2327', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:30` — ('track', '2328', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:31` — ('track', '2329', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:32` — ('track', '2330', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:33` — ('track', '2331', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:34` — ('track', '2332', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:35` — ('track', '2333', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:36` — ('track', '2336', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:37` — ('track', '2337', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:38` — ('track', '2338', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:39` — ('track', '2339', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:40` — ('track', '2340', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:41` — ('track', '2341', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:42` — ('track', '2342', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:43` — ('track', '2343', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:44` — ('track', '2344', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:45` — ('track', '2345', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:46` — ('track', '2346', 'track_artist', 'artist', '390', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),
- `packages/db/migrations/003_seed_repaired_data.sql:47` — ('track', '2347', 'track_artist', 'artist', '166', 1, 'primary', 0.85, 'wp_wkcharts_track_artists', false, null),

## docs_only_reference

### Files by hit count

| File | Hits |
|---|---:|
| `docs/charts-ingest-backend-handoff.md` | 41 |
| `docs/supabase-full-data-audit.md` | 33 |
| `docs/parity/phase-6-api-parity-foundation.md` | 23 |
| `docs/react-parity-migration-plan.md` | 16 |
| `docs/parity/wp-plugin-verification.md` | 13 |
| `docs/wordpress-plugin-audit.md` | 12 |
| `docs/auth-review-queue-closure-runbook.md` | 11 |
| `docs/parity/master-parity-matrix.md` | 11 |
| `docs/chart-v2-rest-api-implementation-brief.md` | 10 |
| `docs/product-behavior-harness-audit.md` | 7 |
| `docs/public-charts-api-qa.md` | 7 |
| `docs/parity/html-feature-inventory.md` | 6 |
| `docs/supabase-preliminary-data-audit.md` | 5 |
| `docs/api-naming-audit.md` | 3 |
| `docs/cloudflare-waf-config.md` | 3 |
| `docs/data-contract.md` | 3 |
| `docs/parity/WAKILISHA_REACT_PARITY_CANON.md` | 3 |
| `docs/relationship-graph-build-spec.md` | 3 |
| `docs/chart-v2-content-qa-decisions.md` | 2 |
| `docs/parity/react-app-audit.md` | 2 |
| `docs/data-repair-first-implementation-plan.md` | 1 |

### Sample hits

- `docs/api-naming-audit.md:8` — The WAKILISHA project has grown from a WordPress migration into a 50-function Supabase Edge Function fleet, a public read API, a chart ingestion pipeline, a provider intake system, and an admin registry layer. This growth has created **nomenclature debt** that
- `docs/api-naming-audit.md:34` — | `migrate-*`, `import-*`, `clean-*` (12 functions) | WordPress migration / cleanup | Body params | Service-role only |
- `docs/api-naming-audit.md:326` — - **Handles:** chart scoring, data repair, WordPress import, backfills, migration scripts
- `docs/auth-review-queue-closure-runbook.md:17` — export RUN_ID="<WORDPRESS_INGESTION_RUN_UUID>"
- `docs/auth-review-queue-closure-runbook.md:206` — DATABASE_URL="$DATABASE_URL" npm run imports:promote-wordpress-registry -- --job "$RUN_ID"
- `docs/auth-review-queue-closure-runbook.md:212` — DATABASE_URL="$DATABASE_URL" npm run imports:resolve-wordpress-artists -- --job "$RUN_ID"
- `docs/auth-review-queue-closure-runbook.md:218` — DATABASE_URL="$DATABASE_URL" npm run imports:promote-wordpress-artist-relationships -- --job "$RUN_ID"
- `docs/auth-review-queue-closure-runbook.md:224` — DATABASE_URL="$DATABASE_URL" npm run imports:resolve-wordpress-term-relationships -- --job "$RUN_ID"
- `docs/auth-review-queue-closure-runbook.md:232` — DATABASE_URL="$DATABASE_URL" npm run imports:classify-wordpress-postmeta -- --job "$RUN_ID" --dry-run
- `docs/auth-review-queue-closure-runbook.md:238` — DATABASE_URL="$DATABASE_URL" npm run imports:classify-wordpress-postmeta -- --job "$RUN_ID"
- `docs/auth-review-queue-closure-runbook.md:244` — DATABASE_URL="$DATABASE_URL" npm run imports:classify-wordpress-postmeta -- --job "$RUN_ID" --apply-safe
- `docs/auth-review-queue-closure-runbook.md:252` — DATABASE_URL="$DATABASE_URL" npm run imports:operationalize-wordpress-media -- --job "$RUN_ID" --dry-run
- `docs/auth-review-queue-closure-runbook.md:258` — DATABASE_URL="$DATABASE_URL" npm run imports:operationalize-wordpress-media -- --job "$RUN_ID"
- `docs/auth-review-queue-closure-runbook.md:264` — DATABASE_URL="$DATABASE_URL" npm run imports:operationalize-wordpress-media -- --job "$RUN_ID" --apply-public-fields
- `docs/chart-v2-content-qa-decisions.md:83` — Final status should be decided after checking the original WordPress/source context.
- `docs/chart-v2-content-qa-decisions.md:132` — 1. Check whether both editions existed in the original WordPress/source data.
- `docs/chart-v2-rest-api-implementation-brief.md:3` — This brief defines the backend REST API scaffold for serving the Chart V2 ontology from WordPress or another backend without changing the current public React chart behavior.
- `docs/chart-v2-rest-api-implementation-brief.md:35` — /wp-json/wakilisha/v2
- `docs/chart-v2-rest-api-implementation-brief.md:43` — GET /wp-json/wakilisha/v2/charts/health
- `docs/chart-v2-rest-api-implementation-brief.md:51` — GET /wp-json/wakilisha/v2/charts
- `docs/chart-v2-rest-api-implementation-brief.md:59` — GET /wp-json/wakilisha/v2/charts/{programSlug}
- `docs/chart-v2-rest-api-implementation-brief.md:67` — GET /wp-json/wakilisha/v2/charts/{programSlug}/latest
- `docs/chart-v2-rest-api-implementation-brief.md:75` — GET /wp-json/wakilisha/v2/charts/{programSlug}/{editionSlug}
- `docs/chart-v2-rest-api-implementation-brief.md:83` — GET /wp-json/wakilisha/v2/charts/{programSlug}/{editionSlug}/entries
- `docs/chart-v2-rest-api-implementation-brief.md:91` — GET /wp-json/wakilisha/v2/charts/resolve/{slug}
- `docs/chart-v2-rest-api-implementation-brief.md:99` — GET /wp-json/wakilisha/v2/tracks/{trackSlug}/chart-history
- `docs/charts-ingest-backend-handoff.md:11` — This document is the reference implementation for the WordPress plugin / backend developer who will wire the real REST API to the React ingestion studio. The React app is built as a **contract-first** implementation — every screen, action, and state transition
- `docs/charts-ingest-backend-handoff.md:25` — | `/admin/settings/charts/integration-map` | Integration Map | **Dev-only.** Maps every frontend function to its future WordPress endpoint |
- `docs/charts-ingest-backend-handoff.md:39` — | `client.ts` | **Adapter boundary.** All components import from here. Switching `CHARTS_INGESTION_MODE` from `"mock"` to `"wordpress"` routes all calls to the WordPress adapter |
- `docs/charts-ingest-backend-handoff.md:60` — All endpoints are defined in `client.ts` as `WORDPRESS_CHART_ENDPOINTS` — a record of 26 endpoints with:
- `docs/charts-ingest-backend-handoff.md:66` — - `capabilities`: required WordPress capabilities
- `docs/charts-ingest-backend-handoff.md:71` — - `GET /wp-json/wakilisha/v1/charts/families`
- `docs/charts-ingest-backend-handoff.md:72` — - `POST /wp-json/wakilisha/v1/charts/ingest-jobs`
- `docs/charts-ingest-backend-handoff.md:73` — - `GET /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}`
- `docs/charts-ingest-backend-handoff.md:74` — - `GET /wp-json/wakilisha/v1/charts/ingest-jobs`
- `docs/charts-ingest-backend-handoff.md:75` — - `PATCH /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/status`
- `docs/charts-ingest-backend-handoff.md:76` — - `POST /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/cancel`
- `docs/charts-ingest-backend-handoff.md:77` — - `DELETE /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}`
- `docs/charts-ingest-backend-handoff.md:80` — - `POST /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/sources`
- `docs/charts-ingest-backend-handoff.md:81` — - `GET /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/sources`

## needs_manual_review

### Files by hit count

| File | Hits |
|---|---:|
| `project_plan.md` | 31 |
| `package.json` | 16 |
| `reports/chart-v2-api-fixtures.json` | 14 |
| `reports/chart-v2-api-fixtures.md` | 10 |
| `supabase/functions/enrich-artist-discography/index.ts` | 9 |
| `src/services/chartsPublic/client.ts` | 8 |
| `reports/chart-v2-api-fixture-check.json` | 6 |
| `reports/chart-v2-api-fixture-check.md` | 6 |
| `README.md` | 5 |
| `src/services/chartsIngestion/normalizers.ts` | 5 |
| `src/services/chartsIngestion/client.ts` | 4 |
| `src/services/chartsIngestion/simulation.ts` | 4 |
| `src/services/migrationImportJobs.ts` | 4 |
| `test/fixtures/README.md` | 4 |
| `packages/design-system/src/chapters/media.ts` | 3 |
| `src/design-system/chapters/media.ts` | 3 |
| `packages/design-system/src/designSystemManifest.ts` | 2 |
| `reports/chart-v2-live-api-smoke.md` | 2 |
| `src/components/charts/TrackChartHistory.tsx` | 2 |
| `src/data/adminSearchIndex.ts` | 2 |
| `src/design-system/designSystemManifest.ts` | 2 |
| `src/pages/charts/edition/page.tsx` | 2 |
| `src/services/adminReviewCommandCenter.ts` | 2 |
| `src/services/chartsIngestion/commitService.ts` | 2 |
| `src/services/mediaService.ts` | 2 |
| `src/utils/decodeHtmlEntities.ts` | 2 |
| `test/scoring/golden-file-migration.test.ts` | 2 |
| `data/supabase-imports/2026-05-30/README.md` | 1 |
| `reports/chart-v2-live-api-smoke.json` | 1 |
| `src/pages/mobile/charts/edition/page.tsx` | 1 |

### Sample hits

- `README.md:7` — WAKILISHA is moving from a WordPress plugin into a unified React app, but we are not copying WordPress into React. The old WordPress plugin and Supabase export contain the cultural data spine: tracks, artists, releases, labels, genres, charts, chart entries, m
- `README.md:75` — wk_wordpress_items.csv
- `README.md:112` — 3. Slug resolver from old slugs, registry hrefs, and WordPress items.
- `README.md:153` — docs/wordpress-plugin-audit.md
- `README.md:176` — Once this gate is met, the app can safely build charts, artists, tracks, releases, labels, genres, magazine, guides, registry canvas, the player, corrections, and Admin Studio without carrying over WordPress-era structural mess.
- `data/supabase-imports/2026-05-30/README.md:27` — wk_wordpress_items.csv
- `package.json:63` — "imports:classify-wordpress-postmeta": "tsx scripts/imports/classify-wordpress-postmeta.ts",
- `package.json:64` — "imports:connect-wordpress-database": "tsx scripts/imports/connect-wordpress-database.ts",
- `package.json:65` — "imports:connect-wordpress-rest": "tsx scripts/imports/connect-wordpress-rest.ts",
- `package.json:66` — "imports:discover-wordpress-mappings": "tsx scripts/imports/discover-wordpress-mappings.ts",
- `package.json:67` — "imports:finalize-wordpress-staging": "tsx scripts/imports/finalize-wordpress-staging.ts",
- `package.json:68` — "imports:operationalize-wordpress-media": "tsx scripts/imports/operationalize-wordpress-media.ts",
- `package.json:69` — "imports:plan-wordpress-staging": "tsx scripts/imports/plan-wordpress-staging.ts",
- `package.json:70` — "imports:process-wordpress-pipeline": "tsx scripts/imports/process-wordpress-pipeline.ts",
- `package.json:71` — "imports:process-wordpress-zips": "tsx scripts/imports/process-wordpress-zips.ts",
- `package.json:72` — "imports:promote-wordpress-artist-relationships": "tsx scripts/imports/promote-wordpress-artist-relationships.ts",
- `package.json:73` — "imports:promote-wordpress-registry": "tsx scripts/imports/promote-wordpress-registry-entities.ts",
- `package.json:74` — "imports:resolve-wordpress-artists": "tsx scripts/imports/resolve-wordpress-artists.ts",
- `package.json:75` — "imports:resolve-wordpress-term-relationships": "tsx scripts/imports/resolve-wordpress-term-relationships.ts",
- `package.json:76` — "imports:stage-wordpress-database-records": "tsx scripts/imports/stage-wordpress-database-records.ts",
- `package.json:77` — "imports:stage-wordpress-records": "tsx scripts/imports/stage-wordpress-records.ts",
- `package.json:78` — "imports:watch-wordpress-zips": "tsx scripts/imports/process-wordpress-zips.ts --watch",
- `packages/design-system/src/chapters/media.ts:32` — summary: 'Magazine surfaces feel authored, credible, and culturally specific. Articles need headline, dek, byline, section, date, hero, body, related entities, and attribution. Use --wk-w-text for reading body. Separate true editorial from WordPress shells usi
- `packages/design-system/src/chapters/media.ts:37` — 'Separate true editorial from WordPress shells using content classification.',
- `packages/design-system/src/chapters/media.ts:101` — summary: 'Repeatable public page structures that replace disjointed WordPress templates. Every archetype starts with data contract, then layout, then components. Pattern: page shell + hero + relationship modules + related content. No one-off pages where a reus
- `packages/design-system/src/designSystemManifest.ts:290` — 'Separate true editorial from WordPress shells using content classification.'
- `packages/design-system/src/designSystemManifest.ts:325` — purpose: 'Define the repeatable public page structures that replace disjointed WordPress templates.',
- `project_plan.md:49` — **Current state:** Music vertical is the mature layer. Real data has been imported from the legacy WordPress/Wkcharts stack into Supabase — 1,713 artists, 5,263 tracks, 687 releases, 232 labels, 27 genres, plus 74K+ relationship records. 859 dead unscoped trac
- `project_plan.md:61` — - WordPress import pipeline (staging → resolution → finalize)
- `project_plan.md:101` — 3. Handle the two-ID-space problem: WordPress post IDs (350 artists) vs Wkcharts auto-increment IDs (everything else)
- `project_plan.md:602` — ## WordPress Historical Chart Import — Clean Pipeline Architecture 🔴 PENDING (June 2026)
- `project_plan.md:606` — The old staging→finalize pipeline is **deprecated for charts**. Chart data must flow cleanly from WordPress directly into the v2 chart tables with registry canonicalization and publish-first semantics. No staging middleman.
- `project_plan.md:655` — - ~~`finalize-wp-staging`~~ — No longer used for chart data. Retained for non-chart entity staging→production.
- `project_plan.md:707` — ## Artist Discography Enrichment from WordPress ✅ COMPLETE (June 2026)
- `project_plan.md:713` — The WordPress database has richer, properly structured discography data in:
- `project_plan.md:714` — - `wp_wkcharts_release_shells` (97 release shells)
- `project_plan.md:715` — - `wp_wkcharts_release_shell_artists` (582 artist-release links)
- `project_plan.md:716` — - `wp_wkcharts_release_shell_tracks` (668 track-release links)
- `project_plan.md:717` — - `wp_wkcharts_tracks` (5,705 tracks)
- `project_plan.md:718` — - `wp_wkcharts_track_artists` (6,959 track-artist links)

## Recommended Next PRs

1. Add this audit guardrail and keep it runnable.
2. Add Cloudflare redirect/block plan for old WP routes.
3. Add media migration plan targeting AWS Lightsail media storage/origin, not Supabase Storage.
4. Hide legacy WordPress import tools behind an explicit admin legacy flag.
5. After verification, freeze WordPress and keep only a controlled archive window.
