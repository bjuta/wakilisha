import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const BASE_REF =
  process.env.CONTROL_PLANE_BASE_REF ??
  "origin/main";
const SUPABASE_CLI_VERSION =
  process.env.SUPABASE_CLI_VERSION ??
  "2.107.0";
const TARGET_PROJECT_REF =
  process.env.SUPABASE_TARGET_PROJECT_REF ??
  "pgzizndxdyhqmtyywjmt";

const TYPE_FILE =
  "src/types/database.types.ts";
const BASELINE_FILE =
  "docs/engineering/live-schema-baseline.json";
const MIGRATIONS_DIR =
  "supabase/migrations";
const GENERATOR =
  "scripts/control-plane/generate-live-schema.sh";

function fail(message, detail = "") {
  console.error(`STOP: ${message}`);
  if (detail) console.error(detail);
  process.exit(1);
}

function arg(name) {
  const index = process.argv.indexOf(name);
  if (
    index === -1 ||
    !process.argv[index + 1]
  ) {
    fail(
      `Missing required argument ${name}`,
    );
  }
  return process.argv[index + 1];
}

function run(
  command,
  args,
  {
    env = process.env,
    allowFailure = false,
  } = {},
) {
  const result = spawnSync(
    command,
    args,
    {
      encoding: "utf8",
      env,
    },
  );

  if (
    result.status !== 0 &&
    !allowFailure
  ) {
    fail(
      `${command} ${args.join(" ")} failed.`,
      `${result.stdout ?? ""}${result.stderr ?? ""}`,
    );
  }

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function git(args) {
  return run("git", args).stdout.trim();
}

function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function activeMigrations() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

function parseRemoteVersions(raw) {
  const normalized =
    raw.replaceAll("│", "|");
  const versions = [];

  for (
    const line of
    normalized.split(/\r?\n/)
  ) {
    const cells =
      line.split("|");
    if (cells.length < 2) continue;

    const remote =
      cells[1].replace(/\s/g, "");
    if (/^\d{14}$/.test(remote)) {
      versions.push(remote);
    }
  }

  return [
    ...new Set(versions),
  ].sort();
}

const migrationFile =
  arg("--migration");
const previewProjectRef =
  arg("--preview-project-ref");
const previewBranchId =
  arg("--preview-branch-id");
const verifierFile =
  arg("--verifier-file");

if (!fs.existsSync(migrationFile)) {
  fail(
    `Migration file does not exist: ${migrationFile}`,
  );
}
if (!fs.existsSync(verifierFile)) {
  fail(
    `Verifier file does not exist: ${verifierFile}`,
  );
}
if (!fs.existsSync(GENERATOR)) {
  fail(
    `Schema generator does not exist: ${GENERATOR}`,
  );
}

const basename =
  path.basename(migrationFile);
const version =
  basename.match(
    /^(\d{14})_/,
  )?.[1];

if (!version) {
  fail(
    `Migration filename is not canonical: ${basename}`,
  );
}
if (
  !/^[a-z0-9]{20}$/.test(
    previewProjectRef,
  )
) {
  fail(
    "Preview project ref is not canonical.",
  );
}
if (
  !/^[0-9a-f-]{36}$/i.test(
    previewBranchId,
  )
) {
  fail(
    "Preview branch id is not a UUID.",
  );
}

const linkedProjectRef =
  fs.existsSync(
    "supabase/.temp/project-ref",
  )
    ? fs
        .readFileSync(
          "supabase/.temp/project-ref",
          "utf8",
        )
        .trim()
    : "";

if (
  linkedProjectRef !==
  previewProjectRef
) {
  fail(
    "Replay proof must be recorded while the worktree is linked to the exact preview project.",
    `Expected ${previewProjectRef}, linked ${linkedProjectRef || "<none>"}`,
  );
}

const migrations =
  activeMigrations();
if (migrations.length === 0) {
  fail(
    "No active migrations exist.",
  );
}

const latestMigration =
  migrations.at(-1);
const latestVersion =
  latestMigration.match(
    /^(\d{14})_/,
  )?.[1];

if (!latestVersion) {
  fail(
    `Latest migration is not canonical: ${latestMigration}`,
  );
}

const listResult = run(
  "npx",
  [
    "--yes",
    `supabase@${SUPABASE_CLI_VERSION}`,
    "migration",
    "list",
    "--linked",
  ],
);

const remoteVersions =
  parseRemoteVersions(
    `${listResult.stdout}\n${listResult.stderr}`,
  );

if (
  remoteVersions.length !==
  migrations.length
) {
  fail(
    "Preview migration ledger has not reached the exact repository migration head.",
    `Local active migrations: ${migrations.length}\nPreview remote migrations: ${remoteVersions.length}`,
  );
}

if (
  remoteVersions.at(-1) !==
  latestVersion
) {
  fail(
    "Preview migration head does not equal the repository migration head.",
    `Repository head: ${latestVersion}\nPreview head: ${remoteVersions.at(-1) ?? "<none>"}`,
  );
}

const baseMainSha =
  git([
    "merge-base",
    "HEAD",
    BASE_REF,
  ]);
const migrationSha256 =
  sha256File(migrationFile);

const generationResult =
  run(
    "bash",
    [GENERATOR],
    {
      env: {
        ...process.env,
        SUPABASE_CLI_VERSION,
        SUPABASE_TARGET_PROJECT_REF:
          TARGET_PROJECT_REF,
        SUPABASE_SCHEMA_SOURCE_PROJECT_REF:
          previewProjectRef,
        SCHEMA_SEAL_MODE:
          "preview",
        SCHEMA_BASE_MAIN_SHA:
          baseMainSha,
        SCHEMA_PREVIEW_BRANCH_ID:
          previewBranchId,
      },
    },
  );

process.stdout.write(
  generationResult.stdout,
);
process.stderr.write(
  generationResult.stderr,
);

if (
  !fs.existsSync(TYPE_FILE) ||
  !fs.existsSync(BASELINE_FILE)
) {
  fail(
    "Schema generator did not produce the canonical schema snapshot files.",
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
    `Generated schema baseline is invalid JSON: ${error.message}`,
  );
}

const schemaTypesSha256 =
  sha256File(TYPE_FILE);

if (
  baseline.typesSha256 !==
  schemaTypesSha256
) {
  fail(
    "Generated schema baseline hash does not match generated database types.",
  );
}

if (
  baseline.migrationCount !==
  migrations.length ||
  baseline.latestMigration !==
  latestMigration
) {
  fail(
    "Generated schema baseline does not bind the exact repository migration head.",
  );
}

if (
  baseline.schemaSeal?.mode !==
    "preview" ||
  baseline.schemaSeal
    ?.sourceProjectRef !==
    previewProjectRef ||
  baseline.schemaSeal
    ?.previewBranchId !==
    previewBranchId ||
  baseline.schemaSeal
    ?.baseMainSha !==
    baseMainSha ||
  baseline.schemaSeal
    ?.migrationHead !==
    latestVersion
) {
  fail(
    "Generated schema baseline does not bind the exact preview replay authority.",
  );
}

const proof = {
  migration_file:
    migrationFile,
  migration_sha256:
    migrationSha256,
  base_main_sha:
    baseMainSha,
  preview_project_ref:
    previewProjectRef,
  preview_branch_id:
    previewBranchId,
  preview_migration_head:
    version,
  baseline_replay:
    "pass",
  candidate_apply:
    "pass",
  verifier:
    "pass",
  verifier_file:
    verifierFile,
  schema_types_sha256:
    schemaTypesSha256,
  schema_migration_count:
    migrations.length,
  schema_migration_head:
    latestVersion,
  verified_at:
    new Date().toISOString(),
};

const proofDir =
  "docs/engineering/replay-proofs";
fs.mkdirSync(
  proofDir,
  { recursive: true },
);

const proofPath =
  path.join(
    proofDir,
    `${basename}.json`,
  );

fs.writeFileSync(
  proofPath,
  `${JSON.stringify(
    proof,
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(
  `PASS: wrote replay proof ${proofPath}`,
);
console.log(
  `MIGRATION_SHA256=${migrationSha256}`,
);
console.log(
  `BASE_MAIN_SHA=${baseMainSha}`,
);
console.log(
  `SCHEMA_TYPES_SHA256=${schemaTypesSha256}`,
);
console.log(
  `SCHEMA_MIGRATION_HEAD=${latestVersion}`,
);
