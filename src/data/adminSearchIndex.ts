export interface AdminSearchItem {
  id: string;
  label: string;
  description: string;
  path: string;
  icon: string;
  group: string;
  keywords?: string[];
}

export const ADMIN_SEARCH_INDEX: AdminSearchItem[] = [
  // ── Dashboard ──
  { id: "dashboard", label: "Dashboard Overview", description: "KPIs, operational stats, recent activity, and system health", path: "/admin", icon: "LayoutDashboard", group: "Dashboard", keywords: ["home", "kpi", "stats", "overview", "health"] },
  { id: "analytics", label: "Analytics", description: "Share analytics, page views, scroll depth, and audience metrics", path: "/admin/analytics", icon: "BarChart3", group: "Dashboard", keywords: ["metrics", "shares", "views", "tracking", "audience data"] },

  // ── Content & Editorial ──
  { id: "articles", label: "Articles", description: "Manage magazine articles. Edit, publish, schedule, and trash.", path: "/admin/content/articles", icon: "FileText", group: "Content & Editorial", keywords: ["posts", "magazine", "blog", "writing", "editorial"] },
  { id: "articles-new", label: "New Article", description: "Create a new magazine article with the rich text editor", path: "/admin/content/articles/new", icon: "Plus", group: "Content & Editorial", keywords: ["create", "write", "compose", "draft"] },
  { id: "audio", label: "Audio", description: "Create and govern shows, episodes, standalone audio, transcripts, chapters, Credits, Citations, and Review", path: "/admin/content/audio", icon: "Radio", group: "Content & Editorial", keywords: ["podcast", "episode", "show", "transcript", "chapters", "rss"] },
  { id: "video", label: "Video", description: "Create and govern standalone Video and shared Show Episodes with sources, posters, captions, chapters, and Review", path: "/admin/content/video", icon: "Clapperboard", group: "Content & Editorial", keywords: ["film", "video", "youtube", "vimeo", "captions", "subtitles", "chapters"] },
  { id: "articles-trash", label: "Article Trash", description: "Review and restore or permanently delete trashed articles", path: "/admin/content/articles/trash", icon: "Trash2", group: "Content & Editorial", keywords: ["deleted", "bin", "restore", "removed"] },
  { id: "guides", label: "Guides", description: "Manage culture guides for Dakar, Venice, and Reading editions", path: "/admin/content/guides", icon: "BookOpen", group: "Content & Editorial", keywords: ["culture", "travel", "curated", "dakar", "venice"] },
  { id: "pages", label: "Pages", description: "Manage static pages like About, Contact, FAQs, Privacy, Terms", path: "/admin/content/pages", icon: "Layout", group: "Content & Editorial", keywords: ["static", "about", "contact", "legal", "faq"] },
  { id: "lyrics", label: "Lyrics", description: "Manage and review user-contributed lyrics", path: "/admin/content/lyrics", icon: "Mic2", group: "Content & Editorial", keywords: ["words", "song text", "contributions", "review lyrics"] },
  { id: "featured-artists", label: "Featured Artists", description: "Curate featured artists for the magazine homepage", path: "/admin/content/magazine/featured-artists", icon: "Star", group: "Content & Editorial", keywords: ["spotlight", "magazine", "curation", "highlight"] },
  { id: "featured-guides", label: "Featured Guides", description: "Curate featured guides for the magazine homepage", path: "/admin/content/magazine/featured-guides", icon: "BookMarked", group: "Content & Editorial", keywords: ["spotlight", "curation", "highlight"] },
  { id: "publishing", label: "Publishing Dashboard", description: "Overview of publishing schedule, drafts, and upcoming releases", path: "/admin/content/publishing", icon: "Globe", group: "Content & Editorial", keywords: ["schedule", "calendar", "release", "publish queue"] },
  { id: "categories", label: "Categories", description: "Manage article categories and taxonomy terms", path: "/admin/content/categories", icon: "FolderTree", group: "Content & Editorial", keywords: ["taxonomy", "terms", "organization", "sections"] },
  { id: "tags", label: "Tags", description: "Manage article tags and content labels", path: "/admin/content/tags", icon: "Tags", group: "Content & Editorial", keywords: ["labels", "taxonomy", "keywords", "metadata"] },
  { id: "archive", label: "Content Archive", description: "Browse and manage archived content across all types", path: "/admin/content/archive", icon: "Archive", group: "Content & Editorial", keywords: ["history", "old", "past content", "browse"] },

  // ── Music Registry ──
  { id: "registry", label: "Registry Overview", description: "Manage artists, tracks, releases, labels, and genres", path: "/admin/registry", icon: "LayoutDashboard", group: "Music Registry", keywords: ["entities", "master", "database", "all"] },
  { id: "registry-artists", label: "Artists", description: "Browse and manage all artist entities in the registry", path: "/admin/registry/artists", icon: "Mic2", group: "Music Registry", keywords: ["musicians", "performers", "singers", "bands"] },
  { id: "registry-artist-intake", label: "Artist Intake", description: "Ingest new artists from external providers into the registry", path: "/admin/registry/artists/intake", icon: "Upload", group: "Music Registry", keywords: ["import", "new artist", "provider", "add artist"] },
  { id: "registry-tracks", label: "Tracks", description: "Browse and manage all track entities in the registry", path: "/admin/registry/tracks", icon: "Music", group: "Music Registry", keywords: ["songs", "recordings", "audio"] },
  { id: "registry-track-intake", label: "Track Intake", description: "Review provider-backed tracks sent from Playlists to Music Registry", path: "/admin/registry/tracks/intake", icon: "ListChecks", group: "Music Registry", keywords: ["playlist intake", "pending tracks", "registry review", "provider evidence", "unresolved tracks"] },
  { id: "registry-releases", label: "Releases", description: "Browse and manage all release entities (albums, EPs, singles)", path: "/admin/registry/releases", icon: "Disc", group: "Music Registry", keywords: ["albums", "eps", "singles", "mixtapes"] },
  { id: "registry-labels", label: "Labels", description: "Browse and manage record label entities", path: "/admin/registry/labels", icon: "Building2", group: "Music Registry", keywords: ["record labels", "imprints", "companies", "publishers"] },
  { id: "registry-genres", label: "Genres", description: "Browse and manage music genre taxonomy", path: "/admin/registry/genres", icon: "Tags", group: "Music Registry", keywords: ["styles", "categories", "music types", "sounds"] },
  { id: "registry-aliases", label: "Artist Aliases", description: "Manage artist name variations and alternate identities", path: "/admin/registry/artist-aliases", icon: "Link", group: "Music Registry", keywords: ["aka", "alternate names", "variations", "also known as"] },
  { id: "registry-authors", label: "Authors", description: "Manage author profiles for magazine contributors", path: "/admin/registry/authors", icon: "PenLine", group: "Music Registry", keywords: ["writers", "contributors", "journalists", "byline"] },

  // ── Charts Engine ──
  { id: "charts-dashboard", label: "Charts Dashboard", description: "Overview of chart operations, recent editions, and system health", path: "/admin/charts/dashboard", icon: "LayoutDashboard", group: "Charts Engine", keywords: ["charts home", "overview", "charts stats"] },
  { id: "charts-ingest", label: "Ingest Studio", description: "Import chart data from Spotify, Apple Music, ACRCloud, and YouTube", path: "/admin/charts/ingest", icon: "Database", group: "Charts Engine", keywords: ["import", "data", "provider", "spotify", "apple music", "fetch"] },
  { id: "charts-ingest-runs", label: "Ingest Runs", description: "History and status of all chart data ingestion runs", path: "/admin/charts/ingest-runs", icon: "ListChecks", group: "Charts Engine", keywords: ["history", "past imports", "ingestion log", "runs list"] },
  { id: "charts-editions", label: "Chart Editions", description: "Browse and manage published chart editions", path: "/admin/charts/editions", icon: "Layers", group: "Charts Engine", keywords: ["published", "rankings", "weekly charts", "chart history"] },
  { id: "charts-scoring", label: "Scoring Runs", description: "View chart scoring computation history and results", path: "/admin/charts/scoring-runs", icon: "Rocket", group: "Charts Engine", keywords: ["compute", "rankings calculation", "methodology", "algorithm"] },
  { id: "charts-families", label: "Chart Families", description: "Manage chart series families and their configurations", path: "/admin/charts/families", icon: "FolderTree", group: "Charts Engine", keywords: ["series", "groups", "chart types", "configurations"] },
  { id: "charts-snapshots", label: "Chart Snapshots", description: "Browse archived chart edition snapshots", path: "/admin/charts/snapshots", icon: "Camera", group: "Charts Engine", keywords: ["archived", "historical", "saved charts", "versions"] },
  { id: "charts-review", label: "Chart Review Queue", description: "Review items flagged during chart ingestion for manual resolution", path: "/admin/charts/review-queue", icon: "GitPullRequest", group: "Charts Engine", keywords: ["flagged", "to review", "issues", "manual check"] },
  { id: "charts-canon-gaps", label: "Canon Gaps", description: "Identify and resolve gaps in the canonical chart record", path: "/admin/charts/canon-gaps", icon: "AlertCircle", group: "Charts Engine", keywords: ["missing", "incomplete", "gaps", "canonical"] },
  { id: "charts-health", label: "Ingest Health", description: "API health monitoring for all chart data providers", path: "/admin/charts/ingest-health", icon: "HeartPulse", group: "Charts Engine", keywords: ["api status", "provider health", "monitoring", "connectivity"] },
  { id: "charts-integration", label: "Integration Map", description: "Visual map of chart data integrations and provider connections", path: "/admin/charts/integration-map", icon: "Map", group: "Charts Engine", keywords: ["connections", "providers", "data flow", "pipeline"] },
  { id: "charts-api-qa", label: "Public API QA", description: "Quality assurance tools for the public charts API", path: "/admin/charts/public-api-qa", icon: "FlaskConical", group: "Charts Engine", keywords: ["testing", "api test", "endpoint check", "qa tools"] },
  { id: "charts-no-match", label: "No-Match Records", description: "Review chart entries that could not be matched to registry entities", path: "/admin/charts/no-match", icon: "XCircle", group: "Charts Engine", keywords: ["unmatched", "orphaned", "unresolved", "missing match"] },

  // ── Media ──
  { id: "media-library", label: "Media Library", description: "Browse and manage all uploaded media assets", path: "/admin/media/library", icon: "Image", group: "Media", keywords: ["images", "photos", "uploads", "assets", "files"] },
  { id: "media-missing", label: "Missing Images", description: "Track records with missing or broken hero images", path: "/admin/media/missing", icon: "ImageOff", group: "Media", keywords: ["broken images", "missing artwork", "empty", "no image"] },
  { id: "media-broken", label: "Broken Links", description: "Detect and fix broken media links across the platform", path: "/admin/media/broken", icon: "LinkBreak", group: "Media", keywords: ["dead links", "404", "fix links", "link checker"] },

  // ── Review & Quality ──
  { id: "review-queue", label: "Review Queue", description: "Review flagged records, relationships, and content", path: "/admin/review/queue", icon: "GitPullRequest", group: "Review & Quality", keywords: ["flagged", "pending review", "quality check", "approval"] },
  { id: "relationships", label: "Entity Relationships", description: "Visual graph viewer for entity relationships across the registry", path: "/admin/relationships/viewer", icon: "Network", group: "Review & Quality", keywords: ["graph", "connections", "linked", "network view", "entity graph"] },
  { id: "duplicates", label: "Duplicate Merge", description: "Find and merge duplicate entities in the registry", path: "/admin/relationships/duplicates", icon: "Copy", group: "Review & Quality", keywords: ["deduplicate", "merge entities", "duplicate detection", "clean up"] },

  // ── Data Import ──

  // ── Settings ──
  { id: "settings-hub", label: "Settings Hub", description: "Central overview of all platform settings domains", path: "/admin/settings", icon: "Settings", group: "Settings", keywords: ["configuration", "preferences", "all settings"] },
  { id: "settings-site-identity", label: "Site Identity", description: "Manage the logo, site name, tagline, and favicon", path: "/admin/settings/site-identity", icon: "Fingerprint", group: "Settings", keywords: ["branding", "logo", "name", "brand", "identity"] },
  { id: "settings-appearance", label: "Frontend Appearance", description: "Accent colors, theme defaults, hero fallbacks, route appearance", path: "/admin/settings/frontend-appearance", icon: "Palette", group: "Settings", keywords: ["colors", "theme", "styling", "visual", "design tokens"] },
  { id: "settings-navigation", label: "Navigation Settings", description: "Admin nav structure, public nav labels, visibility toggles", path: "/admin/settings/navigation", icon: "Compass", group: "Settings", keywords: ["menus", "links", "nav bar", "structure"] },
  { id: "settings-design-system", label: "Design System", description: "Design tokens, component specimens, theme browser, visual QA gates", path: "/admin/settings/design-system", icon: "PanelTop", group: "Settings", keywords: ["tokens", "components", "specimens", "visual bible", "ui kit"] },
  { id: "settings-charts", label: "Chart Defaults", description: "Chart-specific defaults, V2 program defaults, ingest rules, commit gating", path: "/admin/settings/chart-defaults", icon: "BarChart3", group: "Settings", keywords: ["chart config", "defaults", "ingest rules", "methodology"] },
  { id: "settings-charts-market", label: "Market Scopes", description: "Manage chart market scope definitions and region settings", path: "/admin/settings/chart-defaults/market-scopes", icon: "Globe", group: "Settings", keywords: ["markets", "regions", "countries", "geographic"] },
  { id: "settings-airplay", label: "Airplay Settings", description: "Airplay sync, provider credentials, detection thresholds, evidence storage", path: "/admin/settings/airplay", icon: "Radio", group: "Settings", keywords: ["radio", "broadcast", "detection", "monitoring"] },
  { id: "settings-player", label: "Player & Playback", description: "Preview source defaults, player variants, visual motion, audible UI", path: "/admin/settings/player-playback", icon: "Play", group: "Settings", keywords: ["audio", "music player", "preview", "playback config"] },
  { id: "settings-registry", label: "Registry Settings", description: "Schema version, materialized stats, quality thresholds, match confidence", path: "/admin/settings/registry", icon: "Database", group: "Settings", keywords: ["entity config", "schema", "threshold", "quality score"] },
  { id: "settings-integrations", label: "Integrations", description: "Provider credentials, connection tests, API mode, health status", path: "/admin/settings/integrations", icon: "Plug", group: "Settings", keywords: ["spotify", "apple music", "youtube", "acrcloud", "api keys"] },
  { id: "settings-gsc", label: "GSC Data", description: "Google Search Console data import, OAuth, property selection, artist matching", path: "/admin/settings/gsc-data", icon: "Globe", group: "Settings", keywords: ["google", "search console", "seo", "search data", "oauth"] },
  { id: "settings-audience", label: "Audience Settings", description: "Subscriber defaults, opt-ins, follow notifications, segmentation", path: "/admin/settings/audience", icon: "Users", group: "Settings", keywords: ["subscribers", "fans", "notifications", "email list"] },
  { id: "settings-email", label: "Email & Briefings", description: "Email sender, artist opt-ins, follow notifications, briefing cadence", path: "/admin/settings/email-briefings", icon: "Mail", group: "Settings", keywords: ["newsletter", "send", "smtp", "communications"] },
  { id: "settings-maintenance", label: "Maintenance", description: "Debug mode, cache clearing, integrity checks, orphaned scans", path: "/admin/settings/maintenance", icon: "Wrench", group: "Settings", keywords: ["debug", "cache", "cleanup", "repair", "system check"] },
  { id: "settings-audit", label: "Audit Log", description: "Recent admin-sensitive events, settings changes, commits, maintenance actions", path: "/admin/settings/audit", icon: "ClipboardList", group: "Settings", keywords: ["log", "history", "events", "security", "changes"] },

  // ── Users ──
  { id: "users", label: "Manage Users", description: "Invite, manage roles, and control access for admin users", path: "/admin/users", icon: "Users", group: "Users", keywords: ["team", "staff", "roles", "permissions", "invite"] },

  // ── Developer ──
  { id: "api-docs", label: "API Documentation", description: "Interactive API reference for WAKILISHA public and admin endpoints", path: "/admin/api-docs", icon: "BookOpen", group: "Developer", keywords: ["swagger", "openapi", "endpoints", "reference", "rest"] },
];