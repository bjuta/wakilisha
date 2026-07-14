import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireImportManagementAccess } from "../_shared/require-import-management-access.ts";

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse(
      {
        status: "error",
        error: "method_not_allowed",
      },
      405,
      {
        Allow: "POST",
      },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(
      {
        status: "error",
        error: "server_not_configured",
      },
      500,
    );
  }

  const access = await requireImportManagementAccess(
    req,
    supabaseUrl,
    anonKey,
  );

  if (!access.ok) {
    return jsonResponse(
      {
        status: "error",
        error: access.error,
      },
      access.status,
    );
  }

  const baseUrl = supabaseUrl.replace(/\/$/, "");
  const rpcUrl =
    `${baseUrl}/rest/v1/rpc/delete_batch_from_staging`;

  const batchSize = 5000;
  let totalDeleted = 0;
  let batch = 0;
  let lastLog: Record<string, number> | null = null;
  let lastError: Record<string, unknown> | null = null;

  try {
    while (batch < 1000) {
      batch += 1;

      let deletedThisBatch = 0;
      let fetchError: Error | null = null;

      try {
        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            batch_size: batchSize,
          }),
        });

        const rawText = await response.text();

        if (!response.ok) {
          fetchError = new Error(
            `HTTP ${response.status}: ${rawText.slice(0, 200)}`,
          );
        } else {
          const result = Number.parseInt(rawText.trim(), 10);
          deletedThisBatch = Number.isNaN(result) ? 0 : result;
        }
      } catch (error: unknown) {
        fetchError = error instanceof Error
          ? error
          : new Error(String(error));
      }

      if (fetchError) {
        lastError = {
          batch,
          message: fetchError.message,
          total_deleted_so_far: totalDeleted,
        };

        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }

      totalDeleted += deletedThisBatch;
      lastLog = {
        batch,
        deleted: deletedThisBatch,
        total: totalDeleted,
      };

      console.log(
        JSON.stringify({
          event: "staging_purge_batch",
          requested_by: access.userId,
          batch,
          deleted: deletedThisBatch,
          total_deleted: totalDeleted,
        }),
      );

      if (deletedThisBatch === 0) {
        break;
      }
    }

    return jsonResponse({
      status: "done",
      total_batches: batch,
      total_deleted: totalDeleted,
      last_log: lastLog,
      last_error: lastError,
    });
  } catch (error: unknown) {
    return jsonResponse(
      {
        status: "error",
        error: error instanceof Error
          ? error.message
          : String(error),
        batch,
        total_deleted: totalDeleted,
      },
      500,
    );
  }
});
