#!/usr/bin/env node

import fs from 'node:fs/promises';

const INPUTS = {
  rehearsalChecklist: 'reports/wordpress-cutover-rehearsal-checklist.json',
  previewSmoke: 'reports/wordpress-react-preview-smoke-report.json',
  redirectBundle: 'reports/wordpress-temporary-redirect-bundle.json',
  decisionRegister: 'reports/wordpress-cutover-decision-register.json',
  decisionResolution: 'reports/wordpress-cutover-decision-resolution-plan.json',
  browserQaChecklist: 'reports/wordpress-cutover-browser-qa-checklist.json',
};

const OUTPUTS = {
  json: 'reports/wordpress-cutover-readiness-gate.json',
  md: 'reports/wordpress-cutover-readiness-gate.md',
  csv: 'reports/wordpress-cutover-readiness-gate-blockers.csv',
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
  const columns = ['id', 'severity', 'category', 'blocker', 'requiredAction', 'evidence'];

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

function addBlocker(blockers, { severity, category, blocker, requiredAction, evidence }) {
  blockers.push({
    id: `BLOCKER-${String(blockers.length + 1).padStart(3, '0')}`,
    severity,
    category,
    blocker,
    requiredAction,
    evidence,
  });
}

function markdownReport({ summary, inputStatus, blockers, rollup }) {
  const lines = [];

  lines.push('# WordPress to React Cutover Readiness Gate');
  lines.push('');
  lines.push('This is the final planning gate before any DNS/IP/Cloudflare cutover move.');
  lines.push('');
  lines.push('It does not approve or apply redirects, DNS changes, Cloudflare changes, Supabase changes, or frontend deploys.');
  lines.push('');
  lines.push('## Gate result');
  lines.push('');
  lines.push(`- May cut over now: ${summary.mayCutOverNow ? 'yes' : 'no'}`);
  lines.push(`- Blockers: ${summary.blockers}`);
  lines.push(`- Critical blockers: ${summary.criticalBlockers}`);
  lines.push(`- High blockers: ${summary.highBlockers}`);
  lines.push(`- Medium blockers: ${summary.mediumBlockers}`);
  lines.push('');
  lines.push('## Cutover rollup');
  lines.push('');
  lines.push(`- Validated primary temporary redirect rows: ${rollup.primaryRedirectRows}`);
  lines.push(`- Ready extra redirect rows: ${rollup.readyExtraRedirectRows}`);
  lines.push(`- Approval-gated redirect rows: ${rollup.approvalGatedRedirectRows}`);
  lines.push(`- Browser QA rows: ${rollup.browserQaRows}`);
  lines.push(`- Critical browser QA rows: ${rollup.criticalBrowserQaRows}`);
  lines.push(`- Hold/do-not-redirect rows: ${rollup.holdRows}`);
  lines.push(`- Preview smoke all passed: ${rollup.previewSmokeAllPassed ? 'yes' : 'no'}`);
  lines.push(`- Rehearsal may cut over now: ${rollup.rehearsalMayCutOverNow ? 'yes' : 'no'}`);
  lines.push('');
  lines.push('## Input reports');
  lines.push('');
  lines.push('| Input | Present |');
  lines.push('|---|---|');

  for (const [name, present] of Object.entries(inputStatus)) {
    lines.push(`| ${escapeMarkdownCell(name)} | ${present ? 'yes' : 'no'} |`);
  }

  lines.push('');
  lines.push('## Blockers');
  lines.push('');
  lines.push('| ID | Severity | Category | Blocker | Required action | Evidence |');
  lines.push('|---|---|---|---|---|---|');

  for (const row of blockers) {
    lines.push(
      `| ${escapeMarkdownCell(row.id)} | ${escapeMarkdownCell(row.severity)} | ${escapeMarkdownCell(row.category)} | ${escapeMarkdownCell(row.blocker)} | ${escapeMarkdownCell(row.requiredAction)} | ${escapeMarkdownCell(row.evidence)} |`
    );
  }

  lines.push('');
  lines.push('## Blocker counts');
  lines.push('');

  for (const [severity, count] of Object.entries(countBy(blockers, 'severity')).sort()) {
    lines.push(`- ${severity}: ${count}`);
  }

  lines.push('');
  lines.push('## Go/no-go interpretation');
  lines.push('');
  lines.push('Cutover is blocked until every critical blocker is resolved. The presence of a validated redirect bundle does not itself approve DNS/IP or Cloudflare changes.');
  lines.push('');
  lines.push('The correct sequence remains: finish browser QA, resolve product/content holds, run this gate again, then decide whether to stage redirects and DNS/IP cutover.');
  lines.push('');
  lines.push('## Deployment checklist');
  lines.push('');
  lines.push('```text');
  lines.push('SQL migration needed: No');
  lines.push('Supabase Edge Function deploy needed: No');
  lines.push('Readdy Finish update needed: No');
  lines.push('Frontend deploy needed: No');
  lines.push('Cloudflare/DNS change needed: No');
  lines.push('This is a readiness-gate artifact only.');
  lines.push('```');

  return `${lines.join('\n')}\n`;
}

const [
  rehearsalChecklist,
  previewSmoke,
  redirectBundle,
  decisionRegister,
  decisionResolution,
  browserQaChecklist,
] = await Promise.all([
  readJson(INPUTS.rehearsalChecklist),
  readJson(INPUTS.previewSmoke),
  readJson(INPUTS.redirectBundle),
  readJson(INPUTS.decisionRegister),
  readJson(INPUTS.decisionResolution),
  readJson(INPUTS.browserQaChecklist),
]);

const inputStatus = {};

for (const [name, path] of Object.entries(INPUTS)) {
  inputStatus[path] = await exists(path);
}

const blockers = [];

const rehearsalMayCutOverNow = rehearsalChecklist?.goNoGo?.mayCutOverNow === true;
const previewSmokeAllPassed = previewSmoke?.summary?.allPassed === true;

const decisionResolutionSummary = decisionResolution?.summary || {};
const redirectBundleSummary = redirectBundle?.summaries || {};

const browserRows = browserQaChecklist?.rows || [];
const criticalBrowserRows = browserRows.filter((row) => row.priority === 'critical');
const pendingCriticalBrowserRows = criticalBrowserRows.filter((row) => row.qaStatus !== 'passed');
const holdRows = browserRows.filter((row) => row.category === 'do_not_redirect_without_decision');
const approvalGatedRedirectRows = decisionResolutionSummary.approvalGatedRedirectRows || 0;

if (!previewSmokeAllPassed) {
  addBlocker(blockers, {
    severity: 'critical',
    category: 'preview_smoke',
    blocker: 'React preview smoke has not fully passed.',
    requiredAction: 'Run and pass the React preview smoke verifier before cutover.',
    evidence: INPUTS.previewSmoke,
  });
}

if (!rehearsalMayCutOverNow) {
  addBlocker(blockers, {
    severity: 'critical',
    category: 'rehearsal_gate',
    blocker: 'Rehearsal checklist still says mayCutOverNow is false.',
    requiredAction: 'Resolve remaining decisions and browser QA, then regenerate the rehearsal/readiness artifacts.',
    evidence: INPUTS.rehearsalChecklist,
  });
}

if (pendingCriticalBrowserRows.length > 0) {
  addBlocker(blockers, {
    severity: 'critical',
    category: 'browser_qa',
    blocker: `${pendingCriticalBrowserRows.length} critical browser QA rows are not passed.`,
    requiredAction: 'Open the critical routes in a browser and mark them passed only after visible UI and client-side data render correctly.',
    evidence: INPUTS.browserQaChecklist,
  });
}

if (holdRows.length > 0) {
  addBlocker(blockers, {
    severity: 'critical',
    category: 'hold_routes',
    blocker: `${holdRows.length} hold/do-not-redirect routes remain unresolved.`,
    requiredAction: 'Confirm each hold route is intentionally retired, rebuilt, preserved, or left out of redirect rules.',
    evidence: INPUTS.browserQaChecklist,
  });
}

if (approvalGatedRedirectRows > 0) {
  addBlocker(blockers, {
    severity: 'high',
    category: 'approval_gated_redirects',
    blocker: `${approvalGatedRedirectRows} approval-gated redirect-shaped rows remain in the decision resolution plan.`,
    requiredAction: 'Approve, reject, or defer section archive redirects before applying any extra redirect bundle.',
    evidence: INPUTS.decisionResolution,
  });
}

if ((decisionResolutionSummary.manualDecisionRows || 0) > 0) {
  addBlocker(blockers, {
    severity: 'high',
    category: 'manual_decisions',
    blocker: `${decisionResolutionSummary.manualDecisionRows} manual decision rows remain.`,
    requiredAction: 'Resolve content/product manual decisions before final cutover approval.',
    evidence: INPUTS.decisionResolution,
  });
}

if ((decisionRegister?.summary?.highRisk || 0) > 0) {
  addBlocker(blockers, {
    severity: 'medium',
    category: 'risk_register',
    blocker: `${decisionRegister.summary.highRisk} high-risk decision-register rows exist.`,
    requiredAction: 'Confirm high-risk account/auth/WooCommerce rows are intentionally handled and not accidentally redirected.',
    evidence: INPUTS.decisionRegister,
  });
}

const rollup = {
  primaryRedirectRows: redirectBundleSummary.totalRedirects || 0,
  readyExtraRedirectRows: decisionResolutionSummary.readyExtraRedirectRows || 0,
  approvalGatedRedirectRows,
  browserQaRows: browserQaChecklist?.summary?.total || browserRows.length,
  criticalBrowserQaRows: criticalBrowserRows.length,
  holdRows: holdRows.length,
  previewSmokeAllPassed,
  rehearsalMayCutOverNow,
};

const summary = {
  mayCutOverNow: blockers.length === 0,
  blockers: blockers.length,
  criticalBlockers: blockers.filter((row) => row.severity === 'critical').length,
  highBlockers: blockers.filter((row) => row.severity === 'high').length,
  mediumBlockers: blockers.filter((row) => row.severity === 'medium').length,
};

const output = {
  generatedAt: new Date().toISOString(),
  inputStatus,
  summary,
  rollup,
  blockerCounts: countBy(blockers, 'severity'),
  blockers,
};

await fs.writeFile(OUTPUTS.json, `${JSON.stringify(output, null, 2)}\n`);
await fs.writeFile(OUTPUTS.csv, toCsv(blockers));
await fs.writeFile(OUTPUTS.md, markdownReport({ summary, inputStatus, blockers, rollup }));

console.log('WordPress cutover readiness gate generated.');
console.log('');
console.log('Summary:');
console.log(summary);
console.log('');
console.log('Rollup:');
console.log(rollup);
console.log('');
console.log('Blocker counts:');
console.log(output.blockerCounts);
console.log('');
console.log(`Wrote ${OUTPUTS.json}`);
console.log(`Wrote ${OUTPUTS.csv}`);
console.log(`Wrote ${OUTPUTS.md}`);

if (!summary.mayCutOverNow) {
  process.exitCode = 1;
}
