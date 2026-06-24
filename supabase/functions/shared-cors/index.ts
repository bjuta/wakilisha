// ── Shared CORS module for Edge Functions ──
// Two modes: open (public APIs) and restricted (admin APIs with origin allowlist)

export const OPEN_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const OPEN_WRITE_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PATCH, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const ALLOWED_ORIGINS = [
  "https://wakilisha.africa",
  "https://www.wakilisha.africa",
  "https://staging.wakilisha.africa",
  "https://wakilisha.africa",
  "https://wakilisha.africa",
  "https://wakilisha.africa",
  "http://localhost:5173",
  "http://localhost:3000",
];

export function restrictedCors(req: Request, methods = "GET, POST, OPTIONS"): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const isWakilishaPreview = origin.endsWith(".wakilisha.africa") || origin === "https://wakilisha.africa";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) || isWakilishaPreview ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": methods,
    "Vary": "Origin",
  };
}

Deno.serve(() => new Response("shared-cors", { status: 404 }));
