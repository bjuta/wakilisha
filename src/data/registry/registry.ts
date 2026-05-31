import { importedRegistry } from './generated';
import type { ImportedArtist, ImportedChartEntry, ImportedGenre, ImportedLabel, ImportedTrack } from './types';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const by = <T extends { id: string; slug?: string }>(items: T[], key: 'id' | 'slug') =>
  new Map(items.filter((item) => item[key]).map((item) => [String(item[key]), item]));

const artistsById = by(importedRegistry.artists, 'id');
const artistsBySlug = by(importedRegistry.artists, 'slug');
const tracksById = by(importedRegistry.tracks, 'id');
const tracksBySlug = by(importedRegistry.tracks, 'slug');
const labelsById = by(importedRegistry.labels, 'id');
const labelsBySlug = by(importedRegistry.labels, 'slug');
const releasesBySlug = by(importedRegistry.releases, 'slug');
const genresBySlug = by(importedRegistry.genres, 'slug');

const chartEntriesByEdition = importedRegistry.chartEntries.reduce((acc, entry) => {
  const list = acc.get(entry.editionId) ?? [];
  list.push(entry);
  acc.set(entry.editionId, list);
  return acc;
}, new Map<string, ImportedChartEntry[]>());

const chartEditionsBySeries = importedRegistry.chartEditions.reduce((acc, edition) => {
  const list = acc.get(edition.seriesId) ?? [];
  list.push(edition);
  acc.set(edition.seriesId, list);
  return acc;
}, new Map<string, typeof importedRegistry.chartEditions>());

const titleCase = (value: string) => value.replace(/\b\w/g, (char) => char.toUpperCase());
const fallbackImage = (seed: string) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/600/600`;

function extractEntryCount(label: string, explicit?: number | null): number {
  if (explicit != null && explicit > 0) return explicit;
  const match = label.match(/\b(10|20|25|30|40|50|60|100)\b/);
  return match ? Number(match[1]) : 40;
}

const dateScore = (value: string | null | undefined) => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function sortEditions<T extends { date: string | null; label: string }>(editions: T[]) {
  return editions.slice().sort((a, b) => dateScore(b.date) - dateScore(a.date) || b.label.localeCompare(a.label));
}

const fallbackChartSeries = importedRegistry.chartEntries.length
  ? [{ id: 'imported-chart', slug: 'imported-chart', label: 'Imported WAKILISHA Chart', description: 'Imported chart entries from the WAKILISHA registry', status: 'active', entryCount: null }]
  : [];

const fallbackChartEditions = importedRegistry.chartEntries.length
  ? [{ id: importedRegistry.chartEntries[0].editionId || 'imported-edition', slug: importedRegistry.chartEntries[0].editionId || 'imported-edition', seriesId: importedRegistry.chartEntries[0].seriesId || 'imported-chart', label: 'Imported Edition', date: null, period: null, methodology: 'Compiled from imported WAKILISHA chart entries.' }]
  : [];

const effectiveChartSeries = importedRegistry.chartSeries.length ? importedRegistry.chartSeries : fallbackChartSeries;
const effectiveChartEditions = importedRegistry.chartEditions.length ? importedRegistry.chartEditions : fallbackChartEditions;

export function hasImportedRegistryData() {
  return importedRegistry.artists.length + importedRegistry.tracks.length + importedRegistry.labels.length + importedRegistry.chartEntries.length > 0;
}

export function hasImportedChartData() {
  return importedRegistry.chartEntries.length > 0;
}

export const getArtists = () => importedRegistry.artists;
export const getTracks = () => importedRegistry.tracks;
export const getLabels = () => importedRegistry.labels;
export const getReleases = () => importedRegistry.releases;
export const getGenres = () => importedRegistry.genres;
export const getChartSeries = () => effectiveChartSeries;
export const getChartEditions = () => effectiveChartEditions;
export const getArtistBySlug = (slug: string) => artistsBySlug.get(slug) ?? null;
export const getTrackBySlug = (slug: string) => tracksBySlug.get(slug) ?? null;
export const getLabelBySlug = (slug: string) => labelsBySlug.get(slug) ?? null;
export const getReleaseBySlug = (slug: string) => releasesBySlug.get(slug) ?? null;
export const getGenreBySlug = (slug: string) => genresBySlug.get(slug) ?? null;
export const resolveTrack = (trackId: string | null | undefined) => trackId ? tracksById.get(trackId) ?? null : null;
export const resolveArtist = (artistId: string | null | undefined) => artistId ? artistsById.get(artistId) ?? null : null;
export const resolveLabel = (labelId: string | null | undefined) => labelId ? labelsById.get(labelId) ?? null : null;

export function getChartEditionsForSeries(seriesSlug: string) {
  const series = effectiveChartSeries.find((item) => item.slug === seriesSlug || item.id === seriesSlug) ?? effectiveChartSeries[0];
  if (!series) return [];
  const editions = chartEditionsBySeries.get(series.id) ?? effectiveChartEditions.filter((edition) => edition.seriesId === series.id);
  return sortEditions(editions.length ? editions : effectiveChartEditions);
}

export function getLatestChartEdition(seriesSlug?: string) {
  const series = seriesSlug
    ? effectiveChartSeries.find((item) => item.slug === seriesSlug || item.id === seriesSlug)
    : effectiveChartSeries[0];
  if (!series) return null;
  return getChartEditionsForSeries(series.slug)[0] ?? null;
}

export function getChartEdition(seriesSlug: string, editionSlug: string) {
  const series = effectiveChartSeries.find((item) => item.slug === seriesSlug || item.id === seriesSlug);
  if (!series) return null;
  return effectiveChartEditions.find((edition) => edition.seriesId === series.id && (edition.slug === editionSlug || edition.id === editionSlug)) ?? getLatestChartEdition(seriesSlug);
}

export function getChartEntriesForEdition(editionId: string) {
  const exact = chartEntriesByEdition.get(editionId) ?? [];
  const rows = exact.length ? exact : importedRegistry.chartEntries;
  return rows.slice().sort((a, b) => a.rank - b.rank);
}

export function getArtistTopChartPosition(artist: ImportedArtist) {
  const ranks = artist.chartEntryIds
    .map((id) => importedRegistry.chartEntries.find((entry) => entry.id === id)?.rank)
    .filter((rank): rank is number => typeof rank === 'number');
  return ranks.length ? Math.min(...ranks) : 0;
}

export function toArtistCard(artist: ImportedArtist) {
  return {
    slug: artist.slug,
    name: artist.name,
    imageUrl: artist.imageUrl ?? undefined,
    genres: artist.genres,
    trackCount: artist.trackIds.length,
    releaseCount: artist.releaseIds.length,
    isChartArtist: artist.chartEntryIds.length > 0,
    isRising: false,
    country: artist.country ?? 'Unknown',
    debutYear: new Date().getFullYear(),
    monthlyStreams: 0,
    topChartPosition: getArtistTopChartPosition(artist),
    spotlightBio: artist.bio ?? `${artist.name} is part of the WAKILISHA registry, connected through the imported old-site data.`,
  };
}

export function toLabelCard(label: ImportedLabel) {
  return {
    slug: label.slug,
    name: label.name,
    country: label.country ?? undefined,
    artistCount: label.artistIds.length,
    releaseCount: label.releaseIds.length,
    logoUrl: label.logoUrl ?? undefined,
    isFeatured: label.artistIds.length >= 3 || label.releaseIds.length >= 3,
    featuredArtists: label.artistIds.map((id) => artistsById.get(id)?.name).filter(Boolean).slice(0, 6) as string[],
  };
}

export function toGenreCard(genre: ImportedGenre) {
  return {
    slug: genre.slug,
    name: genre.name,
    artistCount: genre.artistIds.length,
    trackCount: genre.trackIds.length,
    accentVar: '--wk-v-music',
    representativeArtists: genre.artistIds.map((id) => artistsById.get(id)?.name).filter(Boolean).slice(0, 3) as string[],
  };
}

export function toChartRow(entry: ImportedChartEntry) {
  const track = resolveTrack(entry.trackId);
  const previous = entry.previousRank;
  const movement = previous == null || previous === 0 ? 'new' : previous > entry.rank ? 'up' : previous < entry.rank ? 'down' : 'same';
  const weeksOnChart = entry.weeksOnChart ?? 0;
  return {
    rank: entry.rank,
    title: track?.title ?? 'Unknown track',
    slug: track?.slug ?? `chart-entry-${entry.id}`,
    artist: track?.artistNames.join(', ') || 'Unknown artist',
    movement,
    movementAmount: previous ? Math.abs(previous - entry.rank) : undefined,
    weeksOnChart,
    weeks: weeksOnChart,
    peakPosition: entry.peakPosition ?? entry.rank,
    isPlayable: Boolean(track?.sourceUrl),
    source: track?.source ?? undefined,
    artworkUrl: track?.artworkUrl ?? fallbackImage(track?.slug ?? entry.id),
    artistImage: undefined,
    genre: track?.genres[0] ?? undefined,
    label: track?.labelIds.map((id) => labelsById.get(id)?.name).filter(Boolean).join(', ') || undefined,
    previousWeek: previous ?? 0,
    seriesId: entry.seriesId,
    editionId: entry.editionId,
  };
}

export function getLatestChartRows(seriesSlug?: string) {
  const edition = getLatestChartEdition(seriesSlug);
  return edition ? getChartEntriesForEdition(edition.id).map(toChartRow) : importedRegistry.chartEntries.slice().sort((a, b) => a.rank - b.rank).map(toChartRow);
}

export function getChartRowsForEdition(seriesSlug: string, editionSlug: string) {
  const edition = getChartEdition(seriesSlug, editionSlug);
  return edition ? getChartEntriesForEdition(edition.id).map(toChartRow) : importedRegistry.chartEntries.slice().sort((a, b) => a.rank - b.rank).map(toChartRow);
}

export function getChartSeriesSummaries() {
  return effectiveChartSeries.map((series) => {
    const editions = getChartEditionsForSeries(series.slug);
    const latestEdition = editions[0] ?? null;
    const rows = latestEdition ? getChartEntriesForEdition(latestEdition.id) : importedRegistry.chartEntries;
    const entryCount = extractEntryCount(series.label, series.entryCount);
    return {
      id: series.slug,
      label: series.label,
      description: series.description ?? 'Imported WAKILISHA chart series',
      count: rows.length,
      entryCount,
      editionCount: editions.length,
      latestEdition,
      status: series.status ?? 'active',
    };
  });
}

export function buildChartEditionSummary(rows: ReturnType<typeof toChartRow>[], edition = getLatestChartEdition()) {
  const uniqueArtists = new Set(rows.map((entry) => entry.artist));
  const newEntries = rows.filter((entry) => entry.movement === 'new');
  const longestRunning = rows.slice().sort((a, b) => b.weeksOnChart - a.weeksOnChart)[0] ?? null;
  const biggestMover = rows.filter((entry) => entry.movement === 'up').sort((a, b) => (b.movementAmount ?? 0) - (a.movementAmount ?? 0))[0] ?? null;
  const genreCounts = rows.reduce<Record<string, number>>((acc, entry) => {
    const genre = entry.genre ?? 'Unknown';
    acc[genre] = (acc[genre] ?? 0) + 1;
    return acc;
  }, {});
  const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0] ?? ['Unknown', 0];
  return {
    date: edition?.date ?? '',
    weekNumber: Number(edition?.label?.match(/\d+/)?.[0] ?? edition?.slug?.match(/\d+/)?.[0] ?? 0),
    methodology: edition?.methodology ?? 'Compiled from imported WAKILISHA chart entries.',
    totalEntries: rows.length,
    totalArtists: uniqueArtists.size,
    newEntries: newEntries.length,
    topGenre: topGenre[0],
    topGenreCount: topGenre[1],
    longestRunning: longestRunning ?? { title: 'No chart entries', artist: '', weeks: 0, weeksOnChart: 0 },
    biggestMover: biggestMover ? { ...biggestMover, amount: biggestMover.movementAmount ?? 0 } : { title: 'No movement data', artist: '', amount: 0 },
  };
}

export function getSearchResults(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return { artists: [], tracks: [], labels: [], releases: [], genres: [] };
  const match = (value: string | null | undefined) => Boolean(value && value.toLowerCase().includes(q));
  return {
    artists: importedRegistry.artists.filter((item) => match(item.name) || item.genres.some(match)).slice(0, 12),
    tracks: importedRegistry.tracks.filter((item) => match(item.title) || item.artistNames.some(match)).slice(0, 12),
    labels: importedRegistry.labels.filter((item) => match(item.name) || match(item.country)).slice(0, 12),
    releases: importedRegistry.releases.filter((item) => match(item.title) || item.artistNames.some(match)).slice(0, 12),
    genres: importedRegistry.genres.filter((item) => match(item.name)).slice(0, 12),
  };
}

export function deriveGenresFromTracks(tracks: ImportedTrack[]) {
  const map = new Map<string, ImportedGenre>();
  for (const track of tracks) {
    for (const genreName of track.genres) {
      const slug = slugify(genreName);
      const genre = map.get(slug) ?? { id: slug, slug, name: titleCase(genreName), artistIds: [], trackIds: [] };
      if (!genre.trackIds.includes(track.id)) genre.trackIds.push(track.id);
      for (const artistId of track.artistIds) if (!genre.artistIds.includes(artistId)) genre.artistIds.push(artistId);
      map.set(slug, genre);
    }
  }
  return Array.from(map.values());
}
