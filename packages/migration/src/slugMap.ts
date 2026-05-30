import path from 'node:path';
import { EXPECTED_TABLES, type ExpectedTable } from './config.js';
import { listCsvFiles, readCsvRows, readCsvSummary, writeJson, writeText } from './csv.js';
import { detectTable } from './tableSignatures.js';

type Row = Record<string, string>;
type LoadedTables = Partial<Record<ExpectedTable, Row[]>>;

type EntitySlug = {
  entityType: string;
  entityId: string;
  slug: string;
  fullPath: string;
  status: 'active' | 'redirect' | 'retired' | 'duplicate' | 'review';
  isPrimary: boolean;
  legacyPath?: string | null;
  redirectToEntityType?: string | null;
  redirectToEntityId?: string | null;
  source: string;
  needsReview: boolean;
  reviewReason?: string | null;
};

type RouteReviewItem = {
  entityType: string;
  entityId: string;
  slug: string;
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

function normalizePath(value: string | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  const withoutOrigin = raw.replace(/^https?:\/\/[^/]+/i, '');
  const withLeading = withoutOrigin.startsWith('/') ? withoutOrigin : `/${withoutOrigin}`;
  return withLeading.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

function safeSlug(value: string | undefined): string {
  return (value ?? '').trim().replace(/^\/+|\/+$/g, '');
}

function routeForEntity(entityType: string, slug: string, fallbackPath?: string): string {
  const cleanSlug = safeSlug(slug);
  const fallback = normalizePath(fallbackPath);

  if (fallback && fallback !== '/') return fallback;

  if (!cleanSlug) return '';

  switch (entityType) {
    case 'artist':
      return `/artists/${cleanSlug}`;
    case 'track':
      return cleanSlug.includes('/') ? `/tracks/${cleanSlug}` : `/tracks/${cleanSlug}`;
    case 'release':
      return cleanSlug.includes('/') ? `/releases/${cleanSlug}` : `/releases/${cleanSlug}`;
    case 'label':
      return `/labels/${cleanSlug}`;
    case 'genre':
      return `/genres/${cleanSlug}`;
    case 'chart_series':
      return `/charts/${cleanSlug}`;
    case 'chart_edition':
      return `/charts/${cleanSlug}`;
    case 'guide':
      return `/guides/${cleanSlug}`;
    case 'article':
      return `/${cleanSlug}`;
    default:
      return `/${cleanSlug}`;
  }
}

function addSlug(list: EntitySlug[], item: EntitySlug) {
  const key = [item.entityType, item.entityId, item.slug, item.fullPath, item.source].join('|');
  if (list.some((existing) => [existing.entityType, existing.entityId, existing.slug, existing.fullPath, existing.source].join('|') === key)) {
    return;
  }
  list.push(item);
}

function addReview(list: RouteReviewItem[], item: RouteReviewItem) {
  const key = [item.entityType, item.entityId, item.slug, item.issue, item.source].join('|');
  if (list.some((existing) => [existing.entityType, existing.entityId, existing.slug, existing.issue, existing.source].join('|') === key)) {
    return;
  }
  list.push(item);
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

function classifyPostType(postType: string): { entityType: string; routePrefix: string; needsReview: boolean; reviewReason?: string } {
  switch (postType) {
    case 'wakilisha_artist':
      return { entityType: 'artist', routePrefix: '/artists', needsReview: false };
    case 'wk_chart_series':
      return { entityType: 'chart_series', routePrefix: '/charts', needsReview: false };
    case 'wk_chart_edition':
      return { entityType: 'chart_edition', routePrefix: '/charts', needsReview: false };
    case 'wk_genre_page':
      return { entityType: 'genre', routePrefix: '/genres', needsReview: false };
    case 'wk_field_guide':
      return { entityType: 'guide', routePrefix: '/guides', needsReview: false };
    case 'post':
      return { entityType: 'article', routePrefix: '', needsReview: false };
    case 'page':
      return { entityType: 'surface_page', routePrefix: '', needsReview: true, reviewReason: 'wordpress_page_needs_classification' };
    default:
      return { entityType: 'surface_page', routePrefix: '', needsReview: true, reviewReason: `post_type_${postType}_needs_classification` };
  }
}

export function buildSlugMapReports(importDir: string, reportDir: string) {
  const tables = loadTables(importDir);
  const slugs: EntitySlug[] = [];
  const reviewItems: RouteReviewItem[] = [];

  for (const row of tables.wk_registry_entities ?? []) {
    const entityType = row.entity_type;
    const entityId = row.id || row.slug;
    const slug = safeSlug(row.slug);
    const fullPath = routeForEntity(entityType, slug, row.href);

    if (!entityType || !entityId || !slug || !fullPath) {
      addReview(reviewItems, {
        entityType: entityType || 'unknown',
        entityId: entityId || 'unknown',
        slug,
        issue: 'registry_entity_missing_route_parts',
        source: 'wk_registry_entities',
        recommendation: 'Check entity_type, id, slug, and href.'
      });
      continue;
    }

    addSlug(slugs, {
      entityType,
      entityId,
      slug,
      fullPath,
      status: 'active',
      isPrimary: true,
      legacyPath: row.href || null,
      source: 'wk_registry_entities.href',
      needsReview: false
    });
  }

  for (const row of tables.wk_old_primary_slugs ?? []) {
    const entityType = row.entity_type;
    const entityId = row.entity_id;
    const slug = safeSlug(row.slug || row.entity_slug || row.full_slug);
    const fullPath = routeForEntity(entityType, slug, row.full_path || row.href);

    if (!entityType || !entityId || !slug) {
      addReview(reviewItems, {
        entityType: entityType || 'unknown',
        entityId: entityId || 'unknown',
        slug,
        issue: 'old_primary_slug_missing_parts',
        source: 'wk_old_primary_slugs',
        recommendation: 'Review old slug row and map it manually if public.'
      });
      continue;
    }

    addSlug(slugs, {
      entityType,
      entityId,
      slug,
      fullPath,
      status: 'active',
      isPrimary: row.is_primary === '1' || row.is_primary === 'true' || row.is_primary === '',
      legacyPath: row.full_path || row.href || null,
      source: 'wk_old_primary_slugs',
      needsReview: false
    });
  }

  for (const row of tables.wk_wordpress_items ?? []) {
    const postType = row.post_type;
    const postName = safeSlug(row.post_name || row.slug);
    const postId = row.id || row.ID || row.source_wp_post_id || postName;
    const classification = classifyPostType(postType);
    const fullPath = normalizePath(row.permalink || row.guid) || `${classification.routePrefix}/${postName}`.replace(/\/+/g, '/');

    if (!postName || !postId) continue;

    addSlug(slugs, {
      entityType: classification.entityType,
      entityId: postId,
      slug: postName,
      fullPath: normalizePath(fullPath),
      status: classification.needsReview ? 'review' : 'active',
      isPrimary: true,
      legacyPath: row.guid || row.permalink || null,
      source: 'wk_wordpress_items',
      needsReview: classification.needsReview,
      reviewReason: classification.reviewReason ?? null
    });

    if (classification.needsReview) {
      addReview(reviewItems, {
        entityType: classification.entityType,
        entityId: postId,
        slug: postName,
        issue: classification.reviewReason ?? 'wordpress_item_needs_classification',
        source: 'wk_wordpress_items',
        recommendation: 'Classify as article, guide, app mount, utility page, taxonomy shell, commerce page, retire, or redirect.'
      });
    }
  }

  for (const genre of tables.wk_genres ?? []) {
    const raw = parseJson(genre.raw_meta);
    const entityId = String(raw?._wk_genre_registry_id ?? genre.id ?? genre.slug);
    const slug = safeSlug(genre.slug);
    if (!slug) continue;
    addSlug(slugs, {
      entityType: 'genre',
      entityId,
      slug,
      fullPath: `/genres/${slug}`,
      status: 'active',
      isPrimary: true,
      legacyPath: `/genres/${slug}`,
      source: 'wk_genres',
      needsReview: !genre.description,
      reviewReason: !genre.description ? 'genre_missing_description' : null
    });
  }

  const pathCounts = slugs.reduce<Record<string, number>>((acc, item) => {
    acc[item.fullPath] = (acc[item.fullPath] ?? 0) + 1;
    return acc;
  }, {});

  for (const item of slugs) {
    if (pathCounts[item.fullPath] > 1) {
      item.needsReview = true;
      item.reviewReason = item.reviewReason ?? 'route_conflict';
      addReview(reviewItems, {
        entityType: item.entityType,
        entityId: item.entityId,
        slug: item.slug,
        issue: 'route_conflict',
        source: item.source,
        recommendation: `Multiple entities map to ${item.fullPath}. Resolve canonical route or redirect.`
      });
    }
  }

  const coverage = {
    generatedAt: new Date().toISOString(),
    counts: {
      entitySlugs: slugs.length,
      reviewItems: reviewItems.length,
      active: slugs.filter((item) => item.status === 'active').length,
      review: slugs.filter((item) => item.status === 'review' || item.needsReview).length,
      routeConflicts: reviewItems.filter((item) => item.issue === 'route_conflict').length
    },
    entityTypes: slugs.reduce<Record<string, number>>((acc, item) => {
      acc[item.entityType] = (acc[item.entityType] ?? 0) + 1;
      return acc;
    }, {}),
    sources: slugs.reduce<Record<string, number>>((acc, item) => {
      acc[item.source] = (acc[item.source] ?? 0) + 1;
      return acc;
    }, {}),
    reviewIssueTypes: reviewItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.issue] = (acc[item.issue] ?? 0) + 1;
      return acc;
    }, {})
  };

  writeJson(path.join(reportDir, 'entity-slugs.seed.json'), slugs);
  writeJson(path.join(reportDir, 'route-review-queue.json'), reviewItems);
  writeJson(path.join(reportDir, 'route-coverage.json'), coverage);

  writeText(
    path.join(reportDir, 'route-summary.md'),
    [
      '# WAKILISHA Route and Slug Map',
      '',
      `Generated at: ${coverage.generatedAt}`,
      '',
      '## Counts',
      '',
      `- Entity slug rows: ${coverage.counts.entitySlugs}`,
      `- Active rows: ${coverage.counts.active}`,
      `- Rows needing review: ${coverage.counts.review}`,
      `- Route conflicts: ${coverage.counts.routeConflicts}`,
      `- Review items: ${coverage.counts.reviewItems}`,
      '',
      '## Entity types',
      '',
      ...Object.entries(coverage.entityTypes).map(([type, count]) => `- ${type}: ${count}`),
      '',
      '## Sources',
      '',
      ...Object.entries(coverage.sources).map(([source, count]) => `- ${source}: ${count}`),
      '',
      '## Review issue types',
      '',
      ...Object.entries(coverage.reviewIssueTypes).map(([issue, count]) => `- ${issue}: ${count}`),
      ''
    ].join('\n')
  );

  return coverage;
}
