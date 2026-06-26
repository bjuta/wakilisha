#!/usr/bin/env node

import fs from 'node:fs/promises';

const PARITY_MAP_PATH = 'reports/wordpress-react-route-parity-map.json';

const TEMPORARY_REDIRECT_STATUS = 302;

const LEGACY_SECTION_ROUTES = new Set([
  '/album-reviews/',
  '/art/',
  '/art-design/',
  '/blog-newspaper/',
  '/film/',
  '/journal/',
  '/lifestyle/',
  '/literature/',
  '/literature/short-stories/',
  '/music/',
  '/opinion/',
  '/plan/',
  '/plan/archive/',
  '/science-and-technology/',
  '/short-stories/',
  '/sports/',
]);

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

function isRealRedirect(item) {
  return (
    item.targetPath &&
    item.legacyPath !== item.targetPath &&
    ['redirect_to_react_route', 'redirect_candidate'].includes(item.cutoverDecision)
  );
}

function classifyBlocker(item) {
  const path = item.legacyPath || '';
  const notes = item.notes || '';

  if (item.cutoverDecision === 'product_decision_required') {
    if (path === '/cart/' || path === '/checkout/') return 'woocommerce_dynamic_route';
    return 'product_decision_required';
  }

  if (path.startsWith('/author/')) return 'author_archive';
  if (path.startsWith('/tag/')) return 'tag_archive';
  if (path.startsWith('/charts/')) return 'chart_runtime_route';
  if (LEGACY_SECTION_ROUTES.has(path)) return 'legacy_section_archive';

  if (notes.includes('Known legacy static/account route')) {
    return 'static_or_account_route';
  }

  if (notes.includes('Likely legacy article/page slug')) {
    return 'legacy_article_missing_react_route';
  }

  if (notes.includes('No safe automatic mapping')) {
    return 'unclassified_manual_review';
  }

  return 'manual_review_other';
}

function decorateRedirect(item, status = TEMPORARY_REDIRECT_STATUS) {
  return {
    source: item.legacyPath,
    target: item.targetPath,
    status,
    decision: item.cutoverDecision,
    confidence: item.confidence,
    title: item.title,
    notes: item.notes,
  };
}

function markdownReport({ parityRows, safeRedirects, candidateRedirects, blockers, nativeRoutes, keepBlocked, intentional404, ignored }) {
  const decisionCounts = countBy(parityRows, 'cutoverDecision');
  const blockerCounts = countBy(blockers, (item) => item.blockerType);

  const lines = [];

  lines.push('# WordPress Cutover Redirect Plan');
  lines.push('');
  lines.push('This is a planning artifact only. Do not apply these redirects until the final React/IP cutover rehearsal passes.');
  lines.push('');
  lines.push('Use 302 temporary redirects first. Do not switch these to 301 until the new React surface has been observed in production and analytics/search behavior is stable.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total parity rows: ${parityRows.length}`);
  lines.push(`- Native React routes: ${nativeRoutes.length}`);
  lines.push(`- Safe 302 redirect rows: ${safeRedirects.length}`);
  lines.push(`- Candidate redirect rows needing confirmation: ${candidateRedirects.length}`);
  lines.push(`- Manual/product blockers: ${blockers.length}`);
  lines.push(`- Intentional 404 rows: ${intentional404.length}`);
  lines.push(`- Keep-blocked security rows: ${keepBlocked.length}`);
  lines.push(`- Ignored non-HTML/feed rows: ${ignored.length}`);
  lines.push('');
  lines.push('## Decision counts');
  lines.push('');

  for (const [decision, count] of Object.entries(decisionCounts).sort()) {
    lines.push(`- ${decision}: ${count}`);
  }

  lines.push('');
  lines.push('## Blocker buckets');
  lines.push('');

  for (const [type, count] of Object.entries(blockerCounts).sort()) {
    lines.push(`- ${type}: ${count}`);
  }

  lines.push('');
  lines.push('## Safe 302 redirects');
  lines.push('');
  lines.push('| Source | Target | Confidence | Notes |');
  lines.push('|---|---|---|---|');

  for (const item of safeRedirects) {
    lines.push(
      `| \`${escapeMarkdownCell(item.source)}\` | \`${escapeMarkdownCell(item.target)}\` | ${escapeMarkdownCell(item.confidence)} | ${escapeMarkdownCell(item.notes)} |`
    );
  }

  lines.push('');
  lines.push('## Candidate redirects needing confirmation');
  lines.push('');
  lines.push('| Source | Target | Confidence | Notes |');
  lines.push('|---|---|---|---|');

  for (const item of candidateRedirects) {
    lines.push(
      `| \`${escapeMarkdownCell(item.source)}\` | \`${escapeMarkdownCell(item.target)}\` | ${escapeMarkdownCell(item.confidence)} | ${escapeMarkdownCell(item.notes)} |`
    );
  }

  lines.push('');
  lines.push('## Cutover blockers');
  lines.push('');
  lines.push('| Blocker type | Legacy path | Proposed target | Decision | Notes |');
  lines.push('|---|---|---|---|---|');

  for (const item of blockers) {
    lines.push(
      `| ${escapeMarkdownCell(item.blockerType)} | \`${escapeMarkdownCell(item.legacyPath)}\` | ${escapeMarkdownCell(item.targetPath)} | ${escapeMarkdownCell(item.cutoverDecision)} | ${escapeMarkdownCell(item.notes)} |`
    );
  }

  lines.push('');
  lines.push('## Security endpoints');
  lines.push('');
  lines.push('These must remain blocked after cutover.');
  lines.push('');
  lines.push('| Path | Decision | Notes |');
  lines.push('|---|---|---|');

  for (const item of keepBlocked) {
    lines.push(
      `| \`${escapeMarkdownCell(item.legacyPath)}\` | ${escapeMarkdownCell(item.cutoverDecision)} | ${escapeMarkdownCell(item.notes)} |`
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

  lines.push('# Draft cutover redirects');
  lines.push('# Do not apply before final cutover rehearsal.');
  lines.push('# Use 302 first. Do not use 301 yet.');
  lines.push('');

  for (const item of redirects) {
    lines.push(`${item.source} -> ${item.target} ${item.status}`);
  }

  return `${lines.join('\n')}\n`;
}

const parityRows = JSON.parse(await fs.readFile(PARITY_MAP_PATH, 'utf8'));

const nativeRoutes = parityRows.filter((item) => item.cutoverDecision === 'native_react_route');
const keepBlocked = parityRows.filter((item) => item.cutoverDecision === 'keep_blocked');
const intentional404 = parityRows.filter((item) => item.cutoverDecision === 'intentional_404');
const ignored = parityRows.filter((item) => item.cutoverDecision === 'ignore_for_html_cutover');

const safeRedirects = parityRows
  .filter((item) => item.cutoverDecision === 'redirect_to_react_route')
  .filter(isRealRedirect)
  .map((item) => decorateRedirect(item));

const candidateRedirects = parityRows
  .filter((item) => item.cutoverDecision === 'redirect_candidate')
  .filter(isRealRedirect)
  .map((item) => decorateRedirect(item));

const blockers = parityRows
  .filter((item) => ['manual_review', 'product_decision_required'].includes(item.cutoverDecision))
  .map((item) => ({
    ...item,
    blockerType: classifyBlocker(item),
  }))
  .sort((a, b) => {
    const typeCompare = a.blockerType.localeCompare(b.blockerType);
    if (typeCompare !== 0) return typeCompare;
    return a.legacyPath.localeCompare(b.legacyPath);
  });

const plan = {
  generatedAt: new Date().toISOString(),
  redirectStatus: TEMPORARY_REDIRECT_STATUS,
  summary: {
    totalRows: parityRows.length,
    nativeRoutes: nativeRoutes.length,
    safeRedirects: safeRedirects.length,
    candidateRedirects: candidateRedirects.length,
    blockers: blockers.length,
    keepBlocked: keepBlocked.length,
    intentional404: intentional404.length,
    ignored: ignored.length,
  },
  decisionCounts: countBy(parityRows, 'cutoverDecision'),
  blockerCounts: countBy(blockers, (item) => item.blockerType),
  safeRedirects,
  candidateRedirects,
  blockers,
  nativeRoutes,
  keepBlocked,
  intentional404,
  ignored,
};

await fs.writeFile('reports/wordpress-cutover-redirect-plan.json', `${JSON.stringify(plan, null, 2)}\n`);

await fs.writeFile(
  'reports/wordpress-cutover-safe-redirects.csv',
  toCsv(safeRedirects, ['source', 'target', 'status', 'decision', 'confidence', 'title', 'notes'])
);

await fs.writeFile(
  'reports/wordpress-cutover-candidate-redirects.csv',
  toCsv(candidateRedirects, ['source', 'target', 'status', 'decision', 'confidence', 'title', 'notes'])
);

await fs.writeFile(
  'reports/wordpress-cutover-blockers.csv',
  toCsv(blockers, [
    'blockerType',
    'legacyPath',
    'legacyStatus',
    'auditClassification',
    'cutoverDecision',
    'targetPath',
    'confidence',
    'title',
    'notes',
  ])
);

await fs.writeFile(
  'reports/wordpress-cutover-redirect-plan.md',
  markdownReport({
    parityRows,
    safeRedirects,
    candidateRedirects,
    blockers,
    nativeRoutes,
    keepBlocked,
    intentional404,
    ignored,
  })
);

await fs.writeFile(
  'reports/wordpress-cutover-draft-redirect-rules.txt',
  draftRedirectRules([...safeRedirects, ...candidateRedirects])
);

console.log('Cutover redirect plan generated.');
console.log('');
console.log('Summary:');
console.log(plan.summary);
console.log('');
console.log('Decision counts:');
console.log(plan.decisionCounts);
console.log('');
console.log('Blocker counts:');
console.log(plan.blockerCounts);
console.log('');
console.log('Wrote reports/wordpress-cutover-redirect-plan.json');
console.log('Wrote reports/wordpress-cutover-redirect-plan.md');
console.log('Wrote reports/wordpress-cutover-safe-redirects.csv');
console.log('Wrote reports/wordpress-cutover-candidate-redirects.csv');
console.log('Wrote reports/wordpress-cutover-blockers.csv');
console.log('Wrote reports/wordpress-cutover-draft-redirect-rules.txt');
