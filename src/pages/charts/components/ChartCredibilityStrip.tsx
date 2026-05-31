export default function ChartCredibilityStrip() {
  const sources = [
    { name: "Spotify", status: "live" as const, pct: 28 },
    { name: "Apple Music", status: "live" as const, pct: 22 },
    { name: "YouTube", status: "live" as const, pct: 20 },
    { name: "Boomplay", status: "live" as const, pct: 14 },
    { name: "Radio", status: "live" as const, pct: 12 },
    { name: "Social", status: "live" as const, pct: 4 },
  ];

  return (
    <div className="reveal border-y border-[var(--wk-border)] bg-[var(--wk-surface)]">
      <div className="wk-container-wide px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8">
          {/* Left: Trust signal */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--wk-brand-soft)]">
              <i className="ri-shield-check-line text-[var(--wk-brand)]" />
            </div>
            <div>
              <div className="text-[13px] font-bold text-[var(--wk-text)]">Verified Data Pipeline</div>
              <div className="text-[11px] text-[var(--wk-text-muted)]">6 active sources · Last sync 2h ago</div>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden lg:block h-8 w-px bg-[var(--wk-divider)]" />

          {/* Source bars */}
          <div className="flex-1 flex items-center gap-4 flex-wrap">
            {sources.map((s) => (
              <div key={s.name} className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--wk-success)]" />
                <span className="text-[12px] font-semibold text-[var(--wk-text)]">{s.name}</span>
                <span className="text-[11px] text-[var(--wk-text-faint)]">{s.pct}%</span>
              </div>
            ))}
          </div>

          {/* Right: CTA */}
          <div className="shrink-0">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
              <i className="ri-check-double-line" /> All sources verified
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}