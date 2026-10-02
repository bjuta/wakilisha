# Creator Cohort Work Provider Resolution V1

Date: 1 October 2026

Status: **PRODUCTION SQL + EDGE DEPLOYED — FIRST BOUNDED WORK COHORT PENDING**

Programme authority:

- issue #1118 — real creator cohort rollout acceptance;
- accepted Music Identity & Rights Work / Track-to-Work authority;
- accepted Music Work provider evidence audit;
- accepted Track ISRC projection closure.

## 1. Purpose

Production now has:

- 2,407 active Tracks;
- 2,306 active Tracks with canonical ISRC;
- zero canonical Works;
- zero Track-to-Work links.

The remaining structural gap is not schema. WAKILISHA already has governed:

- `registry.work.create/v1`;
- `registry.track_work_link.admit/v1`;
- `registry.external_identifier_assertion.admit/v1`.

The missing layer is trusted provider Work observation that can feed those existing operations without inventing a generic Work writer.

V1 adds that missing bridge.

## 2. Provider boundary

The first executable provider is MusicBrainz because the accepted evidence package already established the chain:

`ISRC → Recording → Work`

V1 automatically admits only when all of the following are current:

- the WAKILISHA Track exists and is not archived;
- the caller-supplied ISRC exactly equals the Track's canonical ISRC after scheme normalization;
- MusicBrainz returns exactly one Recording for the ISRC;
- that Recording has exactly one Work relation;
- the Recording→Work relation type is exactly `performance`;
- the relation is not marked `partial`;
- the Work has a valid MusicBrainz UUID and a nonblank title.

Anything else is review-only.

No Apple composer string, title similarity, Artist billing, or cross-provider heuristic is allowed to create Work identity in V1.

## 3. Identity model

MusicBrainz Work MBID is evidence, not WAKILISHA canonical identity.

For a new exact MusicBrainz Work observation, WAKILISHA derives a deterministic internal Work UUID from:

`work.provider:musicbrainz:<work-mbid>`

This provides idempotent convergence when multiple WAKILISHA recordings resolve to the same MusicBrainz Work while preserving the WAKILISHA UUID as the canonical Registry identity.

Track-to-Work link UUID is derived independently from:

`track.work:<track-uuid>:<work-uuid>:embodies`

The relation remains a first-class Registry row and does not collapse Track identity into Work identity.

## 4. Runtime separation

The Edge function:

`supabase/functions/music-work-resolver/index.ts`

has two separate authority legs.

### Provider observation

Service authority may only record append-only provider evidence through:

`public.record_registry_work_provider_observation_v1(...)`

That function writes no canonical Work, Track-to-Work, or external-identifier row.

Provider evidence is classified:

- trust: `EXTERNAL_EVIDENCE`;
- source kind: `musicbrainz`;
- recorder: `system:music_work_provider_resolver`.

### Canonical promotion

The authenticated caller must have `manage_registry`.

Canonical promotion runs through:

`public.admin_admit_registry_work_provider_observation_v1(work_evidence_id, track_work_evidence_id)`

That wrapper composes existing typed authorities:

1. `public.admin_create_registry_work_v1(...)`;
2. Work MusicBrainz external identifier admission;
3. optional ISWC external identifier admission when retained on the new Work;
4. `public.admin_admit_registry_track_work_link_v1(...)`.

The provider runtime never performs service-role DML against:

- `registry_works`;
- `registry_track_work_links`;
- `registry_external_identifier_assertions`.

## 5. External identifiers

The existing external-identifier operation family remains authoritative.

V1 adds:

- `musicbrainz` to the allowed identifier schemes;
- a Work-specific adapter over the same `registry_external_identifier_admin` actor and `registry.external_identifier_assertion.admit/v1` operation.

No second generic external-identifier authority is introduced.

Work MBID and ISWC therefore remain typed assertions against the WAKILISHA Work UUID.

## 6. Catalogue runner

`scripts/control-plane/run-music-work-resolution.mjs`

is resumable and defaults to plan-only.

Without `--apply`:

- no provider network calls;
- no Registry mutation.

With `--apply`:

- authenticates a real Registry administrator;
- requires an explicit reviewed Track cohort via repeatable `--track-id` or `--track-ids-file`;
- refuses `--limit` as a Production apply selector so database ordering cannot change cohort membership;
- resolves only those exact non-archived Tracks with valid canonical ISRCs;
- calls the governed resolver sequentially;
- records every verified or review-only result to a durable JSONL file;
- supports `--resume-log`;
- stops on an unexpected runtime failure.

The runner does not receive or use the service-role key.

The first reviewed Production Work-resolution cohort is committed at:

`scripts/control-plane/music-work-resolution-cohorts/creator-cohort-work-resolution-v1.json`

and contains exactly:

- `Legend (Intro)` — Track `8ae9c169-3ece-4c29-8c86-07352bf93dd9`, ISRC `ZA34K2301678`, expected automatic `verified` lane;
- `Legalization` — Track `c4ecbbf1-c7ec-450b-81b2-8476964a6069`, ISRC `ZA56E2302202`, expected `review_required` no-Work lane.

The manifest is cohort authority only. Provider state remains live and runtime results are recorded from the actual resolver response.

## 7. Rate limit

The MusicBrainz public service requires a meaningful User-Agent and limits clients to approximately one request per second.

The resolver and runner both preserve at least 1.1 seconds between public request sequences. Production-scale commercial use must use an appropriate MusicBrainz commercial/licensed path rather than assuming the public service is an unrestricted bulk-production backend.

## 8. Explicit non-goals

V1 does not:

- create Work contributions;
- create People from composer/writer strings;
- infer rights, ownership, royalties, or splits;
- automatically resolve multiple MusicBrainz Recordings;
- automatically resolve multiple Works;
- promote partial Recording→Work relationships;
- merge existing WAKILISHA Works across providers;
- use Apple Music as a bulk Work-resolution backbone;
- mutate frontend presentation;
- introduce a generic Work backfill SQL engine.

## 9. Acceptance gates

Before Production execution:

1. canonical Supabase migration filename generated by CLI;
2. focused contract tests pass;
3. permanent SQL verifier passes;
4. canonical writer inventory regenerated and passes;
5. one clean disposable Preview proves full baseline replay;
6. only the target migration is pending;
7. target migration applies;
8. `music-work-resolver` Preview deployment is ACTIVE;
9. deterministic positive fixture proves Work + MBID/ISWC + Track→Work causality;
10. negative no-Recording, multi-Recording, no-Work, multi-Work, partial-relation cases fail closed;
11. idempotent replay leaves one Work and one Track→Work link;
12. protected Critical Control Plane and application build pass;
13. Production SQL and Edge promotion occur as separate deployment gates;
14. Production Work backfill begins with a bounded cohort before catalogue-wide continuation.

## 10. Deployment classification

For this implementation:

- SQL migration: **Yes**
- Edge Function: **Yes — `music-work-resolver`**
- Frontend: **No**
- Production data mutation during implementation/PR: **No**
- Provider calls during implementation/PR: **Preview/test only after explicit acceptance setup**
