import { pushAuditEvent } from "./settingsStore";
import {
  getDefaultFieldValue,
  getProviderCredentialSchema,
  getProviderEnvVars,
  getRequiredProviderEnvVars,
  type ProviderCredentialSchema,
  type SettingsFieldValue,
} from "./providerCredentialSchema";

export type ProviderCredentialValues = Record<string, SettingsFieldValue>;

export type ProviderCredentialStatus = {
  providerKey: string;
  configured: boolean;
  requiredEnvVars: string[];
  optionalEnvVars: string[];
  configuredVars: string[];
  missingRequiredVars: string[];
  missingOptionalVars: string[];
  savedAt: string | null;
};

const ENV_PREFIX = "env_";
const PROVIDER_CONFIG_PREFIX = "wk_provider_config_";
const PROVIDER_SAVED_AT_PREFIX = "wk_provider_saved_at_";

function isServerStoredSecretMarker(value: string): boolean {
  return value === "__server_stored__" || value.startsWith("uploaded:");
}

export function envStorageKey(envVar: string): string {
  return `${ENV_PREFIX}${envVar}`;
}

export function providerConfigKey(providerKey: string): string {
  return `${PROVIDER_CONFIG_PREFIX}${providerKey}`;
}

function providerSavedAtKey(providerKey: string): string {
  return `${PROVIDER_SAVED_AT_PREFIX}${providerKey}`;
}

export function readEnvValue(envVar: string): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(envStorageKey(envVar)) ?? "";
}

export function writeEnvValue(envVar: string, value: SettingsFieldValue): void {
  if (typeof window === "undefined") return;
  const normalized = typeof value === "boolean" || typeof value === "number" ? String(value) : value;
  if (!normalized.trim()) localStorage.removeItem(envStorageKey(envVar));
  else localStorage.setItem(envStorageKey(envVar), normalized);
}

export function readProviderCredentialValues(providerKey: string): ProviderCredentialValues {
  const schema = getProviderCredentialSchema(providerKey);
  if (!schema) return {};
  const values: ProviderCredentialValues = {};
  for (const field of schema.fields) {
    if (field.envVar) values[field.key] = readEnvValue(field.envVar);
    else values[field.key] = getDefaultFieldValue(field);
  }
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(providerConfigKey(providerKey));
      if (raw) Object.assign(values, JSON.parse(raw));
    } catch { /* ignore malformed local provider config */ }
  }
  return values;
}

export function saveProviderCredentialValues(providerKey: string, values: ProviderCredentialValues): ProviderCredentialStatus {
  const schema = getProviderCredentialSchema(providerKey);
  if (!schema) throw new Error(`Unknown provider credential schema: ${providerKey}`);
  const nonSecretConfig: ProviderCredentialValues = {};

  for (const field of schema.fields) {
    const value = values[field.key] ?? getDefaultFieldValue(field);
    if (field.envVar) writeEnvValue(field.envVar, value);
    else nonSecretConfig[field.key] = value;
  }

  if (typeof window !== "undefined") {
    localStorage.setItem(providerConfigKey(providerKey), JSON.stringify(nonSecretConfig));
    localStorage.setItem(providerSavedAtKey(providerKey), new Date().toISOString());
  }

  const status = getProviderCredentialStatus(providerKey);
  pushAuditEvent({
    domain: "integrations",
    action: "provider_credentials_saved",
    details: `${schema.title} credentials saved. Configured ${status.configuredVars.length}/${status.requiredEnvVars.length + status.optionalEnvVars.length} env fields.`,
    severity: status.configured ? "info" : "warning",
  });
  return status;
}

export function clearProviderCredentialValues(providerKey: string): ProviderCredentialStatus {
  const envVars = getProviderEnvVars(providerKey);
  if (typeof window !== "undefined") {
    for (const envVar of envVars) localStorage.removeItem(envStorageKey(envVar));
    localStorage.removeItem(providerConfigKey(providerKey));
    localStorage.removeItem(providerSavedAtKey(providerKey));
  }
  const schema = getProviderCredentialSchema(providerKey);
  pushAuditEvent({
    domain: "integrations",
    action: "provider_credentials_cleared",
    details: `${schema?.title ?? providerKey} credentials cleared.`,
    severity: "warning",
  });
  return getProviderCredentialStatus(providerKey);
}

export function getProviderCredentialStatus(providerKey: string): ProviderCredentialStatus {
  const schema = getProviderCredentialSchema(providerKey);
  if (!schema) return { providerKey, configured: false, requiredEnvVars: [], optionalEnvVars: [], configuredVars: [], missingRequiredVars: [], missingOptionalVars: [], savedAt: null };
  const requiredEnvVars = getRequiredProviderEnvVars(providerKey);
  const optionalEnvVars = schema.optionalEnvVars ?? [];
  const configuredVars = [...requiredEnvVars, ...optionalEnvVars].filter((envVar) => readEnvValue(envVar).trim().length > 0);
  const missingRequiredVars = requiredEnvVars.filter((envVar) => !configuredVars.includes(envVar));
  const missingOptionalVars = optionalEnvVars.filter((envVar) => !configuredVars.includes(envVar));
  const savedAt = typeof window === "undefined" ? null : localStorage.getItem(providerSavedAtKey(providerKey));
  return { providerKey, configured: missingRequiredVars.length === 0, requiredEnvVars, optionalEnvVars, configuredVars, missingRequiredVars, missingOptionalVars, savedAt };
}

export function getProviderCredentialTemplateFromSchema(schema: ProviderCredentialSchema): string {
  return [...schema.requiredEnvVars, ...(schema.optionalEnvVars ?? [])]
    .map((envVar) => `${envVar}=your_value_here`)
    .join("\n");
}

// ──── Server sync — pushes credentials to admin_settings_secrets table ────
// The chart-ingest-api edge function reads from Deno.env first, then falls
// back to admin_settings_secrets. This bridges the admin UI → edge function gap.

export type ServerSyncResult = {
  ok: boolean;
  message: string;
  savedKeys: string[];
  errors?: string[];
};

export async function syncProviderCredentialsToServer(
  providerKey: string,
  values: ProviderCredentialValues,
): Promise<ServerSyncResult> {
  const schema = getProviderCredentialSchema(providerKey);
  if (!schema) return { ok: false, message: `Unknown provider: ${providerKey}`, savedKeys: [] };

  const credentials: Record<string, string> = {};
  for (const field of schema.fields) {
    if (!field.envVar) continue;

    const val = values[field.key] ?? getDefaultFieldValue(field);
    const strVal = typeof val === "boolean" || typeof val === "number" ? String(val) : val;
    const trimmed = String(strVal ?? "").trim();

    if (!trimmed) continue;

    // secretFile values are server-side upload markers such as "__server_stored__".
    // They are not the secret itself, and must never be pushed through the generic
    // credentials sync because that overwrites admin_settings_secrets with the marker.
    if (field.type === "secretFile") continue;
    if (isServerStoredSecretMarker(trimmed)) continue;

    credentials[field.envVar] = trimmed;
  }

  if (Object.keys(credentials).length === 0) {
    return { ok: false, message: "No credential values to sync.", savedKeys: [] };
  }

  try {
    const { supabase } = await import("@/lib/supabase");
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return { ok: false, message: "Not authenticated. Please log in again.", savedKeys: [] };

    const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
    const res = await fetch(`${supabaseUrl}/functions/v1/admin-router/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "save", provider: providerKey, credentials }),
    });

    const result = await res.json() as ServerSyncResult;
    if (!res.ok || !result.ok) {
      return { ok: false, message: result.message || `Server sync failed (${res.status})`, savedKeys: result.savedKeys || [], errors: result.errors };
    }
    return result;
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Network error during server sync", savedKeys: [] };
  }
}

export async function clearProviderCredentialsFromServer(providerKey: string): Promise<ServerSyncResult> {
  const envVars = getProviderEnvVars(providerKey);
  if (envVars.length === 0) return { ok: false, message: `No env vars for provider: ${providerKey}`, savedKeys: [] };

  try {
    const { supabase } = await import("@/lib/supabase");
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return { ok: false, message: "Not authenticated. Please log in again.", savedKeys: [] };

    const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
    const res = await fetch(`${supabaseUrl}/functions/v1/admin-router/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "clear", provider: providerKey, envVars }),
    });

    const result = await res.json() as ServerSyncResult;
    return result;
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Network error during server clear", savedKeys: [] };
  }
}
