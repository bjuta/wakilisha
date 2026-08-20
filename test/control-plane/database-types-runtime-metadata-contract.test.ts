import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const helper =
  "scripts/control-plane/normalize-database-types-runtime-metadata.mjs";
const generator = fs.readFileSync(
  "scripts/control-plane/generate-live-schema.sh",
  "utf8",
);
const verifier = fs.readFileSync(
  "scripts/control-plane/verify-live-schema.sh",
  "utf8",
);

function runHelper(args: string[]) {
  return spawnSync(
    process.execPath,
    [helper, ...args],
    { encoding: "utf8" },
  );
}

function sampleTypes(
  postgrestVersion: string,
  idType = "string",
) {
  return `export type Database = {\n  __InternalSupabase: {\n    PostgrestVersion: "${postgrestVersion}"\n  }\n  public: {\n    Tables: {\n      sample: {\n        Row: { id: ${idType} }\n      }\n    }\n  }\n}\n`;
}

describe("database types runtime metadata contract", () => {
  it("pins preview-generated types to target production PostgREST metadata without replacing schema content", () => {
    const dir = fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        "wakilisha-types-runtime-",
      ),
    );
    const preview = path.join(dir, "preview.ts");
    const production = path.join(dir, "production.ts");
    const output = path.join(dir, "output.ts");

    fs.writeFileSync(
      preview,
      sampleTypes("14.15", "string"),
    );
    fs.writeFileSync(
      production,
      sampleTypes("14.5", "number"),
    );

    const result = runHelper([
      "--input",
      preview,
      "--runtime-source",
      production,
      "--output",
      output,
    ]);

    expect(result.status).toBe(0);

    const pinned = fs.readFileSync(
      output,
      "utf8",
    );

    expect(pinned).toContain(
      'PostgrestVersion: "14.5"',
    );
    expect(pinned).toContain(
      "Row: { id: string }",
    );
    expect(pinned).not.toContain(
      "Row: { id: number }",
    );
  });

  it("treats a PostgREST-version-only difference as equal schema", () => {
    const dir = fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        "wakilisha-types-normalize-",
      ),
    );
    const first = path.join(dir, "first.ts");
    const second = path.join(dir, "second.ts");
    const firstNormalized = path.join(
      dir,
      "first-normalized.ts",
    );
    const secondNormalized = path.join(
      dir,
      "second-normalized.ts",
    );

    fs.writeFileSync(
      first,
      sampleTypes("14.15"),
    );
    fs.writeFileSync(
      second,
      sampleTypes("14.5"),
    );

    expect(
      runHelper([
        "--input",
        first,
        "--normalize",
        "--output",
        firstNormalized,
      ]).status,
    ).toBe(0);
    expect(
      runHelper([
        "--input",
        second,
        "--normalize",
        "--output",
        secondNormalized,
      ]).status,
    ).toBe(0);

    expect(
      fs.readFileSync(
        firstNormalized,
        "utf8",
      ),
    ).toBe(
      fs.readFileSync(
        secondNormalized,
        "utf8",
      ),
    );
  });

  it("still detects a real generated schema difference after normalization", () => {
    const dir = fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        "wakilisha-types-real-drift-",
      ),
    );
    const first = path.join(dir, "first.ts");
    const second = path.join(dir, "second.ts");
    const firstNormalized = path.join(
      dir,
      "first-normalized.ts",
    );
    const secondNormalized = path.join(
      dir,
      "second-normalized.ts",
    );

    fs.writeFileSync(
      first,
      sampleTypes("14.15", "string"),
    );
    fs.writeFileSync(
      second,
      sampleTypes("14.5", "number"),
    );

    expect(
      runHelper([
        "--input",
        first,
        "--normalize",
        "--output",
        firstNormalized,
      ]).status,
    ).toBe(0);
    expect(
      runHelper([
        "--input",
        second,
        "--normalize",
        "--output",
        secondNormalized,
      ]).status,
    ).toBe(0);

    expect(
      fs.readFileSync(
        firstNormalized,
        "utf8",
      ),
    ).not.toBe(
      fs.readFileSync(
        secondNormalized,
        "utf8",
      ),
    );
  });

  it("uses target runtime metadata during preview generation and normalization during production equality", () => {
    expect(generator).toContain(
      "normalize-database-types-runtime-metadata.mjs",
    );
    expect(generator).toContain(
      "--runtime-source",
    );
    expect(generator).toContain(
      'SOURCE_PROJECT_REF" != "$TARGET_PROJECT_REF',
    );

    expect(verifier).toContain(
      "normalize-database-types-runtime-metadata.mjs",
    );
    expect(verifier).toContain(
      "--normalize",
    );
    expect(verifier).toContain(
      "volatile PostgREST runtime metadata",
    );
  });
});
