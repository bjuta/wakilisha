# MIZIZI Slice 3 Tranche A Production Closure

Status: **PRODUCTION ACCEPTED — bounded Tranche A closure**

Issue: **#962 MIZIZI Slice 3: Obsolete Authority Retirement & Bypass Closure**

Implementation PR: **#1006**

Merged implementation main:

```text
9a163ddb9382287fa961e37d44f6f04806bf640d
```

This record closes only the stale Artist + Chart authority block delivered by
PR #1006. It does not close #962.

## Accepted scope

PR #1006 converged the stale low/medium Artist and Chart authority represented
by its exact merged scope:

- reviewed Artist identity composition reuses `registry.artist.create/v1`;
- Artist Claim creation composes governed Artist identity while preserving
  Claim-specific representation/lifecycle semantics;
- Missing Artist Intake composes governed Artist creation, bounded alias
  state, typed relationship resolution, audit, and review authority;
- the stale legacy `contributor_submissions.entity_id` write is absent;
- Chart Artist resolution is rebased onto canonical Track plus current
  Track↔Artist credit authority;
- Chart resolution reuses reviewed evidence, exact grants, admission, and
  verification;
- direct browser Artist Alias deletion is replaced by bounded alias-state
  authority;
- Label and Genre profile mutation uses accepted bounded profile commands;
- stale authenticated direct mutation grants are contracted for the exact
  provider-link and relationship-evidence roads in the merged candidate.

The shared grant/journal/evidence/fingerprint/review kernel was not redesigned.

## Preview and behavior acceptance

Disposable Preview:

```text
project_ref=qjqtscxezmijkioxwazy
branch_id=b3188255-79cf-44ca-bf08-7febca89c301
```

Accepted real Auth/PostgREST behavior included:

- applicant login: PASS;
- reviewer login: PASS;
- V3 Artist Claim submission: PASS;
- Claim approval: PASS;
- Missing Artist Intake: PASS;
- `create_from_artist_claim / applied` provenance: PASS;
- active Artist representation: PASS;
- Missing Artist alias `manual / active`: PASS;
- typed relationship endpoint resolution: PASS;
- merged review state: PASS;
- exactly one governed `registry.artist.create/v1` execution per accepted
  flow;
- Registry Artist Resource identity/lifecycle convergence: PASS;
- Top Songs presentation mutation during this acceptance: 0 rows;
- exact execution grants at rest: 0.

The candidate was then replayed cleanly in two directly observed stages:

```text
167 / 20260921170000 -> Artist permanent verifier PASS
168 / 20260921171000 -> Chart permanent verifier PASS
```

Replay receipts preserve the exact migration SHA-256 values merged by PR #1006.

## Protected implementation CI

Protected PR #1006 head:

```text
bd027bd07419f00c91d604f625ec11a17cbe9e99
```

Accepted runs:

```text
Critical Control Plane #1419 = SUCCESS
MIZIZI Release Production Control Plane #63 = SUCCESS
MIZIZI Track Production Control Plane #85 = SUCCESS
```

## Production SQL promotion

The canonical repository-migration promotion path ran from exact merged
`main`.

Applied repository migrations:

```text
20260921170000_registry_reviewed_artist_identity_composition_v1.sql
20260921171000_registry_chart_artist_resolution_rebase_v1.sql
```

Post-apply Production authority:

```text
project_ref=pgzizndxdyhqmtyywjmt
migration_count=168
migration_head=20260921171000
has_170000=true
has_171000=true
pending_repository_migrations=0
```

Independent Production SQL verification:

```text
verify-artist-studio-registry-entry-convergence.sql = PASS
verify-registry-chart-materialization-runtime.sql = PASS
```

The migration promoter stopped after durable apply because the committed
generated schema seal still represented Preview authority. The migrations were
not rerun.

## Production schema reconciliation

The repository's canonical `schema:generate` path regenerated the
`public,editorial` types and seal from live Production.

Accepted schema authority:

```text
schema_seal_mode=production
schema_source_project_ref=pgzizndxdyhqmtyywjmt
schema_migration_count=168
schema_migration_head=20260921171000
types_sha256=472186569827cdfe3d5a72b46a546db605839934abeaa8028d9e3233f911dc46
schema_verify=PASS
pending_migrations=0
```

The Production schema also independently exposes the expected
`editorial.publishing_items.content_kind` foreign-key relationship; this was
schema/type reconciliation, not another Slice 3 database mutation.

## Production frontend promotion

PR #1006 changed frontend callers, so frontend promotion remained a separate
post-merge gate.

Accepted build authority:

```text
deployed_main=9a163ddb9382287fa961e37d44f6f04806bf640d
protected_critical=365/365 PASS
complete_production_build=PASS
ga4_build_output_audit=PASS
preview_ref_in_dist=NO
production_ref_in_dist=YES
local_index_sha256=e9b9e62992b34b78825e5045cd0e77806900ab75ebf852d7c4f94b87cd834084
local_entry=assets/index-DG1JgV36.js
local_entry_sha256=5b409c8f8c0fc33c41b38e88407f56549956cc57fac9ca9a11648eb1956ee047
local_file_count=3794
```

Rollback authority was preserved before activation:

```text
/opt/wakilisha-react-backups/slice3-tranche-a-20260921T193928Z-9a163ddb
```

Staged bytes and activated live bytes matched exactly.

## Stopped deployment and recovery

The first direct-origin smoke after activation returned HTTP 500.

Read-only diagnosis proved:

```text
live_directories=3569 mode=700
live_files=3794 mode=600
rollback_directories=3569 mode=755
rollback_files=3794 mode=644
```

Nginx could not traverse the live root or read `index.html`, producing
permission-denied errors and the resulting SPA fallback redirect cycle.

This was a deployment-mode defect, not an application-byte defect.

The live artifact was repaired in place by restoring the accepted web-serving
mode contract only:

```text
directories=755
files=644
```

Post-repair byte identity remained exact:

```text
remote_index_sha256=e9b9e62992b34b78825e5045cd0e77806900ab75ebf852d7c4f94b87cd834084
remote_entry_sha256=5b409c8f8c0fc33c41b38e88407f56549956cc57fac9ca9a11648eb1956ee047
remote_file_count=3794
```

Post-repair HTTP acceptance:

```text
direct / = 200
direct /messages = 200
direct /admin/messages = 200
public / = 200
public /messages = 200
public /admin/messages = 200
direct entry SHA = expected
public entry SHA = expected
```

No content rollback, SQL change, Edge Function change, Nginx configuration
change, or second frontend deployment was required.

The preserved remote stage was then deleted.

## Deployment-runner hardening

The canonical versioned Lightsail frontend template now normalizes and asserts
the accepted web-mode contract:

```text
remote stage directories = 755
remote stage files = 644
live directories = 755
live files = 644
```

The canonical wrapper remains template-SHA pinned and its self-test now requires
the stage/live mode-contract markers and both `chmod 755` / `chmod 644`
operations.

This converts the Production incident into a permanent deployment control-plane
guard rather than retaining a manual operational exception.

## Disposable Preview cleanup

After Production SQL, schema, frontend-byte, and HTTP acceptance, the
disposable Preview branch was deleted:

```text
project_ref=qjqtscxezmijkioxwazy
branch_id=b3188255-79cf-44ca-bf08-7febca89c301
delete=PASS
```

The Supabase branch list now contains only the default Production branch.

## Remaining Slice 3 boundary

#962 remains **OPEN**.

This closure does not claim completion of:

- Tranche B high-blast exact containment/retirement;
- remaining Slice-3-owned bypass/grant work not closed by PR #1006;
- the separately active Candidate D1 Top Songs presentation-authority work.

Slice 4 #991 therefore remains blocked by the whole-Slice exit gate.

## Final deployment classification

- SQL migration needed: **No — PR #1006 Production SQL is accepted**
- Supabase Edge Function deploy needed: **No**
- Production Finish update needed: **Complete for this bounded block**
- frontend deploy needed: **No — accepted artifact is live**
- Production data mutation: **No additional mutation**
- disposable Preview: **Deleted**
- PR needed: **Yes — this closure/schema/runner reconciliation PR**
