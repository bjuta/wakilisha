import path from 'node:path';
import { EXPECTED_TABLES, type ExpectedTable } from './config.js';
import { listCsvFiles, readCsvRows, readCsvSummary, writeJson, writeText } from './csv.js';
import { buildOldRegistryRepair } from './oldRegistry.js';
import { detectTable } from './tableSignatures.js';

type Row = Record<string, string>;

type LoadedTables = Partial<Record<ExpectedTable, Row[]>>;

type Relationship = {
  sourceEntityType: string;
  sourceEntityId: string;
  relationshipType: string;
  targetEntityType: string;
  targetEntityId: string;
  position?: number | null;
  role?: string | null;
  confidence: number;
  source: string;
  needsReview: boolean;
  reviewReason?: string | null;
};

type ReviewItem = {
  entityType: string;
  entityId: string;
  label: string;
  issue: string;
  source: string;
  recommendation: string;
};

function loadTables(importDir: string): LoadedTables {
  const tables: LoadedTables = {};
  for (const filePath of listCsvFiles(importDir)) {
    const summary = readCsvSummary(filePath);
    const table = detectTable(summary.headers);
    if (!table) continue;
    tables[table] = readCsvRows(filePath);
  }
  return tables;
}

function safeLower(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function hasCombinedArtistSignal(value: string | undefined): boolean {
  const text = safeLower(value);
  if (!text) return false;
  return /,|&|\s+x\s+|\s+ft\.?\s+|\s+feat\.?\s+|\s+featuring\s+|\s+with\s+|\//i.test(text);
}

function makeKey(entityType: string, slugOrId: string): string {
  return `${entityType}:${safeLower(slugOrId)}`;
}

function buildEntityIndex(tables: LoadedTables) {
  const index = new Map<string, Row>();
  const add = (type: string, row: Row, slugField = 'slug') => {
    const slug = row[slugField] || row.id;
    if (!slug) return;
    index.set(makeKey(type, slug), row);
  };

  for (const row of tables.wk_tracks ?? []) add('track', row);
  for (const row of tables.wk_releases ?? []) add('release', row);
  for (const row of tables.wk_labels ?? []) add('label', row);
  for (const row of tables.wk_genres ?? []) add('genre', row);
  for (const row of tables.wk_registry_entities ?? []) {
    const type = row.entity_type || 'unknown';
    add(type, row);
  }

  return index;
}

function addRelationship(list: Relationship[], rel: Relationship) {
  const duplicate = list.some((existing) =>
    existing.sourceEntityType === rel.sourceEntityType &&
    existing.sourceEntityId === rel.sourceEntityId &&
    existing.relationshipType === rel.relationshipType &&
    existing.targetEntityType === rel.targetEntityType &&
    existing.targetEntityId === rel.targetEntityId &&
    existing.role === rel.role &&
    existing.position === rel.position
  );
  if (!duplicate) list.push(rel);
}

function addReviewItem(list: ReviewItem[], item: ReviewItem) {
  const duplicate = list.some((existing) =>
    existing.entityType === item.entityType &&
    existing.entityId === item.entityId &&
    existing.issue === item.issue &&
    existing.source === item.source
  );
  if (!duplicate) list.push(item);
}

function parseJsonMaybe(value: string | undefined): unknown | null {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function buildGraphReports(importDir: string, reportDir: string) {
  const tables = loadTables(importDir);
  const entityIndex = buildEntityIndex(tables);
  const relationships: Relationship[] = [];
  const reviewQueue: ReviewItem[] = [];

  for (const track of tables.wk_tracks ?? []) {
    const trackSlug = track.slug;
    const artistSlug = track.artist_slug;
    const artistName = track.artist_name;
    if (!trackSlug) continue;

    const artist = artistSlug ? entityIndex.get(makeKey('artist', artistSlug)) : null;
    if (artist) {
      addRelationship(relationships, {
        sourceEntityType: 'track',
        sourceEntityId: trackSlug,
        relationshipType: 'track_artist',
        targetEntityType: 'artist',
        targetEntityId: artistSlug,
        position: 1,
        role: 'primary',
        confidence: hasCombinedArtistSignal(artistName) ? 0.55 : 0.8,
        source: 'wk_tracks.artist_slug',
        needsReview: hasCombinedArtistSignal(artistName),
        reviewReason: hasCombinedArtistSignal(artistName) ? 'artist_name_looks_combined' : null
      });
    } else {
      addReviewItem(reviewQueue, {
        entityType: 'track',
        entityId: trackSlug,
        label: track.title ?? trackSlug,
        issue: 'missing_artist_relationship',
        source: 'wk_tracks',
        recommendation: 'Resolve artist_slug against registry artist entities.'
      });
    }
  }

  for (const release of tables.wk_releases ?? []) {
    const releaseSlug = release.slug;
    if (!releaseSlug) continue;

    const labelSlug = release.label_slug;
    if (labelSlug && entityIndex.has(makeKey('label', labelSlug))) {
      addRelationship(relationships, {
        sourceEntityType: 'release',
        sourceEntityId: releaseSlug,
        relationshipType: 'release_label',
        targetEntityType: 'label',
        targetEntityId: labelSlug,
        confidence: 0.85,
        source: 'wk_releases.label_slug',
        needsReview: false
      });
    }

    const tracklist = parseJsonMaybe(release.tracklist);
    if (!Array.isArray(tracklist) || tracklist.length === 0) {
      addReviewItem(reviewQueue, {
        entityType: 'release',
        entityId: releaseSlug,
        label: release.title ?? releaseSlug,
        issue: 'release_without_parseable_tracklist',
        source: 'wk_releases.tracklist',
        recommendation: 'Rebuild tracklist from old release track rows or provider payloads.'
      });
    }
  }

  for (const entry of tables.wk_chart_entries ?? []) {
    const entryId = entry.id || `${entry.chart_slug}:${entry.edition_id}:${entry.position}`;
    const trackSlug = entry.track_slug;
    if (trackSlug && entityIndex.has(makeKey('track', trackSlug))) {
      addRelationship(relationships, {
        sourceEntityType: 'chart_entry',
        sourceEntityId: entryId,
        relationshipType: 'chart_entry_track',
        targetEntityType: 'track',
        targetEntityId: trackSlug,
        position: Number(entry.position) || null,
        confidence: entry.is_resolved === 'true' ? 0.95 : 0.75,
        source: 'wk_chart_entries.track_slug',
        needsReview: entry.is_resolved !== 'true'
      });
    } else {
      addReviewItem(reviewQueue, {
        entityType: 'chart_entry',
        entityId: entryId,
        label: `${entry.title ?? 'Untitled'} - ${entry.artist_name ?? 'Unknown artist'}`,
        issue: 'chart_entry_without_canonical_track',
        source: 'wk_chart_entries',
        recommendation: 'Resolve by ISRC, provider ID, or normalized title plus artist.'
      });
    }
  }

  for (const media of tables.wk_media_assets ?? []) {
    const type = media.entity_type;
    const slug = media.entity_slug;
    if (type && slug && entityIndex.has(makeKey(type, slug))) {
      addRelationship(relationships, {
        sourceEntityType: type,
        sourceEntityId: slug,
        relationshipType: 'entity_media',
        targetEntityType: 'media_asset',
        targetEntityId: media.id || `${type}:${slug}:${media.url}`,
        role: media.role || 'primary',
        confidence: 0.9,
        source: 'wk_media_assets',
        needsReview: false
      });
    } else {
      addReviewItem(reviewQueue, {
        entityType: type || 'unknown',
        entityId: slug || media.id || 'unknown',
        label: media.alt_text || media.url || 'Unlabeled media',
        issue: 'media_asset_entity_not_found',
        source: 'wk_media_assets',
        recommendation: 'Check entity_type/entity_slug against canonical entity index.'
      });
    }
  }

  for (const artist of tables.wk_registry_entities?.filter((row) => row.entity_type === 'artist') ?? []) {
    if (hasCombinedArtistSignal(artist.title)) {
      addReviewItem(reviewQueue, {
        entityType: 'artist',
        entityId: artist.slug || artist.id,
        label: artist.title ?? artist.slug,
        issue: 'possible_combined_artist_string',
        source: 'wk_registry_entities',
        recommendation: 'Review whether this is a true group/collaboration or should split into multiple artists.'
      });
    }
  }

  const oldRegistry = buildOldRegistryRepair(tables);
  for (const rel of oldRegistry.relationships) addRelationship(relationships, rel);
  for (const item of oldRegistry.reviewItems) addReviewItem(reviewQueue, item);

  const coverage = {
    generatedAt: new Date().toISOString(),
    sourceTablesPresent: Object.fromEntries(EXPECTED_TABLES.map((table) => [table, Boolean(tables[table])])),
    oldRegistrySourceCounts: oldRegistry.stats,
    counts: {
      tracks: tables.wk_tracks?.length ?? 0,
      releases: tables.wk_releases?.length ?? 0,
      chartEntries: tables.wk_chart_entries?.length ?? 0,
      mediaAssets: tables.wk_media_assets?.length ?? 0,
      relationships: relationships.length,
      reviewItems: reviewQueue.length
    },
    relationshipTypes: relationships.reduce<Record<string, number>>((acc, rel) => {
      acc[rel.relationshipType] = (acc[rel.relationshipType] ?? 0) + 1;
      return acc;
    }, {}),
    relationshipSources: relationships.reduce<Record<string, number>>((acc, rel) => {
      acc[rel.source] = (acc[rel.source] ?? 0) + 1;
      return acc;
    }, {}),
    reviewIssueTypes: reviewQueue.reduce<Record<string, number>>((acc, item) => {
      acc[item.issue] = (acc[item.issue] ?? 0) + 1;
      return acc;
    }, {})
  };

  writeJson(path.join(reportDir, 'entity-relationships.seed.json'), relationships);
  writeJson(path.join(reportDir, 'relationship-review-queue.json'), reviewQueue);
  writeJson(path.join(reportDir, 'graph-coverage.json'), coverage);

  writeText(
    path.join(reportDir, 'graph-summary.md'),
    [
      '# WAKILISHA Relationship Graph First Pass',
      '',
      `Generated at: ${coverage.generatedAt}`,
      '',
      '## Counts',
      '',
      `- Tracks: ${coverage.counts.tracks}`,
      `- Releases: ${coverage.counts.releases}`,
      `- Chart entries: ${coverage.counts.chartEntries}`,
      `- Media assets: ${coverage.counts.mediaAssets}`,
      `- Relationships generated: ${coverage.counts.relationships}`,
      `- Review items: ${coverage.counts.reviewItems}`,
      '',
      '## Relationship types',
      '',
      ...Object.entries(coverage.relationshipTypes).map(([type, count]) => `- ${type}: ${count}`),
      '',
      '## Relationship sources',
      '',
      ...Object.entries(coverage.relationshipSources).map(([type, count]) => `- ${type}: ${count}`),
      '',
      '## Review issue types',
      '',
      ...Object.entries(coverage.reviewIssueTypes).map(([type, count]) => `- ${type}: ${count}`),
      ''
    ].join('\n')
  );

  return coverage;
}
