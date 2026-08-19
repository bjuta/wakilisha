import fs from "node:fs";
import path from "node:path";

const DIST_DIR = path.resolve("dist");
const METADATA_PATH = path.join(DIST_DIR, "seo-metadata-manifest.json");
const SITE_NAME = "WAKILISHA";

const hardErrors = [];
const warnings = [];

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function walkFiles(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, predicate, out);
    } else if (predicate(fullPath)) {
      out.push(fullPath);
    }
  }

  return out;
}

function brandCount(value) {
  return (String(value || "").match(/\bWAKILISHA\b/gi) || []).length;
}

function hasDuplicateBrandSuffix(value) {
  const clean = cleanWhitespace(value).replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  return new RegExp(`(?:\\s*[|–—-]\\s*${SITE_NAME}){2,}$`, "i").test(clean);
}

function cleanWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function routeFromHtmlPath(filePath) {
  const relative = path.relative(DIST_DIR, filePath);
  if (relative === "index.html") return "/";
  return `/${relative.replace(/\/index\.html$/, "").replace(/\\/g, "/")}`;
}

function reportError(message) {
  hardErrors.push(message);
}

function reportWarning(message) {
  warnings.push(message);
}

function auditMetadataManifest() {
  if (!fs.existsSync(METADATA_PATH)) {
    reportError(`Missing SEO metadata manifest at ${METADATA_PATH}. Run npm run build first.`);
    return;
  }

  const manifest = JSON.parse(readText(METADATA_PATH));
  const entries = Object.entries(manifest);

  for (const [route, rawEntry] of entries) {
    const entry = rawEntry && typeof rawEntry === "object" ? rawEntry : {};
    const title = cleanWhitespace(entry.title);
    const socialTitle = cleanWhitespace(entry.socialTitle);
    const description = cleanWhitespace(entry.description);
    const entityName = cleanWhitespace(entry.entityName);
    const kind = cleanWhitespace(entry.kind);
    const sourceTable = cleanWhitespace(entry.sourceTable);

    if (!title) reportError(`${route}: missing metadata title.`);
    if (!description) reportWarning(`${route}: missing metadata description.`);

    if (hasDuplicateBrandSuffix(title)) {
      reportError(`${route}: metadata title contains duplicate ${SITE_NAME} branding: "${title}"`);
    }

    if (socialTitle && hasDuplicateBrandSuffix(socialTitle)) {
      reportError(`${route}: social title contains duplicate ${SITE_NAME} branding: "${socialTitle}"`);
    }

    if (description && description.length < 45 && sourceTable) {
      reportWarning(`${route}: metadata description is very short (${description.length} chars).`);
    }

    if (description && description.length > 170) {
      reportWarning(`${route}: metadata description is long (${description.length} chars).`);
    }

    if (sourceTable && ["artist", "track", "release", "playlist", "person"].includes(kind) && !entityName) {
      reportError(`${route}: ${kind} metadata is missing clean entityName.`);
    }

    if (entityName && ["artist", "track", "release", "playlist", "person", "profile"].includes(kind) && brandCount(entityName) > 0) {
      reportError(`${route}: ${kind} entityName should not include ${SITE_NAME}: "${entityName}"`);
    }
  }

  const playlistCollection =
    manifest["/playlists"];

  if (!playlistCollection) {
    reportError(
      "/playlists: missing from SEO metadata manifest.",
    );
  }

  for (
    const [
      route,
      rawEntry,
    ] of entries
  ) {
    const entry =
      rawEntry &&
      typeof rawEntry ===
        "object"
        ? rawEntry
        : {};

    if (
      route.startsWith(
        "/playlists/",
      ) &&
      entry.sourceTable ===
        "public_playlist" &&
      entry.kind !==
        "playlist"
    ) {
      reportError(
        `${route}: public Playlist metadata must use kind playlist.`,
      );
    }

    if (
      route.startsWith(
        "/people/",
      ) &&
      entry.sourceTable ===
        "public_person" &&
      entry.kind !==
        "person"
    ) {
      reportError(
        `${route}: public Person metadata must use kind person.`,
      );
    }

    if (
      route.startsWith(
        "/organizations/",
      ) &&
      entry.sourceTable ===
        "public_organization" &&
      entry.kind !==
        "organization"
    ) {
      reportError(
        `${route}: public Organization metadata must use kind organization.`,
      );
    }
  }

  console.log(`SEO audit: metadata manifest checked ${entries.length.toLocaleString()} entries.`);
}

function extractJsonLdBlocks(html) {
  const blocks = [];
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = regex.exec(html))) {
    const raw = match[1]?.trim();
    if (raw) blocks.push(raw);
  }

  return blocks;
}

function nodesFromJsonLd(value) {
  if (!value || typeof value !== "object") return [];

  if (Array.isArray(value)) {
    return value.flatMap(nodesFromJsonLd);
  }

  const nodes = [value];

  if (Array.isArray(value["@graph"])) {
    nodes.push(...value["@graph"].flatMap(nodesFromJsonLd));
  }

  return nodes;
}

function auditSchemaEntity(route, node) {
  const about = node?.about;
  const aboutItems = Array.isArray(about) ? about : about ? [about] : [];

  for (const item of aboutItems) {
    if (!item || typeof item !== "object") continue;

    const type = String(item["@type"] || "");
    const name = cleanWhitespace(item.name);
    const isMusicEntity = ["MusicGroup", "MusicRecording", "MusicAlbum", "Person"].includes(type);

    if (isMusicEntity && name && brandCount(name) > 0) {
      reportError(`${route}: JSON-LD ${type} entity name contains ${SITE_NAME}: "${name}"`);
    }
  }
}

function auditHtmlFile(filePath) {
  const route = routeFromHtmlPath(filePath);
  const html = readText(filePath);

  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const pageTitle = cleanWhitespace(titleMatch?.[1] || "");

  if (!pageTitle) {
    reportWarning(`${route}: missing <title>.`);
  } else if (hasDuplicateBrandSuffix(pageTitle)) {
    reportError(`${route}: <title> contains duplicate ${SITE_NAME} branding: "${pageTitle}"`);
  }

  const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']*)["']/i);
  const ogTitle = cleanWhitespace(ogTitleMatch?.[1] || "");
  if (ogTitle && hasDuplicateBrandSuffix(ogTitle)) {
    reportError(`${route}: og:title contains duplicate ${SITE_NAME} branding: "${ogTitle}"`);
  }

  const twitterTitleMatch = html.match(/<meta\s+name=["']twitter:title["']\s+content=["']([^"']*)["']/i);
  const twitterTitle = cleanWhitespace(twitterTitleMatch?.[1] || "");
  if (twitterTitle && hasDuplicateBrandSuffix(twitterTitle)) {
    reportError(`${route}: twitter:title contains duplicate ${SITE_NAME} branding: "${twitterTitle}"`);
  }

  const canonicalMatch = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  if (!canonicalMatch) {
    reportWarning(`${route}: missing canonical link.`);
  }

  for (const rawBlock of extractJsonLdBlocks(html)) {
    try {
      const parsed = JSON.parse(rawBlock);
      for (const node of nodesFromJsonLd(parsed)) {
        auditSchemaEntity(route, node);
      }
    } catch (error) {
      reportError(`${route}: invalid JSON-LD block: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

function auditHtmlFiles() {
  const files = walkFiles(DIST_DIR, (filePath) => filePath.endsWith(".html"));
  for (const filePath of files) auditHtmlFile(filePath);
  console.log(`SEO audit: prerendered HTML checked ${files.length.toLocaleString()} files.`);
}

function main() {
  if (!fs.existsSync(DIST_DIR)) {
    reportError("Missing dist directory. Run npm run build first.");
  } else {
    auditMetadataManifest();
    auditHtmlFiles();
  }

  if (warnings.length) {
    console.warn("\nSEO audit warnings:");
    for (const warning of warnings.slice(0, 40)) console.warn(`- ${warning}`);
    if (warnings.length > 40) console.warn(`- ...and ${warnings.length - 40} more warning(s).`);
  }

  if (hardErrors.length) {
    console.error("\nSEO audit failed:");
    for (const error of hardErrors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log("\nSEO audit passed: no hard SEO regressions found.");
}

main();
