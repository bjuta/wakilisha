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

  const batchSize = 2000;
  let totalDeleted = 0;
  let batch = 0;

  try {
    while (batch < 500) {
      batch += 1;

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
        return jsonResponse(
          {
            status: "error",
            batch,
            total_deleted: totalDeleted,
            upstream_status: response.status,
            upstream_error: rawText.slice(0, 500),
          },
          500,
        );
      }

      const parsed = Number.parseInt(rawText.trim(), 10);
      const deletedThisBatch = Number.isNaN(parsed) ? 0 : parsed;

      totalDeleted += deletedThisBatch;

      console.log(
        JSON.stringify({
          event: "staging_batch_delete",
          requested_by: access.userId,
          batch,
          deleted: deletedThisBatch,
          total_deleted: totalDeleted,
        }),
      );

      if (deletedThisBatch === 0) {
        break;
      }

      if (batch >= 500) {
        return jsonResponse({
          status: "incomplete",
          total_batches: batch,
          total_deleted: totalDeleted,
        });
      }
    }

    return jsonResponse({
      status: "done",
      total_batches: batch,
      total_deleted: totalDeleted,
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
