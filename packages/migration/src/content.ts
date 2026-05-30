import path from 'node:path';
import { ensureDir, writeJson, writeText } from './csv.js';
import type { ExpectedTable } from './config.js';
import type { ContentClassification } from './types.js';

export type ContentRow = {
  legacy_wp_post_id: string;
  legacy_post_type: string;
  slug: string;
  title: string;
  classification: string;
  react_route?: string;
  migration_action: string;
  needs_review: boolean;
  review_reason?: string;
  source_payload?: unknown;
};

export function classifyContent(
  tables: Partial<Record<ExpectedTable, Record<string, string>[]>>
): {
  classifications: ContentRow[];
  coverage: ContentClassification;
} {
  const classifications: ContentRow[] = [];

  const articles = tables.wk_articles ?? [];
  const guides = tables.wk_guides ?? [];
  const pageSurfaces = tables.wk_page_surfaces ?? [];
  const wordpressItems = tables.wk_wordpress_items ?? [];
  const oldRegistryRows = tables.wk_old_registry_rows ?? [];

  const seenSlugs = new Set<string>();

  for (const raw of articles) {
    const slug = String(raw.slug ?? raw.id ?? '').trim();
    const title = String(raw.title ?? raw.post_title ?? '').trim();
    if (!slug || seenSlugs.has(`article:${slug}`)) continue;
    seenSlugs.add(`article:${slug}`);

    const wpStatus = String(raw.wp_status ?? raw.post_status ?? '');
    const isPublished = wpStatus === 'publish';

    classifications.push({
      legacy_wp_post_id: String(raw.id ?? ''),
      legacy_post_type: 'post',
      slug,
      title,
      classification: 'article',
      react_route: isPublished ? `/magazine/${slug}/` : undefined,
      migration_action: isPublished ? 'migrate_to_article' : 'review_or_retire',
      needs_review: !isPublished,
      review_reason: !isPublished ? 'article_not_published' : undefined,
      source_payload: raw
    });
  }

  for (const raw of guides) {
    const slug = String(raw.slug ?? raw.id ?? '').trim();
    const title = String(raw.title ?? raw.post_title ?? '').trim();
    if (!slug || seenSlugs.has(`guide:${slug}`)) continue;
    seenSlugs.add(`guide:${slug}`);

    const wpStatus = String(raw.wp_status ?? raw.post_status ?? '');
    const isPublished = wpStatus === 'publish';

    classifications.push({
      legacy_wp_post_id: String(raw.id ?? ''),
      legacy_post_type: 'wk_field_guide',
      slug,
      title,
      classification: 'guide',
      react_route: isPublished ? `/guides/${slug}/` : undefined,
      migration_action: isPublished ? 'migrate_to_guide' : 'review_or_retire',
      needs_review: !isPublished,
      review_reason: !isPublished ? 'guide_not_published' : undefined,
      source_payload: raw
    });
  }

  for (const raw of pageSurfaces) {
    const slug = String(raw.slug ?? raw.id ?? '').trim();
    const title = String(raw.title ?? raw.post_title ?? '').trim();
    if (!slug || seenSlugs.has(`surface:${slug}`)) continue;
    seenSlugs.add(`surface:${slug}`);

    const wpStatus = String(raw.wp_status ?? raw.post_status ?? '');
    const isPublished = wpStatus === 'publish';

    let classification = 'surface_page';
    let reactRoute: string | undefined;
    let migrationAction = 'migrate_to_surface';
    let needsReview = !isPublished;
    let reviewReason: string | undefined;

    if (slug === 'home' || slug === 'front-page') {
      classification = 'app_mount';
      reactRoute = '/';
      migrationAction = 'mount_as_app';
      needsReview = false;
    } else if (slug.includes('play') || slug.includes('top10') || slug.includes('top-10')) {
      classification = 'app_mount';
      reactRoute = `/${slug}/`;
      migrationAction = 'mount_as_app';
      needsReview = false;
    } else if (slug.includes('shop') || slug.includes('cart') || slug.includes('checkout')) {
      classification = 'commerce_page';
      migrationAction = 'review_commerce_scope';
      needsReview = true;
      reviewReason = 'commerce_page_needs_decision';
    } else if (slug.includes('methodology') || slug.includes('about') || slug.includes('contact') || slug.includes('faq') || slug.includes('privacy')) {
      classification = 'utility_page';
      reactRoute = `/${slug}/`;
      migrationAction = 'migrate_to_utility_page';
      needsReview = false;
    } else if (slug.includes('correction')) {
      classification = 'utility_page';
      reactRoute = `/corrections/`;
      migrationAction = 'migrate_to_utility_page';
      needsReview = false;
    } else if (slug.includes('registry') || slug.includes('canvas')) {
      classification = 'app_mount';
      reactRoute = `/registry/`;
      migrationAction = 'mount_as_app';
      needsReview = false;
    } else if (slug.includes('settings') || slug.includes('profile')) {
      classification = 'app_mount';
      migrationAction = 'mount_as_app';
      needsReview = true;
      reviewReason = 'user_account_page_needs_auth';
    } else if (!isPublished) {
      classification = 'review';
      migrationAction = 'review_or_retire';
      reviewReason = 'surface_page_not_published';
    }

    classifications.push({
      legacy_wp_post_id: String(raw.id ?? ''),
      legacy_post_type: 'page',
      slug,
      title,
      classification,
      react_route: reactRoute,
      migration_action: migrationAction,
      needs_review: needsReview,
      review_reason: reviewReason,
      source_payload: raw
    });
  }

  for (const raw of wordpressItems) {
    const postType = String(raw.post_type ?? '').trim();
    const slug = String(raw.post_name ?? '').trim();
    const title = String(raw.post_title ?? '').trim();
    const postStatus = String(raw.post_status ?? '').trim();
    if (!slug || seenSlugs.has(`${postType}:${slug}`)) continue;
    seenSlugs.add(`${postType}:${slug}`);

    const isPublished = postStatus === 'publish';

    let classification = 'surface_page';
    let reactRoute: string | undefined;
    let migrationAction = 'migrate_to_surface';
    let needsReview = !isPublished;
    let reviewReason: string | undefined;

    switch (postType) {
      case 'post':
        classification = 'article';
        reactRoute = isPublished ? `/magazine/${slug}/` : undefined;
        migrationAction = 'migrate_to_article';
        break;
      case 'wk_field_guide':
        classification = 'guide';
        reactRoute = isPublished ? `/guides/${slug}/` : undefined;
        migrationAction = 'migrate_to_guide';
        break;
      case 'wakilisha_artist':
        classification = 'taxonomy_shell';
        reactRoute = `/artists/${slug}/`;
        migrationAction = 'redirect_to_registry';
        needsReview = false;
        break;
      case 'wk_genre_page':
        classification = 'taxonomy_shell';
        reactRoute = `/genres/${slug}/`;
        migrationAction = 'redirect_to_registry';
        needsReview = false;
        break;
      case 'wk_chart_edition':
      case 'wk_chart_series':
        classification = 'app_mount';
        migrationAction = 'mount_as_app';
        needsReview = false;
        break;
      case 'wk_magazine_surface':
        classification = 'surface_page';
        reactRoute = `/magazine/`;
        migrationAction = 'mount_as_app';
        needsReview = false;
        break;
      case 'wk_top10_surface':
      case 'wk_play_surface':
      case 'wk_settings_surface':
      case 'wk_profile_surface':
      case 'wk_registry_track':
      case 'wk_registry_release':
      case 'wk_labels_surface':
        classification = 'app_mount';
        migrationAction = 'mount_as_app';
        needsReview = true;
        reviewReason = 'app_mount_needs_ui_decision';
        break;
      case 'wk_correction_page':
        classification = 'utility_page';
        reactRoute = `/corrections/`;
        migrationAction = 'migrate_to_utility_page';
        needsReview = false;
        break;
      case 'page':
        if (slug === 'home') {
          classification = 'app_mount';
          reactRoute = '/';
          migrationAction = 'mount_as_app';
          needsReview = false;
        } else if (slug.includes('methodology') || slug.includes('about') || slug.includes('contact') || slug.includes('faq') || slug.includes('privacy')) {
          classification = 'utility_page';
          reactRoute = `/${slug}/`;
          migrationAction = 'migrate_to_utility_page';
          needsReview = false;
        }
        break;
      default:
        classification = 'review';
        migrationAction = 'review_or_retire';
        needsReview = true;
        reviewReason = `unknown_post_type_${postType}`;
    }

    classifications.push({
      legacy_wp_post_id: String(raw.id ?? ''),
      legacy_post_type: postType,
      slug,
      title,
      classification,
      react_route: reactRoute,
      migration_action: migrationAction,
      needs_review: needsReview,
      review_reason: reviewReason,
      source_payload: raw
    });
  }

  for (const raw of oldRegistryRows) {
    const sourceTable = raw.source_table ?? '';
    if (sourceTable !== 'wp_posts' && !sourceTable.includes('wp_wk')) continue;

    let data: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(raw.row_data ?? '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        data = parsed as Record<string, unknown>;
      }
    } catch {
      continue;
    }

    const postType = String(data.post_type ?? '').trim();
    const slug = String(data.post_name ?? data.slug ?? '').trim();
    if (!slug || seenSlugs.has(`registry:${slug}`)) continue;
    seenSlugs.add(`registry:${slug}`);

    let classification = 'review';
    let migrationAction = 'review_or_retire';
    let needsReview = true;
    let reviewReason = 'from_old_registry_unclear';

    if (postType === 'post') {
      classification = 'article';
      migrationAction = 'migrate_to_article';
      needsReview = false;
    } else if (postType === 'page') {
      classification = 'surface_page';
      migrationAction = 'migrate_to_surface';
      needsReview = false;
    } else if (postType === 'wk_field_guide') {
      classification = 'guide';
      migrationAction = 'migrate_to_guide';
      needsReview = false;
    }

    classifications.push({
      legacy_wp_post_id: String(data.ID ?? data.id ?? ''),
      legacy_post_type: postType,
      slug,
      title: String(data.post_title ?? data.title ?? '').trim(),
      classification,
      migration_action: migrationAction,
      needs_review: needsReview,
      review_reason: reviewReason,
      source_payload: data
    });
  }

  const coverage: ContentClassification = {
    total: classifications.length,
    articles: classifications.filter((c) => c.classification === 'article').length,
    guides: classifications.filter((c) => c.classification === 'guide').length,
    surfacePages: classifications.filter((c) => c.classification === 'surface_page').length,
    appMounts: classifications.filter((c) => c.classification === 'app_mount').length,
    taxonomyShells: classifications.filter((c) => c.classification === 'taxonomy_shell').length,
    utilityPages: classifications.filter((c) => c.classification === 'utility_page').length,
    commercePages: classifications.filter((c) => c.classification === 'commerce_page').length,
    retire: classifications.filter((c) => c.classification === 'retire').length,
    review: classifications.filter((c) => c.classification === 'review' || c.needs_review).length
  };

  return { classifications, coverage };
}

export function writeContentFiles(reportDir: string, data: ReturnType<typeof classifyContent>) {
  ensureDir(reportDir);
  writeJson(path.join(reportDir, 'content-classification.json'), data.classifications);
  writeJson(path.join(reportDir, 'content-coverage.json'), data.coverage);

  writeText(
    path.join(reportDir, 'content-classification.md'),
    [
      '# WAKILISHA Content Classification Report',
      '',
      `Generated at: ${new Date().toISOString()}`,
      '',
      '## Summary',
      '',
      `- Total content rows: ${data.coverage.total}`,
      `- Articles: ${data.coverage.articles}`,
      `- Guides: ${data.coverage.guides}`,
      `- Surface pages: ${data.coverage.surfacePages}`,
      `- App mounts: ${data.coverage.appMounts}`,
      `- Taxonomy shells: ${data.coverage.taxonomyShells}`,
      `- Utility pages: ${data.coverage.utilityPages}`,
      `- Commerce pages: ${data.coverage.commercePages}`,
      `- Retire: ${data.coverage.retire}`,
      `- Review needed: ${data.coverage.review}`,
      '',
      '## Migration actions',
      '',
      ...Object.entries(
        data.classifications.reduce<Record<string, number>>((acc, c) => {
          acc[c.migration_action] = (acc[c.migration_action] ?? 0) + 1;
          return acc;
        }, {})
      ).map(([action, count]) => `- ${action}: ${count}`),
      '',
      '## Sample classifications',
      '',
      ...data.classifications.slice(0, 15).map(
        (c) => `- [${c.classification}] ${c.slug}: ${c.title} (${c.migration_action})`
      ),
      ''
    ].join('\n')
  );
}