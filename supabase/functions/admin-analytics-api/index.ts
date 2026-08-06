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

const ANALYTICS_TIME_ZONE = "Africa/Nairobi";

function nairobiDateString(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ANALYTICS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function utcFromNairobiDate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00+03:00`);
}

function shiftNairobiDate(dateString: string, days: number): string {
  const date = utcFromNairobiDate(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return nairobiDateString(date);
}

function sinceFromRange(range: RangeInput = 30): string {
  if (typeof range === "number") {
    if (range <= 0) return new Date(0).toISOString();

    const today = nairobiDateString();
    const start = shiftNairobiDate(today, -(range - 1));
    return utcFromNairobiDate(start).toISOString();
  }

  return utcFromNairobiDate(range.start).toISOString();
}

function untilFromRange(range: RangeInput = 30): string {
  if (typeof range === "number") {
    if (range <= 0) return new Date().toISOString();

    const today = nairobiDateString();
    const tomorrow = shiftNairobiDate(today, 1);
    return new Date(utcFromNairobiDate(tomorrow).getTime() - 1).toISOString();
  }

  const nextDay = shiftNairobiDate(range.end, 1);
  return new Date(utcFromNairobiDate(nextDay).getTime() - 1).toISOString();
}

function dayCount(range: RangeInput = 30): number {
  if (typeof range === "number") return range <= 0 ? 365 : range;

  const start = utcFromNairobiDate(range.start);
  const end = utcFromNairobiDate(range.end);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

function todayStart(): string {
  return utcFromNairobiDate(nairobiDateString()).toISOString();
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

function hostnameFromUrl(raw: unknown): string {
  const value = readString(raw);
  if (!value) return "";

  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function isInternalHostname(hostname: string): boolean {
  const host = hostname.replace(/^www\./, "").toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local") ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  );
}

function isInternalAnalyticsEvent(row: any): boolean {
  const ctx = (row?.context || {}) as Record<string, any>;

  if (ctx.analytics_is_internal === true) return true;
  if (readString(ctx.analytics_traffic_type).toLowerCase() === "internal") return true;
  if (isInternalHostname(readString(ctx.analytics_hostname))) return true;

  const pageHost = hostnameFromUrl(row?.page_url);
  if (pageHost && isInternalHostname(pageHost)) return true;

  const rawHost = hostnameFromUrl(ctx.raw_page_url);
  if (rawHost && isInternalHostname(rawHost)) return true;

  const canonicalHost = hostnameFromUrl(ctx.canonical_page_url);
  if (canonicalHost && isInternalHostname(canonicalHost)) return true;

  return false;
}

function filterInternalEvents<T extends any[]>(events: T, clean = true): T {
  if (!clean) return events;

  const filtered = events.filter((row) => !isInternalAnalyticsEvent(row)) as T;

  // Safety guard: clean mode should remove internal noise, not erase the dashboard.
  // If raw analytics has rows but the clean filter removes everything, return raw rows
  // and log loudly so we can tighten the classifier without breaking reporting.
  if (events.length > 0 && filtered.length === 0) {
    console.warn("[admin-analytics-api] clean filter removed all events; returning raw events as safety fallback", {
      rawCount: events.length,
    });
    return events;
  }

  return filtered;
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

async function getAnalyticsEvents(db: ReturnType<typeof createClient>, range: RangeInput, limit = 50000, clean = true) {
  const since = sinceFromRange(range);
  const until = untilFromRange(range);
  const pageSize = 1000;
  const rows: any[] = [];

  for (let offset = 0; offset < limit; offset += pageSize) {
    const { data, error } = await db
      .from("analytics_events")
      .select("id,event_name,page_url,page_type,entity_slug,entity_type,context,session_id,user_id,referrer,created_at")
      .gte("created_at", since)
      .lte("created_at", until)
      .order("created_at", { ascending: true })
      .range(offset, Math.min(offset + pageSize - 1, limit - 1));

    if (error) throw error;

    const batch = data ?? [];
    rows.push(...batch);

    if (batch.length < pageSize) break;
  }

  return filterInternalEvents(rows, clean);
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
      searchQueries: searchEvents.filter((e) => e.created_at >= today).length,
      videoPlays: videos.filter((e) => e.created_at >= today).length,
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

function dateRangeForRollups(range: RangeInput = 30): { startDate: string; endDate: string } {
  if (typeof range !== "number") {
    return { startDate: range.start, endDate: range.end };
  }

  const end = new Date();
  const start = new Date(Date.now() - Math.max(1, range) * 86400000);

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function evidenceFromRollup(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item: any) => {
      const label = readString(item?.label);
      const rawValue = item?.value;
      const numberValue = typeof rawValue === "number" ? rawValue : Number(rawValue || 0);
      if (!label || !Number.isFinite(numberValue) || numberValue <= 0) return "";
      return `${numberValue} ${label.toLowerCase()}`;
    })
    .filter(Boolean);
}

function rollupLabel(row: any): string {
  return (
    readString(row.entity_title) ||
    labelFromPath(row.page_path || row.entity_slug || row.query || "Unknown")
  );
}

function platformFromRollupContext(row: any): string {
  const ctx = row?.sample_context || {};
  return (
    readString(ctx.platform) ||
    readString(ctx.share_platform) ||
    readString(ctx.sharePlatform) ||
    readString(ctx.channel) ||
    readString(ctx.target) ||
    "share"
  );
}

function rollupNumber(row: any, key: string): number {
  const value = Number(row?.[key] || 0);
  return Number.isFinite(value) ? value : 0;
}

function mergeRollupEvidence(a: unknown, b: unknown): unknown[] {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  return [...left, ...right].slice(0, 12);
}

function rollupNodeLabel(entityType: unknown, entitySlug: unknown, entityTitle: unknown, pagePath: unknown): string {
  const title = readString(entityTitle);
  if (title) return title;

  const type = prettySignalLabel(entityType);
  const label = labelFromPath(pagePath || entitySlug || "Unknown");

  if (!type || type === "Unknown" || type === "Page") return label;
  return `${type}: ${label}`;
}

function dedupeScoreRows(rows: any[]): any[] {
  const map = new Map<string, any>();

  for (const row of rows) {
    const key = `${row.entity_type || "entity"}::${row.entity_slug || row.page_path || ""}`;
    if (!key || key.endsWith("::")) continue;

    const existing = map.get(key) || { ...row };
    if (!map.has(key)) {
      map.set(key, existing);
      continue;
    }

    existing.entity_title = existing.entity_title || row.entity_title;
    existing.page_path = existing.page_path || row.page_path;
    existing.page_views += rollupNumber(row, "page_views");
    existing.unique_sessions += rollupNumber(row, "unique_sessions");
    existing.share_events += rollupNumber(row, "share_events");
    existing.search_mentions += rollupNumber(row, "search_mentions");
    existing.newsletter_events += rollupNumber(row, "newsletter_events");
    existing.playback_events += rollupNumber(row, "playback_events");
    existing.referrer_domains += rollupNumber(row, "referrer_domains");
    existing.signal_score = Math.max(rollupNumber(existing, "signal_score"), rollupNumber(row, "signal_score"));
    existing.evidence = mergeRollupEvidence(existing.evidence, row.evidence);
    existing.explanation = existing.explanation || row.explanation;
    existing.recommended_action = existing.recommended_action || row.recommended_action;
  }

  return Array.from(map.values()).sort((a, b) => rollupNumber(b, "signal_score") - rollupNumber(a, "signal_score"));
}

function dedupeOpportunityRows(rows: any[]): any[] {
  const map = new Map<string, any>();

  for (const row of rows) {
    const key = [
      row.opportunity_type || "opportunity",
      row.entity_type || "",
      row.entity_slug || "",
      row.query || "",
      row.page_path || "",
    ].join("::");

    const existing = map.get(key);
    if (!existing || rollupNumber(row, "opportunity_score") > rollupNumber(existing, "opportunity_score")) {
      map.set(key, row);
    }
  }

  return Array.from(map.values()).sort((a, b) => rollupNumber(b, "opportunity_score") - rollupNumber(a, "opportunity_score"));
}

function dedupeSearchRows(rows: any[]): any[] {
  const map = new Map<string, any>();

  for (const row of rows) {
    const key = readString(row.query).toLowerCase();
    if (!key) continue;

    const existing = map.get(key) || { ...row, searches: 0, unique_sessions: 0, zero_result_events: 0, opportunity_score: 0 };
    existing.searches += rollupNumber(row, "searches");
    existing.unique_sessions += rollupNumber(row, "unique_sessions");
    existing.zero_result_events += rollupNumber(row, "zero_result_events");
    existing.opportunity_score = Math.max(rollupNumber(existing, "opportunity_score"), rollupNumber(row, "opportunity_score"));
    existing.recommended_action = existing.recommended_action || row.recommended_action;
    map.set(key, existing);
  }

  return Array.from(map.values()).sort((a, b) => rollupNumber(b, "opportunity_score") - rollupNumber(a, "opportunity_score"));
}

function dedupeJourneyRows(rows: any[]): any[] {
  const map = new Map<string, any>();

  for (const row of rows) {
    const key = `${row.from_type}::${row.from_slug}::${row.to_type}::${row.to_slug}`;
    const existing = map.get(key) || { ...row, sessions: 0, transitions: 0 };

    existing.from_title = existing.from_title || row.from_title;
    existing.to_title = existing.to_title || row.to_title;
    existing.from_path = existing.from_path || row.from_path;
    existing.to_path = existing.to_path || row.to_path;
    existing.sessions += rollupNumber(row, "sessions");
    existing.transitions += rollupNumber(row, "transitions");
    map.set(key, existing);
  }

  return Array.from(map.values()).sort((a, b) => {
    const sessionDiff = rollupNumber(b, "sessions") - rollupNumber(a, "sessions");
    if (sessionDiff !== 0) return sessionDiff;
    return rollupNumber(b, "transitions") - rollupNumber(a, "transitions");
  });
}

function dedupeShareRows(rows: any[]): any[] {
  const map = new Map<string, any>();

  for (const row of rows) {
    const key = `${row.entity_type || "entity"}::${row.entity_slug || row.page_path || ""}`;
    if (!key || key.endsWith("::")) continue;

    const existing = map.get(key) || { ...row, share_events: 0, unique_sessions: 0 };
    existing.entity_title = existing.entity_title || row.entity_title;
    existing.page_path = existing.page_path || row.page_path;
    existing.share_events += rollupNumber(row, "share_events");
    existing.unique_sessions += rollupNumber(row, "unique_sessions");

    const currentPlatform = platformFromRollupContext(existing);
    const nextPlatform = platformFromRollupContext(row);
    if (currentPlatform === "share" && nextPlatform !== "share") existing.sample_context = row.sample_context;

    map.set(key, existing);
  }

  return Array.from(map.values()).sort((a, b) => rollupNumber(b, "share_events") - rollupNumber(a, "share_events"));
}

function brokenPagePathFromUrl(raw: unknown): string {
  const value = readString(raw);
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.pathname.replace(/\/+$/, "") || "/";
  } catch {
    return value.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
  }
}

function brokenRouteGuess(path: string): string {
  if (path.startsWith("/tag/")) return "legacy_tag";
  if (path.startsWith("/category/")) return "legacy_category";
  if (path.startsWith("/artist/")) return "legacy_artist";
  if (path.startsWith("/release/")) return "legacy_release";
  if (path.startsWith("/track/")) return "legacy_track";
  return "unknown";
}

function brokenSuggestedFix(path: string): string {
  if (path.startsWith("/tag/")) return path.replace(/^\/tag\//, "/tags/");
  if (path.startsWith("/category/")) return path.replace(/^\/category\//, "/categories/");
  if (path.startsWith("/artist/")) return path.replace(/^\/artist\//, "/artists/");
  if (path.startsWith("/release/")) return path.replace(/^\/release\//, "/releases/");
  if (path.startsWith("/track/")) return path.replace(/^\/track\//, "/tracks/");
  return "";
}

function brokenSeverity(hits: number, sessions: number, suggestedFix: string): "low" | "medium" | "high" {
  if (hits >= 10 || sessions >= 5) return "high";
  if (hits >= 3 || sessions >= 2 || suggestedFix) return "medium";
  return "low";
}

function isScannablePublicUrl(raw: unknown): boolean {
  const value = readString(raw);
  if (!value) return false;

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    if (host !== "wakilisha.africa") return false;

    const path = url.pathname || "/";
    if (path.startsWith("/admin")) return false;
    if (path.startsWith("/api")) return false;
    if (path.startsWith("/auth")) return false;
    if (path.startsWith("/settings")) return false;
    if (path.startsWith("/wp-admin")) return false;
    if (path.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|css|js|map|xml|txt|json|woff2?)$/i)) return false;

    return true;
  } catch {
    return false;
  }
}

function canonicalScanUrl(raw: unknown): string {
  try {
    const url = new URL(readString(raw));
    url.hash = "";
    return `https://wakilisha.africa${url.pathname.replace(/\/+$/, "") || "/"}${url.search || ""}`;
  } catch {
    return "";
  }
}

function isSoft404Html(html: string): boolean {
  const sample = html.slice(0, 120000).toLowerCase();

  return (
    sample.includes("page not found") ||
    sample.includes(">404<") ||
    sample.includes("the page you're looking for doesn't exist") ||
    sample.includes("doesn't exist or has been moved") ||
    sample.includes("not found.")
  );
}

function titleFromHtml(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim() || "";
}

async function scanPublicUrl(url: string) {
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "WAKILISHA Maintenance URL Health Scanner/1.0",
        "Accept": "text/html,application/xhtml+xml",
      },
    });

    const finalUrl = response.url || url;
    const contentType = response.headers.get("content-type") || "";
    const html = contentType.includes("text/html") ? await response.text() : "";
    const soft404 = response.ok && html ? isSoft404Html(html) : false;

    return {
      url,
      finalUrl,
      statusCode: response.status,
      ok: response.ok && !soft404,
      soft404,
      title: html ? titleFromHtml(html) : "",
      durationMs: Date.now() - startedAt,
      error: "",
    };
  } catch (error) {
    return {
      url,
      finalUrl: url,
      statusCode: 0,
      ok: false,
      soft404: false,
      title: "",
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Fetch failed",
    };
  }
}

function scanResultToBrokenEvent(result: any) {
  const path = brokenPagePathFromUrl(result.finalUrl || result.url);
  const status = result.statusCode || 0;
  const legacyFix = brokenSuggestedFix(path);
  const dirtyTrackFix = cleanDirtyTrackPath(path);
  const suggestedFix = legacyFix || dirtyTrackFix;

  let routeGuess = brokenRouteGuess(path);
  if (dirtyTrackFix) routeGuess = "dirty_track_slug";
  if (routeGuess === "unknown" && path.startsWith("/magazine/")) routeGuess = "missing_article";
  if (routeGuess === "unknown" && path.startsWith("/tracks/")) routeGuess = "missing_track";
  if (routeGuess === "unknown" && path.startsWith("/artists/")) routeGuess = "missing_artist";
  if (routeGuess === "unknown" && path.startsWith("/releases/")) routeGuess = "missing_release";
  if (routeGuess === "unknown" && path.startsWith("/guides/")) routeGuess = "missing_guide";

  if (routeGuess === "unknown" && isKnownContentRoute(path) && status < 400 && !result.soft404) {
    return null;
  }

  return {
    id: `scan::${result.url}`,
    event_name: "page_not_found",
    page_url: result.finalUrl || result.url,
    page_type: result.soft404 ? "soft_404" : "404",
    entity_slug: path.replace(/^\/+|\/+$/g, "").replace(/[^a-zA-Z0-9/_-]+/g, "-") || "home",
    entity_type: "broken_page",
    session_id: `maintenance_scan::${new Date().toISOString().slice(0, 10)}`,
    referrer: null,
    created_at: new Date().toISOString(),
    context: {
      status_code: status,
      not_found_path: path,
      route_guess: result.soft404 && routeGuess === "unknown" ? "suspected_soft_404" : routeGuess,
      suggested_fix: suggestedFix,
      soft_404_surface: result.soft404 ? "proactive_url_scan" : null,
      proactive_scan: true,
      scanned_url: result.url,
      final_url: result.finalUrl,
      page_title: result.title,
      fetch_error: result.error,
      duration_ms: result.durationMs,
    },
  };
}

function isKnownPublicIndexPath(path: string): boolean {
  return [
    "/about",
    "/account",
    "/artists",
    "/authors",
    "/categories",
    "/charts",
    "/contact",
    "/faqs",
    "/featured-artists",
    "/featured-guides",
    "/genres",
    "/guides",
    "/labels",
    "/lyrics",
    "/magazine",
    "/privacy",
    "/profile",
    "/releases",
    "/search",
    "/tags",
    "/terms",
    "/tracks",
  ].includes(path);
}

function isKnownContentRoute(path: string): boolean {
  return (
    path.startsWith("/magazine/") ||
    path.startsWith("/tracks/") ||
    path.startsWith("/artists/") ||
    path.startsWith("/releases/") ||
    path.startsWith("/guides/")
  );
}

function cleanDirtyTrackPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts[0] !== "tracks" || parts.length < 3) return "";

  const artistSlug = parts[1];
  const trackSlug = parts.slice(2).join("/");

  if (trackSlug.endsWith(`-${artistSlug}`)) {
    return `/tracks/${artistSlug}/${trackSlug.slice(0, -artistSlug.length - 1)}`;
  }

  return "";
}

function routeAwareBrokenEvent(url: string): any | null {
  const path = brokenPagePathFromUrl(url);
  if (!path || path === "/" || isKnownPublicIndexPath(path)) return null;

  const legacyFix = brokenSuggestedFix(path);
  const routeGuess = brokenRouteGuess(path);

  if (legacyFix) {
    return {
      id: `route_scan::${path}`,
      event_name: "page_not_found",
      page_url: url,
      page_type: "suspected_soft_404",
      entity_slug: path.replace(/^\/+|\/+$/g, "").replace(/[^a-zA-Z0-9/_-]+/g, "-") || "home",
      entity_type: "broken_page",
      session_id: `maintenance_route_scan::${new Date().toISOString().slice(0, 10)}`,
      referrer: null,
      created_at: new Date().toISOString(),
      context: {
        status_code: 200,
        not_found_path: path,
        route_guess: routeGuess,
        suggested_fix: legacyFix,
        soft_404_surface: "route_aware_proactive_scan",
        proactive_scan: true,
        scanned_url: url,
        final_url: legacyFix,
      },
    };
  }

  const parts = path.split("/").filter(Boolean);

  if (parts.length === 1) {
    return {
      id: `single_slug_scan::${path}`,
      event_name: "page_not_found",
      page_url: url,
      page_type: "suspected_soft_404",
      entity_slug: parts[0],
      entity_type: "broken_page",
      session_id: `maintenance_route_scan::${new Date().toISOString().slice(0, 10)}`,
      referrer: null,
      created_at: new Date().toISOString(),
      context: {
        status_code: 200,
        not_found_path: path,
        route_guess: "possible_legacy_article_slug",
        suggested_fix: "",
        soft_404_surface: "single_slug_proactive_scan",
        proactive_scan: true,
        scanned_url: url,
      },
    };
  }

  return null;
}

async function taxonomyEmptyEvents(db: ReturnType<typeof createClient>, pageRows: any[]) {
  const events: any[] = [];
  const seen = new Set<string>();

  for (const row of pageRows) {
    const path = brokenPagePathFromUrl(row.page_url);
    const match = path.match(/^\/(tags|categories)\/([^/?#]+)/);
    if (!match) continue;

    const taxonomy = match[1] === "tags" ? "post_tag" : "category";
    const kind = match[1] === "tags" ? "tag" : "category";
    const slug = decodeURIComponent(match[2]);
    const key = `${kind}:${slug}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const { data: termRows, error: termError } = await db.rpc("public_get_taxonomy_term", {
      p_taxonomy: taxonomy,
      p_slug: slug,
    });

    const term = Array.isArray(termRows) ? termRows[0] : null;

    if (termError || !term) {
      events.push({
        id: `missing_taxonomy::${kind}::${slug}`,
        event_name: "page_not_found",
        page_url: row.page_url,
        page_type: "suspected_soft_404",
        entity_slug: slug,
        entity_type: "broken_page",
        session_id: `maintenance_taxonomy_scan::${new Date().toISOString().slice(0, 10)}`,
        referrer: row.referrer ?? null,
        created_at: new Date().toISOString(),
        context: {
          status_code: 200,
          not_found_path: path,
          route_guess: `missing_${kind}`,
          suggested_fix: "",
          soft_404_surface: "taxonomy_proactive_scan",
          proactive_scan: true,
          scanned_url: row.page_url,
        },
      });
      continue;
    }

    const count = Number(term.article_count || 0);
    if (count === 0) {
      events.push({
        id: `empty_taxonomy::${kind}::${slug}`,
        event_name: "page_not_found",
        page_url: row.page_url,
        page_type: "suspected_soft_404",
        entity_slug: slug,
        entity_type: "broken_page",
        session_id: `maintenance_taxonomy_scan::${new Date().toISOString().slice(0, 10)}`,
        referrer: row.referrer ?? null,
        created_at: new Date().toISOString(),
        context: {
          status_code: 200,
          not_found_path: path,
          route_guess: `empty_${kind}`,
          suggested_fix: kind === "tag" ? "/admin/tags" : "/admin/categories",
          soft_404_surface: "taxonomy_proactive_scan",
          proactive_scan: true,
          scanned_url: row.page_url,
          taxonomy_name: term.name,
        },
      });
    }
  }

  return events;
}

async function scanBrokenPages(db: ReturnType<typeof createClient>, range: RangeInput, limit = 80, clean = true) {
  const { data: pageRows, error: pageError } = await db
    .from("analytics_events")
    .select("page_url,created_at,event_name,session_id,referrer,page_type,entity_slug,entity_type,context")
    .gte("created_at", sinceFromRange(range))
    .lte("created_at", untilFromRange(range))
    .not("page_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (pageError) throw pageError;

  const cleanPageRows = filterInternalEvents(pageRows ?? [], clean);

  const seen = new Set<string>();
  const candidates: string[] = [];
  const routeEvents: any[] = [];

  for (const row of cleanPageRows) {
    const url = canonicalScanUrl(row.page_url);
    if (!url || seen.has(url) || !isScannablePublicUrl(url)) continue;

    seen.add(url);

    const routeEvent = routeAwareBrokenEvent(url);
    if (routeEvent) routeEvents.push(routeEvent);

    candidates.push(url);
    if (candidates.length >= Math.max(1, Math.min(limit, 150))) break;
  }

  const taxonomyEvents = await taxonomyEmptyEvents(db, cleanPageRows);

  const brokenEvents: any[] = [...routeEvents, ...taxonomyEvents];
  let scanned = 0;
  let skipped = 0;
  let failed = 0;

  for (const url of candidates) {
    const result = await scanPublicUrl(url);
    scanned += 1;

    if (result.error) failed += 1;

    if (!result.ok) {
      const brokenEvent = scanResultToBrokenEvent(result);
      if (brokenEvent) brokenEvents.push(brokenEvent);
    } else {
      skipped += 1;
    }
  }

  const board = buildBrokenPages(brokenEvents, range);

  return {
    ...board,
    scanned,
    skipped,
    failed,
  };
}

function buildBrokenPages(events: any[], range: RangeInput) {
  const notFoundEvents = events.filter((row) => row.event_name === "page_not_found");
  const map = new Map<string, any>();

  for (const row of notFoundEvents) {
    const ctx = row.context || {};
    const path =
      readString(ctx.not_found_path) ||
      brokenPagePathFromUrl(ctx.raw_page_url) ||
      brokenPagePathFromUrl(row.page_url);

    if (!path) continue;

    const existing = map.get(path) || {
      id: `broken::${path}`,
      path,
      url: row.page_url || path,
      hits: 0,
      sessionSet: new Set<string>(),
      referrerSet: new Set<string>(),
      firstSeenAt: row.created_at,
      lastSeenAt: row.created_at,
      routeGuess: readString(ctx.route_guess) || brokenRouteGuess(path),
      suggestedFix: readString(ctx.suggested_fix) || brokenSuggestedFix(path),
      sampleUserAgent: readString(ctx.user_agent) || null,
    };

    existing.hits += 1;
    if (row.session_id) existing.sessionSet.add(row.session_id);
    if (row.referrer) existing.referrerSet.add(domainFromReferrer(row.referrer) || row.referrer);

    if (!existing.firstSeenAt || new Date(row.created_at) < new Date(existing.firstSeenAt)) {
      existing.firstSeenAt = row.created_at;
    }
    if (!existing.lastSeenAt || new Date(row.created_at) > new Date(existing.lastSeenAt)) {
      existing.lastSeenAt = row.created_at;
    }

    existing.routeGuess = existing.routeGuess || readString(ctx.route_guess) || brokenRouteGuess(path);
    existing.suggestedFix = existing.suggestedFix || readString(ctx.suggested_fix) || brokenSuggestedFix(path);
    map.set(path, existing);
  }

  const rows = Array.from(map.values())
    .map((row) => {
      const sessions = row.sessionSet.size;
      const referrers = Array.from(row.referrerSet).filter(Boolean).slice(0, 5);
      const severity = brokenSeverity(row.hits, sessions, row.suggestedFix);

      return {
        id: row.id,
        path: row.path,
        url: row.url,
        hits: row.hits,
        sessions,
        referrers,
        firstSeenAt: row.firstSeenAt,
        lastSeenAt: row.lastSeenAt,
        routeGuess: row.routeGuess || "unknown",
        suggestedFix: row.suggestedFix || "",
        severity,
        status: "hard_404",
        sampleUserAgent: row.sampleUserAgent,
      };
    })
    .sort((a, b) => {
      const severityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
      const severityDiff = severityWeight[b.severity] - severityWeight[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.hits - a.hits;
    });

  return {
    generatedAt: new Date().toISOString(),
    range,
    summary: {
      totalHits: rows.reduce((sum, row) => sum + row.hits, 0),
      uniquePages: rows.length,
      highSeverityCount: rows.filter((row) => row.severity === "high").length,
      legacyFixCount: rows.filter((row) => Boolean(row.suggestedFix)).length,
      lastSeenAt: rows[0]?.lastSeenAt || null,
    },
    rows,
  };
}

async function buildSignalBoardFromRollups(db: ReturnType<typeof createClient>, range: RangeInput) {
  const { startDate, endDate } = dateRangeForRollups(range);

  const [scoresResult, opportunitiesResult, searchResult, journeyResult, shareResult] = await Promise.all([
    db
      .from("signal_os_entity_signal_scores")
      .select("score_date,entity_type,entity_slug,entity_title,page_path,signal_score,signal_label,page_views,unique_sessions,share_events,search_mentions,newsletter_events,playback_events,referrer_domains,explanation,recommended_action,evidence")
      .gte("score_date", startDate)
      .lte("score_date", endDate)
      .order("signal_score", { ascending: false })
      .limit(200),

    db
      .from("signal_os_content_opportunities")
      .select("id,opportunity_date,opportunity_type,entity_type,entity_slug,entity_title,query,page_path,opportunity_score,title,reason,recommended_action,evidence,status")
      .gte("opportunity_date", startDate)
      .lte("opportunity_date", endDate)
      .eq("status", "open")
      .order("opportunity_score", { ascending: false })
      .limit(200),

    db
      .from("signal_os_search_demand_gaps")
      .select("metric_date,query,searches,unique_sessions,zero_result_events,matched_entity_type,matched_entity_slug,opportunity_score,recommended_action,sample_context")
      .gte("metric_date", startDate)
      .lte("metric_date", endDate)
      .order("opportunity_score", { ascending: false })
      .limit(200),

    db
      .from("signal_os_journey_edges_daily")
      .select("metric_date,from_type,from_slug,from_title,from_path,to_type,to_slug,to_title,to_path,sessions,transitions")
      .gte("metric_date", startDate)
      .lte("metric_date", endDate)
      .order("sessions", { ascending: false })
      .order("transitions", { ascending: false })
      .limit(200),

    db
      .from("signal_os_entity_daily_metrics")
      .select("metric_date,entity_type,entity_slug,entity_title,page_path,share_events,unique_sessions,sample_context")
      .gte("metric_date", startDate)
      .lte("metric_date", endDate)
      .gt("share_events", 0)
      .order("share_events", { ascending: false })
      .limit(200),
  ]);

  const firstError =
    scoresResult.error ||
    opportunitiesResult.error ||
    searchResult.error ||
    journeyResult.error ||
    shareResult.error;

  if (firstError) {
    console.warn("[analytics_signal_board] rollup fallback:", firstError.message);
    return null;
  }

  const scoreRows = dedupeScoreRows(scoresResult.data ?? []).slice(0, 12);
  const opportunityRows = dedupeOpportunityRows(opportunitiesResult.data ?? []).slice(0, 12);
  const searchRows = dedupeSearchRows(searchResult.data ?? []).slice(0, 12);
  const journeyRows = dedupeJourneyRows(journeyResult.data ?? []).slice(0, 12);
  const shareRows = dedupeShareRows(shareResult.data ?? []).slice(0, 10);

  if (
    scoreRows.length === 0 &&
    opportunityRows.length === 0 &&
    searchRows.length === 0 &&
    journeyRows.length === 0 &&
    shareRows.length === 0
  ) {
    return null;
  }

  const risingEntities = scoreRows.map((row: any) => {
    const evidence = evidenceFromRollup(row.evidence);
    if (evidence.length === 0 && row.explanation) evidence.push(row.explanation);

    return {
      id: `${row.entity_type}::${row.entity_slug}`,
      entityType: row.entity_type,
      entitySlug: row.entity_slug,
      label: rollupLabel(row),
      score: Number(row.signal_score || 0),
      metric: Number(row.page_views || 0),
      metricLabel: "views",
      evidence,
      recommendedAction: row.recommended_action || actionForEntity(row.entity_type),
      targetUrl: row.page_path || "",
      adminUrl: adminUrlForEntity(row.entity_type, row.entity_slug),
    };
  });

  const searchGaps = searchRows.map((row: any) => {
    const zeroResults = Number(row.zero_result_events || 0) > 0;

    return {
      id: `search::${row.query}`,
      query: row.query,
      count: Number(row.searches || 0),
      zeroResults,
      score: Number(row.opportunity_score || 0),
      evidence: [
        `${Number(row.searches || 0)} searches`,
        `${Number(row.unique_sessions || 0)} sessions`,
        zeroResults ? `${Number(row.zero_result_events || 0)} zero-result events` : "existing demand",
      ],
      recommendedAction:
        row.recommended_action ||
        (zeroResults
          ? "Fix this demand gap: ingest entity, add alias, create article, or improve search mapping."
          : "Turn this demand into content: refresh the best page and add stronger entity links."),
      adminUrl: zeroResults ? "/admin/registry/artist-aliases" : "/admin/content/articles/new",
      targetUrl: `/search?q=${encodeURIComponent(row.query || "")}`,
    };
  });

  const shareVelocity = shareRows.map((row: any) => {
    const platform = platformFromRollupContext(row);
    const score = scoreCap(Number(row.share_events || 0) * 20 + Number(row.unique_sessions || 0) * 8);

    return {
      id: `share::${platform}::${row.entity_type}::${row.entity_slug}`,
      label: rollupLabel(row),
      platform,
      shares: Number(row.share_events || 0),
      score,
      evidence: [
        `${Number(row.share_events || 0)} shares`,
        `${Number(row.unique_sessions || 0)} sessions`,
        platform === "share" ? "Share activity is moving it" : `${prettySignalLabel(platform)} is moving it`,
      ],
      recommendedAction: "Create a tracked campaign link for the strongest channel and push this entity again.",
      targetUrl: row.page_path || "",
      adminUrl: "/admin/analytics",
    };
  });

  const highIntentJourneys = journeyRows.map((row: any) => {
    const fromLabel = rollupNodeLabel(row.from_type, row.from_slug, row.from_title, row.from_path);
    const toLabel = rollupNodeLabel(row.to_type, row.to_slug, row.to_title, row.to_path);
    const path = `${fromLabel} → ${toLabel}`;

    return {
      id: `journey::${row.metric_date}::${row.from_type}::${row.from_slug}::${row.to_type}::${row.to_slug}`,
      path,
      sessions: Number(row.sessions || 0),
      score: scoreCap(Number(row.sessions || 0) * 18 + Number(row.transitions || 0) * 6),
      evidence: [
        `${Number(row.sessions || 0)} sessions followed this path`,
        `${Number(row.transitions || 0)} transitions`,
      ],
      recommendedAction: "Strengthen this journey with internal links, embeds, and a clearer next step.",
      adminUrl: "/admin/analytics",
    };
  });

  const pagesToFix = opportunityRows
    .filter((row: any) => row.opportunity_type === "page_fix")
    .map((row: any) => ({
      id: row.id,
      pageUrl: row.page_path || "",
      pageType: row.entity_type || "page",
      views: 0,
      score: Number(row.opportunity_score || 0),
      evidence: evidenceFromRollup(row.evidence),
      recommendedAction: row.recommended_action || "Review this page because it is getting attention.",
      targetUrl: row.page_path || "",
      adminUrl: row.entity_type === "article" ? "/admin/content/articles" : "/admin/analytics",
    }));

  const recommendedActionKeys = new Set<string>();
  const recommendedActions = opportunityRows
    .map((row: any) => ({
      id: `action::${row.id}`,
      priority: Number(row.opportunity_score || 0),
      title: row.title || `Review ${rollupLabel(row)}`,
      reason: row.reason || row.recommended_action || "Signal OS found a culture opportunity.",
      evidence: evidenceFromRollup(row.evidence),
      actionLabel:
        row.opportunity_type === "search_gap"
          ? "Open demand"
          : row.entity_type
            ? "Open entity"
            : "Open signal",
      actionUrl:
        row.opportunity_type === "search_gap"
          ? `/search?q=${encodeURIComponent(row.query || "")}`
          : row.page_path || adminUrlForEntity(row.entity_type, row.entity_slug),
    }))
    .filter((action: any) => {
      const key = String(action.title || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      if (!key || recommendedActionKeys.has(key)) return false;
      recommendedActionKeys.add(key);
      return true;
    });

  return {
    generatedAt: new Date().toISOString(),
    range,
    source: "signal_os_rollups",
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
    recommendedActions,
  };
}

async function buildRealtime(db: ReturnType<typeof createClient>, clean = true) {
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

  const events = filterInternalEvents(data ?? [], clean);
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

      const clean = body.clean !== false;

      if (!clean) {
        const rawEvents = await getAnalyticsEvents(db, range, 10000, false);
        return ok(buildSnapshot(rawEvents, range), headers);
      }

      const rawEvents = await getAnalyticsEvents(db, range, 10000, false);
      const cleanEvents = filterInternalEvents(rawEvents, true);

      const rawSnapshot = buildSnapshot(rawEvents, range);
      const cleanSnapshot = buildSnapshot(cleanEvents, range);

      const cleanLooksEmpty =
        cleanSnapshot.today.pageViews === 0 &&
        cleanSnapshot.today.uniqueSessions === 0 &&
        cleanSnapshot.kpis.totalPageViews === 0;

      const rawHasTraffic =
        rawSnapshot.today.pageViews > 0 ||
        rawSnapshot.today.uniqueSessions > 0 ||
        rawSnapshot.kpis.totalPageViews > 0;

      const cleanLooksOverFiltered =
        rawSnapshot.kpis.totalPageViews >= 100 &&
        cleanSnapshot.kpis.totalPageViews < Math.floor(rawSnapshot.kpis.totalPageViews * 0.6);

      if ((cleanLooksEmpty && rawHasTraffic) || cleanLooksOverFiltered) {
        console.warn("[admin-analytics-api] clean snapshot looked untrustworthy; returning raw snapshot", {
          rawEvents: rawEvents.length,
          cleanEvents: cleanEvents.length,
          rawTodayPageViews: rawSnapshot.today.pageViews,
          cleanTodayPageViews: cleanSnapshot.today.pageViews,
          rawTotalPageViews: rawSnapshot.kpis.totalPageViews,
          cleanTotalPageViews: cleanSnapshot.kpis.totalPageViews,
          reason: cleanLooksEmpty ? "clean_empty" : "clean_over_filtered",
        });

        return ok(rawSnapshot, headers);
      }

      return ok(cleanSnapshot, headers);
    }

    if (action === "analytics_signal_board") {
      const range = body.range ?? 30;
      const clean = body.clean !== false;
      const rollupBoard = await buildSignalBoardFromRollups(db, range);
      if (rollupBoard) return ok(rollupBoard, headers);

      const events = await getAnalyticsEvents(db, range, 10000, clean);
      return ok({ ...buildSignalBoard(events, range), source: "live_events_fallback" }, headers);
    }

    if (action === "analytics_broken_pages") {
      const range = body.range ?? 30;
      const clean = body.clean !== false;

      const { data: brokenEvents, error: brokenError } = await db
        .from("analytics_events")
        .select("id,event_name,page_url,page_type,entity_slug,entity_type,context,session_id,referrer,created_at")
        .eq("event_name", "page_not_found")
        .gte("created_at", sinceFromRange(range))
        .lte("created_at", untilFromRange(range))
        .order("created_at", { ascending: false })
        .limit(5000);

      if (brokenError) throw brokenError;

      return ok(buildBrokenPages(filterInternalEvents(brokenEvents ?? [], clean), range), headers);
    }

    if (action === "analytics_scan_broken_pages") {
      const range = body.range ?? 30;
      const limit = Number(body.limit || 80);
      const clean = body.clean !== false;
      return ok(await scanBrokenPages(db, range, limit, clean), headers);
    }

    if (action === "analytics_refresh_signal_os_rollups") {
      const range = body.range ?? 30;
      const clean = body.clean !== false;
      const { startDate, endDate } = dateRangeForRollups(range);

      const { data: refreshResult, error: refreshError } = await db.rpc("admin_refresh_signal_os_rollups", {
        p_start_date: startDate,
        p_end_date: endDate,
      });

      if (refreshError) throw refreshError;

      const rollupBoard = await buildSignalBoardFromRollups(db, range);
      if (rollupBoard) {
        return ok({ refresh: refreshResult, board: rollupBoard }, headers);
      }

      const events = await getAnalyticsEvents(db, range, 10000, clean);
      return ok({
        refresh: refreshResult,
        board: { ...buildSignalBoard(events, range), source: "live_events_fallback" },
      }, headers);
    }

    if (action === "analytics_realtime") {
      const clean = body.clean !== false;
      return ok(await buildRealtime(db, clean), headers);
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
