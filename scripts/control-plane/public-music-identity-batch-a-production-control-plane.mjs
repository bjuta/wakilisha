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
const ARTIFACT_DIR =
  process.env.MIZIZI_ARTIFACT_DIR ||
  "artifacts/public-music-identity-batch-a";

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
    from mizizi_private.execute_stewardship_operation_v1(
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
    from mizizi_private.verify_stewardship_operation_v1(
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
  linkSupabaseProject(PROJECT_REF);

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
    await jit.restore();
  } catch (restoreError) {
    if (primaryError) {
      throw new Error(
        (primaryError instanceof Error
          ? primaryError.message
          : String(primaryError)) +
          "; JIT cleanup also failed: " +
          (restoreError instanceof Error
            ? restoreError.message
            : String(restoreError)),
      );
    }
    throw restoreError;
  }

  if (primaryError) {
    throw primaryError;
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
