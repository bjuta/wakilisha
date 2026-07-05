// ── Shared Apple Music module for Edge Functions ──
// JWT creation + credential reading + source fetching

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Import credential reader from shared-db
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function readCredential(envVar: string, dbKey: string, db?: ReturnType<typeof createClient>): Promise<string | null> {
  const ev = Deno.env.get(envVar);
  if (ev && ev.trim()) return ev.trim();
  if (!db) return null;
  try {
    const { data: row } = await db.from("admin_settings_secrets").select("setting_value").eq("setting_key", dbKey).maybeSingle();
    if (row && (row.setting_value as string)?.trim()) return (row.setting_value as string).trim();
  } catch { /* ignore */ }
  return null;
}

/** Create an Apple Music JWT for API calls. */
export async function createAppleMusicJWT(pk: string, tid: string, kid: string): Promise<string> {
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
  const b64u = (s: string) => s.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const hb = b64u(btoa(JSON.stringify(header)));
  const pb = b64u(btoa(JSON.stringify(payload)));
  const si = hb + "." + pb;
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, key, enc.encode(si),
  );
  const sb = b64u(btoa(String.fromCharCode(...new Uint8Array(sig))));
  return si + "." + sb;
}

/** Fetch Apple Music credentials and return a JWT token. */
export async function getAppleMusicToken(db?: ReturnType<typeof createClient>): Promise<{ token: string } | { error: string }> {
  const privateKey = await readCredential("APPLE_MUSIC_PRIVATE_KEY", "apple_music_private_key", db);
  const teamId = await readCredential("APPLE_MUSIC_TEAM_ID", "apple_music_team_id", db);
  const musicKeyId = await readCredential("APPLE_MUSIC_KEY_ID", "apple_music_key_id", db);
  if (!privateKey || !teamId || !musicKeyId) {
    const missing = [!privateKey && "APPLE_MUSIC_PRIVATE_KEY", !teamId && "APPLE_MUSIC_TEAM_ID", !musicKeyId && "APPLE_MUSIC_KEY_ID"].filter(Boolean);
    return { error: "Apple Music credentials missing: " + missing.join(", ") };
  }
  try {
    const token = await createAppleMusicJWT(privateKey, teamId, musicKeyId);
    return { token };
  } catch (e) {
    return { error: "JWT failed: " + (e instanceof Error ? e.message : String(e)) };
  }
}

Deno.serve(() => new Response("shared-apple-music", { status: 404 }));
