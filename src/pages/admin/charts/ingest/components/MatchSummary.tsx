import { useNavigate } from "react-router-dom";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { IngestRunSummary } from "@/services/chartsIngestion/ingestStudioTypes";

interface MatchSummaryProps {
  summary: IngestRunSummary;
  runId?: string;
}

export function MatchSummary({ summary, runId }: MatchSummaryProps) {
  const navigate = useNavigate();

  const total = summary.totalRows || 1;
  const needsReviewEst = Math.max(0, total - summary.canonicalMatches - summary.shells - summary.gaps - summary.duplicateCandidates);

  const segments = [
    { label: "Canonical", value: summary.canonicalMatches, color: "bg-wk-success", text: "text-wk-success", icon: "ri-check-double-line", action: null },
    { label: "Shells", value: summary.shells, color: "bg-wk-warning", text: "text-wk-warning", icon: "ri-folder-add-line", action: "/admin/charts/release-shells" },
    { label: "No Match", value: summary.gaps, color: "bg-wk-danger", text: "text-wk-danger", icon: "ri-close-circle-line", action: "/admin/charts/no-match" },
    { label: "Duplicates", value: summary.duplicateCandidates, color: "bg-wk-info", text: "text-wk-info", icon: "ri-file-copy-line", action: "/admin/charts/review-queue" },
    { label: "Needs Review", value: needsReviewEst, color: "bg-wk-brand", text: "text-wk-brand", icon: "ri-flag-line", action: "/admin/charts/review-queue" },
  ];

  const barTotal = segments.reduce((sum, s) => sum + s.value, 0) || 1;

  return (
    <WkSurface className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-bold text-wk-text">Match Summary</h2>
        <div className="flex items-center gap-2">
          <span className={`text-[12px] font-bold ${summary.matchRate >= 85 ? "text-wk-success" : summary.matchRate >= 70 ? "text-wk-warning" : "text-wk-danger"}`}>
            {summary.matchRate.toFixed(1)}% match rate
          </span>
          <span className="text-[11px] text-wk-text-muted">{summary.totalRows} rows</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-wk-surface-raised">
        {segments.map((s) => (
          s.value > 0 && (
            <div
              key={s.label}
              className={`${s.color} transition-all duration-500`}
              style={{ width: `${(s.value / barTotal) * 100}%` }}
              title={`${s.label}: ${s.value}`}
            />
          )
        ))}
      </div>

      {/* Segment cards */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {segments.map((s) => (
          <div
            key={s.label}
            className={`rounded-lg border p-2 ${
              s.action && s.value > 0
                ? "cursor-pointer border-wk-border hover:border-current/30 transition-colors"
                : "border-wk-border"
            }`}
            style={s.action && s.value > 0 ? {} : {}}
            onClick={() => s.action && s.value > 0 && navigate(s.action)}
          >
            <div className="flex items-center gap-1 mb-1">
              <div className={`h-1.5 w-4 rounded-full ${s.color}`} />
              {s.action && s.value > 0 && <i className="ri-arrow-right-s-line text-[10px] ml-auto text-wk-text-faint" />}
            </div>
            <p className="text-[10px] text-wk-text-muted">{s.label}</p>
            <p className={`text-[16px] font-black ${s.text}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Action callouts for issues */}
      {(summary.gaps > 0 || summary.shells > 0) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {summary.gaps > 0 && (
            <button
              onClick={() => navigate("/admin/charts/no-match")}
              className="flex items-center gap-1.5 rounded-lg border border-wk-danger/20 bg-wk-danger-soft px-3 py-1.5 text-[11px] font-semibold text-wk-danger transition-colors hover:bg-wk-danger/20"
            >
              <i className="ri-close-circle-line" />
              {summary.gaps} no-match rows need resolution
              <i className="ri-arrow-right-s-line" />
            </button>
          )}
          {summary.shells > 0 && (
            <button
              onClick={() => navigate("/admin/charts/release-shells")}
              className="flex items-center gap-1.5 rounded-lg border border-wk-warning/20 bg-wk-warning-soft px-3 py-1.5 text-[11px] font-semibold text-wk-warning transition-colors hover:bg-wk-warning/20"
            >
              <i className="ri-folder-add-line" />
              {summary.shells} release shells pending
              <i className="ri-arrow-right-s-line" />
            </button>
          )}
          {summary.duplicateCandidates > 0 && (
            <button
              onClick={() => navigate("/admin/charts/review-queue")}
              className="flex items-center gap-1.5 rounded-lg border border-wk-info/20 bg-wk-info-soft px-3 py-1.5 text-[11px] font-semibold text-wk-info transition-colors hover:bg-wk-info/20"
            >
              <i className="ri-file-copy-line" />
              {summary.duplicateCandidates} duplicate candidates
              <i className="ri-arrow-right-s-line" />
            </button>
          )}
        </div>
      )}
    </WkSurface>
  );
}