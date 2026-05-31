import { useState, useEffect } from "react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { IngestSource, CsvImportSession } from "@/services/chartsIngestion/types";
import {
  addSourceApi,
  removeSourceApi,
  updateSourceWeight,
  toggleSourceEnabled,
  fetchSources,
  hasCapability,
  getDisabledReason,
  getDiscoveredCsvSources,
  attachCsvAsSource,
  normalizeCsvCandidates,
  getCsvImportSessions,
} from "@/services/chartsIngestion/client";
import { CsvMappingPreview } from "./CsvMappingPreview";
import type { UserRole } from "@/services/chartsIngestion/client";
import type { DiscoveredCsvSource } from "@/services/chartsIngestion/types";

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
  const [discoveredCsvs, setDiscoveredCsvs] = useState<DiscoveredCsvSource[]>([]);
  const [previewCsv, setPreviewCsv] = useState<DiscoveredCsvSource | null>(null);
  const [normalizingCsv, setNormalizingCsv] = useState<string | null>(null);
  const [importSessions, setImportSessions] = useState<CsvImportSession[]>([]);

  const csvSources = sources.filter((s) => s.provider === "csv");
  const canAddSource = hasCapability(role, "add_source");
  const canRemoveSource = hasCapability(role, "remove_source");
  const canFetchSources = hasCapability(role, "fetch_sources");

  useEffect(() => {
    getDiscoveredCsvSources().then(setDiscoveredCsvs);
    getCsvImportSessions(jobId).then(setImportSessions);
  }, [jobId]);

  const refreshSessions = () => {
    getCsvImportSessions(jobId).then(setImportSessions);
  };

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
    await fetchSources(jobId);
    onUpdate();
  };

  const handleUseAsSource = async (csv: DiscoveredCsvSource) => {
    if (!canAddSource) return;
    await attachCsvAsSource(jobId, csv.id);
    onUpdate();
  };

  const handleNormalizeCsv = async (csv: DiscoveredCsvSource) => {
    if (!canFetchSources) return;
    setNormalizingCsv(csv.id);
    await normalizeCsvCandidates(jobId, csv.id);
    setNormalizingCsv(null);
    refreshSessions();
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
                {[
                  { value: "spotify", label: "Spotify" }, { value: "apple", label: "Apple Music" },
                  { value: "youtube", label: "YouTube" }, { value: "csv", label: "CSV Upload" },
                  { value: "manual", label: "Manual Entry" }, { value: "airplay", label: "Airplay" },
                  { value: "legacy", label: "Legacy WAKILISHA" }, { value: "previous", label: "Previous Edition" },
                ].map((p) => (
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

      {/* CSV Import Sessions */}
      {importSessions.length > 0 && (
        <WkSurface className="p-4">
          <h3 className="mb-3 text-[13px] font-bold text-[var(--wk-text)]">
            <i className="ri-file-list-3-line text-[var(--wk-brand)] mr-1.5" />
            CSV Import Sessions
          </h3>
          <div className="space-y-3">
            {importSessions.map((session) => (
              <div key={session.id} className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <i className="ri-file-list-line text-[var(--wk-brand)]" />
                    <span className="text-[12px] font-bold text-[var(--wk-text)]">{session.filename}</span>
                  </div>
                  <span className="text-[10px] text-[var(--wk-text-faint)]">
                    {new Date(session.normalizedAt).toLocaleString()}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  <div className="rounded-md border border-[var(--wk-border)] p-2 text-center">
                    <div className="text-[10px] text-[var(--wk-text-muted)]">Rows</div>
                    <div className="text-[13px] font-bold text-[var(--wk-text)]">{session.rowCount}</div>
                  </div>
                  <div className="rounded-md border border-[var(--wk-border)] p-2 text-center">
                    <div className="text-[10px] text-[var(--wk-text-muted)]">Valid Rows</div>
                    <div className="text-[13px] font-bold text-[var(--wk-success)]">{session.validRows}</div>
                  </div>
                  <div className="rounded-md border border-[var(--wk-border)] p-2 text-center">
                    <div className="text-[10px] text-[var(--wk-text-muted)]">Candidates</div>
                    <div className="text-[13px] font-bold text-[var(--wk-brand)]">{session.candidateCount}</div>
                  </div>
                  <div className="rounded-md border border-[var(--wk-border)] p-2 text-center">
                    <div className="text-[10px] text-[var(--wk-text-muted)]">Issues</div>
                    <div className={`text-[13px] font-bold ${session.issueCount > 0 ? "text-[var(--wk-warning)]" : "text-[var(--wk-text)]"}`}>
                      {session.issueCount}
                    </div>
                  </div>
                </div>
                {(session.validationSummary.errors.length > 0 || session.validationSummary.warnings.length > 0) && (
                  <div className="mt-2 space-y-1">
                    {session.validationSummary.errors.map((e, i) => (
                      <div key={i} className="text-[10px] text-[var(--wk-danger)]"><i className="ri-error-warning-line mr-1" />{e}</div>
                    ))}
                    {session.validationSummary.warnings.map((w, i) => (
                      <div key={i} className="text-[10px] text-[var(--wk-warning)]"><i className="ri-alert-line mr-1" />{w}</div>
                    ))}
                  </div>
                )}
                <div className="mt-2 text-[10px] text-[var(--wk-text-faint)]">
                  Session ID: {session.id} · By: {session.normalizedBy}
                </div>
              </div>
            ))}
          </div>
        </WkSurface>
      )}

      {/* Discovered WAKILISHA CSVs */}
      {discoveredCsvs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-bold text-[var(--wk-text)]">
              Available WAKILISHA CSV Imports
            </h3>
            <span className="text-[11px] text-[var(--wk-text-muted)]">{discoveredCsvs.length} discovered</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {discoveredCsvs.map((csv) => (
              <WkSurface key={csv.id} className="p-4">
                <div className="flex items-center gap-2">
                  <i className="ri-file-list-line text-[var(--wk-brand)]" />
                  <span className="text-[12px] font-bold text-[var(--wk-text)] truncate" title={csv.filename}>
                    {csv.filename}
                  </span>
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    csv.confidence === "high" ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]" :
                    csv.confidence === "medium" ? "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]" :
                    "bg-[var(--wk-text-faint)]/10 text-[var(--wk-text-faint)]"
                  }`}>
                    {csv.confidence}
                  </span>
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--wk-text-muted)]">Chart Type</span>
                    <span className="font-semibold text-[var(--wk-text)]">{csv.chartType}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--wk-text-muted)]">Rows</span>
                    <span className="font-semibold text-[var(--wk-text)]">{csv.rowCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--wk-text-muted)]">Date</span>
                    <span className="font-semibold text-[var(--wk-text)]">{csv.detectedDate ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--wk-text-muted)]">Week</span>
                    <span className="font-semibold text-[var(--wk-text)]">{csv.detectedWeek ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--wk-text-muted)]">Mapping</span>
                    <span className={`text-[10px] font-semibold ${
                      csv.mappingStatus === "mapped" ? "text-[var(--wk-success)]" :
                      csv.mappingStatus === "partial" ? "text-[var(--wk-warning)]" :
                      "text-[var(--wk-danger)]"
                    }`}>
                      {csv.mappingStatus}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--wk-text-muted)]">Validation</span>
                    <span className={`text-[10px] font-semibold ${
                      csv.validationStatus === "valid" ? "text-[var(--wk-success)]" :
                      csv.validationStatus === "warnings" ? "text-[var(--wk-warning)]" :
                      "text-[var(--wk-danger)]"
                    }`}>
                      {csv.validationStatus}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1 border-t border-[var(--wk-divider)] pt-3">
                  <button
                    onClick={() => setPreviewCsv(previewCsv?.id === csv.id ? null : csv)}
                    className="flex h-7 items-center justify-center rounded-md px-2 text-[11px] text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-brand)]"
                    title="Preview"
                  >
                    <i className="ri-eye-line text-sm mr-1" />
                    Preview
                  </button>
                  <button
                    onClick={() => handleUseAsSource(csv)}
                    disabled={csv.usedAsSource || !canAddSource}
                    className={`flex h-7 items-center justify-center rounded-md px-2 text-[11px] text-[var(--wk-success)] hover:bg-[var(--wk-success-soft)] ${csv.usedAsSource || !canAddSource ? "cursor-not-allowed opacity-50" : ""}`}
                    title={csv.usedAsSource ? "Already used as source" : "Use as source"}
                  >
                    <i className="ri-add-circle-line text-sm mr-1" />
                    {csv.usedAsSource ? "Added" : "Use as source"}
                  </button>
                  <button
                    onClick={() => handleNormalizeCsv(csv)}
                    disabled={normalizingCsv === csv.id || !canFetchSources}
                    className={`flex h-7 items-center justify-center rounded-md px-2 text-[11px] text-[var(--wk-brand)] hover:bg-[var(--wk-brand-soft)] ${normalizingCsv === csv.id || !canFetchSources ? "cursor-not-allowed opacity-50" : ""}`}
                    title="Normalize into candidates"
                  >
                    {normalizingCsv === csv.id ? <i className="ri-loader-4-line animate-spin text-sm mr-1" /> : <i className="ri-sparkling-line text-sm mr-1" />}
                    {normalizingCsv === csv.id ? "Normalizing..." : "Normalize"}
                  </button>
                </div>

                {/* Inline Preview */}
                {previewCsv?.id === csv.id && (
                  <div className="mt-3">
                    <CsvMappingPreview discoveredCsv={csv} />
                  </div>
                )}
              </WkSurface>
            ))}
          </div>
        </div>
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