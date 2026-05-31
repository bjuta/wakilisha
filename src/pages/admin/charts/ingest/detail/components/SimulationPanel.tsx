import { useState } from "react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  simulate,
  retry,
  getActiveSimulations,
  isSimulated,
  getLastErrorMessage,
  clearAllSimulations,
} from "@/services/chartsIngestion/client";
import type { SimulationType } from "@/services/chartsIngestion/client";

const SIMULATION_BUTTONS: Array<{
  type: SimulationType;
  label: string;
  icon: string;
  category: string;
  description: string;
}> = [
  {
    type: "source_fetch_failure",
    label: "Source Fetch Failure",
    icon: "ri-download-cloud-line",
    category: "Fetch",
    description: "Simulate Spotify API 500 error on source fetch",
  },
  {
    type: "normalization_failure",
    label: "Normalization Failure",
    icon: "ri-file-list-3-line",
    category: "Fetch",
    description: "Simulate normalization engine unable to parse raw items",
  },
  {
    type: "matching_failure",
    label: "Matching Failure",
    icon: "ri-links-line",
    category: "Matching",
    description: "Simulate canonical match engine returning no results",
  },
  {
    type: "duplicate_rank",
    label: "Duplicate Rank",
    icon: "ri-bar-chart-grouped-line",
    category: "Ranking",
    description: "Inject duplicate rank on top 2 candidates",
  },
  {
    type: "duplicate_canonical",
    label: "Duplicate Canonical",
    icon: "ri-git-merge-line",
    category: "Matching",
    description: "Force two candidates to match same canonical track",
  },
  {
    type: "publish_failure",
    label: "Publish Failure",
    icon: "ri-upload-cloud-line",
    category: "Publish",
    description: "Simulate WordPress edition creation 403 error",
  },
  {
    type: "snapshot_failure",
    label: "Snapshot Failure",
    icon: "ri-camera-lens-line",
    category: "Publish",
    description: "Simulate database write timeout during snapshot creation",
  },
  {
    type: "api_timeout",
    label: "API Timeout",
    icon: "ri-time-line",
    category: "Fetch",
    description: "Simulate 30s timeout on external API request",
  },
  {
    type: "permission_denied",
    label: "Permission Denied",
    icon: "ri-shield-keyhole-line",
    category: "Publish",
    description: "Simulate publish_wakilisha_charts capability missing",
  },
];

export interface SimulationPanelProps {
  jobId: string;
  onUpdate: () => void;
}

export function SimulationPanel({ jobId, onUpdate }: SimulationPanelProps) {
  const [active, setActive] = useState<SimulationType[]>(getActiveSimulations());
  const [lastError, setLastError] = useState<string | null>(getLastErrorMessage());
  const [retrying, setRetrying] = useState<SimulationType | null>(null);
  const [retryProgress, setRetryProgress] = useState(0);

  const refresh = () => {
    setActive(getActiveSimulations());
    setLastError(getLastErrorMessage());
  };

  const handleSimulate = (type: SimulationType) => {
    simulate(type, jobId);
    refresh();
    onUpdate();
  };

  const handleRetry = async (type: SimulationType) => {
    setRetrying(type);
    setRetryProgress(0);

    // Simulate retry progress
    const interval = setInterval(() => {
      setRetryProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        return p + 20;
      });
    }, 300);

    // Wait for progress
    setTimeout(() => {
      clearInterval(interval);
      retry(type, jobId);
      refresh();
      onUpdate();
      setRetrying(null);
      setRetryProgress(0);
    }, 1800);
  };

  const handleClearAll = () => {
    clearAllSimulations();
    refresh();
    onUpdate();
  };

  const categories = Array.from(new Set(SIMULATION_BUTTONS.map((b) => b.category)));

  return (
    <WkSurface className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <i className="ri-flask-line text-[var(--wk-warning)]" />
          <h3 className="text-[14px] font-bold text-[var(--wk-text)]">Simulation Controls</h3>
          <span className="text-[10px] font-mono text-[var(--wk-text-muted)] bg-[var(--wk-bg-subtle)] rounded-full px-2 py-0.5">
            DEMO ONLY
          </span>
        </div>
        <button
          onClick={handleClearAll}
          className="text-[11px] text-[var(--wk-text-muted)] hover:text-[var(--wk-danger)] transition-colors"
        >
          <i className="ri-close-circle-line mr-1" />Clear All
        </button>
      </div>

      {/* Active Simulations Banner */}
      {active.length > 0 && (
        <div className="mb-4 rounded-lg border border-[var(--wk-danger)]/20 bg-[var(--wk-danger-soft)] p-3">
          <div className="flex items-center gap-2">
            <i className="ri-error-warning-line text-[var(--wk-danger)]" />
            <span className="text-[12px] font-semibold text-[var(--wk-danger)]">
              {active.length} active simulation{active.length !== 1 ? "s" : ""}
            </span>
          </div>
          {lastError && (
            <div className="mt-2 text-[11px] text-[var(--wk-danger)]/80">
              {lastError}
            </div>
          )}
        </div>
      )}

      {/* Retry Progress */}
      {retrying && (
        <div className="mb-4 rounded-lg border border-[var(--wk-info)]/20 bg-[var(--wk-info-soft)] p-3">
          <div className="flex items-center gap-2 mb-2">
            <i className="ri-loader-4-line animate-spin text-[var(--wk-info)]" />
            <span className="text-[12px] font-semibold text-[var(--wk-info)]">
              Retrying {SIMULATION_BUTTONS.find((b) => b.type === retrying)?.label}...
            </span>
          </div>
          <div className="h-2 rounded-full bg-[var(--wk-bg-subtle)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--wk-info)] transition-all duration-300"
              style={{ width: `${retryProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Simulation Buttons by Category */}
      <div className="space-y-4">
        {categories.map((category) => (
          <div key={category} className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">
              {category}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {SIMULATION_BUTTONS.filter((b) => b.category === category).map((btn) => {
                const isActive = isSimulated(btn.type);
                return (
                  <div key={btn.type} className="flex items-center gap-2">
                    <button
                      onClick={() => handleSimulate(btn.type)}
                      className={`flex-1 flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all ${
                        isActive
                          ? "border-[var(--wk-danger)]/20 bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]"
                          : "border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]"
                      }`}
                    >
                      <i className={btn.icon} />
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold truncate">{btn.label}</div>
                        <div className="text-[10px] text-[var(--wk-text-muted)] truncate">{btn.description}</div>
                      </div>
                    </button>
                    {isActive && (
                      <button
                        onClick={() => handleRetry(btn.type)}
                        disabled={retrying !== null}
                        className="shrink-0 flex items-center gap-1 rounded-lg border border-[var(--wk-success)]/20 bg-[var(--wk-success-soft)] px-3 py-2 text-[11px] font-semibold text-[var(--wk-success)] hover:bg-[var(--wk-success)]/20 transition-colors disabled:opacity-50"
                      >
                        <i className="ri-refresh-line" />
                        Retry
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-[var(--wk-border)] flex flex-wrap items-center gap-3 text-[10px] text-[var(--wk-text-muted)]">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[var(--wk-danger)]" />
          Active simulation
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[var(--wk-success)]" />
          Retry available
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[var(--wk-text-faint)]" />
          Not triggered
        </span>
      </div>
    </WkSurface>
  );
}