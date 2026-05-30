type Row = Record<string, string>;

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

type OldRegistryRepairResult = {
  relationships: Relationship[];
  reviewItems: ReviewItem[];
  stats: Record<string, number>;
};

type LoadedTables = {
  wk_old_registry_rows?: Row[];
  wk_registry_entities?: Row[];
  wk_genres?: Row[];
  wk_labels?: Row[];
  wk_releases?: Row[];
  wk_tracks?: Row[];
};

function safeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function key(type: string, id: unknown): string {
  return `${type}:${safeString(id).toLowerCase()}`;
}

function parseJson(value: string | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function oldRowsBySource(tables: LoadedTables): Map<string, Record<string, unknown>[]> {
  const grouped = new Map<string, Record<string, unknown>[]>();

  for (const row of tables.wk_old_registry_rows ?? []) {
    const sourceTable = row.source_table;
    const rowData = parseJson(row.row_data);
    if (!sourceTable || !rowData) continue;
    const list = grouped.get(sourceTable) ?? [];
    list.push(rowData);
    grouped.set(sourceTable, list);
  }

  return grouped;
}

function buildLegacySlugIndex(tables: LoadedTables, grouped: Map<string, Record<string, unknown>[]>) {
  const slugs = new Map<string, string>();

  for (const row of grouped.get('wp_wkcharts_entity_slugs') ?? []) {
    const type = safeString(row.entity_type);
    const entityId = row.entity_id;
    const entitySlug = safeString(row.entity_slug || row.full_slug);
    if (!type || !entityId || !entitySlug) continue;
    slugs.set(key(type, entityId), entitySlug);
  }

  for (const row of grouped.get('wp_wkcharts_artists') ?? []) {
    if (row.id && row.slug) slugs.set(key('artist', row.id), safeString(row.slug));
  }

  for (const row of grouped.get('wp_wkcharts_labels') ?? []) {
    if (row.id && row.slug) slugs.set(key('label', row.id), safeString(row.slug));
  }

  for (const entity of tables.wk_registry_entities ?? []) {
    const raw = parseJson(entity.raw_meta);
    const type = entity.entity_type;
    if (raw?.id && type && entity.slug) slugs.set(key(type, raw.id), entity.slug);
  }

  for (const genre of tables.wk_genres ?? []) {
    const raw = parseJson(genre.raw_meta);
    const registryId = raw?._wk_genre_registry_id;
    if (registryId && genre.slug) slugs.set(key('genre', registryId), genre.slug);
  }

  return slugs;
}

function dedupeRelationships(relationships: Relationship[]): Relationship[] {
  const seen = new Set<string>();
  const out: Relationship[] = [];

  for (const rel of relationships) {
    const relationshipKey = [
      rel.sourceEntityType,
      rel.sourceEntityId,
      rel.relationshipType,
      rel.targetEntityType,
      rel.targetEntityId,
      rel.role ?? '',
      rel.position ?? ''
    ].join('|');

    if (seen.has(relationshipKey)) continue;
    seen.add(relationshipKey);
    out.push(rel);
  }

  return out;
}

export function buildOldRegistryRepair(tables: LoadedTables): OldRegistryRepairResult {
  const grouped = oldRowsBySource(tables);
  const legacySlugs = buildLegacySlugIndex(tables, grouped);
  const relationships: Relationship[] = [];
  const reviewItems: ReviewItem[] = [];

  for (const row of grouped.get('wp_wkcharts_track_artists') ?? []) {
    const trackSlug = legacySlugs.get(key('track', row.track_id));
    const artistSlug = legacySlugs.get(key('artist', row.artist_id));

    if (trackSlug && artistSlug) {
      relationships.push({
        sourceEntityType: 'track',
        sourceEntityId: trackSlug,
        relationshipType: 'track_artist',
        targetEntityType: 'artist',
        targetEntityId: artistSlug,
        position: Number(row.sort_order ?? 0) + 1,
        role: safeString(row.role) || 'primary',
        confidence: 0.95,
        source: 'old_registry.wp_wkcharts_track_artists',
        needsReview: false
      });
    } else {
      reviewItems.push({
        entityType: 'track_artist',
        entityId: `${safeString(row.track_id)}:${safeString(row.artist_id)}`,
        label: 'Old track artist relationship',
        issue: 'old_track_artist_unresolved_slug',
        source: 'old_registry.wp_wkcharts_track_artists',
        recommendation: 'Resolve old track_id or artist_id through legacy slug map.'
      });
    }
  }

  for (const row of grouped.get('wp_wkcharts_release_tracks') ?? []) {
    const releaseSlug = legacySlugs.get(key('release', row.release_id));
    const trackSlug = legacySlugs.get(key('track', row.track_id));

    if (releaseSlug && trackSlug) {
      relationships.push({
        sourceEntityType: 'release',
        sourceEntityId: releaseSlug,
        relationshipType: 'release_track',
        targetEntityType: 'track',
        targetEntityId: trackSlug,
        position: Number(row.track_number) || null,
        role: 'tracklist_item',
        confidence: 0.95,
        source: 'old_registry.wp_wkcharts_release_tracks',
        needsReview: false
      });
    } else {
      reviewItems.push({
        entityType: 'release_track',
        entityId: `${safeString(row.release_id)}:${safeString(row.track_id)}`,
        label: 'Old release track relationship',
        issue: 'old_release_track_unresolved_slug',
        source: 'old_registry.wp_wkcharts_release_tracks',
        recommendation: 'Resolve old release_id or track_id through legacy slug map.'
      });
    }
  }

  for (const row of grouped.get('wp_wkcharts_artist_genres') ?? []) {
    const artistSlug = legacySlugs.get(key('artist', row.artist_id));
    const genreSlug = legacySlugs.get(key('genre', row.genre_id));

    if (artistSlug && genreSlug) {
      relationships.push({
        sourceEntityType: 'artist',
        sourceEntityId: artistSlug,
        relationshipType: 'artist_genre',
        targetEntityType: 'genre',
        targetEntityId: genreSlug,
        role: row.is_primary === 1 || row.is_primary === '1' ? 'primary' : 'related',
        confidence: 0.95,
        source: 'old_registry.wp_wkcharts_artist_genres',
        needsReview: false
      });
    } else {
      reviewItems.push({
        entityType: 'artist_genre',
        entityId: `${safeString(row.artist_id)}:${safeString(row.genre_id)}`,
        label: 'Old artist genre relationship',
        issue: 'old_artist_genre_unresolved_slug',
        source: 'old_registry.wp_wkcharts_artist_genres',
        recommendation: 'Resolve old artist_id or genre_id through legacy slug map.'
      });
    }
  }

  const stats: Record<string, number> = {};
  for (const [sourceTable, rows] of grouped.entries()) {
    stats[sourceTable] = rows.length;
  }

  return {
    relationships: dedupeRelationships(relationships),
    reviewItems,
    stats
  };
}
