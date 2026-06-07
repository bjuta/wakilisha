import pg from "pg";

const ARTICLE_MEDIA_BASE = (
  process.env.WAKILISHA_ARTICLE_MEDIA_BASE ||
  ARTICLE_MEDIA_BASE
).replace(/\/?$/, "/");


function normalizeLegacyWpMediaUrl(url: string): string {
  const clean = String(url || "").trim();
  if (!clean) return "";

  return clean
    .replace(/^http:\/\/18\.135\.76\.250\/wp-content\/uploads\//i, ARTICLE_MEDIA_BASE)
    .replace(/^https?:\/\/(?:www\.)?wakilisha\.africa\/wp-content\/uploads\//i, ARTICLE_MEDIA_BASE)
    .replace(/^https?:\/\/staging\.wakilisha\.africa\/wp-content\/uploads\//i, ARTICLE_MEDIA_BASE)
    .replace(/^\/wp-content\/uploads\//i, ARTICLE_MEDIA_BASE)
    .replace(/^\/__legacy-wp-media\//i, ARTICLE_MEDIA_BASE)
    .replace(/^\/legacy-wp-media\//i, ARTICLE_MEDIA_BASE)
    .replace(/^http:\/\/wakilisha\.africa/i, "https://wakilisha.africa")
    .replace(/^http:\/\/www\.wakilisha\.africa/i, "https://wakilisha.africa");
}

function normalizeLegacyWpMediaHtml(html: string): string {
  return String(html || "")
    .replace(/http:\/\/18\.135\.76\.250\/wp-content\/uploads\//gi, ARTICLE_MEDIA_BASE)
    .replace(/https?:\/\/(?:www\.)?wakilisha\.africa\/wp-content\/uploads\//gi, ARTICLE_MEDIA_BASE)
    .replace(/https?:\/\/staging\.wakilisha\.africa\/wp-content\/uploads\//gi, ARTICLE_MEDIA_BASE)
    .replace(/\/wp-content\/uploads\//gi, ARTICLE_MEDIA_BASE)
    .replace(/\/__legacy-wp-media\//gi, ARTICLE_MEDIA_BASE)
    .replace(/\/legacy-wp-media\//gi, ARTICLE_MEDIA_BASE);
}



type Row = Record<string, unknown>;

let pool: pg.Pool | null = null;

function normalizeDatabaseUrl(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("uselibpqcompat");
    return url.toString();
  } catch {
    return databaseUrl;
  }
}

function db(): pg.Pool {
  const explicitHost = process.env.PGHOST;
  const explicitUser = process.env.PGUSER;
  const explicitPassword = process.env.PGPASSWORD;
  const explicitDatabase = process.env.PGDATABASE;
  const explicitPort = Number(process.env.PGPORT || 5432);
  const url = process.env.DATABASE_URL;

  if (!pool) {
    if (explicitHost && explicitUser && explicitPassword && explicitDatabase) {
      pool = new pg.Pool({ host: explicitHost, port: explicitPort, user: explicitUser, password: explicitPassword, database: explicitDatabase, ssl: { rejectUnauthorized: false }, max: 4, connectionTimeoutMillis: 10000, query_timeout: 10000, statement_timeout: 10000 });
    } else {
      if (!url) throw new Error("DATABASE_URL or explicit PG* env vars are required for public detail endpoints.");
      pool = new pg.Pool({ connectionString: normalizeDatabaseUrl(url), ssl: { rejectUnauthorized: false }, max: 4, connectionTimeoutMillis: 10000, query_timeout: 10000, statement_timeout: 10000 });
    }
  }
  return pool;
}

async function q(query: string, values: unknown[] = []): Promise<Row[]> {
  const result = await db().query(query, values);
  return result.rows as Row[];
}

async function hasTable(tableName: string): Promise<boolean> {
  const rows = await q("select to_regclass($1) as table_name", [tableName]);
  return Boolean(rows[0]?.table_name);
}

function s(row: Row | undefined | null, key: string): string {
  const value = row?.[key];
  return value === null || value === undefined ? "" : String(value);
}

function maybe(row: Row | undefined | null, key: string): string | null {
  const value = s(row, key);
  return value || null;
}

function n(row: Row | undefined | null, key: string): number {
  const value = Number(row?.[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function parsePayload(value: unknown): Row {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Row;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Row : {};
    } catch {
      return {};
    }
  }
  return {};
}

function payload(value: unknown, key: string): Row {
  return parsePayload(parsePayload(value)[key]);
}

function payloadText(value: unknown, key: string): string {
  const parsed = parsePayload(value);
  const next = parsed[key];
  return next === null || next === undefined ? "" : String(next);
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#038;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8217;/g, "’")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”");
}

function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = decodeHtml(String(value)).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!text || ["null", "undefined", "false", "[object object]"].includes(text.toLowerCase())) return "";
  return normalizeLegacyWpMediaUrl(text);
}

function slugify(value: string): string {
  return cleanText(value).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}

function readingTime(...values: string[]): number {
  const text = values.join(" ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return Math.max(1, Math.min(18, Math.ceil((text ? text.split(" ").length : 480) / 220)));
}

function placeholder(type: string, id: string): string {
  return `https://picsum.photos/seed/wakilisha-${type}-${id || "item"}/800/800`;
}

function rowsToArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return [];
}

async function artistGenres(artistId: string): Promise<string[]> {
  if (!(await hasTable("registry_artist_genres"))) return [];
  const rows = await q(`
    select rg.name
    from registry_artist_genres rag
    join registry_genres rg on rg.id = rag.genre_id
    where rag.artist_id = $1::uuid and coalesce(rag.status, 'active') = 'active'
    order by rg.name asc
    limit 12
  `, [artistId]);
  return rows.map((row) => s(row, "name")).filter(Boolean);
}

async function artistReleases(artistSlug: string, artistName: string): Promise<Row[]> {
  if (!(await hasTable("registry_releases"))) return [];

  const needle = cleanText(artistName || artistSlug).toLowerCase();
  const rows = await q(`
    with release_rows as (
      select
        rr.id::text,
        rr.slug,
        rr.title,
        rr.release_type,
        rr.release_date::text,
        rr.artwork_url,
        rr.metadata,
        coalesce(
          nullif(rr.metadata->>'artist_name', ''),
          nullif(rr.metadata->>'artist_display', ''),
          nullif(rr.metadata->>'artists', ''),
          ''
        ) as release_artist_line,
        count(distinct rt.id)::int as track_count
      from registry_releases rr
      left join registry_tracks rt on rt.release_id = rr.id
      where rr.status in ('active', 'needs_review', 'draft')
      group by rr.id, rr.slug, rr.title, rr.release_type, rr.release_date, rr.artwork_url, rr.metadata
    )
    select *
    from release_rows
    where
      lower(release_artist_line) = $1
      or lower(release_artist_line) like $1 || ',%'
      or lower(release_artist_line) like '%, ' || $1 || ',%'
      or lower(release_artist_line) like '%, ' || $1
      or lower(release_artist_line) like $1 || ' &%'
      or lower(release_artist_line) like '%& ' || $1
      or lower(release_artist_line) like '% & ' || $1 || ' & %'
      or lower(release_artist_line) like $1 || ' feat.%'
      or lower(release_artist_line) like $1 || ' ft.%'
    order by release_date desc nulls last, title asc
    limit 24
  `, [needle]);

  return rows;
}

async function artistAppearances(artistSlug: string, artistName: string): Promise<Row[]> {
  if (!(await hasTable("registry_releases"))) return [];

  const nameNeedle = cleanText(artistName || artistSlug).toLowerCase();
  const slugNeedle = cleanText(artistSlug).toLowerCase();

  return q(`
    with release_rows as (
      select
        rr.id::text,
        rr.slug,
        rr.title,
        rr.release_type,
        rr.release_date::text,
        rr.artwork_url,
        rr.metadata,
        coalesce(
          nullif(rr.metadata->>'artist_name', ''),
          nullif(rr.metadata->>'artist_display', ''),
          nullif(rr.metadata->>'artists', ''),
          ''
        ) as release_artist_line,
        rr.metadata->>'source_payload' as source_payload_text
      from registry_releases rr
      where rr.status in ('active', 'needs_review', 'draft')
    ),
    candidates as (
      select *
      from release_rows
      where
        lower(coalesce(source_payload_text, metadata::text)) like '%' || $1 || '%'
        or lower(coalesce(source_payload_text, metadata::text)) like '%' || $2 || '%'
    )
    select *
    from candidates
    where not (
      lower(release_artist_line) = $1
      or lower(release_artist_line) like $1 || ',%'
      or lower(release_artist_line) like '%, ' || $1 || ',%'
      or lower(release_artist_line) like '%, ' || $1
      or lower(release_artist_line) like $1 || ' &%'
      or lower(release_artist_line) like '%& ' || $1
      or lower(release_artist_line) like '% & ' || $1 || ' & %'
    )
    order by release_date desc nulls last, title asc
    limit 24
  `, [nameNeedle, slugNeedle]);
}

async function artistRelated(artistSlug: string): Promise<Row[]> {
  if (!(await hasTable("registry_artist_relationships"))) return [];
  return q(`
    with related_slugs as (
      select
        case
          when rar.artist_a_slug = $1 then rar.artist_b_slug
          when rar.artist_b_slug = $1 then rar.artist_a_slug
          else null
        end as related_slug,
        coalesce(
          nullif(to_jsonb(rar)->>'score', '')::numeric,
          nullif(to_jsonb(rar)->>'relationship_score', '')::numeric,
          nullif(to_jsonb(rar)->>'confidence_score', '')::numeric,
          0
        ) as score,
        coalesce(nullif(to_jsonb(rar)->>'shared_track_count', '')::int, 0) as shared_track_count,
        coalesce(nullif(to_jsonb(rar)->>'shared_chart_track_count', '')::int, 0) as shared_chart_track_count,
        coalesce(nullif(to_jsonb(rar)->>'features_them_count', '')::int, 0) as features_them_count,
        coalesce(nullif(to_jsonb(rar)->>'they_feature_count', '')::int, 0) as they_feature_count,
        coalesce(to_jsonb(rar)->'shared_titles', '[]'::jsonb) as shared_titles
      from registry_artist_relationships rar
      where (rar.artist_a_slug = $1 or rar.artist_b_slug = $1)
        and coalesce(rar.relationship_status, 'active') = 'active'
    )
    select
      ra.slug,
      coalesce(ra.display_name, ra.normalized_name, ra.slug) as name,
      coalesce(to_jsonb(ra)->>'image_url', to_jsonb(ra)->>'public_image_url', '') as image_url,
      rs.score,
      rs.shared_track_count,
      rs.shared_chart_track_count,
      rs.features_them_count,
      rs.they_feature_count,
      rs.shared_titles
    from related_slugs rs
    join registry_artists ra on ra.slug = rs.related_slug
    where rs.related_slug is not null
    order by rs.score desc nulls last, name asc
    limit 12
  `, [artistSlug]);
}

async function artistChartEntries(artistSlug: string): Promise<Row[]> {
  if (!(await hasTable("wk_chart_entries_v2"))) return [];
  return q(`
    with ranked as (
      select
        coalesce(ce.rank, 0)::int as rank,
        coalesce(ce.track_title, 'Untitled Track') as title,
        coalesce(ce.artist_name, $1) as artist,
        coalesce(nullif(ce.track_slug, ''), lower(regexp_replace(coalesce(ce.track_title, 'untitled-track'), '[^a-zA-Z0-9]+', '-', 'g'))) as slug,
        coalesce(ce.movement, 'same') as movement,
        0::int as movement_amount,
        min(coalesce(ce.rank, 0)::int) over (
          partition by coalesce(nullif(ce.track_slug, ''), lower(regexp_replace(coalesce(ce.track_title, 'untitled-track'), '[^a-zA-Z0-9]+', '-', 'g')))
        ) as peak_position,
        count(*) over (
          partition by coalesce(nullif(ce.track_slug, ''), lower(regexp_replace(coalesce(ce.track_title, 'untitled-track'), '[^a-zA-Z0-9]+', '-', 'g')))
        )::int as weeks_on_chart,
        coalesce(ce.artwork_url, '') as artwork_url,
        row_number() over (
          partition by coalesce(nullif(ce.track_slug, ''), lower(regexp_replace(coalesce(ce.track_title, 'untitled-track'), '[^a-zA-Z0-9]+', '-', 'g')))
          order by coalesce(ce.rank, 999999)::int asc
        ) as rn
      from wk_chart_entries_v2 ce
      where ce.artist_slug = $1
    )
    select rank, title, artist, slug, movement, movement_amount, peak_position, weeks_on_chart, artwork_url
    from ranked
    where rn = 1
    order by rank asc nulls last, title asc
    limit 20
  `, [artistSlug]);
}

async function getArtistDetail(slug: string): Promise<Record<string, unknown>> {
  const rows = await q(`
    select
      id::text,
      slug,
      coalesce(display_name, normalized_name, slug) as display_name,
      normalized_name,
      coalesce(to_jsonb(registry_artists)->>'bio', '') as bio,
      coalesce(to_jsonb(registry_artists)->>'artist_type', '') as artist_type,
      coalesce(to_jsonb(registry_artists)->>'gender', '') as gender,
      coalesce(to_jsonb(registry_artists)->>'origin_iso2', '') as origin_iso2,
      coalesce(to_jsonb(registry_artists)->>'image_url', to_jsonb(registry_artists)->>'public_image_url', '') as public_image_url,
      coalesce(to_jsonb(registry_artists)->'metadata', '{}'::jsonb) as metadata,
      status
    from registry_artists
    where slug = $1 and status in ('active', 'needs_review', 'draft')
    limit 1
  `, [slug]);
  const row = rows[0];
  if (!row) return { artist: null };
  const metadata = parsePayload(row.metadata);
  const genres = await artistGenres(s(row, "id"));
  const chartRows = await artistChartEntries(s(row, "slug"));
  const releaseRows = await artistReleases(s(row, "slug"), s(row, "display_name"));
  const appearanceRows = await artistAppearances(s(row, "slug"), s(row, "display_name"));
  const relatedRows = await artistRelated(s(row, "slug"));
  const image = s(row, "public_image_url") || String(metadata.image_url ?? metadata.profile_image_url ?? "");

  return { artist: {
    id: s(row, "id"),
    slug: s(row, "slug"),
    name: s(row, "display_name"),
    country: s(row, "origin_iso2") || "",
    imageUrl: image,
    profileImageUrl: image,
    genres,
    trackCount: chartRows.length,
    releaseCount: releaseRows.length,
    isChartArtist: chartRows.length > 0,
    isRising: chartRows.some((entry) => n(entry, "rank") > 0 && n(entry, "rank") <= 20),
    topChartPosition: chartRows.length ? Math.min(...chartRows.map((entry) => n(entry, "rank")).filter(Boolean)) : null,
    bio: cleanText(s(row, "bio")) || `${s(row, "display_name")} is part of the WAKILISHA registry.`,
    fullBio: cleanText(s(row, "bio")) || `${s(row, "display_name")} is part of the WAKILISHA registry.`,
    artistType: maybe(row, "artist_type"),
    followerCount: Number(metadata.follower_count ?? metadata.followers ?? 0) || 0,
    popularity: Number(metadata.popularity ?? 0) || 0,
    spotifyUrl: String(metadata.spotify_url ?? metadata.spotify ?? ""),
    instagram: String(metadata.instagram ?? metadata.instagram_url ?? ""),
    chartEntries: chartRows.map((entry) => ({
      rank: n(entry, "rank"), title: s(entry, "title"), artist: s(entry, "artist"), slug: s(entry, "slug") || slugify(s(entry, "title")),
      movement: ["up", "down", "new", "same"].includes(s(entry, "movement")) ? s(entry, "movement") : "same",
      movementAmount: n(entry, "movement_amount"), peakPosition: n(entry, "peak_position"), weeksOnChart: n(entry, "weeks_on_chart"), artworkUrl: s(entry, "artwork_url") || "",
    })),
    releases: releaseRows.map((release) => ({
      slug: s(release, "slug"), title: s(release, "title"), releaseType: s(release, "release_type") || "unknown",
      year: s(release, "release_date").slice(0, 4), releaseDate: s(release, "release_date"), trackCount: n(release, "track_count"),
      artworkUrl: s(release, "artwork_url") || placeholder("release", s(release, "id")),
      artistLine: s(release, "release_artist_line"),
      tracks: [],
    })),
    appearances: appearanceRows.map((release) => ({
      slug: s(release, "slug"), title: s(release, "title"), releaseType: s(release, "release_type") || "unknown",
      year: s(release, "release_date").slice(0, 4), releaseDate: s(release, "release_date"),
      artworkUrl: s(release, "artwork_url") || placeholder("release", s(release, "id")),
      artistLine: s(release, "release_artist_line"),
      tracks: [],
    })),
    topSongs: chartRows.slice(0, 8).map((entry) => ({ title: s(entry, "title"), artists: s(row, "display_name"), image: s(entry, "artwork_url") || "", duration: "", songUrl: `/tracks/${s(row, "slug")}/${s(entry, "slug") || slugify(s(entry, "title"))}` })),
    relatedArtists: relatedRows.map((related) => ({
      slug: s(related, "slug"), name: s(related, "name"), imageUrl: s(related, "image_url"), score: n(related, "score"),
      sharedTracksAll: n(related, "shared_track_count"), sharedChartTracks: n(related, "shared_chart_track_count"),
      featuresThem: n(related, "features_them_count"), theyFeature: n(related, "they_feature_count"), sharedTitles: rowsToArray(related.shared_titles),
    })),
    videos: [],
  } };
}

async function getReleaseDetail(_artistSlug: string, releaseSlug: string): Promise<Record<string, unknown>> {
  const rows = await q(`
    select rr.id::text, rr.slug, rr.title, rr.release_type, rr.release_date::text, rr.artwork_url, rr.description, rr.metadata,
           coalesce(rl.name, rr.metadata->>'label_name', 'WAKILISHA Registry') as label_name,
           coalesce(rl.slug, '') as label_slug,
           coalesce(rr.metadata->>'artist_display', rr.metadata->>'artist_name', 'WAKILISHA Registry') as artist
    from registry_releases rr
    left join registry_labels rl on rl.id = rr.label_id
    where rr.slug = $1 and rr.status in ('active', 'needs_review', 'draft')
    limit 1
  `, [releaseSlug]);
  const row = rows[0];
  if (!row) return { release: null };
  const tracks = await q(`
    select id::text, slug, title, duration_ms, artwork_url
    from registry_tracks
    where release_id = $1::uuid and status in ('active', 'needs_review', 'draft')
    order by title asc
  `, [s(row, "id")]);
  const totalDuration = tracks.reduce((sum, track) => sum + n(track, "duration_ms"), 0);
  return { release: {
    id: s(row, "id"), slug: s(row, "slug"), title: s(row, "title"), artist: s(row, "artist"), year: s(row, "release_date").slice(0, 4), releaseDate: s(row, "release_date"),
    releaseType: s(row, "release_type") || "unknown", labelName: s(row, "label_name"), labelSlug: s(row, "label_slug"), artworkUrl: s(row, "artwork_url") || placeholder("release", s(row, "id")),
    trackCount: tracks.length, totalDuration, description: s(row, "description"), metadata: parsePayload(row.metadata),
    tracks: tracks.map((track, index) => ({ id: s(track, "id"), slug: s(track, "slug") || slugify(s(track, "title")), title: s(track, "title"), artist: s(row, "artist"), duration: n(track, "duration_ms"), trackNumber: index + 1, artworkUrl: s(track, "artwork_url") || s(row, "artwork_url") || "" })),
  } };
}

async function getLabelDetail(slug: string): Promise<Record<string, unknown>> {
  const rows = await q(`
    select id::text, slug, name, country_code, description, metadata
    from registry_labels
    where slug = $1 and status in ('active', 'needs_review', 'draft')
    limit 1
  `, [slug]);
  const row = rows[0];
  if (!row) return { label: null };
  const releases = await q("select id::text, slug, title, release_date::text, release_type, artwork_url from registry_releases where label_id = $1::uuid and status in ('active', 'needs_review', 'draft') order by release_date desc nulls last, title asc limit 60", [s(row, "id")]);
  const metadata = parsePayload(row.metadata);
  const wordpressMedia = payload(metadata, "wordpress_media");
  return { label: {
    id: s(row, "id"), slug: s(row, "slug"), name: s(row, "name"), country: maybe(row, "country_code"), logoUrl: String(metadata.logo_url ?? wordpressMedia.logo_url ?? "") || null,
    artistCount: 0, releaseCount: releases.length, featuredArtists: [], isFeatured: releases.length > 0, description: s(row, "description") || `${s(row, "name")} appears in the canonical WAKILISHA registry.`,
    releases: releases.map((release) => ({ id: s(release, "id"), slug: s(release, "slug"), title: s(release, "title"), year: s(release, "release_date").slice(0, 4), releaseType: s(release, "release_type"), artworkUrl: s(release, "artwork_url") || "" })),
  } };
}

async function getGenreDetail(slug: string): Promise<Record<string, unknown>> {
  const rows = await q("select id::text, slug, name, description from registry_genres where slug = $1 and status in ('active', 'draft', 'needs_review') limit 1", [slug]);
  const row = rows[0];
  if (!row) return { genre: null };
  const artists = await artistListForGenre(s(row, "id"));
  return { genre: { id: s(row, "id"), slug: s(row, "slug"), name: s(row, "name"), description: s(row, "description"), artistCount: artists.length, trackCount: 0, representativeArtists: artists.slice(0, 6).map((artist) => s(artist, "name")), artists } };
}

async function artistListForGenre(genreId: string): Promise<Row[]> {
  if (!(await hasTable("registry_artist_genres"))) return [];
  return q(`
    select ra.id::text, ra.slug, coalesce(ra.display_name, ra.normalized_name, ra.slug) as name, coalesce(to_jsonb(ra)->>'image_url', to_jsonb(ra)->>'public_image_url', '') as image_url
    from registry_artist_genres rag
    join registry_artists ra on ra.id = rag.artist_id
    where rag.genre_id = $1::uuid and coalesce(rag.status, 'active') = 'active'
    order by name asc
    limit 80
  `, [genreId]);
}

async function trackChartStats(trackSlug: string, artistSlug = "", trackTitle = ""): Promise<{
  currentRank: number;
  previousRank: number | null;
  peakRank: number;
  weeksOnChart: number;
  chartAppearanceCount?: number;
  movement: string;
  movementAmount: number;
  chartHistory: number[];
  chartAppearances: Row[];
}> {
  if (!(await hasTable("wk_chart_entries_v2"))) {
    return {
      currentRank: 0,
      previousRank: null,
      peakRank: 0,
      weeksOnChart: 0,
      movement: "same",
      movementAmount: 0,
      chartHistory: [],
      chartAppearances: [],
    };
  }

  const appearances = await q(`
    select
      ce.edition_id::text as edition_id,
      coalesce(ed.edition_slug, '') as edition_slug,
      coalesce(ed.edition_label, ed.edition_slug, '') as edition_label,
      coalesce(ed.edition_date::text, ed.period_start::text, '') as edition_date,
      coalesce(ce.rank, 0)::int as rank,
      nullif(ce.previous_rank, 0)::int as previous_rank,
      coalesce(ce.movement, '') as movement,
      coalesce(ce.track_slug, $1) as track_slug,
      coalesce(ce.track_title, $3, $1) as track_title,
      coalesce(ce.artist_slug, '') as artist_slug,
      coalesce(ce.artist_name, '') as artist_name,
      coalesce(ce.artwork_url, '') as artwork_url
    from wk_chart_entries_v2 ce
    left join wk_chart_editions_v2 ed
      on ed.id::text = ce.edition_id::text
    where (
      ce.track_slug = $1
      or lower(ce.track_title) = lower($3)
      or lower(regexp_replace(coalesce(ce.track_title, ''), '[^a-zA-Z0-9]+', '-', 'g')) = $1
    )
    order by
      case
        when $2 <> '' and ce.artist_slug = $2 then 0
        when $2 <> '' and ce.artist_slug like $2 || '-%' then 1
        when $2 <> '' and lower(ce.artist_name) like '%' || replace($2, '-', ' ') || '%' then 2
        else 3
      end,
      coalesce(ed.edition_date, ed.period_start, ed.period_end) desc nulls last,
      ed.edition_slug desc
    limit 120
  `, [trackSlug, artistSlug, trackTitle]);

  if (!appearances.length) {
    return {
      currentRank: 0,
      previousRank: null,
      peakRank: 0,
      weeksOnChart: 0,
      movement: "same",
      movementAmount: 0,
      chartHistory: [],
      chartAppearances: [],
    };
  }

  const latestDate = s(appearances[0], "edition_date");
  const latestAppearances = appearances.filter((row) => s(row, "edition_date") === latestDate);
  const latest = latestAppearances
    .slice()
    .sort((a, b) => n(a, "rank") - n(b, "rank"))[0] || appearances[0];

  const previous = appearances.find((row) => s(row, "edition_date") < latestDate) ?? null;

  const currentRank = n(latest, "rank");
  const previousRank = n(latest, "previous_rank") || (previous ? n(previous, "rank") : null);

  const ranks = appearances
    .map((row) => n(row, "rank"))
    .filter((rank) => rank > 0);

  const peakRank = ranks.length ? Math.min(...ranks) : 0;
  const weeksOnChart = new Set(
    appearances.map((row) => s(row, "edition_date")).filter(Boolean)
  ).size;
  const chartAppearanceCount = appearances.length;

  let movement = s(latest, "movement");
  let movementAmount = 0;

  if (!["up", "down", "new", "same", "re_entry"].includes(movement)) {
    if (!previousRank || previousRank <= 0) {
      movement = "new";
    } else if (currentRank > 0 && currentRank < previousRank) {
      movement = "up";
      movementAmount = previousRank - currentRank;
    } else if (currentRank > 0 && currentRank > previousRank) {
      movement = "down";
      movementAmount = currentRank - previousRank;
    } else {
      movement = "same";
    }
  } else if (previousRank && currentRank > 0) {
    movementAmount = Math.abs(previousRank - currentRank);
  }

  return {
    currentRank,
    previousRank,
    peakRank,
    weeksOnChart,
    chartAppearanceCount,
    movement,
    movementAmount,
    chartHistory: appearances
      .slice()
      .reverse()
      .map((row) => n(row, "rank"))
      .filter((rank) => rank > 0),
    chartAppearances: appearances,
  };
}

async function getTrackDetail(slug: string, artistSlug = ""): Promise<Record<string, unknown>> {
  const rows = await q(`
    select rt.id::text, rt.slug, rt.title, rt.normalized_title, rt.isrc, rt.duration_ms, rt.explicit, rt.artwork_url, rt.preview_url, rt.metadata,
           rr.slug as release_slug, rr.title as release_title, rr.artwork_url as release_artwork_url
    from registry_tracks rt
    left join registry_releases rr on rr.id = rt.release_id
    where rt.slug = $1 and rt.status in ('active', 'needs_review', 'draft')
    limit 1
  `, [slug]);

  const row = rows[0];
  if (row) {
    const stats = await trackChartStats(s(row, "slug"), artistSlug, s(row, "title"));
    return {
      track: {
        id: s(row, "id"),
        slug: s(row, "slug"),
        title: s(row, "title"),
        normalizedTitle: s(row, "normalized_title"),
        isrc: maybe(row, "isrc"),
        duration: n(row, "duration_ms"),
        explicit: row.explicit === true || String(row.explicit).toLowerCase() === "true",
        artworkUrl: s(row, "artwork_url") || s(row, "release_artwork_url") || placeholder("track", s(row, "id")),
        previewUrl: maybe(row, "preview_url"),
        metadata: parsePayload(row.metadata),
        release: s(row, "release_slug") ? { slug: s(row, "release_slug"), title: s(row, "release_title") } : null,
      },
      currentRank: stats.currentRank,
      previousRank: stats.previousRank,
      peakRank: stats.peakRank,
      weeksOnChart: stats.weeksOnChart,
      chartAppearanceCount: stats.chartAppearanceCount,
      movement: stats.movement,
      movementAmount: stats.movementAmount,
      chartHistory: stats.chartHistory,
      chartAppearances: stats.chartAppearances.map((entry) => ({
        editionSlug: s(entry, "edition_slug"),
        editionLabel: s(entry, "edition_label"),
        date: s(entry, "edition_date"),
        rank: n(entry, "rank"),
        previousRank: n(entry, "previous_rank") || null,
        movement: s(entry, "movement"),
      })),
    };
  }

  if (await hasTable("wk_chart_entries_v2")) {
    const chartRows = await q(`
      select
        coalesce(track_slug, $1) as slug,
        coalesce(track_title, $1) as title,
        coalesce(artist_name, '') as artist,
        coalesce(artist_slug, '') as artist_slug,
        coalesce(artwork_url, '') as artwork_url,
        min(rank)::int as top_chart_position,
        count(distinct edition_id)::int as chart_count
      from wk_chart_entries_v2
      where track_slug = $1
        and ($2 = '' or artist_slug = $2)
      group by track_slug, track_title, artist_name, artist_slug, artwork_url
      order by chart_count desc, top_chart_position asc nulls last
      limit 1
    `, [slug, artistSlug]);
    const chart = chartRows[0];
    if (chart) {
      const stats = await trackChartStats(s(chart, "slug"), artistSlug, s(chart, "title"));
      return {
        track: {
          id: s(chart, "slug"),
          slug: s(chart, "slug"),
          title: s(chart, "title"),
          normalizedTitle: s(chart, "title").toLowerCase(),
          isrc: null,
          duration: 0,
          explicit: false,
          artworkUrl: s(chart, "artwork_url") || placeholder("track", s(chart, "slug")),
          previewUrl: null,
          metadata: {
            source: "wk_chart_entries_v2",
            artist: s(chart, "artist"),
            artistSlug: s(chart, "artist_slug"),
            chartCount: stats.weeksOnChart,
            topChartPosition: stats.peakRank,
          },
          release: null,
        },
        currentRank: stats.currentRank,
        previousRank: stats.previousRank,
        peakRank: stats.peakRank,
        weeksOnChart: stats.weeksOnChart,
        movement: stats.movement,
        movementAmount: stats.movementAmount,
        chartHistory: stats.chartHistory,
        chartAppearances: stats.chartAppearances.map((entry) => ({
          editionSlug: s(entry, "edition_slug"),
          editionLabel: s(entry, "edition_label"),
          date: s(entry, "edition_date"),
          rank: n(entry, "rank"),
          previousRank: n(entry, "previous_rank") || null,
          movement: s(entry, "movement"),
        })),
      };
    }
  }

  return { track: null };
}


function looksLikeArticleImageUrl(url: string): boolean {
  return /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(url) || /\/wp-content\/uploads\//i.test(url);
}

function firstArticleUrl(...values: unknown[]): string {
  const stack = [...values];
  const seen = new Set<unknown>();

  while (stack.length) {
    const value = stack.shift();
    if (value === undefined || value === null || value === "" || seen.has(value)) continue;
    seen.add(value);

    if (Array.isArray(value)) {
      stack.unshift(...value);
      continue;
    }

    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      stack.unshift(
        obj.url,
        obj.source_url,
        obj.guid,
        obj.local_url,
        obj.image_url,
        obj.featured_image_url,
        obj.hero_image_url,
        obj.thumbnail_url,
        obj.cover_image_url,
        obj.media_url,
        obj.file_url,
        obj.attachment_url,
        obj.og_image,
        obj.twitter_image,
        obj.raw_record,
        obj.mapped_record,
        obj.metadata
      );
      continue;
    }

    const text = String(value).trim();
    if (!text) continue;

    if (text.startsWith("{") || text.startsWith("[")) {
      try {
        stack.unshift(JSON.parse(text));
        continue;
      } catch {}
    }

    const match = text.match(/https?:\/\/[^\s"'<>\\]+/);
    if (match) {
      return normalizeLegacyWpMediaUrl(match[0]);
    }
  }

  return "";
}


function articleField(row: Row, raw: Row, mapped: Row, keys: string[]): string {
  for (const key of keys) {
    const direct = cleanText(row[key]);
    if (direct) return direct;

    const rawValue = cleanText(raw[key]);
    if (rawValue) return rawValue;

    const mappedValue = cleanText(mapped[key]);
    if (mappedValue) return mappedValue;
  }
  return "";
}

async function articleHeroLookups(slug: string, row: Row, raw: Row, mapped: Row): Promise<string> {
  const direct = firstArticleUrl(
    row.hero_image_url,
    row.featured_image_url,
    row.image_url,
    row.thumbnail_url,
    row.cover_image_url,
    row.source_url,
    row.guid,
    raw.wordpress_media,
    raw.hero_image_url,
    raw.featured_image_url,
    raw.image_url,
    raw.thumbnail_url,
    raw.cover_image_url,
    raw.og_image,
    raw.twitter_image,
    mapped.hero_image_url,
    mapped.featured_image_url,
    mapped.image_url,
    mapped.thumbnail_url,
    mapped.cover_image_url
  );

  if (direct) return direct;

  if (!(await hasTable("public.wk_media_assets"))) return "";

  const rows = await q(`
    select *
    from public.wk_media_assets
    where coalesce(status, 'active') not in ('trash', 'deleted', 'rejected')
      and (
        entity_slug = $1
        or slug = $1
        or source_record_id = $2
        or source_record_id = $3
        or raw_record::text ilike '%' || $1 || '%'
        or mapped_record::text ilike '%' || $1 || '%'
        or metadata::text ilike '%' || $1 || '%'
      )
    limit 50
  `, [slug, s(row, "id"), String(raw.ID ?? raw.id ?? "")]);

  for (const media of rows) {
    const mediaRaw = parsePayload(media.raw_record);
    const mediaMapped = parsePayload(media.mapped_record);
    const mediaMeta = parsePayload(media.metadata);
    const url = firstArticleUrl(
      media.url,
      media.source_url,
      media.guid,
      media.local_url,
      media.image_url,
      media.featured_image_url,
      media.media_url,
      media.file_url,
      mediaRaw,
      mediaMapped,
      mediaMeta
    );
    if (url && looksLikeArticleImageUrl(url)) return url;
  }

  return "";
}


async function getArticleDetail(slug: string): Promise<Record<string, unknown>> {
  const requestedSlug = cleanText(slug).toLowerCase();

  function articleFromRow(row: Row): Record<string, unknown> {
    const raw = parsePayload(row.raw_record ?? row.raw_meta ?? row.metadata ?? row.source_payload ?? {});
    const mapped = parsePayload(row.mapped_record ?? row.editable_payload ?? row.immutable_payload ?? {});
    const wpMedia = payload(raw, "wordpress_media");

    const resolvedSlug =
      articleField(row, raw, mapped, ["slug", "post_name", "source_slug", "wp_slug"]) ||
      requestedSlug;

    const title =
      articleField(row, raw, mapped, ["title", "post_title", "name"]) ||
      resolvedSlug;

    const body = normalizeLegacyWpMediaHtml(
      articleField(row, raw, mapped, ["body", "content_html", "content", "post_content"]) ||
      String(raw.content_html ?? raw.post_content ?? mapped.content_html ?? mapped.body ?? "")
    );

    const excerpt =
      articleField(row, raw, mapped, ["excerpt", "excerpt_html", "dek", "post_excerpt"]) ||
      "";

    const heroUrl = normalizeLegacyWpMediaUrl(String(
      wpMedia.hero_image_url ??
      wpMedia.featured_image_url ??
      raw.hero_image_url ??
      raw.featured_image_url ??
      raw.image_url ??
      raw.thumbnail_url ??
      raw.cover_image_url ??
      mapped.hero_image_url ??
      mapped.featured_image_url ??
      mapped.image_url ??
      mapped.thumbnail_url ??
      row.hero_image_url ??
      row.featured_image_url ??
      row.image_url ??
      row.thumbnail_url ??
      row.cover_image_url ??
      ""
    ));

    return {
      article: {
        id: articleField(row, raw, mapped, ["id", "ID", "source_wp_post_id", "legacy_wp_post_id"]) || resolvedSlug,
        slug: resolvedSlug,
        title,
        section: articleField(row, raw, mapped, ["section", "category", "post_type"]) || "Article",
        dek: excerpt,
        author: articleField(row, raw, mapped, ["author_name", "author", "post_author"]) || "WAKILISHA Editorial",
        date: articleField(row, raw, mapped, ["published_at", "published_date", "post_date", "updated_at", "modified_at"]) || "Undated",
        readingTime: readingTime(excerpt, body),
        heroUrl,
        imageUrl: heroUrl,
        featuredImageUrl: heroUrl,
        contentHtml: body,
        tags: [],
        categories: [],
        seo: payloadText(raw, "wordpress_seo_fields") ? parsePayload(raw.wordpress_seo_fields) : {},
      },
    };
  }

  if (await hasTable("public.wk_articles")) {
    const rows = await q(`
      select *
      from public.wk_articles a
      where lower(coalesce(
        to_jsonb(a)->>'slug',
        to_jsonb(a)->>'post_name',
        to_jsonb(a)->>'source_slug',
        to_jsonb(a)->>'wp_slug',
        to_jsonb(a)->'raw_record'->>'slug',
        to_jsonb(a)->'raw_record'->>'post_name',
        to_jsonb(a)->'raw_meta'->>'slug',
        to_jsonb(a)->'raw_meta'->>'post_name',
        to_jsonb(a)->'mapped_record'->>'slug',
        to_jsonb(a)->'mapped_record'->>'post_name',
        ''
      )) = $1
      limit 1
    `, [requestedSlug]);

    if (rows[0]) return articleFromRow(rows[0]);
  }

  if (await hasTable("public.wk_content_items")) {
    const rows = await q(`
      select *
      from public.wk_content_items c
      where lower(coalesce(
        to_jsonb(c)->>'slug',
        to_jsonb(c)->>'post_name',
        to_jsonb(c)->>'source_slug',
        to_jsonb(c)->>'wp_slug',
        to_jsonb(c)->'raw_record'->>'slug',
        to_jsonb(c)->'raw_record'->>'post_name',
        to_jsonb(c)->'mapped_record'->>'slug',
        to_jsonb(c)->'mapped_record'->>'post_name',
        ''
      )) = $1
      limit 1
    `, [requestedSlug]);

    if (rows[0]) return articleFromRow(rows[0]);
  }

  return { article: null };
}

export async function repairedDetailResponse(resource: string, pathParts: string[]): Promise<Record<string, unknown>> {
  if (resource === "artists" && pathParts.length === 1) return getArtistDetail(pathParts[0]);
  if (resource === "releases" && pathParts.length >= 2) return getReleaseDetail(pathParts[0], pathParts[1]);
  if (resource === "labels" && pathParts.length === 1) return getLabelDetail(pathParts[0]);
  if (resource === "genres" && pathParts.length === 1) return getGenreDetail(pathParts[0]);
  if (resource === "tracks" && pathParts.length === 1) return getTrackDetail(pathParts[0]);
  if (resource === "tracks" && pathParts.length >= 2) return getTrackDetail(pathParts[pathParts.length - 1], pathParts[pathParts.length - 2]);
  if (resource === "magazine" && pathParts.length === 1) return getArticleDetail(pathParts[0]);
  throw Object.assign(new Error("Public entity detail resource not found."), { status: 404 });
}
