import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  validateRepositorySchemaSnapshot,
} from "./verify-repository-schema-snapshot.mjs";

const BASE_REF =
  process.env.CONTROL_PLANE_BASE_REF ??
  "origin/main";
const MIGRATIONS_DIR =
  "supabase/migrations";
const PROOF_DIR =
  "docs/engineering/replay-proofs";
const RETIRED_DIR =
  "docs/engineering/replay-baseline/retired-active-migrations";
const TYPE_FILE =
  "src/types/database.types.ts";
const BASELINE_FILE =
  "docs/engineering/live-schema-baseline.json";
const TARGET_PROJECT_REF =
  process.env.SUPABASE_TARGET_PROJECT_REF ??
  process.env.SUPABASE_PROJECT_REF ??
  "pgzizndxdyhqmtyywjmt";

function fail(
  message,
  detail = "",
) {
  console.error(`STOP: ${message}`);
  if (detail) {
    console.error(detail);
  }
  process.exit(1);
}

function runGit(
  args,
  {
    allowFailure = false,
  } = {},
) {
  const result = spawnSync(
    "git",
    args,
    { encoding: "utf8" },
  );

  if (
    result.status !== 0 &&
    !allowFailure
  ) {
    fail(
      `git ${args.join(" ")} failed.`,
      `${result.stdout ?? ""}${result.stderr ?? ""}`,
    );
  }

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(
      fs.readFileSync(filePath),
    )
    .digest("hex");
}

function activeMigrations() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(
      (name) =>
        name.endsWith(".sql"),
    )
    .sort();
}

export function analyzeMigrationText(
  text,
) {
  const rules = [
    [
      "production-only reconciliation",
      /\bproduction[- ]only\b/i,
    ],
    [
      "reviewed production boundary",
      /\breviewed\b[\s\S]{0,120}\b(?:boundary|manifest|cardinality|revision|count)\b/i,
    ],
    [
      "manifest digest lock",
      /\bmanifest\s+digest\b/i,
    ],
    [
      "lock-and-backfill block",
      /lock_and_backfill/i,
    ],
  ];

  return rules
    .filter(
      ([, pattern]) =>
        pattern.test(text),
    )
    .map(
      ([label]) =>
        label,
    );
}

export function validateReplayProof({
  proof,
  migrationFile,
  migrationSha256,
  baseMainSha,
}) {
  const errors = [];
  const basename =
    path.basename(
      migrationFile,
    );
  const versionMatch =
    basename.match(
      /^(\d{14})_/,
    );
  const version =
    versionMatch?.[1] ??
    null;

  if (
    proof.migration_file !==
    migrationFile
  ) {
    errors.push(
      `migration_file must be ${migrationFile}`,
    );
  }

  if (
    proof.migration_sha256 !==
    migrationSha256
  ) {
    errors.push(
      "migration_sha256 does not match the candidate bytes",
    );
  }

  if (
    proof.base_main_sha !==
    baseMainSha
  ) {
    errors.push(
      `base_main_sha must equal merge base ${baseMainSha}`,
    );
  }

  if (
    !version ||
    proof.preview_migration_head !==
      version
  ) {
    errors.push(
      `preview_migration_head must equal candidate version ${version ?? "<unknown>"}`,
    );
  }

  if (
    proof.baseline_replay !==
    "pass"
  ) {
    errors.push(
      "baseline_replay must be pass",
    );
  }

  if (
    proof.candidate_apply !==
    "pass"
  ) {
    errors.push(
      "candidate_apply must be pass",
    );
  }

  if (
    proof.verifier !==
    "pass"
  ) {
    errors.push(
      "verifier must be pass",
    );
  }

  if (
    typeof proof
      .preview_project_ref !==
      "string" ||
    !/^[a-z0-9]{20}$/.test(
      proof.preview_project_ref,
    )
  ) {
    errors.push(
      "preview_project_ref must be a 20-character Supabase project ref",
    );
  }

  if (
    typeof proof
      .preview_branch_id !==
      "string" ||
    !/^[0-9a-f-]{36}$/i.test(
      proof.preview_branch_id,
    )
  ) {
    errors.push(
      "preview_branch_id must be a UUID",
    );
  }

  if (
    typeof proof.verifier_file !==
      "string" ||
    proof.verifier_file.trim() ===
      ""
  ) {
    errors.push(
      "verifier_file is required",
    );
  } else if (
    !fs.existsSync(
      proof.verifier_file,
    )
  ) {
    errors.push(
      `verifier_file does not exist: ${proof.verifier_file}`,
    );
  }

  if (
    typeof proof
      .schema_types_sha256 !==
      "string" ||
    !/^[0-9a-f]{64}$/.test(
      proof.schema_types_sha256,
    )
  ) {
    errors.push(
      "schema_types_sha256 must be a SHA-256 digest",
    );
  }

  if (
    !Number.isInteger(
      proof.schema_migration_count,
    ) ||
    proof.schema_migration_count <
      1
  ) {
    errors.push(
      "schema_migration_count must be a positive integer",
    );
  }

  if (
    typeof proof
      .schema_migration_head !==
      "string" ||
    !/^\d{14}$/.test(
      proof.schema_migration_head,
    )
  ) {
    errors.push(
      "schema_migration_head must be a 14-digit migration version",
    );
  }

  const verifiedAt =
    Date.parse(
      proof.verified_at ??
        "",
    );

  if (
    !Number.isFinite(
      verifiedAt,
    )
  ) {
    errors.push(
      "verified_at must be an ISO timestamp",
    );
  }

  return errors;
}

function parseNameStatus(raw) {
  const entries = [];

  for (
    const line of
    raw.split(/\r?\n/)
  ) {
    if (!line.trim()) {
      continue;
    }

    const cells =
      line.split("\t");
    const status =
      cells[0];

    if (
      status.startsWith(
        "R",
      )
    ) {
      entries.push({
        status: "D",
        path: cells[1],
      });
      entries.push({
        status: "A",
        path: cells[2],
      });
    } else {
      entries.push({
        status: status[0],
        path: cells.at(-1),
      });
    }
  }

  return entries;
}

function collectChangedMigrations(
  mergeBase,
) {
  const committed =
    parseNameStatus(
      runGit([
        "diff",
        "--name-status",
        "--find-renames",
        `${mergeBase}...HEAD`,
        "--",
        MIGRATIONS_DIR,
      ]).stdout,
    );

  const working = [];
  const statusOutput =
    runGit([
      "status",
      "--porcelain",
      "--untracked-files=all",
      "--",
      MIGRATIONS_DIR,
    ]).stdout;

  for (
    const line of
    statusOutput.split(/\r?\n/)
  ) {
    if (!line.trim()) {
      continue;
    }

    const code =
      line.slice(0, 2);
    const filePath =
      line.slice(3).trim();

    let status = "M";

    if (
      code.includes("?")
    ) {
      status = "A";
    } else if (
      code.includes("D")
    ) {
      status = "D";
    } else if (
      code.includes("A")
    ) {
      status = "A";
    }

    working.push({
      status,
      path: filePath,
    });
  }

  const byPath =
    new Map();

  for (
    const entry of [
      ...committed,
      ...working,
    ]
  ) {
    if (
      !entry.path?.endsWith(
        ".sql",
      )
    ) {
      continue;
    }

    byPath.set(
      entry.path,
      entry,
    );
  }

  return [
    ...byPath.values(),
  ].sort(
    (a, b) =>
      a.path.localeCompare(
        b.path,
      ),
  );
}

function readJson(
  filePath,
  failures,
) {
  try {
    return JSON.parse(
      fs.readFileSync(
        filePath,
        "utf8",
      ),
    );
  } catch (error) {
    failures.push(
      `${filePath}: invalid JSON (${error.message})`,
    );
    return null;
  }
}

function main() {
  const mergeBaseResult =
    runGit(
      [
        "merge-base",
        "HEAD",
        BASE_REF,
      ],
      {
        allowFailure: true,
      },
    );

  if (
    mergeBaseResult.status !==
    0
  ) {
    fail(
      `Could not resolve merge base against ${BASE_REF}.`,
      mergeBaseResult.stderr,
    );
  }

  const mergeBase =
    mergeBaseResult
      .stdout
      .trim();

  if (
    !/^[0-9a-f]{40}$/.test(
      mergeBase,
    )
  ) {
    fail(
      "Resolved merge base is not a commit SHA.",
      mergeBase,
    );
  }

  const changed =
    collectChangedMigrations(
      mergeBase,
    );

  if (
    changed.length === 0
  ) {
    console.log(
      "PASS: no active migration files changed; replay proof gate not required.",
    );
    return;
  }

  const failures = [];
  const proofs =
    new Map();

  for (
    const entry of changed
  ) {
    const basename =
      path.basename(
        entry.path,
      );

    if (
      entry.status === "D"
    ) {
      const retiredReceipt =
        path.join(
          RETIRED_DIR,
          basename,
        );

      if (
        !fs.existsSync(
          retiredReceipt,
        )
      ) {
        failures.push(
          `${entry.path}: deleted active migration lacks byte-preserved retired receipt at ${retiredReceipt}`,
        );
      }

      continue;
    }

    if (
      !fs.existsSync(
        entry.path,
      )
    ) {
      failures.push(
        `${entry.path}: changed migration file is missing from the worktree`,
      );
      continue;
    }

    const text =
      fs.readFileSync(
        entry.path,
        "utf8",
      );
    const risks =
      analyzeMigrationText(
        text,
      );

    if (
      risks.length > 0
    ) {
      failures.push(
        `${entry.path}: production-bound replay risk detected (${risks.join(", ")}). Split enduring replay authority from one-time production reconciliation before PR.`,
      );
    }

    const proofPath =
      path.join(
        PROOF_DIR,
        `${basename}.json`,
      );

    if (
      !fs.existsSync(
        proofPath,
      )
    ) {
      failures.push(
        `${entry.path}: missing replay proof ${proofPath}`,
      );
      continue;
    }

    const proof =
      readJson(
        proofPath,
        failures,
      );

    if (!proof) {
      continue;
    }

    proofs.set(
      entry.path,
      proof,
    );

    const proofErrors =
      validateReplayProof({
        proof,
        migrationFile:
          entry.path,
        migrationSha256:
          sha256File(
            entry.path,
          ),
        baseMainSha:
          mergeBase,
      });

    for (
      const error of
      proofErrors
    ) {
      failures.push(
        `${proofPath}: ${error}`,
      );
    }
  }

  const changedActive =
    changed.filter(
      (entry) =>
        entry.status !== "D",
    );

  if (
    changedActive.length > 0
  ) {
    if (
      !fs.existsSync(
        TYPE_FILE,
      )
    ) {
      failures.push(
        `${TYPE_FILE}: committed database types are required when active migrations change`,
      );
    }

    if (
      !fs.existsSync(
        BASELINE_FILE,
      )
    ) {
      failures.push(
        `${BASELINE_FILE}: repository schema baseline is required when active migrations change`,
      );
    }

    if (
      fs.existsSync(TYPE_FILE) &&
      fs.existsSync(
        BASELINE_FILE,
      )
    ) {
      const baseline =
        readJson(
          BASELINE_FILE,
          failures,
        );

      const migrations =
        activeMigrations();
      const latestMigration =
        migrations.at(-1);

      if (baseline) {
        const actualTypesSha256 =
          sha256File(
            TYPE_FILE,
          );

        const snapshotErrors =
          validateRepositorySchemaSnapshot({
            baseline,
            actualTypesSha256,
            expectedProjectRef:
              TARGET_PROJECT_REF,
            migrationCount:
              migrations.length,
            latestMigration,
          });

        for (
          const error of
          snapshotErrors
        ) {
          failures.push(
            `${BASELINE_FILE}: ${error}`,
          );
        }

        if (
          baseline
            .schemaSeal?.mode !==
          "preview"
        ) {
          failures.push(
            `${BASELINE_FILE}: active migration changes require schemaSeal.mode=preview`,
          );
        }

        if (
          baseline
            .schemaSeal
            ?.baseMainSha !==
          mergeBase
        ) {
          failures.push(
            `${BASELINE_FILE}: schemaSeal.baseMainSha must equal merge base ${mergeBase}`,
          );
        }

        const latestChanged =
          changedActive.at(-1);
        const latestProof =
          proofs.get(
            latestChanged.path,
          );

        if (!latestProof) {
          failures.push(
            `${latestChanged.path}: latest changed active migration lacks a usable replay proof for schema snapshot binding`,
          );
        } else {
          if (
            baseline
              .schemaSeal
              ?.sourceProjectRef !==
            latestProof
              .preview_project_ref
          ) {
            failures.push(
              `${BASELINE_FILE}: schemaSeal.sourceProjectRef must equal the latest migration proof preview_project_ref`,
            );
          }

          if (
            baseline
              .schemaSeal
              ?.previewBranchId !==
            latestProof
              .preview_branch_id
          ) {
            failures.push(
              `${BASELINE_FILE}: schemaSeal.previewBranchId must equal the latest migration proof preview_branch_id`,
            );
          }

          if (
            baseline
              .typesSha256 !==
            latestProof
              .schema_types_sha256
          ) {
            failures.push(
              `${BASELINE_FILE}: typesSha256 must equal the latest migration proof schema_types_sha256`,
            );
          }

          if (
            baseline
              .migrationCount !==
            latestProof
              .schema_migration_count
          ) {
            failures.push(
              `${BASELINE_FILE}: migrationCount must equal the latest migration proof schema_migration_count`,
            );
          }

          if (
            baseline
              .schemaSeal
              ?.migrationHead !==
            latestProof
              .schema_migration_head
          ) {
            failures.push(
              `${BASELINE_FILE}: schemaSeal.migrationHead must equal the latest migration proof schema_migration_head`,
            );
          }
        }
      }
    }
  }

  if (
    failures.length > 0
  ) {
    fail(
      "migration replay contract is not sealed.",
      failures.join("\n"),
    );
  }

  console.log(
    `PASS: migration replay contract sealed for ${changed.length} active migration change(s).`,
  );
}

if (
  process.argv[1] &&
  import.meta.url ===
    pathToFileURL(
      process.argv[1],
    ).href
) {
  main();
}
