import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { getIngestRuns } from "@/services/chartsIngestion/client";
import type { IngestRun } from "@/services/chartsIngestion/ingestStudioTypes";
import { useAdminBadgeCounts } from "@/hooks/useAdminBadgeCounts";

export default function AdminReviewQueuePage() {
  const navigate = useNavigate();
  const badgeCounts = useAdminBadgeCounts();
  const [runs, setRuns] = useState<IngestRun[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const r = await getIngestRuns();
    setRuns(r);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const allRows = runs.flatMap((run) => run.rows);
  const chartsReviewCount = allRows.filter((r) => r.matchStatus === "needs_review").length;
  const noMatchCount = allRows.filter((r) => r.matchStatus === "no_match").length;
  const shellCount = allRows.filter((r) => r.matchStatus === "shell").length;
  const canonGapCount = allRows.filter((r) =>
    r.matchStatus === "no_match" || r.matchStatus === "needs_review" || r.matchStatus === "duplicate_candidate"
  ).length;

  const totalReviewItems = chartsReviewCount + noMatchCount + shellCount + canonGapCount;

  const queueCategories = [
    {
      label: "Missing Hero Images",
      count: badgeCounts.missingImages,
      icon: "ImageOff" as const,
      path: "/admin/media/missing",
      accent: "warning" as const,
    },
    {
      label: "Broken Media Links",
      count: badgeCounts.brokenLinks,
      icon: "LinkBreak" as const,
      path: "/admin/media/broken",
      accent: "danger" as const,
    },
    {
      label: "Missing Metadata",
      count: 0,
      icon: "AlertCircle" as const,
      path: "/admin/review/missing-metadata",
      accent: "warning" as const,
      disabled: true,
    },
    {
      label: "Unresolved Entities",
      count: badgeCounts.reviewQueue,
      icon: "HelpCircle" as const,
      path: "/admin/review/unresolved",
      accent: "warning" as const,
      disabled: true,
    },
    {
      label: "Content Conflicts",
      count: 0,
      icon: "GitCompare" as const,
      path: "/admin/review/conflicts",
      accent: "danger" as const,
      disabled: true,
    },
    {
      label: "Migration Issues",
      count: badgeCounts.failedImports,
      icon: "AlertTriangle" as const,
      path: "/admin/review/migration",
      accent: "warning" as const,
      disabled: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Review</div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Review Queue</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            {loading ? "Loading..." : `${totalReviewItems} items awaiting review across all systems.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/admin/settings/charts/review-queue")}
            className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
          >
            <WkIcon name="ArrowRight" size={14} />
            Charts Review Queue
          </button>
        </div>
      </div>

      <WkSurface className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-wk-brand-soft text-wk-brand">
            <WkIcon name="GitPullRequest" size={20} />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-wk-text">Review Queue is Consolidated</h3>
            <p className="text-[13px] text-wk-text-muted mt-1 max-w-[600px]">
              The main review queue is currently managed within the Charts Ingestion Studio.
              All review items — missing matches, unresolved entities, canonical gaps, and conflicts —
              are surfaced there for editorial resolution.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { label: "Charts Review Queue", path: "/admin/settings/charts/review-queue", count: chartsReviewCount },
                { label: "No-match Items", path: "/admin/settings/charts/no-match", count: noMatchCount },
                { label: "Release Shells", path: "/admin/settings/charts/release-shells", count: shellCount },
                { label: "Canon Gaps", path: "/admin/settings/charts/canon-gaps", count: canonGapCount },
              ].map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-wk-border bg-wk-surface-raised px-3 py-1.5 text-[12px] font-semibold text-wk-text transition-colors hover:bg-wk-surface"
                >
                  <span>{item.label}</span>
                  <span className="rounded-full bg-wk-danger-soft px-1.5 py-0.5 text-[10px] font-bold text-wk-danger">
                    {item.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </WkSurface>

      {/* Queue categories */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {queueCategories.map((cat) => (
          <button
            key={cat.label}
            onClick={() => !cat.disabled && navigate(cat.path)}
            disabled={cat.disabled}
            className={`group text-left rounded-xl border border-wk-border bg-wk-surface p-4 transition-all hover:border-wk-border-2 hover:bg-wk-surface-raised ${
              cat.disabled ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                cat.accent === "warning" ? "bg-wk-warning-soft text-wk-warning" : "bg-wk-danger-soft text-wk-danger"
              }`}>
                <WkIcon name={cat.icon} size={16} />
              </div>
              <span className="rounded-full bg-wk-danger-soft px-2 py-0.5 text-[10px] font-bold text-wk-danger">
                {cat.count}
              </span>
            </div>
            <div className="text-[13px] font-semibold text-wk-text">{cat.label}</div>
            <div className="text-[11px] text-wk-text-muted mt-0.5">
              {cat.disabled ? "Coming soon" : "Click to review"}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}