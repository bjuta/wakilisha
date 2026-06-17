// ── Shared Responses module for Edge Functions ──
// Unified API response envelope: { ok, data/error, meta }

export interface ApiMeta {
  requestId: string;
  servedAt: string;
  version: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  detail?: string;
}

export function requestId(): string {
  return crypto.randomUUID().slice(0, 12);
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function okResponse(
  data: unknown,
  corsHeaders: Record<string, string>,
  status = 200,
  extraHeaders?: Record<string, string>,
): Response {
  const body = {
    ok: true,
    data,
    meta: { requestId: requestId(), servedAt: nowISO(), version: "1.0.0" },
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(extraHeaders ?? {}) },
  });
}

export function errResponse(
  code: string,
  message: string,
  corsHeaders: Record<string, string>,
  status = 400,
  detail?: string,
): Response {
  const body = {
    ok: false,
    error: { code, message, ...(detail ? { detail } : {}) },
    meta: { requestId: requestId(), servedAt: nowISO(), version: "1.0.0" },
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Legacy-compatible JSON response (no envelope) — used during migration */
export function rawJson(
  data: unknown,
  corsHeaders: Record<string, string>,
  status = 200,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(() => new Response("shared-responses", { status: 404 }));
