# WordPress Cutover Browser QA Results Ledger

This ledger records human browser QA results for the WordPress to React cutover.

It does not approve DNS, Cloudflare, Supabase, frontend deploy, or production redirect changes.

## Summary

- Using filled results CSV: no
- Total rows: 18
- Passed rows: 0
- Failed rows: 0
- Blocked rows: 0
- Pending rows: 18
- Critical rows not passed: 7
- Issues: 0
- QA complete: no

## Status counts

- pending: 18

## Priority counts

- critical: 7
- high: 10
- medium: 1

## Category counts

- core_route: 7
- ready_extra_redirect_target: 1
- sample_safe_redirect_target: 5
- sample_tag_search_target: 5

## Issues

No validation issues.

## Critical rows not passed

| ID | Category | Route | Status | Notes |
|---|---|---|---|---|
| CORE-001 | core_route | `/` | pending |  |
| CORE-002 | core_route | `/magazine` | pending |  |
| CORE-003 | core_route | `/charts` | pending |  |
| CORE-004 | core_route | `/artists` | pending |  |
| CORE-005 | core_route | `/releases` | pending |  |
| CORE-006 | core_route | `/tracks` | pending |  |
| CORE-007 | core_route | `/search` | pending |  |

## How to fill

Copy `reports/wordpress-cutover-browser-qa-results.template.csv` to `reports/wordpress-cutover-browser-qa-results.csv`, then fill `qaStatus`, `testedBy`, `testedAt`, `device`, `browser`, and `notes`.

Allowed `qaStatus` values:

- blocked
- blocked_or_hold
- failed
- not_applicable
- passed
- pending
- pending_product_approval

## Deployment checklist

```text
SQL migration needed: No
Supabase Edge Function deploy needed: No
Readdy Finish update needed: No
Frontend deploy needed: No
Cloudflare/DNS change needed: No
This is a QA-results artifact only.
```
