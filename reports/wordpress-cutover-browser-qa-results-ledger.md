# WordPress Cutover Browser QA Results Ledger

This ledger records human browser QA results for the WordPress to React cutover.

It does not approve DNS, Cloudflare, Supabase, frontend deploy, or production redirect changes.

## Summary

- Using filled results CSV: no
- Total rows: 56
- Passed rows: 0
- Failed rows: 0
- Blocked rows: 17
- Pending rows: 39
- Critical rows not passed: 18
- Issues: 0
- QA complete: no

## Status counts

- blocked_or_hold: 17
- pending: 31
- pending_product_approval: 8

## Priority counts

- critical: 18
- high: 29
- medium: 9

## Category counts

- approval_gated_redirect: 8
- chart_runtime_route: 3
- core_route: 7
- do_not_redirect_without_decision: 17
- ready_extra_redirect_target: 1
- sample_safe_redirect_target: 10
- sample_tag_search_target: 10

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
| CHART-001 | chart_runtime_route | `/charts/top-100/ke/2026-01-26` | pending |  |
| CHART-002 | chart_runtime_route | `/charts/top-gengetone/ke/2026-01-26` | pending |  |
| CHART-003 | chart_runtime_route | `/charts/top-rnb/ke/2026-01-26` | pending |  |
| HOLD-008 | do_not_redirect_without_decision | `/account/` | blocked_or_hold |  |
| HOLD-009 | do_not_redirect_without_decision | `/my-account/` | blocked_or_hold |  |
| HOLD-010 | do_not_redirect_without_decision | `/my-library/` | blocked_or_hold |  |
| HOLD-011 | do_not_redirect_without_decision | `/my-top-10/` | blocked_or_hold |  |
| HOLD-012 | do_not_redirect_without_decision | `/order-tracking/` | blocked_or_hold |  |
| HOLD-013 | do_not_redirect_without_decision | `/settings/` | blocked_or_hold |  |
| HOLD-016 | do_not_redirect_without_decision | `/cart/` | blocked_or_hold |  |
| HOLD-017 | do_not_redirect_without_decision | `/checkout/` | blocked_or_hold |  |

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
