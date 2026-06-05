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

function hasArg(name: string) {
  return process.argv.includes(name);
}

function passthroughArgs() {
  const args = process.argv.slice(2);
  const allowed = new Set(["--job", "--limit", "--force"]);
  const valueArgs = new Set(["--job", "--limit"]);
  const out: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!allowed.has(arg)) continue;
    out.push(arg);
    if (valueArgs.has(arg) && args[index + 1]) {
      out.push(args[index + 1]);
      index += 1;
    }
  }
  return out;
}

async function main() {
  const args = passthroughArgs();
  const shouldFinalize = hasArg("--finalize") || hasArg("--promote") || hasArg("--production");

  await runStep("scan queued WordPress ZIP jobs", ["scripts/imports/process-wordpress-zips.ts", ...args]);
  await runStep("discover mappings from real scan evidence", ["scripts/imports/discover-wordpress-mappings.ts", ...args]);
  await runStep("plan staging from real mappings", ["scripts/imports/plan-wordpress-staging.ts", ...args]);
  await runStep("stage supported records", ["scripts/imports/stage-wordpress-records.ts", ...args]);

  if (shouldFinalize) {
    await runStep("finalize ready staged records into production tables", ["scripts/imports/finalize-wordpress-staging.ts", ...args]);
    console.log("[pipeline] done: queued → scanned → mapped → planned → staged → finalized where data allowed");
    return;
  }

  console.log("[pipeline] done: queued → scanned → mapped → planned → staged where data allowed");
  console.log("[pipeline] production finalization was skipped. Re-run with --finalize to copy ready staged records into production tables.");
}

main().catch((error) => {
  console.error("[pipeline] fatal:", error instanceof Error ? error.message : error);
  process.exit(1);
});
