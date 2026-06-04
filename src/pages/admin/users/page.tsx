import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { useAdminUser } from "@/hooks/useAdminUser";
import {
  fetchAllUserRoles,
  assignUserRole,
  removeUserRole,
  ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  type UserRole,
  type UserRoleRecord,
} from "@/services/userRoles";
import { supabase } from "@/lib/supabase";

interface AuthUser {
  id: string;
  email: string;
}

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const currentUser = useAdminUser();

  const [roleRecords, setRoleRecords] = useState<UserRoleRecord[]>([]);
  const [authUsers, setAuthUsers] = useState<Map<string, AuthUser>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Assign modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignEmail, setAssignEmail] = useState("");
  const [assignRole, setAssignRole] = useState<UserRole>("writer");
  const [assignDisplayName, setAssignDisplayName] = useState("");
  const [assignBio, setAssignBio] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);

  // Edit modal state
  const [editRecord, setEditRecord] = useState<UserRoleRecord | null>(null);
  const [editRole, setEditRole] = useState<UserRole>("writer");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const records = await fetchAllUserRoles();
      setRoleRecords(records);

      // Fetch auth users for email display
      const userIds = records.map((r) => r.user_id).filter(Boolean);
      const userMap = new Map<string, AuthUser>();

      if (userIds.length > 0) {
        // We can't list all auth users from client side, but we can show what we have
        // For display purposes, we'll just use user_id and look up display_name from role record
        for (const id of userIds) {
          userMap.set(id, { id, email: id }); // placeholder - real email comes from auth admin API
        }
      }
      setAuthUsers(userMap);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Check if current user is admin
  if (!currentUser.loading && currentUser.role !== "administrator") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-wk-danger/10 mb-4">
          <WkIcon name="ShieldOff" size={24} className="text-wk-danger" />
        </div>
        <h2 className="text-[18px] font-bold text-wk-text mb-1">Access Denied</h2>
        <p className="text-[13px] text-wk-text-muted max-w-md mb-4">
          Only administrators can manage user roles. You are signed in as{" "}
          <strong>{currentUser.role ? ROLE_LABELS[currentUser.role] : "unassigned"}</strong>.
        </p>
        <button onClick={() => navigate("/admin")} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const handleAssign = async () => {
    if (!assignEmail.trim()) {
      setAssignError("Email is required");
      return;
    }

    setAssigning(true);
    setAssignError(null);
    setAssignSuccess(null);

    try {
      // Look up user by email via Supabase Auth Admin - we need an edge function for this
      // For now, we'll try to get the user ID from the auth session context
      // This requires an admin-level edge function to properly look up by email

      // Since we can't look up users by email from the client, we'll show guidance
      // The proper way is via an edge function with service_role key

      // For now, let's use the email as a direct key (temporary workaround)
      // In production, you'd use an edge function to resolve email -> user ID

      setAssignError(
        "User lookup by email requires an admin edge function. For now, ask the user to sign in first so their ID is registered, then assign their role here.",
      );
    } finally {
      setAssigning(false);
    }
  };

  const handleEdit = (record: UserRoleRecord) => {
    setEditRecord(record);
    setEditRole(record.role);
    setEditDisplayName(record.display_name ?? "");
    setEditBio(record.bio ?? "");
  };

  const handleSaveEdit = async () => {
    if (!editRecord) return;
    setSaving(true);
    try {
      await assignUserRole(editRecord.user_id, editRole, editDisplayName || undefined, editBio || undefined);
      setEditRecord(null);
      await loadData();
    } catch (err: any) {
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    setDeleting(true);
    try {
      const record = roleRecords.find((r) => r.id === deleteId);
      if (record) {
        await removeUserRole(record.user_id);
      }
      setDeleteId(null);
      await loadData();
    } catch (err: any) {
      console.error("Failed to delete:", err);
    } finally {
      setDeleting(false);
    }
  };

  const roleBadgeColors: Record<string, string> = {
    administrator: "bg-wk-danger/10 text-wk-danger border-wk-danger/20",
    editor: "bg-wk-brand/10 text-wk-brand border-wk-brand/20",
    author: "bg-wk-success/10 text-wk-success border-wk-success/20",
    writer: "bg-wk-warning/10 text-wk-warning border-wk-warning/20",
  };

  const getEmailFromId = (userId: string) => {
    return authUsers.get(userId)?.email ?? userId.substring(0, 12) + "...";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">
            Administration
          </div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">User Roles</h1>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            Manage who has access to the production engine. WordPress-style roles — each role unlocks specific areas.
          </p>
        </div>
        <button
          onClick={() => setShowAssignModal(true)}
          className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
        >
          <WkIcon name="UserPlus" size={14} />
          Assign Role
        </button>
      </div>

      {/* Role Legend */}
      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-wk-text mb-3">Role Permissions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((role) => (
            <div key={role} className="rounded-lg border border-wk-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${roleBadgeColors[role]}`}>
                  {ROLE_LABELS[role]}
                </span>
              </div>
              <p className="text-[12px] text-wk-text-muted leading-relaxed">{ROLE_DESCRIPTIONS[role]}</p>
            </div>
          ))}
        </div>
      </WkSurface>

      {/* Users Table */}
      <WkSurface className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-wk-brand border-t-transparent" />
            <p className="mt-3 text-[13px] text-wk-text-muted">Loading users...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl bg-wk-danger/10 mb-3">
              <WkIcon name="AlertCircle" size={18} className="text-wk-danger" />
            </div>
            <p className="text-[13px] font-semibold text-wk-text mb-1">Failed to load</p>
            <p className="text-[12px] text-wk-text-muted mb-3">{error}</p>
            <button onClick={loadData} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
              Retry
            </button>
          </div>
        ) : roleRecords.length === 0 ? (
          <div className="p-12 text-center">
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-wk-surface-raised mb-4">
              <WkIcon name="Users" size={22} className="text-wk-text-faint" />
            </div>
            <p className="text-[14px] font-semibold text-wk-text mb-1">No users assigned yet</p>
            <p className="text-[12px] text-wk-text-muted max-w-sm mx-auto mb-4">
              When team members sign in to the site, assign them a role here to grant access to the admin area.
            </p>
            <button
              onClick={() => setShowAssignModal(true)}
              className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
            >
              <WkIcon name="UserPlus" size={14} />
              Assign First User
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-wk-border bg-wk-bg-subtle">
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">User</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">Role</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-wk-text-muted hidden md:table-cell">Display Name</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-wk-text-muted hidden lg:table-cell">Assigned</th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roleRecords.map((record) => {
                  const isCurrentUser = record.user_id === currentUser.id;
                  return (
                    <tr
                      key={record.id}
                      className="border-b border-wk-border last:border-0 hover:bg-wk-surface-raised transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wk-brand-soft text-wk-brand">
                            <WkIcon name="User" size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-wk-text truncate max-w-[160px]">
                              {record.display_name || getEmailFromId(record.user_id)}
                            </p>
                            <p className="text-[11px] text-wk-text-muted truncate max-w-[160px]">
                              {getEmailFromId(record.user_id)}
                            </p>
                          </div>
                          {isCurrentUser && (
                            <span className="shrink-0 rounded-full bg-wk-brand/10 px-1.5 py-0.5 text-[9px] font-bold text-wk-brand">
                              YOU
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${roleBadgeColors[record.role] ?? ""}`}>
                          {ROLE_LABELS[record.role] ?? record.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-[13px] text-wk-text-muted">{record.display_name || "—"}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-[12px] text-wk-text-muted">
                          {new Date(record.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEdit(record)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text transition-colors"
                            title="Edit role"
                          >
                            <WkIcon name="Pencil" size={14} />
                          </button>
                          {!isCurrentUser && (
                            <button
                              onClick={() => setDeleteId(record.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-wk-text-faint hover:bg-wk-danger/10 hover:text-wk-danger transition-colors"
                              title="Remove role"
                            >
                              <WkIcon name="Trash2" size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </WkSurface>

      {/* Assign Role Modal */}
      {showAssignModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowAssignModal(false)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-wk-border bg-wk-surface shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-bold text-wk-text">Assign Role</h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-wk-text-muted hover:bg-wk-surface-raised"
              >
                <WkIcon name="X" size={16} />
              </button>
            </div>

            <p className="text-[12px] text-wk-text-muted mb-4">
              To assign a role, the user must first sign in to the site. Once they appear in the auth system, you can look up their user ID and assign a role here.
            </p>

            <div className="bg-wk-info/5 border border-wk-info/20 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <WkIcon name="Info" size={16} className="text-wk-info shrink-0 mt-0.5" />
                <div>
                  <p className="text-[12px] font-semibold text-wk-text mb-1">How to assign roles</p>
                  <p className="text-[11px] text-wk-text-muted leading-relaxed">
                    Have the user sign in at <strong>/auth</strong>. After they sign in, their user ID will be registered. Come back here to assign their role. For bulk management, use the Supabase dashboard.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAssignModal(false)}
                className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}

      {/* Edit Role Modal */}
      {editRecord && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setEditRecord(null)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-wk-border bg-wk-surface shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-bold text-wk-text">Edit Role</h3>
              <button
                onClick={() => setEditRecord(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-wk-text-muted hover:bg-wk-surface-raised"
              >
                <WkIcon name="X" size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-wk-text mb-1.5">User</label>
                <p className="text-[13px] text-wk-text-muted bg-wk-bg-subtle rounded-lg px-3 py-2 border border-wk-border">
                  {editRecord.display_name || getEmailFromId(editRecord.user_id)}
                </p>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-wk-text mb-1.5">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none focus:border-wk-brand"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-wk-text-muted">{ROLE_DESCRIPTIONS[editRole]}</p>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-wk-text mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none focus:border-wk-brand placeholder:text-wk-text-faint"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-wk-text mb-1.5">Bio</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Short bio for this user..."
                  rows={2}
                  className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none focus:border-wk-brand placeholder:text-wk-text-faint resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setEditRecord(null)}
                className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
              >
                {saving ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation */}
      {deleteId !== null && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setDeleteId(null)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-wk-border bg-wk-surface shadow-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wk-danger/10">
                <WkIcon name="AlertTriangle" size={20} className="text-wk-danger" />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-wk-text">Remove Role?</h3>
                <p className="text-[12px] text-wk-text-muted">
                  This user will lose all admin access. They can still browse the public site.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="wk-button wk-button-danger wk-button-sm whitespace-nowrap"
              >
                {deleting ? "Removing..." : "Remove Role"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}