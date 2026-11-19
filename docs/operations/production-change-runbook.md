# Production change, rollback, and incident runbook

## Before deployment

- Start from current `origin/main`.
- Require a clean worktree and a named branch.
- Confirm the exact migration, Edge Function, and frontend scope.
- Run `npm run test:critical`.
- Run `npm run schema:verify` for schema-affecting work.
- Record the rollback mechanism before applying production changes.

## Database deployment

- Apply only immutable files from `supabase/migrations`.
- Promote repository migrations only with `bash scripts/control-plane/promote-repository-migrations.sh` from exact merged `main`.
- Launch that script through the permanent `Repository Migration Production Promotion` workflow when CI-hosted promotion is required. The workflow is manual-dispatch only, serialized by one Production-promotion concurrency key, and requires both the exact protected-main SHA and the exact reviewed pending migration filenames.
- Maintain exactly one live promotion launcher for a reviewed pending set. An empty immediate workflow lookup is not evidence that a GitHub Actions run was not enqueued. Before creating any fallback trigger, reconcile repository-wide workflow runs for the same launcher/head and allow the enqueue state to settle.
- A second launcher for the same pending set is prohibited unless the first launcher is conclusively completed or cancelled and live Production state has been re-read. Never let two promotion runners race on the same migration set.
- That promotion path must show the intended repository migration filenames in the native `supabase db push --dry-run --linked` output before any write.
- Do not use connector `apply_migration` or any raw-SQL migration helper for a migration file that already exists in the repository. Those paths may generate a different migration version and create ledger drift.
- After promotion, require the production ledger versions to match the numeric prefixes of the repository filenames and require zero pending migrations.
- Never apply SQL from archived migration trees.
- Verify the intended grants, policies, functions, and public read contracts.
- Regenerate committed database types after the live migration.
- Run the relevant production verifier.

## Edge Function deployment

- Deploy only functions changed by the pull request.
- Confirm JWT and capability boundaries before service-role client creation.
- Verify CORS, request authentication, and non-destructive failure paths.
- Do not redeploy source-only helper modules.

## Frontend deployment

**Offline SEO snapshot gate:** The canonical `scripts/deploy/production-frontend.sh`
runner requires `WAKILISHA_ACCEPTED_PRERENDER_DIR` (an absolute local
directory outside the fresh `dist`) and
`WAKILISHA_ACCEPTED_PRERENDER_SHA256` (the 64-character digest of its
`wakilisha-accepted-prerender-index.json`). Its wrapper now runs the
repository's existing `restore-accepted-prerender.mjs --check` **before**
dependency installation, critical tests, compilation, SSH, staging or
activation. A missing, unsealed or tampered snapshot must stop immediately.

These environment variables do **not** confer publication authority: source
files must originate in the currently deployed and previously accepted
Lightsail public frontend, be copied read-only to a separate local directory,
and have their governed publication freshness independently accepted.
See `docs/engineering/incident-20261113-public-read-load-containment.md`
and `docs/engineering/seo-governed-publication-receipts-v1.md`. Never create
a seal for arbitrary local `dist`, skip the accepted SEO rebuild with
`build:app`, or treat a passing checksum as proof that no article, Artist,
Track or Chart publication changed. If acceptance evidence is absent, keep
the live frontend in place. Once the snapshot is approved, use the **same
canonical frontend runner**, with both inputs exported, and preserve its
rollback and staged/live parity gates.

- Deploy only when frontend output changed.
- Run the complete production application build from exact merged `main`.
- Run targeted route tests and build-time SEO/route canaries before upload.
- Record index, entry-asset, and complete staged-artifact identity before activation.
- Require exact staged/live byte parity before public acceptance.
- Smoke-test direct origin and public HTTPS routes after activation.
- If the direct origin HTTP vhost redirects to HTTPS, asset-body hash checks must follow the redirect. Record the redirect separately if useful, but never compare the hash of a 301 response body to the expected asset hash.
- Record the deployed commit and rollback snapshot.

### Stopped deployment rule

A stopped deployment is a state to diagnose, not a reason to restart the entire mutating script.

If a runner stops after any upload, stage, activation, migration, Edge deployment, or other mutation:

1. identify the last completed mutation
2. inspect the actual live state
3. preserve the rollback artifact and logs
4. do not rerun already-completed mutations merely to reach later acceptance checks
5. resume with the narrowest possible read-only or surgical gate
6. correct the runner itself when the failure was in acceptance logic rather than runtime state

This rule is especially important when exact live hashes already prove that the intended artifact is active.

## Rollback

- Stop additional writes through the affected path.
- Prefer a forward corrective migration for database changes.
- Redeploy the previous known-good Edge Function bundle when runtime code is responsible.
- Restore the previous frontend build when public delivery is responsible.
- Never delete production evidence required to diagnose the incident.

## 21 October 2026 public origin outage and recovery

The 2026-10-21 06:58 UTC unattended Ubuntu upgrade restarted Nginx and
systemd-resolved together. Nginx could not resolve the static Supabase
hostname during its startup validation and remained stopped. Cloudflare
returned HTTP 521 for all public pages while Supabase remained healthy.
On 2026-10-22, restoring Nginx returned origin and public HTTPS to 200.

Prevent recurrence by using a variable-based upstream and a location-local
resolver for `/api/public/v1/search`, retaining the exact rewrite URI,
query arguments, anonymous credential stripping, TLS SNI, and ETag contract.
The bounded recovery drop-in is tracked at
`ops/systemd/20-wakilisha-recovery.conf` and installed on the origin at
`/etc/systemd/system/nginx.service.d/20-wakilisha-recovery.conf`.
`Restart=on-failure` handles unexpected process failure but does not
replace the DNS-safe configuration during a package-initiated restart.
Do not disable unattended security upgrades. Back up the live snippet,
validate any candidate configuration before reload, and verify local
origin, public HTTPS, and the search API before closing this incident.

## Incident response

1. Record the UTC start time, affected surface, request or correlation IDs, and observed impact.
2. Contain the failing write or deployment path.
3. Preserve logs, audit rows, failed jobs, and relevant payload metadata.
4. Decide between forward repair, runtime rollback, or traffic isolation.
5. Verify data integrity and public read health.
6. Record root cause, corrective action, and prevention control.
7. Do not resume normal deployment until the critical control-plane checks pass.
