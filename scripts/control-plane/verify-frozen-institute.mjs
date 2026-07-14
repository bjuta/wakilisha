import fs from "node:fs";
import {
  execFileSync,
} from "node:child_process";

const frozenRoots = [
  "src/pages/admin/institute/",
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

const violations = [];

for (const line of diff.split("\n")) {
  if (!line) continue;

  const [status, ...paths] =
    line.split("\t");

  for (const path of paths) {
    if (
      frozenRoots.some((root) =>
        path.startsWith(root)
      ) &&
      !status.startsWith("D")
    ) {
      violations.push(
        `${status}\t${path}`,
      );
    }
  }
}

if (violations.length > 0) {
  throw new Error(
    [
      "Legacy Institute development is frozen.",
      "Only deletion is permitted beneath frozen paths:",
      ...violations,
    ].join("\n"),
  );
}

console.log(
  "PASS: Legacy Institute is absent from normal navigation and has no new development.",
);
