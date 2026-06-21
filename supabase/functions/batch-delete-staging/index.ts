import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Supabase service role key missing. This function requires SERVICE_ROLE_KEY to delete staging records." }), { status: 500 });
  }

  const baseUrl = supabaseUrl.replace(/\/$/, "");
  const rpcUrl = `${baseUrl}/rest/v1/rpc/delete_batch_from_staging`;
  const BATCH_SIZE = 2000;
  let totalDeleted = 0;
  let batch = 0;

  try {
    while (batch < 500) {
      batch++;
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
        return new Response(JSON.stringify({
          status: "error",
          batch,
          total_deleted: totalDeleted,
          http_status: response.status,
          body: rawText.slice(0, 500),
        }), { status: 500 });
      }

      const deletedThisBatch = parseInt(rawText.trim(), 10) || 0;
      totalDeleted += deletedThisBatch;

      console.log(`Batch ${batch}: deleted ${deletedThisBatch}, total: ${totalDeleted}`);

      if (deletedThisBatch === 0) {
        break;
      }

      if (batch >= 500) {
        return new Response(JSON.stringify({
          status: "incomplete",
          total_batches: batch,
          total_deleted: totalDeleted,
        }), { status: 200 });
      }
    }

    return new Response(JSON.stringify({
      status: "done",
      total_batches: batch,
      total_deleted: totalDeleted,
    }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({
      status: "error",
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : null,
      batch,
      total_deleted: totalDeleted,
    }), { status: 500 });
  }
});