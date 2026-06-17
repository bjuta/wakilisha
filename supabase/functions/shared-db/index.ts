// ── Shared DB module for Edge Functions ──
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Service-role Supabase client (bypasses RLS). */
export function getServiceClient(): ReturnType<typeof createClient> {
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

/** User-scoped Supabase client (respects RLS for given JWT). */
export function getUserClient(token: string): ReturnType<typeof createClient> {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

/** Read a provider credential from env or admin_settings_secrets. */
export async function readCredential(
  envVar: string,
  dbKey: string,
  db?: ReturnType<typeof createClient>,
): Promise<string | null> {
  const ev = Deno.env.get(envVar);
  if (ev && ev.trim()) return ev.trim();
  if (!db) return null;
  try {
    const { data: row } = await db
      .from("admin_settings_secrets")
      .select("setting_value")
      .eq("setting_key", dbKey)
      .maybeSingle();
    if (row && (row.setting_value as string)?.trim()) return (row.setting_value as string).trim();
  } catch { /* ignore */ }
  return null;
}

Deno.serve(() => new Response("shared-db", { status: 404 }));
