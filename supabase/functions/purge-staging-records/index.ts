import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req: Request) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization" }), { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Missing env vars", url: supabaseUrl ? "ok" : "missing", key: serviceRoleKey ? "ok" : "missing" }),
      { status: 500 }
    );
  }

  const baseUrl = supabaseUrl.replace(/\/$/, "");
  const rpcUrl = `${baseUrl}/rest/v1/rpc/delete_batch_from_staging`;
  const BATCH_SIZE = 5000;
  let totalDeleted = 0;
  let batch = 0;
  let lastLog = null;
  let lastError = null;

  try {
    while (batch < 1000) {
      batch++;
      let deletedThisBatch = 0;
      let fetchError = null;

      try {
        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceRoleKey}`,
            "apikey": serviceRoleKey,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
          },
          body: JSON.stringify({ batch_size: BATCH_SIZE }),
        });

        const rawText = await response.text();

        if (!response.ok) {
          fetchError = new Error(`HTTP ${response.status}: ${rawText.slice(0, 200)}`);
        } else {
          const result = parseInt(rawText.trim(), 10);
          deletedThisBatch = Number.isNaN(result) ? 0 : result;
        }
      } catch (err) {
        fetchError = err instanceof Error ? err : new Error(String(err));
      }

      if (fetchError) {
        lastError = {
          batch,
          message: fetchError.message,
          total_deleted_so_far: totalDeleted,
        };
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      totalDeleted += deletedThisBatch;
      lastLog = { batch, deleted: deletedThisBatch, total: totalDeleted };

      console.log(`Batch ${batch}: deleted ${deletedThisBatch}, total: ${totalDeleted}`);

      if (deletedThisBatch === 0) {
        break;
      }
    }

    return new Response(
      JSON.stringify({
        status: "done",
        total_batches: batch,
        total_deleted: totalDeleted,
        last_log: lastLog,
        last_error: lastError,
      }),
      { status: 200 }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        status: "error",
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : null,
        batch,
        total_deleted: totalDeleted,
      }),
      { status: 500 }
    );
  }
});