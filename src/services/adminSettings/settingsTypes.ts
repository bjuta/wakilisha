import { getIngestionMode } from "@/services/chartsIngestion/client";

export type AdminSettingsDomain =
  | "charts"
  | "integrations"
  | "gscData"
  | "frontendAppearance"
  | "playerPlayback"
  | "registry"
  | "airplay"
  | "audience"
  | "emailBriefings"
  | "maintenance"
  | "navigation"
  | "audit"
  | "designSystem";

export interface SettingsDomainMeta {
  key: AdminSettingsDomain;
  label: string;
  description: string;
  icon: string;
  route: string;
  health?: "healthy" | "warning" | "critical" | "unknown";
  lastUpdated?: string;
  primaryAction?: string;
}

export const SETTINGS_DOMAINS: SettingsDomainMeta[] = [
  {
    key: "charts",
    label: "Charts",
    description: "Chart-specific defaults, V2 program defaults, ingest rules, commit gating",
    icon: "BarChart3",
    route: "/admin/settings/chart-defaults",
    health: "healthy",
    primaryAction: "Edit defaults",
  },
  {
    key: "designSystem",
    label: "Design System",
    description: "Design tokens, component specimens, theme browser, and visual QA gates",
    icon: "PanelTop",
    route: "/admin/settings/design-system",
    health: "healthy",
    primaryAction: "Open bible",
  },
  {
    key: "integrations",
    label: "Integrations",
    description: "Provider credentials, connection tests, API mode, health status",
    icon: "Plug",
    route: "/admin/settings/integrations",
    health: "warning",
    primaryAction: "Test connections",
  },
  {
    key: "gscData",
    label: "GSC Data",
    description: "Google Search Console data import, OAuth, property selection, artist matching",
    icon: "Globe",
    route: "/admin/settings/gsc-data",
    health: "unknown",
    primaryAction: "Connect GSC",
  },
  {
    key: "frontendAppearance",
    label: "Frontend Appearance",
    description: "Platform-wide accent colors, theme defaults, hero fallbacks, route appearance",
    icon: "Palette",
    route: "/admin/settings/frontend-appearance",
    health: "healthy",
    primaryAction: "Customize appearance",
  },
  {
    key: "playerPlayback",
    label: "Player & Playback",
    description: "Preview source defaults, player variants, visual motion, audible UI",
    icon: "Play",
    route: "/admin/settings/player-playback",
    health: "healthy",
    primaryAction: "Configure playback",
  },
  {
    key: "registry",
    label: "Registry",
    description: "Schema version, materialized stats, quality thresholds, match confidence",
    icon: "Database",
    route: "/admin/settings/registry",
    health: "healthy",
    primaryAction: "Refresh health",
  },
  {
    key: "airplay",
    label: "Airplay",
    description: "Airplay sync, provider credentials, detection thresholds, evidence storage",
    icon: "Radio",
    route: "/admin/settings/airplay",
    health: "unknown",
    primaryAction: "Configure airplay",
  },
  {
    key: "audience",
    label: "Audience",
    description: "Subscriber defaults, opt-ins, follow notifications, segmentation",
    icon: "Users",
    route: "/admin/settings/audience",
    health: "unknown",
    primaryAction: "Configure audience",
  },
  {
    key: "emailBriefings",
    label: "Email & Briefings",
    description: "Email sender, artist opt-ins, follow notifications, briefing cadence",
    icon: "Mail",
    route: "/admin/settings/email-briefings",
    health: "unknown",
    primaryAction: "Configure email",
  },
  {
    key: "maintenance",
    label: "Maintenance",
    description: "Debug mode, cache clearing, integrity checks, orphaned scans",
    icon: "Wrench",
    route: "/admin/settings/maintenance",
    health: "healthy",
    primaryAction: "Run checks",
  },
  {
    key: "navigation",
    label: "Navigation",
    description: "Admin nav structure, public nav labels, visibility toggles",
    icon: "Compass",
    route: "/admin/settings/navigation",
    health: "healthy",
    primaryAction: "Edit nav",
  },
  {
    key: "audit",
    label: "Audit",
    description: "Recent admin-sensitive events, settings changes, commits, maintenance actions",
    icon: "ClipboardList",
    route: "/admin/settings/audit",
    health: "unknown",
    primaryAction: "View events",
  },
];

/* ──────── Chart Settings ──────── */

export interface ChartSettings {
  defaultChartSize: number;
  defaultMarket: string;
  defaultPeriodType: "weekly" | "daily" | "monthly";
  defaultSourceProviderPriority: string[];
  defaultDryRunMode: boolean;
  allowPartialSourceSuccess: boolean;
  blockCommitIfReviewGaps: boolean;
  blockCommitIfEnrichmentWarnings: boolean;
  blockDuplicateEditions: boolean;
  defaultUnresolvedRowBehavior: "shell" | "ignore" | "review";
  defaultCoverStyle: "artwork" | "photo" | "abstract";
  defaultChartKind: "tracks" | "releases" | "artists" | "videos";
  v2ProgramDefaults: {
    defaultMethodologyVersion: string;
    defaultEligibilityRulesVersion: string;
  };
}

export const DEFAULT_CHART_SETTINGS: ChartSettings = {
  defaultChartSize: 40,
  defaultMarket: "kenya",
  defaultPeriodType: "weekly",
  defaultSourceProviderPriority: ["spotify", "apple_music", "acrcloud", "youtube"],
  defaultDryRunMode: true,
  allowPartialSourceSuccess: true,
  blockCommitIfReviewGaps: true,
  blockCommitIfEnrichmentWarnings: true,
  blockDuplicateEditions: true,
  defaultUnresolvedRowBehavior: "shell",
  defaultCoverStyle: "artwork",
  defaultChartKind: "tracks",
  v2ProgramDefaults: {
    defaultMethodologyVersion: "v1.0",
    defaultEligibilityRulesVersion: "v1.0",
  },
};

/* ──────── Integration Settings ──────── */

export interface IntegrationProvider {
  name: string;
  key: string;
  envVar: string;
  connected: boolean;
  lastTested: string | null;
  health: "healthy" | "unhealthy" | "unknown";
  testUrl?: string;
  description: string;
}

export interface IntegrationSettings {
  providers: IntegrationProvider[];
  apiMode: "wp" | "v2" | "mock";
}

export const DEFAULT_INTEGRATION_SETTINGS: IntegrationSettings = {
  providers: [
    {
      name: "Spotify",
      key: "spotify",
      envVar: "SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET",
      connected: false,
      lastTested: null,
      health: "unknown",
      description: "Web API for track metadata, previews, and artwork.",
    },
    {
      name: "Apple Music",
      key: "apple_music",
      envVar: "APPLE_MUSIC_KEY, APPLE_MUSIC_TEAM_ID, APPLE_MUSIC_KEY_ID",
      connected: false,
      lastTested: null,
      health: "unknown",
      description: "JWT-based previews and catalog metadata.",
    },
    {
      name: "ACRCloud",
      key: "acrcloud",
      envVar: "ACR_HOST, ACR_ACCESS_KEY, ACR_ACCESS_SECRET",
      connected: false,
      lastTested: null,
      health: "unknown",
      description: "Audio fingerprinting and preview recovery.",
    },
    {
      name: "YouTube",
      key: "youtube",
      envVar: "YOUTUBE_API_KEY",
      connected: false,
      lastTested: null,
      health: "unknown",
      description: "oEmbed previews and watch page metadata.",
    },
    {
      name: "Airplay",
      key: "airplay",
      envVar: "AIRPLAY_API_KEY, AIRPLAY_API_BASE",
      connected: false,
      lastTested: null,
      health: "unknown",
      description: "Airplay detection and sync.",
    },
  ],
  apiMode: "mock",
};

/* ──────── GSC Settings ──────── */

export interface GscSettings {
  enabled: boolean;
  oauthStatus: "disconnected" | "connected" | "pending" | "error";
  selectedProperty: string | null;
  importSchedule: "manual" | "daily" | "weekly";
  queryRowRetentionDays: number;
  enableArtistMatching: boolean;
  minimumMatchConfidence: number;
}

export const DEFAULT_GSC_SETTINGS: GscSettings = {
  enabled: false,
  oauthStatus: "disconnected",
  selectedProperty: null,
  importSchedule: "manual",
  queryRowRetentionDays: 90,
  enableArtistMatching: true,
  minimumMatchConfidence: 0.75,
};

/* ──────── Frontend Appearance ──────── */

export interface FrontendAppearanceSettings {
  lightModeAccent: string;
  darkModeAccent: string;
  themeDefault: "system" | "light" | "dark";
  defaultChartHeroImage: string;
  defaultArtistHeroFallback: string;
  defaultGenreHeroFallback: string;
  defaultLabelHeroFallback: string;
  defaultLoginBackground: string;
  archiveFilterBehavior: "show_all" | "collapse_by_year";
}

export const DEFAULT_FRONTEND_APPEARANCE_SETTINGS: FrontendAppearanceSettings = {
  lightModeAccent: "#c0392b",
  darkModeAccent: "#e74c3c",
  themeDefault: "system",
  defaultChartHeroImage: "",
  defaultArtistHeroFallback: "",
  defaultGenreHeroFallback: "",
  defaultLabelHeroFallback: "",
  defaultLoginBackground: "",
  archiveFilterBehavior: "collapse_by_year",
};

/* ──────── Player & Playback ──────── */

export interface PlayerPlaybackSettings {
  previewSourceMode: "auto" | "spotify" | "apple" | "youtube" | "acrcloud";
  desktopPlayerVariant: "compact" | "full" | "minimal";
  enableVisualMotionByDefault: boolean;
  audibleUiModeDefault: boolean;
  enableHoverSounds: boolean;
  applePlaybackConnected: boolean;
  preferSpotifyPreviews: boolean;
  preferApplePreviews: boolean;
  fallbackToYouTubeEmbeds: boolean;
  fallbackToAcrcloudPreview: boolean;
}

export const DEFAULT_PLAYER_PLAYBACK_SETTINGS: PlayerPlaybackSettings = {
  previewSourceMode: "auto",
  desktopPlayerVariant: "compact",
  enableVisualMotionByDefault: true,
  audibleUiModeDefault: false,
  enableHoverSounds: false,
  applePlaybackConnected: false,
  preferSpotifyPreviews: true,
  preferApplePreviews: false,
  fallbackToYouTubeEmbeds: true,
  fallbackToAcrcloudPreview: true,
};

/* ──────── Registry Settings ──────── */

export interface RegistrySettings {
  schemaVersion: string;
  dbStatus: "connected" | "disconnected" | "unknown";
  materializedStatsStatus: "fresh" | "stale" | "unknown";
  qualityThreshold: number;
  duplicateCandidateThreshold: number;
  canonicalMatchConfidenceThreshold: number;
  autoCreateReleaseShells: boolean;
  autoSendNoMatchRowsToReview: boolean;
}

export const DEFAULT_REGISTRY_SETTINGS: RegistrySettings = {
  schemaVersion: "v2",
  dbStatus: "unknown",
  materializedStatsStatus: "unknown",
  qualityThreshold: 0.85,
  duplicateCandidateThreshold: 0.92,
  canonicalMatchConfidenceThreshold: 0.80,
  autoCreateReleaseShells: true,
  autoSendNoMatchRowsToReview: false,
};

/* ──────── Airplay Settings ──────── */

export interface AirplaySettings {
  enabled: boolean;
  provider: string;
  apiBaseUrl: string;
  apiKey: string;
  syncFrequency: "manual" | "hourly" | "daily" | "weekly";
  defaultMarket: string;
  evidenceStorageMode: "local" | "s3" | "db";
  autoLinkDetections: boolean;
  minimumConfidenceThreshold: number;
}

export const DEFAULT_AIRPLAY_SETTINGS: AirplaySettings = {
  enabled: false,
  provider: "default",
  apiBaseUrl: "",
  apiKey: "",
  syncFrequency: "manual",
  defaultMarket: "kenya",
  evidenceStorageMode: "local",
  autoLinkDetections: true,
  minimumConfidenceThreshold: 0.70,
};

/* ──────── Audience Settings ──────── */

export interface AudienceSettings {
  subscriberDefaults: {
    defaultOptIn: boolean;
    defaultBriefingFrequency: "weekly" | "biweekly" | "monthly";
  };
  optInSettings: {
    requireDoubleOptIn: boolean;
    showOptInOnSignup: boolean;
  };
  followNotificationDefaults: {
    enabled: boolean;
    frequency: "immediate" | "daily_digest" | "weekly_digest";
  };
  segmentationDefaults: {
    enabled: boolean;
    defaultSegments: string[];
  };
  newsletterIssueDefaults: {
    defaultSendDay: "monday" | "friday";
    defaultSendTime: string;
  };
}

export const DEFAULT_AUDIENCE_SETTINGS: AudienceSettings = {
  subscriberDefaults: {
    defaultOptIn: true,
    defaultBriefingFrequency: "weekly",
  },
  optInSettings: {
    requireDoubleOptIn: false,
    showOptInOnSignup: true,
  },
  followNotificationDefaults: {
    enabled: true,
    frequency: "weekly_digest",
  },
  segmentationDefaults: {
    enabled: false,
    defaultSegments: ["music", "charts"],
  },
  newsletterIssueDefaults: {
    defaultSendDay: "friday",
    defaultSendTime: "09:00",
  },
};

/* ──────── Email & Briefings ──────── */

export interface EmailBriefingsSettings {
  fromName: string;
  fromAddress: string;
  enableArtistOptInEmails: boolean;
  enableFollowNotifications: boolean;
  enableBriefingIssues: boolean;
  briefingSendCadence: "weekly" | "biweekly" | "monthly";
  testRecipientEmail: string;
}

export const DEFAULT_EMAIL_BRIEFINGS_SETTINGS: EmailBriefingsSettings = {
  fromName: "WAKILISHA",
  fromAddress: "briefings@wakilisha.com",
  enableArtistOptInEmails: false,
  enableFollowNotifications: false,
  enableBriefingIssues: false,
  briefingSendCadence: "weekly",
  testRecipientEmail: "",
};

/* ──────── Maintenance Settings ──────── */

export interface MaintenanceSettings {
  debugMode: boolean;
  lastIntegrityCheck: string | null;
  lastDuplicateScan: string | null;
  lastOrphanedScan: string | null;
  lastSnapshotIntegrityCheck: string | null;
}

export const DEFAULT_MAINTENANCE_SETTINGS: MaintenanceSettings = {
  debugMode: false,
  lastIntegrityCheck: null,
  lastDuplicateScan: null,
  lastOrphanedScan: null,
  lastSnapshotIntegrityCheck: null,
};

/* ──────── Navigation Settings ──────── */

export interface NavigationSettings {
  adminNavCollapsed: boolean;
  publicNavItems: {
    label: string;
    path: string;
    visible: boolean;
    order: number;
  }[];
  shareConfig: {
    enabled: boolean;
    platforms: string[];
  };
}

export const DEFAULT_NAVIGATION_SETTINGS: NavigationSettings = {
  adminNavCollapsed: false,
  publicNavItems: [
    { label: "Home", path: "/", visible: true, order: 1 },
    { label: "Charts", path: "/charts", visible: true, order: 2 },
    { label: "Artists", path: "/artists", visible: true, order: 3 },
    { label: "Releases", path: "/releases", visible: true, order: 4 },
    { label: "Genres", path: "/genres", visible: true, order: 5 },
    { label: "Labels", path: "/labels", visible: true, order: 6 },
    { label: "Magazine", path: "/magazine", visible: true, order: 7 },
  ],
  shareConfig: {
    enabled: true,
    platforms: ["twitter", "facebook", "whatsapp", "copy"],
  },
};

/* ──────── Audit Event ──────── */

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  domain: AdminSettingsDomain;
  action: string;
  details: string;
  severity: "info" | "warning" | "error";
}

/* ──────── Full Settings State ──────── */

export interface AdminSettingsState {
  charts: ChartSettings;
  integrations: IntegrationSettings;
  gscData: GscSettings;
  frontendAppearance: FrontendAppearanceSettings;
  playerPlayback: PlayerPlaybackSettings;
  registry: RegistrySettings;
  airplay: AirplaySettings;
  audience: AudienceSettings;
  emailBriefings: EmailBriefingsSettings;
  maintenance: MaintenanceSettings;
  navigation: NavigationSettings;
  audit: AuditEvent[];
}

export const DEFAULT_ADMIN_SETTINGS: AdminSettingsState = {
  charts: DEFAULT_CHART_SETTINGS,
  integrations: DEFAULT_INTEGRATION_SETTINGS,
  gscData: DEFAULT_GSC_SETTINGS,
  frontendAppearance: DEFAULT_FRONTEND_APPEARANCE_SETTINGS,
  playerPlayback: DEFAULT_PLAYER_PLAYBACK_SETTINGS,
  registry: DEFAULT_REGISTRY_SETTINGS,
  airplay: DEFAULT_AIRPLAY_SETTINGS,
  audience: DEFAULT_AUDIENCE_SETTINGS,
  emailBriefings: DEFAULT_EMAIL_BRIEFINGS_SETTINGS,
  maintenance: DEFAULT_MAINTENANCE_SETTINGS,
  navigation: DEFAULT_NAVIGATION_SETTINGS,
  audit: [],
};

/* ──────── Utility types ──────── */

export type SettingsSaveResult =
  | { ok: true; message: string }
  | { ok: false; error: string; code: string };

export type ProviderTestResult =
  | { ok: true; latencyMs: number; message: string }
  | { ok: false; error: string; code: string; envVar?: string };

export type MaintenanceActionResult =
  | { ok: true; message: string; itemsAffected?: number }
  | { ok: false; error: string; reason: string };

export const SETTINGS_STORAGE_KEY = "wk_admin_settings_v1";
export const AUDIT_STORAGE_KEY = "wk_admin_audit_v1";

export function isMockMode(): boolean {
  return getIngestionMode() === "mock";
}