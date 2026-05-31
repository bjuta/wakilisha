export default function ChartDataSourcesPanel() {
  const sources = [
    {
      name: "Streaming",
      icon: "ri-headphone-line",
      providers: ["Spotify", "Apple Music", "YouTube Music", "Boomplay", "Deezer", "Audiomack"],
      weight: "45%",
      status: "active" as const,
    },
    {
      name: "Radio Airplay",
      icon: "ri-radio-line",
      providers: ["Nigerian Top 40 stations", "Ghana Radio Network", "Kenya FM Index", "SA Broadcasting", "UK Afrobeats Radio", "Diaspora FM"],
      weight: "25%",
      status: "active" as const,
    },
    {
      name: "Digital Activity",
      icon: "ri-smartphone-line",
      providers: ["TikTok sound usage", "Instagram Reels", "Twitter/X mentions", "Playlist adds", "Shazam queries"],
      weight: "20%",
      status: "active" as const,
    },
    {
      name: "Editorial",
      icon: "ri-article-line",
      providers: ["WAKILISHA Magazine reviews", "Curator panel scores", "Festival bookings", "Press coverage index"],
      weight: "10%",
      status: "active" as const,
    },
  ];

  return (
    <div className="reveal rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
      <div className="px-6 py-5 border-b border-[var(--wk-divider)]">
        <div className="wk-eyebrow mb-2">Data Transparency</div>
        <h3 className="font-black text-[clamp(20px,2.5vw,28px)] leading-[1.05] tracking-[-0.03em] text-[var(--wk-text)]">
          What we measure, how we weight it
        </h3>
      </div>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {sources.map((s) => (
          <div key={s.name} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--wk-surface-raised)]">
                <i className={`${s.icon} text-[var(--wk-brand)]`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-bold text-[var(--wk-text)]">{s.name}</div>
                <div className="text-[11px] text-[var(--wk-text-muted)]">
                  {s.providers.length} sources · Weight: {s.weight}
                </div>
              </div>
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-[var(--wk-success-soft)] text-[var(--wk-success)]">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--wk-success)]" /> Live
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {s.providers.map((p) => (
                <span key={p} className="inline-flex items-center rounded-md px-2 py-1 text-[10px] font-medium bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)] border border-[var(--wk-border)]">
                  {p}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="px-6 py-4 border-t border-[var(--wk-divider)] bg-[var(--wk-bg-subtle)]">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-[12px] text-[var(--wk-text-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <i className="ri-refresh-line text-[var(--wk-brand)]" /> Data refreshes every 6 hours
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="ri-file-list-3-line text-[var(--wk-brand)]" /> Full methodology published
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="ri-database-2-line text-[var(--wk-brand)]" /> Historical data since 2019
          </span>
          <span className="sm:ml-auto inline-flex items-center gap-1.5 font-semibold text-[var(--wk-brand)]">
            <i className="ri-download-cloud-line" /> Download this edition
          </span>
        </div>
      </div>
    </div>
  );
}