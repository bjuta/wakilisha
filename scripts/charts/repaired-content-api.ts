import pg from "pg";

type Row = Record<string, unknown>;
type PublicStory = {
  id: string;
  slug: string;
  title: string;
  section: string;
  dek: string;
  author: string;
  date: string;
  readingTime: number;
  heroUrl: string;
};

type HeroLookups = {
  byId: Map<string, string>;
  bySlug: Map<string, string>;
  byTitle: Map<string, string>;
  byAttachmentParent: Map<string, string>;
};

let pool: pg.Pool | null = null;

const SYSTEM_SLUGS = new Set([
  "about", "about-old", "account", "account-settings", "archive", "cart", "checkout", "claim-your-name",
  "contacts", "corrections", "faq", "faqs", "home", "journal", "labels", "lifestyle", "login",
  "magazine", "music", "my-account", "my-library", "my-top-10", "news-resources", "opinion",
  "order-tracking", "plan", "play", "privacy", "profile", "profile1", "settings", "settings-2",
  "short-stories", "sports", "the-registry", "venues",
]);

const SYSTEM_TITLES = new Set([
  "about", "account", "account settings", "accordions", "archive", "artists", "cart", "chart methodology",
  "checkout", "claim your name", "contacts", "corrections", "duka", "events", "faq", "faqs", "home",
  "journal", "labels", "lifestyle", "login", "magazine", "music", "my account", "my library",
  "my top 10", "news & resources", "opinion", "order tracking", "plan", "play", "privacy", "profile",
  "science and technology", "settings", "short stories", "sports", "the registry©", "venues",
]);

const SYSTEM_SLUG_PATTERNS = ["account", "checkout", "order-tracking", "privacy", "profile", "settings", "wp-"];

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

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#038;/g, "&")
    .replace(/&#38;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#034;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8217;/g, "’")
    .replace(/&#8216;/g, "‘")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—");
}

function cleanDisplayText(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = decodeHtml(String(value)).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (["null", "undefined", "false", "[object object]"].includes(text.toLowerCase())) return "";
  return text;
}

function normalizeArtworkUrl(url: string): string {
  return url.replace(/\{w\}x\{h\}/g, "1200x1200").replace(/\{w\}/g, "1200").replace(/\{h\}/g, "1200");
}

function extractFirstUrl(value: string): string {
  const match = value.match(/https?:\/\/[^\s"'<>,]+|\/[A-Za-z0-9_./%?=&:@+-]+/i);
  return match?.[0] ?? value;
}

function isVideoOrAudioAsset(value: string): boolean {
  return /\.(mp4|m4v|mov|webm|avi|mkv|mp3|m4a|wav|aac|ogg)(\?|#|$)/i.test(value) || /\b(video|audio)\//i.test(value);
}

function looksLikeImageUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value) && !value.startsWith("/")) return false;
  if (isVideoOrAudioAsset(value)) return false;
  if (/\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(value)) return true;
  return /(image\/thumb|\/image\/|cloudinary|mzstatic|images\.unsplash|cdn)/i.test(value) && !/\/wp-content\/uploads\/[^\s]+\.(mp4|m4v|mov|webm|mp3|m4a|wav)/i.test(value);
}

function cleanUrl(value: unknown): string {
  const text = cleanDisplayText(value);
  if (!text) return "";
  const candidate = extractFirstUrl(text);
  const normalized = normalizeArtworkUrl(candidate);
  if (!looksLikeImageUrl(normalized)) return "";
  return normalized;
}

function slugify(value: string): string {
  return cleanDisplayText(value).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}

function stripHtml(value: string): string {
  return cleanDisplayText(value);
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

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = cleanDisplayText(value);
    if (text) return text;
  }
  return "";
}

function findImageUrlDeep(value: unknown, depth = 0): string {
  if (depth > 5 || value === null || value === undefined) return "";
  const direct = cleanUrl(value);
  if (direct) return direct;

  if (typeof value === "string") {
    const parsed = parsePayload(value);
    if (Object.keys(parsed).length) return findImageUrlDeep(parsed, depth + 1);
    return "";
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findImageUrlDeep(item, depth + 1);
      if (found) return found;
    }
    return "";
  }

  if (typeof value === "object") {
    const row = value as Row;
    const preferredKeys = [
      "featured_image_url", "hero_image_url", "image_url", "thumbnail_url", "cover_image_url", "source_url",
      "url", "guid", "media_url", "file_url", "artwork_url", "og_image", "twitter_image",
    ];
    for (const key of preferredKeys) {
      const found = findImageUrlDeep(row[key], depth + 1);
      if (found) return found;
    }
    for (const item of Object.values(row)) {
      const found = findImageUrlDeep(item, depth + 1);
      if (found) return found;
    }
  }

  return "";
}

function firstUrl(...values: unknown[]): string {
  for (const value of values) {
    const text = findImageUrlDeep(value);
    if (text) return text;
  }
  return "";
}

function estimateReadingTime(...values: string[]): number {
  const text = stripHtml(values.join(" "));
  if (!text) return 3;
  return Math.max(1, Math.min(18, Math.ceil(text.split(" ").length / 220)));
}

function isSystemSlug(slug: string): boolean {
  const normalized = slugify(slug);
  return SYSTEM_SLUGS.has(normalized) || normalized.startsWith("my-") || SYSTEM_SLUG_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function isSystemTitle(title: string): boolean {
  return SYSTEM_TITLES.has(cleanDisplayText(title).toLowerCase());
}

function isPublicMagazineStory(story: PublicStory): boolean {
  if (!story.slug || !story.title) return false;
  if (isSystemSlug(story.slug) || isSystemTitle(story.title)) return false;
  return true;
}

async function q(query: string, values: unknown[] = []): Promise<Row[]> {
  const result = await db().query(query, values);
  return result.rows as Row[];
}

async function hasTable(tableName: string): Promise<boolean> {
  const rows = await q("select to_regclass($1) as table_name", [tableName]);
  return Boolean(rows[0]?.table_name);
}

function addLookup(map: Map<string, string>, key: unknown, url: string): void {
  const normalizedKey = cleanDisplayText(key);
  if (!normalizedKey || !url || map.has(normalizedKey)) return;
  map.set(normalizedKey, url);
}

function mediaUrlFromRow(row: Row): string {
  return firstUrl(row.url, row.source_url, row.guid, row.local_url, row.image_url, row.featured_image_url, row.media_url, row.file_url, row.raw_meta, row);
}

function imageUrlFromWpItem(row: Row): string {
  return firstUrl(row.featured_image_url, row.source_url, row.guid, row.url, row.image_url, row.media_url, row.raw_meta, row);
}

async function buildHeroLookups(): Promise<HeroLookups> {
  const lookups: HeroLookups = {
    byId: new Map(),
    bySlug: new Map(),
    byTitle: new Map(),
    byAttachmentParent: new Map(),
  };

  if (await hasTable("wakilisha_raw.wk_media_assets")) {
    const mediaRows = await q("select * from wakilisha_raw.wk_media_assets limit 5000");
    for (const row of mediaRows) {
      const url = mediaUrlFromRow(row);
      if (!url) continue;
      const payload = parsePayload(row.raw_meta);
      addLookup(lookups.byId, row.id, url);
      addLookup(lookups.byId, row.source_wp_post_id, url);
      addLookup(lookups.bySlug, row.slug, url);
      addLookup(lookups.bySlug, row.entity_slug, url);
      addLookup(lookups.byTitle, row.title, url);
      addLookup(lookups.byTitle, row.alt_text, url);
      addLookup(lookups.byAttachmentParent, row.attached_to_post_id, url);
      addLookup(lookups.byAttachmentParent, row.parent_id, url);
      addLookup(lookups.byAttachmentParent, row.post_parent, url);
      addLookup(lookups.byAttachmentParent, payload.attached_to_post_id, url);
      addLookup(lookups.byAttachmentParent, payload.parent_id, url);
      addLookup(lookups.byAttachmentParent, payload.post_parent, url);
    }
  }

  if (await hasTable("wakilisha_raw.wk_wordpress_items")) {
    const itemRows = await q("select * from wakilisha_raw.wk_wordpress_items limit 5000");
    for (const row of itemRows) {
      const url = imageUrlFromWpItem(row);
      if (!url) continue;
      const payload = parsePayload(row.raw_meta);
      addLookup(lookups.byId, row.id, url);
      addLookup(lookups.byId, row.source_wp_post_id, url);
      addLookup(lookups.byId, row.featured_media, url);
      addLookup(lookups.byId, row.featured_media_id, url);
      addLookup(lookups.byId, payload.featured_media, url);
      addLookup(lookups.byId, payload.featured_media_id, url);
      addLookup(lookups.bySlug, row.slug, url);
      addLookup(lookups.byTitle, row.title, url);
      addLookup(lookups.byAttachmentParent, row.parent_id, url);
      addLookup(lookups.byAttachmentParent, payload.parent_id, url);
      addLookup(lookups.byAttachmentParent, payload.post_parent, url);
    }
  }

  return lookups;
}

function resolveHeroUrl(row: Row, lookups?: HeroLookups): string {
  const editablePayload = parsePayload(row.editable_payload);
  const immutablePayload = parsePayload(row.immutable_payload);
  const seoPayload = parsePayload(row.seo_payload);
  const rawMeta = parsePayload(row.raw_meta);
  const direct = firstUrl(row, editablePayload, immutablePayload, seoPayload, rawMeta);
  if (direct) return direct;

  const idCandidates = [
    row.featured_media, row.featured_media_id, row.thumbnail_id, row.post_thumbnail_id,
    editablePayload.featured_media, editablePayload.featured_media_id, immutablePayload.featured_media,
    seoPayload.featured_media, rawMeta.featured_media, rawMeta.featured_media_id, rawMeta.thumbnail_id,
  ];
  for (const key of idCandidates) {
    const url = lookups?.byId.get(cleanDisplayText(key));
    if (url) return url;
  }

  const articleIdCandidates = [row.source_wp_post_id, row.id, rawMeta.ID, rawMeta.id];
  for (const key of articleIdCandidates) {
    const cleanKey = cleanDisplayText(key);
    const byId = lookups?.byId.get(cleanKey);
    if (byId) return byId;
    const byParent = lookups?.byAttachmentParent.get(cleanKey);
    if (byParent) return byParent;
  }

  const slugUrl = lookups?.bySlug.get(cleanDisplayText(row.slug));
  if (slugUrl) return slugUrl;

  const titleUrl = lookups?.byTitle.get(cleanDisplayText(row.title));
  if (titleUrl) return titleUrl;

  return "";
}

function storyFromRawArticle(row: Row, index: number, heroLookups?: HeroLookups): PublicStory {
  const title = firstText(row.title, `Story ${index + 1}`);
  const slug = firstText(row.slug, slugify(title));
  const editablePayload = parsePayload(row.editable_payload);
  const immutablePayload = parsePayload(row.immutable_payload);
  const seoPayload = parsePayload(row.seo_payload);
  const rawMeta = parsePayload(row.raw_meta);
  const dek = firstText(
    row.excerpt_html, row.excerpt, row.dek, editablePayload.excerpt, editablePayload.dek,
    immutablePayload.excerpt, seoPayload.description, seoPayload.excerpt, rawMeta.excerpt, ""
  );
  const content = firstText(row.content_html, row.content, editablePayload.content, immutablePayload.content, rawMeta.content);
  return {
    id: firstText(row.id, row.source_wp_post_id, slug),
    slug,
    title,
    section: firstText(row.category, row.section, editablePayload.category, rawMeta.category, "Article"),
    dek,
    author: firstText(row.author, row.author_name, editablePayload.author, rawMeta.author, "WAKILISHA Editorial"),
    date: firstText(row.published_at, row.published_date, row.modified_at, row.updated_at, rawMeta.date, "Undated"),
    readingTime: estimateReadingTime(dek, content),
    heroUrl: resolveHeroUrl(row, heroLookups) || `https://picsum.photos/seed/wakilisha-story-${slug}/1200/800`,
  };
}

function storyFromRouteClassification(row: Row, index: number): PublicStory {
  const payload = parsePayload(row.source_payload);
  const title = firstText(row.title, payload.title, payload.post_title, `Story ${index + 1}`);
  const slug = firstText(row.slug, payload.slug, payload.post_name, slugify(title));
  const dek = firstText(row.dek, row.excerpt, payload.excerpt, payload.post_excerpt, "");
  const content = firstText(payload.post_content, payload.content);
  const heroUrl = firstUrl(row.hero_url, payload.featured_image_url, payload.image, payload.hero_image_url);
  return {
    id: firstText(row.id, row.legacy_wp_post_id, payload.id, payload.ID, slug),
    slug,
    title,
    section: firstText(row.section, payload.category, payload.post_type, "Article"),
    dek,
    author: firstText(row.author, payload.author, payload.author_name, "WAKILISHA Editorial"),
    date: firstText(row.date, payload.post_date, payload.date, payload.modified, "Undated"),
    readingTime: estimateReadingTime(dek, content),
    heroUrl: heroUrl || `https://picsum.photos/seed/wakilisha-story-${slug}/1200/800`,
  };
}

export async function repairedResponse(resource: string, limit = 120): Promise<Record<string, unknown>> {
  if (resource === "magazine") {
    if (await hasTable("wakilisha_raw.wk_articles")) {
      const rows = await q(`
        select *
        from wakilisha_raw.wk_articles
        where nullif(title, '') is not null
          and nullif(slug, '') is not null
          and lower(coalesce(wp_status, 'publish')) in ('publish', 'published', 'active')
          and lower(coalesce(slug, '')) not in (
            'about', 'about-old', 'account', 'account-settings', 'archive', 'cart', 'checkout',
            'contacts', 'faq', 'faqs', 'home', 'journal', 'login', 'magazine', 'my-account',
            'order-tracking', 'privacy', 'profile', 'settings', 'settings-2'
          )
          and lower(coalesce(title, '')) not in (
            'about', 'account', 'account settings', 'accordions', 'archive', 'cart', 'checkout',
            'contacts', 'faq', 'faqs', 'home', 'journal', 'login', 'magazine', 'privacy', 'profile', 'settings'
          )
        order by title asc
        limit $1
      `, [limit]);
      const heroLookups = await buildHeroLookups();
      return { stories: rows.map((row, index) => storyFromRawArticle(row, index, heroLookups)).filter(isPublicMagazineStory) };
    }

    if (await hasTable("wakilisha_repaired.content_route_classification")) {
      const rows = await q(`
        select *
        from wakilisha_repaired.content_route_classification
        where classification = 'article'
          and coalesce(migration_action, '') in ('migrate_to_article', 'review_or_retire', '')
          and lower(coalesce(slug, '')) not in (
            'about', 'about-old', 'account', 'account-settings', 'archive', 'cart', 'checkout', 'claim-your-name',
            'contacts', 'corrections', 'faq', 'faqs', 'home', 'journal', 'labels', 'lifestyle',
            'login', 'magazine', 'music', 'my-account', 'my-library', 'my-top-10', 'news-resources',
            'opinion', 'order-tracking', 'plan', 'play', 'privacy', 'profile', 'profile1', 'settings',
            'settings-2', 'short-stories', 'sports', 'the-registry', 'venues'
          )
          and lower(coalesce(title, '')) not in (
            'about', 'account', 'account settings', 'accordions', 'archive', 'artists', 'cart', 'chart methodology',
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
            length(coalesce(nullif(source_payload->>'post_content',''), nullif(source_payload->>'content',''), '')) > 240
            or length(coalesce(nullif(source_payload->>'excerpt',''), nullif(source_payload->>'post_excerpt',''), '')) > 60
          )
        order by created_at desc nulls last, title asc nulls last
        limit $1
      `, [limit]);
      return { stories: rows.map(storyFromRouteClassification).filter(isPublicMagazineStory) };
    }

    return { stories: [] };
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
    return { artists: rows.map((row) => {
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
    }) };
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
