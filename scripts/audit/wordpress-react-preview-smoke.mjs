#!/usr/bin/env node

import fs from 'node:fs/promises';

const ORIGIN = (process.env.WAKILISHA_REACT_PREVIEW_ORIGIN || 'http://127.0.0.1:4173').replace(/\/$/, '');

const INPUTS = {
  redirectPlan: 'reports/wordpress-cutover-redirect-plan.json',
  tagPolicy: 'reports/wordpress-tag-archive-cutover-policy.json',
  remainingPolicy: 'reports/wordpress-remaining-blocker-cutover-policy.json',
};

const OUTPUTS = {
  json: 'reports/wordpress-react-preview-smoke-report.json',
  md: 'reports/wordpress-react-preview-smoke-report.md',
  csv: 'reports/wordpress-react-preview-smoke-report.csv',
};

const CORE_ROUTES = [
  '/',
  '/magazine',
  '/charts',
  '/artists',
  '/releases',
  '/tracks',
  '/search',
];

const SAMPLE_LIMIT = 25;

async function readJson(path) {
  return JSON.parse(await fs.readFile(path, 'utf8'));
}

function toRoute(value) {
  if (!value) return null;

  const raw = String(value).trim();

  if (!raw) return null;

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    const url = new URL(raw);
    return `${url.pathname}${url.search}`;
  }

  return raw.startsWith('/') ? raw : `/${raw}`;
}

function uniqueRoutes(items) {
  const seen = new Set();
  const out = [];

  for (const item of items) {
    const route = toRoute(item);

    if (!route || seen.has(route)) continue;

    seen.add(route);
    out.push(route);
  }

  return out;
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
    'group',
    'route',
    'url',
    'status',
    'contentType',
    'bytes',
    'rootMountPresent',
    'oldWordPressUploadPresent',
    'wpJsonPresent',
    'passed',
    'reason',
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

async function smoke(route, group) {
  const url = new URL(route, ORIGIN).toString();

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'user-agent': 'WAKILISHA-cutover-preview-smoke/1.0',
      },
    });

    const body = await response.text();
    const contentType = response.headers.get('content-type') || '';

    const rootMountPresent = body.includes('id="root"') || body.includes("id='root'");
    const oldWordPressUploadPresent = body.includes('/wp-content/uploads/');
    const wpJsonPresent = body.includes('/wp-json/');
    const statusPassed = response.status >= 200 && response.status < 400;
    const htmlPassed = contentType.includes('text/html') && rootMountPresent;
    const legacyLeakPassed = !oldWordPressUploadPresent && !wpJsonPresent;

    const passed = statusPassed && htmlPassed && legacyLeakPassed;

    let reason = 'ok';

    if (!statusPassed) {
      reason = `Unexpected status ${response.status}.`;
    } else if (!htmlPassed) {
      reason = 'Response did not look like React HTML shell.';
    } else if (!legacyLeakPassed) {
      reason = 'Response still contains old WordPress upload or wp-json references.';
    }

    return {
      group,
      route,
      url,
      status: response.status,
      contentType,
      bytes: Buffer.byteLength(body, 'utf8'),
      rootMountPresent,
      oldWordPressUploadPresent,
      wpJsonPresent,
      passed,
      reason,
    };
  } catch (error) {
    return {
      group,
      route,
      url,
      status: 0,
      contentType: '',
      bytes: 0,
      rootMountPresent: false,
      oldWordPressUploadPresent: false,
      wpJsonPresent: false,
      passed: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

function markdownReport({ rows, summary }) {
  const lines = [];

  lines.push('# WordPress React Preview Smoke Report');
  lines.push('');
  lines.push('This report verifies that a React preview origin can serve core cutover routes before any DNS/IP switch.');
  lines.push('');
  lines.push('It does not apply redirects, change Cloudflare, or deploy anything.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Preview origin: ${ORIGIN}`);
  lines.push(`- Routes checked: ${summary.total}`);
  lines.push(`- Passed: ${summary.passed}`);
  lines.push(`- Failed: ${summary.failed}`);
  lines.push(`- All passed: ${summary.allPassed ? 'yes' : 'no'}`);
  lines.push('');
  lines.push('## Group counts');
  lines.push('');

  for (const [group, count] of Object.entries(summary.groupCounts).sort()) {
    lines.push(`- ${group}: ${count}`);
  }

  lines.push('');
  lines.push('## Results');
  lines.push('');
  lines.push('| Group | Route | Status | Passed | Reason |');
  lines.push('|---|---|---:|---|---|');

  for (const row of rows) {
    lines.push(
      `| ${escapeMarkdownCell(row.group)} | \`${escapeMarkdownCell(row.route)}\` | ${row.status} | ${row.passed ? 'yes' : 'no'} | ${escapeMarkdownCell(row.reason)} |`
    );
  }

  lines.push('');
  lines.push('## Cutover interpretation');
  lines.push('');
  lines.push('- Passing this check means the preview origin returns the React HTML shell for the tested deep links.');
  lines.push('- Chart pages still need browser QA because client-side data loading cannot be fully proven with curl-style HTML checks.');
  lines.push('- Keep all cutover redirects as 302 until production behavior is stable.');
  lines.push('');
  lines.push('## Deployment checklist');
  lines.push('');
  lines.push('```text');
  lines.push('SQL migration needed: No');
  lines.push('Supabase Edge Function deploy needed: No');
  lines.push('Readdy Finish update needed: No');
  lines.push('Frontend deploy needed: No');
  lines.push('Cloudflare/DNS change needed: No');
  lines.push('This is a smoke-test artifact only.');
  lines.push('```');

  return `${lines.join('\n')}\n`;
}

const redirectPlan = await readJson(INPUTS.redirectPlan);
const tagPolicy = await readJson(INPUTS.tagPolicy);
const remainingPolicy = await readJson(INPUTS.remainingPolicy);

const safeRedirectTargets = (redirectPlan.safeRedirects || [])
  .map((item) => item.target || item.targetPath)
  .filter(Boolean)
  .slice(0, SAMPLE_LIMIT);

const tagRedirectTargets = (tagPolicy.redirects || [])
  .map((item) => item.target)
  .filter(Boolean)
  .slice(0, SAMPLE_LIMIT);

const chartRuntimeTargets = (remainingPolicy.runtimeVerification || [])
  .map((item) => item.target)
  .filter(Boolean);

const routeGroups = [
  ...CORE_ROUTES.map((route) => ({ group: 'core_route', route })),
  ...safeRedirectTargets.map((route) => ({ group: 'sample_safe_redirect_target', route })),
  ...tagRedirectTargets.map((route) => ({ group: 'sample_tag_redirect_target', route })),
  ...chartRuntimeTargets.map((route) => ({ group: 'chart_runtime_route', route })),
];

const deduped = [];
const seen = new Set();

for (const item of routeGroups) {
  const route = toRoute(item.route);

  if (!route || seen.has(`${item.group}:${route}`)) continue;

  seen.add(`${item.group}:${route}`);
  deduped.push({ ...item, route });
}

const rows = [];

for (const item of deduped) {
  rows.push(await smoke(item.route, item.group));
}

const groupCounts = rows.reduce((acc, row) => {
  acc[row.group] = (acc[row.group] || 0) + 1;
  return acc;
}, {});

const summary = {
  origin: ORIGIN,
  total: rows.length,
  passed: rows.filter((row) => row.passed).length,
  failed: rows.filter((row) => !row.passed).length,
  allPassed: rows.every((row) => row.passed),
  groupCounts,
};

const output = {
  generatedAt: new Date().toISOString(),
  summary,
  rows,
};

await fs.writeFile(OUTPUTS.json, `${JSON.stringify(output, null, 2)}\n`);
await fs.writeFile(OUTPUTS.md, markdownReport({ rows, summary }));
await fs.writeFile(OUTPUTS.csv, toCsv(rows));

console.log('React preview smoke report generated.');
console.log('');
console.log('Summary:');
console.log(summary);
console.log('');
console.log(`Wrote ${OUTPUTS.json}`);
console.log(`Wrote ${OUTPUTS.md}`);
console.log(`Wrote ${OUTPUTS.csv}`);

if (!summary.allPassed) {
  process.exitCode = 1;
}
