import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const TYPE_FILE =
  "src/types/database.types.ts";
const BASELINE_FILE =
  "docs/engineering/live-schema-baseline.json";
const MIGRATIONS_DIR =
  "supabase/migrations";
const TARGET_PROJECT_REF =
  process.env.SUPABASE_TARGET_PROJECT_REF ??
  process.env.SUPABASE_PROJECT_REF ??
  "pgzizndxdyhqmtyywjmt";

function fail(
  message,
  detail = "",
) {
  console.error(`STOP: ${message}`);
  if (detail) {
    console.error(detail);
  }
  process.exit(1);
}

function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(
      fs.readFileSync(filePath),
    )
    .digest("hex");
}

function activeMigrations() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(
      (name) =>
        name.endsWith(".sql"),
    )
    .sort();
}

export function validateRepositorySchemaSnapshot({
  baseline,
  actualTypesSha256,
  expectedProjectRef,
  migrationCount,
  latestMigration,
}) {
  const errors = [];
  const latestVersion =
    latestMigration?.match(
      /^(\d{14})_/,
    )?.[1] ?? null;

  if (
    baseline.projectRef !==
    expectedProjectRef
  ) {
    errors.push(
      `projectRef must be ${expectedProjectRef}`,
    );
  }

  if (
    baseline.schema !==
    "public,editorial"
  ) {
    errors.push(
      "schema must be public,editorial",
    );
  }

  if (
    baseline
      .authoritativeMigrationDirectory !==
    MIGRATIONS_DIR
  ) {
    errors.push(
      `authoritativeMigrationDirectory must be ${MIGRATIONS_DIR}`,
    );
  }

  if (
    baseline.typesSha256 !==
    actualTypesSha256
  ) {
    errors.push(
      "typesSha256 does not match src/types/database.types.ts",
    );
  }

  if (
    baseline.migrationCount !==
    migrationCount
  ) {
    errors.push(
      `migrationCount must be ${migrationCount}`,
    );
  }

  if (
    baseline.latestMigration !==
    latestMigration
  ) {
    errors.push(
      `latestMigration must be ${latestMigration}`,
    );
  }

  if (
    !Number.isFinite(
      Date.parse(
        baseline.generatedAt ?? "",
      ),
    )
  ) {
    errors.push(
      "generatedAt must be an ISO timestamp",
    );
  }

  const seal =
    baseline.schemaSeal;

  if (
    !seal ||
    typeof seal !== "object"
  ) {
    errors.push(
      "schemaSeal is required",
    );
    return errors;
  }

  if (
    ![
      "production",
      "preview",
    ].includes(seal.mode)
  ) {
    errors.push(
      "schemaSeal.mode must be production or preview",
    );
  }

  if (
    typeof seal.sourceProjectRef !==
      "string" ||
    !/^[a-z0-9]{20}$/.test(
      seal.sourceProjectRef,
    )
  ) {
    errors.push(
      "schemaSeal.sourceProjectRef must be a 20-character Supabase project ref",
    );
  }

  if (
    !latestVersion ||
    seal.migrationHead !==
      latestVersion
  ) {
    errors.push(
      `schemaSeal.migrationHead must be ${latestVersion ?? "<unknown>"}`,
    );
  }

  if (
    seal.mode ===
    "production"
  ) {
    if (
      seal.sourceProjectRef !==
      expectedProjectRef
    ) {
      errors.push(
        "production schema seal must come from the target production project",
      );
    }
  }

  if (
    seal.mode ===
    "preview"
  ) {
    if (
      typeof seal.baseMainSha !==
        "string" ||
      !/^[0-9a-f]{40}$/.test(
        seal.baseMainSha,
      )
    ) {
      errors.push(
        "preview schema seal requires a 40-character baseMainSha",
      );
    }

    if (
      typeof seal.previewBranchId !==
        "string" ||
      !/^[0-9a-f-]{36}$/i.test(
        seal.previewBranchId,
      )
    ) {
      errors.push(
        "preview schema seal requires a UUID previewBranchId",
      );
    }
  }

  return errors;
}

export function validatePendingSchemaState({
  pendingCount,
  sealMode,
}) {
  const errors = [];

  if (
    !Number.isInteger(
      pendingCount,
    ) ||
    pendingCount < 0
  ) {
    errors.push(
      "pendingCount must be a non-negative integer",
    );
    return errors;
  }

  if (
    pendingCount > 0 &&
    sealMode !== "preview"
  ) {
    errors.push(
      "pending repository migrations require a preview-sealed schema snapshot",
    );
  }

  return errors;
}

function argValue(name) {
  const index =
    process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }
  return (
    process.argv[index + 1] ??
    null
  );
}

function main() {
  if (!fs.existsSync(TYPE_FILE)) {
    fail(
      "Committed database types are missing.",
    );
  }

  if (
    !fs.existsSync(
      BASELINE_FILE,
    )
  ) {
    fail(
      "Repository schema baseline metadata is missing.",
    );
  }

  let baseline;
  try {
    baseline =
      JSON.parse(
        fs.readFileSync(
          BASELINE_FILE,
          "utf8",
        ),
      );
  } catch (error) {
    fail(
      `Repository schema baseline is invalid JSON: ${error.message}`,
    );
  }

  const migrations =
    activeMigrations();

  if (
    migrations.length === 0
  ) {
    fail(
      "No active migrations exist.",
    );
  }

  const latestMigration =
    migrations.at(-1);
  const actualTypesSha256 =
    sha256File(TYPE_FILE);

  const errors =
    validateRepositorySchemaSnapshot({
      baseline,
      actualTypesSha256,
      expectedProjectRef:
        TARGET_PROJECT_REF,
      migrationCount:
        migrations.length,
      latestMigration,
    });

  const pendingRaw =
    argValue("--pending-count");

  if (pendingRaw !== null) {
    if (!/^\d+$/.test(pendingRaw)) {
      errors.push(
        "--pending-count must be a non-negative integer",
      );
    } else {
      errors.push(
        ...validatePendingSchemaState({
          pendingCount:
            Number(pendingRaw),
          sealMode:
            baseline
              .schemaSeal?.mode,
        }),
      );
    }
  }

  if (errors.length > 0) {
    fail(
      "repository schema snapshot contract is not sealed.",
      errors.join("\n"),
    );
  }

  console.log(
    `PASS: repository schema snapshot matches ${migrations.length} active migration(s) at ${latestMigration}.`,
  );

  if (pendingRaw !== null) {
    console.log(
      `SCHEMA_SEAL_MODE=${baseline.schemaSeal.mode}`,
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url ===
    pathToFileURL(
      process.argv[1],
    ).href
) {
  main();
}
