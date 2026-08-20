import {
  describe,
  expect,
  it,
} from "vitest";
import {
  analyzeMigrationText,
  validateReplayProof,
} from "../../scripts/control-plane/verify-migration-replay-contract.mjs";
import {
  validatePendingSchemaState,
  validateRepositorySchemaSnapshot,
} from "../../scripts/control-plane/verify-repository-schema-snapshot.mjs";

describe(
  "migration replay contract",
  () => {
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
      "rejects a replay proof whose candidate bytes or base changed",
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
      "rejects replay proofs that omit the candidate schema snapshot",
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
  },
);
