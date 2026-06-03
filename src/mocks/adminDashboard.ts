/* Admin Dashboard Mock Data — Phase 1 Visibility */

export interface DashboardKpi {
  label: string;
  value: number | string;
  change?: number;
  accent: "brand" | "success" | "warning" | "danger" | "info" | "muted";
  icon: string;
  href?: string;
}

export interface AttentionItem {
  id: string;
  type: "failed" | "warning" | "info" | "review";
  title: string;
  count: number;
  href: string;
}

export interface RecentActivityItem {
  id: string;
  action: string;
  entity: string;
  entityType: string;
  actor: string;
  timestamp: string;
  status: "success" | "warning" | "error" | "pending";
}

export interface QuickAction {
  label: string;
  description: string;
  icon: string;
  href: string;
  accent?: "brand" | "muted";
  disabled?: boolean;
}

export interface SystemHealthItem {
  label: string;
  status: "healthy" | "warning" | "critical" | "unknown";
  lastChecked: string;
}

export const DASHBOARD_KPIS: DashboardKpi[] = [
  { label: "Articles", value: 119, change: 12, accent: "brand", icon: "FileText", href: "/admin/content/articles" },
  { label: "Guides", value: 34, change: 3, accent: "success", icon: "BookOpen", href: "/admin/content/guides" },
  { label: "Pages", value: 28, change: 0, accent: "muted", icon: "Layout", href: "/admin/content/pages" },
  { label: "Artists", value: 744, change: 23, accent: "brand", icon: "Mic2", href: "/admin/registry/artists" },
  { label: "Tracks", value: 5549, change: 156, accent: "success", icon: "Music", href: "/admin/registry/tracks" },
  { label: "Releases", value: 892, change: 41, accent: "success", icon: "Disc", href: "/admin/registry/releases" },
  { label: "Labels", value: 232, change: 8, accent: "muted", icon: "Building2", href: "/admin/registry/labels" },
  { label: "Genres", value: 67, change: 2, accent: "muted", icon: "Tags", href: "/admin/registry/genres" },
  { label: "Chart Families", value: 12, change: 1, accent: "info", icon: "BarChart3", href: "/admin/settings/charts/families" },
  { label: "Chart Editions", value: 156, change: 4, accent: "info", icon: "Layers", href: "/admin/settings/charts/editions" },
  { label: "Chart Entries", value: 6332, change: 142, accent: "info", icon: "ListOrdered", href: "/admin/settings/charts/editions" },
  { label: "Media Assets", value: 1929, change: 89, accent: "brand", icon: "Image", href: "/admin/media/library" },
  { label: "Import Jobs", value: 47, change: -2, accent: "warning", icon: "Upload", href: "/admin/imports/jobs" },
  { label: "Review Queue", value: 446, change: -12, accent: "danger", icon: "GitPullRequest", href: "/admin/review/queue" },
];

export const ATTENTION_ITEMS: AttentionItem[] = [
  { id: "att-1", type: "failed", title: "Failed import jobs", count: 3, href: "/admin/imports/jobs" },
  { id: "att-2", type: "review", title: "Runs need review", count: 7, href: "/admin/settings/charts/review-queue" },
  { id: "att-3", type: "warning", title: "Missing hero images", count: 103, href: "/admin/media/missing" },
  { id: "att-4", type: "warning", title: "Broken media links", count: 28, href: "/admin/media/broken" },
  { id: "att-5", type: "info", title: "Active ingest runs", count: 2, href: "/admin/settings/charts/ingest-runs" },
  { id: "att-6", type: "review", title: "Unresolved entities", count: 34, href: "/admin/review/unresolved" },
  { id: "att-7", type: "warning", title: "Records missing slugs", count: 19, href: "/admin/review/missing-metadata" },
  { id: "att-8", type: "failed", title: "Failed records", count: 12, href: "/admin/imports/failed" },
];

export const RECENT_ACTIVITY: RecentActivityItem[] = [
  { id: "act-1", action: "Imported", entity: "120 articles from WordPress export", entityType: "articles", actor: "System", timestamp: "2026-06-03T08:30:00Z", status: "success" },
  { id: "act-2", action: "Published", entity: "Kenya Top 40 — 2026-05-18", entityType: "chart", actor: "admin", timestamp: "2026-06-02T16:45:00Z", status: "success" },
  { id: "act-3", action: "Created", entity: "Khaligraph Jones artist profile", entityType: "artist", actor: "editor", timestamp: "2026-06-02T14:20:00Z", status: "success" },
  { id: "act-4", action: "Drafted", entity: "Gengetone Revival feature article", entityType: "article", actor: "editor", timestamp: "2026-06-02T11:00:00Z", status: "pending" },
  { id: "act-5", action: "Flagged", entity: "23 tracks missing playback sources", entityType: "track", actor: "System", timestamp: "2026-06-01T22:15:00Z", status: "warning" },
  { id: "act-6", action: "Resolved", entity: "12 artist-genre relationships", entityType: "relationship", actor: "admin", timestamp: "2026-06-01T18:30:00Z", status: "success" },
  { id: "act-7", action: "Failed", entity: "Spotify provider fetch — timeout", entityType: "import", actor: "System", timestamp: "2026-06-01T09:00:00Z", status: "error" },
  { id: "act-8", action: "Edited", entity: "Wakadinali release discography", entityType: "release", actor: "editor", timestamp: "2026-05-31T15:45:00Z", status: "success" },
];

export const QUICK_ACTIONS: QuickAction[] = [
  { label: "Create Article", description: "Write a new editorial piece", icon: "PenLine", href: "/admin/content/articles/new", accent: "brand" },
  { label: "Upload Import ZIP", description: "Import WordPress export data", icon: "Upload", href: "/admin/imports/upload" },
  { label: "Review Missing Images", description: "103 records need hero images", icon: "ImageOff", href: "/admin/media/missing" },
  { label: "Open Review Queue", description: "446 items awaiting review", icon: "GitPullRequest", href: "/admin/review/queue" },
  { label: "Create Chart Edition", description: "Publish a new weekly chart", icon: "BarChart3", href: "/admin/settings/charts/ingest" },
  { label: "Add Artist", description: "Create a new artist profile", icon: "UserPlus", href: "/admin/registry/artists/new" },
  { label: "Run Data Health Check", description: "Scan for integrity issues", icon: "Activity", href: "/admin/tools/health" },
  { label: "Manage Relationships", description: "View and repair entity links", icon: "Network", href: "/admin/relationships/entity" },
];

export const SYSTEM_HEALTH: SystemHealthItem[] = [
  { label: "Database", status: "healthy", lastChecked: "2026-06-03T10:00:00Z" },
  { label: "Spotify API", status: "healthy", lastChecked: "2026-06-03T09:45:00Z" },
  { label: "Apple Music", status: "warning", lastChecked: "2026-06-03T09:30:00Z" },
  { label: "ACRCloud", status: "healthy", lastChecked: "2026-06-03T09:15:00Z" },
  { label: "YouTube API", status: "healthy", lastChecked: "2026-06-03T09:00:00Z" },
  { label: "WordPress Bridge", status: "critical", lastChecked: "2026-06-03T08:00:00Z" },
  { label: "Media Storage", status: "healthy", lastChecked: "2026-06-03T10:00:00Z" },
  { label: "Search Index", status: "healthy", lastChecked: "2026-06-03T10:00:00Z" },
];

export const OPERATIONAL_COUNTS = {
  recentlyImported: 12,
  recentlyEdited: 8,
  recentlyPublished: 4,
  draftsAwaitingReview: 6,
  recordsMissingHeroImages: 103,
  recordsMissingSlugs: 19,
  failedImports: 3,
  contentConflicts: 2,
};