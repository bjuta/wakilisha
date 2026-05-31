import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { IngestSource } from "@/services/chartsIngestion/types";

interface FetchStepProps {
  sources: IngestSource[];
}

export function FetchStep({ sources }: FetchStepProps) {
  const completed = sources.filter((s) => s.status === "completed").length;
  const total = sources.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <WkSurface className="p-5">
        <h2 className="mb-4 text-[14px] font-bold text-[var(--wk-text)]">Source Fetch Progress</h2>
        <div className="mb-4">
          <div className="flex items-center justify-between text-[12px] mb-1">
            <span className="text-[var(--wk-text-muted)]">Overall Progress</span>
            <span className="font-semibold text-[var(--wk-text)]">{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--wk-bg-subtle)] overflow-hidden">
            <div className="h-full rounded-full bg-[var(--wk-brand)] transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="space-y-2">
          {sources.map((source) => (
            <div key={source.id} className="flex items-center gap-3 rounded-lg border border-[var(--wk-border)] p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
                <i className={`ri-${getProviderIcon(source.provider)}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-[var(--wk-text)]">
                  {source.provider.charAt(0).toUpperCase() + source.provider.slice(1)}
                </div>
                <div className="text-[11px] text-[var(--wk-text-muted)]">
                  {source.rawCount} raw items · {source.normalizedCount} normalized · {source.errorCount} errors
                </div>
              </div>
              <div className="flex items-center gap-2">
                {source.status === "completed" && <i className="ri-check-line text-[var(--wk-success)]" />}
                {source.status === "fetching" && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--wk-info)] border-t-transparent" />
                )}
                {source.status === "failed" && <i className="ri-error-warning-line text-[var(--wk-danger)]" />}
                {source.status === "pending" && <i className="ri-time-line text-[var(--wk-text-faint)]" />}
                {source.status === "disabled" && <i className="ri-eye-off-line text-[var(--wk-text-faint)]" />}
                <span className={`text-[10px] font-semibold ${
                  source.status === "completed" ? "text-[var(--wk-success)]" :
                  source.status === "fetching" ? "text-[var(--wk-info)]" :
                  source.status === "failed" ? "text-[var(--wk-danger)]" :
                  source.status === "disabled" ? "text-[var(--wk-text-faint)]" :
                  "text-[var(--wk-text-faint)]"
                }`}>
                  {source.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </WkSurface>
    </div>
  );
}

function getProviderIcon(provider: string): string {
  const icons: Record<string, string> = {
    spotify: "spotify-fill",
    apple: "apple-fill",
    youtube: "youtube-fill",
    csv: "file-list-line",
    manual: "edit-line",
    airplay: "radio-line",
    legacy: "archive-line",
    previous: "history-line",
  };
  return icons[provider] ?? "database-2-line";
}