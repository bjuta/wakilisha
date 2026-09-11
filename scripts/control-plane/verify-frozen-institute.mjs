import fs from "node:fs";
import {
  execFileSync,
} from "node:child_process";
import {
  scanWakilishaUiChromeSource,
} from "./verify-wakilisha-ui-chrome.mjs";

const frozenUiRoot =
  "src/pages/admin/institute/";

const frozenAuthorityRoots = [
  "src/services/institute/",
  "supabase/functions/institute-assistant/",
  "test/institute/",
];

const freezeDocument =
  "docs/institute/LEGACY_INSTITUTE_FREEZE.md";

if (!fs.existsSync(freezeDocument)) {
  throw new Error(
    `Legacy Institute freeze document is missing: ${freezeDocument}`,
  );
}

const adminShell = fs.readFileSync(
  "src/pages/admin/AdminShell.tsx",
  "utf8",
);

if (
  adminShell.includes(
    'label: "Institute"',
  ) ||
  adminShell.includes(
    "/admin/institute/inquiry-interface",
  )
) {
  throw new Error(
    "Legacy Institute remains in normal admin navigation.",
  );
}

const baseRef =
  process.env
    .CONTROL_PLANE_BASE_REF ??
  "origin/main";

execFileSync(
  "git",
  [
    "rev-parse",
    "--verify",
    baseRef,
  ],
  {
    stdio: "ignore",
  },
);

const diff = execFileSync(
  "git",
  [
    "diff",
    "--name-status",
    baseRef,
    "--",
  ],
  {
    encoding: "utf8",
  },
).trim();

function summarizeChromeDebt(source) {
  const summary = new Map();

  for (
    const issue of
      scanWakilishaUiChromeSource(source)
  ) {
    summary.set(
      issue.kind,
      (summary.get(issue.kind) ?? 0) + 1,
    );
  }

  return summary;
}

function totalDebt(summary) {
  return [...summary.values()].reduce(
    (total, count) => total + count,
    0,
  );
}

function validateUiDebtReduction(path) {
  let beforeSource;

  try {
    beforeSource = execFileSync(
      "git",
      ["show", `${baseRef}:${path}`],
      { encoding: "utf8" },
    );
  } catch {
    return [
      "new or unresolved legacy Institute UI files are not permitted",
    ];
  }

  if (!fs.existsSync(path)) {
    return [
      "modified legacy Institute UI path is missing from the working tree",
    ];
  }

  const afterSource = fs.readFileSync(
    path,
    "utf8",
  );
  const before = summarizeChromeDebt(
    beforeSource,
  );
  const after = summarizeChromeDebt(
    afterSource,
  );
  const beforeTotal = totalDebt(before);
  const afterTotal = totalDebt(after);
  const reasons = [];

  for (
    const kind of
      new Set([
        ...before.keys(),
        ...after.keys(),
      ])
  ) {
    const beforeCount = before.get(kind) ?? 0;
    const afterCount = after.get(kind) ?? 0;

    if (afterCount > beforeCount) {
      reasons.push(
        `${kind} increased ${beforeCount} -> ${afterCount}`,
      );
    }
  }

  if (beforeTotal === 0) {
    reasons.push(
      "file had no native browser-chrome debt to retire",
    );
  } else if (afterTotal >= beforeTotal) {
    reasons.push(
      `native browser-chrome debt did not strictly decrease (${beforeTotal} -> ${afterTotal})`,
    );
  }

  return reasons;
}

const violations = [];

for (const line of diff.split("\n")) {
  if (!line) continue;

  const [status, ...paths] =
    line.split("\t");

  for (const path of paths) {
    if (
      frozenAuthorityRoots.some((root) =>
        path.startsWith(root)
      ) &&
      !status.startsWith("D")
    ) {
      violations.push(
        `${status}\t${path}\tlegacy Institute authority remains deletion-only`,
      );
      continue;
    }

    if (!path.startsWith(frozenUiRoot)) {
      continue;
    }

    if (status.startsWith("D")) {
      continue;
    }

    if (status !== "M") {
      violations.push(
        `${status}\t${path}\tnew, renamed, or copied legacy Institute UI files are not permitted`,
      );
      continue;
    }

    const reasons =
      validateUiDebtReduction(path);

    for (const reason of reasons) {
      violations.push(
        `${status}\t${path}\t${reason}`,
      );
    }
  }
}

if (violations.length > 0) {
  throw new Error(
    [
      "Legacy Institute development is frozen.",
      "Authority-bearing paths remain deletion-only.",
      "Existing legacy UI files may change only when each modified file strictly retires native browser-chrome debt without increasing any debt class:",
      ...violations,
    ].join("\n"),
  );
}

console.log(
  "PASS: Legacy Institute remains outside normal navigation; authority is frozen and any legacy UI maintenance strictly reduces native browser-chrome debt.",
);
