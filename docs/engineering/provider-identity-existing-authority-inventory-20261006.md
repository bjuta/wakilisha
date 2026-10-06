# Provider Identity Existing Authority Inventory

**Status:** Working inventory for #1163  
**Date:** 6 October 2026  
**Repository base:** `e8857c0da3368ee55bbee5c71c6bd6321612a964`  
**Purpose:** Identify existing provider/identity surfaces before any new schema is proposed.

## 1. Classification

Each surface is classified as one of:

- **Observation**: source/provider facts retained as evidence.
- **Evidence**: durable evidence/review bookkeeping.
- **Assertion**: a typed claim that may conflict and is not automatically canonical truth.
- **Canonical binding**: accepted provider-to-Registry operational identity.
- **Canonical entity mutation**: create/change/merge/split canonical Registry state.
- **Review**: human-governed ambiguity resolution.
- **Stewardship**: MIZIZI invariant detection/repair.
- **Projection/consumer**: downstream read/use of canonical identity.

## 2. Current Data Surfaces

| Surface | Current role | Classification | Durable owner | #1163 disposition |
| --- | --- | --- | --- | --- |
| `provider_field_observations` | Provider field observations with source path/raw payload | Observation | Provider evidence layer | Reuse |
| `registry_provider_sources` | Retained provider source/raw payload records | Observation/evidence | Provider evidence layer | Reuse; audit current writers |
| `provider_entity_links` | Registry entity ↔ provider object evidence/review bookkeeping; candidate/match state | Evidence | Provider/review evidence layer | Reuse for now; never promote to canonical truth implicitly |
| `registry_external_identifier_assertions` | Typed external identifier assertions across Registry subjects | Assertion | Registry external-identifier authority | Core reuse; do not duplicate |
| `registry_track_provider_links` | Canonical Track-provider operational identity | Canonical binding | Registry provider-link authority | Core reuse |
| `platform_private.registry_evidence_assertions` | Immutable evidence bound to governed operations | Evidence | Registry governance kernel | Core reuse |
| `platform_private.registry_review_cases` / existing review machinery | Ambiguity/human review | Review | Registry review | Core reuse |
| `registry_identity_lineage` | Append-only merge/split/supersede/retire history | Canonical identity lineage | Registry | Core reuse |
| `registry_identity_projection_lineage` | Rebuildable projection history tied to historical observation | Projection lineage | Registry/projection authority | Reuse |
| `registry_canonical_write_events` | Canonical mutation provenance | Canonical audit | Registry governance kernel | Core reuse |
| `platform_private.registry_operation_write_events` | Operation ↔ canonical write causality | Canonical audit | Registry governance kernel | Core reuse |

## 3. Current Mutation / Operation Surfaces

| Surface | Current semantics | Classification | Owner | Convergence decision |
| --- | --- | --- | --- | --- |
| `registry.track.provider_link.admit/v1` | One governed Track-provider canonical binding | Canonical binding | Registry | Preserve |
| `admin_admit_registry_track_provider_link_v1(...)` | Human reviewed broker for Track provider link admission | Canonical binding | Registry | Preserve |
| `registry.external_identifier_assertion.admit/v1` | Admit one exact retained-evidence identifier candidate | Assertion | Registry external identifier authority | Preserve |
| `admin_admit_registry_external_identifier_candidate_v1(...)` | Human reviewed broker for identifier candidate admission | Assertion | Registry | Preserve |
| Track Create / reviewed profile / activation operation families | Canonical Track lifecycle and reviewed profile mutation | Canonical entity mutation | Registry | Provider identity must call/consume, never duplicate |
| Release reviewed profile / lifecycle operation families | Canonical Release mutation | Canonical entity mutation | Registry | Provider identity must call/consume, never duplicate |
| Artist merge / decouple / reviewed identity operations | Canonical Artist identity transitions | Canonical entity mutation | Registry | Remain outside provider reconciliation mutation scope |
| MIZIZI governed repair operations | Deterministic repair of accepted canonical/projection invariants | Stewardship | MIZIZI | Preserve downstream role |

## 4. Runtime / Workflow Surfaces

| Surface | Current role | Classification | #1163 treatment |
| --- | --- | --- | --- |
| `provider-intake-api` | Provider inspection/intake; current Apple exact track inspection returns provider IDs/ISRC metadata | Observation / candidate discovery | Reuse provider client capability; keep canonical mutation outside |
| `run-chart-playback-enrichment` | Chart-driven provider enrichment feeding governed provider-link authority | Observation + reviewed canonical admission | Audit local matching policy; keep typed Registry write boundary |
| Track Intake provider selection/finalization | Human-reviewed provider evidence; finalization requires canonical provider links | Review/workflow consumer | Preserve; converge reads onto shared identity snapshot where useful |
| Discography ingestion/review | Provider-specific enrichment and Registry reviewed operations | Observation/review/canonical consumer | Audit provider-specific reconciliation logic |
| `chart-ingest-api` | Chart intake; existing Registry identity/write boundaries | Consumer/ingestion | Must consume shared provider identity, not become reconciliation owner |
| `scrape-artist-data` | Provider/source ingestion under Registry boundaries | Observation/consumer | Audit identity policy |
| `ingest-artist-discography` | Discography/provider ingestion under Registry boundaries | Observation/consumer | Audit identity policy |
| Registry admin inquiry/search | Reads provider links and canonical entities | Consumer | Read-only consumer |
| D11B research collector/calibration | Provider observations + read-only identity snapshot | Consumer | No canonical identity writes |

## 5. MIZIZI Surfaces

MIZIZI currently reuses accepted Registry structures including:

- Registry Tracks/Releases/Artists and relationships;
- provider observations/evidence;
- `provider_entity_links`;
- Registry review items;
- canonical write events;
- canonical chart links;
- identity lineage/projection authority.

Accepted MIZIZI rule families include canonical slug/taxonomy/projection hygiene and high-blast identity repair behind reviewed typed authority.

### MIZIZI retains ownership of

- invariant auditing;
- canonical/projection drift detection;
- deterministic reversible cleanup where Registry already proves the answer;
- downstream reference repair explicitly tied to canonical identity;
- review escalation;
- historical stewardship.

### MIZIZI does not acquire ownership of

- provider adapter lifecycle;
- provider API polling;
- cross-provider identity candidate generation;
- provider equivalence scoring;
- external identifier interpretation policy;
- fuzzy match promotion;
- generic provider-object storage.

## 6. Existing Strong Architectural Decisions

The repository already contains decisions #1163 must preserve:

1. External identifiers are assertions/evidence, not canonical database identity.
2. External identifier conflicts must be representable.
3. Do not create another provider-identifier table.
4. `provider_entity_links` is evidence/review bookkeeping.
5. `registry_track_provider_links` is canonical Track-provider identity.
6. Canonical provider-link mutation uses a governed typed operation.
7. Historical observations are not rewritten to match current identity.
8. Identity lineage is append-only.
9. Provider/metadata promotion must retain provenance.
10. MIZIZI has no standing unrestricted canonical mutation authority.
11. Human-reviewed operations remain separate by fact family and exact review fingerprint.
12. New operation families are added only when a concrete semantic gap is proven.

## 7. Authority Debt / Collision Risks To Audit

These are known or probable convergence targets.

### 7.1 Evidence link versus canonical link

Both `provider_entity_links` and `registry_track_provider_links` can appear to represent “provider identity” to callers.

Required outcome:

- evidence links stay explicitly non-canonical;
- canonical Track-provider reads use the canonical provider-link authority;
- workflow code must never infer canonicality from an evidence link alone.

### 7.2 Track-only canonical provider binding

Current canonical provider operational binding is Track-specific.

Question:

- Are Release and Artist provider IDs adequately represented as external identifier assertions + evidence links?
- Or is a typed operational provider binding required for those domains?

Do not answer by cloning the Track table. Prove the semantic need first.

### 7.3 Match methods inside canonical Track links

The accepted Track link contract currently recognizes match methods including exact identifiers, exact title/artist, fuzzy title/artist, manual, source import, and unknown.

#1163 must separate:

- historical/current link metadata;
- what methods may create a **candidate**;
- what methods are strong enough for future automatic canonical resolution.

Do not rewrite historical accepted links merely because future automatic policy is stricter.

### 7.4 Provider-specific local reconciliation

Audit provider ingestion/enrichment code for local rules that decide identity before the shared governance boundary.

Any such logic should become either:

- adapter observation;
- shared reconciliation candidate generation;
- or an explicitly reviewed Registry operation.

### 7.5 Direct table privileges

The current database-authority documentation has previously identified direct authenticated DML debt on identity-related tables even after governed operations existed.

Re-audit live current authority before implementation.

No assumption that old debt still exists is allowed.

### 7.6 Provider key normalization

Audit whether provider keys, schemes, object types, URLs, and provider IDs use one stable vocabulary across:

- observations;
- evidence links;
- canonical provider links;
- external identifier assertions;
- adapters;
- charts/research;
- admin surfaces.

## 8. Gaps Not Yet Proven

Do **not** create new tables for these until current authority is proven insufficient:

- generic external provider objects;
- generic provider capability registry;
- Release-provider canonical binding;
- Artist-provider canonical binding;
- provider-object lineage;
- generic cross-provider equivalence edges.

Each requires a concrete semantic-gap analysis.

## 9. First Architecture Audit Sequence

1. Inventory current Production schema/privileges for all tables above.
2. Inventory every current writer and classify it.
3. Inventory every provider key/object type currently stored.
4. Inventory current external identifier schemes.
5. Find local identity matching/reconciliation logic in provider adapters/workflows.
6. Map current read consumers to evidence versus canonical authority.
7. Reconcile MIZIZI rules against the jurisdiction contract.
8. Produce a collision/debt matrix.
9. Decide which existing primitives are sufficient.
10. Only then propose schema or operation changes.

## 10. Current Deployment State

This inventory is documentation-only.

- SQL migration needed: **No**
- Supabase Edge Function deploy needed: **No**
- Production Finish update needed: **No**
- Production data mutation: **No**


## 11. Read-only Production audit — 6 October 2026

Production project: `pgzizndxdyhqmtyywjmt`.

This audit performed no mutation.

### 11.1 Live evidence and canonical-link populations

`provider_entity_links` currently contains:

- Apple Music Track evidence: 104 confirmed, 2 superseded;
- YouTube Track evidence: 101 confirmed;
- Spotify Track evidence: 4 confirmed;
- SoundCloud Track evidence: 1 confirmed.

`provider_field_observations` currently contains:

- Apple Music Track observations: 978;
- YouTube Track observations: 128;
- Spotify Track observations: 22;
- SoundCloud Track observations: 3.

`registry_track_provider_links` currently contains:

- Apple Music: 328 `matched` rows with `match_method='exact_title_artist'`;
- Apple Music: 4 `needs_review` rows with `match_method='fuzzy_title_artist'`;
- no current canonical Track-provider rows for YouTube, Spotify, SoundCloud, Audiomack, Boomplay, or Mdundo.

`registry_external_identifier_assertions` currently contains:

- ISRC: 209 candidate assertions;
- MusicBrainz: 1 candidate assertion.

`registry_provider_sources` currently contains zero rows.

### 11.2 Current direct table privileges

The live audit confirms a materially different write posture across the authority layers.

#### `registry_external_identifier_assertions`

- anon: no access;
- authenticated: no direct access;
- service_role: SELECT only;
- no direct INSERT/UPDATE/DELETE for anon/authenticated/service_role.

This is aligned with typed governed admission.

#### `registry_track_provider_links`

- anon/authenticated/service_role: SELECT;
- no direct INSERT/UPDATE/DELETE for those roles.

This is aligned with governed canonical provider-link admission.

#### `provider_entity_links`

- authenticated: SELECT only;
- service_role: SELECT/INSERT/UPDATE/DELETE.

Because this table is evidence/review bookkeeping, service-role mutation is not automatically a canonical-authority violation, but every writer must remain explicitly classified and bounded.

#### `provider_field_observations`

- authenticated: SELECT only;
- service_role: SELECT/INSERT/UPDATE/DELETE.

This remains an evidence surface, not canonical identity.

#### `registry_provider_sources`

- authenticated: SELECT/INSERT/UPDATE/DELETE;
- service_role: SELECT/INSERT/UPDATE/DELETE;
- table currently empty.

This is the strongest live privilege debt found by the first #1163 audit.

Repository search found no current application-level direct writer that obviously requires authenticated DML on this table. The privilege must therefore be treated as **candidate retirement debt**, subject to exact dependency proof before any revocation migration is proposed.

#### `registry_identity_lineage`

- anon/authenticated: no direct access;
- service_role: direct table privileges are present;
- append-only triggers reject UPDATE/DELETE.

Insert authority and the exact current lineage writer paths still require writer-inventory reconciliation. Do not alter this table in #1163 architecture phase.

### 11.3 Current writer findings

Repository search confirms:

- Track Intake workflow finalization intentionally inserts `provider_entity_links` only to preserve provider evidence/navigation after proving canonical provider-link authority;
- permanent verifiers explicitly forbid Track Intake finalization from writing `registry_track_provider_links` directly;
- chart playback provider admission writes canonical provider links inside the accepted typed Registry operation/executor;
- an older `phase9-apple-music-chart-enrichment.ts` script contains direct provider-link SQL and must be classified as current, historical, or retired before implementation;
- legacy replay-baseline migrations contain historical direct writers and are not current runtime authority;
- current architecture documentation already records `provider_entity_links` as evidence bookkeeping and canonical provider identity as `registry_track_provider_links`.

### 11.4 First collision matrix

| Collision / debt | Evidence | Current decision |
| --- | --- | --- |
| Evidence links exist for YouTube/Spotify/SoundCloud but canonical provider links do not | live Production counts | Expected distinction, but reconciliation/admission path must be shared rather than consumer-specific |
| Apple canonical links rely heavily on historical `exact_title_artist` method | 328 matched rows | Preserve history; future auto-resolution policy may be stricter without rewriting historical accepted evidence |
| External identifier ledger is under-populated relative to provider evidence | 209 ISRC candidates / 1 MusicBrainz candidate | Build promotion/reconciliation around existing ledger, not a replacement table |
| `registry_provider_sources` has broad authenticated DML while empty | live privileges + zero rows | Candidate authority contraction after dependency proof |
| Evidence tables retain service-role write authority | live privileges | Audit writer allowlist; evidence writes are acceptable only through bounded provider workflows |
| Canonical Track provider binding is Track-only | schema | Semantic-gap analysis required before any Release/Artist provider-binding schema |
| Provider vocabulary is currently sparse and inconsistent with desired Tier 1 coverage | live rows only Apple/YouTube/Spotify/SoundCloud | Define provider-key/capability vocabulary before adapter expansion |
| Research identity coverage cannot be solved by fuzzy fallback | #1161/#1162 evidence | Provider Identity Control Plane must expose strong resolution/read snapshot; D11B remains consumer only |

## 12. Architecture Direction After Live Audit

The first live audit **does not justify a new generic identity table**.

Instead, the next design work should focus on:

1. canonical provider/identifier vocabulary;
2. exact writer allowlist for evidence surfaces;
3. shared reconciliation policy over existing evidence + identifier assertions + canonical links + lineage;
4. read-only resolution/snapshot contract;
5. provider adapter capability contract;
6. authority contraction for stale direct privileges;
7. only then any schema gap that remains proven.

The biggest immediate architecture risk is not missing storage. It is **multiple representations of provider evidence with insufficiently explicit promotion rules between observation, evidence, assertion, and canonical binding**.


## 13. Exact evidence-writer allowlist — Production 6 October 2026

Database-function inspection found exactly three current functions that mutate
`public.provider_entity_links`:

1. `public.admin_record_registry_track_intake_provider_evidence(...)`
2. `public.admin_select_registry_track_intake_provider_evidence(...)`
3. `public.admin_finalize_registry_track_intake_v1(...)`

No current database function was found mutating:

- `public.provider_field_observations`;
- `public.registry_provider_sources`.

Execution authority for all three `provider_entity_links` writers is:

- anon: **no EXECUTE**;
- authenticated: **EXECUTE**;
- service_role: **no EXECUTE**.

This is consistent with Track Intake being a reviewed human workflow.

The allowlist implication is important:

- Track Intake may write provider evidence bookkeeping;
- it may not directly write canonical `registry_track_provider_links`;
- canonical provider-link admission remains separately governed;
- an autonomous Provider Identity worker must not reuse these human-only functions as a hidden service-role write path.

### Candidate authority retirement

Because `registry_provider_sources`:

- currently has zero rows;
- exposes authenticated direct INSERT/UPDATE/DELETE;
- has no current database writer discovered by the writer scan;
- has no current application writer found by repository search;

its broad authenticated DML is now classified as **candidate stale authority**.

This is not yet permission to revoke it. The implementation phase must first prove:

1. no current RPC relies on invoker direct DML;
2. no frontend/service code relies on direct table writes;
3. no scheduled/legacy operational job depends on it;
4. no RLS policy intentionally uses those grants for an active workflow.

Only then may a narrow authority-contraction migration be proposed.
