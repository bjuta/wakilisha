import crypto from "node:crypto";
import fs from "node:fs";
import {
  execFileSync,
} from "node:child_process";

const requiredFiles = [
  ".github/workflows/critical-control-plane.yml",
  "archive/legacy-migrations/README.md",
  "docs/engineering/live-schema-baseline.json",
  "docs/engineering/migration-authority.md",
  "docs/engineering/phase-0b-engineering-control-plane.md",
  "docs/institute/LEGACY_INSTITUTE_FREEZE.md",
  "docs/operations/production-change-runbook.md",
  "scripts/control-plane/generate-live-schema.sh",
  "scripts/control-plane/promote-repository-migrations.sh",
  "scripts/control-plane/resolve-supabase-anon-key.mjs",
  "scripts/control-plane/verify-frozen-institute.mjs",
  "scripts/control-plane/verify-live-schema.sh",
  "src/lib/requestContext.ts",
  "src/types/database.types.ts",
  "test/control-plane/request-context.test.ts",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    throw new Error(
      `Required Phase 0B file is missing: ${file}`,
    );
  }
}

for (const forbidden of [
  "database/migrations",
  "packages/db/migrations",
]) {
  if (fs.existsSync(forbidden)) {
    throw new Error(
      `Legacy executable migration path remains: ${forbidden}`,
    );
  }
}

for (const archive of [
  "archive/legacy-migrations/database",
  "archive/legacy-migrations/packages-db",
]) {
  if (!fs.existsSync(archive)) {
    throw new Error(
      `Archived migration tree is missing: ${archive}`,
    );
  }
}

const trackedFiles = execFileSync(
  "git",
  [
    "ls-files",
    "-z",
  ],
)
  .toString("utf8")
  .split("\0")
  .filter(Boolean);

for (const file of trackedFiles) {
  if (
    file.startsWith(
      "database/migrations/",
    ) ||
    file.startsWith(
      "packages/db/migrations/",
    )
  ) {
    throw new Error(
      `Tracked legacy migration remains executable: ${file}`,
    );
  }
}

const migrations = fs
  .readdirSync(
    "supabase/migrations",
  )
  .filter((file) =>
    file.endsWith(".sql")
  )
  .sort();

if (migrations.length === 0) {
  throw new Error(
    "Authoritative Supabase migration directory is empty.",
  );
}

const versions = new Map();

for (const file of migrations) {
  const match =
    file.match(/^(\d+)_/);

  if (!match) {
    throw new Error(
      `Migration lacks a numeric version: ${file}`,
    );
  }

  const version = match[1];
  const existing =
    versions.get(version) ?? [];

  existing.push(file);
  versions.set(
    version,
    existing,
  );
}

for (const [version, files] of versions) {
  if (files.length > 1) {
    throw new Error(
      `Duplicate migration version ${version}:\n${files.join("\n")}`,
    );
  }
}

const pkg = JSON.parse(
  fs.readFileSync(
    "package.json",
    "utf8",
  ),
);

for (const script of [
  "control-plane:verify",
  "schema:generate",
  "schema:verify",
  "test:critical",
]) {
  if (!pkg.scripts?.[script]) {
    throw new Error(
      `Required package script is missing: ${script}`,
    );
  }
}

for (const forbiddenScript of [
  "extract:local",
  "extract:zip",
  "migration:audit",
  "migration:chunked-seed",
  "migration:generate-registry",
  "migration:graph",
  "migration:repair",
  "migration:routes",
  "migration:seed",
]) {
  if (
    pkg.scripts?.[forbiddenScript]
  ) {
    throw new Error(
      `Legacy migration script remains in the normal namespace: ${forbiddenScript}`,
    );
  }
}

const promotionScript = fs.readFileSync(
  "scripts/control-plane/promote-repository-migrations.sh",
  "utf8",
);

for (const fragment of [
  'test "$(git branch --show-current)" = "main"',
  'test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"',
  "npm run schema:verify",
  "supabase db push --dry-run --linked",
  "supabase db push --linked",
  "POST_PENDING",
  "REPOSITORY_MIGRATION_PROMOTION_PASS",
]) {
  if (!promotionScript.includes(fragment)) {
    throw new Error(
      `Canonical production migration promotion is missing: ${fragment}`,
    );
  }
}

const typesPath =
  "src/types/database.types.ts";

const typesBuffer =
  fs.readFileSync(typesPath);

if (typesBuffer.length < 10000) {
  throw new Error(
    "Committed database types are unexpectedly small.",
  );
}

const baseline = JSON.parse(
  fs.readFileSync(
    "docs/engineering/live-schema-baseline.json",
    "utf8",
  ),
);

const actualTypesSha = crypto
  .createHash("sha256")
  .update(typesBuffer)
  .digest("hex");

if (
  baseline.typesSha256 !==
  actualTypesSha
) {
  throw new Error(
    "Committed database types do not match the recorded baseline hash.",
  );
}

if (
  baseline
    .authoritativeMigrationDirectory !==
  "supabase/migrations"
) {
  throw new Error(
    "Live schema baseline names the wrong migration authority.",
  );
}

const workflow = fs.readFileSync(
  ".github/workflows/critical-control-plane.yml",
  "utf8",
);

for (const fragment of [
  "npm run test:critical",
  "npm run schema:verify",
  "npm run build:app",
  "SUPABASE_ACCESS_TOKEN",
]) {
  if (!workflow.includes(fragment)) {
    throw new Error(
      `Critical workflow is missing: ${fragment}`,
    );
  }
}

const client = fs.readFileSync(
  "src/lib/supabase.ts",
  "utf8",
);

for (const fragment of [
  "createInstrumentedFetch",
  "global:",
  "fetch:",
]) {
  if (!client.includes(fragment)) {
    throw new Error(
      `Supabase client lacks request instrumentation: ${fragment}`,
    );
  }
}

const requestContext =
  fs.readFileSync(
    "src/lib/requestContext.ts",
    "utf8",
  );

for (const fragment of [
  "requestId",
  "upstreamRequestId",
  "request_failure",
  "wakilisha-request-error",
]) {
  if (
    !requestContext.includes(
      fragment,
    )
  ) {
    throw new Error(
      `Structured request context is missing: ${fragment}`,
    );
  }
}

console.log(
  [
    "PASS: Phase 0B engineering control plane is structurally complete.",
    `Authoritative migrations: ${migrations.length}`,
    `Committed type bytes: ${typesBuffer.length}`,
  ].join("\n"),
);
