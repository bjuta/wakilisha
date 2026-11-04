import {
  readFileSync, readdirSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";
import {
  analyzeMigrationText,
  validateReplayProof,
  validateRetiredMigrationReceipt,
} from "../../scripts/control-plane/verify-migration-replay-contract.mjs";
import {
  validateHistoricalCleanReplayProof,
} from "../../scripts/control-plane/verify-historical-migration-clean-replay.mjs";
import {
  validateRnb18StagedFields,
  RNB18_STAGED_MODE,
  RNB18_STAGE1,
  RNB18_BASE,
} from "../../scripts/control-plane/verify-rnb18-staged-retirement.mjs";
import {
  validatePendingSchemaState,
  validateRepositorySchemaSnapshot,
} from "../../scripts/control-plane/verify-repository-schema-snapshot.mjs";
import {
  isDisposableCiReplayProof,
  validateDisposableCiReplayProof,
} from "../../scripts/control-plane/verify-disposable-ci-replay-proof.mjs";

describe(
  "migration replay contract",
  () => {
    it("requires a real unlinked CI replay and independent Auth/Storage/cleanup markers", () => {
      const proof=JSON.parse(readFileSync(
        "docs/engineering/replay-proofs/20261104084956_wk100_spotify_offered_export_method_admission.sql.json",
        "utf8"
      ));
      expect(isDisposableCiReplayProof(proof)).toBe(true);
      const args={proof,migrationFile:proof.migration_file,
        migrationSha256:proof.migration_sha256,baseMainSha:proof.base_main_sha};
      expect(validateDisposableCiReplayProof(args)).toEqual([]);
      expect(validateDisposableCiReplayProof({
        ...args,proof:{...proof,workflow_conclusion:"failure"},
      })).toContain("disposable CI requires successful pull-request workflow evidence");
      expect(validateDisposableCiReplayProof({
        ...args,proof:{...proof,ci_markers:proof.ci_markers.slice(0,-1)},
      })).toContain("disposable CI missing ordered independent replay/auth/storage/cleanup markers");
      expect(validateDisposableCiReplayProof({
        ...args,proof:{...proof,hosted_preview_used:true},
      })).toContain("disposable CI must be unlinked, not hosted or Production");
      expect(validateDisposableCiReplayProof({
        ...args,migrationSha256:"0".repeat(64),
      })).toContain("disposable CI migration digest mismatch");
    });
    it("permits a correctly bound unlinked schema seal, not an unverified local claim", () => {
      const baseline=JSON.parse(readFileSync(
        "docs/engineering/live-schema-baseline.json","utf8"
      ));
      const args={baseline,actualTypesSha256:baseline.typesSha256,
        expectedProjectRef:"pgzizndxdyhqmtyywjmt",
        migrationCount:readdirSync("supabase/migrations").filter(name=>name.endsWith(".sql")).length,
        latestMigration:readdirSync("supabase/migrations").filter(name=>name.endsWith(".sql")).sort().at(-1)!};
      expect(validateRepositorySchemaSnapshot(args)).toEqual([]);
      expect(validateRepositorySchemaSnapshot({
        ...args,baseline:{...baseline,schemaSeal:{...baseline.schemaSeal,workflowRunId:null}},
      })).toContain("disposable_ci schema seal needs unlinked-local-ci and exact replay commit/run authority");
      expect(validatePendingSchemaState({pendingCount:1,sealMode:"disposable_ci"})).toEqual([]);
    });
    it(
      "allows ordinary replay-safe schema authority",
      () => {
        expect(
          analyzeMigrationText(`
            begin;
            create table if not exists audio.shows (
              id uuid primary key,
              title text not null
            );
            commit;
          `),
        ).toEqual([]);
      },
    );

    it(
      "would have blocked the August 19 Article replay trap",
      () => {
        expect(
          analyzeMigrationText(`
            raise exception
              'STOP: pgcrypto is required for the locked Article manifest digest';
            raise exception
              'STOP: reviewed Beautah Person Follow boundary changed';
          `),
        ).toEqual(
          expect.arrayContaining([
            "reviewed production boundary",
            "manifest digest lock",
          ]),
        );
      },
    );

    it(
      "does not misclassify ordinary reviewed runtime boundary prose as production reconciliation",
      () => {
        expect(
          analyzeMigrationText(`
            raise exception
              'Duplicate finalization found a current-pointer surface outside the reviewed Community-thread boundary.';
          `),
        ).toEqual([]);

        expect(
          analyzeMigrationText(`
            raise exception
              'STOP: reviewed Production boundary is exactly 8 Release identities';
          `),
        ).toContain(
          "reviewed production boundary",
        );
      },
    );

    it(
      "does not classify reviewed source-method documentation as a production replay lock",
      () => {
        expect(
          analyzeMigrationText(`
            comment on table platform_private.wk100_source_method_decisions_v1 is
              'Immutable independently reviewed source-method decisions. A decision is not a collector manifest.';
          `),
        ).toEqual([]);

        expect(
          analyzeMigrationText(`
            raise exception 'STOP: reviewed Production manifest revision mismatched';
          `),
        ).toContain(
          "reviewed production boundary",
        );
      },
    );

    it(
      "would have blocked the August 19 Organization backfill trap",
      () => {
        expect(
          analyzeMigrationText(`
            do $lock_and_backfill_staff_articles$
            begin
              -- production-only institutional Article attribution reconciliation
              null;
            end;
            $lock_and_backfill_staff_articles$;
          `),
        ).toEqual(
          expect.arrayContaining([
            "production-only reconciliation",
            "lock-and-backfill block",
          ]),
        );
      },
    );

    it(
      "does not grant clean baseline replay from a linked migration ledger alone",
      () => {
        const recorder = readFileSync(
          "scripts/control-plane/record-migration-replay-proof.mjs",
          "utf8",
        );
        expect(recorder).toMatch(
          /baseline_replay:\s*"pending"/,
        );
        expect(recorder).not.toMatch(
          /baseline_replay:\s*"pass"/,
        );
      },
    );

    it(
      "rejects a preview replay proof whose candidate bytes or base changed",
      () => {
        const proof = {
          migration_file:
            "supabase/migrations/20260820105540_audio.sql",
          migration_sha256:
            "a".repeat(64),
          base_main_sha:
            "b".repeat(40),
          preview_project_ref:
            "abcdefghijklmnopqrst",
          preview_branch_id:
            "11111111-1111-1111-1111-111111111111",
          preview_migration_head:
            "20260820105540",
          baseline_replay:
            "pass",
          candidate_apply:
            "pass",
          verifier:
            "pass",
          verifier_file:
            "package.json",
          schema_types_sha256:
            "e".repeat(64),
          schema_migration_count:
            31,
          schema_migration_head:
            "20260820105540",
          verified_at:
            "2026-08-20T11:00:00.000Z",
        };

        expect(
          validateReplayProof({
            proof,
            migrationFile:
              proof.migration_file,
            migrationSha256:
              "c".repeat(64),
            baseMainSha:
              "d".repeat(40),
          }),
        ).toEqual(
          expect.arrayContaining([
            "migration_sha256 does not match the candidate bytes",
            `base_main_sha must equal merge base ${"d".repeat(40)}`,
          ]),
        );
      },
    );

    it(
      "rejects preview replay proofs that omit the candidate schema snapshot",
      () => {
        const proof = {
          migration_file:
            "supabase/migrations/20260820105540_audio.sql",
          migration_sha256:
            "a".repeat(64),
          base_main_sha:
            "b".repeat(40),
          preview_project_ref:
            "abcdefghijklmnopqrst",
          preview_branch_id:
            "11111111-1111-1111-1111-111111111111",
          preview_migration_head:
            "20260820105540",
          baseline_replay:
            "pass",
          candidate_apply:
            "pass",
          verifier:
            "pass",
          verifier_file:
            "package.json",
          verified_at:
            "2026-08-20T11:00:00.000Z",
        };

        expect(
          validateReplayProof({
            proof,
            migrationFile:
              proof.migration_file,
            migrationSha256:
              proof.migration_sha256,
            baseMainSha:
              proof.base_main_sha,
          }),
        ).toEqual(
          expect.arrayContaining([
            "schema_types_sha256 must be a SHA-256 digest",
            "schema_migration_count must be a positive integer",
            "schema_migration_head must be a 14-digit migration version",
          ]),
        );
      },
    );

    it(
      "accepts a schema-neutral historical clean-replay receipt without pretending it was a Preview apply",
      () => {
        const proof = {
          proof_mode:
            "historical_clean_replay",
          migration_file:
            "supabase/migrations/20260905090000_acl.sql",
          migration_git_blob_sha:
            "a".repeat(40),
          base_main_sha:
            "b".repeat(40),
          candidate_migration_version:
            "20260905090000",
          baseline_replay:
            "pass",
          candidate_apply:
            "pass",
          verifier:
            "pass",
          verifier_file:
            "package.json",
          schema_types_sha256:
            "c".repeat(64),
          schema_migration_count:
            123,
          schema_migration_head:
            "20260914193300",
          replay_candidate_head_sha:
            "d".repeat(40),
          replay_environment:
            "supabase-local",
          supabase_cli_version:
            "2.107.0",
          replay_marker:
            "WK_NATIVE_PREVIEW_ACL_CLEAN_REPLAY_PASS",
          predecessor_migration_count:
            89,
          predecessor_blob_manifest_sha256:
            "e".repeat(64),
          verified_at:
            "2026-09-15T07:49:32.000Z",
        };

        expect(
          validateHistoricalCleanReplayProof({
            proof,
            migrationFile:
              proof.migration_file,
            baseMainSha:
              proof.base_main_sha,
          }),
        ).toEqual([]);
      },
    );

    it(
      "keeps historical clean replay receipts tightly bound to local replay evidence",
      () => {
        const proof = {
          proof_mode:
            "historical_clean_replay",
          migration_file:
            "supabase/migrations/20260905090000_acl.sql",
          migration_git_blob_sha:
            "a".repeat(40),
          base_main_sha:
            "b".repeat(40),
          candidate_migration_version:
            "20260905090000",
          baseline_replay:
            "pass",
          candidate_apply:
            "pass",
          verifier:
            "pass",
          verifier_file:
            "package.json",
          schema_types_sha256:
            "c".repeat(64),
          schema_migration_count:
            123,
          schema_migration_head:
            "20260914193300",
          replay_candidate_head_sha:
            "d".repeat(40),
          replay_environment:
            "preview",
          supabase_cli_version:
            "not-a-version",
          replay_marker:
            "pass",
          predecessor_migration_count:
            0,
          predecessor_blob_manifest_sha256:
            "bad",
          verified_at:
            "2026-09-15T07:49:32.000Z",
        };

        expect(
          validateHistoricalCleanReplayProof({
            proof,
            migrationFile:
              proof.migration_file,
            baseMainSha:
              proof.base_main_sha,
          }),
        ).toEqual(
          expect.arrayContaining([
            "replay_environment must be supabase-local",
            "supabase_cli_version must be semantic",
            "replay_marker must be canonical",
            "predecessor_migration_count must be a positive integer",
            "predecessor_blob_manifest_sha256 must be a SHA-256 digest",
          ]),
        );
      },
    );

    it(
      "would have blocked the Phase 6A M1 missing generated-types snapshot before merge",
      () => {
        const baseline = {
          projectRef:
            "pgzizndxdyhqmtyywjmt",
          schema:
            "public,editorial",
          generatedAt:
            "2026-08-20T12:00:00Z",
          typesSha256:
            "a".repeat(64),
          authoritativeMigrationDirectory:
            "supabase/migrations",
          migrationCount:
            30,
          latestMigration:
            "20260820105540_phase_6a_m1_audio_identity_working_versions.sql",
          schemaSeal: {
            mode:
              "preview",
            sourceProjectRef:
              "abcdefghijklmnopqrst",
            migrationHead:
              "20260820105540",
            baseMainSha:
              "b".repeat(40),
            previewBranchId:
              "11111111-1111-1111-1111-111111111111",
          },
        };

        expect(
          validateRepositorySchemaSnapshot({
            baseline,
            actualTypesSha256:
              "c".repeat(64),
            expectedProjectRef:
              "pgzizndxdyhqmtyywjmt",
            migrationCount:
              30,
            latestMigration:
              baseline.latestMigration,
          }),
        ).toContain(
          "typesSha256 does not match src/types/database.types.ts",
        );
      },
    );

    it(
      "requires preview-sealed repository types while production has pending migrations",
      () => {
        expect(
          validatePendingSchemaState({
            pendingCount:
              1,
            sealMode:
              "production",
          }),
        ).toContain(
          "pending repository migrations require a preview-sealed schema snapshot",
        );

        expect(
          validatePendingSchemaState({
            pendingCount:
              1,
            sealMode:
              "preview",
          }),
        ).toEqual([]);
      },
    );

    it(
      "keeps heavyweight CI off draft PR runners and requires ready-to-review validation",
      () => {
        const critical = readFileSync(
          "ops/local/workflows/critical-control-plane.yml",
          "utf8",
        );
        const wk100 = readFileSync(
          "ops/local/workflows/wk100-disposable-security.yml",
          "utf8",
        );
        const mizizi = readFileSync(
          "ops/local/workflows/mizizi-slice1-disposable-postgres.yml",
          "utf8",
        );

        for (const workflow of [critical, wk100, mizizi]) {
          expect(workflow).toContain(
            "types: [opened, reopened, synchronize, converted_to_draft, ready_for_review]",
          );
          expect(workflow).toContain(
            "github.event.pull_request.draft == false",
          );
        }

        const nonDraftOrMain =
          "if: ${{ github.event_name != 'pull_request' || github.event.pull_request.draft == false }}";
        expect(critical.split(nonDraftOrMain)).toHaveLength(3);
        expect(critical).toContain(
          "if: ${{ always() && (github.event_name != 'pull_request' || github.event.pull_request.draft == false) }}",
        );
        expect(critical).toContain("  push:\n    branches:\n      - main");
        expect(critical).toContain(
          'test "$CORE_RESULT" = "success"',
        );
        expect(critical).toContain(
          'test "$BROWSER_RESULT" = "success"',
        );
        expect(wk100).toContain(
          "if: ${{ github.event.pull_request.draft == false }}",
        );
        expect(mizizi).toContain(
          "if: ${{ github.event.pull_request.draft == false }}",
        );
        expect(wk100.split(
          "if: ${{ github.event.pull_request.draft == false }}",
        )).toHaveLength(2);
        expect(mizizi.split(
          "if: ${{ github.event.pull_request.draft == false }}",
        )).toHaveLength(3);
        expect(mizizi).toContain(
          "  disposable-operator-jwt:\n    name: disposable-operator-jwt\n    if: ${{ github.event.pull_request.draft == false }}",
        );
      },
    );

    it(
      "keeps Production migration promotion single-dispatch, serialized, and exact-main bound",
      () => {
        const workflow =
          readFileSync(
            "ops/local/workflows/repository-migration-production-promotion.yml",
            "utf8",
          );

        expect(
          workflow,
        ).toContain(
          "workflow_dispatch:",
        );
        expect(
          workflow,
        ).not.toContain(
          "pull_request:",
        );
        expect(
          workflow,
        ).not.toMatch(
          /^\s*push:\s*$/m,
        );
        expect(
          workflow,
        ).toContain(
          "group: repository-migration-production-promotion",
        );
        expect(
          workflow,
        ).toContain(
          "cancel-in-progress: false",
        );
        expect(
          workflow,
        ).toContain(
          "expected_main_sha:",
        );
        expect(
          workflow,
        ).toContain(
          "expected_pending:",
        );
        expect(
          workflow,
        ).toContain(
          "if: github.ref == 'refs/heads/main'",
        );
        expect(
          workflow,
        ).toContain(
          'test "$(git rev-parse HEAD)" = "$EXPECTED_MAIN_SHA"',
        );
        expect(
          workflow,
        ).toContain(
          'test "$GITHUB_SHA" = "$EXPECTED_MAIN_SHA"',
        );
        expect(
          workflow,
        ).toContain(
          "REPOSITORY_MIGRATION_EXACT_PENDING_SET=PASS",
        );
        expect(
          workflow,
        ).toContain(
          "bash scripts/control-plane/promote-repository-migrations.sh",
        );
        expect(
          workflow,
        ).toContain(
          "REPOSITORY_MIGRATION_PRODUCTION_PROMOTION=PASS",
        );
        expect(
          workflow,
        ).not.toContain(
          "apply_migration",
        );
      },
    );

    it(
      "rejects a retired active-migration receipt whose bytes differ from the deleted migration",
      () => {
        expect(
          validateRetiredMigrationReceipt({
            originalText:
              "begin;\nselect 1;\ncommit;\n",
            retiredText:
              "begin;\nselect 2;\ncommit;\n",
            retiredPath:
              "docs/engineering/replay-baseline/retired-active-migrations/example.sql",
          }),
        ).toEqual([
          "docs/engineering/replay-baseline/retired-active-migrations/example.sql: retired receipt bytes do not match deleted active migration",
        ]);

        expect(
          validateRetiredMigrationReceipt({
            originalText:
              "begin;\nselect 1;\ncommit;\n",
            retiredText:
              "begin;\nselect 1;\ncommit;\n",
            retiredPath:
              "docs/engineering/replay-baseline/retired-active-migrations/example.sql",
          }),
        ).toEqual([]);
      },
    );

    it("restricts RNB18 staged replay to its exact 237-to-236 version identity", () => {
      const proof = {
        proof_mode:RNB18_STAGED_MODE,
        migration_file:"supabase/migrations/"+RNB18_STAGE1,
        migration_sha256:"705c19ddd540705942900ce0ca47da1a6b65fb548a30e553a7eac05dd73bdb9c",
        base_main_sha:RNB18_BASE,
        stage1_migration_count:237,
        stage1_migration_head:"20261101210335",
        original_historical_migration_file:"supabase/migrations/20261030062819_retire_18_kenya_rnb_editions.sql",
        original_historical_git_blob_sha:"b3c2b412ea8bb594d22f61858fb40c5c4a6553f5",
        paired_replay_commit_sha:"905455ba985b25814a6ad45b9b92229510a2abe4",
        paired_replay_proof_blob_sha:"95a897fa628cf5ca702fcbcc03ddf4bceb9f04c3",
        paired_replay_migration_count:236,
        paired_replay_migration_head:"20261101210335",
        paired_preview_project_ref:"uummbxewahdozsjkubez",
        paired_preview_branch_id:"c00bfe1e-fcc8-4a10-86b3-c2af1d249776",
        schema_types_sha256:"eed74587624364062f6d4cee1d2b0a16d530aa86865d2493476994061e8a9cf6",
        verifier_file:"scripts/control-plane/verify-rnb18-stage1-replay-authority.sql",
        stage1_clean_replay:"not_claimed",
        paired_stage2_hosted_replay:"pass",
        verified_at:"2026-11-01T22:21:19.798Z"
      };
      const args={proof,migrationFile:proof.migration_file,
        migrationSha256:proof.migration_sha256,baseMainSha:RNB18_BASE};
      expect(validateRnb18StagedFields(args)).toEqual([]);
      expect(validateRnb18StagedFields({...args,proof:{...proof,baseline_replay:"pass"}}))
        .toContain("Stage 1 must not claim a 237-file clean replay");
      expect(validateRnb18StagedFields({...args,proof:{...proof,paired_replay_migration_count:237}}))
        .toContain("paired_replay_migration_count must equal the sealed RNB18 stage authority");
      expect(validateRnb18StagedFields({...args,proof:{...proof,original_historical_git_blob_sha:"0".repeat(40)}}))
        .toContain("original_historical_git_blob_sha must equal the sealed RNB18 stage authority");
    });
    it("rejects changed RNB18 staged schema seal or unrelated migration use", () => {
      const base = {
        projectRef:"pgzizndxdyhqmtyywjmt",schema:"public,editorial",
        generatedAt:"2026-11-01T22:21:19Z",
        typesSha256:"eed74587624364062f6d4cee1d2b0a16d530aa86865d2493476994061e8a9cf6",
        authoritativeMigrationDirectory:"supabase/migrations",
        migrationCount:237,latestMigration:RNB18_STAGE1,
        schemaSeal:{
          mode:RNB18_STAGED_MODE,sourceProjectRef:"uummbxewahdozsjkubez",
          migrationHead:"20261101210335",baseMainSha:RNB18_BASE,
          previewBranchId:"c00bfe1e-fcc8-4a10-86b3-c2af1d249776",
          pairedReplayCommitSha:"905455ba985b25814a6ad45b9b92229510a2abe4",
          pairedReplayMigrationCount:236,retiredHistoricalVersion:"20261030062819"
        }
      };
      const args={baseline:base,actualTypesSha256:base.typesSha256,
        expectedProjectRef:base.projectRef,migrationCount:237,latestMigration:RNB18_STAGE1};
      expect(validateRepositorySchemaSnapshot(args)).toEqual([]);
      const error="RNB18 two-stage seal must disclose the exact 236-file paired Preview for the 237-file stage";
      expect(validateRepositorySchemaSnapshot({...args,latestMigration:"20261101210336_unrelated.sql"})).toContain(error);
      expect(validateRepositorySchemaSnapshot({...args,baseline:{...base,schemaSeal:{...base.schemaSeal,pairedReplayMigrationCount:237}}})).toContain(error);
      expect(validatePendingSchemaState({pendingCount:1,sealMode:RNB18_STAGED_MODE})).toEqual([]);
    });

  },
);
