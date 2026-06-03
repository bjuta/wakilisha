import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import {
  getChartFamilies,
  getLatestChartEdition,
  getChartEditionEntries,
} from "@/services/chartsPublic/client";
import {
  toChartDirectoryViewModel,
  toChartTrackPlayerModels,
  type ChartDirectoryViewModel,
  type ChartEntryRowViewModel,
} from "@/services/chartsPublic/viewModels";
import { ChartRefreshButton } from "@/components/charts/ChartRefreshButton";

const HERO_IMAGE = "https://readdy.ai/api/search-image?query=abstract%20dark%20minimalist%20music%20visualization%20with%20subtle%20green%20neon%20light%20streaks%20on%20deep%20black%20background%20geometric%20waveforms%20and%20floating%20particles%20premium%20cinematic%20atmosphere%20no%20text%20high%20contrast%20editorial%20photography%20style&width=1600&height=640&seq=charts-hero-01&orientation=landscape";

const GOLD = "#C9A96E";
const SILVER = "#B8C4CE";
const BRONZE = "#C4956A";

function AnimatedCounter({ value, label }: { value: number; label: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 1200;
    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(eased * value));
      if (progress >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [value]);
  return (
    <div className="flex flex-col items-center">
      <div className="text-[28px] md:text-[40px] font-black leading-none text-[var(--wk-brand)]">{display}</div>
      <div className="mt-1 text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">{label}</div>
    </div>
  );
}

function PodiumCard({
  entry,
  rank,
  color,
  onPlay,
  featured,
}: {
  entry: ChartEntryRowViewModel;
  rank: number;
  color: "gold" | "silver" | "bronze";
  onPlay: () => void;
  featured?: boolean;
}) {
  const colors = {
    gold: { border: GOLD, text: GOLD, bg: "rgba(201,169,110,0.08)", label: "1st" },
    silver: { border: SILVER, text: SILVER, bg: "rgba(184,196,206,0.08)", label: "2nd" },
    bronze: { border: BRONZE, text: BRONZE, bg: "rgba(196,149,106,0.08)", label: "3rd" },
  };
  const c = colors[color];

  return (
    <div
      className="relative flex flex-col rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden transition-all duration-300 hover:shadow-xl"
      style={{ borderTopColor: c.border, borderTopWidth: "4px" }}
    >
      {featured && (
        <div className="absolute -inset-px rounded-2xl opacity-25 blur-xl" style={{ backgroundColor: c.border }} />
      )}
      <div className={`relative flex flex-col ${featured ? "p-5 md:p-6" : "p-5"}`}>
        <div className="mb-3 flex items-center gap-2">
          <span className={`font-black leading-none ${featured ? "text-[32px] md:text-[36px]" : "text-[28px]"}`} style={{ color: c.text }}>
            #{rank}
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">{c.label}</span>
        </div>

        <div className={`relative mb-3 w-full overflow-hidden rounded-xl bg-[var(--wk-surface-raised)] ${featured ? "aspect-square" : "aspect-[4/3]"}`}>
          {entry.artworkUrl ? (
            <img src={entry.artworkUrl} alt={entry.title} className="h-full w-full object-cover object-top" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[var(--wk-text-faint)]">
              <i className={`ri-music-2-line ${featured ? "text-4xl" : "text-3xl"}`} />
            </div>
          )}
        </div>

        <div className="mb-2">
          <Link to={`/tracks/${entry.slug}`} className="block truncate text-[15px] font-bold text-[var(--wk-text)] hover:text-[var(--wk-brand)] transition-colors">
            {entry.title}
          </Link>
          <div className="truncate text-[13px] text-[var(--wk-text-muted)]">{entry.artist}</div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {entry.genre && (
            <span className="rounded-full bg-[var(--wk-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--wk-text-muted)]">{entry.genre}</span>
          )}
          {entry.weeksOnChart !== undefined && (
            <span className="text-[10px] text-[var(--wk-text-faint)]">{entry.weeksOnChart} wk{entry.weeksOnChart !== 1 ? "s" : ""}</span>
          )}
          {entry.peakPosition === rank && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: c.bg, color: c.text }}>PEAK</span>
          )}
        </div>

        <button
          onClick={onPlay}
          className={`wk-button wk-button-primary w-full justify-center ${featured ? "text-[13px]" : "text-[12px]"}`}
        >
          <i className="ri-play-fill" /> Play
        </button>
      </div>
    </div>
  );
}

function MovementIndicator({ movement, amount }: { movement?: string; amount?: number }) {
  if (!movement) return null;
  const config: Record<string, { color: string; icon: string }> = {
    up: { color: "var(--wk-success)", icon: "ri-arrow-up-line" },
    down: { color: "var(--wk-danger)", icon: "ri-arrow-down-line" },
    new: { color: "var(--wk-brand)", icon: "ri-star-smile-line" },
    same: { color: "var(--wk-text-faint)", icon: "ri-subtract-line" },
  };
  const c = config[movement] || config.same;
  return (
    <span className="mt-0.5 flex items-center gap-0.5 text-[10px] font-bold" style={{ color: c.color }}>
      <i className={`text-[10px] ${c.icon}`} />
      {amount && amount > 0 ? amount : ""}
    </span>
  );
}

function ChartRow({ entry, onPlay }: { entry: ChartEntryRowViewModel; onPlay: () => void }) {
  const rankColors: Record<number, string> = { 1: GOLD, 2: SILVER, 3: BRONZE };
  return (
    <div className="group flex items-center gap-3 px-4 py-3 transition-all duration-200 hover:bg-[var(--wk-surface-raised)] hover:translate-x-1">
      <div className="flex w-12 shrink-0 flex-col items-center">
        <span className="text-[22px] font-black leading-none" style={{ color: rankColors[entry.rank] || "var(--wk-text-muted)" }}>
          {entry.rank}
        </span>
        <MovementIndicator movement={entry.movement} amount={entry.movementAmount} />
      </div>
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
        {entry.artworkUrl ? (
          <img src={entry.artworkUrl} alt="" className="h-full w-full object-cover object-top" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--wk-text-faint)]">
            <i className="ri-music-2-line text-lg" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <Link to={`/tracks/${entry.slug}`} className="truncate text-[14px] font-bold text-[var(--wk-text)] hover:text-[var(--wk-brand)] transition-colors">
            {entry.title}
          </Link>
          {entry.peakPosition === entry.rank && (
            <span className="shrink-0 rounded-full bg-[var(--wk-brand-soft)] border border-[var(--wk-brand)]/30 px-2 py-0.5 text-[10px] font-bold text-[var(--wk-brand)]">PEAK</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="truncate text-[12px] text-[var(--wk-text-muted)]">{entry.artist}</span>
          {entry.genre && (
            <span className="hidden sm:inline-block rounded-full bg-[var(--wk-bg)] px-2 py-0.5 text-[10px] text-[var(--wk-text-muted)]">{entry.genre}</span>
          )}
        </div>
      </div>
      <div className="hidden shrink-0 flex-col items-end gap-0.5 md:flex">
        {entry.weeksOnChart !== undefined && (
          <span className="text-[11px] text-[var(--wk-text-faint)]">{entry.weeksOnChart} wk{entry.weeksOnChart !== 1 ? "s" : ""}</span>
        )}
        {entry.peakPosition !== undefined && entry.peakPosition !== entry.rank && (
          <span className="text-[11px] text-[var(--wk-text-faint)]">Peak #{entry.peakPosition}</span>
        )}
      </div>
      <button
        onClick={onPlay}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] opacity-0 transition-all duration-200 group-hover:opacity-100 hover:scale-110"
      >
        <i className="ri-play-mini-fill text-sm" />
      </button>
    </div>
  );
}

function SignalStrip({ title, entries, badge }: { title: string; entries: ChartEntryRowViewModel[]; badge: string }) {
  return (
    <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">{title}</div>
        <span className="text-[11px] font-bold text-[var(--wk-brand)]">{entries.length}</span>
      </div>
      <div className="space-y-1">
        {entries.slice(0, 5).map((entry) => (
          <div key={entry.rank} className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-[var(--wk-bg)]">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[10px] font-black text-[var(--wk-brand-on)]">{entry.rank}</div>
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-[var(--wk-surface-raised)]">
              <img src={entry.artworkUrl ?? ""} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-bold text-[var(--wk-text)]">{entry.title}</div>
              <div className="truncate text-[11px] text-[var(--wk-text-muted)]">{entry.artist}</div>
            </div>
            <span className="text-[10px] font-bold text-[var(--wk-brand)]">{badge}</span>
          </div>
        ))}
        {entries.length === 0 && <div className="py-2 text-[12px] text-[var(--wk-text-faint)]">No entries this week.</div>}
      </div>
    </div>
  );
}

export default function ChartsDirectory() {
  const { playTrack } = usePlayer();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; error: string; diagnostics?: string }
    | { status: "empty" }
    | { status: "loaded"; data: ChartDirectoryViewModel }
  >({ status: "loading" });
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const { data: families, meta: familiesMeta } = await getChartFamilies();
      if (families.length === 0) {
        setState({ status: "empty" });
        return;
      }
      const featuredFamily = families[0];
      const featuredSlug = featuredFamily.publicSlug ?? featuredFamily.slug ?? featuredFamily.familyKey;
      const { data: edition, meta: editionMeta } = await getLatestChartEdition(featuredSlug);
      if (!edition) {
        setState({ status: "empty" });
        return;
      }
      const { data: entries } = await getChartEditionEntries(featuredSlug, edition.slug);
      const data = toChartDirectoryViewModel(
        families,
        [edition],
        featuredSlug,
        edition,
        entries,
        editionMeta.source === "cache" ? { ...editionMeta, isStale: editionMeta.isStale || familiesMeta.isStale } : editionMeta
      );
      setState({ status: "loaded", data });
    } catch (err) {
      setState({
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
        diagnostics: err instanceof Error ? err.stack : undefined,
      });
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const handleRetry = () => load();

  const loadedData = state.status === "loaded" ? state.data : null;
  const allTracks = useMemo(() => loadedData ? toChartTrackPlayerModels(loadedData.topEntries) : [], [loadedData]);
  const top10Playlist = useMemo(() => {
    if (!loadedData) return [];
    const list = loadedData.topEntries.slice(0, 10);
    return toChartTrackPlayerModels(list);
  }, [loadedData]);

  const handlePlayTop10 = useCallback(() => {
    if (top10Playlist.length > 0) playTrack(top10Playlist[0], top10Playlist);
  }, [top10Playlist, playTrack]);

  const handlePlay = useCallback((globalIndex: number) => {
    const track = allTracks[globalIndex];
    if (!track) return;
    playTrack(track, allTracks);
  }, [allTracks, playTrack]);

  if (state.status === "loading") {
    return (
      <div className="min-h-screen">
        <section className="relative min-h-[600px] md:min-h-[720px] overflow-hidden flex items-end">
          <div className="absolute inset-0 bg-[var(--wk-bg)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--wk-bg)] via-[var(--wk-bg)]/85 to-[var(--wk-bg)]/30" />
          <div className="relative wk-container px-4 pb-10 pt-20 md:px-6 md:pb-16 md:pt-28 w-full">
            <div className="space-y-4">
              <div className="h-4 w-32 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
              <div className="h-20 w-3/4 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
              <div className="h-10 w-40 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
              <div className="flex gap-6 mt-6">
                <div className="h-8 w-16 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                <div className="h-8 w-16 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                <div className="h-8 w-16 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                <div className="h-8 w-16 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
              </div>
            </div>
          </div>
        </section>
        <section className="relative z-10 -mt-20 px-4 md:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 md:p-8">
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="h-10 w-16 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                  <div className="mt-1 h-3 w-20 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="wk-container px-4 pt-16 md:px-6 md:pt-24">
          <div className="mb-8 text-center">
            <div className="h-3 w-24 mx-auto rounded bg-[var(--wk-surface-raised)] animate-pulse mb-2" />
            <div className="h-8 w-48 mx-auto rounded bg-[var(--wk-surface-raised)] animate-pulse" />
          </div>
          <div className="flex flex-col gap-4 md:hidden">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-80 rounded-2xl bg-[var(--wk-surface-raised)] animate-pulse" />
            ))}
          </div>
          <div className="hidden md:flex items-end justify-center gap-5">
            <div className="w-[300px] pb-4">
              <div className="h-[420px] rounded-2xl bg-[var(--wk-surface-raised)] animate-pulse" />
            </div>
            <div className="w-[340px] pb-10">
              <div className="h-[460px] rounded-2xl bg-[var(--wk-surface-raised)] animate-pulse" />
            </div>
            <div className="w-[300px]">
              <div className="h-[380px] rounded-2xl bg-[var(--wk-surface-raised)] animate-pulse" />
            </div>
          </div>
        </section>
        <section className="wk-container px-4 pt-14 md:px-6 md:pt-20">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <div className="h-3 w-20 rounded bg-[var(--wk-surface-raised)] animate-pulse mb-2" />
              <div className="h-8 w-40 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
            </div>
            <div className="h-5 w-24 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="h-8 w-8 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                  <div className="h-12 w-12 rounded-lg bg-[var(--wk-surface-raised)] animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/2 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                    <div className="h-3 w-1/3 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <div className="h-40 rounded-2xl bg-[var(--wk-surface-raised)] animate-pulse" />
              <div className="h-40 rounded-2xl bg-[var(--wk-surface-raised)] animate-pulse" />
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="min-h-screen">
        <section className="wk-container px-4 py-16 md:px-6 md:py-24">
          <div className="max-w-2xl rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]">
              <i className="ri-error-warning-line text-2xl" />
            </div>
            <div className="wk-eyebrow mb-3">WAKILISHA charts</div>
            <h1 className="wk-h-page">Could not load chart data</h1>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--wk-text-muted)]">
              Something went wrong while fetching the chart directory. Please try again.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <button onClick={handleRetry} className="wk-button wk-button-primary">
                <i className="ri-refresh-line" /> Retry
              </button>
              <button onClick={() => setShowErrorDetails(!showErrorDetails)} className="wk-button wk-button-ghost text-[13px]">
                {showErrorDetails ? "Hide" : "Show"} details
              </button>
            </div>
            {showErrorDetails && (
              <div className="mt-4 rounded-xl bg-[var(--wk-bg)] p-4 font-mono text-[12px] text-[var(--wk-text-soft)] overflow-auto">
                <div className="mb-2 font-bold text-[var(--wk-text)]">Diagnostics</div>
                <div className="space-y-1">
                  <div>Mode: {import.meta.env.VITE_CHARTS_PUBLIC_MODE ?? "mock"}</div>
                  <div>Endpoint: GET /charts</div>
                  <div>Error: {state.error}</div>
                </div>
                {state.diagnostics && <div className="mt-2 text-[var(--wk-text-faint)]">{state.diagnostics}</div>}
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  if (state.status === "empty") {
    return (
      <div className="min-h-screen">
        <section className="wk-container px-4 py-16 md:px-6 md:py-24">
          <div className="max-w-2xl rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
              <i className="ri-bar-chart-box-line text-2xl" />
            </div>
            <div className="wk-eyebrow mb-3">WAKILISHA charts</div>
            <h1 className="wk-h-page">No published chart edition found</h1>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--wk-text-muted)]">
              There are no published chart editions available at the moment. Check back soon.
            </p>
            <div className="mt-6">
              <button onClick={handleRetry} className="wk-button wk-button-primary">
                <i className="ri-refresh-line" /> Refresh
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const data = state.data;
  const featured = data.featuredFamily;
  const edition = data.featuredEdition;
  const topTrack = data.topEntries[0] ?? null;
  const top3 = data.topEntries.slice(0, 3);
  const chartList = data.topEntries.slice(0, 10);
  const newEntries = data.topEntries.filter((e) => e.movement === "new");
  const climbers = data.topEntries
    .filter((e) => e.movement === "up")
    .sort((a, b) => (b.movementAmount ?? 0) - (a.movementAmount ?? 0));

  const latestEditionHref = edition
    ? `/charts/${featured?.slug ?? "weekly-top-40"}/${edition.slug}`
    : `/charts/${featured?.slug ?? "weekly-top-40"}`;

  const totalEditions = data.families.reduce((sum, s) => sum + (s.editionCount ?? 0), 0);

  const metaLine = data.meta.isStale
    ? `Loaded from cache (stale) · Last updated ${new Date(data.meta.fetchedAt).toLocaleString()}`
    : data.meta.dataSource === "cache"
    ? `Loaded from cache · Last updated ${new Date(data.meta.fetchedAt).toLocaleString()}`
    : `Loaded from ${data.meta.dataSource === "mock" ? "mock data" : "WordPress API"} · ${new Date(data.meta.fetchedAt).toLocaleTimeString()}`;

  return (
    <div className="min-h-screen bg-[var(--wk-bg)]">
      {/* Cinematic Hero */}
      <section className="relative min-h-[600px] md:min-h-[720px] overflow-hidden flex items-end">
        {topTrack?.artworkUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${topTrack.artworkUrl})`, filter: "blur(60px) saturate(1.3)", transform: "scale(1.15)" }}
          />
        ) : (
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${HERO_IMAGE})` }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--wk-bg)] via-[var(--wk-bg)]/90 to-[var(--wk-bg)]/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--wk-bg)]/90 via-transparent to-[var(--wk-bg)]/90" />
        <div className="absolute inset-0 bg-[var(--wk-brand)]/[0.04]" />

        <div className="relative wk-container px-4 pb-10 pt-20 md:px-6 md:pb-16 md:pt-28 w-full">
          <div className="max-w-3xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="wk-eyebrow">WAKILISHA charts</div>
              <span className="inline-block h-1 w-1 rounded-full bg-[var(--wk-brand)]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--wk-brand)]">Directory</span>
            </div>

            <h1 className="text-[clamp(52px,8vw,110px)] font-black leading-[0.88] tracking-[-0.06em] text-[var(--wk-text)]">
              {featured?.publicLabel ?? featured?.label ?? "Chart Universe"}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px] text-[var(--wk-text-muted)]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wk-bg)]/80 backdrop-blur-sm px-3 py-1 text-[var(--wk-text)]">
                <i className="ri-calendar-line text-[var(--wk-brand)]" />
                {edition?.weekNumber ? `Week ${edition.weekNumber}` : ""} · {edition?.date ?? ""}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wk-bg)]/80 backdrop-blur-sm px-3 py-1 text-[var(--wk-text)]">
                <i className="ri-bar-chart-box-line text-[var(--wk-brand)]" />
                Top {featured?.entryCount ?? data.stats.entries}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wk-bg)]/80 backdrop-blur-sm px-3 py-1 text-[var(--wk-text)]">
                <i className="ri-global-line text-[var(--wk-brand)]" />
                {featured?.marketLabel ?? "Global"}
              </span>
            </div>

            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--wk-text-soft)]">
              {featured?.description ?? "The definitive index of African music charts."} Track what is rising, what has stayed, and what is breaking through.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button onClick={handlePlayTop10} className="wk-button wk-button-primary">
                <i className="ri-play-fill" /> Listen to top 10
              </button>
              <button className="wk-button wk-button-ghost">
                <i className="ri-share-line" /> Share
              </button>
              <Link to={latestEditionHref} className="hidden md:inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--wk-brand)] whitespace-nowrap">
                View edition <i className="ri-arrow-right-line" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Floating Stats Strip */}
      <section className="relative z-10 -mt-20 px-4 md:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 md:p-8 shadow-lg">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <AnimatedCounter value={data.stats.entries} label="Chart Entries" />
            <AnimatedCounter value={data.stats.series} label="Series" />
            <AnimatedCounter value={totalEditions} label="Editions" />
            <AnimatedCounter value={data.stats.newThisWeek} label="New This Week" />
          </div>
        </div>
      </section>

      {/* Top 3 Podium */}
      {top3.length > 0 && (
        <section className="wk-container px-4 pt-16 md:px-6 md:pt-24">
          <div className="mb-8 text-center">
            <div className="wk-eyebrow mb-2">This Week</div>
            <h2 className="wk-h-section">Top 3 Positions</h2>
          </div>

          {/* Mobile */}
          <div className="flex flex-col gap-4 md:hidden">
            <PodiumCard entry={top3[0]} rank={1} color="gold" onPlay={() => handlePlay(0)} featured />
            {top3[1] && <PodiumCard entry={top3[1]} rank={2} color="silver" onPlay={() => handlePlay(1)} />}
            {top3[2] && <PodiumCard entry={top3[2]} rank={3} color="bronze" onPlay={() => handlePlay(2)} />}
          </div>

          {/* Desktop */}
          <div className="hidden md:flex items-end justify-center gap-5">
            {top3[1] && (
              <div className="w-[300px] pb-4">
                <PodiumCard entry={top3[1]} rank={2} color="silver" onPlay={() => handlePlay(1)} />
              </div>
            )}
            <div className="w-[340px] pb-10">
              <PodiumCard entry={top3[0]} rank={1} color="gold" onPlay={() => handlePlay(0)} featured />
            </div>
            {top3[2] && (
              <div className="w-[300px]">
                <PodiumCard entry={top3[2]} rank={3} color="bronze" onPlay={() => handlePlay(2)} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Chart List + Sidebar */}
      <section className="wk-container px-4 pt-14 md:px-6 md:pt-20">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="wk-eyebrow mb-2">Full Chart</div>
            <h2 className="wk-h-section">Top Positions</h2>
            <p className="mt-1 text-[14px] text-[var(--wk-text-muted)]">
              {edition?.weekNumber ? `Week ${edition.weekNumber} · ` : ""}{edition?.date ?? ""} · Top {featured?.entryCount ?? data.stats.entries}
            </p>
          </div>
          <Link to={latestEditionHref} className="hidden md:inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--wk-brand)] whitespace-nowrap">
            View full chart <i className="ri-arrow-right-line" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
          <div className="overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
            <div className="grid grid-cols-[48px_56px_1fr_80px_40px] items-center gap-3 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] border-b border-[var(--wk-divider)]">
              <div className="text-center">#</div>
              <div></div>
              <div>Track</div>
              <div className="hidden md:block text-right">Stats</div>
              <div></div>
            </div>
            <div className="divide-y divide-[var(--wk-divider)]">
              {chartList.map((entry, idx) => (
                <ChartRow key={entry.rank} entry={entry} onPlay={() => handlePlay(idx)} />
              ))}
            </div>
            <div className="border-t border-[var(--wk-divider)] px-4 py-3">
              <Link to={latestEditionHref} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--wk-brand)]">
                View all {featured?.entryCount ?? data.stats.entries} positions <i className="ri-arrow-right-line" />
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <SignalStrip title="New entries" entries={newEntries} badge="New" />
            <SignalStrip title="Biggest climbers" entries={climbers} badge="Climber" />
          </div>
        </div>
      </section>

      {/* Chart Family Grid */}
      <section className="border-t border-[var(--wk-border)] bg-[var(--wk-surface)] mt-10">
        <div className="wk-container px-4 py-10 md:px-6 md:py-14">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <div className="wk-eyebrow mb-2">Chart families</div>
              <h2 className="wk-h-section">Browse by chart</h2>
            </div>
            <span className="text-[13px] text-[var(--wk-text-muted)]">{data.families.length} active</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.families.map((series) => {
              const href = series.latestEditionSlug
                ? `/charts/${series.slug}/${series.latestEditionSlug}`
                : `/charts/${series.slug}`;
              return (
                <Link
                  key={series.id}
                  to={href}
                  className="group flex flex-col rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-5 transition-all duration-300 hover:border-[var(--wk-border-2)] hover:bg-[var(--wk-surface)] hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors" style={{ backgroundColor: `${series.accentColor}15` }}>
                        <i className={`${series.icon} text-xl`} style={{ color: series.accentColor }} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[16px] font-bold text-[var(--wk-text)]">{series.publicLabel}</div>
                        {series.shortLabel && series.shortLabel !== series.publicLabel && (
                          <div className="text-[11px] text-[var(--wk-text-faint)]">{series.shortLabel}</div>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-brand)] bg-[var(--wk-brand-soft)]">Active</span>
                  </div>

                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-[var(--wk-text-muted)]">
                      <span className="font-semibold text-[var(--wk-text)]">Series:</span> {series.seriesLabel}
                    </span>
                    <span className="text-[var(--wk-text-faint)]">·</span>
                    <span className="text-[11px] text-[var(--wk-text-muted)]">
                      <span className="font-semibold text-[var(--wk-text)]">Market:</span> {series.marketLabel}
                    </span>
                    <span className="text-[var(--wk-text-faint)]">·</span>
                    <span className="text-[11px] text-[var(--wk-text-muted)]">
                      <span className="font-semibold text-[var(--wk-text)]">Mode:</span> {series.chartMode === "data" ? "Data" : series.chartMode === "editorial" ? "Editorial" : "Hybrid"}
                    </span>
                  </div>

                  <div className="mb-4 flex items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                      {topTrack?.artworkUrl ? (
                        <img src={topTrack.artworkUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[var(--wk-text-faint)]">
                          <i className="ri-music-2-line" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-bold text-[var(--wk-text)]">Latest #1</div>
                      <div className="truncate text-[11px] text-[var(--wk-text-muted)]">{topTrack?.title ?? "No data"}</div>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--wk-divider)] pt-4">
                    <div className="flex items-center gap-3 text-[12px] text-[var(--wk-text-muted)]">
                      <span className="font-bold text-[var(--wk-text)]">Top {series.entryCount}</span>
                      <span className="text-[var(--wk-text-faint)]">·</span>
                      <span><span className="font-bold text-[var(--wk-text)]">{series.editionCount}</span> editions</span>
                      {series.latestEditionDate && (
                        <>
                          <span className="text-[var(--wk-text-faint)]">·</span>
                          <span>{series.latestEditionDate}</span>
                        </>
                      )}
                    </div>
                    <i className="ri-arrow-right-line text-[var(--wk-text-faint)] transition-colors group-hover:text-[var(--wk-brand)]" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Recent Editions */}
      <section className="wk-container px-4 py-10 md:px-6 md:py-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="wk-eyebrow mb-2">Archive</div>
            <h2 className="wk-h-section">Recent editions</h2>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
          <div className="hidden grid-cols-[1.5fr_1.5fr_1fr_1fr] gap-3 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] border-b border-[var(--wk-divider)] md:grid">
            <div>Chart</div>
            <div>Edition</div>
            <div className="text-right">Entries</div>
            <div className="text-right">Date</div>
          </div>
          <div className="divide-y divide-[var(--wk-divider)]">
            {data.families
              .filter((f) => f.latestEditionSlug)
              .map((row) => (
                <Link
                  key={`${row.id}-${row.latestEditionSlug}`}
                  to={`/charts/${row.slug}/${row.latestEditionSlug}`}
                  className="grid grid-cols-1 items-center gap-2 px-5 py-3 transition-colors hover:bg-[var(--wk-bg)] md:grid-cols-[1.5fr_1.5fr_1fr_1fr] md:gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-[var(--wk-surface-raised)]">
                      {topTrack?.artworkUrl ? (
                        <img src={topTrack.artworkUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[var(--wk-text-faint)]">
                          <i className="ri-bar-chart-line text-sm" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-[var(--wk-text)]">{row.publicLabel}</div>
                      <div className="text-[11px] text-[var(--wk-text-muted)] md:hidden">{row.latestEditionLabel}</div>
                    </div>
                  </div>
                  <div className="hidden text-[13px] text-[var(--wk-text)] md:block">{row.latestEditionLabel}</div>
                  <div className="text-[12px] font-bold text-[var(--wk-text-muted)] md:text-right">Top {row.entryCount}</div>
                  <div className="text-[12px] text-[var(--wk-text-muted)] md:text-right">{row.latestEditionDate}</div>
                </Link>
              ))}
            {data.families.filter((f) => f.latestEditionSlug).length === 0 && (
              <div className="px-5 py-6 text-[13px] text-[var(--wk-text-muted)]">No recent editions available.</div>
            )}
          </div>
        </div>
      </section>

      {/* Methodology */}
      <section className="border-t border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div className="wk-container px-4 py-10 md:px-6 md:py-14">
          <div className="mb-6">
            <div className="wk-eyebrow mb-2">Trust</div>
            <h2 className="wk-h-section">How the charts are compiled</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: "ri-database-2-line", title: "Verified data", desc: "Streaming data from Spotify, Apple Music, YouTube, and Boomplay." },
              { icon: "ri-radio-line", title: "Radio airplay", desc: "Monitored across 12 African countries and major FM networks." },
              { icon: "ri-line-chart-line", title: "Digital activity", desc: "Social engagement, playlist adds, and search volume combined." },
              { icon: "ri-shield-check-line", title: "Verified tracks", desc: "All tracks verified against ISRC and graph relationship data." },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
                  <i className={`${item.icon} text-lg`} />
                </div>
                <div className="text-[15px] font-bold text-[var(--wk-text)] mb-1">{item.title}</div>
                <div className="text-[13px] leading-[1.6] text-[var(--wk-text-muted)]">{item.desc}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-[13px] font-bold text-[var(--wk-text)] mb-1">Methodology</div>
                <div className="text-[13px] text-[var(--wk-text-muted)]">
                  {edition?.methodology ?? "Combined streaming data from Spotify, Apple Music, YouTube, and Boomplay. Radio airplay monitored across 12 African countries."}
                </div>
              </div>
              <div className="flex items-center gap-4 text-[12px] text-[var(--wk-text-muted)] shrink-0">
                <span><span className="font-bold text-[var(--wk-text)]">{totalEditions}</span> editions</span>
                <span className="text-[var(--wk-text-faint)]">·</span>
                <span><span className="font-bold text-[var(--wk-text)]">{data.stats.entries}</span> entries tracked</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Metadata */}
      <div className="border-t border-[var(--wk-border)] bg-[var(--wk-bg)]">
        <div className="wk-container px-4 py-3 md:px-6 flex items-center justify-between gap-3">
          <div className="text-[11px] text-[var(--wk-text-faint)]">{metaLine}</div>
          <ChartRefreshButton onRefresh={load} size="sm" />
        </div>
      </div>
    </div>
  );
}