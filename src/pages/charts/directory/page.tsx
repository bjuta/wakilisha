import { useMemo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { CHART_DATA, CHART_SERIES, CHART_EDITION } from "@/mocks/charts";
import ChartCredibilityStrip from "../components/ChartCredibilityStrip";
import ChartCulturalAnalysis from "../components/ChartCulturalAnalysis";
import ChartRegionalHeat from "../components/ChartRegionalHeat";
import ChartJourney from "../components/ChartJourney";
import ChartDataSourcesPanel from "../components/ChartDataSourcesPanel";
import ChartCharter from "../components/ChartCharter";

export default function ChartsDirectory() {
  const { playTrack } = usePlayer();
  const heroRef = useRef<HTMLDivElement>(null);

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
    document.querySelectorAll(".reveal").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const topTrack = CHART_DATA[0];
  const climbers = useMemo(
    () => CHART_DATA.filter((e) => e.movement === "up").sort((a, b) => (b.movementAmount ?? 0) - (a.movementAmount ?? 0)).slice(0, 3),
    []
  );
  const newEntries = useMemo(() => CHART_DATA.filter((e) => e.movement === "new").slice(0, 3), []);
  const longRunners = useMemo(() => CHART_DATA.filter((e) => (e.weeksOnChart ?? 0) > 10).sort((a, b) => (b.weeksOnChart ?? 0) - (a.weeksOnChart ?? 0)).slice(0, 3), []);

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

  const seriesList = CHART_SERIES.map((s) => {
    const latestEntry = CHART_DATA[0];
    return {
      ...s,
      status: s.id === "weekly-top-40" ? ("active" as const) : s.id === "rising-voices" ? ("active" as const) : ("experimental" as const),
      latestNo1: latestEntry,
      editions: s.count > 30 ? 48 : s.count > 15 ? 24 : 12,
      sources: Math.floor(s.count / 3),
    };
  });

  const archiveRows = [
    { series: "Weekly Top 40", period: "2024", edition: "Week 132", date: "2024-05-24", no1: CHART_DATA[0], entries: 40, sources: 3, access: "public" },
    { series: "Weekly Top 40", period: "2024", edition: "Week 131", date: "2024-05-17", no1: CHART_DATA[1], entries: 40, sources: 3, access: "public" },
    { series: "Weekly Top 40", period: "2024", edition: "Week 130", date: "2024-05-10", no1: CHART_DATA[2], entries: 40, sources: 3, access: "public" },
    { series: "Rising Voices", period: "2024", edition: "May 2024", date: "2024-05-01", no1: CHART_DATA[3], entries: 20, sources: 2, access: "public" },
    { series: "Genre Pulse", period: "2024", edition: "Q2 2024", date: "2024-04-15", no1: CHART_DATA[4], entries: 25, sources: 2, access: "members" },
  ];

  const genreBreakdown = [
    { genre: "Afrobeats", count: 18, pct: 45 },
    { genre: "Afropop", count: 10, pct: 25 },
    { genre: "Amapiano", count: 6, pct: 15 },
    { genre: "Afrofusion", count: 4, pct: 10 },
    { genre: "R&B", count: 2, pct: 5 },
  ];

  const journeyTracks = CHART_DATA.slice(0, 4);

  const heroBgUrl = 'https://readdy.ai/api/search-image?query=Abstract%20cinematic%20hero%20background%20depicting%20African%20music%20culture%20with%20flowing%20golden%20and%20green%20light%20waves%2C%20geometric%20shapes%20resembling%20vinyl%20records%20and%20sound%20waves%2C%20dark%20moody%20atmosphere%20with%20deep%20black%20and%20forest%20green%20tones%2C%20minimalist%20artistic%20composition%20with%20subtle%20glow%20effects%2C%20perfect%20for%20text%20overlay%20with%20strong%20contrast%20between%20dark%20background%20and%20bright%20text%2C%20stylized%20non-photorealistic%20illustration%20with%20dramatic%20lighting%20and%20abstract%20rhythm%20patterns%2C%20harmonious%20and%20beautiful%20with%20deep%20green%20and%20gold%20accent%20colors%20on%20a%20dark%20canvas&width=1600&height=700&seq=wakilisha-charts-hero-bg&orientation=landscape';

  return (
    <div className="min-h-screen">
      {/* ===== CINEMATIC HERO ===== */}
      <section ref={heroRef} className="relative min-h-[420px] md:min-h-[540px] flex items-end overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${heroBgUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "saturate(1.1)",
            transform: "scale(1.05)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--wk-bg)] via-[var(--wk-bg)]/85 to-[var(--wk-bg)]/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--wk-bg)]/50 via-transparent to-[var(--wk-bg)]/50" />
        <div className="absolute inset-0 bg-black/30" />

        <div className="relative wk-container-wide w-full px-6 pb-10 md:pb-14 pt-20">
          <div className="grid gap-8 lg:grid-cols-[1fr_380px] items-end">
            {/* Left: Text */}
            <div>
              <div className="wk-eyebrow mb-4">WAKILISHA charts</div>
              <h1 className="font-black leading-[0.92] tracking-[-0.055em] text-[var(--wk-text)]" style={{ fontSize: "clamp(40px, 6vw, 78px)" }}>
                The African music<br />chart universe
              </h1>
              <p className="mt-4 max-w-lg text-[15px] leading-relaxed" style={{ color: "var(--wk-text-soft)" }}>
                Track what is rising, what has stayed, and what is new. Weekly rankings compiled from verified data across the African music ecosystem.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link to="/charts/weekly-top-40/week-132" className="wk-button wk-button-primary">
                  <i className="ri-bar-chart-line" />
                  View full chart
                </Link>
                <Link to="/charts/weekly-top-40/week-132" className="wk-button wk-button-ghost">
                  <i className="ri-share-line" />
                  Share
                </Link>
              </div>
            </div>

            {/* Right: Current #1 card */}
            <div className="hidden lg:block">
              <div className="relative rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]/80 backdrop-blur p-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)]">
                    <span className="text-[14px] font-black">1</span>
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">Current #1</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]">
                    <img src={topTrack.artworkUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-[18px] font-black text-[var(--wk-text)]">{topTrack.title}</h3>
                    <div className="truncate text-[14px] text-[var(--wk-text-muted)]">{topTrack.artist}</div>
                    <div className="mt-2 flex items-center gap-3 text-[12px] text-[var(--wk-text-faint)]">
                      <span className="inline-flex items-center gap-1 text-[var(--wk-success)]">
                        <i className="ri-arrow-up-line" /> {topTrack.movementAmount}
                      </span>
                      <span>{topTrack.weeksOnChart} weeks</span>
                      <span>{topTrack.genre}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <button onClick={() => handlePlay(0)} className="wk-button wk-button-primary flex-1 justify-center">
                    <i className="ri-play-fill" /> Play
                  </button>
                  <Link to={`/tracks/${topTrack.slug}`} className="wk-button wk-button-ghost flex-1 justify-center">
                    <i className="ri-file-list-line" /> Details
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CREDIBILITY STRIP ===== */}
      <ChartCredibilityStrip />

      {/* ===== MAIN — FULL WIDTH ===== */}
      <div className="wk-container-wide px-6 py-10 md:py-14">
        {/* ========== MUSIC: THE CHART ========== */}
        <div className="reveal">
          <div className="mb-5 flex items-center justify-between">
            <div className="wk-eyebrow">Current edition</div>
            <Link to="/charts/weekly-top-40/week-132" className="text-[12px] font-semibold text-[var(--wk-brand)]">
              Full chart <i className="ri-arrow-right-line" />
            </Link>
          </div>
          <div className="cdir-feature">
            <div className="cdir-feature-hdr">
              <div>
                <div className="cdir-feature-badge">Current edition</div>
                <div className="cdir-feature-title mt-1">Weekly Top 40 — Week {CHART_EDITION.weekNumber}</div>
                <div className="cdir-feature-ed">{CHART_EDITION.date} · {CHART_EDITION.totalEntries} entries · {CHART_EDITION.totalArtists} artists</div>
              </div>
              {/* Compact genre pills inline with header */}
              <div className="hidden lg:flex items-center gap-1.5 flex-wrap">
                {genreBreakdown.map((g) => (
                  <span key={g.genre} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)] border border-[var(--wk-border)]">
                    {g.genre} <span className="text-[var(--wk-brand)]">{g.count}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="cdir-top1">
              <div className="cdir-top1-rank">1</div>
              <div className="cdir-top1-art">
                <img src={CHART_DATA[0].artworkUrl} alt="" />
              </div>
              <div>
                <div className="cdir-top1-track">{CHART_DATA[0].title}</div>
                <div className="cdir-top1-artist">{CHART_DATA[0].artist}</div>
                <div className="cdir-top1-chips">
                  <span className="cdir-top1-chip up">Up {CHART_DATA[0].movementAmount}</span>
                  <span className="cdir-top1-chip">{CHART_DATA[0].weeksOnChart} weeks</span>
                  <span className="cdir-top1-chip">Peak #{CHART_DATA[0].peakPosition}</span>
                </div>
              </div>
              <div className="cdir-top1-actions">
                <button onClick={() => handlePlay(0)} className="cdir-play" aria-label="Play">
                  <i className="ri-play-fill" />
                </button>
              </div>
            </div>
            <div className="divide-y divide-[var(--wk-divider)]">
              {CHART_DATA.slice(1, 11).map((entry, idx) => (
                <div key={entry.rank} className="cdir-row">
                  <div className="cdir-row-rank">{entry.rank}</div>
                  <div className="cdir-row-art">
                    <img src={entry.artworkUrl} alt="" />
                  </div>
                  <div className="min-w-0">
                    <div className="cdir-row-title">{entry.title}</div>
                    <div className="cdir-row-artist">{entry.artist}</div>
                  </div>
                  <div className="cdir-row-delta" style={{ color: entry.movement === "up" ? "var(--wk-success)" : entry.movement === "down" ? "var(--wk-danger)" : "var(--wk-text-faint)" }}>
                    {entry.movement === "up" && <i className="ri-arrow-up-line" />}
                    {entry.movement === "down" && <i className="ri-arrow-down-line" />}
                    {entry.movement === "new" && <span className="text-[var(--wk-brand)]">New</span>}
                    {entry.movement === "same" && <i className="ri-subtract-line" />}
                    {entry.movementAmount && entry.movementAmount > 0 ? entry.movementAmount : ""}
                  </div>
                  <div className="cdir-row-weeks">{entry.weeksOnChart}w</div>
                  <button onClick={() => handlePlay(idx + 1)} className="cdir-play sm" aria-label="Play">
                    <i className="ri-play-mini-fill" />
                  </button>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-[var(--wk-divider)]">
              <Link to="/charts/weekly-top-40/week-132" className="text-[12px] font-semibold text-[var(--wk-brand)]">
                View all {CHART_DATA.length} positions <i className="ri-arrow-right-line" />
              </Link>
            </div>
          </div>
        </div>

        {/* ========== MUSIC: PLAYABLE RAIL ========== */}
        <div className="reveal mt-10 md:mt-14">
          <div className="mb-5 flex items-center justify-between">
            <div className="wk-eyebrow">Playable preview</div>
            <span className="text-[11px] text-[var(--wk-text-faint)]">{CHART_DATA.filter(e => e.isPlayable).length} tracks available</span>
          </div>
          <div className="cdir-play-rail">
            {CHART_DATA.filter((e) => e.isPlayable).slice(0, 10).map((entry, idx) => (
              <button key={entry.rank} onClick={() => handlePlay(idx)} className="cdir-play-card text-left">
                <div className="cdir-play-card-art">
                  <img src={entry.artworkUrl} alt="" />
                  <div className="cdir-play-card-overlay">
                    <div className="cdir-play-card-playbtn">
                      <i className="ri-play-fill" />
                    </div>
                  </div>
                </div>
                <div className="cdir-play-card-body">
                  <div className="cdir-play-card-title">{entry.title}</div>
                  <div className="cdir-play-card-artist">{entry.artist}</div>
                  <div className="cdir-play-card-src">{entry.source}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ========== MUSIC + EDITORIAL: SIGNALS + CHARTER SIDE BY SIDE ========== */}
        <div className="reveal mt-10 md:mt-14 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          {/* Left: Signals */}
          <div>
            <div className="mb-4">
              <div className="wk-eyebrow">Movement signals</div>
            </div>
            <div className="cdir-signals">
              <div className="csignal-card">
                <div className="csignal-label">Climbers</div>
                {climbers.map((entry) => (
                  <div key={entry.rank} className="csignal-item">
                    <div className="csignal-pos">{entry.rank}</div>
                    <div className="csignal-art">
                      <img src={entry.artworkUrl} alt="" />
                    </div>
                    <div className="min-w-0">
                      <div className="csignal-track">{entry.title}</div>
                      <div className="csignal-meta">{entry.artist} · +{entry.movementAmount}</div>
                    </div>
                  </div>
                ))}
                {climbers.length === 0 && (
                  <div className="py-3 text-[12px] text-[var(--wk-text-faint)]">No climbers this week.</div>
                )}
              </div>
              <div className="csignal-card">
                <div className="csignal-label">New entries</div>
                {newEntries.map((entry) => (
                  <div key={entry.rank} className="csignal-item">
                    <div className="csignal-pos">{entry.rank}</div>
                    <div className="csignal-art">
                      <img src={entry.artworkUrl} alt="" />
                    </div>
                    <div className="min-w-0">
                      <div className="csignal-track">{entry.title}</div>
                      <div className="csignal-meta">{entry.artist}</div>
                    </div>
                    <span className="csignal-badge new-e">New</span>
                  </div>
                ))}
                {newEntries.length === 0 && (
                  <div className="py-3 text-[12px] text-[var(--wk-text-faint)]">No new entries this week.</div>
                )}
              </div>
              <div className="csignal-card">
                <div className="csignal-label">Long runners</div>
                {longRunners.map((entry) => (
                  <div key={entry.rank} className="csignal-item">
                    <div className="csignal-pos">{entry.rank}</div>
                    <div className="csignal-art">
                      <img src={entry.artworkUrl} alt="" />
                    </div>
                    <div className="min-w-0">
                      <div className="csignal-track">{entry.title}</div>
                      <div className="csignal-meta">{entry.artist} · {entry.weeksOnChart} weeks</div>
                    </div>
                    <span className="csignal-badge long">{entry.weeksOnChart}w</span>
                  </div>
                ))}
                {longRunners.length === 0 && (
                  <div className="py-3 text-[12px] text-[var(--wk-text-faint)]">No long runners this week.</div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Compact milestones + editorial */}
          <div className="space-y-4">
            {/* Compact milestones */}
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] mb-3">This week</div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-[var(--wk-brand-soft)] flex items-center justify-center shrink-0">
                    <i className="ri-trophy-line text-[var(--wk-brand)]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] font-bold text-[var(--wk-text)]">{CHART_EDITION.longestRunning.title}</div>
                    <div className="text-[11px] text-[var(--wk-text-muted)]">{CHART_EDITION.longestRunning.weeks} weeks — longest running</div>
                  </div>
                </div>
                <div className="h-px bg-[var(--wk-divider)]" />
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-[var(--wk-success-soft)] flex items-center justify-center shrink-0">
                    <i className="ri-arrow-up-line text-[var(--wk-success)]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] font-bold text-[var(--wk-text)]">{CHART_EDITION.biggestMover.title}</div>
                    <div className="text-[11px] text-[var(--wk-text-muted)]">+{CHART_EDITION.biggestMover.amount} positions — biggest climb</div>
                  </div>
                </div>
                <div className="h-px bg-[var(--wk-divider)]" />
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-[var(--wk-info-soft)] flex items-center justify-center shrink-0">
                    <i className="ri-star-line text-[var(--wk-info)]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] font-bold text-[var(--wk-text)]">{CHART_EDITION.newEntries} new entries</div>
                    <div className="text-[11px] text-[var(--wk-text-muted)]">Fresh tracks entering the chart</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Compact editor note */}
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
              <div className="flex items-center gap-2 mb-2">
                <i className="ri-quill-pen-line text-[var(--wk-brand)]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">Editor's Note</span>
              </div>
              <p className="text-[13px] leading-[1.6] text-[var(--wk-text-soft)]">
                <strong className="text-[var(--wk-text)]">Oxlade's "Alone"</strong> reaches #1 after 8 weeks of steady growth — driven by radio playlist adds across Lagos, Accra, and London. <strong className="text-[var(--wk-text)]">Asake's "Sungba"</strong> enters at #9 as the only Amapiano new entry this week. Amapiano now makes up 15% of the Top 40, up from 8% three months ago.
              </p>
              <Link to="/magazine" className="mt-2 inline-flex text-[11px] font-semibold text-[var(--wk-brand)] items-center gap-1">
                Full analysis <i className="ri-arrow-right-line" />
              </Link>
            </div>
          </div>
        </div>

        {/* ========== MUSIC: JOURNEYS ========== */}
        <div className="reveal mt-10 md:mt-14">
          <div className="mb-5 flex items-center justify-between">
            <div className="wk-eyebrow">Chart Journeys</div>
            <span className="text-[11px] text-[var(--wk-text-faint)]">Week-by-week trajectories</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {journeyTracks.map((track) => (
              <ChartJourney key={track.slug} trackSlug={track.slug} />
            ))}
          </div>
        </div>

        {/* ========== MUSIC: SERIES GRID ========== */}
        <div className="reveal mt-10 md:mt-14">
          <div className="mb-5 flex items-center justify-between">
            <div className="wk-eyebrow">Chart series</div>
            <Link to="/charts/weekly-top-40" className="text-[12px] font-semibold text-[var(--wk-brand)]">
              All series <i className="ri-arrow-right-line" />
            </Link>
          </div>
          <div className="cdir-series-grid">
            {seriesList.map((s) => (
              <Link key={s.id} to={`/charts/${s.id}`} className="cseries-card">
                <div className="cseries-card-head">
                  <div className="min-w-0">
                    <div className="cseries-card-name">{s.label}</div>
                    <div className="cseries-card-desc">{s.description}</div>
                  </div>
                  <span className={`cseries-status ${s.status}`}>{s.status}</span>
                </div>
                <div className="cseries-card-body">
                  <div className="cseries-card-art">
                    <img src={s.latestNo1?.artworkUrl} alt="" />
                  </div>
                  <div className="min-w-0">
                    <div className="cseries-top-track">{s.latestNo1?.title}</div>
                    <div className="cseries-top-artist">Latest #1 · {s.latestNo1?.artist}</div>
                  </div>
                </div>
                <div className="cseries-card-foot">
                  <div className="cseries-meta-item">
                    <span className="cseries-meta-val">{s.editions}</span>
                    <span className="cseries-meta-lbl">Editions</span>
                  </div>
                  <div className="cseries-meta-item">
                    <span className="cseries-meta-val">{s.count}</span>
                    <span className="cseries-meta-lbl">Entries</span>
                  </div>
                  <div className="cseries-meta-item">
                    <span className="cseries-meta-val">{s.sources}</span>
                    <span className="cseries-meta-lbl">Sources</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ========== EDITORIAL: CULTURAL ANALYSIS ========== */}
        <div className="mt-10 md:mt-14">
          <ChartCulturalAnalysis
            biggestMoverTitle={CHART_EDITION.biggestMover.title}
            biggestMoverArtist={CHART_EDITION.biggestMover.artist}
            biggestMoverAmount={CHART_EDITION.biggestMover.amount}
            longestRunningTitle={CHART_EDITION.longestRunning.title}
            longestRunningArtist={CHART_EDITION.longestRunning.artist}
            longestRunningWeeks={CHART_EDITION.longestRunning.weeks}
            newEntryCount={CHART_EDITION.newEntries}
          />
        </div>

        {/* ========== DATA: REGIONAL + SOURCES ========== */}
        <div className="mt-10 md:mt-14 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartRegionalHeat />
          <ChartDataSourcesPanel />
        </div>

        {/* ========== EDITORIAL: CHARTER ========== */}
        <div className="mt-10 md:mt-14">
          <ChartCharter />
        </div>

        {/* ========== MUSIC: ARCHIVE ========== */}
        <div className="reveal mt-10 md:mt-14">
          <div className="mb-5 flex items-center justify-between">
            <div className="wk-eyebrow">Archive</div>
            <div className="flex items-center gap-2">
              <button className="cdir-filter-chip on">All</button>
              <button className="cdir-filter-chip">2024</button>
              <button className="cdir-filter-chip">2023</button>
            </div>
          </div>
          <div className="cdir-archive">
            <div className="cdir-archive-hdr">
              <div className="cdir-archive-title">Past editions</div>
            </div>
            <div className="cdir-archive-thead">
              <div className="cdir-archive-col-head">Series</div>
              <div className="cdir-archive-col-head">#1 Track</div>
              <div className="cdir-archive-col-head">Entries</div>
              <div className="cdir-archive-col-head">Sources</div>
              <div className="cdir-archive-col-head" />
              <div className="cdir-archive-col-head">Access</div>
            </div>
            {archiveRows.map((row) => (
              <div key={`${row.series}-${row.edition}`} className="cdir-archive-row">
                <div className="min-w-0">
                  <div className="cdir-archive-series">{row.series}</div>
                  <div className="cdir-archive-ed">
                    <span className="cdir-archive-ed-period">{row.edition}</span>
                    <span className="cdir-archive-date"> · {row.date}</span>
                  </div>
                </div>
                <div className="cdir-no1-thumb">
                  <div className="cdir-no1-thumb-art">
                    <img src={row.no1.artworkUrl} alt="" />
                  </div>
                  <div className="cdir-no1-thumb-title">{row.no1.title}</div>
                </div>
                <div className="cdir-archive-ed-date">{row.entries}</div>
                <div className="cdir-archive-ed-date">{row.sources}</div>
                <div />
                <div>
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${row.access === "public" ? "text-[var(--wk-success)]" : "text-[var(--wk-warning)]"}`}>
                    {row.access}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== ANIMATION STYLES ===== */}
      <style>{`
        .reveal {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .reveal.in-view {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
}