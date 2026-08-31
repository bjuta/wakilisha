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
  proposedSlug: string;
};

type RunStats = {
  findings: number;
  applied: number;
  queued: number;
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
  };
}

function sourceTableFor(
  entityType: MiziziFinding["entityType"],
): string {
  if (entityType === "track") {
    return "registry_tracks";
  }

  if (entityType === "release") {
    return "registry_releases";
  }

  return "wk_chart_entries_v2";
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
    "wk_slug_redirects",
    "registry_review_items",
    "registry_canonical_write_events",
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

function reviewKey(
  finding: MiziziFinding,
): string {
  return (
    MIZIZI_AGENT_KEY +
    ":" +
    finding.fingerprint
  );
}

function findingTitle(
  finding: MiziziFinding,
): string {
  const label =
    finding.entityType === "track"
      ? "Track"
      : finding.entityType === "release"
        ? "Release"
        : "chart entry";

  return (
    "MIZIZI found " +
    label +
    " data that needs review"
  );
}

async function queueReview(
  pool: ReturnType<typeof createRegistryPool>,
  finding: MiziziFinding,
  extraEvidence: Record<string, unknown> = {},
): Promise<void> {
  await pool.query(
    `
    insert into public.registry_review_items (
      review_key,
      entity_type,
      entity_id,
      review_type,
      priority,
      status,
      title,
      summary,
      source_table,
      source_id,
      source_payload,
      candidate_payload,
      created_at,
      updated_at
    )
    values (
      $1,
      $2,
      case
        when $3 ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then $3::uuid
        else null
      end,
      'mizizi_data_hygiene',
      $4,
      'open',
      $5,
      $6,
      $7,
      $3,
      $8::jsonb,
      $9::jsonb,
      now(),
      now()
    )
    on conflict (review_key)
    do update set
      priority = excluded.priority,
      title = excluded.title,
      summary = excluded.summary,
      source_payload = excluded.source_payload,
      candidate_payload = excluded.candidate_payload,
      updated_at = now()
    where public.registry_review_items.status <> 'resolved'
    `,
    [
      reviewKey(finding),
      finding.entityType,
      finding.entityId,
      finding.severity === "high"
        ? "high"
        : "normal",
      findingTitle(finding),
      finding.reason,
      sourceTableFor(finding.entityType),
      JSON.stringify({
        agent: MIZIZI_AGENT_KEY,
        ruleId: finding.ruleId,
        ruleVersion: finding.ruleVersion,
        fieldName: finding.fieldName,
        currentValue: finding.currentValue,
        confidence: finding.confidence,
        evidence: {
          ...finding.evidence,
          ...extraEvidence,
        },
      }),
      JSON.stringify({
        proposedValue: finding.proposedValue,
        disposition: finding.disposition,
      }),
    ],
  );
}

async function writeCanonicalEvent(
  pool: ReturnType<typeof createRegistryPool>,
  finding: MiziziFinding,
  downstreamImpact: Record<string, unknown> = {},
): Promise<void> {
  const sourceTable =
    sourceTableFor(finding.entityType);

  await pool.query(
    `
    insert into public.registry_canonical_write_events (
      registry_entity_type,
      registry_entity_id,
      source_suggestion_id,
      source_table,
      field_name,
      target_path,
      before_value,
      after_value,
      action,
      status,
      actor,
      created_at
    )
    values (
      $1,
      $2,
      $3,
      'mizizi_cultural_data_steward',
      $4,
      $5,
      $6::jsonb,
      $7::jsonb,
      'canonicalize_identity',
      'succeeded',
      'mizizi',
      now()
    )
    `,
    [
      finding.entityType,
      finding.entityId,
      finding.fingerprint,
      finding.fieldName,
      "public." +
        sourceTable +
        "." +
        finding.fieldName,
      JSON.stringify({
        value: finding.currentValue,
        ruleId: finding.ruleId,
        ruleVersion: finding.ruleVersion,
      }),
      JSON.stringify({
        value: finding.proposedValue,
        confidence: finding.confidence,
        downstreamImpact,
      }),
    ],
  );
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
    order by ta.artist_slug, t.id
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

async function currentScopeCollision(
  pool: ReturnType<typeof createRegistryPool>,
  row: TrackRow,
  proposedSlug: string,
): Promise<string> {
  const artistSlug = String(
    row.primary_artist_slug || "",
  );

  if (!artistSlug) {
    return "missing_explicit_primary_artist_scope";
  }

  const artistCollision =
    await pool.query(
      `
      select t.id::text
      from public.registry_track_artists ta
      join public.registry_tracks t
        on t.id = ta.track_id
      where ta.artist_slug = $1
        and ta.status = 'active'
        and ta.is_primary is true
        and t.status = 'active'
        and t.slug = $2
        and t.id <> $3::uuid
      order by t.id
      limit 1
      `,
      [
        artistSlug,
        proposedSlug,
        row.id,
      ],
    );

  if (artistCollision.rowCount) {
    return (
      "candidate_slug_collides_with_track:" +
      String(
        artistCollision.rows[0].id,
      )
    );
  }

  const releaseCollision =
    await pool.query(
      `
      select sibling_track.id::text
      from public.registry_release_tracks target
      join public.registry_release_tracks sibling
        on sibling.release_id =
           target.release_id
       and sibling.status = 'active'
      join public.registry_tracks sibling_track
        on sibling_track.id =
           sibling.track_id
       and sibling_track.status =
           'active'
      where target.track_id = $1::uuid
        and target.status = 'active'
        and sibling_track.id <>
            $1::uuid
        and sibling_track.slug = $2
      order by sibling_track.id
      limit 1
      `,
      [
        row.id,
        proposedSlug,
      ],
    );

  if (releaseCollision.rowCount) {
    return (
      "candidate_slug_collides_with_track:" +
      String(
        releaseCollision.rows[0].id,
      )
    );
  }

  return "";
}

async function loadTrackRedirectPaths(
  pool: ReturnType<typeof createRegistryPool>,
  row: TrackRow,
  oldSlug: string,
  newSlug: string,
): Promise<
  Array<{
    scopeSlug: string;
    oldPath: string;
    newPath: string;
  }>
> {
  const paths: Array<{
    scopeSlug: string;
    oldPath: string;
    newPath: string;
  }> = [];
  const primary = String(
    row.primary_artist_slug || "",
  );

  if (primary) {
    paths.push({
      scopeSlug: primary,
      oldPath:
        "/tracks/" +
        primary +
        "/" +
        oldSlug,
      newPath:
        "/tracks/" +
        primary +
        "/" +
        newSlug,
    });
  }

  const releaseResult =
    await pool.query(
      `
      select
        r.slug as release_slug,
        coalesce(
          (
            select ra.artist_slug
            from public.registry_release_artists ra
            where ra.release_id = r.id
              and ra.status = 'active'
              and ra.is_primary is true
              and nullif(
                btrim(ra.artist_slug),
                ''
              ) is not null
            order by
              ra.credit_order nulls last,
              ra.id
            limit 1
          ),
          $2
        ) as artist_slug,
        (
          select count(*)
          from public.registry_release_tracks member
          where member.release_id = r.id
            and member.status = 'active'
        )::integer as active_track_count
      from public.registry_release_tracks rt
      join public.registry_releases r
        on r.id = rt.release_id
      where rt.track_id = $1::uuid
        and rt.status = 'active'
        and r.status = 'active'
      order by r.id
      `,
      [
        row.id,
        primary,
      ],
    );

  for (
    const release
    of releaseResult.rows
  ) {
    const artistSlug = String(
      release.artist_slug || "",
    );
    const releaseSlug = String(
      release.release_slug || "",
    );
    const activeTrackCount = Number(
      release.active_track_count || 0,
    );

    if (
      !artistSlug ||
      !releaseSlug
    ) {
      continue;
    }

    const oldPath =
      "/releases/" +
      artistSlug +
      "/" +
      releaseSlug +
      "/" +
      oldSlug;

    const newPath =
      activeTrackCount > 1
        ? (
            "/releases/" +
            artistSlug +
            "/" +
            releaseSlug +
            "/" +
            newSlug
          )
        : (
            "/tracks/" +
            artistSlug +
            "/" +
            newSlug
          );

    paths.push({
      scopeSlug: artistSlug,
      oldPath,
      newPath,
    });
  }

  return paths;
}

async function ensureRedirect(
  pool: ReturnType<typeof createRegistryPool>,
  scopeSlug: string,
  oldSlug: string,
  newSlug: string,
  oldPath: string,
  newPath: string,
): Promise<void> {
  if (oldPath === newPath) {
    return;
  }

  const existing =
    await pool.query(
      `
      select new_path
      from public.wk_slug_redirects
      where old_path = $1
      limit 1
      `,
      [oldPath],
    );

  if (existing.rowCount) {
    const currentTarget = String(
      existing.rows[0].new_path || "",
    );

    if (
      currentTarget !== newPath
    ) {
      throw new Error(
        "Redirect conflict for " +
          oldPath +
          ": existing target " +
          currentTarget,
      );
    }

    return;
  }

  await pool.query(
    `
    insert into public.wk_slug_redirects (
      old_slug,
      new_slug,
      entity_type,
      created_by,
      scope_slug,
      old_path,
      new_path,
      redirect_status,
      created_at,
      updated_at
    )
    values (
      $1,
      $2,
      'track',
      $3,
      $4,
      $5,
      $6,
      301,
      now(),
      now()
    )
    `,
    [
      oldSlug,
      newSlug,
      MIZIZI_AGENT_KEY +
        ":" +
        MIZIZI_RULESET_VERSION,
      scopeSlug,
      oldPath,
      newPath,
    ],
  );
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
  await pool.query("begin");

  try {
    await pool.query(
      `
      select pg_advisory_xact_lock(
        hashtextextended(
          'mizizi:track-scope:' || $1,
          0
        )
      )
      `,
      [
        row.primary_artist_slug || "",
      ],
    );

    const locked =
      await pool.query(
        `
        select slug
        from public.registry_tracks
        where id = $1::uuid
          and status = 'active'
        for update
        `,
        [row.id],
      );

    if (
      !locked.rowCount ||
      String(
        locked.rows[0].slug,
      ) !== finding.currentValue
    ) {
      await pool.query("rollback");
      return {
        outcome: "stale",
      };
    }

    const collision =
      await currentScopeCollision(
        pool,
        row,
        finding.proposedValue,
      );

    if (collision) {
      await pool.query("rollback");

      return {
        outcome: "collision",
        reason: collision,
      };
    }

    const paths =
      await loadTrackRedirectPaths(
        pool,
        row,
        finding.currentValue,
        finding.proposedValue,
      );

    for (const path of paths) {
      await ensureRedirect(
        pool,
        path.scopeSlug,
        finding.currentValue,
        finding.proposedValue,
        path.oldPath,
        path.newPath,
      );
    }

    const updated =
      await pool.query(
        `
        update public.registry_tracks
        set
          slug = $1,
          updated_at = now()
        where id = $2::uuid
          and slug = $3
        returning id
        `,
        [
          finding.proposedValue,
          row.id,
          finding.currentValue,
        ],
      );

    if (!updated.rowCount) {
      throw new Error(
        "Track changed after lock: " +
          row.id,
      );
    }

    const chartUpdate =
      await pool.query(
        `
        update public.wk_chart_entries_v2
        set
          track_slug = $1,
          updated_at = now()
        where canonical_track_id = $2
          and track_slug
              is distinct from $1
        `,
        [
          finding.proposedValue,
          row.id,
        ],
      );

    await writeCanonicalEvent(
      pool,
      finding,
      {
        permanentRedirects:
          paths.length,
        chartEntriesUpdated:
          chartUpdate.rowCount || 0,
      },
    );

    await pool.query("commit");

    return {
      outcome: "applied",
      chartRows:
        chartUpdate.rowCount || 0,
      redirects: paths.length,
    };
  } catch (error) {
    await pool
      .query("rollback")
      .catch(() => undefined);

    throw error;
  }
}

async function applyChartSlug(
  pool: ReturnType<typeof createRegistryPool>,
  finding: MiziziFinding,
): Promise<
  "applied" | "stale"
> {
  await pool.query("begin");

  try {
    const updated =
      await pool.query(
        `
        update public.wk_chart_entries_v2
        set
          track_slug = $1,
          updated_at = now()
        where id = $2
          and track_slug = $3
        returning id
        `,
        [
          finding.proposedValue,
          finding.entityId,
          finding.currentValue,
        ],
      );

    if (!updated.rowCount) {
      await pool.query("rollback");
      return "stale";
    }

    await writeCanonicalEvent(
      pool,
      finding,
    );
    await pool.query("commit");

    return "applied";
  } catch (error) {
    await pool
      .query("rollback")
      .catch(() => undefined);

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
    const artistScope =
      await loadArtistScopeCandidates(
        pool,
        artistSlugs,
      );
    const releaseScope =
      await loadReleaseScopeCandidates(
        pool,
        trackIds,
      );

    for (const row of rows) {
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
          id::text,
          slug,
          title,
          release_type,
          updated_at::text
        from public.registry_releases
        where status = 'active'
          and (
            $1::timestamptz is null
            or updated_at >=
               $1::timestamptz
          )
          and (
            $2::timestamptz is null
            or updated_at >
               $2::timestamptz
            or (
              updated_at =
                $2::timestamptz
              and id::text > $3
            )
          )
          and mod(
            hashtextextended(
              id::text,
              0
            )::numeric +
              9223372036854775808,
            $4::numeric
          ) = $5::numeric
        order by
          updated_at,
          id
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
          options.mode === "apply"
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
        } else {
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
