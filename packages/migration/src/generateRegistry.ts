import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_IMPORT_DIR } from './config.js';
import { addUnique, first, list, loadDetectedTables, numberOrNull, rowId, rowImage, rowName, rowSlug, slugify, type Tables } from './registryUtils.js';

const importDir = process.env.WAKILISHA_IMPORT_DIR ?? DEFAULT_IMPORT_DIR;
const outputPath = process.env.WAKILISHA_REGISTRY_OUTPUT ?? path.join(process.cwd(), 'src', 'data', 'registry', 'generated.ts');

type AnyEntity = Record<string, any>;

function ensureSeries(chartSeries: Map<string, AnyEntity>, id: string) {
  if (!chartSeries.has(id)) {
    chartSeries.set(id, { id, slug: 'wakilisha-charts', label: 'WAKILISHA Charts', description: null, status: 'active' });
  }
}

function splitSlugs(value: string | null) {
  return list(value).map((item) => slugify(item));
}

function stripHtml(value: string | null) {
  return String(value ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function paragraphsFromHtml(value: string | null) {
  if (!value) return [];
  const matches = Array.from(value.matchAll(/<p[^>]*>(.*?)<\/p>/gis)).map((match) => stripHtml(match[1]));
  const paras = matches.length ? matches : stripHtml(value).split(/\n{2,}/).map((item) => item.trim());
  return paras.filter(Boolean).slice(0, 24);
}

function readMinutes(text: string) {
  const words = stripHtml(text).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function normalizeSection(row: AnyEntity, fallback: string) {
  const raw = first(row, ['section', 'category', 'category_name', 'post_type', 'type']) ?? fallback;
  const value = raw.replace(/^wk_/, '').replace(/_/g, ' ');
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function ingestArticles(tables: Tables) {
  const rows = [...(tables.wk_articles ?? []), ...(tables.wk_guides ?? [])];
  return rows.map((row, index) => {
    const title = rowName(row) ?? `Article ${index + 1}`;
    const id = rowId(row, 'article', index);
    const contentHtml = first(row, ['content_html', 'post_content', 'body', 'content']);
    const excerpt = first(row, ['excerpt_html', 'excerpt', 'post_excerpt', 'dek', 'summary']);
    const body = paragraphsFromHtml(contentHtml ?? excerpt);
    const date = first(row, ['published_at', 'post_date', 'date', 'modified_at']);
    const slug = rowSlug(row, title, 'article');
    const section = normalizeSection(row, tables.wk_guides?.includes(row) ? 'Guide' : 'Article');
    return {
      id,
      slug,
      title,
      section,
      date,
      author: first(row, ['author', 'author_name', 'post_author']) ?? 'WAKILISHA Editorial',
      excerpt: stripHtml(excerpt) || body[0] || null,
      contentHtml,
      body,
      heroUrl: rowImage(row),
      readingTime: readMinutes(contentHtml ?? excerpt ?? title),
      tags: list(first(row, ['tags', 'tag_names', 'keywords'])),
      relatedEntities: [],
      isFeatured: index === 0,
      readCount: 0,
    };
  }).filter((article) => article.title && article.slug);
}

function ensureArtistFromTrack(artists: Map<string, AnyEntity>, artistName: string | null, artistSlug: string | null) {
  const slug = artistSlug ? slugify(artistSlug) : artistName ? slugify(artistName) : null;
  if (!slug) return null;
  const existing = Array.from(artists.values()).find((artist) => artist.slug === slug || artist.name.toLowerCase() === String(artistName ?? '').toLowerCase());
  if (existing) return existing;
  const name = artistName || slug.replace(/-/g, ' ');
  const id = `artist-${slug}`;
  const artist = { id, slug, name, imageUrl: null, genres: [], country: null, bio: null, labels: [], trackIds: [], releaseIds: [], chartEntryIds: [] };
  artists.set(id, artist);
  return artist;
}

function ingestRegistryEntities(tables: Tables, artists: Map<string, AnyEntity>, labels: Map<string, AnyEntity>, genres: Map<string, AnyEntity>) {
  for (const [index, row] of (tables.wk_registry_entities ?? []).entries()) {
    const type = (first(row, ['type', 'entity_type', 'post_type', 'kind']) ?? '').toLowerCase();
    const name = rowName(row);
    if (!name) continue;
    const id = rowId(row, 'entity', index);
    const slug = rowSlug(row, name, 'entity');
    if (type.includes('artist')) artists.set(id, { id, slug, name, imageUrl: rowImage(row), genres: list(first(row, ['genres', 'genre'])), country: first(row, ['country', 'location']), bio: first(row, ['bio', 'description', 'excerpt']), labels: list(first(row, ['labels', 'label'])), trackIds: [], releaseIds: [], chartEntryIds: [] });
    if (type.includes('label')) labels.set(id, { id, slug, name, country: first(row, ['country', 'location']), logoUrl: rowImage(row), artistIds: [], releaseIds: [], trackIds: [] });
    if (type.includes('genre')) genres.set(id, { id, slug, name, artistIds: [], trackIds: [] });
  }
}

function ingestCoreTables(tables: Tables, tracks: Map<string, AnyEntity>, releases: Map<string, AnyEntity>, labels: Map<string, AnyEntity>, genres: Map<string, AnyEntity>) {
  for (const [index, row] of (tables.wk_labels ?? []).entries()) {
    const name = rowName(row); if (!name) continue;
    const id = rowId(row, 'label', index);
    labels.set(id, { id, slug: rowSlug(row, name, 'label'), name, country: first(row, ['country', 'location']), logoUrl: rowImage(row), artistIds: [], releaseIds: [], trackIds: [] });
  }
  for (const [index, row] of (tables.wk_tracks ?? []).entries()) {
    const title = rowName(row); if (!title) continue;
    const id = rowId(row, 'track', index);
    tracks.set(id, { id, slug: rowSlug(row, title, 'track'), title, artistNames: list(first(row, ['artist', 'artists', 'artist_name', 'artist_display', 'primary_artist'])), artistSlugs: splitSlugs(first(row, ['artist_slug', 'artist_slugs', 'primary_artist_slug'])), artistIds: list(first(row, ['artist_ids', 'artist_id'])), releaseId: first(row, ['release_id', 'album_id']), labelIds: list(first(row, ['label_ids', 'label_id'])), genres: list(first(row, ['genres', 'genre'])), artworkUrl: rowImage(row), source: first(row, ['source', 'platform']), sourceUrl: first(row, ['source_url', 'url', 'spotify_url', 'youtube_url', 'apple_url', 'preview_url']), chartEntryIds: [] });
  }
  for (const [index, row] of (tables.wk_releases ?? []).entries()) {
    const title = rowName(row); if (!title) continue;
    const id = rowId(row, 'release', index);
    releases.set(id, { id, slug: rowSlug(row, title, 'release'), title, artistNames: list(first(row, ['artist', 'artists', 'artist_name', 'artist_display'])), artistSlugs: splitSlugs(first(row, ['artist_slug', 'artist_slugs'])), artistIds: list(first(row, ['artist_ids', 'artist_id'])), labelIds: list(first(row, ['label_ids', 'label_id'])), trackIds: [], artworkUrl: rowImage(row), releaseDate: first(row, ['release_date', 'date', 'published_at']), year: numberOrNull(first(row, ['year', 'release_year'])) });
  }
  for (const [index, row] of (tables.wk_genres ?? []).entries()) {
    const name = rowName(row); if (!name) continue;
    const id = rowId(row, 'genre', index);
    genres.set(id, { id, slug: rowSlug(row, name, 'genre'), name, artistIds: [], trackIds: [] });
  }
}

function ingestCharts(tables: Tables, chartSeries: Map<string, AnyEntity>, chartEditions: Map<string, AnyEntity>, tracks: Map<string, AnyEntity>) {
  const chartEntries: AnyEntity[] = [];
  for (const [index, row] of (tables.wk_chart_series ?? []).entries()) {
    const label = rowName(row) ?? `Chart Series ${index + 1}`;
    const id = rowId(row, 'series', index);
    chartSeries.set(id, { id, slug: rowSlug(row, label, 'series'), label, description: first(row, ['description', 'excerpt']), status: first(row, ['status']) });
  }
  for (const [index, row] of (tables.wk_chart_editions ?? []).entries()) {
    const label = rowName(row) ?? `Edition ${index + 1}`;
    const id = rowId(row, 'edition', index);
    const seriesId = first(row, ['series_id', 'chart_series_id', 'chart_slug']) ?? Array.from(chartSeries.keys())[0] ?? 'default-series';
    ensureSeries(chartSeries, seriesId);
    chartEditions.set(id, { id, slug: rowSlug(row, label, 'edition'), seriesId, label, date: first(row, ['date', 'published_at', 'edition_date', 'chart_date']), period: first(row, ['period', 'chart_period']), methodology: first(row, ['methodology', 'source_notes']) });
  }
  for (const [index, row] of (tables.wk_chart_entries ?? []).entries()) {
    const id = rowId(row, 'entry', index);
    const editionId = first(row, ['edition_id', 'chart_edition_id']) ?? Array.from(chartEditions.keys())[0] ?? 'default-edition';
    const seriesId = first(row, ['series_id', 'chart_series_id', 'chart_slug']) ?? chartEditions.get(editionId)?.seriesId ?? Array.from(chartSeries.keys())[0] ?? 'default-series';
    ensureSeries(chartSeries, seriesId);
    const rank = numberOrNull(first(row, ['rank', 'position', 'chart_position'])) ?? index + 1;
    const title = first(row, ['track_title', 'song_title', 'title']);
    let trackId = first(row, ['track_id', 'song_id']);
    const trackSlug = first(row, ['track_slug', 'song_slug']);
    if (!trackId && trackSlug) trackId = Array.from(tracks.values()).find((track) => track.slug === trackSlug)?.id ?? null;
    if (!trackId && title) {
      trackId = `chart-track-${id}`;
      tracks.set(trackId, { id: trackId, slug: rowSlug(row, title, 'track'), title, artistNames: list(first(row, ['artist', 'artists', 'artist_name'])), artistSlugs: splitSlugs(first(row, ['artist_slug', 'artist_slugs'])), artistIds: [], releaseId: null, labelIds: [], genres: list(first(row, ['genre', 'genres'])), artworkUrl: rowImage(row), source: first(row, ['source', 'platform']), sourceUrl: first(row, ['source_url', 'url', 'preview_url']), chartEntryIds: [] });
    }
    chartEntries.push({ id, editionId, seriesId, trackId, rank, previousRank: numberOrNull(first(row, ['previous_rank', 'previous_position', 'last_week'])), weeksOnChart: numberOrNull(first(row, ['weeks', 'weeks_on_chart'])), peakPosition: numberOrNull(first(row, ['peak', 'peak_position'])) });
    if (trackId && tracks.has(trackId)) tracks.get(trackId).chartEntryIds.push(id);
  }
  return chartEntries;
}

function linkRelationships(artists: Map<string, AnyEntity>, tracks: Map<string, AnyEntity>, releases: Map<string, AnyEntity>, labels: Map<string, AnyEntity>, genres: Map<string, AnyEntity>, chartEntries: AnyEntity[]) {
  const artistsByName = new Map(Array.from(artists.values()).map((artist) => [String(artist.name).toLowerCase(), artist]));
  const artistsBySlug = new Map(Array.from(artists.values()).map((artist) => [String(artist.slug), artist]));
  for (const track of tracks.values()) {
    for (let i = 0; i < Math.max(track.artistNames.length, track.artistSlugs.length, track.artistIds.length); i++) {
      const artistName = track.artistNames[i] ?? null;
      const artistSlug = track.artistSlugs[i] ?? (artistName ? slugify(artistName) : null);
      const artist = (artistSlug ? artistsBySlug.get(artistSlug) : null) ?? (artistName ? artistsByName.get(String(artistName).toLowerCase()) : null) ?? ensureArtistFromTrack(artists, artistName, artistSlug);
      if (artist) { addUnique(track.artistIds, artist.id); addUnique(artist.trackIds, track.id); artistsBySlug.set(artist.slug, artist); artistsByName.set(String(artist.name).toLowerCase(), artist); }
    }
    for (const artistId of track.artistIds) addUnique(artists.get(artistId)?.trackIds, track.id);
    if (track.releaseId) addUnique(releases.get(track.releaseId)?.trackIds, track.id);
    for (const labelId of track.labelIds) addUnique(labels.get(labelId)?.trackIds, track.id);
    for (const genreName of track.genres) {
      const slug = slugify(genreName);
      let genre = Array.from(genres.values()).find((g) => g.slug === slug);
      if (!genre) { genre = { id: slug, slug, name: genreName, artistIds: [], trackIds: [] }; genres.set(slug, genre); }
      addUnique(genre.trackIds, track.id);
      for (const artistId of track.artistIds) addUnique(genre.artistIds, artistId);
    }
  }
  for (const release of releases.values()) {
    for (let i = 0; i < Math.max(release.artistNames.length, release.artistSlugs.length, release.artistIds.length); i++) {
      const artistName = release.artistNames[i] ?? null;
      const artistSlug = release.artistSlugs[i] ?? (artistName ? slugify(artistName) : null);
      const artist = (artistSlug ? artistsBySlug.get(artistSlug) : null) ?? (artistName ? artistsByName.get(String(artistName).toLowerCase()) : null) ?? ensureArtistFromTrack(artists, artistName, artistSlug);
      if (artist) { addUnique(release.artistIds, artist.id); addUnique(artist.releaseIds, release.id); }
    }
    for (const artistId of release.artistIds) addUnique(artists.get(artistId)?.releaseIds, release.id);
    for (const labelId of release.labelIds) addUnique(labels.get(labelId)?.releaseIds, release.id);
  }
  for (const entry of chartEntries) {
    const track = entry.trackId ? tracks.get(entry.trackId) : null;
    for (const artistId of track?.artistIds ?? []) addUnique(artists.get(artistId)?.chartEntryIds, entry.id);
  }
}

function build() {
  const tables = loadDetectedTables(importDir);
  const artists = new Map<string, AnyEntity>();
  const tracks = new Map<string, AnyEntity>();
  const releases = new Map<string, AnyEntity>();
  const labels = new Map<string, AnyEntity>();
  const genres = new Map<string, AnyEntity>();
  const chartSeries = new Map<string, AnyEntity>();
  const chartEditions = new Map<string, AnyEntity>();
  ingestRegistryEntities(tables, artists, labels, genres);
  ingestCoreTables(tables, tracks, releases, labels, genres);
  const chartEntries = ingestCharts(tables, chartSeries, chartEditions, tracks);
  linkRelationships(artists, tracks, releases, labels, genres, chartEntries);
  const articles = ingestArticles(tables);
  return { artists: Array.from(artists.values()), tracks: Array.from(tracks.values()), releases: Array.from(releases.values()), labels: Array.from(labels.values()), genres: Array.from(genres.values()), chartSeries: Array.from(chartSeries.values()), chartEditions: Array.from(chartEditions.values()), chartEntries, mediaAssets: [], articles, generatedAt: new Date().toISOString() };
}

const registry = build();
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `import type { ImportedRegistry } from './types';\n\nexport const importedRegistry: ImportedRegistry = ${JSON.stringify(registry, null, 2)};\n`, 'utf8');
console.log(`Generated registry: ${outputPath}`);
console.log(JSON.stringify({ artists: registry.artists.length, tracks: registry.tracks.length, labels: registry.labels.length, genres: registry.genres.length, releases: registry.releases.length, chartEntries: registry.chartEntries.length, articles: registry.articles.length, orphanTracks: registry.tracks.filter((track: AnyEntity) => track.artistIds.length === 0).length }, null, 2));
