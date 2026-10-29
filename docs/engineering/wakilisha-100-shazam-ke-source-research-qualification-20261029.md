# WAKILISHA 100: Shazam Kenya Source Research Qualification — 29 October 2026

**Programme:** #1264. **Source key:** `shazam_ke`. **Signal:** discovery / music-recognition rank, not audio streams, sales, views or a Kenya-wide listening count.

**Decision boundary:** Independently authored public-fact research dossier, **not** authorization to retrieve the full CSV, operate the unattended WK100 collector, create a production source contract, archive fresh bulk provider responses, rank a live candidate, or publish an Edition. Apply the [independent research operating model](wakilisha-100-independent-research-source-qualification-v1.md), not a universal provider-partnership prerequisite.

## 1. Source-derived evidence and provenance

| Observation | Authority and what it actually proves |
| --- | --- |
| Official chart surface | [Shazam Kenya Top 200](https://www.shazam.com/charts/top-200/kenya) is a Kenya-labelled Top 200 chart page offering a **Download CSV** control. Page describes the top songs in Kenya **this week**. This establishes publicly presented factual chart metadata and an advertised download feature; it does **not** by itself prove a commercial bulk-reuse permission or exact dated source-native interval. |
| Chart update semantics | [Apple Music for Artists — Charting on Shazam](https://artists.apple.com/support/1109-shazam-in-apple-music-for-artists): Shazam chart data updates every 24 hours and artist-facing charts show position/movement over the last seven days. It does **not** establish the exact beginning/end or timezone of each public CSV's data interval; Apple notes [different Shazam product schedules](https://itunespartner.apple.com/music/support/5235-shazam-for-artists). |
| Measurement type | [Apple Shazam Music Recognition & Privacy](https://www.apple.com/legal/privacy/data/en/music-recognition/) explains that Shazam observations arise from music-identification requests and their approximate locations. A Kenya chart rank is a **discovery signal**; it is not a count of plays or streams. |
| Report precedent | The same Apple privacy explanation identifies reporting to artists, labels and chart compilers as a use of Shazam-derived information. This confirms industry reporting is possible; it does **not** supply WAKILISHA with a licence or convert Shazam ranks into consumption data. |
| Current usage restriction requiring review | [Apple Media Services Terms](https://www.apple.com/legal/internet-services/itunes/) expressly list Shazam among covered services and include restrictions addressing automated scraping, copying, analysis and comparable manual processes, alongside commercial-use limitations. The **exact agreement applicable to this public CSV, WAKILISHA's Kenyan research method and its proposed archive/reuse has not been resolved**. A Download CSV control is evidence of a product feature, not an independent unrestricted commercial permission. |
| Historic WAKILISHA technical research | The [20 October source-method register](wakilisha-100-source-access-admission-register-v1.md) records 28/28 historic HTTP 200 CSV responses and 17 body digests in a September accessibility soak. These are older technical observations, **not current retrieval**, a permission verdict, source-period proof or prospective WK100 evidence. |

**Research actions in this review:** inspected the retained WAKILISHA repo record and public provider documentation. **No live chart CSV was downloaded**, no ranks or provider responses were newly archived, no credentials were used, and no chart endpoint was polled.

## 2. Actual acquisition methods are separate decisions

| Method | Current review result | Practical implication |
| --- | --- | --- |
| Metadata-level documentary review of the publicly presented Shazam chart and Apple's published explanation | **PUBLIC SOURCE METADATA VERIFIED** | Valid as a factual research input to this dossier. It is not a finding that all downstream uses are unrestricted. |
| Limited, accurately attributed human observation and reporting of particular public chart facts | **RESEARCH_REVIEW_REQUIRED** for the proposed capture/retention scope | Identify the precise facts, quantity, applicable terms and their agreement/exception basis before declaring that research method qualified; do not presume a contract is always required. |
| Researcher-written or researcher-triggered retrieval of full CSV | **RESEARCH_REVIEW_REQUIRED** | A human starting a script does not change the automated character of its HTTP request. Review the applicable contract, advertised CSV export conditions, number of records, recurrence and proposed archival/derived use. |
| Unattended `wk-chart-capture` GET plus full raw CSV WORM-like archive and commercial composite | **DEFER — not COLLECTOR_ELIGIBLE** | No source manifest, source-contract seed, schedule, secret activation, provider request or new Preview based on this dossier. Source-specific terms/retention decision and exact technical proof remain required. |

These are scoped review determinations, **not** a legal conclusion that individual public chart facts are protected or that the provider can veto WAKILISHA's original methodology. The separately archived terms analysis remains evidence of an unresolved *method-specific* restriction.

## 3. Exact measurement, provenance and Registry gaps

1. **Territory:** official title and chart page identify **Kenya**. The technical basis used by Shazam to attribute observations to Kenya, and the differences between Kenya-wide and city charts, require an explicit source-period/market record before any composite interpretation.
2. **Clock:** the consumer page describes **this week**, whereas Apple's artist-facing chart documentation describes 24-hour refreshes and seven-day movement. Neither supplies exact CSV start/end instants or an agreed timezone. Keep the WAKILISHA Monday **Africa/Nairobi** observation week distinct from the provider's native rolling/reporting period. Do **not** invent `native_period_start`, `native_period_end` or `native_period_evidence_ref`.
3. **Metric:** `discovery` + `rank` only. The chart position is not Shazam count, number of listeners, streams, plays, or YouTube views. Repeated snapshots of an unchanged chart do not create new recognition events.
4. **Current parser:** `parseShazamKenya` in `supabase/functions/_shared/chart-public-source-observations.mjs` parses `Rank,Artist,Title` from the CSV, enforces contiguous ranks and returns `provider_track_id: null`; it does not infer a Shazam-specific recording ID. Its extracted `provider_period_label` is not independent native-period truth.
5. **Private ranking blocker:** `wk100-capture-ranking-reader.mjs` resolves candidate rows only through existing exact `registry_track_provider_links` or confirmed `provider_entity_links` and active `registry_tracks`. A row with no provider-native ID cannot be automatically matched; title/artist similarity must **not** be elevated to canonical identity. Such evidence remains `review_required` until a separately governed identity/link method has proven the exact recording. The SHA-256 and native raw-row replay checks are necessary, not sufficient.
6. **Source integrity:** no current, independently qualified live full-CSV acquisition path or new prospective WK100 Shazam receipt was exercised in this review; the historic September 28-day soak is not substitute evidence.

## 4. Decisive next source-specific proofs

**One short review, no five-provider negotiation programme:**

- Confirm the operative Apple/Shazam terms governing use of the **public Kenya Top 200 CSV** in WAKILISHA's actual research context, including whether the restrictions above apply to an advertised export, selected factual reporting, researcher-triggered downloads, full archival and original commercial composite. Record source URL/version, responsible reviewer and the concrete permissible method. Do not bypass any authentication or rate limit. A written licence is **not** presumed universally necessary, but if the selected method requires permission, obtain it.
- Identify an authoritative date/period signal for that specific CSV; retain a provider-native clock independent of Monday EAT. A seven-day artist dashboard description alone is **not** enough.
- Establish an approved, non-fuzzy identity evidence path for CSV rows without stable provider IDs, including independent Registry review and the original recording/variant; otherwise the captured evidence may support editorial analysis but **not** private rank scoring.
- Only for a positively qualified method, design one bounded *prospective* nonpublishing capture with real byte receipts, source version and operator review. Prove native parsing, digest/object readback, row replay, Registry bindings, missingness and an explicit blocked/review-only outcome before considering recurring collection.

## 5. Decision record and operating state

| Gate | Result, 29 Oct 2026 |
| --- | --- |
| Public Kenya source metadata and advertised CSV availability | **VERIFIED** from provider documentation |
| Research qualification for a specific retained ranked-fact sample | **REVIEW REQUIRED** (quantity/use/terms not signed off) |
| Unattended WK100 collector method | **DEFERRED** (actual access, reuse and retention terms unresolved) |
| Exact provider-native time window | **UNVERIFIED** |
| Immutable provider-native recording identity from current CSV parser | **ABSENT** |
| Genuine prospective receipt + verified Registry resolution | **NOT STARTED** |
| WK100 Edition or scoring/publication authorization | **NO** |

**No operational mutations:** `WK100_CAPTURE_ENABLED` stays unset/false; the collector source manifest remains unapproved, candidate contracts/receipts/raw objects remain unseeded, and this dossier creates no cron, provider traffic, server secret, storage object or release approval. Continue #1264 with source-specific research, not blanket permission assumptions.

**Historical research consulted:** [source-access admission register](wakilisha-100-source-access-admission-register-v1.md), [source legal-usability assessment](wakilisha-100-source-legal-usability-and-zero-cost-partnership-v1.md), [integrated capture runtime](wakilisha-100-integrated-capture-runtime-v1.md), and [private receipt replay](wk100-private-capture-preview-server-v1.md).
