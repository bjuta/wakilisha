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
  "scripts/control-plane/registry-privileged-writer-manifest.json",
  "scripts/control-plane/resolve-supabase-anon-key.mjs",
  "scripts/control-plane/verify-frozen-institute.mjs",
  "scripts/control-plane/verify-live-schema.sh",
  "scripts/registry/agents/mizizi/artist-origin-broker.ts",
  "supabase/functions/backfill-artist-origin/index.ts",
  "src/lib/requestContext.ts",
  "src/types/database.types.ts",
  "test/control-plane/request-context.test.ts",
  "scripts/control-plane/verify-registry-identity-creation-primitives.sql",
  "scripts/control-plane/verify-registry-relation-admission-primitives.sql",
  "scripts/control-plane/verify-registry-chart-materialization-runtime.sql",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    throw new Error(
      `Required Phase 0B file is missing: ${file}`,
    );
  }
}

const registryWriterManifest = JSON.parse(
  fs.readFileSync(
    "scripts/control-plane/registry-privileged-writer-manifest.json",
    "utf8",
  ),
);

if (registryWriterManifest.schemaVersion !== 1) {
  throw new Error(
    "Registry privileged-writer manifest schemaVersion must be 1.",
  );
}

if (
  registryWriterManifest.scope !==
  "canonical_music_registry"
) {
  throw new Error(
    "Registry privileged-writer manifest has the wrong authority scope.",
  );
}

for (const [rule, expected] of Object.entries({
  newWriterRequiresClassification: true,
  publicReadCanonicalMutationAllowed: false,
  systemActorExecutionRequiresExactGrant: true,
  directBrowserCanonicalDmlAllowed: false,
  genericSqlIsExecutionCapability: false,
})) {
  if (
    registryWriterManifest.rules?.[rule] !==
    expected
  ) {
    throw new Error(
      `Registry privileged-writer manifest rule drifted: ${rule}`,
    );
  }
}

const registryWriters =
  registryWriterManifest.writers;

if (
  !Array.isArray(registryWriters) ||
  registryWriters.length < 10
) {
  throw new Error(
    "Registry privileged-writer manifest is unexpectedly small.",
  );
}

const writerIds = new Set();
const writerRiskClasses = new Set([
  "low",
  "medium",
  "high",
  "critical",
]);
const writerDispositions = new Set([
  "keep",
  "keep_converge",
  "converge",
  "retire",
  "partial_convergence",
  "remove_canonical_write_side_effect",
  "candidate_retire",
  "retire_or_internalize",
]);

for (const writer of registryWriters) {
  if (
    !writer.id ||
    writerIds.has(writer.id)
  ) {
    throw new Error(
      `Registry privileged writer id is missing or duplicated: ${writer.id ?? "<missing>"}`,
    );
  }
  writerIds.add(writer.id);

  for (const field of [
    "kind",
    "entrypoint",
    "authentication",
    "authorization",
    "executionAuthority",
    "futureBoundary",
  ]) {
    if (
      !writer[field] ||
      !String(writer[field]).trim()
    ) {
      throw new Error(
        `${writer.id}: privileged-writer field is missing: ${field}`,
      );
    }
  }

  if (!writerRiskClasses.has(writer.riskClass)) {
    throw new Error(
      `${writer.id}: unsupported Registry writer risk class ${writer.riskClass}`,
    );
  }

  if (!writerDispositions.has(writer.disposition)) {
    throw new Error(
      `${writer.id}: unsupported Registry writer disposition ${writer.disposition}`,
    );
  }

  if (
    !Array.isArray(writer.targets) ||
    writer.targets.length === 0
  ) {
    throw new Error(
      `${writer.id}: Registry writer targets are required.`,
    );
  }

  for (const flag of [
    "miziziCallable",
    "humanCallable",
    "publicCallable",
    "canonicalMutation",
    "legacyDebt",
  ]) {
    if (typeof writer[flag] !== "boolean") {
      throw new Error(
        `${writer.id}: Registry writer flag must be boolean: ${flag}`,
      );
    }
  }

  const writerHasRuntimeSource =
    writer.kind === "edge_function" ||
    writer.kind === "production_runner";

  if (
    writerHasRuntimeSource &&
    writer.disposition === "retire"
  ) {
    if (fs.existsSync(writer.entrypoint)) {
      throw new Error(
        `${writer.id}: retired Registry writer source must remain absent: ${writer.entrypoint}`,
      );
    }
  } else if (
    writerHasRuntimeSource &&
    !fs.existsSync(writer.entrypoint)
  ) {
    throw new Error(
      `${writer.id}: classified writer entrypoint is missing: ${writer.entrypoint}`,
    );
  }

  if (
    writer.publicCallable &&
    writer.canonicalMutation &&
    !writer.legacyDebt
  ) {
    throw new Error(
      `${writer.id}: public canonical mutation may only exist as explicit legacy debt pending convergence/retirement.`,
    );
  }
}

for (const requiredWriter of [
  "mizizi-agent-runner",
  "mizizi-artist-origin-broker",
  "scrape-artist-data",
  "artist-registry-intake",
  "ingest-artist-discography",
  "registry-enrichment-review",
  "chart-ingest-api",
  "admin-router-registry",
  "registry-enrich-artist",
  "backfill-artist-origin",
  "public-content-read",
  "wakilisha-public-api",
]) {
  if (!writerIds.has(requiredWriter)) {
    throw new Error(
      `Required Registry privileged writer is unclassified: ${requiredWriter}`,
    );
  }
}

for (const [retiredWriter, retiredEntrypoint] of [
  [
    "backfill-artist-spotify-images",
    "supabase/functions/backfill-artist-spotify-images/index.ts",
  ],
  [
    "backfill-artist-type",
    "supabase/functions/backfill-artist-type/index.ts",
  ],
]) {
  if (writerIds.has(retiredWriter)) {
    throw new Error(
      `Retired Registry privileged writer must remain unclassified: ${retiredWriter}`,
    );
  }
  if (fs.existsSync(retiredEntrypoint)) {
    throw new Error(
      `Retired Registry writer source returned: ${retiredEntrypoint}`,
    );
  }
}

const publicReadWriter =
  registryWriters.find(
    (writer) =>
      writer.id === "public-content-read",
  );

if (
  publicReadWriter?.futureBoundary !==
    "pure_public_read" ||
  publicReadWriter?.disposition !== "keep" ||
  publicReadWriter?.canonicalMutation !== false ||
  publicReadWriter?.legacyDebt !== false ||
  publicReadWriter?.publicCallable !== true
) {
  throw new Error(
    "Public content read authority must remain a mechanically pure canonical Registry read boundary.",
  );
}

const publicContentReadSource = fs.readFileSync(
  "supabase/functions/public-content-read/index.ts",
  "utf8",
);

const directCanonicalRegistryDml =
  /\.from\(\s*["']registry_[^"']+["']\s*\)\s*\.\s*(insert|update|upsert|delete)\s*\(/s;

if (directCanonicalRegistryDml.test(publicContentReadSource)) {
  throw new Error(
    "public-content-read reintroduced direct canonical Registry DML.",
  );
}

const canonicalDatabaseMutatorNames =
  registryWriters
    .filter(
      (writer) =>
        writer.kind === "database_function" &&
        writer.canonicalMutation === true,
    )
    .map((writer) => {
      const match = String(writer.entrypoint).match(
        /^(?:[^.]+\.)?([^.(]+)(?:\(|$)/,
      );
      return match?.[1] ?? "";
    })
    .filter(Boolean);

for (const functionName of canonicalDatabaseMutatorNames) {
  const escapedFunctionName =
    functionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rpcCall = new RegExp(
    String.raw`\.rpc\(\s*["']${escapedFunctionName}["']`,
  );

  if (rpcCall.test(publicContentReadSource)) {
    throw new Error(
      `public-content-read may not invoke canonical Registry mutator RPC: ${functionName}`,
    );
  }
}

const miziziRunner =
  registryWriters.find(
    (writer) =>
      writer.id === "mizizi-agent-runner",
  );

if (
  miziziRunner?.executionAuthority !==
    "direct postgres session" ||
  miziziRunner?.futureBoundary !==
    "exact_execution_grant_and_typed_registry_operation" ||
  !miziziRunner?.legacyDebt
) {
  throw new Error(
    "Current MIZIZI ambient database execution must remain classified as debt until brokered execution replaces it.",
  );
}

const artistOriginBroker =
  registryWriters.find(
    (writer) =>
      writer.id === "mizizi-artist-origin-broker",
  );

if (
  artistOriginBroker?.entrypoint !==
    "scripts/registry/agents/mizizi/artist-origin-broker.ts" ||
  artistOriginBroker?.executionAuthority !==
    "typed one-Artist origin broker over current JIT postgres transport" ||
  artistOriginBroker?.futureBoundary !==
    "dedicated_narrow_executor_identity_without_postgres_ambient_authority" ||
  artistOriginBroker?.disposition !== "converge" ||
  artistOriginBroker?.miziziCallable !== true ||
  artistOriginBroker?.humanCallable !== false ||
  artistOriginBroker?.publicCallable !== false ||
  artistOriginBroker?.canonicalMutation !== true ||
  artistOriginBroker?.legacyDebt !== true
) {
  throw new Error(
    "MIZIZI Artist-origin broker classification drifted from the typed exact-grant boundary.",
  );
}

const artistOriginBrokerSource = fs.readFileSync(
  "scripts/registry/agents/mizizi/artist-origin-broker.ts",
  "utf8",
);

for (const {
  label,
  pattern,
} of [
  {
    label: "--artist-id parser",
    pattern:
      /argValue\(\s*"artist-id"\s*\)/,
  },
  {
    label: "--idempotency-key parser",
    pattern:
      /argValue\(\s*"idempotency-key"\s*,/,
  },
]) {
  if (!pattern.test(artistOriginBrokerSource)) {
    throw new Error(
      `MIZIZI Artist-origin broker contract is missing: ${label}`,
    );
  }
}

for (const fragment of [
  "public.registry_artists.metadata.country",
  "record_registry_artist_origin_evidence",
  "issue_registry_artist_origin_execution_grant",
  "execute_registry_artist_origin_admission",
  "verify_registry_artist_origin_admission",
  "MIZIZI_ARTIST_ORIGIN_APPLY",
]) {
  if (!artistOriginBrokerSource.includes(fragment)) {
    throw new Error(
      `MIZIZI Artist-origin broker contract is missing: ${fragment}`,
    );
  }
}

for (const forbiddenFragment of [
  'argValue("origin',
  "--origin",
  "update public.registry_artists",
  "insert into public.registry_artists",
  "delete from public.registry_artists",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  if (
    artistOriginBrokerSource
      .toLowerCase()
      .includes(forbiddenFragment.toLowerCase())
  ) {
    throw new Error(
      `MIZIZI Artist-origin broker contains a forbidden authority escape hatch: ${forbiddenFragment}`,
    );
  }
}


const artistOriginBackfill =
  registryWriters.find(
    (writer) => writer.id === "backfill-artist-origin",
  );

if (
  artistOriginBackfill?.authentication !== "request_user" ||
  artistOriginBackfill?.authorization !== "manage_registry" ||
  artistOriginBackfill?.executionAuthority !==
    "typed_human_exact_grant_rpc_no_service_role" ||
  artistOriginBackfill?.riskClass !== "low" ||
  artistOriginBackfill?.disposition !== "keep" ||
  artistOriginBackfill?.futureBoundary !==
    "registry_artist_origin_admin_admission" ||
  artistOriginBackfill?.miziziCallable !== false ||
  artistOriginBackfill?.humanCallable !== true ||
  artistOriginBackfill?.publicCallable !== false ||
  artistOriginBackfill?.canonicalMutation !== true ||
  artistOriginBackfill?.legacyDebt !== false
) {
  throw new Error(
    "Artist-origin backfill classification drifted from the exact human-grant boundary.",
  );
}

const artistOriginBackfillSource = fs.readFileSync(
  "supabase/functions/backfill-artist-origin/index.ts",
  "utf8",
);

for (const fragment of [
  "SUPABASE_ANON_KEY",
  'required_capability: "manage_registry"',
  "admin_execute_registry_artist_origin_admission",
  "admin_verify_registry_artist_origin_admission",
  "artist_id",
]) {
  if (!artistOriginBackfillSource.includes(fragment)) {
    throw new Error(`Artist-origin backfill contract is missing: ${fragment}`);
  }
}

for (const forbiddenFragment of [
  "SUPABASE_SERVICE_ROLE_KEY",
  ".update(",
  ".insert(",
  ".delete(",
]) {
  if (artistOriginBackfillSource.toLowerCase().includes(forbiddenFragment.toLowerCase())) {
    throw new Error(
      `Artist-origin backfill retained forbidden ambient mutation authority: ${forbiddenFragment}`,
    );
  }
}

const artistDetailSource = fs.readFileSync(
  "src/pages/admin/registry/artists/detail/page.tsx",
  "utf8",
);
if (
  !/artist_id\s*:\s*artist\.id/.test(artistDetailSource) ||
  !/batch_size\s*:\s*1/.test(artistDetailSource)
) {
  throw new Error("Artist detail origin backfill is not bound to its exact Artist.");
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
    `Classified Registry privileged writers: ${registryWriters.length}`,
    `Committed type bytes: ${typesBuffer.length}`,
  ].join("\n"),
);
