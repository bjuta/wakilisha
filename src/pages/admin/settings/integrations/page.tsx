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
} from "@/services/adminSettings/providerHealthService";
import { type IntegrationSettings, type ProviderTestResult } from "@/services/adminSettings/settingsTypes";
import {
  getDefaultFieldValue,
  getProviderCredentialSchema,
  validateProviderCredentialValues,
  type SettingsField,
  type SettingsFieldValue,
} from "@/services/adminSettings/providerCredentialSchema";

type ProviderFormState = Record<string, Record<string, SettingsFieldValue>>;
type ProviderFormErrors = Record<string, Record<string, string>>;

function envStorageKey(envVar: string): string {
  return `env_${envVar}`;
}

function readEnv(envVar: string): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(envStorageKey(envVar)) ?? "";
}

function writeEnv(envVar: string, value: SettingsFieldValue): void {
  if (typeof window === "undefined") return;
  const normalized = typeof value === "boolean" || typeof value === "number" ? String(value) : value;
  if (!normalized.trim()) {
    localStorage.removeItem(envStorageKey(envVar));
    return;
  }
  localStorage.setItem(envStorageKey(envVar), normalized);
}

function makeInitialFormState(settings: IntegrationSettings): ProviderFormState {
  const next: ProviderFormState = {};
  for (const provider of settings.providers) {
    const schema = getProviderCredentialSchema(provider.key);
    if (!schema) continue;
    next[provider.key] = {};
    for (const field of schema.fields) {
      next[provider.key][field.key] = field.envVar ? readEnv(field.envVar) : getDefaultFieldValue(field);
    }
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

  const providerSchemas = useMemo(
    () => new Map(settings.providers.map((provider) => [provider.key, getProviderCredentialSchema(provider.key)])),
    [settings.providers]
  );

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

  const handleSaveProvider = (providerKey: string) => {
    const schema = providerSchemas.get(providerKey);
    if (!schema) return;
    const values = formValues[providerKey] ?? {};
    const errors = validateProviderCredentialValues(providerKey, values);
    setFormErrors((prev) => ({ ...prev, [providerKey]: errors }));
    if (Object.keys(errors).length > 0) return;

    for (const field of schema.fields) {
      if (!field.envVar) continue;
      writeEnv(field.envVar, values[field.key] ?? "");
      if (providerKey === "apple_music" && field.key === "developerToken") writeEnv("APPLE_MUSIC_KEY", values[field.key] ?? "");
    }

    const updatedProviders = settings.providers.map((provider) =>
      provider.key === providerKey ? { ...provider, connected: true, lastTested: null, health: "unknown" as const } : provider
    );
    const next = { ...settings, providers: updatedProviders };
    saveDomainSettings("integrations", next);
    setSettings(next);
    setTestResults((prev) => ({
      ...prev,
      [providerKey]: { ok: true, latencyMs: 0, message: `${schema.title} settings saved. Test the connection to verify server access.` },
    }));
  };

  const handleClearProvider = (providerKey: string) => {
    clearProviderCredentials(providerKey);
    const schema = providerSchemas.get(providerKey);
    if (schema) {
      for (const field of schema.fields) {
        if (field.envVar && typeof window !== "undefined") localStorage.removeItem(envStorageKey(field.envVar));
        if (providerKey === "apple_music" && field.key === "developerToken" && typeof window !== "undefined") localStorage.removeItem(envStorageKey("APPLE_MUSIC_KEY"));
      }
    }
    refreshSettings();
  };

  const handleApiMode = (mode: "wp" | "v2" | "mock") => {
    setApiMode(mode);
    setSettings((current) => ({ ...current, apiMode: mode }));
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <WkIcon name="Plug" size={20} className="text-[var(--wk-brand)]" />
          <h1 className="text-[20px] font-black tracking-tight text-[var(--wk-text)]">Integrations</h1>
        </div>
        <p className="text-[13px] text-[var(--wk-text-muted)]">
          Platform-level external integrations. Each provider now exposes the exact fields its function requires; secrets are masked after save.
        </p>
      </div>

      <WkSurface className="p-5">
        <h2 className="mb-3 text-[14px] font-bold text-[var(--wk-text)]">API Mode</h2>
        <div className="flex flex-wrap gap-2">
          {(["wp", "v2", "mock"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => handleApiMode(mode)}
              className={`rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors ${
                settings.apiMode === mode
                  ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                  : "border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]"
              }`}
            >
              {mode === "wp" ? "WordPress" : mode === "v2" ? "V2 API" : "Mock"}
            </button>
          ))}
        </div>
      </WkSurface>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Providers</h2>
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
                {schema.fields.map((field) => (
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
                ))}
              </div>

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

              <div className="flex flex-wrap gap-2">
                <button onClick={() => handleTest(provider.key)} disabled={testing[provider.key]} className="wk-button wk-button-primary wk-button-sm flex items-center gap-1.5">
                  <WkIcon name={testing[provider.key] ? "Loader" : "Activity"} size={14} />
                  {testing[provider.key] ? "Testing..." : "Test Connection"}
                </button>
                <button onClick={() => handleSaveProvider(provider.key)} className="wk-button wk-button-primary wk-button-sm flex items-center gap-1.5">
                  <WkIcon name="Save" size={14} />
                  Save {schema.title}
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
  const wrapperClass = field.type === "secretTextarea" ? "md:col-span-2" : "";

  return (
    <div className={wrapperClass}>
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-semibold text-[var(--wk-text-muted)]">
        {field.label}{field.required ? " *" : ""}
      </label>
      {field.type === "toggle" ? (
        <button type="button" onClick={() => onChange(!(value === true))} className="flex w-full items-center justify-between rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5 text-left">
          <span className="text-[13px] font-semibold text-[var(--wk-text)]">{value === true ? "Enabled" : "Disabled"}</span>
          <span className={`relative h-6 w-11 rounded-full transition-colors ${value === true ? "bg-[var(--wk-brand)]" : "bg-[var(--wk-border-2)]"}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--wk-surface)] transition-transform ${value === true ? "translate-x-5.5" : "translate-x-0.5"}`} />
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
