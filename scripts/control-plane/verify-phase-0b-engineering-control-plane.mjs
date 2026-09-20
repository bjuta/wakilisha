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
  "scripts/control-plane/generate-registry-canonical-writer-verifier.mjs",
  "scripts/control-plane/verify-registry-canonical-writer-inventory.sql",
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
  "scripts/control-plane/verify-registry-chart-playback-provider-authority.sql",
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
const databaseFunctionEntrypoints = new Set();
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

  if (writer.kind === "database_function") {
    if (
      !/^public\.[a-z0-9_]+\(.+\)$/.test(
        String(writer.entrypoint),
      )
    ) {
      throw new Error(
        `${writer.id}: database-function writer must use an exact public regprocedure signature: ${writer.entrypoint}`,
      );
    }

    if (
      databaseFunctionEntrypoints.has(
        writer.entrypoint,
      )
    ) {
      throw new Error(
        `${writer.id}: database-function writer signature is duplicated: ${writer.entrypoint}`,
      );
    }

    databaseFunctionEntrypoints.add(
      writer.entrypoint,
    );
  }
}

const registryWriterVerifierGeneration =
  execFileSync(
    process.execPath,
    [
      "scripts/control-plane/generate-registry-canonical-writer-verifier.mjs",
      "--check",
    ],
    {
      encoding: "utf8",
    },
  );

if (
  !registryWriterVerifierGeneration.includes(
    "REGISTRY_CANONICAL_WRITER_VERIFIER_GENERATION=PASS",
  )
) {
  throw new Error(
    "Registry canonical-writer verifier generation did not return its PASS receipt.",
  );
}

for (const requiredWriter of [
  "mizizi-agent-runner",
  "mizizi-artist-origin-broker",
  "scrape-artist-data",
  "artist-registry-intake",
  "ingest-artist-discography",
  "chart-ingest-api",
  "admin-router-registry",
  "registry-enrich-artist",
  "backfill-artist-origin",
  "public-content-read",
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
  [
    "wakilisha-public-api",
    "supabase/functions/wakilisha-public-api/index.ts",
  ],
  [
    "registry-enrichment-review",
    "supabase/functions/registry-enrichment-review/index.ts",
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

const artistRegistryIntake =
  registryWriters.find(
    (writer) =>
      writer.id === "artist-registry-intake",
  );

if (
  artistRegistryIntake?.authentication !==
    "request_bearer_user" ||
  artistRegistryIntake?.authorization !==
    "manage_registry" ||
  artistRegistryIntake?.executionAuthority !==
    "service_role_staging_and_reads_plus_caller_jwt_reviewed_registry_admissions" ||
  artistRegistryIntake?.disposition !== "keep" ||
  artistRegistryIntake?.futureBoundary !==
    "reviewed_artist_intake_typed_registry_admissions" ||
  artistRegistryIntake?.miziziCallable !== false ||
  artistRegistryIntake?.humanCallable !== true ||
  artistRegistryIntake?.publicCallable !== false ||
  artistRegistryIntake?.canonicalMutation !== true ||
  artistRegistryIntake?.legacyDebt !== false
) {
  throw new Error(
    "Artist Registry intake must remain caller-bound, manage_registry-gated, and converged onto reviewed typed Registry admissions.",
  );
}

const adminRouterRegistry =
  registryWriters.find(
    (writer) =>
      writer.id === "admin-router-registry",
  );

if (
  adminRouterRegistry?.authentication !==
    "request_bearer_user" ||
  adminRouterRegistry?.authorization !==
    "roles_and_manage_registry" ||
  adminRouterRegistry?.executionAuthority !==
    "service_role_registry_reads_plus_caller_jwt_bounded_admin_registry_commands" ||
  adminRouterRegistry?.disposition !== "keep" ||
  adminRouterRegistry?.futureBoundary !==
    "caller_bound_bounded_admin_registry_commands" ||
  adminRouterRegistry?.miziziCallable !== false ||
  adminRouterRegistry?.humanCallable !== true ||
  adminRouterRegistry?.publicCallable !== false ||
  adminRouterRegistry?.canonicalMutation !== false ||
  adminRouterRegistry?.legacyDebt !== false
) {
  throw new Error(
    "Admin Registry router must remain a caller-bound orchestration/read boundary over bounded Registry commands.",
  );
}

const adminRouterSource = fs.readFileSync(
  "supabase/functions/admin-router/index.ts",
  "utf8",
);

const adminRouterDirectCanonicalDml =
  /\.from\(\s*["']registry_(?:artists|tracks|releases|labels|genres)["']\s*\)\s*\.\s*(insert|update|upsert|delete)\s*\(/s;

if (adminRouterDirectCanonicalDml.test(adminRouterSource)) {
  throw new Error(
    "admin-router reintroduced direct canonical Registry DML.",
  );
}

for (const requiredRpc of [
  "admin_patch_registry_artist_profile_v1",
  "admin_patch_registry_track_profile_v1",
  "admin_patch_registry_release_profile_v1",
  "admin_patch_registry_label_profile_v1",
  "admin_patch_registry_genre_profile_v1",
  "admin_delete_registry_draft_artist_v1",
]) {
  if (!adminRouterSource.includes(requiredRpc)) {
    throw new Error(
      `admin-router is missing bounded Registry command: ${requiredRpc}`,
    );
  }
}

if (
  !adminRouterSource.includes("SUPABASE_ANON_KEY") ||
  !adminRouterSource.includes("p_expected_updated_at")
) {
  throw new Error(
    "admin-router Registry mutations are not bound to caller JWT plus optimistic concurrency.",
  );
}

const providerIntake =
  registryWriters.find(
    (writer) =>
      writer.id === "provider-intake-api",
  );

if (
  providerIntake?.authentication !==
    "request_user_for_privileged_routes" ||
  providerIntake?.authorization !==
    "scoped_intake_authority" ||
  providerIntake?.executionAuthority !==
    "service_role_reads_and_secret_access_plus_caller_bound_validation_rpc" ||
  providerIntake?.disposition !== "keep" ||
  providerIntake?.futureBoundary !==
    "provider_search_inspect_and_caller_bound_evidence_only" ||
  providerIntake?.miziziCallable !== false ||
  providerIntake?.humanCallable !== true ||
  providerIntake?.publicCallable !== false ||
  providerIntake?.canonicalMutation !== false ||
  providerIntake?.legacyDebt !== false
) {
  throw new Error(
    "Provider intake must remain a fail-closed provider evidence/read boundary with no canonical Registry mutation authority.",
  );
}

const providerIntakeSource = fs.readFileSync(
  "supabase/functions/provider-intake-api/index.ts",
  "utf8",
);

if (
  !providerIntakeSource.includes(
    "retired_provider_release_mutation_route",
  ) ||
  !providerIntakeSource.includes(
    'route === "create-shell" || route === "refresh-shell"',
  )
) {
  throw new Error(
    "Provider intake legacy Release mutation compatibility routes are not fail-closed.",
  );
}

const providerIntakeDirectCanonicalDml =
  /\.from\(\s*["']registry_(?:artists|tracks|releases|labels|genres)["']\s*\)\s*\.\s*(insert|update|upsert|delete)\s*\(/s;

if (providerIntakeDirectCanonicalDml.test(providerIntakeSource)) {
  throw new Error(
    "provider-intake-api reintroduced direct canonical Registry DML.",
  );
}

if (
  /\.from\(\s*["']registry_release_shells["']\s*\)\s*\.\s*(insert|update|upsert|delete)\s*\(/s.test(
    providerIntakeSource,
  ) ||
  /\.from\(\s*["']provider_entity_links["']\s*\)\s*\.\s*(insert|update|upsert|delete)\s*\(/s.test(
    providerIntakeSource,
  )
) {
  throw new Error(
    "Provider intake retired Release mutation routes may not mutate legacy shell/link state.",
  );
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

const chartPlaybackEnrichmentSource = fs.readFileSync(
  "supabase/functions/run-chart-playback-enrichment/index.ts",
  "utf8",
);

if (
  !chartPlaybackEnrichmentSource.includes(
    '"chart_admit_track_provider_link_v1"',
  )
) {
  throw new Error(
    "Chart playback enrichment must route accepted provider persistence through the typed provider-link admission RPC.",
  );
}

for (const forbiddenPattern of [
  /\.from\(\s*["']registry_track_provider_links["']\s*\)\s*\.\s*(insert|update|upsert|delete)\s*\(/s,
  /\.from\(\s*["']registry_tracks["']\s*\)\s*\.\s*(insert|update|upsert|delete)\s*\(/s,
]) {
  if (forbiddenPattern.test(chartPlaybackEnrichmentSource)) {
    throw new Error(
      "Chart playback enrichment reintroduced direct canonical Registry provider/Track DML.",
    );
  }
}

const miziziRunner =
  registryWriters.find(
    (writer) =>
      writer.id === "mizizi-agent-runner",
  );

if (
  miziziRunner?.entrypoint !==
    "scripts/registry/agents/mizizi/run.ts" ||
  miziziRunner?.authorization !==
    "manual apply confirmation plus human standing stewardship capability grant and deterministic policy-issued exact execution grant" ||
  miziziRunner?.executionAuthority !==
    "typed exact-grant stewardship broker over Stage-C-ledger-gated JIT transport with dedicated mizizi_executor after activation" ||
  miziziRunner?.futureBoundary !==
    "stage_c_ledger_gated_dedicated_executor_cutover" ||
  miziziRunner?.disposition !== "keep" ||
  miziziRunner?.miziziCallable !== true ||
  miziziRunner?.humanCallable !== true ||
  miziziRunner?.publicCallable !== false ||
  miziziRunner?.canonicalMutation !== true ||
  miziziRunner?.legacyDebt !== false
) {
  throw new Error(
    "MIZIZI runner classification drifted from the Stage C ledger-gated dedicated-executor boundary.",
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
    "typed one-Artist origin broker over Stage-C-ledger-gated JIT transport with dedicated mizizi_executor after activation" ||
  artistOriginBroker?.futureBoundary !==
    "stage_c_ledger_gated_dedicated_executor_cutover" ||
  artistOriginBroker?.disposition !== "keep" ||
  artistOriginBroker?.miziziCallable !== true ||
  artistOriginBroker?.humanCallable !== false ||
  artistOriginBroker?.publicCallable !== false ||
  artistOriginBroker?.canonicalMutation !== true ||
  artistOriginBroker?.legacyDebt !== false
) {
  throw new Error(
    "MIZIZI Artist-origin broker classification drifted from the Stage C ledger-gated dedicated-executor boundary.",
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
  "record_artist_origin_evidence_v1",
  "issue_artist_origin_execution_grant_v1",
  "execute_artist_origin_admission_v1",
  "verify_artist_origin_admission_v1",
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
  "platform_private.record_registry_artist_origin_evidence",
  "platform_private.issue_registry_artist_origin_execution_grant",
  "platform_private.execute_registry_artist_origin_admission",
  "platform_private.verify_registry_artist_origin_admission",
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


const stageCMiziziRunnerSource = fs.readFileSync(
  "scripts/registry/agents/mizizi/run.ts",
  "utf8",
);
for (const forbiddenFragment of [
  "from public.user_role_assignments role",
  "editorial.person_identity_links",
  "platform_private.send_system_message",
]) {
  if (stageCMiziziRunnerSource.includes(forbiddenFragment)) {
    throw new Error(
      `MIZIZI runner retained direct Stage C standup authority: ${forbiddenFragment}`,
    );
  }
}
if (!stageCMiziziRunnerSource.includes("send_operational_standup_v1")) {
  throw new Error(
    "MIZIZI runner is missing the narrow Stage C operational standup wrapper.",
  );
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
