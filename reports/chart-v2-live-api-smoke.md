# Chart V2 Live API Smoke Test

Generated: 2026-06-01T10:44:36.460Z

Mode: **live-api-smoke**

Live base: `http://localhost:4175/wp-json/wakilisha/v2`

Fixture source: `reports/chart-v2-api-fixtures.json`

## Summary

| Status | Count |
| --- | ---: |
| Pass | 11 |
| Warning | 0 |
| Fail | 0 |
| Skipped | 0 |

## Checks

| ID | Status | Check | Endpoint | Detail |
| --- | --- | --- | --- | --- |
| LIVE-001 | PASS | Health endpoint responds | `/charts/health` | HTTP 200 |
| LIVE-002 | PASS | Program list count matches fixture contract | `/charts` | live=4; fixture=4; HTTP 200 |
| LIVE-003 | PASS | Latest edition matches fixture for 2026-releases-kenya | `/charts/2026-releases-kenya/latest` | live=2026-2026-05-18; fixture=2026-2026-05-18; HTTP 200 |
| LIVE-004 | PASS | Edition entry count matches fixture for 2026-releases-kenya/2026-2026-05-18 | `/charts/2026-releases-kenya/2026-2026-05-18/entries` | live=100; fixture=100; HTTP 200 |
| LIVE-005 | PASS | Latest edition matches fixture for gengetone-kenya | `/charts/gengetone-kenya/latest` | live=gengetone-2026-05-18; fixture=gengetone-2026-05-18; HTTP 200 |
| LIVE-006 | PASS | Edition entry count matches fixture for gengetone-kenya/gengetone-2026-05-18 | `/charts/gengetone-kenya/gengetone-2026-05-18/entries` | live=50; fixture=50; HTTP 200 |
| LIVE-007 | PASS | Latest edition matches fixture for top-songs-kenya | `/charts/top-songs-kenya/latest` | live=kenya-2026-05-18; fixture=kenya-2026-05-18; HTTP 200 |
| LIVE-008 | PASS | Edition entry count matches fixture for top-songs-kenya/kenya-2026-05-18 | `/charts/top-songs-kenya/kenya-2026-05-18/entries` | live=100; fixture=100; HTTP 200 |
| LIVE-009 | PASS | Latest edition matches fixture for rnb-kenya | `/charts/rnb-kenya/latest` | live=rnb-2026-05-18; fixture=rnb-2026-05-18; HTTP 200 |
| LIVE-010 | PASS | Edition entry count matches fixture for rnb-kenya/rnb-2026-05-18 | `/charts/rnb-kenya/rnb-2026-05-18/entries` | live=100; fixture=100; HTTP 200 |
| LIVE-011 | PASS | Legacy alias resolves to canonical slug | `/charts/resolve/2026` | legacy=2026; expected=2026-releases-kenya; HTTP 200 |

## How to run live checks

`WAKILISHA_V2_LIVE_API_SMOKE=1 WAKILISHA_V2_LIVE_API_BASE=https://example.com/wp-json/wakilisha/v2 npm run charts:v2-live-smoke`

By default this script does not call the network. It is safe to run in CI before the backend exists.
