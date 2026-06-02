import { WkSurface } from "@/components/design-system/primitives/Surface";
import { useNavigate } from "react-router-dom";
import { getIngestionMode } from "@/services/chartsIngestion/client";
import { getEnrichmentProviderHealth } from "@/services/chartsIngestion/enrichment";
import type { ProviderHealthStatus } from "@/services/chartsIngestion/enrichment";

const PROVIDER_ICONS: Record<string, string> = {
  Spotify: "ri-spotify-fill",
  "Apple Music": "ri-apple-fill",
  ACRCloud: "ri-fingerprint-line",
  YouTube: "ri-youtube-fill",
};

const PROVIDER_COLORS: Record<string, string> = {
  Spotify: "#1DB954",
  "Apple Music": "#FA233B",
  ACRCloud: "#FF6B2C",
  YouTube: "#FF0000",
};

interface ProviderRowProps {
  health: ProviderHealthStatus;
}

function ProviderRow({ health }: ProviderRowProps) {
  const color = PROVIDER_COLORS[health.provider];
  const icon = PROVIDER_ICONS[health.provider] || "ri-database-2-line";
  const isLive = health.status === "live";
  const isMocked = health.status === "mocked";

  return (
    <div className="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0 border-b border-wk-border last:border-0">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded" style={{ backgroundColor: `${color}18` }}>
        <i className={`${icon} text-[13px]`} style={{ color }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-semibold text-wk-text">{health.provider}</span>
          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
            isLive ? "bg-wk-success-soft text-wk-success" :
            isMocked ? "bg-wk-warning-soft text-wk-warning" :
            "bg-wk-danger-soft text-wk-danger"
          }`}>
            {isLive ? "Live" : isMocked ? "Mocked" : "No Creds"}
          </span>
        </div>
        {!isLive && !isMocked && (
          <div className="mt-0.5">
            {health.envVars.map((v) => (
              <code key={v} className="mr-1 text-[9px] font-mono text-wk-text-faint bg-wk-surface-raised px-1 py-0.5 rounded">
                {v}
              </code>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ProviderHealthPanel() {
  const navigate = useNavigate();
  const mode = getIngestionMode();
  const enrichmentHealth = getEnrichmentProviderHealth();
  const missingCount = enrichmentHealth.filter((h) => h.status === "missing_credentials").length;
  const liveCount = enrichmentHealth.filter((h) => h.status === "live").length;

  const registryStatus = {
    provider: "Registry DB",
    status: "mocked" as const,
    message: "LocalStorage mock registry — 25 canonical tracks",
    envVars: [],
  };

  const ingestModeStatus = {
    provider: "Ingest Mode",
    status: mode === "wordpress" ? "live" : "mocked" as const,
    message: mode === "mock" ? "Mock (dev) — switch to wordpress mode for production" : "WordPress mode — real backend active",
    envVars: mode === "wordpress" ? [] : ["VITE_CHARTS_INGESTION_MODE=wordpress"],
  };

  return (
    <WkSurface className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-bold text-wk-text">Provider Health</h2>
        {missingCount > 0 && (
          <span className="text-[10px] font-bold text-wk-warning bg-wk-warning-soft rounded-full px-2 py-0.5">
            {missingCount} missing
          </span>
        )}
        {liveCount === 4 && (
          <span className="text-[10px] font-bold text-wk-success bg-wk-success-soft rounded-full px-2 py-0.5">
            All live
          </span>
        )}
      </div>

      <div className="space-y-0">
        {enrichmentHealth.map((h) => (
          <ProviderRow key={h.provider} health={h} />
        ))}
        <ProviderRow health={{ provider: "Registry DB", status: "mocked", message: registryStatus.message, envVars: [] }} />
        <ProviderRow health={{ provider: "Ingest Mode", status: ingestModeStatus.status, message: ingestModeStatus.message, envVars: ingestModeStatus.envVars }} />
      </div>

      {missingCount > 0 && (
        <div className="mt-3 rounded-lg border border-wk-warning/20 bg-wk-warning-soft px-3 py-2">
          <p className="text-[11px] font-semibold text-wk-warning mb-1">
            <i className="ri-alert-line mr-1" />{missingCount} provider(s) running in mock mode
          </p>
          <p className="text-[10px] text-wk-text-soft">
            Add credentials to <code className="font-mono">.env.local</code> and restart to enable real enrichment.
          </p>
        </div>
      )}

      <button
        onClick={() => navigate("/admin/charts/ingest-health")}
        className="mt-3 w-full text-[11px] font-semibold text-wk-brand hover:underline text-left"
      >
        <i className="ri-external-link-line mr-1" />Full API Health &amp; Endpoint Map
      </button>
    </WkSurface>
  );
}