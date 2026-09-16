# MIZIZI Slice 2 Gate A-final Authority Convergence

Date: 16 September 2026

Status: **candidate source convergence only; Production is unchanged and runtime acceptance remains gated on disposable Preview replay.**

Accepted base: `main@e69f78667c8b8451239f085a87309e54a53fd008`

Working branch: `fix/slice2-gate-a-final-artist-intake-authority`

This record supersedes the pre-convergence runtime descriptions for `artist-registry-intake` and the Track/Release detail browser mutation paths in `docs/engineering/mizizi-registry-authority-ledger.md`. The older ledger remains retained as historical Slice-1 audit evidence.

## Gate objective

Gate A-final closes the remaining live Artist intake authority defect and removes the two stale Admin browser canonical DML paths identified after Artist enrichment and Discography authority had already converged.

The gate does not reopen those previously accepted slices and does not authorize Production mutation by itself.

## Artist intake authority

The candidate changes the Artist CSV intake workflow from an unauthenticated service-role mutation boundary into a caller-bound reviewed-evidence workflow.

The Admin page now sends the signed-in user's Supabase access token. `artist-registry-intake` is configured with `verify_jwt = true`, validates the caller, and requires `manage_registry` before creating any service-role client.

Service-role use remains limited to intake run/staging operations and canonical reads needed for orchestration. It is not canonical Artist mutation authority.

Review decisions are recorded through `admin_review_registry_artist_intake_v1(...)`. Accepted review state is frozen with a SHA-256 `review_fingerprint`. The reviewed target pointer remains review authority; a separate `applied_registry_artist_id` stores the eventual materialization result so apply cannot rewrite the reviewed facts after approval.

New Artist identity creation reuses the accepted `registry.artist.create/v1` materializer through `registry_artist_intake_admin`. That path creates a draft Artist only, rechecks collision state at execution, records canonical write evidence, and requires independent verification.

Existing/new Artist evidence admission reuses the established typed Artist Origin and Artist Enrichment operations. `csv_manual_upload` is admitted narrowly as a reviewed evidence source rather than being mislabeled as Spotify, Apple Music, MusicBrainz, or another provider.

The candidate Edge function contains no direct `registry_artists` insert/update/delete road and no body-supplied actor authority.

## Track detail browser mutation

The Track detail page no longer performs browser-side `registry_tracks.update(...)` calls.

Save now uses `saveRegistryEntityPatch(...)` in the shared Admin Registry client. The caller's real JWT is forwarded to the Admin Registry boundary, the existing editable-field schema remains authoritative, and `updated_at` is supplied as the optimistic concurrency boundary.

Archive now uses the existing `deleteRegistryEntity("track", ...)` Admin Registry path rather than browser table DML.

Direct Track reads remain unchanged because this gate concerns mutation authority, not read-path consolidation.

## Release detail browser mutation

The Release detail page no longer performs browser-side `registry_releases.update(...)` calls.

The legacy minified `admin-router` Release allowlist does not include `release_date_precision` or `label_id`. Rewriting that one-line deployed bundle merely to preserve these two existing editor fields would enlarge risk and create unrelated router churn.

Instead, Gate A-final installs `admin_patch_registry_release_detail_v1(...)`, a narrow caller-bound Release-detail authority that preserves the existing field family atomically:

- title;
- release type;
- UPC;
- release date;
- release date precision;
- label binding;
- description;
- artwork URL;
- status.

The RPC requires an authenticated `manage_registry` user, locks the exact Release row, compare-and-sets against the editor's `updated_at`, relies on canonical table constraints/FKs for typed validity, writes the Registry audit log, writes the canonical write ledger, and returns the updated Release row.

The frontend calls this authority through `src/services/registry/admin/releaseDetailClient.ts`. Archive continues through the established Admin Registry delete/archive path.

This is intentionally narrower than expanding `admin-router`: it does not add another generic CRUD surface and it preserves the two fields that the current generic router cannot save.

## Permanent source contract

`test/registry/gate-a-final-artist-intake-authority.test.ts` seals the source-level invariants:

- signed-in JWT Artist intake transport;
- JWT gateway enforcement;
- no canonical Artist DML in the intake Edge function;
- frozen review fingerprint and separate apply-result pointer;
- governed Artist creation/evidence admission;
- no browser Track canonical update;
- no browser Release canonical update;
- preservation of Release date precision and label binding through the new exact authority.

These tests are source contracts, not substitutes for runtime acceptance.

## Runtime acceptance still required

Before PR/merge/Production promotion, one disposable Supabase Preview must prove the repository migration baseline plus both Gate A-final migrations and runtime surfaces.

Required Preview proof includes:

1. unauthenticated Artist intake rejection;
2. authenticated non-`manage_registry` rejection;
3. valid manager upload/match/review flow;
4. review fingerprint freeze and tamper rejection;
5. new Artist materialization as draft only;
6. collision/idempotency behavior;
7. reviewed CSV origin/enrichment evidence admission;
8. no direct canonical Artist mutation from the Edge function;
9. Track detail save/archive through Admin Registry authority with stale-update protection;
10. Release detail save preserving `release_date_precision` and `label_id` with stale-update protection;
11. canonical/audit write evidence for Release detail mutation;
12. focused tests, consolidated CI contract, relevant audits, and `npm run build:app`.

No disposable Preview branch existed when this candidate was prepared. Creating one is billable and therefore requires explicit cost confirmation before the Preview gate can begin.

## Production posture

Production remains unchanged at this stage.

No Gate A-final SQL has been applied to Production. No Gate A-final Edge function has been deployed. No frontend deployment has been activated. The accepted deployment sequence remains Preview proof first, protected PR/CI/merge second, then Production SQL, Edge, frontend activation, and smoke/canary as separate controlled steps.
