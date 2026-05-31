import { useState } from "react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { IngestJobLog } from "@/services/chartsIngestion/types";

interface TimelineProps {
  logs: IngestJobLog[];
  jobId: string;
}

const LEVEL_ICON: Record<string, string> = {
  info: "ri-information-line",
  warning: "ri-error-warning-line",
  error: "ri-close-circle-line",
  success: "ri-check-line",
};

const LEVEL_COLOR: Record<string, string> = {
  info: "text-[var(--wk-info)] bg-[var(--wk-info-soft)]",
  warning: "text-[var(--wk-warning)] bg-[var(--wk-warning-soft)]",
  error: "text-[var(--wk-danger)] bg-[var(--wk-danger-soft)]",
  success: "text-[var(--wk-success)] bg-[var(--wk-success-soft)]",
};

const LEVEL_DOT: Record<string, string> = {
  info: "bg-[var(--wk-info)]",
  warning: "bg-[var(--wk-warning)]",
  error: "bg-[var(--wk-danger)]",
  success: "bg-[var(--wk-success)]",
};

export function Timeline({ logs, jobId }: TimelineProps) {
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const jobLogs = logs
    .filter((l) => l.jobId === jobId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Job Timeline</h2>
        <span className="text-[11px] text-[var(--wk-text-muted)]">{jobLogs.length} events</span>
      </div>

      <WkSurface className="p-4">
        <div className="space-y-0">
          {jobLogs.map((log, index) => {
            const isExpanded = expandedLog === log.id;
            const hasContext = Object.keys(log.contextJson).length > 0;
            const isLast = index === jobLogs.length - 1;

            return (
              <div key={log.id} className="flex gap-3">
                {/* Timeline line */}
                <div className="flex flex-col items-center">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full ${LEVEL_COLOR[log.level] ?? LEVEL_COLOR.info}`}>
                    <i className={`${LEVEL_ICON[log.level] ?? LEVEL_ICON.info} text-xs`} />
                  </div>
                  {!isLast && <div className="mt-1 h-full w-px bg-[var(--wk-border)]" />}
                </div>

                {/* Content */}
                <div className={`flex-1 pb-4 ${isLast ? "" : ""}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-[var(--wk-text)]">{log.message}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${LEVEL_COLOR[log.level] ?? ""}`}>
                      {log.level}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--wk-text-muted)]">
                    <span>{log.stage}</span>
                    <span>·</span>
                    <span>{log.createdBy}</span>
                    <span>·</span>
                    <span>{formatTime(log.createdAt)}</span>
                  </div>
                  {hasContext && (
                    <button
                      onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                      className="mt-1 text-[10px] text-[var(--wk-brand)] hover:underline"
                    >
                      {isExpanded ? "Hide context" : "Show context"}
                    </button>
                  )}
                  {isExpanded && hasContext && (
                    <div className="mt-2 rounded-lg bg-[var(--wk-bg-subtle)] p-2">
                      <pre className="text-[10px] text-[var(--wk-text-soft)] overflow-x-auto">
                        {JSON.stringify(log.contextJson, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {jobLogs.length === 0 && (
            <div className="py-4 text-center text-[12px] text-[var(--wk-text-muted)]">
              No timeline events yet.
            </div>
          )}
        </div>
      </WkSurface>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}