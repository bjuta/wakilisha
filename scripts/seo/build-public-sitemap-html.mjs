import fs from "node:fs";
import path from "node:path";

const siteOrigin = "https://wakilisha.africa";
const distDir = path.resolve("dist");
const sitemapXmlPath = path.join(distDir, "sitemap.xml");
const indexHtmlPath = path.join(distDir, "index.html");
const sitemapHtmlPath = path.join(distDir, "sitemap.html");

function fail(message) {
  throw new Error(`[public-sitemap] ${message}`);
}

function readRequired(filePath) {
  if (!fs.existsSync(filePath)) fail(`Missing required file: ${filePath}`);
  return fs.readFileSync(filePath, "utf8");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function titleFromPathname(pathname) {
  if (pathname === "/") return "Home";

  const parts = pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1] || "Page";

  return last
    .replaceAll("-", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function sectionName(group) {
  if (group === "home") return "Core pages";

  return group
    .replaceAll("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function isCanonicalPublicUrl(url) {
  const pathname = new URL(url).pathname;
  const parts = pathname.split("/").filter(Boolean);

  if (parts[0] === "tracks") {
    return parts.length >= 3;
  }

  return true;
}

function isShortTrackUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split("/").filter(Boolean);

    return parts[0] === "tracks" && parts.length === 2;
  } catch {
    return false;
  }
}

function removeNonCanonicalTrackUrlsFromXml(xml) {
  return xml.replace(/\s*<url>[\s\S]*?<\/url>/g, (block) => {
    const match = block.match(/<loc>(.*?)<\/loc>/i);
    const url = match?.[1]?.trim() || "";

    return isShortTrackUrl(url) ? "" : block;
  });
}

function shortTrackUrlsFromXml(xml) {
  return Array.from(xml.matchAll(/<loc>(https:\/\/wakilisha\.africa\/tracks\/[^\/<]+)<\/loc>/g))
    .map((match) => match[1]);
}

function publicUrlFromDistIndex(filePath) {
  const relative = path.relative(distDir, filePath);
  if (!relative.endsWith("index.html")) return null;

  const route = `/${relative.replace(/\/index\.html$/, "").replace(/\\/g, "/")}`;
  if (route === "/index.html") return `${siteOrigin}/`;
  if (route === "/admin" || route.startsWith("/admin/")) return null;
  if (route === "/auth" || route.startsWith("/auth/")) return null;
  if (route === "/profile" || route.startsWith("/profile/")) return null;
  if (route === "/settings" || route.startsWith("/settings/")) return null;
  if (route === "/preview" || route.startsWith("/preview/")) return null;

  return `${siteOrigin}${route === "/" ? "" : route}`;
}

function findDistIndexFiles(dir) {
  const results = [];

  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...findDistIndexFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name === "index.html") {
      results.push(fullPath);
    }
  }

  return results;
}

function ensureUrlInSitemap(xml, url) {
  if (xml.includes(`<loc>${url}</loc>`)) return xml;

  const block = `  <url>
    <loc>${url}</loc>
  </url>
`;

  return xml.replace("</urlset>", `${block}</urlset>`);
}

const sitemapXml = readRequired(sitemapXmlPath);
const indexHtml = readRequired(indexHtmlPath);

const sitemapUrls = Array.from(sitemapXml.matchAll(/<loc>(.*?)<\/loc>/g))
  .map((match) => match[1].trim())
  .filter((url) => url.startsWith(siteOrigin));

const distUrls = findDistIndexFiles(distDir)
  .map(publicUrlFromDistIndex)
  .filter(Boolean);

const urls = uniqueSorted([...sitemapUrls, ...distUrls, `${siteOrigin}/sitemap.html`])
  .filter(isCanonicalPublicUrl)
  .filter((url) => {
    const pathname = new URL(url).pathname;
    return !pathname.startsWith("/admin") &&
      !pathname.startsWith("/auth") &&
      !pathname.startsWith("/profile") &&
      !pathname.startsWith("/settings") &&
      !pathname.startsWith("/preview");
  });

const grouped = new Map();

for (const url of urls) {
  const pathname = new URL(url).pathname;
  const group = pathname === "/" ? "home" : pathname.split("/").filter(Boolean)[0];

  if (!grouped.has(group)) grouped.set(group, []);
  grouped.get(group).push(url);
}

const groupOrder = [
  "home",
  "magazine",
  "artists",
  "releases",
  "playlists",
  "charts",
  "genres",
  "labels",
  "authors",
  "people",
  "categories",
  "tags",
  "about",
  "privacy",
  "terms",
];

const orderedGroups = [
  ...groupOrder.filter((group) => grouped.has(group)),
  ...Array.from(grouped.keys()).filter((group) => !groupOrder.includes(group)).sort(),
];

const sections = orderedGroups.map((group) => {
  const links = grouped.get(group)
    .map((url) => {
      const pathname = new URL(url).pathname || "/";
      return `        <li><a href="${escapeHtml(pathname)}">${escapeHtml(titleFromPathname(pathname))}</a></li>`;
    })
    .join("\n");

  return `      <section>
        <h2>${escapeHtml(sectionName(group))}</h2>
        <ul>
${links}
        </ul>
      </section>`;
}).join("\n");

const publicSitemapHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>WAKILISHA Sitemap</title>
  <meta name="description" content="Links to public WAKILISHA pages.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${siteOrigin}/sitemap.html">
  <style>
    body{font-family:Inter,system-ui,sans-serif;max-width:1120px;margin:0 auto;padding:40px 20px;line-height:1.5;background:#fff;color:#111}
    header{margin-bottom:28px}
    h1{font-size:32px;margin:0 0 8px}
    h2{font-size:18px;margin:28px 0 10px}
    p{color:#555;margin:0}
    ul{columns:3;column-gap:32px;padding-left:18px}
    li{break-inside:avoid;margin:0 0 6px}
    a{color:#111;text-decoration:underline;text-underline-offset:3px}
    @media(max-width:800px){ul{columns:1}}
  </style>
</head>
<body>
  <header>
    <h1>WAKILISHA Sitemap</h1>
    <p>Links to public WAKILISHA pages.</p>
  </header>
  <main>
${sections}
  </main>
</body>
</html>
`;

fs.writeFileSync(sitemapHtmlPath, publicSitemapHtml);

const publicLinksBlock = `<noscript data-wakilisha-public-links>
  <nav aria-label="WAKILISHA public links">
    <a href="/sitemap.html">Sitemap</a>
    <a href="/magazine">Magazine</a>
    <a href="/artists">Artists</a>
    <a href="/releases">Releases</a>
    <a href="/playlists">Playlists</a>
    <a href="/charts">Charts</a>
  </nav>
</noscript>`;

let updatedIndexHtml = indexHtml;

if (!updatedIndexHtml.includes('rel="sitemap"')) {
  updatedIndexHtml = updatedIndexHtml.replace("</head>", `  <link rel="sitemap" type="application/xml" href="/sitemap.xml">\n</head>`);
}

if (!updatedIndexHtml.includes("data-wakilisha-public-links")) {
  updatedIndexHtml = updatedIndexHtml.replace("</body>", `${publicLinksBlock}\n</body>`);
}

fs.writeFileSync(indexHtmlPath, updatedIndexHtml);

const sitemapXmlUrls = uniqueSorted([...urls, `${siteOrigin}/sitemap.html`])
  .filter(isCanonicalPublicUrl);

const updatedSitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapXmlUrls.map((url) => `  <url>
    <loc>${escapeXml(url)}</loc>
  </url>`).join("\n")}
</urlset>
`;

fs.writeFileSync(sitemapXmlPath, updatedSitemapXml);

const finalIndexHtml = readRequired(indexHtmlPath);
const finalSitemapHtml = readRequired(sitemapHtmlPath);
const homepageRequiredLinks = ["/sitemap.html", "/magazine", "/artists", "/releases", "/playlists", "/charts"];

const missingHomepageLinks = homepageRequiredLinks.filter((href) => !finalIndexHtml.includes(`href="${href}"`));
if (missingHomepageLinks.length) fail(`Homepage is missing raw links: ${missingHomepageLinks.join(", ")}`);

const sitemapHtmlLinkCount = (finalSitemapHtml.match(/href="/g) ?? []).length;
if (sitemapHtmlLinkCount < 1000) fail(`sitemap.html has too few links: ${sitemapHtmlLinkCount}`);

const finalSitemapXml = readRequired(sitemapXmlPath);
const shortTrackXmlUrls = shortTrackUrlsFromXml(finalSitemapXml);

if (shortTrackXmlUrls.length) {
  fail(`sitemap.xml still contains non-canonical short track URLs: ${shortTrackXmlUrls.slice(0, 10).join(", ")}`);
}

console.log(`Public sitemap generated: ${sitemapHtmlPath}`);
console.log(`Public sitemap links: ${sitemapHtmlLinkCount}`);
