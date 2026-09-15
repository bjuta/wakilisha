# MIZIZI Slice 2 Chart Materialization — Production Closure

Date: 15 September 2026

Status: **PRODUCTION ACCEPTED — #939 CLOSED**

Programme authority:

- `docs/engineering/mizizi-registry-authority-security-convergence-programme.md`
- Slice 2 — Governance Primitive Convergence

Implementation authority:

- issue #939 — `MIZIZI Slice 2 — converge chart Registry materialization onto governed primitives`
- PR #941 — governed Registry materialization primitives
- PR #943 — chart runtime caller-JWT convergence
- merged main: `43c67c2da912e85d271d60346da947c33a31d13b`

This record closes the chart Registry materialization convergence boundary represented by #939.
It does **not** declare Slice 2 complete and does not authorize Slice 3 retirement work.

## Production database promotion

The exact merged repository migration was promoted with the canonical repository-owned migration path:

- `20260915122100_chart_runtime_caller_jwt_convergence_v1.sql`
- candidate migration SHA-256: `03c1444482379adf0b745b1fc43bb84c5c53d6f80ce4125b9233bad3ae7f7754`

Production migration authority advanced to:

- migration count: `132`
- migration head: `20260915122100`

Canonical promotion acceptance proved:

- the exact repository migration was the only pending Production migration before mutation;
- `supabase db push` applied only that migration;
- all 132 Production migration versions exist locally at the same timestamps;
- repository migration history is fully applied to Production;
- post-apply dry-run reports zero pending migrations;
- repository schema snapshot matches all 132 active migrations;
- committed `public,editorial` database types match Production under the accepted schema-equality contract;
- the permanent chart materialization runtime SQL verifier completed without exception in Production.

No migration-history repair, timestamp alias, `db pull`, connector migration apply, or Production ledger rewrite was used.

## Production Edge deployment

Only the two Edge Functions changed by PR #943 were deployed from exact merged `main`, in the accepted order.

### `chart-provider-fetch`

Production state after deployment:

- status: `ACTIVE`
- version: `1`
- `verify_jwt = true`
- deployed bundle SHA-256: `d7626b4cb614c18386ea570da794cffebc7a7b78f2fa4c5aedb198be549b779f`

The function remains a narrow provider boundary. It verifies the caller, requires `manage_ingest`, reads the existing Admin-managed provider credential store server-side, performs the provider request, and returns provider data. It has no canonical Registry mutation authority.

### `chart-ingest-api`

Production state after deployment:

- status: `ACTIVE`
- version: `92`
- `verify_jwt = true`
- deployed bundle SHA-256: `a92b6aaa813df2f2b5bfb84ec68c1638546a9688f5b77c3990b6c43b2bd871d3`

The deployed runtime:

- uses caller JWT + anon-key database access;
- no longer loads `SUPABASE_SERVICE_ROLE_KEY`;
- performs action-specific capability checks;
- contains no direct canonical Registry Artist/Track/credit DML;
- routes Artist creation, Track creation, Track↔Artist credit admission, and Artist-origin admission through the governed Slice-2 broker/RPC surfaces;
- keeps superseded service-role chart-origin roads revoked.

No unrelated Edge Function was redeployed.

## Production runtime acceptance

Authenticated browser acceptance was run against live Production after both Edge deployments.

The probe was intentionally read-only/non-destructive. It did not create an ingest run, save a preset, invoke a real provider, commit a chart, or mutate canonical Registry state.

Accepted results:

- `chart-ingest-api` OPTIONS request: HTTP `200`;
- `chart-provider-fetch` OPTIONS request: HTTP `200`;
- invalid JWT against `chart-ingest-api`: HTTP `401`;
- invalid JWT against `chart-provider-fetch`: HTTP `401`;
- real caller-JWT guarded `get_family_ingest_presets` read: HTTP `200`, two presets returned;
- real caller-JWT provider-boundary request using an intentionally unknown provider: HTTP `400` with the expected `Unknown provider` rejection after authorization.

The first probe harness printed an overall FAIL only because its JavaScript check expected `Access-Control-Allow-Origin` to be directly readable and received `null`. That was a harness observability error, not a runtime/CORS failure: the browser successfully completed the cross-origin requests and exposed their HTTP responses to JavaScript, including the authenticated POST results above.

Under the stopped-deployment rule no Edge function was redeployed and no completed mutation was repeated. The actual live state was inspected and accepted surgically.

## Preview cleanup

The disposable #939 canonical Preview was deleted only after Production SQL, Edge, and runtime acceptance were complete:

- Preview project ref: `chuujtdijreulagarnfq`
- Preview branch id: `b621f511-8796-432d-a230-118200cd2cbc`

Post-deletion Supabase branch inspection showed only the Production default branch remaining.

## #939 exit conclusion

The accepted Production state now proves:

- chart-side Artist/Track materialization is governed;
- chart commit/reingest no longer directly creates Registry Artists or Tracks under ambient service role;
- Track↔Artist credit admission is governed;
- existing-Artist origin admission is governed and established-origin overwrite remains rejected;
- unresolved Artist materialization remains draft-first and does not smuggle lifecycle activation into identity creation;
- `chart-ingest-api` carries no ambient service-role Registry mutation authority;
- `chart-provider-fetch` isolates provider credential use from Registry authority;
- Release-family materialization remains disabled/inert because the audited current chart runtime does not require a Release materialization road in this boundary;
- MIZIZI remains non-autonomous with no new standing Registry grants;
- exact merged-main Production promotion is independently verified;
- disposable Preview residue is removed.

Issue #939 was therefore closed as `completed` after Production acceptance.

## Slice 2 remains open

Completion of #939 does **not** complete Slice 2.

The Primitive Convergence Map and current Authority Ledger still identify substantial accepted Slice-2 convergence work, including:

1. converge the deployed Artist enrichment/backfill family behind one governed Artist enrichment capability instead of four permanent privileged roads;
2. converge remaining legitimate high-blast-radius intake/discography/membership/credit writers onto the shared exact-grant/admission/journal boundary while preserving their domain semantics;
3. enforce the Pure Public Read invariant by removing canonical Registry write-on-read behavior from `public-content-read` and any surviving compatible gateway;
4. establish the relationship-authority convergence contract from the legacy graph onto typed Registry relationship authority without destroying historical evidence;
5. establish Identity + Projection Lineage so historical canonical references remain interpretable after merge/supersession/retirement;
6. establish shared Evidence/Review contracts where recurrence is proven, without collapsing domain-specific review semantics into generic JSON tables.

These should be executed as one serious Slice-2 completion programme boundary with bounded internal gates, not recursively decomposed into a proliferation of product phases or child issues.

Slice 3 obsolete-authority retirement, including final `scrape-artist-data` removal, remains blocked until the required Slice-2 replacement authority and dependency proof exist.

## Deployment classification for this closure record

- SQL migration needed: **No**
- Supabase Edge Function deploy needed: **No**
- Production Finish update needed: **No**
- frontend deploy needed: **No**
- Production data mutation: **No**

This file is documentation-only reconciliation of already accepted Production authority.
