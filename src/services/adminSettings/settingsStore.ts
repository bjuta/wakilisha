import {
  DEFAULT_ADMIN_SETTINGS,
  SETTINGS_STORAGE_KEY,
  AUDIT_STORAGE_KEY,
  type AdminSettingsState,
  type AdminSettingsDomain,
  type AuditEvent,
  type ChartSettings,
  type IntegrationSettings,
  type GscSettings,
  type FrontendAppearanceSettings,
  type PlayerPlaybackSettings,
  type RegistrySettings,
  type AirplaySettings,
  type AudienceSettings,
  type EmailBriefingsSettings,
  type MaintenanceSettings,
  type NavigationSettings,
  type SettingsSaveResult,
} from "./settingsTypes";

/* ──────── Load / Save ──────── */

export function loadSettings(): AdminSettingsState {
  if (typeof window === "undefined") return DEFAULT_ADMIN_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_ADMIN_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AdminSettingsState>;
    return mergeDefaults(parsed, DEFAULT_ADMIN_SETTINGS);
  } catch {
    return DEFAULT_ADMIN_SETTINGS;
  }
}

export function saveSettings(state: AdminSettingsState): SettingsSaveResult {
  if (typeof window === "undefined") {
    return { ok: false, error: "No browser environment available", code: "no_browser" };
  }
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(state));
    return { ok: true, message: "Settings saved" };
  } catch {
    return { ok: false, error: "Failed to save settings", code: "save_failed" };
  }
}

export function saveDomainSettings<T>(
  domain: AdminSettingsDomain,
  value: T
): SettingsSaveResult {
  const current = loadSettings();
  const next = { ...current, [domain]: value };
  const result = saveSettings(next);
  if (result.ok) {
    pushAuditEvent({
      domain,
      action: "settings_updated",
      details: `Settings updated for ${domain}`,
      severity: "info",
    });
  }
  return result;
}

/* ──────── Audit ──────── */

export function pushAuditEvent(partial: Omit<AuditEvent, "id" | "timestamp" | "actor">): void {
  if (typeof window === "undefined") return;
  const actor = getCurrentActor();
  const event: AuditEvent = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    actor,
    ...partial,
  };
  const existing = loadAuditEvents();
  const next = [event, ...existing].slice(0, 500);
  localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(next));
}

export function loadAuditEvents(): AuditEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuditEvent[]) : [];
  } catch {
    return [];
  }
}

export function clearAuditEvents(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUDIT_STORAGE_KEY);
}

function getCurrentActor(): string {
  try {
    const user = localStorage.getItem("wk_user");
    if (user) return JSON.parse(user).email || "admin";
  } catch { /* ignore */ }
  return "admin";
}

/* ──────── Merge defaults ──────── */

function mergeDefaults<T>(partial: Partial<T>, defaults: T): T {
  return { ...defaults, ...partial } as T;
}

/* ──────── Domain-specific helpers ──────── */

export function getChartSettings(): ChartSettings {
  return loadSettings().charts;
}

export function getIntegrationSettings(): IntegrationSettings {
  return loadSettings().integrations;
}

export function getGscSettings(): GscSettings {
  return loadSettings().gscData;
}

export function getFrontendAppearanceSettings(): FrontendAppearanceSettings {
  return loadSettings().frontendAppearance;
}

export function getPlayerPlaybackSettings(): PlayerPlaybackSettings {
  return loadSettings().playerPlayback;
}

export function getRegistrySettings(): RegistrySettings {
  return loadSettings().registry;
}

export function getAirplaySettings(): AirplaySettings {
  return loadSettings().airplay;
}

export function getAudienceSettings(): AudienceSettings {
  return loadSettings().audience;
}

export function getEmailBriefingsSettings(): EmailBriefingsSettings {
  return loadSettings().emailBriefings;
}

export function getMaintenanceSettings(): MaintenanceSettings {
  return loadSettings().maintenance;
}

export function getNavigationSettings(): NavigationSettings {
  return loadSettings().navigation;
}

/* ──────── Secret masking ──────── */

export function maskSecret(value: string): string {
  if (!value || value.length < 8) return "***";
  return `${value.slice(0, 3)}...${value.slice(-3)}`;
}

export function isSecretPresent(value: string): boolean {
  return value.length > 0;
}