import { supabase } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────

export type DateRange = { start: string; end: string };

export interface AnalyticsKpis {
  totalPageViews: number;
  uniqueSessions: number;
  newsletterSignups: number;
  searchQueries: number;
  avgDailyViews: number;
  topPageType: string;
  totalVideoPlays: number;
  totalScrollEvents: number;
}

export interface TimelinePoint {
  date: string;
  [pageType: string]: string | number;
}

export interface TopPage {
  page_url: string;
  page_type: string;
  views: number;
}

export interface TopEntity {
  entity_slug: string;
  entity_type: string;
  views: number;
}

export interface EventDistribution {
  event_name: string;
  count: number;
}

export interface PageTypeDistribution {
  page_type: string;
  count: number;
}

export interface SearchQueryRow {
  query: string;
  count: number;
  zero_results: boolean;
}

export interface NewsletterSource {
  page_type: string;
  source_section: string;
  count: number;
}

export interface VideoStat {
  platform: string;
  count: number;
}

export interface ScrollDepthBucket {
  scroll_percent: number;
  count: number;
}

export interface FunnelStep {
  step: string;
  count: number;
}

export interface AttributionBreakdown {
  label: string;
  events: number;
  pageViews: number;
  signups: number;
  shareEvents: number;
  sessions: number;
  percentage: number;
}

export interface AttributionLandingPage {
  page_url: string;
  source: string;
  campaign: string;
  pageViews: number;
  sessions: number;
}

export interface ShareAttributionRow {
  platform: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  shares: number;
}

export interface AttributionSummary {
  totalEvents: number;
  totalPageViews: number;
  attributedEvents: number;
  attributedPageViews: number;
  unattributedPageViews: number;
  attributedSessions: number;
  sources: AttributionBreakdown[];
  mediums: AttributionBreakdown[];
  campaigns: AttributionBreakdown[];
  contents: AttributionBreakdown[];
  referrers: AttributionBreakdown[];
  landingPages: AttributionLandingPage[];
  shareOutbounds: ShareAttributionRow[];
}

// ── Helpers ────────────────────────────────────────────────────────

function daysAgo(days: number): string {
  if (days <= 0) return new Date(0).toISOString(); // epoch — all time
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function todayStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function rangeToSince(range: DateRange | number): string {
  if (typeof range === "number") return daysAgo(range);
  return new Date(range.start + "T00:00:00").toISOString();
}

function rangeToUntil(range: DateRange | number): string {
  if (typeof range === "number") return new Date().toISOString();
  return new Date(range.end + "T23:59:59.999").toISOString();
}

function rangeToDayCount(range: DateRange | number): number {
  if (typeof range === "number") {
    if (range <= 0) {
      // All time — use a large sentinel; caller should handle
      return 365;
    }
    return range;
  }
  const start = new Date(range.start + "T00:00:00");
  const end = new Date(range.end + "T00:00:00");
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

function rangeToDaysNumber(range: DateRange | number): number {
  if (typeof range === "number") return range;
  return 0; // sentinel for "custom range"
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

function getCurrentAttribution(row: any): {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
  referrerDomain: string;
  landingUrl: string;
} {
  const ctx = (row.context || {}) as Record<string, any>;
  const attr = (ctx.attribution || {}) as Record<string, any>;
  const current = (attr.current || {}) as Record<string, any>;
  const firstTouch = (attr.first_touch || {}) as Record<string, any>;

  return {
    source: readString(current.utm_source) || readString(firstTouch.utm_source),
    medium: readString(current.utm_medium) || readString(firstTouch.utm_medium),
    campaign: readString(current.utm_campaign) || readString(firstTouch.utm_campaign),
    content: readString(current.utm_content) || readString(firstTouch.utm_content),
    term: readString(current.utm_term) || readString(firstTouch.utm_term),
    referrerDomain:
      readString(current.referrer_domain) ||
      readString(firstTouch.referrer_domain) ||
      domainFromReferrer(row.referrer),
    landingUrl:
      readString(current.landing_url) ||
      readString(firstTouch.landing_url) ||
      readString(ctx.raw_page_url) ||
      readString(row.page_url),
  };
}

type MutableAttributionBucket = Omit<AttributionBreakdown, "sessions" | "percentage"> & {
  sessionSet: Set<string>;
};

function addAttributionBucket(
  map: Map<string, MutableAttributionBucket>,
  label: string,
  row: any,
): void {
  const cleanLabel = label || "unknown";
  const existing = map.get(cleanLabel) || {
    label: cleanLabel,
    events: 0,
    pageViews: 0,
    signups: 0,
    shareEvents: 0,
    sessionSet: new Set<string>(),
  };

  existing.events += 1;
  if (row.event_name === "page_view") existing.pageViews += 1;
  if (row.event_name === "newsletter_signup" || row.event_name === "briefing_subscribe") existing.signups += 1;
  if (row.event_name === "share_click" || row.event_name === "share_copy") existing.shareEvents += 1;
  if (row.session_id) existing.sessionSet.add(row.session_id);

  map.set(cleanLabel, existing);
}

function finalizeAttributionBuckets(
  map: Map<string, MutableAttributionBucket>,
  totalEvents: number,
  limit: number,
): AttributionBreakdown[] {
  return Array.from(map.values())
    .map((b) => ({
      label: b.label,
      events: b.events,
      pageViews: b.pageViews,
      signups: b.signups,
      shareEvents: b.shareEvents,
      sessions: b.sessionSet.size,
      percentage: totalEvents > 0 ? Math.round((b.events / totalEvents) * 100) : 0,
    }))
    .sort((a, b) => b.events - a.events)
    .slice(0, limit);
}

// ── KPI Queries ───────────────────────────────────────────────────

export async function fetchDashboardKpis(range: DateRange | number = 30): Promise<AnalyticsKpis> {
  const since = rangeToSince(range);
  const until = rangeToUntil(range);
  const dayCount = rangeToDayCount(range);
  const daysNum = rangeToDaysNumber(range);

  const [
    { count: pageViews },
    { data: sessionData },
    { count: newsletterCount },
    { count: searchCount },
    { data: dailyData },
    { count: videoCount },
    { count: scrollCount },
    { data: pageTypes },
  ] = await Promise.all([
    supabase.from("analytics_events").select("*", { count: "exact", head: true }).eq("event_name", "page_view").gte("created_at", since).lte("created_at", until),
    supabase.from("analytics_events").select("session_id").eq("event_name", "page_view").gte("created_at", since).lte("created_at", until),
    supabase.from("analytics_events").select("*", { count: "exact", head: true }).eq("event_name", "newsletter_signup").gte("created_at", since).lte("created_at", until),
    supabase.from("analytics_events").select("*", { count: "exact", head: true }).eq("event_name", "search_query").gte("created_at", since).lte("created_at", until),
    supabase.from("analytics_events").select("created_at").eq("event_name", "page_view").gte("created_at", since).lte("created_at", until).order("created_at", { ascending: true }),
    supabase.from("analytics_events").select("*", { count: "exact", head: true }).eq("event_name", "video_play").gte("created_at", since).lte("created_at", until),
    supabase.from("analytics_events").select("*", { count: "exact", head: true }).eq("event_name", "scroll_depth").gte("created_at", since).lte("created_at", until),
    supabase.from("analytics_events").select("page_type").eq("event_name", "page_view").gte("created_at", since).lte("created_at", until),
  ]);

  // Unique sessions
  const sessionSet = new Set((sessionData || []).map((r: any) => r.session_id));
  const uniqueSessions = sessionSet.size;

  // Average daily views
  const dailyCount = (dailyData || []).length > 0
    ? Math.ceil((pageViews ?? 0) / daysNum)
    : Math.ceil((pageViews ?? 0) / Math.max(daysNum, 1));

  // Top page type
  const ptCounts: Record<string, number> = {};
  (pageTypes || []).forEach((r: any) => {
    const pt = r.page_type || "unknown";
    ptCounts[pt] = (ptCounts[pt] || 0) + 1;
  });
  const topPageType = Object.entries(ptCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  return {
    totalPageViews: pageViews ?? 0,
    uniqueSessions,
    newsletterSignups: newsletterCount ?? 0,
    searchQueries: searchCount ?? 0,
    avgDailyViews: dailyCount,
    topPageType,
    totalVideoPlays: videoCount ?? 0,
    totalScrollEvents: scrollCount ?? 0,
  };
}

export async function fetchTodayKpis(): Promise<{ pageViews: number; newsletterSignups: number; uniqueSessions: number }> {
  const since = todayStart();

  const [{ count: pageViews }, { data: sessionData }, { count: newsletterCount }] = await Promise.all([
    supabase.from("analytics_events").select("*", { count: "exact", head: true }).eq("event_name", "page_view").gte("created_at", since),
    supabase.from("analytics_events").select("session_id").eq("event_name", "page_view").gte("created_at", since),
    supabase.from("analytics_events").select("*", { count: "exact", head: true }).eq("event_name", "newsletter_signup").gte("created_at", since),
  ]);

  const sessionSet = new Set((sessionData || []).map((r: any) => r.session_id));

  return {
    pageViews: pageViews ?? 0,
    newsletterSignups: newsletterCount ?? 0,
    uniqueSessions: sessionSet.size,
  };
}

// ── Timeline ──────────────────────────────────────────────────────

export async function fetchPageViewsTimeline(range: DateRange | number = 30): Promise<TimelinePoint[]> {
  const since = rangeToSince(range);
  const until = rangeToUntil(range);
  const daysNum = rangeToDaysNumber(range);

  const PAGE_TYPE_COLORS = [
    "home", "article", "artist_detail", "artist_listing", "release_detail",
    "genre_detail", "label_detail", "track_detail", "charts_edition", "charts_directory",
    "guide_detail", "guides_listing", "search", "magazine_issue", "category_detail",
    "tag_detail", "author_detail", "other",
  ];

  const { data } = await supabase
    .from("analytics_events")
    .select("created_at, page_type")
    .eq("event_name", "page_view")
    .gte("created_at", since)
    .lte("created_at", until)
    .order("created_at", { ascending: true });

  if (!data || data.length === 0) return [];

  // Determine actual date range
  let startDate: Date;
  let endDate: Date;

  if (typeof range === "number") {
    startDate = range > 0
      ? new Date(Date.now() - range * 86400000)
      : new Date(data[0].created_at);
    endDate = new Date();
  } else {
    startDate = new Date(range.start + "T00:00:00");
    endDate = new Date(range.end + "T00:00:00");
  }

  // Build date map
  const dateMap = new Map<string, Record<string, number>>();
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const ds = d.toISOString().split("T")[0];
    const entry: Record<string, number> = {};
    PAGE_TYPE_COLORS.forEach((pt) => { entry[pt] = 0; });
    entry.date = 0;
    dateMap.set(ds, entry);
  }

  for (const row of data) {
    const ds = row.created_at.split("T")[0];
    const entry = dateMap.get(ds);
    if (!entry) continue;
    const pt = PAGE_TYPE_COLORS.includes(row.page_type) ? row.page_type : "other";
    entry[pt] = (entry[pt] || 0) + 1;
  }

  return Array.from(dateMap.entries()).map(([date, counts]) => ({
    date,
    ...counts,
  }));
}

// ── Top Pages ─────────────────────────────────────────────────────

export async function fetchTopPages(range: DateRange | number = 30, limit: number = 20): Promise<TopPage[]> {
  const since = rangeToSince(range);
  const until = rangeToUntil(range);

  const { data } = await supabase
    .from("analytics_events")
    .select("page_url, page_type")
    .eq("event_name", "page_view")
    .gte("created_at", since)
    .lte("created_at", until);

  if (!data || data.length === 0) return [];

  const urlMap = new Map<string, { page_type: string; count: number }>();
  for (const row of data) {
    const key = row.page_url;
    const existing = urlMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      urlMap.set(key, { page_type: row.page_type || "unknown", count: 1 });
    }
  }

  return Array.from(urlMap.entries())
    .map(([page_url, val]) => ({ page_url, page_type: val.page_type, views: val.count }))
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
}

// ── Top Entities ──────────────────────────────────────────────────

export async function fetchTopEntities(range: DateRange | number = 30, limit: number = 20): Promise<TopEntity[]> {
  const since = rangeToSince(range);
  const until = rangeToUntil(range);

  const { data } = await supabase
    .from("analytics_events")
    .select("entity_slug, entity_type")
    .eq("event_name", "page_view")
    .gte("created_at", since)
    .lte("created_at", until)
    .not("entity_slug", "is", null)
    .not("entity_type", "is", null);

  if (!data || data.length === 0) return [];

  const entityMap = new Map<string, { entity_type: string; count: number }>();
  for (const row of data) {
    const key = `${row.entity_type}::${row.entity_slug}`;
    const existing = entityMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      entityMap.set(key, { entity_type: row.entity_type || "unknown", count: 1 });
    }
  }

  return Array.from(entityMap.entries())
    .map(([key, val]) => {
      const [entity_type, entity_slug] = key.split("::");
      return { entity_slug, entity_type, views: val.count };
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
}

// ── Event Distribution ────────────────────────────────────────────

export async function fetchEventDistribution(range: DateRange | number = 30): Promise<EventDistribution[]> {
  const since = rangeToSince(range);
  const until = rangeToUntil(range);

  const { data } = await supabase
    .from("analytics_events")
    .select("event_name")
    .gte("created_at", since)
    .lte("created_at", until);

  if (!data || data.length === 0) return [];

  const eventMap = new Map<string, number>();
  for (const row of data) {
    eventMap.set(row.event_name, (eventMap.get(row.event_name) || 0) + 1);
  }

  return Array.from(eventMap.entries())
    .map(([event_name, count]) => ({ event_name, count }))
    .sort((a, b) => b.count - a.count);
}

// ── Page Type Distribution ────────────────────────────────────────

export async function fetchPageTypeDistribution(range: DateRange | number = 30): Promise<PageTypeDistribution[]> {
  const since = rangeToSince(range);
  const until = rangeToUntil(range);

  const { data } = await supabase
    .from("analytics_events")
    .select("page_type")
    .eq("event_name", "page_view")
    .gte("created_at", since)
    .lte("created_at", until);

  if (!data || data.length === 0) return [];

  const ptMap = new Map<string, number>();
  for (const row of data) {
    const pt = row.page_type || "unknown";
    ptMap.set(pt, (ptMap.get(pt) || 0) + 1);
  }

  return Array.from(ptMap.entries())
    .map(([page_type, count]) => ({ page_type, count }))
    .sort((a, b) => b.count - a.count);
}

// ── Search Queries ────────────────────────────────────────────────

export async function fetchSearchQueries(range: DateRange | number = 30, limit: number = 20): Promise<SearchQueryRow[]> {
  const since = rangeToSince(range);
  const until = rangeToUntil(range);

  const { data } = await supabase
    .from("analytics_events")
    .select("context")
    .eq("event_name", "search_query")
    .gte("created_at", since)
    .lte("created_at", until);

  if (!data || data.length === 0) return [];

  const queryMap = new Map<string, { count: number; zero_results: boolean }>();
  for (const row of data) {
    const ctx = row.context as Record<string, any> | null;
    const q = (ctx?.search_query || "").trim().toLowerCase();
    if (!q) continue;
    const hasZeroResults = ctx?.results_count === 0;
    const existing = queryMap.get(q);
    if (existing) {
      existing.count++;
      existing.zero_results = existing.zero_results || hasZeroResults;
    } else {
      queryMap.set(q, { count: 1, zero_results: hasZeroResults });
    }
  }

  return Array.from(queryMap.entries())
    .map(([query, val]) => ({ query, count: val.count, zero_results: val.zero_results }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ── Newsletter Sources ────────────────────────────────────────────

export async function fetchNewsletterSources(range: DateRange | number = 30): Promise<NewsletterSource[]> {
  const since = rangeToSince(range);
  const until = rangeToUntil(range);

  const { data } = await supabase
    .from("analytics_events")
    .select("page_type, context")
    .eq("event_name", "newsletter_signup")
    .gte("created_at", since)
    .lte("created_at", until);

  if (!data || data.length === 0) return [];

  const sourceMap = new Map<string, NewsletterSource>();
  for (const row of data) {
    const ctx = row.context as Record<string, any> | null;
    const section = ctx?.source_section || "unknown";
    const pt = row.page_type || "unknown";
    const key = `${pt}::${section}`;
    const existing = sourceMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      sourceMap.set(key, { page_type: pt, source_section: section, count: 1 });
    }
  }

  return Array.from(sourceMap.values()).sort((a, b) => b.count - a.count);
}

// ── Video Engagement ──────────────────────────────────────────────

export async function fetchVideoEngagement(range: DateRange | number = 30): Promise<VideoStat[]> {
  const since = rangeToSince(range);
  const until = rangeToUntil(range);

  const { data } = await supabase
    .from("analytics_events")
    .select("context")
    .eq("event_name", "video_play")
    .gte("created_at", since)
    .lte("created_at", until);

  if (!data || data.length === 0) return [];

  const platMap = new Map<string, number>();
  for (const row of data) {
    const ctx = row.context as Record<string, any> | null;
    const platform = ctx?.platform || "unknown";
    platMap.set(platform, (platMap.get(platform) || 0) + 1);
  }

  return Array.from(platMap.entries())
    .map(([platform, count]) => ({ platform, count }))
    .sort((a, b) => b.count - a.count);
}

// ── Scroll Depth ──────────────────────────────────────────────────

export async function fetchScrollDepth(range: DateRange | number = 30): Promise<ScrollDepthBucket[]> {
  const since = rangeToSince(range);
  const until = rangeToUntil(range);

  const { data } = await supabase
    .from("analytics_events")
    .select("context")
    .eq("event_name", "scroll_depth")
    .gte("created_at", since)
    .lte("created_at", until);

  if (!data || data.length === 0) return [];

  const bucketMap = new Map<number, number>();
  for (const row of data) {
    const ctx = row.context as Record<string, any> | null;
    const pct = ctx?.scroll_percent;
    if (typeof pct !== "number") continue;
    bucketMap.set(pct, (bucketMap.get(pct) || 0) + 1);
  }

  return [25, 50, 75, 100].map((pct) => ({
    scroll_percent: pct,
    count: bucketMap.get(pct) || 0,
  }));
}

// ── Conversion Funnel ─────────────────────────────────────────────

export async function fetchConversionFunnel(range: DateRange | number = 30): Promise<FunnelStep[]> {
  const since = rangeToSince(range);
  const until = rangeToUntil(range);

  const [
    { data: pageViews },
    { data: scroll50 },
    { data: scroll100 },
    { data: cardClicks },
    { data: signups },
  ] = await Promise.all([
    supabase.from("analytics_events").select("session_id").eq("event_name", "page_view").gte("created_at", since).lte("created_at", until),
    supabase.from("analytics_events").select("session_id, context").eq("event_name", "scroll_depth").gte("created_at", since).lte("created_at", until),
    supabase.from("analytics_events").select("session_id, context").eq("event_name", "scroll_depth").gte("created_at", since).lte("created_at", until),
    supabase.from("analytics_events").select("session_id").eq("event_name", "card_click").gte("created_at", since).lte("created_at", until),
    supabase.from("analytics_events").select("session_id").eq("event_name", "newsletter_signup").gte("created_at", since).lte("created_at", until),
  ]);

  const pvSessions = new Set((pageViews || []).map((r: any) => r.session_id).filter(Boolean));
  const scroll50Sessions = new Set((scroll50 || []).filter((r: any) => {
    const ctx = r.context as Record<string, any> | null;
    return ctx?.scroll_percent >= 50;
  }).map((r: any) => r.session_id).filter(Boolean));
  const scroll100Sessions = new Set((scroll100 || []).filter((r: any) => {
    const ctx = r.context as Record<string, any> | null;
    return ctx?.scroll_percent >= 100;
  }).map((r: any) => r.session_id).filter(Boolean));
  const clickSessions = new Set((cardClicks || []).map((r: any) => r.session_id).filter(Boolean));
  const signupSessions = new Set((signups || []).map((r: any) => r.session_id).filter(Boolean));

  // Count sessions that have BOTH the funnel step AND a page view
  return [
    { step: "Page View", count: pvSessions.size },
    { step: "Scroll 50%", count: [...scroll50Sessions].filter((s) => pvSessions.has(s)).length },
    { step: "Scroll 100%", count: [...scroll100Sessions].filter((s) => pvSessions.has(s)).length },
    { step: "Card Click", count: [...clickSessions].filter((s) => pvSessions.has(s)).length },
    { step: "Newsletter Signup", count: [...signupSessions].filter((s) => pvSessions.has(s)).length },
  ];
}

// ── UTM / Attribution Breakdown ────────────────────────────────────

export async function fetchAttributionSummary(range: DateRange | number = 30, limit: number = 12): Promise<AttributionSummary> {
  const since = rangeToSince(range);
  const until = rangeToUntil(range);

  const { data } = await supabase
    .from("analytics_events")
    .select("event_name, page_url, page_type, context, session_id, referrer, created_at")
    .gte("created_at", since)
    .lte("created_at", until)
    .order("created_at", { ascending: false })
    .limit(10000);

  const rows = data || [];
  const totalEvents = rows.length;
  let totalPageViews = 0;
  let attributedEvents = 0;
  let attributedPageViews = 0;
  const attributedSessionSet = new Set<string>();

  const sourceMap = new Map<string, MutableAttributionBucket>();
  const mediumMap = new Map<string, MutableAttributionBucket>();
  const campaignMap = new Map<string, MutableAttributionBucket>();
  const contentMap = new Map<string, MutableAttributionBucket>();
  const referrerMap = new Map<string, MutableAttributionBucket>();

  const landingMap = new Map<string, { page_url: string; source: string; campaign: string; pageViews: number; sessionSet: Set<string> }>();
  const shareOutboundMap = new Map<string, ShareAttributionRow>();

  for (const row of rows) {
    const att = getCurrentAttribution(row);
    const isPageView = row.event_name === "page_view";
    if (isPageView) totalPageViews += 1;

    const hasUtm = Boolean(att.source || att.medium || att.campaign || att.content || att.term);

    if (hasUtm) {
      attributedEvents += 1;
      if (isPageView) attributedPageViews += 1;
      if (row.session_id) attributedSessionSet.add(row.session_id);
    }

    addAttributionBucket(sourceMap, att.source || "direct / unknown", row);
    addAttributionBucket(mediumMap, att.medium || "none / direct", row);

    if (att.campaign) addAttributionBucket(campaignMap, att.campaign, row);
    if (att.content) addAttributionBucket(contentMap, att.content, row);
    if (att.referrerDomain) addAttributionBucket(referrerMap, att.referrerDomain, row);

    if (isPageView && hasUtm) {
      const pageUrl = att.landingUrl || row.page_url || "unknown";
      const key = `${pageUrl}::${att.source || "unknown"}::${att.campaign || "none"}`;
      const existing = landingMap.get(key) || {
        page_url: pageUrl,
        source: att.source || "unknown",
        campaign: att.campaign || "none",
        pageViews: 0,
        sessionSet: new Set<string>(),
      };
      existing.pageViews += 1;
      if (row.session_id) existing.sessionSet.add(row.session_id);
      landingMap.set(key, existing);
    }

    if (row.event_name === "share_click" || row.event_name === "share_copy") {
      const ctx = (row.context || {}) as Record<string, any>;
      const outbound = (ctx.outbound_utm || {}) as Record<string, any>;
      const platform = readString(ctx.share_platform) || readString(outbound.utm_source) || "unknown";
      const source = readString(outbound.utm_source) || platform;
      const medium = readString(outbound.utm_medium) || "share";
      const campaign = readString(outbound.utm_campaign) || "unknown";
      const content = readString(outbound.utm_content) || readString(ctx.share_type) || "unknown";
      const key = `${platform}::${source}::${medium}::${campaign}::${content}`;
      const existing = shareOutboundMap.get(key) || { platform, source, medium, campaign, content, shares: 0 };
      existing.shares += 1;
      shareOutboundMap.set(key, existing);
    }
  }

  return {
    totalEvents,
    totalPageViews,
    attributedEvents,
    attributedPageViews,
    unattributedPageViews: Math.max(0, totalPageViews - attributedPageViews),
    attributedSessions: attributedSessionSet.size,
    sources: finalizeAttributionBuckets(sourceMap, totalEvents, limit),
    mediums: finalizeAttributionBuckets(mediumMap, totalEvents, limit),
    campaigns: finalizeAttributionBuckets(campaignMap, totalEvents, limit),
    contents: finalizeAttributionBuckets(contentMap, totalEvents, limit),
    referrers: finalizeAttributionBuckets(referrerMap, totalEvents, limit),
    landingPages: Array.from(landingMap.values())
      .map((r) => ({ page_url: r.page_url, source: r.source, campaign: r.campaign, pageViews: r.pageViews, sessions: r.sessionSet.size }))
      .sort((a, b) => b.pageViews - a.pageViews)
      .slice(0, limit),
    shareOutbounds: Array.from(shareOutboundMap.values())
      .sort((a, b) => b.shares - a.shares)
      .slice(0, limit),
  };
}

// ── Referrer Breakdown ────────────────────────────────────────────

export async function fetchReferrerBreakdown(range: DateRange | number = 30): Promise<Array<{ referrer: string; count: number }>> {
  const since = rangeToSince(range);
  const until = rangeToUntil(range);

  const { data } = await supabase
    .from("analytics_events")
    .select("referrer")
    .eq("event_name", "page_view")
    .gte("created_at", since)
    .lte("created_at", until)
    .not("referrer", "is", null);

  if (!data || data.length === 0) return [];

  const refMap = new Map<string, number>();
  for (const row of data) {
    let ref = row.referrer || "";
    if (!ref) continue;
    // Simplify: extract domain only
    try {
      const url = new URL(ref);
      ref = url.hostname.replace(/^www\./, "");
    } catch { /* use raw */ }
    refMap.set(ref, (refMap.get(ref) || 0) + 1);
  }

  return Array.from(refMap.entries())
    .map(([referrer, count]) => ({ referrer, count }))
    .sort((a, b) => b.count - a.count);
}

// ── Export ────────────────────────────────────────────────────────

export async function fetchExportEvents(range: DateRange | number = 30): Promise<any[]> {
  const since = rangeToSince(range);
  const until = rangeToUntil(range);

  const { data } = await supabase
    .from("analytics_events")
    .select("event_name, page_url, page_type, entity_slug, entity_type, context, session_id, referrer, created_at")
    .gte("created_at", since)
    .lte("created_at", until)
    .order("created_at", { ascending: false })
    .limit(10000);

  return data || [];
}