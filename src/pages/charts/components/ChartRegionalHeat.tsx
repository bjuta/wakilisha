export default function ChartRegionalHeat() {
  const regions = [
    { name: "West Africa", pct: 42, cities: "Lagos, Accra, Abidjan", color: "#84C241" },
    { name: "East Africa", pct: 18, cities: "Nairobi, Dar es Salaam, Kampala", color: "#4FD9C2" },
    { name: "Southern Africa", pct: 15, cities: "Johannesburg, Cape Town, Gaborone", color: "#6BA8F5" },
    { name: "Diaspora", pct: 16, cities: "London, Paris, New York, Dubai", color: "#D85AAB" },
    { name: "Central Africa", pct: 9, cities: "Kinshasa, Douala, Yaoundé", color: "#F5B84B" },
  ];

  return (
    <div className="reveal rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
      <div className="px-6 py-5 border-b border-[var(--wk-divider)]">
        <div className="wk-eyebrow mb-2">Regional Heat</div>
        <h3 className="font-black text-[clamp(20px,2.5vw,28px)] leading-[1.05] tracking-[-0.03em] text-[var(--wk-text)]">
          Where the chart is living
        </h3>
        <p className="mt-1 text-[13px] text-[var(--wk-text-muted)]">
          Breakdown of streaming and radio activity by African region and diaspora
        </p>
      </div>
      <div className="p-6">
        <div className="flex items-end gap-2 h-[140px] mb-6">
          {regions.map((r) => (
            <div key={r.name} className="flex-1 flex flex-col items-center gap-2">
              <div className="text-[11px] font-bold text-[var(--wk-text)]">{r.pct}%</div>
              <div
                className="w-full rounded-t-md transition-all duration-700"
                style={{
                  height: `${r.pct * 2.5}px`,
                  background: r.color,
                  opacity: 0.85,
                }}
              />
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] text-center leading-tight">
                {r.name}
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {regions.map((r) => (
            <div key={r.name} className="flex items-center gap-3 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3">
              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: r.color }} />
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-[var(--wk-text)]">{r.name}</div>
                <div className="text-[11px] text-[var(--wk-text-muted)] truncate">{r.cities}</div>
              </div>
              <div className="ml-auto text-[13px] font-black text-[var(--wk-text)]">{r.pct}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}