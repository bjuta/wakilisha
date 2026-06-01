import type { ChartFamily, ChartEdition, ChartEditionEntry, TrackChartHistory } from "./types";
import {
  hasImportedChartData,
  getChartSeriesSummaries,
  getChartEditionsForSeries,
  getChartRowsForEdition,
} from "../../data/registry/registry";
import { applyChartFamilyPresentation, resolveSourceFamilySlug } from "./chartPresentation";

// ─── Registry-backed mock data ────────────────────────────────────────────────
// Public chart pages run through this mock client until the WordPress public API is live.
// When imported registry data exists, preserve edition boundaries exactly instead of
// flattening latest rows into one shared entry pool.

type RegistryRow = ReturnType<typeof getChartRowsForEdition>[number];

type RegistryData = {
  entries: ChartEditionEntry[];
  families: ChartFamily[];
  editions: ChartEdition[];
};

const toIsoDate = (value: string | null | undefined, fallback = "2026-05-31") => value || fallback;
const stableImage = (seed: string) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/600/600`;

function toMovement(value: unknown): ChartEditionEntry["movement"] {
  return value === "up" || value === "down" || value === "same" || value === "new" || value === "re_entry"
    ? value
    : "same";
}

function registryRowToEntry(row: RegistryRow, edition: { id: string }, index: number): ChartEditionEntry {
  const rank = row.rank ?? index + 1;
  const previousRank = row.previousRank ?? null;
  const trackSlug = row.slug ?? `chart-entry-${edition.id}-${rank}`;
  const movement = toMovement(row.movement);

  return {
    id: `${edition.id}::${String(rank).padStart(3, "0")}::${trackSlug}`,
    editionId: edition.id,
    rank,
    previousRank,
    movement,
    peakPosition: row.peakPosition ?? rank,
    weeksOnChart: row.weeksOnChart ?? row.weeks ?? 1,
    trackSlug,
    trackTitle: row.title,
    artistSlugs: [],
    artistNames: [row.artist],
    artworkUrl: row.artworkUrl ?? stableImage(trackSlug),
    score: Math.max(100, 1000 - index * 18),
    entryPayload: {
      registrySeriesId: row.seriesId,
      registryEditionId: row.editionId,
      previousWeek: row.previousWeek,
      label: row.label,
    },
    genre: row.genre ?? "Unknown",
    source: row.source ?? "WAKILISHA Registry",
    isPlayable: row.isPlayable ?? false,
    duration: undefined,
    movementAmount: row.movementAmount ?? (previousRank ? Math.abs(previousRank - rank) : 0),
  };
}

function buildRegistryData(): RegistryData | null {
  try {
    if (!hasImportedChartData()) return null;

    const seriesSummaries = getChartSeriesSummaries();
    if (!seriesSummaries.length) return null;

    const families: ChartFamily[] = seriesSummaries.map((series) => {
      const base = {
        id: series.id,
        familyKey: series.id,
        label: series.label,
        description: series.description ?? "Imported WAKILISHA chart series",
        defaultChartSize: series.entryCount ?? 40,
        defaultRegion: "global",
        editionFrequency: "weekly" as const,
        defaultRuleset: "default",
        defaultScoringModel: "weighted_streaming",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: new Date().toISOString(),
        slug: series.id,
      };
      return applyChartFamilyPresentation(base);
    });

    const editions: ChartEdition[] = [];
    const entries: ChartEditionEntry[] = [];

    for (const series of seriesSummaries) {
      const registryEditions = getChartEditionsForSeries(series.id);
      for (const edition of registryEditions) {
        const rows = getChartRowsForEdition(series.id, edition.slug);
        const editionEntries = rows.map((row, index) => registryRowToEntry(row, edition, index));

        entries.push(...editionEntries);
        editions.push({
          id: edition.id,
          familyId: series.id,
          slug: edition.slug,
          label: edition.label,
          date: toIsoDate(edition.date),
          periodStart: edition.period ?? "",
          periodEnd: edition.period ?? "",
          status: "published",
          ingestJobId: null,
          publishedAt: edition.date ? `${edition.date}T00:00:00Z` : null,
          publishedBy: "WAKILISHA Registry Import",
          entryCount: editionEntries.length,
          newEntries: editionEntries.filter((entry) => entry.movement === "new").length,
          reEntries: editionEntries.filter((entry) => entry.movement === "re_entry").length,
        });
      }
    }

    if (!entries.length || !editions.length) return null;
    return { entries, families, editions };
  } catch (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn("[chartsPublic/mockData] Failed to build registry-backed chart data", error);
    }
    return null;
  }
}

const registryData = buildRegistryData();

// ─── Hardcoded fallback data ──────────────────────────────────────────────────
// Used only when no imported registry chart data exists. Unlike the old fallback,
// entries are generated per edition so archive pages never relabel one shared pool.

const fallbackFamilies: ChartFamily[] = [
  {
    id: "weekly-top-40",
    familyKey: "weekly-top-40",
    label: "Weekly Top 40",
    description: "The definitive weekly ranking of the most streamed and played tracks across Africa.",
    defaultChartSize: 40,
    defaultRegion: "global",
    editionFrequency: "weekly",
    defaultRuleset: "default",
    defaultScoringModel: "weighted_streaming",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2026-05-31T00:00:00Z",
    slug: "weekly-top-40",
    sourceFamilySlug: "weekly-top-40",
    seriesSlug: "weekly-top-40",
    seriesLabel: "Weekly Top 40",
    marketSlug: "global",
    marketLabel: "Global",
    publicSlug: "weekly-top-40",
    publicLabel: "Weekly Top 40 · Global",
    shortLabel: "Top 40",
    chartMode: "data",
    periodType: "weekly",
    methodologyVersion: "weighted_streaming_v1",
    eligibilityRulesVersion: "default_v1",
    legacySlugs: ["weekly-top-40", "top-40", "weeklytop40"],
  },
  {
    id: "rising-voices",
    familyKey: "rising-voices",
    label: "Rising Voices",
    description: "Emerging artists breaking into the mainstream for the first time.",
    defaultChartSize: 20,
    defaultRegion: "global",
    editionFrequency: "weekly",
    defaultRuleset: "breakout",
    defaultScoringModel: "velocity_weighted",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2026-05-31T00:00:00Z",
    slug: "rising-voices",
    sourceFamilySlug: "rising-voices",
    seriesSlug: "rising-voices",
    seriesLabel: "Rising Voices",
    marketSlug: "global",
    marketLabel: "Global",
    publicSlug: "rising-voices",
    publicLabel: "Rising Voices · Global",
    shortLabel: "Rising",
    chartMode: "data",
    periodType: "weekly",
    methodologyVersion: "velocity_weighted_v1",
    eligibilityRulesVersion: "breakout_v1",
    legacySlugs: ["rising-voices", "risingvoices", "breakout"],
  },
  {
    id: "genre-pulse",
    familyKey: "genre-pulse",
    label: "Genre Pulse",
    description: "Deep dives into specific genres shaping the African soundscape.",
    defaultChartSize: 30,
    defaultRegion: "global",
    editionFrequency: "monthly",
    defaultRuleset: "genre_focused",
    defaultScoringModel: "weighted_streaming",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2026-05-31T00:00:00Z",
    slug: "genre-pulse",
    sourceFamilySlug: "genre-pulse",
    seriesSlug: "genre-pulse",
    seriesLabel: "Genre Pulse",
    marketSlug: "global",
    marketLabel: "Global",
    publicSlug: "genre-pulse",
    publicLabel: "Genre Pulse · Global",
    shortLabel: "Genre",
    chartMode: "hybrid",
    periodType: "monthly",
    methodologyVersion: "weighted_streaming_v1",
    eligibilityRulesVersion: "genre_focused_v1",
    legacySlugs: ["genre-pulse", "genrepulse", "genre"],
  },
  {
    id: "classics",
    familyKey: "classics",
    label: "Classics",
    description: "Timeless tracks that continue to define African music heritage.",
    defaultChartSize: 25,
    defaultRegion: "global",
    editionFrequency: "monthly",
    defaultRuleset: "legacy",
    defaultScoringModel: "engagement_weighted",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2026-05-31T00:00:00Z",
    slug: "classics",
    sourceFamilySlug: "classics",
    seriesSlug: "classics",
    seriesLabel: "Classics",
    marketSlug: "global",
    marketLabel: "Global",
    publicSlug: "classics",
    publicLabel: "Classics · Global",
    shortLabel: "Classics",
    chartMode: "editorial",
    periodType: "evergreen",
    methodologyVersion: "engagement_weighted_v1",
    eligibilityRulesVersion: "legacy_v1",
    legacySlugs: ["classics", "classic", "timeless"],
  },
  {
    id: "breakout",
    familyKey: "breakout",
    label: "Breakout",
    description: "The fastest rising tracks showing the most velocity this week.",
    defaultChartSize: 15,
    defaultRegion: "global",
    editionFrequency: "weekly",
    defaultRuleset: "velocity",
    defaultScoringModel: "velocity_weighted",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2026-05-31T00:00:00Z",
    slug: "breakout",
    sourceFamilySlug: "breakout",
    seriesSlug: "breakout",
    seriesLabel: "Breakout",
    marketSlug: "global",
    marketLabel: "Global",
    publicSlug: "breakout",
    publicLabel: "Breakout · Global",
    shortLabel: "Breakout",
    chartMode: "data",
    periodType: "weekly",
    methodologyVersion: "velocity_weighted_v1",
    eligibilityRulesVersion: "velocity_v1",
    legacySlugs: ["breakout", "fastest-rising", "rising"],
  },
];

const fallbackEditions: ChartEdition[] = [
  ["weekly-top-40", "week-22-2026", "Week 22, 2026", "2026-05-31", 40],
  ["weekly-top-40", "week-21-2026", "Week 21, 2026", "2026-05-24", 40],
  ["weekly-top-40", "week-20-2026", "Week 20, 2026", "2026-05-17", 40],
  ["weekly-top-40", "week-19-2026", "Week 19, 2026", "2026-05-10", 40],
  ["rising-voices", "week-22-2026", "Week 22, 2026", "2026-05-31", 20],
  ["rising-voices", "week-21-2026", "Week 21, 2026", "2026-05-24", 20],
  ["genre-pulse", "may-2026", "May 2026", "2026-05-31", 30],
  ["genre-pulse", "april-2026", "April 2026", "2026-04-30", 30],
  ["classics", "may-2026", "May 2026", "2026-05-31", 25],
  ["classics", "april-2026", "April 2026", "2026-04-30", 25],
  ["breakout", "week-22-2026", "Week 22, 2026", "2026-05-31", 15],
  ["breakout", "week-21-2026", "Week 21, 2026", "2026-05-24", 15],
].map(([familyId, slug, label, date, entryCount]) => ({
  id: `ed-${familyId}-${slug}`,
  familyId: String(familyId),
  slug: String(slug),
  label: String(label),
  date: String(date),
  periodStart: String(date),
  periodEnd: String(date),
  status: "published" as const,
  ingestJobId: `job-${familyId}-${slug}`,
  publishedAt: `${date}T00:00:00Z`,
  publishedBy: "WAKILISHA Charts",
  entryCount: Number(entryCount),
  newEntries: Math.max(1, Math.floor(Number(entryCount) / 8)),
  reEntries: Math.max(0, Math.floor(Number(entryCount) / 20)),
}));

const fallbackTitles = [
  ["Midnight Dreams", "Luna Stark", "Afrobeats"],
  ["Golden Hour", "The Radiants", "Afropop"],
  ["Electric Soul", "Kai Nova", "Amapiano"],
  ["Savanna Wind", "Amara & The Echoes", "Afrobeats"],
  ["Lagos Lights", "DJ Kole", "Afrobeats"],
  ["Desert Rose", "Zara Nia", "Afrofusion"],
  ["Neon Nights", "Pulse City", "Afrobeats"],
  ["River Flow", "Kofi Soul", "Afropop"],
  ["City Drums", "The Beats Collective", "Amapiano"],
  ["Sunrise", "Eva M", "R&B"],
  ["Jungle Beat", "Tribe X", "Afrobeats"],
  ["Ocean Drive", "Sandy Vibes", "Afropop"],
  ["Fire Dance", "Blaze Crew", "Amapiano"],
  ["Ice Queen", "Crystal T", "Afrobeats"],
  ["Terra Firma", "Earth Tone", "Afrofusion"],
  ["Violet Haze", "Magenta Sky", "R&B"],
  ["Bronze Age", "Vintage Soul", "Afrobeats"],
  ["Cloud Nine", "Sky Walker", "Afropop"],
  ["Ember Glow", "Ash & Fire", "Amapiano"],
  ["Pearl", "Lumina", "Afrobeats"],
  ["Nightfall", "Dark Matter", "Afrofusion"],
  ["Solar Flare", "Sun Child", "Afrobeats"],
  ["Red Dust", "Desert Storm", "Afropop"],
  ["Blue Velvet", "Silk Route", "R&B"],
  ["Green Light", "Go Signal", "Afrobeats"],
  ["Shadow Box", "Mystery Man", "Amapiano"],
  ["Crystal Clear", "Pure Water", "Afropop"],
  ["Wild Heart", "Nature Boy", "Afrofusion"],
  ["Steel Drum", "Island Sound", "Afrobeats"],
  ["Paper Crown", "Young King", "Afrobeats"],
  ["Rain Dance", "Storm Chaser", "Afropop"],
  ["Stone Cold", "Rock Steady", "Amapiano"],
  ["Soft Landing", "Feather Weight", "R&B"],
  ["Hard Knock", "Tough Love", "Afrobeats"],
  ["Fast Lane", "Speed Demon", "Afrofusion"],
  ["Slow Burn", "Ember Ash", "Afropop"],
  ["High Tide", "Wave Rider", "Afrobeats"],
  ["Low Key", "Quiet Storm", "Amapiano"],
  ["Full Moon", "Lunar Tide", "Afrobeats"],
  ["Empty Space", "Void Walker", "Afropop"],
];

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function buildFallbackEntriesForEdition(edition: ChartEdition, editionIndex: number): ChartEditionEntry[] {
  const limit = edition.entryCount || 40;
  return Array.from({ length: limit }, (_, index) => {
    const rotated = fallbackTitles[(index + editionIndex * 3) % fallbackTitles.length];
    const [title, artist, genre] = rotated;
    const rank = index + 1;
    const previousRank = rank === 1 && editionIndex % 2 === 0 ? 2 : rank + ((editionIndex + index) % 5 === 0 ? 2 : 0);
    const movement: ChartEditionEntry["movement"] = editionIndex === 0 && index % 9 === 0 ? "new" : previousRank > rank ? "up" : previousRank < rank ? "down" : "same";
    const trackSlug = slugify(`${title}-${artist}`);

    return {
      id: `${edition.id}::${String(rank).padStart(3, "0")}::${trackSlug}`,
      editionId: edition.id,
      rank,
      previousRank: movement === "new" ? null : previousRank,
      movement,
      peakPosition: Math.max(1, Math.min(rank, previousRank)),
      weeksOnChart: 1 + ((index + editionIndex) % 24),
      trackSlug,
      trackTitle: title,
      artistSlugs: [slugify(artist)],
      artistNames: [artist],
      artworkUrl: stableImage(`${edition.id}-${trackSlug}`),
      score: Math.max(100, 1000 - index * 14 - editionIndex * 3),
      entryPayload: { fallbackEditionId: edition.id, generatedForEdition: true },
      genre,
      source: ["Spotify", "Apple Music", "YouTube", "Boomplay"][index % 4],
      isPlayable: index % 7 !== 0,
      duration: 180 + ((title.length * 7) % 120),
      movementAmount: movement === "new" ? 0 : Math.abs(previousRank - rank),
    };
  });
}

const fallbackEntries = fallbackEditions.flatMap((edition, index) => buildFallbackEntriesForEdition(edition, index));

export const MOCK_FAMILIES = registryData?.families ?? fallbackFamilies;
export const MOCK_EDITIONS = registryData?.editions ?? fallbackEditions;
export const MOCK_ENTRIES = registryData?.entries ?? fallbackEntries;

const historyEntries = MOCK_ENTRIES.filter((entry) => entry.trackSlug === "midnight-dreams").slice(0, 8);

export const MOCK_TRACK_HISTORY: TrackChartHistory = {
  trackSlug: "midnight-dreams",
  trackTitle: "Midnight Dreams",
  artistNames: ["Luna Stark"],
  appearances: historyEntries.map((entry) => {
    const edition = MOCK_EDITIONS.find((item) => item.id === entry.editionId);
    return {
      editionSlug: edition?.slug ?? entry.editionId,
      editionLabel: edition?.label ?? entry.editionId,
      rank: entry.rank,
      weeksOnChart: entry.weeksOnChart ?? 0,
      movement: entry.movement,
    };
  }),
  peakPosition: historyEntries.length ? Math.min(...historyEntries.map((entry) => entry.rank)) : 0,
  totalWeeksOnChart: historyEntries.length ? Math.max(...historyEntries.map((entry) => entry.weeksOnChart ?? 0)) : 0,
  firstAppearance: null,
  latestAppearance: null,
};

// ─── Edition helpers ─────────────────────────────────────────────────────────

export function getMockEntriesForEdition(familySlug: string, editionSlug: string): ChartEditionEntry[] {
  const family = getMockFamily(familySlug);
  if (!family) return [];

  const edition = MOCK_EDITIONS.find(
    (item) => item.familyId === family.id && (item.slug === editionSlug || item.id === editionSlug)
  );
  if (!edition) return [];

  return MOCK_ENTRIES
    .filter((entry) => entry.editionId === edition.id)
    .slice()
    .sort((a, b) => a.rank - b.rank);
}

export function getMockEditionsForFamily(familySlug: string): ChartEdition[] {
  const family = getMockFamily(familySlug);
  if (!family) return [];

  return MOCK_EDITIONS
    .filter((edition) => edition.familyId === family.id)
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.label.localeCompare(a.label));
}

export function getMockLatestEdition(familySlug: string): ChartEdition | null {
  const editions = getMockEditionsForFamily(familySlug);
  return editions[0] ?? null;
}

export function getMockEdition(familySlug: string, editionSlug: string): ChartEdition | null {
  const family = getMockFamily(familySlug);
  if (!family) return null;
  return MOCK_EDITIONS.find((edition) => edition.familyId === family.id && (edition.slug === editionSlug || edition.id === editionSlug)) ?? null;
}

export function getMockFamily(familySlug: string): ChartFamily | null {
  const resolved = resolveSourceFamilySlug(familySlug);
  return MOCK_FAMILIES.find((family) =>
    family.publicSlug === familySlug ||
    family.slug === familySlug ||
    family.familyKey === familySlug ||
    family.id === familySlug ||
    family.sourceFamilySlug === familySlug ||
    family.legacySlugs?.includes(familySlug) ||
    family.publicSlug === resolved ||
    family.slug === resolved ||
    family.id === resolved ||
    family.sourceFamilySlug === resolved ||
    family.legacySlugs?.includes(resolved)
  ) ?? null;
}

export function computeEditionMeta(entries: ChartEditionEntry[]) {
  const totalEntries = entries.length;
  const artists = new Set(entries.flatMap((entry) => entry.artistNames));
  const newEntries = entries.filter((entry) => entry.movement === "new").length;
  const reEntries = entries.filter((entry) => entry.movement === "re_entry").length;

  const longest = entries.reduce(
    (current, entry) => {
      const weeks = entry.weeksOnChart ?? 0;
      return weeks > (current?.weeks ?? 0)
        ? { title: entry.trackTitle, artist: entry.artistNames.join(", "), weeks }
        : current;
    },
    null as { title: string; artist: string; weeks: number } | null
  );

  const biggestMover = entries
    .filter((entry) => entry.movement === "up")
    .reduce(
      (current, entry) => {
        const amount = entry.movementAmount ?? 0;
        return amount > (current?.amount ?? 0)
          ? { title: entry.trackTitle, artist: entry.artistNames.join(", "), amount }
          : current;
      },
      null as { title: string; artist: string; amount: number } | null
    );

  const genreCounts = entries.reduce<Record<string, number>>((acc, entry) => {
    const genre = entry.genre ?? "Unknown";
    acc[genre] = (acc[genre] ?? 0) + 1;
    return acc;
  }, {});
  const topGenreEntry = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0];

  return {
    totalEntries,
    totalArtists: artists.size,
    newEntries,
    reEntries,
    longestRunning: longest,
    biggestMover,
    topGenre: topGenreEntry?.[0] ?? "Unknown",
    topGenreCount: topGenreEntry?.[1] ?? 0,
  };
}