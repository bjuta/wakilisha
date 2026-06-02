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
import type { BackendCommitResponse } from "@/services/backendContract/backendTypes";
import { wakilishaBackend } from "@/services/backendContract/backendClient";
import type { ChartEligibilityProfile } from "@/services/chartsEligibility/eligibilityTypes";
import { getMarketScopes, type StoredChartMarketScope } from "@/services/chartsMarkets/marketScopeStore";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { WkIcon } from "@/components/design-system/Icon";
import { GitPullRequest, XCircle, FolderPlus, AlertCircle, History, Music, Disc3 } from "lucide-react";

import { Stepper, type IngestStudioStep } from "./components/Stepper";
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
import { CommitResultPanel } from "./components/CommitResultPanel";
import { RulesStep } from "./components/RulesStep";
import { MarketScopeStep } from "./components/MarketScopeStep";
import { QuickTemplateButton, ProviderChip, KindToggle } from "./components/FormComponents";

const INPUT_CLASS = "w-full rounded-md border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none focus:border-wk-border-strong focus:ring-1 focus:ring-wk-brand/20";
const LABEL_CLASS = "mb-1 block text-[12px] font-semibold text-wk-text-soft";
const BTN_PRIMARY = "inline-flex items-center gap-1.5 rounded-md bg-wk-brand px-5 py-2.5 text-[13px] font-semibold text-wk-brand-on transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 whitespace-nowrap";
const BTN_GHOST = "inline-flex items-center gap-1.5 rounded-md border border-wk-border bg-wk-surface px-4 py-2.5 text-[13px] font-semibold text-wk-text-soft transition-colors hover:bg-wk-surface-raised whitespace-nowrap";

function toBackendCommitResponse(result: any): BackendCommitResponse {
  return {
    runId: result.runId,
    status: "committed",
    programId: result.programId,
    publicSlug: result.publicSlug,
    editionId: result.editionId,
    editionSlug: result.editionSlug,
    editionDate: result.editionDate,
    entryCount: result.entryCount,
    publicUrl: result.publicUrl,
    apiUrl: result.apiUrl,
    snapshotId: result.snapshotId ?? null,
    commitPersistence: result.commitPersistence ?? "local_only",
    publicAvailability: result.publicAvailability ?? "local_preview_only",
    integrity: result.integrity ?? { ok: false, warnings: ["Integrity response missing."], errors: [] },
    auditEventId: result.auditEventId ?? null,
  };
}

export default function AdminChartsIngest() {
  const navigate = useNavigate();
  const mode = getIngestionMode();

  const [kpis, setKpis] = useState<IngestStudioKpi | null>(null);
  const [activity, setActivity] = useState<RecentIngestActivity[]>([]);
  const [runs, setRuns] = useState<IngestRun[]>([]);
  const [families, setFamilies] = useState<ChartFamily[]>([]);
  const [eligibilityProfiles, setEligibilityProfiles] = useState<ChartEligibilityProfile[]>([]);
  const [marketScopes, setMarketScopes] = useState<StoredChartMarketScope[]>([]);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState<IngestStudioStep>("configure");

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
  const [selectedEligibilityProfileId, setSelectedEligibilityProfileId] = useState("elig_all_artists");
  const [selectedMarketScopeId, setSelectedMarketScopeId] = useState("scope_kenya");
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
  const [commitResult, setCommitResult] = useState<BackendCommitResponse | null>(null);

  const loadData = useCallback(async () => {
    const [k, a, r, f, eligibilityResult] = await Promise.all([
      getIngestKpis(),
      getRecentIngestActivity(),
      getIngestRuns(),
      getChartFamilies(),
      wakilishaBackend.charts.getEligibilityProfiles(),
    ]);
    const scopes = getMarketScopes();
    setKpis(k);
    setActivity(a);
    setRuns(r);
    setFamilies(f);
    setMarketScopes(scopes);
    if (!scopes.some((scope) => scope.id === selectedMarketScopeId)) {
      setSelectedMarketScopeId(scopes[0]?.id ?? "scope_kenya");
    }
    if (eligibilityResult.ok) {
      setEligibilityProfiles(eligibilityResult.data);
      if (!eligibilityResult.data.some((profile) => profile.id === selectedEligibilityProfileId)) {
        setSelectedEligibilityProfileId(eligibilityResult.data[0]?.id ?? "elig_all_artists");
      }
    } else {
      setFormError(eligibilityResult.error.message);
    }
    setLoading(false);
  }, [selectedEligibilityProfileId, selectedMarketScopeId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const urls = sourceUrls.split("\n").filter((u) => u.trim());
    setDetectedProviders(detectProvidersFromUrls(urls));
  }, [sourceUrls]);

  useEffect(() => {
    if (chartTitle && !chartSlug) {
      setChartSlug(chartTitle.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-").substring(0, 60));
    }
  }, [chartTitle]);

  useEffect(() => {
    if (!existingSeriesId || !editionDate || existingSeriesId === "__new__") { setEditionExistsWarning(null); return; }
    const dup = runs.find((r) => r.existingSeriesId === existingSeriesId && r.editionDate === editionDate && r.status !== "cancelled");
    setEditionExistsWarning(dup ? `An edition already exists for this series on ${editionDate} (${dup.chartTitle}). Committing will overwrite unless you change the date.` : null);
  }, [existingSeriesId, editionDate, runs]);

  const selectedFamily = useMemo(() => families.find((f) => f.id === existingSeriesId) || null, [families, existingSeriesId]);
  const selectedEligibilityProfile = useMemo(() => eligibilityProfiles.find((profile) => profile.id === selectedEligibilityProfileId || profile.slug === selectedEligibilityProfileId) || null, [eligibilityProfiles, selectedEligibilityProfileId]);
  const selectedMarketScope = useMemo(() => marketScopes.find((scope) => scope.id === selectedMarketScopeId || scope.slug === selectedMarketScopeId) || null, [marketScopes, selectedMarketScopeId]);

  useEffect(() => {
    if (selectedFamily) {
      setChartSize(selectedFamily.defaultChartSize);
      const regionToMarket: Record<string, string> = { Africa: "KE", Kenya: "KE", Nigeria: "NG", "South Africa": "ZA", Ghana: "GH", Uganda: "UG", Tanzania: "TZ" };
      setMarket(regionToMarket[selectedFamily.defaultRegion] || "KE");
    }
  }, [selectedFamily]);

  useEffect(() => {
    const firstMarket = selectedMarketScope?.includedMarkets[0]?.countryCode;
    if (firstMarket && firstMarket !== market) setMarket(firstMarket);
  }, [selectedMarketScope]);

  const publicUrlPreview = useMemo(() => chartSlug && editionDate ? `/charts/${chartSlug}/${editionDate}` : null, [chartSlug, editionDate]);

  function validateProgramStep(): string | null {
    if (!chartTitle.trim()) return "Chart title is required.";
    if (!chartSlug.trim()) return "Chart slug is required.";
    if (!editionDate) return "Edition date is required.";
    if (chartSize < 1 || chartSize > 100) return "Chart size must be between 1 and 100.";
    if (!existingSeriesId || existingSeriesId === "__new__") return "Select an existing chart series.";
    return null;
  }

  function validateForm(): string | null {
    const base = validateProgramStep();
    if (base) return base;
    if (!selectedEligibilityProfileId) return "Select an eligibility profile.";
    if (!selectedMarketScopeId) return "Select a market scope.";
    const urls = sourceUrls.split("\n").filter((u) => u.trim());
    if (urls.length === 0) return "At least one source URL is required.";
    const invalid = urls.filter((u) => !isValidProviderUrl(u));
    if (invalid.length > 0) return `Unrecognized provider URL(s): ${invalid.join(", ")}.`;
    return null;
  }

  function handleContinueToRules() {
    const error = validateProgramStep();
    if (error) { setFormError(error); return; }
    setFormError(null); setSuccessMessage(null); setStep("rules");
  }

  async function handleDryRun() {
    const error = validateForm();
    if (error) { setFormError(error); return; }
    setFormError(null); setDryRunLoading(true); setDryRunResult(null); setSuccessMessage(null); setExpandedRowId(null);
    try {
      const urls = sourceUrls.split("\n").filter((u) => u.trim());
      const response = await runDryRun({ chartTitle, chartSlug, editionDate, chartSize, market, chartKind, coverStyle, sourceUrls: urls, saveAsRecurringSeries: saveAsRecurring, existingSeriesId: existingSeriesId || null, eligibilityProfileId: selectedEligibilityProfileId });
      const run = await getIngestRuns().then((r) => r.find((x) => x.id === response.runId));
      if (run) {
        setDryRunResult(run); setStep("preview");
        setSuccessMessage(`Dry run complete — ${run.summary.totalRows} rows, ${run.summary.matchRate.toFixed(1)}% match rate${selectedEligibilityProfile ? ` · ${selectedEligibilityProfile.name}` : ""}${selectedMarketScope ? ` · ${selectedMarketScope.name}` : ""}`);
        const guard = await getResourceGuardStatus(run.id); setGuardStatus(guard);
      }
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Dry run failed";
      setFormError(msg.includes("rate limit") ? "Spotify rate limit exceeded." : msg.includes("credentials") ? "Provider credentials are missing." : msg.includes("Apple") ? "Apple Music token is missing." : msg.includes("all sources failed") ? "All sources failed to fetch." : `Dry run failed: ${msg}`);
    } finally { setDryRunLoading(false); }
  }

  async function handleCommit() {
    if (!dryRunResult) return;
    setCommitLoading(true); setFormError(null); setCommitResult(null);
    try {
      const result = await commitIngestRun({ runId: dryRunResult.id, publishImmediately: true });
      setCommitResult(toBackendCommitResponse(result)); setStep("commit"); setDryRunResult(null); await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Commit failed";
      if (msg.includes("duplicate_edition") || msg.includes("program_not_found") || msg.includes("unresolved_required_gaps") || msg.includes("commit_not_ready")) setFormError(msg.replace(/^[^:]+: /, ""));
      else if (msg.includes("no_rows_to_commit")) setFormError("No rows are eligible for commit. Resolve match statuses first.");
      else setFormError(`Commit failed: ${msg}`);
    } finally { setCommitLoading(false); }
  }

  function handleReset() {
    setStep("configure"); setDryRunResult(null); setFormError(null); setSuccessMessage(null); setGuardStatus(null); setExpandedRowId(null); setRowFilter("all"); setEditionExistsWarning(null); setCommitResult(null);
  }

  async function handleCancelRun(runId: string) { setCancelLoading(runId); try { await cancelIngestRun(runId); await loadData(); } catch (err) { setFormError(err instanceof Error ? err.message : "Cancel failed"); } finally { setCancelLoading(null); } }
  async function handleRetryRun(runId: string) { setRetryLoading(runId); try { await retryIngestRun(runId); await loadData(); } catch (err) { setFormError(err instanceof Error ? err.message : "Retry failed"); } finally { setRetryLoading(null); } }

  const filteredRows = useMemo(() => !dryRunResult ? [] : rowFilter === "all" ? dryRunResult.rows : dryRunResult.rows.filter((r) => r.matchStatus === rowFilter), [dryRunResult, rowFilter]);
  const activeRun = runs.find((r) => r.status === "running");

  if (loading) return <div className="flex h-96 flex-col items-center justify-center gap-3"><div className="h-8 w-8 animate-spin rounded-full border-2 border-wk-brand/30 border-t-wk-brand" /><p className="text-[13px] font-medium text-wk-text-muted">Loading Ingest Studio…</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">Chart Operations</div><h1 className="text-[22px] font-bold text-wk-text">Ingest Studio</h1><p className="text-[13px] text-wk-text-soft">Create chart editions from streaming playlists — program, rules, sources, review, commit</p></div><div className="flex items-center gap-2"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${mode === "mock" ? "bg-wk-warning-soft text-wk-warning" : "bg-wk-success-soft text-wk-success"}`}><WkIcon name={mode === "mock" ? "FlaskConical" : "Globe"} size={12} />{mode === "mock" ? "Mock Mode" : "WordPress Mode"}</span><button onClick={() => navigate("/admin/settings/charts/ingest-runs")} className={BTN_GHOST}><WkIcon name="List" size={14} />All Runs</button><button onClick={() => navigate("/admin/settings/charts/ingest-health")} className={BTN_GHOST}><WkIcon name="HeartPulse" size={14} />API Health</button></div></div>
      <Stepper step={step} onStepChange={(s) => { if (s === "configure") handleReset(); if (s === "rules") setStep("rules"); }} />
      {kpis && <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><KpiCard label="Editions This Week" value={String(kpis.editionsThisWeek)} trend="+1" positive /><KpiCard label="Match Rate" value={`${kpis.canonicalMatchRate.toFixed(1)}%`} trend="-1.2%" positive={kpis.canonicalMatchRate >= 85} /><KpiCard label="Awaiting Review" value={String(kpis.rowsAwaitingReview)} trend="-4" positive={kpis.rowsAwaitingReview < 20} /><KpiCard label="Avg Run Time" value={`${(kpis.averageRunTimeMs / 1000).toFixed(1)}s`} trend="-0.3s" positive /></div>}
      {formError && <div className="rounded-lg border border-wk-danger/20 bg-wk-danger-soft p-3"><div className="flex items-center gap-2 text-wk-danger"><WkIcon name="AlertCircle" size={16} /><span className="text-[13px] font-semibold">{formError}</span></div></div>}
      {successMessage && <div className="rounded-lg border border-wk-success/20 bg-wk-success-soft p-3"><div className="flex items-center gap-2 text-wk-success"><WkIcon name="CheckCircle2" size={16} /><span className="text-[13px] font-semibold">{successMessage}</span></div></div>}
      {editionExistsWarning && <div className="rounded-lg border border-wk-warning/20 bg-wk-warning-soft p-3"><div className="flex items-center gap-2 text-wk-warning"><WkIcon name="AlertTriangle" size={16} /><span className="text-[13px] font-semibold">{editionExistsWarning}</span></div></div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {step === "configure" && <WkSurface className="p-5"><h2 className="mb-4 text-[16px] font-bold text-wk-text">Program & Sources</h2><div className="mb-5"><label className={LABEL_CLASS}>Quick Start</label><div className="flex flex-wrap gap-2"><QuickTemplateButton label="Top 40 Kenya" onClick={() => { setChartTitle("WAKILISHA Top 40"); setChartSlug("wakilisha-top-40"); setChartSize(40); setMarket("KE"); setSelectedMarketScopeId("scope_kenya"); setExistingSeriesId("kenya"); setSelectedEligibilityProfileId("elig_all_artists"); setSaveAsRecurring(true); }} /><QuickTemplateButton label="Kenyan Artists Only" onClick={() => { setChartTitle("WAKILISHA Top 100 — Kenyan Artists"); setChartSlug("top-songs-kenya-artists-only"); setChartSize(100); setMarket("KE"); setSelectedMarketScopeId("scope_kenya"); setExistingSeriesId("kenya"); setSelectedEligibilityProfileId("elig_kenyan_artists_only"); setSaveAsRecurring(true); }} /><QuickTemplateButton label="Groups Only" onClick={() => { setChartTitle("WAKILISHA Groups & Collectives"); setChartSlug("groups-collectives-kenya"); setChartSize(40); setMarket("KE"); setSelectedMarketScopeId("scope_kenya"); setExistingSeriesId("kenya"); setSelectedEligibilityProfileId("elig_groups_collectives_only"); setSaveAsRecurring(true); }} /><QuickTemplateButton label="EA Artists" onClick={() => { setChartTitle("WAKILISHA East African Artists"); setChartSlug("east-african-artists"); setChartSize(100); setMarket("KE"); setSelectedMarketScopeId("scope_east_africa_ke_ug_tz"); setExistingSeriesId("kenya"); setSelectedEligibilityProfileId("elig_east_africa_selected_markets"); setSaveAsRecurring(true); }} /></div></div><div className="mb-4"><label className={LABEL_CLASS}>Chart Series *</label><select value={existingSeriesId} onChange={(e) => setExistingSeriesId(e.target.value)} className={INPUT_CLASS}><option value="">— Select a series —</option>{families.map((f) => <option key={f.id} value={f.id}>{f.label} ({f.familyKey})</option>)}<option value="__new__">+ Create new series…</option></select>{selectedFamily && <div className="mt-2 rounded-lg border border-wk-border bg-wk-surface-raised p-3"><div className="flex items-center gap-2 mb-1"><span className="text-[12px] font-bold text-wk-text">{selectedFamily.label}</span><span className="rounded bg-wk-bg-subtle px-1.5 py-0.5 text-[10px] font-semibold text-wk-text-muted">{selectedFamily.editionFrequency}</span><span className="rounded bg-wk-bg-subtle px-1.5 py-0.5 text-[10px] font-semibold text-wk-text-muted">{selectedFamily.defaultRegion}</span></div><p className="text-[11px] text-wk-text-muted">{selectedFamily.description}</p><div className="mt-2 flex flex-wrap gap-3 text-[11px] text-wk-text-soft"><span>Default size: <strong className="text-wk-text">{selectedFamily.defaultChartSize}</strong></span><span>Ruleset: <strong className="text-wk-text">{selectedFamily.defaultRuleset}</strong></span><span>Scoring: <strong className="text-wk-text">{selectedFamily.defaultScoringModel}</strong></span></div></div>}{existingSeriesId === "__new__" && <div className="mt-2 rounded-lg border border-wk-brand/20 bg-wk-brand-soft p-3"><p className="text-[12px] font-semibold text-wk-brand mb-2">Create New Series</p><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><input type="text" value={newSeriesLabel} onChange={(e) => { setNewSeriesLabel(e.target.value); setNewSeriesKey(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "")); }} placeholder="Series name" className={INPUT_CLASS} /><input type="text" value={newSeriesKey} onChange={(e) => setNewSeriesKey(e.target.value)} placeholder="series-key" className={INPUT_CLASS} /></div><div className="mt-2 flex gap-2"><button onClick={() => { if (newSeriesLabel && newSeriesKey) { const newFamily: ChartFamily = { id: newSeriesKey, familyKey: newSeriesKey, label: newSeriesLabel, description: "Custom chart series", defaultChartSize: chartSize, defaultRegion: market, editionFrequency: "weekly", defaultRuleset: "csv_registry_import_v1", defaultScoringModel: "csv_position_order", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; setFamilies((prev) => [...prev, newFamily]); setExistingSeriesId(newSeriesKey); setNewSeriesLabel(""); setNewSeriesKey(""); } }} className="wk-button wk-button-primary wk-button-sm whitespace-nowrap">Create Series</button><button onClick={() => { setExistingSeriesId(""); setNewSeriesLabel(""); setNewSeriesKey(""); }} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">Cancel</button></div></div>}</div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4"><div><label className={LABEL_CLASS}>Chart Title *</label><input type="text" value={chartTitle} onChange={(e) => setChartTitle(e.target.value)} placeholder="e.g. WAKILISHA Top 40 — Week 22" className={INPUT_CLASS} /></div><div><label className={LABEL_CLASS}>Chart Slug *</label><input type="text" value={chartSlug} onChange={(e) => setChartSlug(e.target.value)} placeholder="wakilisha-top-40-week-22" className={INPUT_CLASS} />{publicUrlPreview && <p className="mt-1 text-[11px] text-wk-text-muted">Public URL: <span className="font-semibold text-wk-brand">{publicUrlPreview}</span></p>}</div></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-4"><div><label className={LABEL_CLASS}>Edition Date *</label><input type="date" value={editionDate} onChange={(e) => setEditionDate(e.target.value)} className={INPUT_CLASS} /><p className="mt-1 text-[11px] text-wk-text-muted">Usually the chart week (Monday)</p></div><div><label className={LABEL_CLASS}>Chart Size *</label><div className="flex items-center gap-2"><input type="range" min={10} max={100} step={10} value={chartSize} onChange={(e) => setChartSize(Number(e.target.value))} className="flex-1 accent-wk-brand" /><span className="w-10 text-right text-[13px] font-bold text-wk-text">{chartSize}</span></div></div><div><label className={LABEL_CLASS}>Market *</label><select value={market} onChange={(e) => setMarket(e.target.value)} className={INPUT_CLASS}><option value="KE">Kenya (KE)</option><option value="NG">Nigeria (NG)</option><option value="ZA">South Africa (ZA)</option><option value="GH">Ghana (GH)</option><option value="UG">Uganda (UG)</option><option value="TZ">Tanzania (TZ)</option><option value="GLOBAL">Global</option></select></div></div><div className="mb-4"><label className={LABEL_CLASS}>Source URLs * (one per line)</label><textarea value={sourceUrls} onChange={(e) => setSourceUrls(e.target.value)} rows={3} placeholder="https://open.spotify.com/playlist/...&#10;https://music.apple.com/..." className={`${INPUT_CLASS} resize-none`} />{detectedProviders.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2">{detectedProviders.map((p) => <ProviderChip key={p} provider={p} />)}</div>}</div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4"><div><label className={LABEL_CLASS}>Chart Kind</label><div className="flex gap-2"><KindToggle active={chartKind === "tracks"} onClick={() => setChartKind("tracks")} icon={Music} label="Tracks" /><KindToggle active={chartKind === "releases"} onClick={() => setChartKind("releases")} icon={Disc3} label="Releases" /></div></div><div><label className={LABEL_CLASS}>Cover Style</label><select value={coverStyle} onChange={(e) => setCoverStyle(e.target.value)} className={INPUT_CLASS}><option value="default">Default</option><option value="genre">Genre</option><option value="minimal">Minimal</option><option value="editorial">Editorial</option></select></div></div><div className="mb-5"><label className="flex cursor-pointer items-center gap-2 rounded-lg border border-wk-border bg-wk-surface px-3 py-2 hover:bg-wk-surface-raised transition-colors w-fit"><input type="checkbox" checked={saveAsRecurring} onChange={(e) => setSaveAsRecurring(e.target.checked)} className="h-4 w-4 rounded border-wk-border accent-wk-brand" /><span className="text-[13px] text-wk-text-soft">Save as recurring series</span></label></div><div className="flex flex-wrap items-center gap-3 pt-2 border-t border-wk-divider"><button onClick={handleContinueToRules} className={BTN_PRIMARY}><WkIcon name="SlidersHorizontal" size={14} />Continue to Rules</button><button onClick={handleReset} className={BTN_GHOST}><WkIcon name="RotateCcw" size={14} />Reset</button></div></WkSurface>}
          {step === "rules" && <div className="space-y-5"><MarketScopeStep scopes={marketScopes} selectedMarketScopeId={selectedMarketScopeId} onSelectMarketScope={setSelectedMarketScopeId} /><RulesStep profiles={eligibilityProfiles} selectedEligibilityProfileId={selectedEligibilityProfileId} onSelectEligibilityProfile={setSelectedEligibilityProfileId} onBack={() => setStep("configure")} onContinue={handleDryRun} /></div>}
          {step === "preview" && dryRunResult && <div className="space-y-5"><RunMetadataPanel run={dryRunResult} />{selectedMarketScope && <WkSurface className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-[14px] font-bold text-wk-text">Market Scope</h2><p className="mt-1 text-[12px] text-wk-text-soft">{selectedMarketScope.name} · {selectedMarketScope.aggregationMode.replace(/_/g, " ")}</p><p className="mt-1 text-[11px] text-wk-text-muted">{selectedMarketScope.includedMarkets.map((m) => `${m.marketSlug} (${m.countryCode})`).join(" · ")}</p></div><span className="rounded-full bg-wk-brand-soft px-2.5 py-1 text-[11px] font-bold text-wk-brand">{selectedMarketScope.primaryMarketSlug}</span></div></WkSurface>}{selectedEligibilityProfile && <WkSurface className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-[14px] font-bold text-wk-text">Eligibility Profile</h2><p className="mt-1 text-[12px] text-wk-text-soft">{selectedEligibilityProfile.name} · {selectedEligibilityProfile.slug}</p><p className="mt-1 text-[11px] text-wk-text-muted">{selectedEligibilityProfile.description}</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${selectedEligibilityProfile.visibility === "public" ? "bg-wk-success-soft text-wk-success" : "bg-wk-warning-soft text-wk-warning"}`}>{selectedEligibilityProfile.visibility === "public" ? "Public label allowed" : "Admin-only rules"}</span></div></WkSurface>}<PipelinePanel run={dryRunResult} /><MatchSummary summary={dryRunResult.summary} runId={dryRunResult.id} /><PublishChecklist run={dryRunResult} onCommit={handleCommit} commitLoading={commitLoading} commitError={formError && formError.includes("Commit") ? formError : null} /><WkSurface className="p-4 overflow-hidden"><div className="flex items-center justify-between mb-3"><h2 className="text-[14px] font-bold text-wk-text">Chart Preview</h2><span className="text-[12px] text-wk-text-muted">Top {Math.min(10, dryRunResult.rows.length)} of {dryRunResult.rows.length}</span></div><div className="space-y-1">{dryRunResult.rows.slice(0, 10).map((row, idx) => <MiniChartRow key={row.id} row={row} index={idx} />)}</div></WkSurface><WkSurface className="overflow-hidden"><div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-[14px] font-bold text-wk-text">Resolved Rows</h2><div className="flex items-center gap-2"><span className="text-[12px] text-wk-text-muted">{dryRunResult.rows.length} rows</span><div className="flex flex-wrap gap-1">{["all", "canonical", "shell", "no_match", "needs_review", "duplicate_candidate"].map((f) => <button key={f} onClick={() => setRowFilter(f)} className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all ${rowFilter === f ? "bg-wk-brand text-wk-brand-on" : "bg-wk-surface-raised text-wk-text-soft hover:bg-wk-border"}`}>{f === "all" ? "All" : f.replace(/_/g, " ")}</button>)}</div></div></div><div className="overflow-x-auto"><table className="w-full text-left text-[13px]"><thead><tr className="border-b border-wk-border">{["#", "Title & Artist", "Match", "Confidence", "Warnings", "Decision", ""].map((h, i) => <th key={i} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-wk-text-muted">{h}</th>)}</tr></thead><tbody>{filteredRows.map((row) => <RowTableRow key={row.id} row={row} expanded={expandedRowId === row.id} onToggle={() => setExpandedRowId(expandedRowId === row.id ? null : row.id)} onDecisionApplied={() => {}} />)}</tbody></table></div>{filteredRows.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-wk-text-muted">No rows match the selected filter.</div>}</WkSurface><div className="flex flex-wrap items-center gap-3"><button onClick={() => setStep("rules")} className={BTN_GHOST}><WkIcon name="ArrowLeft" size={14} />Back to Rules</button><button onClick={() => navigate(`/admin/settings/charts/ingest-runs/${dryRunResult.id}`)} className={BTN_GHOST}><WkIcon name="ExternalLink" size={14} />Open Run Detail</button></div></div>}
          {step === "commit" && commitResult && <CommitResultPanel result={commitResult} onNewIngest={handleReset} />}
        </div>
        <div className="space-y-5"><ProviderHealthPanel />{selectedMarketScope && (step === "configure" || step === "rules") && <WkSurface className="p-4 border-l-4 border-l-wk-brand"><h2 className="mb-2 text-[14px] font-bold text-wk-text">Selected Market Scope</h2><p className="text-[12px] font-semibold text-wk-text-soft">{selectedMarketScope.name}</p><p className="mt-1 text-[11px] text-wk-text-muted">{selectedMarketScope.includedMarkets.map((m) => m.countryCode).join(" + ")} · {selectedMarketScope.aggregationMode.replace(/_/g, " ")}</p></WkSurface>}{selectedEligibilityProfile && (step === "configure" || step === "rules") && <WkSurface className="p-4 border-l-4 border-l-wk-brand"><h2 className="mb-2 text-[14px] font-bold text-wk-text">Selected Rules</h2><p className="text-[12px] font-semibold text-wk-text-soft">{selectedEligibilityProfile.name}</p><p className="mt-1 text-[11px] text-wk-text-muted">{selectedEligibilityProfile.description}</p></WkSurface>}{activeRun && !dryRunResult && <WkSurface className="p-4 border-l-4 border-l-wk-brand"><div className="flex items-center justify-between mb-2"><h2 className="text-[14px] font-bold text-wk-text">Running Now</h2><span className="flex items-center gap-1 text-[11px] font-semibold text-wk-brand"><span className="inline-block h-2 w-2 rounded-full bg-wk-brand animate-pulse" />In progress</span></div><PipelinePanel run={activeRun} compact /><button onClick={() => navigate(`/admin/settings/charts/ingest-runs/${activeRun.id}`)} className="mt-3 w-full rounded-md bg-wk-brand-soft px-3 py-2 text-[12px] font-semibold text-wk-brand transition-colors hover:bg-wk-brand/20">Monitor Run →</button></WkSurface>}{(guardStatus || dryRunResult) && <ResourceGuardPanel guard={guardStatus} run={dryRunResult} />}<WkSurface className="p-4"><h2 className="mb-3 text-[14px] font-bold text-wk-text">Active Runs</h2><div className="space-y-2">{runs.filter((r) => r.status === "running" || r.status === "draft" || r.status === "dry_run_complete").slice(0, 4).map((run) => <RunCard key={run.id} run={run} onClick={() => navigate(`/admin/settings/charts/ingest-runs/${run.id}`)} onCancel={() => handleCancelRun(run.id)} onRetry={() => handleRetryRun(run.id)} cancelLoading={cancelLoading === run.id} retryLoading={retryLoading === run.id} />)}{runs.filter((r) => r.status === "running" || r.status === "draft" || r.status === "dry_run_complete").length === 0 && <p className="text-[13px] text-wk-text-muted">No active runs</p>}</div></WkSurface><WkSurface className="p-4"><h2 className="mb-3 text-[14px] font-bold text-wk-text">Recent Activity</h2><div className="space-y-3">{activity.slice(0, 6).map((act) => <ActivityItem key={act.id} activity={act} onClick={() => { if (act.runId) navigate(`/admin/settings/charts/ingest-runs/${act.runId}`); }} />)}{activity.length === 0 && <p className="text-[13px] text-wk-text-muted">No recent activity</p>}</div></WkSurface><WkSurface className="p-4"><h2 className="mb-3 text-[14px] font-bold text-wk-text">Operations</h2><div className="space-y-1"><NavButton icon={GitPullRequest} label="Review Queue" path="/admin/settings/charts/review-queue" /><NavButton icon={XCircle} label="No-match Releases" path="/admin/settings/charts/no-match" /><NavButton icon={FolderPlus} label="Release Shells" path="/admin/settings/charts/release-shells" /><NavButton icon={AlertCircle} label="Canon Gaps" path="/admin/settings/charts/canon-gaps" /><NavButton icon={History} label="Legacy Ingest Jobs" path="/admin/settings/charts/ingest-jobs" /></div></WkSurface></div>
      </div>
    </div>
  );
}
