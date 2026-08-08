import { Outlet } from "react-router-dom";
import { AdminGuard } from "@/components/admin/AdminGuard";
import type { Capability } from "@/services/userRoles";

interface Props { capabilities: Capability[]; }

function makeLayout(capabilities: Capability[], label: string) {
  return function AdminSectionLayout() {
    return (
      <AdminGuard capabilities={capabilities} fallback={
        <div className="flex h-64 items-center justify-center">
          <div className="text-[13px] text-wk-text-muted">Checking {label} access…</div>
        </div>
      }>
        <Outlet />
      </AdminGuard>
    );
  };
}

export const AdminContentLayout = makeLayout(["edit_own_articles", "edit_others_articles", "view_playlists", "edit_own_playlists", "edit_others_playlists"], "content");
export const AdminUsersLayout = makeLayout(["manage_users"], "users");
export const AdminRegistryLayout = makeLayout(["view_registry", "manage_registry"], "registry");
export const AdminMediaLayout = makeLayout(["upload_media", "manage_media_library"], "media");
export const AdminReviewLayout = makeLayout(["view_review_queue", "manage_review_queue"], "review");
export const AdminRelationshipsLayout = makeLayout(["view_relationships", "manage_relationships"], "relationships");