import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  getIngestKpis,
  getRecentIngestActivity,
  getIngestRuns,
  runDryRun,
  commitIngestRun,
  detectProvidersFromUrls,
  isValidProviderUrl,
  getResourceGuardStatus,
  getChartFamilies,
  getIngestionMode,
  cancelIngestRun,
  retryIngestRun,
} from "@/services/chartsIngestion/client";
import type {
  IngestStudioKpi,
  RecentIngestActivity,
  IngestRun,
  ProviderName,
  ResourceGuardStatus,
} from "@/services/chartsIngestion/ingestStudioTypes";
import type { ChartFamily } from "@/services/chartsIngestion/types";
import { WkSurface } from "@/components/design-system/primitives/Surface";

import { Stepper } from "./components/Stepper";
import { KpiCard } from "./components/KpiCard";
import { MatchSummary } from "./components/MatchSummary";
import { MiniChartRow, RowTableRow } from "./components/RowComponents";
import { PipelinePanel } from "./components/PipelinePanel";
import { ResourceGuardPanel } from "./components/ResourceGuardPanel";
import { RunCard } from "./components/RunCard";
import { ActivityItem } from "./components/ActivityItem";
import { NavButton } from "./components/NavButton";
import { ProviderHealthPanel } from "./components/ProviderHealthPanel";
import { RunMetadataPanel } from "./components/RunMetadataPanel";
import { PublishChecklist } from "./components/PublishChecklist";
import { QuickTemplateButton, ProviderChip, KindToggle } from "./components/FormComponents";

export default function AdminChartsIngest() {
  const navigate = useNavigate();
  const mode = getIngestionMode();

  const [kpis, setKpis] = useState<IngestStudioKpi | null>(null);
  const [activity, setActivity] = useState<RecentIngestActivity[]>([]);
  const [runs, setRuns] = useState<IngestRun[]>([]);
  const [families, setFamilies] = useState<ChartFamily[]>([]);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState<"configure" | "preview" | "commit">("configure");

  const [chartTitle, setChartTitle] = useState("");
  const [chartSlug, setChartSlug] = useState("");
  const [sourceUrls, setSourceUrls] = useState("");
  const [editionDate, setEditionDate] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d.toISOString().split("T")[0];
  });
  const [chartSize, setChartSize] = useState(40);
  const [market, setMarket] = useState("KE");
  const [chartKind, setChartKind] = useState<"tracks" | "releases">("tracks");
  const [coverStyle, setCoverStyle] = useState("default");
  const [saveAsRecurring, setSaveAsRecurring] = useState(false);
  const [existingSeriesId, setExistingSeriesId] = useState("");
  const [detectedProviders, setDetectedProviders] = useState<ProviderName[]>([]);

  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<IngestRun | null>(null);
  const [commitLoading, setCommitLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [rowFilter, setRowFilter] = useState<string>("all");
  const [guardStatus, setGuardStatus] = useState<ResourceGuardStatus | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [editionExistsWarning, setEditionExistsWarning] = useState<string | null>(null);
  const [newSeriesLabel, setNewSeriesLabel] = useState("");
  const [newSeriesKey, setNewSeriesKey] = useState("");
  const [cancelLoading, setCancelLoading] = useState<string | null>(null);
  const [retryLoading, setRetryLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [k, a, r, f] = await Promise.all([
      getIngestKpis(),
      getRecentIngestActivity(),
      getIngestRuns(),
      getChartFamilies(),
    ]);
    setKpis(k);
    setActivity(a);
    setRuns(r);
    setFamilies(f);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const urls = sourceUrls.split("\n").filter((u) => u.trim());
    setDetectedProviders(detectProvidersFromUrls(urls));
  }, [sourceUrls]);

  useEffect(() => {
    if (chartTitle && !chartSlug) {
      setChartSlug(
        chartTitle
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, "")
          .replace(/\s+/g, "-")
          .substring(0, 60)
      );
    }
  }, [chartTitle]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!existingSeriesId || !editionDate || existingSeriesId === "__new__") {
      setEditionExistsWarning(null);
      return;
    }
    const dup = runs.find(
      (r) => r.existingSeriesId === existingSeriesId && r.editionDate === editionDate && r.status !== "cancelled"
    );
    if (dup) {
      setEditionExistsWarning(
        `An edition already exists for this series on ${editionDate} (${dup.chartTitle}). Committing will overwrite unless you change the date.`
      );
    } else {
      setEditionExistsWarning(null);
    }
  }, [existingSeriesId, editionDate, runs]);

  const selectedFamily = useMemo(
    () => families.find((f) => f.id === existingSeriesId) || null,
    [families, existingSeriesId]
  );

  useEffect(() => {
    if (selectedFamily) {
      setChartSize(selectedFamily.defaultChartSize);
      const regionToMarket: Record<string, string> = {
        Africa: "KE", Kenya: "KE", Nigeria: "NG", "South Africa": "ZA",
        Ghana: "GH", Uganda: "UG", Tanzania: "TZ",
      };
      setMarket(regionToMarket[selectedFamily.defaultRegion] || "KE");
    }
  }, [selectedFamily]);

  const publicUrlPreview = useMemo(() => {
    if (!chartSlug || !editionDate) return null;
    return `/charts/${chartSlug}/${editionDate}`;
  }, [chartSlug, editionDate]);

  function validateForm(): string | null {
    if (!chartTitle.trim()) return "Chart title is required. Give this edition a clear, public-facing name.";
    if (!chartSlug.trim()) return "Chart slug is required. This becomes the public URL path.";
    if (!editionDate) return "Edition date is required. Choose the chart week (usually the most recent Monday).";
    const urls = sourceUrls.split("\n").filter((u) => u.trim());
    if (urls.length === 0) return "At least one source URL is required. Paste a Spotify or Apple Music playlist link.";
    const invalid = urls.filter((u) => !isValidProviderUrl(u));
    if (invalid.length > 0) {
      return `Unrecognized provider URL(s): ${invalid.join(", ")}. Only Spotify and Apple Music playlist links are supported in this release.`;
    }
    if (chartSize < 1 || chartSize > 100) return "Chart size must be between 1 and 100.";
    if (!existingSeriesId || existingSeriesId === "__new__") return "Select an existing chart series or create a new one. This determines the family, ruleset, and public URL structure.";
    return null;
  }

  async function handleDryRun() {
    const error = validateForm();
    if (error) {
      setFormError(error);
      return;
    }
    setFormError(null);
    setDryRunLoading(true);
    setDryRunResult(null);
    setSuccessMessage(null);
    setExpandedRowId(null);

    try {
      const urls = sourceUrls.split("\n").filter((u) => u.trim());
      const response = await runDryRun({
        chartTitle,
        chartSlug,
        editionDate,
        chartSize,
        market,
        chartKind,
        coverStyle,
        sourceUrls: urls,
        saveAsRecurringSeries: saveAsRecurring,
        existingSeriesId: existingSeriesId || null,
      });

      const run = await getIngestRuns().then((r) => r.find((x) => x.id === response.runId));
      if (run) {
        setDryRunResult(run);
        setStep("preview");
        setSuccessMessage(
          `Dry run complete — ${run.summary.totalRows} rows processed, ${run.summary.matchRate.toFixed(1)}% match rate`
        );
        const guard = await getResourceGuardStatus(run.id);
        setGuardStatus(guard);
      }
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Dry run failed";
      setFormError(
        msg.includes("rate limit")
          ? "Spotify rate limit exceeded. Wait 15 minutes or reduce the number of sources."
          : msg.includes("credentials")
            ? "Provider credentials are missing. Add VITE_SPOTIFY_CLIENT_ID or switch to mock mode."
            : msg.includes("Apple")
              ? "Apple Music token is missing. Add VITE_APPLE_MUSIC_DEVELOPER_TOKEN or remove Apple URLs."
              : msg.includes("all sources failed")
                ? "All sources failed to fetch. Check the URLs are valid playlists and try again."
                : `Dry run failed: ${msg}`
      );
    } finally {
      setDryRunLoading(false);
    }
  }

  async function handleCommit() {
    if (!dryRunResult) return;
    setCommitLoading(true);
    setFormError(null);
    try {
      const result = await commitIngestRun({
        runId: dryRunResult.id,
        publishImmediately: true,
      });
      setSuccessMessage(`Edition committed! Public URL: ${result.publicUrl}`);
      setStep("commit");
      setDryRunResult(null);
      await loadData();
      setTimeout(() => navigate(`/admin/charts/ingest-runs/${result.runId}`), 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Commit failed";
      setFormError(
        msg.includes("dry run")
          ? "Cannot publish: the run must complete a dry run first."
          : msg.includes("not found")
            ? "Run not found. It may have been deleted or reset."
            : `Commit failed: ${msg}`
      );
    } finally {
      setCommitLoading(false);
    }
  }

  function handleReset() {
    setStep("configure");
    setDryRunResult(null);
    setFormError(null);
    setSuccessMessage(null);
    setGuardStatus(null);
    setExpandedRowId(null);
    setRowFilter("all");
    setEditionExistsWarning(null);
  }

  async function handleCancelRun(runId: string) {
    setCancelLoading(runId);
    try {
      await cancelIngestRun(runId);
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setCancelLoading(null);
    }
  }

  async function handleRetryRun(runId: string) {
    setRetryLoading(runId);
    try {
      await retryIngestRun(runId);
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetryLoading(null);
    }
  }

  const filteredRows = useMemo(() => {
    if (!dryRunResult) return [];
    if (rowFilter === "all") return dryRunResult.rows;
    return dryRunResult.rows.filter((r) => r.matchStatus === rowFilter);
  }, [dryRunResult, rowFilter]);

  const activeRun = runs.find((r) => r.status === "running");

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-300 border-t-primary-600" />
        <p className="text-[13px] font-medium text-foreground-500">Loading Ingest Studio…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-foreground-500">Chart Operations</div>
          <h1 className="text-[22px] font-bold text-foreground-950">Ingest Studio</h1>
          <p className="text-[13px] text-foreground-600">Create chart editions from streaming playlists — step by step</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${mode === "mock" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
            <i className={mode === "mock" ? "ri-flask-line" : "ri-earth-line"} />
            {mode === "mock" ? "Mock Mode" : "WordPress Mode"}
          </span>
          <button onClick={() => navigate("/admin/charts/ingest-runs")} className="inline-flex items-center gap-1.5 rounded-md border border-background-200 bg-background-50 px-3 py-2 text-[13px] font-semibold text-foreground-700 transition-colors hover:bg-background-100 whitespace-nowrap">
            <i className="ri-list-check" />All Runs
          </button>
          <button onClick={() => navigate("/admin/charts/ingest-health")} className="inline-flex items-center gap-1.5 rounded-md border border-background-200 bg-background-50 px-3 py-2 text-[13px] font-semibold text-foreground-700 transition-colors hover:bg-background-100 whitespace-nowrap">
            <i className="ri-heart-pulse-line" />API Health
          </button>
        </div>
      </div>

      <Stepper step={step} onStepChange={(s) => { if (s === "configure") handleReset(); }} />

      {kpis && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Editions This Week" value={String(kpis.editionsThisWeek)} trend="+1" positive />
          <KpiCard label="Match Rate" value={`${kpis.canonicalMatchRate.toFixed(1)}%`} trend="-1.2%" positive={kpis.canonicalMatchRate >= 85} />
          <KpiCard label="Awaiting Review" value={String(kpis.rowsAwaitingReview)} trend="-4" positive={kpis.rowsAwaitingReview < 20} />
          <KpiCard label="Avg Run Time" value={`${(kpis.averageRunTimeMs / 1000).toFixed(1)}s`} trend="-0.3s" positive />
        </div>
      )}

      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 animate-hero-fade">
          <div className="flex items-center gap-2 text-red-700">
            <i className="ri-error-warning-line" />
            <span className="text-[13px] font-semibold">{formError}</span>
          </div>
        </div>
      )}
      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 animate-hero-fade">
          <div className="flex items-center gap-2 text-green-700">
            <i className="ri-check-line" />
            <span className="text-[13px] font-semibold">{successMessage}</span>
          </div>
        </div>
      )}
      {editionExistsWarning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 animate-hero-fade">
          <div className="flex items-center gap-2 text-amber-700">
            <i className="ri-alert-line" />
            <span className="text-[13px] font-semibold">{editionExistsWarning}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {step === "configure" && (
            <WkSurface className="p-5 animate-hero-fade">
              <h2 className="mb-4 text-[16px] font-bold text-foreground-950">Configure Ingest</h2>

              <div className="mb-5">
                <label className="mb-2 block text-[12px] font-semibold text-foreground-700">Quick Start</label>
                <div className="flex flex-wrap gap-2">
                  <QuickTemplateButton label="Top 40 Kenya" onClick={() => {
                    setChartTitle("WAKILISHA Top 40");
                    setChartSlug("wakilisha-top-40");
                    setChartSize(40);
                    setMarket("KE");
                    setExistingSeriesId("kenya");
                    setSaveAsRecurring(true);
                  }} />
                  <QuickTemplateButton label="Top 100 Kenya" onClick={() => {
                    setChartTitle("WAKILISHA Top 100");
                    setChartSlug("wakilisha-top-100");
                    setChartSize(100);
                    setMarket("KE");
                    setExistingSeriesId("kenya");
                    setSaveAsRecurring(true);
                  }} />
                  <QuickTemplateButton label="Afrobeats 20" onClick={() => {
                    setChartTitle("Afrobeats Top 20");
                    setChartSlug("afrobeats-top-20");
                    setChartSize(20);
                    setMarket("KE");
                    setCoverStyle("genre");
                    setExistingSeriesId("kenya");
                    setSaveAsRecurring(true);
                  }} />
                  <QuickTemplateButton label="Nigeria Top 40" onClick={() => {
                    setChartTitle("WAKILISHA Top 40 — Nigeria");
                    setChartSlug("wakilisha-top-40-nigeria");
                    setChartSize(40);
                    setMarket("NG");
                    setExistingSeriesId("");
                    setSaveAsRecurring(false);
                  }} />
                </div>
              </div>

              <div className="mb-4">
                <label className="mb-1 block text-[12px] font-semibold text-foreground-700">Chart Series *</label>
                <select
                  value={existingSeriesId}
                  onChange={(e) => setExistingSeriesId(e.target.value)}
                  className="w-full rounded-md border border-background-200 bg-background-50 px-3 py-2 text-[13px] text-foreground-950 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
                >
                  <option value="">— Select a series —</option>
                  {families.map((f) => (
                    <option key={f.id} value={f.id}>{f.label} ({f.familyKey})</option>
                  ))}
                  <option value="__new__">+ Create new series…</option>
                </select>
                {selectedFamily && (
                  <div className="mt-2 rounded-lg border border-background-200 bg-background-50 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[12px] font-bold text-foreground-700">{selectedFamily.label}</span>
                      <span className="rounded bg-secondary-100 px-1.5 py-0.5 text-[10px] font-semibold text-secondary-700">{selectedFamily.editionFrequency}</span>
                      <span className="rounded bg-secondary-100 px-1.5 py-0.5 text-[10px] font-semibold text-secondary-700">{selectedFamily.defaultRegion}</span>
                    </div>
                    <p className="text-[11px] text-foreground-500">{selectedFamily.description}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-foreground-600">
                      <span>Default size: <strong className="text-foreground-950">{selectedFamily.defaultChartSize}</strong></span>
                      <span>Ruleset: <strong className="text-foreground-950">{selectedFamily.defaultRuleset}</strong></span>
                      <span>Scoring: <strong className="text-foreground-950">{selectedFamily.defaultScoringModel}</strong></span>
                    </div>
                  </div>
                )}
                {existingSeriesId === "__new__" && (
                  <div className="mt-2 rounded-lg border border-primary-200 bg-primary-50 p-3">
                    <p className="text-[12px] font-semibold text-primary-700 mb-2">Create New Series</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input
                        type="text"
                        value={newSeriesLabel}
                        onChange={(e) => {
                          setNewSeriesLabel(e.target.value);
                          setNewSeriesKey(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""));
                        }}
                        placeholder="Series name"
                        className="rounded-md border border-background-200 bg-background-50 px-3 py-2 text-[13px] text-foreground-950 outline-none focus:border-primary-400"
                      />
                      <input
                        type="text"
                        value={newSeriesKey}
                        onChange={(e) => setNewSeriesKey(e.target.value)}
                        placeholder="series-key"
                        className="rounded-md border border-background-200 bg-background-50 px-3 py-2 text-[13px] text-foreground-950 outline-none focus:border-primary-400"
                      />
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => {
                          if (newSeriesLabel && newSeriesKey) {
                            const newFamily: ChartFamily = {
                              id: newSeriesKey,
                              familyKey: newSeriesKey,
                              label: newSeriesLabel,
                              description: "Custom chart series",
                              defaultChartSize: chartSize,
                              defaultRegion: market,
                              editionFrequency: "weekly",
                              defaultRuleset: "csv_registry_import_v1",
                              defaultScoringModel: "csv_position_order",
                              createdAt: new Date().toISOString(),
                              updatedAt: new Date().toISOString(),
                            };
                            setFamilies((prev) => [...prev, newFamily]);
                            setExistingSeriesId(newSeriesKey);
                            setNewSeriesLabel("");
                            setNewSeriesKey("");
                          }
                        }}
                        className="rounded-md bg-primary-500 px-3 py-1.5 text-[12px] font-semibold text-background-50 hover:bg-primary-600"
                      >
                        Create Series
                      </button>
                      <button
                        onClick={() => { setExistingSeriesId(""); setNewSeriesLabel(""); setNewSeriesKey(""); }}
                        className="rounded-md border border-background-200 bg-background-50 px-3 py-1.5 text-[12px] font-semibold text-foreground-600 hover:bg-background-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4">
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-foreground-700">Chart Title *</label>
                  <input
                    type="text"
                    value={chartTitle}
                    onChange={(e) => setChartTitle(e.target.value)}
                    placeholder="e.g. WAKILISHA Top 40 — Week 22"
                    className="w-full rounded-md border border-background-200 bg-background-50 px-3 py-2 text-[13px] text-foreground-950 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-foreground-700">Chart Slug *</label>
                  <input
                    type="text"
                    value={chartSlug}
                    onChange={(e) => setChartSlug(e.target.value)}
                    placeholder="wakilisha-top-40-week-22"
                    className="w-full rounded-md border border-background-200 bg-background-50 px-3 py-2 text-[13px] text-foreground-950 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
                  />
                  {publicUrlPreview && (
                    <p className="mt-1 text-[11px] text-foreground-500">Public URL: <span className="font-semibold text-primary-600">{publicUrlPreview}</span></p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-4">
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-foreground-700">Edition Date *</label>
                  <input
                    type="date"
                    value={editionDate}
                    onChange={(e) => setEditionDate(e.target.value)}
                    className="w-full rounded-md border border-background-200 bg-background-50 px-3 py-2 text-[13px] text-foreground-950 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
                  />
                  <p className="mt-1 text-[11px] text-foreground-500">Usually the chart week (Monday)</p>
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-foreground-700">Chart Size *</label>
                  <div className="flex items-center gap-2">
                    <input type="range" min={10} max={100} step={10} value={chartSize} onChange={(e) => setChartSize(Number(e.target.value))} className="flex-1 accent-primary-500" />
                    <span className="w-10 text-right text-[13px] font-bold text-foreground-950">{chartSize}</span>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-foreground-700">Market *</label>
                  <select value={market} onChange={(e) => setMarket(e.target.value)} className="w-full rounded-md border border-background-200 bg-background-50 px-3 py-2 text-[13px] text-foreground-950 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400">
                    <option value="KE">Kenya (KE)</option>
                    <option value="NG">Nigeria (NG)</option>
                    <option value="ZA">South Africa (ZA)</option>
                    <option value="GH">Ghana (GH)</option>
                    <option value="UG">Uganda (UG)</option>
                    <option value="TZ">Tanzania (TZ)</option>
                    <option value="GLOBAL">Global</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="mb-1 block text-[12px] font-semibold text-foreground-700">Source URLs * (one per line)</label>
                <textarea
                  value={sourceUrls}
                  onChange={(e) => setSourceUrls(e.target.value)}
                  rows={3}
                  placeholder="https://open.spotify.com/playlist/...&#10;https://music.apple.com/..."
                  className="w-full rounded-md border border-background-200 bg-background-50 px-3 py-2 text-[13px] text-foreground-950 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
                />
                {detectedProviders.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {detectedProviders.map((p) => (
                      <ProviderChip key={p} provider={p} />
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4">
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-foreground-700">Chart Kind</label>
                  <div className="flex gap-2">
                    <KindToggle active={chartKind === "tracks"} onClick={() => setChartKind("tracks")} icon="ri-music-line" label="Tracks" />
                    <KindToggle active={chartKind === "releases"} onClick={() => setChartKind("releases")} icon="ri-album-line" label="Releases" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-foreground-700">Cover Style</label>
                  <select value={coverStyle} onChange={(e) => setCoverStyle(e.target.value)} className="w-full rounded-md border border-background-200 bg-background-50 px-3 py-2 text-[13px] text-foreground-950 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400">
                    <option value="default">Default</option>
                    <option value="genre">Genre</option>
                    <option value="minimal">Minimal</option>
                    <option value="editorial">Editorial</option>
                  </select>
                </div>
              </div>

              <div className="mb-5">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-background-200 bg-background-50 px-3 py-2 hover:bg-background-100 transition-colors w-fit">
                  <input type="checkbox" checked={saveAsRecurring} onChange={(e) => setSaveAsRecurring(e.target.checked)} className="h-4 w-4 rounded border-background-200 accent-primary-500" />
                  <span className="text-[13px] text-foreground-600">Save as recurring series</span>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-background-200">
                <button onClick={handleDryRun} disabled={dryRunLoading} className="inline-flex items-center gap-1.5 rounded-md bg-primary-500 px-5 py-2.5 text-[13px] font-semibold text-background-50 transition-all hover:bg-primary-600 hover:shadow-md active:scale-[0.98] disabled:opacity-50 whitespace-nowrap">
                  <i className={dryRunLoading ? "ri-loader-4-line animate-spin" : "ri-flask-line"} />
                  {dryRunLoading ? "Running dry run…" : "Run Dry Run"}
                </button>
                <button onClick={handleReset} className="inline-flex items-center gap-1.5 rounded-md border border-background-200 bg-background-50 px-4 py-2.5 text-[13px] font-semibold text-foreground-600 transition-colors hover:bg-background-100 whitespace-nowrap">
                  <i className="ri-refresh-line" />Reset
                </button>
              </div>
            </WkSurface>
          )}

          {step === "preview" && dryRunResult && (
            <div className="space-y-5 animate-hero-fade">
              <RunMetadataPanel run={dryRunResult} />
              <PipelinePanel run={dryRunResult} />
              <MatchSummary summary={dryRunResult.summary} />
              <PublishChecklist run={dryRunResult} />
              <WkSurface className="p-4 overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[14px] font-bold text-foreground-950">Chart Preview</h2>
                  <span className="text-[12px] text-foreground-500">Top {Math.min(10, dryRunResult.rows.length)} of {dryRunResult.rows.length}</span>
                </div>
                <div className="space-y-1">
                  {dryRunResult.rows.slice(0, 10).map((row, idx) => (
                    <MiniChartRow key={row.id} row={row} index={idx} />
                  ))}
                </div>
              </WkSurface>
              <WkSurface className="overflow-hidden">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-[14px] font-bold text-foreground-950">Resolved Rows</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-foreground-500">{dryRunResult.rows.length} rows</span>
                    <div className="flex flex-wrap gap-1">
                      {["all", "canonical", "shell", "no_match", "needs_review", "duplicate_candidate"].map((f) => (
                        <button key={f} onClick={() => setRowFilter(f)} className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all ${rowFilter === f ? "bg-primary-500 text-background-50" : "bg-background-100 text-foreground-600 hover:bg-background-200"}`}>
                          {f === "all" ? "All" : f.replace(/_/g, " ")}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-background-200">
                        <th className="px-4 py-3 font-semibold text-foreground-500">#</th>
                        <th className="px-4 py-3 font-semibold text-foreground-500">Title</th>
                        <th className="px-4 py-3 font-semibold text-foreground-500">Artist</th>
                        <th className="px-4 py-3 font-semibold text-foreground-500">Match</th>
                        <th className="px-4 py-3 font-semibold text-foreground-500">Confidence</th>
                        <th className="px-4 py-3 font-semibold text-foreground-500">Warnings</th>
                        <th className="px-4 py-3 font-semibold text-foreground-500" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row) => (
                        <RowTableRow key={row.id} row={row} expanded={expandedRowId === row.id} onToggle={() => setExpandedRowId(expandedRowId === row.id ? null : row.id)} />
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredRows.length === 0 && (
                  <div className="px-4 py-8 text-center text-[13px] text-foreground-500">No rows match the selected filter.</div>
                )}
              </WkSurface>
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={handleCommit} disabled={commitLoading} className="inline-flex items-center gap-1.5 rounded-md bg-primary-500 px-5 py-2.5 text-[13px] font-semibold text-background-50 transition-all hover:bg-primary-600 hover:shadow-md active:scale-[0.98] disabled:opacity-50 whitespace-nowrap">
                  <i className={commitLoading ? "ri-loader-4-line animate-spin" : "ri-check-double-line"} />
                  {commitLoading ? "Committing…" : "Commit Edition"}
                </button>
                <button onClick={() => setStep("configure")} className="inline-flex items-center gap-1.5 rounded-md border border-background-200 bg-background-50 px-4 py-2.5 text-[13px] font-semibold text-foreground-600 transition-colors hover:bg-background-100 whitespace-nowrap">
                  <i className="ri-arrow-left-line" />Back to Configure
                </button>
                <button onClick={() => navigate(`/admin/charts/ingest-runs/${dryRunResult.id}`)} className="inline-flex items-center gap-1.5 rounded-md border border-background-200 bg-background-50 px-4 py-2.5 text-[13px] font-semibold text-foreground-600 transition-colors hover:bg-background-100 whitespace-nowrap">
                  <i className="ri-external-link-line" />Open Run Detail
                </button>
              </div>
            </div>
          )}

          {step === "commit" && (
            <WkSurface className="p-8 text-center animate-hero-fade">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <i className="ri-check-double-line text-2xl text-green-600" />
              </div>
              <h2 className="mb-2 text-[20px] font-bold text-foreground-950">Edition Published!</h2>
              <p className="mb-6 text-[13px] text-foreground-600">Your chart edition has been committed and is now live. Redirecting to the run detail page…</p>
              <div className="flex items-center justify-center gap-3">
                <button onClick={handleReset} className="inline-flex items-center gap-1.5 rounded-md bg-primary-500 px-5 py-2.5 text-[13px] font-semibold text-background-50 transition-all hover:bg-primary-600 hover:shadow-md active:scale-[0.98] whitespace-nowrap">
                  <i className="ri-add-line" />Start New Ingest
                </button>
                <button onClick={() => navigate("/admin/charts/ingest-runs")} className="inline-flex items-center gap-1.5 rounded-md border border-background-200 bg-background-50 px-4 py-2.5 text-[13px] font-semibold text-foreground-600 transition-colors hover:bg-background-100 whitespace-nowrap">
                  <i className="ri-list-check" />View All Runs
                </button>
              </div>
            </WkSurface>
          )}
        </div>

        <div className="space-y-5">
          <ProviderHealthPanel />

          {activeRun && !dryRunResult && (
            <WkSurface className="p-4 border-l-4 border-l-primary-400">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[14px] font-bold text-foreground-950">Running Now</h2>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-primary-600">
                  <span className="inline-block h-2 w-2 rounded-full bg-primary-500 animate-pulse" />In progress
                </span>
              </div>
              <PipelinePanel run={activeRun} compact />
              <button onClick={() => navigate(`/admin/charts/ingest-runs/${activeRun.id}`)} className="mt-3 w-full rounded-md bg-primary-50 px-3 py-2 text-[12px] font-semibold text-primary-700 transition-colors hover:bg-primary-100">
                Monitor Run →
              </button>
            </WkSurface>
          )}

          {(guardStatus || dryRunResult) && (
            <ResourceGuardPanel guard={guardStatus} run={dryRunResult} />
          )}

          <WkSurface className="p-4">
            <h2 className="mb-3 text-[14px] font-bold text-foreground-950">Active Runs</h2>
            <div className="space-y-2">
              {runs
                .filter((r) => r.status === "running" || r.status === "draft" || r.status === "dry_run_complete")
                .slice(0, 4)
                .map((run) => (
                  <RunCard
                    key={run.id}
                    run={run}
                    onClick={() => navigate(`/admin/charts/ingest-runs/${run.id}`)}
                    onCancel={() => handleCancelRun(run.id)}
                    onRetry={() => handleRetryRun(run.id)}
                    cancelLoading={cancelLoading === run.id}
                    retryLoading={retryLoading === run.id}
                  />
                ))}
              {runs.filter((r) => r.status === "running" || r.status === "draft" || r.status === "dry_run_complete").length === 0 && (
                <p className="text-[13px] text-foreground-500">No active runs</p>
              )}
            </div>
          </WkSurface>

          <WkSurface className="p-4">
            <h2 className="mb-3 text-[14px] font-bold text-foreground-950">Recent Activity</h2>
            <div className="space-y-3">
              {activity.slice(0, 6).map((act) => (
                <ActivityItem key={act.id} activity={act} onClick={() => { if (act.runId) navigate(`/admin/charts/ingest-runs/${act.runId}`); }} />
              ))}
              {activity.length === 0 && (
                <p className="text-[13px] text-foreground-500">No recent activity</p>
              )}
            </div>
          </WkSurface>

          <WkSurface className="p-4">
            <h2 className="mb-3 text-[14px] font-bold text-foreground-950">Operations</h2>
            <div className="space-y-1">
              <NavButton icon="ri-git-pull-request-line" label="Review Queue" path="/admin/charts/review-queue" />
              <NavButton icon="ri-close-circle-line" label="No-match Releases" path="/admin/charts/no-match" />
              <NavButton icon="ri-folder-add-line" label="Release Shells" path="/admin/charts/release-shells" />
              <NavButton icon="ri-error-warning-line" label="Canon Gaps" path="/admin/charts/canon-gaps" />
              <NavButton icon="ri-history-line" label="Legacy Ingest Jobs" path="/admin/charts/ingest-jobs" />
            </div>
          </WkSurface>
        </div>
      </div>
    </div>
  );
}