import path from 'node:path';
import { ensureDir, writeJson, writeText } from './csv.js';
import type { ExpectedTable } from './config.js';
import type { Relationship, ReviewItem, RouteCoverage } from './types.js';

export type SlugRow = {
  entity_type: string;
  entity_id: string;
  slug: string;
  full_path?: string;
  status: string;
  is_primary: boolean;
  legacy_path?: string;
  redirect_to_entity_type?: string;
  redirect_to_entity_id?: string;
  source: string;
  needs_review: boolean;
  review_reason?: string;
};

export function buildSlugAndRedirectMap(
  tables: Partial<Record<ExpectedTable, Record<string, string>[]>>
): {
  slugs: SlugRow[];
  relationships: Relationship[];
  reviewQueue: ReviewItem[];
  coverage: RouteCoverage;
} {
  const slugs: SlugRow[] = [];
  const relationships: Relationship[] = [];
  const reviewQueue: ReviewItem[] = [];

  const oldSlugs = tables.wk_old_primary_slugs ?? [];
  const registryEntities = tables.wk_registry_entities ?? [];
  const wordpressItems = tables.wk_wordpress_items ?? [];
  const releases = tables.wk_releases ?? [];
  const oldRegistryRows = tables.wk_old_registry_rows ?? [];

  const seenSlugs = new Set<string>();
  const canonicalSlugs = new Map<string, string>();
  const entityStatus = new Map<string, string>();

  for (const row of registryEntities) {
    const type = row.entity_type ?? '';
    const slug = row.slug ?? '';
    if (type && slug) {
      canonicalSlugs.set(`${type}:${slug}`, row.id ?? slug);
    }
  }

  for (const row of releases) {
    const slug = row.slug ?? '';
    if (slug) {
      entityStatus.set(`release:${slug}`, row.status ?? 'canonicalized');
    }
  }

  for (const raw of oldSlugs) {
    const entityType = String(raw.entity_type ?? '').trim();
    const entityId = String(raw.entity_id ?? raw.id ?? '').trim();
    const slug = String(raw.slug ?? '').trim();
    const fullPath = String(raw.full_path ?? '').trim();
    const isPrimary = raw.is_primary === 'true' || raw.is_primary === '1' || raw.is_primary === true;
    const key = `${entityType}:${slug}`;

    if (!entityType || !entityId || !slug || seenSlugs.has(key)) continue;
    seenSlugs.add(key);

    const canonicalKey = `${entityType}:${entityId}`;
    const hasCanonical = canonicalSlugs.has(canonicalKey);
    const releaseStatus = entityStatus.get(`release:${entityId}`);

    let status = 'active';
    let needsReview = false;
    let reviewReason: string | undefined;

    if (entityType === 'release' && releaseStatus) {
      if (releaseStatus === 'duplicate_suspected') {
        status = 'duplicate';
        needsReview = true;
        reviewReason = 'release_duplicate_suspected';
      } else if (releaseStatus === 'rejected') {
        status = 'retired';
        needsReview = false;
      } else if (releaseStatus === 'review_needed') {
        status = 'review';
        needsReview = true;
        reviewReason = 'release_needs_review';
      }
    }

    if (!hasCanonical && status === 'active') {
      status = 'review';
      needsReview = true;
      reviewReason = reviewReason ?? 'old_slug_no_canonical_entity';
    }

    slugs.push({
      entity_type: entityType,
      entity_id: entityId,
      slug,
      full_path: fullPath || undefined,
      status,
      is_primary: isPrimary,
      legacy_path: fullPath || undefined,
      source: 'wk_old_primary_slugs',
      needs_review: needsReview,
      review_reason: reviewReason
    });

    if (status === 'active' || status === 'redirect') {
      relationships.push({
        sourceEntityType: 'old_slug',
        sourceEntityId: slug,
        relationshipType: 'redirects_to',
        targetEntityType: entityType,
        targetEntityId: entityId,
        confidence: hasCanonical ? 0.9 : 0.5,
        source: 'wk_old_primary_slugs',
        needsReview: !hasCanonical,
        reviewReason: !hasCanonical ? 'old_slug_no_canonical_entity' : undefined
      });
    }

    if (status !== 'active' && status !== 'redirect') {
      reviewQueue.push({
        entityType: 'old_slug',
        entityId: slug,
        label: `${entityType}/${slug}`,
        issue: `old_slug_status_${status}`,
        source: 'wk_old_primary_slugs',
        recommendation: `Review old slug: ${fullPath || slug} for entity ${entityType}:${entityId}`
      });
    }
  }

  for (const raw of wordpressItems) {
    const postType = String(raw.post_type ?? '').trim();
    const postName = String(raw.post_name ?? '').trim();
    const postTitle = String(raw.post_title ?? '').trim();
    const guid = String(raw.guid ?? '').trim();
    const postStatus = String(raw.post_status ?? '').trim();

    if (!postName) continue;

    const entityType = wordpressPostTypeToEntityType(postType);
    if (!entityType) continue;

    const slugKey = `${entityType}:${postName}`;
    if (seenSlugs.has(slugKey)) continue;
    seenSlugs.add(slugKey);

    const legacyPath = guid || `/${postType}/${postName}/`;
    const isActive = postStatus === 'publish';

    let status = isActive ? 'active' : 'retired';
    let needsReview = !isActive;
    let reviewReason: string | undefined;

    if (postType === 'wakilisha_artist' || postType === 'wk_genre_page') {
      status = 'redirect';
      needsReview = false;
    }

    if (postType === 'page' && postName === 'home') {
      status = 'active';
      needsReview = false;
    }

    slugs.push({
      entity_type: entityType,
      entity_id: postName,
      slug: postName,
      full_path: legacyPath,
      status,
      is_primary: false,
      legacy_path: legacyPath,
      source: 'wk_wordpress_items',
      needs_review: needsReview,
      review_reason: reviewReason
    });

    if (isActive) {
      relationships.push({
        sourceEntityType: 'old_slug',
        sourceEntityId: postName,
        relationshipType: 'redirects_to',
        targetEntityType: entityType,
        targetEntityId: postName,
        confidence: 0.75,
        source: 'wk_wordpress_items',
        needsReview: false
      });
    }
  }

  for (const raw of oldRegistryRows) {
    let data: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(raw.row_data ?? '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        data = parsed as Record<string, unknown>;
      }
    } catch {
      continue;
    }

    const sourceTable = String(raw.source_table ?? '').trim();
    if (sourceTable !== 'wp_wkcharts_entity_slugs') continue;

    const entityType = String(data.entity_type ?? '').trim();
    const entityId = String(data.entity_id ?? data.id ?? '').trim();
    const slug = String(data.slug ?? '').trim();
    const fullPath = String(data.full_path ?? data.path ?? '').trim();
    const oldStatus = String(data.status ?? '').trim();

    if (!entityType || !slug) continue;

    const key = `${entityType}:${slug}`;
    if (seenSlugs.has(key)) continue;
    seenSlugs.add(key);

    const status = ['active', 'redirect', 'retired', 'duplicate', 'review'].includes(oldStatus)
      ? oldStatus
      : 'active';

    slugs.push({
      entity_type: entityType,
      entity_id: entityId || slug,
      slug,
      full_path: fullPath || undefined,
      status,
      is_primary: false,
      legacy_path: fullPath || undefined,
      source: 'wp_wkcharts_entity_slugs',
      needs_review: status === 'review' || status === 'duplicate',
      review_reason: status === 'review' ? 'slug_flagged_for_review' : undefined
    });

    relationships.push({
      sourceEntityType: 'old_slug',
      sourceEntityId: slug,
      relationshipType: 'redirects_to',
      targetEntityType: entityType,
      targetEntityId: entityId || slug,
      confidence: 0.8,
      source: 'wp_wkcharts_entity_slugs',
      needsReview: status !== 'active'
    });
  }

  const coverage: RouteCoverage = {
    totalOldSlugs: slugs.length,
    activeRoutes: slugs.filter((s) => s.status === 'active').length,
    redirects: slugs.filter((s) => s.status === 'redirect').length,
    retired: slugs.filter((s) => s.status === 'retired').length,
    duplicates: slugs.filter((s) => s.status === 'duplicate').length,
    flagged: slugs.filter((s) => s.needs_review).length,
    unresolved: slugs.filter((s) => s.status === 'review').length,
    byEntityType: {}
  };

  for (const s of slugs) {
    coverage.byEntityType[s.entity_type] = (coverage.byEntityType[s.entity_type] ?? 0) + 1;
  }

  return { slugs, relationships, reviewQueue, coverage };
}

export function wordpressPostTypeToEntityType(postType: string): string | null {
  const map: Record<string, string> = {
    post: 'article',
    wk_field_guide: 'guide',
    wakilisha_artist: 'artist',
    wk_chart_edition: 'chart_edition',
    page: 'surface_page',
    wk_genre_page: 'genre',
    wk_chart_series: 'chart_series',
    wk_magazine_surface: 'surface_page',
    wk_top10_surface: 'app_mount',
    wk_correction_page: 'utility_page',
    wk_settings_surface: 'app_mount',
    wk_registry_track: 'track',
    wk_registry_release: 'release',
    wk_labels_surface: 'label',
    wk_profile_surface: 'app_mount',
    wk_play_surface: 'app_mount',
    wk_methodology_surface: 'surface_page',
  };
  return map[postType] ?? null;
}

export function writeSlugFiles(reportDir: string, data: ReturnType<typeof buildSlugAndRedirectMap>) {
  ensureDir(reportDir);
  writeJson(path.join(reportDir, 'entity-slugs.full.json'), data.slugs);
  writeJson(path.join(reportDir, 'route-coverage.json'), data.coverage);

  writeText(
    path.join(reportDir, 'route-coverage.md'),
    [
      '# WAKILISHA Route Coverage Report',
      '',
      `Generated at: ${new Date().toISOString()}`,
      '',
      '## Summary',
      '',
      `- Total old slugs processed: ${data.coverage.totalOldSlugs}`,
      `- Active routes: ${data.coverage.activeRoutes}`,
      `- Redirects: ${data.coverage.redirects}`,
      `- Retired: ${data.coverage.retired}`,
      `- Duplicates: ${data.coverage.duplicates}`,
      `- Flagged for review: ${data.coverage.flagged}`,
      `- Unresolved: ${data.coverage.unresolved}`,
      '',
      '## By entity type',
      '',
      ...Object.entries(data.coverage.byEntityType).map(([type, count]) => `- ${type}: ${count}`),
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