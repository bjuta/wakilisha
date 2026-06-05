import { Navigate, useLocation } from "react-router-dom";
import { useAdminUser } from "@/hooks/useAdminUser";
import type { Capability } from "@/services/userRoles";
import { getDefaultRoute } from "@/services/userRoles";
import { SkeletonAdminGuard } from "@/components/skeletons/Skeletons";

interface AdminGuardProps {
  children: React.ReactNode;
  /** Require at least one of these capabilities */
  capabilities?: Capability[];
  /** Fallback role label shown during loading */
  fallback?: React.ReactNode;
}

export function AdminGuard({ children, capabilities, fallback }: AdminGuardProps) {
  const user = useAdminUser();
  const location = useLocation();

  // Still loading — show loading skeleton or nothing
  if (user.loading) {
    return (
      fallback ?? <SkeletonAdminGuard />
    );
  }

  // Not authenticated
  if (!user.id) {
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }

  // No role assigned
  if (!user.role) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-wk-bg px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-wk-warning/10 mb-4">
          <i className="ri-shield-keyhole-line text-2xl text-wk-warning" />
        </div>
        <h2 className="text-[18px] font-bold text-wk-text mb-1">No Access Role</h2>
        <p className="text-[13px] text-wk-text-muted max-w-md mb-4">
          Your account doesn&apos;t have an assigned role yet. Contact an administrator to get access to the production engine.
        </p>
        <a href="/" className="text-[13px] font-semibold text-wk-brand hover:underline">
          Back to site
        </a>
      </div>
    );
  }

  // Check capabilities
  if (capabilities && capabilities.length > 0) {
    const hasCap = capabilities.some((c) => user.can(c));
    if (!hasCap) {
      // Redirect to their default area
      const defaultRoute = getDefaultRoute(user.role);
      return <Navigate to={defaultRoute} replace />;
    }
  }

  return <>{children}</>;
}