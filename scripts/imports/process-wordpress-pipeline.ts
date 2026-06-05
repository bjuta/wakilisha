import { spawn } from "node:child_process";

function runStep(label: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    console.log(`[pipeline] ${label}`);
    const child = spawn(process.execPath, ["./node_modules/tsx/dist/cli.mjs", ...args], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed with exit code ${code}`));
    });
  });
}

function passthroughArgs() {
  const args = process.argv.slice(2);
  const allowed = new Set(["--job", "--limit"]);
  const out: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (allowed.has(arg)) {
      out.push(arg);
      if (args[index + 1]) out.push(args[index + 1]);
      index += 1;
    }
  }
  return out;
}

async function main() {
  const args = passthroughArgs();
  await runStep("scan queued WordPress ZIP jobs", ["scripts/imports/process-wordpress-zips.ts", ...args]);
  await runStep("discover mappings from real scan evidence", ["scripts/imports/discover-wordpress-mappings.ts", ...args]);
  await runStep("plan staging from real mappings", ["scripts/imports/plan-wordpress-staging.ts", ...args]);
  console.log("[pipeline] done: queued → scanned → mapped → planned where data allowed");
}

main().catch((error) => {
  console.error("[pipeline] fatal:", error instanceof Error ? error.message : error);
  process.exit(1);
});
