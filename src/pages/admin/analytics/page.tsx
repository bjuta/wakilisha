import { useEffect, useState, useMemo, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, LineChart, Line,
} from "recharts";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminChartsPageHeader } from "@/pages/admin/charts/components/AdminChartsPageHeader";
import { AdminChartsKpiCard } from "@/pages/admin/charts/components/AdminChartsKpiCard";
import { AdminChartsLoadingState } from "@/pages/admin/charts/components/AdminChartsLoadingState";
import DateRangePicker from "@/components/base/DateRangePicker";
import type { DateRangeValue } from "@/components/base/DateRangePicker";
import {
  fetchTodayKpis,
  fetchDashboardKpis,
  fetchPageViewsTimeline,
  fetchTopPages,
  fetchTopEntities,
  fetchEventDistribution,
  fetchPageTypeDistribution,
  fetchSearchQueries,
  fetchNewsletterSources,
  fetchScrollDepth,
  fetchVideoEngagement,
  fetchReferrerBreakdown,
  fetchAttributionSummary,
  fetchConversionFunnel,
  fetchExportEvents,
  fetchRealtimeAnalytics,
} from "@/services/adminAnalytics";
import type {
  AnalyticsKpis,
  TimelinePoint,
  TopPage,
  TopEntity,
  EventDistribution,
  PageTypeDistribution,
  SearchQueryRow,
  NewsletterSource,
  ScrollDepthBucket,
  VideoStat,
  FunnelStep,
  AttributionSummary,
  RealtimeAnalyticsSnapshot,
  DateRange,
} from "@/services/adminAnalytics";
import {
  getShareEventsDaily,
  getTopSharedArticles,
  getShareEventsTimeline,
} from "@/services/shareTracking";

// ── Chart colors — warm, non-blue palette ─────────────────────────

const PAGE_TYPE_COLORS: Record<string, string> = {
  home: "#D97706",
  article: "#059669",
  artist_detail: "#DC2626",
  artist_listing: "#F59E0B",
  release_detail: "#7C3AED",
  genre_detail: "#0891B2",
  label_detail: "#B45309",
  track_detail: "#BE185D",
  charts_edition: "#4F46E5",
  charts_directory: "#6366F1",
  guide_detail: "#0D9488",
  guides_listing: "#14B8A6",
  search: "#9333EA",
  magazine_issue: "#D946EF",
  category_detail: "#F97316",
  tag_detail: "#84CC16",
  author_detail: "#EC4899",
  other: "#6B7280",
};

const EVENT_COLORS = [
  "#059669", "#D97706", "#DC2626", "#7C3AED", "#B45309",
  "#0891B2", "#BE185D", "#0D9488", "#9333EA", "#F59E0B",
];

// ── Share platform colors & labels ─────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  x: "#000000",
  whatsapp: "#25D366",
  facebook: "#1877F2",
  telegram: "#26A5E4",
  linkedin: "#0A66C2",
  email: "#EA4335",
  reddit: "#FF4500",
  messenger: "#00B2FF",
  copy: "#6B7280",
  native: "#8B5CF6",
};

const PLATFORM_LABELS: Record<string, string> = {
  x: "X",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  telegram: "Telegram",
  linkedin: "LinkedIn",
  email: "Email",
  reddit: "Reddit",
  messenger: "Messenger",
  copy: "Copy Link",
  native: "Native",
};

// ── Utility helpers ────────────────────────────────────────────────

function formatPageType(pt: string): string {
  return pt.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtDate(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtDateLong(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric" });
}

function toRange(dr: DateRangeValue): DateRange | number {
  if (dr.mode === "preset") return dr.days;
  return { start: dr.start, end: dr.end };
}

function rangeLabel(dr: DateRangeValue): string {
  if (dr.mode === "preset") {
    if (dr.days === 1) return "Today";
    if (dr.days === 0) return "All Time";
    return `${dr.days}d`;
  }
  const s = new Date(dr.start + "T00:00:00");
  const e = new Date(dr.end + "T00:00:00");
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(s)} — ${fmt(e)}`;
}

function rangeDayLabel(dr: DateRangeValue): string {
  if (dr.mode === "preset") {
    if (dr.days === 0) return "All Time";
    if (dr.days === 1) return "Today";
    return `${dr.days}d`;
  }
  return "Custom Range";
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function labelize(value: string): string {
  if (!value) return "—";
  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function attributionPct(part: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

// ── Main page ─────────────────────────────────────────────────────

function getPreviousPeriod(primary: DateRangeValue): DateRangeValue {
  if (primary.mode === "preset") {
    if (primary.days === 0) return { mode: "preset", days: 0 }; // all time has no "previous"
    if (primary.days === 1) return { mode: "preset", days: 1 }; // just yesterday
    // Previous N-day period: e.g., last 7d → 7d before that
    const end = new Date(Date.now() - primary.days * 86400000);
    const start = new Date(end.getTime() - (primary.days - 1) * 86400000);
    return { mode: "custom", start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
  }
  // Custom range: compute same-length period immediately before
  const pStart = new Date(primary.start + "T00:00:00");
  const pEnd = new Date(primary.end + "T00:00:00");
  const lengthDays = Math.round((pEnd.getTime() - pStart.getTime()) / 86400000);
  const prevEnd = new Date(pStart.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - lengthDays * 86400000);
  return { mode: "custom", start: prevStart.toISOString().split("T")[0], end: prevEnd.toISOString().split("T")[0] };
}

export default function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRangeValue>({ mode: "preset", days: 30 });
  const [tab, setTab] = useState<"realtime" | "overview" | "search" | "engagement" | "attribution" | "shares" | "funnel">("realtime");

  // ── Compare periods ─────────────────────────────────────────
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [secondaryDateRange, setSecondaryDateRange] = useState<DateRangeValue>(() => getPreviousPeriod({ mode: "preset", days: 30 }));
  const [compareKpis, setCompareKpis] = useState<AnalyticsKpis | null>(null);
  const [compareTimeline, setCompareTimeline] = useState<TimelinePoint[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);

  // Data states
  const [todayKpis, setTodayKpis] = useState<{ pageViews: number; newsletterSignups: number; uniqueSessions: number } | null>(null);
  const [kpis, setKpis] = useState<AnalyticsKpis | null>(null);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [topPages, setTopPages] = useState<TopPage[]>([]);
  const [topEntities, setTopEntities] = useState<TopEntity[]>([]);
  const [eventDist, setEventDist] = useState<EventDistribution[]>([]);
  const [pageTypeDist, setPageTypeDist] = useState<PageTypeDistribution[]>([]);
  const [searchQueries, setSearchQueries] = useState<SearchQueryRow[]>([]);
  const [newsletterSources, setNewsletterSources] = useState<NewsletterSource[]>([]);
  const [scrollDepth, setScrollDepth] = useState<ScrollDepthBucket[]>([]);
  const [videoEngagement, setVideoEngagement] = useState<VideoStat[]>([]);
  const [referrerBreakdown, setReferrerBreakdown] = useState<Array<{ referrer: string; count: number }>>([]);
  const [attribution, setAttribution] = useState<AttributionSummary | null>(null);
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [exporting, setExporting] = useState(false);

  // Realtime analytics data
  const [realtime, setRealtime] = useState<RealtimeAnalyticsSnapshot | null>(null);
  const [realtimeLoading, setRealtimeLoading] = useState(false);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);

  // Share analytics data
  const [shareDailyData, setShareDailyData] = useState<Array<{ date: string; total: number; [platform: string]: number | string }>>([]);
  const [sharePlatforms, setSharePlatforms] = useState<string[]>([]);
  const [shareTopArticles, setShareTopArticles] = useState<Awaited<ReturnType<typeof getTopSharedArticles>>>([]);
  const [shareSelectedArticle, setShareSelectedArticle] = useState<string | null>(null);
  const [shareArticleTimeline, setShareArticleTimeline] = useState<Array<{ date: string; count: number }>>([]);

  // Top page types in timeline (max 6 for readability)
  const topTimelineTypes = useMemo(() => {
    const totals: Record<string, number> = {};
    timeline.forEach((t) => {
      Object.keys(t).forEach((k) => {
        if (k === "date") return;
        totals[k] = (totals[k] || 0) + (t[k] as number);
      });
    });
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([key]) => key);
  }, [timeline]);

  // Load data
  const loadData = useCallback(async (dr: DateRangeValue) => {
    setLoading(true);
    const range = toRange(dr);
    try {
        const [today, period, tl, tp, te, ed, ptd, sq, ns, sd, ve, rb, attr, f] = await Promise.all([
        fetchTodayKpis(),
        fetchDashboardKpis(range),
        fetchPageViewsTimeline(range),
        fetchTopPages(range, 20),
        fetchTopEntities(range, 20),
        fetchEventDistribution(range),
        fetchPageTypeDistribution(range),
        fetchSearchQueries(range, 20),
        fetchNewsletterSources(range),
        fetchScrollDepth(range),
        fetchVideoEngagement(range),
        fetchReferrerBreakdown(range),
        fetchAttributionSummary(range),
        fetchConversionFunnel(range),
      ]);
      setTodayKpis(today);
      setKpis(period);
      setTimeline(tl);
      setTopPages(tp);
      setTopEntities(te);
      setEventDist(ed);
      setPageTypeDist(ptd);
      setSearchQueries(sq);
      setNewsletterSources(ns);
      setScrollDepth(sd);
      setVideoEngagement(ve);
      setReferrerBreakdown(rb);
      setAttribution(attr);
      setFunnel(f);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(dateRange); }, [dateRange, loadData]);

  const loadRealtime = useCallback(async () => {
    setRealtimeLoading(true);
    setRealtimeError(null);
    try {
      setRealtime(await fetchRealtimeAnalytics());
    } catch (error) {
      setRealtimeError(error instanceof Error ? error.message : "Realtime analytics failed.");
    } finally {
      setRealtimeLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRealtime();
    const timer = window.setInterval(loadRealtime, 15000);
    return () => window.clearInterval(timer);
  }, [loadRealtime]);

  // Load comparison data when compare is toggled on or secondary range changes
  useEffect(() => {
    if (!compareEnabled) {
      setCompareKpis(null);
      setCompareTimeline([]);
      return;
    }
    let cancelled = false;
    setCompareLoading(true);
    const range = toRange(secondaryDateRange);
    Promise.all([
      fetchDashboardKpis(range),
      fetchPageViewsTimeline(range),
    ]).then(([k, tl]) => {
      if (cancelled) return;
      setCompareKpis(k);
      setCompareTimeline(tl);
    }).catch(() => {}).finally(() => {
      if (!cancelled) setCompareLoading(false);
    });
    return () => { cancelled = true; };
  }, [compareEnabled, secondaryDateRange]);

  // Load share data separately (different table)
  useEffect(() => {
    const range = toRange(dateRange);
    Promise.all([
      getShareEventsDaily(range),
      getTopSharedArticles(range, 20),
    ]).then(([daily, top]) => {
      const dateMap = new Map<string, { date: string; total: number; [platform: string]: number | string }>();
      const platSet = new Set<string>();

      for (const evt of daily) {
        platSet.add(evt.platform);
        if (!dateMap.has(evt.date)) {
          dateMap.set(evt.date, { date: evt.date, total: 0 });
        }
        const dp = dateMap.get(evt.date)!;
        dp[evt.platform] = (dp[evt.platform] as number || 0) + evt.count;
        dp.total += evt.count;
      }

      setSharePlatforms(Array.from(platSet).sort());
      setShareDailyData(Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date)));
      setShareTopArticles(top);
    }).catch(() => {});
  }, [dateRange]);

  // Load article timeline when selected
  useEffect(() => {
    if (!shareSelectedArticle) { setShareArticleTimeline([]); return; }
    const range = toRange(dateRange);
    getShareEventsTimeline(shareSelectedArticle, range).then(setShareArticleTimeline).catch(() => {});
  }, [shareSelectedArticle, dateRange]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const range = toRange(dateRange);
      const rows = await fetchExportEvents(range);
      const csv = ["event_name,page_url,page_type,entity_slug,entity_type,session_id,referrer,created_at,utm_source,utm_medium,utm_campaign,utm_content,utm_term,first_utm_source,first_utm_medium,first_utm_campaign,referrer_domain,raw_page_url,context_json"];
      rows.forEach((r: any) => {
        const ctx = (r.context || {}) as Record<string, any>;
        const attr = (ctx.attribution || {}) as Record<string, any>;
        const current = (attr.current || {}) as Record<string, any>;
        const first = (attr.first_touch || {}) as Record<string, any>;
        const cells = [
          r.event_name,
          r.page_url,
          r.page_type || "",
          r.entity_slug || "",
          r.entity_type || "",
          r.session_id || "",
          r.referrer || "",
          r.created_at,
          current.utm_source || "",
          current.utm_medium || "",
          current.utm_campaign || "",
          current.utm_content || "",
          current.utm_term || "",
          first?.utm_source || "",
          first?.utm_medium || "",
          first?.utm_campaign || "",
          current.referrer_domain || first?.referrer_domain || "",
          ctx.raw_page_url || current.landing_url || "",
          JSON.stringify(ctx),
        ];
        csv.push(cells.map(csvCell).join(","));
      });
      const blob = new Blob([csv.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const label = rangeLabel(dateRange).replace(/[^a-zA-Z0-9-]/g, "-");
      a.download = `analytics-export-${label}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ }
    setExporting(false);
  };

  const handleCompareToggle = () => {
    if (!compareEnabled) {
      setSecondaryDateRange(getPreviousPeriod(dateRange));
    }
    setCompareEnabled(!compareEnabled);
  };

  const handlePrimaryChange = (dr: DateRangeValue) => {
    setDateRange(dr);
    if (compareEnabled) {
      setSecondaryDateRange(getPreviousPeriod(dr));
    }
  };

  const calcDelta = (primary: number, secondary: number): { text: string; up: boolean } | null => {
    if (secondary === 0) return primary > 0 ? { text: "+∞", up: true } : null;
    const pct = Math.round(((primary - secondary) / secondary) * 100);
    return { text: `${pct > 0 ? "+" : ""}${pct}%`, up: pct >= 0 };
  };

  if (loading) return <AdminChartsLoadingState message="Loading analytics..." />;

  const tabButtons = [
    { key: "realtime" as const, label: "Realtime", icon: "Activity" },
    { key: "overview" as const, label: "Overview", icon: "LayoutDashboard" },
    { key: "search" as const, label: "Search", icon: "Search" },
    { key: "engagement" as const, label: "Engagement", icon: "Heart" },
    { key: "attribution" as const, label: "Attribution", icon: "BarChart3" },
    { key: "shares" as const, label: "Shares", icon: "Share2" },
    { key: "funnel" as const, label: "Funnel", icon: "GitBranch" },
  ];

  return (
    <div className="space-y-5">
      <AdminChartsPageHeader
        eyebrow="Analytics"
        title="Audience Dashboard"
        description="First-party analytics across all WAKILISHA surfaces. Page views, search behavior, engagement, and conversion funnels."
      >
        <div className="flex items-center gap-2">
          {/* Export */}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-full border border-[var(--wk-border)] px-3 py-1.5 text-[11px] font-bold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] hover:border-[var(--wk-text-faint)] transition-all whitespace-nowrap cursor-pointer"
          >
            <WkIcon name={exporting ? "Loader2" : "Download"} size={13} className={exporting ? "animate-spin" : ""} />
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
          {/* Compare toggle */}
          <button
            onClick={handleCompareToggle}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer border ${
              compareEnabled
                ? "bg-[var(--wk-brand)] text-white border-[var(--wk-brand)]"
                : "border-[var(--wk-border)] text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] hover:border-[var(--wk-text-faint)]"
            }`}
          >
            <WkIcon name="GitCompare" size={13} />
            Compare
          </button>
          {/* Primary date picker */}
          <DateRangePicker value={dateRange} onChange={handlePrimaryChange} />
        </div>
      </AdminChartsPageHeader>

      {/* Secondary comparison range — shown when compare is enabled */}
      {compareEnabled && (
        <div className="flex items-center gap-2 -mt-2">
          <span className="text-[11px] font-semibold text-[var(--wk-text-faint)] uppercase tracking-wider">vs.</span>
          <DateRangePicker
            value={secondaryDateRange}
            onChange={setSecondaryDateRange}
            compact
          />
          {compareLoading && (
            <WkIcon name="Loader2" size={13} className="animate-spin text-[var(--wk-text-muted)]" />
          )}
        </div>
      )}

      {/* Today's KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdminChartsKpiCard
          value={todayKpis?.pageViews?.toLocaleString() ?? "—"}
          label="Page Views Today"
          icon="Eye"
          accent="brand"
        />
        <AdminChartsKpiCard
          value={todayKpis?.uniqueSessions?.toLocaleString() ?? "—"}
          label="Unique Sessions Today"
          icon="Users"
          accent="muted"
        />
        <AdminChartsKpiCard
          value={todayKpis?.newsletterSignups?.toLocaleString() ?? "—"}
          label="Newsletter Signups Today"
          icon="Mail"
          accent="success"
        />
        <AdminChartsKpiCard
          value={kpis?.searchQueries?.toLocaleString() ?? "—"}
          label="Searches Today"
          icon="Search"
          accent="warning"
        />
      </div>

      {/* Period KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdminChartsKpiCard
          value={kpis?.totalPageViews?.toLocaleString() ?? "—"}
          label={`Total Page Views — ${rangeDayLabel(dateRange)}`}
          icon="BarChart3"
          accent="brand"
          compareDelta={compareEnabled && compareKpis ? calcDelta(kpis?.totalPageViews ?? 0, compareKpis.totalPageViews) : null}
        />
        <AdminChartsKpiCard
          value={kpis?.avgDailyViews?.toLocaleString() ?? "—"}
          label="Avg. Daily Views"
          icon="TrendingUp"
          accent="muted"
          compareDelta={compareEnabled && compareKpis ? calcDelta(kpis?.avgDailyViews ?? 0, compareKpis.avgDailyViews) : null}
        />
        <AdminChartsKpiCard
          value={kpis?.topPageType ? formatPageType(kpis.topPageType) : "—"}
          label="Top Page Type"
          icon="Layers"
          accent="success"
        />
        <AdminChartsKpiCard
          value={kpis?.totalVideoPlays?.toLocaleString() ?? "—"}
          label="Video Plays"
          icon="Play"
          accent="warning"
          compareDelta={compareEnabled && compareKpis ? calcDelta(kpis?.totalVideoPlays ?? 0, compareKpis.totalVideoPlays) : null}
        />
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] p-0.5 w-fit">
        {tabButtons.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-bold transition-all whitespace-nowrap cursor-pointer ${
              tab === t.key
                ? "bg-[var(--wk-brand)] text-white"
                : "text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
            }`}
          >
            <WkIcon name={t.icon as never} size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "realtime" && (
        <RealtimeTab
          data={realtime}
          loading={realtimeLoading}
          error={realtimeError}
          onRefresh={loadRealtime}
        />
      )}

      {tab === "overview" && (
        <OverviewTab
          timeline={timeline}
          topTimelineTypes={topTimelineTypes}
          topPages={topPages}
          topEntities={topEntities}
          eventDist={eventDist}
          pageTypeDist={pageTypeDist}
          compareEnabled={compareEnabled}
          compareTimeline={compareTimeline}
          compareLoading={compareLoading}
        />
      )}

      {tab === "search" && (
        <SearchTab searchQueries={searchQueries} />
      )}

      {tab === "engagement" && (
        <EngagementTab
          scrollDepth={scrollDepth}
          videoEngagement={videoEngagement}
          newsletterSources={newsletterSources}
          referrerBreakdown={referrerBreakdown}
        />
      )}

      {tab === "attribution" && (
        <AttributionTab summary={attribution} />
      )}

      {tab === "shares" && (
        <SharesTab
          shareDailyData={shareDailyData}
          sharePlatforms={sharePlatforms}
          shareTopArticles={shareTopArticles}
          shareSelectedArticle={shareSelectedArticle}
          setShareSelectedArticle={setShareSelectedArticle}
          shareArticleTimeline={shareArticleTimeline}
          dateRange={dateRange}
        />
      )}

      {tab === "funnel" && (
        <FunnelTab funnel={funnel} />
      )}

      {/* All empty state */}
      {kpis && kpis.totalPageViews === 0 && kpis.newsletterSignups === 0 && kpis.searchQueries === 0 && (
        <WkSurface className="p-10 text-center">
          <WkIcon name="BarChart3" size={36} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
          <h3 className="text-[15px] font-bold text-[var(--wk-text)] mb-1">No analytics data yet</h3>
          <p className="text-[13px] text-[var(--wk-text-muted)] max-w-md mx-auto">
            Events will start appearing here as visitors browse the site. The analytics system is live — it just needs traffic to start filling the dashboard.
          </p>
        </WkSurface>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// Realtime Tab
// ═══════════════════════════════════════════════════════════════════

function RealtimeTab({
  data,
  loading,
  error,
  onRefresh,
}: {
  data: RealtimeAnalyticsSnapshot | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const lastUpdated = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "—";

  return (
    <div className="space-y-5">
      <WkSurface className="p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--wk-brand)]/10 text-[var(--wk-brand)]">
            <WkIcon name="Activity" size={18} />
          </div>
          <div>
            <h2 className="text-[15px] font-black text-[var(--wk-text)]">Realtime Traffic</h2>
            <p className="text-[12px] text-[var(--wk-text-muted)]">
              Auto-refreshes every 15 seconds. Last updated: {lastUpdated}
            </p>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[var(--wk-border)] px-3 py-1.5 text-[11px] font-bold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] disabled:opacity-50"
          >
            <WkIcon name={loading ? "Loader2" : "RefreshCw"} size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-700">
            {error}
          </div>
        )}
      </WkSurface>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdminChartsKpiCard value={(data?.activeSessions ?? 0).toLocaleString()} label="Active Sessions — 5m" icon="Users" accent="brand" />
        <AdminChartsKpiCard value={(data?.pageViews5m ?? 0).toLocaleString()} label="Page Views — 5m" icon="Eye" accent="success" />
        <AdminChartsKpiCard value={(data?.pageViews30m ?? 0).toLocaleString()} label="Page Views — 30m" icon="BarChart3" accent="warning" />
        <AdminChartsKpiCard value={(data?.events30m ?? 0).toLocaleString()} label="Events — 30m" icon="Activity" accent="muted" />
      </div>

      <WkSurface className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <WkIcon name="TrendingUp" size={16} className="text-[var(--wk-brand)]" />
          <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Page Views Per Minute</h2>
        </div>
        {!data || data.minuteSeries.length === 0 ? (
          <EmptyChart message="No realtime page views yet." />
        ) : (
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.minuteSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--wk-border)" strokeOpacity={0.4} />
                <XAxis
                  dataKey="minute"
                  tick={{ fontSize: 10, fill: "var(--wk-text-muted)" }}
                  tickFormatter={(value) => new Date(value).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                />
                <YAxis tick={{ fontSize: 10, fill: "var(--wk-text-muted)" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid var(--wk-border)",
                    background: "var(--wk-surface)",
                    fontSize: 11,
                  }}
                  labelFormatter={(value) => new Date(String(value)).toLocaleTimeString()}
                />
                <Line type="monotone" dataKey="pageViews" stroke="var(--wk-brand)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </WkSurface>

      <div className="grid gap-5 lg:grid-cols-2">
        <WkSurface className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <WkIcon name="FileText" size={16} className="text-[var(--wk-text-muted)]" />
            <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Live Top Pages</h2>
          </div>
          {!data || data.topLivePages.length === 0 ? (
            <EmptyChart message="No live page views in the last 30 minutes." compact />
          ) : (
            <DataList
              items={data.topLivePages}
              getLabel={(p) => p.page_url}
              getValue={(p) => p.views}
              getMeta={(p) => formatPageType(p.page_type)}
              maxValue={data.topLivePages[0]?.views ?? 1}
            />
          )}
        </WkSurface>

        <WkSurface className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <WkIcon name="Globe" size={16} className="text-[var(--wk-text-muted)]" />
            <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Live Referrers</h2>
          </div>
          {!data || data.topReferrers.length === 0 ? (
            <EmptyChart message="No live referrer data yet." compact />
          ) : (
            <DataList
              items={data.topReferrers}
              getLabel={(r) => r.referrer}
              getValue={(r) => r.count}
              getMeta={() => "referrer"}
              maxValue={data.topReferrers[0]?.count ?? 1}
            />
          )}
        </WkSurface>
      </div>

      <WkSurface className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <WkIcon name="List" size={16} className="text-[var(--wk-brand)]" />
          <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Live Event Stream</h2>
        </div>
        {!data || data.eventStream.length === 0 ? (
          <EmptyChart message="No events in the last 30 minutes." compact />
        ) : (
          <div className="divide-y divide-[var(--wk-border)]">
            {data.eventStream.slice(0, 20).map((event) => (
              <div key={event.id} className="flex items-center gap-3 py-2 text-[12px]">
                <span className="w-24 shrink-0 font-mono text-[10px] text-[var(--wk-text-faint)]">
                  {new Date(event.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span className="rounded-full bg-[var(--wk-brand)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--wk-brand)]">
                  {event.event_name.replace(/_/g, " ")}
                </span>
                <span className="min-w-0 truncate text-[var(--wk-text-muted)]">
                  {event.page_url || event.entity_slug || "Unknown page"}
                </span>
              </div>
            ))}
          </div>
        )}
      </WkSurface>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// Overview Tab
// ═══════════════════════════════════════════════════════════════════

function OverviewTab({
  timeline,
  topTimelineTypes,
  topPages,
  topEntities,
  eventDist,
  pageTypeDist,
  compareEnabled,
  compareTimeline,
  compareLoading,
}: {
  timeline: TimelinePoint[];
  topTimelineTypes: string[];
  topPages: TopPage[];
  topEntities: TopEntity[];
  eventDist: EventDistribution[];
  pageTypeDist: PageTypeDistribution[];
  compareEnabled?: boolean;
  compareTimeline?: TimelinePoint[];
  compareLoading?: boolean;
}) {
  return (
    <div className="space-y-5">
      {/* Page Views Over Time */}
      <WkSurface className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <WkIcon name="TrendingUp" size={16} className="text-[var(--wk-brand)]" />
          <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Page Views Over Time</h2>
          {compareEnabled && compareTimeline && compareTimeline.length > 0 && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-semibold text-[var(--wk-text-faint)]">
              <span className="w-3 h-0.5 rounded-full bg-[var(--wk-brand)]" />
              Current
              <span className="w-3 h-0.5 rounded-full border border-dashed border-[var(--wk-text-faint)]" />
              Previous
            </span>
          )}
        </div>
        {timeline.length === 0 ? (
          <EmptyChart message="No page view data yet." />
        ) : (
          <ChartWithCompare
            timeline={timeline}
            topTimelineTypes={topTimelineTypes}
            compareEnabled={compareEnabled}
            compareTimeline={compareTimeline}
            compareLoading={compareLoading}
          />
        )}
      </WkSurface>

      {/* Two-column: Top Pages | Top Entities */}
      <div className="grid gap-5 lg:grid-cols-2">
        <WkSurface className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <WkIcon name="FileText" size={16} className="text-[var(--wk-text-muted)]" />
            <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Top Pages</h2>
          </div>
          {topPages.length === 0 ? (
            <EmptyChart message="No page view data yet." compact />
          ) : (
            <DataList
              items={topPages.slice(0, 10)}
              getLabel={(p) => p.page_url}
              getValue={(p) => p.views}
              getMeta={(p) => formatPageType(p.page_type)}
              maxValue={topPages[0]?.views ?? 1}
            />
          )}
        </WkSurface>

        <WkSurface className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <WkIcon name="Star" size={16} className="text-[var(--wk-text-muted)]" />
            <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Top Entities</h2>
          </div>
          {topEntities.length === 0 ? (
            <EmptyChart message="No entity-specific page views yet." compact />
          ) : (
            <DataList
              items={topEntities.slice(0, 10)}
              getLabel={(e) => e.entity_slug}
              getValue={(e) => e.views}
              getMeta={(e) => formatPageType(e.entity_type)}
              maxValue={topEntities[0]?.views ?? 1}
            />
          )}
        </WkSurface>
      </div>

      {/* Two-column: Event Distribution | Page Type Distribution */}
      <div className="grid gap-5 lg:grid-cols-2">
        <WkSurface className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <WkIcon name="Activity" size={16} className="text-[var(--wk-brand)]" />
            <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Event Distribution</h2>
          </div>
          {eventDist.length === 0 ? (
            <EmptyChart message="No events recorded yet." compact />
          ) : (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={eventDist}
                    dataKey="count"
                    nameKey="event_name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={2}
                    label={({ event_name, percent }) =>
                      `${event_name.replace(/_/g, " ")} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {eventDist.map((_, i) => (
                      <Cell key={i} fill={EVENT_COLORS[i % EVENT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid var(--wk-border)",
                      background: "var(--wk-surface)",
                      fontSize: 11,
                    }}
                    formatter={(value: number, name: string) => [value.toLocaleString(), name.replace(/_/g, " ")]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </WkSurface>

        <WkSurface className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <WkIcon name="Layers" size={16} className="text-[var(--wk-brand)]" />
            <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Traffic by Page Type</h2>
          </div>
          {pageTypeDist.length === 0 ? (
            <EmptyChart message="No page type data yet." compact />
          ) : (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pageTypeDist} layout="vertical" margin={{ top: 4, right: 4, left: 80, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--wk-border)" strokeOpacity={0.4} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "var(--wk-text-muted)" }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="page_type"
                    tick={{ fontSize: 10, fill: "var(--wk-text-muted)" }}
                    tickFormatter={formatPageType}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid var(--wk-border)",
                      background: "var(--wk-surface)",
                      fontSize: 11,
                    }}
                    formatter={(value: number) => [value.toLocaleString(), "Views"]}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {pageTypeDist.map((entry, i) => (
                      <Cell key={i} fill={PAGE_TYPE_COLORS[entry.page_type] || EVENT_COLORS[i % EVENT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </WkSurface>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Search Tab
// ═══════════════════════════════════════════════════════════════════

function SearchTab({ searchQueries }: { searchQueries: SearchQueryRow[] }) {
  const zeroResultCount = searchQueries.filter((q) => q.zero_results).length;
  const totalQueries = searchQueries.reduce((s, q) => s + q.count, 0);

  return (
    <div className="space-y-5">
      {/* Search KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <AdminChartsKpiCard value={searchQueries.length.toString()} label="Unique Queries" icon="Search" accent="brand" />
        <AdminChartsKpiCard value={totalQueries.toLocaleString()} label="Total Searches" icon="BarChart3" accent="muted" />
        <AdminChartsKpiCard value={zeroResultCount.toString()} label="Zero-Result Queries" icon="AlertCircle" accent="danger" />
      </div>

      {/* Top Queries Table */}
      <WkSurface className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <WkIcon name="Search" size={16} className="text-[var(--wk-brand)]" />
          <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Top Search Queries</h2>
        </div>
        {searchQueries.length === 0 ? (
          <EmptyChart message="No search data recorded yet." compact />
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--wk-border)]">
                <th className="pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)] w-8">#</th>
                <th className="pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">Query</th>
                <th className="pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)] text-right w-20">Count</th>
                <th className="pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)] text-right w-24">Status</th>
              </tr>
            </thead>
            <tbody>
              {searchQueries.slice(0, 15).map((q, i) => (
                <tr key={q.query} className="border-b border-[var(--wk-border)]">
                  <td className="py-2.5 text-[12px] font-bold text-[var(--wk-text-muted)]">{i + 1}</td>
                  <td className="py-2.5 text-[13px] font-semibold text-[var(--wk-text)]">{q.query}</td>
                  <td className="py-2.5 text-right text-[13px] font-bold text-[var(--wk-text)]">{q.count}</td>
                  <td className="py-2.5 text-right">
                    {q.zero_results ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-danger)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--wk-danger)]">
                        No results
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-success)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--wk-success)]">
                        Has results
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </WkSurface>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Engagement Tab
// ═══════════════════════════════════════════════════════════════════

function EngagementTab({
  scrollDepth,
  videoEngagement,
  newsletterSources,
  referrerBreakdown,
}: {
  scrollDepth: ScrollDepthBucket[];
  videoEngagement: VideoStat[];
  newsletterSources: NewsletterSource[];
  referrerBreakdown: Array<{ referrer: string; count: number }>;
}) {
  const totalScroll = scrollDepth.reduce((s, b) => s + b.count, 0);
  const totalVideo = videoEngagement.reduce((s, v) => s + v.count, 0);
  const totalNewsletter = newsletterSources.reduce((s, n) => s + n.count, 0);

  return (
    <div className="space-y-5">
      {/* Scroll depth */}
      <WkSurface className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <WkIcon name="MoveDown" size={16} className="text-[var(--wk-brand)]" />
          <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Scroll Depth Distribution</h2>
        </div>
        {scrollDepth.length === 0 ? (
          <EmptyChart message="No scroll data yet." compact />
        ) : (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scrollDepth} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--wk-border)" strokeOpacity={0.4} />
                <XAxis
                  dataKey="scroll_percent"
                  tick={{ fontSize: 10, fill: "var(--wk-text-muted)" }}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <YAxis tick={{ fontSize: 10, fill: "var(--wk-text-muted)" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid var(--wk-border)",
                    background: "var(--wk-surface)",
                    fontSize: 11,
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#059669" name="Sessions">
                  {scrollDepth.map((_, i) => (
                    <Cell key={i} fill={["#D97706", "#059669", "#0891B2", "#7C3AED"][i] || "#059669"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {totalScroll > 0 && (
          <div className="mt-3 flex gap-3 text-[11px] text-[var(--wk-text-muted)]">
            {scrollDepth.map((b) => (
              <span key={b.scroll_percent}>
                {b.scroll_percent}%: <strong className="text-[var(--wk-text)]">{b.count}</strong>
              </span>
            ))}
          </div>
        )}
      </WkSurface>

      {/* Two-column: Video | Newsletter */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Video Engagement */}
        <WkSurface className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <WkIcon name="Play" size={16} className="text-[var(--wk-text-muted)]" />
            <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Video Plays by Platform</h2>
          </div>
          {videoEngagement.length === 0 ? (
            <EmptyChart message="No video play data yet." compact />
          ) : (
            <div>
              <DataList
                items={videoEngagement}
                getLabel={(v) => v.platform}
                getValue={(v) => v.count}
                maxValue={videoEngagement[0]?.count ?? 1}
              />
              <div className="mt-3 pt-3 border-t border-[var(--wk-border)] text-[11px] text-[var(--wk-text-muted)]">
                Total: <strong className="text-[var(--wk-text)]">{totalVideo.toLocaleString()}</strong> plays
              </div>
            </div>
          )}
        </WkSurface>

        {/* Newsletter Sources */}
        <WkSurface className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <WkIcon name="Mail" size={16} className="text-[var(--wk-text-muted)]" />
            <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Newsletter Signup Sources</h2>
          </div>
          {newsletterSources.length === 0 ? (
            <EmptyChart message="No newsletter signup data yet." compact />
          ) : (
            <div>
              {newsletterSources.slice(0, 8).map((ns) => (
                <div key={`${ns.page_type}::${ns.source_section}`} className="flex items-center justify-between py-2 border-b border-[var(--wk-border)] last:border-b-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[12px] font-semibold text-[var(--wk-text)] truncate">
                      {formatPageType(ns.page_type)}
                    </span>
                    <span className="text-[10px] text-[var(--wk-text-faint)]">· {ns.source_section}</span>
                  </div>
                  <span className="text-[13px] font-bold text-[var(--wk-text)] shrink-0">{ns.count}</span>
                </div>
              ))}
              {totalNewsletter > 0 && (
                <div className="mt-3 pt-3 border-t border-[var(--wk-border)] text-[11px] text-[var(--wk-text-muted)]">
                  Total: <strong className="text-[var(--wk-text)]">{totalNewsletter.toLocaleString()}</strong> signups
                </div>
              )}
            </div>
          )}
        </WkSurface>
      </div>

      {/* Referrer Breakdown */}
      <WkSurface className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <WkIcon name="Link" size={16} className="text-[var(--wk-text-muted)]" />
          <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Top Referrers</h2>
        </div>
        {referrerBreakdown.length === 0 ? (
          <EmptyChart message="No referrer data yet (all direct traffic)." compact />
        ) : (
          <DataList
            items={referrerBreakdown.slice(0, 10)}
            getLabel={(r) => r.referrer || "Direct"}
            getValue={(r) => r.count}
            maxValue={referrerBreakdown[0]?.count ?? 1}
          />
        )}
      </WkSurface>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Funnel Tab
// ═══════════════════════════════════════════════════════════════════

function FunnelTab({ funnel }: { funnel: FunnelStep[] }) {
  const maxCount = funnel[0]?.count ?? 1;

  return (
    <div className="space-y-5">
      <WkSurface className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <WkIcon name="GitBranch" size={16} className="text-[var(--wk-brand)]" />
          <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Conversion Funnel</h2>
          <span className="text-[11px] text-[var(--wk-text-faint)]">(session-level)</span>
        </div>
        {funnel.length === 0 ? (
          <EmptyChart message="No funnel data available yet." compact />
        ) : (
          <div className="space-y-2 max-w-xl">
            {funnel.map((step, i) => {
              const pct = maxCount > 0 ? Math.round((step.count / maxCount) * 100) : 0;
              const prevCount = i > 0 ? funnel[i - 1].count : step.count;
              const dropPct = prevCount > 0 ? Math.round(((prevCount - step.count) / prevCount) * 100) : 0;

              return (
                <div key={step.step} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--wk-surface-raised)] border border-[var(--wk-border)] flex items-center justify-center text-[11px] font-bold text-[var(--wk-text-muted)] shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] font-semibold text-[var(--wk-text)]">{step.step}</span>
                      <span className="text-[13px] font-bold text-[var(--wk-text)]">{step.count.toLocaleString()}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--wk-bg-subtle)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--wk-brand)] transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {i > 0 && (
                      <div className="mt-0.5 text-[10px] text-[var(--wk-text-faint)]">
                        {dropPct}% drop from previous step
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </WkSurface>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Attribution Tab
// ═══════════════════════════════════════════════════════════════════

function AttributionTab({ summary }: { summary: AttributionSummary | null }) {
  if (!summary) {
    return (
      <WkSurface className="p-10 text-center">
        <WkIcon name="BarChart3" size={28} className="mx-auto mb-3 text-[var(--wk-text-faint)]" />
        <p className="text-[12px] text-[var(--wk-text-muted)]">No attribution data loaded yet.</p>
      </WkSurface>
    );
  }

  const attributedRate = attributionPct(summary.attributedPageViews, summary.totalPageViews);
  const topSource = summary.sources.find((s) => s.label !== "direct / unknown") || summary.sources[0];
  const topCampaign = summary.campaigns[0];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdminChartsKpiCard
          value={summary.attributedPageViews.toLocaleString()}
          label={`Attributed Page Views (${attributedRate})`}
          icon="BarChart3"
          accent="brand"
        />
        <AdminChartsKpiCard
          value={summary.attributedSessions.toLocaleString()}
          label="Attributed Sessions"
          icon="Users"
          accent="muted"
        />
        <AdminChartsKpiCard
          value={topSource ? labelize(topSource.label) : "—"}
          label="Top Source"
          icon="Share2"
          accent="success"
        />
        <AdminChartsKpiCard
          value={topCampaign ? labelize(topCampaign.label) : "—"}
          label="Top Campaign"
          icon="TrendingUp"
          accent="warning"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <WkSurface className="p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <WkIcon name="Share2" size={16} className="text-[var(--wk-brand)]" />
              <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Traffic Sources</h2>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
              Events
            </span>
          </div>
          {summary.sources.length === 0 ? (
            <EmptyChart message="No source attribution yet." compact />
          ) : (
            <DataList
              items={summary.sources}
              getLabel={(r) => labelize(r.label)}
              getMeta={(r) => `${r.sessions} sessions · ${r.pageViews} page views · ${r.percentage}%`}
              getValue={(r) => r.events}
              maxValue={summary.sources[0]?.events ?? 1}
            />
          )}
        </WkSurface>

        <WkSurface className="p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <WkIcon name="Layers" size={16} className="text-[var(--wk-brand)]" />
              <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Mediums</h2>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
              Events
            </span>
          </div>
          {summary.mediums.length === 0 ? (
            <EmptyChart message="No medium attribution yet." compact />
          ) : (
            <DataList
              items={summary.mediums}
              getLabel={(r) => labelize(r.label)}
              getMeta={(r) => `${r.sessions} sessions · ${r.pageViews} page views · ${r.percentage}%`}
              getValue={(r) => r.events}
              maxValue={summary.mediums[0]?.events ?? 1}
            />
          )}
        </WkSurface>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <WkSurface className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <WkIcon name="TrendingUp" size={16} className="text-[var(--wk-brand)]" />
            <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Campaigns</h2>
          </div>
          {summary.campaigns.length === 0 ? (
            <EmptyChart message="No UTM campaigns captured yet. New shared links will populate this." compact />
          ) : (
            <DataList
              items={summary.campaigns}
              getLabel={(r) => labelize(r.label)}
              getMeta={(r) => `${r.sessions} sessions · ${r.pageViews} page views`}
              getValue={(r) => r.events}
              maxValue={summary.campaigns[0]?.events ?? 1}
            />
          )}
        </WkSurface>

        <WkSurface className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <WkIcon name="FileText" size={16} className="text-[var(--wk-brand)]" />
            <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Content Tags</h2>
          </div>
          {summary.contents.length === 0 ? (
            <EmptyChart message="No UTM content values captured yet." compact />
          ) : (
            <DataList
              items={summary.contents}
              getLabel={(r) => labelize(r.label)}
              getMeta={(r) => `${r.sessions} sessions · ${r.pageViews} page views`}
              getValue={(r) => r.events}
              maxValue={summary.contents[0]?.events ?? 1}
            />
          )}
        </WkSurface>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
        <WkSurface className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <WkIcon name="Link" size={16} className="text-[var(--wk-brand)]" />
            <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Attributed Landing Pages</h2>
          </div>
          {summary.landingPages.length === 0 ? (
            <EmptyChart message="No attributed landing page views yet." compact />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--wk-border)]">
                    <th className="pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">Landing page</th>
                    <th className="pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">Source</th>
                    <th className="pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">Campaign</th>
                    <th className="pb-2 text-right text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">Views</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.landingPages.map((row) => (
                    <tr key={`${row.page_url}-${row.source}-${row.campaign}`} className="border-b border-[var(--wk-border)]">
                      <td className="py-2.5 text-[12px] font-semibold text-[var(--wk-text)] max-w-[360px] truncate">{row.page_url}</td>
                      <td className="py-2.5 text-[12px] text-[var(--wk-text-muted)]">{labelize(row.source)}</td>
                      <td className="py-2.5 text-[12px] text-[var(--wk-text-muted)]">{labelize(row.campaign)}</td>
                      <td className="py-2.5 text-right text-[13px] font-bold text-[var(--wk-text)]">{row.pageViews.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </WkSurface>

        <WkSurface className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <WkIcon name="Globe" size={16} className="text-[var(--wk-brand)]" />
            <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Referrer Domains</h2>
          </div>
          {summary.referrers.length === 0 ? (
            <EmptyChart message="No referrer domains captured yet." compact />
          ) : (
            <DataList
              items={summary.referrers}
              getLabel={(r) => r.label}
              getMeta={(r) => `${r.sessions} sessions · ${r.pageViews} page views`}
              getValue={(r) => r.events}
              maxValue={summary.referrers[0]?.events ?? 1}
            />
          )}
        </WkSurface>
      </div>

      <WkSurface className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <WkIcon name="Share2" size={16} className="text-[var(--wk-brand)]" />
          <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Outbound Share UTMs</h2>
        </div>
        {summary.shareOutbounds.length === 0 ? (
          <EmptyChart message="No outbound share UTM events captured yet. Use the share sheet after the UTM patch is live." compact />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--wk-border)]">
                  <th className="pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">Platform</th>
                  <th className="pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">Source</th>
                  <th className="pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">Medium</th>
                  <th className="pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">Campaign</th>
                  <th className="pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">Content</th>
                  <th className="pb-2 text-right text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">Shares</th>
                </tr>
              </thead>
              <tbody>
                {summary.shareOutbounds.map((row) => (
                  <tr key={`${row.platform}-${row.source}-${row.campaign}-${row.content}`} className="border-b border-[var(--wk-border)]">
                    <td className="py-2.5 text-[12px] font-bold text-[var(--wk-text)]">{PLATFORM_LABELS[row.platform] || labelize(row.platform)}</td>
                    <td className="py-2.5 text-[12px] text-[var(--wk-text-muted)]">{row.source}</td>
                    <td className="py-2.5 text-[12px] text-[var(--wk-text-muted)]">{row.medium}</td>
                    <td className="py-2.5 text-[12px] text-[var(--wk-text-muted)]">{row.campaign}</td>
                    <td className="py-2.5 text-[12px] text-[var(--wk-text-muted)]">{labelize(row.content)}</td>
                    <td className="py-2.5 text-right text-[13px] font-bold text-[var(--wk-text)]">{row.shares.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </WkSurface>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Shares Tab
// ═══════════════════════════════════════════════════════════════════

function SharesTab({
  shareDailyData,
  sharePlatforms,
  shareTopArticles,
  shareSelectedArticle,
  setShareSelectedArticle,
  shareArticleTimeline,
  dateRange,
}: {
  shareDailyData: Array<{ date: string; total: number; [platform: string]: number | string }>;
  sharePlatforms: string[];
  shareTopArticles: Array<{ article_slug: string; article_title: string; total_shares: number }>;
  shareSelectedArticle: string | null;
  setShareSelectedArticle: (slug: string | null) => void;
  shareArticleTimeline: Array<{ date: string; count: number }>;
  dateRange: DateRangeValue;
}) {
  const totalShares = useMemo(() => shareDailyData.reduce((s, d) => s + d.total, 0), [shareDailyData]);
  const uniqueArticles = useMemo(() => new Set(shareTopArticles.map((a) => a.article_slug)).size, [shareTopArticles]);
  const topPlatform = useMemo(() => {
    if (sharePlatforms.length === 0) return null;
    return sharePlatforms.reduce((best, p) => {
      const total = shareDailyData.reduce((s, d) => s + (d[p] as number || 0), 0);
      return total > (shareDailyData.reduce((s2, d2) => s2 + (d2[best] as number || 0), 0)) ? p : best;
    }, sharePlatforms[0]);
  }, [shareDailyData, sharePlatforms]);
  const avgDaily = useMemo(() => {
    if (shareDailyData.length === 0) return 0;
    // All time: compute from actual date range
    const firstDate = new Date(shareDailyData[0].date);
    const lastDate = new Date(shareDailyData[shareDailyData.length - 1].date);
    const rangeDays = Math.max(1, Math.round((lastDate.getTime() - firstDate.getTime()) / 86400000) + 1);
    return Math.round(totalShares / rangeDays);
  }, [shareDailyData, totalShares]);

  // Fill in missing dates for timeline
  const filledTimeline = useMemo(() => {
    if (shareArticleTimeline.length === 0) return [];
    const dateSet = new Map(shareArticleTimeline.map((d) => [d.date, d.count]));
    const result: Array<{ date: string; count: number }> = [];
    const start = new Date(shareArticleTimeline[0].date);
    for (let d = new Date(start); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().split("T")[0];
      result.push({ date: ds, count: dateSet.get(ds) || 0 });
    }
    return result;
  }, [shareArticleTimeline]);

  const topArticleMaxShares = shareTopArticles[0]?.total_shares ?? 1;

  return (
    <div className="space-y-5">
      {/* Share KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdminChartsKpiCard value={totalShares.toLocaleString()} label="Total Shares" icon="Share2" accent="brand" />
        <AdminChartsKpiCard value={uniqueArticles.toString()} label="Articles Shared" icon="FileText" accent="muted" />
        <AdminChartsKpiCard value={topPlatform ? PLATFORM_LABELS[topPlatform] || topPlatform : "—"} label="Top Platform" icon="BarChart3" accent="success" />
        <AdminChartsKpiCard value={avgDaily.toLocaleString()} label="Avg. Daily Shares" icon="TrendingUp" accent="warning" />
      </div>

      {/* Daily Share Trends Chart */}
      <WkSurface className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <WkIcon name="BarChart3" size={16} className="text-[var(--wk-brand)]" />
          <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Daily Share Trends</h2>
        </div>

        {shareDailyData.length === 0 ? (
          <EmptyChart message="No share data yet for this period. Shares will appear here as readers engage with articles." compact />
        ) : (
          <>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={shareDailyData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--wk-border)" strokeOpacity={0.5} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "var(--wk-text-muted)" }}
                    tickFormatter={fmtDate}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 10, fill: "var(--wk-text-muted)" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--wk-border)",
                      background: "var(--wk-surface)",
                      fontSize: 12,
                      fontFamily: "var(--wk-font-ui)",
                    }}
                    formatter={(value: number, name: string) => [value, PLATFORM_LABELS[name] || name]}
                    labelFormatter={fmtDateLong}
                  />
                  {sharePlatforms.map((platform) => (
                    <Bar
                      key={platform}
                      dataKey={platform}
                      stackId="shares"
                      fill={PLATFORM_COLORS[platform] || "#6B7280"}
                      radius={platform === sharePlatforms[sharePlatforms.length - 1] ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            {sharePlatforms.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-[var(--wk-border)]">
                {sharePlatforms.map((p) => (
                  <div key={p} className="flex items-center gap-1.5 text-[11px] text-[var(--wk-text-muted)]">
                    <span className="w-3 h-3 rounded-sm" style={{ background: PLATFORM_COLORS[p] || "#6B7280" }} />
                    {PLATFORM_LABELS[p] || p}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </WkSurface>

      {/* Two-column: top articles + article detail */}
      <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
        {/* Top Articles Table */}
        <WkSurface className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <WkIcon name="FileText" size={16} className="text-[var(--wk-text-muted)]" />
            <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Top Shared Articles</h2>
          </div>

          {shareTopArticles.length === 0 ? (
            <EmptyChart message="No article share data available yet." compact />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--wk-border)]">
                    <th className="pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)] w-8">#</th>
                    <th className="pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">Article</th>
                    <th className="pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)] text-right w-20">Shares</th>
                    <th className="pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)] text-right w-28">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {shareTopArticles.map((article, i) => (
                    <tr
                      key={article.article_slug}
                      className={`border-b border-[var(--wk-border)] transition-colors cursor-pointer hover:bg-[var(--wk-bg-subtle)] ${
                        shareSelectedArticle === article.article_slug ? "bg-[var(--wk-brand-soft)]" : ""
                      }`}
                      onClick={() => setShareSelectedArticle(
                        shareSelectedArticle === article.article_slug ? null : article.article_slug
                      )}
                    >
                      <td className="py-2.5 text-[12px] font-bold text-[var(--wk-text-muted)]">{i + 1}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-[var(--wk-text)] truncate max-w-[320px]">
                            {article.article_title}
                          </span>
                          <a
                            href={`/magazine/${article.article_slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-[var(--wk-text-faint)] hover:text-[var(--wk-brand)] transition-colors"
                            onClick={(e) => e.stopPropagation()}
                            title="View article"
                          >
                            <i className="ri-external-link-line text-[13px]" />
                          </a>
                        </div>
                      </td>
                      <td className="py-2.5 text-right">
                        <span className="text-[13px] font-bold text-[var(--wk-text)]">
                          {article.total_shares.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <div className="h-1.5 flex-1 max-w-[80px] rounded-full bg-[var(--wk-bg-subtle)] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[var(--wk-brand)] transition-all"
                              style={{ width: `${Math.min(100, (article.total_shares / topArticleMaxShares) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </WkSurface>

        {/* Article Detail Panel */}
        <WkSurface className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <WkIcon name="ZoomIn" size={16} className="text-[var(--wk-brand)]" />
            <h2 className="text-[14px] font-bold text-[var(--wk-text)]">
              {shareSelectedArticle ? "Article Timeline" : "Select an Article"}
            </h2>
          </div>

          {!shareSelectedArticle ? (
            <div className="py-16 text-center">
              <WkIcon name="MousePointerClick" size={24} className="mx-auto mb-3 text-[var(--wk-text-faint)]" />
              <p className="text-[12px] text-[var(--wk-text-muted)]">
                Click an article from the table to view its daily share trend.
              </p>
            </div>
          ) : filledTimeline.length === 0 ? (
            <div className="py-10 text-center">
              <WkIcon name="Loader2" size={20} className="mx-auto mb-2 text-[var(--wk-text-faint)] animate-spin" />
              <p className="text-[12px] text-[var(--wk-text-muted)]">Loading timeline...</p>
            </div>
          ) : (
            <>
              <div className="mb-3">
                <a
                  href={`/magazine/${shareSelectedArticle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] font-semibold text-[var(--wk-brand)] hover:underline inline-flex items-center gap-1"
                >
                  {shareSelectedArticle.replace(/-/g, " ")}
                  <i className="ri-external-link-line text-[12px]" />
                </a>
              </div>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filledTimeline} margin={{ top: 4, right: 4, left: -16, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--wk-border)" strokeOpacity={0.4} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9, fill: "var(--wk-text-muted)" }}
                      tickFormatter={fmtDate}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 9, fill: "var(--wk-text-muted)" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid var(--wk-border)",
                        background: "var(--wk-surface)",
                        fontSize: 11,
                        fontFamily: "var(--wk-font-ui)",
                      }}
                      labelFormatter={fmtDateLong}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="var(--wk-brand)"
                      strokeWidth={2}
                      dot={{ r: 2, fill: "var(--wk-brand)" }}
                      activeDot={{ r: 4, fill: "var(--wk-brand)" }}
                      name="Shares"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 pt-3 border-t border-[var(--wk-border)] flex items-center justify-between text-[11px]">
                <span className="text-[var(--wk-text-muted)]">
                  Total: <strong className="text-[var(--wk-text)]">
                    {filledTimeline.reduce((s, d) => s + d.count, 0).toLocaleString()}
                  </strong> shares
                </span>
                <button
                  onClick={() => setShareSelectedArticle(null)}
                  className="text-[var(--wk-brand)] font-semibold hover:underline cursor-pointer"
                >
                  Clear selection
                </button>
              </div>
            </>
          )}
        </WkSurface>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Shared sub-components
// ═══════════════════════════════════════════════════════════════════

function EmptyChart({ message, compact }: { message: string; compact?: boolean }) {
  return (
    <div className={`text-center ${compact ? "py-10" : "py-16"}`}>
      <WkIcon name="BarChart3" size={compact ? 24 : 28} className="mx-auto mb-3 text-[var(--wk-text-faint)]" />
      <p className="text-[12px] text-[var(--wk-text-muted)]">{message}</p>
    </div>
  );
}

function DataList<T>({
  items,
  getLabel,
  getValue,
  getMeta,
  maxValue,
}: {
  items: T[];
  getLabel: (item: T) => string;
  getValue: (item: T) => number;
  getMeta?: (item: T) => string;
  maxValue: number;
}) {
  return (
    <div className="space-y-1">
      {items.map((item, i) => {
        const pct = maxValue > 0 ? Math.round((getValue(item) / maxValue) * 100) : 0;
        return (
          <div key={i} className="flex items-center gap-3 group">
            <span className="w-5 text-right text-[10px] font-bold text-[var(--wk-text-faint)]">{i + 1}</span>
            <div className="flex-1 min-w-0 flex items-center justify-between py-1.5">
              <div className="min-w-0 flex-1 mr-3">
                <span className="text-[12px] font-semibold text-[var(--wk-text)] truncate block">
                  {getLabel(item)}
                </span>
                {getMeta && (
                  <span className="text-[10px] text-[var(--wk-text-faint)]">{getMeta(item)}</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-1 w-16 rounded-full bg-[var(--wk-bg-subtle)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--wk-brand)]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-12 text-right text-[12px] font-bold text-[var(--wk-text)]">
                  {getValue(item).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ChartWithCompare — overlays comparison period on timeline chart
// ═══════════════════════════════════════════════════════════════════

function ChartWithCompare({
  timeline,
  topTimelineTypes,
  compareEnabled,
  compareTimeline,
  compareLoading,
}: {
  timeline: TimelinePoint[];
  topTimelineTypes: string[];
  compareEnabled?: boolean;
  compareTimeline?: TimelinePoint[];
  compareLoading?: boolean;
}) {
  // Merge primary and comparison timelines into one dataset
  const mergedData = useMemo(() => {
    if (!compareEnabled || !compareTimeline || compareTimeline.length === 0) return timeline;

    const dateMap = new Map<string, Record<string, number>>();

    // Primary data
    for (const point of timeline) {
      const entry: Record<string, number> = {};
      topTimelineTypes.forEach((pt) => { entry[pt] = (point[pt] as number) || 0; });
      entry.__primaryTotal = Object.values(entry).reduce((s, v) => s + v, 0);
      dateMap.set(point.date, entry);
    }

    // Comparison data — prefix keys with "prev_"
    for (const point of compareTimeline) {
      const existing = dateMap.get(point.date) || {};
      topTimelineTypes.forEach((pt) => {
        existing[`prev_${pt}`] = (point[pt] as number) || 0;
      });
      existing.__compareTotal = topTimelineTypes.reduce((s, pt) => s + ((point[pt] as number) || 0), 0);
      dateMap.set(point.date, existing);
    }

    // Fill zeros for missing keys
    const result: Array<Record<string, number | string>> = [];
    for (const [date, values] of dateMap) {
      topTimelineTypes.forEach((pt) => {
        if (!(pt in values)) values[pt] = 0;
        if (!(`prev_${pt}` in values)) values[`prev_${pt}`] = 0;
      });
      result.push({ date, ...values });
    }

    return result.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [timeline, compareTimeline, topTimelineTypes, compareEnabled]);

  if (mergedData.length === 0) return <EmptyChart message="No page view data yet." />;

  return (
    <div className="h-[340px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={mergedData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--wk-border)" strokeOpacity={0.4} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "var(--wk-text-muted)" }}
            tickFormatter={fmtDate}
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 10, fill: "var(--wk-text-muted)" }} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              borderRadius: 10,
              border: "1px solid var(--wk-border)",
              background: "var(--wk-surface)",
              fontSize: 11,
              fontFamily: "var(--wk-font-ui)",
            }}
            labelFormatter={fmtDateLong}
            formatter={(value: number, name: string) => {
              const isPrev = name.startsWith("prev_");
              const cleanName = isPrev ? name.replace("prev_", "") : name;
              return [value, `${isPrev ? "(prev) " : ""}${formatPageType(cleanName)}`];
            }}
          />
          <Legend
            formatter={(value: string) => {
              const isPrev = value.startsWith("prev_");
              return <span className="text-[11px] text-[var(--wk-text-muted)]">
                {isPrev ? "(prev) " : ""}{formatPageType(value.replace("prev_", ""))}
              </span>;
            }}
          />

          {/* Primary areas — solid, normal opacity */}
          {topTimelineTypes.map((pt, i) => (
            <Area
              key={pt}
              type="monotone"
              dataKey={pt}
              stackId="primary"
              stroke={PAGE_TYPE_COLORS[pt] || EVENT_COLORS[i % EVENT_COLORS.length]}
              fill={PAGE_TYPE_COLORS[pt] || EVENT_COLORS[i % EVENT_COLORS.length]}
              fillOpacity={0.18}
              strokeWidth={1.5}
            />
          ))}

          {/* Comparison areas — dashed, lighter */}
          {compareEnabled && compareTimeline && compareTimeline.length > 0 &&
            topTimelineTypes.map((pt, i) => (
              <Area
                key={`prev_${pt}`}
                type="monotone"
                dataKey={`prev_${pt}`}
                stackId="compare"
                stroke={PAGE_TYPE_COLORS[pt] || EVENT_COLORS[i % EVENT_COLORS.length]}
                fill={PAGE_TYPE_COLORS[pt] || EVENT_COLORS[i % EVENT_COLORS.length]}
                fillOpacity={0.06}
                strokeWidth={1}
                strokeDasharray="4 3"
              />
            ))
          }
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}