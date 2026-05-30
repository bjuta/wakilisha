import path from 'node:path';
import fs from 'node:fs';
import { ensureDir, listCsvFiles, readCsvRows, writeJson, writeText } from './csv.js';
import type { ExpectedTable } from './config.js';
import type { Relationship, ReviewItem } from './types.js';

export type OldRegistryRow = {
  source_table: string;
  source_pk: string;
  row_data: string;
  import_run_id?: string;
};

export type ParsedRegistryRow = {
  source_table: string;
  source_pk: string;
  data: Record<string, unknown>;
};

export type RegistryGrouped = Record<string, ParsedRegistryRow[]>;

export function parseRegistryRows(rows: OldRegistryRow[]): RegistryGrouped {
  const grouped: RegistryGrouped = {};

  for (const row of rows) {
    const table = row.source_table?.trim() ?? 'unknown';
    let data: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(row.row_data ?? '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        data = parsed as Record<string, unknown>;
      }
    } catch {
      data = {};
    }

    if (!grouped[table]) grouped[table] = [];
    grouped[table].push({
      source_table: table,
      source_pk: row.source_pk,
      data
    });
  }

  return grouped;
}

export function buildFromRegistryRows(
  tables: Partial<Record<ExpectedTable, Record<string, string>[]>>
): {
  relationships: Relationship[];
  reviewQueue: ReviewItem[];
  trackArtists: Array<{
    track_id: string;
    artist_id: string;
    artist_name_snapshot?: string;
    role?: string;
    position?: number;
    source: string;
    confidence: number;
    needs_review: boolean;
    review_reason?: string;
  }>;
  releaseTracks: Array<{
    release_id: string;
    track_id: string;
    disc_number?: number;
    track_number?: number;
    title_snapshot?: string;
    artist_snapshot?: string;
    source: string;
    confidence: number;
    needs_review: boolean;
    review_reason?: string;
  }>;
  artistGenres: Array<{
    artist_id: string;
    genre_id: string;
    source: string;
    confidence: number;
    needs_review: boolean;
    review_reason?: string;
  }>;
  playbackSources: Array<{
    track_id: string;
    provider?: string;
    provider_track_id?: string;
    isrc?: string;
    preview_url?: string;
    duration_ms?: number;
    artwork_url?: string;
    source_url?: string;
    source_ref?: string;
    source_payload?: unknown;
    confidence: number;
    needs_review: boolean;
    review_reason?: string;
  }>;
  entitySlugs: Array<{
    entity_type: string;
    entity_id: string;
    slug: string;
    full_path?: string;
    status: string;
    is_primary: boolean;
    legacy_path?: string;
    source: string;
    needs_review: boolean;
    review_reason?: string;
  }>;
  chartEntryTracks: Array<{
    chart_entry_id: string;
    track_id: string;
    position?: number;
    source: string;
    confidence: number;
    needs_review: boolean;
    review_reason?: string;
  }>;
} {
  const relationships: Relationship[] = [];
  const reviewQueue: ReviewItem[] = [];
  const trackArtists: ReturnType<typeof buildFromRegistryRows>['trackArtists'] = [];
  const releaseTracks: ReturnType<typeof buildFromRegistryRows>['releaseTracks'] = [];
  const artistGenres: ReturnType<typeof buildFromRegistryRows>['artistGenres'] = [];
  const playbackSources: ReturnType<typeof buildFromRegistryRows>['playbackSources'] = [];
  const entitySlugs: ReturnType<typeof buildFromRegistryRows>['entitySlugs'] = [];
  const chartEntryTracks: ReturnType<typeof buildFromRegistryRows>['chartEntryTracks'] = [];

  const oldRegistryRows = (tables.wk_old_registry_rows ?? []) as unknown as OldRegistryRow[];
  const registry = parseRegistryRows(oldRegistryRows);

  const trackArtistsOld = registry['wp_wkcharts_track_artists'] ?? [];
  const releaseTracksOld = registry['wp_wkcharts_release_tracks'] ?? [];
  const artistGenresOld = registry['wp_wkcharts_artist_genres'] ?? [];
  const entitySlugsOld = registry['wp_wkcharts_entity_slugs'] ?? [];
  const trackSourcesOld = registry['wp_wkcharts_track_sources'] ?? [];
  const releaseSourcesOld = registry['wp_wkcharts_release_sources'] ?? [];
  const releaseShellTracksOld = registry['wp_wkcharts_release_shell_tracks'] ?? [];
  const releaseShellArtistsOld = registry['wp_wkcharts_release_shell_artists'] ?? [];
  const editionItemsOld = registry['wp_wkcharts_edition_items'] ?? [];
  const tracksOld = registry['wp_wkcharts_tracks'] ?? [];
  const artistsOld = registry['wp_wkcharts_artists'] ?? [];
  const releasesOld = registry['wp_wkcharts_releases'] ?? [];
  const labelsOld = registry['wp_wkcharts_labels'] ?? [];

  const seenTrackArtists = new Set<string>();
  for (const row of trackArtistsOld) {
    const d = row.data;
    const trackId = String(d.track_id ?? d.track_slug ?? '');
    const artistId = String(d.artist_id ?? d.artist_slug ?? '');
    const role = String(d.role ?? 'primary');
    const position = Number(d.position ?? d.artist_position ?? 1);
    const artistName = String(d.artist_name ?? d.name ?? '');
    const combined = hasCombinedArtistSignal(artistName);
    const key = `${trackId}:${artistId}:${role}:${position}`;
    if (!trackId || !artistId || seenTrackArtists.has(key)) continue;
    seenTrackArtists.add(key);

    trackArtists.push({
      track_id: trackId,
      artist_id: artistId,
      artist_name_snapshot: artistName || undefined,
      role,
      position,
      source: 'wp_wkcharts_track_artists',
      confidence: combined ? 0.55 : 0.85,
      needs_review: combined,
      review_reason: combined ? 'artist_name_looks_combined' : undefined
    });

    relationships.push({
      sourceEntityType: 'track',
      sourceEntityId: trackId,
      relationshipType: 'track_artist',
      targetEntityType: 'artist',
      targetEntityId: artistId,
      position,
      role,
      confidence: combined ? 0.55 : 0.85,
      source: 'wp_wkcharts_track_artists',
      needsReview: combined,
      reviewReason: combined ? 'artist_name_looks_combined' : undefined
    });
  }

  const seenReleaseTracks = new Set<string>();
  for (const row of releaseTracksOld) {
    const d = row.data;
    const releaseId = String(d.release_id ?? d.release_slug ?? '');
    const trackId = String(d.track_id ?? d.track_slug ?? '');
    const discNumber = Number(d.disc_number ?? 1) || 1;
    const trackNumber = Number(d.track_number ?? d.position ?? '') || undefined;
    const titleSnapshot = String(d.track_title ?? d.title ?? '');
    const artistSnapshot = String(d.artist_name ?? d.artist_display ?? '');
    const key = `${releaseId}:${trackId}:${discNumber}:${trackNumber ?? -1}`;
    if (!releaseId || !trackId || seenReleaseTracks.has(key)) continue;
    seenReleaseTracks.add(key);

    releaseTracks.push({
      release_id: releaseId,
      track_id: trackId,
      disc_number: discNumber,
      track_number: trackNumber,
      title_snapshot: titleSnapshot || undefined,
      artist_snapshot: artistSnapshot || undefined,
      source: 'wp_wkcharts_release_tracks',
      confidence: 0.85,
      needs_review: false
    });

    relationships.push({
      sourceEntityType: 'release',
      sourceEntityId: releaseId,
      relationshipType: 'release_track',
      targetEntityType: 'track',
      targetEntityId: trackId,
      position: trackNumber ?? null,
      role: null,
      confidence: 0.85,
      source: 'wp_wkcharts_release_tracks',
      needsReview: false
    });
  }

  for (const row of releaseShellTracksOld) {
    const d = row.data;
    const releaseId = String(d.release_id ?? d.release_slug ?? '');
    const trackId = String(d.track_id ?? d.track_slug ?? '');
    const discNumber = Number(d.disc_number ?? 1) || 1;
    const trackNumber = Number(d.track_number ?? d.position ?? '') || undefined;
    const key = `${releaseId}:${trackId}:${discNumber}:${trackNumber ?? -1}`;
    if (!releaseId || !trackId || seenReleaseTracks.has(key)) continue;
    seenReleaseTracks.add(key);

    releaseTracks.push({
      release_id: releaseId,
      track_id: trackId,
      disc_number: discNumber,
      track_number: trackNumber,
      title_snapshot: String(d.track_title ?? d.title ?? '') || undefined,
      artist_snapshot: String(d.artist_name ?? d.artist_display ?? '') || undefined,
      source: 'wp_wkcharts_release_shell_tracks',
      confidence: 0.7,
      needs_review: true,
      review_reason: 'from_release_shell_needs_verification'
    });

    relationships.push({
      sourceEntityType: 'release',
      sourceEntityId: releaseId,
      relationshipType: 'release_track',
      targetEntityType: 'track',
      targetEntityId: trackId,
      position: trackNumber ?? null,
      role: null,
      confidence: 0.7,
      source: 'wp_wkcharts_release_shell_tracks',
      needsReview: true,
      reviewReason: 'from_release_shell_needs_verification'
    });
  }

  const seenArtistGenres = new Set<string>();
  for (const row of artistGenresOld) {
    const d = row.data;
    const artistId = String(d.artist_id ?? d.artist_slug ?? '');
    const genreId = String(d.genre_id ?? d.genre_slug ?? '');
    if (!artistId || !genreId || seenArtistGenres.has(`${artistId}:${genreId}`)) continue;
    seenArtistGenres.add(`${artistId}:${genreId}`);

    artistGenres.push({
      artist_id: artistId,
      genre_id: genreId,
      source: 'wp_wkcharts_artist_genres',
      confidence: 0.85,
      needs_review: false
    });

    relationships.push({
      sourceEntityType: 'artist',
      sourceEntityId: artistId,
      relationshipType: 'artist_genre',
      targetEntityType: 'genre',
      targetEntityId: genreId,
      confidence: 0.85,
      source: 'wp_wkcharts_artist_genres',
      needsReview: false
    });
  }

  const seenEntitySlugs = new Set<string>();
  for (const row of entitySlugsOld) {
    const d = row.data;
    const entityType = String(d.entity_type ?? '');
    const entityId = String(d.entity_id ?? d.id ?? '');
    const slug = String(d.slug ?? '');
    const fullPath = String(d.full_path ?? d.path ?? '');
    const status = String(d.status ?? 'active');
    const isPrimary = d.is_primary === true || d.is_primary === 'true' || d.is_primary === '1' || d.is_primary === 1;
    const legacyPath = String(d.old_path ?? d.legacy_path ?? '');
    const key = `${entityType}:${entityId}:${slug}`;
    if (!entityType || !entityId || !slug || seenEntitySlugs.has(key)) continue;
    seenEntitySlugs.add(key);

    entitySlugs.push({
      entity_type: entityType,
      entity_id: entityId,
      slug,
      full_path: fullPath || undefined,
      status: ['active', 'redirect', 'retired', 'duplicate', 'review'].includes(status) ? status : 'active',
      is_primary: isPrimary,
      legacy_path: legacyPath || undefined,
      source: 'wp_wkcharts_entity_slugs',
      needs_review: status === 'review' || status === 'duplicate',
      review_reason: status === 'review' ? 'slug_flagged_for_review' : status === 'duplicate' ? 'duplicate_slug' : undefined
    });

    relationships.push({
      sourceEntityType: 'old_slug',
      sourceEntityId: slug,
      relationshipType: 'redirects_to',
      targetEntityType: entityType,
      targetEntityId: entityId,
      confidence: 0.85,
      source: 'wp_wkcharts_entity_slugs',
      needsReview: false
    });
  }

  const seenPlayback = new Set<string>();
  for (const row of trackSourcesOld) {
    const d = row.data;
    const trackId = String(d.track_id ?? d.track_slug ?? '');
    const provider = String(d.provider ?? d.source_provider ?? '');
    const providerTrackId = String(d.provider_track_id ?? d.apple_track_id ?? d.spotify_track_id ?? '');
    const isrc = String(d.isrc ?? '');
    const previewUrl = extractPreviewUrl(d);
    const durationMs = Number(d.duration_ms ?? d.preview_duration_ms ?? d.duration ?? '') || undefined;
    const artworkUrl = String(d.artwork_url ?? d.image_url ?? '');
    const sourceUrl = String(d.source_url ?? d.url ?? '');
    const key = `${trackId}:${provider}:${providerTrackId}`;
    if (!trackId || !provider || seenPlayback.has(key)) continue;
    seenPlayback.add(key);

    playbackSources.push({
      track_id: trackId,
      provider,
      provider_track_id: providerTrackId || undefined,
      isrc: isrc || undefined,
      preview_url: previewUrl || undefined,
      duration_ms: durationMs,
      artwork_url: artworkUrl || undefined,
      source_url: sourceUrl || undefined,
      source_ref: 'wp_wkcharts_track_sources',
      source_payload: d,
      confidence: previewUrl ? 0.85 : 0.5,
      needs_review: !previewUrl,
      review_reason: !previewUrl ? 'missing_preview_url_in_track_source' : undefined
    });

    if (previewUrl) {
      relationships.push({
        sourceEntityType: 'track',
        sourceEntityId: trackId,
        relationshipType: 'entity_media',
        targetEntityType: 'playback_source',
        targetEntityId: `${provider}:${providerTrackId}`,
        confidence: 0.85,
        source: 'wp_wkcharts_track_sources',
        needsReview: false
      });
    }
  }

  for (const row of releaseSourcesOld) {
    const d = row.data;
    const releaseId = String(d.release_id ?? d.release_slug ?? '');
    const provider = String(d.provider ?? d.source_provider ?? '');
    const providerReleaseId = String(d.provider_release_id ?? d.apple_release_id ?? '');
    const artworkUrl = String(d.artwork_url ?? d.image_url ?? '');
    const sourceUrl = String(d.source_url ?? d.url ?? '');
    if (!releaseId || !provider) continue;

    relationships.push({
      sourceEntityType: 'release',
      sourceEntityId: releaseId,
      relationshipType: 'release_source',
      targetEntityType: 'provider',
      targetEntityId: provider,
      confidence: 0.75,
      source: 'wp_wkcharts_release_sources',
      needsReview: false
    });

    if (artworkUrl) {
      relationships.push({
        sourceEntityType: 'release',
        sourceEntityId: releaseId,
        relationshipType: 'entity_media',
        targetEntityType: 'media_asset',
        targetEntityId: `${provider}:${providerReleaseId}`,
        confidence: 0.75,
        source: 'wp_wkcharts_release_sources',
        needsReview: false
      });
    }
  }

  const seenChartEntryTracks = new Set<string>();
  for (const row of editionItemsOld) {
    const d = row.data;
    const editionId = String(d.edition_id ?? '');
    const chartSlug = String(d.chart_slug ?? '');
    const position = Number(d.position ?? '') || undefined;
    const trackId = String(d.track_id ?? d.track_slug ?? '');
    const entryId = `${chartSlug}:${editionId}:${position ?? 'unknown'}`;
    if (!trackId || !editionId || seenChartEntryTracks.has(`${entryId}:${trackId}`)) continue;
    seenChartEntryTracks.add(`${entryId}:${trackId}`);

    chartEntryTracks.push({
      chart_entry_id: entryId,
      track_id: trackId,
      position,
      source: 'wp_wkcharts_edition_items',
      confidence: 0.85,
      needs_review: false
    });

    relationships.push({
      sourceEntityType: 'chart_entry',
      sourceEntityId: entryId,
      relationshipType: 'chart_entry_track',
      targetEntityType: 'track',
      targetEntityId: trackId,
      position: position ?? null,
      confidence: 0.85,
      source: 'wp_wkcharts_edition_items',
      needsReview: false
    });
  }

  for (const row of tracksOld) {
    const d = row.data;
    const trackId = String(d.slug ?? d.id ?? d.track_id ?? '');
    const artistName = String(d.artist_name ?? '');
    if (trackId && hasCombinedArtistSignal(artistName)) {
      reviewQueue.push({
        entityType: 'track',
        entityId: trackId,
        label: `${String(d.title ?? 'Untitled')} - ${artistName}`,
        issue: 'track_artist_name_looks_combined',
        source: 'wp_wkcharts_tracks',
        recommendation: 'Review combined artist string and split if multiple artists exist.'
      });
    }
  }

  for (const row of releasesOld) {
    const d = row.data;
    const releaseId = String(d.slug ?? d.id ?? d.release_id ?? '');
    const status = String(d.status ?? '');
    if (status === 'duplicate_suspected' || status === 'review_needed' || status === 'rejected') {
      reviewQueue.push({
        entityType: 'release',
        entityId: releaseId,
        label: String(d.title ?? releaseId),
        issue: `release_status_${status}`,
        source: 'wp_wkcharts_releases',
        recommendation: 'Review release canonicalization status before public display.'
      });
    }
  }

  for (const row of artistsOld) {
    const d = row.data;
    const artistId = String(d.slug ?? d.id ?? d.artist_id ?? '');
    const artistName = String(d.name ?? d.display_name ?? '');
    if (artistId && hasCombinedArtistSignal(artistName)) {
      reviewQueue.push({
        entityType: 'artist',
        entityId: artistId,
        label: artistName,
        issue: 'possible_combined_artist_string',
        source: 'wp_wkcharts_artists',
        recommendation: 'Review whether this is a true group/collaboration or should split into multiple artists.'
      });
    }
  }

  for (const row of labelsOld) {
    const d = row.data;
    const labelId = String(d.slug ?? d.id ?? d.label_id ?? '');
    const labelName = String(d.name ?? '');
    if (labelId && !labelName.trim()) {
      reviewQueue.push({
        entityType: 'label',
        entityId: labelId,
        label: 'Unnamed label',
        issue: 'label_missing_name',
        source: 'wp_wkcharts_labels',
        recommendation: 'Add label name or retire label.'
      });
    }
  }

  return {
    relationships,
    reviewQueue,
    trackArtists,
    releaseTracks,
    artistGenres,
    playbackSources,
    entitySlugs,
    chartEntryTracks
  };
}

function hasCombinedArtistSignal(value: string | undefined): boolean {
  const text = (value ?? '').trim().toLowerCase();
  if (!text) return false;
  return /,|&|\s+x\s+|\s+ft\.?\s+|\s+feat\.?\s+|\s+featuring\s+|\s+with\s+|\//i.test(text);
}

function extractPreviewUrl(data: Record<string, unknown>): string | undefined {
  const direct = String(data.preview_url ?? data.previewUrl ?? '');
  if (direct && direct.startsWith('http')) return direct;

  const payload = data.payload ?? data.source_payload ?? data.immutable_payload ?? data.editable_payload;
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    const nested = String(p.preview_url ?? p.previewUrl ?? p.preview ?? '');
    if (nested && nested.startsWith('http')) return nested;

    const previewData = p.preview_data ?? p.preview;
    if (previewData && typeof previewData === 'object') {
      const pd = previewData as Record<string, unknown>;
      const url = String(pd.url ?? pd.preview_url ?? '');
      if (url && url.startsWith('http')) return url;
    }

    const attributes = p.attributes ?? p.Attributes;
    if (attributes && typeof attributes === 'object') {
      const attrs = attributes as Record<string, unknown>;
      const url = String(attrs.preview_url ?? attrs.previewUrl ?? attrs.url ?? '');
      if (url && url.startsWith('http')) return url;
    }
  }

  return undefined;
}

export function writeRegistrySeedFiles(
  reportDir: string,
  data: ReturnType<typeof buildFromRegistryRows>
) {
  ensureDir(reportDir);

  writeJson(path.join(reportDir, 'track-artists.seed.json'), data.trackArtists);
  writeJson(path.join(reportDir, 'release-tracks.seed.json'), data.releaseTracks);
  writeJson(path.join(reportDir, 'artist-genres.seed.json'), data.artistGenres);
  writeJson(path.join(reportDir, 'track-playback-sources.seed.json'), data.playbackSources);
  writeJson(path.join(reportDir, 'entity-slugs.seed.json'), data.entitySlugs);
  writeJson(path.join(reportDir, 'chart-entry-tracks.seed.json'), data.chartEntryTracks);

  writeText(
    path.join(reportDir, 'registry-parse-summary.md'),
    [
      '# WAKILISHA Old Registry Deep Parse Summary',
      '',
      `Generated at: ${new Date().toISOString()}`,
      '',
      '## Reconstructed from old registry rows',
      '',
      `- Track artists: ${data.trackArtists.length}`,
      `- Release tracks: ${data.releaseTracks.length}`,
      `- Artist genres: ${data.artistGenres.length}`,
      `- Playback sources: ${data.playbackSources.length}`,
      `- Entity slugs: ${data.entitySlugs.length}`,
      `- Chart entry tracks: ${data.chartEntryTracks.length}`,
      `- Total relationships: ${data.relationships.length}`,
      `- Review queue items: ${data.reviewQueue.length}`,
      '',
      '## Source tables used',
      '',
      '- wp_wkcharts_track_artists',
      '- wp_wkcharts_release_tracks',
      '- wp_wkcharts_release_shell_tracks',
      '- wp_wkcharts_artist_genres',
      '- wp_wkcharts_entity_slugs',
      '- wp_wkcharts_track_sources',
      '- wp_wkcharts_release_sources',
      '- wp_wkcharts_edition_items',
      '- wp_wkcharts_tracks',
      '- wp_wkcharts_releases',
      '- wp_wkcharts_artists',
      '- wp_wkcharts_labels',
      '',
      '## Review queue items',
      '',
      ...data.reviewQueue.slice(0, 20).map(
        (item) => `- [${item.entityType}] ${item.entityId}: ${item.issue} (${item.recommendation})`
      ),
      data.reviewQueue.length > 20 ? `\n... and ${data.reviewQueue.length - 20} more` : '',
      ''
    ].join('\n')
  );
}