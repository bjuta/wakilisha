import fs from "node:fs";
import { execFileSync } from "node:child_process";

const nondeployableModules = [
  "shared-auth",
  "shared-cors",
  "shared-db",
  "shared-responses",
  "shared-logging",
  "shared-utils",
  "shared-apple-music",
];

for (const slug of nondeployableModules) {
  const sourcePath =
    `supabase/functions/${slug}/index.ts`;

  if (!fs.existsSync(sourcePath)) {
    throw new Error(
      `Shared source module is missing: ${sourcePath}`,
    );
  }

  const source = fs.readFileSync(
    sourcePath,
    "utf8",
  );

  if (!source.includes("Deno.serve")) {
    throw new Error(
      `${slug} lacks an explicit network stub`,
    );
  }

  if (
    !source.includes("status: 404") &&
    !source.includes("status:404")
  ) {
    throw new Error(
      `${slug} network stub does not return 404`,
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
  .filter(
    (file) =>
      !file.startsWith("docs/") &&
      !file.startsWith("reports/") &&
      file !==
        "scripts/security/verify-nondeployable-edge-modules.mjs",
  );

for (const file of trackedFiles) {
  if (!fs.existsSync(file)) continue;

  const buffer = fs.readFileSync(file);

  if (buffer.includes(0)) continue;

  const source = buffer.toString("utf8");

  for (const slug of nondeployableModules) {
    const networkPatterns = [
      `/functions/v1/${slug}`,
      `functions.invoke("${slug}"`,
      `functions.invoke('${slug}'`,
      `supabase.functions.invoke("${slug}"`,
      `supabase.functions.invoke('${slug}'`,
    ];

    for (const pattern of networkPatterns) {
      if (source.includes(pattern)) {
        throw new Error(
          `${slug} is invoked as a network endpoint in ${file}`,
        );
      }
    }
  }
}

console.log(
  "PASS: Shared Edge modules remain source-only and have no tracked network callers.",
);
