# MIZIZI Slice 2 Gate A-final Authority Convergence

Date: 16 September 2026

Status: **disposable Preview acceptance passed for the database authority surfaces; protected PR/CI remains pending. Production is unchanged.**

Accepted base: `main@e69f78667c8b8451239f085a87309e54a53fd008`

Working branch: `fix/slice2-gate-a-final-artist-intake-authority`

Runtime-acceptance Preview: `gate-a-final-preview` / `ltrjkigkdryfdqkdwygk` — deleted after acceptance; used for runtime authority validation, not canonical migration-ledger replay proof.

Canonical replay-proof Preview: `gate-a-final-preview-clean` / `cxasrxyajuoxwsaevvfy` / branch `9b532573-a392-4ced-8f48-559a03e00737`.

This record supersedes the pre-convergence runtime descriptions for `artist-registry-intake` and the Track/Release detail browser mutation paths in `docs/engineering/mizizi-registry-authority-ledger.md`. The older ledger remains retained as historical Slice-1 audit evidence.

## Gate objective

Gate A-final closes the remaining live Artist intake authority defect and removes the two stale Admin browser canonical DML paths identified after Artist enrichment and Discography authority had already converged.

The gate does not reopen those previously accepted slices and does not authorize Production mutation by itself.

## Artist intake authority

The candidate changes the Artist CSV intake workflow from an unauthenticated service-role mutation boundary into a caller-bound reviewed-evidence workflow.

The Admin page now sends the signed-in user's Supabase access token. `artist-registry-intake` is configured with `verify_jwt = true`, validates the caller, and requires `manage_registry` before creating any service-role client.

Service-role use remains limited to intake run/staging operations and canonical reads needed for orchestration. It is not canonical Artist mutation authority.

Review decisions are recorded through `admin_review_registry_artist_intake_v1(...)`. Accepted review state is frozen with a SHA-256 `review_fingerprint`. The reviewed target pointer remains review authority; a separate `applied_registry_artist_id` stores the eventual materialization result so apply cannot rewrite the reviewed facts after approval.

New Artist identity creation reuses the accepted `registry.artist.create/v1` materializer through `registry_artist_intake_admin`. That path creates a draft Artist only, records canonical write evidence, and requires independent verification.

Preview replay exposed one important retry defect: the first implementation performed fresh collision discovery before asking the shared materializer whether the exact deterministic grant was already a succeeded operation. A retry therefore collided with the Artist created by its own first success. `20260916120300_registry_artist_intake_idempotent_replay_integrity_v1.sql` corrects the order: an existing exact grant bound to the same caller, staging row, deterministic Artist and reviewed identity re-enters the shared materializer first; fresh collision discovery remains mandatory for first materialization only.

Preview replay also closed a target-status mismatch. The original review functions admitted `needs_review` Artists while downstream Artist Origin/Enrichment authorities operate only on active/draft Artists. `20260916120400_registry_artist_intake_target_status_integrity_v1.sql` aligns review snapshot, review admission and apply sealing to the same active/draft boundary.

Existing/new Artist evidence admission reuses the established typed Artist Origin and Artist Enrichment operations. `csv_manual_upload` is admitted narrowly as a reviewed evidence source rather than being mislabeled as Spotify, Apple Music, MusicBrainz, or another provider.

The candidate Edge function contains no direct `registry_artists` insert/update/delete road and no body-supplied actor authority.

## Track detail browser mutation

The Track detail page no longer performs browser-side `registry_tracks.update(...)` calls.

Save now uses `saveRegistryEntityPatch(...)` in the shared Admin Registry client. The caller's real JWT is forwarded to the Admin Registry boundary, the existing editable-field schema remains authoritative, and `updated_at` is supplied as the optimistic concurrency boundary.

Archive does **not** use the shared `deleteRegistryEntity(...)` helper. Production inspection established that the corresponding `admin-router` DELETE route is a draft-only hard-delete boundary, so using it here would change existing editor semantics. Gate A-final therefore installs `admin_archive_registry_music_entity_v1(...)` and the Track editor calls it through `archiveRegistryTrack(...)`. The operation sets only `status='archived'`, compare-and-sets against the editor's `updated_at`, writes the Registry audit log, and emits canonical write evidence.

Direct Track reads remain unchanged because this gate concerns mutation authority, not read-path consolidation.

## Release detail browser mutation

The Release detail page no longer performs browser-side `registry_releases.update(...)` calls.

The deployed `admin-router` Release allowlist does not include `release_date_precision` or `label_id`. Rewriting that bundled router merely to preserve these two existing editor fields would enlarge risk and create unrelated router churn.

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

The frontend calls this authority through `src/services/registry/admin/releaseDetailClient.ts`. Release archive uses the same exact soft-archive authority as Track through `archiveRegistryRelease(...)`; it does not call the draft-only hard-delete router path.

`admin_archive_registry_music_entity_v1(...)` is intentionally restricted to `track` and `release`, requires `manage_registry`, locks the exact target, compare-and-sets `updated_at`, changes only canonical status to `archived`, writes both audit surfaces, and contains no DELETE statement.

This is intentionally narrower than expanding `admin-router`: it does not add another generic CRUD surface and it preserves the two fields that the current generic router cannot save.

## Permanent source contract

`test/registry/mizizi-cultural-data-steward.test.ts` seals the source-level invariants:

- signed-in JWT Artist intake transport;
- JWT gateway enforcement configuration;
- no canonical Artist DML in the intake Edge function;
- frozen review fingerprint and separate apply-result pointer;
- deterministic idempotent replay before fresh collision discovery;
- active/draft-only reviewed/applied Artist target eligibility;
- governed Artist creation/evidence admission;
- no browser Track canonical update;
- no browser Release canonical update;
- soft archive rather than hard delete for Track and Release editors;
- preservation of Release date precision and label binding through the new exact authority.

These tests are source contracts, not substitutes for runtime acceptance.

## Disposable Preview acceptance

The first disposable Preview, `gate-a-final-preview` / `ltrjkigkdryfdqkdwygk`, was used for runtime database-authority and Edge-artifact acceptance. It exposed the two integrity defects documented above and proved the corrected authority behavior. Its candidate migrations had been recorded by the management path under generated remote migration versions, so that Preview was not accepted as canonical migration-ledger replay authority and was deleted after the mismatch was discovered.

A fresh disposable Preview, `gate-a-final-preview-clean` / `cxasrxyajuoxwsaevvfy` / branch `9b532573-a392-4ced-8f48-559a03e00737`, was then created from Production. No candidate migration was applied through the management API. Supabase CLI `2.107.0` replayed the five repository migration files directly, producing exact local/remote migration-version parity through `20260916120400`. The five committed replay-proof receipts, generated database types, and live-schema baseline are sealed to that clean Preview and accepted base `e69f78667c8b8451239f085a87309e54a53fd008`.

The Gate A-final migrations are:

1. `registry_artist_intake_authority_v1`;
2. `registry_release_detail_admin_authority_v1`;
3. `registry_track_release_archive_authority_v1`;
4. `registry_artist_intake_idempotent_replay_integrity_v1`;
5. `registry_artist_intake_target_status_integrity_v1`.

The candidate `artist-registry-intake` Edge function was deployed to Preview with `verify_jwt=true`.

Database acceptance used disposable Preview auth identities under `authenticated` role plus request JWT claim context. The `registry_editor` fixture resolved `manage_registry=true`; the `viewer` fixture resolved `false`.

Accepted runtime proofs:

- non-`manage_registry` Artist review rejected with SQLSTATE `42501`;
- manager review recorded a frozen review fingerprint;
- changing a reviewed source fact after approval caused snapshot rejection with SQLSTATE `40001`;
- first no-match materialization created exactly one deterministic Artist as `draft`, with independent verifier `passed`;
- exact retry returned the same operation ID with `created=false` and `idempotent_replay=true`;
- a `needs_review` Artist was rejected as a review target with SQLSTATE `22023` after target-status integrity convergence;
- reviewed CSV origin, provider profile, public image and bio evidence were admitted through the existing governed Artist authorities;
- the intake row retained its reviewed target separately from `applied_registry_artist_id`, and the run completed only after apply sealing;
- final Artist remained `draft` with the reviewed evidence applied and canonical write evidence emitted;
- Release detail mutation preserved `release_date_precision` and label binding and emitted audit/canonical write events;
- stale Release detail mutation rejected with SQLSTATE `40001`;
- viewer soft archive rejected with SQLSTATE `42501`;
- manager Track and Release soft archive changed status only to `archived` and emitted audit/canonical write evidence;
- stale Track archive rejected with SQLSTATE `40001`.

The management environment available for this gate does not expose an authenticated Edge-function invocation primitive and its shell environment cannot resolve external hosts. Therefore an end-to-end signed HTTP POST using manager/non-manager access tokens was not fabricated. The deployed Preview artifact and `verify_jwt=true` gateway setting are verified, while the caller/capability behavior was exercised at the database authority boundary with PostgREST-equivalent authenticated role/JWT claim context. Browser/HTTP smoke remains part of post-merge deployment acceptance.

## PR/CI gate still required

Before merge or Production promotion, the protected PR must prove:

1. focused Gate A-final source contract tests;
2. the consolidated MIZIZI Registry governance tests;
3. relevant TypeScript/lint checks;
4. `npm run build:app` or the repository's protected equivalent;
5. no unrelated diff or authority-surface regression.

## Production posture

Production remains unchanged at this stage.

No Gate A-final SQL has been applied to Production. No Gate A-final Edge function has been deployed to Production. No frontend deployment has been activated. The accepted sequence remains protected PR/CI/merge first, then Production SQL, Edge, frontend activation, and smoke/canary as separate controlled steps.
