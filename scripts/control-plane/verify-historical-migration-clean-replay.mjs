import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const HISTORICAL_CLEAN_REPLAY_PROOF_MODE =
  "historical_clean_replay";

const MIGRATIONS_DIR =
  "supabase/migrations";
const TYPE_FILE =
  "src/types/database.types.ts";
const BASELINE_FILE =
  "docs/engineering/live-schema-baseline.json";

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
    throw new Error(
      `git ${args.join(" ")} failed:\n${result.stdout ?? ""}${result.stderr ?? ""}`,
    );
  }

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function sha256Bytes(value) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

function sha256File(filePath) {
  return sha256Bytes(
    fs.readFileSync(filePath),
  );
}

function migrationVersion(
  migrationFile,
) {
  return path
    .basename(migrationFile)
    .match(/^(\d{14})_/)?.[1] ??
    null;
}

function activeMigrationsAt(ref) {
  return runGit([
    "ls-tree",
    "-r",
    "--name-only",
    ref,
    "--",
    MIGRATIONS_DIR,
  ])
    .stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .filter(
      (filePath) =>
        filePath.endsWith(".sql"),
    )
    .map(
      (filePath) =>
        path.basename(filePath),
    )
    .sort();
}

function fileSha256At(
  ref,
  filePath,
) {
  const result = runGit(
    [
      "show",
      `${ref}:${filePath}`,
    ],
    { allowFailure: true },
  );

  if (result.status !== 0) {
    return null;
  }

  return sha256Bytes(
    Buffer.from(
      result.stdout,
      "utf8",
    ),
  );
}

function fileBlobShaAt(
  ref,
  filePath,
) {
  const result = runGit(
    [
      "rev-parse",
      `${ref}:${filePath}`,
    ],
    { allowFailure: true },
  );
  const value =
    result.stdout.trim();

  return (
    result.status === 0 &&
    /^[0-9a-f]{40}$/.test(value)
  )
    ? value
    : null;
}

function predecessorMigrationManifest(
  ref,
  candidateVersion,
) {
  const rows = [];
  const raw = runGit([
    "ls-tree",
    "-r",
    ref,
    "--",
    MIGRATIONS_DIR,
  ]).stdout;

  for (
    const line of
    raw.split(/\r?\n/)
  ) {
    if (!line.trim()) {
      continue;
    }

    const [meta, filePath] =
      line.split("\t");

    if (
      !filePath ||
      !filePath.endsWith(".sql")
    ) {
      continue;
    }

    const version =
      migrationVersion(filePath);
    const blobSha =
      meta.split(/\s+/)[2];

    if (
      !version ||
      version >= candidateVersion ||
      !/^[0-9a-f]{40}$/.test(
        blobSha ?? "",
      )
    ) {
      continue;
    }

    rows.push({
      blobSha,
      filePath,
    });
  }

  rows.sort(
    (a, b) =>
      a.filePath.localeCompare(
        b.filePath,
      ),
  );

  const manifest = rows
    .map(
      ({ blobSha, filePath }) =>
        `${blobSha} ${filePath}`,
    )
    .join("\n");

  return {
    count: rows.length,
    sha256:
      sha256Bytes(
        Buffer.from(
          manifest,
          "utf8",
        ),
      ),
  };
}

function arraysEqual(a, b) {
  return (
    a.length === b.length &&
    a.every(
      (value, index) =>
        value === b[index],
    )
  );
}

export function isHistoricalCleanReplayProof(
  proof,
) {
  return (
    proof?.proof_mode ===
    HISTORICAL_CLEAN_REPLAY_PROOF_MODE
  );
}

export function validateHistoricalCleanReplayProof({
  proof,
  migrationFile,
  baseMainSha,
}) {
  const errors = [];
  const version =
    migrationVersion(migrationFile);

  if (
    !isHistoricalCleanReplayProof(
      proof,
    )
  ) {
    errors.push(
      `proof_mode must be ${HISTORICAL_CLEAN_REPLAY_PROOF_MODE}`,
    );
  }

  if (
    proof.migration_file !==
    migrationFile
  ) {
    errors.push(
      `migration_file must be ${migrationFile}`,
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
    typeof proof
      .migration_git_blob_sha !==
      "string" ||
    !/^[0-9a-f]{40}$/.test(
      proof.migration_git_blob_sha,
    )
  ) {
    errors.push(
      "migration_git_blob_sha must be a Git blob SHA",
    );
  }

  if (
    !version ||
    proof.candidate_migration_version !==
      version
  ) {
    errors.push(
      `candidate_migration_version must equal candidate version ${version ?? "<unknown>"}`,
    );
  }

  for (
    const field of [
      "baseline_replay",
      "candidate_apply",
      "verifier",
    ]
  ) {
    if (
      proof[field] !== "pass"
    ) {
      errors.push(
        `${field} must be pass`,
      );
    }
  }

  if (
    typeof proof.verifier_file !==
      "string" ||
    proof.verifier_file.trim() === ""
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
    proof.schema_migration_count < 1
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

  if (
    typeof proof
      .replay_candidate_head_sha !==
      "string" ||
    !/^[0-9a-f]{40}$/.test(
      proof.replay_candidate_head_sha,
    )
  ) {
    errors.push(
      "replay_candidate_head_sha must be a commit SHA",
    );
  }

  if (
    proof.replay_environment !==
    "supabase-local"
  ) {
    errors.push(
      "replay_environment must be supabase-local",
    );
  }

  if (
    typeof proof
      .supabase_cli_version !==
      "string" ||
    !/^\d+\.\d+\.\d+$/.test(
      proof.supabase_cli_version,
    )
  ) {
    errors.push(
      "supabase_cli_version must be semantic",
    );
  }

  if (
    typeof proof.replay_marker !==
      "string" ||
    !/^WK_[A-Z0-9_]+_PASS$/.test(
      proof.replay_marker,
    )
  ) {
    errors.push(
      "replay_marker must be canonical",
    );
  }

  if (
    !Number.isInteger(
      proof.predecessor_migration_count,
    ) ||
    proof.predecessor_migration_count < 1
  ) {
    errors.push(
      "predecessor_migration_count must be a positive integer",
    );
  }

  if (
    typeof proof
      .predecessor_blob_manifest_sha256 !==
      "string" ||
    !/^[0-9a-f]{64}$/.test(
      proof
        .predecessor_blob_manifest_sha256,
    )
  ) {
    errors.push(
      "predecessor_blob_manifest_sha256 must be a SHA-256 digest",
    );
  }

  if (
    !Number.isFinite(
      Date.parse(
        proof.verified_at ?? "",
      ),
    )
  ) {
    errors.push(
      "verified_at must be an ISO timestamp",
    );
  }

  return errors;
}

export function validateHistoricalCleanReplayRepositoryState({
  changedActive,
  proofs,
  mergeBase,
  baseline,
  migrations,
  latestMigration,
  actualTypesSha256,
}) {
  const errors = [];

  if (
    changedActive.length === 0 ||
    !changedActive.every(
      (entry) =>
        isHistoricalCleanReplayProof(
          proofs.get(entry.path),
        ),
    )
  ) {
    errors.push(
      "historical clean replay mode cannot be mixed with ordinary active migration changes",
    );
    return errors;
  }

  for (
    const entry of changedActive
  ) {
    if (entry.status !== "M") {
      errors.push(
        `${entry.path}: historical clean replay is only valid for a modified migration already present on main`,
      );
    }
  }

  const baseMigrations =
    activeMigrationsAt(mergeBase);

  if (
    !arraysEqual(
      baseMigrations,
      migrations,
    )
  ) {
    errors.push(
      "historical clean replay requires the active migration filename set to remain identical to main",
    );
  }

  const baseTypesSha256 =
    fileSha256At(
      mergeBase,
      TYPE_FILE,
    );

  if (
    !baseTypesSha256 ||
    baseTypesSha256 !==
      actualTypesSha256
  ) {
    errors.push(
      "historical clean replay requires committed database types to remain byte-identical to main",
    );
  }

  const baselineDiff =
    runGit(
      [
        "diff",
        "--quiet",
        mergeBase,
        "--",
        BASELINE_FILE,
      ],
      { allowFailure: true },
    );

  if (baselineDiff.status !== 0) {
    errors.push(
      "historical clean replay requires the accepted live-schema baseline to remain byte-identical to main",
    );
  }

  const latestVersion =
    migrationVersion(latestMigration);
  const currentHead =
    runGit([
      "rev-parse",
      "HEAD",
    ]).stdout.trim();

  for (
    const entry of changedActive
  ) {
    const proof =
      proofs.get(entry.path);
    const version =
      migrationVersion(entry.path);
    const currentBlobSha =
      runGit([
        "hash-object",
        entry.path,
      ]).stdout.trim();

    if (
      proof.migration_git_blob_sha !==
      currentBlobSha
    ) {
      errors.push(
        `${entry.path}: migration_git_blob_sha does not match candidate bytes`,
      );
    }

    const replayAncestor =
      runGit(
        [
          "merge-base",
          "--is-ancestor",
          proof.replay_candidate_head_sha,
          currentHead,
        ],
        { allowFailure: true },
      );

    if (replayAncestor.status !== 0) {
      errors.push(
        `${entry.path}: replay_candidate_head_sha must be an ancestor of HEAD`,
      );
    }

    if (
      fileBlobShaAt(
        proof.replay_candidate_head_sha,
        entry.path,
      ) !== currentBlobSha
    ) {
      errors.push(
        `${entry.path}: migration bytes drifted after clean replay`,
      );
    }

    if (
      !arraysEqual(
        activeMigrationsAt(
          proof.replay_candidate_head_sha,
        ),
        migrations,
      )
    ) {
      errors.push(
        `${entry.path}: replay candidate migration set no longer matches HEAD`,
      );
    }

    if (
      fileSha256At(
        proof.replay_candidate_head_sha,
        TYPE_FILE,
      ) !== actualTypesSha256
    ) {
      errors.push(
        `${entry.path}: replay candidate database types no longer match HEAD`,
      );
    }

    if (
      proof.schema_types_sha256 !==
      actualTypesSha256
    ) {
      errors.push(
        `${entry.path}: schema_types_sha256 must equal unchanged accepted database types`,
      );
    }

    if (
      proof.schema_migration_count !==
      migrations.length
    ) {
      errors.push(
        `${entry.path}: schema_migration_count must equal ${migrations.length}`,
      );
    }

    if (
      !latestVersion ||
      proof.schema_migration_head !==
        latestVersion
    ) {
      errors.push(
        `${entry.path}: schema_migration_head must equal ${latestVersion ?? "<unknown>"}`,
      );
    }

    if (version) {
      const predecessor =
        predecessorMigrationManifest(
          mergeBase,
          version,
        );

      if (
        proof.predecessor_migration_count !==
        predecessor.count
      ) {
        errors.push(
          `${entry.path}: predecessor_migration_count must equal ${predecessor.count}`,
        );
      }

      if (
        proof
          .predecessor_blob_manifest_sha256 !==
        predecessor.sha256
      ) {
        errors.push(
          `${entry.path}: predecessor blob manifest does not match main`,
        );
      }
    }
  }

  if (
    baseline.typesSha256 !==
      actualTypesSha256 ||
    baseline.migrationCount !==
      migrations.length ||
    baseline.latestMigration !==
      latestMigration
  ) {
    errors.push(
      "historical clean replay requires the accepted schema snapshot to remain aligned with the unchanged repository schema head",
    );
  }

  return errors;
}
