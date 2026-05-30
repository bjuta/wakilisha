import { importedRegistry } from './generated';
import type { ImportedArtist, ImportedChartEntry, ImportedGenre, ImportedLabel, ImportedRelease, ImportedTrack } from './types';

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
const releasesById = by(importedRegistry.releases, 'id');
const releasesBySlug = by(importedRegistry.releases, 'slug');
const genresBySlug = by(importedRegistry.genres, 'slug');
const chartEntriesByEdition = importedRegistry.chartEntries.reduce((acc, entry) => {
  const list = acc.get(entry.editionId) ?? [];
  list.push(entry);
  acc.set(entry.editionId, list);
  return acc;
}, new Map<string, ImportedChartEntry[]>());

const titleCase = (value: string) => value.replace(/\b\w/g, (char) => char.toUpperCase());
const fallbackImage = (seed: string) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/600/600`;

export function hasImportedRegistryData() {
  return importedRegistry.artists.length + importedRegistry.tracks.length + importedRegistry.labels.length + importedRegistry.chartEntries.length > 0;
}

export function getArtists() {
  return importedRegistry.artists;
}

export function getArtistBySlug(slug: string) {
  return artistsBySlug.get(slug) ?? null;
}

export function getTracks() {
  return importedRegistry.tracks;
}

export function getTrackBySlug(slug: string) {
  return tracksBySlug.get(slug) ?? null;
}

export function getLabels() {
  return importedRegistry.labels;
}

export function getLabelBySlug(slug: string) {
  return labelsBySlug.get(slug) ?? null;
}

export function getReleases() {
  return importedRegistry.releases;
}

export function getReleaseBySlug(slug: string) {
  return releasesBySlug.get(slug) ?? null;
}

export function getGenres() {
  return importedRegistry.genres;
}

export function getGenreBySlug(slug: string) {
  return genresBySlug.get(slug) ?? null;
}

export function getChartSeries() {
  return importedRegistry.chartSeries;
}

export function getLatestChartEdition(seriesSlug?: string) {
  const series = seriesSlug ? importedRegistry.chartSeries.find((item) => item.slug === seriesSlug) : importedRegistry.chartSeries[0];
  if (!series) return null;
  return importedRegistry.chartEditions.find((edition) => edition.seriesId === series.id) ?? null;
}

export function getChartEdition(seriesSlug: string, editionSlug: string) {
  const series = importedRegistry.chartSeries.find((item) => item.slug === seriesSlug);
  if (!series) return null;
  return importedRegistry.chartEditions.find((edition) => edition.seriesId === series.id && edition.slug === editionSlug) ?? null;
}

export function getChartEntriesForEdition(editionId: string) {
  return (chartEntriesByEdition.get(editionId) ?? []).slice().sort((a, b) => a.rank - b.rank);
}

export function resolveTrack(trackId: string | null | undefined) {
  return trackId ? tracksById.get(trackId) ?? null : null;
}

export function resolveArtist(artistId: string | null | undefined) {
  return artistId ? artistsById.get(artistId) ?? null : null;
}

export function resolveLabel(labelId: string | null | undefined) {
  return labelId ? labelsById.get(labelId) ?? null : null;
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
    country: artist.country ?? 'Unknown',
    debutYear: null,
    monthlyStreams: null,
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
  return {
    rank: entry.rank,
    title: track?.title ?? 'Unknown track',
    slug: track?.slug ?? `chart-entry-${entry.id}`,
    artist: track?.artistNames.join(', ') || 'Unknown artist',
    movement,
    movementAmount: previous ? Math.abs(previous - entry.rank) : undefined,
    weeksOnChart: entry.weeksOnChart ?? 0,
    peakPosition: entry.peakPosition ?? entry.rank,
    isPlayable: Boolean(track?.sourceUrl),
    source: track?.source ?? undefined,
    artworkUrl: track?.artworkUrl ?? fallbackImage(track?.slug ?? entry.id),
    artistImage: undefined,
    genre: track?.genres[0] ?? undefined,
    label: track?.labelIds.map((id) => labelsById.get(id)?.name).filter(Boolean).join(', ') || undefined,
    previousWeek: previous ?? 0,
  };
}

export function getLatestChartRows() {
  const edition = getLatestChartEdition();
  return edition ? getChartEntriesForEdition(edition.id).map(toChartRow) : [];
}

export function getArtistTopChartPosition(artist: ImportedArtist) {
  const ranks = artist.chartEntryIds
    .map((id) => importedRegistry.chartEntries.find((entry) => entry.id === id)?.rank)
    .filter((rank): rank is number => typeof rank === 'number');
  return ranks.length ? Math.min(...ranks) : 0;
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
