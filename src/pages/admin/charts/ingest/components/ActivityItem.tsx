import type { RecentIngestActivity } from "@/services/chartsIngestion/ingestStudioTypes";

interface ActivityItemProps {
  activity: RecentIngestActivity;
  onClick?: () => void;
}

export function ActivityItem({ activity: act, onClick }: ActivityItemProps) {
  const typeConfig: Record<string, { icon: string; bg: string; text: string }> = {
    commit: { icon: "ri-check-line", bg: "bg-green-100", text: "text-green-700" },
    dry_run: { icon: "ri-flask-line", bg: "bg-primary-100", text: "text-primary-700" },
    cancel: { icon: "ri-close-line", bg: "bg-red-100", text: "text-red-700" },
    retry: { icon: "ri-refresh-line", bg: "bg-amber-100", text: "text-amber-700" },
    review: { icon: "ri-git-pull-request-line", bg: "bg-purple-100", text: "text-purple-700" },
  };
  const cfg = typeConfig[act.type] || typeConfig.dry_run;
  const timeStr = new Date(act.createdAt).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <button onClick={onClick} className="flex w-full items-start gap-2 text-left rounded-lg p-1 hover:bg-background-100 transition-colors">
      <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] ${cfg.bg} ${cfg.text}`}>
        <i className={cfg.icon} />
      </div>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-foreground-950 truncate">{act.chartTitle}</p>
        <p className="text-[11px] text-foreground-500">
          {act.type === "commit" ? "Committed" : act.type === "dry_run" ? "Dry run" : act.type === "cancel" ? "Cancelled" : "Sent to review"} by {act.actor}
        </p>
        <p className="text-[10px] text-foreground-400">{timeStr}</p>
      </div>
    </button>
  );
}