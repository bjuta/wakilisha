#!/usr/bin/env node
// Rehydrate an accepted public SEO build without accessing Production APIs.
// This is a CODE-ONLY release bridge. Publication/correction requires a fresh,
// separately accepted snapshot, not reuse of a potentially superseded snapshot.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SOURCE = process.env.WAKILISHA_ACCEPTED_PRERENDER_DIR || "";
const EXPECTED_SHA = (process.env.WAKILISHA_ACCEPTED_PRERENDER_SHA256 || "").toLowerCase();
const OUTPUT = path.resolve("dist");
const INDEX_NAME = "wakilisha-accepted-prerender-index.json";
const REQUIRED = ["index.html", "magazine/index.html", "seo-metadata-manifest.json", "public-magazine-fallback.json", "sitemap.xml"];
const ORIGIN = "https://wakilisha.africa";

function fail(message) {
  throw new Error("[accepted-prerender] " + message);
}

function digest(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function read(root, relative) {
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep)) fail("Path escapes accepted snapshot: " + relative);
  if (!fs.existsSync(file) || !fs.lstatSync(file).isFile()) fail("Missing or unsafe file: " + relative);
  return fs.readFileSync(file);
}

function htmlPaths(root, relative = "") {
  const directory = path.join(root, relative);
  const results = [];
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    if (item.isSymbolicLink()) fail("Symlink forbidden in accepted snapshot: " + item.name);
    const next = path.posix.join(relative, item.name);
    if (item.isDirectory()) results.push(...htmlPaths(root, next));
    else if (item.isFile() && item.name === "index.html") results.push(next);
  }
  return results;
}

function validateMaterial(root) {
  for (const name of REQUIRED) read(root, name);
  const metadata = JSON.parse(read(root, "seo-metadata-manifest.json").toString("utf8"));
  const fallback = JSON.parse(read(root, "public-magazine-fallback.json").toString("utf8"));
  const sitemap = read(root, "sitemap.xml").toString("utf8");
  if (!metadata || typeof metadata !== "object" || !Object.keys(metadata).length) fail("Empty SEO metadata manifest");
  if (!Array.isArray(fallback.stories) || !fallback.stories.length) fail("Empty Magazine fallback");
  if (!sitemap.includes("<urlset") || !sitemap.includes("<loc>")) fail("Invalid sitemap XML");
  return [...new Set([...REQUIRED, ...htmlPaths(root)])].sort();
}

function routeFromFile(relative) {
  return relative === "index.html" ? "/" : "/" + relative.slice(0, -"/index.html".length);
}

function extractSeo(html, route) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];
  if (!head) fail("Missing head for " + route);
  const jsonld = /<script\s+id="wk-jsonld-primary"\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i;
  const script = jsonld.exec(head);
  const titleStart = head.lastIndexOf("<title>", script?.index ?? 0);
  if (!script || titleStart < 0) fail("Missing accepted SEO / JSON-LD for " + route);
  try { JSON.parse(script[1]); } catch { fail("Unparseable accepted JSON-LD for " + route); }
  const block = head.slice(titleStart, script.index + script[0].length);
  const canonicals = [...block.matchAll(/<link\s+rel="canonical"\s+href="([^"]+)"[^>]*>/gi)];
  if (canonicals.length !== 1) fail("Missing or duplicate canonical for " + route);
  if (canonicals[0][1] !== ORIGIN + route) fail("Canonical route mismatch: " + route);
  if ([...block.matchAll(/<script\b/gi)].length !== 1) fail("Unexpected script in accepted SEO for " + route);
  if (!/<meta\s+name="robots"/i.test(block) || !/<meta\s+property="og:title"/i.test(block)) fail("Incomplete SEO for " + route);
  return block;
}

function stripDefaultSeo(html) {
  return html
    .replace(/\n?\s*<title>[\s\S]*?<\/title>/i, "")
    .replace(/\n?\s*<meta\s+name="(?:description|robots|twitter:card|twitter:title|twitter:description|twitter:image|twitter:image:alt|twitter:site)"[^>]*>/gi, "")
    .replace(/\n?\s*<meta\s+property="(?:og:site_name|og:title|og:description|og:type|og:url|og:image|og:image:secure_url|og:image:width|og:image:height|og:image:alt)"[^>]*>/gi, "")
    .replace(/\n?\s*<link\s+rel="canonical"[^>]*>/gi, "")
    .replace(/\n?\s*<link\b[^>]*data-wakilisha-lcp-preload="(?:article|artist|release|magazine)"[^>]*>/gi, "")
    .replace(/\n?\s*<script\s+id="wk-jsonld-primary"[^>]*>[\s\S]*?<\/script>/gi, "");
}

function magazineBody(sourceHtml, acceptedFallback, route) {
  if (route !== "/" && route !== "/magazine") return "";
  const inline = sourceHtml.match(/<script\s+id="wk-magazine-fallback"\s+type="application\/json">([\s\S]*?)<\/script>/i);
  if (!inline) fail("Missing accepted Magazine inline fallback for " + route);
  let parsed;
  try { parsed = JSON.parse(inline[1]); } catch { fail("Unparseable Magazine inline fallback for " + route); }
  if (JSON.stringify(parsed) !== JSON.stringify(acceptedFallback)) fail("Magazine inline fallback differs from accepted JSON for " + route);
  const hero = sourceHtml.match(/<link\b(?=[^>]*data-wakilisha-lcp-preload="magazine")[^>]*>/i)?.[0] || "";
  if (route === "/magazine" && !hero) fail("Missing Magazine hero LCP preload");
  return (hero ? hero + "\n" : "") + inline[0] + "\n";
}

function main() {
  const mode = process.argv[2];
  if (!["--seal", "--check", "--restore"].includes(mode)) fail("Use --seal, --check or --restore");
  if (!SOURCE || !path.isAbsolute(SOURCE)) fail("WAKILISHA_ACCEPTED_PRERENDER_DIR must be an absolute path");
  const root = fs.realpathSync(SOURCE);
  if (root === OUTPUT || root.startsWith(OUTPUT + path.sep)) fail("Accepted snapshot must be outside fresh dist");
  const files = validateMaterial(root);

  if (mode === "--seal") {
    const records = Object.fromEntries(files.map(name => [name, digest(read(root, name))]));
    const index = JSON.stringify({ format: 1, files: records }, null, 2) + "\n";
    fs.writeFileSync(path.join(root, INDEX_NAME), index, { flag: "wx", mode: 0o600 });
    console.log("ACCEPTED_PRERENDER_SHA256=" + digest(index));
    console.log("ACCEPTED_PRERENDER_FILES=" + files.length);
    return;
  }

  if (!/^[a-f0-9]{64}$/.test(EXPECTED_SHA)) fail("Missing pinned WAKILISHA_ACCEPTED_PRERENDER_SHA256");
  const indexText = read(root, INDEX_NAME).toString("utf8");
  if (digest(indexText) !== EXPECTED_SHA) fail("Accepted snapshot index SHA256 mismatch");
  const index = JSON.parse(indexText);
  if (index.format !== 1 || !index.files || Object.keys(index.files).length !== files.length) fail("Invalid snapshot inventory");
  for (const file of files) {
    if (index.files[file] !== digest(read(root, file))) fail("Accepted snapshot file changed: " + file);
  }
  console.log("ACCEPTED_PRERENDER_INTEGRITY=PASS files=" + files.length);
  if (mode === "--check") return;

  if (!fs.existsSync(path.join(OUTPUT, "index.html"))) fail("Fresh Vite dist missing; run vite build first");
  const baseHtml = fs.readFileSync(path.join(OUTPUT, "index.html"), "utf8");
  if (!baseHtml.includes("</head>") || !baseHtml.includes("</body>")) fail("Invalid fresh Vite document shell");
  const cleanBase = stripDefaultSeo(baseHtml);
  const acceptedFallback = JSON.parse(read(root, "public-magazine-fallback.json").toString("utf8"));

  let restored = 0;
  for (const relative of files.filter(name => name.endsWith("/index.html") || name === "index.html")) {
    const route = routeFromFile(relative);
    const oldHtml = read(root, relative).toString("utf8");
    const seo = extractSeo(oldHtml, route);
    const additions = magazineBody(oldHtml, acceptedFallback, route);
    let html = cleanBase.replace("</head>", seo + "\n  </head>");
    if (additions) html = html.replace("</body>", additions + "</body>");
    const target = path.join(OUTPUT, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, html);
    restored++;
  }

  for (const file of REQUIRED.filter(name => !name.endsWith(".html"))) {
    fs.copyFileSync(path.join(root, file), path.join(OUTPUT, file));
  }
  console.log("ACCEPTED_PRERENDER_RESTORED=" + restored);
  console.log("ACCEPTED_PRERENDER_NETWORK_READS=0");
}

try { main(); } catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
