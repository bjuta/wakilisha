/**
 * Download and extract WAKILISHA CSV export from Dropbox
 * Run in Codespaces/SSH, not from the browser.
 */
import { createWriteStream, mkdirSync, existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import path from "node:path";

const DROPBOX_URL = "https://www.dropbox.com/scl/fi/zfhyr3spm1ga579oe08u1/wakilisha_supabase_import_2026-05-30.zip?rlkey=y66f7vvrobxcxkberuwx8dkfn&st=oelezl89&dl=1";
const BASE_DIR = "data/supabase-imports/2026-05-30";
const ZIP_PATH = path.join(BASE_DIR, "wakilisha_supabase_import_2026-05-30.zip");
const RAW_DIR = path.join(BASE_DIR, "raw");

async function downloadFile(url: string, dest: string): Promise<void> {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
  }
  const body = response.body;
  if (!body) {
    throw new Error("Response body is empty");
  }
  const fileStream = createWriteStream(dest);
  await pipeline(Readable.fromWeb(body as unknown as import("node:stream/web").ReadableStream), fileStream);
  console.log(`Downloaded to ${dest}`);
}

async function main(): Promise<void> {
  console.log("WAKILISHA CSV Download & Extract Pipeline");
  console.log("==========================================\n");

  // Ensure directories exist
  mkdirSync(BASE_DIR, { recursive: true });

  // Download
  if (!existsSync(ZIP_PATH)) {
    console.log("Downloading ZIP from Dropbox...");
    await downloadFile(DROPBOX_URL, ZIP_PATH);
  } else {
    console.log(`ZIP already exists at ${ZIP_PATH}`);
  }

  // Clean old raw
  if (existsSync(RAW_DIR)) {
    console.log("Cleaning old raw/ directory...");
    await rm(RAW_DIR, { recursive: true, force: true });
  }

  mkdirSync(RAW_DIR, { recursive: true });

  // Extract using unzipper
  console.log("Extracting ZIP...");
  const unzipper = await import("unzipper");
  await createWriteStream(ZIP_PATH)
    .pipe(unzipper.Extract({ path: RAW_DIR }))
    .promise();

  console.log(`\nExtracted to ${RAW_DIR}`);
  console.log("Done.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});