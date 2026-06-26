#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const CUTOVER_PLAN_PATH = 'reports/wordpress-cutover-redirect-plan.json';
const DIST_DIR = 'dist';
const REDIRECT_STATUS = 302;

const REMAINING_BLOCKER_TYPES = new Set([
  'legacy_section_archive',
  'chart_runtime_route',
  'woocommerce_dynamic_route',
  'legacy_article_missing_react_route',
]);

const SECTION_POLICY = new Map([
  ['/album-reviews/', { target: '/magazine', reason: 'Legacy album reviews archive needs a React section/archive destination or retirement decision.' }],
  ['/art/', { target: '/magazine', reason: 'Legacy art archive needs a React section/archive destination or retirement decision.' }],
  ['/art-design/', { target: '/magazine', reason: 'Legacy art/design archive needs a React section/archive destination or retirement decision.' }],
  ['/blog-newspaper/', { target: '/magazine', reason: 'Legacy blog/newspaper archive needs a React section/archive destination or retirement decision.' }],
  ['/film/', { target: '/magazine', reason: 'Legacy film archive needs a React section/archive destination or retirement decision.' }],
  ['/journal/', { target: '/magazine', reason: 'Legacy journal archive needs a React section/archive destination or retirement decision.' }],
  ['/lifestyle/', { target: '/magazine', reason: 'Legacy lifestyle archive needs a React section/archive destination or retirement decision.' }],
  ['/literature/', { target: '/magazine', reason: 'Legacy literature archive needs a React section/archive destination or retirement decision.' }],
  ['/literature/short-stories/', { target: '/magazine', reason: 'Legacy nested short stories archive needs a React section/archive destination or retirement decision.' }],
  ['/music/', { target: '/music', reason: 'Legacy music archive needs a React music/archive destination or retirement decision.' }],
  ['/opinion/', { target: '/magazine', reason: 'Legacy opinion archive needs a React section/archive destination or retirement decision.' }],
  ['/plan/', { target: '/magazine', reason: 'Legacy plan route needs product decision: rebuild, redirect, or retire.' }],
  ['/plan/archive/', { target: '/magazine', reason: 'Legacy plan archive needs product decision: rebuild, redirect, or retire.' }],
  ['/science-and-technology/', { target: '/magazine', reason: 'Legacy science and technology archive needs a React section/archive destination or retirement decision.' }],
  ['/short-stories/', { target: '/magazine', reason: 'Legacy short stories archive needs a React section/archive destination or retirement decision.' }],
  ['/sports/', { target: '/magazine', reason: 'Legacy sports archive needs a React section/archive destination or retirement decision.' }],
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

function inferSectionPolicy(blocker, reactRoutes) {
  const policy = SECTION_POLICY.get(blocker.legacyPath);
  const target = policy?.target || blocker.targetPath || '';
  const targetExists = target ? reactRoutes.has(normalizeRoute(target)) : false;

  if (targetExists) {
    return {
      source: blocker.legacyPath,
      target,
      status: REDIRECT_STATUS,
      blockerType: blocker.blockerType,
      policyDecision: 'redirect_candidate',
      confidence: 'medium',
      reason: 'Legacy section archive has a matching React destination, but section/archive equivalence still needs product confirmation.',
      legacyTitle: blocker.title || '',
      targetExists,
    };
  }

  return {
    source: blocker.legacyPath,
    target,
    status: REDIRECT_STATUS,
    blockerType: blocker.blockerType,
    policyDecision: 'manual_review_section_archive',
    confidence: 'low',
    reason: `${policy?.reason || 'Legacy section archive needs a cutover decision.'} Target route was not found in current React prerender output.`,
    legacyTitle: blocker.title || '',
    targetExists,
  };
}

function inferChartPolicy(blocker, reactRoutes) {
  const target = blocker.targetPath || blocker.legacyPath;
  const targetExists = reactRoutes.has(normalizeRoute(target));

  return {
    source: blocker.legacyPath,
    target,
    status: REDIRECT_STATUS,
    blockerType: blocker.blockerType,
    policyDecision: targetExists ? 'native_chart_route' : 'runtime_verification_required',
    confidence: targetExists ? 'high' : 'medium',
    reason: targetExists
      ? 'Chart route exists in React prerender output.'
      : 'Chart route is likely handled by React runtime routing, but needs deployment-preview smoke testing before cutover.',
    legacyTitle: blocker.title || '',
    targetExists,
  };
}

function inferWooPolicy(blocker) {
  const target = blocker.legacyPath === '/checkout/' ? '/checkout' : '/cart';

  return {
    source: blocker.legacyPath,
    target,
    status: REDIRECT_STATUS,
    blockerType: blocker.blockerType,
    policyDecision: 'product_decision_required',
    confidence: 'high',
    reason: 'Legacy WooCommerce route. Decide whether to retire, rebuild, redirect to a non-commerce page, or preserve a legacy store path.',
    legacyTitle: blocker.title || '',
    targetExists: false,
  };
}

function inferMissingArticlePolicy(blocker, reactRoutes) {
  const target = blocker.targetPath || `/magazine/${normalizeRoute(blocker.legacyPath).slice(1)}`;
  const targetExists = reactRoutes.has(normalizeRoute(target));

  if (targetExists) {
    return {
      source: blocker.legacyPath,
      target,
      status: REDIRECT_STATUS,
      blockerType: blocker.blockerType,
      policyDecision: 'redirect_candidate',
      confidence: 'high',
      reason: 'Previously missing article now has a matching React route.',
      legacyTitle: blocker.title || '',
      targetExists,
    };
  }

  return {
    source: blocker.legacyPath,
    target,
    status: REDIRECT_STATUS,
    blockerType: blocker.blockerType,
    policyDecision: 'manual_review_missing_article',
    confidence: 'low',
    reason: 'Legacy article/page slug has no matching React route. Decide whether to import, redirect elsewhere, preserve static HTML, or intentionally 404.',
    legacyTitle: blocker.title || '',
    targetExists,
  };
}

function inferPolicy(blocker, reactRoutes) {
  switch (blocker.blockerType) {
    case 'legacy_section_archive':
      return inferSectionPolicy(blocker, reactRoutes);
    case 'chart_runtime_route':
      return inferChartPolicy(blocker, reactRoutes);
    case 'woocommerce_dynamic_route':
      return inferWooPolicy(blocker);
    case 'legacy_article_missing_react_route':
      return inferMissingArticlePolicy(blocker, reactRoutes);
    default:
      return {
        source: blocker.legacyPath,
        target: blocker.targetPath || '',
        status: REDIRECT_STATUS,
        blockerType: blocker.blockerType,
        policyDecision: 'manual_review',
        confidence: 'low',
        reason: 'Unhandled blocker type.',
        legacyTitle: blocker.title || '',
        targetExists: false,
      };
  }
}

function markdownReport({ rows, redirectCandidates, manualReview, productDecision, runtimeVerification }) {
  const lines = [];

  lines.push('# WordPress Remaining Blocker Cutover Policy');
  lines.push('');
  lines.push('This is a planning artifact only. Do not apply redirects until the final React/IP cutover rehearsal passes.');
  lines.push('');
  lines.push('Use 302 temporary redirects first. Do not use 301 until the new React surface has been observed in production.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total remaining blockers reviewed: ${rows.length}`);
  lines.push(`- Redirect candidates: ${redirectCandidates.length}`);
  lines.push(`- Manual review rows: ${manualReview.length}`);
  lines.push(`- Product decision rows: ${productDecision.length}`);
  lines.push(`- Runtime verification rows: ${runtimeVerification.length}`);
  lines.push('');
  lines.push('## Blocker type counts');
  lines.push('');

  for (const [type, count] of Object.entries(countBy(rows, 'blockerType')).sort()) {
    lines.push(`- ${type}: ${count}`);
  }

  lines.push('');
  lines.push('## Decision counts');
  lines.push('');

  for (const [decision, count] of Object.entries(countBy(rows, 'policyDecision')).sort()) {
    lines.push(`- ${decision}: ${count}`);
  }

  lines.push('');
  lines.push('## Redirect candidates');
  lines.push('');
  lines.push('| Source | Target | Confidence | Reason |');
  lines.push('|---|---|---|---|');

  for (const item of redirectCandidates) {
    lines.push(
      `| \`${escapeMarkdownCell(item.source)}\` | \`${escapeMarkdownCell(item.target)}\` | ${escapeMarkdownCell(item.confidence)} | ${escapeMarkdownCell(item.reason)} |`
    );
  }

  lines.push('');
  lines.push('## Runtime verification required');
  lines.push('');
  lines.push('| Source | Target | Confidence | Reason |');
  lines.push('|---|---|---|---|');

  for (const item of runtimeVerification) {
    lines.push(
      `| \`${escapeMarkdownCell(item.source)}\` | \`${escapeMarkdownCell(item.target)}\` | ${escapeMarkdownCell(item.confidence)} | ${escapeMarkdownCell(item.reason)} |`
    );
  }

  lines.push('');
  lines.push('## Manual review');
  lines.push('');
  lines.push('| Blocker type | Source | Proposed target | Confidence | Reason |');
  lines.push('|---|---|---|---|---|');

  for (const item of manualReview) {
    lines.push(
      `| ${escapeMarkdownCell(item.blockerType)} | \`${escapeMarkdownCell(item.source)}\` | \`${escapeMarkdownCell(item.target)}\` | ${escapeMarkdownCell(item.confidence)} | ${escapeMarkdownCell(item.reason)} |`
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

  lines.push('# Draft remaining blocker redirects');
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

const blockers = cutoverPlan.blockers
  .filter((item) => REMAINING_BLOCKER_TYPES.has(item.blockerType))
  .sort((a, b) => {
    const typeCompare = a.blockerType.localeCompare(b.blockerType);
    if (typeCompare !== 0) return typeCompare;
    return a.legacyPath.localeCompare(b.legacyPath);
  });

const rows = blockers.map((blocker) => inferPolicy(blocker, reactRoutes));

const redirectCandidates = rows.filter((item) => item.policyDecision === 'redirect_candidate');
const manualReview = rows.filter((item) =>
  ['manual_review', 'manual_review_section_archive', 'manual_review_missing_article'].includes(item.policyDecision)
);
const productDecision = rows.filter((item) => item.policyDecision === 'product_decision_required');
const runtimeVerification = rows.filter((item) => item.policyDecision === 'runtime_verification_required');

const output = {
  generatedAt: new Date().toISOString(),
  redirectStatus: REDIRECT_STATUS,
  reactRoutesFound: reactRoutes.size,
  summary: {
    total: rows.length,
    redirectCandidates: redirectCandidates.length,
    manualReview: manualReview.length,
    productDecision: productDecision.length,
    runtimeVerification: runtimeVerification.length,
  },
  blockerTypeCounts: countBy(rows, 'blockerType'),
  decisionCounts: countBy(rows, 'policyDecision'),
  rows,
  redirectCandidates,
  manualReview,
  productDecision,
  runtimeVerification,
};

await fs.writeFile('reports/wordpress-remaining-blocker-cutover-policy.json', `${JSON.stringify(output, null, 2)}\n`);

await fs.writeFile(
  'reports/wordpress-remaining-blocker-policy.csv',
  toCsv(rows, [
    'blockerType',
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
  'reports/wordpress-remaining-blocker-draft-redirect-rules.txt',
  draftRedirectRules(redirectCandidates)
);

await fs.writeFile(
  'reports/wordpress-remaining-blocker-cutover-policy.md',
  markdownReport({ rows, redirectCandidates, manualReview, productDecision, runtimeVerification })
);

console.log('Remaining blocker cutover policy generated.');
console.log('');
console.log('React routes found:', reactRoutes.size);
console.log('');
console.log('Summary:');
console.log(output.summary);
console.log('');
console.log('Blocker type counts:');
console.log(output.blockerTypeCounts);
console.log('');
console.log('Decision counts:');
console.log(output.decisionCounts);
console.log('');
console.log('Wrote reports/wordpress-remaining-blocker-cutover-policy.json');
console.log('Wrote reports/wordpress-remaining-blocker-cutover-policy.md');
console.log('Wrote reports/wordpress-remaining-blocker-policy.csv');
console.log('Wrote reports/wordpress-remaining-blocker-draft-redirect-rules.txt');
