#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const CUTOVER_PLAN_PATH = 'reports/wordpress-cutover-redirect-plan.json';
const DIST_DIR = 'dist';
const REDIRECT_STATUS = 302;

const STATIC_ROUTE_POLICY = new Map([
  ['/account/', { target: '/account', policyDecision: 'product_decision_required', reason: 'Legacy account route needs auth/product confirmation before cutover.' }],
  ['/contacts/', { target: '/contact', policyDecision: 'redirect_candidate', reason: 'Legacy contacts page can map to React contact route if present.' }],
  ['/corrections/', { target: '/corrections', policyDecision: 'redirect_candidate', reason: 'Legacy corrections page can map to React corrections route if present.' }],
  ['/events/', { target: '/events', policyDecision: 'redirect_candidate', reason: 'Legacy events page can map to React events route if present.' }],
  ['/faq/', { target: '/faq', policyDecision: 'redirect_candidate', reason: 'Legacy FAQ page can map to React FAQ route if present.' }],
  ['/methodology/', { target: '/methodology', policyDecision: 'redirect_candidate', reason: 'Legacy methodology page can map to React methodology route if present.' }],
  ['/my-account/', { target: '/account', policyDecision: 'product_decision_required', reason: 'Legacy WooCommerce account route needs auth/product confirmation before cutover.' }],
  ['/my-library/', { target: '/library', policyDecision: 'product_decision_required', reason: 'Legacy user library route needs auth/product confirmation before cutover.' }],
  ['/my-top-10/', { target: '/my-top-10', policyDecision: 'product_decision_required', reason: 'Legacy user top 10 route needs auth/product confirmation before cutover.' }],
  ['/news-resources/', { target: '/magazine', policyDecision: 'redirect_candidate', reason: 'Legacy news resources page can map to React magazine route if present.' }],
  ['/order-tracking/', { target: '/account', policyDecision: 'product_decision_required', reason: 'Legacy WooCommerce order tracking route needs product decision before cutover.' }],
  ['/privacy-policy/', { target: '/privacy', policyDecision: 'redirect_candidate', reason: 'Legacy privacy policy can map to React privacy route if present.' }],
  ['/privacy/', { target: '/privacy', policyDecision: 'redirect_candidate', reason: 'Legacy privacy page can map to React privacy route if present.' }],
  ['/profile/', { target: '/profile', policyDecision: 'product_decision_required', reason: 'Legacy profile route needs auth/product confirmation before cutover.' }],
  ['/settings/', { target: '/settings', policyDecision: 'product_decision_required', reason: 'Legacy settings route needs auth/product confirmation before cutover.' }],
  ['/venues/', { target: '/venues', policyDecision: 'redirect_candidate', reason: 'Legacy venues page can map to React venues route if present.' }],
]);

function stripTrailingSlash(route) {
  if (!route || route === '/') return '/';
  return route.endsWith('/') ? route.slice(0, -1) : route;
}

function normalizeRoute(route) {
  if (!route) return '/';

  let next = String(route).trim();

  if (!next.startsWith('/')) next = `/${next}`;

  next = next.replace(/\/index\.html$/, '/');
  next = next.replace(/\.html$/, '');
  next = next.replace(/\/+/g, '/');

  return stripTrailingSlash(next);
}

async function walkHtml(dir) {
  const out = [];

  async function walk(current) {
    let entries = [];

    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        out.push(fullPath);
      }
    }
  }

  await walk(dir);
  return out.sort();
}

function distHtmlPathToRoute(filePath) {
  let relative = filePath.replace(/^dist\/?/, '');

  if (relative === 'index.html') return '/';

  relative = relative.replace(/\/index\.html$/, '');
  relative = relative.replace(/\.html$/, '');

  return normalizeRoute(`/${relative}`);
}

function parseAuthorRoute(route) {
  const match = String(route || '').match(/^\/author\/([^/]+)\/(?:page\/(\d+)\/)?$/);

  if (!match) return null;

  return {
    slug: match[1],
    page: match[2] ? Number(match[2]) : null,
    isPaginated: Boolean(match[2]),
  };
}

function countBy(items, keyOrFn) {
  const getValue = typeof keyOrFn === 'function' ? keyOrFn : (item) => item[keyOrFn];

  return items.reduce((acc, item) => {
    const value = getValue(item) || 'unknown';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function escapeCsv(value) {
  const str = String(value ?? '');

  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

function toCsv(items, columns) {
  const lines = [columns.join(',')];

  for (const item of items) {
    lines.push(columns.map((column) => escapeCsv(item[column])).join(','));
  }

  return `${lines.join('\n')}\n`;
}

function escapeMarkdownCell(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
    .trim();
}

function inferAuthorPolicy(blocker, reactRoutes) {
  const author = parseAuthorRoute(blocker.legacyPath);

  if (!author) {
    return {
      source: blocker.legacyPath,
      target: '',
      status: REDIRECT_STATUS,
      blockerType: blocker.blockerType,
      policyDecision: 'manual_review',
      confidence: 'low',
      reason: 'Author route did not match expected /author/<slug>/ shape.',
      legacyTitle: blocker.title || '',
      authorSlug: '',
      page: '',
      isPaginated: false,
      targetExists: false,
    };
  }

  const target = `/authors/${author.slug}`;
  const targetExists = reactRoutes.has(normalizeRoute(target));

  if (targetExists) {
    return {
      source: blocker.legacyPath,
      target,
      status: REDIRECT_STATUS,
      blockerType: blocker.blockerType,
      policyDecision: author.isPaginated ? 'redirect_to_canonical_author' : 'redirect_to_author',
      confidence: 'high',
      reason: author.isPaginated
        ? 'Paginated legacy author archive can collapse to matching React author route.'
        : 'Legacy author archive has a matching React author route.',
      legacyTitle: blocker.title || '',
      authorSlug: author.slug,
      page: author.page || '',
      isPaginated: author.isPaginated,
      targetExists,
    };
  }

  return {
    source: blocker.legacyPath,
    target,
    status: REDIRECT_STATUS,
    blockerType: blocker.blockerType,
    policyDecision: 'manual_review_author_mapping',
    confidence: 'low',
    reason: author.isPaginated
      ? 'Paginated legacy author archive has no confirmed matching React author route.'
      : 'Legacy author archive has no confirmed matching React author route. Confirm slug mapping or retire.',
    legacyTitle: blocker.title || '',
    authorSlug: author.slug,
    page: author.page || '',
    isPaginated: author.isPaginated,
    targetExists,
  };
}

function inferStaticPolicy(blocker, reactRoutes) {
  const policy = STATIC_ROUTE_POLICY.get(blocker.legacyPath);

  if (!policy) {
    return {
      source: blocker.legacyPath,
      target: blocker.targetPath || '',
      status: REDIRECT_STATUS,
      blockerType: blocker.blockerType,
      policyDecision: 'manual_review_static_route',
      confidence: 'low',
      reason: 'Static/account route has no explicit policy mapping.',
      legacyTitle: blocker.title || '',
      targetExists: false,
    };
  }

  const targetExists = reactRoutes.has(normalizeRoute(policy.target));

  if (policy.policyDecision === 'redirect_candidate') {
    if (targetExists) {
      return {
        source: blocker.legacyPath,
        target: policy.target,
        status: REDIRECT_STATUS,
        blockerType: blocker.blockerType,
        policyDecision: 'redirect_to_static_route',
        confidence: 'high',
        reason: 'Legacy static route has a matching React destination.',
        legacyTitle: blocker.title || '',
        targetExists,
      };
    }

    return {
      source: blocker.legacyPath,
      target: policy.target,
      status: REDIRECT_STATUS,
      blockerType: blocker.blockerType,
      policyDecision: 'manual_review_static_route',
      confidence: 'low',
      reason: `${policy.reason} Target route was not found in current React prerender output.`,
      legacyTitle: blocker.title || '',
      targetExists,
    };
  }

  return {
    source: blocker.legacyPath,
    target: policy.target,
    status: REDIRECT_STATUS,
    blockerType: blocker.blockerType,
    policyDecision: policy.policyDecision,
    confidence: targetExists ? 'medium' : 'low',
    reason: targetExists
      ? policy.reason
      : `${policy.reason} Target route was not found in current React prerender output.`,
    legacyTitle: blocker.title || '',
    targetExists,
  };
}

function markdownReport({ rows, authorRows, staticRows, redirects, manualReview, productDecision }) {
  const lines = [];

  lines.push('# WordPress Author + Static Route Cutover Policy');
  lines.push('');
  lines.push('This is a planning artifact only. Do not apply redirects until the final React/IP cutover rehearsal passes.');
  lines.push('');
  lines.push('Use 302 temporary redirects first. Do not use 301 until the new React surface has been observed in production.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total author/static blockers reviewed: ${rows.length}`);
  lines.push(`- Author archive rows: ${authorRows.length}`);
  lines.push(`- Static/account route rows: ${staticRows.length}`);
  lines.push(`- Redirect candidates: ${redirects.length}`);
  lines.push(`- Manual review rows: ${manualReview.length}`);
  lines.push(`- Product decision rows: ${productDecision.length}`);
  lines.push('');
  lines.push('## Decision counts');
  lines.push('');

  for (const [decision, count] of Object.entries(countBy(rows, 'policyDecision')).sort()) {
    lines.push(`- ${decision}: ${count}`);
  }

  lines.push('');
  lines.push('## Author route policy');
  lines.push('');
  lines.push('- `/author/<slug>/` can redirect to `/authors/<slug>` only when the React author route exists.');
  lines.push('- `/author/<slug>/page/<n>/` should collapse to the canonical `/authors/<slug>` only when the target exists.');
  lines.push('- If the React author route does not exist, the row must remain manual review because WordPress usernames may not match React author slugs.');
  lines.push('');
  lines.push('## Static/account route policy');
  lines.push('');
  lines.push('- Pure static pages can redirect to equivalent React routes only when the target exists.');
  lines.push('- Account, profile, settings, and WooCommerce account/order routes need product confirmation before redirecting.');
  lines.push('');
  lines.push('## Redirect candidates');
  lines.push('');
  lines.push('| Source | Target | Confidence | Reason |');
  lines.push('|---|---|---|---|');

  for (const item of redirects) {
    lines.push(
      `| \`${escapeMarkdownCell(item.source)}\` | \`${escapeMarkdownCell(item.target)}\` | ${escapeMarkdownCell(item.confidence)} | ${escapeMarkdownCell(item.reason)} |`
    );
  }

  lines.push('');
  lines.push('## Manual review');
  lines.push('');
  lines.push('| Source | Proposed target | Confidence | Reason |');
  lines.push('|---|---|---|---|');

  for (const item of manualReview) {
    lines.push(
      `| \`${escapeMarkdownCell(item.source)}\` | \`${escapeMarkdownCell(item.target)}\` | ${escapeMarkdownCell(item.confidence)} | ${escapeMarkdownCell(item.reason)} |`
    );
  }

  lines.push('');
  lines.push('## Product decision required');
  lines.push('');
  lines.push('| Source | Proposed target | Confidence | Reason |');
  lines.push('|---|---|---|---|');

  for (const item of productDecision) {
    lines.push(
      `| \`${escapeMarkdownCell(item.source)}\` | \`${escapeMarkdownCell(item.target)}\` | ${escapeMarkdownCell(item.confidence)} | ${escapeMarkdownCell(item.reason)} |`
    );
  }

  lines.push('');
  lines.push('## Media import boundary');
  lines.push('');
  lines.push('This plan is about URL routing only.');
  lines.push('');
  lines.push('Do not import provider-hosted artist images such as Spotify CDN images by default.');
  lines.push('');
  lines.push('Only old WordPress upload media under /wp-content/uploads/ belongs in the media mirror/rewrite workstream.');

  return `${lines.join('\n')}\n`;
}

function draftRedirectRules(redirects) {
  const lines = [];

  lines.push('# Draft author/static redirects');
  lines.push('# Do not apply before final cutover rehearsal.');
  lines.push('# Use 302 first. Do not use 301 yet.');
  lines.push('');

  for (const item of redirects) {
    lines.push(`${item.source} -> ${item.target} ${REDIRECT_STATUS}`);
  }

  return `${lines.join('\n')}\n`;
}

const cutoverPlan = JSON.parse(await fs.readFile(CUTOVER_PLAN_PATH, 'utf8'));
const htmlFiles = await walkHtml(DIST_DIR);
const reactRoutes = new Set(htmlFiles.map(distHtmlPathToRoute));

const authorBlockers = cutoverPlan.blockers.filter((item) => item.blockerType === 'author_archive');
const staticBlockers = cutoverPlan.blockers.filter((item) => item.blockerType === 'static_or_account_route');

const authorRows = authorBlockers.map((blocker) => inferAuthorPolicy(blocker, reactRoutes));
const staticRows = staticBlockers.map((blocker) => inferStaticPolicy(blocker, reactRoutes));

const rows = [...authorRows, ...staticRows];

const redirects = rows.filter((item) =>
  ['redirect_to_author', 'redirect_to_canonical_author', 'redirect_to_static_route'].includes(item.policyDecision)
);

const manualReview = rows.filter((item) =>
  ['manual_review', 'manual_review_author_mapping', 'manual_review_static_route'].includes(item.policyDecision)
);

const productDecision = rows.filter((item) => item.policyDecision === 'product_decision_required');

const output = {
  generatedAt: new Date().toISOString(),
  redirectStatus: REDIRECT_STATUS,
  reactRoutesFound: reactRoutes.size,
  summary: {
    total: rows.length,
    authorArchiveRows: authorRows.length,
    staticAccountRows: staticRows.length,
    redirectCandidates: redirects.length,
    manualReview: manualReview.length,
    productDecision: productDecision.length,
  },
  decisionCounts: countBy(rows, 'policyDecision'),
  rows,
  authorRows,
  staticRows,
  redirects,
  manualReview,
  productDecision,
};

await fs.writeFile('reports/wordpress-author-static-cutover-policy.json', `${JSON.stringify(output, null, 2)}\n`);

await fs.writeFile(
  'reports/wordpress-author-archive-policy.csv',
  toCsv(authorRows, [
    'source',
    'target',
    'status',
    'authorSlug',
    'isPaginated',
    'page',
    'targetExists',
    'policyDecision',
    'confidence',
    'reason',
    'legacyTitle',
  ])
);

await fs.writeFile(
  'reports/wordpress-static-route-policy.csv',
  toCsv(staticRows, [
    'source',
    'target',
    'status',
    'targetExists',
    'policyDecision',
    'confidence',
    'reason',
    'legacyTitle',
  ])
);

await fs.writeFile(
  'reports/wordpress-author-static-draft-redirect-rules.txt',
  draftRedirectRules(redirects)
);

await fs.writeFile(
  'reports/wordpress-author-static-cutover-policy.md',
  markdownReport({ rows, authorRows, staticRows, redirects, manualReview, productDecision })
);

console.log('Author/static cutover policy generated.');
console.log('');
console.log('React routes found:', reactRoutes.size);
console.log('');
console.log('Summary:');
console.log(output.summary);
console.log('');
console.log('Decision counts:');
console.log(output.decisionCounts);
console.log('');
console.log('Wrote reports/wordpress-author-static-cutover-policy.json');
console.log('Wrote reports/wordpress-author-static-cutover-policy.md');
console.log('Wrote reports/wordpress-author-archive-policy.csv');
console.log('Wrote reports/wordpress-static-route-policy.csv');
console.log('Wrote reports/wordpress-author-static-draft-redirect-rules.txt');
