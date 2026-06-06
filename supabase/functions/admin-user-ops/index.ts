// WAKILISHA admin user operations edge function.
// Requires Supabase secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
// Service-role writes happen only after the caller is verified as an administrator.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

type Action = "invite_user" | "send_password_reset";
type InviteScope = { scope_type: string; scope_value: string; can_view?: boolean; can_edit?: boolean; can_publish?: boolean };
type RequestBody = { action: Action; email?: string; role_key?: string; display_name?: string; redirect_to?: string; scopes?: InviteScope[]; user_id?: string };

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
function json(status: number, body: unknown) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function serviceClient() { const url = Deno.env.get("SUPABASE_URL"); const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."); return createClient(url, key, { auth: { persistSession: false } }); }
function userClient(authHeader: string) { const url = Deno.env.get("SUPABASE_URL"); const anon = Deno.env.get("SUPABASE_ANON_KEY"); if (!url || !anon) throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required."); return createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }); }

async function requireAdministrator(authHeader: string) {
  const client = userClient(authHeader);
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) throw Object.assign(new Error("Not authenticated."), { status: 401 });
  const { data: ok, error } = await client.rpc("current_user_is_administrator");
  if (error || ok !== true) throw Object.assign(new Error("Only administrators can use this endpoint."), { status: 403 });
  return userData.user;
}

async function findUserByEmail(service: ReturnType<typeof serviceClient>, email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 1000) break;
  }
  return null;
}

async function audit(service: ReturnType<typeof serviceClient>, actorId: string, targetUserId: string | null, eventType: string, targetTable: string, targetRecordId: string, message: string, metadata: Record<string, unknown>) {
  const { error } = await service.from("admin_audit_events").insert({ actor_user_id: actorId, target_user_id: targetUserId, event_type: eventType, target_table: targetTable, target_record_id: targetRecordId, message, metadata });
  if (error) throw error;
}

async function assignRole(service: ReturnType<typeof serviceClient>, actorId: string, userId: string, email: string, roleKey: string, displayName?: string | null) {
  const now = new Date().toISOString();
  const profile = await service.from("user_profiles").upsert({ user_id: userId, email, display_name: displayName ?? null, status: "active", updated_at: now }, { onConflict: "user_id" });
  if (profile.error) throw profile.error;
  const assigned = await service.from("user_role_assignments").upsert({ user_id: userId, role_key: roleKey, status: "active", assigned_by: actorId, assigned_at: now, notes: "Assigned from admin user operations.", updated_at: now }, { onConflict: "user_id,role_key" }).select("id").single();
  if (assigned.error) throw assigned.error;
  await audit(service, actorId, userId, "role_assigned", "user_role_assignments", String(assigned.data.id), "Role assigned from Admin Studio.", { role_key: roleKey, email });
}

async function assignScopes(service: ReturnType<typeof serviceClient>, actorId: string, userId: string, roleKey: string, scopes: InviteScope[]) {
  const now = new Date().toISOString();
  for (const scope of scopes) {
    if (!scope.scope_type || !scope.scope_value) continue;
    const result = await service.from("user_access_scopes").upsert({ user_id: userId, role_key: roleKey, scope_type: scope.scope_type, scope_value: scope.scope_value, can_view: scope.can_view ?? true, can_edit: scope.can_edit ?? false, can_publish: scope.can_publish ?? false, status: "active", assigned_by: actorId, assigned_at: now, updated_at: now }, { onConflict: "user_id,role_key,scope_type,scope_value" }).select("id").single();
    if (result.error) throw result.error;
    await audit(service, actorId, userId, "scope_assigned", "user_access_scopes", String(result.data.id), "Scope assigned from Admin Studio.", { role_key: roleKey, ...scope });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Only POST is supported." });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Missing bearer token." });
    const actor = await requireAdministrator(authHeader);
    const body = await req.json() as RequestBody;
    const service = serviceClient();

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
      const invite = await service.from("admin_user_invites").insert({ email, role_key: roleKey, display_name: body.display_name ?? null, invite_status: "sent", invited_user_id: targetUser.id, invited_by: actor.id, invite_redirect_to: redirectTo, metadata: { source: "admin-user-ops", scopes: body.scopes ?? [] } }).select("id").single();
      if (invite.error) throw invite.error;
      await assignRole(service, actor.id, targetUser.id, email, roleKey, body.display_name ?? null);
      await assignScopes(service, actor.id, targetUser.id, roleKey, body.scopes ?? []);
      await audit(service, actor.id, targetUser.id, "user_invited", "admin_user_invites", String(invite.data.id), "User invited and role assigned from Admin Studio.", { email, role_key: roleKey, scopes: body.scopes ?? [] });
      return json(200, { ok: true, user_id: targetUser.id, email, role_key: roleKey });
    }

    if (body.action === "send_password_reset") {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!email) return json(400, { error: "email is required." });
      const redirectTo = body.redirect_to || `${new URL(req.url).origin}/auth`;
      const targetUser = body.user_id ? { id: body.user_id } : await findUserByEmail(service, email);
      const reset = await service.auth.resetPasswordForEmail(email, { redirectTo });
      const deliveryStatus = reset.error ? "failed" : "sent";
      const recovery = await service.from("admin_account_recovery_events").insert({ target_user_id: targetUser?.id ?? null, target_email: email, requested_by: actor.id, recovery_type: "password_reset", delivery_status: deliveryStatus, redirect_to: redirectTo, message: reset.error?.message ?? "Password reset email requested from Admin Studio.", metadata: { source: "admin-user-ops" } }).select("id").single();
      if (recovery.error) throw recovery.error;
      await audit(service, actor.id, targetUser?.id ?? null, "password_reset_requested", "admin_account_recovery_events", String(recovery.data.id), "Password reset requested from Admin Studio.", { email, redirect_to: redirectTo, delivery_status: deliveryStatus });
      if (reset.error) throw reset.error;
      return json(200, { ok: true, email, delivery_status: deliveryStatus });
    }

    return json(400, { error: "Unsupported action." });
  } catch (error) {
    const status = typeof (error as { status?: unknown }).status === "number" ? (error as { status: number }).status : 500;
    return json(status, { error: error instanceof Error ? error.message : "Unknown admin user ops error." });
  }
});
