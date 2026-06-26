#!/usr/bin/env node

import fs from 'node:fs/promises';

const CUTOVER_PLAN_PATH = 'reports/wordpress-cutover-redirect-plan.json';
const REDIRECT_STATUS = 302;

function decodeSlug(slug) {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

function normalizeTagLabel(slug) {
  return decodeSlug(slug)
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasSuspiciousEncoding(value) {
  return /%[0-9a-f]{2}/i.test(value);
}

function parseTagRoute(route) {
  const match = String(route || '').match(/^\/tag\/([^/]+)\/(?:page\/(\d+)\/)?$/);

  if (!match) return null;

  const slug = match[1];
  const page = match[2] ? Number(match[2]) : null;

  return {
    slug,
    decodedSlug: decodeSlug(slug),
    label: normalizeTagLabel(slug),
    page,
    isPaginated: Boolean(page),
    hasSuspiciousEncoding: hasSuspiciousEncoding(slug),
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

function tagSearchTarget(tag) {
  const query = encodeURIComponent(tag.decodedSlug.replace(/-/g, ' '));
  return `/search?tag=${query}`;
}

function classifyTagDecision(blocker, tag) {
  if (!tag) {
    return {
      policyDecision: 'manual_review',
      target: '',
      confidence: 'low',
      reason: 'Route did not match the expected /tag/<slug>/ shape.',
    };
  }

  if (tag.hasSuspiciousEncoding) {
    return {
      policyDecision: 'manual_review',
      target: tagSearchTarget(tag),
      confidence: 'low',
      reason: 'Encoded tag slug needs manual review before redirecting.',
    };
  }

  if (tag.isPaginated) {
    return {
      policyDecision: 'redirect_to_canonical_tag_search',
      target: tagSearchTarget(tag),
      confidence: 'medium',
      reason: 'Paginated WordPress tag archive should collapse to canonical tag search during cutover.',
    };
  }

  return {
    policyDecision: 'redirect_to_tag_search',
    target: tagSearchTarget(tag),
    confidence: 'medium',
    reason: 'Legacy WordPress tag archive can redirect to React search filtered by tag.',
  };
}

function markdownReport({ rows, redirects, manualReview, summary }) {
  const lines = [];

  lines.push('# WordPress Tag Archive Cutover Policy');
  lines.push('');
  lines.push('This is a planning artifact only. Do not apply redirects until the final React/IP cutover rehearsal passes.');
  lines.push('');
  lines.push('Use 302 temporary redirects first. Do not use 301 until the new React surface has been observed in production.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total tag archive blockers: ${summary.total}`);
  lines.push(`- Redirect candidates: ${summary.redirectCandidates}`);
  lines.push(`- Manual review rows: ${summary.manualReview}`);
  lines.push(`- Canonical tag archive rows: ${summary.canonical}`);
  lines.push(`- Paginated tag archive rows: ${summary.paginated}`);
  lines.push(`- Encoded/suspicious slug rows: ${summary.suspicious}`);
  lines.push('');
  lines.push('## Policy');
  lines.push('');
  lines.push('- `/tag/<slug>/` should redirect to `/search?tag=<slug label>` if the slug is clean.');
  lines.push('- `/tag/<slug>/page/<n>/` should collapse to the same canonical tag search URL.');
  lines.push('- Encoded or malformed slugs need manual review before redirecting.');
  lines.push('- Tag feeds are already ignored in the cutover plan and should not be treated as HTML route blockers.');
  lines.push('');
  lines.push('## Decision counts');
  lines.push('');

  for (const [decision, count] of Object.entries(countBy(rows, 'policyDecision')).sort()) {
    lines.push(`- ${decision}: ${count}`);
  }

  lines.push('');
  lines.push('## Redirect candidates preview');
  lines.push('');
  lines.push('| Source | Target | Confidence | Reason |');
  lines.push('|---|---|---|---|');

  for (const item of redirects.slice(0, 80)) {
    lines.push(
      `| \`${escapeMarkdownCell(item.source)}\` | \`${escapeMarkdownCell(item.target)}\` | ${escapeMarkdownCell(item.confidence)} | ${escapeMarkdownCell(item.reason)} |`
    );
  }

  if (redirects.length > 80) {
    lines.push(`| ... | ... | ... | ${redirects.length - 80} more redirect candidates in CSV/JSON |`);
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

  lines.push('# Draft tag archive redirects');
  lines.push('# Do not apply before final cutover rehearsal.');
  lines.push('# Use 302 first. Do not use 301 yet.');
  lines.push('');

  for (const item of redirects) {
    lines.push(`${item.source} -> ${item.target} ${REDIRECT_STATUS}`);
  }

  return `${lines.join('\n')}\n`;
}

const cutoverPlan = JSON.parse(await fs.readFile(CUTOVER_PLAN_PATH, 'utf8'));

const tagBlockers = cutoverPlan.blockers.filter((item) => item.blockerType === 'tag_archive');

const rows = tagBlockers.map((blocker) => {
  const tag = parseTagRoute(blocker.legacyPath);
  const decision = classifyTagDecision(blocker, tag);

  return {
    source: blocker.legacyPath,
    target: decision.target,
    status: REDIRECT_STATUS,
    tagSlug: tag?.slug || '',
    decodedTagSlug: tag?.decodedSlug || '',
    tagLabel: tag?.label || '',
    isPaginated: tag?.isPaginated || false,
    page: tag?.page || '',
    hasSuspiciousEncoding: tag?.hasSuspiciousEncoding || false,
    policyDecision: decision.policyDecision,
    confidence: decision.confidence,
    reason: decision.reason,
    title: blocker.title || '',
  };
});

const redirects = rows.filter((item) =>
  ['redirect_to_tag_search', 'redirect_to_canonical_tag_search'].includes(item.policyDecision)
);

const manualReview = rows.filter((item) => item.policyDecision === 'manual_review');

const summary = {
  total: rows.length,
  redirectCandidates: redirects.length,
  manualReview: manualReview.length,
  canonical: rows.filter((item) => !item.isPaginated).length,
  paginated: rows.filter((item) => item.isPaginated).length,
  suspicious: rows.filter((item) => item.hasSuspiciousEncoding).length,
};

const output = {
  generatedAt: new Date().toISOString(),
  redirectStatus: REDIRECT_STATUS,
  summary,
  decisionCounts: countBy(rows, 'policyDecision'),
  redirects,
  manualReview,
  rows,
};

await fs.writeFile('reports/wordpress-tag-archive-cutover-policy.json', `${JSON.stringify(output, null, 2)}\n`);

await fs.writeFile(
  'reports/wordpress-tag-archive-redirect-candidates.csv',
  toCsv(redirects, [
    'source',
    'target',
    'status',
    'tagSlug',
    'decodedTagSlug',
    'tagLabel',
    'isPaginated',
    'page',
    'confidence',
    'reason',
    'title',
  ])
);

await fs.writeFile(
  'reports/wordpress-tag-archive-manual-review.csv',
  toCsv(manualReview, [
    'source',
    'target',
    'status',
    'tagSlug',
    'decodedTagSlug',
    'tagLabel',
    'isPaginated',
    'page',
    'hasSuspiciousEncoding',
    'confidence',
    'reason',
    'title',
  ])
);

await fs.writeFile(
  'reports/wordpress-tag-archive-draft-redirect-rules.txt',
  draftRedirectRules(redirects)
);

await fs.writeFile(
  'reports/wordpress-tag-archive-cutover-policy.md',
  markdownReport({ rows, redirects, manualReview, summary })
);

console.log('Tag archive cutover policy generated.');
console.log('');
console.log('Summary:');
console.log(summary);
console.log('');
console.log('Decision counts:');
console.log(output.decisionCounts);
console.log('');
console.log('Wrote reports/wordpress-tag-archive-cutover-policy.json');
console.log('Wrote reports/wordpress-tag-archive-cutover-policy.md');
console.log('Wrote reports/wordpress-tag-archive-redirect-candidates.csv');
console.log('Wrote reports/wordpress-tag-archive-manual-review.csv');
console.log('Wrote reports/wordpress-tag-archive-draft-redirect-rules.txt');
