#!/usr/bin/env node
// Offline publication authority comparator. This does not acquire authority:
// the two SHA-pinned receipts must come from a separately governed source read.
// A code-only Vite build must never call this script to fetch live content.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://wakilisha.africa';
const HEX = /^[a-f0-9]{64}$/;
const SURFACES = Object.freeze([
  'static', 'magazine', 'artists', 'releases', 'tracks',
  'genres', 'labels', 'guides', 'briefings', 'charts',
  'playlists', 'people', 'organizations', 'taxonomy', 'authors',
]);
const REASONS = new Set(['withdrawn', 'private', 'superseded', 'redirected']);
const MAX_ROUTES = 6000;

function stop(message) { throw new Error('[governed-publication] ' + message); }
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function isObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function validHash(v, label) { if (typeof v !== 'string' || !HEX.test(v)) stop('Invalid ' + label); }
function validPath(p, label) {
  if (typeof p !== 'string' || !p.startsWith('/') || p.startsWith('//') || p.length > 320 || p.includes('?') || p.includes('#') || p.includes('\\') || p.includes('%') || /\/\//.test(p) || (p !== '/' && p.endsWith('/')) || p.split('/').some(s => s === '.' || s === '..') || /[\u0000-\u001f\u007f]/.test(p)) stop('Invalid canonical path in ' + label);
  if (/^\/(admin|auth|settings|preview|following|messages|start)(\/|$)/.test(p)) stop('Private route in ' + label + ': ' + p);
  return p;
}
function keyOf(record) { return record.source + ':' + record.subjectId; }
function verifyReceipt(receipt, label) {
  if (!isObject(receipt) || receipt.format !== 1 || receipt.origin !== ORIGIN || receipt.complete !== true) stop('Invalid or incomplete receipt: ' + label);
  validHash(receipt.sourceEpoch, label + ' source epoch');
  if (typeof receipt.capturedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(receipt.capturedAt) || !Number.isFinite(Date.parse(receipt.capturedAt))) stop('Invalid capture instant: ' + label);
  if (!isObject(receipt.surfaces) || Object.keys(receipt.surfaces).length !== SURFACES.length) stop('Incomplete source surface set: ' + label);
  for (const surface of SURFACES) {
    const s = receipt.surfaces[surface];
    if (!isObject(s) || s.complete !== true || s.sourceEpoch !== receipt.sourceEpoch || !Number.isSafeInteger(s.rowCount) || s.rowCount < 0 || s.rowCount > 1000000) stop('Incomplete source scan: ' + label + '/' + surface);
    validHash(s.digest, label + '/' + surface + ' source digest');
  }
  if (Object.keys(receipt.surfaces).some(s => !SURFACES.includes(s))) stop('Unknown source scan in ' + label);
  if (!Array.isArray(receipt.routes) || !Array.isArray(receipt.retired) || receipt.routes.length > MAX_ROUTES || receipt.retired.length > MAX_ROUTES) stop('Invalid route inventory: ' + label);
  const paths = new Set();
  const subjects = new Set();
  for (const [i, record] of receipt.routes.entries()) {
    if (!isObject(record) || !SURFACES.includes(record.source) || typeof record.subjectId !== 'string' || !/^[a-zA-Z0-9_:.-]{1,160}$/.test(record.subjectId)) stop('Invalid route source at ' + label + '/' + i);
    validPath(record.path, label + '/routes');
    validHash(record.revision, label + ' source revision ' + record.path);
    validHash(record.seoSha256, label + ' rendered SEO digest ' + record.path);
    if (paths.has(record.path) || subjects.has(keyOf(record))) stop('Duplicate route or subject in ' + label + ': ' + record.path);
    paths.add(record.path); subjects.add(keyOf(record));
  }
  for (const [i, record] of receipt.retired.entries()) {
    if (!isObject(record) || !SURFACES.includes(record.source) || typeof record.subjectId !== 'string' || !/^[a-zA-Z0-9_:.-]{1,160}$/.test(record.subjectId) || !REASONS.has(record.reason)) stop('Invalid retirement receipt at ' + label + '/' + i);
    validPath(record.path, label + '/retired');
    validHash(record.eventSha256, label + ' retirement event ' + record.path);
    if (paths.has(record.path)) stop('Active/retired route collision in ' + label + ': ' + record.path);
    paths.add(record.path);
    if ((record.reason === 'withdrawn' || record.reason === 'private') && subjects.has(keyOf(record))) stop('Nonpublic subject still has active route: ' + record.path);
    if (record.reason === 'redirected') {
      validPath(record.target, label + '/redirect');
      if (record.target === record.path) stop('Self redirect in ' + label);
      const next = receipt.routes.find(r => r.path === record.target && keyOf(r) === keyOf(record));
      if (!next) stop('Redirect target missing or changes subject: ' + record.path);
    } else if (Object.hasOwn(record, 'target')) stop('Unexpected target for nonredirect retirement: ' + record.path);
  }
  return receipt;
}
function differences(accepted, current) {
  verifyReceipt(accepted, 'accepted'); verifyReceipt(current, 'current');
  if (Date.parse(current.capturedAt) < Date.parse(accepted.capturedAt)) stop('Current receipt predates accepted publication');
  const issues = [];
  for (const s of SURFACES) {
    if (accepted.surfaces[s].digest !== current.surfaces[s].digest || accepted.surfaces[s].rowCount !== current.surfaces[s].rowCount) issues.push('SOURCE_CHANGED ' + s);
  }
  const a = new Map(accepted.routes.map(x => [x.path, x]));
  const b = new Map(current.routes.map(x => [x.path, x]));
  const tombstones = new Map(current.retired.map(x => [x.path, x]));
  for (const [route, old] of a) {
    const now = b.get(route);
    if (!now) {
      const retired = tombstones.get(route);
      if (!retired || keyOf(retired) !== keyOf(old)) stop('Route disappeared without exact governed retirement: ' + route);
      issues.push('ROUTE_RETIRED ' + route + ' reason=' + retired.reason);
    } else if (keyOf(old) !== keyOf(now)) {
      stop('Canonical path reused for a different subject: ' + route);
    } else if (old.revision !== now.revision || old.seoSha256 !== now.seoSha256) {
      issues.push('ROUTE_CHANGED ' + route);
    }
  }
  for (const route of b.keys()) if (!a.has(route)) issues.push('ROUTE_ADDED ' + route);
  for (const [route, old] of accepted.retired.map(x => [x.path, x])) {
    const now = tombstones.get(route);
    if (!now || keyOf(old) !== keyOf(now) || old.eventSha256 !== now.eventSha256 || old.reason !== now.reason || old.target !== now.target) stop('Retired path resurrection or changed history: ' + route);
  }
  if (issues.length && accepted.sourceEpoch === current.sourceEpoch) stop('Content changed inside one source epoch');
  return issues.sort();
}
function safeRead(root, relative) {
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(root + path.sep)) stop('Artifact path escaped root: ' + relative);
  const stat = fs.lstatSync(absolute, { throwIfNoEntry: false });
  if (!stat || !stat.isFile() || stat.isSymbolicLink()) stop('Artifact missing or unsafe: ' + relative);
  if (!fs.realpathSync(absolute).startsWith(root + path.sep)) stop('Artifact symlink escapes root: ' + relative);
  return fs.readFileSync(absolute, 'utf8');
}
function extractSeo(html, route) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];
  const script = head && /<script\s+id="wk-jsonld-primary"\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i.exec(head);
  const title = head?.lastIndexOf('<title>', script?.index ?? 0) ?? -1;
  if (!head || !script || title < 0) stop('Accepted route missing SEO: ' + route);
  const block = head.slice(title, script.index + script[0].length);
  const links = [...block.matchAll(/<link\s+rel="canonical"\s+href="([^"]+)"[^>]*>/gi)];
  if (links.length !== 1 || links[0][1] !== ORIGIN + route) stop('Canonical mismatch: ' + route);
  if (!/<meta\s+name="robots"\s+content="index, follow"/i.test(block)) stop('Not indexable: ' + route);
  let jsonld;
  try { jsonld = JSON.parse(script[1]); } catch { stop('Invalid JSON-LD: ' + route); }
  if (!isObject(jsonld) && !Array.isArray(jsonld)) stop('Invalid JSON-LD document: ' + route);
  return sha256(block);
}
function auditArtifact(rootDir, current) {
  verifyReceipt(current, 'current');
  const root = fs.realpathSync(rootDir);
  const manifest = JSON.parse(safeRead(root, 'seo-metadata-manifest.json'));
  const xml = safeRead(root, 'sitemap.xml');
  if (!isObject(manifest)) stop('Missing SEO manifest');
  const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const sitemapRoutes = new Set(locations);
  const expectedUrls = new Set(current.routes.map(r => ORIGIN + r.path));
  if (locations.length !== sitemapRoutes.size) stop('Duplicate sitemap canonical route');
  for (const route of current.routes) {
    const relative = route.path === '/' ? 'index.html' : route.path.slice(1) + '/index.html';
    const actual = extractSeo(safeRead(root, relative), route.path);
    if (actual !== route.seoSha256) stop('Rendered SEO source digest mismatch: ' + route.path);
    if (!sitemapRoutes.has(ORIGIN + route.path)) stop('Public route missing from sitemap: ' + route.path);
  }
  for (const url of sitemapRoutes) {
    if (!url.startsWith(ORIGIN + '/')) stop('Foreign sitemap authority: ' + url);
    if (!expectedUrls.has(url)) stop('Unlisted public sitemap route: ' + url);
  }
  for (const retired of current.retired) {
    const relative = retired.path === '/' ? 'index.html' : retired.path.slice(1) + '/index.html';
    if (fs.existsSync(path.join(root, relative))) stop('Retired route still has public HTML: ' + retired.path);
    if (sitemapRoutes.has(ORIGIN + retired.path) || Object.hasOwn(manifest, retired.path)) stop('Retired route still publicly indexed: ' + retired.path);
  }
  return current.routes.length;
}
function readPinnedJson(filename, hash, label) {
  validHash(hash, label + ' expected sha256');
  const stat = fs.lstatSync(filename, { throwIfNoEntry: false });
  if (!stat || !stat.isFile() || stat.isSymbolicLink()) stop('Missing or unsafe receipt: ' + label);
  const bytes = fs.readFileSync(filename);
  if (sha256(bytes) !== hash) stop(label + ' receipt hash mismatch');
  return verifyReceipt(JSON.parse(bytes.toString('utf8')), label);
}
function main() {
  if (process.argv.length !== 6 || !['--plan', '--verify'].includes(process.argv[2])) stop('Use --plan|--verify ACCEPTED.json CURRENT.json SNAPSHOT_DIR');
  const accepted = readPinnedJson(process.argv[3], process.env.WAKILISHA_ACCEPTED_PUBLICATION_SHA256, 'accepted');
  const current = readPinnedJson(process.argv[4], process.env.WAKILISHA_CURRENT_PUBLICATION_SHA256, 'current');
  const issues = differences(accepted, current);
  console.log('GOVERNED_PUBLICATION_SOURCE_DIFF=' + issues.length);
  for (const issue of issues.slice(0, 30)) console.log(issue);
  if (issues.length) stop('Publication authority changed; generate a new independently accepted snapshot. Do not reuse old HTML.');
  if (process.argv[2] === '--verify') {
    const count = auditArtifact(process.argv[5], current);
    console.log('GOVERNED_PUBLICATION_ARTIFACT_ROUTES=' + count);
    console.log('GOVERNED_PUBLICATION_ARTIFACT_PARITY=PASS');
  }
  console.log('GOVERNED_PUBLICATION_RECEIPT_PARITY=PASS');
  console.log('PRODUCTION_NETWORK_READS=0');
}

export { SURFACES, verifyReceipt, differences, extractSeo, auditArtifact };
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (err) { console.error(err instanceof Error ? err.message : String(err)); process.exitCode = 1; }
}
