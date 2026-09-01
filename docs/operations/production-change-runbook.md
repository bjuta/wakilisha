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

## Incident response

1. Record the UTC start time, affected surface, request or correlation IDs, and observed impact.
2. Contain the failing write or deployment path.
3. Preserve logs, audit rows, failed jobs, and relevant payload metadata.
4. Decide between forward repair, runtime rollback, or traffic isolation.
5. Verify data integrity and public read health.
6. Record root cause, corrective action, and prevention control.
7. Do not resume normal deployment until the critical control-plane checks pass.
