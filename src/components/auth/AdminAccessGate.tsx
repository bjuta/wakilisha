import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { useAdminUser } from "@/hooks/useAdminUser";
import { getDefaultRoute, roleCanAccessAdmin, type Capability } from "@/services/userRoles";

export function AdminAccessGate({
  children,
  requiredCapability,
  label = "Admin Studio",
}: {
  children: React.ReactNode;
  requiredCapability?: Capability;
  label?: string;
}) {
  const user = useAdminUser();
  const navigate = useNavigate();
  const location = useLocation();

  const isAuthed = Boolean(user.id);
  const hasAdminAccess = roleCanAccessAdmin(user.role);
  const hasCapability = requiredCapability ? user.can(requiredCapability) : true;

  useEffect(() => {
    if (user.loading) return;
    if (!isAuthed || !hasAdminAccess) {
      navigate(`/admin/login?next=${encodeURIComponent(location.pathname)}`, { replace: true });
    }
  }, [user.loading, isAuthed, hasAdminAccess, navigate, location.pathname]);

  if (user.loading || !isAuthed || !hasAdminAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-wk-bg text-wk-text">
        <div className="rounded-xl border border-wk-border bg-wk-surface p-6 text-center shadow-sm">
          <WkIcon name="ShieldCheck" size={28} className="mx-auto mb-3 text-wk-brand" />
          <div className="text-[14px] font-bold">Checking admin access…</div>
          <div className="mt-1 text-[12px] text-wk-text-muted">Public subscriber sessions cannot enter {label}.</div>
        </div>
      </div>
    );
  }

  if (!hasCapability) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-wk-bg px-4 text-wk-text">
        <div className="max-w-md rounded-xl border border-wk-border bg-wk-surface p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-wk-warning-soft text-wk-warning">
            <WkIcon name="LockKeyhole" size={24} />
          </div>
          <h1 className="text-[18px] font-black">Access not granted</h1>
          <p className="mt-2 text-[13px] leading-5 text-wk-text-muted">
            Your account is signed in as {user.role ? user.role.replaceAll("_", " ") : "an admin user"}, but it does not have the required capability for this area.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button onClick={() => navigate(user.role ? getDefaultRoute(user.role) : "/admin")} className="wk-button wk-button-primary wk-button-sm">Go to my admin area</button>
            <button onClick={() => navigate("/")} className="wk-button wk-button-ghost wk-button-sm">Back to public site</button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
