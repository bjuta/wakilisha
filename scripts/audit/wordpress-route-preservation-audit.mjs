#!/usr/bin/env node

import fs from 'node:fs/promises';

const ORIGIN = process.env.WAKILISHA_LEGACY_ORIGIN || 'https://wakilisha.africa';
const LIMIT = Number(process.env.WAKILISHA_ROUTE_AUDIT_LIMIT || 0);
const CONCURRENCY = Number(process.env.WAKILISHA_ROUTE_AUDIT_CONCURRENCY || 6);

const SEED_PATHS = [
  '/',
  '/charts/',
  '/artists/',
  '/music/',
  '/tag/music/',
  '/category/music/',
  '/author/admin/',
  '/magazine/issues/',
  '/admin/',
  '/wp-login.php',
  '/wp-admin/',
  '/wp-json/',
  '/xmlrpc.php',
];

const SECURITY_EXCLUDED_PREFIXES = [
  '/wp-admin',
  '/wp-login.php',
  '/wp-json',
  '/xmlrpc.php',
  '/.env',
  '/.git',
];

const SITEMAP_CANDIDATES = [
  '/sitemap.xml',
  '/sitemap_index.xml',
  '/wp-sitemap.xml',
  '/post-sitemap.xml',
  '/page-sitemap.xml',
  '/category-sitemap.xml',
  '/post_tag-sitemap.xml',
  '/author-sitemap.xml',
];

function normalizePath(input) {
  try {
    const url = input.startsWith('http') ? new URL(input) : new URL(input, ORIGIN);
    let path = url.pathname || '/';

    if (!path.startsWith('/')) path = `/${path}`;

    return path;
  } catch {
    return null;
  }
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'WAKILISHA route preservation audit',
        'Accept': 'text/html,application/xml,text/xml,*/*',
      },
    });

    const text = await response.text().catch(() => '');
    return {
      ok: response.ok,
      status: response.status,
      url: response.url,
      text,
      contentType: response.headers.get('content-type') || '',
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url,
      text: '',
      contentType: '',
      error: error?.message || String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

function extractSitemapUrls(xml) {
  const urls = [];

  for (const match of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
    const raw = match[1].trim();
    if (raw.startsWith(ORIGIN)) {
      urls.push(raw);
    }
  }

  return urls;
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return '';
  return match[1].replace(/\s+/g, ' ').trim();
}

function classifyRoute(path, status, finalPath, contentType) {
  if (SECURITY_EXCLUDED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return 'security_excluded';
  }

  if (path === '/cart/' || path === '/checkout/') return 'dynamic_legacy_woo_route';

  if (status >= 300 && status < 400) return 'redirect';
  if (status === 404) return 'legacy_404';
  if (status >= 500) return 'server_error';

  if (status === 200) {
    if (contentType.includes('text/html')) return 'preserve_or_map';
    return 'asset_or_non_html';
  }

  if (finalPath && finalPath !== path) return 'redirect_or_rewrite';

  return 'review';
}

async function discoverRoutes() {
  const routes = [...SEED_PATHS];
  const sitemapQueue = [...SITEMAP_CANDIDATES];
  const visitedSitemaps = new Set();

  while (sitemapQueue.length) {
    const sitemapPath = sitemapQueue.shift();
    const sitemapUrl = new URL(sitemapPath, ORIGIN).toString();

    if (visitedSitemaps.has(sitemapUrl)) continue;
    visitedSitemaps.add(sitemapUrl);

    const result = await fetchText(sitemapUrl);
    if (!result.ok || !result.text) continue;

    const urls = extractSitemapUrls(result.text);

    for (const url of urls) {
      const path = normalizePath(url);
      if (!path) continue;

      if (path.endsWith('.xml')) {
        sitemapQueue.push(path);
      } else {
        routes.push(path);
      }
    }
  }

  let uniqueRoutes = uniqueSorted(routes);

  if (LIMIT > 0) {
    uniqueRoutes = uniqueRoutes.slice(0, LIMIT);
  }

  return uniqueRoutes;
}

async function auditOne(path) {
  const originalUrl = new URL(path, ORIGIN).toString();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(originalUrl, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'WAKILISHA route preservation audit',
        'Accept': 'text/html,*/*',
      },
    });

    const text = await response.text().catch(() => '');
    const finalUrl = response.url;
    const finalPath = normalizePath(finalUrl);
    const contentType = response.headers.get('content-type') || '';
    const title = contentType.includes('text/html') ? extractTitle(text) : '';

    return {
      path,
      originalUrl,
      status: response.status,
      finalUrl,
      finalPath,
      contentType,
      title,
      classification: classifyRoute(path, response.status, finalPath, contentType),
    };
  } catch (error) {
    const isDynamicLegacyWooRoute = path === '/cart/' || path === '/checkout/';

    return {
      path,
      originalUrl,
      status: 0,
      finalUrl: originalUrl,
      finalPath: path,
      contentType: '',
      title: '',
      classification: isDynamicLegacyWooRoute ? 'dynamic_legacy_woo_route' : 'fetch_error',
      error: error?.message || String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runPool(items, worker) {
  const results = [];
  let index = 0;

  async function next() {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, next));
  return results;
}

function groupCounts(results) {
  return results.reduce((acc, item) => {
    acc[item.classification] = (acc[item.classification] || 0) + 1;
    return acc;
  }, {});
}

function escapeMarkdownTableCell(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
    .trim();
}

function markdownReport(results) {
  const counts = groupCounts(results);
  const preserve = results.filter((item) => item.classification === 'preserve_or_map');
  const redirects = results.filter((item) => item.classification === 'redirect' || item.finalPath !== item.path);
  const dynamicLegacy = results.filter((item) => item.classification === 'dynamic_legacy_woo_route');
  const errors = results.filter((item) => ['server_error', 'fetch_error'].includes(item.classification));

  const lines = [];

  lines.push('# WordPress Route Preservation Audit');
  lines.push('');
  lines.push(`Origin: ${ORIGIN}`);
  lines.push(`Routes checked: ${results.length}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');

  for (const [key, value] of Object.entries(counts).sort()) {
    lines.push(`- ${key}: ${value}`);
  }

  lines.push('');
  lines.push('## Preserve or map before React cutover');
  lines.push('');
  lines.push('| Status | Path | Title |');
  lines.push('|---:|---|---|');

  for (const item of preserve) {
    lines.push(`| ${item.status} | \`${escapeMarkdownTableCell(item.path)}\` | ${escapeMarkdownTableCell(item.title)} |`);
  }

  lines.push('');
  lines.push('## Redirects or rewritten routes');
  lines.push('');
  lines.push('| Status | Source | Final path |');
  lines.push('|---:|---|---|');

  for (const item of redirects) {
    lines.push(`| ${item.status} | \`${escapeMarkdownTableCell(item.path)}\` | \`${escapeMarkdownTableCell(item.finalPath)}\` |`);
  }

  lines.push('');
  lines.push('## Dynamic legacy WooCommerce routes');
  lines.push('');
  lines.push('These routes should not be treated as ordinary React content pages during cutover. They need a product decision: retire, redirect, rebuild, or preserve behind a legacy store path.');
  lines.push('');
  lines.push('| Status | Path | Note |');
  lines.push('|---:|---|---|');

  for (const item of dynamicLegacy) {
    lines.push(`| ${item.status} | \`${escapeMarkdownTableCell(item.path)}\` | Self-redirecting or dynamic WooCommerce route |`);
  }

  lines.push('');
  lines.push('## Errors needing review');
  lines.push('');
  lines.push('| Status | Path | Error |');
  lines.push('|---:|---|---|');

  for (const item of errors) {
    lines.push(`| ${item.status} | \`${escapeMarkdownTableCell(item.path)}\` | ${escapeMarkdownTableCell(item.error)} |`);
  }

  lines.push('');
  lines.push('## Media import boundary');
  lines.push('');
  lines.push('This audit is for route preservation, not wholesale image importing.');
  lines.push('');
  lines.push('Only old WordPress upload media under /wp-content/uploads/ should be mirrored or rewritten to the Lightsail media origin.');
  lines.push('');
  lines.push('Do not import artist images or other provider-hosted images that already resolve from Spotify CDN, Apple, YouTube, or other provider CDNs unless there is a separate legal/product reason to cache them.');
  lines.push('');
  lines.push('Artist images should continue to use provider CDN URLs where available.');
  lines.push('');
  lines.push('## Cutover rule');
  lines.push('');
  lines.push('Every preserve_or_map route needs one of these before wakilisha.africa points at React:');
  lines.push('');
  lines.push('- Native React route');
  lines.push('- React redirect');
  lines.push('- Static legacy page');
  lines.push('- Explicit intentional 404');

  return `${lines.join('\n')}\n`;
}

const routes = await discoverRoutes();

console.log(`Discovered routes: ${routes.length}`);
console.log(`Concurrency: ${CONCURRENCY}`);

const results = await runPool(routes, async (path, index) => {
  const result = await auditOne(path);
  console.log(`${index + 1}/${routes.length} ${result.status} ${result.classification} ${path}`);
  return result;
});

await fs.writeFile('reports/wordpress-route-preservation-audit.json', `${JSON.stringify(results, null, 2)}\n`);
await fs.writeFile('reports/wordpress-route-preservation-audit.md', markdownReport(results));
await fs.writeFile('reports/wordpress-route-preservation-routes.txt', `${routes.join('\n')}\n`);

console.log('');
console.log('Wrote reports/wordpress-route-preservation-audit.json');
console.log('Wrote reports/wordpress-route-preservation-audit.md');
console.log('Wrote reports/wordpress-route-preservation-routes.txt');
console.log('');
console.log('Summary:');
console.log(groupCounts(results));
