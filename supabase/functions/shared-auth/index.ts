// ── Shared Auth module for Edge Functions ──
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export interface AuthUser {
  id: string;
  email?: string;
}

/** Extract and verify JWT from Authorization header. Returns user or null. */
export async function verifyJwt(req: Request): Promise<{ user: AuthUser; token: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const uc = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await uc.auth.getUser(token);
  if (error || !user) return null;
  return { user: { id: user.id, email: user.email }, token };
}

/** Check if user has a specific capability via role assignments. */
export async function requireCapability(
  userId: string,
  capability: string,
  db?: ReturnType<typeof createClient>,
): Promise<boolean> {
  const client = db ?? createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: roles } = await client
    .from("user_role_assignments")
    .select("role_key, role_definitions!inner(role_capabilities(capability_key))")
    .eq("user_id", userId)
    .eq("status", "active")
    .or("expires_at.is.null,expires_at.gt.now()");

  if (!roles || roles.length === 0) return false;

  // Administrator role bypass
  if (roles.some((r: { role_key: string }) => r.role_key === "administrator")) return true;

  const allCaps = new Set<string>();
  for (const r of roles) {
    const caps = (r.role_definitions as { role_capabilities?: Array<{ capability_key: string }> } | null)
      ?.role_capabilities ?? [];
    for (const c of caps) allCaps.add(c.capability_key);
  }
  return allCaps.has(capability);
}

Deno.serve(() => new Response("shared-auth", { status: 404 }));
