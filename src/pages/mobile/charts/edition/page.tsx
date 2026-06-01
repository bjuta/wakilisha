import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { ChartRow } from "@/components/design-system/music/ChartRow";
import { SkeletonChartRow } from "@/components/skeletons/Skeletons";
import {
  getChartFamily,
  getLatestChartEdition,
  getChartEdition,
  getChartEditionEntries,
  getChartEditionsForFamily,
} from "@/services/chartsPublic/client";
import {
  toChartEditionViewModel,
  toChartEntryRowViewModel,
  toChartTrackPlayerModel,
  toChartArchiveViewModel,
  type ChartEditionViewModel,
  type ChartEntryRowViewModel,
  type ChartArchiveViewModel,
} from "@/services/chartsPublic/viewModels";
import { ChartRefreshButton } from "@/components/charts/ChartRefreshButton";

export default function MobileChartEdition() {
  const { series, edition: editionSlug } = useParams<{
    series: string;
    edition: string;
  }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDiagnostics, setErrorDiagnostics] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [notFound, setNotFound] = useState<"family" | "edition" | null>(null);
  const [edition, setEdition] = useState<ChartEditionViewModel | null>(null);
  const [entries, setEntries] = useState<ChartEntryRowViewModel[]>([]);
  const [familyLabel, setFamilyLabel] = useState("WAKILISHA Charts");
  const [familySlug, setFamilySlug] = useState("");
  const [publicSlug, setPublicSlug] = useState("");
  const [latestEditionSlug, setLatestEditionSlug] = useState<string | undefined>(undefined);
  const [archive, setArchive] = useState<ChartArchiveViewModel | null>(null);
  const [meta, setMeta] = useState<{ dataSource: "mock" | "wordpress" | "cache"; fetchedAt: string; isStale: boolean } | null>(null);
  const { playTrack } = usePlayer();

  const load = useCallback(async () => {
    if (!series) {
      setNotFound("family");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setErrorDiagnostics(null);
    setNotFound(null);
    try {
      const { data: family } = await getChartFamily(series);
      if (!family) {
        setNotFound("family");
        setLoading(false);
        return;
      }
      setFamilyLabel(family.label);
      setFamilySlug(series);
      setPublicSlug(family.publicSlug ?? family.slug ?? series);

      let editionResult: Awaited<ReturnType<typeof getChartEdition>>;
      if (editionSlug) {
        editionResult = await getChartEdition(series, editionSlug);
      } else {
        editionResult = await getLatestChartEdition(series);
      }

      if (!editionResult.data) {
        const { data: latest } = await getLatestChartEdition(series);
        setLatestEditionSlug(latest.data?.slug);
        setNotFound("edition");
        setLoading(false);
        return;
      }

      setMeta(editionResult.meta);

      const { data: rawEntries } = await getChartEditionEntries(series, editionResult.data.slug);
      const mappedEntries = rawEntries.map(toChartEntryRowViewModel);
      const editionVM = toChartEditionViewModel(editionResult.data, family, rawEntries);

      const { data: allEditions } = await getChartEditionsForFamily(series);
      const entriesMap: Record<string, import("@/services/chartsPublic/types").ChartEditionEntry[]> = {
        [editionResult.data.slug]: rawEntries,
      };
      const archiveVM = toChartArchiveViewModel(allEditions, entriesMap);

      setEdition(editionVM);
      setEntries(mappedEntries);
      setArchive(archiveVM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setErrorDiagnostics(err instanceof Error ? err.stack : null);
    } finally {
      setLoading(false);
    }
  }, [series, editionSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const top3 = useMemo(() => entries.slice(0, 3), [entries]);
  const restOfChart = useMemo(() => entries.slice(3), [entries]);

  const chartTracks = useMemo(
    () => entries.map(toChartTrackPlayerModel),
    [entries]
  );

  const handlePlayChart = (idx: number) => {
    const track = chartTracks[idx];
    if (!track) return;
    playTrack(track, chartTracks);
  };

  const handlePlayTop10 = () => {
    const top10 = chartTracks.slice(0, 10);
    if (top10.length > 0) playTrack(top10[0], top10);
  };

  const stats = useMemo(() => {
    if (!edition) return [];
    return [
      { label: "Entries", value: edition.totalEntries },
      { label: "Artists", value: edition.totalArtists },
      { label: "New", value: edition.newEntries },
    ];
  }, [edition]);

  const genreBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    entries.forEach((e) => {
      const g = e.genre || "Unknown";
      counts[g] = (counts[g] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([genre, count]) => ({ genre, count }));
  }, [entries]);

  const metaLine = meta?.isStale
    ? `Loaded from cache (stale) · ${new Date(meta.fetchedAt).toLocaleString()}`
    : meta?.dataSource === "cache"
    ? `Loaded from cache · ${new Date(meta.fetchedAt).toLocaleString()}`
    : meta
    ? `Loaded from ${meta.dataSource === "mock" ? "mock data" : "WordPress API"}`
    : "";

  if (loading) {
    return (
      <div className="min-h-screen pb-24">
        <section className="relative min-h-[480px] flex items-end overflow-hidden">
          <div className="absolute inset-0 bg-[var(--wk-surface-raised)] animate-pulse" />
          <div className="relative w-full px-5 pb-10 pt-20">
            <div className="h-4 w-32 rounded bg-[var(--wk-surface-raised)] animate-pulse mb-3" />
            <div className="h-12 w-3/4 rounded bg-[var(--wk-surface-raised)] animate-pulse mb-3" />
            <div className="h-4 w-1/2 rounded bg-[var(--wk-surface-raised)] animate-pulse mb-5" />
            <div className="flex gap-3">
              <div className="h-10 w-32 rounded-full bg-[var(--wk-surface-raised)] animate-pulse" />
              <div className="h-10 w-32 rounded-full bg-[var(--wk-surface-raised)] animate-pulse" />
            </div>
            <div className="mt-6 h-32 rounded-2xl bg-[var(--wk-surface-raised)] animate-pulse" />
          </div>
        </section>
        <div className="grid grid-cols-3 gap-px border-b border-[var(--wk-border)]" style={{ background: "var(--wk-border)" }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-[var(--wk-surface)] px-4 py-3 text-center">
              <div className="h-5 w-8 rounded bg-[var(--wk-surface-raised)] animate-pulse mx-auto mb-1" />
              <div className="h-3 w-12 rounded bg-[var(--wk-surface-raised)] animate-pulse mx-auto" />
            </div>
          ))}
        </div>
        <div className="px-5 py-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonChartRow key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pb-24 px-5 py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--wk-danger-soft)] text-[var(--wk-danger)] mx-auto">
          <i className="ri-error-warning-line text-2xl" />
        </div>
        <h1 className="text-[16px] font-bold text-[var(--wk-text)] mb-2">Could not load chart data</h1>
        <p className="text-[13px] text-[var(--wk-text-muted)] mb-4">{error}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={load} className="wk-button wk-button-primary text-[13px]">
            <i className="ri-refresh-line" /> Retry
          </button>
          <Link to="/charts" className="wk-button wk-button-ghost text-[13px]">
            <i className="ri-arrow-left-line" /> Back
          </Link>
        </div>

        {/* Diagnostics */}
        <div className="mt-6">
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="text-[12px] text-[var(--wk-text-muted)] flex items-center gap-1 mx-auto"
          >
            <i className={`ri-${showDiagnostics ? "arrow-up" : "arrow-down"}-s-line`} />
            {showDiagnostics ? "Hide" : "Show"} diagnostics
          </button>
          {showDiagnostics && (
            <div className="mt-3 text-left rounded-lg bg-[var(--wk-bg)] p-3 space-y-1 font-mono text-[11px] text-[var(--wk-text-soft)]">
              <div className="grid grid-cols-[100px_1fr] gap-1">
                <span className="text-[var(--wk-text-faint)]">Mode</span>
                <span>{import.meta.env.VITE_CHARTS_PUBLIC_MODE ?? "mock"}</span>
                <span className="text-[var(--wk-text-faint)]">Family slug</span>
                <span>{series ?? "—"}</span>
                <span className="text-[var(--wk-text-faint)]">Edition slug</span>
                <span>{editionSlug ?? "latest"}</span>
                <span className="text-[var(--wk-text-faint)]">Endpoint</span>
                <span>GET /charts/{series}{editionSlug ? `/${editionSlug}` : "/latest"}</span>
                <span className="text-[var(--wk-text-faint)]">Error</span>
                <span className="text-[var(--wk-danger)]">{error}</span>
                <span className="text-[var(--wk-text-faint)]">Retryable</span>
                <span>{error.includes("timeout") || error.includes("Network") ? "Yes" : "No"}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (notFound === "family") {
    return (
      <div className="min-h-screen pb-24 px-5 py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--wk-brand-soft)] text-[var(--wk-brand)] mx-auto">
          <i className="ri-bar-chart-box-line text-2xl" />
        </div>
        <h1 className="text-[16px] font-bold text-[var(--wk-text)] mb-2">Chart not found</h1>
        <p className="text-[13px] text-[var(--wk-text-muted)] mb-4">The chart series you are looking for does not exist.</p>
        <Link to="/charts" className="wk-button wk-button-primary text-[13px]">
          <i className="ri-arrow-left-line" /> Back to charts
        </Link>
      </div>
    );
  }

  if (notFound === "edition") {
    return (
      <div className="min-h-screen pb-24 px-5 py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--wk-brand-soft)] text-[var(--wk-brand)] mx-auto">
          <i className="ri-bar-chart-box-line text-2xl" />
        </div>
        <h1 className="text-[16px] font-bold text-[var(--wk-text)] mb-2">Edition not found</h1>
        <p className="text-[13px] text-[var(--wk-text-muted)] mb-4">
          The edition <code className="font-mono text-[11px] bg-[var(--wk-bg)] px-1 rounded">{editionSlug}</code> does not exist.
        </p>
        <div className="flex gap-3 justify-center">
          {latestEditionSlug && (
            <Link to={`/charts/${series}/${latestEditionSlug}`} className="wk-button wk-button-primary text-[13px]">
              <i className="ri-arrow-right-line" /> Latest edition
            </Link>
          )}
          <Link to="/charts" className="wk-button wk-button-ghost text-[13px]">
            <i className="ri-arrow-left-line" /> Back
          </Link>
        </div>
      </div>
    );
  }

  if (!edition || entries.length === 0) {
    return (
      <div className="min-h-screen pb-24 px-5 py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--wk-brand-soft)] text-[var(--wk-brand)] mx-auto">
          <i className="ri-bar-chart-box-line text-2xl" />
        </div>
        <h1 className="text-[16px] font-bold text-[var(--wk-text)] mb-2">No published chart edition found</h1>
        <p className="text-[13px] text-[var(--wk-text-muted)] mb-4">There are no entries for this chart edition yet.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={load} className="wk-button wk-button-primary text-[13px]">
            <i className="ri-refresh-line" /> Refresh
          </button>
          <Link to="/charts" className="wk-button wk-button-ghost text-[13px]">
            <i className="ri-arrow-left-line" /> Back
          </Link>
        </div>
      </div>
    );
  }

  const topTrack = entries[0];

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
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--wk-bg)] via-[var(--wk-bg)]/80 to-[var(--wk-bg)]/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--wk-bg)]/60 via-transparent to-[var(--wk-bg)]/60" />

        <div className="relative w-full px-5 pb-10 pt-20">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] mb-3 flex items-center gap-2">
            <span className="w-5 h-px bg-[var(--wk-brand)]" />
            WAKILISHA charts
          </div>
          {/* Taxonomy-aware title */}
          <h1
            className="font-black leading-[0.92] tracking-[-0.055em] text-[var(--wk-text)]"
            style={{ fontSize: "clamp(28px, 9vw, 42px)" }}
          >
            {edition.publicLabel ?? `${edition.seriesLabel} · ${edition.marketLabel}`}
          </h1>
          <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-[var(--wk-text-soft)]">
            {edition.label}
          </p>
          {/* Taxonomy chips */}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--wk-brand)]/30 bg-[var(--wk-brand)]/10 px-2.5 py-0.5 text-[10px] font-semibold text-[var(--wk-brand)]">
              {edition.seriesLabel}
            </span>
            <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-white/80">
              {edition.marketLabel}
            </span>
            <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] text-white/70">
              {edition.methodologyVersion}
            </span>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={handlePlayTop10}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-3 text-[13px] font-bold text-[var(--wk-brand-on)] whitespace-nowrap active:scale-[0.97] transition-transform"
            >
              <i className="ri-play-fill" /> Listen to top 10
            </button>
            <button className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border-2)] bg-transparent px-5 py-3 text-[13px] font-bold text-[var(--wk-text)] whitespace-nowrap active:scale-[0.97] transition-transform">
              <i className="ri-share-line" /> Share
            </button>
          </div>

          {/* Current #1 card */}
          <div className="mt-6 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]/80 backdrop-blur p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)]">
                <span className="text-[12px] font-black">1</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">Current #1</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]">
                <img src={topTrack.artworkUrl} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-[16px] font-black text-[var(--wk-text)]">{topTrack.title}</h3>
                <div className="truncate text-[13px] text-[var(--wk-text-muted)]">{topTrack.artist}</div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)]">
                  <span className="inline-flex items-center gap-1 text-[var(--wk-success)]">
                    <i className="ri-arrow-up-line" /> {topTrack.movementAmount}
                  </span>
                  <span>{topTrack.weeksOnChart} weeks</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Edition header */}
      <div className="border-y border-[var(--wk-border)] px-5 py-3 flex items-center justify-between text-[11px] text-[var(--wk-text-muted)]">
        <span className="font-bold text-[var(--wk-text)]">{edition.date}</span>
        <span>{edition.weekNumber ? `Week ${edition.weekNumber}` : edition.label}</span>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-px border-b border-[var(--wk-border)]" style={{ background: "var(--wk-border)" }}>
        {stats.map((stat) => (
          <div key={stat.label} className="bg-[var(--wk-surface)] px-4 py-3 text-center">
            <div className="text-[18px] font-black text-[var(--wk-brand)]">{stat.value}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Archive switcher */}
      {archive && archive.previous.length > 0 && (
        <div className="px-5 py-4 border-b border-[var(--wk-border)]">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Edition history</div>
          <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-none" style={{ scrollbarWidth: "none" }}>
            {archive.latest && (
              <Link
                to={`/charts/${publicSlug || familySlug}/${archive.latest.slug}`}
                className={`flex-none snap-start rounded-xl border p-3 w-[140px] ${
                  archive.latest.slug === edition.slug
                    ? "border-[var(--wk-brand)] bg-[var(--wk-brand)]/5"
                    : "border-[var(--wk-border)] bg-[var(--wk-surface)]"
                }`}
              >
                <div className="text-[10px] font-bold text-[var(--wk-brand)] mb-0.5">Latest</div>
                <div className="text-[12px] font-bold text-[var(--wk-text)] truncate">{archive.latest.label}</div>
                <div className="text-[10px] text-[var(--wk-text-muted)]">{archive.latest.entryCount} entries</div>
              </Link>
            )}
            {archive.previous.map((item) => (
              <Link
                key={item.slug}
                to={`/charts/${publicSlug || familySlug}/${item.slug}`}
                className={`flex-none snap-start rounded-xl border p-3 w-[140px] ${
                  item.slug === edition.slug
                    ? "border-[var(--wk-brand)] bg-[var(--wk-brand)]/5"
                    : "border-[var(--wk-border)] bg-[var(--wk-surface)]"
                }`}
              >
                <div className="text-[12px] font-bold text-[var(--wk-text)] truncate">{item.label}</div>
                <div className="text-[10px] text-[var(--wk-text-muted)]">{item.entryCount} entries</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Top 3 */}
      <div className="px-5 py-6">
        <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Top 3</div>
        <div className="space-y-3">
          {top3.map((entry, i) => (
            <Link
              key={entry.rank}
              to={`/tracks/${entry.slug}`}
              className="group flex items-center gap-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 transition-all hover:border-[var(--wk-brand)]/40 active:scale-[0.98] active:opacity-80"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]">
                <span className="font-black text-[22px] text-[var(--wk-brand)]">{i + 1}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-[14px] font-bold text-[var(--wk-text)]">{entry.title}</h3>
                  {entry.movement === "new" && (
                    <span className="shrink-0 rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[9px] font-bold text-[var(--wk-brand)] uppercase">New</span>
                  )}
                </div>
                <div className="truncate text-[12px] text-[var(--wk-text-muted)]">{entry.artist}</div>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--wk-text-faint)]">
                  <span>{entry.weeksOnChart} weeks</span>
                  {entry.peakPosition === entry.rank && <span className="text-[var(--wk-brand)]">· Peak</span>}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePlayChart(i);
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] opacity-0 transition-all group-hover:opacity-100"
                aria-label="Play"
              >
                <i className="ri-play-fill text-sm" />
              </button>
              <div className="flex items-center gap-1 text-[12px] font-bold">
                {entry.movement === "up" && <i className="ri-arrow-up-line text-[var(--wk-success)]" />}
                {entry.movement === "down" && <i className="ri-arrow-down-line text-[var(--wk-danger)]" />}
                {entry.movement === "same" && <i className="ri-subtract-line text-[var(--wk-text-faint)]" />}
                {entry.movementAmount && entry.movementAmount > 0 && (
                  <span
                    style={{
                      color: entry.movement === "up" ? "var(--wk-success)" : entry.movement === "down" ? "var(--wk-danger)" : "var(--wk-text-faint)",
                    }}
                  >
                    {entry.movementAmount}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Main chart body */}
      <div className="px-5 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
            Positions 4–{entries.length}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[var(--wk-text-faint)]">
            <span className="inline-flex items-center gap-1">
              <i className="ri-arrow-up-line text-[var(--wk-success)]" /> Up
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="ri-arrow-down-line text-[var(--wk-danger)]" /> Down
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
          <div className="divide-y divide-[var(--wk-divider)]">
            {restOfChart.map((entry, idx) => (
              <ChartRow key={entry.rank} {...entry} onPlay={() => handlePlayChart(idx + 3)} />
            ))}
          </div>
        </div>
      </div>

      {/* Edition stats */}
      <div className="px-5 pb-5">
        <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">This edition</div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {[
            { label: "Entries", value: edition.totalEntries },
            { label: "Artists", value: edition.totalArtists },
            { label: "New", value: edition.newEntries, color: "var(--wk-success)" },
            { label: "Longest run", value: edition.longestRunning?.weeks ?? "—", color: "var(--wk-info)" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 text-center">
              <div className="text-[18px] font-black" style={{ color: stat.color || "var(--wk-brand)" }}>
                {stat.value}
              </div>
              <div className="text-[9px] font-semibold uppercase tracking-wider text-[var(--wk-text-muted)]">{stat.label}</div>
            </div>
          ))}
        </div>
        {edition.longestRunning && (
          <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 flex items-center gap-2">
            <i className="ri-trophy-line text-[var(--wk-brand)]" />
            <div>
              <div className="text-[12px] font-bold text-[var(--wk-text)]">{edition.longestRunning.title}</div>
              <div className="text-[10px] text-[var(--wk-text-muted)]">
                {edition.longestRunning.artist} · {edition.longestRunning.weeks} weeks on chart
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Genre breakdown */}
      <div className="px-5 pb-5">
        <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Genre breakdown</div>
        <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 space-y-3">
          {genreBreakdown.map((g) => {
            const pct = edition.totalEntries ? (g.count / edition.totalEntries) * 100 : 0;
            return (
              <div key={g.genre}>
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-[12px] font-semibold text-[var(--wk-text)]">{g.genre}</div>
                  <div className="text-[11px] font-bold text-[var(--wk-text-muted)]">
                    {g.count} ({Math.round(pct)}%)
                  </div>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--wk-bg)]">
                  <div className="h-full rounded-full bg-[var(--wk-brand)] transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* New entries */}
      {entries.filter((e) => e.movement === "new").length > 0 && (
        <div className="px-5 pb-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">New entries</div>
            <span className="text-[10px] font-bold text-[var(--wk-brand)]">
              {entries.filter((e) => e.movement === "new").length}
            </span>
          </div>
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
            <div className="divide-y divide-[var(--wk-divider)]">
              {entries.filter((e) => e.movement === "new").slice(0, 5).map((entry) => (
                <div key={entry.rank} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[10px] font-black text-[var(--wk-brand-on)]">
                    {entry.rank}
                  </div>
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                    <img src={entry.artworkUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-bold text-[var(--wk-text)]">{entry.title}</div>
                    <div className="truncate text-[10px] text-[var(--wk-text-muted)]">{entry.artist}</div>
                  </div>
                  <span className="text-[10px] font-bold text-[var(--wk-brand)]">New</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Biggest climbers */}
      {entries.filter((e) => e.movement === "up").length > 0 && (
        <div className="px-5 pb-5">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Biggest climbers</div>
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
            <div className="divide-y divide-[var(--wk-divider)]">
              {entries
                .filter((e) => e.movement === "up")
                .sort((a, b) => (b.movementAmount ?? 0) - (a.movementAmount ?? 0))
                .slice(0, 5)
                .map((entry) => (
                  <div key={entry.rank} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--wk-success)] text-[10px] font-black text-white">
                      +{entry.movementAmount}
                    </div>
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                      <img src={entry.artworkUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-bold text-[var(--wk-text)]">{entry.title}</div>
                      <div className="truncate text-[10px] text-[var(--wk-text-muted)]">{entry.artist}</div>
                    </div>
                    <span className="text-[11px] font-bold text-[var(--wk-text-muted)]">#{entry.rank}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Editor's note */}
      <div className="px-5 pb-5">
        <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <i className="ri-quill-pen-line text-[var(--wk-brand)]" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">Editor's Note</span>
          </div>
          <p className="text-[12px] leading-[1.7] text-[var(--wk-text-soft)]">
            <strong className="text-[var(--wk-text)]">{edition.biggestMover?.title ?? topTrack.title}</strong> makes the biggest move this week
            {edition.biggestMover ? `, climbing ${edition.biggestMover.amount} positions` : ""}.
            The {edition.topGenre} genre dominates with {edition.topGenreCount} entries.
          </p>
          <Link to="/magazine" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--wk-brand)]">
            Full analysis <i className="ri-arrow-right-line" />
          </Link>
        </div>
      </div>

      {/* Playable preview shelf */}
      {entries.filter((t) => t.isPlayable).length > 0 && (
        <div className="border-t border-[var(--wk-border)] bg-[var(--wk-surface)] px-5 py-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
              Playable preview · {entries.filter((t) => t.isPlayable).length} tracks
            </div>
            <button onClick={handlePlayTop10} className="text-[11px] font-semibold text-[var(--wk-brand)] flex items-center gap-1">
              <i className="ri-play-fill" /> Play all
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
            {entries.filter((e) => e.isPlayable).map((entry, idx) => (
              <button
                key={entry.rank}
                onClick={() => handlePlayChart(idx)}
                className="group flex-none w-[136px] text-left active:scale-[0.97] transition-transform"
              >
                <div className="relative aspect-square overflow-hidden rounded-xl bg-[var(--wk-surface-raised)] mb-2">
                  <img src={entry.artworkUrl} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-active:opacity-100 transition-opacity">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)]">
                      <i className="ri-play-fill" />
                    </div>
                  </div>
                  <div className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] font-black text-white">
                    {entry.rank}
                  </div>
                </div>
                <div className="truncate text-[11px] font-bold text-[var(--wk-text)]">{entry.title}</div>
                <div className="truncate text-[10px] text-[var(--wk-text-muted)]">{entry.artist}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Subtle metadata */}
      {metaLine && (
        <div className="border-t border-[var(--wk-border)] bg-[var(--wk-bg)] px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[10px] text-[var(--wk-text-faint)]">{metaLine}</div>
            <ChartRefreshButton onRefresh={load} size="sm" />
          </div>
        </div>
      )}
    </div>
  );
}