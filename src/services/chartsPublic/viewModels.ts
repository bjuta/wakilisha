import type {
  ChartFamily,
  ChartEdition,
  ChartEditionEntry,
} from "./types";

// ─── View model types for public chart pages ───

export interface ChartFamilyViewModel {
  id: string;
  slug: string;
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
  biggestMover?: { title: string; artist: string; amount: number };
  topGenre?: string;
  topGenreCount?: number;
  longestRunning?: { title: string; artist: string; weeks: number };
  familySlug: string;
  familyLabel: string;
}

export interface ChartEntryRowViewModel {
  rank: number;
  previousRank: number | null;
  movement: "up" | "down" | "same" | "new" | "re_entry";
  movementAmount: number | null;
  title: string;
  artist: string;
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

// ─── Accent colors and icons for families ───

const FAMILY_ACCENT: Record<string, string> = {
  "weekly-top-40": "#84C241",
  "rising-voices": "#E8A23A",
  "genre-pulse": "#D6766A",
  "classics": "#C9A96E",
  "breakout": "#4FD9C2",
};

const FAMILY_ICON: Record<string, string> = {
  "weekly-top-40": "ri-bar-chart-line",
  "rising-voices": "ri-rocket-line",
  "genre-pulse": "ri-pulse-line",
  "classics": "ri-vip-crown-line",
  "breakout": "ri-fire-line",
};

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

  const movementAmount =
    rich.movementAmount ??
    (entry.previousRank !== null
      ? Math.abs(entry.previousRank - entry.rank)
      : null);

  return {
    rank: entry.rank,
    previousRank: entry.previousRank,
    movement: entry.movement,
    movementAmount,
    title: entry.trackTitle,
    artist: entry.artistNames.join(", "),
    artworkUrl: entry.artworkUrl,
    slug: entry.trackSlug,
    genre: rich.genre ?? "Afrobeats",
    peakPosition: entry.peakPosition ?? entry.rank,
    weeksOnChart: entry.weeksOnChart ?? 1,
    isPlayable: rich.isPlayable ?? true,
    source: rich.source ?? "Spotify",
    score: entry.score,
    duration: rich.duration ?? 180 + ((entry.trackTitle.length * 7) % 120),
  };
}

export function toChartFamilyViewModel(
  family: ChartFamily,
  editions: ChartEdition[]
): ChartFamilyViewModel {
  const familyEditions = editions.filter((e) => e.familyId === family.id);
  const latest = familyEditions[0];
  return {
    id: family.id,
    slug: family.slug ?? family.familyKey,
    label: family.label,
    description: family.description,
    entryCount: family.defaultChartSize,
    editionCount: familyEditions.length,
    accentColor: FAMILY_ACCENT[family.id] ?? "var(--wk-brand)",
    icon: FAMILY_ICON[family.id] ?? "ri-bar-chart-line",
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
    const g = rich.genre ?? "Unknown";
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
      "Combined streaming data from Spotify, Apple Music, YouTube, and Boomplay. Radio airplay monitored across 12 African countries. Social engagement, playlist adds, and search volume weighted into final scores.",
    biggestMover: biggestMover ?? undefined,
    topGenre: topGenreEntry?.[0] ?? "Afrobeats",
    topGenreCount: topGenreEntry?.[1] ?? 0,
    longestRunning: longest ?? undefined,
    familySlug: family.slug ?? family.familyKey,
    familyLabel: family.label,
  };
}

export function toChartDirectoryViewModel(
  families: ChartFamily[],
  editions: ChartEdition[],
  featuredFamilySlug: string,
  featuredEdition: ChartEdition | null,
  featuredEntries: ChartEditionEntry[]
): ChartDirectoryViewModel {
  const familyVMs = families.map((f) => toChartFamilyViewModel(f, editions));
  const featuredFamily =
    familyVMs.find((f) => f.slug === featuredFamilySlug) ?? familyVMs[0] ?? null;

  const topEntries = featuredEntries
    .slice(0, 5)
    .map(toChartEntryRowViewModel);

  const totalEditions = editions.length;
  const newThisWeek = featuredEntries.filter((e) => e.movement === "new").length;

  const featuredEditionVM =
    featuredFamily && featuredEdition
      ? toChartEditionViewModel(
          featuredEdition,
          families.find((f) => (f.slug ?? f.familyKey) === featuredFamilySlug) ?? families[0],
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
      series: families.length,
      editions: totalEditions,
      newThisWeek,
    },
  };
}

export function toChartTrackPlayerModel(
  entry: ChartEntryRowViewModel
): ChartTrackPlayerModel {
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

export function toChartTrackPlayerModels(
  entries: ChartEntryRowViewModel[]
): ChartTrackPlayerModel[] {
  return entries.map(toChartTrackPlayerModel);
}

// ─── Re-export types for convenience ───
export type {
  ChartFamily,
  ChartEdition,
  ChartEditionEntry,
} from "./types";