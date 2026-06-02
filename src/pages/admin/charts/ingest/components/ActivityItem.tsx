import { Check, FlaskConical, X, RefreshCw, GitPullRequest } from "lucide-react";
import type { RecentIngestActivity } from "@/services/chartsIngestion/ingestStudioTypes";

interface ActivityItemProps {
  activity: RecentIngestActivity;
  onClick?: () => void;
}

export function ActivityItem({ activity: act, onClick }: ActivityItemProps) {
  const typeConfig: Record<string, { icon: typeof Check; bg: string; text: string }> = {
    commit: { icon: Check, bg: "bg-wk-success-soft", text: "text-wk-success" },
    dry_run: { icon: FlaskConical, bg: "bg-wk-info-soft", text: "text-wk-info" },
    cancel: { icon: X, bg: "bg-wk-danger-soft", text: "text-wk-danger" },
    retry: { icon: RefreshCw, bg: "bg-wk-warning-soft", text: "text-wk-warning" },
    review: { icon: GitPullRequest, bg: "bg-wk-brand-soft", text: "text-wk-brand" },
  };
  const cfg = typeConfig[act.type] || typeConfig.dry_run;
  const Icon = cfg.icon;
  const timeStr = new Date(act.createdAt).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <button onClick={onClick} className="flex w-full items-start gap-2 text-left rounded-lg p-1 hover:bg-wk-bg-subtle transition-colors">
      <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] ${cfg.bg} ${cfg.text}`}>
        <Icon size={10} />
      </div>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-wk-text truncate">{act.chartTitle}</p>
        <p className="text-[11px] text-wk-text-muted">
          {act.type === "commit" ? "Committed" : act.type === "dry_run" ? "Dry run" : act.type === "cancel" ? "Cancelled" : "Sent to review"} by {act.actor}
        </p>
        <p className="text-[10px] text-wk-text-faint">{timeStr}</p>
      </div>
    </button>
  );
}