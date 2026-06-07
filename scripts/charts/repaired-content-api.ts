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
function isPlaceholderAsset(value: string): boolean {
  return /picsum\.photos|placeholder|placehold\.co|dummyimage/i.test(value);
}
function isMusicArtworkAsset(value: string): boolean {
  return /i\.scdn\.co|scdn\.co\/image|mzstatic\.com\/image\/thumb\/Music|is\d+-ssl\.mzstatic\.com\/image\/thumb\/Music|audio-ssl\.itunes\.apple\.com/i.test(value);
}
function looksLikeImageUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value) && !value.startsWith("/")) return false;
  if (isVideoOrAudioAsset(value) || isPlaceholderAsset(value) || isMusicArtworkAsset(value)) return false;
  if (/\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(value)) return true;
  return /(image\/thumb|\/image\/|cloudinary|images\.unsplash|cdn)/i.test(value) && !/\/wp-content\/uploads\/[^\s]+\.(mp4|m4v|mov|webm|mp3|m4a|wav)/i.test(value);
}
function cleanUrl(value: unknown): string {
  if (value === null || value === undefined) return "";
  const raw = decodeHtml(String(value));
  if (["", "null", "undefined", "false", "[object object]"].includes(raw.trim().toLowerCase())) return "";
  const candidateFromRaw = extractFirstUrl(raw);
  const normalizedFromRaw = normalizeArtworkUrl(candidateFromRaw);
  if (looksLikeImageUrl(normalizedFromRaw)) return normalizedFromRaw;
  const text = cleanDisplayText(value);
  if (!text) return "";
  const candidateFromCleanText = extractFirstUrl(text);
  const normalizedFromCleanText = normalizeArtworkUrl(candidateFromCleanText);
  if (!looksLikeImageUrl(normalizedFromCleanText)) return "";
  return normalizedFromCleanText;
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
function addSlugLookup(lookups: HeroLookups, key: unknown, url: string): void {
  const text = cleanDisplayText(key);
  if (!text || !url) return;
  addLookup(lookups.bySlug, text, url);
  const slug = slugify(text);
  if (slug !== "item") addLookup(lookups.bySlug, slug, url);
  const tail = text.split("/").filter(Boolean).pop();
  if (tail) addLookup(lookups.bySlug, tail, url);
}
function addTitleLookup(lookups: HeroLookups, key: unknown, url: string): void {
  const text = cleanDisplayText(key);
  if (!text || !url) return;
  addLookup(lookups.byTitle, text, url);
  addLookup(lookups.byTitle, text.toLowerCase(), url);
  const slug = slugify(text);
  if (slug !== "item") addLookup(lookups.byTitle, slug, url);
}
function emptyLookups(): HeroLookups {
  return { byId: new Map(), bySlug: new Map(), byTitle: new Map(), byAttachmentParent: new Map() };
}
function findLookupUrl(lookups: HeroLookups | undefined, key: unknown): string {
  const text = cleanDisplayText(key);
  if (!text) return "";
  const safeLookups = lookups ?? emptyLookups();
  return safeLookups.byId.get(text)
    || safeLookups.bySlug.get(text)
    || safeLookups.bySlug.get(slugify(text))
    || safeLookups.byTitle.get(text)
    || safeLookups.byTitle.get(text.toLowerCase())
    || safeLookups.byTitle.get(slugify(text))
    || safeLookups.byAttachmentParent.get(text)
    || "";
}
function rowTextValues(row: Row): string[] {
  const values = new Set<string>();
  for (const value of Object.values(row)) {
    if (value === null || value === undefined || typeof value === "object") continue;
    const text = cleanDisplayText(value);
    if (!text || text.length > 220 || looksLikeImageUrl(text)) continue;
    values.add(text);
    const slug = slugify(text);
    if (slug !== "item") values.add(slug);
    const tail = text.split("/").filter(Boolean).pop();
    if (tail) values.add(tail);
  }
  return [...values];
}
function hasAttachmentParent(row: Row, payload: Row): boolean {
  return Boolean(
    cleanDisplayText(row.attached_to_post_id)
    || cleanDisplayText(row.parent_id)
    || cleanDisplayText(row.post_parent)
    || cleanDisplayText(payload.attached_to_post_id)
    || cleanDisplayText(payload.parent_id)
    || cleanDisplayText(payload.post_parent)
  );
}
function isLikelyWordPressArticleMediaUrl(url: string): boolean {
  return looksLikeImageUrl(url) && /\/wp-content\/uploads\//i.test(url);
}
function mediaUrlFromRow(row: Row): string {
  return firstUrl(row.url, row.source_url, row.guid, row.local_url, row.image_url, row.featured_image_url, row.media_url, row.file_url, row.raw_meta);
}
function imageUrlFromWpItem(row: Row): string {
  return firstUrl(row.featured_image_url, row.source_url, row.guid, row.url, row.image_url, row.media_url, row.raw_meta);
}
async function buildHeroLookups(): Promise<HeroLookups> {
  const lookups: HeroLookups = emptyLookups();
  return lookups;
}
function directArticleHeroUrl(row: Row, editablePayload: Row, immutablePayload: Row, seoPayload: Row, rawMeta: Row, sourcePayload: Row): string {
  return firstUrl(
    row.featured_image_url, row.hero_image_url, row.image_url, row.thumbnail_url, row.cover_image_url, row.og_image, row.twitter_image,
    editablePayload.featured_image_url, editablePayload.hero_image_url, editablePayload.image_url, editablePayload.thumbnail_url, editablePayload.cover_image_url,
    immutablePayload.featured_image_url, immutablePayload.hero_image_url, immutablePayload.image_url, immutablePayload.thumbnail_url, immutablePayload.cover_image_url,
    seoPayload.og_image, seoPayload.twitter_image, seoPayload.featured_image_url, seoPayload.image_url,
    rawMeta.featured_image_url, rawMeta.hero_image_url, rawMeta.image_url, rawMeta.thumbnail_url, rawMeta.cover_image_url,
    sourcePayload.featured_image_url, sourcePayload.hero_image_url, sourcePayload.image_url, sourcePayload.thumbnail_url, sourcePayload.cover_image_url
  );
}
function resolveHeroUrl(row: Row, lookups?: HeroLookups): string {
  const editablePayload = parsePayload(row.editable_payload);
  const immutablePayload = parsePayload(row.immutable_payload);
  const seoPayload = parsePayload(row.seo_payload);
  const rawMeta = parsePayload(row.raw_meta);
  const sourcePayload = parsePayload(row.source_payload);
  const direct = directArticleHeroUrl(row, editablePayload, immutablePayload, seoPayload, rawMeta, sourcePayload);
  if (direct) return direct;
  const idCandidates = [
    row.featured_media, row.featured_media_id, row.thumbnail_id, row.post_thumbnail_id,
    editablePayload.featured_media, editablePayload.featured_media_id, immutablePayload.featured_media,
    seoPayload.featured_media, rawMeta.featured_media, rawMeta.featured_media_id, rawMeta.thumbnail_id,
    sourcePayload.featured_media, sourcePayload.featured_media_id, sourcePayload.thumbnail_id,
  ];
  for (const key of idCandidates) {
    const url = findLookupUrl(lookups, key);
    if (url) return url;
  }
  const articleIdCandidates = [row.source_wp_post_id, row.legacy_wp_post_id, row.id, rawMeta.ID, rawMeta.id, sourcePayload.ID, sourcePayload.id];
  for (const key of articleIdCandidates) {
    const url = findLookupUrl(lookups, key);
    if (url) return url;
  }
  const slugUrl = findLookupUrl(lookups, row.slug) || findLookupUrl(lookups, sourcePayload.slug) || findLookupUrl(lookups, sourcePayload.post_name);
  if (slugUrl) return slugUrl;
  const titleUrl = findLookupUrl(lookups, row.title) || findLookupUrl(lookups, sourcePayload.title) || findLookupUrl(lookups, sourcePayload.post_title);
  if (titleUrl) return titleUrl;
  return "";
}
function storyFromRawArticle(row: Row, index: number, heroLookups?: HeroLookups): PublicStory {
  const title = firstText(row.title, row.post_title, `Story ${index + 1}`);
  const slug = firstText(row.slug, row.post_name, slugify(title));
  const dek = firstText(row.excerpt_html, row.excerpt, row.dek, row.post_excerpt, "");
  const content = firstText(row.content_html, row.content, row.post_content);
  return {
    id: firstText(row.id, row.source_wp_post_id, slug),
    slug,
    title,
    section: firstText(row.category, row.section, "Article"),
    dek,
    author: firstText(row.author, row.author_name, "WAKILISHA Editorial"),
    date: firstText(row.published_at, row.published_date, row.post_date, row.modified_at, row.updated_at, "Undated"),
    readingTime: estimateReadingTime(dek, content),
    heroUrl: resolveHeroUrl(row, heroLookups),
  };
}
function storyFromRouteClassification(row: Row, index: number, heroLookups?: HeroLookups): PublicStory {
  const payload = parsePayload(row.source_payload);
  const title = firstText(row.title, payload.title, payload.post_title, `Story ${index + 1}`);
  const slug = firstText(row.slug, payload.slug, payload.post_name, slugify(title));
  const dek = firstText(row.dek, row.excerpt, payload.excerpt, payload.post_excerpt, "");
  const content = firstText(payload.post_content, payload.content);
  return {
    id: firstText(row.id, row.legacy_wp_post_id, payload.id, payload.ID, slug),
    slug,
    title,
    section: firstText(row.section, payload.category, payload.post_type, "Article"),
    dek,
    author: firstText(row.author, payload.author, payload.author_name, "WAKILISHA Editorial"),
    date: firstText(row.date, payload.post_date, payload.date, payload.modified, "Undated"),
    readingTime: estimateReadingTime(dek, content),
    heroUrl: resolveHeroUrl(row, heroLookups),
  };
}

export async function repairedResponse(resource: string, limit = 120): Promise<Record<string, unknown>> {
  if (resource === "magazine") {
    const heroLookups = await buildHeroLookups();

    if (await hasTable("public.wk_articles")) {
      const rows = await q(`
        select *
        from public.wk_articles
        where lower(coalesce(wp_status, 'publish')) in ('publish', 'published', 'active')
        order by published_at desc nulls last, updated_at desc nulls last, title asc nulls last
        limit $1
      `, [limit]);
      return { stories: rows.map((row, index) => storyFromRawArticle(row, index, heroLookups)).filter(isPublicMagazineStory) };
    }
    return { stories: [] };
  }

  if (resource === "artists") {
    const rows = await q(`
      with artist_base as (
        select
          ra.id,
          ra.id::text as id_text,
          ra.slug,
          coalesce(nullif(ra.display_name, ''), nullif(ra.normalized_name, ''), ra.slug) as name,
          coalesce(
            nullif(to_jsonb(ra)->>'country', ''),
            nullif(to_jsonb(ra)->>'origin_country', ''),
            nullif(to_jsonb(ra)->>'origin_iso2', ''),
            ''
          ) as country,
          coalesce(
            nullif(to_jsonb(ra)->>'image_url', ''),
            nullif(to_jsonb(ra)->>'public_image_url', ''),
            nullif(to_jsonb(ra)->>'profile_image_url', ''),
            ''
          ) as image_url
        from registry_artists ra
        where ra.status in ('active', 'needs_review')
      )
      select
        ab.id_text as id,
        ab.slug,
        ab.name,
        ab.country,
        ab.image_url,
        coalesce(count(distinct ce.track_slug), 0)::int as chart_track_count,
        coalesce(count(distinct ce.edition_id), 0)::int as chart_count,
        min(ce.rank)::int as top_chart_position
      from artist_base ab
      left join wk_chart_entries_v2 ce on ce.artist_slug = ab.slug
      group by ab.id_text, ab.slug, ab.name, ab.country, ab.image_url
      order by coalesce(count(distinct ce.edition_id), 0) desc, coalesce(count(distinct ce.track_slug), 0) desc, ab.name asc
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
    return { releases: rows.map((row) => ({
      id: s(row, "id"),
      slug: s(row, "slug") || slugify(s(row, "title")),
      title: s(row, "title"),
      artist: s(row, "artist"),
      year: s(row, "year"),
      releaseType: s(row, "release_type") || "unknown",
      labelName: s(row, "label_name"),
      artworkUrl: s(row, "artwork_url") || "",
      trackCount: n(row, "track_count"),
    })) };
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
    return { genres: rows.map((row) => ({
      id: s(row, "id"),
      slug: s(row, "slug") || slugify(s(row, "name")),
      name: s(row, "name"),
      artistCount: n(row, "artist_count"),
      trackCount: n(row, "track_count"),
      representativeArtists: Array.isArray(row.representative_artists) ? row.representative_artists.map(String).slice(0, 6) : [],
    })) };
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
    return { labels: rows.map((row) => ({
      id: s(row, "id"),
      slug: s(row, "slug") || slugify(s(row, "name")),
      name: s(row, "name"),
      country: s(row, "country") || null,
      logoUrl: s(row, "logo_url") || null,
      artistCount: 0,
      releaseCount: n(row, "release_count"),
      featuredArtists: [],
      isFeatured: n(row, "release_count") > 0,
      description: s(row, "description") || `${s(row, "name")} appears in the canonical WAKILISHA registry.`,
    })) };
  }

  throw Object.assign(new Error("Public entity resource not found."), { status: 404 });
}
