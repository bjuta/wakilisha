import pg from 'pg';
import type { PoolClient } from 'pg';
import { sign as cryptoSign } from 'node:crypto';

const { Pool } = pg;

type JsonRecord = Record<string, unknown>;

type Args = {
  runId: string | null;
  program: string | null;
  edition: string | null;
  storefront: string;
  limit: number;
  write: boolean;
  force: boolean;
  minAutoAccept: number;
  includeNeedsReview: boolean;
};

type ChartEntryRow = {
  entry_id: string;
  edition_id: string | null;
  edition_slug: string;
  program_id: string;
  public_slug: string;
  source_family_slug: string | null;
  market_slug: string | null;
  rank: number;
  artist_slug: string | null;
  track_slug: string | null;
  track_title: string;
  artist_name: string;
  artwork_url: string | null;
  raw_payload: JsonRecord;
  track_id: string | null;
  registry_slug: string | null;
  registry_title: string | null;
  registry_metadata: JsonRecord;
  registry_duration_ms: number | null;
  registry_preview_url: string | null;
  registry_artwork_url: string | null;
};

type AppleSong = {
  id: string;
  type: 'songs';
  href?: string;
  attributes?: {
    name?: string;
    artistName?: string;
    albumName?: string;
    durationInMillis?: number;
    isrc?: string;
    url?: string;
    previews?: { url?: string }[];
    artwork?: { url?: string; width?: number; height?: number };
    releaseDate?: string;
    genreNames?: string[];
    contentRating?: string;
  };
  relationships?: {
    artists?: { data?: { id: string; type: string; attributes?: { name?: string } }[] };
    albums?: { data?: { id: string; type: string; attributes?: { name?: string } }[] };
  };
};

type MatchResult = {
  song: AppleSong;
  matchMethod: 'isrc' | 'exact_title_artist' | 'fuzzy_title_artist';
  confidence: number;
  status: 'matched' | 'needs_review';
  reason: string;
};

type EnrichmentResult = {
  entry: ChartEntryRow;
  isrc: string | null;
  match: MatchResult | null;
  skippedReason?: string;
};

type RuntimeSchemaInfo = {
  chartEntryRawPayloadColumn: string | null;
  hasTrackArtistCreditsTable: boolean;
  hasRegistryTrackArtistsTable: boolean;
};

function getArg(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function databaseUrlForNodePg(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);

    url.searchParams.delete("sslmode");
    url.searchParams.delete("sslcert");
    url.searchParams.delete("sslkey");
    url.searchParams.delete("sslrootcert");

    return url.toString();
  } catch {
    return databaseUrl;
  }
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return slug || `chart-track-${Date.now()}`;
}

function stableSlug(value: string | null | undefined, fallback: string): string {
  const raw = value?.trim() || fallback;
  return slugify(raw || fallback);
}

function firstArtistName(value: string | null | undefined): string {
  return (value || '')
    .split(/,|&|\bfeat\.?\b|\bft\.?\b|\bwith\b|\bx\b/gi)
    .map((part) => part.trim())
    .find(Boolean) || value?.trim() || 'Unknown Artist';
}

function entryArtistSlug(entry: ChartEntryRow): string {
  return stableSlug(entry.artist_slug, firstArtistName(entry.artist_name));
}

function entryTrackSlug(entry: ChartEntryRow): string {
  return stableSlug(entry.track_slug, entry.track_title || 'untitled');
}

type RegistryTrackShellRow = {
  id: string;
  slug: string;
  title: string;
  metadata: JsonRecord;
  duration_ms: number | null;
  preview_url: string | null;
  artwork_url: string | null;
};

function assignRegistryTrack(entry: ChartEntryRow, track: RegistryTrackShellRow, artistSlug?: string): void {
  entry.track_id = track.id;
  entry.track_slug = track.slug;
  if (artistSlug) entry.artist_slug = artistSlug;
  entry.registry_slug = track.slug;
  entry.registry_title = track.title;
  entry.registry_metadata = track.metadata ?? {};
  entry.registry_duration_ms = track.duration_ms;
  entry.registry_preview_url = track.preview_url;
  entry.registry_artwork_url = track.artwork_url;
}

async function findScopedRegistryTrack(
  client: PoolClient,
  input: {
    trackSlug: string;
    artistSlug: string;
    chartEntryId: string;
  },
): Promise<RegistryTrackShellRow | null> {
  const result = await client.query<RegistryTrackShellRow>(
    `
      select
        rt.id,
        rt.slug,
        rt.title,
        coalesce(rt.metadata, '{}'::jsonb) as metadata,
        rt.duration_ms,
        rt.preview_url,
        rt.artwork_url
      from public.registry_tracks rt
      left join public.registry_track_artists rta
        on rta.track_id = rt.id
      where rt.metadata->>'chart_entry_id' = $3
         or (
          rt.slug = $1
          and (
            rta.artist_slug = $2
            or rt.metadata->>'primary_artist_slug' = $2
          )
        )
      order by
        case
          when rt.metadata->>'chart_entry_id' = $3 then 1
          when rta.artist_slug = $2 then 2
          when rt.metadata->>'primary_artist_slug' = $2 then 3
          else 4
        end,
        rt.updated_at desc nulls last,
        rt.created_at desc
      limit 1
    `,
    [input.trackSlug, input.artistSlug, input.chartEntryId],
  );

  return result.rows[0] ?? null;
}

async function chooseRegistryTrackSlug(
  client: PoolClient,
  baseTrackSlug: string,
  artistSlug: string,
): Promise<string> {
  const existing = await client.query<{ id: string }>(
    `
      select rt.id
      from public.registry_tracks rt
      where rt.slug = $1
      limit 1
    `,
    [baseTrackSlug],
  );

  if (existing.rowCount === 0) return baseTrackSlug;

  const scoped = await client.query<{ id: string }>(
    `
      select rt.id
      from public.registry_tracks rt
      left join public.registry_track_artists rta
        on rta.track_id = rt.id
      where rt.slug = $1
        and (
          rta.artist_slug = $2
          or rt.metadata->>'primary_artist_slug' = $2
        )
      limit 1
    `,
    [baseTrackSlug, artistSlug],
  );

  if ((scoped.rowCount ?? 0) > 0) return baseTrackSlug;

  const seeded = `${baseTrackSlug}-${artistSlug}`;
  let candidate = seeded;
  let suffix = 2;

  while (true) {
    const check = await client.query<{ id: string }>(
      `select id from public.registry_tracks where slug = $1 limit 1`,
      [candidate],
    );

    if (check.rowCount === 0) return candidate;

    candidate = `${seeded}-${suffix}`;
    suffix += 1;
  }
}

function buildAppleMusicDeveloperToken(): string {
  const existingToken = process.env.APPLE_MUSIC_DEVELOPER_TOKEN?.trim();

  if (existingToken) {
    if (existingToken.includes('BEGIN PRIVATE KEY')) {
      throw new Error(
        'APPLE_MUSIC_DEVELOPER_TOKEN must be a developer-token JWT, not the raw .p8 private key. Unset APPLE_MUSIC_DEVELOPER_TOKEN and provide APPLE_MUSIC_TEAM_ID, APPLE_MUSIC_KEY_ID, and APPLE_MUSIC_PRIVATE_KEY instead.',
      );
    }

    return existingToken;
  }

  const teamId = process.env.APPLE_MUSIC_TEAM_ID?.trim();
  const keyId = process.env.APPLE_MUSIC_KEY_ID?.trim();
  const privateKey = process.env.APPLE_MUSIC_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();

  if (!teamId || !keyId || !privateKey) {
    throw new Error(
      'Apple Music auth is required. Provide APPLE_MUSIC_DEVELOPER_TOKEN as a JWT, or provide APPLE_MUSIC_TEAM_ID, APPLE_MUSIC_KEY_ID, and APPLE_MUSIC_PRIVATE_KEY.',
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const tokenDays = Math.min(Math.max(Number(process.env.APPLE_MUSIC_TOKEN_DAYS ?? 30), 1), 180);
  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + tokenDays * 24 * 60 * 60,
  };

  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signature = cryptoSign('sha256', Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  });

  return `${signingInput}.${signature.toString('base64url')}`;
}

async function ensureRegistryTrackShells(
  client: PoolClient,
  entries: ChartEntryRow[],
  schema: RuntimeSchemaInfo,
): Promise<ChartEntryRow[]> {
  const next = [...entries];

  for (const entry of next) {
    const artistSlug = entryArtistSlug(entry);
    const baseTrackSlug = entryTrackSlug(entry);

    if (entry.track_id) {
      entry.artist_slug = artistSlug;
      entry.track_slug = entry.track_slug ? stableSlug(entry.track_slug, baseTrackSlug) : baseTrackSlug;
      continue;
    }

    const title = entry.track_title?.trim();
    if (!title) continue;

    if (schema.hasRegistryTrackArtistsTable) {
      const scopedTrack = await findScopedRegistryTrack(client, {
        trackSlug: baseTrackSlug,
        artistSlug,
        chartEntryId: entry.entry_id,
      });

      if (scopedTrack) {
        assignRegistryTrack(entry, scopedTrack, artistSlug);

        if (entry.edition_id) {
          await client.query(
            `
              update public.wk_chart_entries_v2
              set
                artist_slug = $2,
                track_slug = $3
              where id = $1
                and (
                  artist_slug is distinct from $2
                  or track_slug is distinct from $3
                )
            `,
            [entry.entry_id, artistSlug, scopedTrack.slug],
          );
        }

        continue;
      }
    }

    const artistName = firstArtistName(entry.artist_name);
    const normalizedTitle = normalizeText(title);
    const safeTrackSlug = await chooseRegistryTrackSlug(client, baseTrackSlug, artistSlug);

    let artistId: string | null = null;

    if (schema.hasRegistryTrackArtistsTable) {
      const artistResult = await client.query<{ id: string }>(
        `
          insert into public.registry_artists (
            slug,
            display_name,
            normalized_name,
            sort_name,
            status,
            metadata
          )
          values (
            $1,
            $2,
            $3,
            $2,
            'needs_review',
            jsonb_build_object('source', 'chart_apple_music_enrichment')
          )
          on conflict (slug)
          do update set
            display_name = excluded.display_name,
            normalized_name = excluded.normalized_name,
            sort_name = excluded.sort_name,
            metadata = coalesce(public.registry_artists.metadata, '{}'::jsonb) || excluded.metadata,
            updated_at = now()
          returning id
        `,
        [artistSlug, artistName, normalizeText(artistName)],
      );

      artistId = artistResult.rows[0]?.id ?? null;
    }

    const result = await client.query<RegistryTrackShellRow>(
      `
        insert into public.registry_tracks (
          slug,
          title,
          normalized_title,
          artwork_url,
          status,
          metadata
        )
        values (
          $1,
          $2,
          $3,
          $4,
          'needs_review',
          jsonb_build_object(
            'source', 'chart_apple_music_enrichment',
            'chart_entry_id', $5::text,
            'chart_edition_slug', $6::text,
            'chart_program_slug', $7::text,
            'artist_name', $8::text,
            'primary_artist_slug', $9::text,
            'base_track_slug', $10::text
          )
        )
        on conflict (slug)
        do update set
          artwork_url = coalesce(public.registry_tracks.artwork_url, excluded.artwork_url),
          metadata = coalesce(public.registry_tracks.metadata, '{}'::jsonb) || excluded.metadata,
          updated_at = now()
        returning id, slug, title, metadata, duration_ms, preview_url, artwork_url
      `,
      [
        safeTrackSlug,
        title,
        normalizedTitle,
        entry.artwork_url,
        entry.entry_id,
        entry.edition_slug,
        entry.public_slug,
        entry.artist_name?.trim() || artistName,
        artistSlug,
        baseTrackSlug,
      ],
    );

    const track = result.rows[0];
    if (!track) continue;

    assignRegistryTrack(entry, track, artistSlug);

    if (schema.hasRegistryTrackArtistsTable && artistId) {
      await client.query(
        `
          insert into public.registry_track_artists (
            track_id,
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
            $1,
            $2,
            $3,
            $4,
            'primary_artist',
            true,
            false,
            1,
            $4,
            'chart_apple_music_enrichment',
            0.9500,
            'needs_review',
            jsonb_build_object('source', 'chart_apple_music_enrichment')
          where not exists (
            select 1
            from public.registry_track_artists
            where track_id = $1
              and artist_slug = $3
              and role = 'primary_artist'
          )
        `,
        [track.id, artistId, artistSlug, artistName],
      );
    }

    if (entry.edition_id) {
      await client.query(
        `
          update public.wk_chart_entries_v2
          set
            artist_slug = $2,
            track_slug = $3
          where id = $1
            and (
              artist_slug is distinct from $2
              or track_slug is distinct from $3
            )
        `,
        [entry.entry_id, artistSlug, track.slug],
      );
    }
  }

  return next;
}

async function getTableColumns(client: PoolClient, tableName: string): Promise<Set<string>> {
  const result = await client.query<{ column_name: string }>(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = $1
    `,
    [tableName],
  );

  return new Set(result.rows.map((row) => row.column_name));
}

async function tableExists(client: PoolClient, tableName: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `
      select exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = $1
      ) as exists
    `,
    [tableName],
  );

  return result.rows[0]?.exists === true;
}

async function detectRuntimeSchema(client: PoolClient): Promise<RuntimeSchemaInfo> {
  const entryColumns = await getTableColumns(client, 'wk_chart_entries_v2');

  const chartEntryRawPayloadColumn =
    entryColumns.has('raw_payload') ? 'raw_payload' :
    entryColumns.has('entry_payload') ? 'entry_payload' :
    entryColumns.has('payload') ? 'payload' :
    entryColumns.has('metadata') ? 'metadata' :
    null;

  return {
    chartEntryRawPayloadColumn,
    hasTrackArtistCreditsTable: await tableExists(client, 'registry_track_artist_credits'),
    hasRegistryTrackArtistsTable: await tableExists(client, 'registry_track_artists'),
  };
}

function parseArgs(): Args {
  return {
    runId: getArg('run-id'),
    program: getArg('program'),
    edition: getArg('edition'),
    storefront: (getArg('storefront') ?? 'ke').toLowerCase(),
    limit: Number(getArg('limit') ?? 100),
    write: hasFlag('write'),
    force: hasFlag('force'),
    minAutoAccept: Number(getArg('min-auto-accept') ?? 0.98),
    includeNeedsReview: !hasFlag('skip-needs-review'),
  };
}

function readNested(record: unknown, path: string[]): unknown {
  return path.reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return (acc as JsonRecord)[key];
  }, record);
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }

  return null;
}

function normalizeIsrc(value: unknown): string | null {
  const raw = firstString(value);
  if (!raw) return null;
  const normalized = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return normalized.length >= 8 ? normalized : null;
}

function extractIsrc(row: ChartEntryRow): string | null {
  const raw = row.raw_payload ?? {};
  const meta = row.registry_metadata ?? {};

  return normalizeIsrc(
    readNested(raw, ['isrc']),
    readNested(raw, ['external_ids', 'isrc']),
    readNested(raw, ['externalIds', 'isrc']),
    readNested(raw, ['track', 'external_ids', 'isrc']),
    readNested(raw, ['spotify', 'external_ids', 'isrc']),
    readNested(raw, ['source', 'external_ids', 'isrc']),
    readNested(raw, ['enriched', 'isrc']),
    readNested(meta, ['isrc']),
    readNested(meta, ['external_ids', 'isrc']),
    readNested(meta, ['spotify', 'isrc']),
    readNested(meta, ['providers', 'spotify', 'isrc']),
    readNested(meta, ['enriched', 'isrc']),
  );
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*(feat|ft|with)[^)]*\)/gi, '')
    .replace(/\[[^\]]*(feat|ft|with)[^\]]*\]/gi, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function artworkUrl(song: AppleSong, size = 600): string | null {
  const url = song.attributes?.artwork?.url;
  if (!url) return null;
  return url.replace('{w}', String(size)).replace('{h}', String(size));
}

function previewUrl(song: AppleSong): string | null {
  return song.attributes?.previews?.find((item) => item.url)?.url ?? null;
}

function releaseId(song: AppleSong): string | null {
  return song.relationships?.albums?.data?.[0]?.id ?? null;
}

function artistIds(song: AppleSong): string[] {
  return song.relationships?.artists?.data?.map((artist) => artist.id).filter(Boolean) ?? [];
}

function splitArtistNames(value: string): string[] {
  return value
    .split(/,|&|\bfeat\.?\b|\bft\.?\b|\bwith\b|\bx\b/gi)
    .map((part) => normalizeText(part))
    .filter(Boolean);
}

function scoreArtistMatch(entryArtistRaw: string, songArtistRaw: string): number {
  const entryArtist = normalizeText(entryArtistRaw);
  const songArtist = normalizeText(songArtistRaw);
  const entryArtists = splitArtistNames(entryArtistRaw);
  const songArtists = splitArtistNames(songArtistRaw);

  if (!entryArtist || !songArtist) return 0;
  if (entryArtist === songArtist) return 0.35;

  for (const entryPart of entryArtists) {
    for (const songPart of songArtists) {
      if (entryPart === songPart) return 0.35;
      if (entryPart.includes(songPart) || songPart.includes(entryPart)) return 0.30;
    }
  }

  if (entryArtist.includes(songArtist) || songArtist.includes(entryArtist)) return 0.24;

  return 0;
}

function strippedVersionTitle(title: string): string {
  const normalized = title.trim();
  const stripped = normalized
    .replace(/\s[-–—:]\s*(home\s+session|live\s+session|acoustic\s+session|session|home\s+version|live|acoustic)$/i, '')
    .replace(/\s+\((home\s+session|live\s+session|acoustic\s+session|session|home\s+version|live|acoustic)\)$/i, '')
    .replace(/\s+\[(home\s+session|live\s+session|acoustic\s+session|session|home\s+version|live|acoustic)\]$/i, '')
    .trim();

  return stripped && stripped !== normalized ? stripped : normalized;
}

function searchTermsForEntry(entry: ChartEntryRow): string[] {
  const terms = new Set<string>();
  const full = `${entry.track_title} ${entry.artist_name}`.trim();
  const strippedTitle = strippedVersionTitle(entry.track_title);
  const stripped = `${strippedTitle} ${entry.artist_name}`.trim();

  if (full) terms.add(full);
  if (stripped && stripped !== full) terms.add(stripped);

  return [...terms];
}

function scoreSearchMatch(entry: ChartEntryRow, song: AppleSong): number {
  const entryTitle = normalizeText(entry.track_title);
  const songTitle = normalizeText(song.attributes?.name ?? '');
  let score = 0;

  if (entryTitle && songTitle && entryTitle === songTitle) score += 0.58;
  else if (entryTitle && songTitle && (entryTitle.includes(songTitle) || songTitle.includes(entryTitle))) score += 0.42;

  score += scoreArtistMatch(entry.artist_name, song.attributes?.artistName ?? '');

  const registryDuration = entry.registry_duration_ms;
  const appleDuration = song.attributes?.durationInMillis;
  if (registryDuration && appleDuration) {
    const diff = Math.abs(registryDuration - appleDuration);
    if (diff <= 2500) score += 0.07;
    else if (diff <= 6000) score += 0.04;
  }

  if (song.attributes?.isrc && normalizeIsrc(song.attributes.isrc) === extractIsrc(entry)) {
    score = Math.max(score, 0.99);
  }

  return Math.min(Number(score.toFixed(4)), 1);
}

async function appleRequest<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`https://api.music.apple.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Apple Music API ${response.status} ${response.statusText}: ${text}`);
  }

  return await response.json() as T;
}

async function lookupSongsByIsrc(
  storefront: string,
  isrcs: string[],
  token: string,
): Promise<Map<string, AppleSong>> {
  const map = new Map<string, AppleSong>();
  const unique = [...new Set(isrcs.map(normalizeIsrc).filter(Boolean) as string[])];

  for (let i = 0; i < unique.length; i += 20) {
    const batch = unique.slice(i, i + 20);
    const params = new URLSearchParams();
    params.set('filter[isrc]', batch.join(','));

    const payload = await appleRequest<{ data?: AppleSong[] }>(
      `/v1/catalog/${storefront}/songs?${params.toString()}`,
      token,
    );

    for (const song of payload.data ?? []) {
      const songIsrc = normalizeIsrc(song.attributes?.isrc);
      if (songIsrc) map.set(songIsrc, song);
    }
  }

  return map;
}

async function searchAppleSong(
  entry: ChartEntryRow,
  args: Args,
  token: string,
): Promise<MatchResult | null> {
  const terms = searchTermsForEntry(entry);
  if (terms.length === 0) return null;

  const rankedAcrossTerms: Array<{ song: AppleSong; confidence: number; term: string }> = [];

  for (const term of terms) {
    const params = new URLSearchParams();
    params.set('term', term);
    params.set('types', 'songs');
    params.set('limit', '10');

    const payload = await appleRequest<{
      results?: { songs?: { data?: AppleSong[] } };
    }>(`/v1/catalog/${args.storefront}/search?${params.toString()}`, token);

    const songs = payload.results?.songs?.data ?? [];

    for (const song of songs) {
      rankedAcrossTerms.push({
        song,
        confidence: scoreSearchMatch(entry, song),
        term,
      });
    }
  }

  if (!rankedAcrossTerms.length) return null;

  const ranked = rankedAcrossTerms
    .sort((a, b) => b.confidence - a.confidence);

  const best = ranked[0];
  if (!best || best.confidence < 0.72) return null;

  const method = best.confidence >= 0.9 ? 'exact_title_artist' : 'fuzzy_title_artist';
  const confidence = Number(best.confidence.toFixed(4));

  return {
    song: best.song,
    matchMethod: method,
    confidence,
    status: confidence >= args.minAutoAccept ? 'matched' : 'needs_review',
    reason: `Apple search best match confidence ${confidence.toFixed(2)} via "${best.term}"`,
  };
}

async function loadChartEntries(client: PoolClient, args: Args, schema: RuntimeSchemaInfo): Promise<ChartEntryRow[]> {
  if (args.runId) {
    const result = await client.query<ChartEntryRow>(
      `
        with base as (
          select
            c.id as entry_id,
            null::uuid as edition_id,
            r.edition_date::text as edition_slug,
            r.program_id,
            coalesce(r.series_slug, r.program_id) as public_slug,
            null::text as source_family_slug,
            r.market_slug,
            row_number() over (
              order by
                coalesce(cs.final_score, 0) desc,
                c.normalized_key asc,
                c.id asc
            )::integer as rank,
            regexp_replace(
              regexp_replace(
                lower(coalesce(nullif(split_part(c.normalized_key, '::', 1), ''), c.title, 'untitled')),
                '[^a-z0-9]+',
                '-',
                'g'
              ),
              '(^-|-$)',
              '',
              'g'
            ) as scoped_track_slug,
            regexp_replace(
              regexp_replace(
                lower(coalesce(nullif(split_part(c.normalized_key, '::', 2), ''), split_part(c.artist_display, ',', 1), 'unknown-artist')),
                '[^a-z0-9]+',
                '-',
                'g'
              ),
              '(^-|-$)',
              '',
              'g'
            ) as scoped_artist_slug,
            c.title as track_title,
            c.artist_display as artist_name,
            c.artwork_url
          from public.chart_ingest_candidates c
          join public.chart_ingest_runs r on r.id = c.run_id
          left join public.chart_ingest_candidate_scores cs
            on cs.run_id::text = c.run_id::text
           and cs.candidate_id::text = c.id::text
          where c.run_id::text = $1
            and c.status = 'eligible'
          order by
            coalesce(cs.final_score, 0) desc,
            c.normalized_key asc,
            c.id asc
          limit $2
        )
        select
          b.entry_id,
          b.edition_id,
          b.edition_slug,
          b.program_id,
          b.public_slug,
          b.source_family_slug,
          b.market_slug,
          b.rank,
          b.scoped_artist_slug as artist_slug,
          b.scoped_track_slug as track_slug,
          b.track_title,
          b.artist_name,
          b.artwork_url,
          '{}'::jsonb as raw_payload,
          rt.id as track_id,
          rt.slug as registry_slug,
          rt.title as registry_title,
          coalesce(rt.metadata, '{}'::jsonb) as registry_metadata,
          rt.duration_ms as registry_duration_ms,
          rt.preview_url as registry_preview_url,
          rt.artwork_url as registry_artwork_url
        from base b
        left join lateral (
          select rt.*
          from public.registry_tracks rt
          left join public.registry_track_artists rta
            on rta.track_id = rt.id
          where rt.metadata->>'chart_entry_id' = b.entry_id::text
             or (
              rt.slug = b.scoped_track_slug
              and (
                rta.artist_slug = b.scoped_artist_slug
                or rt.metadata->>'primary_artist_slug' = b.scoped_artist_slug
              )
            )
          order by
            case
              when rt.metadata->>'chart_entry_id' = b.entry_id::text then 1
              when rta.artist_slug = b.scoped_artist_slug then 2
              when rt.metadata->>'primary_artist_slug' = b.scoped_artist_slug then 3
              else 4
            end,
            rt.updated_at desc nulls last,
            rt.created_at desc
          limit 1
        ) rt on true
        order by b.rank asc
      `,
      [args.runId, args.limit],
    );

    return result.rows.map((row) => ({
      ...row,
      raw_payload: row.raw_payload ?? {},
      registry_metadata: row.registry_metadata ?? {},
    }));
  }

  if (!args.edition) {
    throw new Error('Provide --edition=<edition-slug> or --run-id=<chart_ingest_run_id>.');
  }

  const rawPayloadSelect = schema.chartEntryRawPayloadColumn
    ? `coalesce(ce.${schema.chartEntryRawPayloadColumn}, '{}'::jsonb) as raw_payload`
    : `'{}'::jsonb as raw_payload`;

  const result = await client.query<ChartEntryRow>(
    `
      with base as (
        select
          ce.id as entry_id,
          ce.edition_id,
          e.edition_slug,
          p.id as program_id,
          p.public_slug,
          p.source_family_slug,
          p.market_slug,
          ce.rank,
          regexp_replace(
            regexp_replace(
              lower(coalesce(nullif(ce.artist_slug, ''), split_part(ce.artist_name, ',', 1), 'unknown-artist')),
              '[^a-z0-9]+',
              '-',
              'g'
            ),
            '(^-|-$)',
            '',
            'g'
          ) as scoped_artist_slug,
          regexp_replace(
            regexp_replace(
              lower(coalesce(nullif(ce.track_slug, ''), ce.track_title, 'untitled')),
              '[^a-z0-9]+',
              '-',
              'g'
            ),
            '(^-|-$)',
            '',
            'g'
          ) as scoped_track_slug,
          ce.track_title,
          ce.artist_name,
          ce.artwork_url,
          ${rawPayloadSelect}
        from public.wk_chart_entries_v2 ce
        join public.wk_chart_editions_v2 e on e.id = ce.edition_id
        join public.wk_chart_programs_v2 p on p.id = e.program_id
        where e.edition_slug = $1
          and (
            $2::text is null
            or p.public_slug = $2
            or p.source_family_slug = $2
            or p.id = $2
          )
        order by ce.rank asc
        limit $3
      )
      select
        b.entry_id,
        b.edition_id,
        b.edition_slug,
        b.program_id,
        b.public_slug,
        b.source_family_slug,
        b.market_slug,
        b.rank,
        b.scoped_artist_slug as artist_slug,
        b.scoped_track_slug as track_slug,
        b.track_title,
        b.artist_name,
        b.artwork_url,
        b.raw_payload,
        rt.id as track_id,
        rt.slug as registry_slug,
        rt.title as registry_title,
        coalesce(rt.metadata, '{}'::jsonb) as registry_metadata,
        rt.duration_ms as registry_duration_ms,
        rt.preview_url as registry_preview_url,
        rt.artwork_url as registry_artwork_url
      from base b
      left join lateral (
        select rt.*
        from public.registry_tracks rt
        left join public.registry_track_artists rta
          on rta.track_id = rt.id
        where rt.metadata->>'chart_entry_id' = b.entry_id::text
           or (
            rt.slug = b.scoped_track_slug
            and (
              rta.artist_slug = b.scoped_artist_slug
              or rt.metadata->>'primary_artist_slug' = b.scoped_artist_slug
            )
          )
        order by
          case
            when rt.metadata->>'chart_entry_id' = b.entry_id::text then 1
            when rta.artist_slug = b.scoped_artist_slug then 2
            when rt.metadata->>'primary_artist_slug' = b.scoped_artist_slug then 3
            else 4
          end,
          rt.updated_at desc nulls last,
          rt.created_at desc
        limit 1
      ) rt on true
      order by b.rank asc
    `,
    [args.edition, args.program, args.limit],
  );

  return result.rows.map((row) => ({
    ...row,
    raw_payload: row.raw_payload ?? {},
    registry_metadata: row.registry_metadata ?? {},
  }));
}

async function loadExistingAppleMatches(client: PoolClient, trackIds: string[]): Promise<Set<string>> {
  if (!trackIds.length) return new Set();

  const result = await client.query<{ track_id: string }>(
    `
      select distinct track_id
      from public.registry_track_provider_links
      where provider_key = 'apple_music'
        and match_status = 'matched'
        and track_id = any($1::uuid[])
    `,
    [trackIds],
  );

  return new Set(result.rows.map((row) => row.track_id));
}

async function enrichEntries(args: Args, entries: ChartEntryRow[], token: string): Promise<EnrichmentResult[]> {
  const results: EnrichmentResult[] = [];
  const byIsrc = new Map<string, ChartEntryRow[]>();

  for (const entry of entries) {
    if (!entry.track_id) {
      results.push({ entry, isrc: null, match: null, skippedReason: 'No registry track_id for chart entry' });
      continue;
    }

    const isrc = extractIsrc(entry);
    if (isrc) {
      const bucket = byIsrc.get(isrc) ?? [];
      bucket.push(entry);
      byIsrc.set(isrc, bucket);
    }
  }

  const isrcMatches = await lookupSongsByIsrc(args.storefront, [...byIsrc.keys()], token);

  for (const [isrc, bucket] of byIsrc.entries()) {
    const song = isrcMatches.get(isrc) ?? null;

    for (const entry of bucket) {
      if (song) {
        results.push({
          entry,
          isrc,
          match: {
            song,
            matchMethod: 'isrc',
            confidence: 0.99,
            status: 'matched',
            reason: 'Exact ISRC match',
          },
        });
      } else {
        results.push({ entry, isrc, match: null, skippedReason: 'No Apple Music ISRC match' });
      }
    }
  }

  const alreadyResolved = new Set(results.map((result) => result.entry.entry_id));
  const needsSearch = entries.filter((entry) => entry.track_id && !alreadyResolved.has(entry.entry_id));

  for (const entry of needsSearch) {
    const match = await searchAppleSong(entry, args, token);
    results.push({
      entry,
      isrc: extractIsrc(entry),
      match,
      skippedReason: match ? undefined : 'No safe Apple Music title/artist match',
    });
  }

  return results.sort((a, b) => a.entry.rank - b.entry.rank);
}

async function writeProviderMatch(
  client: PoolClient,
  args: Args,
  result: EnrichmentResult,
  schema: RuntimeSchemaInfo,
): Promise<void> {
  const { entry, match, isrc } = result;
  if (!entry.track_id || !match) return;
  if (match.status !== 'matched' && !args.includeNeedsReview) return;

  const song = match.song;
  const attrs = song.attributes ?? {};
  const providerPayload = {
    provider: 'apple_music',
    id: song.id,
    storefront: args.storefront,
    name: attrs.name ?? null,
    artistName: attrs.artistName ?? null,
    albumName: attrs.albumName ?? null,
    isrc: attrs.isrc ?? isrc,
    matchMethod: match.matchMethod,
    matchConfidence: match.confidence,
    matchStatus: match.status,
    enrichedAt: new Date().toISOString(),
  };

  await client.query(
    `
      insert into public.registry_track_provider_links (
        track_id,
        provider_key,
        provider_track_id,
        provider_release_id,
        provider_artist_ids,
        isrc,
        preview_url,
        artwork_url,
        duration_ms,
        storefront,
        match_method,
        match_confidence,
        match_status,
        raw_payload,
        last_checked_at,
        updated_at
      )
      values (
        $1,
        'apple_music',
        $2,
        $3,
        $4::text[],
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13::jsonb,
        now(),
        now()
      )
      on conflict (provider_key, provider_track_id)
      do update set
        track_id = excluded.track_id,
        provider_release_id = excluded.provider_release_id,
        provider_artist_ids = excluded.provider_artist_ids,
        isrc = excluded.isrc,
        preview_url = excluded.preview_url,
        artwork_url = excluded.artwork_url,
        duration_ms = excluded.duration_ms,
        storefront = excluded.storefront,
        match_method = excluded.match_method,
        match_confidence = excluded.match_confidence,
        match_status = excluded.match_status,
        raw_payload = excluded.raw_payload,
        last_checked_at = now(),
        updated_at = now()
    `,
    [
      entry.track_id,
      song.id,
      releaseId(song),
      artistIds(song),
      normalizeIsrc(attrs.isrc) ?? isrc,
      previewUrl(song),
      artworkUrl(song),
      attrs.durationInMillis ?? null,
      args.storefront,
      match.matchMethod,
      match.confidence,
      match.status,
      JSON.stringify({ song, providerPayload }),
    ],
  );

  if (match.status !== 'matched') return;

  await client.query(
    `
      update public.registry_tracks
      set metadata = jsonb_set(
        jsonb_set(
          jsonb_set(
            coalesce(metadata, '{}'::jsonb),
            '{providers,apple_music}',
            $2::jsonb,
            true
          ),
          '{apple_music_track_id}',
          to_jsonb($3::text),
          true
        ),
        '{apple_music_catalog_id}',
        to_jsonb($3::text),
        true
      )
      where id = $1
    `,
    [entry.track_id, JSON.stringify(providerPayload), song.id],
  );

  if (schema.chartEntryRawPayloadColumn && entry.edition_id) {
    await client.query(
      `
        update public.wk_chart_entries_v2
        set ${schema.chartEntryRawPayloadColumn} = jsonb_set(
          coalesce(${schema.chartEntryRawPayloadColumn}, '{}'::jsonb),
          '{playback}',
          $2::jsonb,
          true
        )
        where id = $1
      `,
      [
        entry.entry_id,
        JSON.stringify({
          provider: 'apple_music',
          appleMusicId: song.id,
          appleMusicCatalogId: song.id,
          previewUrl: previewUrl(song),
          artworkUrl: artworkUrl(song),
          durationMs: attrs.durationInMillis ?? null,
          storefront: args.storefront,
          matchMethod: match.matchMethod,
          matchConfidence: match.confidence,
          enrichedAt: new Date().toISOString(),
        }),
      ],
    );
  }
}

async function run(): Promise<void> {
  const args = parseArgs();
  const databaseUrl = process.env.DATABASE_URL;
  const token = buildAppleMusicDeveloperToken();

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  console.log('\nWAKILISHA Phase 9 Apple Music Chart Playback Enrichment');
  console.log('='.repeat(80));
  console.log(`Mode: ${args.write ? 'WRITE' : 'DRY RUN'}`);
  console.log(`Run ID: ${args.runId ?? 'none'}`);
  console.log(`Program: ${args.program ?? 'any'}`);
  console.log(`Edition: ${args.edition ?? 'none'}`);
  console.log(`Storefront: ${args.storefront}`);
  console.log(`Limit: ${args.limit}`);
  console.log(`Force existing matches: ${args.force}`);
  console.log(`Min auto accept: ${args.minAutoAccept}`);

  const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true";

  const pool = new Pool({
    connectionString: databaseUrlForNodePg(databaseUrl),
    ssl: {
      rejectUnauthorized,
    },
  });

  const client = await pool.connect();

  try {
    const schema = await detectRuntimeSchema(client);

    if (!schema.chartEntryRawPayloadColumn) {
      console.warn('wk_chart_entries_v2 has no JSON payload column. Provider links and registry metadata will still be written, but chart entry playback snapshots will be skipped.');
    }

    if (!schema.hasRegistryTrackArtistsTable) {
      console.warn('registry_track_artists does not exist. Scoped registry track shelling will fall back to track-only identity.');
    }

    let entries = await loadChartEntries(client, args, schema);

    if (args.write) {
      entries = await ensureRegistryTrackShells(client, entries, schema);
    }

    if (!entries.length) {
      throw new Error('No chart entries found for this program/edition.');
    }

    const trackIds = entries.map((entry) => entry.track_id).filter(Boolean) as string[];
    const existingMatches = args.force ? new Set<string>() : await loadExistingAppleMatches(client, trackIds);

    const candidates = entries.filter((entry) => !entry.track_id || !existingMatches.has(entry.track_id));
    const skippedExisting = entries.length - candidates.length;

    console.log('\nLoaded entries');
    console.log('-'.repeat(80));
    console.table([{
      entries: entries.length,
      candidates: candidates.length,
      skippedExisting,
      missingRegistryTrack: entries.filter((entry) => !entry.track_id).length,
    }]);

    const results = await enrichEntries(args, candidates, token);

    const matched = results.filter((result) => result.match?.status === 'matched');
    const needsReview = results.filter((result) => result.match?.status === 'needs_review');
    const missing = results.filter((result) => !result.match);
    const top10 = results.filter((result) => result.entry.rank <= 10);
    const top10Matched = top10.filter((result) => result.match?.status === 'matched');

    console.log('\nApple Music enrichment results');
    console.log('-'.repeat(80));
    console.table(results.slice(0, 30).map((result) => ({
      rank: result.entry.rank,
      track: result.entry.track_title,
      artist: result.entry.artist_name,
      isrc: result.isrc ?? '',
      apple: result.match?.song.id ?? '',
      method: result.match?.matchMethod ?? '',
      confidence: result.match?.confidence ?? '',
      status: result.match?.status ?? 'missing',
      reason: result.match?.reason ?? result.skippedReason ?? '',
    })));

    console.log('\nCoverage summary');
    console.log('-'.repeat(80));
    console.table([{
      totalCandidates: candidates.length,
      matched: matched.length,
      needsReview: needsReview.length,
      missing: missing.length,
      top10Matched: `${top10Matched.length}/${top10.length}`,
      writeMode: args.write,
    }]);

    if (args.write) {
      let written = 0;

      await client.query('begin');
      try {
        for (const result of results) {
          if (!result.match) continue;
          if (result.match.status === 'needs_review' && !args.includeNeedsReview) continue;

          await writeProviderMatch(client, args, result, schema);
          written += 1;
        }

        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      }

      console.log('\nWrite complete');
      console.log('-'.repeat(80));
      console.table([{ providerLinksWrittenOrUpdated: written }]);
    } else {
      console.log('\nDry run complete. Re-run with --write to persist provider links and playback snapshots.');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error('\nApple Music chart playback enrichment failed.');
  console.error(error);
  process.exitCode = 1;
});
