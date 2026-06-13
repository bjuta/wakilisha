import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  "https://wakilisha.africa",
  "https://www.wakilisha.africa",
  "https://staging.wakilisha.africa",
  "https://readdy.cc",
  "https://www.readdy.cc",
  "http://localhost:5173",
  "http://localhost:3000",
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  // Also allow any *.readdy.cc subdomain for preview builds
  const isReaddyPreview = origin.endsWith(".readdy.cc") || origin === "https://readdy.cc";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) || isReaddyPreview ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const PROVIDER_SECRET_KEYS: Record<string, string[]> = {
  spotify: ["SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET", "SPOTIFY_MARKET"],
  apple_music: ["APPLE_MUSIC_TEAM_ID", "APPLE_MUSIC_KEY_ID", "APPLE_MUSIC_STOREFRONT"],
  acrcloud: ["ACR_HOST", "ACR_ACCESS_KEY", "ACR_ACCESS_SECRET", "ACR_CALLBACK_SECRET"],
  youtube: ["YOUTUBE_API_KEY"],
  airplay: ["AIRPLAY_API_BASE", "AIRPLAY_API_KEY"],
};

const DB_KEY_PREFIX: Record<string, string> = {
  SPOTIFY_CLIENT_ID: "spotify_client_id",
  SPOTIFY_CLIENT_SECRET: "spotify_client_secret",
  SPOTIFY_MARKET: "spotify_market",
  APPLE_MUSIC_TEAM_ID: "apple_music_team_id",
  APPLE_MUSIC_KEY_ID: "apple_music_key_id",
  APPLE_MUSIC_STOREFRONT: "apple_music_storefront",
  APPLE_MUSIC_PRIVATE_KEY: "apple_music_private_key",
  ACR_HOST: "acr_host",
  ACR_ACCESS_KEY: "acr_access_key",
  ACR_ACCESS_SECRET: "acr_access_secret",
  ACR_CALLBACK_SECRET: "acr_callback_secret",
  YOUTUBE_API_KEY: "youtube_api_key",
  AIRPLAY_API_BASE: "airplay_api_base",
  AIRPLAY_API_KEY: "airplay_api_key",
};

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

async function acrcloudSign(
  accessKey: string,
  accessSecret: string,
  method: string,
  host: string,
  uri: string,
): Promise<{ signature: string; timestamp: number }> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signatureVersion = "1";
  const stringToSign = `${method}\n${host}\n${uri}\n${accessKey}\n${signatureVersion}\n${timestamp}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(accessSecret),
    { name: "HMAC", hash: "SHA-1" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(stringToSign));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return { signature, timestamp };
}

async function healthCheckAcrcloud(
  host: string, accessKey: string, accessSecret: string,
): Promise<{ ok: boolean; latencyMs: number; message: string; details?: unknown }> {
  const start = Date.now();
  let apiHost = host.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!apiHost) return { ok: false, latencyMs: 0, message: "ACR_HOST is empty." };
  const apiUrl = `https://${apiHost}`;
  const uri = "/v1/containers";
  let sig: string, ts: number;
  try {
    const result = await acrcloudSign(accessKey, accessSecret, "GET", apiHost, uri);
    sig = result.signature; ts = result.timestamp;
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start, message: `Signature generation failed: ${e instanceof Error ? e.message : String(e)}` };
  }
  const fullUrl = `${apiUrl}${uri}?access_key=${encodeURIComponent(accessKey)}&signature=${encodeURIComponent(sig)}&signature_version=1&timestamp=${ts}`;
  let res: Response;
  try { res = await fetch(fullUrl, { method: "GET", headers: { Accept: "application/json" } }); }
  catch (e) { return { ok: false, latencyMs: Date.now() - start, message: `ACRCloud API unreachable at ${apiHost}: ${e instanceof Error ? e.message : String(e)}` }; }
  const latencyMs = Date.now() - start;
  const bodyText = await res.text();
  let bodyJson: unknown = null;
  try { bodyJson = JSON.parse(bodyText); } catch { /* not JSON */ }
  if (res.status === 200) return { ok: true, latencyMs, message: `ACRCloud connection verified (${res.status}). Host: ${apiHost}`, details: { status: res.status, containers: bodyJson, host: apiHost } };
  if (res.status === 401 || res.status === 403) return { ok: false, latencyMs, message: `ACRCloud rejected credentials (${res.status}). Verify ACR_ACCESS_KEY and ACR_ACCESS_SECRET.`, details: { status: res.status, host: apiHost } };
  if (res.status === 404) return { ok: true, latencyMs, message: `ACRCloud host reachable, signature accepted (${res.status}). Credentials appear valid.`, details: { status: res.status, host: apiHost } };
  return { ok: false, latencyMs, message: `ACRCloud returned unexpected status ${res.status}`, details: { status: res.status, host: apiHost } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return json(req, { ok: false, error: "Missing or invalid Authorization header" }, 401);

  const token = authHeader.replace("Bearer ", "");
  const userClient = createClient(supabaseUrl, serviceKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error: authErr } = await userClient.auth.getUser(token);
  if (authErr || !user) return json(req, { ok: false, error: "Invalid or expired token" }, 401);

  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: roles } = await adminClient.from("user_role_assignments").select("role_key").eq("user_id", user.id).eq("status", "active");
  const roleKeys = (roles ?? []).map((r: { role_key: string }) => r.role_key);
  if (!roleKeys.includes("administrator")) {
    const { data: caps } = await adminClient.from("role_capabilities").select("capability_key").in("role_key", roleKeys).eq("capability_key", "manage_settings");
    if (!caps || caps.length === 0) return json(req, { ok: false, error: "Insufficient permissions. Requires 'manage_settings' capability." }, 403);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(req, { ok: false, error: "Invalid JSON body" }, 400); }

  const { action, provider, credentials, envVars } = body as {
    action: string; provider: string;
    credentials?: Record<string, string>; envVars?: string[];
  };

  if (action === "health_check") {
    if (!provider) return json(req, { ok: false, error: "Provider key is required for health_check" }, 400);
    if (provider !== "acrcloud") return json(req, { ok: false, error: `Health check not yet implemented for provider: ${provider}. Currently supported: acrcloud.` }, 400);
    const dbKeys = ["acr_host", "acr_access_key", "acr_access_secret"];
    const { data: secrets, error: secretsErr } = await adminClient.from("admin_settings_secrets").select("setting_key, setting_value").in("setting_key", dbKeys);
    if (secretsErr) return json(req, { ok: false, error: "internal_error" }, 500);
    const credMap = new Map<string, string>();
    for (const s of (secrets ?? [])) credMap.set(s.setting_key as string, (s.setting_value as string)?.trim() ?? "");
    const host = Deno.env.get("ACR_HOST") || credMap.get("acr_host") || "";
    const accessKey = Deno.env.get("ACR_ACCESS_KEY") || credMap.get("acr_access_key") || "";
    const accessSecret = Deno.env.get("ACR_ACCESS_SECRET") || credMap.get("acr_access_secret") || "";
    const missing: string[] = [];
    if (!host) missing.push("ACR_HOST");
    if (!accessKey) missing.push("ACR_ACCESS_KEY");
    if (!accessSecret) missing.push("ACR_ACCESS_SECRET");
    if (missing.length > 0) return json(req, { ok: false, error: `ACRCloud credentials incomplete. Missing: ${missing.join(", ")}.`, code: "missing_credentials", missingVars: missing });
    const result = await healthCheckAcrcloud(host, accessKey, accessSecret);
    await adminClient.from("chart_ingest_audit_events").insert({ run_id: null, actor: user.id, actor_email: user.email || null, action: "provider_health_check", new_status: null, payload_json: { provider: "acrcloud", ok: result.ok, latencyMs: result.latencyMs, host } });
    return json(req, result);
  }

  if (!provider) return json(req, { ok: false, error: "Provider key is required" }, 400);
  const providerEnvVars = PROVIDER_SECRET_KEYS[provider];
  if (!providerEnvVars) return json(req, { ok: false, error: `Unknown provider: ${provider}` }, 400);

  if (action === "clear") {
    const keysToClear = (envVars ?? providerEnvVars).map((ev) => DB_KEY_PREFIX[ev]).filter(Boolean);
    if (keysToClear.length === 0) return json(req, { ok: false, error: "No valid env vars to clear" }, 400);
    const { error: delErr } = await adminClient.from("admin_settings_secrets").delete().in("setting_key", keysToClear);
    if (delErr) return json(req, { ok: false, error: "internal_error" }, 500);
    await adminClient.from("chart_ingest_audit_events").insert({ run_id: null, actor: user.id, actor_email: user.email || null, action: "provider_credentials_cleared", new_status: null, payload_json: { provider, cleared_keys: keysToClear } });
    return json(req, { ok: true, message: `${provider} credentials cleared from secure store.`, clearedKeys: keysToClear });
  }

  if (action !== "save") return json(req, { ok: false, error: `Unknown action: ${action}. Use 'save', 'clear', or 'health_check'.` }, 400);
  if (!credentials || Object.keys(credentials).length === 0) return json(req, { ok: false, error: "credentials object is required for save action" }, 400);

  const now = new Date().toISOString();
  const savedKeys: string[] = [];
  const errors: string[] = [];

  for (const [envVar, value] of Object.entries(credentials)) {
    const dbKey = DB_KEY_PREFIX[envVar];
    if (!dbKey) { errors.push(`Unknown env var: ${envVar}`); continue; }
    if (!providerEnvVars.includes(envVar)) { errors.push(`Env var ${envVar} does not belong to provider ${provider}`); continue; }
    const trimmedValue = String(value).trim();
    if (!trimmedValue) {
      const { error: delErr } = await adminClient.from("admin_settings_secrets").delete().eq("setting_key", dbKey);
      if (delErr) { errors.push(`Failed to clear ${envVar}`); } else { savedKeys.push(`${envVar} (cleared)`); }
      continue;
    }
    const { error: upsertErr } = await adminClient.from("admin_settings_secrets").upsert({ setting_key: dbKey, setting_value: trimmedValue, updated_by: user.id, updated_at: now, metadata: { provider, env_var: envVar, saved_at: now } }, { onConflict: "setting_key" });
    if (upsertErr) { errors.push(`Failed to save ${envVar}`); } else { savedKeys.push(envVar); }
  }

  await adminClient.from("chart_ingest_audit_events").insert({ run_id: null, actor: user.id, actor_email: user.email || null, action: "provider_credentials_saved", new_status: null, payload_json: { provider, saved_keys: savedKeys, error_keys: errors } });

  return json(req, {
    ok: errors.length === 0,
    message: errors.length === 0 ? `${provider} credentials saved securely (${savedKeys.length} field(s)).` : `${provider}: ${savedKeys.length} field(s) saved, ${errors.length} error(s). ${errors.join("; ")}`,
    savedKeys,
    errors: errors.length > 0 ? errors : undefined,
    storedIn: "admin_settings_secrets",
  });
});
