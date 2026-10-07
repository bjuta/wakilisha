# WAKILISHA chart research programme retirement archive

Issue: #1174  
Retirement date: 2026-10-07  
Status: archived historical research, not current product authority.

## Decision

The active D11 / D11B WAKILISHA 100 research programme was discontinued before prospective D11B qualification began.

The programme is preserved as historical research and engineering provenance. It is not current product methodology, launch authority, or chart-scoring authority.

Current product direction is:

- resume product-first chart development;
- publish a transparent, versioned public methodology;
- bind every public chart edition to the methodology version that produced it;
- preserve historical methodology versions;
- keep edition-level source/evidence receipts;
- iterate methodology prospectively as source coverage and product evidence improve.

## Product infrastructure explicitly retained

The retirement does **not** roll back:

- Registry or MIZIZI authority;
- chart evidence provenance / identity convergence;
- Provider Identity Control Plane;
- strong-evidence provider / ISRC / UPC identity resolution;
- lineage-aware canonical identity;
- ambiguity fail-closed behavior;
- production chart runtime;
- shared pg_cron, pg_net, or Supabase Vault platform capability.

D11B was an early consumer of Provider Identity work, not its architectural owner.

## Production research substrate state at retirement

The Production `chart_research_*` substrate contained no research rows:

- chart_research_windows: 0
- chart_research_source_runs: 0
- chart_research_observations: 0
- chart_research_model_runs: 0
- chart_research_rank_outputs: 0
- chart_research_stress_runs: 0
- chart_research_validation_results: 0
- chart_research_audit_events: 0

The runtime objects remain pending one canonical forward retirement migration.

## Production Chart Source Soak V3 evidence

The earlier Chart Source Soak V3 contained real historical evidence and was archived before retirement:

- runs: 29
- requests: 174
- observations: 174
- Spotify UGC panel rows: 20
- Spotify UGC requests: 580
- Spotify UGC observations: 580
- scheduler-control rows: 1

Raw provider response bodies and request/response headers were intentionally **not copied** into this archive. The archive preserves run state, request metadata, response status, body hashes, parse results, observed track identifiers, source URLs, timestamps, and scheduler receipts sufficient to preserve the engineering evidence trail without unnecessarily retaining full provider payload bodies.

Canonical database JSON SHA-256 receipts:

- production-soak-v3-runs: `50c9b412a3ff382bb4f94765ca1ce26695b130ad3b8fdf72aa32e88c2ce8e604`
- production-soak-v3-scheduler-control: `1e9200e16c2945320933ad972f0f2ba256c0717c51611f18b74d216f7e89dbc0`
- production-soak-v3-requests: `18e1ef2409e3df32f96b33bdd4156991ca0f4443d617b3cf1fa4578af3236e67`
- production-soak-v3-observation-receipts: `d1e41ee10e2d4229f5e3adad558c784aca15593dfa68c8520687e889d47a6aa7`
- production-soak-v3-spotify-panel: `c5b152064c2860ba2e0a98e24cd9d43e05d992452c1690db652aa987d8ef97f6`
- production-soak-v3-spotify-requests-part1: `b75e624932de3a8706eca861dc5486d8bdeb998be75b004b0aeb77cdfe0aab5e`
- production-soak-v3-spotify-requests-part2: `45f7b7220980d0b8fa33e97a0ea30b6cd32b46b38db21e8c843ed71aebe7c78d`
- production-soak-v3-spotify-observation-receipts-part1: `ee39220593caa148f4e9c96f1afcb5eeb3ec89b478a4d83542220a40adf5bb51`
- production-soak-v3-spotify-observation-receipts-part2: `ce41058c105a4ff7cdaf0dce796d667880e985cedf74179a37561288ed57fa19`

## D11B Preview evidence at retirement

Deleted Supabase Preview:

- project ref: `irgtqkcrufvldrznqcuv`
- branch id: `d82c2814-c609-45fe-9be3-2511fb632bec`
- name: `d11b-qualified-source-observation-capture`

Evidence archived before deletion:

- research windows: 2
- source runs: 14
- observations: 897
  - Apple Music: 700
  - Audiomack: 97
  - YouTube: 100
- audit events: 915
- model runs: 0
- rank outputs: 0
- stress runs: 0
- validation results: 0

Canonical database JSON SHA-256 receipts:

- d11b-preview-windows: `d707de577c43f49c7f3c4b72920981194975d3af1658678a606c31d481cb03ac`
- d11b-preview-source-runs: `c663b7e629c81904c833b4462c9268cc85b7d70c5b9904b46a00844ba077050d`
- d11b-preview-observations-apple-part1: `27f610550a684677e2928a67197d368f6b466da783b2f0f38cff05355c6ee672`
- d11b-preview-observations-apple-part2: `977f0cbcdde697453827eb14d4e2ddf73e72f90649707cd31129cc6a708dbdbd`
- d11b-preview-observations-audiomack: `28ea20e0b1ef27033f6114c0cc078940c7f751f3979532583a186ae86bda5956`
- d11b-preview-observations-youtube: `2911c0e974af11e407604f15dcf698bfb4083b16a30d53e87855c98773512e7a`
- d11b-preview-audit-events: `31354b5323524914add01fa9a86bd741ba39db1cbea3399a7e9843d02dff97d7`
- d11b-preview-scheduler-control: `67699b3d528c1522c6f78b96ecc3a20629c0fba14c74c482293cc3e971e48c38`

The exact deployed Preview-only Edge Function sources were also archived:

- `chart-research-collect` v5, bundle SHA-256 `03a659824fe5d357048f6ed1eb12d2bbc09e74748ec1dbdd81ea6e2df8cb2bc9`
- `d11b-preview-soak-tick` v2, bundle SHA-256 `acd7004fe2864e2c47fdab876f338fb51708d28bf0e1db137574dba5633f6c7c`

The scheduler Vault secret **value was not archived**. Only its name and creation metadata were preserved.

## Other disposable Preview retired

Deleted Supabase Preview:

- project ref: `ldfcfcoxziftoerbqajh`
- branch id: `fb15ceb0-951e-49f8-a27e-24d843dbe0d6`
- name: `provider-identity-slice3-strong-evidence`

The Preview was disposable acceptance infrastructure. Provider Identity code and Production authority remain intact.

## GitHub programme retirement

Closed as discontinued research work:

- #1155 WAKILISHA 100 flagship launch methodology convergence
- #1157 D11B qualified source adapters and immutable observation capture
- #1160 D11B model-selection hierarchy and qualification thresholds
- #1161 D11B threshold calibration harness
- PR #1158 research source collector
- PR #1162 threshold calibration kernels

No D11B prospective qualification window began.

Temporary workflow retired from the cleanup branch:

- `.github/workflows/d11b-preview-soak-scheduler.yml`

## Google Drive research corpus

D04 through D11F were marked:

> ARCHIVED PRE-LAUNCH RESEARCH PROGRAMME - NOT CURRENT PRODUCT AUTHORITY

The Preregistration Lock Matrix, Methodology Decision Log, and Launch Readiness Gates were renamed with an `ARCHIVED -` prefix.

These artifacts remain available as intellectual history and possible future research material, but they no longer govern the product roadmap.

## Remaining retirement work

One canonical forward Production migration must retire:

- `public.chart_research_*`
- `private.chart_source_soak_v3_*`
- their research-only helper functions / triggers / inactive scheduler authority.

The migration must be minted through the accepted Supabase CLI workflow. Historical migration files are not deleted or rewritten.

After that migration:

- regenerate Production database types;
- remove research-only verifier/test hooks that no longer describe live schema;
- prove production chart runtime, Registry, Provider Identity, shared extensions, and unrelated cron jobs remain intact;
- merge #1174 cleanup and close the retirement slice.
