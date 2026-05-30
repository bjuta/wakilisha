import path from 'node:path';
import { ensureDir, writeJson, writeText } from './csv.js';
import type { ExpectedTable } from './config.js';
import type { Relationship, ReviewItem, PlaybackCoverage } from './types.js';

export type PlaybackSourceRow = {
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
};

export function buildPlaybackSources(
  tables: Partial<Record<ExpectedTable, Record<string, string>[]>>
): {
  playbackSources: PlaybackSourceRow[];
  relationships: Relationship[];
  reviewQueue: ReviewItem[];
  coverage: PlaybackCoverage;
} {
  const playbackSources: PlaybackSourceRow[] = [];
  const relationships: Relationship[] = [];
  const reviewQueue: ReviewItem[] = [];

  const tracks = tables.wk_tracks ?? [];
  const chartEntries = tables.wk_chart_entries ?? [];
  const oldRegistryRows = tables.wk_old_registry_rows ?? [];
  const mediaAssets = tables.wk_media_assets ?? [];

  const seen = new Set<string>();
  const tracksWithPlayable = new Set<string>();

  for (const track of tracks) {
    const trackId = track.slug ?? '';
    if (!trackId) continue;

    const platformLinks = safeParseJson(track.platform_links);
    const immutablePayload = safeParseJson(track.immutable_payload);
    const editablePayload = safeParseJson(track.editable_payload);

    const previewUrl =
      extractPreviewUrlFromPayload(editablePayload) ??
      extractPreviewUrlFromPayload(immutablePayload) ??
      extractPreviewUrlFromPayload(platformLinks);

    const appleTrackId =
      extractAppleTrackId(editablePayload) ??
      extractAppleTrackId(immutablePayload) ??
      extractAppleTrackId(platformLinks) ??
      track.apple_track_id;

    const isrc = track.isrc || extractIsrc(editablePayload) || extractIsrc(immutablePayload);
    const durationMs = Number(track.duration_ms ?? '') || extractDurationMs(editablePayload) || extractDurationMs(immutablePayload);
    const artworkUrl = track.artwork_url || extractArtworkUrl(editablePayload) || extractArtworkUrl(immutablePayload);

    const provider = appleTrackId ? 'apple_music' : 'unknown';
    const key = `${trackId}:${provider}:${appleTrackId ?? 'unknown'}`;

    if (seen.has(key)) continue;
    seen.add(key);

    playbackSources.push({
      track_id: trackId,
      provider,
      provider_track_id: appleTrackId || undefined,
      isrc: isrc || undefined,
      preview_url: previewUrl || undefined,
      duration_ms: durationMs || undefined,
      artwork_url: artworkUrl || undefined,
      source_url: undefined,
      source_ref: 'wk_tracks.payload_extraction',
      source_payload: { editablePayload, immutablePayload },
      confidence: previewUrl ? 0.75 : 0.4,
      needs_review: !previewUrl,
      review_reason: !previewUrl ? 'track_payload_missing_preview_url' : undefined
    });

    if (previewUrl) {
      tracksWithPlayable.add(trackId);
      relationships.push({
        sourceEntityType: 'track',
        sourceEntityId: trackId,
        relationshipType: 'entity_media',
        targetEntityType: 'playback_source',
        targetEntityId: `${provider}:${appleTrackId ?? trackId}`,
        confidence: 0.75,
        source: 'wk_tracks.payload_extraction',
        needsReview: false
      });
    }
  }

  for (const entry of chartEntries) {
    const trackId = entry.track_slug ?? '';
    if (!trackId) continue;

    const payload = safeParseJson(entry.source_payload);
    if (!payload || typeof payload !== 'object') continue;

    const p = payload as Record<string, unknown>;
    const trackPayload = p.track ?? p.song ?? p.canonical_track;
    if (!trackPayload || typeof trackPayload !== 'object') continue;

    const tp = trackPayload as Record<string, unknown>;
    const previewUrl = extractPreviewUrlFromPayload(tp);
    const appleTrackId = extractAppleTrackId(tp);
    const isrc = extractIsrc(tp);
    const durationMs = extractDurationMs(tp);
    const artworkUrl = extractArtworkUrl(tp);

    const provider = appleTrackId ? 'apple_music' : 'unknown';
    const key = `${trackId}:chart:${provider}:${appleTrackId ?? 'unknown'}`;
    if (seen.has(key)) continue;
    seen.add(key);

    playbackSources.push({
      track_id: trackId,
      provider,
      provider_track_id: appleTrackId || undefined,
      isrc: isrc || undefined,
      preview_url: previewUrl || undefined,
      duration_ms: durationMs || undefined,
      artwork_url: artworkUrl || undefined,
      source_url: undefined,
      source_ref: 'wk_chart_entries.source_payload',
      source_payload: tp,
      confidence: previewUrl ? 0.9 : 0.5,
      needs_review: !previewUrl,
      review_reason: !previewUrl ? 'chart_payload_missing_preview_url' : undefined
    });

    if (previewUrl) {
      tracksWithPlayable.add(trackId);
    }
  }

  for (const raw of oldRegistryRows) {
    const sourceTable = raw.source_table ?? '';
    if (sourceTable !== 'wp_wkcharts_track_sources') continue;

    let data: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(raw.row_data ?? '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        data = parsed as Record<string, unknown>;
      }
    } catch {
      continue;
    }

    const trackId = String(data.track_id ?? data.track_slug ?? '');
    const provider = String(data.provider ?? data.source_provider ?? '');
    const providerTrackId = String(data.provider_track_id ?? data.apple_track_id ?? '');
    const previewUrl = extractPreviewUrlFromPayload(data);
    const isrc = String(data.isrc ?? '');
    const durationMs = Number(data.duration_ms ?? data.preview_duration_ms ?? '') || undefined;
    const artworkUrl = String(data.artwork_url ?? data.image_url ?? '');

    if (!trackId || !provider) continue;
    const key = `${trackId}:registry:${provider}:${providerTrackId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    playbackSources.push({
      track_id: trackId,
      provider,
      provider_track_id: providerTrackId || undefined,
      isrc: isrc || undefined,
      preview_url: previewUrl || undefined,
      duration_ms: durationMs,
      artwork_url: artworkUrl || undefined,
      source_url: String(data.source_url ?? data.url ?? '') || undefined,
      source_ref: 'wp_wkcharts_track_sources',
      source_payload: data,
      confidence: previewUrl ? 0.85 : 0.5,
      needs_review: !previewUrl,
      review_reason: !previewUrl ? 'registry_source_missing_preview' : undefined
    });

    if (previewUrl) {
      tracksWithPlayable.add(trackId);
    }
  }

  for (const media of mediaAssets) {
    const entityType = media.entity_type ?? '';
    const entitySlug = media.entity_slug ?? '';
    const url = media.url ?? '';
    if (entityType !== 'track' || !entitySlug || !url) continue;
    if (tracksWithPlayable.has(entitySlug)) continue;

    const key = `${entitySlug}:media:${url}`;
    if (seen.has(key)) continue;
    seen.add(key);

    playbackSources.push({
      track_id: entitySlug,
      provider: 'media_asset',
      artwork_url: url,
      source_ref: 'wk_media_assets',
      confidence: 0.5,
      needs_review: true,
      review_reason: 'media_asset_only_no_preview_url'
    });
  }

  const totalTracks = tracks.length;
  const tracksWithPreview = new Set(playbackSources.filter((p) => p.preview_url).map((p) => p.track_id)).size;
  const tracksWithAppleId = new Set(playbackSources.filter((p) => p.provider_track_id).map((p) => p.track_id)).size;
  const tracksWithIsrc = new Set(playbackSources.filter((p) => p.isrc).map((p) => p.track_id)).size;
  const tracksWithArtwork = new Set(playbackSources.filter((p) => p.artwork_url).map((p) => p.track_id)).size;

  const byProvider: Record<string, number> = {};
  for (const p of playbackSources) {
    const provider = p.provider ?? 'unknown';
    byProvider[provider] = (byProvider[provider] ?? 0) + 1;
  }

  const coverage: PlaybackCoverage = {
    totalTracks,
    tracksWithPreview,
    tracksWithAppleId,
    tracksWithIsrc,
    tracksWithArtwork,
    tracksWithoutPlayable: totalTracks - tracksWithPreview,
    byProvider
  };

  for (const track of tracks) {
    const trackId = track.slug ?? '';
    if (!trackId || tracksWithPlayable.has(trackId)) continue;
    reviewQueue.push({
      entityType: 'track',
      entityId: trackId,
      label: `${track.title ?? 'Untitled'} - ${track.artist_name ?? 'Unknown'}`,
      issue: 'track_without_playable_metadata',
      source: 'playback_extraction',
      recommendation: 'Extract preview from old source rows or manual review.'
    });
  }

  return { playbackSources, relationships, reviewQueue, coverage };
}

function safeParseJson(value: string | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractPreviewUrlFromPayload(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const p = payload as Record<string, unknown>;

  const direct = String(p.preview_url ?? p.previewUrl ?? p.preview ?? '');
  if (direct && direct.startsWith('http')) return direct;

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

  const platforms = p.platforms ?? p.platform_links;
  if (platforms && typeof platforms === 'object') {
    const pl = platforms as Record<string, unknown>;
    const apple = pl.apple_music ?? pl.apple;
    if (apple && typeof apple === 'object') {
      const a = apple as Record<string, unknown>;
      const url = String(a.preview_url ?? a.url ?? '');
      if (url && url.startsWith('http')) return url;
    }
  }

  return undefined;
}

function extractAppleTrackId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const p = payload as Record<string, unknown>;
  const id = String(p.apple_track_id ?? p.appleTrackId ?? p.apple_id ?? p.id ?? '');
  return id || undefined;
}

function extractIsrc(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const p = payload as Record<string, unknown>;
  const isrc = String(p.isrc ?? p.ISRC ?? '');
  return isrc || undefined;
}

function extractDurationMs(payload: unknown): number | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const p = payload as Record<string, unknown>;
  const duration = Number(p.duration_ms ?? p.preview_duration_ms ?? p.duration ?? '');
  return duration || undefined;
}

function extractArtworkUrl(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const p = payload as Record<string, unknown>;
  const url = String(p.artwork_url ?? p.image_url ?? p.artwork ?? p.cover ?? '');
  return url || undefined;
}

export function writePlaybackFiles(reportDir: string, data: ReturnType<typeof buildPlaybackSources>) {
  ensureDir(reportDir);
  writeJson(path.join(reportDir, 'track-playback-sources.full.json'), data.playbackSources);
  writeJson(path.join(reportDir, 'playback-coverage.json'), data.coverage);

  writeText(
    path.join(reportDir, 'playback-coverage.md'),
    [
      '# WAKILISHA Playback Coverage Report',
      '',
      `Generated at: ${new Date().toISOString()}`,
      '',
      '## Summary',
      '',
      `- Total tracks: ${data.coverage.totalTracks}`,
      `- Tracks with preview URL: ${data.coverage.tracksWithPreview}`,
      `- Tracks with Apple track ID: ${data.coverage.tracksWithAppleId}`,
      `- Tracks with ISRC: ${data.coverage.tracksWithIsrc}`,
      `- Tracks with artwork: ${data.coverage.tracksWithArtwork}`,
      `- Tracks without playable metadata: ${data.coverage.tracksWithoutPlayable}`,
      '',
      '## By provider',
      '',
      ...Object.entries(data.coverage.byProvider).map(([provider, count]) => `- ${provider}: ${count}`),
      '',
      '## Review queue',
      '',
      ...data.reviewQueue.slice(0, 20).map(
        (item) => `- [${item.entityType}] ${item.entityId}: ${item.issue}`
      ),
      data.reviewQueue.length > 20 ? `\n... and ${data.reviewQueue.length - 20} more` : '',
      ''
    ].join('\n')
  );
}