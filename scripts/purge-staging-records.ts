import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv(path: string) {
  try {
    const content = readFileSync(path, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (match) {
        const [, key, value] = match;
        process.env[key] = value.trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch { /* ignore */ }
}

loadEnv(resolve(process.cwd(), ".env.local"));
loadEnv(resolve(process.cwd(), ".env"));

const supabaseUrl = process.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env vars. Set VITE_PUBLIC_SUPABASE_URL and VITE_PUBLIC_SUPABASE_ANON_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const BATCH_SIZE = 2000;
let totalDeleted = 0;
let batch = 0;

async function run() {
  console.log("Starting purge of wk_import_staging_records...");
  while (true) {
    batch++;
    const { data, error } = await supabase.rpc("delete_batch_from_staging", {
      batch_size: BATCH_SIZE,
    });

    if (error) {
      console.error(`Batch ${batch} error:`, error.message);
      process.exit(1);
    }

    const deletedThisBatch = typeof data === "number" ? data : 0;
    totalDeleted += deletedThisBatch;

    console.log(`Batch ${batch}: deleted ${deletedThisBatch}, total: ${totalDeleted}`);

    if (deletedThisBatch === 0) {
      console.log("Done! Table is empty.");
      break;
    }
  }
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});