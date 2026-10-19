# WAKILISHA 100 — Weekly evidence kernel, v1

**Status:** nonpublishing implementation slice for [issue #1260](https://github.com/bjuta/wakilisha/issues/1260). Not deployed, not the source collector, not permission to issue Edition 1.

## Sources of truth

- Production audit and browser evidence: [19 October 2026](https://docs.google.com/document/d/1wqyd0HBDB6-9LpWm6LNOXbGDhLcVATKX7oduARdOios/edit).
- Historical September seven-day [source durability closure](charts-public-source-accessibility-soak-final.md). It is an accessibility result, **not** a live scoring source grant.
- [Research-programme retirement](archive/chart-research-retirement-20261007/README.md): D11/D11B is no longer product authority; do not recreate its scheduler or tables.
- [Google Drive source observation contract ledger](https://docs.google.com/spreadsheets/d/1fcPlSrOA-OCGfYoY2TQWLNlCyMOiA0orZX3zV7zcyh0/edit) preserves behavioral and update-time uncertainties.

## What this code does

`supabase/functions/_shared/chart-weekly-evidence.mjs` is a portable, deterministic, read-only kernel intended for reuse by a later authenticated production collector and freeze worker. It:

- Defines a half-open Monday-to-Monday tracking week in East Africa Time (UTC+03:00), independent of server timezone.
- Derives expected *source-specific* daily, weekly or 3/4/6/8/12/24-hour observation checkpoints from an explicit versioned contract.
- Validates identity, territory, version, source-native period, timing, status, source-native rank/metric type, observed top-N depth, and content-hash receipts.
- Counts fetched snapshots separately from observed changes. Re-reading unchanged source content does **not** generate listening events.
- Rejects duplicate, unplanned and mismatched checkpoints. Required sources missing an authorized minimum fail closed.
- Preserves failures and optional-source degradation without redistributing weights. Unknown provider-native periods block evidence readiness for required sources.
- Produces deterministically canonicalized, SHA-256-fingerprinted, deeply immutable, nonpublishing evidence manifests. A fingerprint does **not** authenticate a provider or verify that raw bytes were retained.

The output explicitly sets `can_publish: false` in every case. Independent provider-adapter, Registry identity, source admission, scoring policy, review and publication gates remain mandatory.

## Test

Run from repository root:

```bash
node --test test/charts/chart-weekly-evidence.test.mjs
```

The test suite covers EAT/UTC boundaries, daily and six-hour cadence, weekly updates, immutable deterministic manifests, missing/degraded observations, unknown source periods, forged source/metric/territory, duplicate checkpoints, and source-native ranks.

## Required integration before closure of #1260

1. Decide and publish the *product* source constitution. The source ledger is research evidence, not a switch that turns all seven sources on. Confirm each native publication period, observed update time, geographic scope, lawful access path, adapter parser behavior and retry budget.
2. Mint minimal product observation/receipt and freeze state through the **existing accepted Supabase CLI migration process**. Do not add retired `chart_research_*` tables. Enforce append-only raw observations, RLS/service-only access and durable blobs/receipts.
3. Build bounded provider adapters and use the existing Supabase `pg_cron` / Edge infrastructure. Do not use a Mac-based scheduler. Scheduled job time should follow each provider's admitted contract, never the mere success frequency of the old soak.
4. Record actual provider response-body hashes, native chart periods, territory, depth and schema version; verify adapter-to-receipt matching before treating a checkpoint as successful. Ensure repeat polls are idempotent and document source health and failed responses.
5. Integrate accepted MIZIZI recording identity and a read-only weekly evidence freeze into the existing Admin Charts intake workbench.
6. Demonstrate a complete prospective collection week and deterministic independent replay. Then resolve the v1.0.1 library/Edge disagreement under a separately versioned methodology decision. Require editor approval before edition publication.
7. Independently archive/checksum the historical 18 editions and demonstrate restoration before proposing the separate irreversible deletion operation to the owner.

No scheduled jobs, migrations, database writes, chart-scoring changes, publication, or deletion are included in this source-only slice.

## Native public-source parser boundary (follow-on source work)

`supabase/functions/_shared/chart-public-source-observations.mjs` contains conservative, pure parsers for the already investigated Kenya chart surfaces: Mdundo Top Charts, Audiomack Geo Chart, Boomplay chart-list links, Shazam CSV, Apple public Top 100 RSS and YouTube Charts weekly tracks. It reuses the *technical observations* from the archived September soak and D11B Preview without resurrecting research routes, tables, methodology or scheduling authority.

The parsers produce distinct source-native observations:

- Mdundo, Audiomack, Boomplay and Apple: observed ordinal ranks only, not counts of plays or national audience.
- Shazam: discovery/identification ranks, not streaming.
- YouTube: ordered weekly video observations with source-native view counts; these are not audio streams.

Each output explicitly includes `candidate_only: true`, `eligible_for_scoring: false`, and `native_period: 'unknown'` unless a separate source-specific field reports an unverified period label/key. Provider scope, territorial basis, update timing, native period, officiality, access authorization, and live HTML/JSON schema must be proven separately before receipts may be marked successfully collected or any source admitted to production scoring. In particular, HTML song anchors may include unrelated presentation links; these parsers alone cannot prove chart officiality or row coverage. No provider fetch or persistent database write is included.

The same existing weekly kernel test file now guards the distinct source measurement contracts using bounded synthetic fixtures. It does **not** claim current provider protocol acceptance. Before wiring a scheduler or publishing an edition, verify live response semantics and acceptance under real provider access rules, obtain a current source-set decision, and use the canonical Supabase CLI migration + runtime pathway.
