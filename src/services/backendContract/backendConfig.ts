import type {
  WakilishaBackendProvider,
  WakilishaRepositoryMode,
  WakilishaRuntimeMode,
} from "./backendTypes";

export type BackendConfig = {
  runtimeMode: WakilishaRuntimeMode;
  backendProvider: WakilishaBackendProvider;
  apiBaseUrl: string;
  v2ApiBaseUrl: string;
  repositoryMode: WakilishaRepositoryMode;
  allowLocalFallback: boolean;
  legacyModeAlias?: "mock" | "wordpress" | null;
};

const DEFAULT_WORDPRESS_V2_BASE = "/wp-json/wakilisha/v2";
const DEFAULT_WORDPRESS_V1_BASE = "/wp-json/wakilisha/v1";
const DEFAULT_LOCAL_API_BASE = "/__wakilisha-local-api";

function readEnv(key: string): string | undefined {
  return (import.meta.env[key] as string | undefined) || undefined;
}

function normalizeBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const clean = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(clean)) return true;
  if (["0", "false", "no", "off"].includes(clean)) return false;
  return fallback;
}

function normalizeRuntimeMode(value: string | undefined): WakilishaRuntimeMode | null {
  if (!value) return null;
  const clean = value.trim().toLowerCase();
  if (clean === "local" || clean === "demo" || clean === "local-demo") return "local";
  if (clean === "backend" || clean === "api" || clean === "production") return "backend";
  return null;
}

function normalizeBackendProvider(value: string | undefined): WakilishaBackendProvider {
  if (!value) return "unknown";
  const clean = value.trim().toLowerCase();
  if (clean === "wordpress" || clean === "wp") return "wordpress";
  if (clean === "node") return "node";
  if (clean === "supabase") return "supabase";
  return "unknown";
}

function normalizeRepositoryMode(value: string | undefined, runtimeMode: WakilishaRuntimeMode): WakilishaRepositoryMode {
  if (!value) return runtimeMode === "local" ? "localStorage" : "api";
  const clean = value.trim().toLowerCase();
  if (clean === "localstorage" || clean === "local_storage" || clean === "browser") return "localStorage";
  if (clean === "api") return "api";
  if (clean === "database" || clean === "db") return "database";
  return "unknown";
}

function resolveLegacyModeAlias(): "mock" | "wordpress" | null {
  const oldMode = readEnv("VITE_CHARTS_INGESTION_MODE")?.trim().toLowerCase();
  if (oldMode === "mock") return "mock";
  if (oldMode === "wordpress") return "wordpress";
  return null;
}

function inferRuntimeFromLegacy(alias: "mock" | "wordpress" | null): WakilishaRuntimeMode {
  if (alias === "wordpress") return "backend";
  return "local";
}

function inferProviderFromLegacy(alias: "mock" | "wordpress" | null): WakilishaBackendProvider {
  if (alias === "wordpress") return "wordpress";
  return "unknown";
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function resolveApiBaseUrl(runtimeMode: WakilishaRuntimeMode, backendProvider: WakilishaBackendProvider): string {
  const explicit = readEnv("VITE_WAKILISHA_API_BASE") || readEnv("VITE_WAKILISHA_BACKEND_API_BASE");
  if (explicit) return stripTrailingSlash(explicit);

  const legacyWpBase = readEnv("VITE_WAKILISHA_WP_API_BASE");
  if (legacyWpBase) return stripTrailingSlash(legacyWpBase);

  if (runtimeMode === "local") return DEFAULT_LOCAL_API_BASE;
  if (backendProvider === "wordpress") return DEFAULT_WORDPRESS_V2_BASE;
  return DEFAULT_WORDPRESS_V2_BASE;
}

function resolveV2ApiBaseUrl(apiBaseUrl: string, backendProvider: WakilishaBackendProvider): string {
  const explicit = readEnv("VITE_WAKILISHA_V2_API_BASE");
  if (explicit) return stripTrailingSlash(explicit);

  if (backendProvider === "wordpress") {
    if (apiBaseUrl.endsWith("/v1")) return apiBaseUrl.replace(/\/v1$/, "/v2");
    if (apiBaseUrl.includes("/wp-json/wakilisha/v1")) {
      return apiBaseUrl.replace("/wp-json/wakilisha/v1", "/wp-json/wakilisha/v2");
    }
  }

  return apiBaseUrl || DEFAULT_WORDPRESS_V2_BASE;
}

export function resolveBackendConfig(): BackendConfig {
  const legacyModeAlias = resolveLegacyModeAlias();
  const runtimeMode =
    normalizeRuntimeMode(readEnv("VITE_WAKILISHA_RUNTIME_MODE")) ?? inferRuntimeFromLegacy(legacyModeAlias);

  const backendProvider =
    normalizeBackendProvider(readEnv("VITE_WAKILISHA_BACKEND_PROVIDER")) || inferProviderFromLegacy(legacyModeAlias);

  const resolvedProvider = backendProvider === "unknown" ? inferProviderFromLegacy(legacyModeAlias) : backendProvider;
  const repositoryMode = normalizeRepositoryMode(readEnv("VITE_WAKILISHA_REPOSITORY_MODE"), runtimeMode);
  const apiBaseUrl = resolveApiBaseUrl(runtimeMode, resolvedProvider);
  const v2ApiBaseUrl = resolveV2ApiBaseUrl(apiBaseUrl, resolvedProvider);

  return {
    runtimeMode,
    backendProvider: resolvedProvider,
    apiBaseUrl,
    v2ApiBaseUrl,
    repositoryMode,
    allowLocalFallback: normalizeBoolean(readEnv("VITE_WAKILISHA_ALLOW_LOCAL_FALLBACK"), runtimeMode === "local"),
    legacyModeAlias,
  };
}

export const backendConfig: BackendConfig = resolveBackendConfig();

export function isLocalRuntime(config: BackendConfig = backendConfig): boolean {
  return config.runtimeMode === "local";
}

export function isBackendRuntime(config: BackendConfig = backendConfig): boolean {
  return config.runtimeMode === "backend";
}

export function getBackendModeLabel(config: BackendConfig = backendConfig): string {
  if (config.runtimeMode === "local") return "Local demo mode";
  const provider = config.backendProvider === "unknown" ? "backend" : config.backendProvider;
  return `${provider[0]?.toUpperCase() ?? "B"}${provider.slice(1)} backend mode`;
}

export function getBackendModeWarnings(config: BackendConfig = backendConfig): string[] {
  const warnings: string[] = [];

  if (config.runtimeMode === "local") {
    warnings.push("Local mode stores data in this browser only.");
    warnings.push("Local commits are not public WAKILISHA publications.");
  }

  if (config.legacyModeAlias) {
    warnings.push(
      `VITE_CHARTS_INGESTION_MODE=${config.legacyModeAlias} is a legacy alias. Use VITE_WAKILISHA_RUNTIME_MODE and VITE_WAKILISHA_BACKEND_PROVIDER instead.`
    );
  }

  if (config.runtimeMode === "backend" && config.backendProvider === "unknown") {
    warnings.push("Backend runtime is enabled but VITE_WAKILISHA_BACKEND_PROVIDER is not set.");
  }

  if (config.runtimeMode === "backend" && config.repositoryMode === "localStorage") {
    warnings.push("Backend runtime is using localStorage repository mode; this is not production persistence.");
  }

  return warnings;
}

export function getDefaultApiBaseForProvider(provider: WakilishaBackendProvider): string {
  if (provider === "wordpress") return DEFAULT_WORDPRESS_V2_BASE;
  if (provider === "node" || provider === "supabase") return DEFAULT_LOCAL_API_BASE;
  return DEFAULT_WORDPRESS_V2_BASE;
}

export { DEFAULT_WORDPRESS_V2_BASE, DEFAULT_WORDPRESS_V1_BASE, DEFAULT_LOCAL_API_BASE };
