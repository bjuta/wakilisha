import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const INCLUDE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".sql", ".html", ".css"]);
const SKIP_DIRS = new Set([".git", "node_modules", "dist", ".vite", ".next", "coverage", "supabase/.temp"]);
const URL_OR_PATH_PATTERN = /(?:https?:\/\/[^"'\s)]+)?\/wp-content\/uploads\/[^\s"'`)<>]+/g;

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

    if (entry.isFile() && INCLUDE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(absolute);
    }
  }

  return files;
}

function normalizePath(match) {
  const cleaned = match.replace(/[),.;]+$/, "");
  if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
    try {
      return new URL(cleaned).pathname;
    } catch {
      return cleaned;
    }
  }

  return cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
}

const found = new Map();

for (const absolute of walk(ROOT)) {
  const relative = path.relative(ROOT, absolute);
  const lines = fs.readFileSync(absolute, "utf8").split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const match of line.match(URL_OR_PATH_PATTERN) ?? []) {
      const pathname = normalizePath(match);
      if (!pathname.startsWith("/wp-content/uploads/")) continue;

      const current = found.get(pathname) ?? { path: pathname, sources: [] };
      current.sources.push({ file: relative, line: index + 1, raw: match });
      found.set(pathname, current);
    }
  });
}

const items = [...found.values()].sort((a, b) => a.path.localeCompare(b.path));
const manifest = {
  generatedAt: new Date().toISOString(),
  total: items.length,
  items,
};

fs.writeFileSync("reports/wordpress-media-url-manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync("reports/wordpress-media-url-manifest.txt", `${items.map((item) => item.path).join("\n")}${items.length ? "\n" : ""}`);

console.log("WordPress media URL manifest generated.");
console.log(`Unique upload paths: ${items.length}`);
console.log("JSON: reports/wordpress-media-url-manifest.json");
console.log("TXT: reports/wordpress-media-url-manifest.txt");

if (items.length === 0) {
  console.warn("No upload paths found in repo files. Database extraction may still be needed.");
}
