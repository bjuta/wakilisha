interface StatsBarItem {
  label: string;
  value: string | number;
  suffix?: string;
  icon?: string;
}

interface ArtistStatsBarProps {
  stats: StatsBarItem[];
}

export function ArtistStatsBar({ stats }: ArtistStatsBarProps) {
  return (
    <div className="border-b border-[var(--wk-border)] bg-[var(--wk-surface)]">
      <div className="wk-container grid grid-cols-2 gap-4 px-6 py-5 md:flex md:items-center md:justify-start md:gap-10 md:py-6">
        {stats.map((stat, i) => (
          <div key={i} className="flex items-center gap-2">
            {stat.icon && (
              <i className={`${stat.icon} text-[14px] text-[var(--wk-brand)]`} />
            )}
            <span className="text-[18px] font-black tracking-[-0.04em] text-[var(--wk-brand)] md:text-[22px]">
              {stat.value}
              {stat.suffix || ""}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}