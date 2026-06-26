import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const INCLUDE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".sql",
  ".html",
  ".css",
]);

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  ".vite",
  ".next",
  "coverage",
  "supabase/.temp",
]);

const NEEDLES = [
  "wp-content/uploads",
  "wakilisha.africa/wp-content",
  "/wp-content/",
  "wpImageRewrite",
  "rewriteWpImageUrl",
  "article-media/wp-import",
  "media_assets",
  "featured_image",
  "artwork_url",
  "image_url",
  "cover_image",
  "thumbnail",
];

function shouldSkipDir(relativePath) {
  return [...SKIP_DIRS].some((skip) => relativePath === skip || relativePath.startsWith(`${skip}${path.sep}`));
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    const relative = path.relative(ROOT, absolute);

    if (entry.isDirectory()) {
      if (!shouldSkipDir(relative)) walk(absolute, files);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!INCLUDE_EXTENSIONS.has(path.extname(entry.name))) continue;

    files.push(absolute);
  }

  return files;
}

function classify(relativePath, line) {
  const lower = `${relativePath} ${line}`.toLowerCase();

  if (lower.includes("wpimagerrewrite") || lower.includes("wpimagerewrite") || lower.includes("rewritewpimageurl")) {
    return "rewrite_service";
  }

  if (lower.includes("wp-content/uploads") || lower.includes("/wp-content/")) {
    return "direct_wp_upload_reference";
  }

  if (lower.includes("article-media/wp-import")) {
    return "supabase_import_path_reference";
  }

  if (
    lower.includes("featured_image") ||
    lower.includes("artwork_url") ||
    lower.includes("image_url") ||
    lower.includes("cover_image") ||
    lower.includes("thumbnail")
  ) {
    return "media_field_reference";
  }

  if (lower.includes("media_assets")) {
    return "media_asset_table_reference";
  }

  return "other_media_reference";
}

const results = [];
const files = walk(ROOT);

for (const absolute of files) {
  const relative = path.relative(ROOT, absolute);
  const content = fs.readFileSync(absolute, "utf8");
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (NEEDLES.some((needle) => line.includes(needle))) {
      results.push({
        file: relative,
        line: index + 1,
        category: classify(relative, line),
        text: line.trim().slice(0, 220),
      });
    }
  });
}

const grouped = results.reduce((acc, result) => {
  acc[result.category] ??= [];
  acc[result.category].push(result);
  return acc;
}, {});

const categoryOrder = [
  "direct_wp_upload_reference",
  "rewrite_service",
  "supabase_import_path_reference",
  "media_asset_table_reference",
  "media_field_reference",
  "other_media_reference",
];

const lines = [];
lines.push("# WordPress Media Dependency Audit");
lines.push("");
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push("");
lines.push("## Summary");
lines.push("");
lines.push(`- Total hits: ${results.length}`);
for (const category of categoryOrder) {
  lines.push(`- ${category}: ${(grouped[category] ?? []).length}`);
}
lines.push("");
lines.push("## Shutdown decision");
lines.push("");
lines.push("Do not block or redirect `/wp-content/uploads/*` yet.");
lines.push("");
lines.push("The correct next phase is to mirror WordPress uploads to the Lightsail-backed media origin, verify coverage, then change Cloudflare routing for `/wp-content/uploads/*`.");
lines.push("");
lines.push("Supabase Storage should not be the permanent media destination for imported and future WAKILISHA media.");
lines.push("");
lines.push("## Required next phase");
lines.push("");
lines.push("1. Export or crawl all WordPress upload URLs currently referenced by app data.");
lines.push("2. Mirror files to the Lightsail media origin.");
lines.push("3. Verify every referenced URL resolves on the new media origin.");
lines.push("4. Keep the existing rewrite logic until verified data no longer depends on old WordPress media URLs.");
lines.push("5. Only then route `/wp-content/uploads/*` at Cloudflare.");
lines.push("");
lines.push("## Findings");
lines.push("");

for (const category of categoryOrder) {
  const items = grouped[category] ?? [];
  if (!items.length) continue;

  lines.push(`### ${category}`);
  lines.push("");

  for (const item of items.slice(0, 200)) {
    lines.push(`- \`${item.file}:${item.line}\` — ${item.text}`);
  }

  if (items.length > 200) {
    lines.push(`- ... ${items.length - 200} more hits omitted from this section.`);
  }

  lines.push("");
}

fs.writeFileSync("reports/wordpress-media-dependency-audit.md", `${lines.join("\n").trim()}\n`);

console.log("WordPress media dependency audit complete.");
console.log(`Total hits: ${results.length}`);
for (const category of categoryOrder) {
  console.log(`${category}: ${(grouped[category] ?? []).length}`);
}
console.log("Report: reports/wordpress-media-dependency-audit.md");
