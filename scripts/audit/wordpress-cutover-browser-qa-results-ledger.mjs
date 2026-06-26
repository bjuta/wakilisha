#!/usr/bin/env node

import fs from 'node:fs/promises';

const INPUTS = {
  checklist: 'reports/wordpress-cutover-browser-qa-checklist.json',
};

const OUTPUTS = {
  templateCsv: 'reports/wordpress-cutover-browser-qa-results.template.csv',
  resultsCsv: 'reports/wordpress-cutover-browser-qa-results.csv',
  json: 'reports/wordpress-cutover-browser-qa-results-ledger.json',
  md: 'reports/wordpress-cutover-browser-qa-results-ledger.md',
};

const ALLOWED_STATUSES = new Set([
  'pending',
  'passed',
  'failed',
  'blocked',
  'not_applicable',
  'pending_product_approval',
  'blocked_or_hold',
]);

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

function csvEscape(value) {
  const str = String(value ?? '');

  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

function parseCsvLine(line) {
  const out = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      out.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  out.push(current);
  return out;
}

function parseCsv(text) {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });

    return row;
  });
}

function toCsv(rows) {
  const columns = [
    'id',
    'category',
    'priority',
    'route',
    'url',
    'qaStatus',
    'testedBy',
    'testedAt',
    'device',
    'browser',
    'notes',
    'expectedResult',
    'failureMeans',
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

function countBy(rows, field) {
  return rows.reduce((acc, row) => {
    const key = row[field] || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function buildTemplateRows(checklistRows) {
  return checklistRows.map((row) => ({
    id: row.id,
    category: row.category,
    priority: row.priority,
    route: row.route,
    url: row.url,
    qaStatus: row.qaStatus || 'pending',
    testedBy: '',
    testedAt: '',
    device: '',
    browser: '',
    notes: '',
    expectedResult: row.expectedResult,
    failureMeans: row.failureMeans,
  }));
}

function normalizeResults({ checklistRows, resultRows }) {
  const checklistById = new Map(checklistRows.map((row) => [row.id, row]));
  const resultById = new Map(resultRows.map((row) => [row.id, row]));

  return checklistRows.map((checklistRow) => {
    const resultRow = resultById.get(checklistRow.id) || {};

    return {
      id: checklistRow.id,
      category: checklistRow.category,
      priority: checklistRow.priority,
      route: checklistRow.route,
      url: checklistRow.url,
      qaStatus: resultRow.qaStatus || checklistRow.qaStatus || 'pending',
      testedBy: resultRow.testedBy || '',
      testedAt: resultRow.testedAt || '',
      device: resultRow.device || '',
      browser: resultRow.browser || '',
      notes: resultRow.notes || '',
      expectedResult: checklistRow.expectedResult,
      failureMeans: checklistRow.failureMeans,
    };
  });
}

function validateRows(rows) {
  const issues = [];

  for (const row of rows) {
    if (!ALLOWED_STATUSES.has(row.qaStatus)) {
      issues.push({
        id: row.id,
        issue: `Invalid qaStatus "${row.qaStatus}".`,
        requiredAction: `Use one of: ${Array.from(ALLOWED_STATUSES).sort().join(', ')}.`,
      });
    }

    if (row.qaStatus === 'passed') {
      if (!row.testedBy.trim()) {
        issues.push({
          id: row.id,
          issue: 'Passed row is missing testedBy.',
          requiredAction: 'Add the tester name or initials.',
        });
      }

      if (!row.testedAt.trim()) {
        issues.push({
          id: row.id,
          issue: 'Passed row is missing testedAt.',
          requiredAction: 'Add the test date/time.',
        });
      }

      if (!row.device.trim()) {
        issues.push({
          id: row.id,
          issue: 'Passed row is missing device.',
          requiredAction: 'Add desktop/mobile/device note.',
        });
      }

      if (!row.browser.trim()) {
        issues.push({
          id: row.id,
          issue: 'Passed row is missing browser.',
          requiredAction: 'Add browser name.',
        });
      }
    }

    if (row.qaStatus === 'failed' && !row.notes.trim()) {
      issues.push({
        id: row.id,
        issue: 'Failed row is missing notes.',
        requiredAction: 'Add failure details before gate review.',
      });
    }

    if (row.qaStatus === 'blocked' && !row.notes.trim()) {
      issues.push({
        id: row.id,
        issue: 'Blocked row is missing notes.',
        requiredAction: 'Add blocker details before gate review.',
      });
    }
  }

  return issues;
}

function markdownReport({ usingResultsCsv, summary, statusCounts, priorityCounts, categoryCounts, issues, rows }) {
  const lines = [];

  lines.push('# WordPress Cutover Browser QA Results Ledger');
  lines.push('');
  lines.push('This ledger records human browser QA results for the WordPress to React cutover.');
  lines.push('');
  lines.push('It does not approve DNS, Cloudflare, Supabase, frontend deploy, or production redirect changes.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Using filled results CSV: ${usingResultsCsv ? 'yes' : 'no'}`);
  lines.push(`- Total rows: ${summary.total}`);
  lines.push(`- Passed rows: ${summary.passed}`);
  lines.push(`- Failed rows: ${summary.failed}`);
  lines.push(`- Blocked rows: ${summary.blocked}`);
  lines.push(`- Pending rows: ${summary.pending}`);
  lines.push(`- Critical rows not passed: ${summary.criticalNotPassed}`);
  lines.push(`- Issues: ${summary.issues}`);
  lines.push(`- QA complete: ${summary.qaComplete ? 'yes' : 'no'}`);
  lines.push('');
  lines.push('## Status counts');
  lines.push('');

  for (const [status, count] of Object.entries(statusCounts).sort()) {
    lines.push(`- ${status}: ${count}`);
  }

  lines.push('');
  lines.push('## Priority counts');
  lines.push('');

  for (const [priority, count] of Object.entries(priorityCounts).sort()) {
    lines.push(`- ${priority}: ${count}`);
  }

  lines.push('');
  lines.push('## Category counts');
  lines.push('');

  for (const [category, count] of Object.entries(categoryCounts).sort()) {
    lines.push(`- ${category}: ${count}`);
  }

  lines.push('');
  lines.push('## Issues');
  lines.push('');

  if (issues.length === 0) {
    lines.push('No validation issues.');
  } else {
    lines.push('| ID | Issue | Required action |');
    lines.push('|---|---|---|');

    for (const issue of issues) {
      lines.push(
        `| ${escapeMarkdownCell(issue.id)} | ${escapeMarkdownCell(issue.issue)} | ${escapeMarkdownCell(issue.requiredAction)} |`
      );
    }
  }

  lines.push('');
  lines.push('## Critical rows not passed');
  lines.push('');
  lines.push('| ID | Category | Route | Status | Notes |');
  lines.push('|---|---|---|---|---|');

  for (const row of rows.filter((item) => item.priority === 'critical' && item.qaStatus !== 'passed')) {
    lines.push(
      `| ${escapeMarkdownCell(row.id)} | ${escapeMarkdownCell(row.category)} | \`${escapeMarkdownCell(row.route)}\` | ${escapeMarkdownCell(row.qaStatus)} | ${escapeMarkdownCell(row.notes)} |`
    );
  }

  lines.push('');
  lines.push('## How to fill');
  lines.push('');
  lines.push('Copy `reports/wordpress-cutover-browser-qa-results.template.csv` to `reports/wordpress-cutover-browser-qa-results.csv`, then fill `qaStatus`, `testedBy`, `testedAt`, `device`, `browser`, and `notes`.');
  lines.push('');
  lines.push('Allowed `qaStatus` values:');
  lines.push('');
  lines.push(Array.from(ALLOWED_STATUSES).sort().map((status) => `- ${status}`).join('\n'));
  lines.push('');
  lines.push('## Deployment checklist');
  lines.push('');
  lines.push('```text');
  lines.push('SQL migration needed: No');
  lines.push('Supabase Edge Function deploy needed: No');
  lines.push('Readdy Finish update needed: No');
  lines.push('Frontend deploy needed: No');
  lines.push('Cloudflare/DNS change needed: No');
  lines.push('This is a QA-results artifact only.');
  lines.push('```');

  return `${lines.join('\n')}\n`;
}

const checklist = await readJson(INPUTS.checklist);
const checklistRows = checklist.rows || [];
const templateRows = buildTemplateRows(checklistRows);

await fs.writeFile(OUTPUTS.templateCsv, toCsv(templateRows));

const usingResultsCsv = await exists(OUTPUTS.resultsCsv);
const resultRows = usingResultsCsv
  ? parseCsv(await fs.readFile(OUTPUTS.resultsCsv, 'utf8'))
  : templateRows;

const rows = normalizeResults({ checklistRows, resultRows });
const issues = validateRows(rows);

const summary = {
  total: rows.length,
  passed: rows.filter((row) => row.qaStatus === 'passed').length,
  failed: rows.filter((row) => row.qaStatus === 'failed').length,
  blocked: rows.filter((row) => row.qaStatus === 'blocked' || row.qaStatus === 'blocked_or_hold').length,
  pending: rows.filter((row) => row.qaStatus === 'pending' || row.qaStatus === 'pending_product_approval').length,
  criticalNotPassed: rows.filter((row) => row.priority === 'critical' && row.qaStatus !== 'passed').length,
  issues: issues.length,
  qaComplete:
    issues.length === 0 &&
    rows.filter((row) => ['pending', 'pending_product_approval', 'blocked', 'blocked_or_hold', 'failed'].includes(row.qaStatus)).length === 0 &&
    rows.filter((row) => row.priority === 'critical' && row.qaStatus !== 'passed').length === 0,
};

const output = {
  generatedAt: new Date().toISOString(),
  usingResultsCsv,
  allowedStatuses: Array.from(ALLOWED_STATUSES).sort(),
  summary,
  statusCounts: countBy(rows, 'qaStatus'),
  priorityCounts: countBy(rows, 'priority'),
  categoryCounts: countBy(rows, 'category'),
  issues,
  rows,
};

await fs.writeFile(OUTPUTS.json, `${JSON.stringify(output, null, 2)}\n`);
await fs.writeFile(
  OUTPUTS.md,
  markdownReport({
    usingResultsCsv,
    summary,
    statusCounts: output.statusCounts,
    priorityCounts: output.priorityCounts,
    categoryCounts: output.categoryCounts,
    issues,
    rows,
  })
);

console.log('WordPress cutover browser QA results ledger generated.');
console.log('');
console.log('Summary:');
console.log(summary);
console.log('');
console.log(`Using filled results CSV: ${usingResultsCsv ? 'yes' : 'no'}`);
console.log(`Wrote ${OUTPUTS.templateCsv}`);
console.log(`Wrote ${OUTPUTS.json}`);
console.log(`Wrote ${OUTPUTS.md}`);

if (!summary.qaComplete) {
  process.exitCode = 1;
}
