import { useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  getIntegrationSettings,
  saveDomainSettings,
} from "@/services/adminSettings/settingsStore";
import {
  testProviderConnection,
  testAllProviders,
  saveProviderCredentials,
  clearProviderCredentials,
  getProviderCredentialTemplate,
  getProviderEnvVarStatus,
  setApiMode,
} from "@/services/adminSettings/providerHealthService";
import {
  DEFAULT_INTEGRATION_SETTINGS,
  type IntegrationSettings,
  type ProviderTestResult,
} from "@/services/adminSettings/settingsTypes";

export default function AdminSettingsIntegrations() {
  const [settings, setSettings] = useState<IntegrationSettings>(getIntegrationSettings());
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, ProviderTestResult>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [showTemplate, setShowTemplate] = useState<string | null>(null);
  const [savingDomain, setSavingDomain] = useState(false);

  const handleTest = async (key: string) => {
    setTesting((p) => ({ ...p, [key]: true }));
    const provider = settings.providers.find((p) => p.key === key);
    if (!provider) return;
    const result = await testProviderConnection(provider);
    setTestResults((p) => ({ ...p, [key]: result }));
    setTesting((p) => ({ ...p, [key]: false }));

    const updatedProviders = settings.providers.map((p) =>
      p.key === key
        ? { ...p, connected: result.ok, lastTested: new Date().toISOString(), health: result.ok ? "healthy" : "unhealthy" }
        : p
    );
    const next = { ...settings, providers: updatedProviders };
    setSettings(next);
    saveDomainSettings("integrations", next);
  };

  const handleTestAll = async () => {
    const results = await testAllProviders();
    setTestResults(results);
    setSettings(getIntegrationSettings());
  };

  const handleSaveCreds = (key: string) => {
    const value = creds[key] || "";
    const provider = settings.providers.find((p) => p.key === key);
    if (!provider) return;
    const envVars = provider.envVar.split(",").map((s) => s.trim());
    if (value.length > 0) {
      saveProviderCredentials(key, value, envVars[0]);
    }
    setCreds((p) => ({ ...p, [key]: "" }));
    setSettings(getIntegrationSettings());
  };

  const handleClearCreds = (key: string) => {
    clearProviderCredentials(key);
    setSettings(getIntegrationSettings());
  };

  const handleApiMode = (mode: "wp" | "v2" | "mock") => {
    setApiMode(mode);
    setSettings((s) => ({ ...s, apiMode: mode }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <WkIcon name="Plug" size={20} className="text-[var(--wk-brand)]" />
          <h1 className="text-[20px] font-black tracking-tight text-[var(--wk-text)]">Integrations</h1>
        </div>
        <p className="text-[13px] text-[var(--wk-text-muted)]">
          Platform-level external integrations. Provider credentials are masked and never fully exposed.
        </p>
      </div>

      {/* API Mode */}
      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-3">API Mode</h2>
        <div className="flex flex-wrap gap-2">
          {(["wp", "v2", "mock"] as const).map((m) => (
            <button
              key={m}
              onClick={() => handleApiMode(m)}
              className={`rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors ${
                settings.apiMode === m
                  ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                  : "border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]"
              }`}
            >
              {m === "wp" ? "WordPress" : m === "v2" ? "V2 API" : "Mock"}
            </button>
          ))}
        </div>
      </WkSurface>

      {/* Providers */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Providers</h2>
          <button
            onClick={handleTestAll}
            className="wk-button wk-button-primary wk-button-sm flex items-center gap-2"
          >
            <WkIcon name="Activity" size={14} />
            Test All Connections
          </button>
        </div>

        {settings.providers.map((provider) => {
          const envStatus = getProviderEnvVarStatus(provider.key);
          const result = testResults[provider.key];
          return (
            <WkSurface key={provider.key} className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    provider.connected ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]" : "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]"
                  }`}>
                    <WkIcon name="Plug" size={18} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-[var(--wk-text)]">{provider.name}</h3>
                    <p className="text-[12px] text-[var(--wk-text-muted)]">{provider.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    provider.health === "healthy" ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]" :
                    provider.health === "unhealthy" ? "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]" :
                    "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]"
                  }`}>
                    {provider.health === "healthy" ? "Healthy" : provider.health === "unhealthy" ? "Unhealthy" : "Unknown"}
                  </span>
                </div>
              </div>

              {/* Env vars */}
              <div className="mb-4 rounded-lg bg-[var(--wk-bg)] p-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] mb-2">Required Environment Variables</div>
                <div className="space-y-1">
                  {provider.envVar.split(",").map((env) => (
                    <div key={env} className="flex items-center gap-2 text-[12px] font-mono text-[var(--wk-text-soft)]">
                      <WkIcon name="Check" size={12} className={envStatus.present ? "text-[var(--wk-success)]" : "text-[var(--wk-text-faint)]"} />
                      {env.trim()}
                      {envStatus.present && <span className="text-[var(--wk-success)]">present</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Credentials input */}
              <div className="mb-4">
                <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">
                  Credentials
                </label>
                <div className="flex gap-2">
                  <input
                    type={showSecrets[provider.key] ? "text" : "password"}
                    value={creds[provider.key] || ""}
                    onChange={(e) => setCreds((p) => ({ ...p, [provider.key]: e.target.value }))}
                    placeholder="Enter credentials..."
                    className="flex-1 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
                  />
                  <button
                    onClick={() => setShowSecrets((p) => ({ ...p, [provider.key]: !p[provider.key] }))}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--wk-border)] text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]"
                    title="Toggle visibility"
                  >
                    <WkIcon name={showSecrets[provider.key] ? "EyeOff" : "Eye"} size={14} />
                  </button>
                  <button
                    onClick={() => handleSaveCreds(provider.key)}
                    className="wk-button wk-button-primary wk-button-sm"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => handleClearCreds(provider.key)}
                    className="wk-button wk-button-ghost wk-button-sm"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Test result */}
              {result && (
                <div className={`mb-4 rounded-lg p-3 text-[12px] ${
                  result.ok
                    ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]"
                    : "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]"
                }`}>
                  <div className="flex items-center gap-2 font-semibold">
                    <WkIcon name={result.ok ? "CheckCircle" : "XCircle"} size={14} />
                    {result.ok ? "Connection successful" : "Connection failed"}
                    {result.ok && result.latencyMs && <span className="ml-auto text-[11px]">{result.latencyMs}ms</span>}
                  </div>
                  <div className="mt-1">{result.ok ? result.message : result.error}</div>
                  {!result.ok && result.envVar && (
                    <div className="mt-1 text-[11px] font-mono">Env: {result.envVar}</div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleTest(provider.key)}
                  disabled={testing[provider.key]}
                  className="wk-button wk-button-primary wk-button-sm flex items-center gap-1.5"
                >
                  <WkIcon name={testing[provider.key] ? "Loader" : "Activity"} size={14} />
                  {testing[provider.key] ? "Testing..." : "Test Connection"}
                </button>
                <button
                  onClick={() => {
                    setShowTemplate(showTemplate === provider.key ? null : provider.key);
                  }}
                  className="wk-button wk-button-ghost wk-button-sm flex items-center gap-1.5"
                >
                  <WkIcon name="Copy" size={14} />
                  Copy Env Template
                </button>
                {provider.lastTested && (
                  <span className="text-[11px] text-[var(--wk-text-faint)] ml-auto">
                    Last tested: {new Date(provider.lastTested).toLocaleString()}
                  </span>
                )}
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