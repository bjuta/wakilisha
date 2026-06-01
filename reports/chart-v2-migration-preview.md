# Chart V2 Migration Preview

Generated: 2026-06-01T10:00:00.000Z

Mode: **preview-only-no-db-writes**

---

## Migration Readiness

**Status: ⚠️  READY WITH WARNINGS**

| Metric | Count |
| --- | ---: |
| Blockers | 0 |
| Warnings | 3 |
| Info | 9 |

---

## Source Counts

| Metric | Count |
| --- | ---: |
| Families | 4 |
| Editions | 78 |
| Entries (loaded) | 6332 |
| Entries (manifest) | 6332 |

---

## Target V2 Counts

| Metric | Count |
| --- | ---: |
| Series | 4 |
| Markets | 1 |
| Programs | 4 |
| Editions | 78 |
| Entries | 6332 |
| Aliases | 10 |

---

## Program Mapping

| Source family | Series | Market | Public slug | Public label | Methodology | Eligibility |
| --- | --- | --- | --- | --- | --- | --- |
| 2026 | 2026-releases | kenya | 2026-releases-kenya | 2026 Releases · Kenya | csv-registry-import-v1 | 2026-releases-kenya-v1 |
| gengetone | gengetone | kenya | gengetone-kenya | Gengetone Songs · Kenya | csv-registry-import-v1 | gengetone-kenya-v1 |
| kenya | top-songs | kenya | top-songs-kenya | Top 100 Songs · Kenya | csv-registry-import-v1 | top-songs-kenya-v1 |
| rnb | rnb | kenya | rnb-kenya | R&B Songs · Kenya | csv-registry-import-v1 | rnb-kenya-v1 |

---

## Blockers

No migration blockers found.

---

## Warnings

#### Content QA

- **WARN-001** — Empty editions found *(1 affected)*
  1 edition(s) have zero entries. These will migrate as empty placeholder editions unless excluded.
  → Confirm whether each empty edition is a valid draft/placeholder or should be excluded from public archive display. Known case: `gengetone-2026-03-28`.

#### Editorial Review

- **WARN-005** — Repeated top-10 signatures across editions *(12 affected)*
  Some chart families have editions where the top-10 ordering is identical to another edition. This may indicate duplicate or stale data, or normal consistency in a slow-moving chart.
  → Review repeated top-10 editions to determine if the data reflects genuine chart stability or a data ingestion error.

#### Route Aliases

- **WARN-006** — Legacy aliases pointing to already-canonical slugs *(4 affected)*
  Some aliases use a source family slug that is identical to the legacy alias slug. These are low-risk but redundant.
  → Remove or mark deprecated any alias whose `legacy_slug` matches a canonical `public_slug`.

---

## Latest Edition Top 3 per Program

### 2026-releases-kenya

Edition: `2026-2026-05-18`

- #1 Not Letting Go — Bensoul
- #2 Hallelujah (Washwash) — Khaligraph Jones, Bensoul
- #3 Mafrrrmbanya — Watendawili

### gengetone-kenya

Edition: `gengetone-2026-05-18`

- #1 Songa ka injili — Kushman, Shark Tank
- #2 Wakiuliza — Collo Blue, Fathermoh
- #3 PAPARAZZI — Uncojingjong

### top-songs-kenya

Edition: `kenya-2026-05-18`

- #1 Hallelujah (Washwash) — Khaligraph Jones, Bensoul
- #2 Chai ya saa kumi — Ywaya Tajiri
- #3 We Don't Need Money to Be Rich — Mutoriah

### rnb-kenya

Edition: `rnb-2026-05-18`

- #1 NERVOUS — Bee Thee Artiste, Ywaya Tajiri, AUGUST IV
- #2 Wi Muthaka — Tuku Kantu, Muthaka
- #3 Njia — Billy Black

---

## Recommended Next Actions

1. Review the empty gengetone edition (`gengetone-2026-03-28`) — confirm whether it is a valid draft/placeholder or should be excluded from public archive display.
2. Decide whether repeated top-10 signatures across editions represent acceptable chart stability or a data ingestion error worth correcting.
3. Decide whether entries without artwork need enrichment before API cutover, or whether a graceful UI fallback is sufficient.
4. Proceed to dry-run V2 SQL insert planner only after blocker count remains zero.

---

*This report is preview-only. No database writes. No public chart JSON was modified. No routes were changed.*