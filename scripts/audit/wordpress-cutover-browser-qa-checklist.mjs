#!/usr/bin/env node

import fs from 'node:fs/promises';

const PREVIEW_ORIGIN_PLACEHOLDER = '<REACT_PREVIEW_OR_CUTOVER_ORIGIN>';

const INPUTS = {
  previewSmoke: 'reports/wordpress-react-preview-smoke-report.json',
  decisionResolution: 'reports/wordpress-cutover-decision-resolution-plan.json',
  redirectBundle: 'reports/wordpress-temporary-redirect-bundle.json',
  rehearsalChecklist: 'reports/wordpress-cutover-rehearsal-checklist.json',
};

const OUTPUTS = {
  json: 'reports/wordpress-cutover-browser-qa-checklist.json',
  csv: 'reports/wordpress-cutover-browser-qa-checklist.csv',
  md: 'reports/wordpress-cutover-browser-qa-checklist.md',
  urls: 'reports/wordpress-cutover-browser-qa-urls.txt',
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
    'category',
    'priority',
    'route',
    'url',
    'expectedResult',
    'failureMeans',
    'qaStatus',
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

function makeId(prefix, index) {
  return `${prefix}-${String(index + 1).padStart(3, '0')}`;
}

function toUrl(route) {
  return `${PREVIEW_ORIGIN_PLACEHOLDER}${route}`;
}

function uniqueByRoute(rows) {
  const seen = new Set();
  const out = [];

  for (const row of rows) {
    const key = `${row.category}:${row.route}`;

    if (seen.has(key)) continue;

    seen.add(key);
    out.push(row);
  }

  return out;
}

function buildCoreRows(previewSmoke) {
  return (previewSmoke.rows || [])
    .filter((row) => row.group === 'core_route')
    .map((row, index) => ({
      id: makeId('CORE', index),
      category: 'core_route',
      priority: 'critical',
      route: row.route,
      url: toUrl(row.route),
      expectedResult: 'React page loads, main UI renders, no blank screen, no console-blocking runtime error.',
      failureMeans: 'Core route is not ready for cutover.',
      qaStatus: 'pending',
      notes: `HTML smoke status: ${row.status}.`,
    }));
}

function buildChartRows(decisionResolution) {
  return (decisionResolution.rows || [])
    .filter((row) => row.resolution === 'browser_qa_required')
    .map((row, index) => ({
      id: makeId('CHART', index),
      category: 'chart_runtime_route',
      priority: 'critical',
      route: row.finalTarget || row.proposedTarget,
      url: toUrl(row.finalTarget || row.proposedTarget),
      expectedResult: 'Chart page loads in browser, chart title/date/country render, entries/data load, empty/error state is not shown unless expected.',
      failureMeans: 'Chart runtime route cannot be approved for cutover yet.',
      qaStatus: 'pending',
      notes: 'HTML shell smoke passed; browser must confirm client-side chart data rendering.',
    }));
}

function buildSampleRedirectRows(previewSmoke) {
  return (previewSmoke.rows || [])
    .filter((row) => row.group === 'sample_safe_redirect_target')
    .slice(0, 5)
    .map((row, index) => ({
      id: makeId('ARTICLE', index),
      category: 'sample_safe_redirect_target',
      priority: 'high',
      route: row.route,
      url: toUrl(row.route),
      expectedResult: 'Magazine/article page loads, title/content shell renders, no old WordPress upload/wp-json leak is visible.',
      failureMeans: 'Safe redirect target may not be safe to send legacy traffic to.',
      qaStatus: 'pending',
      notes: `HTML smoke status: ${row.status}.`,
    }));
}

function buildTagRows(previewSmoke) {
  return (previewSmoke.rows || [])
    .filter((row) => row.group === 'sample_tag_redirect_target')
    .slice(0, 5)
    .map((row, index) => ({
      id: makeId('TAG', index),
      category: 'sample_tag_search_target',
      priority: 'high',
      route: row.route,
      url: toUrl(row.route),
      expectedResult: 'Search page loads with tag query preserved; search UI does not crash or blank.',
      failureMeans: 'Tag archive redirect pattern needs revision before cutover.',
      qaStatus: 'pending',
      notes: `HTML smoke status: ${row.status}.`,
    }));
}

function buildExtraRedirectRows(decisionResolution) {
  return (decisionResolution.rows || [])
    .filter((row) => row.resolution === 'redirect_to_magazine')
    .slice(0, 3)
    .map((row, index) => ({
      id: makeId('EXTRA-REDIRECT', index),
      category: 'ready_extra_redirect_target',
      priority: 'medium',
      route: row.finalTarget,
      url: toUrl(row.finalTarget),
      expectedResult: 'Magazine landing route loads correctly as the fallback destination.',
      failureMeans: 'Ready extra redirects to /magazine should not be applied.',
      qaStatus: 'pending',
      notes: `Sample source: ${row.source}.`,
    }));
}

function buildApprovalGatedRows(decisionResolution) {
  return (decisionResolution.rows || [])
    .filter((row) => row.resolution === 'redirect_to_magazine_after_product_approval')
    .slice(0, 8)
    .map((row, index) => ({
      id: makeId('APPROVAL-GATED', index),
      category: 'approval_gated_redirect',
      priority: 'medium',
      route: row.source,
      url: `${PREVIEW_ORIGIN_PLACEHOLDER}${row.source}`,
      expectedResult: 'Do not approve automatically. Confirm product/content accepts redirecting this old section archive to /magazine.',
      failureMeans: 'Product/content decision is still open.',
      qaStatus: 'pending_product_approval',
      notes: `Proposed target after approval: ${row.finalTarget}.`,
    }));
}

function buildRetireRows(decisionResolution) {
  return (decisionResolution.rows || [])
    .filter((row) =>
      [
        'manual_content_decision_required',
        'manual_product_decision_required',
      ].includes(row.resolution)
    )
    .map((row, index) => ({
      id: makeId('HOLD', index),
      category: 'do_not_redirect_without_decision',
      priority: row.risk === 'high' ? 'critical' : 'high',
      route: row.source,
      url: `${PREVIEW_ORIGIN_PLACEHOLDER}${row.source}`,
      expectedResult: 'Do not add this route to redirect bundle unless a separate product/content decision approves it.',
      failureMeans: 'Route was accidentally treated as approved.',
      qaStatus: 'blocked_or_hold',
      notes: `${row.resolution}: ${row.reason}`,
    }));
}

function toUrls(rows) {
  const lines = [];

  lines.push('# WordPress cutover browser QA URLs');
  lines.push('# Replace <REACT_PREVIEW_OR_CUTOVER_ORIGIN> with the preview/cutover origin.');
  lines.push('# Example: https://preview.example.com');
  lines.push('');

  for (const row of rows) {
    lines.push(`# ${row.id} | ${row.category} | ${row.priority}`);
    lines.push(row.url);
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function markdownReport({ rows, summary, inputStatus }) {
  const lines = [];

  lines.push('# WordPress Cutover Browser QA Checklist');
  lines.push('');
  lines.push('This checklist is for browser verification before any DNS/IP cutover.');
  lines.push('');
  lines.push('It does not approve Cloudflare changes, DNS changes, Supabase deploys, frontend deploys, or production redirects.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total QA rows: ${summary.total}`);
  lines.push(`- Critical rows: ${summary.critical}`);
  lines.push(`- High rows: ${summary.high}`);
  lines.push(`- Medium rows: ${summary.medium}`);
  lines.push(`- Chart runtime browser QA rows: ${summary.chartRuntimeRows}`);
  lines.push(`- Hold/do-not-redirect rows: ${summary.holdRows}`);
  lines.push('');
  lines.push('## Input reports');
  lines.push('');
  lines.push('| Input | Present |');
  lines.push('|---|---|');

  for (const [name, present] of Object.entries(inputStatus)) {
    lines.push(`| ${escapeMarkdownCell(name)} | ${present ? 'yes' : 'no'} |`);
  }

  lines.push('');
  lines.push('## How to use');
  lines.push('');
  lines.push('Replace `<REACT_PREVIEW_OR_CUTOVER_ORIGIN>` in the URL file with the actual React preview or cutover origin.');
  lines.push('');
  lines.push('For each page, open it in a browser and check visible UI, console-breaking errors, client-side data rendering, media loading, and obvious mobile layout breakage.');
  lines.push('');
  lines.push('## Critical checklist');
  lines.push('');
  lines.push('- [ ] Core routes load without blank screen.');
  lines.push('- [ ] Magazine/article redirect targets render content shell correctly.');
  lines.push('- [ ] Tag-search URLs preserve query and do not crash search UI.');
  lines.push('- [ ] Media still loads from `media.wakilisha.africa` or approved provider CDNs.');
  lines.push('- [ ] No new `/wp-json/` dependency appears in browser network calls.');
  lines.push('- [ ] No old `/wp-content/uploads/` image URL appears as a final image URL.');
  lines.push('');
  lines.push('## QA rows');
  lines.push('');
  lines.push('| ID | Priority | Category | Route | Expected result | Status |');
  lines.push('|---|---|---|---|---|---|');

  for (const row of rows) {
    lines.push(
      `| ${escapeMarkdownCell(row.id)} | ${escapeMarkdownCell(row.priority)} | ${escapeMarkdownCell(row.category)} | \`${escapeMarkdownCell(row.route)}\` | ${escapeMarkdownCell(row.expectedResult)} | ${escapeMarkdownCell(row.qaStatus)} |`
    );
  }

  lines.push('');
  lines.push('## Go/no-go rule');
  lines.push('');
  lines.push('Cutover cannot be approved from this checklist unless all critical React routes pass in browser and smoke-sampled article/search/media behavior is acceptable.');
  lines.push('');
  lines.push('## Deployment checklist');
  lines.push('');
  lines.push('```text');
  lines.push('SQL migration needed: No');
  lines.push('Supabase Edge Function deploy needed: No');
  lines.push('Readdy Finish update needed: No');
  lines.push('Frontend deploy needed: No');
  lines.push('Cloudflare/DNS change needed: No');
  lines.push('This is a browser QA planning artifact only.');
  lines.push('```');

  return `${lines.join('\n')}\n`;
}

const previewSmoke = await readJson(INPUTS.previewSmoke);
const decisionResolution = await readJson(INPUTS.decisionResolution);
const redirectBundle = await readJson(INPUTS.redirectBundle);
const rehearsalChecklist = await readJson(INPUTS.rehearsalChecklist);

const inputStatus = {
  [INPUTS.previewSmoke]: await exists(INPUTS.previewSmoke),
  [INPUTS.decisionResolution]: await exists(INPUTS.decisionResolution),
  [INPUTS.redirectBundle]: await exists(INPUTS.redirectBundle),
  [INPUTS.rehearsalChecklist]: await exists(INPUTS.rehearsalChecklist),
};

const rows = uniqueByRoute([
  ...buildCoreRows(previewSmoke),
  ...buildChartRows(decisionResolution),
  ...buildSampleRedirectRows(previewSmoke),
  ...buildTagRows(previewSmoke),
  ...buildExtraRedirectRows(decisionResolution),
  ...buildApprovalGatedRows(decisionResolution),
  ...buildRetireRows(decisionResolution),
]);

const summary = {
  total: rows.length,
  critical: rows.filter((row) => row.priority === 'critical').length,
  high: rows.filter((row) => row.priority === 'high').length,
  medium: rows.filter((row) => row.priority === 'medium').length,
  chartRuntimeRows: rows.filter((row) => row.category === 'chart_runtime_route').length,
  holdRows: rows.filter((row) => row.category === 'do_not_redirect_without_decision').length,
  redirectBundleRows: redirectBundle?.summaries?.totalRedirects || 0,
  rehearsalMayCutOverNow: rehearsalChecklist?.goNoGo?.mayCutOverNow ?? false,
};

const output = {
  generatedAt: new Date().toISOString(),
  previewOriginPlaceholder: PREVIEW_ORIGIN_PLACEHOLDER,
  inputStatus,
  summary,
  rows,
};

await fs.writeFile(OUTPUTS.json, `${JSON.stringify(output, null, 2)}\n`);
await fs.writeFile(OUTPUTS.csv, toCsv(rows));
await fs.writeFile(OUTPUTS.urls, toUrls(rows));
await fs.writeFile(OUTPUTS.md, markdownReport({ rows, summary, inputStatus }));

console.log('WordPress cutover browser QA checklist generated.');
console.log('');
console.log('Summary:');
console.log(summary);
console.log('');
console.log(`Wrote ${OUTPUTS.json}`);
console.log(`Wrote ${OUTPUTS.csv}`);
console.log(`Wrote ${OUTPUTS.urls}`);
console.log(`Wrote ${OUTPUTS.md}`);
