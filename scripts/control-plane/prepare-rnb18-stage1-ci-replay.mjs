// ONLY the exact RNB18 Stage 1 draft PR #1335: prove the original 237-file
// staged migration set, then create a temporary unlinked 236-file CI replay
// source identical in EVERY SQL byte to the independently hosted Stage 2 proof.
// No historical Editions are seeded and no Production endpoint is reachable.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { RNB18_PAIRED_COMMIT, RNB18_OLD_BLOB, RNB18_OLD } from "./verify-rnb18-staged-retirement.mjs";

function stop(reason) { console.error("STOP_RNB18_STAGE1_DISPOSABLE_PAIRED_REPLAY: "+reason); process.exit(20); }
function exec(cmd,args) {
  const r=spawnSync(cmd,args,{encoding:"utf8"});
  if(r.status!==0)stop(cmd+" "+args.join(" ")+" failed: "+(r.stderr||r.stdout||""));
  return r.stdout.trim();
}
if(process.env.GITHUB_ACTIONS!=="true" ||
   process.env.GITHUB_EVENT_NAME!=="pull_request" ||
   process.env.GITHUB_HEAD_REF!=="fix/wk100-rnb18-replay-stage1-20261101" ||
   process.env.WK_RNB18_PR_NUMBER!=="1335" ||
   process.env.SUPABASE_ACCESS_TOKEN ||
   process.env.SUPABASE_PROJECT_REF ||
   fs.existsSync("supabase/.temp/project-ref"))stop("unexpected PR identity or remote authority");
if(exec("git",["status","--porcelain"])!=="")stop("worktree must be clean before staged source validation");
exec("node",["scripts/control-plane/verify-migration-replay-contract.mjs"]);
const oldPath="supabase/migrations/"+RNB18_OLD;
if(!fs.existsSync(oldPath))stop("original historical retirement migration not present");
if(exec("git",["hash-object",oldPath])!==RNB18_OLD_BLOB)stop("original historical SQL bytes differ");
const sourceFiles=fs.readdirSync("supabase/migrations").filter(x=>x.endsWith(".sql")).sort();
if(sourceFiles.length!==237)stop("Stage 1 is not exactly 237 active migrations");
const pairedPaths=exec("git",["ls-tree","-r","--name-only",RNB18_PAIRED_COMMIT,"--","supabase/migrations"])
  .split(/\r?\n/).filter(x=>x.endsWith(".sql")).sort();
if(pairedPaths.length!==236)stop("Stage 2 pinned source is not exactly 236 migrations");
if(!sourceFiles.includes(RNB18_OLD))stop("original historical version is missing");
const pruned=sourceFiles.filter(x=>x!==RNB18_OLD).map(x=>"supabase/migrations/"+x);
if(pruned.join("\n")!==pairedPaths.join("\n"))stop("237-to-236 migration filename manifest does not match paired Stage 2");
for(const p of pairedPaths) {
  if(exec("git",["hash-object",p])!==exec("git",["rev-parse",RNB18_PAIRED_COMMIT+":"+p]))
    stop("paired Stage 2 SQL blob differs: "+p);
}
// The old historical SQL is removed ONLY inside this disposable CI worktree.
// All 236 remaining files were just byte-checked against the hosted source.
fs.unlinkSync(oldPath);
const remaining=fs.readdirSync("supabase/migrations").filter(x=>x.endsWith(".sql"));
if(remaining.length!==236||fs.existsSync(oldPath))stop("ephemeral staged source not isolated");
console.log("WK_RNB18_EXACT_237_STAGE1_SOURCE_ASSERTED=PASS");
console.log("WK_RNB18_BYTE_IDENTICAL_236_PAIRED_DISPOSABLE_REPLAY=PASS");
console.log("WK_RNB18_NO_HISTORICAL_EDITION_FIXTURES_OR_REMOTE_TARGET=PASS");
