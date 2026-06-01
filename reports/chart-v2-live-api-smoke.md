# Chart V2 Live API Smoke Test

Generated: 2026-06-01T10:33:46.258Z

Mode: **no-network-skipped**

Live base: Not configured

Fixture source: `reports/chart-v2-api-fixtures.json`

## Summary

| Status | Count |
| --- | ---: |
| Pass | 0 |
| Warning | 0 |
| Fail | 0 |
| Skipped | 1 |

## Checks

| ID | Status | Check | Endpoint | Detail |
| --- | --- | --- | --- | --- |
| LIVE-000 | SKIPPED | Live V2 API smoke test skipped | — | Set WAKILISHA_V2_LIVE_API_SMOKE=1 and WAKILISHA_V2_LIVE_API_BASE=https://example.com/wp-json/wakilisha/v2 to run live checks. |

## How to run live checks

`WAKILISHA_V2_LIVE_API_SMOKE=1 WAKILISHA_V2_LIVE_API_BASE=https://example.com/wp-json/wakilisha/v2 npm run charts:v2-live-smoke`

By default this script does not call the network. It is safe to run in CI before the backend exists.
