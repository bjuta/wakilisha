import { describe, expect, it } from "vitest";
import {
  analyzeMigrationText,
  validateReplayProof,
} from "../../scripts/control-plane/verify-migration-replay-contract.mjs";

describe("migration replay contract", () => {
  it("allows ordinary replay-safe schema authority", () => {
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
  });

  it("would have blocked the August 19 Article replay trap", () => {
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
  });

  it("would have blocked the August 19 Organization backfill trap", () => {
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
  });

  it("rejects a replay proof whose candidate bytes or base changed", () => {
    const proof = {
      migration_file: "supabase/migrations/20260820105540_audio.sql",
      migration_sha256: "a".repeat(64),
      base_main_sha: "b".repeat(40),
      preview_project_ref: "abcdefghijklmnopqrst",
      preview_branch_id: "11111111-1111-1111-1111-111111111111",
      preview_migration_head: "20260820105540",
      baseline_replay: "pass",
      candidate_apply: "pass",
      verifier: "pass",
      verifier_file: "package.json",
      verified_at: "2026-08-20T11:00:00.000Z",
    };

    expect(
      validateReplayProof({
        proof,
        migrationFile: proof.migration_file,
        migrationSha256: "c".repeat(64),
        baseMainSha: "d".repeat(40),
      }),
    ).toEqual(
      expect.arrayContaining([
        "migration_sha256 does not match the candidate bytes",
        `base_main_sha must equal merge base ${"d".repeat(40)}`,
      ]),
    );
  });
});
