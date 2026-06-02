# WAKILISHA Public Charts API QA Guide

## Overview

The Public Charts API QA route (`/admin/settings/charts/public-api-qa`) is a developer-facing diagnostic screen for validating all public chart service endpoints before switching from mock mode to live WordPress mode.

---

## How to Run the QA Route

1. Navigate to `/admin/settings/charts/public-api-qa` (accessible from the **Public API QA** tab in the Admin Charts navigation)
2. Click **Run all tests** to execute all 6 endpoint tests sequentially
3. Review results — each test shows status, duration, data source, and result count
4. Click **Copy smoke report** to copy a compact plain-text summary for sharing

---

## What Each Test Validates

| Test | Function | Endpoint | Validates |
|------|----------|----------|-----------|
| Families | `getChartFamilies()` | `GET /charts` | All chart family records are returned |
| Family | `getChartFamily(slug)` | `GET /charts/{family}` | Single family lookup by slug |
| Latest Edition | `getLatestChartEdition(slug)` | `GET /charts/{family}/latest` | Latest edition is published and accessible |
| Specific Edition | `getChartEdition(family, edition)` | `GET /charts/{family}/{edition}` | Named edition resolves correctly |
| Edition Entries | `getChartEditionEntries(family, edition)` | `GET /charts/{family}/{edition}/entries` | Chart entries are present and correctly structured |
| Track History | `getTrackChartHistory(slug)` | `GET /tracks/{slug}/chart-history` | Track appearances across editions are returned |

---

## Status Meanings

| Status | Meaning |
|--------|---------|
| **PASS** | Endpoint returned data without errors and result count > 0 |
| **WARN** | Endpoint responded but returned 0 results (unexpected) |
| **FAIL** | Endpoint threw an error (network, HTTP, parse, or timeout) |
| **IDLE** | Test has not been run yet, or cache was cleared |

---

## How to Switch from Mock to WordPress Mode

1. Set environment variables in your `.env` or deployment config:
   ```env
   VITE_CHARTS_PUBLIC_MODE=wordpress
   VITE_WAKILISHA_WP_API_BASE=https://your-wp-site.com/wp-json/wakilisha/v1
   ```

2. Restart the dev server (or rebuild for production)

3. Navigate back to `/admin/settings/charts/public-api-qa`

4. Click **Clear public chart cache** to ensure no mock data is served from cache

5. Click **Run all tests** — all 6 endpoints should show:
   - Status: **PASS**
   - Source: **wordpress**
   - Count > 0

---

## Expected Health Behavior

### Mock Mode (default)
- All 6 tests should PASS
- Source will show `mock` (yellow)
- Instant response times (< 5ms)
- Track history test returns 3 appearances for `midnight-dreams`

### WordPress Mode (live)
- All 6 tests should PASS
- Source will show `wordpress` (green)
- Response times will vary (typically 50–500ms depending on server)
- Track history returns real chart appearance data

### Cache Mode
- After first successful fetch, subsequent runs pull from the in-memory cache
- Source shows `cache` (blue)
- TTL is 5 minutes by default
- Use **Clear public chart cache** button to force a fresh fetch

---

## How Cache Affects Results

The public charts client (`src/services/chartsPublic/client.ts`) uses an in-memory cache keyed by family slug, edition slug, and track slug.

**Cache keys:**
- `chart_families` — all families
- `chart_family_{slug}` — single family
- `chart_family_editions_{slug}` — all editions for a family
- `chart_latest_{slug}` — latest edition per family
- `chart_edition_{family}_{edition}` — specific edition
- `chart_entries_{family}_{edition}` — entries for an edition
- `track_history_{slug}` — track chart history

**TTL:** 5 minutes. After TTL expires, `isStale` is set to `true` and the cache entry is used as a stale fallback if the live fetch fails.

**Clearing the cache:** The QA page **Clear cache** button calls `clearChartCache()` which clears the entire in-memory cache. Individual keys can also be invalidated using `invalidateChartCache(key)`.

---

## What Failures Mean

### FAIL on `getChartFamilies`
- WordPress is unreachable, or the plugin is not installed/activated
- Check `VITE_WAKILISHA_WP_API_BASE` is correct and the WP site is live
- Check CORS headers on the WP API endpoint

### FAIL on `getLatestChartEdition`
- No published editions exist for the default family (`weekly-top-40`)
- Ensure at least one edition has been published via the Ingestion Studio

### FAIL on `getChartEditionEntries`
- The specific edition exists but has no entries, or entries endpoint is not implemented
- Check the WP plugin's entry ingestion pipeline

### FAIL on `getTrackChartHistory`
- Track history endpoint is not implemented on the WP side, or track slug doesn't exist
- This endpoint is the newest — may require a plugin update

### WARN (0 results)
- The endpoint responded with HTTP 200 but returned an empty array
- This could be correct (e.g., a new family with no editions yet), or a data gap

---

## Smoke Report Format

The **Copy Smoke Report** button copies a plain-text compact report suitable for sharing with backend developers or for pasting into Slack/GitHub issues:

```
WAKILISHA Public Charts API Smoke Report
Mode: mock
API Base: /wp-json/wakilisha/v1
Run: 2026-05-31, 10:32:15

getChartFamilies: PASS, 5 items, 12ms
getChartFamily: PASS, 1 item, 8ms
getLatestChartEdition: PASS, 1 item, 10ms
getChartEdition: PASS, 1 item, 9ms
getChartEditionEntries: PASS, 40 items, 14ms
getTrackChartHistory: PASS, 3 items, 6ms

Failures: 0
```

---

## Track Chart History Integration

Track chart history is visible on:
- **Desktop:** `/tracks/{slug}` → Chart stats tab → "Chart history" module (below the sparkline)
- **Mobile:** `/tracks/{slug}` → Chart stats tab → "Chart history" module (compact layout)

Both views use `getTrackChartHistory(trackSlug)` → `toChartTrackHistoryViewModel()`. The trajectory bar visualization shows each week's rank (lower number = higher bar). Peak and current position are labelled.

If the public chart service returns no history (empty appearances), the module shows "No chart history yet" without crashing the page.

---

## Files Reference

| File | Purpose |
|------|---------|
| `src/services/chartsPublic/client.ts` | All 6 API functions, mock/WP routing, cache integration |
| `src/services/chartsPublic/cache.ts` | In-memory cache, TTL logic, invalidation |
| `src/services/chartsPublic/wpAdapter.ts` | Hardened WP HTTP client (timeout, retry, error parsing) |
| `src/services/chartsPublic/mockData.ts` | Rich mock data for all families, editions, track history |
| `src/services/chartsPublic/viewModels.ts` | Adapter functions including `toChartTrackHistoryViewModel` |
| `src/components/charts/ChartTrajectory.tsx` | Rank trajectory bar visualization |
| `src/components/charts/TrackChartHistory.tsx` | Track history section component with all states |
| `src/components/charts/ChartRefreshButton.tsx` | Cache-clearing refresh button for chart pages |
| `src/pages/admin/charts/public-api-qa/page.tsx` | The QA screen itself |