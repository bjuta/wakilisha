import fs from "node:fs";

import {
  linkSupabaseProject,
  openMiziziJitSession,
  queryViaLinkedCli,
  runCommand,
} from "./mizizi-production-jit-runtime.mjs";

const PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF || "pgzizndxdyhqmtyywjmt";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || "";
const EXPECTED_MAIN =
  process.env.MIZIZI_EXPECTED_MAIN_SHA || "";
const TRIGGER_FILE =
  process.env.MIZIZI_TRIGGER_FILE || "";
const ARTIFACT_DIR =
  process.env.MIZIZI_ARTIFACT_DIR ||
  "artifacts/public-music-identity-batch-a";

const OPERATION_KEY = "registry.track_slug.canonicalize";
const CAPABILITY_KEY = "canonicalize_registry_track_slug";
const EXPECTED_CANDIDATE_FINGERPRINT =
  "363bed8410570611a8cdf43194f7b47a0e0f380877fac342201fc48e2b6576e9";
const CLOSE_MIGRATION_VERSION = "20260922143000";
const CLOSE_MIGRATION_NAME =
  "mizizi_url_identity_authority_window_close_v1";

const SAFE_SLUG_ROWS = [
  {
    reviewId: "740dbe7e-b423-4e69-b479-83dc91a76da2",
    trackId: "9f02ad39-8f78-4c0b-aeff-6e8c5f1a2269",
    expectedSlug: "dundaing",
  },
  {
    reviewId: "74df20a4-1486-42a1-a6fe-e6b625c38728",
    trackId: "d8d3246e-6cec-4f06-8fa8-26c7934be591",
    expectedSlug: "maproso",
  },
  {
    reviewId: "e4150d85-72b5-4a4b-895b-59cacc81b658",
    trackId: "1995c0b8-e42c-4adb-924f-4e0ea1b59ef0",
    expectedSlug: "rhumba-japani",
  },
  {
    reviewId: "78ac6974-e6a8-4759-a2be-ce3fd979ab0b",
    trackId: "5ddfb449-a403-4793-bd8f-af8acd05cea2",
    expectedSlug: "tamashani",
  },
  {
    reviewId: "d723ff1e-31ad-42ff-9fe0-871c9b9e9b52",
    trackId: "16b3651a-1d71-4784-89a9-915f58be4200",
    expectedSlug: "trust-issues",
  },
];

const DUPLICATE_REVIEW_IDS = [
  "4894bfa2-8308-47d3-b502-6670082e0c61",
  "909afe2e-9f56-4923-ad6a-b9fc50cb4709",
  "6f52d662-3326-414e-a960-47ea27489564",
  "fd29049c-03e1-4005-a5dd-c412a5d7581f",
  "34e1696c-b7e8-45b6-8d0a-6ac7e7a89a76",
  "40f42e78-dfe4-4450-8693-f8c7f37571eb",
  "70e36b3f-909e-4470-acfe-8f411dda1a94",
  "e1e7d310-54aa-421c-97d7-542ef2427608",
  "d1cfb9fe-d338-455b-b57d-ea3c155560c9",
  "72df403c-ad7a-46f6-8478-64640ae1600f",
];

function sqlValues(rows) {
  return rows
    .map(
      (row) =>
        "('" +
        row.reviewId +
        "'::uuid,'" +
        row.trackId +
        "'::uuid,'" +
        row.expectedSlug +
        "'::text)",
    )
    .join(",\n");
}

function sqlUuidArray(values) {
  return (
    "array[" +
    values.map((value) => "'" + value + "'::uuid").join(",") +
    "]::uuid[]"
  );
}

function requireUuid(value, label) {
  const normalized = String(value || "").toLowerCase();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      normalized,
    )
  ) {
    throw new Error(label + " must be an exact UUID.");
  }
  return normalized;
}

function assertReviewedTrigger() {
  if (!TRIGGER_FILE) {
    throw new Error(
      "Batch A reviewed trigger file is required for Production mutation.",
    );
  }

  if (!fs.existsSync(TRIGGER_FILE)) {
    throw new Error(
      "Batch A reviewed trigger file is missing: " +
        TRIGGER_FILE,
    );
  }

  const trigger = JSON.parse(
    fs.readFileSync(TRIGGER_FILE, "utf8"),
  );

  const expectedSafe = SAFE_SLUG_ROWS
    .map((row) => row.reviewId)
    .sort();
  const expectedDuplicate = [...DUPLICATE_REVIEW_IDS].sort();
  const actualSafe = Array.isArray(trigger.safe_review_ids)
    ? [...trigger.safe_review_ids].map(String).sort()
    : [];
  const actualDuplicate = Array.isArray(
    trigger.duplicate_review_ids,
  )
    ? [...trigger.duplicate_review_ids].map(String).sort()
    : [];

  if (
    trigger.operation !==
      "public_music_identity_batch_a_safe_slug_apply" ||
    trigger.scope !==
      "public_music_identity_batch_a_safe_slug" ||
    Number(trigger.programme_issue) !== 1094 ||
    trigger.confirm !==
      "PUBLIC_MUSIC_IDENTITY_BATCH_A_SAFE_SLUG_APPLY" ||
    Number(trigger.expected_candidate_count) !==
      SAFE_SLUG_ROWS.length ||
    trigger.expected_candidate_fingerprint !==
      EXPECTED_CANDIDATE_FINGERPRINT ||
    trigger.expected_operation_key !== OPERATION_KEY ||
    trigger.expected_capability_key !== CAPABILITY_KEY ||
    JSON.stringify(actualSafe) !==
      JSON.stringify(expectedSafe) ||
    JSON.stringify(actualDuplicate) !==
      JSON.stringify(expectedDuplicate)
  ) {
    throw new Error(
      "Batch A reviewed trigger does not match the exact approved manifest.",
    );
  }

  const capabilityGrantId = requireUuid(
    trigger.capability_grant_id,
    "capability_grant_id",
  );

  console.log(
    "PASS: exact reviewed Batch A trigger manifest accepted",
  );

  return {
    ...trigger,
    capability_grant_id: capabilityGrantId,
  };
}

function assertHumanAuthority(trigger) {
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
    from platform_private.registry_operation_types
    where operation_key='${OPERATION_KEY}'
      and operation_version=1
      and capability_key='${CAPABILITY_KEY}'
      and enabled
  ) as operation_enabled,
  exists(
    select 1
    from platform_private.system_actor_capability_grants grant_row
    where grant_row.id='${grantId}'::uuid
      and grant_row.actor_key='mizizi'
      and grant_row.capability_key='${CAPABILITY_KEY}'
      and grant_row.status='active'
      and grant_row.valid_from<=now()
      and grant_row.expires_at>now()+interval '30 minutes'
      and grant_row.revoked_at is null
      and grant_row.scope @> jsonb_build_object(
        'operation_key','${OPERATION_KEY}',
        'operation_version',1,
        'subject_type','track',
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

  const expected = {
    close_migration_applied: true,
    operation_enabled: true,
    exact_human_grant: true,
    active_standing_total: 1,
    active_exact_total: 0,
  };

  for (const [key, value] of Object.entries(expected)) {
    if (String(state?.[key]) !== String(value)) {
      throw new Error(
        "Batch A human stewardship authority " +
          key +
          "=" +
          state?.[key] +
          " expected " +
          value,
      );
    }
  }

  console.log(
    "PASS: exact human Track-slug stewardship authority accepted",
  );
}

function assertZeroAtRest(label) {
  const state = queryViaLinkedCli(`
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
        'registry.chart_track_slug.synchronize',
        'registry.release_single_identity.align'
      )
      and enabled
  ) as enabled_operations
`);

  for (const [key, value] of Object.entries({
    active_standing: 0,
    active_exact: 0,
    unconsumed_exact: 0,
    enabled_operations: 0,
  })) {
    if (String(state?.[key]) !== String(value)) {
      throw new Error(
        label +
          " " +
          key +
          "=" +
          state?.[key] +
          " expected " +
          value,
      );
    }
  }

  return state;
}

async function closeAuthorityWindow(pool, trigger, reason) {
  const result = await pool.query(
    `
    select *
    from mizizi_private.close_stewardship_authority_window_v1(
      $1::text,
      $2::uuid,
      $3::text
    )
    `,
    [OPERATION_KEY, trigger.capability_grant_id, reason],
  );

  if (result.rowCount !== 1) {
    throw new Error(
      "Batch A authority-window close did not return one receipt.",
    );
  }

  return result.rows[0];
}

function assertExactMain() {
  if (!EXPECTED_MAIN || !/^[0-9a-f]{40}$/.test(EXPECTED_MAIN)) {
    throw new Error(
      "MIZIZI_EXPECTED_MAIN_SHA must be the exact 40-character protected-main SHA.",
    );
  }

  const head = runCommand(
    "git",
    ["rev-parse", "HEAD"],
    { capture: true },
  );

  if (head !== EXPECTED_MAIN) {
    throw new Error(
      "Batch A executor checkout " +
        head +
        " does not match expected main " +
        EXPECTED_MAIN,
    );
  }
}

function batchState() {
  const safeValues = sqlValues(SAFE_SLUG_ROWS);
  const duplicateReviewIds = sqlUuidArray(
    DUPLICATE_REVIEW_IDS,
  );

  return queryViaLinkedCli(`
with safe_manifest(review_id,track_id,expected_slug) as (
  values
  ${safeValues}
),
safe_state as (
  select
    manifest.review_id,
    manifest.track_id,
    manifest.expected_slug,
    review.status as review_status,
    track.status as track_status,
    track.slug as current_slug,
    decision.id as decision_id,
    decision.decision_type,
    decision.after_payload->>'proposedSlug' as decided_slug,
    decision.decided_by,
    decision.created_at as decision_created_at
  from safe_manifest manifest
  join public.registry_review_items review
    on review.id=manifest.review_id
   and review.source_id=manifest.track_id::text
  join public.registry_tracks track
    on track.id=manifest.track_id
  left join lateral (
    select candidate.*
    from public.registry_canonicalization_decisions candidate
    where candidate.review_item_id=manifest.review_id
      and candidate.status='recorded'
      and candidate.metadata->>'programmeKey'=
        'public_music_identity_track_actual_zero_v1'
    order by candidate.created_at desc,candidate.id desc
    limit 1
  ) decision on true
),
duplicate_state as (
  select
    review.id as review_id,
    review.status as review_status,
    source_track.id as source_track_id,
    source_track.status as source_track_status,
    decision.id as decision_id,
    decision.decision_type,
    decision.after_payload->>'canonicalTrackId'
      as canonical_track_id,
    decision.created_at as decision_created_at,
    decision.metadata->>'verifiedOperationId'
      as finalized_operation_id
  from public.registry_review_items review
  join public.registry_tracks source_track
    on source_track.id=review.source_id::uuid
  left join lateral (
    select candidate.*
    from public.registry_canonicalization_decisions candidate
    where candidate.review_item_id=review.id
      and candidate.status='recorded'
      and candidate.metadata->>'programmeKey'=
        'public_music_identity_track_actual_zero_v1'
    order by candidate.created_at desc,candidate.id desc
    limit 1
  ) decision on true
  where review.id=any(${duplicateReviewIds})
)
select
  (select count(*)::int from safe_state) as safe_rows,
  (
    select count(*)::int
    from safe_state
    where review_status='open'
      and track_status='active'
      and decision_type='public_music_identity_safe_slug_repair'
      and decided_slug=expected_slug
      and decision_id is not null
      and decided_by is not null
  ) as safe_ready,
  (
    select count(*)::int
    from duplicate_state
  ) as duplicate_rows,
  (
    select count(*)::int
    from duplicate_state
    where review_status='resolved'
      and source_track_status='archived'
      and decision_type='public_music_identity_true_duplicate'
      and decision_id is not null
      and canonical_track_id is not null
      and finalized_operation_id is not null
  ) as duplicate_resolved,
  (
    select jsonb_agg(
      jsonb_build_object(
        'reviewId',review_id,
        'trackId',track_id,
        'expectedSlug',expected_slug,
        'currentSlug',current_slug,
        'reviewStatus',review_status,
        'trackStatus',track_status,
        'decisionId',decision_id,
        'decisionType',decision_type,
        'decidedSlug',decided_slug,
        'decidedBy',decided_by,
        'decisionCreatedAt',decision_created_at
      )
      order by review_id
    )
    from safe_state
  )::text as safe_payload,
  (
    select jsonb_agg(
      jsonb_build_object(
        'reviewId',review_id,
        'reviewStatus',review_status,
        'sourceTrackId',source_track_id,
        'sourceTrackStatus',source_track_status,
        'decisionId',decision_id,
        'decisionType',decision_type,
        'canonicalTrackId',canonical_track_id,
        'finalizedOperationId',finalized_operation_id
      )
      order by review_id
    )
    from duplicate_state
  )::text as duplicate_payload
`);
}

function parsePayload(value, label) {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    if (!Array.isArray(parsed)) {
      throw new Error(label + " is not an array");
    }
    return parsed;
  } catch (error) {
    throw new Error(
      label +
        " is not valid JSON: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}

async function executeSafeSlug(jit, row, stateRow) {
  const plan = await jit.pool.query(
    `
    select *
    from mizizi_private.track_slug_plan_v1(
      $1::uuid
    )
    `,
    [row.trackId],
  );

  if (plan.rowCount !== 1) {
    throw new Error(
      "No exact Track slug plan for review " + row.reviewId,
    );
  }

  const planned = plan.rows[0];

  if (
    String(planned.current_slug || "") === row.expectedSlug ||
    String(planned.proposed_slug || "") !== row.expectedSlug
  ) {
    throw new Error(
      "Track slug plan drift for " +
        row.reviewId +
        ": current=" +
        String(planned.current_slug || "") +
        " proposed=" +
        String(planned.proposed_slug || "") +
        " expected=" +
        row.expectedSlug,
    );
  }

  const idempotencyKey =
    "pmi1094:" +
    row.reviewId +
    ":" +
    stateRow.decisionId;

  const grant = await jit.pool.query(
    `
    select *
    from mizizi_private.issue_stewardship_execution_grant_v1(
      'registry.track_slug.canonicalize'::text,
      $1::text,
      $2::text
    )
    `,
    [row.trackId, idempotencyKey],
  );

  if (
    grant.rowCount !== 1 ||
    !grant.rows[0]?.execution_grant_id
  ) {
    throw new Error(
      "Exact MIZIZI grant was not issued for " + row.reviewId,
    );
  }

  const executionGrantId =
    String(grant.rows[0].execution_grant_id);

  const execution = await jit.pool.query(
    `
    select *
    from mizizi_private.execute_stewardship_operation_v2(
      $1::uuid
    )
    `,
    [executionGrantId],
  );

  if (
    execution.rowCount !== 1 ||
    execution.rows[0]?.operation_status !== "succeeded" ||
    !execution.rows[0]?.operation_id
  ) {
    throw new Error(
      "MIZIZI Track slug execution failed for " + row.reviewId,
    );
  }

  const operationId =
    String(execution.rows[0].operation_id);

  const verification = await jit.pool.query(
    `
    select *
    from mizizi_private.verify_stewardship_operation_v2(
      $1::uuid
    )
    `,
    [operationId],
  );

  if (
    verification.rowCount !== 1 ||
    verification.rows[0]?.verifier_status !== "passed"
  ) {
    throw new Error(
      "MIZIZI Track slug verification failed for " + row.reviewId,
    );
  }

  console.log(
    "BATCH_A_SAFE_SLUG_OPERATION" +
      " reviewId=" +
      row.reviewId +
      " decisionId=" +
      stateRow.decisionId +
      " trackId=" +
      row.trackId +
      " expectedSlug=" +
      row.expectedSlug +
      " operationId=" +
      operationId,
  );

  return {
    reviewId: row.reviewId,
    decisionId: stateRow.decisionId,
    trackId: row.trackId,
    expectedSlug: row.expectedSlug,
    executionGrantId,
    operationId,
  };
}

async function main() {
  if (!TOKEN) {
    throw new Error(
      "SUPABASE_ACCESS_TOKEN repository secret is required.",
    );
  }

  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

  console.log(
    "=== PUBLIC MUSIC IDENTITY BATCH A SAFE-SLUG EXECUTOR ===",
  );

  assertExactMain();
  const trigger = assertReviewedTrigger();
  linkSupabaseProject(PROJECT_REF);
  assertHumanAuthority(trigger);

  const before = batchState();

  if (
    Number(before.safe_rows || 0) !== SAFE_SLUG_ROWS.length ||
    Number(before.safe_ready || 0) !== SAFE_SLUG_ROWS.length ||
    Number(before.duplicate_rows || 0) !==
      DUPLICATE_REVIEW_IDS.length ||
    Number(before.duplicate_resolved || 0) !==
      DUPLICATE_REVIEW_IDS.length
  ) {
    fs.writeFileSync(
      ARTIFACT_DIR + "/preflight-failed.json",
      JSON.stringify(before, null, 2) + "\n",
    );

    throw new Error(
      "Batch A is not ready for MIZIZI safe-slug execution. " +
        "Expected 5 recorded safe-slug decisions and 10 fully resolved duplicate reviews.",
    );
  }

  const safeState = parsePayload(
    before.safe_payload,
    "Batch A safe payload",
  );

  fs.writeFileSync(
    ARTIFACT_DIR + "/preflight.json",
    JSON.stringify(
      {
        expectedMain: EXPECTED_MAIN,
        safeState,
        duplicateState: parsePayload(
          before.duplicate_payload,
          "Batch A duplicate payload",
        ),
      },
      null,
      2,
    ) + "\n",
  );

  const byReview = new Map(
    safeState.map((row) => [String(row.reviewId), row]),
  );

  const jit = await openMiziziJitSession({
    projectRef: PROJECT_REF,
    token: TOKEN,
  });

  const operations = [];
  let primaryError = null;
  let closeError = null;
  let restoreError = null;
  let restError = null;

  try {
    for (const row of SAFE_SLUG_ROWS) {
      const stateRow = byReview.get(row.reviewId);

      if (
        !stateRow ||
        stateRow.expectedSlug !== row.expectedSlug ||
        stateRow.decisionType !==
          "public_music_identity_safe_slug_repair"
      ) {
        throw new Error(
          "Batch A safe decision manifest drift for " +
            row.reviewId,
        );
      }

      operations.push(
        await executeSafeSlug(jit, row, stateRow),
      );
    }
  } catch (error) {
    primaryError = error;
  }

  try {
    const closeReceipt = await closeAuthorityWindow(
      jit.pool,
      trigger,
      primaryError
        ? "close after failed governed Batch A safe-slug apply"
        : "close after accepted governed Batch A safe-slug apply",
    );

    fs.writeFileSync(
      ARTIFACT_DIR + "/authority-close.json",
      JSON.stringify(closeReceipt, null, 2) + "\n",
    );
  } catch (error) {
    closeError = error;
  }

  try {
    await jit.restore();
  } catch (error) {
    restoreError = error;
  }

  try {
    assertZeroAtRest("Batch A post-apply authority");
  } catch (error) {
    restError = error;
  }

  const lifecycleErrors = [
    primaryError
      ? "apply failed: " +
        (primaryError instanceof Error
          ? primaryError.message
          : String(primaryError))
      : null,
    closeError
      ? "authority close failed: " +
        (closeError instanceof Error
          ? closeError.message
          : String(closeError))
      : null,
    restoreError
      ? "JIT cleanup failed: " +
        (restoreError instanceof Error
          ? restoreError.message
          : String(restoreError))
      : null,
    restError
      ? "zero-at-rest verification failed: " +
        (restError instanceof Error
          ? restError.message
          : String(restError))
      : null,
  ].filter(Boolean);

  if (lifecycleErrors.length) {
    throw new Error(lifecycleErrors.join("; "));
  }

  const post = queryViaLinkedCli(`
select
  count(*)::int as canonicalized
from (
  values
  ${sqlValues(SAFE_SLUG_ROWS)}
) manifest(review_id,track_id,expected_slug)
join public.registry_tracks track
  on track.id=manifest.track_id
 and track.status='active'
 and track.slug=manifest.expected_slug
`);

  if (Number(post.canonicalized || 0) !== SAFE_SLUG_ROWS.length) {
    throw new Error(
      "Batch A postcondition failed: not all five safe-slug Tracks own their approved canonical slug.",
    );
  }

  fs.writeFileSync(
    ARTIFACT_DIR + "/safe-slug-operations.json",
    JSON.stringify(operations, null, 2) + "\n",
  );

  console.log(
    "PUBLIC_MUSIC_IDENTITY_BATCH_A_SAFE_SLUG_EXECUTOR=PASS",
  );
  console.log(
    "SAFE_SLUG_OPERATIONS=" + operations.length,
  );
  console.log(
    "NEXT_GATE=authenticated_admin_finalization_for_five_safe_slug_reviews",
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.stack || error.message : error,
  );
  process.exit(1);
});
