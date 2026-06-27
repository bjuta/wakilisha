#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOT = process.cwd();

const SCAN_ROOTS = [
  "src",
  "supabase/functions",
  "scripts",
].filter((dir) => existsSync(join(ROOT, dir)));

const SCANNED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);

const SKIP_DIR_NAMES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".next",
  ".temp",
]);

const CHECKS = [
  {
    label: "Direct Supabase Storage object operation",
    pattern: /\.storage\s*\.\s*from\s*\([^)]*\)\s*\.\s*(upload|update|remove|download|createSignedUrl|createSignedUrls|getPublicUrl)\s*\(/g,
  },
  {
    label: "Direct Supabase public storage URL",
    pattern: /storage\/v1\/object\/public/g,
  },
  {
    label: "Hard-coded Supabase storage object URL",
    pattern: /supabase\.co\/storage\/v1\/object/g,
  },
];

/**
 * Known legacy references that existed before the Lightsail media upload guard.
 * This audit blocks new Supabase Storage usage while letting us clean old debt
 * in focused PRs later.
 */
const BASELINE_COUNTS = new Map([
  ["src/services/mediaService.ts::Direct Supabase Storage object operation", 1],
  ["src/services/mediaService.ts::Direct Supabase public storage URL", 1],
  ["src/services/migrationImportJobs.ts::Direct Supabase Storage object operation", 2],
  ["supabase/functions/migrate-media-from-wp/index.ts::Direct Supabase Storage object operation", 6],
  ["supabase/functions/migrate-wp-images/index.ts::Direct Supabase Storage object operation", 2],
  ["scripts/charts/repaired-content-api.ts::Direct Supabase public storage URL", 6],
  ["scripts/charts/repaired-content-api.ts::Hard-coded Supabase storage object URL", 6],
  ["scripts/charts/repaired-content-details-api.ts::Direct Supabase public storage URL", 1],
  ["scripts/charts/repaired-content-details-api.ts::Hard-coded Supabase storage object URL", 1],
  ["scripts/imports/process-wordpress-zips.ts::Direct Supabase Storage object operation", 1],
  ["scripts/imports/stage-wordpress-records.ts::Direct Supabase Storage object operation", 1],
]);

function toRepoPath(file) {
  return relative(ROOT, file).replaceAll("\\", "/");
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);

    if (stat.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry)) continue;
      walk(full, files);
      continue;
    }

    if (!stat.isFile()) continue;
    if (!SCANNED_EXTENSIONS.has(extname(entry))) continue;

    files.push(full);
  }

  return files;
}

const files = SCAN_ROOTS.flatMap((dir) => walk(join(ROOT, dir)));
const counts = new Map();
const examples = new Map();

for (const file of files) {
  const repoPath = toRepoPath(file);
  const text = readFileSync(file, "utf8");

  for (const check of CHECKS) {
    check.pattern.lastIndex = 0;

    const matches = [...text.matchAll(check.pattern)];
    if (matches.length === 0) continue;

    const key = `${repoPath}::${check.label}`;
    counts.set(key, (counts.get(key) || 0) + matches.length);

    const lines = matches.map((match) => {
      const before = text.slice(0, match.index);
      return before.split("\n").length;
    });

    examples.set(key, lines);
  }
}

const failures = [];
const legacyWarnings = [];

for (const [key, count] of counts.entries()) {
  const baseline = BASELINE_COUNTS.get(key) || 0;
  const [repoPath, label] = key.split("::");
  const lines = examples.get(key) || [];

  if (count > baseline) {
    const added = count - baseline;
    failures.push(`${repoPath}: ${label}. Found ${count}, baseline allows ${baseline}, new references ${added}. Lines: ${lines.join(", ")}`);
  } else if (count > 0) {
    legacyWarnings.push(`${repoPath}: ${label}. Existing baseline count ${count}.`);
  }
}

for (const [key, baseline] of BASELINE_COUNTS.entries()) {
  const count = counts.get(key) || 0;
  if (count < baseline) {
    const [repoPath, label] = key.split("::");
    legacyWarnings.push(`${repoPath}: ${label}. Improved from baseline ${baseline} to ${count}.`);
  }
}

if (failures.length > 0) {
  console.error("\nMedia storage regression audit failed.\n");

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  console.error(
    "\nNew admin/public media uploads must use media-upload-api and media.wakilisha.africa URLs."
  );

  process.exit(1);
}

if (legacyWarnings.length > 0) {
  console.warn("\nKnown legacy Supabase Storage references remain:");
  for (const warning of legacyWarnings) {
    console.warn(`- ${warning}`);
  }
  console.warn("\nNo new media storage regressions detected.\n");
}

console.log("Media storage regression audit passed.");
