export type SettingsFieldType = "text" | "secret" | "secretTextarea" | "url" | "number" | "select" | "toggle";
export type SettingsFieldValue = string | boolean | number;

export type SettingsField = {
  key: string;
  label: string;
  type: SettingsFieldType;
  required?: boolean;
  secret?: boolean;
  envVar?: string;
  placeholder?: string;
  helpText?: string;
  defaultValue?: SettingsFieldValue;
  options?: Array<{ label: string; value: string }>;
  validation?: { min?: number; max?: number; pattern?: string };
};

export type ProviderCredentialSchema = {
  id: string;
  title: string;
  description: string;
  requiredEnvVars: string[];
  optionalEnvVars?: string[];
  fields: SettingsField[];
  envTemplate: string;
};

const MARKET_OPTIONS = ["KE", "UG", "TZ", "NG", "GH", "ZA"].map((value) => ({ label: value, value }));
const STOREFRONT_OPTIONS = ["ke", "ug", "tz", "ng", "gh", "za"].map((value) => ({ label: value, value }));

export const PROVIDER_CREDENTIAL_SCHEMAS: ProviderCredentialSchema[] = [
  {
    id: "spotify",
    title: "Spotify",
    description: "Web API for chart rows, track metadata, previews, artwork, and market scoping.",
    requiredEnvVars: ["SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET"],
    optionalEnvVars: ["SPOTIFY_MARKET"],
    fields: [
      { key: "clientId", label: "Spotify Client ID", type: "text", required: true, envVar: "SPOTIFY_CLIENT_ID" },
      { key: "clientSecret", label: "Spotify Client Secret", type: "secret", required: true, secret: true, envVar: "SPOTIFY_CLIENT_SECRET" },
      { key: "defaultMarket", label: "Default Spotify Market", type: "select", required: true, envVar: "SPOTIFY_MARKET", defaultValue: "KE", options: MARKET_OPTIONS },
      { key: "enableFetch", label: "Enable Spotify Fetch", type: "toggle", defaultValue: true },
      { key: "enableEnrichment", label: "Enable Spotify Enrichment", type: "toggle", defaultValue: true },
    ],
    envTemplate: ["SPOTIFY_CLIENT_ID=", "SPOTIFY_CLIENT_SECRET=", "SPOTIFY_MARKET=KE"].join("\n"),
  },
  {
    id: "apple_music",
    title: "Apple Music",
    description: "Catalog metadata, chart rows, artwork, storefront lookup, and MusicKit preview tokens. The developer token is generated server-side from your .p8 private key — never paste it here.",
    requiredEnvVars: ["APPLE_MUSIC_TEAM_ID", "APPLE_MUSIC_KEY_ID", "APPLE_MUSIC_PRIVATE_KEY"],
    optionalEnvVars: ["APPLE_MUSIC_SERVICE_ID", "APPLE_MUSIC_STOREFRONT", "APPLE_MUSIC_TOKEN_TTL"],
    fields: [
      { key: "teamId", label: "Apple Team ID", type: "text", required: true, envVar: "APPLE_MUSIC_TEAM_ID", helpText: "Your Apple Developer Team ID (10-character alphanumeric)." },
      { key: "keyId", label: "Apple Key ID", type: "text", required: true, envVar: "APPLE_MUSIC_KEY_ID", helpText: "The Key ID from your Apple Music Key in the Developer Portal." },
      { key: "privateKeyFile", label: "Apple .p8 Private Key", type: "secretTextarea", required: true, secret: true, envVar: "APPLE_MUSIC_PRIVATE_KEY", helpText: "Paste the full contents of your .p8 file. This key is stored server-side and never exposed to the browser in production." },
      { key: "serviceId", label: "Apple Service ID", type: "text", envVar: "APPLE_MUSIC_SERVICE_ID" },
      { key: "defaultStorefront", label: "Default Apple Storefront", type: "select", required: true, envVar: "APPLE_MUSIC_STOREFRONT", defaultValue: "ke", options: STOREFRONT_OPTIONS },
      { key: "tokenTtl", label: "Token TTL (hours)", type: "number", envVar: "APPLE_MUSIC_TOKEN_TTL", defaultValue: 24, validation: { min: 1, max: 168 }, helpText: "How long the server-generated developer token is valid (max 6 months). Default: 24 hours." },
      { key: "enableFetch", label: "Enable Apple Music Fetch", type: "toggle", defaultValue: true },
      { key: "enableEnrichment", label: "Enable Apple Music Enrichment", type: "toggle", defaultValue: true },
      { key: "enableJwtPreviews", label: "Enable MusicKit Preview Tokens", type: "toggle", defaultValue: true },
    ],
    envTemplate: ["APPLE_MUSIC_TEAM_ID=", "APPLE_MUSIC_KEY_ID=", "# Paste full .p8 file content in APPLE_MUSIC_PRIVATE_KEY (server-side only)", "APPLE_MUSIC_PRIVATE_KEY=", "APPLE_MUSIC_SERVICE_ID=", "APPLE_MUSIC_STOREFRONT=ke", "APPLE_MUSIC_TOKEN_TTL=24"].join("\n"),
  },
  {
    id: "acrcloud",
    title: "ACRCloud",
    description: "Audio fingerprinting, recognition callbacks, metadata checks, and preview recovery.",
    requiredEnvVars: ["ACR_HOST", "ACR_ACCESS_KEY", "ACR_ACCESS_SECRET"],
    optionalEnvVars: ["ACR_CALLBACK_SECRET"],
    fields: [
      { key: "host", label: "ACRCloud Host / API Base URL", type: "url", required: true, envVar: "ACR_HOST" },
      { key: "accessKey", label: "ACRCloud Access Key", type: "text", required: true, envVar: "ACR_ACCESS_KEY" },
      { key: "accessSecret", label: "ACRCloud Access Secret", type: "secret", required: true, secret: true, envVar: "ACR_ACCESS_SECRET" },
      { key: "callbackSecret", label: "Callback Secret", type: "secret", secret: true, envVar: "ACR_CALLBACK_SECRET" },
      { key: "enableRecognition", label: "Enable ACRCloud Recognition", type: "toggle", defaultValue: false },
      { key: "enablePreviewRecovery", label: "Enable Preview Recovery", type: "toggle", defaultValue: true },
    ],
    envTemplate: ["ACR_HOST=", "ACR_ACCESS_KEY=", "ACR_ACCESS_SECRET=", "ACR_CALLBACK_SECRET="].join("\n"),
  },
  {
    id: "youtube",
    title: "YouTube",
    description: "oEmbed previews, fallback search, video IDs, and watch page metadata.",
    requiredEnvVars: [],
    optionalEnvVars: ["YOUTUBE_API_KEY"],
    fields: [
      { key: "enableOembed", label: "Enable YouTube oEmbed", type: "toggle", defaultValue: true, helpText: "oEmbed can work without an API key." },
      { key: "enableFallbackSearch", label: "Enable YouTube Fallback Search", type: "toggle", defaultValue: false, helpText: "Requires a YouTube API key." },
      { key: "apiKey", label: "YouTube API Key", type: "secret", secret: true, envVar: "YOUTUBE_API_KEY" },
      { key: "defaultEmbedBehavior", label: "Default Embed Behavior", type: "select", defaultValue: "oembed_first", options: [{ label: "Use oEmbed first", value: "oembed_first" }, { label: "Use API search first", value: "api_search_first" }, { label: "Only explicit links", value: "explicit_links_only" }] },
    ],
    envTemplate: "YOUTUBE_API_KEY=",
  },
  {
    id: "airplay",
    title: "Airplay",
    description: "Airplay detection, sync, evidence storage, and registry linking.",
    requiredEnvVars: ["AIRPLAY_API_BASE", "AIRPLAY_API_KEY"],
    fields: [
      { key: "enabled", label: "Enable Airplay Sync", type: "toggle", defaultValue: false },
      { key: "provider", label: "Airplay Provider", type: "select", required: true, defaultValue: "manual", options: [{ label: "Manual", value: "manual" }, { label: "ACRCloud", value: "acrcloud" }, { label: "Radio Monitor", value: "radio_monitor" }, { label: "Custom API", value: "custom_api" }] },
      { key: "apiBaseUrl", label: "Airplay API Base URL", type: "url", envVar: "AIRPLAY_API_BASE" },
      { key: "apiKey", label: "Airplay API Key / Token", type: "secret", secret: true, envVar: "AIRPLAY_API_KEY" },
      { key: "syncFrequency", label: "Sync Frequency", type: "select", defaultValue: "manual", options: [{ label: "Manual", value: "manual" }, { label: "Hourly", value: "hourly" }, { label: "Daily", value: "daily" }, { label: "Weekly", value: "weekly" }] },
      { key: "defaultMarket", label: "Default Market", type: "select", defaultValue: "kenya", options: [{ label: "Kenya", value: "kenya" }, { label: "Uganda", value: "uganda" }, { label: "Tanzania", value: "tanzania" }, { label: "Nigeria", value: "nigeria" }, { label: "Pan-Africa", value: "pan-africa" }] },
      { key: "evidenceStorageMode", label: "Evidence Storage Mode", type: "select", defaultValue: "local", options: [{ label: "Local", value: "local" }, { label: "Database", value: "db" }, { label: "S3", value: "s3" }] },
      { key: "autoLinkDetections", label: "Auto-link detections to registry", type: "toggle", defaultValue: true },
      { key: "minimumConfidence", label: "Minimum Confidence Threshold", type: "number", defaultValue: 0.7, validation: { min: 0, max: 1 } },
    ],
    envTemplate: ["AIRPLAY_API_BASE=", "AIRPLAY_API_KEY="].join("\n"),
  },
];

export function getProviderCredentialSchema(providerKey: string): ProviderCredentialSchema | undefined {
  return PROVIDER_CREDENTIAL_SCHEMAS.find((schema) => schema.id === providerKey);
}

export function getProviderEnvVars(providerKey: string): string[] {
  const schema = getProviderCredentialSchema(providerKey);
  if (!schema) return [];
  return [...schema.requiredEnvVars, ...(schema.optionalEnvVars ?? [])];
}

export function getRequiredProviderEnvVars(providerKey: string): string[] {
  return getProviderCredentialSchema(providerKey)?.requiredEnvVars ?? [];
}

export function getProviderEnvTemplate(providerKey: string): string {
  return getProviderCredentialSchema(providerKey)?.envTemplate ?? "";
}

export function getDefaultFieldValue(field: SettingsField): SettingsFieldValue {
  if (field.defaultValue !== undefined) return field.defaultValue;
  if (field.type === "toggle") return false;
  if (field.type === "number") return 0;
  return "";
}

export function validateProviderCredentialValues(providerKey: string, values: Record<string, SettingsFieldValue>): Record<string, string> {
  const schema = getProviderCredentialSchema(providerKey);
  const errors: Record<string, string> = {};
  if (!schema) return { provider: "Unknown provider schema." };
  for (const field of schema.fields) {
    const value = values[field.key] ?? getDefaultFieldValue(field);
    const stringValue = typeof value === "string" ? value.trim() : String(value);
    if (field.required && stringValue.length === 0) errors[field.key] = `${field.label} is required.`;
    if (field.type === "url" && stringValue.length > 0) {
      try { new URL(stringValue); } catch { errors[field.key] = `${field.label} must be a valid URL.`; }
    }
    if (field.type === "number") {
      const numberValue = Number(value);
      if (!Number.isFinite(numberValue)) errors[field.key] = `${field.label} must be a valid number.`;
      if (field.validation?.min !== undefined && numberValue < field.validation.min) errors[field.key] = `${field.label} must be at least ${field.validation.min}.`;
      if (field.validation?.max !== undefined && numberValue > field.validation.max) errors[field.key] = `${field.label} must be no more than ${field.validation.max}.`;
    }
  }
  if (providerKey === "youtube" && values.enableFallbackSearch === true && !String(values.apiKey ?? "").trim()) {
    errors.apiKey = "YouTube fallback search requires a YouTube API Key.";
  }
  if (providerKey === "airplay" && values.enabled === true) {
    if (!String(values.apiBaseUrl ?? "").trim()) errors.apiBaseUrl = "Airplay API Base URL is required when sync is enabled.";
    if (!String(values.apiKey ?? "").trim()) errors.apiKey = "Airplay API Key / Token is required when sync is enabled.";
  }
  return errors;
}
