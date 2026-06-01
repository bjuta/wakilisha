# Chart V2 API Fixture Contract Check

Generated: 2026-06-01T09:56:12.384Z

Mode: **fixture-contract-check-no-network**

Source fixtures: `reports/chart-v2-api-fixtures.json`

## Summary

| Status | Count |
| --- | ---: |
| Pass | 11 |
| Warning | 0 |
| Fail | 0 |

## Checks

| ID | Status | Check | Detail |
| --- | --- | --- | --- |
| API-001 | PASS | Endpoint fixture exists: listPrograms | /wp-json/wakilisha/v2/charts |
| API-002 | PASS | Endpoint fixture exists: getProgram | /wp-json/wakilisha/v2/charts/{programSlug} |
| API-003 | PASS | Endpoint fixture exists: getLatestEdition | /wp-json/wakilisha/v2/charts/{programSlug}/latest |
| API-004 | PASS | Endpoint fixture exists: getEdition | /wp-json/wakilisha/v2/charts/{programSlug}/{editionSlug} |
| API-005 | PASS | Endpoint fixture exists: getEditionEntries | /wp-json/wakilisha/v2/charts/{programSlug}/{editionSlug}/entries |
| API-006 | PASS | Endpoint fixture exists: resolveAlias | /wp-json/wakilisha/v2/charts/resolve/{slug} |
| API-010 | PASS | Program list count matches fixture count | listPrograms=4; expected=4 |
| API-011 | PASS | Latest examples exist for every program | latestExamples=4; programs=4 |
| API-012 | PASS | Latest examples include sample entries | All latest examples include sample entries. |
| API-013 | PASS | Latest examples do not select empty editions | No latest example selected an empty edition. |
| API-014 | PASS | Alias examples are present | aliasExamples=10 |

## Notes

This script validates the generated fixture contract only. It does not call a live API and does not write to a database. Once the V2 REST API exists, this can be extended into a live smoke test that compares backend responses against these fixtures.
