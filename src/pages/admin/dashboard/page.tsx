import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  DASHBOARD_KPIS,
  ATTENTION_ITEMS,
  RECENT_ACTIVITY,
  QUICK_ACTIONS,
  SYSTEM_HEALTH,
  OPERATIONAL_COUNTS,
} from "@/mocks/adminDashboard";
import type { DashboardKpi, AttentionItem, RecentActivityItem, QuickAction, SystemHealthItem } from "@/mocks/adminDashboard";
import { supabase } from "@/lib/supabase";

const KPI_TO_TABLE: Record<string, string> = {
  Articles: "wk_articles",
  Guides: "wk_guides",
  Pages: "wk_pages",
  Artists: "registry_artists",
  Tracks: "registry_tracks",
  Releases: "registry_releases",
  Labels: "registry_labels",
  Genres: "registry_genres",
  "Chart Families": "chart_series",
  "Chart Editions": "chart_editions",
  "Chart Entries": "chart_entries",
  "Media Assets": "wk_media_assets",
  "Import Jobs": "wk_ingestion_runs",
  "Review Queue": "wk_review_queue",
};

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [realCounts, setRealCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCounts() {
      const tables = [
        "registry_artists",
        "registry_tracks",
        "registry_releases",
        "registry_labels",
        "registry_genres",
        "wk_articles",
        "wk_guides",
        "wk_media_assets",
        "wk_ingestion_runs",
        "chart_editions",
        "chart_entries",
      ];
      const counts: Record<string, number> = {};
      for (const table of tables) {
        const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
        counts[table] = count ?? 0;
      }
      setRealCounts(counts);
      setLoading(false);
    }
    loadCounts();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">
            Production Engine
          </div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Dashboard</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            Command center for WAKILISHA operations. What needs attention today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/admin/settings/charts/ingest")}
            className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
          >
            <WkIcon name="Plus" size={14} />
            New Ingest
          </button>
          <button
            onClick={() => navigate("/admin/settings/charts/ingest-health")}
            className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
          >
            <WkIcon name="HeartPulse" size={14} />
            Health
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {DASHBOARD_KPIS.map((kpi) => (
          <DashboardKpiCard key={kpi.label} kpi={kpi} realCount={realCounts[KPI_TO_TABLE[kpi.label]]} loading={loading} />
        ))}
      </div>

      {/* Attention Bar */}
      {ATTENTION_ITEMS.some((a) => a.count > 0) && (
        <WkSurface className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <WkIcon name="AlertTriangle" size={16} className="text-wk-warning" />
            <h2 className="text-[14px] font-bold text-wk-text">Needs Attention</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {ATTENTION_ITEMS.filter((a) => a.count > 0).map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(item.href)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-semibold transition-colors hover:opacity-80 whitespace-nowrap ${
                  item.type === "failed"
                    ? "border-wk-danger/20 bg-wk-danger-soft text-wk-danger"
                    : item.type === "warning"
                    ? "border-wk-warning/20 bg-wk-warning-soft text-wk-warning"
                    : item.type === "review"
                    ? "border-wk-brand/20 bg-wk-brand-soft text-wk-brand"
                    : "border-wk-info/20 bg-wk-info-soft text-wk-info"
                }`}
              >
                <WkIcon
                  name={
                    item.type === "failed"
                      ? "AlertCircle"
                      : item.type === "warning"
                      ? "AlertTriangle"
                      : item.type === "review"
                      ? "GitPullRequest"
                      : "Info"
                  }
                  size={14}
                />
                {item.count} {item.title}
              </button>
            ))}
          </div>
        </WkSurface>
      )}

      {/* Main Grid */}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Operational Stats */}
          <WkSurface className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <WkIcon name="Activity" size={16} className="text-wk-brand" />
              <h2 className="text-[14px] font-bold text-wk-text">Operational Overview</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <OpStat label="Recently Imported" value={OPERATIONAL_COUNTS.recentlyImported} />
              <OpStat label="Recently Edited" value={OPERATIONAL_COUNTS.recentlyEdited} />
              <OpStat label="Recently Published" value={OPERATIONAL_COUNTS.recentlyPublished} />
              <OpStat label="Drafts Awaiting Review" value={OPERATIONAL_COUNTS.draftsAwaitingReview} accent="warning" />
              <OpStat label="Missing Hero Images" value={OPERATIONAL_COUNTS.recordsMissingHeroImages} accent="danger" />
              <OpStat label="Missing Slugs" value={OPERATIONAL_COUNTS.recordsMissingSlugs} accent="warning" />
              <OpStat label="Failed Imports" value={OPERATIONAL_COUNTS.failedImports} accent="danger" />
              <OpStat label="Content Conflicts" value={OPERATIONAL_COUNTS.contentConflicts} accent="warning" />
            </div>
          </WkSurface>

          {/* Recent Activity */}
          <WkSurface className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <WkIcon name="Clock" size={16} className="text-wk-brand" />
                <h2 className="text-[14px] font-bold text-wk-text">Recent Activity</h2>
              </div>
            </div>
            <div className="space-y-3">
              {RECENT_ACTIVITY.map((item) => (
                <ActivityRow key={item.id} item={item} />
              ))}
            </div>
          </WkSurface>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <WkSurface className="p-5">
            <h2 className="mb-3 text-[14px] font-bold text-wk-text">Quick Actions</h2>
            <div className="space-y-2">
              {QUICK_ACTIONS.map((action) => (
                <QuickActionButton key={action.label} action={action} />
              ))}
            </div>
          </WkSurface>

          {/* System Health */}
          <WkSurface className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <WkIcon name="HeartPulse" size={16} className="text-wk-brand" />
                <h2 className="text-[14px] font-bold text-wk-text">System Health</h2>
              </div>
              <span className="text-[10px] text-wk-text-faint">Updated just now</span>
            </div>
            <div className="space-y-2">
              {SYSTEM_HEALTH.map((item) => (
                <HealthRow key={item.label} item={item} />
              ))}
            </div>
          </WkSurface>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────── Sub-components ────────────────────────── */

function DashboardKpiCard({ kpi, realCount, loading }: { kpi: DashboardKpi; realCount?: number; loading: boolean }) {
  const accentColor =
    kpi.accent === "brand"
      ? "bg-wk-brand-soft text-wk-brand"
      : kpi.accent === "success"
      ? "bg-wk-success-soft text-wk-success"
      : kpi.accent === "warning"
      ? "bg-wk-warning-soft text-wk-warning"
      : kpi.accent === "danger"
      ? "bg-wk-danger-soft text-wk-danger"
      : kpi.accent === "info"
      ? "bg-wk-info-soft text-wk-info"
      : "bg-wk-surface-raised text-wk-text-muted";

  const displayValue = loading ? "—" : realCount !== undefined ? realCount : kpi.value;

  return (
    <button
      onClick={() => kpi.href && window.REACT_APP_NAVIGATE(kpi.href)}
      className="group text-left rounded-xl border border-wk-border bg-wk-surface p-4 transition-all hover:border-wk-border-2 hover:bg-wk-surface-raised"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accentColor}`}>
          <WkIcon name={kpi.icon as never} size={18} />
        </div>
        {kpi.change !== undefined && (
          <span
            className={`flex items-center text-[11px] font-bold ${
              kpi.change > 0
                ? "text-wk-success"
                : kpi.change < 0
                ? "text-wk-danger"
                : "text-wk-text-faint"
            }`}
          >
            <WkIcon
              name={kpi.change > 0 ? "TrendingUp" : kpi.change < 0 ? "TrendingDown" : "Minus"}
              size={12}
            />
            {Math.abs(kpi.change)}%
          </span>
        )}
      </div>
      <div className="text-[22px] font-black text-wk-text">{displayValue}</div>
      <div className="mt-0.5 text-[11px] font-semibold text-wk-text-muted uppercase tracking-wider">
        {kpi.label}
      </div>
    </button>
  );
}

function OpStat({ label, value, accent }: { label: string; value: number; accent?: "warning" | "danger" }) {
  const valueColor =
    accent === "danger" ? "text-wk-danger" : accent === "warning" ? "text-wk-warning" : "text-wk-text";
  return (
    <div className="rounded-lg border border-wk-border bg-wk-bg-subtle p-3">
      <div className={`text-[18px] font-black ${valueColor}`}>{value}</div>
      <div className="text-[11px] font-semibold text-wk-text-muted mt-0.5">{label}</div>
    </div>
  );
}

function ActivityRow({ item }: { item: RecentActivityItem }) {
  const statusColor =
    item.status === "success"
      ? "text-wk-success"
      : item.status === "warning"
      ? "text-wk-warning"
      : item.status === "error"
      ? "text-wk-danger"
      : "text-wk-info";

  const statusIcon =
    item.status === "success"
      ? "CheckCircle2"
      : item.status === "warning"
      ? "AlertTriangle"
      : item.status === "error"
      ? "XCircle"
      : "Clock";

  return (
    <div className="flex items-start gap-3 rounded-lg border border-wk-border p-3 transition-all hover:bg-wk-surface-raised">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wk-surface-raised ${statusColor}`}>
        <WkIcon name={statusIcon as never} size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-wk-text">
          {item.action} <span className="text-wk-text-soft">{item.entity}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-wk-text-muted">
          <span>{item.actor}</span>
          <span>·</span>
          <span>{new Date(item.timestamp).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}

function QuickActionButton({ action }: { action: QuickAction }) {
  const iconColor = action.accent === "brand" ? "text-wk-brand" : "text-wk-text-muted";
  return (
    <button
      onClick={() => window.REACT_APP_NAVIGATE(action.href)}
      disabled={action.disabled}
      className={`flex w-full items-center gap-3 rounded-lg border border-wk-border p-3 text-left transition-all ${
        action.disabled
          ? "opacity-40 cursor-not-allowed"
          : "hover:bg-wk-surface-raised hover:border-wk-border-2"
      }`}
    >
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wk-surface-raised ${iconColor}`}>
        <WkIcon name={action.icon as never} size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-wk-text">{action.label}</div>
        <div className="text-[11px] text-wk-text-muted">{action.description}</div>
      </div>
      <WkIcon name="ChevronRight" size={16} className="text-wk-text-faint" />
    </button>
  );
}

function HealthRow({ item }: { item: SystemHealthItem }) {
  const statusColor =
    item.status === "healthy"
      ? "bg-wk-success"
      : item.status === "warning"
      ? "bg-wk-warning"
      : item.status === "critical"
      ? "bg-wk-danger"
      : "bg-wk-text-faint";

  const statusText =
    item.status === "healthy"
      ? "text-wk-success"
      : item.status === "warning"
      ? "text-wk-warning"
      : item.status === "critical"
      ? "text-wk-danger"
      : "text-wk-text-faint";

  return (
    <div className="flex items-center justify-between rounded-lg border border-wk-border p-3">
      <div className="flex items-center gap-3">
        <div className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
        <span className="text-[13px] font-semibold text-wk-text">{item.label}</span>
      </div>
      <span className={`text-[11px] font-bold uppercase ${statusText}`}>{item.status}</span>
    </div>
  );
}