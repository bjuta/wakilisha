import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { SkeletonAdminTable } from "@/components/skeletons/Skeletons";
import { useAdminUser } from "@/hooks/useAdminUser";
import { supabase } from "@/lib/supabase";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES, type AccessScope, type UserRole } from "@/services/userRoles";

type ProfileRow = { user_id: string; email: string | null; display_name: string | null; status: string | null; created_at: string | null; updated_at: string | null };
type AssignmentRow = { id: string; user_id: string; role_key: UserRole; status: string; created_at: string; updated_at: string };
type AuditRow = { id: string; actor_user_id: string | null; target_user_id: string | null; event_type: string; target_table: string | null; target_record_id: string | null; message: string | null; created_at: string };
type RecoveryRow = { id: string; target_email: string; target_user_id: string | null; delivery_status: string; redirect_to: string | null; created_at: string };
type InviteRow = { id: string; email: string; role_key: UserRole; display_name: string | null; invite_status: string; invited_user_id: string | null; created_at: string };
type UserAccess = { profile: ProfileRow; roles: AssignmentRow[]; scopes: AccessScope[] };

type Modal = "invite" | "scope" | "reset" | null;

const ADMIN_ROLES = ROLES.filter((role) => !["subscriber", "customer", "member", "premium_member"].includes(role));
const SCOPE_TYPES = ["global", "market", "country", "region", "series", "vertical", "entity_type"];

function shortId(value: string) { return value ? `${value.slice(0, 8)}…` : "—"; }
function date(value?: string | null) { return value ? new Date(value).toLocaleString() : "—"; }
function roleTone(role: string) {
  if (role === "administrator") return "border-wk-danger/20 bg-wk-danger/10 text-wk-danger";
  if (role.includes("chart")) return "border-wk-brand/20 bg-wk-brand/10 text-wk-brand";
  if (role.includes("registry") || role.includes("media")) return "border-wk-success/20 bg-wk-success/10 text-wk-success";
  if (role.includes("review") || role.includes("moderator")) return "border-wk-warning/20 bg-wk-warning/10 text-wk-warning";
  return "border-wk-border bg-wk-surface-raised text-wk-text-muted";
}

async function callAdminUserOps(payload: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Admin session is missing. Sign in again.");
  const { data, error } = await supabase.functions.invoke("admin-user-ops", { body: payload, headers: { Authorization: `Bearer ${token}` } });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data;
}

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const currentUser = useAdminUser();
  const [users, setUsers] = useState<UserAccess[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [recoveries, setRecoveries] = useState<RecoveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccess | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("editor");
  const [inviteScopeType, setInviteScopeType] = useState("global");
  const [inviteScopeValue, setInviteScopeValue] = useState("*");
  const [inviteCanEdit, setInviteCanEdit] = useState(true);
  const [inviteCanPublish, setInviteCanPublish] = useState(false);

  const [scopeRole, setScopeRole] = useState<UserRole>("chart_editor_regional");
  const [scopeType, setScopeType] = useState("market");
  const [scopeValue, setScopeValue] = useState("");
  const [scopeCanEdit, setScopeCanEdit] = useState(true);
  const [scopeCanPublish, setScopeCanPublish] = useState(false);

  const canManageUsers = currentUser.can("manage_users");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profilesRes, rolesRes, scopesRes, invitesRes, auditsRes, recoveryRes] = await Promise.all([
        supabase.from("user_profiles").select("user_id,email,display_name,status,created_at,updated_at").order("updated_at", { ascending: false }).limit(500),
        supabase.from("user_role_assignments").select("id,user_id,role_key,status,created_at,updated_at").neq("status", "revoked").order("updated_at", { ascending: false }).limit(1000),
        supabase.from("user_access_scopes").select("id,user_id,role_key,scope_type,scope_value,can_view,can_edit,can_publish,status").neq("status", "revoked").order("updated_at", { ascending: false }).limit(1000),
        supabase.from("admin_user_invites").select("id,email,role_key,display_name,invite_status,invited_user_id,created_at").order("created_at", { ascending: false }).limit(50),
        supabase.from("admin_audit_events").select("id,actor_user_id,target_user_id,event_type,target_table,target_record_id,message,created_at").order("created_at", { ascending: false }).limit(40),
        supabase.from("admin_account_recovery_events").select("id,target_email,target_user_id,delivery_status,redirect_to,created_at").order("created_at", { ascending: false }).limit(25),
      ]);
      for (const res of [profilesRes, rolesRes, scopesRes, invitesRes, auditsRes, recoveryRes]) if (res.error) throw res.error;
      const profiles = (profilesRes.data ?? []) as ProfileRow[];
      const roles = (rolesRes.data ?? []) as AssignmentRow[];
      const scopes = (scopesRes.data ?? []) as AccessScope[];
      const userIds = new Set([...profiles.map((p) => p.user_id), ...roles.map((r) => r.user_id), ...scopes.map((s) => String((s as any).user_id ?? ""))].filter(Boolean));
      const profileById = new Map(profiles.map((p) => [p.user_id, p]));
      setUsers(Array.from(userIds).map((userId) => ({
        profile: profileById.get(userId) ?? { user_id: userId, email: null, display_name: null, status: "active", created_at: null, updated_at: null },
        roles: roles.filter((r) => r.user_id === userId),
        scopes: scopes.filter((s) => String((s as any).user_id) === userId),
      })).sort((a, b) => String(b.profile.updated_at ?? "").localeCompare(String(a.profile.updated_at ?? ""))));
      setInvites((invitesRes.data ?? []) as InviteRow[]);
      setAudits((auditsRes.data ?? []) as AuditRow[]);
      setRecoveries((recoveryRes.data ?? []) as RecoveryRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load access console.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const totals = useMemo(() => ({
    users: users.length,
    admins: users.filter((u) => u.roles.some((r) => r.role_key === "administrator" && r.status === "active")).length,
    scoped: users.filter((u) => u.scopes.length > 0).length,
    invites: invites.filter((i) => ["pending", "sent"].includes(i.invite_status)).length,
  }), [users, invites]);

  if (!currentUser.loading && !canManageUsers) {
    return <div className="py-20 text-center"><WkIcon name="ShieldOff" size={34} className="mx-auto mb-4 text-wk-danger" /><h2 className="text-[18px] font-bold text-wk-text">Access denied</h2><p className="mt-1 text-[13px] text-wk-text-muted">Only users with manage_users can operate roles, scopes, invites, and password recovery.</p><button onClick={() => navigate("/admin")} className="wk-button wk-button-ghost wk-button-sm mt-4">Back to Dashboard</button></div>;
  }

  async function handleInvite() {
    setBusy(true); setError(null); setMessage(null);
    try {
      const scopes = inviteScopeType && inviteScopeValue ? [{ scope_type: inviteScopeType, scope_value: inviteScopeValue, can_view: true, can_edit: inviteCanEdit, can_publish: inviteCanPublish }] : [];
      await callAdminUserOps({ action: "invite_user", email: inviteEmail, role_key: inviteRole, display_name: inviteName || undefined, redirect_to: `${window.location.origin}/admin/login`, scopes });
      setMessage(`Invite/role assignment sent for ${inviteEmail}.`); setModal(null); setInviteEmail(""); setInviteName(""); await loadData();
    } catch (err) { setError(err instanceof Error ? err.message : "Invite failed."); } finally { setBusy(false); }
  }

  async function handleAddScope() {
    if (!selectedUser) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const { error } = await supabase.rpc("upsert_user_scope_admin", { target_user_id: selectedUser.profile.user_id, target_role_key: scopeRole, target_scope_type: scopeType, target_scope_value: scopeValue, target_can_view: true, target_can_edit: scopeCanEdit, target_can_publish: scopeCanPublish });
      if (error) throw error;
      setMessage("Scope assigned."); setModal(null); await loadData();
    } catch (err) { setError(err instanceof Error ? err.message : "Scope assignment failed."); } finally { setBusy(false); }
  }

  async function handleRevokeRole(userId: string, role: UserRole) {
    if (!confirm(`Revoke ${ROLE_LABELS[role] ?? role}?`)) return;
    setBusy(true); setError(null);
    try { const { error } = await supabase.rpc("revoke_user_role_admin", { target_user_id: userId, target_role_key: role }); if (error) throw error; await loadData(); }
    catch (err) { setError(err instanceof Error ? err.message : "Role revocation failed."); }
    finally { setBusy(false); }
  }

  async function handleSuspend(user: UserAccess) {
    if (!confirm(`Suspend access for ${user.profile.email || user.profile.user_id}?`)) return;
    setBusy(true); setError(null);
    try { const { error } = await supabase.rpc("suspend_user_access_admin", { target_user_id: user.profile.user_id, reason: "Suspended from Admin Users console." }); if (error) throw error; await loadData(); }
    catch (err) { setError(err instanceof Error ? err.message : "Suspend failed."); }
    finally { setBusy(false); }
  }

  async function handlePasswordReset() {
    if (!selectedUser) return;
    const email = selectedUser.profile.email;
    if (!email) { setError("This user has no email in user_profiles. Use Supabase Auth dashboard or invite by email first."); return; }
    setBusy(true); setError(null); setMessage(null);
    try {
      await callAdminUserOps({ action: "send_password_reset", user_id: selectedUser.profile.user_id, email, redirect_to: `${window.location.origin}/auth` });
      setMessage(`Password reset email sent to ${email}.`); setModal(null); await loadData();
    } catch (err) { setError(err instanceof Error ? err.message : "Password reset failed."); } finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Administration</div><h1 className="text-[24px] font-black tracking-tight text-wk-text">Access Console</h1><p className="mt-1 max-w-3xl text-[13px] leading-6 text-wk-text-muted">Invite users, assign roles, grant market/series scopes, suspend access, trigger password recovery, and inspect audit trails.</p></div><button onClick={() => setModal("invite")} className="wk-button wk-button-primary wk-button-sm"><WkIcon name="UserPlus" size={14} /> Invite / assign user</button></div>
    {error && <div className="rounded-xl border border-wk-danger/30 bg-wk-danger-soft p-3 text-[13px] text-wk-danger">{error}</div>}
    {message && <div className="rounded-xl border border-wk-success/30 bg-wk-success-soft p-3 text-[13px] text-wk-success">{message}</div>}
    <div className="grid gap-3 sm:grid-cols-4"><Kpi label="Users" value={totals.users} icon="Users" /><Kpi label="Administrators" value={totals.admins} icon="ShieldCheck" /><Kpi label="Scoped users" value={totals.scoped} icon="Map" /><Kpi label="Open invites" value={totals.invites} icon="Mail" /></div>
    <WkSurface className="overflow-hidden">{loading ? <SkeletonAdminTable rows={8} cols={5} /> : <div className="overflow-x-auto"><table className="w-full text-left text-[12px]"><thead className="border-b border-wk-border bg-wk-surface-raised text-[10px] uppercase tracking-wider text-wk-text-faint"><tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Roles</th><th className="px-4 py-3">Scopes</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-wk-border">{users.map((user) => <tr key={user.profile.user_id} className="hover:bg-wk-surface-raised"><td className="px-4 py-3"><div className="font-bold text-wk-text">{user.profile.display_name || user.profile.email || shortId(user.profile.user_id)}</div><div className="text-wk-text-muted">{user.profile.email || user.profile.user_id}</div></td><td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">{user.roles.length ? user.roles.map((role) => <span key={role.id} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${roleTone(role.role_key)}`}>{ROLE_LABELS[role.role_key] ?? role.role_key}<button onClick={() => handleRevokeRole(user.profile.user_id, role.role_key)} className="ml-1 opacity-70 hover:opacity-100">×</button></span>) : <span className="text-wk-text-faint">No role</span>}</div></td><td className="px-4 py-3"><div className="space-y-1">{user.scopes.slice(0, 3).map((scope) => <div key={scope.id} className="text-[11px] text-wk-text-muted">{scope.scope_type}:{scope.scope_value} {scope.can_publish ? "· publish" : scope.can_edit ? "· edit" : "· view"}</div>)}{user.scopes.length > 3 && <div className="text-[11px] text-wk-text-faint">+{user.scopes.length - 3} more</div>}</div></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${user.profile.status === "suspended" ? "bg-wk-danger-soft text-wk-danger" : "bg-wk-success-soft text-wk-success"}`}>{user.profile.status || "active"}</span></td><td className="px-4 py-3"><div className="flex justify-end gap-2"><button onClick={() => { setSelectedUser(user); setScopeRole(user.roles[0]?.role_key ?? "chart_editor_regional"); setModal("scope"); }} className="wk-button wk-button-ghost wk-button-sm">Scope</button><button onClick={() => { setSelectedUser(user); setModal("reset"); }} className="wk-button wk-button-ghost wk-button-sm">Reset</button><button onClick={() => handleSuspend(user)} className="wk-button wk-button-ghost wk-button-sm text-wk-danger" disabled={busy}>Suspend</button></div></td></tr>)}</tbody></table></div>}</WkSurface>
    <div className="grid gap-6 xl:grid-cols-3"><RecentPanel title="Recent invites" rows={invites.map((i) => ({ id: i.id, top: i.email, meta: `${i.role_key} · ${i.invite_status}`, detail: date(i.created_at) }))} /><RecentPanel title="Password recovery" rows={recoveries.map((r) => ({ id: r.id, top: r.target_email, meta: r.delivery_status, detail: date(r.created_at) }))} /><RecentPanel title="Audit trail" rows={audits.map((a) => ({ id: a.id, top: a.event_type, meta: a.target_table || "audit", detail: a.message || date(a.created_at) }))} /></div>
    <WkSurface className="p-5"><h2 className="mb-3 text-[14px] font-bold text-wk-text">Role catalogue</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{ROLES.map((role) => <div key={role} className="rounded-lg border border-wk-border p-3"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${roleTone(role)}`}>{ROLE_LABELS[role]}</span><p className="mt-2 text-[11px] leading-5 text-wk-text-muted">{ROLE_DESCRIPTIONS[role]}</p></div>)}</div></WkSurface>
    {modal === "invite" && <Modal title="Invite / assign user" onClose={() => setModal(null)}><Field label="Email"><input className="wk-input w-full" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="person@wakilisha.africa" /></Field><Field label="Display name"><input className="wk-input w-full" value={inviteName} onChange={(e) => setInviteName(e.target.value)} /></Field><Field label="Role"><select className="wk-input w-full" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as UserRole)}>{ADMIN_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Scope type"><select className="wk-input w-full" value={inviteScopeType} onChange={(e) => setInviteScopeType(e.target.value)}>{SCOPE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></Field><Field label="Scope value"><input className="wk-input w-full" value={inviteScopeValue} onChange={(e) => setInviteScopeValue(e.target.value)} placeholder="kenya / top-100 / *" /></Field></div><Checks canEdit={inviteCanEdit} setCanEdit={setInviteCanEdit} canPublish={inviteCanPublish} setCanPublish={setInviteCanPublish} /><button onClick={handleInvite} disabled={busy} className="wk-button wk-button-primary w-full">{busy ? "Sending…" : "Send invite and assign"}</button></Modal>}
    {modal === "scope" && selectedUser && <Modal title={`Assign scope to ${selectedUser.profile.email || shortId(selectedUser.profile.user_id)}`} onClose={() => setModal(null)}><Field label="Role"><select className="wk-input w-full" value={scopeRole} onChange={(e) => setScopeRole(e.target.value as UserRole)}>{ADMIN_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Scope type"><select className="wk-input w-full" value={scopeType} onChange={(e) => setScopeType(e.target.value)}>{SCOPE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></Field><Field label="Scope value"><input className="wk-input w-full" value={scopeValue} onChange={(e) => setScopeValue(e.target.value)} placeholder="kenya / nigeria / top-100" /></Field></div><Checks canEdit={scopeCanEdit} setCanEdit={setScopeCanEdit} canPublish={scopeCanPublish} setCanPublish={setScopeCanPublish} /><button onClick={handleAddScope} disabled={busy} className="wk-button wk-button-primary w-full">Assign scope</button></Modal>}
    {modal === "reset" && selectedUser && <Modal title="Send password reset" onClose={() => setModal(null)}><p className="text-[13px] leading-6 text-wk-text-muted">Send a Supabase password reset email to <strong className="text-wk-text">{selectedUser.profile.email || "this user"}</strong>. The action is recorded in recovery events and admin audit.</p><button onClick={handlePasswordReset} disabled={busy || !selectedUser.profile.email} className="wk-button wk-button-primary w-full">{busy ? "Sending…" : "Send password reset"}</button></Modal>}
  </div>;
}

function Kpi({ label, value, icon }: { label: string; value: number; icon: any }) { return <WkSurface className="p-4"><div className="flex items-start justify-between"><div><div className="text-[24px] font-black text-wk-text">{value.toLocaleString()}</div><div className="text-[11px] font-bold uppercase tracking-wider text-wk-text-faint">{label}</div></div><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-wk-brand-soft text-wk-brand"><WkIcon name={icon} size={18} /></div></div></WkSurface>; }
function RecentPanel({ title, rows }: { title: string; rows: Array<{ id: string; top: string; meta: string; detail: string }> }) { return <WkSurface className="overflow-hidden"><div className="border-b border-wk-border p-4 text-[13px] font-bold text-wk-text">{title}</div><div className="divide-y divide-wk-border">{rows.length ? rows.map((row) => <div key={row.id} className="p-3"><div className="flex justify-between gap-3"><div className="truncate text-[12px] font-bold text-wk-text">{row.top}</div><span className="shrink-0 text-[10px] uppercase text-wk-text-faint">{row.meta}</span></div><div className="mt-1 line-clamp-2 text-[11px] text-wk-text-muted">{row.detail}</div></div>) : <div className="p-5 text-center text-[12px] text-wk-text-muted">No rows yet.</div>}</div></WkSurface>; }
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) { return <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-lg rounded-2xl border border-wk-border bg-wk-surface p-5 shadow-xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-[16px] font-black text-wk-text">{title}</h2><button onClick={onClose} className="rounded-full p-1 text-wk-text-muted hover:bg-wk-surface-raised"><WkIcon name="X" size={18} /></button></div><div className="space-y-4">{children}</div></div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1 block text-[11px] font-black uppercase tracking-wider text-wk-text-faint">{label}</span>{children}</label>; }
function Checks({ canEdit, setCanEdit, canPublish, setCanPublish }: { canEdit: boolean; setCanEdit: (v: boolean) => void; canPublish: boolean; setCanPublish: (v: boolean) => void }) { return <div className="flex flex-wrap gap-3 text-[12px] text-wk-text-muted"><label className="flex items-center gap-2"><input type="checkbox" checked readOnly /> View</label><label className="flex items-center gap-2"><input type="checkbox" checked={canEdit} onChange={(e) => setCanEdit(e.target.checked)} /> Edit</label><label className="flex items-center gap-2"><input type="checkbox" checked={canPublish} onChange={(e) => setCanPublish(e.target.checked)} /> Publish</label></div>; }
