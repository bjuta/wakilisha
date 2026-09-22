import fs from "node:fs";
import { createHash } from "node:crypto";

import {
  linkSupabaseProject,
  openMiziziJitSession,
  queryViaLinkedCli,
  runCommand,
  streamCommand,
  streamReadOnlyAuditWithRetry,
} from "./mizizi-production-jit-runtime.mjs";

const PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF || "pgzizndxdyhqmtyywjmt";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || "";
const MODE =
  process.env.MIZIZI_CONTROL_PLANE_MODE || "preflight";
const EXPECTED_MAIN =
  process.env.MIZIZI_EXPECTED_MAIN_SHA || "";
const TRIGGER_FILE =
  process.env.MIZIZI_TRIGGER_FILE || "";
const ARTIFACT_DIR =
  process.env.MIZIZI_ARTIFACT_DIR ||
  "artifacts/mizizi-url-identity-production-control-plane";

const CLOSE_MIGRATION_VERSION = "20260922143000";
const CLOSE_MIGRATION_NAME =
  "mizizi_url_identity_authority_window_close_v1";
const RELEASE_RESUME_MIGRATION_VERSION = "20260922171632";
const RELEASE_RESUME_MIGRATION_NAME =
  "mizizi_release_slug_resume_integrity_v1";

const EXPECTED_RELEASE_CANDIDATES = 737;
const EXPECTED_RELEASE_CANDIDATE_FINGERPRINT =
  "b96da159df4ffa8b19a5bb39574995a6b25cac2552823ef24af8f737fb1278be";
const ACCEPTED_RELEASE_PARTIAL_VERIFIED = 731;
const ACCEPTED_RELEASE_PARTIAL_REMAINING = 6;
const EXPECTED_RELEASE_RESUME_CANDIDATE_FINGERPRINT =
  "2be28e013ce904e2a05f5d3c368304684c08a6ad7eadfe23a99c57162d0091b2";
const EXPECTED_CHART_CANDIDATES = 161;
const EXPECTED_CHART_CANDIDATE_FINGERPRINT =
  "28a3b8362f8721ad4f35045a2cd938d265adf35373b522b492054af80eb8a910";

const EXPECTED_BLOBS = {
  "scripts/registry/agents/mizizi/run.ts":
    "81410c1330869565065c8026f2ddc57a8e29ded0",
  "scripts/registry/agents/mizizi/core.ts":
    "c8ab1436437175cd1d7d1c451299ae2b199bc327",
  "supabase/migrations/20260918173446_mizizi_stage_b_broker_convergence_v1.sql":
    "1cd6c591fe312225a8cbfa431b53063431127b77",
  "supabase/migrations/20260920095334_mizizi_stage_c_narrow_executor_transport_v1.sql":
    "b683e0097071899d9871d98b4cdde83a25be19b6",
  "supabase/migrations/20260922171632_mizizi_release_slug_resume_integrity_v1.sql":
    "14e5447a948f34e6f126fef73baef00098376c37",
};

const APPLY_SCOPES = {
  release_slug: {
    operationKey: "registry.release_slug.canonicalize",
    capabilityKey: "canonicalize_registry_release_slug",
    entity: "release",
    expectedCount: EXPECTED_RELEASE_CANDIDATES,
    expectedFingerprint:
      EXPECTED_RELEASE_CANDIDATE_FINGERPRINT,
    eventAction: "canonicalize_release_slug",
  },
  chart_track_slug: {
    operationKey: "registry.chart_track_slug.synchronize",
    capabilityKey: "synchronize_chart_track_slug",
    entity: "chart",
    expectedCount: EXPECTED_CHART_CANDIDATES,
    expectedFingerprint:
      EXPECTED_CHART_CANDIDATE_FINGERPRINT,
    eventAction: "synchronize_chart_track_slug",
  },
};

if (!["preflight", "apply"].includes(MODE)) {
  throw new Error("Unsupported MIZIZI programme control-plane mode");
}

if (!TOKEN) {
  throw new Error(
    "SUPABASE_ACCESS_TOKEN repository secret is required",
  );
}

fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

function assertFields(actual, expected, label) {
  for (const [key, value] of Object.entries(expected)) {
    if (String(actual?.[key]) !== String(value)) {
      throw new Error(
        label +
          " " +
          key +
          "=" +
          actual?.[key] +
          " expected " +
          value,
      );
    }
  }
}

function sha256(value) {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function stripAnsi(value) {
  return value.replace(/\x1b\[[0-9;]*m/g, "");
}

function auditSummary(text) {
  const clean = stripAnsi(text);
  const match = clean.match(
    /│\s*0\s*│\s*(\d+)\s*│\s*(\d+)\s*│\s*(\d+)\s*│\s*(\d+)\s*│\s*(\d+)\s*│\s*(\d+)\s*│\s*(\d+)\s*│\s*(\d+)\s*│\s*'audit'\s*│\s*'1\.2\.0'\s*│/,
  );

  if (!match) {
    throw new Error(
      "MIZIZI audit summary was not parseable as rule set 1.2.0",
    );
  }

  const values = match.slice(1).map(Number);

  return {
    findings: values[0],
    applied: values[1],
    queued: values[2],
    observed: values[3],
    stale: values[4],
    tracks: values[5],
    releases: values[6],
    chart: values[7],
    clean,
  };
}

function ruleCount(clean, ruleId) {
  const match = clean.match(
    new RegExp(
      "│\\s*\\d+\\s*│\\s*'" +
        ruleId +
        "'\\s*│\\s*(\\d+)\\s*│",
    ),
  );
  return match ? Number(match[1]) : 0;
}

function assertAudit(
  text,
  entity,
  phase = "before",
  expectedCurrentCandidates = null,
) {
  const summary = auditSummary(text);
  const clean = summary.clean;

  if (
    !clean.includes(
      "Audit mode completed. No Registry rows were changed.",
    )
  ) {
    throw new Error(
      entity + " audit did not prove read-only completion",
    );
  }

  if (entity === "track") {
    assertFields(
      summary,
      {
        findings: 561,
        applied: 0,
        queued: 0,
        observed: 495,
        stale: 0,
        tracks: 2101,
        releases: 0,
        chart: 0,
      },
      "Track audit",
    );
    assertFields(
      {
        titleNoise: ruleCount(
          clean,
          "track_title_credit_noise",
        ),
        slugNoise: ruleCount(
          clean,
          "track_slug_identity_noise",
        ),
        mismatch: ruleCount(
          clean,
          "track_slug_identity_mismatch",
        ),
      },
      {
        titleNoise: 492,
        slugNoise: 66,
        mismatch: 3,
      },
      "Track findings",
    );
    return;
  }

  if (entity === "release") {
    const slugPackaging =
      phase === "after"
        ? 0
        : Number(
            expectedCurrentCandidates ??
              EXPECTED_RELEASE_CANDIDATES,
          );

    assertFields(
      summary,
      {
        findings: 737 + slugPackaging,
        applied: 0,
        queued: 0,
        observed: 737,
        stale: 0,
        tracks: 0,
        releases: 841,
        chart: 0,
      },
      "Release audit",
    );
    assertFields(
      {
        titlePackaging: ruleCount(
          clean,
          "release_title_provider_packaging",
        ),
        slugPackaging: ruleCount(
          clean,
          "release_slug_provider_packaging",
        ),
        taxonomy: ruleCount(
          clean,
          "release_taxonomy_drift",
        ),
      },
      {
        titlePackaging: 737,
        slugPackaging,
        taxonomy: 0,
      },
      "Release findings",
    );
    return;
  }

  if (entity === "chart") {
    const after = phase === "after";
    assertFields(
      summary,
      {
        findings: after ? 91 : 252,
        applied: 0,
        queued: 0,
        observed: 91,
        stale: 0,
        tracks: 0,
        releases: 0,
        chart: 1800,
      },
      "Chart audit",
    );
    assertFields(
      {
        trackSlug: ruleCount(
          clean,
          "chart_track_slug_drift",
        ),
        artistSlug: ruleCount(
          clean,
          "chart_artist_slug_drift",
        ),
      },
      {
        trackSlug: after ? 0 : 161,
        artistSlug: 91,
      },
      "Chart findings",
    );
  }
}

const releaseCandidateRowsSql = `
with eligible as materialized (
  select release.id
  from public.registry_releases release
  where release.status='active'
    and (
      (
        release.slug ~* '-single$'
        and release.title ~*
          '[[:space:]]+-[[:space:]]+single$'
      )
      or (
        release.slug ~* '-ep$'
        and release.title ~*
          '[[:space:]]+-[[:space:]]+ep$'
      )
      or (
        release.slug ~* '-album$'
        and release.title ~*
          '[[:space:]]+-[[:space:]]+album$'
      )
    )
)
select
  plan.release_id::text as release_id,
  plan.artist_id::text as artist_id,
  plan.artist_slug,
  plan.current_slug,
  plan.proposed_slug,
  plan.uses_date_fallback,
  plan.expected_state_fingerprint
from eligible
cross join lateral
  mizizi_private.release_slug_plan_v1(eligible.id) plan
`;

const releaseCandidateSql = `
with plans as (
  ${releaseCandidateRowsSql}
),
payload as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'release_id',release_id,
        'artist_id',artist_id,
        'artist_slug',artist_slug,
        'current_slug',current_slug,
        'proposed_slug',proposed_slug,
        'uses_date_fallback',uses_date_fallback,
        'expected_state_fingerprint',
          expected_state_fingerprint
      )
      order by release_id
    ),
    '[]'::jsonb
  ) body
  from plans
)
select
  jsonb_array_length(body)::int as candidate_count,
  body::text as candidate_payload
from payload
`;

const releaseProgrammeCandidateSql = `
with current_plans as (
  ${releaseCandidateRowsSql}
),
succeeded_plans as (
  select
    grant_row.plan_payload->>'release_id' as release_id,
    grant_row.plan_payload->>'artist_id' as artist_id,
    grant_row.plan_payload->>'artist_slug' as artist_slug,
    grant_row.plan_payload->>'current_slug' as current_slug,
    grant_row.plan_payload->>'proposed_slug' as proposed_slug,
    (
      grant_row.plan_payload->>'uses_date_fallback'
    )::boolean as uses_date_fallback,
    grant_row.plan_payload->>'expected_state_fingerprint'
      as expected_state_fingerprint
  from platform_private.registry_execution_grants grant_row
  join platform_private.registry_mutation_operations operation
    on operation.execution_grant_id=grant_row.id
  where grant_row.actor_key='mizizi'
    and grant_row.operation_key='registry.release_slug.canonicalize'
    and grant_row.operation_version=1
    and operation.status='succeeded'
    and operation.verifier_status='passed'
),
programme as (
  select * from succeeded_plans
  union all
  select * from current_plans
),
payload as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'release_id',release_id,
        'artist_id',artist_id,
        'artist_slug',artist_slug,
        'current_slug',current_slug,
        'proposed_slug',proposed_slug,
        'uses_date_fallback',uses_date_fallback,
        'expected_state_fingerprint',
          expected_state_fingerprint
      )
      order by release_id
    ),
    '[]'::jsonb
  ) body
  from programme
)
select
  jsonb_array_length(body)::int as candidate_count,
  body::text as candidate_payload
from payload
`;

const releaseEligibleCountSql = `
select count(*)::int as candidate_count
from public.registry_releases release
where release.status='active'
  and (
    (
      release.slug ~* '-single$'
      and release.title ~*
        '[[:space:]]+-[[:space:]]+single$'
    )
    or (
      release.slug ~* '-ep$'
      and release.title ~*
        '[[:space:]]+-[[:space:]]+ep$'
    )
    or (
      release.slug ~* '-album$'
      and release.title ~*
        '[[:space:]]+-[[:space:]]+album$'
    )
  )
`;

const chartCandidateSql = `
with eligible as materialized (
  select entry.id
  from public.wk_chart_entries_v2 entry
  join public.registry_tracks track
    on track.id::text=entry.canonical_track_id
   and track.status='active'
  where entry.track_slug is distinct from track.slug
),
plans as (
  select
    plan.chart_entry_id,
    plan.current_track_slug,
    plan.canonical_track_id::text as canonical_track_id,
    plan.canonical_track_slug,
    plan.expected_track_state_fingerprint
  from eligible
  cross join lateral
    mizizi_private.chart_track_slug_plan_v1(eligible.id) plan
),
payload as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'chart_entry_id',chart_entry_id,
        'current_track_slug',current_track_slug,
        'canonical_track_id',canonical_track_id,
        'canonical_track_slug',canonical_track_slug,
        'expected_track_state_fingerprint',
          expected_track_state_fingerprint
      )
      order by chart_entry_id
    ),
    '[]'::jsonb
  ) body
  from plans
)
select
  jsonb_array_length(body)::int as candidate_count,
  body::text as candidate_payload
from payload
`;

function candidateSnapshot(row) {
  const payload = String(row?.candidate_payload || "[]");
  return {
    candidateCount: Number(row?.candidate_count || 0),
    candidateFingerprint: sha256(payload),
  };
}

const atRestAuthoritySql = `
select
  (
    select count(*)::int
    from platform_private.system_actor_capability_grants
    where actor_key='mizizi'
      and status='active'
  ) as active_standing,
  (
    select count(*)::int
    from platform_private.registry_execution_grants
    where actor_key='mizizi'
      and status='active'
  ) as active_exact,
  (
    select count(*)::int
    from platform_private.registry_execution_grants
    where actor_key='mizizi'
      and status='active'
      and consumed_at is null
  ) as unconsumed_exact,
  (
    select count(*)::int
    from platform_private.registry_operation_types
    where operation_version=1
      and operation_key in (
        'registry.track_slug.canonicalize',
        'registry.release_taxonomy.repair',
        'registry.release_slug.canonicalize',
        'registry.chart_track_slug.synchronize'
      )
      and enabled
  ) as enabled_operations
`;

function assertZeroAtRest(label) {
  const state = queryViaLinkedCli(atRestAuthoritySql);
  assertFields(
    state,
    {
      active_standing: 0,
      active_exact: 0,
      unconsumed_exact: 0,
      enabled_operations: 0,
    },
    label,
  );
  return state;
}

async function runAudit(
  url,
  entity,
  phase = "before",
  expectedCurrentCandidates = null,
) {
  const logPath =
    ARTIFACT_DIR +
    "/" +
    entity +
    "-" +
    phase +
    "-audit.txt";

  await streamReadOnlyAuditWithRetry(
    [
      "run",
      "registry:mizizi:audit",
      "--",
      "--entity=" + entity,
      "--limit=0",
    ],
    { DATABASE_URL: url },
    logPath,
  );

  const text = fs.readFileSync(logPath, "utf8");
  assertAudit(
    text,
    entity,
    phase,
    expectedCurrentCandidates,
  );
}

async function currentCandidateState(pool) {
  const releaseCurrentResult =
    await pool.query(releaseCandidateSql);
  const releaseProgrammeResult =
    await pool.query(releaseProgrammeCandidateSql);
  const chartResult =
    await pool.query(chartCandidateSql);

  const releaseCurrent =
    candidateSnapshot(releaseCurrentResult.rows[0]);
  const releaseProgramme =
    candidateSnapshot(releaseProgrammeResult.rows[0]);
  const chart =
    candidateSnapshot(chartResult.rows[0]);

  assertFields(
    releaseProgramme,
    {
      candidateCount: EXPECTED_RELEASE_CANDIDATES,
      candidateFingerprint:
        EXPECTED_RELEASE_CANDIDATE_FINGERPRINT,
    },
    "Release slug programme freeze",
  );

  assertFields(
    chart,
    {
      candidateCount: EXPECTED_CHART_CANDIDATES,
      candidateFingerprint:
        EXPECTED_CHART_CANDIDATE_FINGERPRINT,
    },
    "Chart Track-slug candidate freeze",
  );

  const releaseJournal =
    journalSnapshot(APPLY_SCOPES.release_slug);

  if (
    Number(releaseJournal.verified_operations) !==
    Number(releaseJournal.canonical_events)
  ) {
    throw new Error(
      "Release slug journal/write-event parity is not exact",
    );
  }

  let releaseState = "";

  if (
    Number(releaseJournal.verified_operations) === 0 &&
    releaseCurrent.candidateCount ===
      EXPECTED_RELEASE_CANDIDATES &&
    releaseCurrent.candidateFingerprint ===
      EXPECTED_RELEASE_CANDIDATE_FINGERPRINT
  ) {
    releaseState = "pristine";
  } else if (
    Number(releaseJournal.verified_operations) ===
      ACCEPTED_RELEASE_PARTIAL_VERIFIED &&
    releaseCurrent.candidateCount ===
      ACCEPTED_RELEASE_PARTIAL_REMAINING &&
    releaseCurrent.candidateFingerprint ===
      EXPECTED_RELEASE_RESUME_CANDIDATE_FINGERPRINT
  ) {
    releaseState = "accepted_partial";
  } else if (
    Number(releaseJournal.verified_operations) ===
      EXPECTED_RELEASE_CANDIDATES &&
    releaseCurrent.candidateCount === 0
  ) {
    releaseState = "accepted_final";
  } else {
    throw new Error(
      "Release slug programme state is not a recognized exact boundary: " +
        JSON.stringify({
          journal: releaseJournal,
          current: releaseCurrent,
        }),
    );
  }

  return {
    releaseProgramme,
    releaseCurrent,
    releaseState,
    releaseJournal,
    chart,
  };
}

function releaseResumeMigrationApplied() {
  const state = queryViaLinkedCli(`
select exists(
  select 1
  from supabase_migrations.schema_migrations
  where version='${RELEASE_RESUME_MIGRATION_VERSION}'
    and name='${RELEASE_RESUME_MIGRATION_NAME}'
) as applied
`);

  return String(state.applied) === "true";
}


function requireUuid(value, label) {
  const text = String(value || "");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      text,
    )
  ) {
    throw new Error(label + " must be a UUID");
  }
  return text.toLowerCase();
}

function readApplyTrigger() {
  if (!EXPECTED_MAIN || !TRIGGER_FILE) {
    throw new Error(
      "reviewed URL-identity production trigger is missing",
    );
  }

  const trigger = JSON.parse(
    fs.readFileSync(TRIGGER_FILE, "utf8"),
  );

  if (
    trigger.operation !==
      "mizizi_url_identity_production_apply" ||
    trigger.confirm !==
      "MIZIZI_URL_IDENTITY_PRODUCTION_APPLY" ||
    Number(trigger.programme_issue) !== 1013
  ) {
    throw new Error(
      "production trigger identity is not exact",
    );
  }

  const scope = APPLY_SCOPES[trigger.scope];

  if (!scope) {
    throw new Error(
      "production trigger scope must be release_slug or chart_track_slug",
    );
  }

  assertFields(
    trigger,
    {
      expected_candidate_count: scope.expectedCount,
      expected_candidate_fingerprint:
        scope.expectedFingerprint,
      expected_operation_key: scope.operationKey,
      expected_capability_key: scope.capabilityKey,
    },
    "production trigger",
  );

  return {
    ...trigger,
    capability_grant_id: requireUuid(
      trigger.capability_grant_id,
      "capability_grant_id",
    ),
    scopeConfig: scope,
  };
}

function assertExactMain() {
  runCommand("git", [
    "fetch",
    "--prune",
    "origin",
    "main",
  ]);

  assertFields(
    {
      head: runCommand(
        "git",
        ["rev-parse", "HEAD"],
        { capture: true },
      ),
      main: runCommand(
        "git",
        ["rev-parse", "origin/main"],
        { capture: true },
      ),
    },
    {
      head: EXPECTED_MAIN,
      main: EXPECTED_MAIN,
    },
    "exact merged main",
  );
}

function assertHumanAuthority(trigger) {
  const scope = trigger.scopeConfig;
  const grantId = trigger.capability_grant_id;

  const state = queryViaLinkedCli(`
select
  exists(
    select 1
    from supabase_migrations.schema_migrations
    where version='${CLOSE_MIGRATION_VERSION}'
      and name='${CLOSE_MIGRATION_NAME}'
  ) as close_migration_applied,
  exists(
    select 1
    from supabase_migrations.schema_migrations
    where version='${RELEASE_RESUME_MIGRATION_VERSION}'
      and name='${RELEASE_RESUME_MIGRATION_NAME}'
  ) as release_resume_migration_applied,
  exists(
    select 1
    from platform_private.registry_operation_types
    where operation_key='${scope.operationKey}'
      and operation_version=1
      and capability_key='${scope.capabilityKey}'
      and enabled
  ) as operation_enabled,
  exists(
    select 1
    from platform_private.system_actor_capability_grants grant_row
    where grant_row.id='${grantId}'::uuid
      and grant_row.actor_key='mizizi'
      and grant_row.capability_key='${scope.capabilityKey}'
      and grant_row.status='active'
      and grant_row.valid_from<=now()
      and grant_row.expires_at>now()+interval '30 minutes'
      and grant_row.revoked_at is null
      and grant_row.scope @> jsonb_build_object(
        'operation_key','${scope.operationKey}',
        'operation_version',1,
        'max_rows',1
      )
  ) as exact_human_grant,
  (
    select count(*)::int
    from platform_private.system_actor_capability_grants
    where actor_key='mizizi'
      and status='active'
  ) as active_standing_total,
  (
    select count(*)::int
    from platform_private.registry_execution_grants
    where actor_key='mizizi'
      and status='active'
  ) as active_exact_total
`);

  assertFields(
    state,
    {
      close_migration_applied: true,
      release_resume_migration_applied: true,
      operation_enabled: true,
      exact_human_grant: true,
      active_standing_total: 1,
      active_exact_total: 0,
    },
    "human stewardship authority",
  );
}

function journalSnapshot(scope) {
  return queryViaLinkedCli(`
select
  (
    select count(*)::int
    from platform_private.registry_mutation_operations
    where actor_key='mizizi'
      and operation_key='${scope.operationKey}'
      and operation_version=1
      and status='succeeded'
      and verifier_status='passed'
  ) as verified_operations,
  (
    select count(*)::int
    from public.registry_canonical_write_events
    where actor='system:mizizi'
      and action='${scope.eventAction}'
      and status='succeeded'
  ) as canonical_events
`);
}

async function closeAuthorityWindow(
  pool,
  trigger,
  reason,
) {
  const result = await pool.query(
    `
    select *
    from mizizi_private.close_stewardship_authority_window_v1(
      $1::text,
      $2::uuid,
      $3::text
    )
    `,
    [
      trigger.scopeConfig.operationKey,
      trigger.capability_grant_id,
      reason,
    ],
  );

  if (result.rowCount !== 1) {
    throw new Error(
      "MIZIZI authority-window close did not return one receipt",
    );
  }

  return result.rows[0];
}

async function main() {
  console.log(
    "\n=== 1. REPOSITORY + CURRENT PROGRAMME AUTHORITY ===",
  );

  runCommand("git", ["fetch", "--prune", "origin", "main"]);

  if (
    runCommand(
      "git",
      ["status", "--porcelain"],
      { capture: true },
    )
  ) {
    throw new Error("worktree is not clean");
  }

  for (const [path, sha] of Object.entries(EXPECTED_BLOBS)) {
    assertFields(
      {
        sha: runCommand(
          "git",
          ["hash-object", path],
          { capture: true },
        ),
      },
      { sha },
      path,
    );
  }

  let trigger = null;

  if (MODE === "apply") {
    trigger = readApplyTrigger();
    assertExactMain();
  }

  console.log(
    "PASS: accepted Stage B/C MIZIZI runtime bytes exact",
  );

  runCommand("npx", [
    "vitest",
    "run",
    "test/registry/mizizi-cultural-data-steward.test.ts",
    "test/registry/mizizi-url-identity-production-control-plane.test.ts",
  ]);

  console.log(
    "\n=== 2. LINKED PRODUCTION + ENTRY AUTHORITY ===",
  );

  linkSupabaseProject(PROJECT_REF);

  if (MODE === "preflight") {
    assertZeroAtRest("preflight entry authority");
  } else {
    assertHumanAuthority(trigger);
  }

  console.log(
    "\n=== 3. STAGE-C JIT MIZIZI EXECUTOR ===",
  );

  const jit = await openMiziziJitSession({
    projectRef: PROJECT_REF,
    token: TOKEN,
  });

  let primaryError = null;

  try {
    const releaseCountResult =
      await jit.pool.query(releaseEligibleCountSql);
    const currentReleaseCandidates =
      Number(
        releaseCountResult.rows[0]?.candidate_count || 0,
      );
    const resumeMigrationReady =
      releaseResumeMigrationApplied();

    console.log(
      "\n=== 4. CURRENT FULL-CORPUS READ-ONLY AUDIT ===",
    );

    await runAudit(jit.url, "track");
    await runAudit(
      jit.url,
      "release",
      "before",
      currentReleaseCandidates,
    );
    await runAudit(jit.url, "chart");

    if (
      MODE === "preflight" &&
      !resumeMigrationReady
    ) {
      const releaseJournal =
        journalSnapshot(APPLY_SCOPES.release_slug);

      assertFields(
        {
          currentReleaseCandidates,
          verified:
            releaseJournal.verified_operations,
          events:
            releaseJournal.canonical_events,
        },
        {
          currentReleaseCandidates:
            ACCEPTED_RELEASE_PARTIAL_REMAINING,
          verified:
            ACCEPTED_RELEASE_PARTIAL_VERIFIED,
          events:
            ACCEPTED_RELEASE_PARTIAL_VERIFIED,
        },
        "pre-migration accepted Release partial stop",
      );

      fs.writeFileSync(
        ARTIFACT_DIR + "/candidate-state.json",
        JSON.stringify(
          {
            releaseState:
              "accepted_partial_migration_pending",
            releaseCurrentCount:
              currentReleaseCandidates,
            releaseJournal,
          },
          null,
          2,
        ) + "\n",
      );

      console.log(
        "\n=== MIZIZI URL-IDENTITY REPAIR PREFLIGHT PASS ===",
      );
      console.log(
        "Resume migration: pending Production promotion",
      );
      console.log("Registry mutation: NO");
      return;
    }

    console.log(
      "\n=== 5. EXACT CURRENT CANDIDATE FREEZE ===",
    );

    const candidates =
      await currentCandidateState(jit.pool);

    fs.writeFileSync(
      ARTIFACT_DIR + "/candidate-state.json",
      JSON.stringify(candidates, null, 2) + "\n",
    );

    if (MODE === "preflight") {
      console.log(
        "\n=== MIZIZI URL-IDENTITY PRODUCTION PREFLIGHT PASS ===",
      );
      console.log(
        "Release programme state: " +
          candidates.releaseState,
      );
      console.log("Registry mutation: NO");
      return;
    }

    const scope = trigger.scopeConfig;
    const before = journalSnapshot(scope);
    const expectedApplyCount =
      scope.entity === "release"
        ? candidates.releaseCurrent.candidateCount
        : scope.expectedCount;

    if (
      scope.entity === "release" &&
      !["pristine", "accepted_partial"].includes(
        candidates.releaseState,
      )
    ) {
      throw new Error(
        "Release slug apply cannot start from " +
          candidates.releaseState,
      );
    }

    fs.writeFileSync(
      ARTIFACT_DIR + "/state-before.json",
      JSON.stringify(
        {
          trigger,
          journal: before,
          candidates,
        },
        null,
        2,
      ) + "\n",
    );

    console.log(
      "\n=== 6. GOVERNED URL-IDENTITY APPLY ===",
    );

    try {
      await streamCommand(
        "npm",
        [
          "run",
          "registry:mizizi:apply",
          "--",
          "--entity=" + scope.entity,
          "--limit=0",
          "--confirm=MIZIZI_APPLY",
        ],
        { DATABASE_URL: jit.url },
        ARTIFACT_DIR + "/apply.txt",
      );
    } catch (error) {
      primaryError = error;
    }

    console.log(
      "\n=== 7. REDUCE HUMAN-ISSUED AUTHORITY WINDOW ===",
    );

    try {
      const closeReceipt =
        await closeAuthorityWindow(
          jit.pool,
          trigger,
          primaryError
            ? "close after failed #1013 governed apply"
            : "close after accepted #1013 governed apply",
        );

      fs.writeFileSync(
        ARTIFACT_DIR + "/authority-close.json",
        JSON.stringify(closeReceipt, null, 2) + "\n",
      );
    } catch (closeError) {
      if (primaryError) {
        throw new Error(
          "apply failed: " +
            (primaryError?.message || primaryError) +
            "; authority close also failed: " +
            (closeError?.message || closeError),
        );
      }
      throw closeError;
    }

    assertZeroAtRest("post-apply authority");

    if (primaryError) {
      throw primaryError;
    }

    console.log(
      "\n=== 8. EXACT PRODUCTION ACCEPTANCE ===",
    );

    const after = journalSnapshot(scope);

    assertFields(
      {
        verifiedDelta:
          Number(after.verified_operations) -
          Number(before.verified_operations),
        eventDelta:
          Number(after.canonical_events) -
          Number(before.canonical_events),
      },
      {
        verifiedDelta: expectedApplyCount,
        eventDelta: expectedApplyCount,
      },
      "governed operation acceptance",
    );

    if (scope.entity === "release") {
      assertFields(
        after,
        {
          verified_operations:
            EXPECTED_RELEASE_CANDIDATES,
          canonical_events:
            EXPECTED_RELEASE_CANDIDATES,
        },
        "final Release programme journal",
      );

      const result =
        await jit.pool.query(releaseCandidateSql);
      const state =
        candidateSnapshot(result.rows[0]);
      assertFields(
        state,
        { candidateCount: 0 },
        "post-apply Release candidate state",
      );
      await runAudit(
        jit.url,
        "release",
        "after",
        0,
      );
    } else {
      const result =
        await jit.pool.query(chartCandidateSql);
      const state =
        candidateSnapshot(result.rows[0]);
      assertFields(
        state,
        { candidateCount: 0 },
        "post-apply Chart candidate state",
      );
      await runAudit(jit.url, "chart", "after");
    }

    fs.writeFileSync(
      ARTIFACT_DIR + "/state-after.json",
      JSON.stringify(
        {
          scope: trigger.scope,
          journal: after,
          authority: queryViaLinkedCli(atRestAuthoritySql),
        },
        null,
        2,
      ) + "\n",
    );

    console.log(
      "\n=== MIZIZI URL-IDENTITY PRODUCTION APPLY PASS ===",
    );
  } finally {
    await jit.restore();
  }
}

main().catch((error) => {
  console.error(
    "\nMIZIZI URL-identity production control plane failed: " +
      (error?.message || error),
  );
  process.exitCode = 1;
});
