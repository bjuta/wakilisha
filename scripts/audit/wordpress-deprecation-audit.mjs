import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const repoFiles = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((path) => !path.startsWith("dist/"))
  .filter((path) => !path.startsWith("node_modules/"))
  .filter((path) => !path.startsWith("reports/wordpress-deprecation-grep.txt"));

const patterns = [
  /wp-content/i,
  /wp-json/i,
  /wp-admin/i,
  /wp-login/i,
  /xmlrpc/i,
  /wordpress/i,
  /wp_wkcharts/i,
  /wp_posts/i,
  /wp-db-stage/i,
  /wp-connect-proxy/i,
  /process-wp-import/i,
  /finalize-wp-staging/i,
  /create-wp-run/i,
  /bitnami_wordpress/i,
  /bn_wordpress/i,
  /wakilisha\.africa\/wp/i,
];

function classify(path, line) {
  const haystack = `${path} ${line}`;

  if (
    path === ".env.local.template" ||
    path.includes("charts-api-env") ||
    /VITE_.*wordpress|WP_API|CHARTS_PUBLIC_MODE=wordpress/i.test(haystack)
  ) {
    return "runtime_config_risk";
  }

  if (
    path === "src/services/wpImageRewrite.ts" ||
    path.includes("migrate-wp-images") ||
    path.includes("migrate-media-from-wp") ||
    path.includes("backfill-article-hero-storage") ||
    /wp-content|uploads/i.test(haystack)
  ) {
    return "media_storage_risk";
  }

  if (
    path === "src/pages/LegacyArticleRedirect.tsx" ||
    path === "src/router/config.tsx" ||
    path.startsWith("public/") ||
    /legacy.*redirect|slug redirect|wp-login|wp-admin|xmlrpc/i.test(haystack)
  ) {
    return "public_route_redirect_risk";
  }

  if (
    path.startsWith("src/pages/admin/") ||
    path === "src/services/wordpressConnectService.ts" ||
    path.startsWith("src/services/legacyImport/") ||
    path.includes("admin/imports") ||
    path.includes("MediaPicker") ||
    path.includes("MediaLibrary")
  ) {
    return "admin_runtime_import_risk";
  }

  if (
    path.startsWith("supabase/functions/") &&
    /wp|wordpress|import|migrate|backfill/i.test(path)
  ) {
    return "supabase_legacy_function_risk";
  }

  if (
    path.startsWith("scripts/") ||
    path.startsWith("packages/migration/") ||
    path.startsWith("packages/db/") ||
    path.startsWith("database/migrations/") ||
    path.startsWith("supabase/migrations/")
  ) {
    return "migration_archive_reference";
  }

  if (path.startsWith("docs/")) {
    return "docs_only_reference";
  }

  return "needs_manual_review";
}

const hits = [];

for (const path of repoFiles) {
  if (!existsSync(path)) continue;

  let text = "";
  try {
    text = readFileSync(path, "utf8");
  } catch {
    continue;
  }

  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!patterns.some((pattern) => pattern.test(line))) return;
    hits.push({
      bucket: classify(path, line),
      path,
      lineNumber: index + 1,
      line: line.trim().slice(0, 260),
    });
  });
}

const buckets = [
  "runtime_config_risk",
  "public_route_redirect_risk",
  "media_storage_risk",
  "admin_runtime_import_risk",
  "supabase_legacy_function_risk",
  "migration_archive_reference",
  "docs_only_reference",
  "needs_manual_review",
];

const grouped = new Map();
for (const bucket of buckets) grouped.set(bucket, []);
for (const hit of hits) grouped.get(hit.bucket).push(hit);

const now = new Date().toISOString();

let md = "";
md += `# WordPress Deprecation Audit\n\n`;
md += `Generated: ${now}\n\n`;
md += `## Decision\n\n`;
md += `Do not fully deprecate the old WordPress server until public redirects, media storage, and legacy import access are resolved.\n\n`;
md += `Media storage direction: do not expand long-term media storage on Supabase Storage. Use AWS Lightsail-backed media storage/origin for imported and future media because Supabase storage is constrained.\n\n`;
md += `## Summary Counts\n\n`;
md += `| Bucket | Hits |\n|---|---:|\n`;
for (const bucket of buckets) {
  md += `| ${bucket} | ${grouped.get(bucket).length} |\n`;
}

md += `\n## Highest Priority Buckets\n\n`;
md += `1. runtime_config_risk — env/config can route runtime code toward WordPress mode.\n`;
md += `2. public_route_redirect_risk — old public URLs need permanent redirects or explicit blocks.\n`;
md += `3. media_storage_risk — old wp-content/uploads URLs must move to Lightsail-backed media storage before WP shutdown.\n`;
md += `4. admin_runtime_import_risk — admin import tools still reference WordPress and should be hidden behind a legacy flag.\n`;
md += `5. supabase_legacy_function_risk — deployed legacy functions should be inventoried before disabling WordPress.\n\n`;

for (const bucket of buckets) {
  const rows = grouped.get(bucket);
  md += `## ${bucket}\n\n`;
  if (rows.length === 0) {
    md += `No hits.\n\n`;
    continue;
  }

  const byFile = new Map();
  for (const row of rows) {
    byFile.set(row.path, (byFile.get(row.path) || 0) + 1);
  }

  md += `### Files by hit count\n\n`;
  md += `| File | Hits |\n|---|---:|\n`;
  for (const [file, count] of [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)) {
    md += `| \`${file}\` | ${count} |\n`;
  }

  md += `\n### Sample hits\n\n`;
  for (const row of rows.slice(0, 40)) {
    md += `- \`${row.path}:${row.lineNumber}\` — ${row.line}\n`;
  }

  md += `\n`;
}

md += `## Recommended Next PRs\n\n`;
md += `1. Add this audit guardrail and keep it runnable.\n`;
md += `2. Add Cloudflare redirect/block plan for old WP routes.\n`;
md += `3. Add media migration plan targeting AWS Lightsail media storage/origin, not Supabase Storage.\n`;
md += `4. Hide legacy WordPress import tools behind an explicit admin legacy flag.\n`;
md += `5. After verification, freeze WordPress and keep only a controlled archive window.\n`;

writeFileSync("reports/wordpress-deprecation-audit.md", md);
console.log(`WordPress deprecation audit complete.`);
console.log(`Total hits: ${hits.length}`);
for (const bucket of buckets) {
  console.log(`${bucket}: ${grouped.get(bucket).length}`);
}
console.log("Report: reports/wordpress-deprecation-audit.md");
