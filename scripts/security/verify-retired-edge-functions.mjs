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
];

const verifierPath =
  "scripts/security/verify-retired-edge-functions.mjs";

for (const slug of retired) {
  const directory = path.join(
    "supabase",
    "functions",
    slug,
  );

  if (fs.existsSync(directory)) {
    throw new Error(
      `Retired function source still exists: ${slug}`,
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
  .filter((file) => file !== verifierPath);

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
        `Retired function ${slug} is still referenced in ${file}`,
      );
    }
  }
}

console.log(
  "PASS: Retired maintenance Edge Functions have no source directories or tracked repository call sites.",
);
