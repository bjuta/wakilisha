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
      if (!url) throw new Error("DATABASE_URL or explicit PG* env vars are required for public entity endpoints.");
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
      select
        legacy_wp_post_id as id,
        slug,
        title,
        coalesce(nullif(source_payload->>'category',''),'Article') as section,
        coalesce(nullif(source_payload->>'excerpt',''), nullif(source_payload->>'post_excerpt',''), '') as dek,
        coalesce(nullif(source_payload->>'author',''),'WAKILISHA Editorial') as author,
        coalesce(nullif(source_payload->>'post_date',''), nullif(source_payload->>'date',''), 'Undated') as date,
        coalesce(nullif(source_payload->>'featured_image_url',''), nullif(source_payload->>'image',''), '') as hero_url
      from wakilisha_repaired.content_route_classification
      where classification = 'article'
        and migration_action = 'migrate_to_article'
        and coalesce(needs_review,false) = false
        and slug is not null
        and title is not null
        and lower(coalesce(source_payload->>'post_type', source_payload->>'type', 'post')) not in (
          'page', 'product', 'attachment', 'nav_menu_item', 'revision'
        )
        and lower(coalesce(slug, '')) not in (
          'about', 'account', 'account-settings', 'archive', 'cart', 'checkout', 'claim-your-name',
          'contacts', 'corrections', 'faq', 'faqs', 'home', 'journal', 'labels', 'lifestyle',
          'login', 'magazine', 'music', 'my-account', 'my-library', 'my-top-10', 'news-resources',
          'opinion', 'order-tracking', 'plan', 'play', 'privacy', 'profile', 'profile1', 'settings',
          'short-stories', 'sports', 'the-registry', 'venues'
        )
        and lower(coalesce(title, '')) not in (
          'about', 'account', 'account settings', 'archive', 'artists', 'cart', 'chart methodology',
          'checkout', 'claim your name', 'contacts', 'corrections', 'duka', 'events', 'faq', 'faqs', 'home',
          'journal', 'labels', 'lifestyle', 'login', 'magazine', 'music', 'my account', 'my library',
          'my top 10', 'news & resources', 'opinion', 'order tracking', 'plan', 'play', 'privacy',
          'profile', 'science and technology', 'settings', 'short stories', 'sports', 'the registry©',
          'venues'
        )
        and lower(coalesce(slug, '')) not like '%account%'
        and lower(coalesce(slug, '')) not like '%checkout%'
        and lower(coalesce(slug, '')) not like '%order-tracking%'
        and lower(coalesce(slug, '')) not like '%privacy%'
        and lower(coalesce(slug, '')) not like '%profile%'
        and lower(coalesce(slug, '')) not like '%settings%'
        and lower(coalesce(slug, '')) not like 'my-%'
        and (
          length(coalesce(nullif(source_payload->>'post_content',''), nullif(source_payload->>'content',''), '')) > 280
          or length(coalesce(nullif(source_payload->>'excerpt',''), nullif(source_payload->>'post_excerpt',''), '')) > 80
        )
      order by nullif(source_payload->>'post_date','') desc nulls last, title asc
      limit $1
    `, [limit]);
    return { stories: rows.map((row, index) => ({ id: s(row, "id") || s(row, "slug"), slug: s(row, "slug"), title: s(row, "title"), section: s(row, "section") || "Article", dek: s(row, "dek"), author: s(row, "author"), date: s(row, "date"), readingTime: Math.max(1, Math.min(9, Math.round((s(row, "dek").length || 300) / 240))), heroUrl: s(row, "hero_url") || `https://picsum.photos/seed/wakilisha-story-${index}/1200/800` })) };
  }

  if (resource === "artists") {
    const rows = await q(`
      select
        ra.id::text as id,
        ra.slug,
        ra.display_name as name,
        ra.origin_iso2 as country,
        ra.public_image_url as image_url,
        coalesce(count(distinct ce.track_id), 0)::int as chart_track_count,
        coalesce(count(distinct ce.edition_id), 0)::int as chart_count,
        min(ce.rank)::int as top_chart_position
      from registry_artists ra
      left join chart_entries ce on ce.artist_slug = ra.slug
      where ra.status in ('active', 'needs_review')
      group by ra.id, ra.slug, ra.display_name, ra.origin_iso2, ra.public_image_url
      order by coalesce(count(distinct ce.edition_id), 0) desc, coalesce(count(distinct ce.track_id), 0) desc, ra.display_name asc
      limit $1
    `, [limit]);
    return {
      artists: rows.map((row) => {
        const topChartPosition = row.top_chart_position === null ? null : n(row, "top_chart_position");
        const chartCount = n(row, "chart_count");
        return {
          id: s(row, "id"),
          slug: s(row, "slug") || slugify(s(row, "name")),
          name: s(row, "name"),
          country: s(row, "country") || null,
          imageUrl: s(row, "image_url") || null,
          genres: [],
          trackCount: n(row, "chart_track_count"),
          releaseCount: 0,
          isChartArtist: chartCount > 0 && topChartPosition !== null,
          isRising: chartCount > 0 && topChartPosition !== null && topChartPosition <= 20,
          topChartPosition,
        };
      })
    };
  }

  if (resource === "releases") {
    const rows = await q(`
      select
        rr.id::text as id,
        rr.slug,
        rr.title,
        coalesce(rr.metadata->>'artist_display', rr.metadata->>'artist_name', 'WAKILISHA Registry') as artist,
        coalesce(extract(year from rr.release_date)::text, '') as year,
        coalesce(rr.release_type, 'unknown') as release_type,
        coalesce(rl.name, rr.metadata->>'label_name', 'WAKILISHA Registry') as label_name,
        rr.artwork_url,
        count(distinct rt.id)::int as track_count
      from registry_releases rr
      left join registry_labels rl on rl.id = rr.label_id
      left join registry_tracks rt on rt.release_id = rr.id
      where rr.status in ('active', 'needs_review')
      group by rr.id, rr.slug, rr.title, rr.metadata, rr.release_date, rr.release_type, rr.artwork_url, rl.name
      order by rr.release_date desc nulls last, rr.title asc
      limit $1
    `, [limit]);
    return { releases: rows.map((row) => ({ id: s(row, "id"), slug: s(row, "slug") || slugify(s(row, "title")), title: s(row, "title"), artist: s(row, "artist"), year: s(row, "year"), releaseType: s(row, "release_type") || "unknown", labelName: s(row, "label_name"), artworkUrl: s(row, "artwork_url") || `https://picsum.photos/seed/wakilisha-release-${s(row, "id")}/800/800`, trackCount: n(row, "track_count") })) };
  }

  if (resource === "genres") {
    const rows = await q(`
      select
        rg.id::text as id,
        rg.slug,
        rg.name,
        0::int as artist_count,
        0::int as track_count,
        array[]::text[] as representative_artists
      from registry_genres rg
      where rg.status in ('active', 'draft')
      order by rg.name asc
      limit $1
    `, [limit]);
    return { genres: rows.map((row) => ({ id: s(row, "id"), slug: s(row, "slug") || slugify(s(row, "name")), name: s(row, "name"), artistCount: n(row, "artist_count"), trackCount: n(row, "track_count"), representativeArtists: Array.isArray(row.representative_artists) ? row.representative_artists.map(String).slice(0, 6) : [] })) };
  }

  if (resource === "labels") {
    const rows = await q(`
      select
        rl.id::text as id,
        rl.slug,
        rl.name,
        rl.country_code as country,
        coalesce(rl.metadata->>'logo_url', '') as logo_url,
        rl.description,
        count(distinct rr.id)::int as release_count
      from registry_labels rl
      left join registry_releases rr on rr.label_id = rl.id
      where rl.status in ('active', 'needs_review')
      group by rl.id, rl.slug, rl.name, rl.country_code, rl.metadata, rl.description
      order by count(distinct rr.id) desc, rl.name asc
      limit $1
    `, [limit]);
    return { labels: rows.map((row) => ({ id: s(row, "id"), slug: s(row, "slug") || slugify(s(row, "name")), name: s(row, "name"), country: s(row, "country") || null, logoUrl: s(row, "logo_url") || null, artistCount: 0, releaseCount: n(row, "release_count"), featuredArtists: [], isFeatured: n(row, "release_count") > 0, description: s(row, "description") || `${s(row, "name")} appears in the canonical WAKILISHA registry.` })) };
  }

  throw Object.assign(new Error("Public entity resource not found."), { status: 404 });
}
