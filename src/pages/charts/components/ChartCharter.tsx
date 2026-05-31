export default function ChartCharter() {
  const principles = [
    {
      icon: "ri-shield-check-line",
      title: "Verified Identity",
      body: "Every track is matched against ISRC and our repaired cultural registry. No duplicates, no misattributions, no confusion between remixes and originals.",
    },
    {
      icon: "ri-global-line",
      title: "Pan-African Scope",
      body: "We compile data from 12 African markets and 4 diaspora territories. A track charting only in Lagos is not the same as a track charting across the continent.",
    },
    {
      icon: "ri-scales-3-line",
      title: "Weighted Integrity",
      body: "Streaming volume does not equal chart position. Radio airplay, playlist curation, social engagement, and editorial coverage are weighted into a composite score.",
    },
    {
      icon: "ri-time-line",
      title: "Historical Memory",
      body: "A chart position is not a snapshot. It is a point in a trajectory. We preserve every edition so that artists, labels, and historians can trace a track's full journey.",
    },
    {
      icon: "ri-lock-unlock-line",
      title: "Open Methodology",
      body: "Our compilation methods are documented and auditable. The same data that powers our charts is available for academic and industry research under our data charter.",
    },
    {
      icon: "ri-community-line",
      title: "Cultural Context",
      body: "Charts are not neutral. We annotate significant movements, milestone weeks, and genre shifts so that numbers tell stories, not just rankings.",
    },
  ];

  return (
    <div className="reveal rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] overflow-hidden">
      <div className="px-6 py-5 border-b border-[var(--wk-divider)]">
        <div className="wk-eyebrow mb-2">The WAKILISHA Charter</div>
        <h3 className="font-black text-[clamp(20px,2.5vw,28px)] leading-[1.05] tracking-[-0.03em] text-[var(--wk-text)]">
          Why these charts are different
        </h3>
      </div>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
        {principles.map((p) => (
          <div key={p.title} className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--wk-surface)] border border-[var(--wk-border)]">
              <i className={`${p.icon} text-[var(--wk-brand)]`} />
            </div>
            <div>
              <div className="text-[14px] font-bold text-[var(--wk-text)] mb-1">{p.title}</div>
              <div className="text-[13px] leading-[1.6] text-[var(--wk-text-muted)]">{p.body}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="px-6 py-4 border-t border-[var(--wk-divider)] bg-[var(--wk-surface)]">
        <div className="flex items-center gap-3 text-[12px] text-[var(--wk-text-muted)]">
          <i className="ri-shield-check-line text-[var(--wk-brand)]" />
          <span>All chart data is verified against the WAKILISHA repaired cultural registry. Last audited: {new Date().toISOString().slice(0, 10)}.</span>
        </div>
      </div>
    </div>
  );
}