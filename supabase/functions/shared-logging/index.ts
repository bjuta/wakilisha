// ── Shared Logging module for Edge Functions ──
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Write an audit event (fire-and-forget). */
export async function writeAuditLog(params: {
  actorId: string;
  actorLabel?: string;
  action: string;
  newStatus?: string;
  payload?: Record<string, unknown>;
  runId?: string;
}): Promise<void> {
  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  try {
    await db.from("chart_ingest_audit_events").insert({
      run_id: params.runId ?? null,
      actor: params.actorId,
      actor_email: params.actorLabel ?? null,
      action: params.action,
      new_status: params.newStatus ?? null,
      payload_json: params.payload ?? {},
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[audit-log] write failed:", err instanceof Error ? err.message : String(err));
  }
}

Deno.serve(() => new Response("shared-logging", { status: 404 }));
