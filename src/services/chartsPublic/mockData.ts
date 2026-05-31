import type { ChartFamily, ChartEdition, ChartEditionEntry, TrackChartHistory } from "./types";
import {
  hasImportedChartData,
  getLatestChartRows,
  getChartSeriesSummaries,
  getLatestChartEdition,
} from "@/data/registry/registry";

// ─── Try to use generated registry data if available ───
let registryData: {
  entries: ChartEditionEntry[];
  families: ChartFamily[];
  editions: ChartEdition[];
} | null = null;

try {
  if (hasImportedChartData()) {
    const rows = getLatestChartRows();
    const seriesSummaries = getChartSeriesSummaries();
    const latestEdition = getLatestChartEdition();

    if (rows.length > 0 && seriesSummaries.length > 0) {
      const entries: ChartEditionEntry[] = rows.map((row, idx) => ({
        id: `entry-${String(idx + 1).padStart(3, "0")}`,
        editionId: latestEdition?.id ?? "ed-registry",
        rank: row.rank ?? idx + 1,
        previousRank: row.previousRank ?? null,
        movement: (row.movement as ChartEditionEntry["movement"]) ?? "same",
        peakPosition: row.peakPosition ?? row.rank ?? idx + 1,
        weeksOnChart: row.weeksOnChart ?? 1,
        trackSlug: row.slug ?? `track-${idx + 1}`,
        trackTitle: row.title,
        artistSlugs: [],
        artistNames: [row.artist],
        artworkUrl: row.artworkUrl ?? null,
        score: Math.max(100, 1000 - idx * 18),
        entryPayload: {},
        genre: (row as unknown as Record<string, string>).genre ?? "Afrobeats",
        source: (row as unknown as Record<string, string>).source ?? "Spotify",
        isPlayable: (row as unknown as Record<string, boolean>).isPlayable ?? true,
        duration: (row as unknown as Record<string, number>).duration,
        movementAmount: row.previousRank
          ? Math.abs(row.previousRank - (row.rank ?? idx + 1))
          : 0,
      }));

      const families: ChartFamily[] = seriesSummaries.map((s) => ({
        id: s.id,
        familyKey: s.id,
        label: s.label,
        description: s.description ?? "Chart series",
        defaultChartSize: s.entryCount ?? 40,
        defaultRegion: "global",
        editionFrequency: "weekly",
        defaultRuleset: "default",
        defaultScoringModel: "weighted_streaming",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-06-01T00:00:00Z",
        slug: s.id,
      }));

      const editions: ChartEdition[] = seriesSummaries
        .filter((s) => s.latestEdition)
        .map((s) => ({
          id: `ed-${s.id}-${s.latestEdition!.slug}`,
          familyId: s.id,
          slug: s.latestEdition!.slug,
          label: s.latestEdition!.label,
          date: s.latestEdition!.date ?? "2026-05-31",
          periodStart: "2026-05-24",
          periodEnd: "2026-05-30",
          status: "published",
          ingestJobId: null,
          publishedAt: "2026-05-31T00:00:00Z",
          publishedBy: "WAKILISHA Charts",
          entryCount: s.count,
          newEntries: entries.filter((e) => e.movement === "new").length,
          reEntries: entries.filter((e) => e.movement === "re_entry").length,
        }));

      registryData = { entries, families, editions };
    }
  }
} catch {
  registryData = null;
}

// ─── Image helpers ───
const img = (seq: number, prompt: string) =>
  `https://readdy.ai/api/search-image?query=$%7BencodeURIComponent%28prompt%29%7D&width=300&height=300&seq=chart-entry-${seq}&orientation=squarish`;

const prompts = [
  "abstract album cover artwork with deep midnight blue and silver starlight tones, dreamy atmospheric minimal design on a dark background, no text, cinematic lighting, premium editorial photography quality",
  "abstract album cover artwork with warm golden sunset tones and amber gradients, soft atmospheric minimal design on a dark background, no text, cinematic lighting, premium editorial photography quality",
  "abstract album cover artwork with electric purple and neon pink tones, energetic vibrant minimal design on a dark background, no text, cinematic lighting, premium editorial photography quality",
  "abstract album cover artwork with savanna green and earth tones, natural organic minimal design on a dark background, no text, cinematic lighting, premium editorial photography quality",
  "abstract album cover artwork with deep ocean blue and teal tones, flowing water minimal design on a dark background, no text, cinematic lighting, premium editorial photography quality",
  "abstract album cover artwork with desert rose and coral tones, warm floral minimal design on a dark background, no text, cinematic lighting, premium editorial photography quality",
  "abstract album cover artwork with neon green and black cyber tones, futuristic minimal design on a dark background, no text, cinematic lighting, premium editorial photography quality",
  "abstract album cover artwork with river blue and misty white tones, serene flowing minimal design on a dark background, no text, cinematic lighting, premium editorial photography quality",
  "abstract album cover artwork with deep crimson and gold tones, bold dramatic minimal design on a dark background, no text, cinematic lighting, premium editorial photography quality",
  "abstract album cover artwork with sunrise orange and soft yellow tones, hopeful bright minimal design on a dark background, no text, cinematic lighting, premium editorial photography quality",
  "abstract album cover artwork with deep forest green and moss tones, earthy organic minimal design on a dark background, no text, cinematic lighting, premium editorial photography quality",
  "abstract album cover artwork with twilight purple and indigo tones, mysterious evening minimal design on a dark background, no text, cinematic lighting, premium editorial photography quality",
  "abstract album cover artwork with fire red and orange ember tones, intense passionate minimal design on a dark background, no text, cinematic lighting, premium editorial photography quality",
  "abstract album cover artwork with ice blue and silver frost tones, cool crystalline minimal design on a dark background, no text, cinematic lighting, premium editorial photography quality",
  "abstract album cover artwork with warm sand and terracotta tones, earthy mediterranean minimal design on a dark background, no text, cinematic lighting, premium editorial photography quality",
  "abstract album cover artwork with deep magenta and violet tones, rich luxurious minimal design on a dark background, no text, cinematic lighting, premium editorial photography quality",
  "abstract album cover artwork with olive green and bronze tones, vintage sophisticated minimal design on a dark background, no text, cinematic lighting, premium editorial photography quality",
  "abstract album cover artwork with sky blue and cloud white tones, airy light minimal design on a dark background, no text, cinematic lighting, premium editorial photography quality",
  "abstract album cover artwork with burnt orange and charcoal tones, smoky dramatic minimal design on a dark background, no text, cinematic lighting, premium editorial photography quality",
  "abstract album cover artwork with pearl white and soft rose tones, elegant delicate minimal design on a dark background, no text, cinematic lighting, premium editorial photography quality",
];

const entryData = [
  { title: "Midnight Dreams", artist: "Luna Stark", movement: "up" as const, prev: 2, peak: 1, weeks: 8, genre: "Afrobeats", score: 985.4, source: "Spotify", playable: true },
  { title: "Golden Hour", artist: "The Radiants", movement: "down" as const, prev: 1, peak: 1, weeks: 12, genre: "Afropop", score: 972.1, source: "Apple Music", playable: true },
  { title: "Electric Soul", artist: "Kai Nova", movement: "up" as const, prev: 5, peak: 3, weeks: 4, genre: "Amapiano", score: 954.7, source: "Spotify", playable: true },
  { title: "Savanna Wind", artist: "Amara & The Echoes", movement: "same" as const, prev: 4, peak: 2, weeks: 15, genre: "Afrobeats", score: 948.2, source: "YouTube", playable: true },
  { title: "Lagos Lights", artist: "DJ Kole", movement: "up" as const, prev: 8, peak: 3, weeks: 6, genre: "Afrobeats", score: 932.8, source: "Spotify", playable: true },
  { title: "Desert Rose", artist: "Zara Nia", movement: "down" as const, prev: 3, peak: 1, weeks: 20, genre: "Afrofusion", score: 921.5, source: "Apple Music", playable: true },
  { title: "Neon Nights", artist: "Pulse City", movement: "new" as const, prev: null, peak: 7, weeks: 1, genre: "Afrobeats", score: 915.3, source: "Spotify", playable: true },
  { title: "River Flow", artist: "Kofi Soul", movement: "up" as const, prev: 11, peak: 5, weeks: 9, genre: "Afropop", score: 908.7, source: "Boomplay", playable: true },
  { title: "City Drums", artist: "The Beats Collective", movement: "down" as const, prev: 6, peak: 4, weeks: 7, genre: "Amapiano", score: 901.2, source: "Spotify", playable: true },
  { title: "Sunrise", artist: "Eva M", movement: "up" as const, prev: 14, peak: 10, weeks: 3, genre: "R&B", score: 894.6, source: "Apple Music", playable: true },
  { title: "Jungle Beat", artist: "Tribe X", movement: "same" as const, prev: 11, peak: 8, weeks: 11, genre: "Afrobeats", score: 887.3, source: "Spotify", playable: true },
  { title: "Ocean Drive", artist: "Sandy Vibes", movement: "down" as const, prev: 9, peak: 5, weeks: 18, genre: "Afropop", score: 880.1, source: "YouTube", playable: false },
  { title: "Fire Dance", artist: "Blaze Crew", movement: "up" as const, prev: 17, peak: 11, weeks: 2, genre: "Amapiano", score: 873.5, source: "Spotify", playable: true },
  { title: "Ice Queen", artist: "Crystal T", movement: "new" as const, prev: null, peak: 14, weeks: 1, genre: "Afrobeats", score: 868.9, source: "Apple Music", playable: true },
  { title: "Terra Firma", artist: "Earth Tone", movement: "same" as const, prev: 15, peak: 12, weeks: 5, genre: "Afrofusion", score: 862.4, source: "Boomplay", playable: true },
  { title: "Violet Haze", artist: "Magenta Sky", movement: "down" as const, prev: 10, peak: 6, weeks: 14, genre: "R&B", score: 856.7, source: "Spotify", playable: true },
  { title: "Bronze Age", artist: "Vintage Soul", movement: "up" as const, prev: 21, peak: 15, weeks: 4, genre: "Afrobeats", score: 849.2, source: "YouTube", playable: true },
  { title: "Cloud Nine", artist: "Sky Walker", movement: "same" as const, prev: 18, peak: 16, weeks: 8, genre: "Afropop", score: 843.1, source: "Spotify", playable: true },
  { title: "Ember Glow", artist: "Ash & Fire", movement: "down" as const, prev: 13, peak: 9, weeks: 22, genre: "Amapiano", score: 838.5, source: "Apple Music", playable: true },
  { title: "Pearl", artist: "Lumina", movement: "new" as const, prev: null, peak: 20, weeks: 1, genre: "Afrobeats", score: 831.6, source: "Spotify", playable: true },
  { title: "Nightfall", artist: "Dark Matter", movement: "up" as const, prev: 25, peak: 18, weeks: 3, genre: "Afrofusion", score: 825.3, source: "Boomplay", playable: false },
  { title: "Solar Flare", artist: "Sun Child", movement: "same" as const, prev: 22, peak: 19, weeks: 6, genre: "Afrobeats", score: 819.8, source: "Spotify", playable: true },
  { title: "Red Dust", artist: "Desert Storm", movement: "down" as const, prev: 19, peak: 14, weeks: 10, genre: "Afropop", score: 813.4, source: "YouTube", playable: true },
  { title: "Blue Velvet", artist: "Silk Route", movement: "up" as const, prev: 28, peak: 22, weeks: 2, genre: "R&B", score: 807.2, source: "Apple Music", playable: true },
  { title: "Green Light", artist: "Go Signal", movement: "same" as const, prev: 24, peak: 23, weeks: 7, genre: "Afrobeats", score: 801.5, source: "Spotify", playable: true },
  { title: "Shadow Box", artist: "Mystery Man", movement: "new" as const, prev: null, peak: 26, weeks: 1, genre: "Amapiano", score: 795.8, source: "Boomplay", playable: true },
  { title: "Crystal Clear", artist: "Pure Water", movement: "down" as const, prev: 23, peak: 17, weeks: 13, genre: "Afropop", score: 789.3, source: "Spotify", playable: true },
  { title: "Wild Heart", artist: "Nature Boy", movement: "up" as const, prev: 31, peak: 27, weeks: 4, genre: "Afrofusion", score: 783.6, source: "YouTube", playable: true },
  { title: "Steel Drum", artist: "Island Sound", movement: "same" as const, prev: 29, peak: 28, weeks: 9, genre: "Afrobeats", score: 777.1, source: "Apple Music", playable: true },
  { title: "Paper Crown", artist: "Young King", movement: "down" as const, prev: 26, peak: 20, weeks: 16, genre: "Afrobeats", score: 771.4, source: "Spotify", playable: true },
  { title: "Rain Dance", artist: "Storm Chaser", movement: "new" as const, prev: null, peak: 31, weeks: 1, genre: "Afropop", score: 765.9, source: "Boomplay", playable: false },
  { title: "Stone Cold", artist: "Rock Steady", movement: "up" as const, prev: 35, peak: 30, weeks: 3, genre: "Amapiano", score: 759.2, source: "YouTube", playable: true },
  { title: "Soft Landing", artist: "Feather Weight", movement: "same" as const, prev: 33, peak: 32, weeks: 5, genre: "R&B", score: 753.7, source: "Spotify", playable: true },
  { title: "Hard Knock", artist: "Tough Love", movement: "down" as const, prev: 30, peak: 25, weeks: 11, genre: "Afrobeats", score: 747.8, source: "Apple Music", playable: true },
  { title: "Fast Lane", artist: "Speed Demon", movement: "up" as const, prev: 38, peak: 34, weeks: 2, genre: "Afrofusion", score: 741.5, source: "Spotify", playable: true },
  { title: "Slow Burn", artist: "Ember Ash", movement: "same" as const, prev: 36, peak: 35, weeks: 6, genre: "Afropop", score: 735.2, source: "Boomplay", playable: true },
  { title: "High Tide", artist: "Wave Rider", movement: "new" as const, prev: null, peak: 37, weeks: 1, genre: "Afrobeats", score: 729.6, source: "YouTube", playable: true },
  { title: "Low Key", artist: "Quiet Storm", movement: "down" as const, prev: 34, peak: 29, weeks: 19, genre: "Amapiano", score: 723.1, source: "Spotify", playable: true },
  { title: "Full Moon", artist: "Lunar Tide", movement: "up" as const, prev: 40, peak: 39, weeks: 2, genre: "Afrobeats", score: 717.8, source: "Apple Music", playable: true },
  { title: "Empty Space", artist: "Void Walker", movement: "same" as const, prev: 39, peak: 38, weeks: 8, genre: "Afropop", score: 712.3, source: "Spotify", playable: true },
];

function buildHardcodedEntries(): ChartEditionEntry[] {
  return entryData.map((d, idx) => {
    const rank = idx + 1;
    const movementAmount = d.prev !== null ? Math.abs(d.prev - rank) : 0;
    const slug = d.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return {
      id: `entry-${String(rank).padStart(3, "0")}`,
      editionId: "ed-2026-w22",
      rank,
      previousRank: d.prev,
      movement: d.movement,
      peakPosition: d.peak,
      weeksOnChart: d.weeks,
      trackSlug: slug,
      trackTitle: d.title,
      artistSlugs: [slug],
      artistNames: [d.artist],
      artworkUrl: img(rank, prompts[idx % prompts.length]),
      score: d.score,
      entryPayload: {},
      genre: d.genre,
      source: d.source,
      isPlayable: d.playable,
      duration: 180 + ((d.title.length * 7) % 120),
      movementAmount,
    };
  });
}

const HARDCODED_FAMILIES: ChartFamily[] = [
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
    updatedAt: "2024-06-01T00:00:00Z",
    slug: "weekly-top-40",
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
    updatedAt: "2024-06-01T00:00:00Z",
    slug: "rising-voices",
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
    updatedAt: "2024-06-01T00:00:00Z",
    slug: "genre-pulse",
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
    updatedAt: "2024-06-01T00:00:00Z",
    slug: "classics",
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
    updatedAt: "2024-06-01T00:00:00Z",
    slug: "breakout",
  },
];

const HARDCODED_EDITIONS: ChartEdition[] = [
  {
    id: "ed-2026-w22",
    familyId: "weekly-top-40",
    slug: "week-22-2026",
    label: "Week 22, 2026",
    date: "2026-05-31",
    periodStart: "2026-05-24",
    periodEnd: "2026-05-30",
    status: "published",
    ingestJobId: "job-2026-w22",
    publishedAt: "2026-05-31T00:00:00Z",
    publishedBy: "WAKILISHA Charts",
    entryCount: 40,
    newEntries: 5,
    reEntries: 1,
  },
  {
    id: "ed-2026-w21",
    familyId: "weekly-top-40",
    slug: "week-21-2026",
    label: "Week 21, 2026",
    date: "2026-05-24",
    periodStart: "2026-05-17",
    periodEnd: "2026-05-23",
    status: "published",
    ingestJobId: "job-2026-w21",
    publishedAt: "2026-05-24T00:00:00Z",
    publishedBy: "WAKILISHA Charts",
    entryCount: 40,
    newEntries: 4,
    reEntries: 2,
  },
  {
    id: "ed-2026-w20",
    familyId: "weekly-top-40",
    slug: "week-20-2026",
    label: "Week 20, 2026",
    date: "2026-05-17",
    periodStart: "2026-05-10",
    periodEnd: "2026-05-16",
    status: "published",
    ingestJobId: "job-2026-w20",
    publishedAt: "2026-05-17T00:00:00Z",
    publishedBy: "WAKILISHA Charts",
    entryCount: 40,
    newEntries: 6,
    reEntries: 0,
  },
  {
    id: "ed-2026-w19",
    familyId: "weekly-top-40",
    slug: "week-19-2026",
    label: "Week 19, 2026",
    date: "2026-05-10",
    periodStart: "2026-05-03",
    periodEnd: "2026-05-09",
    status: "published",
    ingestJobId: "job-2026-w19",
    publishedAt: "2026-05-10T00:00:00Z",
    publishedBy: "WAKILISHA Charts",
    entryCount: 40,
    newEntries: 3,
    reEntries: 1,
  },
  {
    id: "ed-2026-w22-rising",
    familyId: "rising-voices",
    slug: "week-22-2026",
    label: "Week 22, 2026",
    date: "2026-05-31",
    periodStart: "2026-05-24",
    periodEnd: "2026-05-30",
    status: "published",
    ingestJobId: "job-2026-w22-rising",
    publishedAt: "2026-05-31T00:00:00Z",
    publishedBy: "WAKILISHA Charts",
    entryCount: 20,
    newEntries: 8,
    reEntries: 0,
  },
  {
    id: "ed-2026-w21-rising",
    familyId: "rising-voices",
    slug: "week-21-2026",
    label: "Week 21, 2026",
    date: "2026-05-24",
    periodStart: "2026-05-17",
    periodEnd: "2026-05-23",
    status: "published",
    ingestJobId: "job-2026-w21-rising",
    publishedAt: "2026-05-24T00:00:00Z",
    publishedBy: "WAKILISHA Charts",
    entryCount: 20,
    newEntries: 7,
    reEntries: 1,
  },
  {
    id: "ed-2026-m05-genre",
    familyId: "genre-pulse",
    slug: "may-2026",
    label: "May 2026",
    date: "2026-05-31",
    periodStart: "2026-05-01",
    periodEnd: "2026-05-31",
    status: "published",
    ingestJobId: "job-2026-m05-genre",
    publishedAt: "2026-05-31T00:00:00Z",
    publishedBy: "WAKILISHA Charts",
    entryCount: 30,
    newEntries: 4,
    reEntries: 2,
  },
  {
    id: "ed-2026-m04-genre",
    familyId: "genre-pulse",
    slug: "april-2026",
    label: "April 2026",
    date: "2026-04-30",
    periodStart: "2026-04-01",
    periodEnd: "2026-04-30",
    status: "published",
    ingestJobId: "job-2026-m04-genre",
    publishedAt: "2026-04-30T00:00:00Z",
    publishedBy: "WAKILISHA Charts",
    entryCount: 30,
    newEntries: 5,
    reEntries: 1,
  },
  {
    id: "ed-2026-m05-classics",
    familyId: "classics",
    slug: "may-2026",
    label: "May 2026",
    date: "2026-05-31",
    periodStart: "2026-05-01",
    periodEnd: "2026-05-31",
    status: "published",
    ingestJobId: "job-2026-m05-classics",
    publishedAt: "2026-05-31T00:00:00Z",
    publishedBy: "WAKILISHA Charts",
    entryCount: 25,
    newEntries: 0,
    reEntries: 1,
  },
  {
    id: "ed-2026-m04-classics",
    familyId: "classics",
    slug: "april-2026",
    label: "April 2026",
    date: "2026-04-30",
    periodStart: "2026-04-01",
    periodEnd: "2026-04-30",
    status: "published",
    ingestJobId: "job-2026-m04-classics",
    publishedAt: "2026-04-30T00:00:00Z",
    publishedBy: "WAKILISHA Charts",
    entryCount: 25,
    newEntries: 0,
    reEntries: 2,
  },
  {
    id: "ed-2026-w22-breakout",
    familyId: "breakout",
    slug: "week-22-2026",
    label: "Week 22, 2026",
    date: "2026-05-31",
    periodStart: "2026-05-24",
    periodEnd: "2026-05-30",
    status: "published",
    ingestJobId: "job-2026-w22-breakout",
    publishedAt: "2026-05-31T00:00:00Z",
    publishedBy: "WAKILISHA Charts",
    entryCount: 15,
    newEntries: 6,
    reEntries: 0,
  },
  {
    id: "ed-2026-w21-breakout",
    familyId: "breakout",
    slug: "week-21-2026",
    label: "Week 21, 2026",
    date: "2026-05-24",
    periodStart: "2026-05-17",
    periodEnd: "2026-05-23",
    status: "published",
    ingestJobId: "job-2026-w21-breakout",
    publishedAt: "2026-05-24T00:00:00Z",
    publishedBy: "WAKILISHA Charts",
    entryCount: 15,
    newEntries: 5,
    reEntries: 1,
  },
];

const HARDCODED_ENTRIES = buildHardcodedEntries();

export const MOCK_TRACK_HISTORY: TrackChartHistory = {
  trackSlug: "midnight-dreams",
  trackTitle: "Midnight Dreams",
  artistNames: ["Luna Stark"],
  appearances: [
    { editionSlug: "week-22-2026", editionLabel: "Week 22, 2026", rank: 1, weeksOnChart: 8, movement: "up" as const },
    { editionSlug: "week-21-2026", editionLabel: "Week 21, 2026", rank: 2, weeksOnChart: 7, movement: "same" as const },
    { editionSlug: "week-20-2026", editionLabel: "Week 20, 2026", rank: 3, weeksOnChart: 6, movement: "up" as const },
  ],
  peakPosition: 1,
  totalWeeksOnChart: 8,
  firstAppearance: "2026-04-05",
  latestAppearance: "2026-05-31",
};
export const MOCK_FAMILIES = registryData?.families ?? HARDCODED_FAMILIES;
export const MOCK_EDITIONS = registryData?.editions ?? HARDCODED_EDITIONS;
export const MOCK_ENTRIES = registryData?.entries ?? HARDCODED_ENTRIES;

// ─── Edition helpers ───

export function getMockEntriesForEdition(
  familySlug: string,
  editionSlug: string
): ChartEditionEntry[] {
  const edition = MOCK_EDITIONS.find(
    (e) => e.familyId === familySlug && e.slug === editionSlug
  );
  if (!edition) return [];
  return MOCK_ENTRIES.map((e) => ({ ...e, editionId: edition.id }));
}

export function getMockEditionsForFamily(familySlug: string): ChartEdition[] {
  return MOCK_EDITIONS
    .filter((e) => e.familyId === familySlug)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getMockLatestEdition(familySlug: string): ChartEdition | null {
  const editions = getMockEditionsForFamily(familySlug);
  return editions[0] ?? null;
}

export function getMockEdition(familySlug: string, editionSlug: string): ChartEdition | null {
  return (
    MOCK_EDITIONS.find((e) => e.familyId === familySlug && e.slug === editionSlug) ?? null
  );
}

export function getMockFamily(familySlug: string): ChartFamily | null {
  return (
    MOCK_FAMILIES.find((f) => f.slug === familySlug || f.familyKey === familySlug) ?? null
  );
}

// Edition metadata for view model
export function computeEditionMeta(entries: ChartEditionEntry[]) {
  const totalEntries = entries.length;
  const artists = new Set(entries.flatMap((e) => e.artistNames));
  const newEntries = entries.filter((e) => e.movement === "new").length;
  const reEntries = entries.filter((e) => e.movement === "re_entry").length;

  const longest = entries.reduce(
    (longest, e) => {
      const w = e.weeksOnChart ?? 0;
      return w > (longest?.weeks ?? 0) ? { title: e.trackTitle, artist: e.artistNames.join(", "), weeks: w } : longest;
    },
    null as { title: string; artist: string; weeks: number } | null
  );

  const biggestMover = entries
    .filter((e) => e.movement === "up")
    .reduce(
      (biggest, e) => {
        const amt = e.movementAmount ?? 0;
        return amt > (biggest?.amount ?? 0) ? { title: e.trackTitle, artist: e.artistNames.join(", "), amount: amt } : biggest;
      },
      null as { title: string; artist: string; amount: number } | null
    );

  const genreCounts: Record<string, number> = {};
  entries.forEach((e) => {
    const g = (e as ChartEditionEntry & { genre?: string }).genre ?? "Unknown";
    genreCounts[g] = (genreCounts[g] || 0) + 1;
  });
  const topGenreEntry = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0];

  return {
    totalEntries,
    totalArtists: artists.size,
    newEntries,
    reEntries,
    longestRunning: longest,
    biggestMover,
    topGenre: topGenreEntry?.[0] ?? "Afrobeats",
    topGenreCount: topGenreEntry?.[1] ?? 0,
  };
}