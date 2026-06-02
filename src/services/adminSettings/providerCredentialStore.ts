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
