// WAKILISHA admin user operations edge function.
// Requires Supabase secrets:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
//
// Supported actions:
// - invite_user: create/invite auth user, assign role, optionally scopes
// - send_password_reset: send recovery email and record audit
//
// This function uses service-role APIs server-side only. Never expose the service role key to the client.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

type Action = "invite_user" | "send_password_reset";
type InviteScope = {
  scope_type: string;
  scope_value: string;
  can_view?: boolean;
  can_edit?: boolean;
  can_publish?: boolean;
};

type RequestBody = {
  action: Action;
  email?: string;
  role_key?: string;
  display_name?: string;
  redirect_to?: string;
  scopes?: InviteScope[];
  user_id?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  return createClient(url, key, { auth: { persistSession: false } });
}

function anonClient(authHeader: string) {
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required.");
  return createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
}

async function requireAdministrator(authHeader: string) {
  const client = anonClient(authHeader);
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) throw Object.assign(new Error("Not authenticated."), { status: 401 });
  const { data: ok, error } = await client.rpc("current_user_is_administrator");
  if (error || ok !== true) throw Object.assign(new Error("Only administrators can use this endpoint."), { status: 403 });
  return userData.user;
}

async function findUserByEmail(service: ReturnType<typeof adminClient>, email: string) {
  let page = 1;
  while (page <= 20) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 1000) break;
    page++;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Only POST is supported." });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Missing bearer token." });
    const actor = await requireAdministrator(authHeader);
    const body = await req.json() as RequestBody;
    const service = adminClient();

    if (body.action === "invite_user") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const roleKey = String(body.role_key ?? "").trim();
      if (!email || !roleKey) return json(400, { error: "email and role_key are required." });
      const redirectTo = body.redirect_to || `${new URL(req.url).origin}/admin/login`;

      let targetUser = await findUserByEmail(service, email);
      if (!targetUser) {
        const invited = await service.auth.admin.inviteUserByEmail(email, { redirectTo, data: { display_name: body.display_name ?? undefined } });
        if (invited.error) throw invited.error;
        targetUser = invited.data.user;
      }
      if (!targetUser) return json(500, { error: "Could not create or resolve invited user." });

      await service.from("admin_user_invites").insert({ email, role_key: roleKey, display_name: body.display_name ?? null, invite_status: "sent", invited_user_id: targetUser.id, invited_by: actor.id, invite_redirect_to: redirectTo, metadata: { source: "admin-user-ops" } });
      const assigned = await service.rpc("assign_user_role_admin", { target_user_id: targetUser.id, target_role_key: roleKey, target_display_name: body.display_name ?? null, target_bio: null, assignment_notes: "Assigned from admin user invite flow." });
      if (assigned.error) throw assigned.error;

      for (const scope of body.scopes ?? []) {
        if (!scope.scope_type || !scope.scope_value) continue;
        const scoped = await service.rpc("upsert_user_scope_admin", { target_user_id: targetUser.id, target_role_key: roleKey, target_scope_type: scope.scope_type, target_scope_value: scope.scope_value, target_can_view: scope.can_view ?? true, target_can_edit: scope.can_edit ?? false, target_can_publish: scope.can_publish ?? false });
        if (scoped.error) throw scoped.error;
      }

      await service.from("admin_audit_events").insert({ actor_user_id: actor.id, target_user_id: targetUser.id, event_type: "user_invited", target_table: "admin_user_invites", target_record_id: targetUser.id, message: "User invited and role assigned from Admin Studio.", metadata: { email, role_key: roleKey, scopes: body.scopes ?? [] } });
      return json(200, { ok: true, user_id: targetUser.id, email, role_key: roleKey });
    }

    if (body.action === "send_password_reset") {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!email) return json(400, { error: "email is required." });
      const redirectTo = body.redirect_to || `${new URL(req.url).origin}/auth`;
      const targetUser = body.user_id ? { id: body.user_id } : await findUserByEmail(service, email);
      const reset = await service.auth.resetPasswordForEmail(email, { redirectTo });
      const deliveryStatus = reset.error ? "failed" : "sent";
      await service.rpc("record_password_reset_admin", { target_user_id: targetUser?.id ?? null, target_email: email, redirect_to: redirectTo, delivery_status: deliveryStatus, message: reset.error?.message ?? "Password reset email requested from Admin Studio." });
      if (reset.error) throw reset.error;
      return json(200, { ok: true, email, delivery_status: deliveryStatus });
    }

    return json(400, { error: "Unsupported action." });
  } catch (error) {
    const status = typeof (error as { status?: unknown }).status === "number" ? (error as { status: number }).status : 500;
    return json(status, { error: error instanceof Error ? error.message : "Unknown admin user ops error." });
  }
});
