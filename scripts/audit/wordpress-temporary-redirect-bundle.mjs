#!/usr/bin/env node

import fs from 'node:fs/promises';

const REDIRECT_STATUS = 302;

const INPUTS = {
  redirectPlan: 'reports/wordpress-cutover-redirect-plan.json',
  tagPolicy: 'reports/wordpress-tag-archive-cutover-policy.json',
  rehearsalChecklist: 'reports/wordpress-cutover-rehearsal-checklist.json',
  previewSmoke: 'reports/wordpress-react-preview-smoke-report.json',
};

const OUTPUTS = {
  json: 'reports/wordpress-temporary-redirect-bundle.json',
  csv: 'reports/wordpress-temporary-redirect-bundle.csv',
  txt: 'reports/wordpress-temporary-redirect-bundle-rules.txt',
  md: 'reports/wordpress-temporary-redirect-bundle.md',
};

async function readJson(path) {
  return JSON.parse(await fs.readFile(path, 'utf8'));
}

async function exists(path) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

function normalizeSource(source) {
  let next = String(source || '').trim();

  if (!next.startsWith('/')) next = `/${next}`;

  if (!next.endsWith('/')) next = `${next}/`;

  return next.replace(/\/+/g, '/');
}

function normalizeTarget(target) {
  let next = String(target || '').trim();

  if (!next.startsWith('/')) next = `/${next}`;

  next = next.replace(/\/+/g, '/');

  if (next !== '/' && next.endsWith('/') && !next.includes('?')) {
    next = next.slice(0, -1);
  }

  return next;
}

function isInternalTarget(target) {
  return String(target || '').startsWith('/') && !String(target || '').startsWith('//');
}

function hasUnsafeSource(source) {
  return [
    '/wp-admin/',
    '/wp-login.php',
    '/xmlrpc.php',
    '/wp-json/',
    '/.env',
    '/.git/',
    '/wp-content/uploads/',
  ].some((blocked) => source.startsWith(blocked));
}

function hasUnsafeTarget(target) {
  return [
    '/wp-admin/',
    '/wp-login.php',
    '/xmlrpc.php',
    '/wp-json/',
    '/wp-content/uploads/',
  ].some((blocked) => target.startsWith(blocked));
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
    'source',
    'target',
    'status',
    'preserveQueryString',
    'sourceGroup',
    'confidence',
    'safeToApplyAfterFinalGoNoGo',
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

function toRuleText(rows) {
  const lines = [];

  lines.push('# WordPress temporary redirect bundle');
  lines.push('# Planning artifact only. Do not apply before final go/no-go approval.');
  lines.push('# Use 302 temporary redirects first. Do not use 301 yet.');
  lines.push('# Preserve query strings where the redirect platform supports it.');
  lines.push('');

  for (const row of rows) {
    lines.push(`${row.source} -> ${row.target} ${REDIRECT_STATUS}`);
  }

  return `${lines.join('\n')}\n`;
}

function toMarkdown({ rows, validation, inputStatus, summaries }) {
  const lines = [];

  lines.push('# WordPress Temporary Redirect Bundle');
  lines.push('');
  lines.push('This is a planning artifact only. Do not apply these redirects until final cutover go/no-go approval.');
  lines.push('');
  lines.push('All redirects in this bundle are temporary `302` redirects. Do not switch to `301` until the React surface has been observed in production and analytics/search behavior is stable.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total redirect rows: ${rows.length}`);
  lines.push(`- Base article/artist redirects: ${summaries.baseRedirects}`);
  lines.push(`- Tag archive redirects: ${summaries.tagRedirects}`);
  lines.push(`- Status code: ${REDIRECT_STATUS}`);
  lines.push(`- Preserve query string: yes, where supported`);
  lines.push(`- Validation passed: ${validation.passed ? 'yes' : 'no'}`);
  lines.push('');
  lines.push('## Input reports');
  lines.push('');
  lines.push('| Input | Present |');
  lines.push('|---|---|');

  for (const [name, present] of Object.entries(inputStatus)) {
    lines.push(`| ${escapeMarkdownCell(name)} | ${present ? 'yes' : 'no'} |`);
  }

  lines.push('');
  lines.push('## Validation');
  lines.push('');
  lines.push(`- Duplicate sources: ${validation.duplicateSources.length}`);
  lines.push(`- Self redirects: ${validation.selfRedirects.length}`);
  lines.push(`- Unsafe sources: ${validation.unsafeSources.length}`);
  lines.push(`- Unsafe targets: ${validation.unsafeTargets.length}`);
  lines.push(`- Non-internal targets: ${validation.nonInternalTargets.length}`);
  lines.push(`- Non-302 rows: ${validation.non302Rows.length}`);
  lines.push('');
  lines.push('## Bundle preview');
  lines.push('');
  lines.push('| Source | Target | Group |');
  lines.push('|---|---|---|');

  for (const row of rows.slice(0, 80)) {
    lines.push(
      `| \`${escapeMarkdownCell(row.source)}\` | \`${escapeMarkdownCell(row.target)}\` | ${escapeMarkdownCell(row.sourceGroup)} |`
    );
  }

  if (rows.length > 80) {
    lines.push(`| ... | ... | ${rows.length - 80} more rows in CSV/JSON/TXT |`);
  }

  lines.push('');
  lines.push('## Application rule');
  lines.push('');
  lines.push('- Do not apply this bundle before the final cutover rehearsal passes.');
  lines.push('- Apply as 302 only.');
  lines.push('- Keep media redirects separate from app route redirects.');
  lines.push('- Keep WordPress security endpoint blocks separate from app route redirects.');
  lines.push('- Roll back by disabling this bundle first, not by touching media/security rules.');
  lines.push('');
  lines.push('## Deployment checklist');
  lines.push('');
  lines.push('```text');
  lines.push('SQL migration needed: No');
  lines.push('Supabase Edge Function deploy needed: No');
  lines.push('Readdy Finish update needed: No');
  lines.push('Frontend deploy needed: No');
  lines.push('Cloudflare/DNS change needed: No');
  lines.push('This is a redirect planning artifact only.');
  lines.push('```');

  return `${lines.join('\n')}\n`;
}

function buildBaseRows(redirectPlan) {
  return (redirectPlan.safeRedirects || []).map((item) => ({
    source: normalizeSource(item.source || item.legacyPath),
    target: normalizeTarget(item.target || item.targetPath),
    status: REDIRECT_STATUS,
    preserveQueryString: true,
    sourceGroup: 'base_article_artist_redirect',
    confidence: item.confidence || 'high',
    safeToApplyAfterFinalGoNoGo: true,
    notes: item.notes || 'Safe redirect from WordPress cutover redirect plan.',
  }));
}

function buildTagRows(tagPolicy) {
  return (tagPolicy.redirects || []).map((item) => ({
    source: normalizeSource(item.source),
    target: normalizeTarget(item.target),
    status: REDIRECT_STATUS,
    preserveQueryString: true,
    sourceGroup: 'tag_archive_redirect',
    confidence: item.confidence || 'medium',
    safeToApplyAfterFinalGoNoGo: true,
    notes: item.reason || 'Legacy WordPress tag archive redirects to React tag search.',
  }));
}

function validate(rows) {
  const seen = new Map();
  const duplicateSources = [];

  for (const row of rows) {
    if (seen.has(row.source)) {
      duplicateSources.push({
        source: row.source,
        firstTarget: seen.get(row.source),
        duplicateTarget: row.target,
      });
    } else {
      seen.set(row.source, row.target);
    }
  }

  const selfRedirects = rows.filter((row) => normalizeSource(row.source).replace(/\/$/, '') === normalizeTarget(row.target));
  const unsafeSources = rows.filter((row) => hasUnsafeSource(row.source));
  const unsafeTargets = rows.filter((row) => hasUnsafeTarget(row.target));
  const nonInternalTargets = rows.filter((row) => !isInternalTarget(row.target));
  const non302Rows = rows.filter((row) => row.status !== REDIRECT_STATUS);

  return {
    passed:
      duplicateSources.length === 0 &&
      selfRedirects.length === 0 &&
      unsafeSources.length === 0 &&
      unsafeTargets.length === 0 &&
      nonInternalTargets.length === 0 &&
      non302Rows.length === 0,
    duplicateSources,
    selfRedirects,
    unsafeSources,
    unsafeTargets,
    nonInternalTargets,
    non302Rows,
  };
}

const redirectPlan = await readJson(INPUTS.redirectPlan);
const tagPolicy = await readJson(INPUTS.tagPolicy);

const inputStatus = {
  [INPUTS.redirectPlan]: await exists(INPUTS.redirectPlan),
  [INPUTS.tagPolicy]: await exists(INPUTS.tagPolicy),
  [INPUTS.rehearsalChecklist]: await exists(INPUTS.rehearsalChecklist),
  [INPUTS.previewSmoke]: await exists(INPUTS.previewSmoke),
};

const baseRows = buildBaseRows(redirectPlan);
const tagRows = buildTagRows(tagPolicy);

const rows = [...baseRows, ...tagRows].sort((a, b) => {
  const groupCompare = a.sourceGroup.localeCompare(b.sourceGroup);
  if (groupCompare !== 0) return groupCompare;
  return a.source.localeCompare(b.source);
});

const validation = validate(rows);

const output = {
  generatedAt: new Date().toISOString(),
  redirectStatus: REDIRECT_STATUS,
  inputStatus,
  summaries: {
    baseRedirects: baseRows.length,
    tagRedirects: tagRows.length,
    totalRedirects: rows.length,
  },
  validation,
  rows,
};

await fs.writeFile(OUTPUTS.json, `${JSON.stringify(output, null, 2)}\n`);
await fs.writeFile(OUTPUTS.csv, toCsv(rows));
await fs.writeFile(OUTPUTS.txt, toRuleText(rows));
await fs.writeFile(
  OUTPUTS.md,
  toMarkdown({
    rows,
    validation,
    inputStatus,
    summaries: output.summaries,
  })
);

console.log('WordPress temporary redirect bundle generated.');
console.log('');
console.log('Summary:');
console.log(output.summaries);
console.log('');
console.log('Validation:');
console.log({
  passed: validation.passed,
  duplicateSources: validation.duplicateSources.length,
  selfRedirects: validation.selfRedirects.length,
  unsafeSources: validation.unsafeSources.length,
  unsafeTargets: validation.unsafeTargets.length,
  nonInternalTargets: validation.nonInternalTargets.length,
  non302Rows: validation.non302Rows.length,
});
console.log('');
console.log(`Wrote ${OUTPUTS.json}`);
console.log(`Wrote ${OUTPUTS.csv}`);
console.log(`Wrote ${OUTPUTS.txt}`);
console.log(`Wrote ${OUTPUTS.md}`);

if (!validation.passed) {
  process.exitCode = 1;
}
