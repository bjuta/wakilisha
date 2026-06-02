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
  legacyModeAlias?: "mock" | null;
};

const DEFAULT_RUNTIME_API_BASE = "/api/wakilisha";
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
  if (clean === "api" || clean === "backend") return "api";
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

function resolveLegacyModeAlias(): "mock" | null {
  const oldMode = readEnv("VITE_CHARTS_INGESTION_MODE")?.trim().toLowerCase();
  return oldMode === "mock" ? "mock" : null;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function resolveApiBaseUrl(runtimeMode: WakilishaRuntimeMode): string {
  const explicit = readEnv("VITE_WAKILISHA_API_BASE") || readEnv("VITE_WAKILISHA_BACKEND_API_BASE");
  if (explicit) return stripTrailingSlash(explicit);
  return runtimeMode === "local" ? DEFAULT_LOCAL_API_BASE : DEFAULT_RUNTIME_API_BASE;
}

function resolveV2ApiBaseUrl(apiBaseUrl: string): string {
  const explicit = readEnv("VITE_WAKILISHA_V2_API_BASE");
  return explicit ? stripTrailingSlash(explicit) : apiBaseUrl;
}

export function resolveBackendConfig(): BackendConfig {
  const legacyModeAlias = resolveLegacyModeAlias();
  const runtimeMode = normalizeRuntimeMode(readEnv("VITE_WAKILISHA_RUNTIME_MODE")) ?? "local";
  const rawProvider = normalizeBackendProvider(readEnv("VITE_WAKILISHA_BACKEND_PROVIDER"));
  const backendProvider = runtimeMode === "backend" && rawProvider === "unknown" ? "api" : rawProvider;
  const repositoryMode = normalizeRepositoryMode(readEnv("VITE_WAKILISHA_REPOSITORY_MODE"), runtimeMode);
  const apiBaseUrl = resolveApiBaseUrl(runtimeMode);
  const v2ApiBaseUrl = resolveV2ApiBaseUrl(apiBaseUrl);

  return {
    runtimeMode,
    backendProvider,
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
  const provider = config.backendProvider === "unknown" ? "API" : config.backendProvider;
  return `${provider[0]?.toUpperCase() ?? "A"}${provider.slice(1)} backend mode`;
}

export function getBackendModeWarnings(config: BackendConfig = backendConfig): string[] {
  const warnings: string[] = [];

  if (config.runtimeMode === "local") {
    warnings.push("Local mode stores data in this browser only.");
    warnings.push("Local commits are not public WAKILISHA publications.");
  }

  if (config.legacyModeAlias) {
    warnings.push("VITE_CHARTS_INGESTION_MODE=mock is a legacy alias. Use VITE_WAKILISHA_RUNTIME_MODE=local instead.");
  }

  const oldMode = readEnv("VITE_CHARTS_INGESTION_MODE")?.trim().toLowerCase();
  if (oldMode === "wordpress") {
    warnings.push("VITE_CHARTS_INGESTION_MODE=wordpress is ignored. WordPress is no longer a runtime backend.");
  }

  const rawProvider = readEnv("VITE_WAKILISHA_BACKEND_PROVIDER")?.trim().toLowerCase();
  if (rawProvider === "wordpress" || rawProvider === "wp") {
    warnings.push("VITE_WAKILISHA_BACKEND_PROVIDER=wordpress is ignored. Use api, node, or supabase.");
  }

  if (config.runtimeMode === "backend" && config.repositoryMode === "localStorage") {
    warnings.push("Backend runtime is using localStorage repository mode; this is not production persistence.");
  }

  return warnings;
}

export function getDefaultApiBaseForProvider(_provider: WakilishaBackendProvider): string {
  return DEFAULT_RUNTIME_API_BASE;
}

export { DEFAULT_RUNTIME_API_BASE, DEFAULT_LOCAL_API_BASE };
