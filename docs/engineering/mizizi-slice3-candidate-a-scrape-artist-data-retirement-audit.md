# MIZIZI Slice 3 Candidate A Retirement Audit

Status: **IMPLEMENTATION CANDIDATE - PRODUCTION RETIREMENT NOT YET APPLIED**

Programme issue: #962

Exact entry authority:

- `main`: `71ae28d4b76d4336eb65e2bc2a4110f5e64ad544`
- Production project: `pgzizndxdyhqmtyywjmt`
- Production migration head: `20260916210001`

## Candidate

Retire `scrape-artist-data`.

The Edge Function is obsolete canonical Registry authority, not a capability that must be preserved.

## Fresh Production audit

At the Slice 3 entry boundary, Production still exposed:

- Edge Function: `scrape-artist-data`
- status: `ACTIVE`
- version: `55`
- `verify_jwt=false`
- deployed bundle SHA-256: `f389414ec391aca3a0182254387bfb5542f8444420c15ac7b7314e9cb00ed371`

The deployed function creates a service-role client and can directly mutate canonical Artist, Release, Track, membership, credit, and typed relationship state.

Read-only Production dependency checks returned:

- database function/procedure references containing `scrape-artist-data`: `0`
- active `pg_cron` jobs containing `scrape-artist-data`: `0`
- `registry_releases` rows with scraper provenance: `0`
- `registry_tracks` rows with scraper provenance: `0`
- `registry_release_artists` rows with scraper provenance: `0`
- `registry_release_tracks` rows with scraper provenance: `0`
- `registry_track_artists` rows with scraper provenance: `0`
- `registry_entity_relationships` rows with scraper provenance: `0`

Fresh repository search found no live application URL caller for `/functions/v1/scrape-artist-data` and no package/script invocation command.

Historical documents and replay receipts remain historical evidence and are not runtime dependencies.

## Replacement authority

Slice 2 already Production-accepted the replacement governance boundaries for:

- Artist enrichment;
- Discography evidence, review, and exact-set materialization;
- Track and Release identity;
- exact membership and credit operations;
- typed Registry relationships;
- shared evidence and review authority.

The shared `supabase/functions/_shared/registry-track-identity.ts` helper remains live and is not retired.

## Repository candidate

This candidate:

1. removes `supabase/functions/scrape-artist-data/index.ts`;
2. changes the existing Phase 0B privileged-writer verifier so a writer classified `retire` must have no runtime source;
3. changes the consolidated MIZIZI contract from positive scraper-source assertions to a permanent absence assertion;
4. changes no SQL, schema, frontend, accepted Slice 2 primitive, or canonical Registry data.

The privileged-writer manifest intentionally retains the `scrape-artist-data` historical classification with disposition `retire`. The control-plane verifier now interprets that disposition mechanically: reintroducing the source fails Critical.

## Production promotion

Only after protected CI and merge:

1. delete the Production `scrape-artist-data` Edge Function;
2. independently prove the function is absent;
3. recheck zero scraper-provenance canonical rows;
4. recheck ordinary browser canonical DML grants remain zero;
5. record Production closure before advancing to the next retirement family.

## Rollback

No data rollback is expected because retirement itself performs no canonical data mutation.

If an undiscovered legitimate dependency is proved during Production acceptance, restore only the exact previously accepted v55 bundle while the dependency is diagnosed. Do not restore broader authority or alter Slice 2 governance primitives.

## Deployment classification

- SQL migration needed: **No**
- Supabase Edge Function Production change: **Yes, deletion only**
- frontend deploy needed: **No**
- Production Finish update needed: **No**
- Production data mutation: **No**
