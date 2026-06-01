import pg from "pg";

type Row = Record<string, unknown>;
let pool: pg.Pool | null = null;

function db(): pg.Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for repaired content endpoints.");
  pool ??= new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 4 });
  return pool;
}

function s(row: Row, key: string): string {
  const value = row[key];
  return value === null || value === undefined ? "" : String(value);
}

function n(row: Row, key: string): number {
  const value = Number(row[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function slugify(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}

async function q(query: string, values: unknown[] = []): Promise<Row[]> {
  const result = await db().query(query, values);
  return result.rows as Row[];
}

export async function repairedResponse(resource: string, limit = 120): Promise<Record<string, unknown>> {
  if (resource === "magazine") {
    const rows = await q("select legacy_wp_post_id as id, slug, title, coalesce(nullif(source_payload->>'category',''),'Article') as section, coalesce(nullif(source_payload->>'excerpt',''), nullif(source_payload->>'post_excerpt',''), '') as dek, coalesce(nullif(source_payload->>'author',''),'WAKILISHA Editorial') as author, coalesce(nullif(source_payload->>'post_date',''), nullif(source_payload->>'date',''), 'Undated') as date, coalesce(nullif(source_payload->>'featured_image_url',''), nullif(source_payload->>'image',''), '') as hero_url from wakilisha_repaired.content_route_classification where classification='article' and migration_action='migrate_to_article' and coalesce(needs_review,false)=false and slug is not null and title is not null order by nullif(source_payload->>'post_date','') desc nulls last, title asc limit $1", [limit]);
    return { stories: rows.map((row, index) => ({ id: s(row, "id") || s(row, "slug"), slug: s(row, "slug"), title: s(row, "title"), section: s(row, "section") || "Article", dek: s(row, "dek"), author: s(row, "author"), date: s(row, "date"), readingTime: Math.max(1, Math.min(9, Math.round((s(row, "dek").length || 300) / 240))), heroUrl: s(row, "hero_url") || `https://picsum.photos/seed/wakilisha-story-${index}/1200/800` })) };
  }

  if (resource === "artists") {
    const rows = await q("select ta.artist_id as id, coalesce(nullif(max(ta.artist_name_snapshot),''),'Artist ' || ta.artist_id) as name, count(distinct ta.track_id)::int as track_count, count(distinct rt.release_id)::int as release_count, count(distinct cet.chart_entry_id)::int as chart_count, min(ce.rank)::int as top_chart_position, coalesce(array_remove(array_agg(distinct ag.genre_id), null), array[]::text[]) as genres from wakilisha_repaired.track_artists ta left join wakilisha_repaired.release_tracks rt on rt.track_id=ta.track_id left join wakilisha_repaired.chart_entry_tracks cet on cet.track_id=ta.track_id left join wk_chart_entries_v2 ce on ce.id::text=cet.chart_entry_id left join wakilisha_repaired.artist_genres ag on ag.artist_id=ta.artist_id group by ta.artist_id order by count(distinct cet.chart_entry_id) desc, count(distinct ta.track_id) desc limit $1", [limit]);
    return { artists: rows.map((row) => { const name = s(row, "name"); return { id: s(row, "id"), slug: `${slugify(name)}-${s(row, "id")}`, name, country: null, imageUrl: null, genres: Array.isArray(row.genres) ? row.genres.map(String).slice(0, 4) : [], trackCount: n(row, "track_count"), releaseCount: n(row, "release_count"), isChartArtist: n(row, "chart_count") > 0, isRising: n(row, "chart_count") > 0 && n(row, "top_chart_position") <= 20, topChartPosition: row.top_chart_position === null ? null : n(row, "top_chart_position") }; }) };
  }

  if (resource === "releases") {
    const rows = await q("select rt.release_id as id, coalesce(nullif(max(rt.title_snapshot),''),'Release ' || rt.release_id) as title, coalesce(nullif(max(rt.artist_snapshot),''),'WAKILISHA Registry') as artist, count(distinct rt.track_id)::int as track_count, coalesce(max(tps.artwork_url),'') as artwork_url from wakilisha_repaired.release_tracks rt left join wakilisha_repaired.track_playback_sources tps on tps.track_id=rt.track_id and tps.artwork_url is not null group by rt.release_id order by count(distinct rt.track_id) desc, rt.release_id asc limit $1", [limit]);
    return { releases: rows.map((row) => { const title = s(row, "title"); return { id: s(row, "id"), slug: `${slugify(title)}-${s(row, "id")}`, title, artist: s(row, "artist"), year: "", releaseType: n(row, "track_count") > 1 ? "Album" : "Single", labelName: "WAKILISHA Registry", artworkUrl: s(row, "artwork_url") || `https://picsum.photos/seed/wakilisha-release-${s(row, "id")}/800/800`, trackCount: n(row, "track_count") }; }) };
  }

  if (resource === "genres") {
    const rows = await q("select ag.genre_id as id, ag.genre_id as name, count(distinct ag.artist_id)::int as artist_count, count(distinct ta.track_id)::int as track_count, coalesce(array_remove(array_agg(distinct ta.artist_name_snapshot), null), array[]::text[]) as representative_artists from wakilisha_repaired.artist_genres ag left join wakilisha_repaired.track_artists ta on ta.artist_id=ag.artist_id group by ag.genre_id order by count(distinct ta.track_id) desc, ag.genre_id asc limit $1", [limit]);
    return { genres: rows.map((row) => ({ id: s(row, "id"), slug: `${slugify(s(row, "name"))}-${s(row, "id")}`, name: s(row, "name"), artistCount: n(row, "artist_count"), trackCount: n(row, "track_count"), representativeArtists: Array.isArray(row.representative_artists) ? row.representative_artists.map(String).slice(0, 6) : [] })) };
  }

  if (resource === "labels") {
    const rows = await q("select target_entity_id as id, coalesce(nullif(target_entity_id,''),'Unknown label') as name, count(distinct source_entity_id)::int as release_count from wakilisha_repaired.entity_relationships where relationship_type='release_source' group by target_entity_id order by count(distinct source_entity_id) desc, target_entity_id asc limit $1", [limit]);
    return { labels: rows.map((row) => { const name = s(row, "name"); return { id: s(row, "id"), slug: `${slugify(name)}-${s(row, "id")}`, name, country: null, logoUrl: null, artistCount: 0, releaseCount: n(row, "release_count"), featuredArtists: [], isFeatured: n(row, "release_count") > 1, description: `${name} appears in the repaired WAKILISHA relationship graph.` }; }) };
  }

  throw Object.assign(new Error("Repaired resource not found."), { status: 404 });
}
