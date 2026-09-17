# MIZIZI Slice 3 Candidate B: Artist Enrichment Compatibility Wrapper Retirement

Date: 17 September 2026

Repository base: `main@336b39d2c335d149c86f37f2e261b58df50cf9f0`

Issue authority: #962, MIZIZI Slice 3: Obsolete Authority Retirement & Bypass Closure

## Decision

Retire together:

- `backfill-artist-spotify-images`
- `backfill-artist-type`

These functions are compatibility adapters over the accepted `registry-enrich-artist` reviewed-evidence authority. They are no longer product authorities.

## Replacement proof

Current Admin Artist enrichment uses the shared `src/services/registry/admin/artistEnrichment.ts` client and calls only:

`/functions/v1/registry-enrich-artist`

The accepted enrichment authority requires caller JWT + `manage_registry`, immutable reviewed evidence, typed one-Artist admission, exact grants, canonical write receipts, and independent verification.

The compatibility wrappers have no current:

- `src/` caller;
- GitHub workflow caller;
- Production database function/procedure dependency;
- active `pg_cron` dependency.

## Production runtime baselines

### `backfill-artist-spotify-images`

- function id: `990783e3-7468-4be6-baf4-4c1b59270107`
- version: `32`
- `verify_jwt = true`
- bundle SHA-256: `53a37310159e2ab4090a7872821fe54dfaec9e3d4850f4768776f661e1faa289`

### `backfill-artist-type`

- function id: `29b5c648-8696-4e9f-a2ee-e588be4779f3`
- version: `30`
- `verify_jwt = true`
- bundle SHA-256: `ace462904153840981c2ff6d9d29d09baed74d20183d053df62e19babba3cbc8`

## Production traffic proof

Audit window:

- start: `2026-09-15T18:01:30Z`
- end: `2026-09-17T18:07:12Z`
- total: 2,885 minutes
- query windows: five bounded windows, each at most 12 hours

Recorded wrapper traffic:

| Time UTC | Wrapper | Method | HTTP |
|---|---|---|---:|
| 2026-09-15 18:07:21 | Spotify images | POST | 401 |
| 2026-09-15 18:07:22 | Artist type | POST | 401 |
| 2026-09-15 18:19:27 | Spotify images | POST | 401 |
| 2026-09-15 18:19:28 | Artist type | POST | 401 |
| 2026-09-15 18:24:44 | Spotify images | POST | 409 |
| 2026-09-15 18:24:44 | Artist type | POST | 409 |

There were no successful invocations.

All six failed calls were confined to the immediate post-convergence acceptance window. Every later audit window recorded zero invocations for both wrappers through the audit end.

The failure classes are consistent with the accepted convergence contract:

- missing/invalid caller authority fails closed;
- unapproved or unreviewed apply attempts fail closed at the governed broker.

Because current repository/database/job callers are zero and no successful or later runtime use exists, these requests do not establish a legitimate dependency.

## Repository retirement contract

This candidate:

- removes both Edge Function sources;
- removes both privileged-writer manifest entries;
- converts the existing Artist-enrichment verifier from positive compatibility-wrapper assertions to permanent negative retirement assertions;
- extends the Phase 0B writer control plane to reject reintroduction of either source or manifest classification;
- preserves `registry-enrich-artist`;
- preserves `registry-artist-provider-fetch`;
- preserves the already-governed `backfill-artist-origin`;
- preserves historical Slice 2 evidence.

No SQL migration, schema change, frontend runtime change, or Production data mutation is part of this repository candidate.

## Production deletion gate

The two Production wrappers may be deleted only after:

1. this repository retirement candidate passes local focused + critical acceptance;
2. protected CI passes on the exact candidate head;
3. the retirement change is merged;
4. a fresh immediate Production traffic check still shows no new successful/current use;
5. exact deployed identities still match the baselines above.

After deletion, independent acceptance must prove:

- both functions are absent from Production inventory;
- both old URLs fail closed;
- `registry-enrich-artist` remains ACTIVE;
- current Admin enrichment replacement authority remains intact;
- canonical Artist state is unchanged by retirement;
- no frontend or Finish deployment occurred.
