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
const LEGACY_REVIEWED_TRIGGER_FILE =
  ".github/mizizi-url-identity-production-apply.json";
const RELEASE_SINGLE_REVIEWED_TRIGGER_FILE =
  ".github/public-music-identity-release-single-alignment-apply.json";
const TRACK_ZERO_REVIEWED_TRIGGER_FILE =
  ".github/public-music-identity-track-slug-zero-apply.json";
const ARTIFACT_DIR =
  process.env.MIZIZI_ARTIFACT_DIR ||
  "artifacts/mizizi-url-identity-production-control-plane";

const CLOSE_MIGRATION_VERSION = "20260922143000";
const CLOSE_MIGRATION_NAME =
  "mizizi_url_identity_authority_window_close_v1";
const RELEASE_RESUME_MIGRATION_VERSION = "20260922171632";
const RELEASE_RESUME_MIGRATION_NAME =
  "mizizi_release_slug_resume_integrity_v1";
const RELEASE_SINGLE_ALIGNMENT_MIGRATION_VERSION =
  "20260925082706";
const RELEASE_SINGLE_ALIGNMENT_MIGRATION_NAME =
  "public_music_identity_slice3_release_single_alignment_v1";
const TRACK_ZERO_MIGRATION_VERSION = "20260925141117";
const TRACK_ZERO_MIGRATION_NAME =
  "public_music_identity_track_slug_zero_v2";
const EXPECTED_RELEASE_SINGLE_CANDIDATES = 80;
const EXPECTED_RELEASE_SINGLE_CANDIDATE_FINGERPRINT =
  "8cb08c3447b0e8acaf3279ef7b0317e915783b87a7e37678976b01fd02401eab";
const EXPECTED_RELEASE_SINGLE_REVIEWS = 35;
const EXPECTED_RELEASE_SINGLE_REVIEW_FINGERPRINT =
  "3e6ce99990ebd2e3bb5bbfd2600748da20104696bff3ced7875e4d5fe358638d";
const EXPECTED_TRACK_ZERO_CANDIDATES = 34;
const EXPECTED_TRACK_ZERO_CANDIDATE_FINGERPRINT =
  "1f178ed3aff1ac2ba998eefec42ac1f8abdb62ed4e70a93471715552399f5669";
const EXPECTED_TRACK_ZERO_IDENTITY_NOISE_REMAINING = 32;
const EXPECTED_TRACK_ZERO_CREDIT_GAP_REMAINING = 12;

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
    "9d17f2838aeed154d3b93abbcfe687ba6c38be94",
  "scripts/registry/agents/mizizi/core.ts":
    "164c9b5a0431b06f8d990b0aff6c6ef8a998aacb",
  "supabase/migrations/20260918173446_mizizi_stage_b_broker_convergence_v1.sql":
    "1cd6c591fe312225a8cbfa431b53063431127b77",
  "supabase/migrations/20260920095334_mizizi_stage_c_narrow_executor_transport_v1.sql":
    "b683e0097071899d9871d98b4cdde83a25be19b6",
  "supabase/migrations/20260922171632_mizizi_release_slug_resume_integrity_v1.sql":
    "14e5447a948f34e6f126fef73baef00098376c37",
  "supabase/migrations/20260925082706_public_music_identity_slice3_release_single_alignment_v1.sql":
    "bb2a936a8082a506d9b6e1ba94236c2b0aad446b",
  "supabase/migrations/20260925141117_public_music_identity_track_slug_zero_v2.sql":
    "4739ada00e2a50b1cd94074024db182d5cf004a0",
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
    maxRows: 1,
    triggerFile: LEGACY_REVIEWED_TRIGGER_FILE,
    triggerOperation: "mizizi_url_identity_production_apply",
    triggerConfirm: "MIZIZI_URL_IDENTITY_PRODUCTION_APPLY",
    programmeIssue: 1013,
  },
  chart_track_slug: {
    operationKey: "registry.chart_track_slug.synchronize",
    capabilityKey: "synchronize_chart_track_slug",
    entity: "chart",
    expectedCount: EXPECTED_CHART_CANDIDATES,
    expectedFingerprint:
      EXPECTED_CHART_CANDIDATE_FINGERPRINT,
    eventAction: "synchronize_chart_track_slug",
    maxRows: 1,
    triggerFile: LEGACY_REVIEWED_TRIGGER_FILE,
    triggerOperation: "mizizi_url_identity_production_apply",
    triggerConfirm: "MIZIZI_URL_IDENTITY_PRODUCTION_APPLY",
    programmeIssue: 1013,
  },
  track_slug_zero: {
    operationKey: "registry.track_slug.canonicalize",
    capabilityKey: "canonicalize_registry_track_slug",
    entity: "track_slug_zero",
    expectedCount: EXPECTED_TRACK_ZERO_CANDIDATES,
    expectedFingerprint:
      EXPECTED_TRACK_ZERO_CANDIDATE_FINGERPRINT,
    eventAction: "canonicalize_track_slug",
    maxRows: 1,
    triggerFile: TRACK_ZERO_REVIEWED_TRIGGER_FILE,
    triggerOperation:
      "public_music_identity_track_slug_zero_apply",
    triggerConfirm:
      "PUBLIC_MUSIC_IDENTITY_TRACK_SLUG_ZERO_APPLY",
    programmeIssue: 1068,
  },
  release_single_identity: {
    operationKey: "registry.release_single_identity.align",
    capabilityKey: "align_registry_release_single_identity",
    entity: "release_single_identity",
    expectedCount: EXPECTED_RELEASE_SINGLE_CANDIDATES,
    expectedFingerprint:
      EXPECTED_RELEASE_SINGLE_CANDIDATE_FINGERPRINT,
    expectedReviewCount: EXPECTED_RELEASE_SINGLE_REVIEWS,
    expectedReviewFingerprint:
      EXPECTED_RELEASE_SINGLE_REVIEW_FINGERPRINT,
    eventAction: "align_release_single_identity",
    maxRows: 2,
    triggerFile: RELEASE_SINGLE_REVIEWED_TRIGGER_FILE,
    triggerOperation:
      "public_music_identity_release_single_alignment_apply",
    triggerConfirm:
      "PUBLIC_MUSIC_IDENTITY_RELEASE_SINGLE_ALIGNMENT_APPLY",
    programmeIssue: 1068,
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
    const slugNoise = ruleCount(
      clean,
      "track_slug_identity_noise",
    );

    if (
      ![
        66,
        EXPECTED_TRACK_ZERO_IDENTITY_NOISE_REMAINING,
      ].includes(slugNoise)
    ) {
      throw new Error(
        "Track slug-identity audit state is outside the accepted programme boundary: " +
          slugNoise,
      );
    }

    assertFields(
      summary,
      {
        findings: 598 + slugNoise,
        applied: 0,
        queued: 0,
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
        mismatch: ruleCount(
          clean,
          "track_slug_identity_mismatch",
        ),
        creditEvidenceGap: ruleCount(
          clean,
          "track_slug_credit_evidence_gap",
        ),
        recordingIdentityConflict: ruleCount(
          clean,
          "track_recording_identity_conflict",
        ),
      },
      {
        titleNoise: 492,
        mismatch: 3,
        creditEvidenceGap: 12,
        recordingIdentityConflict: 91,
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
        findings: slugPackaging * 2,
        applied: 0,
        queued: 0,
        observed: slugPackaging,
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
        titlePackaging: slugPackaging,
        slugPackaging,
        taxonomy: 0,
      },
      "Release findings",
    );
    return;
  }

  if (entity === "chart") {
    const trackSlug =
      phase === "after"
        ? 0
        : Number(
            expectedCurrentCandidates ??
              EXPECTED_CHART_CANDIDATES,
          );

    assertFields(
      summary,
      {
        findings: trackSlug + 91,
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
        trackSlug,
        artistSlug: 91,
      },
      "Chart findings",
    );
  }
}


const trackZeroCandidateRowsSql = \`
with primary_artist as (
  select distinct on (credit.track_id)
    credit.track_id,
    credit.artist_slug
  from public.registry_track_artists credit
  where credit.status='active'
    and credit.is_primary is true
    and credit.artist_id is not null
    and nullif(btrim(credit.artist_slug),'') is not null
  order by
    credit.track_id,
    credit.credit_order nulls last,
    credit.created_at,
    credit.id
)
select
  review.id::text as review_id,
  track.id::text as track_id,
  track.slug as current_slug,
  review.candidate_payload->>'proposedValue' as proposed_slug,
  artist.artist_slug,
  review.source_payload->'evidence'->>'collision' as stale_blocker,
  platform_private.registry_subject_state_fingerprint(
    'track',
    track.id
  ) as state_fingerprint
from public.registry_review_items review
join public.registry_tracks track
  on track.id::text=review.source_id
 and track.status='active'
join primary_artist artist
  on artist.track_id=track.id
where review.status='open'
  and review.review_type='mizizi_data_hygiene'
  and review.entity_type='track'
  and review.source_payload->>'ruleId'='track_slug_identity_noise'
  and (
    review.source_payload->'evidence'->>'collision'
      like 'candidate_slug_collides_with_current_community_thread:%'
    or
    review.source_payload->'evidence'->>'collision'
      like 'current_community_thread_ownership_ambiguous:%'
  )
order by track.id
\`;

const trackZeroCandidateSql = \`
with plans as (
  \${trackZeroCandidateRowsSql}
),
payload as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'review_id',review_id,
        'track_id',track_id,
        'current_slug',current_slug,
        'proposed_slug',proposed_slug,
        'artist_slug',artist_slug,
        'stale_blocker',stale_blocker,
        'state_fingerprint',state_fingerprint
      )
      order by track_id
    ),
    '[]'::jsonb
  ) body
  from plans
)
select
  jsonb_array_length(body)::int as candidate_count,
  body::text as candidate_payload
from payload
\`;

const trackZeroClosureSql = \`
with decisions as (
  select
    decision.review_item_id,
    decision.entity_id,
    decision.after_payload->>'capabilityGrantId' as capability_grant_id
  from public.registry_canonicalization_decisions decision
  where decision.decision_type=
        'auto_resolved_stale_community_slug_blocker'
    and decision.metadata->>'programmeKey'=
        'public_music_identity_track_slug_zero'
    and decision.after_payload->>'candidateFingerprint'=
        '\${EXPECTED_TRACK_ZERO_CANDIDATE_FINGERPRINT}'
),
grants as (
  select distinct capability_grant_id::uuid as id
  from decisions
  where capability_grant_id ~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
),
operations as (
  select operation.id, operation.result_payload
  from platform_private.registry_execution_grants grant_row
  join grants
    on grants.id=grant_row.system_actor_capability_grant_id
  join platform_private.registry_mutation_operations operation
    on operation.execution_grant_id=grant_row.id
  where grant_row.actor_key='mizizi'
    and grant_row.operation_key='registry.track_slug.canonicalize'
    and grant_row.operation_version=1
    and operation.status='succeeded'
    and operation.verifier_status='passed'
),
events as (
  select distinct event.id
  from operations operation
  join public.registry_canonical_write_events event
    on event.id::text=
       operation.result_payload->>'canonical_write_event_id'
  where event.actor='system:mizizi'
    and event.action='canonicalize_track_slug'
    and event.status='succeeded'
)
select
  (select count(*)::int from decisions) as decision_count,
  (select count(distinct review_item_id)::int from decisions)
    as review_count,
  (select count(distinct entity_id)::int from decisions)
    as target_count,
  (select count(*)::int from grants) as capability_grant_count,
  (select count(*)::int from operations) as verified_operations,
  (select count(*)::int from events) as canonical_events,
  (
    select count(*)::int
    from public.registry_review_items review
    where review.status='resolved'
      and review.resolution_payload->>'programmeKey'=
          'public_music_identity_track_slug_zero'
      and review.resolution_payload->>'candidateFingerprint'=
          '\${EXPECTED_TRACK_ZERO_CANDIDATE_FINGERPRINT}'
  ) as resolved_reviews
\`;

const releaseSingleCandidateRowsSql = `
select
  candidate.release_id::text as release_id,
  candidate.track_id::text as track_id,
  candidate.primary_artist_id::text as primary_artist_id,
  candidate.primary_artist_slug,
  candidate.current_release_slug,
  candidate.proposed_release_slug,
  candidate.current_release_path,
  candidate.canonical_track_path,
  candidate.release_thread_id::text as release_thread_id,
  candidate.track_thread_id::text as track_thread_id,
  candidate.expected_release_state_fingerprint,
  candidate.expected_track_state_fingerprint,
  candidate.alignment_state_fingerprint,
  candidate.expected_row_budget
from public.registry_releases release
cross join lateral
  mizizi_private.release_single_identity_candidate_v1(
    release.id
  ) candidate
where release.status='active'
order by candidate.release_id
`;

const releaseSingleCandidateSql = `
with plans as (
  ${releaseSingleCandidateRowsSql}
),
payload as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'release_id',release_id,
        'track_id',track_id,
        'primary_artist_id',primary_artist_id,
        'primary_artist_slug',primary_artist_slug,
        'current_release_slug',current_release_slug,
        'proposed_release_slug',proposed_release_slug,
        'current_release_path',current_release_path,
        'canonical_track_path',canonical_track_path,
        'release_thread_id',release_thread_id,
        'track_thread_id',track_thread_id,
        'expected_release_state_fingerprint',
          expected_release_state_fingerprint,
        'expected_track_state_fingerprint',
          expected_track_state_fingerprint,
        'alignment_state_fingerprint',
          alignment_state_fingerprint,
        'expected_row_budget',expected_row_budget
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

const releaseSingleReviewPendingRowsSql = `
select
  candidate.release_id::text as release_id,
  candidate.track_id::text as track_id,
  candidate.current_release_slug,
  candidate.proposed_release_slug,
  candidate.release_primary_artist_id::text
    as release_primary_artist_id,
  candidate.release_primary_artist_slug,
  candidate.track_primary_artist_id::text
    as track_primary_artist_id,
  candidate.track_primary_artist_slug,
  candidate.current_release_path,
  candidate.canonical_track_path,
  candidate.release_thread_id::text as release_thread_id,
  candidate.track_thread_id::text as track_thread_id,
  to_jsonb(candidate.reason_codes) as reason_codes,
  candidate.alignment_state_fingerprint
from public.registry_releases release
cross join lateral
  mizizi_private.release_single_identity_review_candidate_v1(
    release.id
  ) candidate
where release.status='active'
  and not exists (
    select 1
    from public.registry_review_items review
    where review.review_type='mizizi_data_hygiene'
      and review.entity_type='release'
      and review.source_id=candidate.release_id::text
      and review.source_payload->>'ruleId'=
        'release_single_identity_conflict'
      and review.source_payload->>'ruleVersion'='1.4.0'
  )
order by candidate.release_id
`;

const releaseSingleReviewPendingSql = `
with plans as (
  ${releaseSingleReviewPendingRowsSql}
),
payload as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'release_id',release_id,
        'track_id',track_id,
        'current_release_slug',current_release_slug,
        'proposed_release_slug',proposed_release_slug,
        'release_primary_artist_id',release_primary_artist_id,
        'release_primary_artist_slug',release_primary_artist_slug,
        'track_primary_artist_id',track_primary_artist_id,
        'track_primary_artist_slug',track_primary_artist_slug,
        'current_release_path',current_release_path,
        'canonical_track_path',canonical_track_path,
        'release_thread_id',release_thread_id,
        'track_thread_id',track_thread_id,
        'reason_codes',reason_codes,
        'alignment_state_fingerprint',
          alignment_state_fingerprint
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
order by plan.release_id
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

const chartEligibleCountSql = `
select count(*)::int as candidate_count
from public.wk_chart_entries_v2 entry
join public.registry_tracks track
  on track.id::text=entry.canonical_track_id
 and track.status='active'
where entry.track_slug is distinct from track.slug
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


async function trackZeroClosureSnapshot(pool) {
  const result = await pool.query(trackZeroClosureSql);
  const row = result.rows[0] || {};
  return {
    decisionCount: Number(row.decision_count || 0),
    reviewCount: Number(row.review_count || 0),
    targetCount: Number(row.target_count || 0),
    capabilityGrantCount: Number(
      row.capability_grant_count || 0,
    ),
    verifiedOperations: Number(
      row.verified_operations || 0,
    ),
    canonicalEvents: Number(
      row.canonical_events || 0,
    ),
    resolvedReviews: Number(
      row.resolved_reviews || 0,
    ),
  };
}

async function executeTrackSlugZeroPlans(
  pool,
  expectedCount,
) {
  const frozen =
    await pool.query(trackZeroCandidateRowsSql);

  if (frozen.rowCount !== expectedCount) {
    throw new Error(
      "Track-slug zero exact target count drifted: " +
        frozen.rowCount +
        " expected " +
        expectedCount,
    );
  }

  const receipts = [];

  for (const row of frozen.rows) {
    const reviewId = String(row.review_id || "");
    const trackId = String(row.track_id || "");

    if (!reviewId || !trackId) {
      throw new Error(
        "Track-slug zero candidate identity is incomplete",
      );
    }

    const grantResult = await pool.query(
      `
      select *
      from mizizi_private.issue_stewardship_execution_grant_v1(
        $1::text,
        $2::text,
        $3::text
      )
      `,
      [
        "registry.track_slug.canonicalize",
        trackId,
        "public-music-track-zero:" + reviewId,
      ],
    );

    if (grantResult.rowCount !== 1) {
      throw new Error(
        "Track-slug zero exact execution grant was not issued for " +
          trackId,
      );
    }

    const executionGrantId = String(
      grantResult.rows[0]?.execution_grant_id || "",
    );

    if (!executionGrantId) {
      throw new Error(
        "Track-slug zero execution grant id is missing for " +
          trackId,
      );
    }

    const executionResult = await pool.query(
      `
      select *
      from mizizi_private.execute_stewardship_operation_v2(
        $1::uuid
      )
      `,
      [executionGrantId],
    );

    if (
      executionResult.rowCount !== 1 ||
      executionResult.rows[0]?.operation_status !==
        "succeeded"
    ) {
      throw new Error(
        "Track-slug zero V2 execution did not succeed for " +
          trackId,
      );
    }

    const operationId = String(
      executionResult.rows[0]?.operation_id || "",
    );

    if (!operationId) {
      throw new Error(
        "Track-slug zero operation id is missing for " +
          trackId,
      );
    }

    const verificationResult = await pool.query(
      `
      select *
      from mizizi_private.verify_stewardship_operation_v2(
        $1::uuid
      )
      `,
      [operationId],
    );

    if (
      verificationResult.rowCount !== 1 ||
      verificationResult.rows[0]?.verifier_status !==
        "passed"
    ) {
      throw new Error(
        "Track-slug zero independent verifier failed for " +
          trackId,
      );
    }

    const threadGuard = await pool.query(
      `
      select count(*)::int as mismatches
      from public.community_threads thread
      where thread.entity_type='track'
        and thread.entity_id=$1::text
        and (
          thread.entity_slug is distinct from $2::text
          or thread.entity_url is distinct from
             'https://' ||
             'wakilisha.africa/tracks/' ||
             $3::text ||
             '/' ||
             $2::text
        )
      `,
      [
        trackId,
        String(row.proposed_slug || ""),
        String(row.artist_slug || ""),
      ],
    );

    if (
      Number(threadGuard.rows[0]?.mismatches || 0) !== 0
    ) {
      throw new Error(
        "Track-slug zero UUID Community pointer verification failed for " +
          trackId,
      );
    }

    receipts.push({
      review_id: reviewId,
      track_id: trackId,
      execution_grant_id: executionGrantId,
      operation_id: operationId,
    });
  }

  return receipts;
}


async function queueReleaseSingleIdentityReviews(
  pool,
  expectedPending,
) {
  const frozen =
    await pool.query(releaseSingleReviewPendingRowsSql);

  if (frozen.rowCount !== expectedPending) {
    throw new Error(
      "Release Single identity review target count drifted: " +
        frozen.rowCount +
        " expected " +
        expectedPending,
    );
  }

  const receipts = [];

  for (const row of frozen.rows) {
    const releaseId =
      String(row.release_id || "");

    if (!releaseId) {
      throw new Error(
        "Release Single identity review target is missing Release id",
      );
    }

    const result = await pool.query(
      `
      select
        mizizi_private.queue_release_single_identity_review_v1(
          $1::uuid
        )::text as review_id
      `,
      [releaseId],
    );

    const reviewId =
      String(result.rows[0]?.review_id || "");

    if (result.rowCount !== 1 || !reviewId) {
      throw new Error(
        "Release Single identity review was not materialized for " +
          releaseId,
      );
    }

    receipts.push({
      release_id: releaseId,
      review_id: reviewId,
    });
  }

  return receipts;
}

async function executeReleaseSingleIdentityPlans(
  pool,
  expectedCount,
) {
  const frozen =
    await pool.query(releaseSingleCandidateRowsSql);

  if (frozen.rowCount !== expectedCount) {
    throw new Error(
      "Release Single identity exact target count drifted: " +
        frozen.rowCount +
        " expected " +
        expectedCount,
    );
  }

  const receipts = [];

  for (const row of frozen.rows) {
    const frozenPlan = {
      release_id: String(row.release_id || ""),
      track_id: String(row.track_id || ""),
      primary_artist_id:
        String(row.primary_artist_id || ""),
      primary_artist_slug:
        String(row.primary_artist_slug || ""),
      current_release_slug:
        String(row.current_release_slug || ""),
      proposed_release_slug:
        String(row.proposed_release_slug || ""),
      current_release_path:
        String(row.current_release_path || ""),
      canonical_track_path:
        String(row.canonical_track_path || ""),
      release_thread_id:
        String(row.release_thread_id || ""),
      track_thread_id:
        String(row.track_thread_id || ""),
      expected_release_state_fingerprint:
        String(
          row.expected_release_state_fingerprint || "",
        ),
      expected_track_state_fingerprint:
        String(
          row.expected_track_state_fingerprint || "",
        ),
      alignment_state_fingerprint:
        String(row.alignment_state_fingerprint || ""),
      expected_row_budget:
        Number(row.expected_row_budget || 0),
    };

    if (
      !frozenPlan.release_id ||
      !frozenPlan.track_id ||
      !frozenPlan.primary_artist_id ||
      !frozenPlan.primary_artist_slug ||
      !frozenPlan.current_release_slug ||
      !frozenPlan.proposed_release_slug ||
      !frozenPlan.current_release_path ||
      !frozenPlan.canonical_track_path ||
      !frozenPlan.expected_release_state_fingerprint ||
      !frozenPlan.expected_track_state_fingerprint ||
      !frozenPlan.alignment_state_fingerprint ||
      frozenPlan.expected_row_budget < 1 ||
      frozenPlan.expected_row_budget > 2
    ) {
      throw new Error(
        "Release Single identity frozen plan is incomplete: " +
          JSON.stringify(frozenPlan),
      );
    }

    const current = await pool.query(
      `
      select
        release_id::text,
        track_id::text,
        primary_artist_id::text,
        primary_artist_slug,
        current_release_slug,
        proposed_release_slug,
        current_release_path,
        canonical_track_path,
        release_thread_id::text as release_thread_id,
        track_thread_id::text as track_thread_id,
        expected_release_state_fingerprint,
        expected_track_state_fingerprint,
        alignment_state_fingerprint,
        expected_row_budget
      from mizizi_private.release_single_identity_plan_v1(
        $1::uuid
      )
      `,
      [frozenPlan.release_id],
    );

    if (current.rowCount !== 1) {
      throw new Error(
        "Release Single identity plan disappeared for " +
          frozenPlan.release_id,
      );
    }

    assertFields(
      {
        ...current.rows[0],
        release_thread_id:
          String(current.rows[0]?.release_thread_id || ""),
        track_thread_id:
          String(current.rows[0]?.track_thread_id || ""),
      },
      frozenPlan,
      "Release Single identity plan " +
        frozenPlan.release_id,
    );

    const idempotencyKey =
      "public-music-identity:release-single:" +
      sha256(JSON.stringify(frozenPlan));

    const grantResult = await pool.query(
      `
      select *
      from mizizi_private.issue_release_single_identity_execution_grant_v1(
        $1::uuid,
        $2::text
      )
      `,
      [frozenPlan.release_id,idempotencyKey],
    );

    const executionGrantId =
      String(
        grantResult.rows[0]?.execution_grant_id || "",
      );

    if (
      grantResult.rowCount !== 1 ||
      !executionGrantId
    ) {
      throw new Error(
        "Release Single identity exact grant was not issued for " +
          frozenPlan.release_id,
      );
    }

    const executionResult = await pool.query(
      `
      select *
      from mizizi_private.execute_release_single_identity_alignment_v1(
        $1::uuid
      )
      `,
      [executionGrantId],
    );

    const operationId =
      String(
        executionResult.rows[0]?.operation_id || "",
      );

    if (
      executionResult.rowCount !== 1 ||
      executionResult.rows[0]?.operation_status !==
        "succeeded" ||
      !operationId
    ) {
      throw new Error(
        "Release Single identity operation did not succeed for " +
          frozenPlan.release_id,
      );
    }

    const verificationResult = await pool.query(
      `
      select *
      from mizizi_private.verify_release_single_identity_alignment_v1(
        $1::uuid
      )
      `,
      [operationId],
    );

    if (
      verificationResult.rowCount !== 1 ||
      verificationResult.rows[0]?.verifier_status !==
        "passed"
    ) {
      throw new Error(
        "Release Single identity verifier did not pass for " +
          frozenPlan.release_id,
      );
    }

    receipts.push({
      release_id: frozenPlan.release_id,
      track_id: frozenPlan.track_id,
      execution_grant_id: executionGrantId,
      operation_id: operationId,
      verifier_status: "passed",
    });
  }

  return receipts;
}

async function executeReleaseResumePlans(pool) {
  const frozen = await pool.query(releaseCandidateRowsSql);

  if (
    frozen.rowCount !==
    ACCEPTED_RELEASE_PARTIAL_REMAINING
  ) {
    throw new Error(
      "Release resume exact target count drifted: " +
        frozen.rowCount,
    );
  }

  const receipts = [];

  for (const row of frozen.rows) {
    const releaseId =
      String(row.release_id || "");
    const frozenPlan = {
      release_id: releaseId,
      artist_id: String(row.artist_id || ""),
      artist_slug: String(row.artist_slug || ""),
      current_slug: String(row.current_slug || ""),
      proposed_slug: String(row.proposed_slug || ""),
      uses_date_fallback:
        Boolean(row.uses_date_fallback),
      expected_state_fingerprint:
        String(
          row.expected_state_fingerprint || "",
        ),
    };

    if (
      !releaseId ||
      !frozenPlan.artist_id ||
      !frozenPlan.current_slug ||
      !frozenPlan.proposed_slug ||
      !frozenPlan.expected_state_fingerprint
    ) {
      throw new Error(
        "Release resume plan is incomplete: " +
          JSON.stringify(frozenPlan),
      );
    }

    const current = await pool.query(
      `
      select
        release_id::text,
        artist_id::text,
        artist_slug,
        current_slug,
        proposed_slug,
        uses_date_fallback,
        expected_state_fingerprint
      from mizizi_private.release_slug_plan_v1(
        $1::uuid
      )
      `,
      [releaseId],
    );

    if (current.rowCount !== 1) {
      throw new Error(
        "Release resume plan disappeared for " +
          releaseId,
      );
    }

    assertFields(
      current.rows[0],
      frozenPlan,
      "Release resume plan " + releaseId,
    );

    const idempotencyKey =
      "mizizi:release_slug_provider_packaging:resume:" +
      sha256(JSON.stringify(frozenPlan));

    const grantResult = await pool.query(
      `
      select *
      from mizizi_private.issue_stewardship_execution_grant_v1(
        $1::text,
        $2::text,
        $3::text
      )
      `,
      [
        APPLY_SCOPES.release_slug.operationKey,
        releaseId,
        idempotencyKey,
      ],
    );

    const executionGrantId =
      String(
        grantResult.rows[0]?.execution_grant_id || "",
      );

    if (
      grantResult.rowCount !== 1 ||
      !executionGrantId
    ) {
      throw new Error(
        "Release resume exact execution grant was not issued for " +
          releaseId,
      );
    }

    const executionResult = await pool.query(
      `
      select *
      from mizizi_private.execute_stewardship_operation_v1(
        $1::uuid
      )
      `,
      [executionGrantId],
    );

    const operationId =
      String(
        executionResult.rows[0]?.operation_id || "",
      );

    if (
      executionResult.rowCount !== 1 ||
      executionResult.rows[0]?.operation_status !==
        "succeeded" ||
      !operationId
    ) {
      throw new Error(
        "Release resume typed operation did not succeed for " +
          releaseId,
      );
    }

    const verificationResult = await pool.query(
      `
      select *
      from mizizi_private.verify_stewardship_operation_v1(
        $1::uuid
      )
      `,
      [operationId],
    );

    if (
      verificationResult.rowCount !== 1 ||
      verificationResult.rows[0]?.verifier_status !==
        "passed"
    ) {
      throw new Error(
        "Release resume verifier did not pass for " +
          releaseId,
      );
    }

    receipts.push({
      release_id: releaseId,
      execution_grant_id: executionGrantId,
      operation_id: operationId,
      verifier_status: "passed",
    });
  }

  fs.writeFileSync(
    ARTIFACT_DIR + "/apply.txt",
    JSON.stringify(
      {
        mode: "accepted_partial_release_resume",
        count: receipts.length,
        receipts,
      },
      null,
      2,
    ) + "\n",
  );

  return receipts;
}


function releaseSingleProgrammeSnapshotFromHistory(
  currentCandidatePayload,
) {
  const escapedCurrent =
    String(currentCandidatePayload || "[]").replaceAll(
      "'",
      "''",
    );

  const row = queryViaLinkedCli(`
with current_plans as (
  select value as candidate
  from jsonb_array_elements(
    '${escapedCurrent}'::jsonb
  )
),
succeeded_plans as (
  select event.after_value->'programme_candidate'
    as candidate
  from public.registry_canonical_write_events event
  join platform_private.registry_operation_write_events link
    on link.canonical_write_event_id=event.id
  join platform_private.registry_mutation_operations operation
    on operation.id=link.operation_id
  where event.actor='system:mizizi'
    and event.action='align_release_single_identity'
    and event.status='succeeded'
    and operation.actor_key='mizizi'
    and operation.operation_key=
      'registry.release_single_identity.align'
    and operation.operation_version=1
    and operation.status='succeeded'
    and operation.verifier_status='passed'
),
programme as (
  select candidate from succeeded_plans
  union all
  select candidate from current_plans
),
stats as (
  select
    count(*)::int as row_count,
    count(distinct candidate->>'release_id')::int
      as distinct_release_count,
    coalesce(
      jsonb_agg(
        candidate
        order by candidate->>'release_id'
      ),
      '[]'::jsonb
    ) as body
  from programme
)
select
  row_count as candidate_count,
  distinct_release_count,
  body::text as candidate_payload
from stats
`);

  if (
    Number(row.distinct_release_count) !==
    Number(row.candidate_count)
  ) {
    throw new Error(
      "Release Single identity programme contains duplicate Release targets",
    );
  }

  return candidateSnapshot(row);
}

function releaseSingleReviewProgrammeSnapshotFromHistory(
  currentCandidatePayload,
) {
  const escapedCurrent =
    String(currentCandidatePayload || "[]").replaceAll(
      "'",
      "''",
    );

  const row = queryViaLinkedCli(`
with current_plans as (
  select value as candidate
  from jsonb_array_elements(
    '${escapedCurrent}'::jsonb
  )
),
materialized_reviews as (
  select review.source_payload->'programmeCandidate'
    as candidate
  from public.registry_review_items review
  where review.review_type='mizizi_data_hygiene'
    and review.entity_type='release'
    and review.source_payload->>'ruleId'=
      'release_single_identity_conflict'
    and review.source_payload->>'ruleVersion'='1.4.0'
),
programme as (
  select candidate from materialized_reviews
  union all
  select candidate from current_plans
),
stats as (
  select
    count(*)::int as row_count,
    count(distinct candidate->>'release_id')::int
      as distinct_release_count,
    coalesce(
      jsonb_agg(
        candidate
        order by candidate->>'release_id'
      ),
      '[]'::jsonb
    ) as body
  from programme
)
select
  row_count as candidate_count,
  distinct_release_count,
  body::text as candidate_payload
from stats
`);

  if (
    Number(row.distinct_release_count) !==
    Number(row.candidate_count)
  ) {
    throw new Error(
      "Release Single identity review programme contains duplicate Release targets",
    );
  }

  return candidateSnapshot(row);
}

function releaseProgrammeSnapshotFromHistory(
  currentCandidatePayload,
) {
  const escapedCurrent =
    String(currentCandidatePayload || "[]").replaceAll(
      "'",
      "''",
    );

  const row = queryViaLinkedCli(`
with current_plans as (
  select
    value->>'release_id' as release_id,
    value->>'artist_id' as artist_id,
    value->>'artist_slug' as artist_slug,
    value->>'current_slug' as current_slug,
    value->>'proposed_slug' as proposed_slug,
    (value->>'uses_date_fallback')::boolean
      as uses_date_fallback,
    value->>'expected_state_fingerprint'
      as expected_state_fingerprint
  from jsonb_array_elements(
    '${escapedCurrent}'::jsonb
  )
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
`);

  return candidateSnapshot(row);
}

function chartProgrammeSnapshotFromHistory(
  currentCandidatePayload,
) {
  const escapedCurrent =
    String(currentCandidatePayload || "[]").replaceAll(
      "'",
      "''",
    );

  const row = queryViaLinkedCli(`
with current_plans as (
  select
    value->>'chart_entry_id' as chart_entry_id,
    value->>'current_track_slug' as current_track_slug,
    value->>'canonical_track_id' as canonical_track_id,
    value->>'canonical_track_slug' as canonical_track_slug,
    value->>'expected_track_state_fingerprint'
      as expected_track_state_fingerprint
  from jsonb_array_elements(
    '${escapedCurrent}'::jsonb
  )
),
succeeded_plans as (
  select
    grant_row.plan_payload->>'chart_entry_id'
      as chart_entry_id,
    grant_row.plan_payload->>'current_track_slug'
      as current_track_slug,
    grant_row.plan_payload->>'canonical_track_id'
      as canonical_track_id,
    grant_row.plan_payload->>'canonical_track_slug'
      as canonical_track_slug,
    grant_row.plan_payload->>'expected_state_fingerprint'
      as expected_track_state_fingerprint
  from platform_private.registry_execution_grants grant_row
  join platform_private.registry_mutation_operations operation
    on operation.execution_grant_id=grant_row.id
  where grant_row.actor_key='mizizi'
    and grant_row.operation_key=
      'registry.chart_track_slug.synchronize'
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
  from programme
)
select
  jsonb_array_length(body)::int as candidate_count,
  body::text as candidate_payload
from payload
`);

  return candidateSnapshot(row);
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
        'registry.chart_track_slug.synchronize',
        'registry.release_single_identity.align'
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
  const chartResult =
    await pool.query(chartCandidateSql);
  const trackZeroResult =
    await pool.query(trackZeroCandidateSql);

  const releaseCurrent =
    candidateSnapshot(releaseCurrentResult.rows[0]);
  const chartCurrent =
    candidateSnapshot(chartResult.rows[0]);
  const trackZeroCurrent =
    candidateSnapshot(trackZeroResult.rows[0]);
  const trackZeroClosure =
    await trackZeroClosureSnapshot(pool);
  const trackZeroMigrationReady =
    trackZeroMigrationApplied();
  const releaseJournal =
    journalSnapshot(APPLY_SCOPES.release_slug);
  const chartJournal =
    journalSnapshot(APPLY_SCOPES.chart_track_slug);

  if (
    Number(releaseJournal.verified_operations) !==
    Number(releaseJournal.canonical_events)
  ) {
    throw new Error(
      "Release slug journal/write-event parity is not exact",
    );
  }

  if (
    Number(chartJournal.verified_operations) !==
    Number(chartJournal.canonical_events)
  ) {
    throw new Error(
      "Chart Track-slug journal/write-event parity is not exact",
    );
  }

  let releaseState = "";
  let releaseProgramme = null;

  if (
    Number(releaseJournal.verified_operations) === 0 &&
    releaseCurrent.candidateCount ===
      EXPECTED_RELEASE_CANDIDATES &&
    releaseCurrent.candidateFingerprint ===
      EXPECTED_RELEASE_CANDIDATE_FINGERPRINT
  ) {
    releaseState = "pristine";
    releaseProgramme = releaseCurrent;
  } else if (
    Number(releaseJournal.verified_operations) ===
      ACCEPTED_RELEASE_PARTIAL_VERIFIED &&
    releaseCurrent.candidateCount ===
      ACCEPTED_RELEASE_PARTIAL_REMAINING &&
    releaseCurrent.candidateFingerprint ===
      EXPECTED_RELEASE_RESUME_CANDIDATE_FINGERPRINT
  ) {
    releaseState = "accepted_partial";
    releaseProgramme =
      releaseProgrammeSnapshotFromHistory(
        releaseCurrentResult.rows[0]
          ?.candidate_payload,
      );
  } else if (
    Number(releaseJournal.verified_operations) ===
      EXPECTED_RELEASE_CANDIDATES &&
    releaseCurrent.candidateCount === 0
  ) {
    releaseState = "accepted_final";
    releaseProgramme =
      releaseProgrammeSnapshotFromHistory("[]");
  } else {
    throw new Error(
      "Release slug programme state is not a recognized exact boundary: " +
        JSON.stringify({
          journal: releaseJournal,
          current: releaseCurrent,
        }),
    );
  }

  assertFields(
    releaseProgramme,
    {
      candidateCount: EXPECTED_RELEASE_CANDIDATES,
      candidateFingerprint:
        EXPECTED_RELEASE_CANDIDATE_FINGERPRINT,
    },
    "Release slug programme freeze",
  );

  let chartState = "";
  let chartProgramme = null;

  if (
    Number(chartJournal.verified_operations) === 0 &&
    chartCurrent.candidateCount ===
      EXPECTED_CHART_CANDIDATES &&
    chartCurrent.candidateFingerprint ===
      EXPECTED_CHART_CANDIDATE_FINGERPRINT
  ) {
    chartState = "pristine";
    chartProgramme = chartCurrent;
  } else if (
    Number(chartJournal.verified_operations) ===
      EXPECTED_CHART_CANDIDATES &&
    chartCurrent.candidateCount === 0
  ) {
    chartState = "accepted_final";
    chartProgramme =
      chartProgrammeSnapshotFromHistory("[]");
  } else {
    throw new Error(
      "Chart Track-slug programme state is not a recognized exact boundary: " +
        JSON.stringify({
          journal: chartJournal,
          current: chartCurrent,
        }),
    );
  }

  assertFields(
    chartProgramme,
    {
      candidateCount: EXPECTED_CHART_CANDIDATES,
      candidateFingerprint:
        EXPECTED_CHART_CANDIDATE_FINGERPRINT,
    },
    "Chart Track-slug programme freeze",
  );

  let trackZeroState = "";

  const trackZeroClosureEmpty =
    Object.values(trackZeroClosure).every(
      (value) => Number(value) === 0,
    );

  if (
    trackZeroClosureEmpty &&
    trackZeroCurrent.candidateCount ===
      EXPECTED_TRACK_ZERO_CANDIDATES &&
    trackZeroCurrent.candidateFingerprint ===
      EXPECTED_TRACK_ZERO_CANDIDATE_FINGERPRINT
  ) {
    trackZeroState = "pristine";
  } else if (
    trackZeroCurrent.candidateCount === 0 &&
    trackZeroClosure.decisionCount ===
      EXPECTED_TRACK_ZERO_CANDIDATES &&
    trackZeroClosure.reviewCount ===
      EXPECTED_TRACK_ZERO_CANDIDATES &&
    trackZeroClosure.targetCount ===
      EXPECTED_TRACK_ZERO_CANDIDATES &&
    trackZeroClosure.capabilityGrantCount === 1 &&
    trackZeroClosure.verifiedOperations ===
      EXPECTED_TRACK_ZERO_CANDIDATES &&
    trackZeroClosure.canonicalEvents ===
      EXPECTED_TRACK_ZERO_CANDIDATES &&
    trackZeroClosure.resolvedReviews ===
      EXPECTED_TRACK_ZERO_CANDIDATES
  ) {
    trackZeroState = "accepted_final";
  } else {
    throw new Error(
      "Track-slug zero programme state is not a recognized exact boundary: " +
        JSON.stringify({
          current: trackZeroCurrent,
          closure: trackZeroClosure,
        }),
    );
  }

  let releaseSingleProgramme = null;
  let releaseSingleCurrent = {
    candidateCount: 0,
    candidateFingerprint: "",
  };
  let releaseSingleState = "migration_pending";
  let releaseSingleReviewProgramme = null;
  let releaseSingleReviewPending = {
    candidateCount: 0,
    candidateFingerprint: "",
  };
  let releaseSingleReviewState =
    "migration_pending";
  const releaseSingleJournal =
    journalSnapshot(
      APPLY_SCOPES.release_single_identity,
    );

  if (
    Number(releaseSingleJournal.verified_operations) !==
    Number(releaseSingleJournal.canonical_events)
  ) {
    throw new Error(
      "Release Single identity journal/write-event parity is not exact",
    );
  }

  if (releaseSingleAlignmentMigrationApplied()) {
    const releaseSingleResult =
      await pool.query(releaseSingleCandidateSql);
    const reviewPendingResult =
      await pool.query(
        releaseSingleReviewPendingSql,
      );

    releaseSingleCurrent =
      candidateSnapshot(
        releaseSingleResult.rows[0],
      );
    releaseSingleReviewPending =
      candidateSnapshot(
        reviewPendingResult.rows[0],
      );

    releaseSingleProgramme =
      releaseSingleProgrammeSnapshotFromHistory(
        releaseSingleResult.rows[0]
          ?.candidate_payload,
      );

    releaseSingleReviewProgramme =
      releaseSingleReviewProgrammeSnapshotFromHistory(
        reviewPendingResult.rows[0]
          ?.candidate_payload,
      );

    assertFields(
      releaseSingleProgramme,
      {
        candidateCount:
          EXPECTED_RELEASE_SINGLE_CANDIDATES,
        candidateFingerprint:
          EXPECTED_RELEASE_SINGLE_CANDIDATE_FINGERPRINT,
      },
      "Release Single identity programme freeze",
    );

    assertFields(
      releaseSingleReviewProgramme,
      {
        candidateCount:
          EXPECTED_RELEASE_SINGLE_REVIEWS,
        candidateFingerprint:
          EXPECTED_RELEASE_SINGLE_REVIEW_FINGERPRINT,
      },
      "Release Single identity review programme freeze",
    );

    const verified = Number(
      releaseSingleJournal.verified_operations,
    );

    if (
      verified +
        releaseSingleCurrent.candidateCount !==
      EXPECTED_RELEASE_SINGLE_CANDIDATES
    ) {
      throw new Error(
        "Release Single identity current/history count is not exact",
      );
    }

    releaseSingleState =
      verified === 0
        ? "pristine"
        : verified ===
            EXPECTED_RELEASE_SINGLE_CANDIDATES
          ? "accepted_final"
          : "accepted_partial";

    const reviewPending =
      releaseSingleReviewPending.candidateCount;

    releaseSingleReviewState =
      reviewPending ===
        EXPECTED_RELEASE_SINGLE_REVIEWS
        ? "pristine"
        : reviewPending === 0
          ? "materialized"
          : "materialized_partial";
  }

  return {
    releaseProgramme,
    releaseCurrent,
    releaseState,
    releaseJournal,
    chartProgramme,
    chartCurrent,
    chartState,
    chartJournal,
    trackZeroCurrent,
    trackZeroClosure,
    trackZeroState,
    trackZeroMigrationReady,
    releaseSingleProgramme,
    releaseSingleCurrent,
    releaseSingleState,
    releaseSingleJournal,
    releaseSingleReviewProgramme,
    releaseSingleReviewPending,
    releaseSingleReviewState,
  };
}



function trackZeroMigrationApplied() {
  const state = queryViaLinkedCli(`
select exists(
  select 1
  from supabase_migrations.schema_migrations
  where version='${TRACK_ZERO_MIGRATION_VERSION}'
    and name='${TRACK_ZERO_MIGRATION_NAME}'
) as applied
`);

  return String(state.applied) === "true";
}


function releaseSingleAlignmentMigrationApplied() {
  const state = queryViaLinkedCli(`
select exists(
  select 1
  from supabase_migrations.schema_migrations
  where version='${RELEASE_SINGLE_ALIGNMENT_MIGRATION_VERSION}'
    and name='${RELEASE_SINGLE_ALIGNMENT_MIGRATION_NAME}'
) as applied
`);

  return String(state.applied) === "true";
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

function readReviewedTrigger(path) {
  if (!path || !fs.existsSync(path)) {
    throw new Error(
      "reviewed URL-identity production trigger is missing",
    );
  }

  const trigger = JSON.parse(
    fs.readFileSync(path, "utf8"),
  );

  const scope = APPLY_SCOPES[trigger.scope];

  if (!scope) {
    throw new Error(
      "production trigger scope is not an accepted URL-identity scope",
    );
  }

  if (
    trigger.operation !== scope.triggerOperation ||
    trigger.confirm !== scope.triggerConfirm ||
    Number(trigger.programme_issue) !==
      scope.programmeIssue ||
    path !== scope.triggerFile
  ) {
    throw new Error(
      "production trigger identity is not exact",
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

  if (scope.expectedReviewCount !== undefined) {
    assertFields(
      trigger,
      {
        expected_review_count:
          scope.expectedReviewCount,
        expected_review_fingerprint:
          scope.expectedReviewFingerprint,
      },
      "production review trigger",
    );
  }

  return {
    ...trigger,
    capability_grant_id: requireUuid(
      trigger.capability_grant_id,
      "capability_grant_id",
    ),
    scopeConfig: scope,
  };
}

function readApplyTrigger() {
  if (!EXPECTED_MAIN || !TRIGGER_FILE) {
    throw new Error(
      "reviewed URL-identity production trigger is missing",
    );
  }

  return readReviewedTrigger(TRIGGER_FILE);
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
        'max_rows',${scope.maxRows}
      )
  ) as exact_human_grant,
  exists(
    select 1
    from supabase_migrations.schema_migrations
    where version='${RELEASE_SINGLE_ALIGNMENT_MIGRATION_VERSION}'
      and name='${RELEASE_SINGLE_ALIGNMENT_MIGRATION_NAME}'
  ) as release_single_alignment_migration_applied,
  exists(
    select 1
    from supabase_migrations.schema_migrations
    where version='${TRACK_ZERO_MIGRATION_VERSION}'
      and name='${TRACK_ZERO_MIGRATION_NAME}'
  ) as track_zero_migration_applied,
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

  if (
    scope.entity === "release_single_identity" &&
    String(
      state.release_single_alignment_migration_applied,
    ) !== "true"
  ) {
    throw new Error(
      "Release Single identity alignment migration is not Production applied",
    );
  }

  if (
    scope.entity === "track_slug_zero" &&
    String(state.track_zero_migration_applied) !==
      "true"
  ) {
    throw new Error(
      "Track-slug zero V2 migration is not Production applied",
    );
  }
}

function assertPreflightAuthority() {
  const state = queryViaLinkedCli(atRestAuthoritySql);

  const zeroAtRest =
    Number(state.active_standing) === 0 &&
    Number(state.active_exact) === 0 &&
    Number(state.unconsumed_exact) === 0 &&
    Number(state.enabled_operations) === 0;

  if (zeroAtRest) {
    return {
      mode: "zero_at_rest",
      state,
      trigger: null,
    };
  }

  assertFields(
    state,
    {
      active_standing: 1,
      active_exact: 0,
      unconsumed_exact: 0,
      enabled_operations: 1,
    },
    "preflight reviewed authority census",
  );

  const active = queryViaLinkedCli(`
select
  capability_key,
  scope->>'operation_key' as operation_key
from platform_private.system_actor_capability_grants
where actor_key='mizizi'
  and status='active'
  and valid_from<=now()
  and expires_at>now()
  and revoked_at is null
limit 1
`);

  const activeScope = Object.values(APPLY_SCOPES).find(
    (scope) =>
      scope.operationKey === active.operation_key &&
      scope.capabilityKey === active.capability_key,
  );

  if (!activeScope) {
    throw new Error(
      "active MIZIZI human authority is outside the accepted URL-identity scopes",
    );
  }

  const trigger =
    readReviewedTrigger(activeScope.triggerFile);

  assertHumanAuthority(trigger);

  return {
    mode: "reviewed_human_authority",
    state,
    trigger: {
      scope: trigger.scope,
      capability_grant_id:
        trigger.capability_grant_id,
      expected_candidate_count:
        trigger.expected_candidate_count,
      expected_candidate_fingerprint:
        trigger.expected_candidate_fingerprint,
      expected_review_count:
        trigger.expected_review_count ?? null,
      expected_review_fingerprint:
        trigger.expected_review_fingerprint ?? null,
    },
  };
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
  applySucceeded,
) {
  const isTrackZero =
    trigger.scopeConfig.entity === "track_slug_zero";
  const isReleaseSingle =
    trigger.scopeConfig.entity ===
      "release_single_identity";

  const result =
    isTrackZero && applySucceeded
      ? await pool.query(
          `
          select *
          from mizizi_private.finalize_track_slug_zero_convergence_v1(
            $1::uuid
          )
          `,
          [trigger.capability_grant_id],
        )
      : isReleaseSingle
        ? await pool.query(
            `
            select *
            from mizizi_private.close_release_single_identity_authority_window_v1(
              $1::uuid,
              $2::text
            )
            `,
            [
              trigger.capability_grant_id,
              reason,
            ],
          )
        : await pool.query(
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

  if (isTrackZero && applySucceeded) {
    assertFields(
      result.rows[0],
      {
        resolved_reviews:
          EXPECTED_TRACK_ZERO_CANDIDATES,
        decision_rows:
          EXPECTED_TRACK_ZERO_CANDIDATES,
        standing_grant_status: "expired",
      },
      "Track-slug zero finalizer receipt",
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
    const preflightAuthority =
      assertPreflightAuthority();

    fs.writeFileSync(
      ARTIFACT_DIR + "/entry-authority.json",
      JSON.stringify(
        preflightAuthority,
        null,
        2,
      ) + "\n",
    );

    console.log(
      "PASS: preflight entry authority = " +
        preflightAuthority.mode,
    );
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
    const chartCountResult =
      await jit.pool.query(chartEligibleCountSql);
    const currentChartCandidates =
      Number(
        chartCountResult.rows[0]?.candidate_count || 0,
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
    await runAudit(
      jit.url,
      "chart",
      "before",
      currentChartCandidates,
    );

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
      console.log(
        "Chart programme state: " +
          candidates.chartState,
      );
      console.log(
        "Release Single identity programme state: " +
          candidates.releaseSingleState,
      );
      console.log(
        "Release Single review state: " +
          candidates.releaseSingleReviewState,
      );
      console.log(
        "Track-slug zero programme state: " +
          candidates.trackZeroState,
      );
      console.log(
        "Track-slug zero migration ready: " +
          candidates.trackZeroMigrationReady,
      );
      console.log("Registry mutation: NO");
      return;
    }

    const scope = trigger.scopeConfig;
    const before = journalSnapshot(scope);
    const expectedApplyCount =
      scope.entity === "release"
        ? candidates.releaseCurrent.candidateCount
        : scope.entity === "release_single_identity"
          ? candidates.releaseSingleCurrent.candidateCount
          : scope.entity === "track_slug_zero"
            ? candidates.trackZeroCurrent.candidateCount
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

    if (
      scope.entity === "release_single_identity" &&
      !["pristine", "accepted_partial"].includes(
        candidates.releaseSingleState,
      )
    ) {
      throw new Error(
        "Release Single identity apply cannot start from " +
          candidates.releaseSingleState,
      );
    }

    if (
      scope.entity === "track_slug_zero" &&
      (
        candidates.trackZeroState !== "pristine" ||
        !candidates.trackZeroMigrationReady
      )
    ) {
      throw new Error(
        "Track-slug zero apply cannot start from " +
          candidates.trackZeroState +
          " / migrationReady=" +
          candidates.trackZeroMigrationReady,
      );
    }

    const trackRedirectsBefore =
      scope.entity === "track_slug_zero"
        ? Number(
            queryViaLinkedCli(`
select count(*)::int as track_redirects
from public.wk_slug_redirects
where entity_type='track'
`).track_redirects || 0,
          )
        : null;

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
      if (scope.entity === "track_slug_zero") {
        const operationReceipts =
          await executeTrackSlugZeroPlans(
            jit.pool,
            expectedApplyCount,
          );

        fs.writeFileSync(
          ARTIFACT_DIR + "/apply.txt",
          JSON.stringify(
            {
              mode: "track_slug_zero_v2",
              operations_verified:
                operationReceipts.length,
              operation_receipts:
                operationReceipts,
            },
            null,
            2,
          ) + "\n",
        );
      } else if (
        scope.entity === "release_single_identity"
      ) {
        const reviewReceipts =
          await queueReleaseSingleIdentityReviews(
            jit.pool,
            candidates
              .releaseSingleReviewPending
              .candidateCount,
          );

        const operationReceipts =
          await executeReleaseSingleIdentityPlans(
            jit.pool,
            expectedApplyCount,
          );

        fs.writeFileSync(
          ARTIFACT_DIR + "/apply.txt",
          JSON.stringify(
            {
              mode:
                "release_single_identity_alignment",
              reviews_materialized:
                reviewReceipts.length,
              operations_verified:
                operationReceipts.length,
              review_receipts: reviewReceipts,
              operation_receipts:
                operationReceipts,
            },
            null,
            2,
          ) + "\n",
        );
      } else if (
        scope.entity === "release" &&
        candidates.releaseState ===
          "accepted_partial"
      ) {
        await executeReleaseResumePlans(
          jit.pool,
        );
      } else {
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
      }
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
            ? "close after failed governed URL-identity apply"
            : "close after accepted governed URL-identity apply",
          !primaryError,
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

    if (scope.entity === "track_slug_zero") {
      const currentResult =
        await jit.pool.query(trackZeroCandidateSql);
      const current =
        candidateSnapshot(currentResult.rows[0]);
      const closure =
        await trackZeroClosureSnapshot(jit.pool);

      assertFields(
        current,
        { candidateCount: 0 },
        "post-apply Track-slug zero candidates",
      );

      assertFields(
        closure,
        {
          decisionCount:
            EXPECTED_TRACK_ZERO_CANDIDATES,
          reviewCount:
            EXPECTED_TRACK_ZERO_CANDIDATES,
          targetCount:
            EXPECTED_TRACK_ZERO_CANDIDATES,
          capabilityGrantCount: 1,
          verifiedOperations:
            EXPECTED_TRACK_ZERO_CANDIDATES,
          canonicalEvents:
            EXPECTED_TRACK_ZERO_CANDIDATES,
          resolvedReviews:
            EXPECTED_TRACK_ZERO_CANDIDATES,
        },
        "Track-slug zero final closure",
      );

      const guard = queryViaLinkedCli(`
select
  (
    select count(*)::int
    from public.registry_review_items review
    where review.status='open'
      and review.review_type='mizizi_data_hygiene'
      and review.entity_type='track'
      and review.source_payload->>'ruleId'=
          'track_slug_identity_noise'
  ) as identity_noise,
  (
    select count(*)::int
    from public.registry_review_items review
    where review.status='open'
      and review.review_type='mizizi_data_hygiene'
      and review.entity_type='track'
      and review.source_payload->>'ruleId'=
          'track_slug_credit_evidence_gap'
  ) as credit_gap,
  (
    select count(*)::int
    from public.registry_review_items review
    where review.status='open'
      and review.review_type='mizizi_data_hygiene'
      and review.entity_type='track'
      and review.source_payload->>'ruleId'=
          'track_slug_identity_noise'
      and (
        review.source_payload->'evidence'->>'collision'
          like
          'candidate_slug_collides_with_current_community_thread:%'
        or
        review.source_payload->'evidence'->>'collision'
          like
          'current_community_thread_ownership_ambiguous:%'
      )
  ) as stale_community_blockers,
  (
    select count(*)::int
    from public.registry_review_items review
    join public.registry_tracks track
      on track.id::text=review.source_id
    join public.wk_chart_entries_v2 chart
      on chart.canonical_track_id=review.source_id
    where review.status='resolved'
      and review.resolution_payload->>'programmeKey'=
          'public_music_identity_track_slug_zero'
      and chart.track_slug is distinct from track.slug
  ) as chart_pointer_mismatches,
  (
    select count(*)::int
    from public.registry_review_items review
    join public.registry_tracks track
      on track.id::text=review.source_id
    join public.community_saves save
      on save.entity_type='track'
     and save.entity_id=review.source_id
    where review.status='resolved'
      and review.resolution_payload->>'programmeKey'=
          'public_music_identity_track_slug_zero'
      and save.entity_slug is distinct from track.slug
  ) as save_pointer_mismatches,
  (
    select count(*)::int
    from public.registry_review_items review
    join public.registry_tracks track
      on track.id::text=review.source_id
    join public.community_threads thread
      on thread.entity_type='track'
     and thread.entity_id=review.source_id
    join lateral (
      select credit.artist_slug
      from public.registry_track_artists credit
      where credit.track_id=track.id
        and credit.status='active'
        and credit.is_primary is true
        and credit.artist_id is not null
        and nullif(btrim(credit.artist_slug),'') is not null
      order by
        credit.credit_order nulls last,
        credit.created_at,
        credit.id
      limit 1
    ) primary_artist on true
    where review.status='resolved'
      and review.resolution_payload->>'programmeKey'=
          'public_music_identity_track_slug_zero'
      and (
        thread.entity_slug is distinct from track.slug
        or thread.entity_url is distinct from
          'https://wakilisha.africa/tracks/' ||
          primary_artist.artist_slug ||
          '/' ||
          track.slug
      )
  ) as thread_pointer_mismatches,
  (
    select count(*)::int
    from public.wk_slug_redirects
    where entity_type='track'
  ) as track_redirects
`);

      assertFields(
        guard,
        {
          identity_noise:
            EXPECTED_TRACK_ZERO_IDENTITY_NOISE_REMAINING,
          credit_gap:
            EXPECTED_TRACK_ZERO_CREDIT_GAP_REMAINING,
          stale_community_blockers: 0,
          chart_pointer_mismatches: 0,
          save_pointer_mismatches: 0,
          thread_pointer_mismatches: 0,
          track_redirects: trackRedirectsBefore,
        },
        "Track-slug zero Production acceptance",
      );
    } else if (scope.entity === "release_single_identity") {
      assertFields(
        after,
        {
          verified_operations:
            EXPECTED_RELEASE_SINGLE_CANDIDATES,
          canonical_events:
            EXPECTED_RELEASE_SINGLE_CANDIDATES,
        },
        "final Release Single identity journal",
      );

      const currentResult =
        await jit.pool.query(
          releaseSingleCandidateSql,
        );
      const current =
        candidateSnapshot(
          currentResult.rows[0],
        );

      assertFields(
        current,
        { candidateCount: 0 },
        "post-apply Release Single identity candidates",
      );

      const programme =
        releaseSingleProgrammeSnapshotFromHistory(
          "[]",
        );

      assertFields(
        programme,
        {
          candidateCount:
            EXPECTED_RELEASE_SINGLE_CANDIDATES,
          candidateFingerprint:
            EXPECTED_RELEASE_SINGLE_CANDIDATE_FINGERPRINT,
        },
        "final Release Single identity programme",
      );

      const pendingReviews =
        await jit.pool.query(
          releaseSingleReviewPendingSql,
        );
      const pendingReviewState =
        candidateSnapshot(
          pendingReviews.rows[0],
        );

      assertFields(
        pendingReviewState,
        { candidateCount: 0 },
        "post-apply Release Single review pending state",
      );

      const reviewProgramme =
        releaseSingleReviewProgrammeSnapshotFromHistory(
          "[]",
        );

      assertFields(
        reviewProgramme,
        {
          candidateCount:
            EXPECTED_RELEASE_SINGLE_REVIEWS,
          candidateFingerprint:
            EXPECTED_RELEASE_SINGLE_REVIEW_FINGERPRINT,
        },
        "final Release Single review programme",
      );

      const guard =
        queryViaLinkedCli(`
select
  (
    select count(*)::int
    from public.registry_review_items review
    where review.review_type='mizizi_data_hygiene'
      and review.entity_type='release'
      and review.source_payload->>'ruleId'=
        'release_single_identity_conflict'
      and review.source_payload->>'ruleVersion'='1.4.0'
  ) as release_single_reviews,
  (
    select count(distinct review.source_id)::int
    from public.registry_review_items review
    where review.review_type='mizizi_data_hygiene'
      and review.entity_type='release'
      and review.source_payload->>'ruleId'=
        'release_single_identity_conflict'
      and review.source_payload->>'ruleVersion'='1.4.0'
  ) as release_single_review_targets,
  (
    select count(*)::int
    from public.registry_canonical_write_events event
    where event.actor='system:mizizi'
      and event.action='align_release_single_identity'
      and event.status='succeeded'
  ) as alignment_events,
  (
    select count(*)::int
    from public.registry_canonical_write_events event
    join public.registry_releases release
      on release.id::text=event.registry_entity_id
    where event.actor='system:mizizi'
      and event.action='align_release_single_identity'
      and event.status='succeeded'
      and release.slug is distinct from
        event.after_value->>'value'
  ) as bad_aligned_release_slug,
  (
    select count(*)::int
    from public.community_threads thread_row
    join public.registry_canonical_write_events event
      on event.after_value->>'release_thread_id'=
         thread_row.id::text
     and event.actor='system:mizizi'
     and event.action='align_release_single_identity'
     and event.status='succeeded'
    where coalesce(
            (event.after_value->>'thread_moved')::boolean,
            false
          )
      and (
        thread_row.entity_type<>'track'
        or thread_row.entity_id is distinct from
           event.after_value->>'track_id'
        or regexp_replace(
             regexp_replace(
               split_part(
                 coalesce(thread_row.entity_url,''),
                 '?',
                 1
               ),
               '^https?://(www\\.)?wakilisha\\.africa',
               '',
               'i'
             ),
             '/+$',
             ''
           ) is distinct from
           event.after_value->>'canonical_track_path'
      )
  ) as bad_moved_threads,
  (
    select count(*)::int
    from public.registry_canonical_write_events
    where actor in ('mizizi','system:mizizi')
      and registry_entity_type='track'
  ) as track_canonical_events,
  (
    select count(*)::int
    from public.wk_slug_redirects
    where entity_type='track'
  ) as track_redirects
`);

      assertFields(
        guard,
        {
          release_single_reviews:
            EXPECTED_RELEASE_SINGLE_REVIEWS,
          release_single_review_targets:
            EXPECTED_RELEASE_SINGLE_REVIEWS,
          alignment_events:
            EXPECTED_RELEASE_SINGLE_CANDIDATES,
          bad_aligned_release_slug: 0,
          bad_moved_threads: 0,
          track_canonical_events: 440,
          track_redirects: 1148,
        },
        "Release Single identity Production acceptance",
      );

      await runAudit(jit.url, "track", "after");
    } else if (scope.entity === "release") {
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
