import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ORIGINS = [
  "https://wakilisha.africa",
  "https://www.wakilisha.africa",
  "https://staging.wakilisha.africa",
  "http://localhost:5173",
  "http://localhost:3000",
];

type RangeInput = number | { start: string; end: string };

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const isAllowed =
    ALLOWED_ORIGINS.includes(origin) ||
    origin.endsWith(".wakilisha.africa");

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(data: unknown, headers: Record<string, string>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function ok(data: unknown, headers: Record<string, string>): Response {
  return json({ ok: true, data, meta: { servedAt: new Date().toISOString() } }, headers);
}

function fail(code: string, message: string, headers: Record<string, string>, status = 400): Response {
  return json({ ok: false, error: { code, message }, meta: { servedAt: new Date().toISOString() } }, headers, status);
}

function sinceFromRange(range: RangeInput = 30): string {
  if (typeof range === "number") {
    if (range <= 0) return new Date(0).toISOString();
    return new Date(Date.now() - range * 86400000).toISOString();
  }
  return new Date(`${range.start}T00:00:00`).toISOString();
}

function untilFromRange(range: RangeInput = 30): string {
  if (typeof range === "number") return new Date().toISOString();
  return new Date(`${range.end}T23:59:59.999`).toISOString();
}

function dayCount(range: RangeInput = 30): number {
  if (typeof range === "number") return range <= 0 ? 365 : range;
  const start = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

function todayStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function countBy<T extends Record<string, unknown>>(rows: T[], keyFn: (row: T) => string, limit = 20) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = keyFn(row) || "unknown";
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function domainFromReferrer(raw: unknown): string {
  const ref = readString(raw);
  if (!ref) return "";
  try {
    return new URL(ref).hostname.replace(/^www\./, "");
  } catch {
    return ref;
  }
}

function getAttribution(row: any) {
  const ctx = (row.context || {}) as Record<string, any>;
  const attr = (ctx.attribution || {}) as Record<string, any>;
  const current = (attr.current || {}) as Record<string, any>;
  const first = (attr.first_touch || {}) as Record<string, any>;

  return {
    source: readString(current.utm_source) || readString(first.utm_source),
    medium: readString(current.utm_medium) || readString(first.utm_medium),
    campaign: readString(current.utm_campaign) || readString(first.utm_campaign),
    content: readString(current.utm_content) || readString(first.utm_content),
    term: readString(current.utm_term) || readString(first.utm_term),
    referrerDomain:
      readString(current.referrer_domain) ||
      readString(first.referrer_domain) ||
      domainFromReferrer(row.referrer),
    landingUrl:
      readString(current.landing_url) ||
      readString(first.landing_url) ||
      readString(ctx.raw_page_url) ||
      readString(row.page_url),
  };
}

async function verifyUser(req: Request, db: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return null;

  return user;
}

async function requireAdminRead(userId: string, db: ReturnType<typeof createClient>): Promise<boolean> {
  const { data: roles, error } = await db
    .from("user_role_assignments")
    .select("role_key, role_definitions!inner(role_capabilities(capability_key))")
    .eq("user_id", userId)
    .eq("status", "active")
    .or("expires_at.is.null,expires_at.gt.now()");

  if (error || !roles) return false;
  if (roles.some((r: any) => r.role_key === "administrator")) return true;

  const caps = new Set<string>();
  for (const role of roles as any[]) {
    const roleCaps = role.role_definitions?.role_capabilities ?? [];
    for (const cap of roleCaps) caps.add(cap.capability_key);
  }

  return caps.has("view_analytics") || caps.has("view_community") || caps.has("manage_registry");
}

async function getAnalyticsEvents(db: ReturnType<typeof createClient>, range: RangeInput, limit = 10000) {
  const since = sinceFromRange(range);
  const until = untilFromRange(range);

  const { data, error } = await db
    .from("analytics_events")
    .select("id,event_name,page_url,page_type,entity_slug,entity_type,context,session_id,user_id,referrer,created_at")
    .gte("created_at", since)
    .lte("created_at", until)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

function buildTimeline(events: any[], range: RangeInput) {
  const pageViews = events.filter((e) => e.event_name === "page_view");
  if (pageViews.length === 0) return [];

  const pageTypes = [
    "home", "article", "artist_detail", "artist_listing", "release_detail",
    "genre_detail", "label_detail", "track_detail", "charts_edition", "charts_directory",
    "guide_detail", "guides_listing", "search", "magazine_issue", "category_detail",
    "tag_detail", "author_detail", "other",
  ];

  let startDate: Date;
  let endDate: Date;

  if (typeof range === "number") {
    startDate = range > 0 ? new Date(Date.now() - range * 86400000) : new Date(pageViews[0].created_at);
    endDate = new Date();
  } else {
    startDate = new Date(`${range.start}T00:00:00`);
    endDate = new Date(`${range.end}T00:00:00`);
  }

  const dateMap = new Map<string, Record<string, number | string>>();
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const date = d.toISOString().split("T")[0];
    const entry: Record<string, number | string> = { date };
    for (const pt of pageTypes) entry[pt] = 0;
    dateMap.set(date, entry);
  }

  for (const row of pageViews) {
    const date = row.created_at.split("T")[0];
    const entry = dateMap.get(date);
    if (!entry) continue;
    const pt = pageTypes.includes(row.page_type) ? row.page_type : "other";
    entry[pt] = Number(entry[pt] || 0) + 1;
  }

  return Array.from(dateMap.values());
}

function buildSnapshot(events: any[], range: RangeInput) {
  const pageViews = events.filter((e) => e.event_name === "page_view");
  const today = todayStart();
  const todayPageViews = pageViews.filter((e) => e.created_at >= today);
  const sessions = new Set(pageViews.map((e) => e.session_id).filter(Boolean));
  const todaySessions = new Set(todayPageViews.map((e) => e.session_id).filter(Boolean));
  const searchEvents = events.filter((e) => e.event_name === "search_query");
  const signups = events.filter((e) => e.event_name === "newsletter_signup" || e.event_name === "briefing_subscribe");
  const videos = events.filter((e) => e.event_name === "video_play" || e.event_name === "player_play");
  const scrolls = events.filter((e) => e.event_name === "scroll_depth");

  const topPageTypeRow = countBy(pageViews, (e) => e.page_type || "unknown", 1)[0];

  const topPages = countBy(pageViews, (e) => e.page_url || "unknown", 20).map((row) => {
    const sample = pageViews.find((e) => (e.page_url || "unknown") === row.label);
    return { page_url: row.label, page_type: sample?.page_type || "unknown", views: row.count };
  });

  const topEntities = countBy(
    pageViews.filter((e) => e.entity_slug && e.entity_type),
    (e) => `${e.entity_type}::${e.entity_slug}`,
    20,
  ).map((row) => {
    const [entity_type, entity_slug] = row.label.split("::");
    return { entity_type, entity_slug, views: row.count };
  });

  const eventDistribution = countBy(events, (e) => e.event_name || "unknown", 100)
    .map((row) => ({ event_name: row.label, count: row.count }));

  const pageTypeDistribution = countBy(pageViews, (e) => e.page_type || "unknown", 100)
    .map((row) => ({ page_type: row.label, count: row.count }));

  const searchMap = new Map<string, { count: number; zero_results: boolean }>();
  for (const row of searchEvents) {
    const ctx = row.context || {};
    const query = String(ctx.search_query || "").trim().toLowerCase();
    if (!query) continue;
    const existing = searchMap.get(query) || { count: 0, zero_results: false };
    existing.count += 1;
    existing.zero_results = existing.zero_results || ctx.results_count === 0;
    searchMap.set(query, existing);
  }

  const searchQueries = Array.from(searchMap.entries())
    .map(([query, value]) => ({ query, count: value.count, zero_results: value.zero_results }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const newsletterSourceMap = new Map<string, { page_type: string; source_section: string; count: number }>();
  for (const row of signups) {
    const source = row.context?.source_section || row.context?.source || "unknown";
    const key = `${row.page_type || "unknown"}::${source}`;
    const existing = newsletterSourceMap.get(key) || { page_type: row.page_type || "unknown", source_section: source, count: 0 };
    existing.count += 1;
    newsletterSourceMap.set(key, existing);
  }

  const scrollDepth = countBy(scrolls, (e) => String(e.context?.scroll_percent ?? e.context?.depth ?? "unknown"), 20)
    .map((row) => ({ scroll_percent: Number(row.label) || 0, count: row.count }))
    .sort((a, b) => a.scroll_percent - b.scroll_percent);

  const videoEngagement = countBy(videos, (e) => e.context?.platform || e.context?.provider || "unknown", 20)
    .map((row) => ({ platform: row.label, count: row.count }));

  const referrerBreakdown = countBy(pageViews, (e) => domainFromReferrer(e.referrer) || "direct", 20)
    .map((row) => ({ referrer: row.label, count: row.count }));

  const sourceBuckets = new Map<string, any>();
  const mediumBuckets = new Map<string, any>();
  const campaignBuckets = new Map<string, any>();
  const contentBuckets = new Map<string, any>();
  const referrerBuckets = new Map<string, any>();

  function addBucket(map: Map<string, any>, label: string, row: any) {
    const key = label || "unknown";
    const existing = map.get(key) || { label: key, events: 0, pageViews: 0, signups: 0, shareEvents: 0, sessions: new Set<string>() };
    existing.events += 1;
    if (row.event_name === "page_view") existing.pageViews += 1;
    if (row.event_name === "newsletter_signup" || row.event_name === "briefing_subscribe") existing.signups += 1;
    if (row.event_name === "share_click" || row.event_name === "share_copy") existing.shareEvents += 1;
    if (row.session_id) existing.sessions.add(row.session_id);
    map.set(key, existing);
  }

  for (const row of events) {
    const attr = getAttribution(row);
    addBucket(sourceBuckets, attr.source, row);
    addBucket(mediumBuckets, attr.medium, row);
    addBucket(campaignBuckets, attr.campaign, row);
    addBucket(contentBuckets, attr.content, row);
    addBucket(referrerBuckets, attr.referrerDomain || "direct", row);
  }

  function finalize(map: Map<string, any>, limit = 20) {
    return Array.from(map.values())
      .map((b) => ({
        label: b.label,
        events: b.events,
        pageViews: b.pageViews,
        signups: b.signups,
        shareEvents: b.shareEvents,
        sessions: b.sessions.size,
        percentage: events.length > 0 ? Math.round((b.events / events.length) * 100) : 0,
      }))
      .sort((a, b) => b.events - a.events)
      .slice(0, limit);
  }

  const landingPages = countBy(pageViews, (e) => getAttribution(e).landingUrl || e.page_url || "unknown", 20)
    .map((row) => {
      const sample = pageViews.find((e) => (getAttribution(e).landingUrl || e.page_url || "unknown") === row.label);
      const attr = sample ? getAttribution(sample) : { source: "", campaign: "" };
      const sessionSet = new Set(pageViews.filter((e) => (getAttribution(e).landingUrl || e.page_url || "unknown") === row.label).map((e) => e.session_id).filter(Boolean));
      return {
        page_url: row.label,
        source: attr.source || "unknown",
        campaign: attr.campaign || "unknown",
        pageViews: row.count,
        sessions: sessionSet.size,
      };
    });

  const funnel = [
    { step: "Page Views", count: pageViews.length },
    { step: "Search Queries", count: searchEvents.length },
    { step: "Share Events", count: events.filter((e) => e.event_name === "share_click" || e.event_name === "share_copy").length },
    { step: "Newsletter Signups", count: signups.length },
  ];

  return {
    today: {
      pageViews: todayPageViews.length,
      newsletterSignups: signups.filter((e) => e.created_at >= today).length,
      uniqueSessions: todaySessions.size,
    },
    kpis: {
      totalPageViews: pageViews.length,
      uniqueSessions: sessions.size,
      newsletterSignups: signups.length,
      searchQueries: searchEvents.length,
      avgDailyViews: Math.ceil(pageViews.length / Math.max(dayCount(range), 1)),
      topPageType: topPageTypeRow?.label || "—",
      totalVideoPlays: videos.length,
      totalScrollEvents: scrolls.length,
    },
    timeline: buildTimeline(events, range),
    topPages,
    topEntities,
    eventDistribution,
    pageTypeDistribution,
    searchQueries,
    newsletterSources: Array.from(newsletterSourceMap.values()).sort((a, b) => b.count - a.count),
    scrollDepth,
    videoEngagement,
    referrerBreakdown,
    attribution: {
      totalEvents: events.length,
      totalPageViews: pageViews.length,
      attributedEvents: events.filter((e) => {
        const a = getAttribution(e);
        return Boolean(a.source || a.medium || a.campaign || a.referrerDomain);
      }).length,
      attributedPageViews: pageViews.filter((e) => {
        const a = getAttribution(e);
        return Boolean(a.source || a.medium || a.campaign || a.referrerDomain);
      }).length,
      unattributedPageViews: pageViews.filter((e) => {
        const a = getAttribution(e);
        return !Boolean(a.source || a.medium || a.campaign || a.referrerDomain);
      }).length,
      attributedSessions: new Set(events.filter((e) => {
        const a = getAttribution(e);
        return Boolean(a.source || a.medium || a.campaign || a.referrerDomain);
      }).map((e) => e.session_id).filter(Boolean)).size,
      sources: finalize(sourceBuckets),
      mediums: finalize(mediumBuckets),
      campaigns: finalize(campaignBuckets),
      contents: finalize(contentBuckets),
      referrers: finalize(referrerBuckets),
      landingPages,
      shareOutbounds: [],
    },
    funnel,
    exportRows: events.slice(-5000),
  };
}


function pathFromUrl(raw: unknown): string {
  const value = readString(raw);
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.pathname || "/";
  } catch {
    return value.startsWith("/") ? value.split("?")[0] : value;
  }
}

function labelFromPath(raw: unknown): string {
  const path = pathFromUrl(raw);
  if (!path || path === "/") return "Home";
  const parts = path.split("/").filter(Boolean);
  const last = parts[parts.length - 1] || path;
  return last.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isSignalNoisePath(raw: unknown): boolean {
  const path = pathFromUrl(raw);
  if (!path) return true;

  const parts = path.split("/").filter(Boolean);
  const first = parts[0] || "";

  if (path === "/") return false;

  return (
    first === "admin" ||
    first === "auth" ||
    first === "preview" ||
    first === "settings" ||
    first === "profile" ||
    first === "api" ||
    first === "player" ||
    first === "briefing" ||
    first === "u" ||
    first === "privacy" ||
    first === "terms" ||
    first === "contact" ||
    first === "faqs" ||
    first === "about" ||
    path.includes("/settings") ||
    path.includes("/preview/")
  );
}

function isCommercialEntityType(raw: unknown): boolean {
  const value = readString(raw);
  return [
    "artist",
    "track",
    "release",
    "article",
    "guide",
    "chart",
    "genre",
    "label",
    "category",
    "tag",
    "author",
    "magazine_issue",
  ].includes(value);
}

function isCommercialContentPath(raw: unknown): boolean {
  const path = pathFromUrl(raw);
  if (!path || isSignalNoisePath(path)) return false;

  const parts = path.split("/").filter(Boolean);
  const first = parts[0] || "";

  return (
    first === "artists" ||
    first === "tracks" ||
    first === "releases" ||
    first === "charts" ||
    first === "magazine" ||
    first === "guides" ||
    first === "genres" ||
    first === "labels" ||
    first === "categories" ||
    first === "tags" ||
    first === "authors" ||
    parts.length === 1
  );
}

function inferEntity(row: any): { entityType: string; entitySlug: string; pagePath: string } | null {
  const explicitType = readString(row.entity_type);
  const explicitSlug = readString(row.entity_slug);
  const pagePath = pathFromUrl(row.page_url);

  if (explicitType && explicitSlug && isCommercialEntityType(explicitType)) {
    return { entityType: explicitType, entitySlug: explicitSlug, pagePath };
  }

  if (!isCommercialContentPath(pagePath)) return null;

  const parts = pagePath.split("/").filter(Boolean);
  if (parts[0] === "artists" && parts[1]) return { entityType: "artist", entitySlug: parts[1], pagePath };
  if (parts[0] === "tracks" && parts[2]) return { entityType: "track", entitySlug: parts[2], pagePath };
  if (parts[0] === "releases" && parts[2]) return { entityType: "release", entitySlug: parts[2], pagePath };
  if ((parts[0] === "magazine" || parts.length === 1) && parts[parts.length - 1]) return { entityType: "article", entitySlug: parts[parts.length - 1], pagePath };
  if (parts[0] === "guides" && parts[1]) return { entityType: "guide", entitySlug: parts[1], pagePath };
  if (parts[0] === "charts") return { entityType: "chart", entitySlug: parts.join("/"), pagePath };

  return null;
}

function readContextString(row: any, keys: string[]): string {
  const ctx = row?.context || {};
  for (const key of keys) {
    const value = readString(ctx[key]);
    if (value) return value;
  }
  return "";
}

function publicUrlForEntity(entityType: string, slug: string, row?: any): string {
  const ctx = row?.context || {};
  const artistSlug = readString(ctx.artist_slug) || readString(ctx.artistSlug) || readString(ctx.primary_artist_slug);

  if (!entityType || !slug) return "";

  if (entityType === "artist") return `/artists/${slug}`;
  if (entityType === "track") return artistSlug ? `/tracks/${artistSlug}/${slug}` : `/tracks/${slug}`;
  if (entityType === "release") return artistSlug ? `/releases/${artistSlug}/${slug}` : `/releases/${slug}`;
  if (entityType === "article") return `/magazine/${slug}`;
  if (entityType === "guide") return `/guides/${slug}`;
  if (entityType === "genre") return `/genres/${slug}`;
  if (entityType === "label") return `/labels/${slug}`;
  if (entityType === "category") return `/categories/${slug}`;
  if (entityType === "tag") return `/tags/${slug}`;
  if (entityType === "author") return `/authors/${slug}`;
  if (entityType === "chart") return `/charts/${slug}`;

  return "";
}

function bestSignalPath(row: any): string {
  const ctx = row?.context || {};

  const direct = [
    row?.page_url,
    ctx.page_url,
    ctx.url,
    ctx.href,
    ctx.raw_page_url,
    ctx.landing_url,
    ctx.target_url,
    ctx.share_url,
    ctx.canonical_url,
    ctx.article_url,
    ctx.entity_url,
    ctx.path,
  ].map(pathFromUrl).find((path) => path && isCommercialContentPath(path));

  if (direct) return direct;

  const explicitType = readString(row?.entity_type) || readString(ctx.entity_type) || readString(ctx.entityType);
  const explicitSlug = readString(row?.entity_slug) || readString(ctx.entity_slug) || readString(ctx.entitySlug);

  if (explicitType && explicitSlug) {
    const entityUrl = publicUrlForEntity(explicitType, explicitSlug, row);
    if (entityUrl) return entityUrl;
  }

  const articleSlug = readString(ctx.article_slug) || readString(ctx.articleSlug) || readString(ctx.slug);
  if (articleSlug) return `/magazine/${articleSlug}`;

  const trackSlug = readString(ctx.track_slug) || readString(ctx.trackSlug);
  if (trackSlug) return publicUrlForEntity("track", trackSlug, row);

  const releaseSlug = readString(ctx.release_slug) || readString(ctx.releaseSlug);
  if (releaseSlug) return publicUrlForEntity("release", releaseSlug, row);

  const artistSlug = readString(ctx.artist_slug) || readString(ctx.artistSlug);
  if (artistSlug) return `/artists/${artistSlug}`;

  return "";
}

function bestSignalLabel(row: any): string {
  const label = readContextString(row, [
    "title",
    "article_title",
    "articleTitle",
    "track_title",
    "trackTitle",
    "release_title",
    "releaseTitle",
    "artist_name",
    "artistName",
    "entity_title",
    "entityTitle",
    "label",
    "name",
  ]);

  if (label) return label;

  const path = bestSignalPath(row) || row?.page_url || row?.entity_slug;
  return labelFromPath(path);
}

function sharePlatform(row: any): string {
  const ctx = row?.context || {};
  return (
    readString(ctx.platform) ||
    readString(ctx.share_platform) ||
    readString(ctx.sharePlatform) ||
    readString(ctx.channel) ||
    readString(ctx.target) ||
    "unknown"
  );
}

function prettySignalLabel(value: unknown): string {
  const raw = readString(value);
  if (!raw) return "Unknown";

  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function adminUrlForEntity(entityType: string, slug: string): string {
  if (!entityType || !slug) return "/admin/analytics";
  if (entityType === "artist") return `/admin/registry/artists/${slug}`;
  if (entityType === "track") return `/admin/registry/tracks/${slug}`;
  if (entityType === "release") return `/admin/registry/releases/${slug}`;
  if (entityType === "label") return `/admin/registry/labels/${slug}`;
  if (entityType === "genre") return `/admin/registry/genres/${slug}`;
  if (entityType === "article") return `/admin/content/articles/${slug}`;
  if (entityType === "guide") return `/admin/content/guides/${slug}/edit`;
  if (entityType === "chart") return "/admin/charts/dashboard";
  return "/admin/analytics";
}

function scoreCap(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function actionForEntity(entityType: string): string {
  if (entityType === "artist") return "Open artist page, check related tracks, and consider featuring in Artist Signals.";
  if (entityType === "track") return "Check playback, shares, chart presence, lyrics, and article context.";
  if (entityType === "release") return "Check tracklist drop-off and promote the strongest track.";
  if (entityType === "article") return "Refresh headline, internal links, entity embeds, and newsletter CTA.";
  if (entityType === "chart") return "Use chart movement as evidence for a culture signal.";
  return "Open the entity and decide the next editorial or registry move.";
}

function buildSignalBoard(events: any[], range: RangeInput) {
  const pageViews = events.filter((e) => e.event_name === "page_view");
  const searchEvents = events.filter((e) => e.event_name === "search_query");
  const shareEvents = events.filter((e) => e.event_name === "share_click" || e.event_name === "share_copy");
  const signups = events.filter((e) => e.event_name === "newsletter_signup" || e.event_name === "briefing_subscribe");
  const plays = events.filter((e) => e.event_name === "video_play" || e.event_name === "player_play");
  const scrollEvents = events.filter((e) => e.event_name === "scroll_depth");

  const entityMap = new Map<string, any>();

  function entityBucket(row: any) {
    const inferred = inferEntity(row);
    if (!inferred) return null;

    const key = `${inferred.entityType}::${inferred.entitySlug}`;
    const existing = entityMap.get(key) || {
      id: key,
      entityType: inferred.entityType,
      entitySlug: inferred.entitySlug,
      label: labelFromPath(inferred.pagePath || row.page_url || inferred.entitySlug),
      pageViews: 0,
      shares: 0,
      signups: 0,
      plays: 0,
      scrolls: 0,
      sessions: new Set<string>(),
      referrers: new Set<string>(),
      pagePath: inferred.pagePath,
    };

    if (row.session_id) existing.sessions.add(row.session_id);
    const ref = domainFromReferrer(row.referrer);
    if (ref) existing.referrers.add(ref);
    if (!existing.pagePath && inferred.pagePath) existing.pagePath = inferred.pagePath;

    entityMap.set(key, existing);
    return existing;
  }

  for (const row of events) {
    const bucket = entityBucket(row);
    if (!bucket) continue;

    if (row.event_name === "page_view") bucket.pageViews += 1;
    if (row.event_name === "share_click" || row.event_name === "share_copy") bucket.shares += 1;
    if (row.event_name === "newsletter_signup" || row.event_name === "briefing_subscribe") bucket.signups += 1;
    if (row.event_name === "video_play" || row.event_name === "player_play") bucket.plays += 1;
    if (row.event_name === "scroll_depth") bucket.scrolls += 1;
  }

  const risingEntities = Array.from(entityMap.values())
    .filter((row) => isCommercialEntityType(row.entityType) || isCommercialContentPath(row.pagePath))
    .map((row) => {
      const score = scoreCap(
        row.pageViews * 4 +
        row.sessions.size * 7 +
        row.shares * 14 +
        row.signups * 18 +
        row.plays * 10 +
        row.referrers.size * 6
      );

      const evidence = [
        `${row.pageViews} page views`,
        `${row.sessions.size} sessions`,
        row.shares > 0 ? `${row.shares} shares` : "",
        row.signups > 0 ? `${row.signups} signups` : "",
        row.plays > 0 ? `${row.plays} plays` : "",
        row.referrers.size > 1 ? `${row.referrers.size} referrers` : "",
      ].filter(Boolean);

      return {
        id: row.id,
        entityType: row.entityType,
        entitySlug: row.entitySlug,
        label: row.label,
        score,
        metric: row.pageViews,
        metricLabel: "views",
        evidence,
        recommendedAction: actionForEntity(row.entityType),
        targetUrl: row.pagePath || "",
        adminUrl: adminUrlForEntity(row.entityType, row.entitySlug),
      };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  const searchMap = new Map<string, any>();
  for (const row of searchEvents) {
    const ctx = row.context || {};
    const query = readString(ctx.search_query).toLowerCase();
    if (!query) continue;
    const existing = searchMap.get(query) || { query, count: 0, zeroResults: false, sessions: new Set<string>() };
    existing.count += 1;
    existing.zeroResults = existing.zeroResults || ctx.results_count === 0 || ctx.zero_results === true;
    if (row.session_id) existing.sessions.add(row.session_id);
    searchMap.set(query, existing);
  }

  const searchGaps = Array.from(searchMap.values())
    .map((row) => ({
      id: `search::${row.query}`,
      query: row.query,
      count: row.count,
      zeroResults: Boolean(row.zeroResults),
      score: scoreCap(row.count * 14 + (row.zeroResults ? 35 : 8)),
      evidence: [
        `${row.count} searches`,
        `${row.sessions.size} sessions`,
        row.zeroResults ? "zero-result demand" : "existing demand",
      ],
      recommendedAction: row.zeroResults
        ? "Fix this demand gap: ingest entity, add alias, create article, or improve search mapping."
        : "Turn this demand into content: refresh the best page and add stronger entity links.",
      adminUrl: row.zeroResults ? "/admin/registry/artist-aliases" : "/admin/content/articles/new",
      targetUrl: `/search?q=${encodeURIComponent(row.query)}`,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  const shareMap = new Map<string, any>();
  for (const row of shareEvents) {
    const platform = sharePlatform(row);
    const pagePath = bestSignalPath(row);
    const inferred = inferEntity(row);
    const label = bestSignalLabel(row);

    if (!pagePath && !inferred && label === "Unknown") continue;

    const targetKey = pagePath || (inferred ? `${inferred.entityType}:${inferred.entitySlug}` : label);
    const key = `${platform}::${targetKey}`;
    const existing = shareMap.get(key) || {
      id: key,
      label,
      platform,
      pagePath,
      shares: 0,
      sessions: new Set<string>(),
    };

    existing.shares += 1;
    if (row.session_id) existing.sessions.add(row.session_id);
    shareMap.set(key, existing);
  }

  const shareVelocity = Array.from(shareMap.values())
    .map((row) => ({
      id: row.id,
      label: row.label,
      platform: row.platform,
      shares: row.shares,
      score: scoreCap(row.shares * 20 + row.sessions.size * 8),
      evidence: [`${row.shares} shares`, `${row.sessions.size} sessions`, `${prettySignalLabel(row.platform)} is moving it`],
      recommendedAction: "Create a tracked campaign link for the strongest channel and push this entity again.",
      targetUrl: row.pagePath,
      adminUrl: "/admin/analytics",
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const pageMap = new Map<string, any>();
  for (const row of pageViews) {
    const pagePath = pathFromUrl(row.page_url);
    if (!pagePath || !isCommercialContentPath(pagePath)) continue;
    const existing = pageMap.get(pagePath) || {
      id: pagePath,
      pageUrl: pagePath,
      pageType: row.page_type || "unknown",
      views: 0,
      sessions: new Set<string>(),
      shares: 0,
      signups: 0,
      plays: 0,
      scrolls: 0,
    };
    existing.views += 1;
    if (row.session_id) existing.sessions.add(row.session_id);
    pageMap.set(pagePath, existing);
  }

  for (const row of [...shareEvents, ...signups, ...plays, ...scrollEvents]) {
    const pagePath = pathFromUrl(row.page_url);
    if (!isCommercialContentPath(pagePath)) continue;
    const existing = pagePath ? pageMap.get(pagePath) : null;
    if (!existing) continue;
    if (row.event_name === "share_click" || row.event_name === "share_copy") existing.shares += 1;
    if (row.event_name === "newsletter_signup" || row.event_name === "briefing_subscribe") existing.signups += 1;
    if (row.event_name === "video_play" || row.event_name === "player_play") existing.plays += 1;
    if (row.event_name === "scroll_depth") existing.scrolls += 1;
  }

  const pagesToFix = Array.from(pageMap.values())
    .map((row) => {
      const weakEngagement = row.views >= 3 && row.shares + row.signups + row.plays === 0;
      const lowScroll = row.views >= 3 && row.scrolls === 0;
      const score = scoreCap(row.views * 5 + (weakEngagement ? 30 : 0) + (lowScroll ? 12 : 0));

      return {
        id: row.id,
        pageUrl: row.pageUrl,
        pageType: row.pageType,
        views: row.views,
        score,
        evidence: [
          `${row.views} views`,
          `${row.sessions.size} sessions`,
          weakEngagement ? "weak downstream action" : "",
          lowScroll ? "no scroll signal captured" : "",
        ].filter(Boolean),
        recommendedAction: weakEngagement
          ? "Improve the CTA, add internal entity links, and make the next action obvious."
          : "Review this page because it is getting attention.",
        targetUrl: row.pageUrl,
        adminUrl: row.pageType === "article" ? "/admin/content/articles" : "/admin/analytics",
      };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const sessions = new Map<string, any[]>();
  for (const row of pageViews) {
    if (!row.session_id) continue;
    if (!sessions.has(row.session_id)) sessions.set(row.session_id, []);
    sessions.get(row.session_id)!.push(row);
  }

  const journeyMap = new Map<string, Set<string>>();
  for (const [sessionId, rows] of sessions.entries()) {
    const sorted = rows
      .filter((row) => {
        const inferred = inferEntity(row);
        return inferred || isCommercialContentPath(row.page_url);
      })
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

    for (let i = 0; i < sorted.length - 1; i += 1) {
      const fromEntity = inferEntity(sorted[i]);
      const toEntity = inferEntity(sorted[i + 1]);
      const from = fromEntity ? `${fromEntity.entityType}:${fromEntity.entitySlug}` : labelFromPath(sorted[i].page_url);
      const to = toEntity ? `${toEntity.entityType}:${toEntity.entitySlug}` : labelFromPath(sorted[i + 1].page_url);
      if (!from || !to || from === to) continue;
      const key = `${from} → ${to}`;
      if (!journeyMap.has(key)) journeyMap.set(key, new Set<string>());
      journeyMap.get(key)!.add(sessionId);
    }
  }

  const highIntentJourneys = Array.from(journeyMap.entries())
    .map(([path, sessionSet]) => ({
      id: `journey::${path}`,
      path,
      sessions: sessionSet.size,
      score: scoreCap(sessionSet.size * 18),
      evidence: [`${sessionSet.size} sessions followed this path`],
      recommendedAction: "Strengthen this journey with internal links, embeds, and a clearer next step.",
      adminUrl: "/admin/analytics",
    }))
    .filter((row) => row.sessions > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const recommendedActions: any[] = [];
  const actionKeys = new Set<string>();

  function pushRecommendedAction(action: any) {
    const key = String(action.title || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!key || actionKeys.has(key)) return;
    actionKeys.add(key);
    recommendedActions.push(action);
  }

  for (const row of risingEntities.slice(0, 8)) {
    pushRecommendedAction({
      id: `action::rising::${row.id}`,
      priority: row.score,
      title: `Lean into ${row.label}`,
      reason: `${row.entityType} signal is moving now.`,
      evidence: row.evidence,
      actionLabel: "Open entity",
      actionUrl: row.adminUrl,
    });
  }

  for (const row of searchGaps.filter((r) => r.zeroResults).slice(0, 6)) {
    pushRecommendedAction({
      id: `action::search::${row.query}`,
      priority: row.score,
      title: `Fix search demand for “${row.query}”`,
      reason: "People are asking for this and the site is not answering cleanly enough.",
      evidence: row.evidence,
      actionLabel: "Open aliases",
      actionUrl: row.adminUrl,
    });
  }

  for (const row of pagesToFix.slice(0, 6)) {
    pushRecommendedAction({
      id: `action::page::${row.pageUrl}`,
      priority: row.score,
      title: `Improve ${labelFromPath(row.pageUrl)}`,
      reason: "This page has attention but needs a stronger next move.",
      evidence: row.evidence,
      actionLabel: "Open page",
      actionUrl: row.targetUrl,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    range,
    summary: {
      signalCount: risingEntities.length + shareVelocity.length + highIntentJourneys.length,
      opportunityCount: recommendedActions.length,
      risingEntityCount: risingEntities.length,
      searchGapCount: searchGaps.filter((row) => row.zeroResults).length,
      pageFixCount: pagesToFix.length,
    },
    risingEntities,
    searchGaps,
    shareVelocity,
    highIntentJourneys,
    pagesToFix,
    recommendedActions: recommendedActions
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 12),
  };
}

async function buildRealtime(db: ReturnType<typeof createClient>) {
  const now = Date.now();
  const since5 = new Date(now - 5 * 60 * 1000).toISOString();
  const since30 = new Date(now - 30 * 60 * 1000).toISOString();

  const { data, error } = await db
    .from("analytics_events")
    .select("id,event_name,page_url,page_type,entity_slug,entity_type,context,session_id,user_id,referrer,created_at")
    .gte("created_at", since30)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;

  const events = data ?? [];
  const last5 = events.filter((e) => e.created_at >= since5);
  const pageViews = events.filter((e) => e.event_name === "page_view");
  const last5PageViews = last5.filter((e) => e.event_name === "page_view");

  const minuteMap = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * 60 * 1000);
    d.setSeconds(0, 0);
    minuteMap.set(d.toISOString(), 0);
  }

  for (const row of pageViews) {
    const d = new Date(row.created_at);
    d.setSeconds(0, 0);
    const key = d.toISOString();
    if (minuteMap.has(key)) minuteMap.set(key, (minuteMap.get(key) || 0) + 1);
  }

  return {
    generatedAt: new Date().toISOString(),
    activeSessions: new Set(last5.map((e) => e.session_id).filter(Boolean)).size,
    pageViews5m: last5PageViews.length,
    pageViews30m: pageViews.length,
    events30m: events.length,
    topLivePages: countBy(pageViews, (e) => e.page_url || "unknown", 10).map((row) => {
      const sample = pageViews.find((e) => (e.page_url || "unknown") === row.label);
      return { page_url: row.label, page_type: sample?.page_type || "unknown", views: row.count };
    }),
    topReferrers: countBy(pageViews, (e) => domainFromReferrer(e.referrer) || "direct", 10).map((row) => ({
      referrer: row.label,
      count: row.count,
    })),
    eventStream: events.slice(0, 30).map((e) => ({
      id: e.id,
      event_name: e.event_name,
      page_url: e.page_url,
      page_type: e.page_type,
      entity_slug: e.entity_slug,
      entity_type: e.entity_type,
      session_id: e.session_id,
      referrer: e.referrer,
      created_at: e.created_at,
    })),
    minuteSeries: Array.from(minuteMap.entries()).map(([minute, pageViews]) => ({ minute, pageViews })),
  };
}

async function moderationStats(db: ReturnType<typeof createClient>) {
  const [
    { count: totalComments },
    { count: flaggedComments },
    { count: pendingReports },
    { count: pendingContributions },
    { count: hiddenComments },
    { count: removedComments },
  ] = await Promise.all([
    db.from("community_comments").select("id", { count: "exact", head: true }),
    db.from("community_comments").select("id", { count: "exact", head: true }).gt("report_count", 0),
    db.from("community_reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("community_contributions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("community_comments").select("id", { count: "exact", head: true }).eq("status", "hidden"),
    db.from("community_comments").select("id", { count: "exact", head: true }).eq("status", "removed"),
  ]);

  return {
    totalComments: totalComments ?? 0,
    flaggedComments: flaggedComments ?? 0,
    pendingReports: pendingReports ?? 0,
    pendingContributions: pendingContributions ?? 0,
    hiddenComments: hiddenComments ?? 0,
    removedComments: removedComments ?? 0,
  };
}

async function commentsQueue(db: ReturnType<typeof createClient>, filters: any = {}) {
  const { status = "all", search = "", sort = "newest", limit = 25, offset = 0 } = filters;

  let countQuery = db.from("community_comments").select("id", { count: "exact", head: true });
  if (status && status !== "all") countQuery = countQuery.eq("status", status);
  if (search) countQuery = countQuery.or(`body_plain.ilike.%${search}%,body_markdown.ilike.%${search}%`);
  const { count: total, error: countError } = await countQuery;
  if (countError) throw countError;

  let query = db
    .from("community_comments")
    .select("*, community_threads(title, entity_type, entity_slug, entity_url)")
    .range(offset, offset + limit - 1);

  if (status && status !== "all") query = query.eq("status", status);
  if (search) query = query.or(`body_plain.ilike.%${search}%,body_markdown.ilike.%${search}%`);

  if (sort === "oldest") query = query.order("created_at", { ascending: true });
  else if (sort === "most_reported") query = query.order("report_count", { ascending: false });
  else if (sort === "most_votes") query = query.order("upvote_count", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw error;

  const authorIds = [...new Set((data ?? []).map((r: any) => r.author_id).filter(Boolean))];
  let profileMap: Record<string, any> = {};
  if (authorIds.length > 0) {
    const { data: profiles } = await db.from("community_profiles").select("*").in("user_id", authorIds);
    profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.user_id, p]));
  }

  const comments = (data ?? []).map((row: any) => {
    const thread = row.community_threads;
    const profile = profileMap[row.author_id];

    return {
      id: row.id,
      threadId: row.thread_id,
      parentId: row.parent_id ?? null,
      rootId: row.root_id ?? null,
      authorId: row.author_id,
      author: profile ? {
        userId: profile.user_id,
        username: profile.username,
        displayName: profile.display_name ?? null,
        avatarUrl: profile.avatar_url ?? null,
        bio: null,
        country: null,
        city: null,
        roleLabels: [],
        trustLevel: 0,
        reputationScore: 0,
        commentCount: 0,
        contributionCount: 0,
        isPublic: true,
        createdAt: "",
        updatedAt: "",
      } : null,
      bodyMarkdown: row.body_markdown,
      bodyPlain: row.body_plain ?? null,
      bodyHtml: row.body_html ?? null,
      depth: row.depth ?? 0,
      path: row.path ?? null,
      status: row.status,
      isPinned: row.is_pinned ?? false,
      isEditorPick: row.is_editor_pick ?? false,
      upvoteCount: row.upvote_count ?? 0,
      downvoteCount: row.downvote_count ?? 0,
      replyCount: row.reply_count ?? 0,
      reactionCount: row.reaction_count ?? 0,
      reportCount: row.report_count ?? 0,
      score: row.score ?? 0,
      userVote: null,
      userReactions: [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      editedAt: row.edited_at ?? null,
      deletedAt: row.deleted_at ?? null,
      threadTitle: thread?.title ?? "Unknown",
      threadEntityType: thread?.entity_type ?? null,
      threadEntitySlug: thread?.entity_slug ?? null,
    };
  });

  return { comments, total: total ?? 0 };
}

async function simpleQueue(db: ReturnType<typeof createClient>, table: string, filters: any = {}) {
  const { status, sort = "newest", limit = 25, offset = 0 } = filters;

  let countQuery = db.from(table).select("id", { count: "exact", head: true });
  if (status) countQuery = countQuery.eq("status", status);
  const { count: total, error: countError } = await countQuery;
  if (countError) throw countError;

  let query = db.from(table).select("*").range(offset, offset + limit - 1);
  if (status) query = query.eq("status", status);
  query = query.order("created_at", { ascending: sort === "oldest" });

  const { data, error } = await query;
  if (error) throw error;

  return { rows: data ?? [], total: total ?? 0 };
}

Deno.serve(async (req) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return fail("method_not_allowed", "Use POST.", headers, 405);

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const user = await verifyUser(req, db);
  if (!user) return fail("not_authenticated", "Missing or invalid Authorization header.", headers, 401);

  const allowed = await requireAdminRead(user.id, db);
  if (!allowed) return fail("permission_denied", "Requires admin analytics/community access.", headers, 403);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("bad_json", "Invalid JSON body.", headers, 400);
  }

  const action = String(body.action || "");

  try {
    if (action === "analytics_snapshot") {
      const range = body.range ?? 30;
      const events = await getAnalyticsEvents(db, range);
      return ok(buildSnapshot(events, range), headers);
    }

    if (action === "analytics_signal_board") {
      const range = body.range ?? 30;
      const events = await getAnalyticsEvents(db, range);
      return ok(buildSignalBoard(events, range), headers);
    }

    if (action === "analytics_realtime") {
      return ok(await buildRealtime(db), headers);
    }

    if (action === "moderation_stats") {
      return ok(await moderationStats(db), headers);
    }

    if (action === "comments_queue") {
      return ok(await commentsQueue(db, body.filters ?? {}), headers);
    }

    if (action === "reports_queue") {
      const result = await simpleQueue(db, "community_reports", body.filters ?? {});
      return ok({
        reports: result.rows.map((row: any) => ({
          id: row.id,
          reporterId: row.reporter_id,
          commentId: row.comment_id ?? null,
          profileId: row.profile_id ?? null,
          reason: row.reason,
          details: row.details ?? null,
          status: row.status,
          reviewedBy: row.reviewed_by ?? null,
          reviewedAt: row.reviewed_at ?? null,
          createdAt: row.created_at,
        })),
        total: result.total,
      }, headers);
    }

    if (action === "contributions_queue") {
      const result = await simpleQueue(db, "community_contributions", body.filters ?? {});
      return ok({
        contributions: result.rows.map((row: any) => ({
          id: row.id,
          userId: row.user_id,
          sourceCommentId: row.source_comment_id ?? null,
          entityType: row.entity_type,
          entityId: row.entity_id ?? null,
          entitySlug: row.entity_slug ?? null,
          contributionType: row.contribution_type,
          payload: row.payload ?? {},
          status: row.status,
          reviewedBy: row.reviewed_by ?? null,
          reviewedAt: row.reviewed_at ?? null,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
        total: result.total,
      }, headers);
    }

    if (action === "moderation_log") {
      const result = await simpleQueue(db, "community_moderation_events", body.filters ?? {});
      return ok({
        events: result.rows.map((row: any) => ({
          id: row.id,
          moderatorId: row.moderator_id,
          moderatorName: "Moderator",
          targetType: row.target_type,
          targetId: row.target_id,
          action: row.action,
          reason: row.reason ?? null,
          metadata: row.metadata ?? {},
          createdAt: row.created_at,
        })),
        total: result.total,
      }, headers);
    }

    return fail("unknown_action", `Unknown action: ${action}`, headers, 400);
  } catch (error) {
    console.error("[admin-analytics-api]", action, error);
    return fail("query_failed", error instanceof Error ? error.message : String(error), headers, 500);
  }
});
