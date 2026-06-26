#!/usr/bin/env node

import fs from 'node:fs/promises';

const INPUTS = {
  decisionRegister: 'reports/wordpress-cutover-decision-register.json',
  redirectBundle: 'reports/wordpress-temporary-redirect-bundle.json',
  previewSmoke: 'reports/wordpress-react-preview-smoke-report.json',
};

const OUTPUTS = {
  json: 'reports/wordpress-cutover-decision-resolution-plan.json',
  csv: 'reports/wordpress-cutover-decision-resolution-plan.csv',
  md: 'reports/wordpress-cutover-decision-resolution-plan.md',
  draftRules: 'reports/wordpress-cutover-decision-resolution-draft-rules.txt',
};

const REDIRECT_STATUS = 302;

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
    'source',
    'proposedTarget',
    'resolution',
    'finalTarget',
    'status',
    'cutoverAction',
    'risk',
    'ownerBucket',
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

function countBy(items, keyOrFn) {
  const getValue = typeof keyOrFn === 'function' ? keyOrFn : (item) => item[keyOrFn];

  return items.reduce((acc, item) => {
    const value = getValue(item) || 'unknown';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function isPaginatedAuthor(source) {
  return /^\/author\/[^/]+\/page\/\d+\/$/.test(source || '');
}

function resolveRow(row) {
  switch (row.sourceGroup) {
    case 'malformed_tag_route':
      return {
        ...row,
        resolution: 'intentional_404',
        finalTarget: '',
        status: '',
        cutoverAction: 'Do not redirect malformed encoded tag route. Let it 404 or keep it retired.',
        risk: 'low',
        reason: 'Malformed encoded tag slugs are not worth preserving and should not be bulk-mapped blindly.',
      };

    case 'author_archive':
      return {
        ...row,
        resolution: 'redirect_to_magazine',
        finalTarget: '/magazine',
        status: REDIRECT_STATUS,
        cutoverAction: isPaginatedAuthor(row.source)
          ? 'Collapse old paginated author archive to /magazine.'
          : 'Retire old WordPress author archive and redirect to /magazine.',
        risk: 'medium',
        reason: 'WordPress username slugs are not confirmed React author slugs. /magazine is safer than fake /authors/<slug> routes.',
      };

    case 'static_route':
      if (row.source === '/news-resources/') {
        return {
          ...row,
          resolution: 'redirect_to_magazine',
          finalTarget: '/magazine',
          status: REDIRECT_STATUS,
          cutoverAction: 'Redirect legacy news/resources page to /magazine.',
          risk: 'low',
          reason: 'Magazine is the closest current React destination.',
        };
      }

      return {
        ...row,
        resolution: 'intentional_404_or_future_rebuild',
        finalTarget: '',
        status: '',
        cutoverAction: 'Do not redirect until this static page is rebuilt or explicitly retired.',
        risk: 'medium',
        reason: 'Target route does not exist in current React prerender output.',
      };

    case 'account_or_user_route':
      return {
        ...row,
        resolution: 'intentional_404_until_auth_route_confirmed',
        finalTarget: '',
        status: '',
        cutoverAction: 'Do not redirect old account/user route until React auth destination is confirmed in production.',
        risk: 'high',
        reason: 'Account, library, top-10, order, and settings routes can affect user expectations and auth behavior.',
      };

    case 'legacy_article_missing_react_route':
      return {
        ...row,
        resolution: 'manual_content_decision_required',
        finalTarget: '',
        status: '',
        cutoverAction: 'Decide whether to import /claim-your-name/, redirect it, preserve static HTML, or intentionally 404.',
        risk: 'medium',
        reason: 'This is a specific legacy page/article and should not be silently redirected without content decision.',
      };

    case 'legacy_section_archive':
      if (row.source === '/music/') {
        return {
          ...row,
          resolution: 'manual_product_decision_required',
          finalTarget: '',
          status: '',
          cutoverAction: 'Decide whether /music/ should be rebuilt as a public music archive before cutover.',
          risk: 'medium',
          reason: '/music/ may be product-significant and should not be blindly redirected.',
        };
      }

      return {
        ...row,
        resolution: 'redirect_to_magazine_after_product_approval',
        finalTarget: '/magazine',
        status: REDIRECT_STATUS,
        cutoverAction: 'Redirect old section archive to /magazine only after product/content approval.',
        risk: 'medium',
        reason: 'Magazine is the closest broad React destination, but section-specific UX may be preferable later.',
      };

    case 'woocommerce_route':
      return {
        ...row,
        resolution: 'intentional_404_or_legacy_store_hold',
        finalTarget: '',
        status: '',
        cutoverAction: 'Retire WooCommerce route or preserve a legacy store path. Do not redirect blindly.',
        risk: 'high',
        reason: 'Cart/checkout behavior can create false commercial expectations.',
      };

    case 'chart_runtime_route':
      return {
        ...row,
        resolution: 'browser_qa_required',
        finalTarget: row.proposedTarget,
        status: '',
        cutoverAction: 'Run browser QA for chart data rendering on preview/cutover origin.',
        risk: 'low',
        reason: 'HTML shell smoke passed, but client-side chart data rendering still needs browser verification.',
      };

    default:
      return {
        ...row,
        resolution: 'manual_review',
        finalTarget: '',
        status: '',
        cutoverAction: 'Manual review required.',
        risk: row.cutoverRisk || 'medium',
        reason: row.reason || 'Unhandled decision row.',
      };
  }
}

function toDraftRules(rows) {
  const redirectRows = rows.filter((row) => row.status === REDIRECT_STATUS && row.finalTarget);

  const lines = [];

  lines.push('# WordPress cutover decision-resolution draft rules');
  lines.push('# Planning artifact only. Do not apply before final go/no-go approval.');
  lines.push('# Use 302 temporary redirects first. Do not use 301 yet.');
  lines.push('');
  lines.push('# These are proposed extra redirects from unresolved decision rows only.');
  lines.push('# They are separate from the validated 1,171-row temporary redirect bundle.');
  lines.push('');

  for (const row of redirectRows) {
    lines.push(`${row.source} -> ${row.finalTarget} ${REDIRECT_STATUS}`);
  }

  return `${lines.join('\n')}\n`;
}

function markdownReport({ rows, summary, inputStatus }) {
  const lines = [];

  lines.push('# WordPress Cutover Decision Resolution Plan');
  lines.push('');
  lines.push('This is a proposed resolution layer for the 64-row cutover decision register.');
  lines.push('');
  lines.push('It does not approve DNS, Cloudflare, Supabase, frontend deploy, or production redirect changes.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Decision rows reviewed: ${summary.total}`);
  lines.push(`- Proposed extra redirect-shaped rows: ${summary.proposedExtraRedirectRows}`);
  lines.push(`- Ready extra redirect rows: ${summary.readyExtraRedirectRows}`);
  lines.push(`- Approval-gated redirect rows: ${summary.approvalGatedRedirectRows}`);
  lines.push(`- Intentional retire/404 rows: ${summary.intentionalRetireRows}`);
  lines.push(`- Manual decision rows remaining: ${summary.manualDecisionRows}`);
  lines.push(`- Browser QA rows: ${summary.browserQaRows}`);
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
  lines.push('## Resolution counts');
  lines.push('');

  for (const [resolution, count] of Object.entries(countBy(rows, 'resolution')).sort()) {
    lines.push(`- ${resolution}: ${count}`);
  }

  lines.push('');
  lines.push('## Proposed extra redirects');
  lines.push('');
  lines.push('These are not part of the validated 1,171-row redirect bundle. Some rows are ready proposals, while section-archive rows remain approval-gated. Apply only after explicit product/content approval.');
  lines.push('');
  lines.push('| Source | Target | Status | Reason |');
  lines.push('|---|---|---:|---|');

  for (const row of rows.filter((item) => item.status === REDIRECT_STATUS && item.finalTarget)) {
    lines.push(
      `| \`${escapeMarkdownCell(row.source)}\` | \`${escapeMarkdownCell(row.finalTarget)}\` | ${REDIRECT_STATUS} | ${escapeMarkdownCell(row.reason)} |`
    );
  }

  lines.push('');
  lines.push('## Rows to retire or leave unredirected');
  lines.push('');
  lines.push('| Source | Resolution | Risk | Reason |');
  lines.push('|---|---|---|---|');

  for (const row of rows.filter((item) => !item.finalTarget && item.resolution !== 'browser_qa_required')) {
    lines.push(
      `| \`${escapeMarkdownCell(row.source)}\` | ${escapeMarkdownCell(row.resolution)} | ${escapeMarkdownCell(row.risk)} | ${escapeMarkdownCell(row.reason)} |`
    );
  }

  lines.push('');
  lines.push('## Browser QA rows');
  lines.push('');
  lines.push('| Source | Target | Reason |');
  lines.push('|---|---|---|');

  for (const row of rows.filter((item) => item.resolution === 'browser_qa_required')) {
    lines.push(
      `| \`${escapeMarkdownCell(row.source)}\` | \`${escapeMarkdownCell(row.finalTarget)}\` | ${escapeMarkdownCell(row.reason)} |`
    );
  }

  lines.push('');
  lines.push('## Cutover interpretation');
  lines.push('');
  lines.push('- The validated 1,171-row temporary redirect bundle remains the primary approved redirect artifact.');
  lines.push('- This plan proposes extra handling for the 64 unresolved rows.');
  lines.push('- Author archive URLs should not fake author profile matches. The safe fallback is `/magazine` if we choose to preserve them.');
  lines.push('- WooCommerce and account routes should not be redirected until product/auth behavior is confirmed.');
  lines.push('- Chart routes have passed HTML-shell smoke and need browser QA for client-side data.');
  lines.push('');
  lines.push('## Deployment checklist');
  lines.push('');
  lines.push('```text');
  lines.push('SQL migration needed: No');
  lines.push('Supabase Edge Function deploy needed: No');
  lines.push('Readdy Finish update needed: No');
  lines.push('Frontend deploy needed: No');
  lines.push('Cloudflare/DNS change needed: No');
  lines.push('This is a decision-resolution planning artifact only.');
  lines.push('```');

  return `${lines.join('\n')}\n`;
}

const decisionRegister = await readJson(INPUTS.decisionRegister);

const inputStatus = {
  [INPUTS.decisionRegister]: await exists(INPUTS.decisionRegister),
  [INPUTS.redirectBundle]: await exists(INPUTS.redirectBundle),
  [INPUTS.previewSmoke]: await exists(INPUTS.previewSmoke),
};

const rows = (decisionRegister.rows || []).map(resolveRow);

const proposedExtraRedirectRows = rows.filter((row) => row.status === REDIRECT_STATUS && row.finalTarget).length;
const approvalGatedRedirectRows = rows.filter((row) => row.resolution === 'redirect_to_magazine_after_product_approval').length;

const summary = {
  total: rows.length,
  proposedExtraRedirectRows,
  readyExtraRedirectRows: proposedExtraRedirectRows - approvalGatedRedirectRows,
  approvalGatedRedirectRows,
  intentionalRetireRows: rows.filter((row) =>
    ['intentional_404', 'intentional_404_or_future_rebuild', 'intentional_404_until_auth_route_confirmed', 'intentional_404_or_legacy_store_hold'].includes(row.resolution)
  ).length,
  manualDecisionRows: rows.filter((row) =>
    ['manual_content_decision_required', 'manual_product_decision_required', 'redirect_to_magazine_after_product_approval'].includes(row.resolution)
  ).length,
  browserQaRows: rows.filter((row) => row.resolution === 'browser_qa_required').length,
  highRisk: rows.filter((row) => row.risk === 'high').length,
  mediumRisk: rows.filter((row) => row.risk === 'medium').length,
  lowRisk: rows.filter((row) => row.risk === 'low').length,
};

const output = {
  generatedAt: new Date().toISOString(),
  redirectStatus: REDIRECT_STATUS,
  inputStatus,
  summary,
  resolutionCounts: countBy(rows, 'resolution'),
  rows,
};

await fs.writeFile(OUTPUTS.json, `${JSON.stringify(output, null, 2)}\n`);
await fs.writeFile(OUTPUTS.csv, toCsv(rows));
await fs.writeFile(OUTPUTS.draftRules, toDraftRules(rows));
await fs.writeFile(OUTPUTS.md, markdownReport({ rows, summary, inputStatus }));

console.log('WordPress cutover decision resolution plan generated.');
console.log('');
console.log('Summary:');
console.log(summary);
console.log('');
console.log('Resolution counts:');
console.log(output.resolutionCounts);
console.log('');
console.log(`Wrote ${OUTPUTS.json}`);
console.log(`Wrote ${OUTPUTS.csv}`);
console.log(`Wrote ${OUTPUTS.draftRules}`);
console.log(`Wrote ${OUTPUTS.md}`);
