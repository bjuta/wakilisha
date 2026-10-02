#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const EXPECTED_PROD_HOST = "pgzizndxdyhqmtyywjmt.supabase.co";

function parseArgs(argv) {
  const args = {
    apply: false,
    limit: null,
    resultLog: null,
    resumeLog: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--apply") {
      args.apply = true;
      continue;
    }
    if (value === "--limit") {
      const parsed = Number(argv[++index]);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("--limit must be a positive integer.");
      }
      args.limit = parsed;
      continue;
    }
    if (value === "--result-log") {
      args.resultLog = argv[++index] || null;
      continue;
    }
    if (value === "--resume-log") {
      args.resumeLog = argv[++index] || null;
      continue;
    }
    if (value === "--help" || value === "-h") {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${value}`);
  }

  return args;
}

function printHelp() {
  process.stdout.write(
    [
      "Usage: node scripts/control-plane/run-music-work-resolution.mjs [options]",
      "",
      "Options:",
      "  --apply              Execute a bounded provider-resolution cohort.",
      "  --limit <n>          Process at most n unresolved Tracks.",
      "  --result-log <path>  Durable JSONL result path.",
      "  --resume-log <path>  Skip Tracks already recorded in a prior JSONL run.",
      "  --help               Show this help.",
      "",
      "Without --apply this command performs no provider calls and no mutation.",
      "",
    ].join("\n"),
  );
}

function parseEnvFile(file) {
  const out = {};
  const text = fs.readFileSync(file, "utf8");

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    out[match[1]] = value;
  }

  return out;
}

function normalizeIsrc(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function jsonOrText(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function fetchAll(url, anonKey, accessToken, table, query) {
  const pageSize = 1000;
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const response = await fetch(
      `${url}/rest/v1/${table}?${query}`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
          "Range-Unit": "items",
          Range: `${from}-${from + pageSize - 1}`,
        },
      },
    );

    const body = await jsonOrText(response);

    if (!response.ok) {
      throw new Error(
        `Failed to read ${table}: HTTP ${response.status}: ${JSON.stringify(body)}`,
      );
    }

    if (!Array.isArray(body)) {
      throw new Error(`Unexpected ${table} response shape.`);
    }

    rows.push(...body);
    if (body.length < pageSize) break;
  }

  return rows;
}

function loadCompleted(pathname) {
  const completed = new Set();
  if (!pathname) return completed;
  if (!fs.existsSync(pathname)) {
    throw new Error(`Resume log does not exist: ${pathname}`);
  }

  for (const line of fs.readFileSync(pathname, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;

    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }

    if (
      row.track_id &&
      [
        "verified",
        "review_required",
        "already_current",
      ].includes(row.state)
    ) {
      completed.add(String(row.track_id));
    }
  }

  return completed;
}

const args = parseArgs(process.argv.slice(2));

if (args.apply && args.limit == null) {
  throw new Error(
    "V1 apply mode requires an explicit --limit. Unbounded catalogue resolution is not accepted.",
  );
}

const root = process.cwd();
const env = parseEnvFile(path.join(root, ".env"));

const url = env.VITE_PUBLIC_SUPABASE_URL;
const anonKey = env.VITE_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing VITE_PUBLIC_SUPABASE_URL or VITE_PUBLIC_SUPABASE_ANON_KEY in repo .env.",
  );
}

const host = new URL(url).host;
if (host !== EXPECTED_PROD_HOST) {
  throw new Error(
    `STOP: repo .env points at ${host}, expected Production ${EXPECTED_PROD_HOST}.`,
  );
}

const email = process.env.WK_EMAIL;
const password = process.env.WK_PASSWORD;

if (!email || !password) {
  throw new Error(
    "WK_EMAIL and WK_PASSWORD are required in the local environment.",
  );
}

const authResponse = await fetch(
  `${url}/auth/v1/token?grant_type=password`,
  {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  },
);

const authBody = await jsonOrText(authResponse);
if (!authResponse.ok) {
  throw new Error(
    `Supabase Auth sign-in failed: HTTP ${authResponse.status}: ${JSON.stringify(authBody)}`,
  );
}

const accessToken = authBody?.access_token;
if (!accessToken) {
  throw new Error("Supabase Auth returned no access token.");
}

const trackQuery = new URLSearchParams({
  select: "id,title,status,isrc",
  status: "neq.archived",
  isrc: "not.is.null",
  order: "id.asc",
}).toString();

const tracks = await fetchAll(
  url,
  anonKey,
  accessToken,
  "registry_tracks",
  trackQuery,
);

const candidates = tracks
  .map((track) => ({
    ...track,
    isrc: normalizeIsrc(track.isrc),
  }))
  .filter((track) => /^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/.test(track.isrc));

const completed = loadCompleted(args.resumeLog);
const pending = candidates.filter(
  (track) => !completed.has(String(track.id)),
);
const selected =
  args.limit == null
    ? pending
    : pending.slice(0, args.limit);

process.stdout.write(
  [
    `Production host: ${host}`,
    `ISRC-bearing non-archived Tracks: ${candidates.length}`,
    `Already accounted by resume log: ${completed.size}`,
    `Pending this invocation: ${selected.length}`,
    `Mode: ${args.apply ? "APPLY" : "PLAN_ONLY"}`,
    "",
  ].join("\n"),
);

if (!args.apply) {
  process.stdout.write(
    "PLAN ONLY: no provider calls and no Registry mutation performed.\n",
  );
  process.exit(0);
}

const stamp = new Date()
  .toISOString()
  .replace(/[-:]/g, "")
  .replace(/\.\d{3}Z$/, "Z");
const resultLog =
  args.resultLog ||
  path.join(
    process.env.HOME || root,
    "Downloads",
    `wk_music_work_resolution_${stamp}.jsonl`,
  );

fs.closeSync(
  fs.openSync(resultLog, "a", 0o600),
);

function append(row) {
  fs.appendFileSync(
    resultLog,
    `${JSON.stringify({
      at: new Date().toISOString(),
      ...row,
    })}\n`,
    {
      encoding: "utf8",
      mode: 0o600,
    },
  );
}

const counts = new Map();

function bump(key) {
  counts.set(key, (counts.get(key) || 0) + 1);
}

for (let index = 0; index < selected.length; index += 1) {
  const track = selected[index];

  const response = await fetch(
    `${url}/functions/v1/music-work-resolver`,
    {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        track_id: track.id,
        isrc: track.isrc,
      }),
    },
  );

  const body = await jsonOrText(response);

  if (!response.ok) {
    append({
      state: "failure",
      track_id: track.id,
      track_title: track.title,
      isrc: track.isrc,
      http_status: response.status,
      response: body,
    });

    throw new Error(
      `STOP: Track ${track.id} failed with HTTP ${response.status}: ${JSON.stringify(body)}`,
    );
  }

  const state = String(body?.state || "unknown");

  if (state === "verified") {
    const authority =
      body?.admission?._authority ||
      body?.admission?.authority ||
      null;

    append({
      state: "verified",
      track_id: track.id,
      track_title: track.title,
      isrc: track.isrc,
      recording_mbid: body?.recording_mbid ?? null,
      work_mbid: body?.work_mbid ?? null,
      work_title: body?.work_title ?? null,
      iswc: body?.iswc ?? null,
      work_id:
        body?.admission?.work?.id ??
        body?.admission?.work_id ??
        null,
      track_work_link_id:
        body?.admission?.track_work_link?.id ??
        body?.admission?.track_work_link_id ??
        null,
      authority,
    });
    bump("verified");
  } else if (state === "review_required") {
    append({
      state: "review_required",
      track_id: track.id,
      track_title: track.title,
      isrc: track.isrc,
      reason: body?.reason ?? "unspecified",
      provider: body?.provider ?? "musicbrainz",
      recording_count: body?.recording_count ?? null,
      work_count: body?.work_count ?? null,
      recording_mbid: body?.recording_mbid ?? null,
    });
    bump(String(body?.reason || "review_required"));
  } else {
    append({
      state,
      track_id: track.id,
      track_title: track.title,
      isrc: track.isrc,
      response: body,
    });
    throw new Error(
      `STOP: unexpected resolver state "${state}" for Track ${track.id}.`,
    );
  }

  const processed = index + 1;
  if (processed % 10 === 0 || processed === selected.length) {
    process.stdout.write(
      `Progress ${processed}/${selected.length}: verified=${counts.get("verified") || 0}\n`,
    );
  }

  // Keep the public MusicBrainz call stream at or below one request per second.
  if (processed < selected.length) {
    await sleep(1100);
  }
}

process.stdout.write("\n=== MUSIC WORK RESOLUTION SUMMARY ===\n");
for (const [key, value] of [...counts.entries()].sort()) {
  process.stdout.write(`${key}=${value}\n`);
}
process.stdout.write(`result_log=${resultLog}\n`);
