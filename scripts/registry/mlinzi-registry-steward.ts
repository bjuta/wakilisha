import pg from "pg";
import {
  MLINZI_ACTOR,
  assessTrackSlug,
  classifyOneTrackReleaseArtistParity,
  type MlinziTrackCredit,
} from "../../src/services/registry/steward/mlinzi";

type TrackAuditRow = {
  id: string;
  title: string;
  slug: string;
  updated_at: string;
  credits: Array<{
    artistId: string | null;
    artistSlug: string | null;
    displayName: string | null;
    isPrimary: boolean;
    isFeatured: boolean;
  }>;
};

type OneTrackParityRow = {
  release_id: string;
  track_id: string;
  artist_id: string;
  artist_slug: string | null;
  artist_name_text: string | null;
  role: string;
  is_primary: boolean;
  is_featured: boolean;
  credit_order: number;
  display_credit: string | null;
  source: string;
  confidence: number;
  metadata: Record<string, unknown>;
};

type Options = {
  apply: boolean;
  limit: number;
  mode: "all" | "slugs" | "relationships";
  since: string | null;
};

type MlinziCheckpoint = {
  watermarkTime: string | null;
  watermarkKey: string | null;
};

type MlinziFindingState = {
  retryCount: number;
  publicBreakage: boolean;
};

function parseOptions(argv: string[]): Options {
  let apply = false;
  let limit = 5000;
  let mode: Options["mode"] = "all";
  let since: string | null = null;

  for (const arg of argv) {
    if (arg === "--apply") {
      apply = true;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      const parsed = Number(arg.slice("--limit=".length));
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100000) {
        throw new Error("--limit must be an integer between 1 and 100000.");
      }
      limit = parsed;
      continue;
    }

    if (arg.startsWith("--mode=")) {
      const value = arg.slice("--mode=".length);
      if (
        value !== "all" &&
        value !== "slugs" &&
        value !== "relationships"
      ) {
        throw new Error("--mode must be all, slugs, or relationships.");
      }
      mode = value;
      continue;
    }

    if (arg.startsWith("--since=")) {
      const value = arg.slice("--since=".length).trim();
      if (!value || Number.isNaN(Date.parse(value))) {
        throw new Error("--since must be an ISO date or timestamp.");
      }
      since = new Date(value).toISOString();
      continue;
    }

    throw new Error(`Unknown Mlinzi option: ${arg}`);
  }

  return { apply, limit, mode, since };
}

function normalizeDatabaseUrl(value: string): string {
  return value.replace(/\?sslmode=[^&]+/i, "");
}

function createPool(): pg.Pool {
  const databaseUrl = process.env.DATABASE_URL;
  const explicitHost = process.env.PGHOST;
  const explicitUser = process.env.PGUSER;
  const explicitPassword = process.env.PGPASSWORD;
  const explicitDatabase = process.env.PGDATABASE;
  const explicitPort = Number(process.env.PGPORT || 5432);

  if (
    explicitHost &&
    explicitUser &&
    explicitPassword &&
    explicitDatabase
  ) {
    return new pg.Pool({
      host: explicitHost,
      port: explicitPort,
      user: explicitUser,
      password: explicitPassword,
      database: explicitDatabase,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
      statement_timeout: 30000,
      query_timeout: 30000,
      max: 4,
    });
  }

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL or explicit PG* environment variables are required.",
    );
  }

  return new pg.Pool({
    connectionString: normalizeDatabaseUrl(databaseUrl),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000,
    query_timeout: 30000,
    max: 4,
  });
}

async function acquireAgentLock(client: pg.PoolClient): Promise<boolean> {
  const result = await client.query<{ locked: boolean }>(
    `
      select pg_try_advisory_lock(
        hashtext('wakilisha:mlinzi:registry-steward')
      ) as locked
    `,
  );

  return Boolean(result.rows[0]?.locked);
}

async function releaseAgentLock(client: pg.PoolClient): Promise<void> {
  await client.query(
    `
      select pg_advisory_unlock(
        hashtext('wakilisha:mlinzi:registry-steward')
      )
    `,
  );
}

function slugFindingKey(trackId: string): string {
  return `track:${trackId}:slug_hygiene`;
}

async function readFindingState(
  pool: pg.Pool,
  findingKey: string,
): Promise<MlinziFindingState> {
  const result = await pool.query<{
    retry_count: number;
    public_breakage: boolean;
  }>(
    `
      select
        retry_count,
        public_breakage
      from platform_private.registry_steward_findings
      where finding_key = $1
        and steward_key = $2
      limit 1
    `,
    [findingKey, MLINZI_ACTOR],
  );

  return {
    retryCount: Number(result.rows[0]?.retry_count || 0),
    publicBreakage: Boolean(
      result.rows[0]?.public_breakage,
    ),
  };
}

async function rememberFinding(
  pool: pg.Pool,
  input: {
    findingKey: string;
    entityType: string;
    entityId: string;
    fieldName: string;
    rule: string;
    disposition: "defer" | "human_required";
    publicBreakage: boolean;
    context: Record<string, unknown>;
  },
): Promise<void> {
  const existing = await readFindingState(
    pool,
    input.findingKey,
  );
  const nextRetryCount = existing.retryCount + 1;
  const retryHours = Math.min(
    168,
    2 ** Math.min(nextRetryCount, 7),
  );

  await pool.query(
    `
      insert into platform_private.registry_steward_findings (
        finding_key,
        steward_key,
        entity_type,
        entity_id,
        field_name,
        rule,
        disposition,
        retry_count,
        public_breakage,
        context,
        first_seen_at,
        last_seen_at,
        next_retry_at,
        human_required_at,
        resolved_at,
        resolution
      )
      values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10::jsonb,
        now(),
        now(),
        case
          when $7 = 'human_required' then null
          else now() + make_interval(hours => $11)
        end,
        case
          when $7 = 'human_required' then now()
          else null
        end,
        null,
        null
      )
      on conflict (finding_key)
      do update
      set
        rule = excluded.rule,
        disposition = excluded.disposition,
        retry_count = excluded.retry_count,
        public_breakage =
          platform_private.registry_steward_findings.public_breakage
          or excluded.public_breakage,
        context = excluded.context,
        last_seen_at = now(),
        next_retry_at = excluded.next_retry_at,
        human_required_at =
          case
            when excluded.disposition = 'human_required'
              then coalesce(
                platform_private.registry_steward_findings.human_required_at,
                now()
              )
            else null
          end,
        resolved_at = null,
        resolution = null
    `,
    [
      input.findingKey,
      MLINZI_ACTOR,
      input.entityType,
      input.entityId,
      input.fieldName,
      input.rule,
      input.disposition,
      nextRetryCount,
      input.publicBreakage,
      JSON.stringify(input.context),
      retryHours,
    ],
  );
}

async function resolveFinding(
  pool: pg.Pool,
  findingKey: string,
  resolution: string,
): Promise<void> {
  await pool.query(
    `
      update platform_private.registry_steward_findings
      set
        disposition = 'resolved',
        resolved_at = now(),
        resolution = $3,
        next_retry_at = null,
        human_required_at = null,
        last_seen_at = now()
      where finding_key = $1
        and steward_key = $2
        and disposition <> 'resolved'
    `,
    [findingKey, MLINZI_ACTOR, resolution],
  );
}

async function loadCheckpoint(
  pool: pg.Pool,
  passKey: string,
): Promise<MlinziCheckpoint> {
  const result = await pool.query<{
    watermark_time: string | null;
    watermark_key: string | null;
  }>(
    `
      select
        watermark_time::text,
        watermark_key
      from platform_private.registry_steward_checkpoints
      where steward_key = $1
        and pass_key = $2
      limit 1
    `,
    [MLINZI_ACTOR, passKey],
  );

  return {
    watermarkTime:
      result.rows[0]?.watermark_time || null,
    watermarkKey:
      result.rows[0]?.watermark_key || null,
  };
}

async function saveCheckpoint(
  pool: pg.Pool,
  passKey: string,
  rows: TrackAuditRow[],
): Promise<void> {
  if (rows.length === 0) {
    await pool.query(
      `
        insert into platform_private.registry_steward_checkpoints (
          steward_key,
          pass_key,
          rows_scanned,
          last_run_started_at,
          last_run_completed_at
        )
        values ($1, $2, 0, now(), now())
        on conflict (steward_key, pass_key)
        do update
        set
          last_run_completed_at = now()
      `,
      [MLINZI_ACTOR, passKey],
    );
    return;
  }

  const last = rows.reduce((best, row) => {
    const bestTime = new Date(best.updated_at).getTime();
    const rowTime = new Date(row.updated_at).getTime();

    if (rowTime > bestTime) return row;
    if (
      rowTime === bestTime &&
      row.id.localeCompare(best.id) > 0
    ) {
      return row;
    }
    return best;
  }, rows[0]);

  await pool.query(
    `
      insert into platform_private.registry_steward_checkpoints (
        steward_key,
        pass_key,
        watermark_time,
        watermark_key,
        rows_scanned,
        last_run_started_at,
        last_run_completed_at
      )
      values (
        $1,
        $2,
        $3::timestamptz,
        $4,
        $5,
        now(),
        now()
      )
      on conflict (steward_key, pass_key)
      do update
      set
        watermark_time =
          case
            when platform_private.registry_steward_checkpoints.watermark_time is null
              or excluded.watermark_time >
                 platform_private.registry_steward_checkpoints.watermark_time
              or (
                excluded.watermark_time =
                  platform_private.registry_steward_checkpoints.watermark_time
                and coalesce(excluded.watermark_key, '') >
                    coalesce(platform_private.registry_steward_checkpoints.watermark_key, '')
              )
            then excluded.watermark_time
            else platform_private.registry_steward_checkpoints.watermark_time
          end,
        watermark_key =
          case
            when platform_private.registry_steward_checkpoints.watermark_time is null
              or excluded.watermark_time >
                 platform_private.registry_steward_checkpoints.watermark_time
              or (
                excluded.watermark_time =
                  platform_private.registry_steward_checkpoints.watermark_time
                and coalesce(excluded.watermark_key, '') >
                    coalesce(platform_private.registry_steward_checkpoints.watermark_key, '')
              )
            then excluded.watermark_key
            else platform_private.registry_steward_checkpoints.watermark_key
          end,
        rows_scanned =
          platform_private.registry_steward_checkpoints.rows_scanned
          + excluded.rows_scanned,
        last_run_completed_at = now()
    `,
    [
      MLINZI_ACTOR,
      passKey,
      last.updated_at,
      last.id,
      rows.length,
    ],
  );
}

async function listTrackAuditRows(
  pool: pg.Pool,
  options: Options,
  checkpoint: MlinziCheckpoint | null,
): Promise<TrackAuditRow[]> {
  const result = await pool.query<TrackAuditRow>(
    `
      select
        track.id::text as id,
        track.title,
        track.slug,
        track.updated_at::text as updated_at,
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'artistId', credit.artist_id,
              'artistSlug', coalesce(
                credit.artist_slug,
                artist.slug
              ),
              'displayName', coalesce(
                credit.artist_name_text,
                artist.display_name
              ),
              'isPrimary', credit.is_primary,
              'isFeatured', credit.is_featured
            )
            order by
              credit.is_primary desc,
              credit.credit_order asc,
              credit.id asc
          ) filter (
            where credit.id is not null
              and credit.status = 'active'
          ),
          '[]'::jsonb
        ) as credits
      from public.registry_tracks track
      left join public.registry_track_artists credit
        on credit.track_id = track.id
       and credit.status = 'active'
      left join public.registry_artists artist
        on artist.id = credit.artist_id
      where track.status = 'active'
        and (
          (
            $1::timestamptz is not null
            and track.updated_at >= $1::timestamptz
          )
          or (
            $1::timestamptz is null
            and (
              $3::timestamptz is null
              or track.updated_at > $3::timestamptz
              or (
                track.updated_at = $3::timestamptz
                and track.id::text > coalesce($4, '')
              )
              or exists (
                select 1
                from platform_private.registry_steward_findings finding
                where finding.steward_key = 'mlinzi'
                  and finding.entity_type = 'track'
                  and finding.entity_id = track.id::text
                  and finding.field_name = 'slug'
                  and finding.disposition = 'defer'
                  and (
                    finding.next_retry_at is null
                    or finding.next_retry_at <= now()
                  )
              )
            )
          )
        )
      group by
        track.id,
        track.title,
        track.slug,
        track.updated_at
      order by track.updated_at asc, track.id asc
      limit $2::int
    `,
    [
      options.since,
      options.limit,
      checkpoint?.watermarkTime || null,
      checkpoint?.watermarkKey || null,
    ],
  );

  return result.rows;
}

function toCredits(row: TrackAuditRow): MlinziTrackCredit[] {
  return (row.credits || []).map((credit) => ({
    artistId: credit.artistId,
    artistSlug: credit.artistSlug,
    displayName: credit.displayName,
    isPrimary: Boolean(credit.isPrimary),
    isFeatured: Boolean(credit.isFeatured),
  }));
}

async function countRouteCollisions(
  pool: pg.Pool,
  trackId: string,
  candidateSlug: string,
  primaryArtistSlugs: string[],
): Promise<number> {
  if (primaryArtistSlugs.length === 0) return 1;

  const result = await pool.query<{ collisions: string }>(
    `
      select count(distinct other.id)::text as collisions
      from public.registry_tracks other
      join public.registry_track_artists other_credit
        on other_credit.track_id = other.id
       and other_credit.status = 'active'
       and other_credit.is_primary
      left join public.registry_artists other_artist
        on other_artist.id = other_credit.artist_id
      where other.status = 'active'
        and other.id <> $1::uuid
        and other.slug = $2
        and coalesce(
          other_credit.artist_slug,
          other_artist.slug
        ) = any($3::text[])
    `,
    [trackId, candidateSlug, primaryArtistSlugs],
  );

  return Number(result.rows[0]?.collisions || 0);
}

type RedirectPath = {
  entityType: "track";
  scopeSlug: string;
  oldSlug: string;
  newSlug: string;
  oldPath: string;
  newPath: string;
};

async function buildRedirectPaths(
  client: pg.PoolClient,
  trackId: string,
  oldSlug: string,
  newSlug: string,
  primaryArtistSlugs: string[],
): Promise<RedirectPath[]> {
  const paths: RedirectPath[] = [];

  for (const artistSlug of primaryArtistSlugs) {
    paths.push({
      entityType: "track",
      scopeSlug: artistSlug,
      oldSlug,
      newSlug,
      oldPath: `/tracks/${artistSlug}/${oldSlug}`,
      newPath: `/tracks/${artistSlug}/${newSlug}`,
    });
  }

  const nested = await client.query<{
    release_slug: string;
    release_artist_slug: string;
  }>(
    `
      with active_memberships as (
        select
          membership.release_id,
          count(*) as track_count
        from public.registry_release_tracks membership
        where membership.status = 'active'
        group by membership.release_id
        having count(*) > 1
      )
      select distinct
        release.slug as release_slug,
        coalesce(
          release_credit.artist_slug,
          release_artist.slug
        ) as release_artist_slug
      from public.registry_release_tracks membership
      join active_memberships active
        on active.release_id = membership.release_id
      join public.registry_releases release
        on release.id = membership.release_id
       and release.status = 'active'
      join public.registry_release_artists release_credit
        on release_credit.release_id = release.id
       and release_credit.status = 'active'
       and release_credit.is_primary
      left join public.registry_artists release_artist
        on release_artist.id = release_credit.artist_id
      where membership.track_id = $1::uuid
        and membership.status = 'active'
        and coalesce(
          release_credit.artist_slug,
          release_artist.slug
        ) is not null
    `,
    [trackId],
  );

  for (const row of nested.rows) {
    const scopeSlug = String(row.release_artist_slug || "").trim();
    const releaseSlug = String(row.release_slug || "").trim();
    if (!scopeSlug || !releaseSlug) continue;

    paths.push({
      entityType: "track",
      scopeSlug,
      oldSlug,
      newSlug,
      oldPath:
        `/releases/${scopeSlug}/${releaseSlug}/${oldSlug}`,
      newPath:
        `/releases/${scopeSlug}/${releaseSlug}/${newSlug}`,
    });
  }

  return paths;
}

async function hasRedirectConflict(
  pool: pg.Pool,
  paths: RedirectPath[],
): Promise<boolean> {
  if (paths.length === 0) return false;

  for (const path of paths) {
    const result = await pool.query<{ new_path: string }>(
      `
        select new_path
        from public.wk_slug_redirects
        where entity_type = $1
          and scope_slug = $2
          and old_slug = $3
          and old_path = $4
        order by created_at desc
        limit 1
      `,
      [
        path.entityType,
        path.scopeSlug,
        path.oldSlug,
        path.oldPath,
      ],
    );

    const currentTarget = String(
      result.rows[0]?.new_path || "",
    ).trim();

    if (currentTarget && currentTarget !== path.newPath) {
      return true;
    }
  }

  return false;
}

async function insertRedirectIfMissing(
  client: pg.PoolClient,
  path: RedirectPath,
): Promise<void> {
  await client.query(
    `
      insert into public.wk_slug_redirects (
        old_slug,
        new_slug,
        entity_type,
        created_by,
        scope_slug,
        old_path,
        new_path,
        redirect_status
      )
      select
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        308
      where not exists (
        select 1
        from public.wk_slug_redirects existing
        where existing.entity_type = $3
          and existing.scope_slug = $5
          and existing.old_slug = $1
          and existing.old_path = $6
          and existing.new_path = $7
      )
    `,
    [
      path.oldSlug,
      path.newSlug,
      path.entityType,
      MLINZI_ACTOR,
      path.scopeSlug,
      path.oldPath,
      path.newPath,
    ],
  );
}

async function logCanonicalWrite(
  client: pg.PoolClient,
  input: {
    entityType: string;
    entityId: string;
    fieldName: string;
    targetPath: string;
    beforeValue: unknown;
    afterValue: unknown;
    action: string;
  },
): Promise<void> {
  await client.query(
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
        actor
      )
      values (
        $1,
        $2,
        null,
        'registry_steward',
        $3,
        $4,
        $5::jsonb,
        $6::jsonb,
        $7,
        'applied',
        $8
      )
    `,
    [
      input.entityType,
      input.entityId,
      input.fieldName,
      input.targetPath,
      JSON.stringify(input.beforeValue),
      JSON.stringify(input.afterValue),
      input.action,
      MLINZI_ACTOR,
    ],
  );
}

async function applyTrackSlugRepair(
  pool: pg.Pool,
  row: TrackAuditRow,
): Promise<"applied" | "deferred" | "stale"> {
  const initialCredits = toCredits(row);
  const initialAssessment = assessTrackSlug({
    trackId: row.id,
    title: row.title,
    currentSlug: row.slug,
    credits: initialCredits,
  });

  if (initialAssessment.disposition !== "auto_repair") {
    return "deferred";
  }

  const routeCollisionCount = await countRouteCollisions(
    pool,
    row.id,
    initialAssessment.candidateSlug,
    initialAssessment.primaryArtistSlugs,
  );

  if (routeCollisionCount > 0) return "deferred";

  const client = await pool.connect();
  try {
    await client.query("begin");

    const locked = await client.query<{
      title: string;
      slug: string;
    }>(
      `
        select title, slug
        from public.registry_tracks
        where id = $1::uuid
          and status = 'active'
        for update
      `,
      [row.id],
    );

    const current = locked.rows[0];
    if (!current || current.slug !== row.slug) {
      await client.query("rollback");
      return "stale";
    }

    const creditResult = await client.query<{
      artist_id: string | null;
      artist_slug: string | null;
      display_name: string | null;
      is_primary: boolean;
      is_featured: boolean;
    }>(
      `
        select
          credit.artist_id::text as artist_id,
          coalesce(
            credit.artist_slug,
            artist.slug
          ) as artist_slug,
          coalesce(
            credit.artist_name_text,
            artist.display_name
          ) as display_name,
          credit.is_primary,
          credit.is_featured
        from public.registry_track_artists credit
        left join public.registry_artists artist
          on artist.id = credit.artist_id
        where credit.track_id = $1::uuid
          and credit.status = 'active'
        order by
          credit.is_primary desc,
          credit.credit_order asc,
          credit.id asc
      `,
      [row.id],
    );

    const credits: MlinziTrackCredit[] =
      creditResult.rows.map((credit) => ({
        artistId: credit.artist_id,
        artistSlug: credit.artist_slug,
        displayName: credit.display_name,
        isPrimary: credit.is_primary,
        isFeatured: credit.is_featured,
      }));

    const assessment = assessTrackSlug({
      trackId: row.id,
      title: current.title,
      currentSlug: current.slug,
      credits,
      routeCollisionCount: await countRouteCollisions(
        pool,
        row.id,
        initialAssessment.candidateSlug,
        initialAssessment.primaryArtistSlugs,
      ),
    });

    if (assessment.disposition !== "auto_repair") {
      await client.query("rollback");
      return "deferred";
    }

    const redirects = await buildRedirectPaths(
      client,
      row.id,
      current.slug,
      assessment.candidateSlug,
      assessment.primaryArtistSlugs,
    );

    if (await hasRedirectConflict(pool, redirects)) {
      await client.query("rollback");
      return "deferred";
    }

    for (const redirect of redirects) {
      await insertRedirectIfMissing(client, redirect);
    }

    await client.query(
      `
        update public.registry_tracks
        set slug = $2
        where id = $1::uuid
          and slug = $3
      `,
      [
        row.id,
        assessment.candidateSlug,
        current.slug,
      ],
    );

    await logCanonicalWrite(client, {
      entityType: "track",
      entityId: row.id,
      fieldName: "slug",
      targetPath: "registry_tracks.slug",
      beforeValue: current.slug,
      afterValue: assessment.candidateSlug,
      action: assessment.rule,
    });

    await client.query("commit");
    return "applied";
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function listOneTrackParityRows(
  pool: pg.Pool,
  limit: number,
): Promise<OneTrackParityRow[]> {
  const result = await pool.query<OneTrackParityRow>(
    `
      with one_track_releases as (
        select
          membership.release_id,
          min(membership.track_id) as track_id,
          count(*) as track_count
        from public.registry_release_tracks membership
        join public.registry_releases release
          on release.id = membership.release_id
         and release.status = 'active'
        join public.registry_tracks track
          on track.id = membership.track_id
         and track.status = 'active'
        where membership.status = 'active'
        group by membership.release_id
        having count(*) = 1
      )
      select
        one.release_id::text as release_id,
        one.track_id::text as track_id,
        credit.artist_id::text as artist_id,
        coalesce(
          credit.artist_slug,
          artist.slug
        ) as artist_slug,
        coalesce(
          credit.artist_name_text,
          artist.display_name
        ) as artist_name_text,
        credit.role,
        credit.is_primary,
        credit.is_featured,
        credit.credit_order,
        credit.display_credit,
        credit.source,
        credit.confidence,
        credit.metadata
      from one_track_releases one
      join public.registry_track_artists credit
        on credit.track_id = one.track_id
       and credit.status = 'active'
       and credit.artist_id is not null
      left join public.registry_artists artist
        on artist.id = credit.artist_id
      left join public.registry_release_artists existing
        on existing.release_id = one.release_id
       and existing.artist_id = credit.artist_id
       and existing.status = 'active'
      where existing.id is null
      order by one.release_id, credit.credit_order, credit.id
      limit $1::int
    `,
    [limit],
  );

  return result.rows;
}

async function applyOneTrackParityRepair(
  pool: pg.Pool,
  row: OneTrackParityRow,
): Promise<"applied" | "deferred" | "stale"> {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const shape = await client.query<{
      active_track_count: string;
      active_track_id: string | null;
    }>(
      `
        select
          count(*)::text as active_track_count,
          min(membership.track_id)::text as active_track_id
        from public.registry_release_tracks membership
        join public.registry_tracks track
          on track.id = membership.track_id
         and track.status = 'active'
        where membership.release_id = $1::uuid
          and membership.status = 'active'
      `,
      [row.release_id],
    );

    const activeTrackCount = Number(
      shape.rows[0]?.active_track_count || 0,
    );
    const activeTrackId = String(
      shape.rows[0]?.active_track_id || "",
    );

    if (
      classifyOneTrackReleaseArtistParity({
        activeTrackCount,
        missingArtistLinkCount: 1,
      }) !== "auto_repair" ||
      activeTrackId !== row.track_id
    ) {
      await client.query("rollback");
      return "stale";
    }

    const inserted = await client.query<{ id: string }>(
      `
        insert into public.registry_release_artists (
          release_id,
          artist_id,
          artist_slug,
          artist_name_text,
          role,
          is_primary,
          is_featured,
          credit_order,
          display_credit,
          source,
          confidence,
          status,
          metadata
        )
        select
          $1::uuid,
          track_credit.artist_id,
          coalesce(
            track_credit.artist_slug,
            artist.slug
          ),
          coalesce(
            track_credit.artist_name_text,
            artist.display_name
          ),
          track_credit.role,
          track_credit.is_primary,
          track_credit.is_featured,
          track_credit.credit_order,
          track_credit.display_credit,
          'mlinzi_structural_parity',
          track_credit.confidence,
          'active',
          coalesce(track_credit.metadata, '{}'::jsonb)
            || jsonb_build_object(
              'mlinzi_rule',
              'one_track_release_artist_parity',
              'source_track_id',
              $2::text,
              'source_track_credit_id',
              track_credit.id::text
            )
        from public.registry_track_artists track_credit
        left join public.registry_artists artist
          on artist.id = track_credit.artist_id
        where track_credit.track_id = $2::uuid
          and track_credit.artist_id = $3::uuid
          and track_credit.status = 'active'
          and not exists (
            select 1
            from public.registry_release_artists existing
            where existing.release_id = $1::uuid
              and existing.artist_id = $3::uuid
              and existing.status = 'active'
          )
        returning id::text
      `,
      [
        row.release_id,
        row.track_id,
        row.artist_id,
      ],
    );

    if (inserted.rowCount === 0) {
      await client.query("rollback");
      return "stale";
    }

    await logCanonicalWrite(client, {
      entityType: "release",
      entityId: row.release_id,
      fieldName: "artist_credit",
      targetPath: "registry_release_artists",
      beforeValue: null,
      afterValue: {
        artistId: row.artist_id,
        artistSlug: row.artist_slug,
        artistName: row.artist_name_text,
        isPrimary: row.is_primary,
        isFeatured: row.is_featured,
        creditOrder: row.credit_order,
        sourceTrackId: row.track_id,
      },
      action: "one_track_release_artist_parity",
    });

    await client.query("commit");
    return "applied";
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function runSlugPass(
  pool: pg.Pool,
  options: Options,
): Promise<Record<string, number>> {
  const checkpoint =
    options.apply && !options.since
      ? await loadCheckpoint(pool, "track_slug_hygiene")
      : null;
  const rows = await listTrackAuditRows(
    pool,
    options,
    checkpoint,
  );
  const summary = {
    scanned: rows.length,
    clean: 0,
    autoRepairCandidates: 0,
    deferred: 0,
    humanRequired: 0,
    applied: 0,
    stale: 0,
  };

  for (const row of rows) {
    const findingKey = slugFindingKey(row.id);
    const findingState =
      options.apply
        ? await readFindingState(pool, findingKey)
        : { retryCount: 0, publicBreakage: false };
    const assessment = assessTrackSlug({
      trackId: row.id,
      title: row.title,
      currentSlug: row.slug,
      credits: toCredits(row),
      retryCount: findingState.retryCount,
      publicBreakage: findingState.publicBreakage,
    });

    if (assessment.disposition === "leave") {
      summary.clean += 1;
      if (options.apply) {
        await resolveFinding(
          pool,
          findingKey,
          "Current canonical slug no longer has a steward finding.",
        );
      }
      continue;
    }

    if (assessment.disposition === "human_required") {
      summary.humanRequired += 1;
      if (options.apply) {
        await rememberFinding(pool, {
          findingKey,
          entityType: "track",
          entityId: row.id,
          fieldName: "slug",
          rule: assessment.rule,
          disposition: "human_required",
          publicBreakage: findingState.publicBreakage,
          context: {
            currentSlug: row.slug,
            candidateSlug: assessment.candidateSlug,
            reasons: assessment.reasons,
          },
        });
      }
      continue;
    }

    if (assessment.disposition === "defer") {
      summary.deferred += 1;
      if (options.apply) {
        await rememberFinding(pool, {
          findingKey,
          entityType: "track",
          entityId: row.id,
          fieldName: "slug",
          rule: assessment.rule,
          disposition: "defer",
          publicBreakage: findingState.publicBreakage,
          context: {
            currentSlug: row.slug,
            candidateSlug: assessment.candidateSlug,
            reasons: assessment.reasons,
          },
        });
      }
      continue;
    }

    const collisionCount = await countRouteCollisions(
      pool,
      row.id,
      assessment.candidateSlug,
      assessment.primaryArtistSlugs,
    );

    const client = await pool.connect();
    let redirects: RedirectPath[] = [];
    try {
      redirects = await buildRedirectPaths(
        client,
        row.id,
        row.slug,
        assessment.candidateSlug,
        assessment.primaryArtistSlugs,
      );
    } finally {
      client.release();
    }

    const redirectConflict =
      await hasRedirectConflict(pool, redirects);

    const finalAssessment = assessTrackSlug({
      trackId: row.id,
      title: row.title,
      currentSlug: row.slug,
      credits: toCredits(row),
      routeCollisionCount: collisionCount,
      redirectConflict,
      retryCount: findingState.retryCount,
      publicBreakage: findingState.publicBreakage,
    });

    if (finalAssessment.disposition !== "auto_repair") {
      if (finalAssessment.disposition === "human_required") {
        summary.humanRequired += 1;
      } else {
        summary.deferred += 1;
      }

      if (options.apply) {
        await rememberFinding(pool, {
          findingKey,
          entityType: "track",
          entityId: row.id,
          fieldName: "slug",
          rule: finalAssessment.rule,
          disposition:
            finalAssessment.disposition === "human_required"
              ? "human_required"
              : "defer",
          publicBreakage: findingState.publicBreakage,
          context: {
            currentSlug: row.slug,
            candidateSlug: finalAssessment.candidateSlug,
            collisionCount,
            redirectConflict,
            reasons: finalAssessment.reasons,
          },
        });
      }
      continue;
    }

    summary.autoRepairCandidates += 1;

    if (!options.apply) continue;

    const result = await applyTrackSlugRepair(pool, row);
    if (result === "applied") {
      summary.applied += 1;
      await resolveFinding(
        pool,
        findingKey,
        "Deterministic slug repair applied with permanent redirect provenance.",
      );
    }
    if (result === "deferred") {
      summary.deferred += 1;
      await rememberFinding(pool, {
        findingKey,
        entityType: "track",
        entityId: row.id,
        fieldName: "slug",
        rule: finalAssessment.rule,
        disposition: "defer",
        publicBreakage: findingState.publicBreakage,
        context: {
          currentSlug: row.slug,
          candidateSlug: finalAssessment.candidateSlug,
          reasons: ["Mutation-time authority changed or became unsafe."],
        },
      });
    }
    if (result === "stale") summary.stale += 1;
  }

  if (options.apply && !options.since) {
    await saveCheckpoint(
      pool,
      "track_slug_hygiene",
      rows,
    );
  }

  return summary;
}

async function runRelationshipPass(
  pool: pg.Pool,
  options: Options,
): Promise<Record<string, number>> {
  const rows = await listOneTrackParityRows(
    pool,
    options.limit,
  );

  const summary = {
    scannedMissingLinks: rows.length,
    autoRepairCandidates: rows.length,
    applied: 0,
    deferred: 0,
    stale: 0,
  };

  if (!options.apply) return summary;

  for (const row of rows) {
    const result = await applyOneTrackParityRepair(pool, row);
    if (result === "applied") summary.applied += 1;
    if (result === "deferred") summary.deferred += 1;
    if (result === "stale") summary.stale += 1;
  }

  return summary;
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const pool = createPool();
  const lockClient = await pool.connect();

  console.log("\nMLINZI REGISTRY STEWARD");
  console.log("=".repeat(80));
  console.log(`Mode: ${options.apply ? "APPLY SAFE REPAIRS" : "AUDIT ONLY"}`);
  console.log(`Pass: ${options.mode}`);
  console.log(`Limit: ${options.limit}`);
  console.log(
    `Since: ${options.since || "all active records in the bounded batch"}`,
  );
  console.log(
    "Manual review is not created by this runner. Ambiguous findings are left unchanged and retried later.",
  );

  try {
    if (!(await acquireAgentLock(lockClient))) {
      throw new Error(
        "Another Mlinzi Registry Steward run already holds the agent lock.",
      );
    }

    if (
      options.mode === "all" ||
      options.mode === "slugs"
    ) {
      const slugSummary = await runSlugPass(pool, options);
      console.log("\nTrack slug pass");
      console.table([slugSummary]);
    }

    if (
      options.mode === "all" ||
      options.mode === "relationships"
    ) {
      const relationshipSummary =
        await runRelationshipPass(pool, options);
      console.log("\nOne-track Release Artist parity pass");
      console.table([relationshipSummary]);
    }

    console.log(
      options.apply
        ? "\nMlinzi completed bounded safe repairs with canonical write provenance."
        : "\nMlinzi audit complete. No canonical writes performed.",
    );
  } finally {
    try {
      await releaseAgentLock(lockClient);
    } catch {
      // The lock connection may already be closed after an earlier failure.
    } finally {
      lockClient.release();
    }
    await pool.end();
  }
}

main().catch((error) => {
  console.error(
    "Mlinzi Registry Steward failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
