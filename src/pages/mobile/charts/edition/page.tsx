import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
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
import {
  getLegacyRedirectTarget,
  normalizeChartProgramSlug,
  isLegacyChartSlug,
  getSourceFamilySlug,
  getCanonicalChartPathFromSlugs,
} from "@/services/chartsPublic/chartRoutes";
import { ChartRefreshButton } from "@/components/charts/ChartRefreshButton";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";
import { trackUrl } from "@/utils/trackUrl";

// ─── Constants ───
const INITIAL_COUNT = 15;
const PAGE_SIZE = 12;

const RANK_COLORS: Record<number, string> = {
  1: "#C9A96E",
  2: "#A8A8A8",
  3: "#B87333",
};

// ─── Movement delta badge ─────────────────────────────────────────────────────

function MovBadge({
  movement,
  amount,
  size = "md",
}: {
  movement?: ChartEntryRowViewModel["movement"];
  amount?: number | null;
  size?: "sm" | "md";
}) {
  const textSize = size === "sm" ? "text-[9px]" : "text-[11px]";
  const amt = amount ?? 0;

  if (movement === "up")
    return (
      <span className={`flex items-center gap-0.5 font-bold tabular-nums ${textSize}`} style={{ color: "var(--wk-success)" }}>
        <i className="ri-arrow-up-line" />+{amt > 0 ? amt : "—"}
      </span>
    );
  if (movement === "down")
    return (
      <span className={`flex items-center gap-0.5 font-bold tabular-nums ${textSize}`} style={{ color: "var(--wk-danger)" }}>
        <i className="ri-arrow-down-line" />−{amt > 0 ? amt : "—"}
      </span>
    );
  if (movement === "new")
    return (
      <span className={`rounded-full px-1.5 py-0.5 font-black uppercase tracking-wide ${size === "sm" ? "text-[8px]" : "text-[10px]"}`} style={{ background: "var(--wk-brand-soft)", color: "var(--wk-brand)" }}>
        NEW
      </span>
    );
  if (movement === "re_entry")
    return (
      <span className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-black uppercase tracking-wide ${size === "sm" ? "text-[8px]" : "text-[10px]"}`} style={{ background: "var(--wk-brand-soft)", color: "var(--wk-brand)" }}>
        <i className="ri-refresh-line" />RE
      </span>
    );
  return <span className={`font-bold ${textSize}`} style={{ color: "var(--wk-text-faint)" }}>—</span>;
}

// ─── Fresh arrival card ───────────────────────────────────────────────────────

function FreshCard({ entry, onJump }: { entry: ChartEntryRowViewModel; onJump: (s: string) => void }) {
  const isRe = entry.movement === "re_entry";
  const rankColor = RANK_COLORS[entry.rank] ?? "rgba(255,255,255,0.55)";
  return (
    <button
      onClick={() => onJump(entry.slug)}
      className="group relative flex h-[190px] w-[135px] shrink-0 cursor-pointer flex-col overflow-hidden rounded-2xl active:scale-[0.97] transition-transform"
    >
      <div className="absolute inset-0">
        {entry.artworkUrl ? (
          <img src={entry.artworkUrl} alt="" className="h-full w-full object-cover object-top" />
        ) : (
          <Ch19GradientImage slug={entry.slug} name={entry.title} />
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
      <div className="relative flex-1 p-2.5">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wide ${isRe ? "bg-white/15 text-white" : "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"}`}>
          {isRe ? <><i className="ri-refresh-line text-[8px]" /> Re</> : <><i className="ri-star-smile-line text-[8px]" /> New</>}
        </span>
      </div>
      <div className="relative px-2.5 pb-3">
        <div className="mb-0.5 text-[10px] font-black leading-none" style={{ color: rankColor }}>#{entry.rank}</div>
        <div className="text-[12px] font-black leading-snug text-white line-clamp-2">{entry.title}</div>
        <div className="mt-0.5 truncate text-[10px] text-white/60">{entry.artist}</div>
      </div>
    </button>
  );
}

// ─── Mover card ───────────────────────────────────────────────────────────────

function MoverCard({ entry, direction }: { entry: ChartEntryRowViewModel; direction: "up" | "down" }) {
  const isUp = direction === "up";
  return (
    <Link
      to={trackUrl(entry.slug, entry.artistSlugs)}
      className="flex flex-col overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] active:scale-[0.98] transition-transform"
    >
      {/* Artwork header */}
      <div className="relative h-[100px] w-full overflow-hidden">
        {entry.artworkUrl ? (
          <img src={entry.artworkUrl} alt="" className="h-full w-full object-cover object-top" style={{ filter: "blur(18px) saturate(1.4)", transform: "scale(1.15)" }} />
        ) : (
          <Ch19GradientImage slug={entry.slug} name={entry.title} />
        )}
        <div className="absolute inset-0 bg-black/50" />
        {/* Artwork thumb */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-14 w-14 overflow-hidden rounded-xl ring-2 ring-white/20">
            {entry.artworkUrl ? (
              <img src={entry.artworkUrl} alt="" className="h-full w-full object-cover object-top" />
            ) : (
              <Ch19GradientImage slug={entry.slug} name={entry.title} />
            )}
          </div>
        </div>
        {/* Direction badge */}
        <div className={`absolute top-2 right-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black ${isUp ? "bg-[var(--wk-success)] text-white" : "bg-[var(--wk-danger)] text-white"}`}>
          <i className={isUp ? "ri-arrow-up-line" : "ri-arrow-down-line"} />
          {isUp ? "Climber" : "Drop"}
        </div>
      </div>
      {/* Body */}
      <div className="p-3">
        <div className="truncate text-[13px] font-black text-[var(--wk-text)]">{entry.title}</div>
        <div className="truncate text-[11px] text-[var(--wk-text-muted)]">{entry.artist}</div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] font-bold" style={{ color: isUp ? "var(--wk-success)" : "var(--wk-danger)" }}>
            {isUp ? "+" : "−"}{entry.movementAmount ?? 0} positions
          </span>
          <span className="text-[11px] font-black tabular-nums" style={{ color: RANK_COLORS[entry.rank] ?? "var(--wk-text-muted)" }}>
            #{entry.rank}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MobileChartEdition() {
  const {
    family,
    market,
    series,
    edition: editionSlug,
  } = useParams<{ family?: string; market?: string; series?: string; edition?: string }>();

  const rawChartProgramSlug = family && market && series
    ? `${family}/${market}/${series}`
    : series ?? "";

  const chartProgramSlug = normalizeChartProgramSlug(rawChartProgramSlug);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<"family" | "edition" | null>(null);
  const [edition, setEdition] = useState<ChartEditionViewModel | null>(null);
  const [entries, setEntries] = useState<ChartEntryRowViewModel[]>([]);
  const [familyLabel, setFamilyLabel] = useState("WAKILISHA Charts");
  const [publicSlug, setPublicSlug] = useState("");
  const [latestEditionSlug, setLatestEditionSlug] = useState<string | undefined>(undefined);
  const [archive, setArchive] = useState<ChartArchiveViewModel | null>(null);
  const [meta, setMeta] = useState<{ dataSource: "wordpress" | "cache"; fetchedAt: string; isStale: boolean } | null>(null);

  // Progressive loading
  const [displayedCount, setDisplayedCount] = useState(INITIAL_COUNT);
  const [highlightedSlug, setHighlightedSlug] = useState<string | null>(null);

  const { playTrack } = usePlayer();

  const load = useCallback(async () => {
    if (!chartProgramSlug) { setNotFound("family"); setLoading(false); return; }
    setLoading(true);
    setError(null);
    setNotFound(null);
    setDisplayedCount(INITIAL_COUNT);
    try {
      const { data: family } = await getChartFamily(chartProgramSlug);
      if (!family) { setNotFound("family"); setLoading(false); return; }

      setFamilyLabel(family.label);
      const familyPublicSlug = family.publicSlug ?? family.slug ?? series;
      setPublicSlug(familyPublicSlug);

      if (rawChartProgramSlug !== chartProgramSlug || isLegacyChartSlug(series)) {
        const redirectTarget = getLegacyRedirectTarget(rawChartProgramSlug, editionSlug);
        if (redirectTarget) { navigate(redirectTarget, { replace: true }); return; }
      }

      const edResult = editionSlug
        ? await getChartEdition(chartProgramSlug, editionSlug)
        : await getLatestChartEdition(chartProgramSlug);

      if (!edResult.data) {
        const { data: latest } = await getLatestChartEdition(chartProgramSlug);
        setLatestEditionSlug(latest.data?.slug);
        setNotFound("edition");
        setLoading(false);
        return;
      }

      setMeta(edResult.meta);
      const { data: rawEntries } = await getChartEditionEntries(chartProgramSlug, edResult.data.slug);
      setEdition(toChartEditionViewModel(edResult.data, family, rawEntries));
      setEntries(rawEntries.map(toChartEntryRowViewModel));

      const { data: allEditions } = await getChartEditionsForFamily(chartProgramSlug);
      const sorted = [...allEditions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const archiveEditions = sorted.slice(0, 4);
      const entriesMap: Record<string, import("@/services/chartsPublic/types").ChartEditionEntry[]> = { [edResult.data.slug]: rawEntries };
      await Promise.all(
        archiveEditions
          .filter((e) => e.slug !== edResult.data!.slug)
          .slice(0, 3)
          .map(async (ed) => {
            try { const { data: edEntries } = await getChartEditionEntries(chartProgramSlug, ed.slug); entriesMap[ed.slug] = edEntries; }
            catch { entriesMap[ed.slug] = []; }
          })
      );
      setArchive(toChartArchiveViewModel(allEditions, entriesMap));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [chartProgramSlug, series, editionSlug, navigate]);

  useEffect(() => { load(); }, [load]);

  const chartTracks = useMemo(() => entries.map(toChartTrackPlayerModel), [entries]);
  const top3 = useMemo(() => entries.slice(0, 3), [entries]);
  const leaderboardRows = useMemo(() => entries.slice(3), [entries]);
  const displayedRows = leaderboardRows.slice(0, displayedCount);
  const hasMore = leaderboardRows.length > displayedCount;
  const nextLoadCount = Math.min(PAGE_SIZE, leaderboardRows.length - displayedCount);
  const totalRemaining = leaderboardRows.length - displayedCount;

  const freshArrivals = useMemo(
    () => entries.filter((e) => e.movement === "new" || e.movement === "re_entry").slice(0, 15),
    [entries]
  );
  const biggestClimber = useMemo(() => {
    const up = entries.filter((e) => e.movement === "up" && e.previousRank !== null);
    return up.length ? up.reduce((best, e) => (e.movementAmount ?? 0) > (best.movementAmount ?? 0) ? e : best) : null;
  }, [entries]);
  const biggestDrop = useMemo(() => {
    const down = entries.filter((e) => e.movement === "down" && e.previousRank !== null);
    return down.length ? down.reduce((worst, e) => (e.movementAmount ?? 0) > (worst.movementAmount ?? 0) ? e : worst) : null;
  }, [entries]);
  const hasMovement = biggestClimber !== null || biggestDrop !== null;

  const genreBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    entries.forEach((e) => { const g = e.genre || "Unknown"; counts[g] = (counts[g] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([genre, count]) => ({ genre, count }));
  }, [entries]);

  const handleJumpTo = useCallback((slug: string) => {
    const idx = leaderboardRows.findIndex((e) => e.slug === slug);
    if (idx >= 0) setDisplayedCount((n) => Math.max(n, idx + 1 + 3)); // ensure visible
    setHighlightedSlug(slug);
    setTimeout(() => {
      document.getElementById(`mob-entry-${slug}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 180);
    setTimeout(() => setHighlightedSlug(null), 2600);
  }, [leaderboardRows]);

  // ─── Loading ───
  if (loading) {
    return (
      <div className="min-h-screen pb-24">
        <div className="relative h-[420px] bg-[var(--wk-surface-raised)] animate-pulse" />
        <div className="grid grid-cols-3 gap-px border-y border-[var(--wk-border)] mt-0" style={{ background: "var(--wk-border)" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[var(--wk-surface)] px-4 py-4 text-center">
              <div className="h-5 w-8 rounded bg-[var(--wk-surface-raised)] animate-pulse mx-auto mb-1.5" />
              <div className="h-2.5 w-12 rounded bg-[var(--wk-surface-raised)] animate-pulse mx-auto" />
            </div>
          ))}
        </div>
        <div className="px-5 py-5 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonChartRow key={i} />)}
        </div>
      </div>
    );
  }

  // ─── Errors / not found ───
  if (error) {
    return (
      <div className="min-h-screen pb-24 px-5 py-16 text-center">
        <div className="mb-4 mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]">
          <i className="ri-error-warning-line text-2xl" />
        </div>
        <h1 className="mb-2 text-[16px] font-bold text-[var(--wk-text)]">Could not load chart</h1>
        <p className="mb-5 text-[13px] text-[var(--wk-text-muted)]">{error}</p>
        <div className="flex justify-center gap-3">
          <button onClick={load} className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-2.5 text-[13px] font-bold text-[var(--wk-brand-on)]">
            <i className="ri-refresh-line" /> Retry
          </button>
          <Link to="/charts" className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border)] px-5 py-2.5 text-[13px] font-bold text-[var(--wk-text)]">
            <i className="ri-arrow-left-line" /> Back
          </Link>
        </div>
      </div>
    );
  }

  if (notFound === "family" || notFound === "edition" || !edition || entries.length === 0) {
    return (
      <div className="min-h-screen pb-24 px-5 py-16 text-center">
        <div className="mb-4 mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
          <i className="ri-bar-chart-box-line text-2xl" />
        </div>
        <h1 className="mb-2 text-[16px] font-bold text-[var(--wk-text)]">
          {notFound === "family" ? "Chart not found" : notFound === "edition" ? "Edition not found" : "No entries yet"}
        </h1>
        <div className="flex justify-center gap-3 mt-4">
          {latestEditionSlug && notFound === "edition" && (
            <Link to={getCanonicalChartPathFromSlugs(publicSlug || (series ?? ""), latestEditionSlug)} className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-2.5 text-[13px] font-bold text-[var(--wk-brand-on)]">
              Latest edition
            </Link>
          )}
          <Link to="/charts" className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border)] px-5 py-2.5 text-[13px] font-bold text-[var(--wk-text)]">
            <i className="ri-arrow-left-line" /> Back
          </Link>
        </div>
      </div>
    );
  }

  const topTrack = entries[0];

  return (
    <div className="min-h-screen pb-28">

      {/* ══ HERO ════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[460px] flex flex-col justify-end overflow-hidden">
        {/* Blurred backdrop */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${topTrack.artworkUrl})`,
            filter: "blur(45px) saturate(1.4)",
            transform: "scale(1.18)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--wk-bg)] via-[var(--wk-bg)]/75 to-[var(--wk-bg)]/25" />

        <div className="relative px-5 pb-8 pt-20">
          {/* Eyebrow */}
          <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--wk-brand)]">
            <span className="h-px w-5 bg-[var(--wk-brand)]" />
            {familyLabel}
          </div>

          {/* Title */}
          <h1 className="font-black leading-[0.9] tracking-[-0.05em] text-[var(--wk-text)]" style={{ fontSize: "clamp(28px, 8.5vw, 40px)" }}>
            {edition.publicLabel}
          </h1>

          {/* Taxonomy chips */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-[var(--wk-brand)]/30 bg-[var(--wk-brand)]/10 px-2.5 py-0.5 text-[10px] font-semibold text-[var(--wk-brand)]">
              {edition.seriesLabel}
            </span>
            <span className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)]/60 px-2.5 py-0.5 text-[10px] font-semibold text-[var(--wk-text-muted)]">
              {edition.marketLabel}
            </span>
            <span className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)]/60 px-2.5 py-0.5 text-[10px] text-[var(--wk-text-faint)]">
              {edition.date}
            </span>
          </div>

          {/* CTAs */}
          <div className="mt-5 flex gap-3">
            <button
              onClick={() => { const t = chartTracks[0]; if (t) playTrack(t, chartTracks.slice(0, 10), { pageType: "charts_edition", entitySlug: editionSlug, entityType: "chart_edition", sourceSection: "hero" }); }}
              className="flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-2.5 text-[13px] font-bold text-[var(--wk-brand-on)] whitespace-nowrap active:scale-[0.96] transition-transform"
            >
              <i className="ri-play-fill" /> Play top 10
            </button>
            <Link
              to="/charts"
              className="flex items-center gap-2 rounded-full border border-[var(--wk-border-2)] px-5 py-2.5 text-[13px] font-bold text-[var(--wk-text)] whitespace-nowrap active:scale-[0.96] transition-transform"
            >
              <i className="ri-archive-line" /> Archive
            </Link>
          </div>

          {/* #1 track card */}
          <div className="mt-5 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]/80 backdrop-blur-sm p-3.5">
            <div className="mb-2 flex items-center gap-1.5">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[9px] font-black text-[var(--wk-brand-on)]">1</div>
              <span className="text-[9px] font-black uppercase tracking-wider text-[var(--wk-brand)]">This week's #1</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                {topTrack.artworkUrl ? <img src={topTrack.artworkUrl} alt="" className="h-full w-full object-cover object-top" /> : <Ch19GradientImage slug={topTrack.slug ?? "t1"} name={topTrack.title} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-black text-[var(--wk-text)]">{topTrack.title}</div>
                <div className="truncate text-[12px] text-[var(--wk-text-muted)]">{topTrack.artist}</div>
                <div className="mt-0.5 flex items-center gap-2">
                  <MovBadge movement={topTrack.movement} amount={topTrack.movementAmount} size="sm" />
                  <span className="text-[10px] text-[var(--wk-text-faint)]">{topTrack.weeksOnChart} wks</span>
                  {topTrack.peakPosition === topTrack.rank && (
                    <span className="text-[9px] font-bold" style={{ color: "#C9A96E" }}><i className="ri-vip-crown-line" /> Peak</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => { const t = chartTracks[0]; if (t) playTrack(t, chartTracks, { pageType: "charts_edition", entitySlug: editionSlug, entityType: "chart_edition", sourceSection: "hero" }); }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] active:scale-[0.93] transition-transform"
              >
                <i className="ri-play-fill" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ══ STATS STRIP ═════════════════════════════════════════════════ */}
      <div className="grid grid-cols-3 gap-px border-y border-[var(--wk-border)]" style={{ background: "var(--wk-border)" }}>
        {[
          { label: "Positions", value: edition.totalEntries },
          { label: "Artists", value: edition.totalArtists },
          { label: "New", value: edition.newEntries },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--wk-surface)] px-3 py-3.5 text-center">
            <div className="text-[20px] font-black tabular-nums text-[var(--wk-brand)]">{s.value}</div>
            <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ══ ARCHIVE CAROUSEL ════════════════════════════════════════════ */}
      {archive && (archive.previous.length > 0 || archive.latest) && (
        <div className="border-b border-[var(--wk-border)] px-5 py-4">
          <div className="mb-2.5 text-[9px] font-black uppercase tracking-widest text-[var(--wk-text-faint)]">Edition history</div>
          <div className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-5 px-5">
            {archive.latest && (
              <Link
                to={getCanonicalChartPathFromSlugs(publicSlug, archive.latest.slug)}
                className={`flex-none w-[150px] rounded-xl border p-3 active:scale-[0.97] transition-transform ${archive.latest.slug === edition.slug ? "border-[var(--wk-brand)] bg-[var(--wk-brand)]/5" : "border-[var(--wk-border)] bg-[var(--wk-surface)]"}`}
              >
                <div className="text-[9px] font-bold uppercase text-[var(--wk-brand)] mb-0.5">Latest</div>
                <div className="text-[12px] font-bold text-[var(--wk-text)] truncate">{archive.latest.label}</div>
                <div className="text-[10px] text-[var(--wk-text-muted)]">{archive.latest.entryCount} entries</div>
                {(archive.latest.newCount ?? 0) > 0 || (archive.latest.droppedCount ?? 0) > 0 ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    {(archive.latest.newCount ?? 0) > 0 && (
                      <span className="text-[9px] font-bold" style={{ color: "var(--wk-success)" }}>+{archive.latest.newCount} new</span>
                    )}
                    {(archive.latest.droppedCount ?? 0) > 0 && (
                      <span className="text-[9px] font-bold" style={{ color: "var(--wk-danger)" }}>−{archive.latest.droppedCount} out</span>
                    )}
                  </div>
                ) : null}
              </Link>
            )}
            {archive.previous.slice(0, 5).map((item) => (
              <Link
                key={item.slug}
                to={getCanonicalChartPathFromSlugs(publicSlug, item.slug)}
                className={`flex-none w-[150px] rounded-xl border p-3 active:scale-[0.97] transition-transform ${item.slug === edition.slug ? "border-[var(--wk-brand)] bg-[var(--wk-brand)]/5" : "border-[var(--wk-border)] bg-[var(--wk-surface)]"}`}
              >
                <div className="text-[12px] font-bold text-[var(--wk-text)] truncate">{item.label}</div>
                <div className="text-[10px] text-[var(--wk-text-muted)]">{item.date} · {item.entryCount}</div>
                {(item.newCount ?? 0) > 0 || (item.droppedCount ?? 0) > 0 ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    {(item.newCount ?? 0) > 0 && (
                      <span className="text-[9px] font-bold" style={{ color: "var(--wk-success)" }}>+{item.newCount} new</span>
                    )}
                    {(item.droppedCount ?? 0) > 0 && (
                      <span className="text-[9px] font-bold" style={{ color: "var(--wk-danger)" }}>−{item.droppedCount} out</span>
                    )}
                  </div>
                ) : null}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ══ TOP 3 ═══════════════════════════════════════════════════════ */}
      <div className="px-5 pt-6 pb-4">
        <div className="mb-3 text-[9px] font-black uppercase tracking-widest text-[var(--wk-text-faint)]">Podium · Top 3</div>
        <div className="space-y-2.5">
          {top3.map((entry, i) => {
            const rankColor = RANK_COLORS[entry.rank] ?? "var(--wk-text)";
            return (
              <Link
                key={entry.rank}
                to={trackUrl(entry.slug, entry.artistSlugs)}
                className="group flex items-center gap-3.5 overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] active:scale-[0.98] active:bg-[var(--wk-surface-raised)] transition-all"
              >
                {/* Artwork */}
                <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden">
                  {entry.artworkUrl ? <img src={entry.artworkUrl} alt="" className="h-full w-full object-cover object-top" /> : <Ch19GradientImage slug={entry.slug} name={entry.title} />}
                  <div className="absolute inset-0 bg-black/30" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[28px] font-black leading-none" style={{ color: rankColor }}>{entry.rank}</span>
                  </div>
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1 py-3">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="truncate text-[14px] font-black text-[var(--wk-text)]">{entry.title}</span>
                    {entry.peakPosition === entry.rank && entry.movement !== "new" && (
                      <span className="shrink-0 text-[9px] font-bold" style={{ color: "#C9A96E" }}>
                        <i className="ri-vip-crown-line" />
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[12px] text-[var(--wk-text-muted)]">{entry.artist}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <MovBadge movement={entry.movement} amount={entry.movementAmount} size="sm" />
                    <span className="text-[10px] text-[var(--wk-text-faint)]">{entry.weeksOnChart} wks</span>
                  </div>
                </div>

                {/* Play */}
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); const t = chartTracks[i]; if (t) playTrack(t, chartTracks, { pageType: "charts_edition", entitySlug: editionSlug, entityType: "chart_edition", sourceSection: "top3" }); }}
                  className="mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] opacity-0 group-active:opacity-100 active:scale-[0.93] transition-all"
                >
                  <i className="ri-play-fill" />
                </button>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ══ BIGGEST MOVERS ══════════════════════════════════════════════ */}
      {hasMovement && (
        <div className="px-5 py-4">
          <div className="mb-3 text-[9px] font-black uppercase tracking-widest text-[var(--wk-text-faint)]">Movement radar</div>
          <div className="grid grid-cols-2 gap-3">
            {biggestClimber && <MoverCard entry={biggestClimber} direction="up" />}
            {biggestDrop && <MoverCard entry={biggestDrop} direction="down" />}
          </div>
        </div>
      )}

      {/* ══ FRESH ARRIVALS ══════════════════════════════════════════════ */}
      {freshArrivals.length > 0 && (
        <div className="py-4 border-t border-[var(--wk-border)]">
          <div className="px-5 mb-3 flex items-center justify-between">
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-[var(--wk-text-faint)]">Fresh arrivals</div>
              <div className="text-[15px] font-black text-[var(--wk-text)]">New this week</div>
            </div>
            <span className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--wk-brand-on)] text-[11px] font-black" style={{ background: "var(--wk-brand)" }}>
              {freshArrivals.length}
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide px-5">
            {freshArrivals.map((entry) => (
              <FreshCard key={entry.slug} entry={entry} onJump={handleJumpTo} />
            ))}
          </div>
        </div>
      )}

      {/* ══ MAIN LEADERBOARD ════════════════════════════════════════════ */}
      <div className="px-5 py-5 border-t border-[var(--wk-border)]" id="mob-leaderboard">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[9px] font-black uppercase tracking-widest text-[var(--wk-text-faint)]">Full ranking</div>
            <div className="text-[15px] font-black text-[var(--wk-text)]">Positions 4–{3 + Math.min(displayedCount, leaderboardRows.length)}</div>
          </div>
          <span className="text-[11px] text-[var(--wk-text-faint)] tabular-nums">
            {Math.min(displayedCount, leaderboardRows.length)} / {leaderboardRows.length}
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
          <div className="divide-y divide-[var(--wk-divider)]">
            {displayedRows.map((entry, idx) => (
              <div
                key={entry.slug}
                id={`mob-entry-${entry.slug}`}
                className={`transition-colors duration-700 ${highlightedSlug === entry.slug ? "bg-[var(--wk-brand-soft)]" : ""}`}
              >
                <ChartRow
                  rank={entry.rank}
                  artworkUrl={entry.artworkUrl ?? undefined}
                  title={entry.title}
                  artist={entry.artist}
                  artistNames={entry.artistNames}
                  artistSlugs={entry.artistSlugs}
                  movement={entry.movement}
                  movementAmount={entry.movementAmount ?? undefined}
                  previousRank={entry.previousRank}
                  weeksOnChart={entry.weeksOnChart}
                  peakPosition={entry.peakPosition}
                  isPlayable={entry.isPlayable}
                  source={entry.source}
                  genre={entry.genre ?? undefined}
                  slug={entry.slug}
                  score={entry.score}
                  duration={entry.duration}
                  onPlay={() => { const t = chartTracks[idx + 3]; if (t) playTrack(t, chartTracks, { pageType: "charts_edition", entitySlug: editionSlug, entityType: "chart_edition", sourceSection: "leaderboard" }); }}
                />
              </div>
            ))}
          </div>

          {/* Progressive gate */}
          {hasMore && (
            <div className="border-t border-[var(--wk-divider)] px-4 py-4 text-center">
              <p className="mb-3 text-[12px] text-[var(--wk-text-muted)]">
                +{totalRemaining} more tracks
              </p>
              <button
                onClick={() => setDisplayedCount((n) => Math.min(n + PAGE_SIZE, leaderboardRows.length))}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-surface-raised)] border border-[var(--wk-border)] px-5 py-2.5 text-[13px] font-bold text-[var(--wk-text)] active:scale-[0.97] transition-transform"
              >
                <i className="ri-arrow-down-s-line" />
                Load {nextLoadCount} more
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══ GENRE BREAKDOWN ═════════════════════════════════════════════ */}
      {genreBreakdown.length > 0 && (
        <div className="px-5 pb-5">
          <div className="mb-3 text-[9px] font-black uppercase tracking-widest text-[var(--wk-text-faint)]">Genre breakdown</div>
          <div className="overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 space-y-3">
            {genreBreakdown.map((g) => {
              const pct = edition.totalEntries ? (g.count / edition.totalEntries) * 100 : 0;
              return (
                <div key={g.genre}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-[var(--wk-text)]">{g.genre}</span>
                    <span className="text-[11px] text-[var(--wk-text-muted)] tabular-nums">{g.count} ({Math.round(pct)}%)</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--wk-surface-raised)]">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: "var(--wk-brand)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ META ════════════════════════════════════════════════════════ */}
      <div className="border-t border-[var(--wk-border)] px-5 py-3 flex items-center justify-between gap-3">
        <span className="text-[10px] text-[var(--wk-text-faint)]">
          {meta?.isStale ? "Cached (stale)" : meta?.dataSource === "cache" ? "From cache" : "Live data"}
          {meta ? ` · ${new Date(meta.fetchedAt).toLocaleTimeString()}` : ""}
        </span>
        <ChartRefreshButton onRefresh={load} size="sm" />
      </div>
    </div>
  );
}