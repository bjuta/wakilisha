// ── Apple Music Developer Token Generator ──
// Returns a JWT developer token for MusicKit JS client authorization.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface AppleMusicTokenResponse {
  developerToken: string | null;
  configured: boolean;
  error?: string;
}

function jsonResponse(payload: AppleMusicTokenResponse, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function notConfigured(message: string, headers: HeadersInit) {
  console.warn(JSON.stringify({ source: "apple-music-token", stage: "not_configured", message }));
  return jsonResponse({ developerToken: null, configured: false, error: message }, 200, headers);
}

// ── b64u helper ──
function b64u(s: string): string {
  return s.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

// ── JWT creator (inlined from shared-apple-music) ──
async function createAppleMusicJWT(pk: string, tid: string, kid: string): Promise<string> {
  const pem = pk
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const bin = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8", bin, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"],
  );
  const header = { alg: "ES256", kid };
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = { iss: tid, iat: nowSec, exp: nowSec + 3600 };
  const enc = new TextEncoder();
  const hb = b64u(btoa(JSON.stringify(header)));
  const pb = b64u(btoa(JSON.stringify(payload)));
  const si = hb + "." + pb;
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, key, enc.encode(si),
  );
  const sb = b64u(btoa(String.fromCharCode(...new Uint8Array(sig))));
  return si + "." + sb;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") ?? "*";
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info, x-supabase-api-version",
    "Access-Control-Max-Age": "86400",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return notConfigured("Apple Music connection is not configured yet.", corsHeaders);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: pkRow, error: pkErr } = await supabase
      .from("admin_settings_secrets")
      .select("setting_value")
      .eq("setting_key", "apple_music_private_key")
      .maybeSingle();

    if (pkErr) {
      console.error(JSON.stringify({ source: "apple-music-token", stage: "read_private_key", error: pkErr.message }));
      return notConfigured("Apple Music credentials could not be read. Ask an admin to check the integration settings.", corsHeaders);
    }

    if (!pkRow?.setting_value) {
      return notConfigured("Apple Music is not configured yet. An admin must upload the Apple Music .p8 key first.", corsHeaders);
    }

    const privateKey = pkRow.setting_value as string;
    const teamId = Deno.env.get("APPLE_TEAM_ID") || "";
    const musicKeyId = Deno.env.get("APPLE_MUSIC_KEY_ID") || "";

    if (!teamId || !musicKeyId) {
      return notConfigured("Apple Music Team ID or Key ID is missing. Ask an admin to finish the Apple Music integration setup.", corsHeaders);
    }

    const developerToken = await createAppleMusicJWT(privateKey, teamId, musicKeyId);

    return jsonResponse({ developerToken, configured: true }, 200, corsHeaders);
  } catch (e) {
    console.error(JSON.stringify({
      source: "apple-music-token",
      stage: "token_generation",
      error: e instanceof Error ? e.message : String(e),
    }));
    return notConfigured("Apple Music credentials are invalid. Ask an admin to check the .p8 key, Team ID, and Key ID.", corsHeaders);
  }
});
