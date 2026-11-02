# RNB18 Stage 1 Forward Replay Repair: Acceptance and Release Hold

**Status:** Canonical migration implemented and targeted PostgreSQL-tested. Repository-wide migration replay and Production rollout remain blocked.  
**Workstream:** #1326 historical Kenya R&B retirement replay compatibility, tracked separately from WK100 #1264.  
**Branch / PR:** `fix/wk100-rnb18-replay-stage1-20261101` / draft #1335.

## Canonical Supabase CLI authority

Official CLI **2.107.0** generated this exact forward filename from the unlinked GitHub Actions runner:

`supabase/migrations/20261101210335_rnb18_stage1_archive_replay_authority_v1.sql`

[CLI-mint log, run 41349990017](https://github.com/bjuta/wakilisha/actions/runs/41349990017): `WK_RNB18_CLI_MINTED_PATH` and `WK_RNB18_CLI_21070_OFFLINE_MINT=PASS`. That workflow's independent Docker step subsequently failed; this does not undo the successful CLI mint. No hand-generated migration timestamp.

Executable `BEGIN;` through `COMMIT;` SQL is byte-identical to reconstructed Stage 1 v4 candidate, SHA-256 `37d7eb5483ad883209ef9a10d5b3df48357de04c65c17ddaef81975b1ca7e6a5`; only its introductory comments differ. The existing `20261030062819_retire_18_kenya_rnb_editions.sql` is not edited.

## Accepted actual PostgreSQL gates

[Exact candidate and canonical body on disposable PostgreSQL 17, run 41350317407](https://github.com/bjuta/wakilisha/actions/runs/41350317407): SUCCESS. Explicit log receipts:

- `WK_RNB18_CANONICAL_CLI_MINT_AND_IDENTICAL_SQL=PASS`
- `RNB18_STAGE1_FRESH_AUTHORITY_CREATED_EMPTY`
- `RNB18_FRESH_POSTGRES_DDL=PASS`
- `RNB18_FRESH_EMPTY_AND_ROLE_DENIAL=PASS`
- `RNB18_UPDATE_DELETE_TRUNCATE_DENIAL=PASS`
- `RNB18_PROBE_ROLLBACK_EMPTY=PASS`
- `RNB18_STAGE1_FRESH_POSTGRES_ACCEPTANCE=PASS`

A PostgreSQL Docker-bootstrap readiness race caused two intermediate harness failures, isolated with `bash -x` and corrected by waiting for the final `postgres` PID 1. The SQL was never weakened or modified. This test used a **minimal, source-equivalent** baseline, not the complete historical migration chain. It is not hosted Preview proof.

The identical Stage 1 SQL also passed direct **read-only Production assertions** under `BEGIN READ ONLY; ... ROLLBACK;` and returned `RNB18_V4_EXISTING_PRODUCTION_ASSERTIONS_READ_ONLY_PASS`. This asserted the sealed 2,904-row existing archive, historical `retired` status, column/constraint/owner/ACL/RLS definitions, and four immutability triggers. No Production transaction committed.

## Intended behavior and exact scope

A clean empty database *after the old historical deletion migration is formally retired from its active chain* receives two empty private archive tables, exact restricted ACL/RLS, immutable function and triggers, and the `retired` ingest-run status. No historical Editions or Entries are manufactured. Existing Production has 236 migrations ending at `20261030095808_wk100_governed_publisher_v1` and a sealed 2,904-row retirement archive. There, the candidate asserts existing authority rather than writing historical data.

## Release hold and next steps

1. Required repository-wide CI, review, and exact final-head checks remain open. Current active migration chain still contains historical data-dependent `20261030062819` and cannot yet be called clean zero-data replay.
2. **Stage 1:** Merge only after protected approval. Promote exactly the CLI-minted forward version separately via canonical pinned deployment procedure, verify the precise pending set and independently re-check the Production archive and migration history.
3. **Stage 2 (separate):** Preserve the original retirement SQL byte-for-byte under governed retired-history documentation, remove only its active file, reconcile only its exact Production migration ledger version via approved native `supabase migration repair --status reverted`, then prove a newly-created hosted zero-data Preview replay of the full remaining migration chain. Do not fabricate historical Edition fixtures or rewrite applied SQL.
4. PR #1333 stays draft. This Stage 1 repair does not admit source receipts, enable scoring, publish an Edition, or complete WK100 launch.

No Production migration, history repair, remote Storage/Edge/frontend deployment, billable hosted Preview creation, or merge happened in these checks.

## CI consolidation

The one-time candidate SQL duplicate, disposable Docker runner, and temporary CI workflow were removed from this PR's final tree after acceptance. Git history and workflow logs remain the immutable execution receipt. No new permanent CI job or historical test duplication is warranted.
