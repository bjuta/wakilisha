import { createHash } from "node:crypto";

import {
  analyzeChartIdentity,
  analyzeReleaseIdentity,
  analyzeTrackIdentity,
  MIZIZI_AGENT_KEY,
  MIZIZI_AGENT_LABEL,
  MIZIZI_RULESET_VERSION,
  slugifyIdentity,
  stripFeatureCreditNoise,
  type MiziziFinding,
} from "./core";
import {
  createRegistryPool,
  hasTable,
} from "../../phase1-db";

type EntityScope = "track" | "release" | "chart" | "all";
type RunMode = "audit" | "apply";

type Options = {
  mode: RunMode;
  entity: EntityScope;
  batchSize: number;
  limit: number;
  since: string | null;
  shardCount: number;
  shardIndex: number;
  sendStandup: boolean;
};

type TrackRow = {
  id: string;
  slug: string;
  title: string;
  updated_at: string;
  primary_artist_slug: string | null;
  primary_artist_name: string | null;
};

type ReleaseRow = {
  id: string;
  slug: string;
  title: string;
  release_type: string | null;
  release_date: string | null;
  primary_artist_id: string | null;
  primary_artist_slug: string | null;
  resolvable_active_track_count: number;
  updated_at: string;
};

type ChartRow = {
  id: string;
  track_slug: string;
  artist_slug: string | null;
  canonical_track_id: string | null;
  canonical_track_slug: string | null;
  canonical_primary_artist_slug: string | null;
  updated_at: string;
};

type ScopeCandidate = {
  id: string;
  slug: string;
  title: string;
  proposedSlug: string;
};

type ReleaseSlugPlan = {
  releaseId: string;
  artistId: string;
  artistSlug: string;
  baseSlug: string;
  plannedSlug: string;
  usesDateFallback: boolean;
};

type RunStats = {
  findings: number;
  applied: number;
  queued: number;
  observed: number;
  stale: number;
  rowsScanned: Record<"track" | "release" | "chart", number>;
  byRule: Map<string, number>;
  sample: MiziziFinding[];
  cursors: Record<
    "track" | "release" | "chart",
    { updatedAt: string; id: string } | null
  >;
};

const MAX_SAMPLE_FINDINGS = 30;

function newStats(): RunStats {
  return {
    findings: 0,
    applied: 0,
    queued: 0,
    observed: 0,
    stale: 0,
    rowsScanned: {
      track: 0,
      release: 0,
      chart: 0,
    },
    byRule: new Map(),
    sample: [],
    cursors: {
      track: null,
      release: null,
      chart: null,
    },
  };
}

function recordFinding(
  stats: RunStats,
  finding: MiziziFinding,
): void {
  stats.findings += 1;
  stats.byRule.set(
    finding.ruleId,
    (stats.byRule.get(finding.ruleId) || 0) + 1,
  );

  if (finding.disposition === "observe") {
    stats.observed += 1;
  }

  if (stats.sample.length < MAX_SAMPLE_FINDINGS) {
    stats.sample.push(finding);
  }
}

function argValue(
  name: string,
  fallback = "",
): string {
  const prefix = "--" + name + "=";
  const found = process.argv.find(
    (arg) => arg.startsWith(prefix),
  );

  return found
    ? found.slice(prefix.length)
    : fallback;
}

function parseOptions(): Options {
  const mode =
    argValue("mode", "audit") as RunMode;
  const entity =
    argValue("entity", "all") as EntityScope;
  const batchSize = Math.max(
    1,
    Math.min(
      Number(argValue("batch-size", "500")) || 500,
      5000,
    ),
  );
  const rawLimit = Number(
    argValue("limit", "5000"),
  );
  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 0
      ? Math.floor(rawLimit)
      : 5000;
  const shardCount = Math.max(
    1,
    Math.floor(
      Number(argValue("shard-count", "1")) || 1,
    ),
  );
  const shardIndex = Math.max(
    0,
    Math.floor(
      Number(argValue("shard-index", "0")) || 0,
    ),
  );
  const since =
    argValue("since", "").trim() || null;
  const sendStandup =
    argValue(
      "send-standup",
      "false",
    ).trim().toLowerCase() ===
      "true";

  if (!["audit", "apply"].includes(mode)) {
    throw new Error(
      "Unsupported --mode. Use audit or apply.",
    );
  }

  if (
    !["track", "release", "chart", "all"].includes(
      entity,
    )
  ) {
    throw new Error(
      "Unsupported --entity. Use track, release, chart, or all.",
    );
  }

  if (shardIndex >= shardCount) {
    throw new Error(
      "--shard-index must be lower than --shard-count.",
    );
  }

  if (
    mode === "apply" &&
    argValue("confirm", "") !== "MIZIZI_APPLY"
  ) {
    throw new Error(
      "Apply mode requires --confirm=MIZIZI_APPLY.",
    );
  }

  if (
    since &&
    Number.isNaN(new Date(since).getTime())
  ) {
    throw new Error(
      "--since must be a valid timestamp.",
    );
  }

  return {
    mode,
    entity,
    batchSize,
    limit,
    since,
    shardCount,
    shardIndex,
    sendStandup,
  };
}


async function assertRequiredTables(
  pool: ReturnType<typeof createRegistryPool>,
): Promise<void> {
  const required = [
    "registry_tracks",
    "registry_releases",
    "registry_track_artists",
    "registry_release_artists",
    "registry_release_tracks",
    "wk_chart_entries_v2",
    "registry_review_items",
    "registry_canonical_write_events",
    "community_saves",
    "community_threads",
  ];

  for (const table of required) {
    if (
      !(await hasTable(
        pool,
        "public." + table,
      ))
    ) {
      throw new Error(
        "Required MIZIZI dependency missing: public." +
          table,
      );
    }
  }
}



async function queueReview(
  pool: ReturnType<typeof createRegistryPool>,
  finding: MiziziFinding,
  extraEvidence: Record<string, unknown> = {},
): Promise<void> {
  if (
    finding.entityType !== "track" &&
    finding.entityType !== "release"
  ) {
    throw new Error(
      "Stage B review broker only accepts Track/Release slug review work.",
    );
  }

  const reviewBroker =
    finding.ruleVersion === "1.3.0" &&
    (
      finding.ruleId ===
        "track_slug_credit_evidence_gap" ||
      finding.ruleId ===
        "track_recording_identity_conflict"
    )
      ? "queue_public_music_identity_review_v1"
      : "queue_registry_review_v1";

  const result =
    await pool.query(
      `
      select
        mizizi_private.${reviewBroker}(
          $1::text,
          $2::text,
          $3::text,
          $4::text,
          $5::text,
          $6::text,
          $7::text,
          $8::text,
          $9::numeric,
          $10::text,
          $11::text,
          $12::jsonb
        )::text as review_id
      `,
      [
        finding.entityType,
        finding.entityId,
        finding.fingerprint,
        finding.ruleId,
        finding.ruleVersion,
        finding.fieldName,
        finding.currentValue,
        finding.proposedValue,
        finding.confidence,
        finding.severity,
        finding.reason,
        JSON.stringify({
          ...finding.evidence,
          ...extraEvidence,
        }),
      ],
    );

  if (
    result.rowCount !== 1 ||
    !String(
      result.rows[0]?.review_id || "",
    )
  ) {
    throw new Error(
      "Bounded MIZIZI review broker did not return one review row.",
    );
  }
}


async function loadTrackFeaturedArtists(
  pool: ReturnType<typeof createRegistryPool>,
  trackIds: string[],
): Promise<
  Map<
    string,
    Array<{
      slug: string;
      name: string;
    }>
  >
> {
  if (trackIds.length === 0) {
    return new Map();
  }

  const result = await pool.query(
    `
    select
      track_id::text,
      coalesce(artist_slug, '') as artist_slug,
      coalesce(artist_name_text, '') as artist_name_text
    from public.registry_track_artists
    where track_id = any($1::uuid[])
      and status = 'active'
      and is_featured is true
    order by
      track_id,
      credit_order nulls last,
      id
    `,
    [trackIds],
  );

  const byTrack = new Map<
    string,
    Array<{
      slug: string;
      name: string;
    }>
  >();

  for (const row of result.rows) {
    const trackId =
      String(row.track_id);
    const list =
      byTrack.get(trackId) || [];

    list.push({
      slug: String(
        row.artist_slug || "",
      ),
      name: String(
        row.artist_name_text || "",
      ),
    });

    byTrack.set(trackId, list);
  }

  return byTrack;
}

async function loadTrackPrimaryArtistSlugs(
  pool: ReturnType<typeof createRegistryPool>,
  trackIds: string[],
): Promise<Map<string, string[]>> {
  if (trackIds.length === 0) {
    return new Map();
  }

  const result = await pool.query(
    `
    select
      track_id::text,
      artist_slug
    from public.registry_track_artists
    where track_id = any($1::uuid[])
      and status = 'active'
      and is_primary is true
      and nullif(btrim(artist_slug), '') is not null
    order by
      track_id,
      credit_order nulls last,
      created_at,
      id
    `,
    [trackIds],
  );

  const byTrack =
    new Map<string, string[]>();

  for (const row of result.rows) {
    const trackId =
      String(row.track_id);
    const artistSlug =
      String(row.artist_slug || "");
    const list =
      byTrack.get(trackId) || [];

    if (
      artistSlug &&
      !list.includes(artistSlug)
    ) {
      list.push(artistSlug);
    }

    byTrack.set(trackId, list);
  }

  return byTrack;
}

async function loadArtistScopeCandidates(
  pool: ReturnType<typeof createRegistryPool>,
  artistSlugs: string[],
): Promise<
  Map<string, ScopeCandidate[]>
> {
  if (artistSlugs.length === 0) {
    return new Map();
  }

  const result = await pool.query(
    `
    select distinct
      ta.artist_slug,
      t.id::text,
      t.slug,
      t.title
    from public.registry_track_artists ta
    join public.registry_tracks t
      on t.id = ta.track_id
    where ta.status = 'active'
      and ta.is_primary is true
      and t.status = 'active'
      and ta.artist_slug = any($1::text[])
    order by ta.artist_slug, t.id::text
    `,
    [artistSlugs],
  );

  const byArtist =
    new Map<string, ScopeCandidate[]>();

  for (const row of result.rows) {
    const artistSlug = String(
      row.artist_slug || "",
    );
    const core =
      stripFeatureCreditNoise(
        String(row.title || ""),
      ).coreTitle;
    const list =
      byArtist.get(artistSlug) || [];

    list.push({
      id: String(row.id),
      slug: String(row.slug || ""),
      title: String(row.title || ""),
      proposedSlug:
        slugifyIdentity(core),
    });

    byArtist.set(
      artistSlug,
      list,
    );
  }

  return byArtist;
}

async function loadReleaseScopeCandidates(
  pool: ReturnType<typeof createRegistryPool>,
  trackIds: string[],
): Promise<
  Map<string, ScopeCandidate[]>
> {
  if (trackIds.length === 0) {
    return new Map();
  }

  const result = await pool.query(
    `
    select
      target.track_id::text as target_track_id,
      sibling.track_id::text as sibling_track_id,
      sibling_track.slug,
      sibling_track.title
    from public.registry_release_tracks target
    join public.registry_release_tracks sibling
      on sibling.release_id =
         target.release_id
     and sibling.status = 'active'
    join public.registry_tracks sibling_track
      on sibling_track.id =
         sibling.track_id
     and sibling_track.status = 'active'
    where target.track_id = any($1::uuid[])
      and target.status = 'active'
    order by
      target.track_id,
      target.release_id,
      sibling.disc_number,
      sibling.track_number,
      sibling.id
    `,
    [trackIds],
  );

  const byTrack =
    new Map<string, ScopeCandidate[]>();

  for (const row of result.rows) {
    const targetTrackId =
      String(row.target_track_id);
    const core =
      stripFeatureCreditNoise(
        String(row.title || ""),
      ).coreTitle;
    const list =
      byTrack.get(targetTrackId) || [];

    list.push({
      id: String(
        row.sibling_track_id,
      ),
      slug: String(row.slug || ""),
      title: String(row.title || ""),
      proposedSlug:
        slugifyIdentity(core),
    });

    byTrack.set(
      targetTrackId,
      list,
    );
  }

  return byTrack;
}

function candidateCollision(
  finding: MiziziFinding,
  row: TrackRow,
  artistScope:
    Map<string, ScopeCandidate[]>,
  releaseScope:
    Map<string, ScopeCandidate[]>,
): string {
  const artistSlug = String(
    row.primary_artist_slug || "",
  );

  if (!artistSlug) {
    return "missing_explicit_primary_artist_scope";
  }

  const collisions = [
    ...(artistScope.get(artistSlug) || []),
    ...(releaseScope.get(row.id) || []),
  ];

  const collision = collisions.find(
    (candidate) =>
      candidate.id !== row.id &&
      (
        candidate.slug ===
          finding.proposedValue ||
        candidate.proposedSlug ===
          finding.proposedValue
      ),
  );

  return collision
    ? "candidate_slug_collides_with_track:" +
        collision.id
    : "";
}





function stewardshipIdempotencyKey(
  finding: MiziziFinding,
): string {
  return (
    "mizizi:" +
    finding.ruleId +
    ":" +
    finding.fingerprint
  );
}

async function executeBrokeredStewardshipOperation(
  pool: ReturnType<typeof createRegistryPool>,
  operationKey: string,
  targetRef: string,
  finding: MiziziFinding,
): Promise<Record<string, unknown>> {
  const grantResult =
    await pool.query(
      `
      select *
      from mizizi_private
        .issue_stewardship_execution_grant_v1(
          $1::text,
          $2::text,
          $3::text
        )
      `,
      [
        operationKey,
        targetRef,
        stewardshipIdempotencyKey(
          finding,
        ),
      ],
    );

  if (grantResult.rowCount !== 1) {
    throw new Error(
      "Stage B exact execution grant was not issued.",
    );
  }

  const executionGrantId =
    String(
      grantResult.rows[0]
        ?.execution_grant_id || "",
    );

  if (!executionGrantId) {
    throw new Error(
      "Stage B exact execution grant id is missing.",
    );
  }

  const executionResult =
    await pool.query(
      `
      select *
      from mizizi_private
        .execute_stewardship_operation_v1(
          $1::uuid
        )
      `,
      [executionGrantId],
    );

  if (
    executionResult.rowCount !== 1 ||
    executionResult.rows[0]
      ?.operation_status !== "succeeded"
  ) {
    throw new Error(
      "Stage B typed stewardship execution did not succeed.",
    );
  }

  const operationId =
    String(
      executionResult.rows[0]
        ?.operation_id || "",
    );

  if (!operationId) {
    throw new Error(
      "Stage B mutation operation id is missing.",
    );
  }

  const verificationResult =
    await pool.query(
      `
      select *
      from mizizi_private
        .verify_stewardship_operation_v1(
          $1::uuid
        )
      `,
      [operationId],
    );

  if (
    verificationResult.rowCount !== 1 ||
    verificationResult.rows[0]
      ?.verifier_status !== "passed"
  ) {
    throw new Error(
      "Stage B independent stewardship verification did not pass.",
    );
  }

  return (
    executionResult.rows[0]
      ?.result_payload || {}
  ) as Record<string, unknown>;
}

async function applyTrackSlug(
  pool: ReturnType<typeof createRegistryPool>,
  row: TrackRow,
  finding: MiziziFinding,
): Promise<
  | {
      outcome: "applied";
      chartRows: number;
      redirects: number;
    }
  | {
      outcome: "stale";
    }
  | {
      outcome: "collision";
      reason: string;
    }
> {
  const plan =
    await pool.query(
      `
      select
        current_slug,
        proposed_slug
      from mizizi_private
        .track_slug_plan_v1(
          $1::uuid
        )
      `,
      [row.id],
    );

  if (
    plan.rowCount !== 1 ||
    String(
      plan.rows[0]?.current_slug || "",
    ) !== finding.currentValue ||
    String(
      plan.rows[0]?.proposed_slug || "",
    ) !== finding.proposedValue
  ) {
    return {
      outcome: "stale",
    };
  }

  try {
    const result =
      await executeBrokeredStewardshipOperation(
        pool,
        "registry.track_slug.canonicalize",
        row.id,
        finding,
      );

    return {
      outcome: "applied",
      chartRows:
        Number(
          result.chart_entries_updated ||
            0,
        ),
      redirects: 0,
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      String(
        (error as { code?: string })
          .code || "",
      ) === "40001"
    ) {
      return {
        outcome: "stale",
      };
    }

    throw error;
  }
}

async function loadReleaseSlugPlan(
  pool: ReturnType<typeof createRegistryPool>,
): Promise<Map<string, ReleaseSlugPlan>> {
  const result =
    await pool.query(
      `
      with packaged as (
        select
          r.id::text as release_id,
          r.slug as current_slug,
          r.release_date,
          regexp_replace(
            r.slug,
            '-(single|ep|album)$',
            '',
            'i'
          ) as base_slug,
          pa.artist_id::text as artist_id,
          pa.artist_slug
        from public.registry_releases r
        left join lateral (
          select
            ra.artist_id,
            ra.artist_slug
          from public.registry_release_artists ra
          where ra.release_id = r.id
            and ra.status = 'active'
            and ra.is_primary is true
          order by
            ra.credit_order nulls last,
            ra.created_at,
            ra.id
          limit 1
        ) pa on true
        where r.status = 'active'
          and (
            (
              r.slug ~* '-single$'
              and r.title ~*
                '[[:space:]]+-[[:space:]]+single$'
            )
            or (
              r.slug ~* '-ep$'
              and r.title ~*
                '[[:space:]]+-[[:space:]]+ep$'
            )
            or (
              r.slug ~* '-album$'
              and r.title ~*
                '[[:space:]]+-[[:space:]]+album$'
            )
          )
      ),
      grouped as (
        select
          artist_id,
          base_slug,
          count(*)::integer as candidate_count
        from packaged
        group by
          artist_id,
          base_slug
      ),
      planned as (
        select
          p.*,
          g.candidate_count,
          exists (
            select 1
            from public.registry_releases other
            join public.registry_release_artists ora
              on ora.release_id = other.id
             and ora.status = 'active'
             and ora.is_primary is true
            where other.status = 'active'
              and other.id::text <> p.release_id
              and ora.artist_id::text = p.artist_id
              and other.slug = p.base_slug
          ) as existing_clean_conflict
        from packaged p
        join grouped g
          on g.artist_id = p.artist_id
         and g.base_slug = p.base_slug
      )
      select
        release_id,
        artist_id,
        artist_slug,
        base_slug,
        case
          when candidate_count = 1
           and not existing_clean_conflict
            then base_slug
          when release_date is not null
            then (
              base_slug ||
              '-' ||
              to_char(
                release_date,
                'YYYY-MM-DD'
              )
            )
          else null
        end as planned_slug,
        (
          candidate_count > 1
          or existing_clean_conflict
        ) as uses_date_fallback
      from planned
      order by
        artist_id,
        base_slug,
        release_id
      `,
    );

  const plan =
    new Map<string, ReleaseSlugPlan>();
  const scopedTargets =
    new Set<string>();

  for (const row of result.rows) {
    const releaseId =
      String(row.release_id || "");
    const artistId =
      String(row.artist_id || "");
    const artistSlug =
      String(row.artist_slug || "");
    const baseSlug =
      String(row.base_slug || "");
    const plannedSlug =
      String(row.planned_slug || "");

    if (
      !releaseId ||
      !artistId ||
      !artistSlug ||
      !baseSlug ||
      !plannedSlug
    ) {
      throw new Error(
        "Release slug plan is incomplete for " +
          releaseId,
      );
    }

    const targetKey =
      artistId + ":" + plannedSlug;

    if (scopedTargets.has(targetKey)) {
      throw new Error(
        "Release slug plan collision: " +
          targetKey,
      );
    }

    scopedTargets.add(targetKey);
    plan.set(
      releaseId,
      {
        releaseId,
        artistId,
        artistSlug,
        baseSlug,
        plannedSlug,
        usesDateFallback:
          Boolean(
            row.uses_date_fallback,
          ),
      },
    );
  }

  return plan;
}

async function applyReleaseSlugPackaging(
  pool: ReturnType<typeof createRegistryPool>,
  row: ReleaseRow,
  finding: MiziziFinding,
  plan: ReleaseSlugPlan,
): Promise<"applied" | "stale"> {
  const serverPlan =
    await pool.query(
      `
      select
        artist_id::text,
        artist_slug,
        current_slug,
        base_slug,
        proposed_slug,
        uses_date_fallback
      from mizizi_private
        .release_slug_plan_v1(
          $1::uuid
        )
      `,
      [row.id],
    );

  if (
    serverPlan.rowCount !== 1 ||
    String(
      serverPlan.rows[0]
        ?.artist_id || "",
    ) !== plan.artistId ||
    String(
      serverPlan.rows[0]
        ?.artist_slug || "",
    ) !== plan.artistSlug ||
    String(
      serverPlan.rows[0]
        ?.current_slug || "",
    ) !== finding.currentValue ||
    String(
      serverPlan.rows[0]
        ?.base_slug || "",
    ) !== plan.baseSlug ||
    String(
      serverPlan.rows[0]
        ?.proposed_slug || "",
    ) !== finding.proposedValue ||
    Boolean(
      serverPlan.rows[0]
        ?.uses_date_fallback,
    ) !== plan.usesDateFallback
  ) {
    return "stale";
  }

  try {
    await executeBrokeredStewardshipOperation(
      pool,
      "registry.release_slug.canonicalize",
      row.id,
      finding,
    );
    return "applied";
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      String(
        (error as { code?: string })
          .code || "",
      ) === "40001"
    ) {
      return "stale";
    }

    throw error;
  }
}

async function applyReleaseTaxonomy(
  pool: ReturnType<typeof createRegistryPool>,
  row: ReleaseRow,
  finding: MiziziFinding,
): Promise<"applied" | "stale"> {
  const plan =
    await pool.query(
      `
      select
        current_release_type,
        active_track_count,
        proposed_release_type
      from mizizi_private
        .release_taxonomy_plan_v1(
          $1::uuid
        )
      `,
      [row.id],
    );

  if (
    plan.rowCount !== 1 ||
    String(
      plan.rows[0]
        ?.current_release_type || "",
    ).trim() !== finding.currentValue ||
    String(
      plan.rows[0]
        ?.proposed_release_type || "",
    ) !== finding.proposedValue ||
    Number(
      plan.rows[0]
        ?.active_track_count || 0,
    ) !==
      Number(
        finding.evidence
          .resolvableActiveTrackCount ||
          0,
      )
  ) {
    return "stale";
  }

  try {
    await executeBrokeredStewardshipOperation(
      pool,
      "registry.release_taxonomy.repair",
      row.id,
      finding,
    );
    return "applied";
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      String(
        (error as { code?: string })
          .code || "",
      ) === "40001"
    ) {
      return "stale";
    }

    throw error;
  }
}

async function applyChartSlug(
  pool: ReturnType<typeof createRegistryPool>,
  finding: MiziziFinding,
): Promise<
  "applied" | "stale"
> {
  const plan =
    await pool.query(
      `
      select
        current_track_slug,
        canonical_track_slug
      from mizizi_private
        .chart_track_slug_plan_v1(
          $1::text
        )
      `,
      [finding.entityId],
    );

  if (
    plan.rowCount !== 1 ||
    String(
      plan.rows[0]
        ?.current_track_slug || "",
    ) !== finding.currentValue ||
    String(
      plan.rows[0]
        ?.canonical_track_slug || "",
    ) !== finding.proposedValue
  ) {
    return "stale";
  }

  try {
    await executeBrokeredStewardshipOperation(
      pool,
      "registry.chart_track_slug.synchronize",
      finding.entityId,
      finding,
    );
    return "applied";
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      String(
        (error as { code?: string })
          .code || "",
      ) === "40001"
    ) {
      return "stale";
    }

    throw error;
  }
}

function remainingLimit(
  options: Options,
  seen: number,
): number {
  if (options.limit === 0) {
    return options.batchSize;
  }

  return Math.min(
    options.batchSize,
    options.limit - seen,
  );
}

function shouldContinue(
  options: Options,
  seen: number,
): boolean {
  return (
    options.limit === 0 ||
    seen < options.limit
  );
}

async function scanTracks(
  pool: ReturnType<typeof createRegistryPool>,
  options: Options,
  stats: RunStats,
): Promise<void> {
  let seen = 0;
  let cursorUpdatedAt: string | null =
    null;
  let cursorId = "";

  while (
    shouldContinue(options, seen)
  ) {
    const take =
      remainingLimit(
        options,
        seen,
      );

    if (take <= 0) {
      break;
    }

    const result =
      await pool.query(
        `
        select
          t.id::text,
          t.slug,
          t.title,
          t.updated_at::text,
          pa.artist_slug
            as primary_artist_slug,
          pa.artist_name_text
            as primary_artist_name
        from public.registry_tracks t
        left join lateral (
          select
            ta.artist_slug,
            ta.artist_name_text
          from public.registry_track_artists ta
          where ta.track_id = t.id
            and ta.status = 'active'
            and ta.is_primary is true
            and nullif(
              btrim(ta.artist_slug),
              ''
            ) is not null
          order by
            ta.credit_order nulls last,
            ta.created_at,
            ta.id
          limit 1
        ) pa on true
        where t.status = 'active'
          and (
            $1::timestamptz is null
            or t.updated_at >=
               $1::timestamptz
          )
          and (
            $2::timestamptz is null
            or t.updated_at >
               $2::timestamptz
            or (
              t.updated_at =
                $2::timestamptz
              and t.id::text > $3
            )
          )
          and mod(
            hashtextextended(
              t.id::text,
              0
            )::numeric +
              9223372036854775808,
            $4::numeric
          ) = $5::numeric
        order by
          t.updated_at,
          t.id
        limit $6
        `,
        [
          options.since,
          cursorUpdatedAt,
          cursorId,
          options.shardCount,
          options.shardIndex,
          take,
        ],
      );

    if (!result.rowCount) {
      break;
    }

    const rows =
      result.rows as TrackRow[];
    const trackIds =
      rows.map(
        (row) => row.id,
      );
    const featured =
      await loadTrackFeaturedArtists(
        pool,
        trackIds,
      );
    const artistSlugs = [
      ...new Set(
        rows
          .map(
            (row) =>
              String(
                row.primary_artist_slug ||
                  "",
              ),
          )
          .filter(Boolean),
      ),
    ];
    const primaryArtistScopes =
      await loadTrackPrimaryArtistSlugs(
        pool,
        trackIds,
      );
    const allPrimaryArtistSlugs = [
      ...new Set(
        [
          ...artistSlugs,
          ...Array.from(
            primaryArtistScopes.values(),
          ).flat(),
        ].filter(Boolean),
      ),
    ];
    const artistScope =
      await loadArtistScopeCandidates(
        pool,
        allPrimaryArtistSlugs,
      );
    const releaseScope =
      await loadReleaseScopeCandidates(
        pool,
        trackIds,
      );

    for (const row of rows) {
      const canonicalTitleSlug =
        slugifyIdentity(
          stripFeatureCreditNoise(
            row.title,
          ).coreTitle,
        );
      const recordingIdentityPeers =
        Array.from(
          new Map(
            (
              primaryArtistScopes.get(
                row.id,
              ) || []
            )
              .flatMap(
                (sharedPrimaryArtistSlug) =>
                  (
                    artistScope.get(
                      sharedPrimaryArtistSlug,
                    ) || []
                  )
                    .filter(
                      (candidate) =>
                        candidate.id !==
                          row.id &&
                        candidate.proposedSlug ===
                          canonicalTitleSlug,
                    )
                    .map(
                      (candidate) => [
                        candidate.id,
                        {
                          id: candidate.id,
                          slug:
                            candidate.slug,
                          title:
                            candidate.title,
                          sharedPrimaryArtistSlug,
                        },
                      ] as const,
                    ),
              ),
          ).values(),
        );

      const rowFindings =
        analyzeTrackIdentity({
          id: row.id,
          slug: row.slug,
          title: row.title,
          primaryArtistSlug:
            row.primary_artist_slug,
          primaryArtistName:
            row.primary_artist_name,
          featuredArtists:
            featured.get(row.id) || [],
          recordingIdentityPeers,
        });

      for (
        const finding
        of rowFindings
      ) {
        recordFinding(
          stats,
          finding,
        );

        if (
          options.mode !== "apply"
        ) {
          continue;
        }

        if (
          finding.disposition ===
          "observe"
        ) {
          continue;
        }

        if (
          finding.disposition ===
          "review"
        ) {
          await queueReview(
            pool,
            finding,
          );
          stats.queued += 1;
          continue;
        }

        const collision =
          candidateCollision(
            finding,
            row,
            artistScope,
            releaseScope,
          );

        if (collision) {
          await queueReview(
            pool,
            {
              ...finding,
              disposition: "review",
              reason:
                finding.reason +
                "," +
                collision,
            },
            { collision },
          );
          stats.queued += 1;
          continue;
        }

        const outcome =
          await applyTrackSlug(
            pool,
            row,
            finding,
          );

        if (
          outcome.outcome ===
          "applied"
        ) {
          stats.applied += 1;
        } else if (
          outcome.outcome ===
          "stale"
        ) {
          stats.stale += 1;
        } else {
          await queueReview(
            pool,
            {
              ...finding,
              disposition: "review",
              reason:
                finding.reason +
                "," +
                outcome.reason,
            },
            {
              collision:
                outcome.reason,
            },
          );
          stats.queued += 1;
        }
      }
    }

    seen += rows.length;
    stats.rowsScanned.track +=
      rows.length;

    const last =
      rows[rows.length - 1];
    cursorUpdatedAt =
      last.updated_at;
    cursorId = last.id;
    stats.cursors.track = {
      updatedAt:
        cursorUpdatedAt,
      id: cursorId,
    };
  }
}

async function scanReleases(
  pool: ReturnType<typeof createRegistryPool>,
  options: Options,
  stats: RunStats,
): Promise<void> {
  const releaseSlugPlan =
    await loadReleaseSlugPlan(
      pool,
    );

  let seen = 0;
  let cursorUpdatedAt: string | null =
    null;
  let cursorId = "";

  while (
    shouldContinue(options, seen)
  ) {
    const take =
      remainingLimit(
        options,
        seen,
      );

    if (take <= 0) {
      break;
    }

    const result =
      await pool.query(
        `
        select
          r.id::text,
          r.slug,
          r.title,
          r.release_type,
          r.release_date::text,
          pa.artist_id::text
            as primary_artist_id,
          pa.artist_slug
            as primary_artist_slug,
          (
            select count(*)::integer
            from public.registry_release_tracks rt
            join public.registry_tracks t
              on t.id = rt.track_id
             and t.status = 'active'
            where rt.release_id = r.id
              and rt.status = 'active'
          ) as resolvable_active_track_count,
          r.updated_at::text
        from public.registry_releases r
        left join lateral (
          select
            ra.artist_id,
            ra.artist_slug
          from public.registry_release_artists ra
          where ra.release_id = r.id
            and ra.status = 'active'
            and ra.is_primary is true
          order by
            ra.credit_order nulls last,
            ra.created_at,
            ra.id
          limit 1
        ) pa on true
        where r.status = 'active'
          and (
            $1::timestamptz is null
            or r.updated_at >=
               $1::timestamptz
          )
          and (
            $2::timestamptz is null
            or r.updated_at >
               $2::timestamptz
            or (
              r.updated_at =
                $2::timestamptz
              and r.id::text > $3
            )
          )
          and mod(
            hashtextextended(
              r.id::text,
              0
            )::numeric +
              9223372036854775808,
            $4::numeric
          ) = $5::numeric
        order by
          r.updated_at,
          r.id
        limit $6
        `,
        [
          options.since,
          cursorUpdatedAt,
          cursorId,
          options.shardCount,
          options.shardIndex,
          take,
        ],
      );

    if (!result.rowCount) {
      break;
    }

    const rows =
      result.rows as ReleaseRow[];

    for (const row of rows) {
      const rowFindings =
        analyzeReleaseIdentity({
          id: row.id,
          slug: row.slug,
          title: row.title,
          releaseType:
            row.release_type,
          activeTrackCount:
            row.resolvable_active_track_count,
        });

      for (
        const finding
        of rowFindings
      ) {
        const plan =
          finding.ruleId ===
            "release_slug_provider_packaging"
            ? releaseSlugPlan.get(
                row.id,
              )
            : undefined;

        const effectiveFinding =
          plan
            ? {
                ...finding,
                proposedValue:
                  plan.plannedSlug,
                evidence: {
                  ...finding.evidence,
                  baseCleanSlug:
                    plan.baseSlug,
                  collisionStrategy:
                    plan.usesDateFallback
                      ? "release_date_suffix"
                      : "clean_slug",
                },
              }
            : finding;

        recordFinding(
          stats,
          effectiveFinding,
        );

        if (
          options.mode !== "apply"
        ) {
          continue;
        }

        if (
          effectiveFinding.disposition ===
          "observe"
        ) {
          continue;
        }

        if (
          effectiveFinding.ruleId ===
            "release_taxonomy_drift" &&
          effectiveFinding.disposition ===
            "auto_fix_candidate"
        ) {
          const outcome =
            await applyReleaseTaxonomy(
              pool,
              row,
              effectiveFinding,
            );

          if (outcome === "applied") {
            stats.applied += 1;
          } else {
            stats.stale += 1;
          }

          continue;
        }

        if (
          effectiveFinding.ruleId ===
            "release_slug_provider_packaging" &&
          effectiveFinding.disposition ===
            "auto_fix_candidate"
        ) {
          if (!plan) {
            await queueReview(
              pool,
              {
                ...effectiveFinding,
                disposition: "review",
                reason:
                  effectiveFinding.reason +
                  ",release_slug_plan_missing",
              },
            );
            stats.queued += 1;
            continue;
          }

          const outcome =
            await applyReleaseSlugPackaging(
              pool,
              row,
              effectiveFinding,
              plan,
            );

          if (outcome === "applied") {
            stats.applied += 1;
          } else {
            stats.stale += 1;
          }

          continue;
        }

        if (
          effectiveFinding.disposition ===
            "review"
        ) {
          await queueReview(
            pool,
            effectiveFinding,
          );
          stats.queued += 1;
        }
      }
    }

    seen += rows.length;
    stats.rowsScanned.release +=
      rows.length;

    const last =
      rows[rows.length - 1];
    cursorUpdatedAt =
      last.updated_at;
    cursorId = last.id;
    stats.cursors.release = {
      updatedAt:
        cursorUpdatedAt,
      id: cursorId,
    };
  }
}

async function scanCharts(
  pool: ReturnType<typeof createRegistryPool>,
  options: Options,
  stats: RunStats,
): Promise<void> {
  let seen = 0;
  let cursorUpdatedAt: string | null =
    null;
  let cursorId = "";

  while (
    shouldContinue(options, seen)
  ) {
    const take =
      remainingLimit(
        options,
        seen,
      );

    if (take <= 0) {
      break;
    }

    const result =
      await pool.query(
        `
        select
          e.id,
          e.track_slug,
          e.artist_slug,
          e.canonical_track_id,
          t.slug
            as canonical_track_slug,
          pa.artist_slug
            as canonical_primary_artist_slug,
          e.updated_at::text
        from public.wk_chart_entries_v2 e
        left join public.registry_tracks t
          on t.id::text =
             e.canonical_track_id
        left join lateral (
          select ta.artist_slug
          from public.registry_track_artists ta
          where ta.track_id = t.id
            and ta.status = 'active'
            and ta.is_primary is true
            and nullif(
              btrim(ta.artist_slug),
              ''
            ) is not null
          order by
            ta.credit_order nulls last,
            ta.created_at,
            ta.id
          limit 1
        ) pa on true
        where (
          $1::timestamptz is null
          or e.updated_at >=
             $1::timestamptz
        )
          and (
            $2::timestamptz is null
            or e.updated_at >
               $2::timestamptz
            or (
              e.updated_at =
                $2::timestamptz
              and e.id > $3
            )
          )
          and mod(
            hashtextextended(
              e.id,
              0
            )::numeric +
              9223372036854775808,
            $4::numeric
          ) = $5::numeric
        order by
          e.updated_at,
          e.id
        limit $6
        `,
        [
          options.since,
          cursorUpdatedAt,
          cursorId,
          options.shardCount,
          options.shardIndex,
          take,
        ],
      );

    if (!result.rowCount) {
      break;
    }

    const rows =
      result.rows as ChartRow[];

    for (const row of rows) {
      const rowFindings =
        analyzeChartIdentity({
          id: row.id,
          trackSlug:
            row.track_slug,
          artistSlug:
            row.artist_slug,
          canonicalTrackId:
            row.canonical_track_id,
          canonicalTrackSlug:
            row.canonical_track_slug,
          canonicalPrimaryArtistSlug:
            row.canonical_primary_artist_slug,
        });

      for (
        const finding
        of rowFindings
      ) {
        recordFinding(
          stats,
          finding,
        );

        if (
          options.mode !== "apply"
        ) {
          continue;
        }

        if (
          finding.ruleId ===
            "chart_track_slug_drift" &&
          finding.disposition ===
            "auto_fix_candidate"
        ) {
          const outcome =
            await applyChartSlug(
              pool,
              finding,
            );

          if (
            outcome === "applied"
          ) {
            stats.applied += 1;
          } else {
            stats.stale += 1;
          }
        } else if (
          finding.disposition ===
            "review"
        ) {
          await queueReview(
            pool,
            finding,
          );
          stats.queued += 1;
        }
      }
    }

    seen += rows.length;
    stats.rowsScanned.chart +=
      rows.length;

    const last =
      rows[rows.length - 1];
    cursorUpdatedAt =
      last.updated_at;
    cursorId = last.id;
    stats.cursors.chart = {
      updatedAt:
        cursorUpdatedAt,
      id: cursorId,
    };
  }
}

function printStats(
  stats: RunStats,
  options: Options,
): void {
  console.log(
    "\nFindings by rule",
  );
  console.log(
    "-".repeat(80),
  );
  console.table(
    [...stats.byRule.entries()]
      .map(
        ([rule, count]) => ({
          rule,
          count,
        }),
      )
      .sort(
        (left, right) =>
          right.count -
          left.count,
      ),
  );

  console.log(
    "\nSample findings",
  );
  console.log(
    "-".repeat(80),
  );
  console.table(
    stats.sample.map(
      (finding) => ({
        rule: finding.ruleId,
        entity:
          finding.entityType,
        id: finding.entityId,
        field:
          finding.fieldName,
        before:
          finding.currentValue,
        after:
          finding.proposedValue,
        disposition:
          finding.disposition,
        confidence:
          finding.confidence,
      }),
    ),
  );

  console.log(
    "\nRun summary",
  );
  console.log(
    "-".repeat(80),
  );
  console.table([
    {
      findings:
        stats.findings,
      applied:
        stats.applied,
      queued_for_review:
        stats.queued,
      observed_findings:
        stats.observed,
      stale:
        stats.stale,
      tracks_scanned:
        stats.rowsScanned.track,
      releases_scanned:
        stats.rowsScanned.release,
      chart_entries_scanned:
        stats.rowsScanned.chart,
      mode: options.mode,
      rule_set:
        MIZIZI_RULESET_VERSION,
    },
  ]);

  console.log(
    "\nLast keyset cursor by entity",
  );
  console.log(
    "-".repeat(80),
  );
  console.table(
    Object.entries(
      stats.cursors,
    ).map(
      ([entity, cursor]) => ({
        entity,
        updated_at:
          cursor?.updatedAt || "",
        id:
          cursor?.id || "",
      }),
    ),
  );
}

async function sendOperationalStandup(
  pool: ReturnType<typeof createRegistryPool>,
  options: Options,
  stats: RunStats,
): Promise<void> {
  if (
    options.mode !== "apply" ||
    !options.sendStandup
  ) {
    return;
  }

  const blocked =
    stats.queued + stats.stale;
  const recommendation =
    blocked > 0
      ? (
          "Recommendation: review blocked or stale findings before the next governed apply."
        )
      : (
          "Recommendation: no blocked findings remain from this run."
        );

  const body = [
    "MIZIZI operational standup",
    "",
    "Rule set: " +
      MIZIZI_RULESET_VERSION,
    "Entity scope: " +
      options.entity,
    "Findings: " +
      stats.findings,
    "Applied: " +
      stats.applied,
    "Queued for review: " +
      stats.queued,
    "Observed: " +
      stats.observed,
    "Stale: " +
      stats.stale,
    "",
    "Successes: governed Registry repairs completed with canonical write provenance.",
    "Blocked work: " +
      blocked +
      " finding(s) require review or a fresh run.",
    "Learnings: redirect rows were not created; canonical identity and current pointers are repaired directly.",
    recommendation,
  ].join("\n");

  const evidence = {
    ruleSet:
      MIZIZI_RULESET_VERSION,
    entity:
      options.entity,
    findings:
      stats.findings,
    applied:
      stats.applied,
    queued:
      stats.queued,
    observed:
      stats.observed,
    stale:
      stats.stale,
    cursors:
      stats.cursors,
  };

  const digest =
    createHash("sha256")
      .update(
        JSON.stringify(
          evidence,
        ),
      )
      .digest("hex")
      .slice(0, 32);

  const result =
    await pool.query(
      `
      select *
      from mizizi_private
        .send_operational_standup_v1(
          $1::text,
          $2::text
        )
      `,
      [
        body,
        "mizizi-standup-" + digest,
      ],
    );

  if (result.rowCount !== 1) {
    throw new Error(
      "MIZIZI standup wrapper did not return one command receipt.",
    );
  }
}

async function main(): Promise<void> {
  const options =
    parseOptions();
  const pool =
    createRegistryPool();
  const stats =
    newStats();

  try {
    await pool.query("select 1");
    await assertRequiredTables(
      pool,
    );

    console.log(
      "\n" +
        MIZIZI_AGENT_LABEL,
    );
    console.log(
      "=".repeat(80),
    );
    console.log(
      "Rule set: " +
        MIZIZI_RULESET_VERSION,
    );
    console.log(
      "Mode: " +
        options.mode,
    );
    console.log(
      "Entity scope: " +
        options.entity,
    );
    console.log(
      "Batch size: " +
        options.batchSize,
    );
    console.log(
      "Limit per entity type: " +
        (
          options.limit === 0
            ? "unlimited"
            : options.limit
        ),
    );
    console.log(
      "Shard: " +
        options.shardIndex +
        "/" +
        options.shardCount,
    );
    console.log(
      "Since: " +
        (
          options.since ||
          "full scan"
        ),
    );

    if (
      options.entity === "track" ||
      options.entity === "all"
    ) {
      await scanTracks(
        pool,
        options,
        stats,
      );
    }

    if (
      options.entity === "release" ||
      options.entity === "all"
    ) {
      await scanReleases(
        pool,
        options,
        stats,
      );
    }

    if (
      options.entity === "chart" ||
      options.entity === "all"
    ) {
      await scanCharts(
        pool,
        options,
        stats,
      );
    }

    printStats(
      stats,
      options,
    );

    await sendOperationalStandup(
      pool,
      options,
      stats,
    );

    if (
      options.mode === "audit"
    ) {
      console.log(
        "Audit mode completed. No Registry rows were changed.",
      );
    }
  } finally {
    await pool
      .end()
      .catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(
    "\nMIZIZI failed:",
    error instanceof Error
      ? error.message
      : error,
  );
  process.exitCode = 1;
});
