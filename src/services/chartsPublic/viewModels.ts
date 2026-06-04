import type {
  ChartFamily,
  ChartEdition,
  ChartEditionEntry,
} from "./types";

// ─── Metadata for page-level source awareness ───

export interface ChartPageMeta {
  dataSource: "mock" | "wordpress" | "cache";
  fetchedAt: string;
  isStale: boolean;
}

// ─── View model types for public chart pages ───

export interface ChartFamilyViewModel {
  id: string;
  slug: string;
  sourceFamilySlug: string;
  seriesSlug: string;
  seriesLabel: string;
  marketSlug: string;
  marketLabel: string;
  publicSlug: string;
  publicLabel: string;
  shortLabel: string;
  chartMode: "data" | "editorial" | "hybrid";
  periodType: "weekly" | "monthly" | "yearly" | "evergreen";
  methodologyVersion: string;
  eligibilityRulesVersion: string;
  legacySlugs: string[];
  label: string;
  description: string;
  entryCount: number;
  editionCount: number;
  accentColor: string;
  icon: string;
  latestEditionSlug?: string;
  latestEditionLabel?: string;
  latestEditionDate?: string;
}

export interface ChartEditionViewModel {
  id: string;
  slug: string;
  label: string;
  date: string;
  weekNumber?: string;
  periodStart: string;
  periodEnd: string;
  totalEntries: number;
  totalArtists: number;
  newEntries: number;
  reEntries: number;
  methodology: string;
  methodologyVersion: string;
  eligibilityRulesVersion: string;
  chartMode: "data" | "editorial" | "hybrid";
  periodType: "weekly" | "monthly" | "yearly" | "evergreen";
  biggestMover?: { title: string; artist: string; amount: number };
  topGenre?: string;
  topGenreCount?: number;
  longestRunning?: { title: string; artist: string; weeks: number };
  familySlug: string;
  familyLabel: string;
  sourceFamilySlug: string;
  seriesSlug: string;
  seriesLabel: string;
  marketSlug: string;
  marketLabel: string;
  publicSlug: string;
  publicLabel: string;
}

export interface ChartEntryRowViewModel {
  rank: number;
  previousRank: number | null;
  movement: "up" | "down" | "same" | "new" | "re_entry";
  movementAmount: number | null;
  title: string;
  artist: string;
  artistNames: string[];
  artistSlugs: string[];
  artworkUrl: string | null;
  slug: string;
  genre: string | null;
  peakPosition: number;
  weeksOnChart: number;
  isPlayable: boolean;
  source: string;
  score: number;
  duration?: number;
}

export interface ChartDirectoryViewModel {
  families: ChartFamilyViewModel[];
  featuredFamily: ChartFamilyViewModel | null;
  featuredEdition: ChartEditionViewModel | null;
  topEntries: ChartEntryRowViewModel[];
  stats: {
    entries: number;
    series: number;
    editions: number;
    newThisWeek: number;
  };
  meta: ChartPageMeta;
}

export interface ChartTrackPlayerModel {
  id: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  isPlayable?: boolean;
  source?: string;
  duration?: number;
}

// ─── Archive view models ───

export interface ChartEditionArchiveItem {
  slug: string;
  label: string;
  date: string;
  entryCount: number;
  isLatest: boolean;
  no1Track?: {
    title: string;
    artist: string;
    artworkUrl: string | null;
  };
  newCount?: number;
  droppedCount?: number;
}

export interface ChartArchiveViewModel {
  latest: ChartEditionArchiveItem | null;
  previous: ChartEditionArchiveItem[];
}

// ─── Track chart history view model ───

export interface ChartTrackHistoryViewModel {
  trackSlug: string;
  trackTitle: string;
  artistNames: string[];
  appearances: {
    editionSlug: string;
    editionLabel: string;
    rank: number;
    weeksOnChart: number;
    movement: "up" | "down" | "same" | "new" | "re_entry";
    date: string;
  }[];
  peakPosition: number;
  totalWeeksOnChart: number;
  firstAppearance: string | null;
  latestAppearance: string | null;
}

// ─── Accent colors and icons for families ───

const FAMILY_ACCENT: Record<string, string> = {
  "top-songs-kenya": "#84C241",
  "rnb-kenya": "#D6766A",
  "gengetone-kenya": "#E8A23A",
  "2026-releases-kenya": "#4FD9C2",
  kenya: "#84C241",
  rnb: "#D6766A",
  gengetone: "#E8A23A",
  "2026": "#4FD9C2",
  "weekly-top-40": "#84C241",
  "rising-voices": "#E8A23A",
  "genre-pulse": "#D6766A",
  classics: "#C9A96E",
  breakout: "#4FD9C2",
};

const FAMILY_ICON: Record<string, string> = {
  "top-songs-kenya": "ri-bar-chart-line",
  "rnb-kenya": "ri-pulse-line",
  "gengetone-kenya": "ri-fire-line",
  "2026-releases-kenya": "ri-calendar-event-line",
  kenya: "ri-bar-chart-line",
  rnb: "ri-pulse-line",
  gengetone: "ri-fire-line",
  "2026": "ri-calendar-event-line",
  "weekly-top-40": "ri-bar-chart-line",
  "rising-voices": "ri-rocket-line",
  "genre-pulse": "ri-pulse-line",
  classics: "ri-vip-crown-line",
  breakout: "ri-fire-line",
};

function familyPublicSlug(family: ChartFamily): string {
  return family.publicSlug ?? family.slug ?? family.familyKey;
}

function editionBelongsToFamily(edition: ChartEdition, family: ChartFamily): boolean {
  const publicSlug = familyPublicSlug(family);
  const sourceFamilySlug = family.sourceFamilySlug ?? family.familyKey ?? family.id;
  const candidates = new Set([
    family.id,
    family.slug,
    family.familyKey,
    family.publicSlug,
    publicSlug,
    sourceFamilySlug,
  ].filter(Boolean));
  return candidates.has(edition.familyId);
}

// ─── Adapter functions ───

export function toChartEntryRowViewModel(
  entry: ChartEditionEntry
): ChartEntryRowViewModel {
  const rich = entry as ChartEditionEntry & {
    genre?: string;
    source?: string;
    isPlayable?: boolean;
    duration?: number;
    movementAmount?: number;
  };

  // previousRank of 0 means no prior comparison data exists (first ingest or broken pipeline).
  // Treat it as null so movementAmount stays null (correctly indicating unknown delta).
  const effectivePreviousRank =
    entry.previousRank !== null && entry.previousRank > 0
      ? entry.previousRank
      : null;

  const movementAmount =
    rich.movementAmount ??
    (effectivePreviousRank !== null
      ? Math.abs(effectivePreviousRank - entry.rank)
      : null);

  return {
    rank: entry.rank,
    previousRank: effectivePreviousRank,
    movement: entry.movement,
    movementAmount,
    title: entry.trackTitle,
    artist: entry.artistNames.join(", "),
    artistNames: entry.artistNames,
    artistSlugs: entry.artistSlugs ?? [],
    artworkUrl: entry.artworkUrl,
    slug: entry.trackSlug,
    genre: rich.genre ?? null,
    peakPosition: entry.peakPosition ?? entry.rank,
    weeksOnChart: entry.weeksOnChart ?? 1,
    isPlayable: rich.isPlayable ?? true,
    source: rich.source ?? "WAKILISHA chart data",
    score: entry.score,
    duration: rich.duration ?? 180 + ((entry.trackTitle.length * 7) % 120),
  };
}

export function toChartFamilyViewModel(
  family: ChartFamily,
  editions: ChartEdition[]
): ChartFamilyViewModel {
  const sourceFamilySlug = family.sourceFamilySlug ?? family.familyKey ?? family.id;
  const publicSlug = familyPublicSlug(family);
  const familyEditions = editions.filter((e) => editionBelongsToFamily(e, family));
  const latest = familyEditions[0];
  return {
    id: family.id,
    slug: publicSlug,
    sourceFamilySlug,
    seriesSlug: family.seriesSlug ?? publicSlug,
    seriesLabel: family.seriesLabel ?? family.label,
    marketSlug: family.marketSlug ?? "unspecified",
    marketLabel: family.marketLabel ?? "Unspecified",
    publicSlug,
    publicLabel: family.publicLabel ?? family.label,
    shortLabel: family.shortLabel ?? family.label,
    chartMode: family.chartMode ?? "data",
    periodType: family.periodType ?? "weekly",
    methodologyVersion: family.methodologyVersion ?? family.defaultScoringModel,
    eligibilityRulesVersion: family.eligibilityRulesVersion ?? family.defaultRuleset,
    legacySlugs: family.legacySlugs ?? [family.slug, family.familyKey, family.id].filter(Boolean) as string[],
    label: family.publicLabel ?? family.label,
    description: family.description,
    entryCount: family.defaultChartSize,
    editionCount: familyEditions.length,
    accentColor: FAMILY_ACCENT[publicSlug] ?? FAMILY_ACCENT[sourceFamilySlug] ?? "var(--wk-brand)",
    icon: FAMILY_ICON[publicSlug] ?? FAMILY_ICON[sourceFamilySlug] ?? "ri-bar-chart-line",
    latestEditionSlug: latest?.slug,
    latestEditionLabel: latest?.label,
    latestEditionDate: latest?.date,
  };
}

export function toChartEditionViewModel(
  edition: ChartEdition,
  family: ChartFamily,
  entries: ChartEditionEntry[]
): ChartEditionViewModel {
  const artists = new Set(entries.flatMap((e) => e.artistNames));
  const newEntries = entries.filter((e) => e.movement === "new").length;
  const reEntries = entries.filter((e) => e.movement === "re_entry").length;
  const sourceFamilySlug = family.sourceFamilySlug ?? family.familyKey ?? family.id;
  const publicSlug = familyPublicSlug(family);

  const longest = entries.reduce(
    (longest, e) => {
      const w = e.weeksOnChart ?? 0;
      return w > (longest?.weeks ?? 0)
        ? {
            title: e.trackTitle,
            artist: e.artistNames.join(", "),
            weeks: w,
          }
        : longest;
    },
    null as { title: string; artist: string; weeks: number } | null
  );

  const biggestMover = entries
    .filter((e) => e.movement === "up")
    .reduce(
      (biggest, e) => {
        const rich = e as ChartEditionEntry & { movementAmount?: number };
        const amt = rich.movementAmount ?? 0;
        return amt > (biggest?.amount ?? 0)
          ? {
              title: e.trackTitle,
              artist: e.artistNames.join(", "),
              amount: amt,
            }
          : biggest;
      },
      null as { title: string; artist: string; amount: number } | null
    );

  const genreCounts: Record<string, number> = {};
  entries.forEach((e) => {
    const rich = e as ChartEditionEntry & { genre?: string };
    const g = rich.genre ?? "Unclassified";
    genreCounts[g] = (genreCounts[g] || 0) + 1;
  });
  const topGenreEntry = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0];

  const weekNumber = edition.label.match(/Week\s+(\d+)/)?.[1];

  return {
    id: edition.id,
    slug: edition.slug,
    label: edition.label,
    date: edition.date,
    weekNumber,
    periodStart: edition.periodStart,
    periodEnd: edition.periodEnd,
    totalEntries: entries.length,
    totalArtists: artists.size,
    newEntries,
    reEntries,
    methodology:
      `Methodology ${family.methodologyVersion ?? family.defaultScoringModel}: ranked from WAKILISHA chart source data with immutable edition partitioning and preserved source provenance.`,
    methodologyVersion: family.methodologyVersion ?? family.defaultScoringModel,
    eligibilityRulesVersion: family.eligibilityRulesVersion ?? family.defaultRuleset,
    chartMode: family.chartMode ?? "data",
    periodType: family.periodType ?? "weekly",
    biggestMover: biggestMover ?? undefined,
    topGenre: topGenreEntry?.[0] ?? undefined,
    topGenreCount: topGenreEntry?.[1] ?? 0,
    longestRunning: longest ?? undefined,
    familySlug: publicSlug,
    familyLabel: family.publicLabel ?? family.label,
    sourceFamilySlug,
    seriesSlug: family.seriesSlug ?? publicSlug,
    seriesLabel: family.seriesLabel ?? family.label,
    marketSlug: family.marketSlug ?? "unspecified",
    marketLabel: family.marketLabel ?? "Unspecified",
    publicSlug,
    publicLabel: family.publicLabel ?? family.label,
  };
}

export function toChartDirectoryViewModel(
  families: ChartFamily[],
  editions: ChartEdition[],
  featuredFamilySlug: string,
  featuredEdition: ChartEdition | null,
  featuredEntries: ChartEditionEntry[],
  meta: ChartPageMeta
): ChartDirectoryViewModel {
  const familyVMs = families.map((f) => toChartFamilyViewModel(f, editions));
  const featuredFamily =
    familyVMs.find((f) => f.slug === featuredFamilySlug || f.sourceFamilySlug === featuredFamilySlug || f.legacySlugs.includes(featuredFamilySlug)) ?? familyVMs[0] ?? null;

  const topEntries = featuredEntries
    .map(toChartEntryRowViewModel);

  const totalEditions = editions.length;
  const newThisWeek = featuredEntries.filter((e) => e.movement === "new").length;

  const featuredEditionVM =
    featuredFamily && featuredEdition
      ? toChartEditionViewModel(
          featuredEdition,
          families.find((f) => {
            const publicSlug = f.publicSlug ?? f.slug ?? f.familyKey;
            return publicSlug === featuredFamily.slug || f.familyKey === featuredFamily.sourceFamilySlug || f.id === featuredFamily.sourceFamilySlug;
          }) ?? families[0],
          featuredEntries
        )
      : null;

  return {
    families: familyVMs,
    featuredFamily,
    featuredEdition: featuredEditionVM,
    topEntries,
    stats: {
      entries: featuredEntries.length,
      series: new Set(familyVMs.map((family) => family.seriesSlug)).size,
      editions: totalEditions,
      newThisWeek,
    },
    meta,
  };
}

export function toChartArchiveViewModel(
  editions: ChartEdition[],
  entriesMap: Record<string, ChartEditionEntry[]>
): ChartArchiveViewModel {
  const sorted = [...editions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const items: ChartEditionArchiveItem[] = sorted.map((edition, idx) => {
    const entries = entriesMap[edition.slug] ?? [];
    const no1 = entries[0];

    // Compute new/dropped counts by comparing with the chronologically prior edition
    let newCount: number | undefined;
    let droppedCount: number | undefined;

    if (idx < sorted.length - 1) {
      const priorEdition = sorted[idx + 1];
      const priorEntries = entriesMap[priorEdition.slug];

      if (priorEntries && priorEntries.length > 0) {
        const currentSlugs = new Set(entries.map((e) => e.trackSlug));
        const priorSlugs = new Set(priorEntries.map((e) => e.trackSlug));

        // Tracks in current but not in prior = new entries
        newCount = [...currentSlugs].filter((s) => !priorSlugs.has(s)).length;

        // Tracks in prior but not in current = dropped entries
        droppedCount = [...priorSlugs].filter((s) => !currentSlugs.has(s)).length;
      }
    }

    return {
      slug: edition.slug,
      label: edition.label,
      date: edition.date,
      entryCount: entries.length > 0 ? entries.length : edition.entryCount,
      isLatest: idx === 0,
      no1Track: no1
        ? {
            title: no1.trackTitle,
            artist: no1.artistNames.join(", "),
            artworkUrl: no1.artworkUrl,
          }
        : undefined,
      newCount,
      droppedCount,
    };
  });

  return {
    latest: items[0] ?? null,
    previous: items.slice(1),
  };
}

export function toChartTrackPlayerModel(entry: ChartEntryRowViewModel): ChartTrackPlayerModel {
  return {
    id: entry.slug,
    title: entry.title,
    artist: entry.artist,
    artworkUrl: entry.artworkUrl ?? undefined,
    isPlayable: entry.isPlayable,
    source: entry.source,
    duration: entry.duration,
  };
}

export function toChartTrackPlayerModels(entries: ChartEntryRowViewModel[]): ChartTrackPlayerModel[] {
  return entries.map(toChartTrackPlayerModel);
}

export function toChartTrackHistoryViewModel(
  history: import("./types").TrackChartHistory
): ChartTrackHistoryViewModel {
  return {
    trackSlug: history.trackSlug,
    trackTitle: history.trackTitle,
    artistNames: history.artistNames,
    appearances: history.appearances.map((appearance) => ({
      ...appearance,
      date: appearance.editionLabel,
    })),
    peakPosition: history.peakPosition,
    totalWeeksOnChart: history.totalWeeksOnChart,
    firstAppearance: history.firstAppearance,
    latestAppearance: history.latestAppearance,
  };
}

// ─── Movement computation from prior edition ───

export interface ComputedMovement {
  previousRank: number | null;
  movement: ChartEditionEntry["movement"];
  movementAmount: number | null;
}

/**
 * Computes real movement data by comparing current edition entries
 * against the same track's rank in the previous edition (by chart date).
 * 
 * This exists because the database `previous_rank` field is often 0/null
 * when all editions are ingested at once — the ingest pipeline doesn't
 * always populate comparison data. We derive it ourselves by loading
 * the prior edition and cross-referencing by track slug.
 */
export function computeMovementFromPriorEdition(
  currentEntries: ChartEditionEntry[],
  priorRankMap: Map<string, number>,
): ChartEditionEntry[] {
  return currentEntries.map((entry) => {
    const priorRank = priorRankMap.get(entry.trackSlug);
    
    if (priorRank === undefined) {
      // Track wasn't in the prior edition — it's either a debut or re-entry
      // We can't distinguish the two without more data, so call it "new"
      return {
        ...entry,
        previousRank: null,
        movement: "new" as const,
      };
    }
    
    const delta = priorRank - entry.rank;
    const movementAmount = Math.abs(delta);
    
    let movement: ChartEditionEntry["movement"];
    if (delta > 0) {
      movement = "up";
    } else if (delta < 0) {
      movement = "down";
    } else {
      movement = "same";
    }
    
    return {
      ...entry,
      previousRank: priorRank,
      movement,
      movementAmount,
    };
  });
}
