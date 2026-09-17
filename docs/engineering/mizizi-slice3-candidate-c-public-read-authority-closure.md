# MIZIZI Slice 3 Candidate C Public Read Authority Closure

Status: **IMPLEMENTATION CANDIDATE - RUNTIME ALREADY CONVERGED**

Programme issue: #962

Exact entry authority:

- merged `main`: `1926c3fc30f8ad4528fa6748049874722f4145b1`
- Production project: `pgzizndxdyhqmtyywjmt`
- Production migration head: `20260916210001`

## Candidate

Close the stale canonical Registry write-on-read debt classification for `public-content-read`.

This candidate does not change the Edge Function source. Production and repository source already satisfy the Pure Public Read invariant. The remaining debt is the authority ledger and the strength of the permanent negative contract.

## Production proof

Production `public-content-read` was audited at:

- status: `ACTIVE`
- version: `89`
- `verify_jwt=true`
- deployed bundle SHA-256: `d5b8abf7776e1086eab2d809b064ba529ec031b6fdc7df9401858ae9853e5943`

The deployed and merged source contains no direct `INSERT`, `UPDATE`, `UPSERT`, or `DELETE` against canonical `registry_*` tables.

The public Release description fallback is response-only.

The seven RPCs used by the deployed gateway were inspected in Production:

- `resolve_video_provider_sources_for_service`
- `list_public_article_author_paths`
- `list_public_article_author_organization_paths`
- `resolve_article_preview_nonce`
- `public_get_article_trust`
- `publish_due_article_publications`
- `get_public_artist_structural_proximity`

None performs direct canonical music Registry DML.

`publish_due_article_publications` belongs to Article publication state, not canonical music Registry authority. Operational rate-limit logging is also outside canonical Registry truth.

## Repository closure

This candidate:

1. changes `public-content-read` from `remove_canonical_write_side_effect` to `keep`;
2. records `canonicalMutation=false`;
3. records `legacyDebt=false`;
4. keeps `futureBoundary=pure_public_read`;
5. makes Phase 0B fail if direct canonical Registry DML is reintroduced;
6. makes Phase 0B and the focused MIZIZI contract fail if `public-content-read` invokes any database function classified as a canonical Registry mutator.

The service-role credential remains classified and high-risk. This closure proves only that the public read gateway has no canonical music Registry mutation authority.

## Production promotion

No Production deployment is required.

The accepted v89 runtime already satisfies the invariant, so redeploying unchanged runtime would add deployment risk without changing authority.

After protected CI and merge, acceptance is:

1. exact merged-main contract proof;
2. Production function version/hash recheck;
3. direct route smoke;
4. canonical Registry DML grant invariant recheck.

## Deployment classification

- SQL migration needed: **No**
- Supabase Edge Function deploy needed: **No**
- frontend deploy needed: **No**
- Production Finish update needed: **No**
- Production data mutation: **No**
