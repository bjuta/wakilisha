import fs from "node:fs";

function fail(message) {
  console.error(`STOP: ${message}`);
  process.exit(1);
}

function arg(name) {
  const index = process.argv.indexOf(name);
  if (
    index === -1 ||
    !process.argv[index + 1]
  ) {
    fail(`Missing required argument ${name}`);
  }
  return process.argv[index + 1];
}

function extractPostgrestVersion(text, label) {
  const matches = [
    ...text.matchAll(
      /PostgrestVersion:\s*"([^"]+)"/g,
    ),
  ];

  if (matches.length !== 1) {
    fail(
      `${label} must contain exactly one __InternalSupabase.PostgrestVersion field. Found ${matches.length}.`,
    );
  }

  return matches[0][1];
}

function replacePostgrestVersion(
  text,
  version,
  label,
) {
  extractPostgrestVersion(text, label);

  return text.replace(
    /PostgrestVersion:\s*"[^"]+"/,
    `PostgrestVersion: "${version}"`,
  );
}

const inputPath = arg("--input");
const outputPath = arg("--output");
const normalize =
  process.argv.includes("--normalize");
const runtimeSourceIndex =
  process.argv.indexOf("--runtime-source");
const runtimeSourcePath =
  runtimeSourceIndex === -1
    ? null
    : process.argv[
        runtimeSourceIndex + 1
      ];

if (
  normalize ===
  Boolean(runtimeSourcePath)
) {
  fail(
    "Choose exactly one of --normalize or --runtime-source <file>.",
  );
}

if (!fs.existsSync(inputPath)) {
  fail(`Input file does not exist: ${inputPath}`);
}

const input = fs.readFileSync(
  inputPath,
  "utf8",
);

let result;

if (normalize) {
  result = replacePostgrestVersion(
    input,
    "__WAKILISHA_RUNTIME_POSTGREST__",
    inputPath,
  );
} else {
  if (
    !runtimeSourcePath ||
    !fs.existsSync(runtimeSourcePath)
  ) {
    fail(
      `Runtime source file does not exist: ${runtimeSourcePath ?? "<missing>"}`,
    );
  }

  const runtimeSource = fs.readFileSync(
    runtimeSourcePath,
    "utf8",
  );
  const runtimeVersion =
    extractPostgrestVersion(
      runtimeSource,
      runtimeSourcePath,
    );

  result = replacePostgrestVersion(
    input,
    runtimeVersion,
    inputPath,
  );
}

fs.writeFileSync(
  outputPath,
  result,
  "utf8",
);
