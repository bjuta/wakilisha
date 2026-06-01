# WAKILISHA Chart Infrastructure V2 Plan

This document defines the backend-safe chart ontology for WAKILISHA's next chart infrastructure layer. It is intentionally additive: the current public chart pages, JSON chart assets, legacy slugs, and existing content must continue working while V2 is introduced beside the current system.

## Current verified public chart state

The React public chart layer currently works from JSON-backed chart data:

- 4 source chart families
- 78 editions
- 6,332 chart entries
- Lazy per-edition JSON entry files
- Partition verification passing
- Taxonomy-aware public slugs and legacy route support

This V2 plan does not replace that layer. It prepares the backend structure needed to eventually move from static JSON fallback to a global, API-backed chart system.

## Core principle

Content is the asset. WAKILISHA has spent years building its catalogue, chart history, artist references, track data, editorial context, and registry. V2 must preserve source content exactly first, then layer improvements through provenance, corrections, canonical identity, and methodology versioning.

Do not destructively migrate. Do not rename source content in place. Do not silently edit historical rankings. Build V2 as a shadow ontology, verify counts and routes, then cut over only when safe.

## Target ontology

### ChartSeries

A ChartSeries defines what is being ranked.

Examples:

- `top-songs`
- `rnb`
- `gengetone`
- `2026-releases`
- future: `hiphop`, `afrobeats`, `gospel`, `breakout`, `airplay`

A series should not imply a country unless the chart concept itself is country-specific. This allows the same series to expand across markets.

### ChartMarket

A ChartMarket defines where the chart is scoped.

Examples:

- `kenya`
- `uganda`
- `nigeria`
- `tanzania`
- `east-africa`
- `africa`
- `global`

Markets can be countries, regions, continents, global scopes, or diaspora scopes. A market can later support a parent/child hierarchy such as Kenya inside East Africa inside Africa.

### ChartProgram

A ChartProgram is a concrete chart product: `series + market`.

Examples:

- `top-songs + kenya` = `Top 100 Songs · Kenya`
- `rnb + kenya` = `R&B Songs · Kenya`
- `gengetone + kenya` = `Gengetone Songs · Kenya`
- `2026-releases + kenya` = `2026 Releases · Kenya`

In the future this becomes:

- `rnb + uganda` = `R&B Songs · Uganda`
- `rnb + nigeria` = `R&B Songs · Nigeria`
- `2026-releases + africa` = `2026 Releases · Africa`

### ChartEdition

A ChartEdition is a dated issue of a ChartProgram.

It carries:

- edition slug
- edition label
- edition date
- period start/end
- status
- entry count
- snapshot reference when published

### ChartEntry

A ChartEntry is one ranked song inside one edition.

It carries:

- rank
- previous rank
- movement
- track slug/title
- artist slug/name
- artwork
- source entry id
- raw payload/provenance

The original imported text must be preserved even when a better canonical track or artist identity is later attached.

### ChartMethodology

A ChartMethodology is a versioned formula and source policy.

Examples:

- `csv-registry-import-v1`
- future: `streaming-airplay-v1`
- future: `blended-market-v2`

Historical editions must keep the exact methodology version used at publication time.

### ChartEligibilityRules

Eligibility rules define what qualifies for a chart.

Examples:

- `top-songs-kenya-v1`
- `rnb-kenya-v1`
- `2026-releases-kenya-v1`

Eligibility rules answer questions such as:

- Does release date matter?
- Does market performance matter?
- Are diaspora artists eligible?
- Are remixes eligible?
- Are collaborations eligible?
- Can old songs re-enter?

### ChartSourceCoverage

Source coverage records which inputs contributed to an edition.

Examples:

- Spotify: available
- Apple Music: partial
- YouTube: available
- Airplay: unavailable
- Manual/editorial: available

This prevents false precision when coverage differs by country, genre, or source type.

### ChartSnapshot

A ChartSnapshot is the immutable published record of an edition.

It should include:

- edition metadata
- ranked entries
- methodology version
- eligibility rules version
- source coverage
- snapshot hash
- provenance payload

Published history should not be silently edited. Corrections create correction records and, when necessary, superseding snapshots.

### ChartCorrection

Corrections track disputes, fixes, and public/internal notes.

Correction types may include:

- wrong rank
- wrong artist
- wrong title
- wrong artwork
- wrong market
- wrong eligibility
- duplicate track
- missing track
- methodology dispute

### ChartSlugAlias

Slug aliases preserve old URLs and source slugs while public routes evolve.

Examples:

- `/charts/rnb` -> `/charts/rnb-kenya`
- `/charts/kenya` -> `/charts/top-songs-kenya`
- `/charts/2026` -> `/charts/2026-releases-kenya`

Aliases protect SEO, old shares, and internal references.

## Current source family mappings

Current imported source families must be preserved for provenance, but presented through public taxonomy.

| Source family slug | Series slug | Market slug | Public slug | Public label |
| --- | --- | --- | --- | --- |
| `kenya` | `top-songs` | `kenya` | `top-songs-kenya` | `Top 100 Songs · Kenya` |
| `rnb` | `rnb` | `kenya` | `rnb-kenya` | `R&B Songs · Kenya` |
| `gengetone` | `gengetone` | `kenya` | `gengetone-kenya` | `Gengetone Songs · Kenya` |
| `2026` | `2026-releases` | `kenya` | `2026-releases-kenya` | `2026 Releases · Kenya` |

The source slug remains the raw import identity. The public slug is the canonical product route.

## Migration approach

1. Keep public JSON charts live.
2. Add V2 tables additively.
3. Generate migration previews from current JSON.
4. Verify counts and top entries.
5. Insert into V2 only after preview validation.
6. Serve API from V2 while keeping JSON as fallback.
7. Add correction and methodology workflows.
8. Expand to new markets and chart series.

## Non-goals for the first scaffold

The first V2 scaffold must not:

- mutate `public/charts-data`
- write to a database
- alter live routes
- drop old tables
- rename old content
- remove legacy slugs
- re-rank historical charts

The first scaffold is documentation, SQL structure, and preview-only reporting.
