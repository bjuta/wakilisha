#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const AUDIT_PATH = 'reports/wordpress-route-preservation-audit.json';
const DIST_DIR = 'dist';

function stripTrailingSlash(route) {
  if (!route || route === '/') return '/';
  return route.endsWith('/') ? route.slice(0, -1) : route;
}

function normalizeRoute(route) {
  if (!route) return '/';
  let next = route.trim();

  if (!next.startsWith('/')) next = `/${next}`;

  next = next.replace(/\/index\.html$/, '/');
  next = next.replace(/\.html$/, '');
  next = next.replace(/\/+/g, '/');

  return stripTrailingSlash(next);
}

function routeToDistCandidates(route) {
  const normalized = normalizeRoute(route);

  if (normalized === '/') {
    return ['dist/index.html'];
  }

  return [
    path.join(DIST_DIR, `${normalized}.html`),
    path.join(DIST_DIR, normalized, 'index.html'),
  ];
}

async function exists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
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

function hasReactRoute(route, reactRoutes) {
  const normalized = normalizeRoute(route);
  return reactRoutes.has(normalized);
}

function inferArtistRedirect(route, reactRoutes) {
  const match = normalizeRoute(route).match(/^\/artist\/([^/]+)$/);
  if (!match) return null;

  const target = `/artists/${match[1]}`;

  return {
    target,
    confidence: hasReactRoute(target, reactRoutes) ? 'high' : 'medium',
    decision: hasReactRoute(target, reactRoutes) ? 'redirect_to_react_route' : 'redirect_candidate',
    note: 'Legacy singular /artist/ route should map to React plural /artists/ route.',
  };
}

function inferAuthorRedirect(route, reactRoutes) {
  const normalized = normalizeRoute(route);
  const match = normalized.match(/^\/author\/([^/]+)(?:\/page\/(\d+))?$/);
  if (!match) return null;

  const slug = match[1];
  const page = match[2];

  const target = page ? `/authors/${slug}?page=${page}` : `/authors/${slug}`;

  return {
    target,
    confidence: hasReactRoute(`/authors/${slug}`, reactRoutes) ? 'medium' : 'low',
    decision: hasReactRoute(`/authors/${slug}`, reactRoutes) ? 'redirect_to_react_route' : 'manual_review',
    note: page
      ? 'Legacy paginated author archive needs React author pagination decision.'
      : 'Legacy author archive should map to React author profile/archive if supported.',
  };
}


function inferLegacySectionRoute(route, reactRoutes) {
  const normalized = normalizeRoute(route);

  const legacySections = new Set([
    '/album-reviews',
    '/art',
    '/art-design',
    '/blog-newspaper',
    '/film',
    '/journal',
    '/lifestyle',
    '/literature',
    '/literature/short-stories',
    '/music',
    '/opinion',
    '/plan',
    '/plan/archive',
    '/science-and-technology',
    '/short-stories',
    '/sports',
  ]);

  if (!legacySections.has(normalized)) return null;

  const target = normalized === '/music' ? '/music' : '/magazine';
  const targetExists = hasReactRoute(target, reactRoutes);

  return {
    target,
    confidence: targetExists ? 'medium' : 'low',
    decision: targetExists ? 'redirect_candidate' : 'manual_review',
    note: 'Legacy WordPress section/archive route. Decide whether to rebuild the archive, redirect to a React section, or intentionally retire it.',
  };
}

function inferTagRoute(route) {
  const normalized = normalizeRoute(route);
  const match = normalized.match(/^\/tag\/([^/]+)(?:\/page\/(\d+))?$/);
  if (!match) return null;

  return {
    target: `/search?tag=${encodeURIComponent(match[1])}`,
    confidence: 'low',
    decision: 'manual_review',
    note: 'Legacy tag archive needs product decision: rebuild tag pages, redirect to search, or intentional 404.',
  };
}

function inferCategoryRoute(route, reactRoutes) {
  const normalized = normalizeRoute(route);
  const match = normalized.match(/^\/category\/([^/]+)$/);
  if (!match) return null;

  const slug = match[1];
  const target = `/${slug}`;

  return {
    target,
    confidence: hasReactRoute(target, reactRoutes) ? 'high' : 'medium',
    decision: hasReactRoute(target, reactRoutes) ? 'redirect_to_react_route' : 'redirect_candidate',
    note: 'Legacy WordPress category archive should map to equivalent top-level React section where available.',
  };
}

function inferChartRoute(route, reactRoutes) {
  const normalized = normalizeRoute(route);

  if (!normalized.startsWith('/charts')) return null;

  if (hasReactRoute(normalized, reactRoutes)) {
    return {
      target: normalized,
      confidence: 'high',
      decision: 'native_react_route',
      note: 'Chart route exists in React prerender output.',
    };
  }

  return {
    target: normalized,
    confidence: 'medium',
    decision: 'manual_review',
    note: 'Chart route should be tested against React runtime routing, not only prerender output.',
  };
}

function inferKnownStaticRoute(route, reactRoutes) {
  const normalized = normalizeRoute(route);

  const knownRedirects = new Map([
    ['/', '/'],
    ['/about', '/about'],
    ['/account', '/account'],
    ['/contacts', '/contact'],
    ['/contact', '/contact'],
    ['/corrections', '/corrections'],
    ['/duka', '/'],
    ['/events', '/events'],
    ['/faq', '/faq'],
    ['/login', '/auth'],
    ['/methodology', '/methodology'],
    ['/my-account', '/account'],
    ['/my-library', '/library'],
    ['/my-top-10', '/my-top-10'],
    ['/news-resources', '/magazine'],
    ['/order-tracking', '/account'],
    ['/privacy', '/privacy'],
    ['/privacy-policy', '/privacy'],
    ['/profile', '/profile'],
    ['/public-profile', '/profile'],
    ['/registry', '/charts'],
    ['/settings', '/settings'],
    ['/shop', '/'],
    ['/venues', '/venues'],
  ]);

  if (!knownRedirects.has(normalized)) return null;

  const target = knownRedirects.get(normalized);
  const targetExists = hasReactRoute(target, reactRoutes);

  return {
    target,
    confidence: targetExists ? 'high' : 'medium',
    decision: targetExists ? 'redirect_to_react_route' : 'manual_review',
    note: targetExists
      ? 'Known legacy static/account route has a matching React destination.'
      : 'Known legacy static/account route needs explicit React route or redirect decision.',
  };
}

function inferArticleRoute(route, reactRoutes) {
  const normalized = normalizeRoute(route);

  if (
    normalized.startsWith('/tag/') ||
    normalized.startsWith('/artist/') ||
    normalized.startsWith('/author/') ||
    normalized.startsWith('/category/') ||
    normalized.startsWith('/charts')
  ) {
    return null;
  }

  if (normalized.split('/').filter(Boolean).length === 1) {
    const target = `/magazine/${normalized.slice(1)}`;
    const targetExists = hasReactRoute(target, reactRoutes);

    return {
      target,
      confidence: targetExists ? 'high' : 'low',
      decision: targetExists ? 'redirect_to_react_route' : 'manual_review',
      note: targetExists
        ? 'Legacy article/page slug has a matching React magazine route.'
        : 'Likely legacy article/page slug. Decide whether to import as magazine article, redirect to new article URL, preserve static HTML, or intentional 404.',
    };
  }

  return null;
}

function classifyCutover(item, reactRoutes) {
  const route = normalizeRoute(item.path);

  if (item.classification === 'security_excluded') {
    return {
      legacyPath: item.path,
      title: item.title || '',
      auditClassification: item.classification,
      legacyStatus: item.status,
      cutoverDecision: 'keep_blocked',
      targetPath: '',
      confidence: 'high',
      notes: 'Security-sensitive WordPress endpoint should remain blocked after cutover.',
    };
  }

  if (item.classification === 'legacy_404') {
    return {
      legacyPath: item.path,
      title: item.title || '',
      auditClassification: item.classification,
      legacyStatus: item.status,
      cutoverDecision: 'intentional_404',
      targetPath: '',
      confidence: 'high',
      notes: 'Already 404 on legacy site. Preserve as intentional 404 unless product decides otherwise.',
    };
  }

  if (item.classification === 'dynamic_legacy_woo_route') {
    return {
      legacyPath: item.path,
      title: item.title || '',
      auditClassification: item.classification,
      legacyStatus: item.status,
      cutoverDecision: 'product_decision_required',
      targetPath: '',
      confidence: 'high',
      notes: 'Dynamic WooCommerce route. Decide whether to retire, rebuild, redirect, or preserve behind a legacy store path.',
    };
  }

  if (item.classification !== 'preserve_or_map') {
    return {
      legacyPath: item.path,
      title: item.title || '',
      auditClassification: item.classification,
      legacyStatus: item.status,
      cutoverDecision: 'ignore_for_html_cutover',
      targetPath: '',
      confidence: 'high',
      notes: 'Not an HTML content route for React cutover.',
    };
  }

  if (hasReactRoute(route, reactRoutes)) {
    return {
      legacyPath: item.path,
      title: item.title || '',
      auditClassification: item.classification,
      legacyStatus: item.status,
      cutoverDecision: 'native_react_route',
      targetPath: route,
      confidence: 'high',
      notes: 'Exact route exists in current React prerender output.',
    };
  }

  const inference =
    inferArtistRedirect(route, reactRoutes) ||
    inferAuthorRedirect(route, reactRoutes) ||
    inferCategoryRoute(route, reactRoutes) ||
    inferChartRoute(route, reactRoutes) ||
    inferKnownStaticRoute(route, reactRoutes) ||
    inferLegacySectionRoute(route, reactRoutes) ||
    inferTagRoute(route) ||
    inferArticleRoute(route, reactRoutes);

  if (inference) {
    return {
      legacyPath: item.path,
      title: item.title || '',
      auditClassification: item.classification,
      legacyStatus: item.status,
      cutoverDecision: inference.decision,
      targetPath: inference.target,
      confidence: inference.confidence,
      notes: inference.note,
    };
  }

  return {
    legacyPath: item.path,
    title: item.title || '',
    auditClassification: item.classification,
    legacyStatus: item.status,
    cutoverDecision: 'manual_review',
    targetPath: '',
    confidence: 'low',
    notes: 'No safe automatic mapping inferred.',
  };
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || 'unknown';
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

function toCsv(items) {
  const columns = [
    'legacyPath',
    'legacyStatus',
    'auditClassification',
    'cutoverDecision',
    'targetPath',
    'confidence',
    'title',
    'notes',
  ];

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

function markdownReport(items, reactRoutes) {
  const decisionCounts = countBy(items, 'cutoverDecision');
  const confidenceCounts = countBy(items, 'confidence');

  const blockers = items.filter((item) =>
    ['manual_review', 'product_decision_required', 'redirect_candidate'].includes(item.cutoverDecision)
  );

  const lines = [];

  lines.push('# WordPress → React Route Parity Map');
  lines.push('');
  lines.push(`React prerender routes found: ${reactRoutes.size}`);
  lines.push(`Legacy audit rows mapped: ${items.length}`);
  lines.push('');
  lines.push('## Decision summary');
  lines.push('');

  for (const [key, value] of Object.entries(decisionCounts).sort()) {
    lines.push(`- ${key}: ${value}`);
  }

  lines.push('');
  lines.push('## Confidence summary');
  lines.push('');

  for (const [key, value] of Object.entries(confidenceCounts).sort()) {
    lines.push(`- ${key}: ${value}`);
  }

  lines.push('');
  lines.push('## Cutover blockers');
  lines.push('');
  lines.push('These rows need a human/product decision before wakilisha.africa points at React.');
  lines.push('');
  lines.push('| Decision | Legacy path | Target | Confidence | Notes |');
  lines.push('|---|---|---|---|---|');

  for (const item of blockers) {
    lines.push(
      `| ${escapeMarkdownCell(item.cutoverDecision)} | \`${escapeMarkdownCell(item.legacyPath)}\` | ${escapeMarkdownCell(item.targetPath)} | ${escapeMarkdownCell(item.confidence)} | ${escapeMarkdownCell(item.notes)} |`
    );
  }

  lines.push('');
  lines.push('## Media import boundary');
  lines.push('');
  lines.push('This map is about route cutover only.');
  lines.push('');
  lines.push('Do not import provider-hosted artist images such as Spotify CDN images by default.');
  lines.push('');
  lines.push('Only old WordPress upload media under /wp-content/uploads/ belongs in the media mirror/rewrite workstream.');

  return `${lines.join('\n')}\n`;
}

const auditRaw = await fs.readFile(AUDIT_PATH, 'utf8');
const auditRows = JSON.parse(auditRaw);

const htmlFiles = await walkHtml(DIST_DIR);
const reactRoutes = new Set(htmlFiles.map(distHtmlPathToRoute));

const mappedRows = auditRows.map((item) => classifyCutover(item, reactRoutes));

await fs.writeFile(
  'reports/wordpress-react-route-parity-map.json',
  `${JSON.stringify(mappedRows, null, 2)}\n`
);

await fs.writeFile(
  'reports/wordpress-react-route-parity-map.csv',
  toCsv(mappedRows)
);

await fs.writeFile(
  'reports/wordpress-react-route-parity-map.md',
  markdownReport(mappedRows, reactRoutes)
);

console.log('React prerender routes found:', reactRoutes.size);
console.log('Legacy audit rows mapped:', mappedRows.length);
console.log('');
console.log('Decision summary:');
console.log(countBy(mappedRows, 'cutoverDecision'));
console.log('');
console.log('Confidence summary:');
console.log(countBy(mappedRows, 'confidence'));
console.log('');
console.log('Wrote reports/wordpress-react-route-parity-map.json');
console.log('Wrote reports/wordpress-react-route-parity-map.csv');
console.log('Wrote reports/wordpress-react-route-parity-map.md');
