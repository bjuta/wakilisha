import fs from "node:fs";
import path from "node:path";
import {
  spawnSync,
} from "node:child_process";

const PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF ??
  "pgzizndxdyhqmtyywjmt";

const CLI = "supabase@2.107.0";
const MIGRATIONS_DIR =
  path.resolve("supabase/migrations");
const PROJECT_REF_FILE =
  path.resolve("supabase/.temp/project-ref");

function fail(message, detail = "") {
  console.error(`STOP: ${message}`);

  if (detail) {
    console.error(detail);
  }

  process.exit(1);
}

function stripAnsi(value) {
  return value.replace(
    /\u001B\[[0-?]*[ -/]*[@-~]/g,
    "",
  );
}

function run(args, label) {
  const result = spawnSync(
    "npx",
    [
      "--yes",
      CLI,
      ...args,
    ],
    {
      encoding: "utf8",
      env: process.env,
    },
  );

  const raw = [
    result.stdout ?? "",
    result.stderr ?? "",
  ].join("");

  const output =
    stripAnsi(raw);

  process.stdout.write(raw);

  if (result.status !== 0) {
    fail(
      `${label} failed.`,
      output,
    );
  }

  return output;
}

if (!fs.existsSync(MIGRATIONS_DIR)) {
  fail(
    "supabase/migrations is missing.",
  );
}

const migrationFiles =
  fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(
      (name) =>
        name.endsWith(".sql"),
    )
    .sort();

const localByVersion =
  new Map();

for (const name of migrationFiles) {
  const match =
    name.match(
      /^(\d{14})_(.+)\.sql$/,
    );

  if (!match) {
    fail(
      `Migration filename is not canonical: ${name}`,
    );
  }

  const version = match[1];

  if (
    localByVersion.has(
      version,
    )
  ) {
    fail(
      `Duplicate local migration version ${version}.`,
      [
        localByVersion.get(
          version,
        ),
        name,
      ].join("\n"),
    );
  }

  localByVersion.set(
    version,
    name,
  );
}

console.log(
  `Local migration files: ${localByVersion.size}`,
);

run(
  [
    "link",
    "--project-ref",
    PROJECT_REF,
  ],
  "Supabase project link",
);

if (
  !fs.existsSync(
    PROJECT_REF_FILE,
  )
) {
  fail(
    "Supabase link did not write project-ref metadata.",
  );
}

const linkedRef =
  fs
    .readFileSync(
      PROJECT_REF_FILE,
      "utf8",
    )
    .trim();

if (
  linkedRef !== PROJECT_REF
) {
  fail(
    "Supabase CLI linked to the wrong project.",
    [
      `Expected: ${PROJECT_REF}`,
      `Actual:   ${linkedRef}`,
    ].join("\n"),
  );
}

console.log(
  `PASS: linked Supabase CLI to production project ${PROJECT_REF}.`,
);

const listOutput =
  run(
    [
      "migration",
      "list",
      "--linked",
    ],
    "Supabase migration list",
  );

const rows = [];

for (
  const rawLine
  of listOutput.split(
    /\r?\n/,
  )
) {
  const line =
    rawLine.replaceAll(
      "│",
      "|",
    );

  if (!line.includes("|")) {
    continue;
  }

  const cells =
    line
      .split("|")
      .map(
        (value) =>
          value.trim(),
      );

  if (
    cells.length < 3
  ) {
    continue;
  }

  const local =
    /^\d{14}$/.test(
      cells[0],
    )
      ? cells[0]
      : null;

  const remote =
    /^\d{14}$/.test(
      cells[1],
    )
      ? cells[1]
      : null;

  if (
    !local &&
    !remote
  ) {
    continue;
  }

  rows.push({
    local,
    remote,
  });
}

const remoteVersions =
  new Set(
    rows
      .map(
        (row) =>
          row.remote,
      )
      .filter(Boolean),
  );

if (
  remoteVersions.size === 0
) {
  fail(
    "No remote migration versions were parsed from Supabase migration list.",
    listOutput,
  );
}

const localVersions =
  new Set(
    localByVersion.keys(),
  );

const remoteOnly =
  [...remoteVersions]
    .filter(
      (version) =>
        !localVersions.has(
          version,
        ),
    )
    .sort();

if (
  remoteOnly.length > 0
) {
  fail(
    "Production contains migration versions missing from the repository.",
    remoteOnly.join("\n"),
  );
}

const localOnly =
  [...localVersions]
    .filter(
      (version) =>
        !remoteVersions.has(
          version,
        ),
    )
    .sort();

const maxRemote =
  [...remoteVersions]
    .sort()
    .at(-1);

const historicalLocalOnly =
  localOnly.filter(
    (version) =>
      version <= maxRemote,
  );

if (
  historicalLocalOnly.length > 0
) {
  fail(
    "Repository contains local-only migrations interleaved inside already-applied production history.",
    historicalLocalOnly
      .map(
        (version) =>
          [
            version,
            localByVersion.get(
              version,
            ),
          ].join(" "),
      )
      .join("\n"),
  );
}

console.log(
  `PASS: all ${remoteVersions.size} production migration versions exist locally at the same timestamps.`,
);

if (
  localOnly.length === 0
) {
  console.log(
    "PASS: repository migration history is fully applied to production.",
  );
} else {
  console.log(
    "PASS: local-only migrations are forward-appended after production history:",
  );

  for (
    const version
    of localOnly
  ) {
    console.log(
      `  ${version} ${localByVersion.get(version)}`,
    );
  }
}

const dryRunOutput =
  run(
    [
      "db",
      "push",
      "--dry-run",
      "--linked",
    ],
    "Supabase db push dry-run",
  );

const dryRunFiles =
  new Set(
    [
      ...dryRunOutput.matchAll(
        /\b(\d{14}_[A-Za-z0-9_-]+\.sql)\b/g,
      ),
    ].map(
      (match) =>
        match[1],
    ),
  );

const expectedPendingFiles =
  new Set(
    localOnly.map(
      (version) =>
        localByVersion.get(
          version,
        ),
    ),
  );

const unexpectedDryRun =
  [...dryRunFiles]
    .filter(
      (name) =>
        !expectedPendingFiles.has(
          name,
        ),
    )
    .sort();

const missingDryRun =
  [...expectedPendingFiles]
    .filter(
      (name) =>
        !dryRunFiles.has(
          name,
        ),
    )
    .sort();

if (
  unexpectedDryRun.length > 0 ||
  missingDryRun.length > 0
) {
  fail(
    "Supabase db push dry-run does not match the forward-only pending migration set.",
    [
      `Unexpected: ${
        unexpectedDryRun.join(
          ", ",
        ) || "<none>"
      }`,
      `Missing: ${
        missingDryRun.join(
          ", ",
        ) || "<none>"
      }`,
    ].join("\n"),
  );
}

console.log(
  "PASS: Supabase db push --dry-run succeeds against production.",
);

if (
  expectedPendingFiles.size === 0
) {
  console.log(
    "PASS: dry-run reports no pending migrations.",
  );
} else {
  console.log(
    "PASS: dry-run pending set exactly matches forward-only local migrations.",
  );
}

console.log(
  "PASS: live migration history is deployable without repair, db pull, or production history rewriting.",
);
