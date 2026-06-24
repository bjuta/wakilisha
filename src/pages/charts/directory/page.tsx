import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { ChartRowExpandedPanel } from "@/components/design-system/music/ChartRowExpandedPanel";
import { ChartHighlights } from "./components/ChartHighlights";
import {
  getChartFamilies,
  getLatestChartEditionWithEntries,
} from "@/services/chartsPublic/client";
import {
  toChartDirectoryViewModel,
  toChartFamilyViewModel,
  toChartEditionViewModel,
  toChartEntryRowViewModel,
  toChartTrackPlayerModels,
  type ChartFamilyViewModel,
  type ChartEditionViewModel,
  type ChartEntryRowViewModel,
  type ChartPageMeta,
} from "@/services/chartsPublic/viewModels";
import type { ChartEdition, ChartEditionEntry } from "@/services/chartsPublic/types";
import { ChartRefreshButton } from "@/components/charts/ChartRefreshButton";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";
import { trackUrl } from "@/utils/trackUrl";

// ─── Constants ───

const METALLIC = {
  gold: "#C9A96E",
  silver: "#A8A8A8",
  bronze: "#B87333",
} as const;

const HERO_FALLBACK =
  "https://wakilisha.africa/api/search-image?query=abstract%20african%20music%20visualization%20with%20vibrant%20green%20and%20gold%20energy%20waves%20radiating%20from%20a%20central%20point%20on%20deep%20charcoal%20black%20background%20rhythmic%20geometric%20patterns%20inspired%20by%20african%20textile%20art%20premium%20cinematic%20atmosphere%20with%20subtle%20luminous%20particles%20no%20text%20high%20contrast%20editorial%20photography%20style&width=1600&height=720&seq=charts-home-hero-v2&orientation=landscape";

// ─── Grouping ───

interface SourceFamilyGroup {
  sourceSlug: string;
  label: string;
  icon: string;
  description: string;
  markets: ChartFamilyViewModel[];
}

function groupFamiliesBySource(all: ChartFamilyViewModel[]): SourceFamilyGroup[] {
  const map = new Map<string, ChartFamilyViewModel[]>();
  for (const f of all) {
    const key = f.sourceFamilySlug || f.slug;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(f);
  }
  const groups: SourceFamilyGroup[] = [];
  for (const [key, markets] of map) {
    const rep = markets[0];
    groups.push({
      sourceSlug: key,
      label: rep.shortLabel ?? rep.publicLabel ?? key,
      icon: rep.icon,
      description: rep.description,
      markets,
    });
  }
  return groups;
}

// ─── Helpers ───

function rankAccent(rank: number) {
  if (rank === 1) return { color: METALLIC.gold, ring: "ring-[#C9A96E]/25" };
  if (rank === 2) return { color: METALLIC.silver, ring: "ring-[#A8A8A8]/20" };
  if (rank === 3) return { color: METALLIC.bronze, ring: "ring-[#B87333]/20" };
  return null;
}

function entryPlaylist(entries: ChartEntryRowViewModel[]) {
  return entries
    .filter((e) => e.isPlayable !== false)
    .map((e) => ({
      id: e.slug,
      title: e.title,
      artist: e.artist,
      artworkUrl: e.artworkUrl ?? undefined,
      isPlayable: e.isPlayable,
      source: e.source,
      duration: e.duration,
    }));
}

// ─── Sub-components ───

function LeaderboardRow({
  entry,
  onPlay,
  rowId,
  isHighlighted,
}: {
  entry: ChartEntryRowViewModel;
  onPlay: () => void;
  rowId?: string;
  isHighlighted?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const accent = rankAccent(entry.rank);
  const mvtAmt = entry.movementAmount && entry.movementAmount > 0 ? entry.movementAmount : null;

  const mvtBadge = useMemo(() => {
    switch (entry.movement) {
      case "up":
        return { icon: "ri-arrow-up-line", color: "var(--wk-success)", label: mvtAmt ? `+${mvtAmt}` : "+" };
      case "down":
        return { icon: "ri-arrow-down-line", color: "var(--wk-danger)", label: mvtAmt ? `−${mvtAmt}` : "−" };
      case "new":
        return { icon: null, color: "var(--wk-brand)", label: "NEW" };
      case "re_entry":
        return { icon: "ri-refresh-line", color: "var(--wk-brand)", label: "RE" };
      default:
        return null;
    }
  }, [entry.movement, mvtAmt]);

  return (
    <div
      id={rowId}
      className={`group transition-colors ${isHighlighted ? "bg-[var(--wk-brand-soft)] duration-700" : isExpanded ? "bg-[var(--wk-surface-raised)] duration-200" : "hover:bg-[var(--wk-surface-raised)] duration-200"}`}
    >
      {/* Row */}
      <div
        onClick={() => setIsExpanded((v) => !v)}
        className="flex cursor-pointer select-none items-center gap-2 px-3 py-3 md:gap-3.5 md:px-4 md:py-3"
      >
        {/* Rank */}
        <div className="flex w-7 shrink-0 items-center justify-center md:w-10">
          {accent ? (
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-black md:h-9 md:w-9 md:text-[16px]"
              style={{ backgroundColor: `${accent.color}18`, color: accent.color }}
            >
              {entry.rank}
            </span>
          ) : (
            <span className="text-[12px] font-bold text-[var(--wk-text-muted)] tabular-nums md:text-[15px]">
              {entry.rank}
            </span>
          )}
        </div>

        {/* Artwork */}
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)] md:h-12 md:w-12">
          {entry.artworkUrl ? (
            <img src={entry.artworkUrl} alt="" className="h-full w-full object-cover object-top" loading="lazy" />
          ) : (
            <Ch19GradientImage slug={entry.slug} name={entry.title} />
          )}
        </div>

        {/* Track info — on mobile, movement + weeks are inline here */}
        <div className="min-w-0 flex-1 py-0.5">
          {/* Title row */}
          <div className="flex items-center gap-1.5">
            <Link
              to={trackUrl(entry.slug, entry.artistSlugs)}
              onClick={(e) => e.stopPropagation()}
              className="truncate text-[13px] font-bold text-[var(--wk-text)] hover:text-[var(--wk-brand)] transition-colors leading-tight md:text-[14px]"
            >
              {entry.title}
            </Link>
            {entry.movement === "new" && (
              <span className="shrink-0 rounded-full bg-[var(--wk-brand-soft)] px-1.5 py-px text-[8px] font-black uppercase tracking-wider text-[var(--wk-brand)]">
                NEW
              </span>
            )}
            {/* Mobile-only: movement inline, right-aligned */}
            {mvtBadge && (
              <span
                className="md:hidden ml-auto flex shrink-0 items-center gap-0.5 text-[11px] font-bold tabular-nums"
                style={{ color: mvtBadge.color }}
              >
                {mvtBadge.icon && <i className={`${mvtBadge.icon} text-[10px]`} />}
                {mvtBadge.label}
              </span>
            )}
            {(entry.movement === "same" || !entry.movement) && (
              <span className="md:hidden ml-auto shrink-0 text-[11px] font-bold text-[var(--wk-text-faint)]">—</span>
            )}
          </div>

          {/* Artist row */}
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="truncate text-[11px] text-[var(--wk-text-muted)] md:text-[12px]">{entry.artist}</span>
            {/* Mobile-only: weeks count inline */}
            <span className="md:hidden ml-auto shrink-0 text-[10px] text-[var(--wk-text-faint)] tabular-nums">
              {entry.weeksOnChart}w
            </span>
          </div>
        </div>

        {/* Movement delta — desktop only */}
        <div className="hidden md:flex shrink-0 w-16 items-center justify-end">
          {entry.movement === "up" && (
            <span className="flex items-center gap-0.5 text-[12px] font-bold tabular-nums" style={{ color: "var(--wk-success)" }}>
              <i className="ri-arrow-up-line text-[11px]" />
              +{mvtAmt ?? 0}
            </span>
          )}
          {entry.movement === "down" && (
            <span className="flex items-center gap-0.5 text-[12px] font-bold tabular-nums" style={{ color: "var(--wk-danger)" }}>
              <i className="ri-arrow-down-line text-[11px]" />
              −{mvtAmt ?? 0}
            </span>
          )}
          {entry.movement === "new" && (
            <span className="rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider" style={{ backgroundColor: "var(--wk-brand-soft)", color: "var(--wk-brand)" }}>
              NEW
            </span>
          )}
          {entry.movement === "re_entry" && (
            <span className="rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider flex items-center gap-0.5" style={{ backgroundColor: "var(--wk-brand-soft)", color: "var(--wk-brand)" }}>
              <i className="ri-refresh-line text-[9px]" />RE
            </span>
          )}
          {(entry.movement === "same" || !entry.movement) && (
            <span className="text-[12px] font-bold" style={{ color: "var(--wk-text-faint)" }}>—</span>
          )}
        </div>

        {/* Weeks + Peak — desktop only */}
        <div className="hidden w-16 shrink-0 flex-col items-end gap-0.5 md:flex">
          <span className="text-[11px] text-[var(--wk-text-soft)] tabular-nums">
            {entry.weeksOnChart} wk{entry.weeksOnChart !== 1 ? "s" : ""}
          </span>
          <span className="text-[10px] text-[var(--wk-text-faint)] tabular-nums">
            #{entry.peakPosition}
          </span>
        </div>

        {/* Play button */}
        <button
          onClick={(e) => { e.stopPropagation(); onPlay(); }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] transition-all duration-200 hover:scale-110 active:scale-95 md:h-9 md:w-9"
          aria-label={`Play ${entry.title}`}
        >
          <i className="ri-play-mini-fill text-sm" />
        </button>
      </div>

      {/* Expandable panel */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: isExpanded ? "1fr" : "0fr",
          transition: "grid-template-rows 0.25s ease",
        }}
      >
        <ChartRowExpandedPanel
          rank={entry.rank}
          slug={entry.slug}
          artistNames={entry.artistNames}
          artistSlugs={entry.artistSlugs}
          peakPosition={entry.peakPosition}
          weeksOnChart={entry.weeksOnChart}
          movement={entry.movement}
          movementAmount={entry.movementAmount}
          previousRank={entry.previousRank}
          duration={entry.duration}
          genre={entry.genre ?? undefined}
          score={entry.score}
        />
      </div>
    </div>
  );
}

function StatTile({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-xl bg-[var(--wk-bg)] p-3">
      <div className="text-[20px] font-black text-[var(--wk-brand)] tabular-nums">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] mt-0.5">{label}</div>
    </div>
  );
}

function MiniEntryRow({
  entry,
  badge,
}: {
  entry: ChartEntryRowViewModel;
  badge: string;
}) {
  return (
    <Link
      to={trackUrl(entry.slug, entry.artistSlugs)}
      className="flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-[var(--wk-bg)] group"
    >
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[10px] font-black text-[var(--wk-brand-on)] tabular-nums">
        {entry.rank}
      </div>
      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-[var(--wk-surface-raised)]">
        {entry.artworkUrl ? (
          <img src={entry.artworkUrl} alt="" className="h-full w-full object-cover object-top" loading="lazy" />
        ) : (
          <Ch19GradientImage slug={entry.slug} name={entry.title} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-bold text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors leading-tight">
          {entry.title}
        </div>
        <div className="truncate text-[10px] text-[var(--wk-text-muted)] mt-0.5">{entry.artist}</div>
      </div>
      <span className="shrink-0 text-[10px] font-bold text-[var(--wk-brand)] uppercase">{badge}</span>
    </Link>
  );
}

function SidebarCard({
  title,
  entries,
  badge,
  emptyLabel,
}: {
  title: string;
  entries: ChartEntryRowViewModel[];
  badge: string;
  emptyLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3.5 md:p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">{title}</span>
        <span className="text-[11px] font-bold text-[var(--wk-brand)] tabular-nums">{entries.length}</span>
      </div>
      {entries.length > 0 ? (
        <div className="space-y-0.5">
          {entries.slice(0, 8).map((entry) => (
            <MiniEntryRow key={`${badge}-${entry.rank}`} entry={entry} badge={badge} />
          ))}
        </div>
      ) : (
        <div className="py-3 text-center text-[12px] text-[var(--wk-text-faint)]">{emptyLabel ?? "None this week."}</div>
      )}
    </div>
  );
}

// ─── Market Switcher ───

function MarketSwitcher({
  markets,
  activeSlug,
  onSelect,
}: {
  markets: ChartFamilyViewModel[];
  activeSlug: string;
  onSelect: (slug: string) => void;
}) {
  if (markets.length <= 1) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] mr-1">
        <i className="ri-global-line text-[11px]" /> Market
      </span>
      {markets.map((m) => {
        const isActive = m.slug === activeSlug;
        return (
          <button
            key={m.slug}
            onClick={() => onSelect(m.slug)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all duration-[var(--wk-d-fast)] whitespace-nowrap cursor-pointer ${
              isActive
                ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)] border border-[var(--wk-brand)]/25"
                : "text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)] border border-transparent"
            }`}
          >
            {m.marketLabel}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Component ───

export default function ChartsDirectory() {
  const { playTrack } = usePlayer();
  const scrollY = useRef(0);
  const [scrollPos, setScrollPos] = useState(0);
  const [searchParams] = useSearchParams();

  // ── core state ──
  const [phase, setPhase] = useState<"loading" | "error" | "empty" | "ready">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [families, setFamilies] = useState<ChartFamilyViewModel[]>([]);
  const [editions, setEditions] = useState<ChartEdition[]>([]);
  const [sourceGroups, setSourceGroups] = useState<SourceFamilyGroup[]>([]);
  const [activeSourceFamily, setActiveSourceFamily] = useState<string>("");
  const [activeSlug, setActiveSlug] = useState<string>("");
  const [cache, setCache] = useState<Record<string, { edition: ChartEditionViewModel | null; entries: ChartEntryRowViewModel[] }>>({});
  const [switching, setSwitching] = useState(false);
  const [meta, setMeta] = useState<ChartPageMeta | null>(null);
  const [highlightedSlug, setHighlightedSlug] = useState<string | null>(null);

  // ── scroll listener ──
  useEffect(() => {
    const onScroll = () => {
      scrollY.current = window.scrollY;
      setScrollPos(window.scrollY);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── load families on mount ──
  const metaRef = useRef(meta);
  metaRef.current = meta;

  const loadFamilyEntry = useCallback(async (slug: string, family: ChartFamilyViewModel) => {
    setSwitching(true);
    try {
      const { data: { edition, entries: rawEntries }, meta: edMeta } = await getLatestChartEditionWithEntries(slug);
      if (!edition || rawEntries.length === 0) {
        setCache((prev) => ({ ...prev, [slug]: { edition: null, entries: [] } }));
        if (!metaRef.current) setMeta(edMeta);
        return;
      }
      const edVM = toChartEditionViewModel(
        edition,
        { ...family, sourceFamilySlug: family.sourceFamilySlug, familyKey: slug } as any,
        rawEntries
      );
      const entryVMs = rawEntries.map(toChartEntryRowViewModel);
      setCache((prev) => ({ ...prev, [slug]: { edition: edVM, entries: entryVMs } }));
      if (!metaRef.current) setMeta(edMeta);
    } catch {
      setCache((prev) => ({ ...prev, [slug]: { edition: null, entries: [] } }));
    } finally {
      setSwitching(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setPhase("loading");
      try {
        const { data: { families: familiesData, editions: editionsData }, meta: familiesMeta } = await getChartFamilies();
        if (cancelled) return;
        if (familiesData.length === 0) { setPhase("empty"); return; }

        const vms = familiesData.map((f) => toChartFamilyViewModel(f, editionsData));
        setFamilies(vms);
        setEditions(editionsData);
        setMeta(familiesMeta);

        const groups = groupFamiliesBySource(vms);
        setSourceGroups(groups);

        // ── URL deep-link support ──
        const urlFamily = searchParams.get("family")?.toLowerCase();
        const urlMarket = searchParams.get("market")?.toLowerCase();

        let targetGroup = groups[0];
        let targetMarket = targetGroup.markets[0];

        if (urlFamily) {
          const matchedGroup = groups.find(
            (g) => g.sourceSlug.toLowerCase() === urlFamily
          );
          if (matchedGroup) {
            targetGroup = matchedGroup;
            if (urlMarket) {
              const matchedMarket = matchedGroup.markets.find(
                (m) => m.marketSlug.toLowerCase() === urlMarket
              );
              if (matchedMarket) targetMarket = matchedMarket;
              else targetMarket = matchedGroup.markets[0];
            } else {
              targetMarket = matchedGroup.markets[0];
            }
          }
        }

        setActiveSourceFamily(targetGroup.sourceSlug);
        setActiveSlug(targetMarket.slug);
        setPhase("ready");
        loadFamilyEntry(targetMarket.slug, targetMarket);

        // Pre-load first market of every other family group for highlights
        for (const group of groups) {
          if (group.sourceSlug === targetGroup.sourceSlug) continue;
          const firstMarket = group.markets[0];
          if (firstMarket) {
            loadFamilyEntry(firstMarket.slug, firstMarket);
          }
        }
      } catch (err) {
        if (cancelled) return;
        setPhase("error");
        setErrorMsg(err instanceof Error ? err.message : "Failed to load chart data");
      }
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── retry ──
  const retry = useCallback(() => {
    setPhase("loading");
    setErrorMsg("");
    setCache({});
    let cancelled = false;
    (async () => {
      try {
        const { data: { families: familiesData, editions: editionsData }, meta: familiesMeta } = await getChartFamilies();
        if (cancelled) return;
        if (familiesData.length === 0) { setPhase("empty"); return; }
        const vms = familiesData.map((f) => toChartFamilyViewModel(f, editionsData));
        setFamilies(vms);
        setEditions(editionsData);
        setMeta(familiesMeta);

        const groups = groupFamiliesBySource(vms);
        setSourceGroups(groups);

        const urlFamily = searchParams.get("family")?.toLowerCase();
        const urlMarket = searchParams.get("market")?.toLowerCase();

        let targetGroup = groups[0];
        let targetMarket = targetGroup.markets[0];

        if (urlFamily) {
          const matchedGroup = groups.find(
            (g) => g.sourceSlug.toLowerCase() === urlFamily
          );
          if (matchedGroup) {
            targetGroup = matchedGroup;
            if (urlMarket) {
              const matchedMarket = matchedGroup.markets.find(
                (m) => m.marketSlug.toLowerCase() === urlMarket
              );
              if (matchedMarket) targetMarket = matchedMarket;
              else targetMarket = matchedGroup.markets[0];
            } else {
              targetMarket = matchedGroup.markets[0];
            }
          }
        }

        setActiveSourceFamily(targetGroup.sourceSlug);
        setActiveSlug(targetMarket.slug);
        setPhase("ready");
        loadFamilyEntry(targetMarket.slug, targetMarket);

        // Pre-load first market of every other family group for highlights
        for (const group of groups) {
          if (group.sourceSlug === targetGroup.sourceSlug) continue;
          const firstMarket = group.markets[0];
          if (firstMarket) {
            loadFamilyEntry(firstMarket.slug, firstMarket);
          }
        }
      } catch (err) {
        if (cancelled) return;
        setPhase("error");
        setErrorMsg(err instanceof Error ? err.message : "Failed to load chart data");
      }
    })();
    return () => { cancelled = true; };
  }, [loadFamilyEntry, searchParams]);

  // ── compute merged entries from all cached families for highlights ──
  const mergedHighlightEntries = useMemo(() => {
    const seen = new Set<string>();
    const merged: ChartEntryRowViewModel[] = [];
    for (const key of Object.keys(cache)) {
      const data = cache[key];
      if (!data?.entries) continue;
      for (const entry of data.entries) {
        if (seen.has(entry.slug)) continue;
        seen.add(entry.slug);
        merged.push(entry);
      }
    }
    return merged;
  }, [cache]);

  // ── derived ──
  const activeFamily = useMemo(
    () => families.find((f) => f.slug === activeSlug) ?? null,
    [families, activeSlug]
  );

  const activeGroup = useMemo(
    () => sourceGroups.find((g) => g.sourceSlug === activeSourceFamily) ?? sourceGroups[0] ?? null,
    [sourceGroups, activeSourceFamily]
  );

  const activeData = cache[activeSlug];
  const activeEntries = activeData?.entries ?? [];
  const activeEdition = activeData?.edition ?? null;
  const playerTracks = useMemo(() => entryPlaylist(activeEntries), [activeEntries]);
  const playerTop10 = useMemo(() => entryPlaylist(activeEntries.slice(0, 10)), [activeEntries]);
  const entryCount = activeEdition?.totalEntries ?? activeEntries.length;

  // 10% preview — minimum 5, always a whole number
  const previewCount = Math.max(5, Math.ceil(entryCount * 0.1));
  const previewEntries = activeEntries.slice(0, previewCount);
  const hiddenCount = Math.max(0, entryCount - previewCount);

  const newEntries = useMemo(() => activeEntries.filter((e) => e.movement === "new"), [activeEntries]);
  const climbers = useMemo(
    () => activeEntries.filter((e) => e.movement === "up").sort((a, b) => (b.movementAmount ?? 0) - (a.movementAmount ?? 0)),
    [activeEntries]
  );

  const topTrack = activeEntries[0] ?? null;
  const heroBg = topTrack?.artworkUrl ?? HERO_FALLBACK;
  const heroStyle = topTrack?.artworkUrl
    ? { backgroundImage: `url(${topTrack.artworkUrl})`, filter: "blur(90px) saturate(1.5)", transform: `scale(1.12) translateY(${scrollPos * 0.04}px)` }
    : { backgroundImage: `url(${HERO_FALLBACK})`, backgroundSize: "cover", backgroundPosition: "center" };

  const handleSourceFamilyTab = useCallback(
    (sourceSlug: string) => {
      if (sourceSlug === activeSourceFamily) return;
      const group = sourceGroups.find((g) => g.sourceSlug === sourceSlug);
      if (!group) return;
      const market = group.markets[0];
      setActiveSourceFamily(sourceSlug);
      setActiveSlug(market.slug);
      if (!cache[market.slug]) {
        loadFamilyEntry(market.slug, market);
      }
    },
    [activeSourceFamily, sourceGroups, cache, loadFamilyEntry]
  );

  const handleMarketSelect = useCallback(
    (marketSlug: string) => {
      if (marketSlug === activeSlug) return;
      setActiveSlug(marketSlug);
      if (!cache[marketSlug]) {
        const market = activeGroup?.markets.find((m) => m.slug === marketSlug);
        if (market) loadFamilyEntry(marketSlug, market);
      }
    },
    [activeSlug, cache, activeGroup, loadFamilyEntry]
  );

  const handlePlayTop10 = useCallback(() => {
    if (playerTop10.length > 0) playTrack(playerTop10[0], playerTop10, {
      pageType: "charts_directory",
      sourceSection: "hero",
    });
  }, [playerTop10, playTrack]);

  const handlePlayEntry = useCallback(
    (idx: number) => {
      const t = playerTracks[idx];
      if (t) playTrack(t, playerTracks, {
        pageType: "charts_directory",
        sourceSection: "leaderboard",
      });
    },
    [playerTracks, playTrack]
  );

  const handleJumpTo = useCallback((slug: string) => {
    setHighlightedSlug(slug);
    setTimeout(() => {
      document.getElementById(`entry-${slug}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 280);
    setTimeout(() => setHighlightedSlug(null), 2600);
  }, []);

  const totalEditions = families.reduce((sum, f) => sum + (f.editionCount ?? 0), 0);
  const totalEntries = families.reduce((sum, f) => sum + (f.entryCount ?? 0), 0);

  const metaLine = meta?.isStale
    ? `Cached (stale) · ${new Date(meta.fetchedAt).toLocaleString()}`
    : meta?.dataSource === "cache"
    ? `Cached · ${new Date(meta.fetchedAt).toLocaleString()}`
    : meta
    ? `Live · ${new Date(meta.fetchedAt).toLocaleTimeString()}`
    : "";

  // ── render: loading ──
  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-[var(--wk-bg)]">
        <section className="relative min-h-[420px] md:min-h-[540px] overflow-hidden flex items-end">
          <div className="absolute inset-0 bg-[var(--wk-surface-raised)] animate-pulse" />
          <div className="relative wk-container px-4 pb-8 pt-20 md:px-6 md:pb-14 md:pt-28 w-full space-y-4">
            <div className="h-8 w-32 rounded-full bg-[var(--wk-surface-strong)] animate-pulse" />
            <div className="h-14 w-2/3 rounded-xl bg-[var(--wk-surface-strong)] animate-pulse" />
            <div className="flex gap-3"><div className="h-9 w-36 rounded-full bg-[var(--wk-surface-strong)] animate-pulse" /><div className="h-9 w-24 rounded-full bg-[var(--wk-surface-strong)] animate-pulse" /></div>
          </div>
        </section>
        <section className="wk-container px-4 pt-12 md:px-6 md:pt-20">
          <div className="flex gap-2 mb-6 overflow-hidden">
            {[1,2,3,4].map((n) => <div key={n} className="h-9 w-32 rounded-full bg-[var(--wk-surface-raised)] animate-pulse shrink-0" />)}
          </div>
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2"><div className="h-8 w-8 rounded-full bg-[var(--wk-surface-raised)] animate-pulse" /><div className="h-10 w-10 rounded-lg bg-[var(--wk-surface-raised)] animate-pulse" /><div className="flex-1 space-y-1.5"><div className="h-3.5 w-1/2 rounded bg-[var(--wk-surface-raised)] animate-pulse" /><div className="h-2.5 w-1/3 rounded bg-[var(--wk-surface-raised)] animate-pulse" /></div></div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  // ── render: error ──
  if (phase === "error") {
    return (
      <div className="min-h-screen bg-[var(--wk-bg)] flex items-center justify-center px-4 py-20">
        <div className="max-w-sm w-full text-center">
          <div className="mb-4 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]">
            <i className="ri-error-warning-line text-2xl" />
          </div>
          <h1 className="text-[20px] font-black text-[var(--wk-text)] mb-2">Charts unavailable right now</h1>
          <p className="text-[14px] text-[var(--wk-text-muted)] mb-6">{errorMsg}</p>
          <button onClick={retry} className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-2.5 text-[13px] font-bold text-[var(--wk-brand-on)] transition-all hover:opacity-90">
            <i className="ri-refresh-line" /> Try again
          </button>
        </div>
      </div>
    );
  }

  // ── render: empty ──
  if (phase === "empty") {
    return (
      <div className="min-h-screen bg-[var(--wk-bg)] flex items-center justify-center px-4 py-20">
        <div className="max-w-sm w-full text-center">
          <div className="mb-4 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
            <i className="ri-bar-chart-box-line text-2xl" />
          </div>
          <h1 className="text-[20px] font-black text-[var(--wk-text)] mb-2">No charts out yet</h1>
          <p className="text-[14px] text-[var(--wk-text-muted)] mb-6">Check back soon. The charts are being compiled.</p>
          <button onClick={retry} className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-2.5 text-[13px] font-bold text-[var(--wk-brand-on)] transition-all hover:opacity-90">
            <i className="ri-refresh-line" /> Refresh
          </button>
        </div>
      </div>
    );
  }

  // ── render: main ──
  return (
    <div className="min-h-screen bg-[var(--wk-bg)]">
      {/* ═══════════════════════════════════════════
          HERO
          ═══════════════════════════════════════════ */}
      <section className="relative min-h-[480px] md:min-h-[620px] overflow-hidden flex items-end -mt-16">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-[var(--wk-d-slow)]"
          style={heroStyle}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--wk-bg)] via-[var(--wk-bg)]/80 to-[var(--wk-bg)]/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--wk-bg)]/60 via-transparent to-[var(--wk-bg)]/60" />

        <div className="relative z-10 wk-container w-full px-4 pb-10 pt-20 md:px-6 md:pb-16 md:pt-28">
          {/* Badge row */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand-soft)] border border-[var(--wk-brand)]/25 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.15em] text-[var(--wk-brand)]">
              <i className="ri-bar-chart-line text-[12px]" />
              WAKILISHA Charts
            </span>
            {activeEdition?.date && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)]/70 backdrop-blur-sm px-3 py-1.5 text-[11px] font-bold text-[var(--wk-text)]">
                <i className="ri-calendar-line text-[var(--wk-brand)] text-[12px]" />
                {activeEdition.date}
              </span>
            )}
            {activeGroup && activeGroup.markets.length > 1 && (
              <MarketSwitcher
                markets={activeGroup.markets}
                activeSlug={activeSlug}
                onSelect={handleMarketSelect}
              />
            )}
          </div>

          {/* Title */}
          <h1 className="max-w-[780px] text-[clamp(36px,6.5vw,80px)] font-black leading-[0.90] tracking-[-0.055em] text-[var(--wk-text)]">
            {activeGroup?.label ?? activeFamily?.publicLabel ?? activeFamily?.label ?? "African Charts"}
          </h1>

          {/* Description */}
          <p className="mt-4 max-w-[540px] text-[14px] leading-relaxed text-[var(--wk-text-soft)] md:text-[15px]">
            {activeGroup?.description || activeFamily?.description || "See what is rising, what is holding strong, what just entered the chat, and what everyone will be arguing about by Friday."}
          </p>

          {/* Meta pills */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)]/70 backdrop-blur-sm px-3 py-1.5 text-[11px] text-[var(--wk-text)]">
              <i className="ri-music-2-line text-[var(--wk-brand)] text-[12px]" />
              Top {entryCount}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)]/70 backdrop-blur-sm px-3 py-1.5 text-[11px] text-[var(--wk-text)]">
              <i className="ri-global-line text-[var(--wk-brand)] text-[12px]" />
              {activeFamily?.marketLabel ?? "Africa"}
            </span>
            {newEntries.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)]/70 backdrop-blur-sm px-3 py-1.5 text-[11px] text-[var(--wk-text)]">
                <span className="font-black text-[var(--wk-brand)]">{newEntries.length}</span> new this week
              </span>
            )}
          </div>

          {/* CTAs */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={handlePlayTop10}
              disabled={playerTop10.length === 0}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-2.5 text-[13px] font-bold text-[var(--wk-brand-on)] transition-all hover:opacity-90 disabled:opacity-40 whitespace-nowrap"
            >
              <i className="ri-play-fill" /> Listen to top 10
            </button>
            {activeEdition && (
              <Link
                to={`/charts/${activeSlug}/${activeEdition.slug}`}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border-2)] px-5 py-2.5 text-[13px] font-bold text-[var(--wk-text)] transition-all hover:bg-[var(--wk-surface)] whitespace-nowrap"
              >
                <i className="ri-arrow-right-line" /> Edition details
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          CHART FAMILY TABS + MARKET SWITCHER
          ═══════════════════════════════════════════ */}
      <section className="sticky top-0 z-30 border-b border-[var(--wk-border)] bg-[var(--wk-bg)]/95 backdrop-blur-md">
        <div className="wk-container px-4 md:px-6">
          <div className="flex flex-col gap-1.5 py-2">
            {/* Source family tabs */}
            <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1">
              {sourceGroups.map((group) => {
                const isActive = group.sourceSlug === activeSourceFamily;
                const totalInGroup = group.markets.reduce((sum, m) => sum + (m.entryCount ?? 0), 0);
                return (
                  <button
                    key={group.sourceSlug}
                    onClick={() => handleSourceFamilyTab(group.sourceSlug)}
                    className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[12px] font-bold transition-all duration-[var(--wk-d-fast)] whitespace-nowrap cursor-pointer ${
                      isActive
                        ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                        : "text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]"
                    }`}
                  >
                    <i className={`${group.icon} text-[13px]`} />
                    <span className="hidden sm:inline">{group.label}</span>
                    <span className="sm:hidden">{group.label.split(" ")[0] ?? group.sourceSlug}</span>
                    <span className={`text-[10px] tabular-nums ${isActive ? "opacity-70" : "opacity-40"}`}>
                      {totalInGroup}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Market pills (only for families with multiple markets) */}
            {activeGroup && activeGroup.markets.length > 1 && (
              <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-0.5">
                {activeGroup.markets.map((m) => {
                  const isActive = m.slug === activeSlug;
                  const data = cache[m.slug];
                  const count = data?.edition?.totalEntries ?? m.entryCount;
                  return (
                    <button
                      key={m.slug}
                      onClick={() => handleMarketSelect(m.slug)}
                      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all duration-[var(--wk-d-fast)] whitespace-nowrap cursor-pointer ${
                        isActive
                          ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)] border border-[var(--wk-brand)]/25"
                          : "text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)] border border-transparent"
                      }`}
                    >
                      <i className="ri-global-line text-[11px]" />
                      {m.marketLabel}
                      <span className={`text-[10px] tabular-nums ${isActive ? "opacity-60" : "opacity-40"}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          WAYS INTO THE CHARTS
          ═══════════════════════════════════════════ */}
      {mergedHighlightEntries.length > 0 && (
        <ChartHighlights
          entries={mergedHighlightEntries}
          onJumpTo={handleJumpTo}
        />
      )}

      {/* ═══════════════════════════════════════════
          LEADERBOARD + SIDEBAR
          ═══════════════════════════════════════════ */}
      <section className="wk-container px-4 py-8 md:px-6 md:py-12">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <div className="wk-eyebrow mb-2">This Week</div>
            <h2 className="wk-h-section">Top {previewCount}</h2>
            <p className="mt-1 text-[13px] text-[var(--wk-text-muted)]">
              {activeEdition?.date ?? ""} · {activeFamily?.marketLabel ?? ""} · Showing {previewCount} of {entryCount} positions
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-[12px] text-[var(--wk-text-faint)]">
            <span className="inline-flex items-center gap-1"><i className="ri-arrow-up-line text-[var(--wk-success)]" /> Up</span>
            <span className="inline-flex items-center gap-1"><i className="ri-arrow-down-line text-[var(--wk-danger)]" /> Down</span>
            <span className="inline-flex items-center gap-1"><i className="ri-star-smile-line text-[var(--wk-brand)]" /> New</span>
            <span className="inline-flex items-center gap-1"><i className="ri-refresh-line text-[var(--wk-info)]" /> Re</span>
          </div>
          {/* Compact legend for mobile */}
          <div className="flex md:hidden items-center gap-2 text-[10px] text-[var(--wk-text-faint)] shrink-0">
            <span className="inline-flex items-center gap-0.5"><i className="ri-arrow-up-line text-[var(--wk-success)] text-[11px]" /></span>
            <span className="inline-flex items-center gap-0.5"><i className="ri-arrow-down-line text-[var(--wk-danger)] text-[11px]" /></span>
            <span className="inline-flex items-center gap-0.5"><i className="ri-star-smile-line text-[var(--wk-brand)] text-[11px]" /></span>
            <span className="inline-flex items-center gap-0.5"><i className="ri-refresh-line text-[var(--wk-info)] text-[11px]" /></span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-[1fr_320px]">
          {/* Leaderboard card */}
          <div className="overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
            {/* Column headers (desktop) */}
            <div className="hidden md:flex items-center gap-3.5 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-faint)] border-b border-[var(--wk-divider)]">
              <div className="w-10 text-center">#</div>
              <div className="w-12" />
              <div className="flex-1">Track</div>
              <div className="w-16 text-right">Move</div>
              <div className="w-16 text-right">Stats</div>
              <div className="w-9" />
            </div>

            {/* Loading state for tab switch */}
            {switching && activeEntries.length === 0 ? (
              <div className="space-y-0 divide-y divide-[var(--wk-divider)]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                    <div className="h-8 w-8 rounded-full bg-[var(--wk-surface-raised)]" />
                    <div className="h-10 w-10 rounded-lg bg-[var(--wk-surface-raised)]" />
                    <div className="flex-1 space-y-1.5"><div className="h-3.5 w-1/2 rounded bg-[var(--wk-surface-raised)]" /><div className="h-2.5 w-1/3 rounded bg-[var(--wk-surface-raised)]" /></div>
                  </div>
                ))}
              </div>
            ) : previewEntries.length > 0 ? (
              <div>
                <div className="divide-y divide-[var(--wk-divider)]">
                  {previewEntries.map((entry, idx) => (
                    <LeaderboardRow
                      key={`${activeSlug}-${entry.rank}`}
                      entry={entry}
                      onPlay={() => handlePlayEntry(idx)}
                      rowId={`entry-${entry.slug}`}
                      isHighlighted={highlightedSlug === entry.slug}
                    />
                  ))}
                </div>

                {/* ── Teaser gate ── */}
                {hiddenCount > 0 && activeEdition && (
                  <div className="relative">
                    {/* Blurred ghost rows */}
                    <div className="pointer-events-none select-none opacity-30 blur-[2px]">
                      {activeEntries.slice(previewCount, previewCount + 3).map((entry) => (
                        <div key={`ghost-${entry.slug}`} className="flex items-center gap-3.5 border-t border-[var(--wk-divider)] px-4 py-3">
                          <div className="flex w-10 items-center justify-center">
                            <span className="text-[14px] font-bold text-[var(--wk-text-muted)] tabular-nums">{entry.rank}</span>
                          </div>
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                            {entry.artworkUrl && <img src={entry.artworkUrl} alt="" className="h-full w-full object-cover object-top" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[14px] font-bold text-[var(--wk-text)]">{entry.title}</div>
                            <div className="truncate text-[12px] text-[var(--wk-text-muted)]">{entry.artist}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Gradient fade + CTA */}
                    <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end pb-6 pt-16"
                      style={{ background: "linear-gradient(to bottom, transparent, var(--wk-surface) 55%)" }}
                    >
                      <p className="mb-3 text-[13px] font-semibold text-[var(--wk-text-muted)]">
                        +{hiddenCount} more tracks in this edition
                      </p>
                      <Link
                        to={`/charts/${activeSlug}/${activeEdition.slug}`}
                        className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-6 py-2.5 text-[13px] font-bold text-[var(--wk-brand-on)] transition-all hover:opacity-90 whitespace-nowrap"
                      >
                        See the full chart
                        <i className="ri-arrow-right-line text-[13px]" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="px-4 py-12 text-center">
                <p className="text-[14px] text-[var(--wk-text-muted)]">No entries available for this chart yet.</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-3 md:gap-4">
            {/* Quick stats */}
            <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3.5 md:p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] mb-3">
                This chart
              </div>
              <div className="grid grid-cols-2 gap-2 md:gap-2.5">
                <StatTile value={entryCount} label="Songs ranked" />
                <StatTile value={sourceGroups.length} label="Chart series" />
                <StatTile value={totalEditions} label="Past charts" />
                <StatTile value={newEntries.length} label="New entries" />
              </div>
            </div>

            {/* New entries */}
            <SidebarCard
              title="New this week"
              entries={newEntries}
              badge="New"
              emptyLabel="No debuts this week"
            />

            {/* Biggest climbers */}
            <SidebarCard
              title="Biggest climbers"
              entries={climbers}
              badge="↑"
              emptyLabel="No big moves this week"
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          METHODOLOGY
          ═══════════════════════════════════════════ */}
      <section className="wk-container px-4 py-6 md:px-6 md:py-12">
        <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="hidden md:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
                <i className="ri-shield-check-line text-lg" />
              </div>
              <div>
                <div className="text-[13px] font-bold text-[var(--wk-text)] mb-1">How the charts work</div>
                <div className="text-[12px] leading-relaxed text-[var(--wk-text-muted)] max-w-[640px]">
                  Combined streaming data from Spotify, Apple Music, YouTube, and Boomplay. Radio airplay monitored across African countries. All tracks independently verified.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-[var(--wk-text-faint)] shrink-0">
              <span><span className="font-bold text-[var(--wk-text)] tabular-nums">{totalEditions}</span> editions</span>
              <span>·</span>
              <span><span className="font-bold text-[var(--wk-text)] tabular-nums">{totalEntries}</span> entries tracked</span>
              <span>·</span>
              <ChartRefreshButton onRefresh={retry} size="sm" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          FOOTER META
          ═══════════════════════════════════════════ */}
      <div className="border-t border-[var(--wk-border)] bg-[var(--wk-bg)]">
        <div className="wk-container px-4 py-3 md:px-6 text-center">
          <span className="text-[11px] text-[var(--wk-text-faint)]">{metaLine}</span>
        </div>
      </div>
    </div>
  );
}