import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationDir = path.resolve("supabase/migrations");
const matches = fs.readdirSync(migrationDir).filter((name) =>
  name.endsWith(
    "_phase_7a_k4c_a3_audio_pointer_compatibility_retirement.sql",
  ),
);

expect(matches).toHaveLength(1);

const migration = fs.readFileSync(path.join(migrationDir, matches[0]), "utf8");
const verifier = fs.readFileSync(
  path.resolve(
    "scripts/control-plane/verify-phase-7a-k4c-a3-audio-pointer-compatibility-retirement.sql",
  ),
  "utf8",
);
const audit = fs.readFileSync(
  path.resolve(
    "docs/engineering/phase-7a-k4c-a3-audio-pointer-compatibility-retirement-implementation-audit.md",
  ),
  "utf8",
);

const pointerColumns = [
  "current_working_version_id",
  "current_submitted_version_id",
  "current_approved_version_id",
  "current_published_version_id",
];

const pointerConstraints = [
  "audio_publication_resources_working_version_fkey",
  "audio_publication_resources_submitted_version_fkey",
  "audio_publication_resources_approved_version_fkey",
  "audio_publication_resources_published_version_fkey",
];

const acceptedA2DefinitionMd5s = [
  "54fd407decbc70816bb174589e7411fb",
  "a0c3b0c9ef0f77b87389250bbf971a4b",
  "ecb29761c632e3da1ba823e3f2cd516c",
  "4c4afedcf8320a02337128c325e53c0d",
  "1688adaa942a4075cd37603c9d96fd2e",
  "c3777c4bffb0b4cb738ca9e2fcd333ef",
  "b17e6ea50a73dd4aa654c41f5d722e17",
  "287d39ea790c900ce0637018804f2a52",
  "29c6262375c537571611a01ae02ad03c",
  "5f84c8ace1bacd2ca3586adbbc7e4a1b",
];

const collectSourceFiles = (dir: string): string[] => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(absolute));
      continue;
    }

    if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      continue;
    }

    if (
      path.normalize(absolute) ===
      path.normalize(path.resolve("src/types/database.types.ts"))
    ) {
      continue;
    }

    files.push(absolute);
  }

  return files;
};

describe("Phase 7A K4C-A3 Audio pointer compatibility retirement", () => {
  it("pins exact A2 authority before retiring compatibility", () => {
    for (const md5 of acceptedA2DefinitionMd5s) {
      expect(migration).toContain(md5);
      expect(verifier).toContain(md5);
    }

    expect(migration).toContain(
      "accepted A2 Audio business definition drift exists",
    );
    expect(verifier).toContain(
      "A2 Audio business/RPC body or owner drifted",
    );
  });

  it("proves Audio is the last compatibility consumer before dropping shared helpers", () => {
    expect(migration).toContain(
      "expected exactly one typed-to-Resource trigger dependency",
    );
    expect(migration).toContain(
      "typed-to-Resource helper has a non-trigger consumer",
    );
    expect(migration).toContain(
      "expected exactly one Resource-to-typed trigger dependency",
    );
    expect(migration).toContain(
      "Resource-to-typed helper has a non-trigger consumer",
    );
    expect(migration).toContain(
      "1a9a366b7a26d023aa589767a2024651",
    );
    expect(migration).toContain(
      "619a2bd22f9066594f84dada7a119902",
    );
  });

  it("retires exactly the two K1 compatibility triggers and two helpers", () => {
    expect(migration).toContain(
      "drop trigger\n  audio_publication_resources_sync_shared_lifecycle",
    );
    expect(migration).toContain(
      "drop trigger\n  resources_sync_typed_lifecycle_compatibility",
    );
    expect(migration).toContain(
      "drop function editorial.sync_resource_lifecycle_from_typed_binding();",
    );
    expect(migration).toContain(
      "drop function editorial.sync_typed_lifecycle_from_resource();",
    );

    expect(
      migration.match(/^\s*drop trigger\b/gim),
    ).toHaveLength(2);
    expect(
      migration.match(/^\s*drop function\b/gim),
    ).toHaveLength(2);
  });

  it("drops exactly four typed pointer FKs and four pointer columns without dependent-object removal", () => {
    for (const constraint of pointerConstraints) {
      expect(migration).toContain(`drop constraint ${constraint}`);
    }

    for (const column of pointerColumns) {
      expect(migration).toContain(`drop column ${column}`);
    }

    expect(migration.toLowerCase()).not.toContain("cascade");
    expect(
      migration.match(/drop constraint audio_publication_resources_/g),
    ).toHaveLength(4);
    expect(
      migration.match(/drop column current_/g),
    ).toHaveLength(4);
  });

  it("does not rewrite business functions or alter grants", () => {
    expect(migration).not.toMatch(/^\s*(grant|revoke)\b/im);
    expect(migration).not.toMatch(
      /^\s*create\s+(or\s+replace\s+)?function\b/im,
    );
    expect(migration).not.toContain("execute v_definition;");
    expect(migration).toContain(
      "changed an Audio business/helper function outside compatibility retirement",
    );
    expect(migration).toContain(
      "mutated non-pointer Audio binding data",
    );
    expect(migration).toContain(
      "mutated canonical Audio Resource rows",
    );
  });

  it("ratchets A1, A2, Playlist P3 and Video boundaries", () => {
    expect(migration).toContain(
      "expected only the K1 Resource-to-typed compatibility writer",
    );
    expect(migration).toContain(
      "live business function(s) still read typed Audio pointers",
    );
    expect(migration).toContain(
      "A1 typed Audio event-writer retirement regressed",
    );
    expect(migration).toContain(
      "Playlist P3 pointer retirement regressed",
    );
    expect(migration).toContain(
      "typed Video event authority exists",
    );

    expect(verifier).toContain(
      "direct Audio typed pointer reader remains",
    );
    expect(verifier).toContain(
      "typed Audio pointer writer remains",
    );
    expect(verifier).toContain(
      "Playlist P3 pointer retirement regressed",
    );
    expect(verifier).toContain(
      "typed Video event authority exists",
    );
  });

  it("keeps typed Audio event history while retiring only pointer compatibility", () => {
    expect(migration).toContain(
      "audio.publication_review_events",
    );
    expect(migration).toContain(
      "audio.publication_lifecycle_events",
    );
    expect(migration).toContain(
      "removed typed Audio historical event compatibility",
    );
    expect(verifier).toContain(
      "typed Audio historical event compatibility is missing",
    );
  });

  it("keeps the permanent verifier read-only and authoritative", () => {
    expect(verifier).toMatch(/^begin;/);
    expect(verifier).toContain("set local transaction read only;");
    expect(verifier).toContain(
      "PHASE_7A_K4C_A3_AUDIO_POINTER_COMPATIBILITY_RETIREMENT_PASS",
    );
    expect(verifier).not.toMatch(
      /^\s*(insert|update|delete|alter|drop|create|grant|revoke)\b/im,
    );
  });

  it("documents the type regeneration and no-preview-before-local-gate boundary", () => {
    expect(audit).toContain("database types must be regenerated");
    expect(audit).toContain("No disposable preview exists for A3.");
    expect(audit).toContain(
      "Only after that gate passes may one A3-only disposable preview be created",
    );
    expect(audit).toContain(
      "Canonical replay/schema seal completed from the accepted 61/A3 preview.",
    );
  });

  it("has no browser/runtime source dependency on the typed Audio binding table", () => {
    const offenders = collectSourceFiles(path.resolve("src")).filter((file) =>
      fs
        .readFileSync(file, "utf8")
        .includes("audio_publication_resources"),
    );

    expect(offenders).toEqual([]);
  });
});
