import { useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { CHART_DATA, CHART_SERIES, CHART_EDITION } from "@/mocks/charts";

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
  const climbers = useMemo(
    () => CHART_DATA.filter((e) => e.movement === "up").sort((a, b) => (b.movementAmount ?? 0) - (a.movementAmount ?? 0)).slice(0, 3),
    []
  );
  const newEntries = useMemo(() => CHART_DATA.filter((e) => e.movement === "new").slice(0, 3), []);

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

  const handlePlayTop10 = () => {
    const top10 = chartTracks.slice(0, 10);
    if (top10.length > 0) playTrack(top10[0], top10);
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Cinematic Hero */}
      <section className="relative min-h-[480px] flex items-end overflow-hidden">
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
          <h1 className="font-black leading-[0.92] tracking-[-0.055em] text-[var(--wk-text)]" style={{ fontSize: "clamp(32px, 10vw, 52px)" }}>
            Chart universe
          </h1>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-[var(--wk-text-soft)]">
            Track what is rising, what has stayed, and what is new.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/charts/weekly-top-40/week-132" className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-3 text-[13px] font-bold text-[var(--wk-brand-on)] whitespace-nowrap">
              <i className="ri-bar-chart-line" /> Current edition
            </Link>
            <button onClick={handlePlayTop10} className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border-2)] bg-transparent px-5 py-3 text-[13px] font-bold text-[var(--wk-text)] whitespace-nowrap">
              <i className="ri-play-fill" /> Top 10
            </button>
          </div>
        </div>
      </section>

      {/* Current #1 */}
      <div className="mob-reveal px-5 py-4 border-b border-[var(--wk-divider)]">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)]">
            <span className="text-[14px] font-black">1</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">Current #1</span>
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
            </div>
          </div>
          <button onClick={() => handlePlay(0)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)]">
            <i className="ri-play-fill" />
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="mob-reveal grid grid-cols-3 gap-px border-b border-[var(--wk-border)]" style={{ background: "var(--wk-border)" }}>
        {[
          { val: CHART_DATA.length, lbl: "Entries" },
          { val: new Set(CHART_DATA.map((e) => e.artist)).size, lbl: "Artists" },
          { val: CHART_EDITION.weekNumber, lbl: "Editions" },
        ].map((stat) => (
          <div key={stat.lbl} className="bg-[var(--wk-surface)] px-4 py-3 text-center">
            <div className="text-[18px] font-black text-[var(--wk-brand)]">{stat.val}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">{stat.lbl}</div>
          </div>
        ))}
      </div>

      {/* Featured edition preview */}
      <div className="mob-reveal spec-section-hd">Current edition</div>
      <div className="px-5 pb-4">
        <Link to="/charts/weekly-top-40/week-132" className="block rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--wk-divider)] flex items-center justify-between">
            <div>
              <div className="text-[13px] font-bold text-[var(--wk-text)]">Weekly Top 40</div>
              <div className="text-[11px] text-[var(--wk-text-muted)]">Week {CHART_EDITION.weekNumber} · {CHART_EDITION.date}</div>
            </div>
            <i className="ri-arrow-right-s-line text-[var(--wk-text-faint)]" />
          </div>
          <div className="divide-y divide-[var(--wk-divider)]">
            {CHART_DATA.slice(0, 5).map((entry, idx) => (
              <div key={entry.rank} className="flex items-center gap-3 px-4 py-3">
                <div className="w-6 text-right text-[14px] font-black text-[var(--wk-brand)]">{entry.rank}</div>
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
          <div className="px-4 py-2.5 border-t border-[var(--wk-divider)]">
            <span className="text-[12px] font-semibold text-[var(--wk-brand)]">View all {CHART_DATA.length} positions</span>
          </div>
        </Link>
      </div>

      {/* Series */}
      <div className="mob-reveal spec-section-hd">Chart series</div>
      <div className="px-5 pb-4 flex gap-3 overflow-x-auto scrollbar-hide">
        {CHART_SERIES.map((s) => (
          <Link key={s.id} to={`/charts/${s.id}`} className="flex-none w-[260px] rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="text-[14px] font-bold text-[var(--wk-text)]">{s.label}</div>
              <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">Active</span>
            </div>
            <div className="text-[12px] text-[var(--wk-text-muted)] mb-3">{s.description}</div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-md overflow-hidden bg-[var(--wk-surface-raised)]">
                <img src={CHART_DATA[0].artworkUrl} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="text-[11px] text-[var(--wk-text-faint)]">Latest #1 · {CHART_DATA[0].title}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Signals */}
      <div className="mob-reveal spec-section-hd">Signals</div>
      <div className="px-5 pb-4 space-y-3">
        <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] mb-2">Climbers</div>
          {climbers.map((entry) => (
            <div key={entry.rank} className="flex items-center gap-3 py-2 border-b border-[var(--wk-divider)] last:border-0">
              <div className="text-[12px] font-black text-[var(--wk-brand)] w-5">{entry.rank}</div>
              <div className="h-8 w-8 rounded-md overflow-hidden bg-[var(--wk-surface-raised)]">
                <img src={entry.artworkUrl} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-bold text-[var(--wk-text)] truncate">{entry.title}</div>
                <div className="text-[11px] text-[var(--wk-text-muted)]">{entry.artist} · +{entry.movementAmount}</div>
              </div>
            </div>
          ))}
          {climbers.length === 0 && <div className="text-[12px] text-[var(--wk-text-faint)]">No climbers this week.</div>}
        </div>

        <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] mb-2">New entries</div>
          {newEntries.map((entry) => (
            <div key={entry.rank} className="flex items-center gap-3 py-2 border-b border-[var(--wk-divider)] last:border-0">
              <div className="text-[12px] font-black text-[var(--wk-brand)] w-5">{entry.rank}</div>
              <div className="h-8 w-8 rounded-md overflow-hidden bg-[var(--wk-surface-raised)]">
                <img src={entry.artworkUrl} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-bold text-[var(--wk-text)] truncate">{entry.title}</div>
                <div className="text-[11px] text-[var(--wk-text-muted)]">{entry.artist}</div>
              </div>
              <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">New</span>
            </div>
          ))}
          {newEntries.length === 0 && <div className="text-[12px] text-[var(--wk-text-faint)]">No new entries this week.</div>}
        </div>
      </div>

      {/* Methodology */}
      <div className="mob-reveal spec-section-hd">Methodology</div>
      <div className="px-5 pb-8">
        <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] p-4">
          <div className="text-[13px] font-bold text-[var(--wk-text)] mb-2">How the charts are compiled</div>
          <div className="text-[12px] text-[var(--wk-text-muted)] leading-relaxed mb-3">{CHART_EDITION.methodology}</div>
          <div className="space-y-2">
            {["Streaming data from Spotify, Apple Music, YouTube, and Boomplay", "Radio airplay across 12 African countries", "Digital activity: social engagement, playlist adds, search volume", "Tracks verified against ISRC and graph relationships"].map((item) => (
              <div key={item} className="flex items-start gap-2 text-[12px] text-[var(--wk-text-muted)]">
                <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--wk-brand)] shrink-0" />
                {item}
              </div>
            ))}
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