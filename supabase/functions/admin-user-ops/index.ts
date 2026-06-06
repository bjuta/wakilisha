// WAKILISHA admin user operations edge function.
// Requires Supabase secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
// Optional Resend secrets: RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_FROM_NAME, RESEND_REPLY_TO.
// Service-role writes happen only after the caller is verified as an administrator.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

type Action = "invite_user" | "send_password_reset" | "send_test_email";
type InviteScope = { scope_type: string; scope_value: string; can_view?: boolean; can_edit?: boolean; can_publish?: boolean };
type RequestBody = { action: Action; email?: string; role_key?: string; display_name?: string; redirect_to?: string; scopes?: InviteScope[]; user_id?: string };
type EmailPayload = { to: string; subject: string; html: string; text: string; tags?: Array<{ name: string; value: string }> };

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
function json(status: number, body: unknown) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function serviceClient() { const url = Deno.env.get("SUPABASE_URL"); const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."); return createClient(url, key, { auth: { persistSession: false } }); }
function userClient(authHeader: string) { const url = Deno.env.get("SUPABASE_URL"); const anon = Deno.env.get("SUPABASE_ANON_KEY"); if (!url || !anon) throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required."); return createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }); }
function resendEnabled() { return Boolean(Deno.env.get("RESEND_API_KEY")); }
function fromAddress() { const email = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@wakilisha.africa"; const name = Deno.env.get("RESEND_FROM_NAME") || "WAKILISHA"; return `${name} <${email}>`; }
function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char] ?? char)); }

async function sendResendEmail(payload: EmailPayload) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured.");
  const replyTo = Deno.env.get("RESEND_REPLY_TO") || undefined;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromAddress(), to: [payload.to], subject: payload.subject, html: payload.html, text: payload.text, reply_to: replyTo, tags: payload.tags }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.message === "string" ? data.message : `Resend email failed with ${response.status}`);
  return data;
}

function emailShell(title: string, intro: string, ctaLabel: string, ctaUrl: string, footer: string) {
  const safeTitle = escapeHtml(title);
  const safeIntro = escapeHtml(intro);
  const safeCta = escapeHtml(ctaLabel);
  const safeFooter = escapeHtml(footer);
  const safeUrl = escapeHtml(ctaUrl);
  return `<!doctype html><html><body style="margin:0;background:#f6f4ef;font-family:Inter,Arial,sans-serif;color:#1f1d1b"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f4ef;padding:32px 16px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid #e8e1d8"><tr><td style="padding:28px 28px 8px"><div style="font-weight:900;letter-spacing:-0.04em;font-size:24px;color:#111">WAKILISHA</div></td></tr><tr><td style="padding:12px 28px 8px"><h1 style="margin:0;font-size:28px;line-height:1.05;letter-spacing:-0.04em;color:#111">${safeTitle}</h1></td></tr><tr><td style="padding:8px 28px 20px"><p style="margin:0;font-size:15px;line-height:1.65;color:#5f5850">${safeIntro}</p></td></tr><tr><td style="padding:0 28px 26px"><a href="${safeUrl}" style="display:inline-block;background:#85C441;color:#111;text-decoration:none;font-weight:800;font-size:14px;border-radius:14px;padding:14px 18px">${safeCta}</a></td></tr><tr><td style="padding:0 28px 24px"><p style="margin:0;font-size:12px;line-height:1.6;color:#8a8178">If the button does not work, copy this link into your browser:<br><span style="word-break:break-all;color:#5f5850">${safeUrl}</span></p></td></tr><tr><td style="padding:18px 28px;background:#faf8f4;border-top:1px solid #eee7df"><p style="margin:0;font-size:12px;line-height:1.6;color:#8a8178">${safeFooter}</p></td></tr></table></td></tr></table></body></html>`;
}

function inviteEmail(to: string, actionLink: string, roleKey: string, displayName?: string | null): EmailPayload {
  const name = displayName?.trim() || to;
  const roleLabel = roleKey.replaceAll("_", " ");
  return {
    to,
    subject: "Your WAKILISHA Admin Studio invite",
    html: emailShell("You have been invited to WAKILISHA Admin Studio", `${name}, you have been granted the ${roleLabel} role. Accept the invite to finish setting up your account and enter the correct admin flow.`, "Accept invite", actionLink, "This invite was sent by a WAKILISHA administrator. If you were not expecting it, ignore this email."),
    text: `You have been invited to WAKILISHA Admin Studio with role ${roleLabel}. Accept invite: ${actionLink}`,
    tags: [{ name: "wakilisha_event", value: "admin_invite" }],
  };
}

function resetEmail(to: string, actionLink: string): EmailPayload {
  return {
    to,
    subject: "Reset your WAKILISHA password",
    html: emailShell("Reset your WAKILISHA password", "Use this secure link to choose a new password. The link is time-limited and should only be used by you.", "Reset password", actionLink, "This reset was requested for your WAKILISHA account. If you did not request it, ignore this email."),
    text: `Reset your WAKILISHA password: ${actionLink}`,
    tags: [{ name: "wakilisha_event", value: "password_reset" }],
  };
}

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

async function generateInviteLink(service: ReturnType<typeof serviceClient>, email: string, redirectTo: string, displayName?: string | null) {
  const generated = await service.auth.admin.generateLink({ type: "invite", email, options: { redirectTo, data: { display_name: displayName ?? undefined } } });
  if (generated.error) throw generated.error;
  return { user: generated.data.user, actionLink: generated.data.properties?.action_link };
}

async function generateRecoveryLink(service: ReturnType<typeof serviceClient>, email: string, redirectTo: string) {
  const generated = await service.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo } });
  if (generated.error) throw generated.error;
  return { user: generated.data.user, actionLink: generated.data.properties?.action_link };
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

    if (body.action === "send_test_email") {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!email) return json(400, { error: "email is required." });
      await sendResendEmail({ to: email, subject: "WAKILISHA email test", html: emailShell("WAKILISHA email test", "Resend is connected and sending email for WAKILISHA transactional flows.", "Open staging", body.redirect_to || "https://staging.wakilisha.africa", "This is a test email from the WAKILISHA Admin Studio email integration."), text: "Resend is connected and sending email for WAKILISHA.", tags: [{ name: "wakilisha_event", value: "email_test" }] });
      await audit(service, actor.id, null, "email_test_sent", "admin_user_ops", email, "Resend test email sent from Admin Studio.", { email, provider: "resend" });
      return json(200, { ok: true, email, provider: "resend" });
    }

    if (body.action === "invite_user") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const roleKey = String(body.role_key ?? "").trim();
      if (!email || !roleKey) return json(400, { error: "email and role_key are required." });
      const redirectTo = body.redirect_to || `${new URL(req.url).origin}/admin/login`;
      let targetUser = await findUserByEmail(service, email);
      let deliveryProvider = "supabase";
      let actionLink: string | undefined;
      if (!targetUser && resendEnabled()) {
        const generated = await generateInviteLink(service, email, redirectTo, body.display_name ?? null);
        targetUser = generated.user;
        actionLink = generated.actionLink;
        if (!actionLink) throw new Error("Supabase did not return an invite action link.");
        await sendResendEmail(inviteEmail(email, actionLink, roleKey, body.display_name ?? null));
        deliveryProvider = "resend";
      } else if (!targetUser) {
        const invited = await service.auth.admin.inviteUserByEmail(email, { redirectTo, data: { display_name: body.display_name ?? undefined } });
        if (invited.error) throw invited.error;
        targetUser = invited.data.user;
      }
      if (!targetUser) return json(500, { error: "Could not create or resolve invited user." });
      const invite = await service.from("admin_user_invites").insert({ email, role_key: roleKey, display_name: body.display_name ?? null, invite_status: "sent", invited_user_id: targetUser.id, invited_by: actor.id, invite_redirect_to: redirectTo, metadata: { source: "admin-user-ops", scopes: body.scopes ?? [], delivery_provider: deliveryProvider } }).select("id").single();
      if (invite.error) throw invite.error;
      await assignRole(service, actor.id, targetUser.id, email, roleKey, body.display_name ?? null);
      await assignScopes(service, actor.id, targetUser.id, roleKey, body.scopes ?? []);
      await audit(service, actor.id, targetUser.id, "user_invited", "admin_user_invites", String(invite.data.id), "User invited and role assigned from Admin Studio.", { email, role_key: roleKey, scopes: body.scopes ?? [], delivery_provider: deliveryProvider });
      return json(200, { ok: true, user_id: targetUser.id, email, role_key: roleKey, delivery_provider: deliveryProvider });
    }

    if (body.action === "send_password_reset") {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!email) return json(400, { error: "email is required." });
      const redirectTo = body.redirect_to || `${new URL(req.url).origin}/auth/reset-password`;
      const targetUser = body.user_id ? { id: body.user_id } : await findUserByEmail(service, email);
      let deliveryStatus = "sent";
      let deliveryProvider = "supabase";
      if (resendEnabled()) {
        const generated = await generateRecoveryLink(service, email, redirectTo);
        const actionLink = generated.actionLink;
        if (!actionLink) throw new Error("Supabase did not return a password recovery action link.");
        await sendResendEmail(resetEmail(email, actionLink));
        deliveryProvider = "resend";
      } else {
        const reset = await service.auth.resetPasswordForEmail(email, { redirectTo });
        deliveryStatus = reset.error ? "failed" : "sent";
        if (reset.error) throw reset.error;
      }
      const recovery = await service.from("admin_account_recovery_events").insert({ target_user_id: targetUser?.id ?? null, target_email: email, requested_by: actor.id, recovery_type: "password_reset", delivery_status: deliveryStatus, redirect_to: redirectTo, message: "Password reset email requested from Admin Studio.", metadata: { source: "admin-user-ops", delivery_provider: deliveryProvider } }).select("id").single();
      if (recovery.error) throw recovery.error;
      await audit(service, actor.id, targetUser?.id ?? null, "password_reset_requested", "admin_account_recovery_events", String(recovery.data.id), "Password reset requested from Admin Studio.", { email, redirect_to: redirectTo, delivery_status: deliveryStatus, delivery_provider: deliveryProvider });
      return json(200, { ok: true, email, delivery_status: deliveryStatus, delivery_provider: deliveryProvider });
    }

    return json(400, { error: "Unsupported action." });
  } catch (error) {
    const status = typeof (error as { status?: unknown }).status === "number" ? (error as { status: number }).status : 500;
    return json(status, { error: error instanceof Error ? error.message : "Unknown admin user ops error." });
  }
});
