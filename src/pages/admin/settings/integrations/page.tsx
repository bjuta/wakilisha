import { useMemo, useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { getIntegrationSettings, saveDomainSettings } from "@/services/adminSettings/settingsStore";
import {
  testProviderConnection,
  testAllProviders,
  clearProviderCredentials,
  getProviderCredentialTemplate,
  getProviderEnvVarStatus,
  setApiMode,
  testAcrcloudHealth,
  type AcrcloudHealthResult,
} from "@/services/adminSettings/providerHealthService";
import { type IntegrationSettings, type ProviderTestResult } from "@/services/adminSettings/settingsTypes";
import {
  getDefaultFieldValue,
  getProviderCredentialSchema,
  validateProviderCredentialValues,
  type SettingsField,
  type SettingsFieldValue,
} from "@/services/adminSettings/providerCredentialSchema";
import {
  readProviderCredentialValues,
  saveProviderCredentialValues,
  type ProviderCredentialValues,
  syncProviderCredentialsToServer,
  clearProviderCredentialsFromServer,
  type ServerSyncResult,
} from "@/services/adminSettings/providerCredentialStore";

type ProviderFormState = Record<string, ProviderCredentialValues>;
type ProviderFormErrors = Record<string, Record<string, string>>;

type RuntimeMode = "backend" | "local";

function normalizeRuntimeMode(mode: IntegrationSettings["apiMode"] | RuntimeMode): RuntimeMode {
  return mode === "mock" ? "local" : mode === "wp" || mode === "v2" ? "backend" : mode;
}

function makeInitialFormState(settings: IntegrationSettings): ProviderFormState {
  const next: ProviderFormState = {};
  for (const provider of settings.providers) {
    next[provider.key] = readProviderCredentialValues(provider.key);
  }
  return next;
}

export default function AdminSettingsIntegrations() {
  const [settings, setSettings] = useState<IntegrationSettings>(getIntegrationSettings());
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, ProviderTestResult>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [showTemplate, setShowTemplate] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<ProviderFormState>(() => makeInitialFormState(getIntegrationSettings()));
  const [formErrors, setFormErrors] = useState<ProviderFormErrors>({});
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [syncResults, setSyncResults] = useState<Record<string, ServerSyncResult>>({});

  // ACRCloud detection test state
  const [acrTesting, setAcrTesting] = useState(false);
  const [acrHealthResult, setAcrHealthResult] = useState<AcrcloudHealthResult | null>(null);

  const providerSchemas = useMemo(
    () => new Map(settings.providers.map((provider) => [provider.key, getProviderCredentialSchema(provider.key)])),
    [settings.providers]
  );

  const runtimeMode = normalizeRuntimeMode(settings.apiMode);

  const refreshSettings = () => {
    const next = getIntegrationSettings();
    setSettings(next);
    setFormValues(makeInitialFormState(next));
  };

  const handleTest = async (key: string) => {
    setTesting((prev) => ({ ...prev, [key]: true }));
    const provider = settings.providers.find((item) => item.key === key);
    if (!provider) return;
    const result = await testProviderConnection(provider);
    setTestResults((prev) => ({ ...prev, [key]: result }));
    setTesting((prev) => ({ ...prev, [key]: false }));

    const updatedProviders = settings.providers.map((item) =>
      item.key === key
        ? { ...item, connected: result.ok, lastTested: new Date().toISOString(), health: result.ok ? "healthy" as const : "unhealthy" as const }
        : item
    );
    const next = { ...settings, providers: updatedProviders };
    setSettings(next);
    saveDomainSettings("integrations", next);
  };

  const handleTestAll = async () => {
    const results = await testAllProviders();
    setTestResults(results);
    refreshSettings();
  };

  const updateField = (providerKey: string, fieldKey: string, value: SettingsFieldValue) => {
    setFormValues((prev) => ({
      ...prev,
      [providerKey]: {
        ...(prev[providerKey] ?? {}),
        [fieldKey]: value,
      },
    }));
    setFormErrors((prev) => ({
      ...prev,
      [providerKey]: {
        ...(prev[providerKey] ?? {}),
        [fieldKey]: "",
      },
    }));
  };

  const handleSaveProvider = async (providerKey: string) => {
    const schema = providerSchemas.get(providerKey);
    if (!schema) return;
    const values = formValues[providerKey] ?? {};
    const errors = validateProviderCredentialValues(providerKey, values);
    setFormErrors((prev) => ({ ...prev, [providerKey]: errors }));
    if (Object.keys(errors).length > 0) return;

    // Save locally
    const status = saveProviderCredentialValues(providerKey, values);
    const updatedProviders = settings.providers.map((provider) =>
      provider.key === providerKey ? { ...provider, connected: status.configured, lastTested: null, health: "unknown" as const } : provider
    );
    const next = { ...settings, providers: updatedProviders };
    saveDomainSettings("integrations", next);
    setSettings(next);

    // Sync to server (so chart-ingest-api can read from admin_settings_secrets)
    setSyncing((prev) => ({ ...prev, [providerKey]: true }));
    const sr = await syncProviderCredentialsToServer(providerKey, values);
    setSyncResults((prev) => ({ ...prev, [providerKey]: sr }));
    setSyncing((prev) => ({ ...prev, [providerKey]: false }));

    setTestResults((prev) => ({
      ...prev,
      [providerKey]: {
        ok: status.configured,
        latencyMs: 0,
        message: sr.ok
          ? `${schema.title} saved locally and synced to server. The chart ingest pipeline will use these credentials on the next run.`
          : `${schema.title} saved locally but server sync failed: ${sr.message}. Credentials may not be available to the ingest pipeline.`,
      } as ProviderTestResult,
    }));
  };

  const handleAcrDetectionTest = async () => {
    setAcrTesting(true);
    setAcrHealthResult(null);
    const result = await testAcrcloudHealth();
    setAcrHealthResult(result);
    setAcrTesting(false);

    // Also update the provider health status
    if (result.ok) {
      const updatedProviders = settings.providers.map((p) =>
        p.key === "acrcloud"
          ? { ...p, connected: true, lastTested: new Date().toISOString(), health: "healthy" as const }
          : p
      );
      const next = { ...settings, providers: updatedProviders };
      saveDomainSettings("integrations", next);
      setSettings(next);
    }
  };

  const handleClearProvider = async (providerKey: string) => {
    clearProviderCredentials(providerKey);
    setSyncing((prev) => ({ ...prev, [providerKey]: true }));
    const sr = await clearProviderCredentialsFromServer(providerKey);
    setSyncResults((prev) => ({ ...prev, [providerKey]: sr }));
    setSyncing((prev) => ({ ...prev, [providerKey]: false }));
    refreshSettings();
  };

  const handleApiMode = async (mode: RuntimeMode) => {
    await setApiMode(mode);
    setSettings((current) => ({ ...current, apiMode: mode as IntegrationSettings["apiMode"] }));
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <WkIcon name="Plug" size={20} className="text-[var(--wk-brand)]" />
          <h1 className="text-[20px] font-black tracking-tight text-[var(--wk-text)]">Integrations</h1>
        </div>
        <p className="text-[13px] text-[var(--wk-text-muted)]">
          Platform-level provider credentials. Each provider exposes the exact fields its function requires; WordPress is import-only, not a runtime API mode.
        </p>
      </div>

      <WkSurface className="p-5">
        <h2 className="mb-3 text-[14px] font-bold text-[var(--wk-text)]">Runtime API Mode</h2>
        <div className="mb-3 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3 text-[12px] text-[var(--wk-text-muted)]">
          Use <strong className="text-[var(--wk-text)]">Backend</strong> for production database/API publishing. Use <strong className="text-[var(--wk-text)]">Local preview</strong> only for UI testing; local commits are not public publications.
        </div>
        <div className="flex flex-wrap gap-2">
          {(["backend", "local"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => handleApiMode(mode)}
              className={`rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors ${
                runtimeMode === mode
                  ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                  : "border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]"
              }`}
            >
              {mode === "backend" ? "Backend API" : "Local Preview"}
            </button>
          ))}
        </div>
      </WkSurface>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Provider Credentials</h2>
          <button onClick={handleTestAll} className="wk-button wk-button-primary wk-button-sm flex items-center gap-2">
            <WkIcon name="Activity" size={14} />
            Test All Connections
          </button>
        </div>

        {settings.providers.map((provider) => {
          const schema = providerSchemas.get(provider.key);
          const envStatus = getProviderEnvVarStatus(provider.key);
          const result = testResults[provider.key];
          const values = formValues[provider.key] ?? {};
          const errors = formErrors[provider.key] ?? {};

          if (!schema) return null;

          return (
            <WkSurface key={provider.key} className="p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${provider.connected ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]" : "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]"}`}>
                    <WkIcon name="Plug" size={18} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-[var(--wk-text)]">{schema.title}</h3>
                    <p className="text-[12px] text-[var(--wk-text-muted)]">{schema.description}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  provider.health === "healthy" ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]" :
                  provider.health === "unhealthy" ? "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]" :
                  "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]"
                }`}>
                  {provider.health === "healthy" ? "Healthy" : provider.health === "unhealthy" ? "Unhealthy" : "Unknown"}
                </span>
              </div>

              <div className="mb-4 rounded-lg bg-[var(--wk-bg)] p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)]">Required configuration</div>
                <div className="grid gap-1 sm:grid-cols-2">
                  {schema.requiredEnvVars.map((env) => (
                    <div key={env} className="flex items-center gap-2 font-mono text-[12px] text-[var(--wk-text-soft)]">
                      <WkIcon name="Check" size={12} className={envStatus.missingVars.includes(env) ? "text-[var(--wk-text-faint)]" : "text-[var(--wk-success)]"} />
                      {env}
                      {!envStatus.missingVars.includes(env) && <span className="text-[var(--wk-success)]">present</span>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-4 grid gap-4 md:grid-cols-2">
                {schema.fields.map((field) => {
                  // Apple Music: hide developer token field - it's generated server-side
                  if (provider.key === "apple_music" && field.key === "developerToken") return null;
                  return (
                    <ProviderField
                      key={field.key}
                      providerKey={provider.key}
                      field={field}
                      value={values[field.key] ?? getDefaultFieldValue(field)}
                      error={errors[field.key]}
                      showSecret={!!showSecrets[`${provider.key}.${field.key}`]}
                      onToggleSecret={() => setShowSecrets((prev) => ({ ...prev, [`${provider.key}.${field.key}`]: !prev[`${provider.key}.${field.key}`] }))}
                      onChange={(value) => updateField(provider.key, field.key, value)}
                    />
                  );
                })}
              </div>

              {/* Apple Music credential status panel */}
              {provider.key === "apple_music" && (
                <div className="mb-4 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <WkIcon name="KeyRound" size={14} className="text-[var(--wk-text-muted)]" />
                    <span className="text-[12px] font-bold text-[var(--wk-text)]">Credential status</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3 text-[11px]">
                    {[
                      { label: "Team ID", present: !!values.teamId },
                      { label: "Key ID", present: !!values.keyId },
                      { label: ".p8 Private Key", present: !!values.privateKeyFile },
                    ].map((item) => (
                      <div key={item.label} className={`flex items-center gap-2 rounded-md px-2.5 py-2 ${item.present ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]" : "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]"}`}>
                        <WkIcon name={item.present ? "CheckCircle2" : "Circle"} size={12} />
                        {item.label}: {item.present ? "Uploaded" : "Missing"}
                      </div>
                    ))}
                  </div>
                  {!values.privateKeyFile && (
                    <p className="mt-2 text-[11px] text-[var(--wk-warning)]">
                      The .p8 private key must be stored server-side. Never paste it into localStorage or client code. The developer token is generated server-side from this key.
                    </p>
                  )}
                  {values.teamId && values.keyId && values.privateKeyFile && (
                    <p className="mt-2 text-[11px] text-[var(--wk-success)]">
                      All credentials provided. The developer token will be generated server-side when you test the connection.
                    </p>
                  )}
                </div>
              )}

              {result && (
                <div className={`mb-4 rounded-lg p-3 text-[12px] ${result.ok ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]" : "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]"}`}>
                  <div className="flex items-center gap-2 font-semibold">
                    <WkIcon name={result.ok ? "CheckCircle" : "XCircle"} size={14} />
                    {result.ok ? "Connection/status check complete" : "Connection failed"}
                    {result.ok && result.latencyMs > 0 && <span className="ml-auto text-[11px]">{result.latencyMs}ms</span>}
                  </div>
                  <div className="mt-1">{result.ok ? result.message : result.error}</div>
                  {!result.ok && result.envVar && <div className="mt-1 font-mono text-[11px]">Config: {result.envVar}</div>}
                </div>
              )}

              {syncResults[provider.key] && (
                <div className={`mb-4 rounded-lg p-3 text-[12px] ${syncResults[provider.key].ok ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]" : "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]"}`}>
                  <div className="flex items-center gap-2 font-semibold">
                    <WkIcon name={syncResults[provider.key].ok ? "Database" : "AlertTriangle"} size={14} />
                    Server sync
                  </div>
                  <div className="mt-1">{syncResults[provider.key].message}</div>
                </div>
              )}

              {/* ACRCloud Detection Test Panel */}
              {provider.key === "acrcloud" && (
                <div className="mb-4 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--wk-accent-100)] text-[var(--wk-accent-500)]">
                        <WkIcon name="Radio" size={16} />
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-[var(--wk-text)]">ACRCloud Detection Test</p>
                        <p className="text-[11px] text-[var(--wk-text-muted)]">Verifies ACR_HOST + ACR_ACCESS_KEY + ACR_ACCESS_SECRET against the live ACRCloud API with HMAC-SHA1 signing.</p>
                      </div>
                    </div>
                    <button
                      onClick={handleAcrDetectionTest}
                      disabled={acrTesting}
                      className="wk-button wk-button-primary wk-button-sm flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <WkIcon name={acrTesting ? "Loader" : "Activity"} size={14} className={acrTesting ? "animate-spin" : ""} />
                      {acrTesting ? "Testing..." : "Run Detection Test"}
                    </button>
                  </div>

                  {acrHealthResult && (
                    <div className={`rounded-lg p-3 text-[12px] ${
                      acrHealthResult.ok
                        ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]"
                        : "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]"
                    }`}>
                      <div className="flex items-center gap-2 font-semibold">
                        <WkIcon name={acrHealthResult.ok ? "CheckCircle" : "XCircle"} size={14} />
                        {acrHealthResult.ok ? "ACRCloud API verified" : "ACRCloud detection failed"}
                        {acrHealthResult.latencyMs > 0 && (
                          <span className="ml-auto text-[11px]">{acrHealthResult.latencyMs}ms</span>
                        )}
                      </div>
                      <div className="mt-1">{acrHealthResult.message}</div>
                      {acrHealthResult.details?.host && (
                        <div className="mt-1 text-[11px] opacity-75">
                          Host: {acrHealthResult.details.host}
                          {acrHealthResult.details.status !== undefined && (
                            <span> &middot; Status: {acrHealthResult.details.status}</span>
                          )}
                        </div>
                      )}
                      {acrHealthResult.missingVars && acrHealthResult.missingVars.length > 0 && (
                        <div className="mt-1 text-[11px] font-semibold">
                          Missing: {acrHealthResult.missingVars.join(", ")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button onClick={() => handleTest(provider.key)} disabled={testing[provider.key]} className="wk-button wk-button-primary wk-button-sm flex items-center gap-1.5">
                  <WkIcon name={testing[provider.key] ? "Loader" : "Activity"} size={14} />
                  {testing[provider.key] ? "Testing..." : "Test Connection"}
                </button>
                <button onClick={() => handleSaveProvider(provider.key)} disabled={syncing[provider.key]} className="wk-button wk-button-primary wk-button-sm flex items-center gap-1.5">
                  <WkIcon name={syncing[provider.key] ? "Loader" : "Save"} size={14} className={syncing[provider.key] ? "animate-spin" : ""} />
                  {syncing[provider.key] ? "Syncing..." : `Save ${schema.title}`}
                </button>
                <button onClick={() => handleClearProvider(provider.key)} className="wk-button wk-button-ghost wk-button-sm">Clear</button>
                <button onClick={() => setShowTemplate(showTemplate === provider.key ? null : provider.key)} className="wk-button wk-button-ghost wk-button-sm flex items-center gap-1.5">
                  <WkIcon name="Copy" size={14} />
                  Copy Env Template
                </button>
                {provider.lastTested && <span className="ml-auto text-[11px] text-[var(--wk-text-faint)]">Last tested: {new Date(provider.lastTested).toLocaleString()}</span>}
              </div>

              {showTemplate === provider.key && (
                <div className="mt-3 rounded-lg bg-[var(--wk-bg)] p-3 font-mono text-[11px] text-[var(--wk-text-soft)]">
                  <pre className="whitespace-pre-wrap">{getProviderCredentialTemplate(provider)}</pre>
                </div>
              )}
            </WkSurface>
          );
        })}
      </div>
    </div>
  );
}

function ProviderField({ providerKey, field, value, error, showSecret, onToggleSecret, onChange }: {
  providerKey: string;
  field: SettingsField;
  value: SettingsFieldValue;
  error?: string;
  showSecret: boolean;
  onToggleSecret: () => void;
  onChange: (value: SettingsFieldValue) => void;
}) {
  const id = `${providerKey}-${field.key}`;
  const isSecret = field.type === "secret" || field.type === "secretTextarea";
  const isSecretFile = field.type === "secretFile";
  const wrapperClass = field.type === "secretTextarea" || field.type === "secretFile" ? "md:col-span-2" : "";

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(
    typeof value === "string" && value.startsWith("uploaded:") ? value.replace("uploaded:", "") : null
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file extension
    if (!file.name.endsWith(".p8") && !file.name.endsWith(".key")) {
      setUploadError("Only .p8 or .key files are accepted.");
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const { data: { session } } = await (await import("@/lib/supabase")).supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated.");

      const formData = new FormData();
      formData.append("p8_file", file);

      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/upload-apple-music-key`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const result = await res.json();
      if (!result.ok) throw new Error(result.error || "Upload failed.");

      setUploadedFileName(file.name);
      onChange(`uploaded:${file.name}`);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleClearFile = () => {
    setUploadedFileName(null);
    setUploadError(null);
    onChange("");
  };

  if (isSecretFile) {
    return (
      <div className={wrapperClass}>
        <label htmlFor={id} className="mb-1.5 block text-[12px] font-semibold text-[var(--wk-text-muted)]">
          {field.label}{field.required ? " *" : ""}
        </label>

        {uploadedFileName ? (
          <div className="flex items-center gap-3 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--wk-success-soft)] text-[var(--wk-success)]">
              <WkIcon name="CheckCircle2" size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[var(--wk-text)] truncate">{uploadedFileName}</p>
              <p className="text-[11px] text-[var(--wk-success)]">Uploaded and stored securely in server-side secrets.</p>
            </div>
            <button
              type="button"
              onClick={handleClearFile}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--wk-border)] text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-danger)]"
              title="Remove uploaded key"
            >
              <WkIcon name="Trash2" size={13} />
            </button>
          </div>
        ) : (
          <div>
            <label
              htmlFor={id}
              className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-[var(--wk-border)] bg-[var(--wk-bg)] px-6 py-6 hover:border-[var(--wk-brand)] hover:bg-[var(--wk-brand)]/5 transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]">
                <WkIcon name={uploading ? "Loader2" : "Upload"} size={18} className={uploading ? "animate-spin" : ""} />
              </div>
              <div className="text-center">
                <p className="text-[13px] font-semibold text-[var(--wk-text)]">
                  {uploading ? "Uploading..." : "Click to upload .p8 file"}
                </p>
                <p className="mt-1 text-[11px] text-[var(--wk-text-faint)]">
                  Select your Apple Music .p8 private key file. It is sent directly to a secure backend and never stored in the browser.
                </p>
              </div>
              <input
                id={id}
                type="file"
                accept=".p8,.key"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
        )}

        {uploadError && <p className="mt-1 text-[11px] font-semibold text-[var(--wk-danger)]">{uploadError}</p>}
        {field.helpText && <p className="mt-1 text-[11px] text-[var(--wk-text-faint)]">{field.helpText}</p>}
        {error && <p className="mt-1 text-[11px] font-semibold text-[var(--wk-danger)]">{error}</p>}
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-semibold text-[var(--wk-text-muted)]">
        {field.label}{field.required ? " *" : ""}
      </label>
      {field.type === "toggle" ? (
        <button type="button" onClick={() => onChange(!(value === true))} className="flex w-full items-center justify-between rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5 text-left">
          <span className="text-[13px] font-semibold text-[var(--wk-text)]">{value === true ? "Enabled" : "Disabled"}</span>
          <span className={`relative h-6 w-11 rounded-full transition-colors ${value === true ? "bg-[var(--wk-brand)]" : "bg-[var(--wk-border-2)]"}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--wk-surface)] transition-transform ${value === true ? "translate-x-[22px]" : "translate-x-0.5"}`} />
          </span>
        </button>
      ) : field.type === "select" ? (
        <select id={id} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]">
          {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : field.type === "secretTextarea" ? (
        <div className="relative">
          <textarea id={id} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} rows={5} placeholder={field.placeholder} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 pr-12 font-mono text-[12px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]" style={{ WebkitTextSecurity: showSecret ? "none" : "disc" }} />
          <button type="button" onClick={onToggleSecret} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--wk-border)] text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]" title="Toggle visibility">
            <WkIcon name={showSecret ? "EyeOff" : "Eye"} size={14} />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input id={id} type={isSecret && !showSecret ? "password" : field.type === "number" ? "number" : field.type === "url" ? "url" : "text"} value={String(value ?? "")} min={field.validation?.min} max={field.validation?.max} onChange={(event) => onChange(field.type === "number" ? Number(event.target.value) : event.target.value)} placeholder={field.placeholder} className="min-w-0 flex-1 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]" />
          {isSecret && (
            <button type="button" onClick={onToggleSecret} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--wk-border)] text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]" title="Toggle visibility">
              <WkIcon name={showSecret ? "EyeOff" : "Eye"} size={14} />
            </button>
          )}
        </div>
      )}
      {field.helpText && <p className="mt-1 text-[11px] text-[var(--wk-text-faint)]">{field.helpText}</p>}
      {error && <p className="mt-1 text-[11px] font-semibold text-[var(--wk-danger)]">{error}</p>}
    </div>
  );
}
