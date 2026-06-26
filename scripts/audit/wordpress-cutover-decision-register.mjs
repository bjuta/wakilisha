#!/usr/bin/env node

import fs from 'node:fs/promises';

const INPUTS = {
  tagPolicy: 'reports/wordpress-tag-archive-cutover-policy.json',
  authorStaticPolicy: 'reports/wordpress-author-static-cutover-policy.json',
  remainingPolicy: 'reports/wordpress-remaining-blocker-cutover-policy.json',
  previewSmoke: 'reports/wordpress-react-preview-smoke-report.json',
  redirectBundle: 'reports/wordpress-temporary-redirect-bundle.json',
};

const OUTPUTS = {
  json: 'reports/wordpress-cutover-decision-register.json',
  csv: 'reports/wordpress-cutover-decision-register.csv',
  md: 'reports/wordpress-cutover-decision-register.md',
};

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function csvEscape(value) {
  const str = String(value ?? '');

  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

function toCsv(rows) {
  const columns = [
    'id',
    'sourceGroup',
    'ownerBucket',
    'cutoverRisk',
    'decisionStatus',
    'source',
    'proposedTarget',
    'recommendedAction',
    'reason',
    'evidence',
    'notes',
  ];

  const lines = [columns.join(',')];

  for (const row of rows) {
    lines.push(columns.map((column) => csvEscape(row[column])).join(','));
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

function countBy(items, keyOrFn) {
  const getValue = typeof keyOrFn === 'function' ? keyOrFn : (item) => item[keyOrFn];

  return items.reduce((acc, item) => {
    const value = getValue(item) || 'unknown';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function makeId(prefix, index) {
  return `${prefix}-${String(index + 1).padStart(3, '0')}`;
}

function isAuthorRoute(source) {
  return String(source || '').startsWith('/author/');
}

function isStaticProductRoute(source) {
  return [
    '/account/',
    '/my-account/',
    '/my-library/',
    '/my-top-10/',
    '/order-tracking/',
    '/settings/',
  ].includes(source);
}

function inferAuthorAction(row) {
  if (String(row.source || '').includes('/page/')) {
    return 'After parent author mapping is approved, collapse paginated archive to the canonical mapped author destination or retire with parent archive.';
  }

  if (row.source === '/author/admin/') {
    return 'Retire or redirect to /magazine after confirming this is not a real public author profile.';
  }

  return 'Map WordPress username slug to the correct React author slug, then approve a 302 redirect only after the target route exists.';
}

function inferStaticProductAction(row) {
  switch (row.source) {
    case '/account/':
    case '/my-account/':
      return 'Decide whether React account/auth replaces this route. If not ready, retire or redirect to the current sign-in/account destination after product approval.';
    case '/my-library/':
      return 'Decide whether user library exists in React. If not ready for cutover, retire or route to signed-in account area only after auth QA.';
    case '/my-top-10/':
      return 'Decide whether this user feature exists in React. If not, retire or preserve as intentional 404.';
    case '/order-tracking/':
      return 'Retire WooCommerce order tracking unless a replacement commerce/order feature exists.';
    case '/settings/':
      return 'Decide whether React user settings replaces this route. If not ready, keep blocked or route to account after auth QA.';
    default:
      return 'Product decision required before redirecting this route.';
  }
}

function inferSectionAction(row) {
  switch (row.source) {
    case '/music/':
      return 'Decide whether to rebuild a public music archive or redirect to the closest React culture/music surface.';
    case '/plan/':
    case '/plan/archive/':
      return 'Decide whether this old product/editorial route should be rebuilt, redirected to magazine, or intentionally retired.';
    default:
      return 'Decide whether to rebuild this section archive, redirect to /magazine with a future section filter, or intentionally retire it.';
  }
}

function buildTagRows(tagPolicy) {
  return (tagPolicy.manualReview || []).map((row, index) => ({
    id: makeId('TAG-MANUAL', index),
    sourceGroup: 'malformed_tag_route',
    ownerBucket: 'SEO/content',
    cutoverRisk: 'low',
    decisionStatus: 'needs_decision',
    source: row.source,
    proposedTarget: row.target,
    recommendedAction: 'Retire, fix the encoded slug, or manually map to a clean /search?tag=... target. Do not bulk-redirect malformed encoded slugs blindly.',
    reason: row.reason || 'Encoded tag slug needs manual review before redirecting.',
    evidence: 'reports/wordpress-tag-archive-cutover-policy.json',
    notes: '',
  }));
}

function buildAuthorStaticRows(authorStaticPolicy) {
  const manualRows = (authorStaticPolicy.manualReview || []).map((row, index) => {
    const authorRoute = isAuthorRoute(row.source);

    return {
      id: makeId(authorRoute ? 'AUTHOR' : 'STATIC-MANUAL', index),
      sourceGroup: authorRoute ? 'author_archive' : 'static_route',
      ownerBucket: authorRoute ? 'Content/SEO' : 'Product',
      cutoverRisk: authorRoute ? 'medium' : 'medium',
      decisionStatus: 'needs_decision',
      source: row.source,
      proposedTarget: row.target,
      recommendedAction: authorRoute
        ? inferAuthorAction(row)
        : 'Confirm whether this static route should be rebuilt, redirected to the closest React destination, or intentionally retired.',
      reason: row.reason,
      evidence: 'reports/wordpress-author-static-cutover-policy.json',
      notes: '',
    };
  });

  const productRows = (authorStaticPolicy.productDecision || []).map((row, index) => ({
    id: makeId('AUTH-PRODUCT', index),
    sourceGroup: isStaticProductRoute(row.source) ? 'account_or_user_route' : 'static_product_route',
    ownerBucket: 'Product/auth',
    cutoverRisk: 'high',
    decisionStatus: 'needs_product_decision',
    source: row.source,
    proposedTarget: row.target,
    recommendedAction: inferStaticProductAction(row),
    reason: row.reason,
    evidence: 'reports/wordpress-author-static-cutover-policy.json',
    notes: '',
  }));

  return [...manualRows, ...productRows];
}

function buildRemainingRows(remainingPolicy, previewSmoke) {
  const manualRows = (remainingPolicy.manualReview || []).map((row, index) => {
    const isMissingArticle = row.blockerType === 'legacy_article_missing_react_route';

    return {
      id: makeId(isMissingArticle ? 'MISSING-ARTICLE' : 'SECTION', index),
      sourceGroup: row.blockerType,
      ownerBucket: isMissingArticle ? 'Content/SEO' : 'Product/content',
      cutoverRisk: isMissingArticle ? 'medium' : 'medium',
      decisionStatus: isMissingArticle ? 'needs_content_decision' : 'needs_product_decision',
      source: row.source,
      proposedTarget: row.target,
      recommendedAction: isMissingArticle
        ? 'Import the missing page/article, redirect it to the closest relevant React destination, preserve static HTML, or intentionally 404 it.'
        : inferSectionAction(row),
      reason: row.reason,
      evidence: 'reports/wordpress-remaining-blocker-cutover-policy.json',
      notes: '',
    };
  });

  const productRows = (remainingPolicy.productDecision || []).map((row, index) => ({
    id: makeId('WOO', index),
    sourceGroup: 'woocommerce_route',
    ownerBucket: 'Product/business',
    cutoverRisk: 'high',
    decisionStatus: 'needs_product_decision',
    source: row.source,
    proposedTarget: row.target,
    recommendedAction: 'Decide whether to retire WooCommerce, rebuild commerce, redirect to a non-commerce destination, or preserve a legacy store path. Do not redirect blindly.',
    reason: row.reason,
    evidence: 'reports/wordpress-remaining-blocker-cutover-policy.json',
    notes: '',
  }));

  const smokeRows = new Map(
    (previewSmoke.rows || [])
      .filter((row) => row.group === 'chart_runtime_route')
      .map((row) => [row.route, row])
  );

  const runtimeRows = (remainingPolicy.runtimeVerification || []).map((row, index) => {
    const smoke = smokeRows.get(row.target);
    const smokePassed = smoke?.passed === true;

    return {
      id: makeId('CHART-RUNTIME', index),
      sourceGroup: 'chart_runtime_route',
      ownerBucket: 'QA/product',
      cutoverRisk: smokePassed ? 'low' : 'medium',
      decisionStatus: smokePassed ? 'preview_smoke_passed_browser_qa_needed' : 'preview_smoke_needed',
      source: row.source,
      proposedTarget: row.target,
      recommendedAction: smokePassed
        ? 'Run browser QA for chart data rendering on preview/cutover origin. HTML shell smoke has passed.'
        : 'Run preview smoke and browser QA before cutover.',
      reason: row.reason,
      evidence: smokePassed
        ? 'reports/wordpress-react-preview-smoke-report.json'
        : 'reports/wordpress-remaining-blocker-cutover-policy.json',
      notes: smokePassed ? `Preview smoke passed with status ${smoke.status}.` : '',
    };
  });

  return [...manualRows, ...productRows, ...runtimeRows];
}

function markdownReport({ rows, inputStatus, summary }) {
  const lines = [];

  lines.push('# WordPress Cutover Decision Register');
  lines.push('');
  lines.push('This register collects every unresolved cutover decision that is not part of the already validated temporary redirect bundle.');
  lines.push('');
  lines.push('This file does not approve DNS, Cloudflare, Supabase, frontend deploy, or production redirect changes.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total decision rows: ${summary.total}`);
  lines.push(`- Needs decision: ${summary.needsDecision}`);
  lines.push(`- Needs product decision: ${summary.needsProductDecision}`);
  lines.push(`- Needs content decision: ${summary.needsContentDecision}`);
  lines.push(`- Preview smoke passed, browser QA needed: ${summary.previewSmokePassedBrowserQaNeeded}`);
  lines.push(`- High-risk rows: ${summary.highRisk}`);
  lines.push(`- Medium-risk rows: ${summary.mediumRisk}`);
  lines.push(`- Low-risk rows: ${summary.lowRisk}`);
  lines.push('');
  lines.push('## Input reports');
  lines.push('');
  lines.push('| Input | Present |');
  lines.push('|---|---|');

  for (const [name, present] of Object.entries(inputStatus)) {
    lines.push(`| ${escapeMarkdownCell(name)} | ${present ? 'yes' : 'no'} |`);
  }

  lines.push('');
  lines.push('## Owner bucket counts');
  lines.push('');

  for (const [owner, count] of Object.entries(countBy(rows, 'ownerBucket')).sort()) {
    lines.push(`- ${owner}: ${count}`);
  }

  lines.push('');
  lines.push('## Source group counts');
  lines.push('');

  for (const [group, count] of Object.entries(countBy(rows, 'sourceGroup')).sort()) {
    lines.push(`- ${group}: ${count}`);
  }

  lines.push('');
  lines.push('## Decision rows');
  lines.push('');
  lines.push('| ID | Group | Owner | Risk | Status | Source | Proposed target | Recommended action |');
  lines.push('|---|---|---|---|---|---|---|---|');

  for (const row of rows) {
    lines.push(
      `| ${escapeMarkdownCell(row.id)} | ${escapeMarkdownCell(row.sourceGroup)} | ${escapeMarkdownCell(row.ownerBucket)} | ${escapeMarkdownCell(row.cutoverRisk)} | ${escapeMarkdownCell(row.decisionStatus)} | \`${escapeMarkdownCell(row.source)}\` | \`${escapeMarkdownCell(row.proposedTarget)}\` | ${escapeMarkdownCell(row.recommendedAction)} |`
    );
  }

  lines.push('');
  lines.push('## Cutover interpretation');
  lines.push('');
  lines.push('- The 1,171-row temporary redirect bundle is validated separately.');
  lines.push('- These rows are excluded from automatic redirects until product/content/QA decisions are made.');
  lines.push('- Chart runtime routes have passed HTML-shell preview smoke but still need browser QA for data rendering.');
  lines.push('- Author routes must not be bulk-redirected until WordPress username slugs are mapped to React author slugs.');
  lines.push('- WooCommerce/account routes are high risk because they can affect user expectations and auth/commercial behavior.');
  lines.push('');
  lines.push('## Deployment checklist');
  lines.push('');
  lines.push('```text');
  lines.push('SQL migration needed: No');
  lines.push('Supabase Edge Function deploy needed: No');
  lines.push('Readdy Finish update needed: No');
  lines.push('Frontend deploy needed: No');
  lines.push('Cloudflare/DNS change needed: No');
  lines.push('This is a decision-planning artifact only.');
  lines.push('```');

  return `${lines.join('\n')}\n`;
}

const tagPolicy = await readJson(INPUTS.tagPolicy);
const authorStaticPolicy = await readJson(INPUTS.authorStaticPolicy);
const remainingPolicy = await readJson(INPUTS.remainingPolicy);
const previewSmoke = await readJson(INPUTS.previewSmoke);

const inputStatus = {
  [INPUTS.tagPolicy]: await exists(INPUTS.tagPolicy),
  [INPUTS.authorStaticPolicy]: await exists(INPUTS.authorStaticPolicy),
  [INPUTS.remainingPolicy]: await exists(INPUTS.remainingPolicy),
  [INPUTS.previewSmoke]: await exists(INPUTS.previewSmoke),
  [INPUTS.redirectBundle]: await exists(INPUTS.redirectBundle),
};

const rows = [
  ...buildTagRows(tagPolicy),
  ...buildAuthorStaticRows(authorStaticPolicy),
  ...buildRemainingRows(remainingPolicy, previewSmoke),
];

const summary = {
  total: rows.length,
  needsDecision: rows.filter((row) => row.decisionStatus === 'needs_decision').length,
  needsProductDecision: rows.filter((row) => row.decisionStatus === 'needs_product_decision').length,
  needsContentDecision: rows.filter((row) => row.decisionStatus === 'needs_content_decision').length,
  previewSmokePassedBrowserQaNeeded: rows.filter((row) => row.decisionStatus === 'preview_smoke_passed_browser_qa_needed').length,
  highRisk: rows.filter((row) => row.cutoverRisk === 'high').length,
  mediumRisk: rows.filter((row) => row.cutoverRisk === 'medium').length,
  lowRisk: rows.filter((row) => row.cutoverRisk === 'low').length,
};

const output = {
  generatedAt: new Date().toISOString(),
  inputStatus,
  summary,
  ownerBucketCounts: countBy(rows, 'ownerBucket'),
  sourceGroupCounts: countBy(rows, 'sourceGroup'),
  decisionStatusCounts: countBy(rows, 'decisionStatus'),
  riskCounts: countBy(rows, 'cutoverRisk'),
  rows,
};

await fs.writeFile(OUTPUTS.json, `${JSON.stringify(output, null, 2)}\n`);
await fs.writeFile(OUTPUTS.csv, toCsv(rows));
await fs.writeFile(OUTPUTS.md, markdownReport({ rows, inputStatus, summary }));

console.log('WordPress cutover decision register generated.');
console.log('');
console.log('Summary:');
console.log(summary);
console.log('');
console.log('Decision status counts:');
console.log(output.decisionStatusCounts);
console.log('');
console.log('Owner bucket counts:');
console.log(output.ownerBucketCounts);
console.log('');
console.log(`Wrote ${OUTPUTS.json}`);
console.log(`Wrote ${OUTPUTS.csv}`);
console.log(`Wrote ${OUTPUTS.md}`);
