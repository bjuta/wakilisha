# WordPress Cutover Browser QA Results Ledger

This ledger records human browser QA results for the WordPress to React cutover.

It does not approve DNS, Cloudflare, Supabase, frontend deploy, or production redirect changes.

## Summary

- Using filled results CSV: yes
- Total rows: 18
- Passed rows: 7
- Failed rows: 0
- Blocked rows: 0
- Pending rows: 11
- Critical rows not passed: 0
- Issues: 0
- QA complete: no

## Status counts

- passed: 7
- pending: 11

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
