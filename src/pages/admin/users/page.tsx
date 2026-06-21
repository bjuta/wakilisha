import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { SkeletonAdminTable } from "@/components/skeletons/Skeletons";
import { useAdminUser } from "@/hooks/useAdminUser";
import { supabase } from "@/lib/supabase";
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLES,
  type AccessScope,
  type UserRole,
} from "@/services/userRoles";

type ProfileRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};
type AssignmentRow = {
  id: string;
  user_id: string;
  role_key: UserRole;
  status: string;
  created_at: string;
  updated_at: string;
};
type AuditRow = {
  id: string;
  actor_user_id: string | null;
  target_user_id: string | null;
  event_type: string;
  target_table: string | null;
  target_record_id: string | null;
  message: string | null;
  created_at: string;
};
type RecoveryRow = {
  id: string;
  target_email: string;
  target_user_id: string | null;
  delivery_status: string;
  redirect_to: string | null;
  created_at: string;
};
type InviteRow = {
  id: string;
  email: string;
  role_key: UserRole;
  display_name: string | null;
  invite_status: string;
  invited_user_id: string | null;
  created_at: string;
};
type UserAccess = {
  profile: ProfileRow;
  roles: AssignmentRow[];
  scopes: AccessScope[];
};

type Modal = "invite" | "scope" | "reset" | null;

const ADMIN_ROLES = ROLES.filter(
  (role) => !["subscriber", "customer", "member", "premium_member"].includes(role),
);

const SCOPE_TYPES = [
  "global",
  "market",
  "country",
  "region",
  "series",
  "vertical",
  "entity_type",
];

// Controlled scope values by type
const SCOPE_VALUE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  global: [{ value: "*", label: "All (*)" }],
  market: [
    { value: "kenya", label: "Kenya" },
    { value: "nigeria", label: "Nigeria" },
    { value: "south-africa", label: "South Africa" },
    { value: "ghana", label: "Ghana" },
    { value: "tanzania", label: "Tanzania" },
    { value: "east-africa", label: "East Africa" },
    { value: "west-africa", label: "West Africa" },
  ],
  country: [
    { value: "KE", label: "KE – Kenya" },
    { value: "NG", label: "NG – Nigeria" },
    { value: "ZA", label: "ZA – South Africa" },
    { value: "GH", label: "GH – Ghana" },
    { value: "TZ", label: "TZ – Tanzania" },
    { value: "UG", label: "UG – Uganda" },
    { value: "US", label: "US – United States" },
    { value: "GB", label: "GB – United Kingdom" },
  ],
  entity_type: [
    { value: "artist", label: "Artist" },
    { value: "track", label: "Track" },
    { value: "release", label: "Release" },
    { value: "label", label: "Label" },
    { value: "genre", label: "Genre" },
    { value: "article", label: "Article" },
    { value: "guide", label: "Guide" },
  ],
};

function shortId(value: string) {
  return value ? `${value.slice(0, 8)}…` : "—";
}
function date(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}
function roleTone(role: string) {
  if (role === "administrator") return "border-wk-danger/20 bg-wk-danger/10 text-wk-danger";
  if (role.includes("chart")) return "border-wk-brand/20 bg-wk-brand/10 text-wk-brand";
  if (role.includes("registry") || role.includes("media"))
    return "border-wk-success/20 bg-wk-success/10 text-wk-success";
  if (role.includes("review") || role.includes("moderator"))
    return "border-wk-warning/20 bg-wk-warning/10 text-wk-warning";
  return "border-wk-border bg-wk-surface-raised text-wk-text-muted";
}

async function callAdminUserOps(payload: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Admin session is missing. Sign in again.");
  const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
  const res = await fetch(`${supabaseUrl}/functions/v1/admin-router/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok && data?.error) throw new Error(String(data.error));
  if (data?.error) throw new Error(String(data.error));
  return data;
}

// ── Validation helper ──
function validateInviteForm(
  email: string,
  role: string,
  scopeType: string,
  scopeValue: string,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    errors.email = "A valid email address is required";
  }
  if (!role) {
    errors.role = "A role must be selected";
  }
  if (!scopeType) {
    errors.scopeType = "A scope type is required";
  }
  if (!scopeValue) {
    errors.scopeValue = "A scope value is required";
  }
  if (scopeType === "global" && scopeValue !== "*") {
    errors.scopeValue = "Global scope must use *";
  }
  return errors;
}

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const currentUser = useAdminUser();
  const [users, setUsers] = useState<UserAccess[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [recoveries, setRecoveries] = useState<RecoveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
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
  const [inviteValidationErrors, setInviteValidationErrors] = useState<Record<string, string>>({});

  const [scopeRole, setScopeRole] = useState<UserRole>("chart_editor_regional");
  const [scopeType, setScopeType] = useState("market");
  const [scopeValue, setScopeValue] = useState("");
  const [scopeCanEdit, setScopeCanEdit] = useState(true);
  const [scopeCanPublish, setScopeCanPublish] = useState(false);

  const canManageUsers = currentUser.can("manage_users");

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Ensure we have a valid session before loading
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        setLoadError("Your session has expired. Please sign in again.");
        setLoading(false);
        return;
      }

      const [profilesRes, rolesRes, scopesRes, invitesRes, auditsRes, recoveryRes] = await Promise.all([
        supabase
          .from("user_profiles")
          .select("user_id,email,display_name,status,created_at,updated_at")
          .order("updated_at", { ascending: false })
          .limit(500),
        supabase
          .from("user_role_assignments")
          .select("id,user_id,role_key,status,created_at,updated_at")
          .neq("status", "revoked")
          .order("updated_at", { ascending: false })
          .limit(1000),
        supabase
          .from("user_access_scopes")
          .select("id,user_id,role_key,scope_type,scope_value,can_view,can_edit,can_publish,status")
          .neq("status", "revoked")
          .order("updated_at", { ascending: false })
          .limit(1000),
        supabase
          .from("admin_user_invites")
          .select("id,email,role_key,display_name,invite_status,invited_user_id,created_at")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("admin_audit_events")
          .select(
            "id,actor_user_id,target_user_id,event_type,target_table,target_record_id,message,created_at",
          )
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("admin_account_recovery_events")
          .select("id,target_email,target_user_id,delivery_status,redirect_to,created_at")
          .order("created_at", { ascending: false })
          .limit(25),
      ]);

      // Core tables must succeed — profiles and roles are required
      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const profiles = (profilesRes.data ?? []) as ProfileRow[];
      const roles = (rolesRes.data ?? []) as AssignmentRow[];
      // Non-critical tables: silently fall back to empty on RLS/permission errors
      const scopes = (scopesRes.error ? [] : (scopesRes.data ?? [])) as AccessScope[];

      const userIds = new Set(
        [
          ...profiles.map((p) => p.user_id),
          ...roles.map((r) => r.user_id),
          ...scopes.map((s) => String((s as Record<string, unknown>).user_id ?? "")),
        ].filter(Boolean),
      );

      const profileById = new Map(profiles.map((p) => [p.user_id, p]));

      setUsers(
        Array.from(userIds)
          .map((userId) => ({
            profile: profileById.get(userId) ?? {
              user_id: userId,
              email: null,
              display_name: null,
              status: "active",
              created_at: null,
              updated_at: null,
            },
            roles: roles.filter((r) => r.user_id === userId),
            scopes: scopes.filter(
              (s) => String((s as Record<string, unknown>).user_id) === userId,
            ),
          }))
          .sort((a, b) =>
            String(b.profile.updated_at ?? "").localeCompare(
              String(a.profile.updated_at ?? ""),
            ),
          ),
      );

      setInvites((invitesRes.error ? [] : (invitesRes.data ?? [])) as InviteRow[]);
      setAudits((auditsRes.error ? [] : (auditsRes.data ?? [])) as AuditRow[]);
      setRecoveries((recoveryRes.error ? [] : (recoveryRes.data ?? [])) as RecoveryRow[]);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Failed to load access console data.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totals = useMemo(
    () => ({
      users: users.length,
      admins: users.filter((u) =>
        u.roles.some((r) => r.role_key === "administrator" && r.status === "active"),
      ).length,
      scoped: users.filter((u) => u.scopes.length > 0).length,
      invites: invites.filter((i) => ["pending", "sent"].includes(i.invite_status)).length,
    }),
    [users, invites],
  );

  if (!currentUser.loading && !canManageUsers) {
    return (
      <div className="py-20 text-center">
        <WkIcon name="ShieldOff" size={34} className="mx-auto mb-4 text-wk-danger" />
        <h2 className="text-[18px] font-bold text-wk-text">Access denied</h2>
        <p className="mt-1 text-[13px] text-wk-text-muted">
          Only users with manage_users can operate roles, scopes, invites, and password recovery.
        </p>
        <button
          onClick={() => navigate("/admin")}
          className="wk-button wk-button-ghost wk-button-sm mt-4"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  async function handleInvite() {
    const errors = validateInviteForm(inviteEmail, inviteRole, inviteScopeType, inviteScopeValue);
    if (Object.keys(errors).length > 0) {
      setInviteValidationErrors(errors);
      return;
    }
    setInviteValidationErrors({});
    setBusy(true);
    setActionError(null);
    setMessage(null);
    try {
      const scopes =
        inviteScopeType && inviteScopeValue
          ? [
              {
                scope_type: inviteScopeType,
                scope_value: inviteScopeValue,
                can_view: true,
                can_edit: inviteCanEdit,
                can_publish: inviteCanPublish,
              },
            ]
          : [];
      await callAdminUserOps({
        action: "invite_user",
        email: inviteEmail,
        role_key: inviteRole,
        display_name: inviteName || undefined,
        redirect_to: `${window.location.origin}/admin/login`,
        scopes,
      });
      setMessage(`Invite sent for ${inviteEmail}.`);
      setModal(null);
      setInviteEmail("");
      setInviteName("");
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Invite failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddScope() {
    if (!selectedUser) return;
    setBusy(true);
    setActionError(null);
    setMessage(null);
    try {
      const { error } = await supabase.rpc("upsert_user_scope_admin", {
        target_user_id: selectedUser.profile.user_id,
        target_role_key: scopeRole,
        target_scope_type: scopeType,
        target_scope_value: scopeValue,
        target_can_view: true,
        target_can_edit: scopeCanEdit,
        target_can_publish: scopeCanPublish,
      });
      if (error) throw error;
      setMessage("Scope assigned.");
      setModal(null);
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Scope assignment failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevokeRole(userId: string, role: UserRole) {
    if (!confirm(`Revoke ${ROLE_LABELS[role] ?? role}?`)) return;
    setBusy(true);
    setActionError(null);
    try {
      const { error } = await supabase.rpc("revoke_user_role_admin", {
        target_user_id: userId,
        target_role_key: role,
      });
      if (error) throw error;
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Role revocation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSuspend(user: UserAccess) {
    if (!confirm(`Suspend access for ${user.profile.email || user.profile.user_id}?`)) return;
    setBusy(true);
    setActionError(null);
    try {
      const { error } = await supabase.rpc("suspend_user_access_admin", {
        target_user_id: user.profile.user_id,
        reason: "Suspended from Admin Users console.",
      });
      if (error) throw error;
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Suspend failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePasswordReset() {
    if (!selectedUser) return;
    const email = selectedUser.profile.email;
    if (!email) {
      setActionError(
        "This user has no email in user_profiles. Use Supabase Auth dashboard or invite by email first.",
      );
      return;
    }
    setBusy(true);
    setActionError(null);
    setMessage(null);
    try {
      await callAdminUserOps({
        action: "send_password_reset",
        user_id: selectedUser.profile.user_id,
        email,
        redirect_to: `${window.location.origin}/auth`,
      });
      setMessage(`Password reset email sent to ${email}.`);
      setModal(null);
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Password reset failed.");
    } finally {
      setBusy(false);
    }
  }

  // ── Loading blocked state ──
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-6 w-48 rounded-lg bg-wk-surface-raised animate-pulse" />
            <div className="h-4 w-96 rounded-lg bg-wk-surface-raised animate-pulse" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-wk-surface-raised animate-pulse" />
          ))}
        </div>
        <SkeletonAdminTable rows={8} cols={5} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-wk-danger-soft text-wk-danger">
          <WkIcon name="AlertTriangle" size={28} />
        </div>
        <h2 className="text-[18px] font-bold text-wk-text">Could not load Access Console</h2>
        <p className="text-[13px] text-wk-text-muted text-center max-w-md">
          {loadError}
        </p>
        <div className="flex gap-3">
          <button onClick={loadData} className="wk-button wk-button-primary wk-button-sm">
            <WkIcon name="RefreshCw" size={14} />
            Retry
          </button>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="wk-button wk-button-ghost wk-button-sm"
          >
            <WkIcon name="ExternalLink" size={14} />
            Check Supabase
          </a>
        </div>
        <p className="text-[11px] text-wk-text-faint mt-2">
          Tables required: user_profiles, user_role_assignments, user_access_scopes, admin_user_invites, admin_audit_events, admin_account_recovery_events
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">
            Administration
          </div>
          <h1 className="text-[24px] font-black tracking-tight text-wk-text">Access Console</h1>
          <p className="mt-1 max-w-3xl text-[13px] leading-6 text-wk-text-muted">
            Invite users, assign roles, grant market/series scopes, suspend access, trigger
            password recovery, and inspect audit trails.
          </p>
        </div>
        <button
          onClick={() => setModal("invite")}
          className="wk-button wk-button-primary wk-button-sm"
        >
          <WkIcon name="UserPlus" size={14} /> Invite / assign user
        </button>
      </div>

      {/* Feedback messages */}
      {actionError && (
        <div className="rounded-xl border border-wk-danger/30 bg-wk-danger-soft p-3 text-[13px] text-wk-danger flex items-start gap-2">
          <WkIcon name="AlertTriangle" size={16} className="shrink-0 mt-0.5" />
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="ml-auto shrink-0 opacity-70 hover:opacity-100">
            <WkIcon name="X" size={14} />
          </button>
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-wk-success/30 bg-wk-success-soft p-3 text-[13px] text-wk-success flex items-center gap-2">
          <WkIcon name="CheckCircle2" size={16} className="shrink-0" />
          {message}
          <button onClick={() => setMessage(null)} className="ml-auto shrink-0 opacity-70 hover:opacity-100">
            <WkIcon name="X" size={14} />
          </button>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label="Users" value={totals.users} icon="Users" />
        <Kpi label="Administrators" value={totals.admins} icon="ShieldCheck" />
        <Kpi label="Scoped users" value={totals.scoped} icon="Map" />
        <Kpi label="Open invites" value={totals.invites} icon="Mail" />
      </div>

      {/* User table */}
      <WkSurface className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="border-b border-wk-border bg-wk-surface-raised text-[10px] uppercase tracking-wider text-wk-text-faint">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Roles</th>
                <th className="px-4 py-3">Scopes</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wk-border">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[13px] text-wk-text-muted">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.profile.user_id} className="hover:bg-wk-surface-raised">
                    <td className="px-4 py-3">
                      <div className="font-bold text-wk-text">
                        {user.profile.display_name || user.profile.email || shortId(user.profile.user_id)}
                      </div>
                      <div className="text-wk-text-muted">
                        {user.profile.email || user.profile.user_id}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {user.roles.length ? (
                          user.roles.map((role) => (
                            <span
                              key={role.id}
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${roleTone(role.role_key)}`}
                            >
                              {ROLE_LABELS[role.role_key] ?? role.role_key}
                              <button
                                onClick={() => handleRevokeRole(user.profile.user_id, role.role_key)}
                                className="ml-1 opacity-70 hover:opacity-100 cursor-pointer"
                              >
                                ×
                              </button>
                            </span>
                          ))
                        ) : (
                          <span className="text-wk-text-faint">No role</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        {user.scopes.slice(0, 3).map((scope) => (
                          <div key={scope.id} className="text-[11px] text-wk-text-muted">
                            {scope.scope_type}:{scope.scope_value}{" "}
                            {scope.can_publish ? "· publish" : scope.can_edit ? "· edit" : "· view"}
                          </div>
                        ))}
                        {user.scopes.length > 3 && (
                          <div className="text-[11px] text-wk-text-faint">
                            +{user.scopes.length - 3} more
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                          user.profile.status === "suspended"
                            ? "bg-wk-danger-soft text-wk-danger"
                            : "bg-wk-success-soft text-wk-success"
                        }`}
                      >
                        {user.profile.status || "active"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setScopeRole(user.roles[0]?.role_key ?? "chart_editor_regional");
                            setModal("scope");
                          }}
                          className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
                        >
                          Scope
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setModal("reset");
                          }}
                          className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
                        >
                          Reset
                        </button>
                        <button
                          onClick={() => handleSuspend(user)}
                          className="wk-button wk-button-ghost wk-button-sm text-wk-danger whitespace-nowrap"
                          disabled={busy}
                        >
                          Suspend
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </WkSurface>

      {/* Activity panels */}
      <div className="grid gap-6 xl:grid-cols-3">
        <RecentPanel
          title="Recent invites"
          rows={invites.map((i) => ({
            id: i.id,
            top: i.email,
            meta: `${i.role_key} · ${i.invite_status}`,
            detail: date(i.created_at),
          }))}
        />
        <RecentPanel
          title="Password recovery"
          rows={recoveries.map((r) => ({
            id: r.id,
            top: r.target_email,
            meta: r.delivery_status,
            detail: date(r.created_at),
          }))}
        />
        <RecentPanel
          title="Audit trail"
          rows={audits.map((a) => ({
            id: a.id,
            top: a.event_type,
            meta: a.target_table || "audit",
            detail: a.message || date(a.created_at),
          }))}
        />
      </div>

      {/* Role catalogue */}
      <WkSurface className="p-5">
        <h2 className="mb-3 text-[14px] font-bold text-wk-text">Role catalogue</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((role) => (
            <div key={role} className="rounded-lg border border-wk-border p-3">
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${roleTone(role)}`}
              >
                {ROLE_LABELS[role]}
              </span>
              <p className="mt-2 text-[11px] leading-5 text-wk-text-muted">
                {ROLE_DESCRIPTIONS[role]}
              </p>
            </div>
          ))}
        </div>
      </WkSurface>

      {/* ── Invite Modal ── */}
      {modal === "invite" && (
        <ModalShell title="Invite / assign user" onClose={() => { setModal(null); setInviteValidationErrors({}); }}>
          <Field label="Email *" error={inviteValidationErrors.email}>
            <input
              type="email"
              className={`wk-input w-full ${inviteValidationErrors.email ? "border-wk-danger" : ""}`}
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="person@wakilisha.africa"
            />
          </Field>
          <Field label="Display name">
            <input
              className="wk-input w-full"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
            />
          </Field>
          <Field label="Role *" error={inviteValidationErrors.role}>
            <select
              className={`wk-input w-full ${inviteValidationErrors.role ? "border-wk-danger" : ""}`}
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserRole)}
            >
              {ADMIN_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Scope type *" error={inviteValidationErrors.scopeType}>
              <select
                className={`wk-input w-full ${inviteValidationErrors.scopeType ? "border-wk-danger" : ""}`}
                value={inviteScopeType}
                onChange={(e) => {
                  setInviteScopeType(e.target.value);
                  // Auto-set default scope value
                  if (e.target.value === "global") setInviteScopeValue("*");
                  else setInviteScopeValue("");
                }}
              >
                {SCOPE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Scope value *" error={inviteValidationErrors.scopeValue}>
              <ScopeValueInput
                scopeType={inviteScopeType}
                value={inviteScopeValue}
                onChange={setInviteScopeValue}
                error={!!inviteValidationErrors.scopeValue}
              />
            </Field>
          </div>
          {inviteScopeType === "global" && (
            <div className="rounded-lg border border-wk-warning/30 bg-wk-warning-soft p-2.5">
              <p className="text-[11px] text-wk-warning font-semibold">
                Global scope (*) means this user can act on all resources within the assigned role. Use only for trusted admins.
              </p>
            </div>
          )}
          <Checks
            canEdit={inviteCanEdit}
            setCanEdit={setInviteCanEdit}
            canPublish={inviteCanPublish}
            setCanPublish={setInviteCanPublish}
          />
          {actionError && (
            <p className="text-[12px] text-wk-danger">{actionError}</p>
          )}
          <button
            onClick={handleInvite}
            disabled={busy}
            className="wk-button wk-button-primary w-full whitespace-nowrap"
          >
            {busy ? (
              <><WkIcon name="Loader2" size={14} className="animate-spin inline mr-1.5" /> Sending…</>
            ) : (
              "Send invite and assign"
            )}
          </button>
        </ModalShell>
      )}

      {/* ── Scope Modal ── */}
      {modal === "scope" && selectedUser && (
        <ModalShell
          title={`Assign scope to ${selectedUser.profile.email || shortId(selectedUser.profile.user_id)}`}
          onClose={() => setModal(null)}
        >
          <Field label="Role">
            <select
              className="wk-input w-full"
              value={scopeRole}
              onChange={(e) => setScopeRole(e.target.value as UserRole)}
            >
              {ADMIN_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Scope type">
              <select
                className="wk-input w-full"
                value={scopeType}
                onChange={(e) => { setScopeType(e.target.value); setScopeValue(""); }}
              >
                {SCOPE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Scope value">
              <ScopeValueInput
                scopeType={scopeType}
                value={scopeValue}
                onChange={setScopeValue}
              />
            </Field>
          </div>
          {scopeType === "global" && (
            <div className="rounded-lg border border-wk-warning/30 bg-wk-warning-soft p-2.5">
              <p className="text-[11px] text-wk-warning font-semibold">
                Global scope (*) is system-wide access. Review carefully before assigning.
              </p>
            </div>
          )}
          <Checks
            canEdit={scopeCanEdit}
            setCanEdit={setScopeCanEdit}
            canPublish={scopeCanPublish}
            setCanPublish={setScopeCanPublish}
          />
          {actionError && <p className="text-[12px] text-wk-danger">{actionError}</p>}
          <button
            onClick={handleAddScope}
            disabled={busy || !scopeValue}
            className="wk-button wk-button-primary w-full whitespace-nowrap"
          >
            {busy ? (
              <><WkIcon name="Loader2" size={14} className="animate-spin inline mr-1.5" /> Assigning…</>
            ) : (
              "Assign scope"
            )}
          </button>
        </ModalShell>
      )}

      {/* ── Password Reset Modal ── */}
      {modal === "reset" && selectedUser && (
        <ModalShell title="Send password reset" onClose={() => setModal(null)}>
          <p className="text-[13px] leading-6 text-wk-text-muted">
            Send a Supabase password reset email to{" "}
            <strong className="text-wk-text">
              {selectedUser.profile.email || "this user"}
            </strong>
            . The action is recorded in recovery events and admin audit.
          </p>
          {actionError && <p className="text-[12px] text-wk-danger">{actionError}</p>}
          <button
            onClick={handlePasswordReset}
            disabled={busy || !selectedUser.profile.email}
            className="wk-button wk-button-primary w-full whitespace-nowrap"
          >
            {busy ? (
              <><WkIcon name="Loader2" size={14} className="animate-spin inline mr-1.5" /> Sending…</>
            ) : (
              "Send password reset"
            )}
          </button>
        </ModalShell>
      )}
    </div>
  );
}

// ── Helper Components ──

function Kpi({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <WkSurface className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[24px] font-black text-wk-text">{value.toLocaleString()}</div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-wk-text-faint">
            {label}
          </div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-wk-brand-soft text-wk-brand">
          <WkIcon name={icon as "Users"} size={18} />
        </div>
      </div>
    </WkSurface>
  );
}

function RecentPanel({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ id: string; top: string; meta: string; detail: string }>;
}) {
  return (
    <WkSurface className="overflow-hidden">
      <div className="border-b border-wk-border p-4 text-[13px] font-bold text-wk-text">
        {title}
      </div>
      <div className="divide-y divide-wk-border">
        {rows.length ? (
          rows.map((row) => (
            <div key={row.id} className="p-3">
              <div className="flex justify-between gap-3">
                <div className="truncate text-[12px] font-bold text-wk-text">{row.top}</div>
                <span className="shrink-0 text-[10px] uppercase text-wk-text-faint">
                  {row.meta}
                </span>
              </div>
              <div className="mt-1 line-clamp-2 text-[11px] text-wk-text-muted">{row.detail}</div>
            </div>
          ))
        ) : (
          <div className="p-5 text-center text-[12px] text-wk-text-muted">No rows yet.</div>
        )}
      </div>
    </WkSurface>
  );
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-wk-border bg-wk-surface p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-black text-wk-text">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-wk-text-muted hover:bg-wk-surface-raised cursor-pointer"
          >
            <WkIcon name="X" size={18} />
          </button>
        </div>
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-black uppercase tracking-wider text-wk-text-faint">
        {label}
      </span>
      {children}
      {error && <p className="mt-1 text-[11px] text-wk-danger font-semibold">{error}</p>}
    </label>
  );
}

function ScopeValueInput({
  scopeType,
  value,
  onChange,
  error,
}: {
  scopeType: string;
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
}) {
  const options = SCOPE_VALUE_OPTIONS[scopeType];

  if (options) {
    return (
      <select
        className={`wk-input w-full ${error ? "border-wk-danger" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select {scopeType}…</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      className={`wk-input w-full ${error ? "border-wk-danger" : ""}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Enter value…"
    />
  );
}

function Checks({
  canEdit,
  setCanEdit,
  canPublish,
  setCanPublish,
}: {
  canEdit: boolean;
  setCanEdit: (v: boolean) => void;
  canPublish: boolean;
  setCanPublish: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3 text-[12px] text-wk-text-muted">
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked readOnly /> View
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={canEdit}
          onChange={(e) => setCanEdit(e.target.checked)}
        />{" "}
        Edit
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={canPublish}
          onChange={(e) => setCanPublish(e.target.checked)}
        />{" "}
        Publish
      </label>
    </div>
  );
}