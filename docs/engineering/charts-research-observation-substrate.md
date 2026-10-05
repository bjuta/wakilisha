# WAKILISHA 100 research observation substrate

Issue: #1153

Status: implementation branch, not production authority.

## Purpose

The WAKILISHA 100 research programme requires a prospective shadow dataset that preserves the meaning of each source observation before model selection.

The existing production chart ingest pipeline remains authoritative for current production behavior, but it does not yet preserve all research semantics required by D05/D06/D08/D09/D11:

- provider rank;
- validated cardinal metric where available;
- chart depth and censoring;
- source-health state;
- provider market;
- territorial confidence;
- behavior class;
- adapter version;
- provider methodology version;
- immutable input/output hashes;
- confirmatory versus exploratory analysis authority.

The research substrate is deliberately non-publishing.

## Non-publication boundary

The substrate does not create or update:

- `wk_chart_editions_v2`;
- `wk_chart_entries_v2`;
- `wk_chart_programs_v2`;
- current `top100` configuration;
- current `toprnb` configuration;
- v1.0.1 production scoring.

It has no foreign-key dependency on public edition/entry tables.

The first flagship edition remains blocked by the D11 launch gates.

## Tables

### `chart_research_windows`

One prospective weekly window.

Stores:

- exact tracking start/end;
- study phase;
- protocol version;
- source-constitution version;
- Registry snapshot reference;
- expected source keys;
- collection lifecycle;
- optional freeze hash.

### `chart_research_source_runs`

One collection receipt per source per research window.

Distinguishes:

- expected source;
- fetch success/failure;
- parse success/failure;
- row count;
- chart depth;
- censoring type;
- source health;
- adapter version;
- source methodology version;
- provider-defined territorial confidence.

### `chart_research_observations`

Immutable provider observations.

Preserves:

- provider/source identity;
- provider row identity;
- provider track/release/artist IDs;
- ISRC where supplied;
- Registry canonical Track only after safe resolution;
- identity state/confidence;
- rank;
- chart depth;
- censoring type;
- metric name/value/unit where exposed;
- exact period;
- capture time;
- behavior class;
- officiality class;
- territorial confidence;
- missingness state;
- raw payload hash/reference;
- adapter version;
- source methodology version.

An observation must carry a rank or a cardinal metric.

A track absent below a public Top-N is not inserted as a zero-valued observation.

### `chart_research_model_runs`

Versioned model execution receipts.

Every run binds:

- weekly window;
- model ID/specification;
- analysis commit;
- config hash;
- input snapshot hash;
- status/convergence;
- diagnostics;
- output hash.

### `chart_research_rank_outputs`

Immutable per-model Track ranking outputs.

Stores:

- Registry Track;
- point rank;
- model-native score;
- optional rank interval;
- optional Top 10/Top 40 probabilities;
- uncertainty payload.

### `chart_research_stress_runs`

Receipts for:

- source deletion;
- depth/censoring masks;
- integrity attacks;
- identity perturbations.

### `chart_research_validation_results`

Immutable validation metrics.

Every row declares whether it is confirmatory or exploratory and carries the preregistration/analysis authority used to produce it.

### `chart_research_audit_events`

Hashed, append-only mutation receipts.

Application/service code receives SELECT only on the audit stream. Audit inserts are performed by a trigger function so the service path cannot forge receipts directly.

## Access model

All research tables:

- have RLS enabled;
- revoke privileges from `PUBLIC`, `anon`, and `authenticated`;
- do not grant DELETE to `service_role`.

Mutable lifecycle tables grant `service_role`:

- SELECT;
- INSERT;
- UPDATE.

Immutable evidence/output tables grant `service_role`:

- SELECT;
- INSERT.

The audit table grants `service_role` SELECT only.

No browser role receives direct research-table authority.

## Immutability

The following are append-only after insertion:

- `chart_research_observations`;
- `chart_research_rank_outputs`;
- `chart_research_validation_results`;
- `chart_research_audit_events`.

Corrections occur through new observations/runs/results, not silent mutation of historical research evidence.

## Auditability

Insert/update/delete activity on mutable research tables and inserts into immutable evidence tables produce hashed audit receipts containing:

- table;
- row ID;
- operation;
- old/new row hashes;
- authenticated user ID when present;
- database role;
- request subject when present;
- timestamp.

The audit stream intentionally does not duplicate full raw payloads.

## Missingness and censoring

Source-level failures belong in `chart_research_source_runs`.

Examples:

- source down;
- parse failure;
- degraded source;
- partial window.

Track-level semantics belong in observations/model construction.

A missing track below Top-N must remain censored/unobserved. The research layer must not manufacture:

- rank N+1;
- zero consumption;
- silent source-weight redistribution.

## Replay contract

A research model run is replay-identifiable through:

- source observation snapshots;
- Registry resolution state/reference;
- adapter version;
- source methodology version;
- model specification version;
- analysis commit;
- config hash;
- input snapshot hash;
- random seed where applicable.

The same frozen inputs should reproduce the same deterministic result or statistically equivalent result under the model's declared randomness contract.

## Phase 0 acceptance

Before Phase 0 weekly collection counts toward the engineering pilot:

1. migration applies cleanly to a replay/preview database;
2. verifier passes;
3. anonymous and ordinary authenticated roles cannot read/write research tables;
4. service authority can create research windows/source receipts/observations;
5. immutable observations reject updates;
6. audit receipts are created by triggers;
7. no research table can publish or couple to public edition/entry tables;
8. one fixture replay produces stable hashes.

## CI consolidation

This slice extends the existing RLS security contract instead of creating a new permanent security test suite.

The SQL verifier is preview/runtime acceptance, not an additional always-on CI test family.

## Next slice

After this substrate is proven in a clean preview:

1. create research adapter interface;
2. add YouTube Charts Kenya adapter;
3. add Mdundo Kenya adapter;
4. add Audiomack Kenya adapter;
5. add Shazam Kenya adapter;
6. add Boomplay adapter;
7. add Apple public most-played adapter;
8. add weekly Phase 0 scheduler and immutable export/replay.

No provider becomes publication authority merely because its research adapter exists.
