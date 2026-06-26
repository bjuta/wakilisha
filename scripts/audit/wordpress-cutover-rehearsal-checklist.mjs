#!/usr/bin/env node

import fs from 'node:fs/promises';

const INPUTS = {
  redirectPlan: 'reports/wordpress-cutover-redirect-plan.json',
  tagPolicy: 'reports/wordpress-tag-archive-cutover-policy.json',
  authorStaticPolicy: 'reports/wordpress-author-static-cutover-policy.json',
  remainingPolicy: 'reports/wordpress-remaining-blocker-cutover-policy.json',
};

const OUTPUTS = {
  json: 'reports/wordpress-cutover-rehearsal-checklist.json',
  md: 'reports/wordpress-cutover-rehearsal-checklist.md',
  txt: 'reports/wordpress-cutover-rehearsal-commands.txt',
};

const CUTOVER_STATUS = {
  redirectStatus: 302,
  productionDomain: 'https://wakilisha.africa',
  mediaOrigin: 'https://media.wakilisha.africa',
  oldUploadsPath: '/wp-content/uploads/',
  cleanUploadsPath: '/uploads/',
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

function getSummary(source) {
  return source?.summary || {};
}

function escapeMarkdownCell(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
    .trim();
}

function checkbox(label, checked = false) {
  return `- [${checked ? 'x' : ' '}] ${label}`;
}

function block(lines) {
  return ['```bash', ...lines, '```'].join('\n');
}

function textBlock(lines) {
  return ['```text', ...lines, '```'].join('\n');
}

function commandReport({ redirectPlan, tagPolicy, authorStaticPolicy, remainingPolicy }) {
  const lines = [];

  lines.push('# WordPress Cutover Rehearsal Commands');
  lines.push('# Do not run DNS/IP changes from this file.');
  lines.push('# This file is for pre-cutover verification only.');
  lines.push('');

  lines.push('# 1. Confirm repo is clean and current');
  lines.push('cd ~/Desktop/wakilisha-supabase-deploy');
  lines.push('git checkout main');
  lines.push('git pull origin main');
  lines.push('git status --short');
  lines.push('');

  lines.push('# 2. Build React and regenerate prerender output');
  lines.push('npm run build');
  lines.push('');

  lines.push('# 3. Re-run planning audits');
  lines.push('node scripts/audit/wordpress-cutover-redirect-plan.mjs');
  lines.push('node scripts/audit/wordpress-tag-archive-cutover-policy.mjs');
  lines.push('node scripts/audit/wordpress-author-static-cutover-policy.mjs');
  lines.push('node scripts/audit/wordpress-remaining-blocker-cutover-policy.mjs');
  lines.push('node scripts/audit/wordpress-cutover-rehearsal-checklist.mjs');
  lines.push('');

  lines.push('# 4. Confirm media origin still serves clean URLs');
  lines.push('curl -I -L https://media.wakilisha.africa/uploads/2025/07/wakilisha-logo_black_v2-2026.png');
  lines.push('');

  lines.push('# 5. Confirm old WordPress media URLs still redirect to clean media origin');
  lines.push('curl -I -L https://wakilisha.africa/wp-content/uploads/2025/07/wakilisha-logo_black_v2-2026.png');
  lines.push('');

  lines.push('# 6. Confirm old WordPress security endpoints remain blocked before cutover');
  lines.push('curl -I https://wakilisha.africa/wp-login.php');
  lines.push('curl -I https://wakilisha.africa/xmlrpc.php');
  lines.push('curl -I https://wakilisha.africa/wp-json/');
  lines.push('');

  lines.push('# 7. Runtime chart smoke test targets after React preview/cutover URL exists');
  for (const item of remainingPolicy.runtimeVerification || []) {
    lines.push(`# curl -I <REACT_PREVIEW_OR_CUTOVER_ORIGIN>${item.target}`);
  }

  lines.push('');
  lines.push('# 8. Do not apply these redirects before final go/no-go approval');
  lines.push(`# Safe article/artist redirects from cutover plan: ${redirectPlan.summary.safeRedirects}`);
  lines.push(`# Tag redirect candidates: ${tagPolicy.summary.redirectCandidates}`);
  lines.push(`# Author/static redirect candidates: ${authorStaticPolicy.summary.redirectCandidates}`);
  lines.push(`# Remaining blocker redirect candidates: ${remainingPolicy.summary.redirectCandidates}`);

  return `${lines.join('\n')}\n`;
}

function markdownReport({ redirectPlan, tagPolicy, authorStaticPolicy, remainingPolicy, optionalFiles }) {
  const redirectSummary = getSummary(redirectPlan);
  const tagSummary = getSummary(tagPolicy);
  const authorStaticSummary = getSummary(authorStaticPolicy);
  const remainingSummary = getSummary(remainingPolicy);

  const totalDraftRedirects =
    Number(redirectSummary.safeRedirects || 0) +
    Number(tagSummary.redirectCandidates || 0) +
    Number(authorStaticSummary.redirectCandidates || 0) +
    Number(remainingSummary.redirectCandidates || 0);

  const unresolvedRows =
    Number(tagSummary.manualReview || 0) +
    Number(authorStaticSummary.manualReview || 0) +
    Number(authorStaticSummary.productDecision || 0) +
    Number(remainingSummary.manualReview || 0) +
    Number(remainingSummary.productDecision || 0) +
    Number(remainingSummary.runtimeVerification || 0);

  const lines = [];

  lines.push('# WordPress to React Cutover Rehearsal Checklist');
  lines.push('');
  lines.push('This is a rehearsal document only. It must not be treated as approval to change DNS, IP routing, or Cloudflare production redirects.');
  lines.push('');
  lines.push('Use 302 temporary redirects first. Do not use 301 until the new React surface has been observed in production and analytics/search behavior is stable.');
  lines.push('');
  lines.push('## Current cutover posture');
  lines.push('');
  lines.push(`- Production domain: ${CUTOVER_STATUS.productionDomain}`);
  lines.push(`- Clean media origin: ${CUTOVER_STATUS.mediaOrigin}`);
  lines.push(`- Temporary redirect status: ${CUTOVER_STATUS.redirectStatus}`);
  lines.push(`- Draft redirect rows currently planned: ${totalDraftRedirects}`);
  lines.push(`- Unresolved/manual/product/runtime rows still requiring decision or smoke test: ${unresolvedRows}`);
  lines.push('');
  lines.push('## Source reports included');
  lines.push('');
  lines.push('| Report | Present |');
  lines.push('|---|---|');

  for (const [label, present] of Object.entries(optionalFiles)) {
    lines.push(`| ${escapeMarkdownCell(label)} | ${present ? 'yes' : 'no'} |`);
  }

  lines.push('');
  lines.push('## Planning summary');
  lines.push('');
  lines.push('| Workstream | Ready redirects | Manual review | Product decision | Runtime verification | Notes |');
  lines.push('|---|---:|---:|---:|---:|---|');
  lines.push(`| Base redirect plan | ${redirectSummary.safeRedirects || 0} | ${redirectSummary.blockers || 0} | 0 | 0 | Safe article/artist redirects only. |`);
  lines.push(`| Tag archives | ${tagSummary.redirectCandidates || 0} | ${tagSummary.manualReview || 0} | 0 | 0 | Search replaces old WordPress tag archives. |`);
  lines.push(`| Author/static routes | ${authorStaticSummary.redirectCandidates || 0} | ${authorStaticSummary.manualReview || 0} | ${authorStaticSummary.productDecision || 0} | 0 | No safe redirects yet. Author slugs need mapping. |`);
  lines.push(`| Remaining blockers | ${remainingSummary.redirectCandidates || 0} | ${remainingSummary.manualReview || 0} | ${remainingSummary.productDecision || 0} | ${remainingSummary.runtimeVerification || 0} | Sections, charts, WooCommerce, missing article. |`);
  lines.push('');
  lines.push('## Go/no-go checklist');
  lines.push('');
  lines.push(checkbox('React production build passes with no hard SEO audit failures.'));
  lines.push(checkbox('Old WordPress media URLs redirect to the clean media origin with final 200 responses.'));
  lines.push(checkbox('Clean media origin serves `/uploads/...` URLs directly.'));
  lines.push(checkbox('WordPress security endpoints remain blocked: `/wp-login.php`, `/xmlrpc.php`, `/wp-json/`.'));
  lines.push(checkbox('All safe article/artist redirects are still 302, not 301.'));
  lines.push(checkbox('Tag archive redirect policy is accepted: `/tag/<slug>/` to `/search?tag=<label>`.'));
  lines.push(checkbox('The 2 malformed tag routes are explicitly retired, fixed, or manually mapped.'));
  lines.push(checkbox('Author archive decision is made: map author slugs, redirect to magazine, or retire.'));
  lines.push(checkbox('Static/account route decision is made for account, library, top 10, settings, order tracking.'));
  lines.push(checkbox('Legacy section archive decision is made for 16 old WordPress sections.'));
  lines.push(checkbox('WooCommerce cart/checkout decision is made: retire, rebuild, redirect, or preserve legacy store path.'));
  lines.push(checkbox('`/claim-your-name/` decision is made: import, redirect, preserve static HTML, or intentional 404.'));
  lines.push(checkbox('Chart runtime routes pass smoke tests on the React preview/cutover origin.'));
  lines.push(checkbox('Rollback path is confirmed before IP/DNS switch.'));
  lines.push('');
  lines.push('## Pre-cutover terminal checks');
  lines.push('');
  lines.push(block([
    'cd ~/Desktop/wakilisha-supabase-deploy',
    '',
    'git checkout main',
    'git pull origin main',
    'git status --short',
    '',
    'npm run build',
    '',
    'node scripts/audit/wordpress-cutover-redirect-plan.mjs',
    'node scripts/audit/wordpress-tag-archive-cutover-policy.mjs',
    'node scripts/audit/wordpress-author-static-cutover-policy.mjs',
    'node scripts/audit/wordpress-remaining-blocker-cutover-policy.mjs',
    'node scripts/audit/wordpress-cutover-rehearsal-checklist.mjs',
    '',
    'git diff --check',
  ]));
  lines.push('');
  lines.push('## Media checks');
  lines.push('');
  lines.push(block([
    'curl -I -L https://media.wakilisha.africa/uploads/2025/07/wakilisha-logo_black_v2-2026.png',
    'curl -I -L https://wakilisha.africa/wp-content/uploads/2025/07/wakilisha-logo_black_v2-2026.png',
  ]));
  lines.push('');
  lines.push('Expected result: clean media URL returns 200, old WordPress upload URL redirects to clean media origin and ends at 200.');
  lines.push('');
  lines.push('## Security endpoint checks');
  lines.push('');
  lines.push(block([
    'curl -I https://wakilisha.africa/wp-login.php',
    'curl -I https://wakilisha.africa/xmlrpc.php',
    'curl -I https://wakilisha.africa/wp-json/',
    'curl -I https://wakilisha.africa/.env',
    'curl -I https://wakilisha.africa/.git/config',
  ]));
  lines.push('');
  lines.push('Expected result: blocked, redirected to safe 404, or otherwise unavailable. None should expose WordPress/admin/private content.');
  lines.push('');
  lines.push('## Runtime chart smoke tests');
  lines.push('');
  lines.push('Run these against the React preview/cutover origin, not the old WordPress origin.');
  lines.push('');
  lines.push('| Path | Expected |');
  lines.push('|---|---|');

  for (const item of remainingPolicy.runtimeVerification || []) {
    lines.push(`| \`${escapeMarkdownCell(item.target)}\` | React chart page renders without legacy WordPress dependency. |`);
  }

  lines.push('');
  lines.push('## Decisions still required before cutover');
  lines.push('');
  lines.push('### Malformed tag routes');
  lines.push('');

  for (const item of tagPolicy.manualReview || []) {
    lines.push(`- \`${item.source}\` → proposed \`${item.target}\`: ${item.reason}`);
  }

  lines.push('');
  lines.push('### Author/static routes');
  lines.push('');
  lines.push(`- Manual review rows: ${authorStaticSummary.manualReview || 0}`);
  lines.push(`- Product decision rows: ${authorStaticSummary.productDecision || 0}`);
  lines.push('');
  lines.push('Author archives should not be automatically redirected until WordPress username slugs are mapped to real React author slugs.');
  lines.push('');
  lines.push('### Remaining blockers');
  lines.push('');
  lines.push(`- Legacy section archive rows: ${remainingPolicy.blockerTypeCounts?.legacy_section_archive || 0}`);
  lines.push(`- Missing article rows: ${remainingPolicy.blockerTypeCounts?.legacy_article_missing_react_route || 0}`);
  lines.push(`- WooCommerce rows: ${remainingPolicy.blockerTypeCounts?.woocommerce_dynamic_route || 0}`);
  lines.push(`- Chart runtime rows: ${remainingPolicy.blockerTypeCounts?.chart_runtime_route || 0}`);
  lines.push('');
  lines.push('## Redirect application rule');
  lines.push('');
  lines.push('Do not apply redirect rules directly from the CSV files without a final rehearsal pass.');
  lines.push('');
  lines.push('Initial production redirect status must be 302 temporary redirects only.');
  lines.push('');
  lines.push('Eligible redirect sources after decision approval:');
  lines.push('');
  lines.push('- `reports/wordpress-cutover-draft-redirect-rules.txt`');
  lines.push('- `reports/wordpress-tag-archive-draft-redirect-rules.txt`');
  lines.push('- no author/static redirects yet');
  lines.push('- no remaining-blocker redirects yet');
  lines.push('');
  lines.push('## Rollback plan');
  lines.push('');
  lines.push(checkbox('Record the current Lightsail/Cloudflare DNS/IP state before cutover.'));
  lines.push(checkbox('Keep the old WordPress origin reachable until React cutover has passed smoke tests.'));
  lines.push(checkbox('Keep media origin independent from the app origin.'));
  lines.push(checkbox('If React fails core smoke tests, point DNS/IP back to old WordPress origin.'));
  lines.push(checkbox('If media fails, disable the upload redirect and restore old WordPress upload handling.'));
  lines.push(checkbox('If redirects loop or break SEO paths, disable new redirect rules and keep only security/media rules.'));
  lines.push('');
  lines.push('## Deployment checklist');
  lines.push('');
  lines.push(textBlock([
    'SQL migration needed: No',
    'Supabase Edge Function deploy needed: No',
    'Readdy Finish update needed: No',
    'Frontend deploy needed: No',
    'Cloudflare/DNS change needed: No',
    'This is a planning artifact only.',
  ]));
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

const redirectPlan = await readJson(INPUTS.redirectPlan);
const tagPolicy = await readJson(INPUTS.tagPolicy);
const authorStaticPolicy = await readJson(INPUTS.authorStaticPolicy);
const remainingPolicy = await readJson(INPUTS.remainingPolicy);

const optionalFiles = {
  [INPUTS.redirectPlan]: await exists(INPUTS.redirectPlan),
  [INPUTS.tagPolicy]: await exists(INPUTS.tagPolicy),
  [INPUTS.authorStaticPolicy]: await exists(INPUTS.authorStaticPolicy),
  [INPUTS.remainingPolicy]: await exists(INPUTS.remainingPolicy),
  'reports/lightsail-media-cutover-status.md': await exists('reports/lightsail-media-cutover-status.md'),
  'reports/lightsail-clean-media-url-manifest.txt': await exists('reports/lightsail-clean-media-url-manifest.txt'),
  'reports/wordpress-live-media-url-manifest.txt': await exists('reports/wordpress-live-media-url-manifest.txt'),
};

const redirectSummary = getSummary(redirectPlan);
const tagSummary = getSummary(tagPolicy);
const authorStaticSummary = getSummary(authorStaticPolicy);
const remainingSummary = getSummary(remainingPolicy);

const output = {
  generatedAt: new Date().toISOString(),
  cutoverStatus: CUTOVER_STATUS,
  optionalFiles,
  summary: {
    safeBaseRedirects: redirectSummary.safeRedirects || 0,
    tagRedirectCandidates: tagSummary.redirectCandidates || 0,
    authorStaticRedirectCandidates: authorStaticSummary.redirectCandidates || 0,
    remainingRedirectCandidates: remainingSummary.redirectCandidates || 0,
    totalDraftRedirects:
      Number(redirectSummary.safeRedirects || 0) +
      Number(tagSummary.redirectCandidates || 0) +
      Number(authorStaticSummary.redirectCandidates || 0) +
      Number(remainingSummary.redirectCandidates || 0),
    malformedTagManualReview: tagSummary.manualReview || 0,
    authorStaticManualReview: authorStaticSummary.manualReview || 0,
    authorStaticProductDecision: authorStaticSummary.productDecision || 0,
    remainingManualReview: remainingSummary.manualReview || 0,
    remainingProductDecision: remainingSummary.productDecision || 0,
    remainingRuntimeVerification: remainingSummary.runtimeVerification || 0,
  },
  goNoGo: {
    mayCutOverNow: false,
    reason: 'Cutover still requires manual product decisions and runtime chart verification.',
  },
};

await fs.writeFile(OUTPUTS.json, `${JSON.stringify(output, null, 2)}\n`);
await fs.writeFile(
  OUTPUTS.md,
  markdownReport({ redirectPlan, tagPolicy, authorStaticPolicy, remainingPolicy, optionalFiles })
);
await fs.writeFile(
  OUTPUTS.txt,
  commandReport({ redirectPlan, tagPolicy, authorStaticPolicy, remainingPolicy })
);

console.log('WordPress cutover rehearsal checklist generated.');
console.log('');
console.log('Summary:');
console.log(output.summary);
console.log('');
console.log('Go/no-go:');
console.log(output.goNoGo);
console.log('');
console.log(`Wrote ${OUTPUTS.json}`);
console.log(`Wrote ${OUTPUTS.md}`);
console.log(`Wrote ${OUTPUTS.txt}`);
