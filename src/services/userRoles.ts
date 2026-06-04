import { supabase } from "@/lib/supabase";

/* ────────────────────────── Role Types ────────────────────────── */

export type UserRole = "administrator" | "editor" | "author" | "writer";

export const ROLES: UserRole[] = ["administrator", "editor", "author", "writer"];

export const ROLE_LABELS: Record<UserRole, string> = {
  administrator: "Administrator",
  editor: "Editor",
  author: "Author",
  writer: "Writer",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  administrator: "Full access to all admin areas, settings, and user management.",
  editor: "Manage all content — articles, guides, pages, media, and publishing. Cannot access charts, registry, or system settings.",
  author: "Write and publish your own articles. Access media library. Cannot manage other authors' content.",
  writer: "Write articles and submit for review. Access media library. Cannot publish directly.",
};

export interface UserRoleRecord {
  id: number;
  user_id: string;
  role: UserRole;
  display_name: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

/* ────────────────────────── Capability Matrix ────────────────────────── */

export type Capability =
  // Dashboard
  | "view_dashboard"
  // Content
  | "edit_own_articles"
  | "edit_others_articles"
  | "publish_articles"
  | "delete_articles"
  | "edit_guides"
  | "edit_pages"
  | "view_publishing_dashboard"
  | "view_archive"
  | "manage_categories"
  | "manage_tags"
  // Media
  | "upload_media"
  | "manage_media_library"
  | "view_missing_images"
  | "view_broken_links"
  // Charts (read-only vs full)
  | "view_charts_admin"
  | "manage_charts"
  | "manage_ingest"
  // Registry
  | "view_registry"
  | "manage_registry"
  // Relationships
  | "view_relationships"
  | "manage_relationships"
  // Review
  | "view_review_queue"
  | "manage_review_queue"
  // Imports
  | "view_imports"
  | "manage_imports"
  // Settings
  | "view_settings"
  | "manage_settings"
  | "manage_integrations"
  | "manage_appearance"
  // Users
  | "manage_users"
  // Migration
  | "view_media_migration";

const CAPABILITY_MATRIX: Record<UserRole, Capability[]> = {
  administrator: [
    "view_dashboard",
    "edit_own_articles",
    "edit_others_articles",
    "publish_articles",
    "delete_articles",
    "edit_guides",
    "edit_pages",
    "view_publishing_dashboard",
    "view_archive",
    "manage_categories",
    "manage_tags",
    "upload_media",
    "manage_media_library",
    "view_missing_images",
    "view_broken_links",
    "view_charts_admin",
    "manage_charts",
    "manage_ingest",
    "view_registry",
    "manage_registry",
    "view_relationships",
    "manage_relationships",
    "view_review_queue",
    "manage_review_queue",
    "view_imports",
    "manage_imports",
    "view_settings",
    "manage_settings",
    "manage_integrations",
    "manage_appearance",
    "manage_users",
    "view_media_migration",
  ],
  editor: [
    "view_dashboard",
    "edit_own_articles",
    "edit_others_articles",
    "publish_articles",
    "delete_articles",
    "edit_guides",
    "edit_pages",
    "view_publishing_dashboard",
    "view_archive",
    "manage_categories",
    "manage_tags",
    "upload_media",
    "manage_media_library",
    "view_missing_images",
    "view_broken_links",
    "view_review_queue",
    "manage_review_queue",
    "view_media_migration",
  ],
  author: [
    "view_dashboard",
    "edit_own_articles",
    "publish_articles",
    "upload_media",
    "manage_media_library",
  ],
  writer: [
    "edit_own_articles",
    "upload_media",
    "manage_media_library",
  ],
};

/* ────────────────────────── Utility Functions ────────────────────────── */

export function getUserCapabilities(role: UserRole): Capability[] {
  return CAPABILITY_MATRIX[role] ?? [];
}

export function userCan(role: UserRole, capability: Capability): boolean {
  return CAPABILITY_MATRIX[role]?.includes(capability) ?? false;
}

export function userCanAny(role: UserRole, capabilities: Capability[]): boolean {
  return capabilities.some((c) => userCan(role, c));
}

export function userCanAll(role: UserRole, capabilities: Capability[]): boolean {
  return capabilities.every((c) => userCan(role, c));
}

/* ────────────────────────── Data Fetching ────────────────────────── */

export async function fetchUserRole(userId: string): Promise<UserRoleRecord | null> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch user role:", error);
    return null;
  }

  return data as UserRoleRecord | null;
}

export async function fetchAllUserRoles(): Promise<UserRoleRecord[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch user roles:", error);
    return [];
  }

  return (data as UserRoleRecord[]) ?? [];
}

export async function assignUserRole(
  userId: string,
  role: UserRole,
  displayName?: string,
  bio?: string,
): Promise<UserRoleRecord | null> {
  const { data, error } = await supabase
    .from("user_roles")
    .upsert(
      {
        user_id: userId,
        role,
        display_name: displayName ?? null,
        bio: bio ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select()
    .single();

  if (error) {
    console.error("Failed to assign user role:", error);
    return null;
  }

  return data as UserRoleRecord;
}

export async function removeUserRole(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to remove user role:", error);
    return false;
  }

  return true;
}

/* ────────────────────────── Admin Nav Visibility ────────────────────────── */

export interface NavVisibility {
  showDashboard: boolean;
  showContent: boolean;
  showArticles: boolean;
  showGuides: boolean;
  showPages: boolean;
  showPublishing: boolean;
  showArchive: boolean;
  showCharts: boolean;
  showRegistry: boolean;
  showCommerce: boolean;
  showMedia: boolean;
  showRelationships: boolean;
  showReview: boolean;
  showImports: boolean;
  showSettings: boolean;
  showMediaMigration: boolean;
  showUsers: boolean;
}

export function getNavVisibility(role: UserRole): NavVisibility {
  const can = (c: Capability) => userCan(role, c);
  return {
    showDashboard: can("view_dashboard"),
    showContent: can("edit_own_articles"),
    showArticles: can("edit_own_articles"),
    showGuides: can("edit_guides"),
    showPages: can("edit_pages"),
    showPublishing: can("view_publishing_dashboard"),
    showArchive: can("view_archive"),
    showCharts: can("view_charts_admin"),
    showRegistry: can("view_registry"),
    showCommerce: false,
    showMedia: can("manage_media_library"),
    showRelationships: can("view_relationships"),
    showReview: can("view_review_queue"),
    showImports: can("view_imports"),
    showSettings: can("view_settings"),
    showMediaMigration: can("view_media_migration"),
    showUsers: can("manage_users"),
  };
}

/* ────────────────────────── Default Redirect ────────────────────────── */

export function getDefaultRoute(role: UserRole): string {
  switch (role) {
    case "administrator":
      return "/admin";
    case "editor":
      return "/admin/content/articles";
    case "author":
      return "/admin/content/articles";
    case "writer":
      return "/admin/content/articles";
    default:
      return "/admin";
  }
}