import { supabase } from "@/lib/supabase";

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

export interface RealtimeAnalyticsSnapshot {
  generatedAt: string;
  activeSessions: number;
  pageViews5m: number;
  pageViews30m: number;
  events30m: number;
  topLivePages: TopPage[];
  topReferrers: Array<{ referrer: string; count: number }>;
  eventStream: Array<{
    id: number;
    event_name: string;
    page_url: string | null;
    page_type: string | null;
    entity_slug: string | null;
    entity_type: string | null;
    session_id: string | null;
    referrer: string | null;
    created_at: string;
  }>;
  minuteSeries: Array<{ minute: string; pageViews: number }>;
}

export interface SignalBoardRowBase {
  id: string;
  score: number;
  evidence: string[];
  recommendedAction: string;
  adminUrl?: string;
  targetUrl?: string;
}

export interface SignalEntityRow extends SignalBoardRowBase {
  entityType: string;
  entitySlug: string;
  label: string;
  metric: number;
  metricLabel: string;
}

export interface SearchGapSignalRow extends SignalBoardRowBase {
  query: string;
  count: number;
  zeroResults: boolean;
}

export interface ShareVelocitySignalRow extends SignalBoardRowBase {
  label: string;
  platform: string;
  shares: number;
}

export interface JourneySignalRow extends SignalBoardRowBase {
  path: string;
  sessions: number;
}

export interface PageFixSignalRow extends SignalBoardRowBase {
  pageUrl: string;
  pageType: string;
  views: number;
}

export interface RecommendedSignalAction {
  id: string;
  priority: number;
  title: string;
  reason: string;
  evidence: string[];
  actionLabel: string;
  actionUrl: string;
}

export interface SignalBoard {
  generatedAt: string;
  range: DateRange | number;
  summary: {
    signalCount: number;
    opportunityCount: number;
    risingEntityCount: number;
    searchGapCount: number;
    pageFixCount: number;
  };
  risingEntities: SignalEntityRow[];
  searchGaps: SearchGapSignalRow[];
  shareVelocity: ShareVelocitySignalRow[];
  highIntentJourneys: JourneySignalRow[];
  pagesToFix: PageFixSignalRow[];
  recommendedActions: RecommendedSignalAction[];
}

export interface SignalOsRefreshResponse {
  refresh: Record<string, unknown>;
  board: SignalBoard;
}

interface AnalyticsSnapshot {
  today: { pageViews: number; newsletterSignups: number; uniqueSessions: number };
  kpis: AnalyticsKpis;
  timeline: TimelinePoint[];
  topPages: TopPage[];
  topEntities: TopEntity[];
  eventDistribution: EventDistribution[];
  pageTypeDistribution: PageTypeDistribution[];
  searchQueries: SearchQueryRow[];
  newsletterSources: NewsletterSource[];
  scrollDepth: ScrollDepthBucket[];
  videoEngagement: VideoStat[];
  referrerBreakdown: Array<{ referrer: string; count: number }>;
  attribution: AttributionSummary;
  funnel: FunnelStep[];
  exportRows: unknown[];
}

function rangeKey(range: DateRange | number): string {
  return typeof range === "number" ? `preset:${range}` : `custom:${range.start}:${range.end}`;
}

async function callAdminAnalytics<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-analytics-api", {
    body: { action, ...payload },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.ok) {
    throw new Error(data?.error?.message ?? "Admin analytics request failed.");
  }

  return data.data as T;
}

const snapshotCache = new Map<string, Promise<AnalyticsSnapshot>>();

async function getSnapshot(range: DateRange | number = 30): Promise<AnalyticsSnapshot> {
  const key = rangeKey(range);
  if (!snapshotCache.has(key)) {
    snapshotCache.set(key, callAdminAnalytics<AnalyticsSnapshot>("analytics_snapshot", { range }));
  }
  return snapshotCache.get(key)!;
}

export function clearAdminAnalyticsCache(): void {
  snapshotCache.clear();
}

export async function fetchRealtimeAnalytics(): Promise<RealtimeAnalyticsSnapshot> {
  return callAdminAnalytics<RealtimeAnalyticsSnapshot>("analytics_realtime");
}

export async function fetchSignalBoard(range: DateRange | number = 30): Promise<SignalBoard> {
  return callAdminAnalytics<SignalBoard>("analytics_signal_board", { range });
}

export async function refreshSignalOsRollups(range: DateRange | number = 30): Promise<SignalOsRefreshResponse> {
  return callAdminAnalytics<SignalOsRefreshResponse>("analytics_refresh_signal_os_rollups", { range });
}

export async function fetchDashboardKpis(range: DateRange | number = 30): Promise<AnalyticsKpis> {
  return (await getSnapshot(range)).kpis;
}

export async function fetchTodayKpis(): Promise<{ pageViews: number; newsletterSignups: number; uniqueSessions: number }> {
  return (await getSnapshot(1)).today;
}

export async function fetchPageViewsTimeline(range: DateRange | number = 30): Promise<TimelinePoint[]> {
  return (await getSnapshot(range)).timeline;
}

export async function fetchTopPages(range: DateRange | number = 30, limit = 20): Promise<TopPage[]> {
  return (await getSnapshot(range)).topPages.slice(0, limit);
}

export async function fetchTopEntities(range: DateRange | number = 30, limit = 20): Promise<TopEntity[]> {
  return (await getSnapshot(range)).topEntities.slice(0, limit);
}

export async function fetchEventDistribution(range: DateRange | number = 30): Promise<EventDistribution[]> {
  return (await getSnapshot(range)).eventDistribution;
}

export async function fetchPageTypeDistribution(range: DateRange | number = 30): Promise<PageTypeDistribution[]> {
  return (await getSnapshot(range)).pageTypeDistribution;
}

export async function fetchSearchQueries(range: DateRange | number = 30, limit = 20): Promise<SearchQueryRow[]> {
  return (await getSnapshot(range)).searchQueries.slice(0, limit);
}

export async function fetchNewsletterSources(range: DateRange | number = 30): Promise<NewsletterSource[]> {
  return (await getSnapshot(range)).newsletterSources;
}

export async function fetchScrollDepth(range: DateRange | number = 30): Promise<ScrollDepthBucket[]> {
  return (await getSnapshot(range)).scrollDepth;
}

export async function fetchVideoEngagement(range: DateRange | number = 30): Promise<VideoStat[]> {
  return (await getSnapshot(range)).videoEngagement;
}

export async function fetchReferrerBreakdown(range: DateRange | number = 30): Promise<Array<{ referrer: string; count: number }>> {
  return (await getSnapshot(range)).referrerBreakdown;
}

export async function fetchAttributionSummary(range: DateRange | number = 30): Promise<AttributionSummary> {
  return (await getSnapshot(range)).attribution;
}

export async function fetchConversionFunnel(range: DateRange | number = 30): Promise<FunnelStep[]> {
  return (await getSnapshot(range)).funnel;
}

export async function fetchExportEvents(range: DateRange | number = 30): Promise<unknown[]> {
  return (await getSnapshot(range)).exportRows;
}
