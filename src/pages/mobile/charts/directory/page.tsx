import { useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { CHART_DATA, CHART_SERIES, CHART_EDITION } from "@/mocks/charts";

const SERIES_ACCENT: Record<string, string> = {
  "weekly-top-40": "#84C241",
  "rising-voices": "#E8A23A",
  "genre-pulse": "#D6766A",
  "classics": "#C9A96E",
  "breakout": "#4FD9C2",
};

const SERIES_ICON: Record<string, string> = {
  "weekly-top-40": "ri-bar-chart-line",
  "rising-voices": "ri-rocket-line",
  "genre-pulse": "ri-pulse-line",
  "classics": "ri-vip-crown-line",
  "breakout": "ri-fire-line",
};

export default function MobileChartsDirectory() {
  const { playTrack } = usePlayer();

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll(".mob-reveal").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const topTrack = CHART_DATA[0];
  const hasData = CHART_DATA.length > 0;

  const chartTracks = useMemo(
    () =>
      CHART_DATA.map((entry) => ({
        id: entry.slug || `${entry.title}-${entry.artist}`.toLowerCase().replace(/\s+/g, "-"),
        title: entry.title,
        artist: entry.artist,
        artworkUrl: entry.artworkUrl,
        isPlayable: entry.isPlayable,
      })),
    []
  );

  const handlePlay = (idx: number) => playTrack(chartTracks[idx], chartTracks);
  const handlePlayTop5 = () => {
    const top5 = chartTracks.slice(0, 5);
    if (top5.length > 0) playTrack(top5[0], top5);
  };

  const latestEditionHref =
    CHART_SERIES[0]?.latestEdition
      ? `/charts/${CHART_SERIES[0].id}/${CHART_SERIES[0].latestEdition.slug}`
      : `/charts/${CHART_SERIES[0]?.id ?? "weekly-top-40"}`;

  const totalEditions = CHART_SERIES.reduce((sum, s) => sum + (s.editionCount ?? 0), 0);

  const recentEditions = useMemo(() => {
    const rows: Array<{
      seriesLabel: string;
      seriesId: string;
      editionLabel: string;
      editionSlug: string;
      date: string;
      no1Title: string;
      no1Artist: string;
      no1Artwork: string;
      entryCount: number;
    }> = [];

    CHART_SERIES.forEach((series) => {
      if (series.latestEdition) {
        rows.push({
          seriesLabel: series.label,
          seriesId: series.id,
          editionLabel: series.latestEdition.label,
          editionSlug: series.latestEdition.slug,
          date: series.latestEdition.date ?? CHART_EDITION.date,
          no1Title: topTrack?.title ?? "",
          no1Artist: topTrack?.artist ?? "",
          no1Artwork: topTrack?.artworkUrl ?? "",
          entryCount: series.count,
        });
      }
    });

    return rows;
  }, []);

  if (!hasData) {
    return (
      <div className="min-h-screen pb-24">
        <section className="px-5 py-16">
          <div className="max-w-2xl rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
              <i className="ri-bar-chart-box-line text-2xl" />
            </div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] mb-3">
              WAKILISHA charts
            </div>
            <h1 className="font-black leading-[0.92] tracking-[-0.055em] text-[var(--wk-text)]" style={{ fontSize: "clamp(28px, 8vw, 40px)" }}>
              Chart data has not been seeded yet.
            </h1>
            <p className="mt-4 text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
              Run the CSV registry generation and seed the app before showing chart entries.
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Hero */}
      <section className="relative min-h-[420px] flex items-end overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${topTrack.artworkUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(40px) saturate(1.2)",
            transform: "scale(1.2)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--wk-bg)] via-[var(--wk-bg)]/85 to-[var(--wk-bg)]/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--wk-bg)]/60 via-transparent to-[var(--wk-bg)]/60" />

        <div className="relative w-full px-5 pb-8 pt-20">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] mb-3 flex items-center gap-2">
            <span className="w-5 h-px bg-[var(--wk-brand)]" />
            WAKILISHA charts
          </div>
          <h1 className="font-black leading-[0.92] tracking-[-0.055em] text-[var(--wk-text)]" style={{ fontSize: "clamp(36px, 10vw, 52px)" }}>
            Chart Universe
          </h1>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-[var(--wk-text-soft)]">
            The definitive index of African music charts.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to={latestEditionHref}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-3 text-[13px] font-bold text-[var(--wk-brand-on)] whitespace-nowrap"
            >
              <i className="ri-bar-chart-line" /> Latest edition
            </Link>
            <button
              onClick={handlePlayTop5}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border-2)] bg-transparent px-5 py-3 text-[13px] font-bold text-[var(--wk-text)] whitespace-nowrap"
            >
              <i className="ri-play-fill" /> Top 5
            </button>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <div className="mob-reveal grid grid-cols-2 gap-px border-b border-[var(--wk-border)]" style={{ background: "var(--wk-border)" }}>
        {[
          { val: CHART_SERIES.length, lbl: "Series" },
          { val: totalEditions, lbl: "Editions" },
          { val: CHART_DATA.length, lbl: "Entries" },
          { val: CHART_EDITION.date || "—", lbl: "Latest" },
        ].map((stat) => (
          <div key={stat.lbl} className="bg-[var(--wk-surface)] px-4 py-3 text-center">
            <div className="text-[18px] font-black text-[var(--wk-brand)]">{stat.val}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">{stat.lbl}</div>
          </div>
        ))}
      </div>

      {/* Current #1 */}
      <div className="mob-reveal px-5 py-4 border-b border-[var(--wk-divider)]">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C9A96E]/20 text-[#C9A96E]">
            <i className="ri-vip-crown-2-fill text-sm" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#C9A96E]">Current #1</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]">
            <img src={topTrack.artworkUrl} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-black text-[var(--wk-text)] truncate">{topTrack.title}</div>
            <div className="text-[13px] text-[var(--wk-text-muted)]">{topTrack.artist}</div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)]">
              <span className="text-[var(--wk-success)]"><i className="ri-arrow-up-line" /> {topTrack.movementAmount}</span>
              <span>{topTrack.weeksOnChart} weeks</span>
              <span>·</span>
              <span className="text-[var(--wk-brand)]">{topTrack.genre}</span>
            </div>
          </div>
          <button onClick={() => handlePlay(0)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)]">
            <i className="ri-play-fill" />
          </button>
        </div>
      </div>

      {/* Featured edition preview */}
      <div className="mob-reveal px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--wk-brand)] flex items-center gap-2">
            <span className="w-4 h-px bg-[var(--wk-brand)]" />
            Current edition
          </div>
          <Link to={latestEditionHref} className="text-[12px] font-semibold text-[var(--wk-brand)]">
            View all <i className="ri-arrow-right-line" />
          </Link>
        </div>
        <Link to={latestEditionHref} className="block rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--wk-divider)] flex items-center justify-between">
            <div>
              <div className="text-[13px] font-bold text-[var(--wk-text)]">{CHART_SERIES[0]?.label ?? "Weekly Top 40"}</div>
              <div className="text-[11px] text-[var(--wk-text-muted)]">Week {CHART_EDITION.weekNumber} · {CHART_EDITION.date}</div>
            </div>
            <i className="ri-arrow-right-s-line text-[var(--wk-text-faint)]" />
          </div>
          <div className="divide-y divide-[var(--wk-divider)]">
            {CHART_DATA.slice(0, 5).map((entry, idx) => (
              <div key={entry.rank} className="flex items-center gap-3 px-4 py-3">
                <div className="w-6 text-right text-[14px] font-black" style={{ color: entry.rank === 1 ? "#C9A96E" : entry.rank === 2 ? "#A8A8A8" : entry.rank === 3 ? "#B87333" : "var(--wk-brand)" }}>
                  {entry.rank}
                </div>
                <div className="h-10 w-10 shrink-0 rounded-md overflow-hidden bg-[var(--wk-surface-raised)]">
                  <img src={entry.artworkUrl} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-[var(--wk-text)] truncate">{entry.title}</div>
                  <div className="text-[11px] text-[var(--wk-text-muted)]">{entry.artist}</div>
                </div>
                <button onClick={() => handlePlay(idx)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)]">
                  <i className="ri-play-mini-fill text-xs" />
                </button>
              </div>
            ))}
          </div>
        </Link>
      </div>

      {/* Chart series */}
      <div className="mob-reveal px-5 py-4 border-t border-[var(--wk-border)]">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--wk-brand)] flex items-center gap-2 mb-3">
          <span className="w-4 h-px bg-[var(--wk-brand)]" />
          Chart series
        </div>
        <div className="space-y-3">
          {CHART_SERIES.map((series) => {
            const accent = SERIES_ACCENT[series.id] ?? "var(--wk-brand)";
            const icon = SERIES_ICON[series.id] ?? "ri-bar-chart-line";
            const href = series.latestEdition
              ? `/charts/${series.id}/${series.latestEdition.slug}`
              : `/charts/${series.id}`;
            return (
              <Link
                key={series.id}
                to={href}
                className="flex items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${accent}15` }}>
                  <i className={`${icon} text-lg`} style={{ color: accent }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-bold text-[var(--wk-text)]">{series.label}</div>
                  <div className="text-[12px] text-[var(--wk-text-muted)]">Top {series.entryCount} · {series.editionCount ?? 1} editions</div>
                </div>
                <i className="ri-arrow-right-s-line text-[var(--wk-text-faint)]" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent editions */}
      <div className="mob-reveal px-5 py-4 border-t border-[var(--wk-border)]">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--wk-brand)] flex items-center gap-2 mb-3">
          <span className="w-4 h-px bg-[var(--wk-brand)]" />
          Recent editions
        </div>
        <div className="space-y-2">
          {recentEditions.map((row) => (
            <Link
              key={`${row.seriesId}-${row.editionSlug}`}
              to={`/charts/${row.seriesId}/${row.editionSlug}`}
              className="flex items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3"
            >
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-[var(--wk-surface-raised)]">
                {row.no1Artwork ? (
                  <img src={row.no1Artwork} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[var(--wk-text-faint)]">
                    <i className="ri-bar-chart-line text-sm" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-[var(--wk-text)]">{row.seriesLabel}</div>
                <div className="text-[11px] text-[var(--wk-text-muted)]">{row.editionLabel} · {row.date}</div>
              </div>
              <span className="text-[11px] font-bold text-[var(--wk-text-muted)]">{row.entryCount} entries</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Methodology */}
      <div className="mob-reveal px-5 py-4 border-t border-[var(--wk-border)]">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--wk-brand)] flex items-center gap-2 mb-3">
          <span className="w-4 h-px bg-[var(--wk-brand)]" />
          How we compile
        </div>
        <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] p-4">
          <div className="text-[13px] font-bold text-[var(--wk-text)] mb-2">{CHART_EDITION.methodology}</div>
          <div className="space-y-2">
            {[
              "Streaming data from Spotify, Apple Music, YouTube, and Boomplay",
              "Radio airplay across 12 African countries",
              "Digital activity: social engagement, playlist adds, search volume",
              "Tracks verified against ISRC and graph relationships",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2 text-[12px] text-[var(--wk-text-muted)]">
                <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--wk-brand)] shrink-0" />
                {item}
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--wk-divider)] text-[11px] text-[var(--wk-text-muted)]">
            <span className="font-bold text-[var(--wk-text)]">{totalEditions}</span> editions · <span className="font-bold text-[var(--wk-text)]">{CHART_DATA.length}</span> entries tracked
          </div>
        </div>
      </div>

      {/* Reveal animation styles */}
      <style>{`
        .mob-reveal {
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .mob-reveal.in-view {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
}