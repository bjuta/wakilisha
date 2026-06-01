import pg from "pg";

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
      pool = new pg.Pool({
        host: explicitHost,
        port: explicitPort,
        user: explicitUser,
        password: explicitPassword,
        database: explicitDatabase,
        ssl: { rejectUnauthorized: false },
        max: 4,
        connectionTimeoutMillis: 10000,
        query_timeout: 10000,
        statement_timeout: 10000,
      });
    } else {
      if (!url) throw new Error("DATABASE_URL or explicit PG* env vars are required for repaired content endpoints.");
      pool = new pg.Pool({
        connectionString: normalizeDatabaseUrl(url),
        ssl: { rejectUnauthorized: false },
        max: 4,
        connectionTimeoutMillis: 10000,
        query_timeout: 10000,
        statement_timeout: 10000,
      });
    }
  }

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
    const rows = await q(`
      with registry_articles as (
        select
          coalesce(source_wp_post_id::text, id::text) as id,
          slug,
          title,
          coalesce(nullif(raw_meta->>'category',''), nullif(raw_meta->>'section',''), 'Article') as section,
          coalesce(nullif(raw_meta->>'excerpt',''), nullif(raw_meta->>'post_excerpt',''), '') as dek,
          coalesce(nullif(raw_meta->>'author',''), nullif(raw_meta->>'post_author_name',''), 'WAKILISHA Editorial') as author,
          coalesce(nullif(raw_meta->>'post_date',''), nullif(raw_meta->>'date',''), nullif(raw_meta->>'published_at',''), 'Undated') as date,
          coalesce(nullif(hero_image_url,''), nullif(image_url,''), nullif(raw_meta->>'featured_image_url',''), nullif(raw_meta->>'image',''), '') as hero_url,
          coalesce(raw_meta->>'post_content', raw_meta->>'content', '') as body,
          1 as source_priority
        from public.wk_registry_entities
        where coalesce(wp_status, 'publish') = 'publish'
          and trim(coalesce(title, '')) <> ''
          and trim(coalesce(slug, '')) <> ''
          and (
            lower(coalesce(entity_type, '')) in ('article', 'guide', 'post', 'story', 'magazine')
            or lower(coalesce(raw_meta->>'post_type', '')) = 'post'
          )
      ),
      old_post_articles as (
        select
          coalesce(row_data->>'ID', source_pk, id::text) as id,
          coalesce(nullif(row_data->>'post_name',''), nullif(row_data->>'slug','')) as slug,
          coalesce(nullif(row_data->>'post_title',''), nullif(row_data->>'title','')) as title,
          coalesce(nullif(row_data->>'category',''), nullif(row_data->>'section',''), 'Article') as section,
          coalesce(nullif(row_data->>'post_excerpt',''), nullif(row_data->>'excerpt',''), '') as dek,
          coalesce(nullif(row_data->>'author',''), nullif(row_data->>'post_author_name',''), 'WAKILISHA Editorial') as author,
          coalesce(nullif(row_data->>'post_date',''), nullif(row_data->>'date',''), 'Undated') as date,
          '' as hero_url,
          coalesce(row_data->>'post_content', row_data->>'content', '') as body,
          2 as source_priority
        from public.wk_old_registry_rows
        where lower(coalesce(source_table, '')) like '%posts%'
          and lower(coalesce(row_data->>'post_status', row_data->>'status', 'publish')) in ('publish', 'published')
          and lower(coalesce(row_data->>'post_type', 'post')) = 'post'
      ),
      combined as (
        select * from registry_articles
        union all
        select * from old_post_articles
      ),
      filtered as (
        select
          *,
          regexp_replace(lower(trim(coalesce(slug, title, ''))), '[^a-z0-9]+', '-', 'g') as dedupe_key
        from combined
        where trim(coalesce(title, '')) <> ''
          and trim(coalesce(slug, '')) <> ''
          and lower(coalesce(slug, '')) not like '%account%'
          and lower(coalesce(slug, '')) not like '%checkout%'
          and lower(coalesce(slug, '')) not like '%order-tracking%'
          and lower(coalesce(slug, '')) not like '%privacy%'
          and lower(coalesce(slug, '')) not like '%profile%'
          and lower(coalesce(slug, '')) not like '%settings%'
          and lower(coalesce(slug, '')) not like 'my-%'
          and lower(coalesce(title, '')) not in (
            'about', 'account', 'account settings', 'cart', 'checkout', 'contacts', 'faq', 'faqs',
            'login', 'my account', 'my library', 'order tracking', 'privacy', 'profile', 'settings'
          )
          and (
            length(coalesce(body, '')) > 80
            or length(coalesce(dek, '')) > 20
            or coalesce(hero_url, '') <> ''
          )
      ),
      deduped as (
        select distinct on (dedupe_key)
          id,
          slug,
          title,
          section,
          dek,
          author,
          date,
          hero_url,
          source_priority
        from filtered
        order by dedupe_key, source_priority asc, date desc, title asc
      )
      select id, slug, title, section, dek, author, date, hero_url
      from deduped
      order by date desc nulls last, title asc
      limit $1
    `, [limit]);

    return {
      stories: rows.map((row, index) => ({
        id: s(row, "id") || s(row, "slug"),
        slug: s(row, "slug"),
        title: s(row, "title"),
        section: s(row, "section") || "Article",
        dek: s(row, "dek"),
        author: s(row, "author"),
        date: s(row, "date"),
        readingTime: Math.max(1, Math.min(9, Math.round((s(row, "dek").length || 300) / 240))),
        heroUrl: s(row, "hero_url") || `https://picsum.photos/seed/wakilisha-story-${index}/1200/800`,
      }))
    };
  }

  if (resource === "artists") {
    const rows = await q(`
      with canonical_artists as (
        select
          wa.id::text as id,
          wa.source_wp_post_id::text as source_wp_post_id,
          wa.slug,
          trim(wa.display_name) as name,
          nullif(trim(coalesce(wa.country, '')), '') as country,
          coalesce(nullif(wa.portrait_image_url, ''), nullif(wa.hero_image_url, '')) as image_url,
          regexp_replace(lower(trim(wa.display_name)), '[^a-z0-9]+', '', 'g') as name_key
        from public.wk_artists wa
        where trim(coalesce(wa.display_name, '')) <> ''
          and coalesce(wa.wp_status, 'publish') = 'publish'
      ),
      track_name_links as (
        select distinct
          regexp_replace(lower(trim(coalesce(artist_name_snapshot, ''))), '[^a-z0-9]+', '', 'g') as name_key,
          track_id
        from wakilisha_repaired.track_artists
        where trim(coalesce(artist_name_snapshot, '')) <> ''
          and lower(trim(artist_name_snapshot)) !~ '(,|&| feat\\.? | ft\\.? | featuring | x )'
      ),
      release_name_links as (
        select distinct
          regexp_replace(lower(trim(coalesce(artist_snapshot, ''))), '[^a-z0-9]+', '', 'g') as name_key,
          track_id,
          release_id
        from wakilisha_repaired.release_tracks
        where trim(coalesce(artist_snapshot, '')) <> ''
          and lower(trim(artist_snapshot)) !~ '(,|&| feat\\.? | ft\\.? | featuring | x )'
      ),
      chart_name_links as (
        select distinct
          regexp_replace(lower(trim(coalesce(ce.artist_name, ''))), '[^a-z0-9]+', '', 'g') as name_key,
          cet.track_id,
          cet.chart_entry_id,
          ce.rank
        from wakilisha_repaired.chart_entry_tracks cet
        inner join wk_chart_entries_v2 ce on ce.id::text = cet.chart_entry_id
        where trim(coalesce(ce.artist_name, '')) <> ''
          and lower(trim(ce.artist_name)) !~ '(,|&| feat\\.? | ft\\.? | featuring | x )'
      ),
      artist_tracks as (
        select ca.id, tnl.track_id
        from canonical_artists ca
        inner join track_name_links tnl on tnl.name_key = ca.name_key
        union
        select ca.id, rnl.track_id
        from canonical_artists ca
        inner join release_name_links rnl on rnl.name_key = ca.name_key
        union
        select ca.id, cnl.track_id
        from canonical_artists ca
        inner join chart_name_links cnl on cnl.name_key = ca.name_key
      ),
      artist_releases as (
        select ca.id, rnl.release_id
        from canonical_artists ca
        inner join release_name_links rnl on rnl.name_key = ca.name_key
      ),
      artist_charts as (
        select ca.id, cnl.chart_entry_id, cnl.rank
        from canonical_artists ca
        inner join chart_name_links cnl on cnl.name_key = ca.name_key
      ),
      artist_metrics as (
        select
          ca.id,
          count(distinct at.track_id)::int as track_count,
          count(distinct ar.release_id)::int as release_count,
          count(distinct ac.chart_entry_id)::int as chart_count,
          min(ac.rank)::int as top_chart_position
        from canonical_artists ca
        left join artist_tracks at on at.id = ca.id
        left join artist_releases ar on ar.id = ca.id
        left join artist_charts ac on ac.id = ca.id
        group by ca.id
      )
      select
        ca.id,
        ca.slug,
        ca.name,
        ca.country,
        ca.image_url,
        coalesce(am.track_count, 0) as track_count,
        coalesce(am.release_count, 0) as release_count,
        coalesce(am.chart_count, 0) as chart_count,
        am.top_chart_position,
        array[]::text[] as genres
      from canonical_artists ca
      left join artist_metrics am on am.id = ca.id
      order by coalesce(am.chart_count, 0) desc, coalesce(am.track_count, 0) desc, coalesce(am.release_count, 0) desc, ca.name asc
      limit $1
    `, [limit]);

    return {
      artists: rows.map((row) => {
        const name = s(row, "name");
        const topChartPosition = row.top_chart_position === null ? null : n(row, "top_chart_position");
        const chartCount = n(row, "chart_count");
        return {
          id: s(row, "id"),
          slug: s(row, "slug") || `${slugify(name)}-${s(row, "id")}`,
          name,
          country: s(row, "country") || null,
          imageUrl: s(row, "image_url") || null,
          genres: Array.isArray(row.genres) ? row.genres.map(String).slice(0, 4) : [],
          trackCount: n(row, "track_count"),
          releaseCount: n(row, "release_count"),
          isChartArtist: chartCount > 0 && topChartPosition !== null,
          isRising: chartCount > 0 && topChartPosition !== null && topChartPosition <= 20,
          topChartPosition,
        };
      })
    };
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
