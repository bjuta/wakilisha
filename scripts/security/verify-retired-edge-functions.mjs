import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const retired = [
  "backfill-artist-relationships",
  "backfill-chart-scores",
  "backfill-top-songs-relationships",
  "cleanup-duplicate-tracks-artist",
  "remap-chart-entries-to-scoped-tracks",
  "rls-diagnostics",
  "test-featured-artists-insert",
  "cleanup-unscoped-slugs",
  "rebuild-discography-from-metadata",
  "trigger-phase1",
  "resolve-relationships-phase1",
  "fix_magazine_rls",
  "import-wp-chart-editions",
  "import-wp-charts-v2",
  "promote-wp-staging-to-v2",
  "clean-chart-v2-tables",
  "clean-wp-chart-import",
  "grab-wp-charts-v2",
  "import-wp-articles",
  "split-multi-release-tracks",
  "smoke-test-rebuild",
  "minimal-test",
];

const verifierPath =
  "scripts/security/verify-retired-edge-functions.mjs";

const ignoredPrefixes = [
  "docs/",
  "reports/",
  "supabase/retired-functions/",
];

const ignoredFiles = new Set([
  verifierPath,
]);

for (const slug of retired) {
  const activeDirectory = path.join(
    "supabase",
    "functions",
    slug,
  );

  if (fs.existsSync(activeDirectory)) {
    throw new Error(
      `Retired function source remains active: ${slug}`,
    );
  }
}

const trackedFiles = execFileSync(
  "git",
  ["ls-files", "-z"],
)
  .toString("utf8")
  .split("\0")
  .filter(Boolean)
  .filter((file) => {
    if (ignoredFiles.has(file)) {
      return false;
    }

    return !ignoredPrefixes.some(
      (prefix) => file.startsWith(prefix),
    );
  });

for (const file of trackedFiles) {
  if (!fs.existsSync(file)) {
    continue;
  }

  const buffer = fs.readFileSync(file);

  if (buffer.includes(0)) {
    continue;
  }

  const source = buffer.toString("utf8");

  for (const slug of retired) {
    if (source.includes(slug)) {
      throw new Error(
        `Retired function ${slug} is actively referenced in ${file}`,
      );
    }
  }
}

console.log(
  "PASS: Retired Edge Functions have no active source directories or tracked runtime call sites.",
);
