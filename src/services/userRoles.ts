import { supabase } from "@/lib/supabase";

export type UserRole =
  | "administrator" | "editor" | "chart_editor_global" | "chart_editor_regional" | "registry_editor" | "media_editor" | "reviewer" | "author" | "writer" | "viewer"
  | "subscriber" | "customer" | "member" | "premium_member" | "artist_claimant" | "artist_manager" | "label_partner" | "chart_partner" | "brand_partner" | "research_partner"
  | "support_agent" | "moderator" | "analyst" | "developer";

export const PUBLIC_DEFAULT_ROLE: UserRole = "subscriber";
export const CUSTOMER_ALIAS_ROLE: UserRole = "customer";

export const ROLES: UserRole[] = [
  "administrator", "developer", "editor", "chart_editor_global", "chart_editor_regional", "registry_editor", "media_editor", "reviewer", "moderator", "support_agent", "author", "analyst", "writer", "viewer",
  "subscriber", "member", "premium_member", "artist_claimant", "artist_manager", "label_partner", "chart_partner", "brand_partner", "research_partner",
];

export const ROLE_LABELS: Record<UserRole, string> = {
  administrator: "Administrator",
  editor: "Editor",
  chart_editor_global: "Chart Editor — Global",
  chart_editor_regional: "Chart Editor — Regional",
  registry_editor: "Registry Editor",
  media_editor: "Media Editor",
  reviewer: "Reviewer",
  author: "Author",
  writer: "Writer",
  viewer: "Viewer",
  subscriber: "Subscriber",
  customer: "Customer / Subscriber Alias",
  member: "Member",
  premium_member: "Premium Member",
  artist_claimant: "Artist Claimant",
  artist_manager: "Artist Manager",
  label_partner: "Label Partner",
  chart_partner: "Chart Partner",
  brand_partner: "Brand Partner",
  research_partner: "Research Partner",
  support_agent: "Support Agent",
  moderator: "Moderator",
  analyst: "Analyst",
  developer: "Developer",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  administrator: "Full access to admin, settings, imports, users, charts, registry, review, and publishing.",
  editor: "Editorial lead with content, media, publishing, and review access.",
  chart_editor_global: "Manage chart editions and publishing across all markets and series.",
  chart_editor_regional: "Manage chart editions only within assigned market/country/series scopes.",
  registry_editor: "Manage artists, tracks, releases, labels, genres, relationships, and duplicates.",
  media_editor: "Manage media library, missing images, broken media, and migration review.",
  reviewer: "Resolve review queue items without system-level settings access.",
  author: "Write and publish own articles. Access media library.",
  writer: "Draft content and submit for review. Cannot publish directly.",
  viewer: "Read-only admin visibility for stakeholders and QA.",
  subscriber: "Default public account for lyrics contributions, follows, saved content, preferences, and notifications.",
  customer: "Legacy alias for subscriber. New public users should use subscriber.",
  member: "Community member with profile, saved charts, followed artists, comments, and member experiences.",
  premium_member: "Elevated/paid member with premium content and subscription capabilities.",
  artist_claimant: "Artist or representative requesting to claim/manage an artist profile.",
  artist_manager: "Approved representative who can submit artist-profile updates and media for review.",
  label_partner: "Label partner with scoped label/release submission and reporting access.",
  chart_partner: "External chart/data partner with scoped upload, QA, or reporting access.",
  brand_partner: "Commercial/sponsor partner with scoped campaign and report access.",
  research_partner: "Research partner with approved dataset/report access.",
  support_agent: "Support operator for account/member assistance without full admin access.",
  moderator: "Community/content moderator for comments, submissions, and UGC queues.",
  analyst: "Read-only analytics/reporting user across approved dashboards.",
  developer: "Technical operator with diagnostics, integrations, and QA tooling access.",
};

export type Capability =
  | "view_dashboard" | "edit_own_articles" | "edit_others_articles" | "publish_articles" | "delete_articles" | "edit_guides" | "edit_pages" | "view_publishing_dashboard" | "manage_publishing" | "view_archive" | "manage_categories" | "manage_tags"
  | "upload_media" | "manage_media_library" | "view_missing_images" | "view_broken_links" | "view_charts_admin" | "manage_charts" | "manage_ingest" | "publish_charts" | "view_registry" | "manage_registry"
  | "view_relationships" | "manage_relationships" | "view_review_queue" | "manage_review_queue" | "view_imports" | "manage_imports" | "view_settings" | "manage_settings" | "manage_integrations" | "manage_appearance"
  | "view_playlists" | "edit_own_playlists" | "edit_others_playlists" | "publish_playlists" | "delete_playlists"
  | "view_audio" | "edit_own_audio" | "edit_others_audio" | "publish_audio" | "delete_audio"
  | "view_video" | "edit_own_video" | "edit_others_video" | "publish_video"
  | "view_trust_records" | "manage_sources" | "review_sources" | "withdraw_sources" | "manage_citations" | "manage_credits"
  | "manage_users" | "view_media_migration" | "view_admin_readonly" | "view_public_account" | "manage_own_profile" | "manage_public_profile" | "manage_own_preferences" | "receive_notifications"
  | "save_content" | "follow_entities" | "follow_artists" | "follow_charts" | "contribute_lyrics" | "comment_public" | "moderate_community" | "view_gated_content" | "view_premium_content" | "manage_subscription"
  | "view_customer_orders" | "manage_customer_orders" | "submit_artist_claim" | "manage_claimed_artist_profile" | "submit_artist_media" | "submit_label_updates" | "view_partner_reports" | "submit_chart_data"
  | "view_research_exports" | "export_research_data" | "view_analytics" | "view_support_console" | "manage_support_cases" | "view_developer_tools" | "manage_developer_tools";

export interface AccessScope {
  id?: string;
  role_key?: UserRole | null;
  scope_type: "global" | "market" | "country" | "region" | "series" | "vertical" | "entity_type" | string;
  scope_value: string;
  can_view: boolean;
  can_edit: boolean;
  can_publish: boolean;
  status?: string;
}

export interface UserRoleRecord {
  id: string | number;
  user_id: string;
  role: UserRole;
  display_name: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
  roles?: UserRole[];
  capabilities?: Capability[];
  scopes?: AccessScope[];
  status?: string;
}

const SUBSCRIBER_CAPABILITIES: Capability[] = ["view_public_account", "manage_own_profile", "manage_public_profile", "manage_own_preferences", "receive_notifications", "save_content", "follow_entities", "follow_artists", "follow_charts", "contribute_lyrics", "view_gated_content"];

const CAPABILITY_MATRIX: Record<UserRole, Capability[]> = {
  administrator: ["view_dashboard", "view_audio", "edit_own_audio", "edit_others_audio", "publish_audio", "delete_audio", "view_video", "edit_own_video", "edit_others_video", "publish_video", "view_playlists", "edit_own_playlists", "edit_others_playlists", "publish_playlists", "delete_playlists", "edit_own_articles", "edit_others_articles", "publish_articles", "delete_articles", "edit_guides", "edit_pages", "view_publishing_dashboard", "manage_publishing", "view_archive", "manage_categories", "manage_tags", "upload_media", "manage_media_library", "view_missing_images", "view_broken_links", "view_charts_admin", "manage_charts", "manage_ingest", "publish_charts", "view_registry", "manage_registry", "view_relationships", "manage_relationships", "view_review_queue", "manage_review_queue", "view_imports", "manage_imports", "view_settings", "manage_settings", "manage_integrations", "manage_appearance", "view_trust_records", "manage_sources", "review_sources", "withdraw_sources", "manage_citations", "manage_credits", "manage_users", "view_media_migration", "view_admin_readonly", ...SUBSCRIBER_CAPABILITIES, "comment_public", "moderate_community", "view_premium_content", "manage_subscription", "view_customer_orders", "manage_customer_orders", "submit_artist_claim", "manage_claimed_artist_profile", "submit_artist_media", "submit_label_updates", "view_partner_reports", "submit_chart_data", "view_research_exports", "export_research_data", "view_analytics", "view_support_console", "manage_support_cases", "view_developer_tools", "manage_developer_tools"],
  developer: ["view_dashboard", "view_developer_tools", "manage_developer_tools", "view_settings", "manage_integrations", "view_imports", "view_charts_admin", "view_admin_readonly"],
  editor: ["view_dashboard", "view_audio", "edit_own_audio", "edit_others_audio", "publish_audio", "delete_audio", "view_video", "edit_own_video", "edit_others_video", "publish_video", "view_playlists", "edit_own_playlists", "edit_others_playlists", "publish_playlists", "delete_playlists", "edit_own_articles", "edit_others_articles", "publish_articles", "delete_articles", "edit_guides", "edit_pages", "view_publishing_dashboard", "manage_publishing", "view_archive", "manage_categories", "manage_tags", "upload_media", "manage_media_library", "view_missing_images", "view_broken_links", "view_review_queue", "manage_review_queue", "view_trust_records", "manage_sources", "manage_citations", "manage_credits", "view_media_migration", "view_admin_readonly"],
  chart_editor_global: ["view_dashboard", "view_charts_admin", "manage_charts", "manage_ingest", "publish_charts", "view_review_queue", "view_admin_readonly"],
  chart_editor_regional: ["view_dashboard", "view_charts_admin", "manage_charts", "publish_charts", "view_review_queue", "view_admin_readonly"],
  registry_editor: ["view_dashboard", "view_registry", "manage_registry", "view_relationships", "manage_relationships", "view_review_queue", "manage_review_queue", "view_trust_records", "manage_sources", "manage_citations", "upload_media", "manage_media_library", "view_admin_readonly"],
  media_editor: ["view_dashboard", "upload_media", "manage_media_library", "view_missing_images", "view_broken_links", "view_media_migration", "view_review_queue", "view_admin_readonly"],
  reviewer: ["view_dashboard", "view_audio", "view_video", "view_playlists", "view_review_queue", "manage_review_queue", "view_trust_records", "review_sources", "view_missing_images", "view_broken_links", "view_admin_readonly"],
  moderator: ["view_dashboard", "view_review_queue", "manage_review_queue", "moderate_community", "view_admin_readonly"],
  support_agent: ["view_dashboard", "view_support_console", "manage_support_cases", "view_admin_readonly"],
  author: ["view_dashboard", "view_audio", "edit_own_audio", "view_video", "edit_own_video", "edit_own_playlists", "edit_own_articles", "publish_articles", "upload_media", "manage_media_library", "view_admin_readonly"],
  analyst: ["view_dashboard", "view_analytics", "view_charts_admin", "view_registry", "view_review_queue", "view_admin_readonly"],
  writer: ["view_audio", "edit_own_audio", "view_video", "edit_own_video", "edit_own_playlists", "edit_own_articles", "upload_media", "manage_media_library"],
  viewer: ["view_dashboard", "view_admin_readonly"],
  subscriber: SUBSCRIBER_CAPABILITIES,
  customer: SUBSCRIBER_CAPABILITIES,
  member: [...SUBSCRIBER_CAPABILITIES, "comment_public"],
  premium_member: [...SUBSCRIBER_CAPABILITIES, "comment_public", "view_premium_content", "manage_subscription"],
  artist_claimant: ["view_public_account", "manage_own_profile", "submit_artist_claim", "submit_artist_media"],
  artist_manager: ["view_public_account", "manage_own_profile", "manage_claimed_artist_profile", "submit_artist_media", "view_partner_reports"],
  label_partner: ["view_public_account", "manage_own_profile", "submit_label_updates", "view_partner_reports"],
  chart_partner: ["view_public_account", "submit_chart_data", "view_partner_reports"],
  brand_partner: ["view_public_account", "view_partner_reports"],
  research_partner: ["view_public_account", "view_research_exports", "export_research_data"],
};

const ROLE_PRIORITY: Record<UserRole, number> = { administrator: 10, developer: 25, editor: 30, chart_editor_global: 35, chart_editor_regional: 40, registry_editor: 45, media_editor: 50, reviewer: 55, moderator: 60, support_agent: 65, author: 70, analyst: 75, writer: 80, viewer: 90, chart_partner: 98, label_partner: 100, artist_manager: 105, artist_claimant: 110, brand_partner: 115, research_partner: 116, premium_member: 118, member: 125, subscriber: 130, customer: 135 };

export function normalizeRole(role: string | null | undefined): UserRole {
  const value = String(role ?? PUBLIC_DEFAULT_ROLE) as UserRole;
  if (value === CUSTOMER_ALIAS_ROLE) return PUBLIC_DEFAULT_ROLE;
  return ROLES.includes(value) ? value : PUBLIC_DEFAULT_ROLE;
}

function primaryRole(roles: UserRole[]): UserRole { return roles.length ? [...roles].sort((a, b) => (ROLE_PRIORITY[a] ?? 999) - (ROLE_PRIORITY[b] ?? 999))[0] : PUBLIC_DEFAULT_ROLE; }
function uniqueCapabilities(roles: UserRole[]): Capability[] { return Array.from(new Set(roles.flatMap((role) => CAPABILITY_MATRIX[role] ?? []))); }

export function getUserCapabilities(role: UserRole): Capability[] { return CAPABILITY_MATRIX[normalizeRole(role)] ?? []; }
export function userCan(role: UserRole, capability: Capability): boolean { return getUserCapabilities(role).includes(capability); }
export function userCanAny(role: UserRole, capabilities: Capability[]): boolean { return capabilities.some((c) => userCan(role, c)); }
export function userCanAll(role: UserRole, capabilities: Capability[]): boolean { return capabilities.every((c) => userCan(role, c)); }
export function roleCanAccessAdmin(role: UserRole | null): boolean { return role ? userCan(role, "view_dashboard") || userCan(role, "view_admin_readonly") : false; }
export function roleIsPublicOnly(role: UserRole | null): boolean { return !roleCanAccessAdmin(role); }

async function fetchRoleCapabilities(
  roles: UserRole[],
): Promise<Capability[]> {
  const { data, error } = await supabase
    .from("role_capabilities")
    .select("capability_key")
    .in("role_key", roles);

  if (error || !data) {
    return uniqueCapabilities(roles);
  }

  const capabilities = Array.from(
    new Set(
      data
        .map((row) =>
          String(row.capability_key ?? "").trim(),
        )
        .filter(Boolean),
    ),
  ) as Capability[];

  return capabilities;
}

export async function fetchUserRole(userId: string): Promise<UserRoleRecord | null> {
  const { data: profile } = await supabase.from("user_profiles").select("user_id, display_name, bio, status, created_at, updated_at").eq("user_id", userId).maybeSingle();
  const { data: assignments, error: assignmentError } = await supabase.from("user_role_assignments").select("id, role_key, status, created_at, updated_at").eq("user_id", userId).eq("status", "active");
  if (!assignmentError && assignments && assignments.length > 0) {
    const roles = assignments.map((row) => normalizeRole(row.role_key as string));
    const role = primaryRole(roles);
    const capabilities = await fetchRoleCapabilities(roles);
    const { data: scopes } = await supabase.from("user_access_scopes").select("id, role_key, scope_type, scope_value, can_view, can_edit, can_publish, status").eq("user_id", userId).eq("status", "active");
    return { id: String(assignments[0].id), user_id: userId, role, roles, capabilities, scopes: (scopes ?? []) as AccessScope[], display_name: (profile?.display_name as string | null | undefined) ?? null, bio: (profile?.bio as string | null | undefined) ?? null, status: (profile?.status as string | null | undefined) ?? "active", created_at: String(profile?.created_at ?? assignments[0].created_at ?? new Date().toISOString()), updated_at: String(profile?.updated_at ?? assignments[0].updated_at ?? new Date().toISOString()) };
  }

  if (assignmentError) console.warn("Durable role lookup failed; defaulting to subscriber:", assignmentError);
  return { id: "default-subscriber", user_id: userId, role: PUBLIC_DEFAULT_ROLE, roles: [PUBLIC_DEFAULT_ROLE], capabilities: getUserCapabilities(PUBLIC_DEFAULT_ROLE), scopes: [], display_name: null, bio: null, status: "active", created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
}

export async function fetchAllUserRoles(): Promise<UserRoleRecord[]> {
  const { data, error } = await supabase.from("user_role_assignments").select("id, user_id, role_key, status, created_at, updated_at").order("created_at", { ascending: false });
  if (!error && data) return data.map((row) => ({ id: String(row.id), user_id: String(row.user_id), role: normalizeRole(row.role_key as string), display_name: null, bio: null, status: String(row.status ?? "active"), created_at: String(row.created_at), updated_at: String(row.updated_at), roles: [normalizeRole(row.role_key as string)], capabilities: getUserCapabilities(normalizeRole(row.role_key as string)), scopes: [] }));
  return [];
}

export async function assignUserRole(userId: string, role: UserRole, displayName?: string, bio?: string): Promise<UserRoleRecord | null> {
  const normalized = normalizeRole(role);
  const now = new Date().toISOString();
  await supabase.from("user_profiles").upsert({ user_id: userId, display_name: displayName ?? null, bio: bio ?? null, status: "active", updated_at: now }, { onConflict: "user_id" });
  const { error } = await supabase.from("user_role_assignments").upsert({ user_id: userId, role_key: normalized, status: "active", assigned_at: now, updated_at: now }, { onConflict: "user_id,role_key" });
  if (!error) return fetchUserRole(userId);
  return fetchUserRole(userId);
}

export async function removeUserRole(userId: string, role?: UserRole): Promise<boolean> {
  const query = supabase.from("user_role_assignments").update({ status: "revoked", updated_at: new Date().toISOString() }).eq("user_id", userId);
  const { error } = role ? await query.eq("role_key", normalizeRole(role)) : await query;
  if (!error) return true;
  return true;
}

export interface NavVisibility { showDashboard: boolean; showContent: boolean; showArticles: boolean; showGuides: boolean; showPages: boolean; showPublishing: boolean; showArchive: boolean; showCharts: boolean; showRegistry: boolean; showCommerce: boolean; showMedia: boolean; showRelationships: boolean; showReview: boolean; showImports: boolean; showSettings: boolean; showUsers: boolean; }

export function getNavVisibility(role: UserRole): NavVisibility {
  const can = (c: Capability) => userCan(role, c);
  return { showDashboard: can("view_dashboard"), showContent: can("edit_own_articles"), showArticles: can("edit_own_articles"), showGuides: can("edit_guides"), showPages: can("edit_pages"), showPublishing: can("view_publishing_dashboard"), showArchive: can("view_archive"), showCharts: can("view_charts_admin"), showRegistry: can("view_registry"), showCommerce: false, showMedia: can("manage_media_library"), showRelationships: can("view_relationships"), showReview: can("view_review_queue"), showImports: can("view_imports"), showSettings: can("view_settings"), showUsers: can("manage_users") };
}

export function getDefaultRoute(role: UserRole): string {
  if (userCan(role, "manage_users") || userCan(role, "view_dashboard")) return "/admin";
  if (userCan(role, "view_charts_admin")) return "/admin/charts/dashboard";
  if (userCan(role, "view_registry")) return "/admin/registry/artists";
  if (userCan(role, "view_review_queue")) return "/admin/review/queue";
  if (userCan(role, "edit_own_articles")) return "/admin/content/articles";
  return "/profile";
}
