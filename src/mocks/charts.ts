import { getChartSeries, getLatestChartEdition, getLatestChartRows, hasImportedRegistryData } from '@/data/registry/registry';

const FALLBACK_CHART_DATA = [
  { rank: 1, title: 'Alone', slug: 'alone-oxlade', artist: 'Oxlade', movement: 'up' as const, movementAmount: 2, weeksOnChart: 8, peakPosition: 1, isPlayable: true, source: 'Spotify', artworkUrl: 'https://picsum.photos/seed/wk-chart-alone/600/600', genre: 'Afropop', label: 'Epic Records', previousWeek: 3 },
  { rank: 2, title: 'Monalisa', slug: 'monalisa-lojay-sarz', artist: 'Lojay ft. Sarz', movement: 'same' as const, weeksOnChart: 12, peakPosition: 1, isPlayable: true, source: 'Spotify', artworkUrl: 'https://picsum.photos/seed/wk-chart-monalisa/600/600', genre: 'Afrobeats', label: 'Warner Music', previousWeek: 2 },
  { rank: 3, title: 'Essence', slug: 'essence-wizkid-tems', artist: 'Wizkid ft. Tems', movement: 'down' as const, movementAmount: 1, weeksOnChart: 24, peakPosition: 1, isPlayable: true, source: 'YouTube', artworkUrl: 'https://picsum.photos/seed/wk-chart-essence/600/600', genre: 'Afrobeats', label: 'RCA Records', previousWeek: 1 },
  { rank: 4, title: 'Running', slug: 'running-burna-boy', artist: 'Burna Boy', movement: 'up' as const, movementAmount: 3, weeksOnChart: 5, peakPosition: 4, isPlayable: true, source: 'Spotify', artworkUrl: 'https://picsum.photos/seed/wk-chart-running/600/600', genre: 'Afrofusion', label: 'Atlantic Records', previousWeek: 7 },
  { rank: 5, title: 'Last Last', slug: 'last-last-burna-boy', artist: 'Burna Boy', movement: 'same' as const, weeksOnChart: 18, peakPosition: 2, isPlayable: true, source: 'YouTube', artworkUrl: 'https://picsum.photos/seed/wk-chart-last-last/600/600', genre: 'Afrofusion', label: 'Atlantic Records', previousWeek: 5 },
  { rank: 6, title: 'Peru', slug: 'peru-fireboy-ed', artist: 'Fireboy DML ft. Ed Sheeran', movement: 'down' as const, movementAmount: 2, weeksOnChart: 22, peakPosition: 2, isPlayable: true, source: 'Spotify', artworkUrl: 'https://picsum.photos/seed/wk-chart-peru/600/600', genre: 'Afropop', label: 'YBNL Nation', previousWeek: 4 },
  { rank: 7, title: 'Buga', slug: 'buga-kizz-tekno', artist: 'Kizz Daniel ft. Tekno', movement: 'up' as const, movementAmount: 1, weeksOnChart: 6, peakPosition: 6, isPlayable: true, source: 'YouTube', artworkUrl: 'https://picsum.photos/seed/wk-chart-buga/600/600', genre: 'Afropop', label: 'Flyboy Inc', previousWeek: 8 },
  { rank: 8, title: 'Calm Down', slug: 'calm-down-rema-selena', artist: 'Rema ft. Selena Gomez', movement: 'same' as const, weeksOnChart: 31, peakPosition: 3, isPlayable: true, source: 'Spotify', artworkUrl: 'https://picsum.photos/seed/wk-chart-calm-down/600/600', genre: 'Afrobeats', label: 'Mavin Records', previousWeek: 8 },
  { rank: 9, title: 'Sungba', slug: 'sungba-asake-burna', artist: 'Asake ft. Burna Boy', movement: 'new' as const, weeksOnChart: 1, peakPosition: 9, isPlayable: false, artworkUrl: 'https://picsum.photos/seed/wk-chart-sungba/600/600', genre: 'Amapiano', label: 'YBNL Nation', previousWeek: 0 },
  { rank: 10, title: 'Terminator', slug: 'terminator-asake', artist: 'Asake', movement: 'down' as const, movementAmount: 4, weeksOnChart: 14, peakPosition: 5, isPlayable: true, source: 'Spotify', artworkUrl: 'https://picsum.photos/seed/wk-chart-terminator/600/600', genre: 'Street Afrobeats', label: 'YBNL Nation', previousWeek: 6 },
];

const registryRows = hasImportedRegistryData() ? getLatestChartRows() : [];
export const CHART_DATA = registryRows.length ? registryRows : FALLBACK_CHART_DATA;

const registrySeries = hasImportedRegistryData() ? getChartSeries() : [];
export const CHART_SERIES = registrySeries.length
  ? registrySeries.map((series) => ({ id: series.slug, label: series.label, description: series.description ?? 'Imported WAKILISHA chart series', count: CHART_DATA.length }))
  : [
      { id: 'weekly-top-40', label: 'Weekly Top 40', description: 'The definitive ranking of African music right now', count: CHART_DATA.length },
      { id: 'rising-voices', label: 'Rising Voices', description: 'New and emerging artists gaining momentum', count: 20 },
      { id: 'genre-pulse', label: 'Genre Pulse', description: 'Genre-specific cultural movement charts', count: 25 },
    ];

const latestEdition = getLatestChartEdition();
const uniqueArtists = new Set(CHART_DATA.map((entry) => entry.artist));
const newEntries = CHART_DATA.filter((entry) => entry.movement === 'new');
const longestRunning = CHART_DATA.slice().sort((a, b) => b.weeksOnChart - a.weeksOnChart)[0] ?? CHART_DATA[0];
const biggestMover = CHART_DATA.filter((entry) => entry.movement === 'up').sort((a, b) => (b.movementAmount ?? 0) - (a.movementAmount ?? 0))[0] ?? CHART_DATA[0];
const genreCounts = CHART_DATA.reduce<Record<string, number>>((acc, entry) => {
  const genre = entry.genre ?? 'Unknown';
  acc[genre] = (acc[genre] ?? 0) + 1;
  return acc;
}, {});
const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0] ?? ['Unknown', 0];

export const CHART_EDITION = {
  date: latestEdition?.date ?? new Date().toISOString().slice(0, 10),
  weekNumber: Number(latestEdition?.label?.match(/\d+/)?.[0] ?? 1),
  methodology: latestEdition?.methodology ?? 'Compiled from the imported WAKILISHA registry and chart entry data.',
  totalEntries: CHART_DATA.length,
  totalArtists: uniqueArtists.size,
  newEntries: newEntries.length,
  topGenre: topGenre[0],
  topGenreCount: topGenre[1],
  longestRunning,
  biggestMover: { ...biggestMover, amount: biggestMover.movementAmount ?? 0 },
};

export const NEW_ENTRIES = newEntries.slice(0, 6);
export const BIGGEST_MOVERS = CHART_DATA.filter((entry) => entry.movement === 'up').sort((a, b) => (b.movementAmount ?? 0) - (a.movementAmount ?? 0)).slice(0, 6);
