import fs from "node:fs";

import {
  linkSupabaseProject,
  queryViaLinkedCli,
  runCommand,
} from "./mizizi-production-jit-runtime.mjs";

const PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF || "pgzizndxdyhqmtyywjmt";
const EXPECTED_MAIN =
  process.env.MIZIZI_EXPECTED_MAIN_SHA || "";
const MODE =
  process.env.PUBLIC_MUSIC_IDENTITY_ZERO_MODE || "report";
const ARTIFACT_DIR =
  process.env.PUBLIC_MUSIC_IDENTITY_ZERO_ARTIFACT_DIR ||
  "artifacts/public-music-identity-track-actual-zero";

if (!["report", "assert-zero"].includes(MODE)) {
  throw new Error(
    "PUBLIC_MUSIC_IDENTITY_ZERO_MODE must be report or assert-zero.",
  );
}

function assertExactMain() {
  if (!EXPECTED_MAIN) return;

  if (!/^[0-9a-f]{40}$/.test(EXPECTED_MAIN)) {
    throw new Error(
      "MIZIZI_EXPECTED_MAIN_SHA must be a 40-character SHA.",
    );
  }

  const head = runCommand(
    "git",
    ["rev-parse", "HEAD"],
    { capture: true },
  );

  if (head !== EXPECTED_MAIN) {
    throw new Error(
      "Actual-zero audit checkout " +
        head +
        " does not match expected main " +
        EXPECTED_MAIN,
    );
  }
}

function parseRows(value) {
  const parsed = JSON.parse(String(value || "[]"));

  if (!Array.isArray(parsed)) {
    throw new Error("Actual-zero dirty-route payload is not an array.");
  }

  return parsed;
}

function snapshot() {
  return queryViaLinkedCli(`
with active_tracks as (
  select
    track.id,
    track.title,
    track.slug,
    track.isrc,
    track.status,
    coalesce((
      select count(*)::int
      from public.registry_track_artists credit
      where credit.track_id=track.id
        and coalesce(credit.status,'active')<>'archived'
        and credit.is_primary is true
        and nullif(btrim(credit.artist_slug),'') is not null
    ),0) as primary_artist_count,
    (
      select min(credit.artist_slug)
      from public.registry_track_artists credit
      where credit.track_id=track.id
        and coalesce(credit.status,'active')<>'archived'
        and credit.is_primary is true
        and nullif(btrim(credit.artist_slug),'') is not null
    ) as primary_artist_slug
  from public.registry_tracks track
  where track.status='active'
),
scoped_reviews as (
  select
    review.id,
    review.source_id::uuid as track_id,
    review.status,
    review.source_payload->>'ruleId' as rule_id,
    review.source_payload->>'ruleVersion' as rule_version,
    review.source_payload->>'currentValue' as reviewed_slug,
    review.candidate_payload->>'proposedValue' as proposed_slug
  from public.registry_review_items review
  where review.review_type='mizizi_data_hygiene'
    and review.entity_type='track'
    and (
      (
        review.source_payload->>'ruleId'='track_slug_identity_noise'
        and review.source_payload->>'ruleVersion'='1.1.0'
      )
      or
      (
        review.source_payload->>'ruleId'='track_slug_credit_evidence_gap'
        and review.source_payload->>'ruleVersion'='1.3.0'
      )
    )
),
dirty_active as (
  select
    track.*,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'reviewId',review.id,
          'ruleId',review.rule_id,
          'ruleVersion',review.rule_version,
          'reviewStatus',review.status,
          'reviewedSlug',review.reviewed_slug,
          'proposedSlug',review.proposed_slug
        )
        order by review.id
      )
      from scoped_reviews review
      where review.track_id=track.id
    ),'[]'::jsonb) as scoped_review_state
  from active_tracks track
  where track.slug ~ '(^|-)(feat|ft|featuring)(-|$)'
),
synthetic_suffix_active as (
  select
    track.*,
    regexp_replace(
      track.slug,
      '-[0-9a-f]{6}$',
      ''
    ) as base_slug,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'trackId',peer.id,
          'title',peer.title,
          'slug',peer.slug,
          'status',peer.status,
        'chartPointerCount',(
          select count(*) from public.wk_chart_entries_v2 ce
          where ce.canonical_track_id=peer.id::text
        ),
        'communityPointerCount',(
          select count(*) from public.community_threads ct
          where ct.entity_type='track' and ct.entity_id=peer.id::text
        ),
        'appleProviderIds',coalesce((
          select jsonb_agg(distinct l.provider_track_id)
          from public.registry_track_provider_links l
          where l.track_id=peer.id
            and l.provider_key='apple_music'
            and nullif(l.provider_track_id,'') is not null
        ),'[]'::jsonb)
        )
        order by peer.id::text
      )
      from public.registry_tracks peer
      where peer.id<>track.id
        and peer.slug=regexp_replace(
          track.slug,
          '-[0-9a-f]{6}$',
          ''
        )
    ),'[]'::jsonb) as same_base_tracks
  from active_tracks track
  where track.slug ~ '-[0-9a-f]{6}$'
),
route_manifest as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'trackId',track.id,
        'title',track.title,
        'slug',track.slug,
        'isrc',track.isrc,
        'primaryArtistCount',track.primary_artist_count,
        'primaryArtistSlug',track.primary_artist_slug
      )
      order by track.id::text
    ),
    '[]'::jsonb
  ) as payload
  from active_tracks track
)
select
  (select count(*)::int from active_tracks)
    as active_track_count,
  (
    select count(*)::int
    from scoped_reviews review
    where review.status='open'
  ) as open_scoped_reviews,
  (
    select count(*)::int
    from scoped_reviews review
    where review.status='open'
      and review.rule_id='track_slug_identity_noise'
      and review.rule_version='1.1.0'
  ) as open_identity_noise,
  (
    select count(*)::int
    from scoped_reviews review
    where review.status='open'
      and review.rule_id='track_slug_credit_evidence_gap'
      and review.rule_version='1.3.0'
  ) as open_credit_gap,
  (
    select count(*)::int
    from dirty_active
  ) as active_feature_slug_count,
  (
    select count(*)::int
    from dirty_active dirty
    where not exists (
      select 1
      from scoped_reviews review
      where review.track_id=dirty.id
        and review.status='open'
    )
  ) as active_feature_slug_outside_open_scope,
  (
    select count(*)::int
    from dirty_active dirty
    where exists (
      select 1
      from scoped_reviews review
      where review.track_id=dirty.id
        and review.status='resolved'
    )
      and not exists (
        select 1
        from scoped_reviews review
        where review.track_id=dirty.id
          and review.status='open'
      )
  ) as active_feature_slug_with_resolved_scope,
  (
    select count(*)::int
    from synthetic_suffix_active
  ) as active_synthetic_suffix_count,
  (
    select count(*)::int
    from active_tracks track
    where track.primary_artist_count<>1
  ) as active_track_non_single_primary_count,
  encode(
    extensions.digest(
      (select payload::text from route_manifest),
      'sha256'
    ),
    'hex'
  ) as active_route_manifest_fingerprint,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'trackId',dirty.id,
        'title',dirty.title,
        'slug',dirty.slug,
        'isrc',dirty.isrc,
        'primaryArtistCount',dirty.primary_artist_count,
        'primaryArtistSlug',dirty.primary_artist_slug,
        'publicUrl',
          case
            when dirty.primary_artist_count=1
             and nullif(dirty.primary_artist_slug,'') is not null
            then
              'https://wakilisha.africa/tracks/'||
              dirty.primary_artist_slug||'/'||dirty.slug||'/'
            else null
          end,
        'reviews',dirty.scoped_review_state
      )
      order by dirty.primary_artist_slug nulls last,dirty.slug,dirty.id
    )
    from dirty_active dirty
  ),'[]'::jsonb)::text as dirty_route_payload,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'trackId',synthetic.id,
        'title',synthetic.title,
        'slug',synthetic.slug,
        'baseSlug',synthetic.base_slug,
        'isrc',synthetic.isrc,
        'primaryArtistCount',synthetic.primary_artist_count,
        'primaryArtistSlug',synthetic.primary_artist_slug,
        'sameBaseTracks',synthetic.same_base_tracks,
        'chartPointerCount',(
          select count(*) from public.wk_chart_entries_v2 ce
          where ce.canonical_track_id=synthetic.id::text
        ),
        'communityPointerCount',(
          select count(*) from public.community_threads ct
          where ct.entity_type='track' and ct.entity_id=synthetic.id::text
        ),
        'appleProviderIds',coalesce((
          select jsonb_agg(distinct l.provider_track_id)
          from public.registry_track_provider_links l
          where l.track_id=synthetic.id
            and l.provider_key='apple_music'
            and nullif(l.provider_track_id,'') is not null
        ),'[]'::jsonb)
      )
      order by
        synthetic.primary_artist_slug nulls last,
        synthetic.slug,
        synthetic.id
    )
    from synthetic_suffix_active synthetic

  ),'[]'::jsonb)::text as synthetic_suffix_route_payload,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'trackId',dirty.id,
        'slug',dirty.slug,
        'recordingReviewId',recording.id,
        'historicalDecisionId',(
          select decision.id
          from public.registry_canonicalization_decisions decision
          join public.registry_review_items scoped
            on scoped.id=decision.review_item_id
          where scoped.source_id=dirty.id::text
            and scoped.status='resolved'
            and scoped.review_type='mizizi_data_hygiene'
            and scoped.source_payload->>'ruleId' in (
              'track_slug_identity_noise','track_slug_credit_evidence_gap'
            )
            and decision.status='recorded'
            and decision.decision_type='public_music_identity_distinct_recording'
            and decision.metadata->>'programmeKey'='public_music_identity_track_actual_zero_v1'
            and decision.after_payload->>'evidenceRecordingIdentityReviewId'=recording.id::text
          order by decision.created_at desc,decision.id desc
          limit 1
        )
      ) order by dirty.slug,dirty.id
    )
    from dirty_active dirty
    join public.registry_review_items recording
      on recording.source_id=dirty.id::text
     and recording.entity_type='track'
     and recording.review_type='mizizi_data_hygiene'
     and recording.status='open'
     and recording.source_payload->>'ruleId'='track_recording_identity_conflict'
     and recording.source_payload->>'ruleVersion'='1.3.0'
    where exists (
      select 1 from scoped_reviews scoped
      where scoped.track_id=dirty.id
        and scoped.status='resolved'
    )
  ),'[]'::jsonb)::text as b1_forward_linkage_payload
`);
}

function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

  console.log(
    "=== PUBLIC MUSIC IDENTITY TRACK ACTUAL-ZERO AUDIT ===",
  );

  assertExactMain();
  linkSupabaseProject(PROJECT_REF);

  const row = snapshot();
  const dirtyRoutes = parseRows(row.dirty_route_payload);
  const syntheticSuffixRoutes = parseRows(
    row.synthetic_suffix_route_payload,
  );
  const b1ForwardLinkages = parseRows(
    row.b1_forward_linkage_payload,
  );
  const b1UnlinkedCount = b1ForwardLinkages.filter(
    (entry) => !entry.historicalDecisionId,
  ).length;

  const result = {
    mode: MODE,
    expectedMain: EXPECTED_MAIN || null,
    activeTrackCount: Number(row.active_track_count || 0),
    openScopedReviews: Number(row.open_scoped_reviews || 0),
    openIdentityNoise: Number(row.open_identity_noise || 0),
    openCreditGap: Number(row.open_credit_gap || 0),
    activeFeatureSlugCount: Number(
      row.active_feature_slug_count || 0,
    ),
    activeFeatureSlugOutsideOpenScope: Number(
      row.active_feature_slug_outside_open_scope || 0,
    ),
    activeFeatureSlugWithResolvedScope: Number(
      row.active_feature_slug_with_resolved_scope || 0,
    ),
    activeSyntheticSuffixCount: Number(
      row.active_synthetic_suffix_count || 0,
    ),
    activeTrackNonSinglePrimaryCount: Number(
      row.active_track_non_single_primary_count || 0,
    ),
    activeRouteManifestFingerprint: String(
      row.active_route_manifest_fingerprint || "",
    ),
    dirtyRoutes,
    syntheticSuffixRoutes,
    b1ForwardLinkages,
    b1UnlinkedCount,
  };

  fs.writeFileSync(
    ARTIFACT_DIR + "/actual-zero-snapshot.json",
    JSON.stringify(result, null, 2) + "\n",
  );

  console.log(
    "ACTIVE_TRACK_COUNT=" + result.activeTrackCount,
  );
  console.log(
    "OPEN_SCOPED_REVIEWS=" + result.openScopedReviews,
  );
  console.log(
    "OPEN_IDENTITY_NOISE=" + result.openIdentityNoise,
  );
  console.log(
    "OPEN_CREDIT_GAP=" + result.openCreditGap,
  );
  console.log(
    "ACTIVE_FEATURE_SLUG_COUNT=" +
      result.activeFeatureSlugCount,
  );
  console.log(
    "ACTIVE_FEATURE_SLUG_OUTSIDE_OPEN_SCOPE=" +
      result.activeFeatureSlugOutsideOpenScope,
  );
  console.log(
    "ACTIVE_FEATURE_SLUG_WITH_RESOLVED_SCOPE=" +
      result.activeFeatureSlugWithResolvedScope,
  );
  console.log(
    "ACTIVE_SYNTHETIC_SUFFIX_COUNT=" +
      result.activeSyntheticSuffixCount,
  );
  console.log(
    "ACTIVE_ROUTE_MANIFEST_FINGERPRINT=" +
      result.activeRouteManifestFingerprint,
  );

  for (const route of dirtyRoutes) {
    console.log(
      "DIRTY_PUBLIC_TRACK_ROUTE " +
        JSON.stringify(route),
    );
  }

  console.log("B1_FORWARD_LINKAGE_COUNT=" + b1ForwardLinkages.length);
  console.log("B1_UNLINKED_COUNT=" + b1UnlinkedCount);
  for (const linkage of b1ForwardLinkages) {
    console.log("B1_FORWARD_LINKAGE " + JSON.stringify(linkage));
  }

  for (const route of syntheticSuffixRoutes) {
    console.log(
      "SYNTHETIC_PUBLIC_TRACK_ROUTE " +
        JSON.stringify(route),
    );
  }

  if (MODE === "assert-zero") {
    if (
      result.openScopedReviews !== 0 ||
      result.openIdentityNoise !== 0 ||
      result.openCreditGap !== 0 ||
      result.activeFeatureSlugCount !== 0 ||
      result.activeFeatureSlugOutsideOpenScope !== 0 ||
      result.b1UnlinkedCount !== 0 ||
      result.activeSyntheticSuffixCount !== 0
    ) {
      throw new Error(
        "PUBLIC_MUSIC_IDENTITY_TRACK_ACTUAL_ZERO=FAIL",
      );
    }

    console.log(
      "PUBLIC_MUSIC_IDENTITY_TRACK_ACTUAL_ZERO=PASS",
    );
  } else {
    console.log(
      "PUBLIC_MUSIC_IDENTITY_TRACK_ACTUAL_ZERO=REPORT_ONLY",
    );
  }
}

try {
  main();
} catch (error) {
  console.error(
    error instanceof Error ? error.stack || error.message : error,
  );
  process.exit(1);
}
