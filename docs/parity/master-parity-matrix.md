# Phase 4 — Master Parity Matrix

## Purpose

This is the execution gate for the WAKILISHA React rebuild.

It merges:

1. **Phase 0** — React parity canon
2. **Phase 1** — HTML feature inventory
3. **Phase 2** — WordPress plugin verification
4. **Phase 3** — Current React app audit

The matrix determines what gets added, preserved, consolidated, removed, deferred, or explicitly protected.

## Non-Negotiable React Baseline

The React app is **not** being reduced back to the WordPress plugin or the HTML document.

The HTML is the feature/disposition canon. WordPress is the verification source. React is the forward product baseline.

Therefore:

- Preserve the newly developed **chart families** model.
- Preserve the newer **taxonomical ordering** work.
- Preserve richer React-first public surfaces when they improve on WordPress.
- Preserve the v2 chart API/migration approach already developed.
- Improve missing canon features by aligning them to the React architecture, not by recreating WordPress shells.
- Do not reintroduce WordPress-era presentation scaffolding, even when the plugin contains it.

## Action Vocabulary

| Action | Meaning |
|---|---|
| `KEEP` | Existing React implementation aligns with canon and should remain. |
| `PROTECT` | Existing React implementation is better than WordPress-era structure and must not be flattened. |
| `ADD` | Feature is missing in React and should be added. |
| `COMPLETE` | Feature exists partially and needs implementation completion. |
| `CONSOLIDATE` | Feature exists across multiple legacy surfaces or duplicated paths and should be unified. |
| `REMOVE` | Feature exists in React but conflicts with canon/drop scope. |
| `DEFER` | Feature is real but not required for immediate parity. |
| `DO_NOT_PORT` | Feature exists in WordPress but must not cross into React parity. |

## Priority Vocabulary

| Priority | Meaning |
|---|---|
| `P0` | Required before serious public parity work continues. |
| `P1` | Core registry/product parity. |
| `P2` | Important operational or account parity. |
| `P3` | Later commercial/ops polish. |
| `P4` | Explicitly deferred or out of parity scope. |

---

# 1. Public Routes & Product Surfaces

| Domain | Feature / Route | HTML Disposition | WP Verified | React Status | Action | Priority | Notes / Acceptance Criteria |
|---|---|---:|---:|---:|---:|---:|---|
| Charts | `/charts` directory | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT | PROTECT | P0 | Preserve React chart-family structure, taxonomy ordering, richer directory UI, and v2 API integration. Do not flatten to old WP listing. |
| Charts | `/charts/:series` latest chart | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT | PROTECT | P0 | Preserve React route and resolve logic. Ensure latest non-empty edition works with chart-family mapping. |
| Charts | `/charts/:series/:edition` | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT | PROTECT | P0 | Preserve ranking, movement, track/artist links, chart entries, and player integration. |
| Charts | `/charts/:series/:date` canonical dated route | CARRY_OVER | WP_CONFIRMED | REACT_PARTIAL | COMPLETE | P1 | Support dated edition aliases where current React route uses `:edition`. Date-based URL should resolve into the v2 edition model. |
| Charts | `/charts/:series/:cc` country route | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P1 | Add country/market-aware route resolution without disrupting chart families. |
| Charts | `/charts/:series/:cc/:date` country + date route | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P1 | Add market/date resolution using chart program/family/taxonomy model. |
| Charts | `/charts/discover` | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P1 | Build chart discovery hub using React chart families and taxonomy ordering. |
| Charts | `/charts/discover/:x` | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P2 | Add subroute only after core discover hub is stable. |
| Artists | `/artists` directory | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT | KEEP | P1 | Preserve React UI. Ensure registry-backed data, filters, search, and taxonomy metadata. |
| Artists | `/artists/:slug` detail | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT | KEEP | P1 | Ensure canonical artist, aliases, genres, releases, tracks, chart history, follow state, and image handling. |
| Tracks | `/tracks/:slug` detail | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT | KEEP | P1 | Ensure chart history, artist links, release links, player integration, metadata, and share state. |
| Releases | `/releases` directory | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT | KEEP | P1 | Preserve improved React directory if already richer than WP. |
| Releases | `/releases/:slug` detail | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT | KEEP | P1 | Ensure tracklist, artists, labels, artwork, source links, and canonical release relationships. |
| Genres | `/genres` directory | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT | PROTECT | P1 | Preserve newer taxonomical ordering and genre hierarchy work. Do not reduce to WP taxonomy shell. |
| Genres | `/genres/:slug` detail | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P1 | Add canonical genre detail route if not fully present. Must use registry genre model, not WP taxonomy duplication. |
| Labels | `/labels` archive | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT | KEEP | P1 | Preserve improved label directory. Ensure many-published-label support. |
| Labels | `/labels/:slug` detail | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P1 | Add label detail with releases, tracks, artists, chart presence, and related entities. |
| Collections | `/collections` archive | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P1 | Add collection directory using registry collections, not editorial shells. |
| Collections | `/collections/:slug` detail | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P1 | Add collection detail, items, ordering, metadata, share/player support. |
| Search | `/search` | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT | KEEP | P1 | Ensure registry-wide search across charts, artists, tracks, releases, labels, genres, collections. |
| Public Profile | `/@:username` | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P2 | Add/complete handle route over user graph. Should not rely on WP profile surface CPT. |
| Profile | `/profile` | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT | COMPLETE | P2 | Keep existing route; ensure token/session auth, user graph identity, preferences, follows. |
| Settings | `/settings` | CONSOLIDATE | WP_CONFIRMED | REACT_PRESENT_OR_PARTIAL | CONSOLIDATE | P2 | Rebuild around unified settings/preferences domains. No surface CPT model. |
| Auth | `/auth` | CONSOLIDATE | WP_CONFIRMED | REACT_PRESENT | COMPLETE | P2 | Ensure token/session flow, reset/verify/register, rate limits, Apple if retained. |
| Top 10 | `/my-top-10` | CONSOLIDATE | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P2 | Add native Top 10 feature only if it uses registry tracks/entities and share token model. |
| Top 10 | `/my-top-10/:token` | CONSOLIDATE | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P2 | Add shareable public token route. |
| Corrections | `/corrections` | CONSOLIDATE | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P2 | Add correction workflow over governance API. Drop WP surface. |
| Corrections | `/corrections/submitted` | CONSOLIDATE | WP_CONFIRMED | REACT_MISSING | ADD | P2 | Confirmation state for correction flow. |
| Corrections | `/corrections/:type/:id` | CONSOLIDATE | WP_CONFIRMED | REACT_MISSING | ADD | P2 | Entity-specific correction form. |
| Newsletter | `/newsletter/:mm/:dd/:yyyy/:slug` | CONSOLIDATE | WP_CONFIRMED | REACT_MISSING | DEFER | P3 | Handle later under audience/CMS. Not a blocker for registry parity. |
| Magazine | `/magazine` | DROP | WP_CONFIRMED | REACT_PRESENT | REMOVE | P4 | Current React route exists but conflicts with canon. Remove from core parity or quarantine as future CMS/static outside registry parity. |
| Magazine | `/magazine/:slug` | DROP | WP_CONFIRMED | REACT_PRESENT | REMOVE | P4 | Same as above. |
| Methodology | `/methodology` | DROP | WP_CONFIRMED | REACT_ABSENT | DO_NOT_PORT | P4 | Do not recreate hardcoded WP methodology shell. |
| Play Lab | `/play`, `/play/app` | DROP | WP_CONFIRMED | REACT_ABSENT | DO_NOT_PORT | P4 | Do not add. React `/player` may stay as product player. |
| Player | `/player` | CARRY_OVER | WP_PARTIAL | REACT_PRESENT | PROTECT | P1 | Protect React player as product surface. It is not the excluded `/play` lab. |

---

# 2. React Route Map Alignment

| Area | Current React Route Status | Action | Priority | Notes |
|---|---:|---:|---:|---|
| Main responsive app layout | Present | KEEP | P0 | Preserve responsive layout pattern. |
| Mobile route variants | Present | KEEP | P1 | Preserve mobile-specific pages, but QA light/dark parity. |
| Admin charts routes | Present | PROTECT | P0 | New admin charts area is a forward baseline. |
| Admin design system route | Present | DEFER | P3 | Useful internally, but should not become product parity center. |
| Missing collections routes | Missing/partial | ADD | P1 | Required by canon. |
| Missing profile handle route | Missing/partial | ADD | P2 | Required by canon. |
| Missing correction routes | Missing/partial | ADD | P2 | Required by governance/corrections canon. |
| Magazine routes | Present | REMOVE | P4 | Remove/quarantine from core parity. |

---

# 3. API & Data Layer Matrix

| Domain | API / Data Capability | HTML Disposition | WP Verified | React Status | Action | Priority | Notes / Acceptance Criteria |
|---|---|---:|---:|---:|---:|---:|---|
| V2 Charts API | `/wp-json/wakilisha/v2/charts/health` | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT | PROTECT | P0 | Preserve health/readiness and database mode checks. |
| V2 Charts API | chart programs/families list | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT | PROTECT | P0 | Preserve React chart-family model and public labels. |
| V2 Charts API | chart resolve aliases | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT | PROTECT | P0 | Extend, do not replace. |
| V2 Charts API | chart edition entries | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT | PROTECT | P0 | Preserve entry normalization and movement/rank model. |
| V2 Charts API | track chart history | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT | KEEP | P1 | Extend into track detail and artist/release pages. |
| Registry Search API | `/search`, `/registry/search` | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P1 | Formalize typed search API across registry entities. |
| Artist API | `/artists/:id` | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P1 | Should serve artist detail, relationships, stats, genres, origin. |
| Track API | `/tracks/:id` | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P1 | Should serve track detail, chart history, artists, release, sources. |
| Release API | `/releases/:id` | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P1 | Should serve release detail, tracks, labels, artists, artwork. |
| Label API | `/labels/:id` | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P1 | Should serve label detail and relationships. |
| Genre API | `/genres/:id` | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P1 | Should serve canonical genre hierarchy/taxonomy. |
| Collection API | `/collections/:id` | CARRY_OVER | WP_CONFIRMED | REACT_MISSING | ADD | P1 | Required for collections. |
| User Graph API | follow entity | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | COMPLETE | P2 | One generic follow API, not duplicated artist/chart paths. |
| User Graph API | `/me/feed` | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P2 | Personalized feed. |
| User Graph API | `/me/recommendations` | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P2 | Recommendation endpoint, recompute job later. |
| User Graph API | `/me/identity` | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P2 | Identity snapshot endpoint. |
| Auth API | signin/register/verify/reset | CONSOLIDATE | WP_CONFIRMED | REACT_PARTIAL | COMPLETE | P2 | Token/session based. No WP cookie assumption. |
| Preferences API | display/audible/notifications | CONSOLIDATE | WP_CONFIRMED | REACT_PARTIAL | CONSOLIDATE | P2 | One user preferences object. |
| Corrections API | correction submit/status | CONSOLIDATE | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P2 | Governance-backed correction flow. |
| Analytics API | share/search/site/internal events | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P3 | Convert relevant AJAX to REST/event API. |
| GSC Data API | import/matching/settings | CONSOLIDATE | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | DEFER | P3 | Keep as analytics signal only. |
| GSC Content API | content idea/draft/editorial radar | DROP | WP_CONFIRMED | REACT_ABSENT | DO_NOT_PORT | P4 | Explicitly excluded. |

---

# 4. Registry Data Model Matrix

| Domain | Registry Capability | HTML Disposition | WP Verified | React Status | Action | Priority | Notes / Acceptance Criteria |
|---|---|---:|---:|---:|---:|---:|---|
| Core Entities | artists, tracks, releases, labels, genres | CARRY_OVER | WP_CONFIRMED | REACT_PARTIAL | COMPLETE | P1 | Preserve all imported/published data. UI must adapt to data, not prebuilt buckets. |
| Chart Core | charts, programs/families, editions, edition_items | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT | PROTECT | P0 | Preserve new chart-family/program model. |
| Collections | collections, collection_items | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P1 | Add directory/detail and API. |
| Relationships | track_artists, release_tracks, release_labels, artist_genres, aliases, entity relationships | CARRY_OVER | WP_CONFIRMED | REACT_PARTIAL | COMPLETE | P1 | Entity pages must expose graph relationships. |
| Provenance | field/source attribution | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P2 | Admin first; public display later if useful. |
| Materialized Stats | artist/track/release/genre/label/chart stats | CARRY_OVER | WP_CONFIRMED | REACT_PARTIAL | COMPLETE | P1 | Preserve precompute strategy. Avoid heavy runtime aggregation. |
| Quality | quality scores, duplicates, repair queue | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P2 | Admin registry ops. |
| Governance | corrections, capability audit, audit events | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P2 | Needed for corrections workflow and data trust. |
| Snapshots | edition snapshots, integrity checks, repair logs | CARRY_OVER | WP_CONFIRMED | REACT_PARTIAL | COMPLETE | P1 | Required for chart reliability. |
| Jobs | jobs/logs/events/ingest runs/reports | CARRY_OVER | WP_CONFIRMED | REACT_PARTIAL | COMPLETE | P1 | Needed for ingestion, status polling, ops. |
| Release Intelligence | release shells, shell tracks/artists, canonicalization gaps | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P1 | Required for no-match ingestion cleanup. |
| Airplay | projects, detections, evidence | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | DEFER | P3 | Important later; not first public parity blocker. |
| User Graph | follows, feed, recommendations, identity | CARRY_OVER | WP_CONFIRMED | REACT_PARTIAL | COMPLETE | P2 | Account/user layer. |
| Audience | subscribers, optins, newsletter issues | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | DEFER | P3 | Retain but not before core registry/entity parity. |
| Analytics | search/site/internal events | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P3 | Needed for data-led iteration. |
| Editorial Intelligence | summaries/prompts/opportunities | CONSOLIDATE | WP_PARTIAL | REACT_MISSING_OR_PARTIAL | DEFER | P3 | Keep registry intelligence only; no content studio. |
| Content Ideas | content_ideas | DROP | WP_CONFIRMED | REACT_ABSENT | DO_NOT_PORT | P4 | Excluded. |

---

# 5. Admin Console Matrix

| Admin Domain | Feature / Surface | HTML Disposition | WP Verified | React Status | Action | Priority | Notes / Acceptance Criteria |
|---|---|---:|---:|---:|---:|---:|---|
| Admin IA | Ingest · Registry · Entities · Operations · Audience · Settings | CONSOLIDATE | WP_CONFIRMED | REACT_PARTIAL | CONSOLIDATE | P1 | Collapse WP admin sprawl into coherent React admin IA. |
| Ingest | Admin charts dashboard | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT | PROTECT | P0 | Preserve and improve current `/admin/charts/dashboard`. |
| Ingest | Families/programs | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT | PROTECT | P0 | Preserve chart-family admin. |
| Ingest | Ingest Studio | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT | PROTECT | P0 | Preserve dry-run/job improvements. Complete missing provider/canonicalization features. |
| Ingest | Ingest detail/job status | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT | KEEP | P1 | Ensure retry/cancel/logs/status are supported. |
| Ingest | Editions | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT | KEEP | P1 | Tie to snapshots, QA, entries. |
| Ingest | Snapshots | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT | KEEP | P1 | Complete integrity checks/repair if missing. |
| Ingest | Integration map | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT | KEEP | P2 | Useful QA/admin diagnostic. |
| Ingest | Public API QA | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT | KEEP | P2 | Use to validate public API shape. |
| Registry | Registry Browser | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P1 | Browse/search/drawer/merge entities. |
| Registry | Schema Audit | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P2 | Verify registry DB readiness and schema versions. |
| Registry | Graph | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P2 | Entity relationship graph. |
| Registry | Provenance | CARRY_OVER | WP_CONFIRMED | REACT_MISSING | ADD | P2 | Admin surface for source attribution. |
| Registry | Data Quality | CARRY_OVER | WP_CONFIRMED | REACT_MISSING | ADD | P2 | Scores, duplicates, repair queue. |
| Registry | Materialized Stats | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P2 | Stats refresh admin action. |
| Entities | Artists admin | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P2 | Entity admin details and enrichment. |
| Entities | Tracks admin | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P2 | Track enrichment/review. |
| Entities | Releases admin | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P2 | Release metadata and shell resolution. |
| Entities | Labels admin | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P2 | Label metadata and relationships. |
| Entities | Genre Registry | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P2 | Preserve taxonomical ordering/hierarchy. |
| Operations | Jobs / Registry Ops | CARRY_OVER | WP_CONFIRMED | REACT_PARTIAL | COMPLETE | P1 | Queue, logs, retry/cancel/poll. |
| Operations | Reports + Exports | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P3 | Later operational surface. |
| Operations | Coverage / Promotions / Tracklists / Repairs / Text Integrity | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | DEFER | P3 | Useful after core entity/admin parity. |
| Governance | Corrections / capability audit | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P2 | Back public corrections flow. |
| Audience | Subscribers / optins / briefings | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | DEFER | P3 | Preserve, but not first phase. |
| Settings | Unified settings | CONSOLIDATE | WP_CONFIRMED | REACT_PARTIAL | CONSOLIDATE | P2 | One domain settings UI/API. |
| Appearance | Frontend appearance | CONSOLIDATE | WP_CONFIRMED | REACT_PARTIAL | CONSOLIDATE | P2 | Route appearance records, design tokens, hero assets. |
| Design System | Admin design system | NEW_IN_REACT | WP_CONFIRMED | REACT_PRESENT | DEFER | P3 | Keep for internal QA but do not over-prioritize as parity product. |
| Magazine Admin | Magazine config/editor | DROP | WP_CONFIRMED | REACT_ABSENT_OR_PRESENT | DO_NOT_PORT | P4 | Excluded. |
| Universal Shells | shell save/reset | DROP | WP_CONFIRMED | REACT_ABSENT | DO_NOT_PORT | P4 | Excluded. |

---

# 6. Ingestion & Enrichment Matrix

| Domain | Feature / Workflow | HTML Disposition | WP Verified | React Status | Action | Priority | Notes / Acceptance Criteria |
|---|---|---:|---:|---:|---:|---:|---|
| Ingest | Input validation | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT_OR_PARTIAL | COMPLETE | P1 | Support chart title/slug/date, size, kind, cover style, source URLs, saved family settings. |
| Ingest | Provider detection | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT_OR_PARTIAL | COMPLETE | P1 | Spotify and Apple detection; market/storefront defaults through settings. |
| Ingest | Resource guard | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P2 | Prevent abusive/heavy ingest runs. |
| Ingest | Source fetch | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT_OR_PARTIAL | COMPLETE | P1 | Multi-source provider fetch. |
| Ingest | Normalize rows | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT_OR_PARTIAL | COMPLETE | P1 | Uniform row shape for rank/title/artists/release/identifiers. |
| Ingest | Canonical match | CARRY_OVER | WP_CONFIRMED | REACT_PARTIAL | COMPLETE | P1 | Match rows to tracks/releases/artists/labels; preserve no-match queues. |
| Ingest | Release shells/no-match | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P1 | Required to close ingestion quality loop. |
| Ingest | Dry run | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT | KEEP | P1 | Must remain before commit. |
| Ingest | Commit/snapshot | CARRY_OVER | WP_CONFIRMED | REACT_PRESENT_OR_PARTIAL | COMPLETE | P1 | Edition, items, snapshots, ingest run logs. |
| Enrichment | Spotify provider | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | COMPLETE | P2 | Metadata/artwork/source. Secrets server-side. |
| Enrichment | Apple Music provider/JWT | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | COMPLETE | P2 | MusicKit/previews. Secrets server-side. |
| Enrichment | ACRCloud | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | DEFER | P3 | Keep for preview recovery/fingerprinting, not first public parity blocker. |
| Enrichment | YouTube embeds/oEmbed | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | COMPLETE | P2 | Embed/playback support where applicable. |
| GSC | Import/matching | CONSOLIDATE | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | DEFER | P3 | Analytics signal only. |
| GSC | Content idea/draft generation | DROP | WP_CONFIRMED | REACT_ABSENT | DO_NOT_PORT | P4 | Excluded. |

---

# 7. Settings, Appearance, Auth & User Graph Matrix

| Domain | Capability | HTML Disposition | WP Verified | React Status | Action | Priority | Notes / Acceptance Criteria |
|---|---|---:|---:|---:|---:|---:|---|
| Settings | Integrations domain | CONSOLIDATE | WP_CONFIRMED | REACT_PARTIAL | CONSOLIDATE | P2 | Spotify, Apple, ACRCloud, GSC. Secrets server-side. |
| Settings | Appearance domain | CONSOLIDATE | WP_CONFIRMED | REACT_PARTIAL | CONSOLIDATE | P2 | Route heroes, accent tokens, login background, theme mode. |
| Settings | Player & Playback domain | CONSOLIDATE | WP_CONFIRMED | REACT_PARTIAL | CONSOLIDATE | P2 | Player variant, motion, audible defaults. |
| Settings | Ingestion domain | CONSOLIDATE | WP_CONFIRMED | REACT_PARTIAL | CONSOLIDATE | P2 | Family/source settings, CSV mapping. |
| Settings | Registry domain | CONSOLIDATE | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P2 | Schema/materialization/quality thresholds. |
| Settings | Email & Audience domain | CONSOLIDATE | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | DEFER | P3 | From address/templates/briefings. |
| Settings | Maintenance domain | CONSOLIDATE | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P3 | Rate-limit reset, debug, repair controls. |
| Appearance | Dark/light mode | CONSOLIDATE | WP_CONFIRMED | REACT_PRESENT | PROTECT | P1 | Preserve React theme provider/tokens. QA all screens. |
| Appearance | Route hero assets | CONSOLIDATE | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P2 | Managed route appearance records, not scattered fields. |
| Auth | Token/session auth | CONSOLIDATE | WP_CONFIRMED | REACT_PARTIAL | COMPLETE | P2 | No WP cookie trust. |
| Auth | Register/verify/reset | CARRY_OVER | WP_CONFIRMED | REACT_PARTIAL | COMPLETE | P2 | Full account flow. |
| Auth | Sign in with Apple | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | DEFER | P3 | Add if strategically needed. |
| User Graph | Follow entity | CARRY_OVER | WP_CONFIRMED | REACT_PARTIAL | COMPLETE | P2 | One generic follow model. |
| User Graph | Feed/recommendations | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P2 | Needs API + route/display surfaces. |
| User Graph | Identity snapshot | CARRY_OVER | WP_CONFIRMED | REACT_MISSING_OR_PARTIAL | ADD | P2 | Account/profile personalization. |
| Preferences | Display/audible/notifications | CONSOLIDATE | WP_CONFIRMED | REACT_PARTIAL | CONSOLIDATE | P2 | One preference object. |

---

# 8. Explicit Removal / Non-Port Matrix

| Area | Feature | HTML Disposition | WP Verified | React Status | Action | Priority | Notes |
|---|---|---:|---:|---:|---:|---:|---|
| WordPress Shells | universal content/taxonomy/page-registry shells | DROP | WP_CONFIRMED | REACT_ABSENT | DO_NOT_PORT | P4 | React owns rendering. |
| Surface CPTs | labels/settings/profile/corrections/play/magazine/methodology surfaces | DROP_OR_CONSOLIDATE | WP_CONFIRMED | REACT_ABSENT_OR_PARTIAL | DO_NOT_PORT | P4 | Preserve underlying feature only where marked consolidate. |
| Magazine | magazine public/admin/editor | DROP | WP_CONFIRMED | REACT_PRESENT | REMOVE | P4 | Quarantine as future CMS/static if wanted. Not registry parity. |
| Field Guides | field guide templates/styles | DROP | WP_CONFIRMED | REACT_ABSENT | DO_NOT_PORT | P4 | Excluded. |
| Methodology | methodology hardcoded app/page | DROP | WP_CONFIRMED | REACT_ABSENT | DO_NOT_PORT | P4 | Excluded. |
| Content Studio | GSC content ideas/draft generation/editorial radar | DROP | WP_CONFIRMED | REACT_ABSENT | DO_NOT_PORT | P4 | Excluded. |
| Play Lab | `/play`, play surface, play shortcode | DROP | WP_CONFIRMED | REACT_ABSENT | DO_NOT_PORT | P4 | Excluded. |
| Woo Skin | WP Woo takeover | CONSOLIDATE | WP_CONFIRMED | REACT_ABSENT | DEFER | P4 | Clean commerce module later. |
| WP Navbar/Footer | PHP render coupling | NEW_IN_REACT | WP_CONFIRMED | REACT_PRESENT | KEEP | P1 | Use React layout/navigation. |

---

# 9. Phase 5 Implementation Queue

## P0 — Protect and stabilize the new React chart foundation

| Task | Action | Acceptance Criteria |
|---|---:|---|
| Preserve chart-family model | PROTECT | No patch may flatten chart programs/families into old WP archive logic. |
| Preserve taxonomical ordering | PROTECT | Genres/charts/directories retain React ordering/hierarchy improvements. |
| Preserve v2 chart API | PROTECT | Existing health/list/resolve/edition/entries endpoints remain stable. |
| Preserve responsive layout and player foundation | PROTECT | Public/mobile/desktop player and layout remain functional. |

## P1 — Public registry parity

| Task | Action | Acceptance Criteria |
|---|---:|---|
| Add chart discover routes | ADD | `/charts/discover` works with React chart families. |
| Complete chart route variants | COMPLETE | Date/country/country-date routes resolve to v2 chart programs/editions. |
| Add/complete genre detail | ADD | `/genres/:slug` renders canonical genre data. |
| Add/complete label detail | ADD | `/labels/:slug` renders canonical label data. |
| Add collections | ADD | `/collections` and `/collections/:slug` work. |
| Complete registry entity APIs | COMPLETE | Artists/tracks/releases/labels/genres/collections served through typed API. |
| Complete release shell/no-match workflow | COMPLETE | Ingest can surface and resolve no-match entities. |

## P2 — Account, governance, settings, admin ops

| Task | Action | Acceptance Criteria |
|---|---:|---|
| Add public handle profile route | ADD | `/@:username` works over user graph. |
| Complete auth and preferences | COMPLETE | Token/session, profile, preferences, reset/verify flows work. |
| Add Top 10 native feature | ADD | Uses registry tracks and share token route. |
| Add corrections workflow | ADD | Public submission + governance-backed admin review. |
| Consolidate unified settings | CONSOLIDATE | One settings API/UI with domains. |
| Add registry browser/admin ops | ADD | Browse/search/merge/quality/provenance/stats admin surfaces. |

## P3 — Operational maturity

| Task | Action | Acceptance Criteria |
|---|---:|---|
| Add analytics events | ADD | Search/share/site/internal events captured. |
| Add GSC import/matching | DEFER/ADD | Import/matching only; no content studio. |
| Add audience/briefings | DEFER | Audience lifecycle retained after core parity. |
| Add airplay operations | DEFER | Airplay project/detection/evidence later. |
| Add reports/exports | ADD | Admin reports/export surface. |

## P4 — Do not port / remove

| Task | Action | Acceptance Criteria |
|---|---:|---|
| Remove/quarantine magazine routes | REMOVE | `/magazine` no longer appears as core registry parity route. |
| Do not add `/play` | DO_NOT_PORT | No play lab routes or surface. |
| Do not recreate universal shells | DO_NOT_PORT | No universal content/taxonomy shell architecture. |
| Do not port content studio | DO_NOT_PORT | No GSC content idea/draft generation. |
| Do not port bespoke editorial templates | DO_NOT_PORT | Guides/methodology/magazine templates excluded. |

---

# 10. Verification Standard for Every Implementation Patch

Every implementation patch after this matrix must include:

1. **Matrix row reference** — which row(s) it satisfies.
2. **Route/API proof** — route/API path tested.
3. **Data proof** — confirms real registry data is used where available.
4. **Mode proof** — desktop/mobile and light/dark mode checked for visible surfaces.
5. **Build proof** — `npm run build` passes.
6. **Smoke proof** — relevant chart/API smoke scripts pass where applicable.

Recommended existing scripts:

```bash
npm run build
npm run charts:v2-db-readiness
npm run charts:v2-live-smoke
npm run charts:v2-local-api
npm run charts:v2-api-fixture-check
```

---

# 11. Phase 4 Completion Criteria

Phase 4 is complete when this matrix becomes the source of truth for implementation.

No future patch should be accepted if it:

- Adds a `DROP` feature.
- Reintroduces WordPress surface CPT thinking.
- Replaces React chart families with legacy WP chart shell logic.
- Ignores taxonomical ordering improvements.
- Adds fake placeholder buckets where registry data exists.
- Treats HTML visual structure as a ceiling rather than a canon of features/dispositions.

The next phase is **Phase 5 — Public route parity**, beginning with P0 protection and P1 route/API gaps.
