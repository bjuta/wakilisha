import { useState } from "react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { IngestSource } from "@/services/chartsIngestion/types";
import {
  addSourceApi,
  removeSourceApi,
  updateSourceWeight,
  toggleSourceEnabled,
  fetchSources,
  hasCapability,
  getDisabledReason,
} from "@/services/chartsIngestion/client";
import { CsvMappingPreview } from "./CsvMappingPreview";
import type { UserRole } from "@/services/chartsIngestion/client";

interface SourcesStepProps {
  jobId: string;
  sources: IngestSource[];
  onUpdate: () => void;
  role?: UserRole;
}

const PROVIDER_OPTIONS = [
  { value: "spotify", label: "Spotify" },
  { value: "apple", label: "Apple Music" },
  { value: "youtube", label: "YouTube" },
  { value: "csv", label: "CSV Upload" },
  { value: "manual", label: "Manual Entry" },
  { value: "airplay", label: "Airplay" },
  { value: "legacy", label: "Legacy WAKILISHA" },
  { value: "previous", label: "Previous Edition" },
];

export function SourcesStep({ jobId, sources, onUpdate, role = "admin" }: SourcesStepProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newProvider, setNewProvider] = useState("spotify");
  const [newWeight, setNewWeight] = useState(0.2);
  const [newUrl, setNewUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [showCsvPreview, setShowCsvPreview] = useState(false);

  const csvSources = sources.filter((s) => s.sourceType === "csv");
  const canAddSource = hasCapability(role, "add_source");
  const canRemoveSource = hasCapability(role, "remove_source");
  const canFetchSources = hasCapability(role, "fetch_sources");

  const handleAddSource = async () => {
    if (!canAddSource) return;
    await addSourceApi(jobId, {
      sourceType: newProvider as IngestSource["sourceType"],
      provider: newProvider as IngestSource["provider"],
      sourceUrl: newUrl || null,
      weight: newWeight,
      priority: sources.length + 1,
    });
    setShowAdd(false);
    setNewProvider("spotify");
    setNewWeight(0.2);
    setNewUrl("");
    onUpdate();
  };

  const handleRemove = async (sourceId: string) => {
    if (!canRemoveSource) return;
    await removeSourceApi(sourceId);
    onUpdate();
  };

  const handleToggle = async (sourceId: string) => {
    if (!canFetchSources) return;
    await toggleSourceEnabled(sourceId);
    onUpdate();
  };

  const handleWeightChange = async (sourceId: string, weight: number) => {
    if (!canFetchSources) return;
    await updateSourceWeight(sourceId, weight);
    onUpdate();
  };

  const handleFetchAll = async () => {
    if (!canFetchSources) return;
    setFetching(true);
    await fetchSources(jobId);
    setFetching(false);
    onUpdate();
  };

  const handleFetchOne = async (sourceId: string) => {
    if (!canFetchSources) return;
    const source = sources.find((s) => s.id === sourceId);
    if (!source) return;
    await fetchSources(jobId);
    onUpdate();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Ingest Sources</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleFetchAll}
            disabled={fetching || !canFetchSources}
            className={`wk-button wk-button-sm wk-button-ghost whitespace-nowrap ${!canFetchSources ? "cursor-not-allowed opacity-50" : ""}`}
            title={!canFetchSources ? getDisabledReason(role, "fetch_sources") : ""}
          >
            {fetching ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-download-cloud-line" />}
            Fetch All
          </button>
          <button
            onClick={() => setShowAdd(true)}
            disabled={!canAddSource}
            className={`wk-button wk-button-sm wk-button-primary whitespace-nowrap ${!canAddSource ? "cursor-not-allowed opacity-50" : ""}`}
            title={!canAddSource ? getDisabledReason(role, "add_source") : ""}
          >
            <i className="ri-add-line" />
            Add Source
          </button>
        </div>
      </div>

      {/* Add Source Form */}
      {showAdd && (
        <WkSurface className="p-4">
          <h3 className="mb-3 text-[13px] font-bold text-[var(--wk-text)]">Add New Source</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Provider</label>
              <select
                value={newProvider}
                onChange={(e) => setNewProvider(e.target.value)}
                className="mt-1 w-full rounded-md border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[12px] text-[var(--wk-text)]"
              >
                {PROVIDER_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Weight ({Math.round(newWeight * 100)}%)</label>
              <input
                type="range"
                min="0.05"
                max="0.8"
                step="0.05"
                value={newWeight}
                onChange={(e) => setNewWeight(parseFloat(e.target.value))}
                className="mt-2 w-full"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">URL / Playlist</label>
              <input
                type="text"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1 w-full rounded-md border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[12px] text-[var(--wk-text)]"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={handleAddSource} className="wk-button wk-button-sm wk-button-primary">
              <i className="ri-check-line" />
              Add
            </button>
            <button onClick={() => setShowAdd(false)} className="wk-button wk-button-sm wk-button-ghost">
              Cancel
            </button>
          </div>
        </WkSurface>
      )}

      {/* CSV Mapping Preview Toggle */}
      {csvSources.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCsvPreview(!showCsvPreview)}
            className="wk-button wk-button-sm wk-button-ghost"
          >
            <i className={showCsvPreview ? "ri-eye-off-line" : "ri-eye-line"} />
            {showCsvPreview ? "Hide CSV Mapping" : "Show CSV Mapping"}
          </button>
          <span className="text-[11px] text-[var(--wk-text-muted)]">{csvSources.length} CSV source(s)</span>
        </div>
      )}

      {showCsvPreview && <CsvMappingPreview />}

      {/* Source Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sources.map((source) => (
          <WkSurface key={source.id} className="p-4">
            <div className="flex items-center gap-2">
              <i className={`ri-${getProviderIcon(source.provider)} text-[var(--wk-brand)]`} />
              <span className="text-[12px] font-bold text-[var(--wk-text)]">
                {source.provider.charAt(0).toUpperCase() + source.provider.slice(1)}
              </span>
              <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                source.status === "completed" ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]" :
                source.status === "fetching" ? "bg-[var(--wk-info-soft)] text-[var(--wk-info)]" :
                source.status === "failed" ? "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]" :
                source.status === "disabled" ? "bg-[var(--wk-text-faint)]/10 text-[var(--wk-text-faint)]" :
                "bg-[var(--wk-text-faint)]/10 text-[var(--wk-text-faint)]"
              }`}>
                {source.status}
              </span>
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--wk-text-muted)]">Weight</span>
                <span className="font-semibold text-[var(--wk-text)]">{Math.round(source.weight * 100)}%</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--wk-text-muted)]">Raw Items</span>
                <span className="font-semibold text-[var(--wk-text)]">{source.rawCount}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--wk-text-muted)]">Normalized</span>
                <span className="font-semibold text-[var(--wk-text)]">{source.normalizedCount}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--wk-text-muted)]">Errors</span>
                <span className={`font-semibold ${source.errorCount > 0 ? "text-[var(--wk-danger)]" : "text-[var(--wk-text)]"}`}>
                  {source.errorCount}
                </span>
              </div>
              {source.fetchedAt && (
                <div className="text-[10px] text-[var(--wk-text-faint)]">
                  Last fetched: {new Date(source.fetchedAt).toLocaleString()}
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center gap-1 border-t border-[var(--wk-divider)] pt-3">
              <button
                onClick={() => handleFetchOne(source.id)}
                disabled={!canFetchSources}
                className={`flex h-7 w-7 items-center justify-center rounded-md text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-brand)] ${!canFetchSources ? "cursor-not-allowed opacity-50" : ""}`}
                title={!canFetchSources ? getDisabledReason(role, "fetch_sources") : "Fetch"}
              >
                <i className="ri-download-cloud-line text-sm" />
              </button>
              <button
                onClick={() => handleToggle(source.id)}
                disabled={!canFetchSources}
                className={`flex h-7 w-7 items-center justify-center rounded-md text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-warning)] ${!canFetchSources ? "cursor-not-allowed opacity-50" : ""}`}
                title={!canFetchSources ? getDisabledReason(role, "fetch_sources") : source.status === "disabled" ? "Enable" : "Disable"}
              >
                <i className={`${source.status === "disabled" ? "ri-eye-line" : "ri-eye-off-line"} text-sm`} />
              </button>
              <div className="flex-1" />
              <button
                onClick={() => handleRemove(source.id)}
                disabled={!canRemoveSource}
                className={`flex h-7 w-7 items-center justify-center rounded-md text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-danger)] ${!canRemoveSource ? "cursor-not-allowed opacity-50" : ""}`}
                title={!canRemoveSource ? getDisabledReason(role, "remove_source") : "Remove"}
              >
                <i className="ri-delete-bin-line text-sm" />
              </button>
            </div>
          </WkSurface>
        ))}
        {sources.length === 0 && (
          <div className="col-span-full py-8 text-center text-[var(--wk-text-muted)]">
            No sources added yet.
          </div>
        )}
      </div>
    </div>
  );
}

function getProviderIcon(provider: string): string {
  const icons: Record<string, string> = {
    spotify: "spotify-fill",
    apple: "apple-fill",
    youtube: "youtube-fill",
    csv: "file-list-line",
    manual: "edit-line",
    airplay: "radio-line",
    legacy: "archive-line",
    previous: "history-line",
  };
  return icons[provider] ?? "database-2-line";
}