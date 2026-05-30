export interface ChartEditionHeaderProps {
  date: string;
  weekNumber: number;
  methodology: string;
  totalEntries: number;
  totalArtists: number;
  newEntries: number;
  topGenre: string;
}

export function ChartEditionHeader({
  date,
  weekNumber,
  methodology,
  totalEntries,
  totalArtists,
  newEntries,
  topGenre,
}: ChartEditionHeaderProps) {
  return (
    <div className="border-b border-[var(--wk-border)] bg-[var(--wk-surface)]">
      <div className="wk-container flex flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[var(--wk-brand)]" />
            <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--wk-brand)]">
              Week {weekNumber}
            </span>
          </div>
          <span className="text-[13px] font-semibold text-[var(--wk-text-soft)]">
            {date}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[12px]" style={{ color: "var(--wk-text-muted)" }}>
          <span className="flex items-center gap-1.5">
            <i className="ri-music-2-line" />
            {totalEntries} entries
          </span>
          <span className="flex items-center gap-1.5">
            <i className="ri-user-3-line" />
            {totalArtists} artists
          </span>
          <span className="flex items-center gap-1.5">
            <i className="ri-add-circle-line" />
            {newEntries} new
          </span>
          <span className="flex items-center gap-1.5">
            <i className="ri-fire-line" />
            {topGenre} leads
          </span>
          <span className="hidden items-center gap-1.5 md:flex">
            <i className="ri-information-line" />
            {methodology}
          </span>
        </div>
      </div>
    </div>
  );
}