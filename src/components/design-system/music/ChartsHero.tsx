import { Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";

interface ChartsHeroProps {
  topTrack: {
    title: string;
    artist: string;
    artworkUrl: string;
    slug?: string;
    artistSlug?: string;
    genre?: string;
    weeksOnChart?: number;
    peakPosition?: number;
    label?: string;
  } | null;
  chartMeta: {
    seriesLabel: string;
    editionLabel: string;
    weekNumber: number;
    date: string;
    totalEntries: number;
    totalArtists: number;
    newEntries: number;
    methodology: string;
  };
  onPlay: () => void;
  onPlayTop10: () => void;
  variant?: "directory" | "edition";
}

export function ChartsHero({
  topTrack,
  chartMeta,
  onPlay,
  onPlayTop10,
  variant = "edition",
}: ChartsHeroProps) {
  const { currentTrack, isPlaying } = usePlayer();
  const isCurrentTrack = currentTrack?.title === topTrack?.title;
  const isPlayingCurrent = isCurrentTrack && isPlaying;

  if (!topTrack) {
    return (
      <section className="relative overflow-hidden border-b border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div className="wk-container px-4 py-16 md:px-6 md:py-24">
          <div className="wk-eyebrow mb-3">WAKILISHA charts</div>
          <h1 className="wk-h-page">Chart universe</h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--wk-text-muted)]">
            {chartMeta.totalEntries} chart positions across imported series.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden">
      {/* Background artwork */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${topTrack.artworkUrl})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-black/90" />
      <div className="absolute inset-0 bg-[var(--wk-brand)]/[0.04]" />

      {/* Content */}
      <div className="relative wk-container px-4 py-12 md:px-6 md:py-16">
        <div className="grid grid-cols-1 items-end gap-8 lg:grid-cols-[1fr_420px]">
          {/* Left: Title and CTA */}
          <div className="pb-2">
            <div className="mb-4 flex items-center gap-3">
              <div className="wk-eyebrow">WAKILISHA charts</div>
              <span className="inline-block h-1 w-1 rounded-full bg-[var(--wk-brand)]" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">
                {chartMeta.seriesLabel}
              </span>
            </div>

            <h1 className="text-[clamp(44px,7vw,88px)] font-black leading-[0.9] tracking-[-0.055em] text-white">
              {variant === "edition" ? chartMeta.editionLabel : "Chart Universe"}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-white/60">
              <span className="font-semibold text-white/80">Week {chartMeta.weekNumber}</span>
              <span className="hidden sm:inline">·</span>
              <span>{chartMeta.date}</span>
              <span className="hidden sm:inline">·</span>
              <span>{chartMeta.totalEntries} entries</span>
              <span className="hidden sm:inline">·</span>
              <span>{chartMeta.totalArtists} artists</span>
              <span className="hidden sm:inline">·</span>
              <span>{chartMeta.newEntries} new</span>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={onPlayTop10}
                className="wk-button wk-button-primary"
              >
                <i className="ri-play-fill" /> Play top 10
              </button>
              <button
                onClick={onPlay}
                className="wk-button wk-button-ghost !border-white/20 !text-white hover:!bg-white/10"
              >
                <i className={isPlayingCurrent ? "ri-pause-fill" : "ri-play-fill"} />
                {isPlayingCurrent ? "Pause #1" : "Play #1"}
              </button>
            </div>
          </div>

          {/* Right: #1 card */}
          <div className="relative">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-md">
              {/* Crown badge */}
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C9A96E]/20 text-[#C9A96E]">
                  <i className="ri-vip-crown-2-fill" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#C9A96E]">
                  Current #1
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl shadow-lg">
                  <img
                    src={topTrack.artworkUrl}
                    alt={topTrack.title}
                    className="h-full w-full object-cover object-top"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 truncate text-[22px] font-black text-white">
                    {topTrack.title}
                  </div>
                  <div className="truncate text-[14px] text-white/70">
                    {topTrack.artist}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {topTrack.genre && (
                      <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white/80">
                        {topTrack.genre}
                      </span>
                    )}
                    {topTrack.weeksOnChart !== undefined && (
                      <span className="text-[11px] text-white/50">
                        {topTrack.weeksOnChart} wk{topTrack.weeksOnChart !== 1 ? "s" : ""} on chart
                      </span>
                    )}
                    {topTrack.peakPosition === 1 && (
                      <span className="rounded-full bg-[#C9A96E]/20 px-2 py-0.5 text-[10px] font-bold text-[#C9A96E]">
                        PEAK
                      </span>
                    )}
                  </div>
                  {topTrack.label && (
                    <div className="mt-1 truncate text-[11px] text-white/40">
                      {topTrack.label}
                    </div>
                  )}
                </div>
              </div>

              {/* Mini stats bar */}
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-white/5 bg-white/5 p-3">
                <div className="text-center">
                  <div className="text-[18px] font-black text-[#C9A96E]">
                    {topTrack.weeksOnChart ?? 0}
                  </div>
                  <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    Weeks
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[18px] font-black text-[#C9A96E]">
                    #{topTrack.peakPosition ?? 1}
                  </div>
                  <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    Peak
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[18px] font-black text-[#C9A96E]">
                    {topTrack.genre ?? "—"}
                  </div>
                  <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    Genre
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}