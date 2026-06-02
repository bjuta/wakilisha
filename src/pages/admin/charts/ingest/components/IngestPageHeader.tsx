import { WkIcon } from "@/components/design-system/Icon";

const BTN_GHOST = "inline-flex items-center gap-1.5 rounded-md border border-wk-border bg-wk-surface px-4 py-2.5 text-[13px] font-semibold text-wk-text-soft transition-colors hover:bg-wk-surface-raised whitespace-nowrap";

type IngestPageHeaderProps = {
  mode: string;
  onOpenRuns: () => void;
  onOpenHealth: () => void;
};

export function IngestPageHeader({ mode, onOpenRuns, onOpenHealth }: IngestPageHeaderProps) {
  const isMock = mode === "mock";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">Chart Operations</div>
        <h1 className="text-[22px] font-bold text-wk-text">Ingest Studio</h1>
        <p className="text-[13px] text-wk-text-soft">Create chart editions from streaming playlists — program, rules, sources, review, commit</p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${isMock ? "bg-wk-warning-soft text-wk-warning" : "bg-wk-success-soft text-wk-success"}`}>
          <WkIcon name={isMock ? "FlaskConical" : "Globe"} size={12} />
          {isMock ? "Mock Mode" : "WordPress Mode"}
        </span>
        <button onClick={onOpenRuns} className={BTN_GHOST}><WkIcon name="List" size={14} />All Runs</button>
        <button onClick={onOpenHealth} className={BTN_GHOST}><WkIcon name="HeartPulse" size={14} />API Health</button>
      </div>
    </div>
  );
}
