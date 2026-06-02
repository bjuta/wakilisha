import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  cancelIngestRun,
  commitIngestRun,
  detectProvidersFromUrls,
  getChartFamilies,
  getIngestKpis,
  getIngestRuns,
  getIngestionMode,
  getRecentIngestActivity,
  getResourceGuardStatus,
  isValidProviderUrl,
  retryIngestRun,
  runDryRun,
} from "@/services/chartsIngestion/client";
import type {
  IngestRun,
  IngestStudioKpi,
  ProviderName,
  RecentIngestActivity,
  ResourceGuardStatus,
} from "@/services/chartsIngestion/ingestStudioTypes";
import type { ChartFamily } from "@/services/chartsIngestion/types";
import type { BackendCommitResponse } from "@/services/backendContract/backendTypes";
import { wakilishaBackend } from "@/services/backendContract/backendClient";
import type { ChartEligibilityProfile } from "@/services/chartsEligibility/eligibilityTypes";
import { getMarketScopes, type StoredChartMarketScope } from "@/services/chartsMarkets/marketScopeStore";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AlertCircle, FolderPlus, GitPullRequest, History, XCircle } from "lucide-react";

import { ActivityItem } from "./components/ActivityItem";
import { CommitResultPanel } from "./components/CommitResultPanel";
import { KpiCard } from "./components/KpiCard";
import { MarketScopeStep } from "./components/MarketScopeStep";
import { MatchSummary } from "./components/MatchSummary";
import { MiniChartRow, RowTableRow } from "./components/RowComponents";
import { NavButton } from "./components/NavButton";
import { PipelinePanel } from "./components/PipelinePanel";
import { ProgramSetupStep } from "./components/ProgramSetupStep";
import { ProviderHealthPanel } from "./components/ProviderHealthPanel";
import { PublishChecklist } from "./components/PublishChecklist";
import { ResourceGuardPanel } from "./components/ResourceGuardPanel";
import { RulesStep } from "./components/RulesStep";
import { RunCard } from "./components/RunCard";
import { RunMetadataPanel } from "./components/RunMetadataPanel";
import { Stepper, type IngestStudioStep } from "./components/Stepper";

const ADMIN_CHARTS_BASE = "/admin/settings/charts";
const BTN_GHOST = "inline-flex items-center gap-1.5 rounded-md border border-wk-border bg-wk-surface px-4 py-2.5 text-[13px] font-semibold text-wk-text-soft transition-colors hover:bg-wk-surface-raised whitespace-nowrap";

type QuickTemplateKey = "top40" | "kenyan" | "groups" | "eastAfrica";

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

function createCustomFamily(label: string, key: string, chartSize: number, market: string): ChartFamily {
  const timestamp = new Date().toISOString();
  return {
    id: key,
    familyKey: key,
    label,
    description: "Custom chart series",
    defaultChartSize: chartSize,
    defaultRegion: market,
    editionFrequency: "weekly",
    defaultRuleset: "csv_registry_import_v1",
    defaultScoringModel: "csv_position_order",
    createdAt: timestamp,
    updatedAt: timestamp,
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
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
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
  const [rowFilter, setRowFilter] = useState("all");
  const [guardStatus, setGuardStatus] = useState<ResourceGuardStatus | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [editionExistsWarning, setEditionExistsWarning] = useState<string | null>(null);
  const [newSeriesLabel, setNewSeriesLabel] = useState("");
  const [newSeriesKey, setNewSeriesKey] = useState("");
  const [cancelLoading, setCancelLoading] = useState<string | null>(null);
  const [retryLoading, setRetryLoading] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<BackendCommitResponse | null>(null);

  const loadData = useCallback(async () => {
    const [kpiData, recentActivity, ingestRuns, chartFamilies, eligibilityResult] = await Promise.all([
      getIngestKpis(),
      getRecentIngestActivity(),
      getIngestRuns(),
      getChartFamilies(),
      wakilishaBackend.charts.getEligibilityProfiles(),
    ]);
    const scopes = getMarketScopes();

    setKpis(kpiData);
    setActivity(recentActivity);
    setRuns(ingestRuns);
    setFamilies(chartFamilies);
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

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setDetectedProviders(detectProvidersFromUrls(sourceUrls.split("\n").filter((url) => url.trim())));
  }, [sourceUrls]);

  useEffect(() => {
    if (chartTitle && !chartSlug) {
      setChartSlug(chartTitle.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-").substring(0, 60));
    }
  }, [chartTitle, chartSlug]);

  useEffect(() => {
    if (!existingSeriesId || !editionDate || existingSeriesId === "__new__") {
      setEditionExistsWarning(null);
      return;
    }
    const duplicate = runs.find((run) => run.existingSeriesId === existingSeriesId && run.editionDate === editionDate && run.status !== "cancelled");
    setEditionExistsWarning(duplicate ? `An edition already exists for this series on ${editionDate} (${duplicate.chartTitle}). Committing will overwrite unless you change the date.` : null);
  }, [existingSeriesId, editionDate, runs]);

  const selectedFamily = useMemo(() => families.find((family) => family.id === existingSeriesId) ?? null, [families, existingSeriesId]);
  const selectedEligibilityProfile = useMemo(() => eligibilityProfiles.find((profile) => profile.id === selectedEligibilityProfileId || profile.slug === selectedEligibilityProfileId) ?? null, [eligibilityProfiles, selectedEligibilityProfileId]);
  const selectedMarketScope = useMemo(() => marketScopes.find((scope) => scope.id === selectedMarketScopeId || scope.slug === selectedMarketScopeId) ?? null, [marketScopes, selectedMarketScopeId]);
  const publicUrlPreview = useMemo(() => (chartSlug && editionDate ? `/charts/${chartSlug}/${editionDate}` : null), [chartSlug, editionDate]);
  const filteredRows = useMemo(() => {
    if (!dryRunResult) return [];
    return rowFilter === "all" ? dryRunResult.rows : dryRunResult.rows.filter((row) => row.matchStatus === rowFilter);
  }, [dryRunResult, rowFilter]);
  const activeRun = runs.find((run) => run.status === "running");

  useEffect(() => {
    if (!selectedFamily) return;
    setChartSize(selectedFamily.defaultChartSize);
    const regionToMarket: Record<string, string> = { Africa: "KE", Kenya: "KE", Nigeria: "NG", "South Africa": "ZA", Ghana: "GH", Uganda: "UG", Tanzania: "TZ" };
    setMarket(regionToMarket[selectedFamily.defaultRegion] ?? "KE");
  }, [selectedFamily]);

  useEffect(() => {
    const firstMarket = selectedMarketScope?.includedMarkets[0]?.countryCode;
    if (firstMarket && firstMarket !== market) setMarket(firstMarket);
  }, [selectedMarketScope, market]);

  function validateProgramStep(): string | null {
    if (!chartTitle.trim()) return "Chart title is required.";
    if (!chartSlug.trim()) return "Chart slug is required.";
    if (!editionDate) return "Edition date is required.";
    if (chartSize < 1 || chartSize > 100) return "Chart size must be between 1 and 100.";
    if (!existingSeriesId || existingSeriesId === "__new__") return "Select an existing chart series.";
    return null;
  }

  function validateForm(): string | null {
    const programError = validateProgramStep();
    if (programError) return programError;
    if (!selectedEligibilityProfileId) return "Select an eligibility profile.";
    if (!selectedMarketScopeId) return "Select a market scope.";

    const urls = sourceUrls.split("\n").filter((url) => url.trim());
    if (urls.length === 0) return "At least one source URL is required.";

    const invalid = urls.filter((url) => !isValidProviderUrl(url));
    if (invalid.length > 0) return `Unrecognized provider URL(s): ${invalid.join(", ")}.`;
    return null;
  }

  function handleQuickTemplate(template: QuickTemplateKey) {
    const templates: Record<QuickTemplateKey, { title: string; slug: string; size: number; market: string; marketScopeId: string; seriesId: string; eligibilityProfileId: string }> = {
      top40: { title: "WAKILISHA Top 40", slug: "wakilisha-top-40", size: 40, market: "KE", marketScopeId: "scope_kenya", seriesId: "kenya", eligibilityProfileId: "elig_all_artists" },
      kenyan: { title: "WAKILISHA Top 100 — Kenyan Artists", slug: "top-songs-kenya-artists-only", size: 100, market: "KE", marketScopeId: "scope_kenya", seriesId: "kenya", eligibilityProfileId: "elig_kenyan_artists_only" },
      groups: { title: "WAKILISHA Groups & Collectives", slug: "groups-collectives-kenya", size: 40, market: "KE", marketScopeId: "scope_kenya", seriesId: "kenya", eligibilityProfileId: "elig_groups_collectives_only" },
      eastAfrica: { title: "WAKILISHA East African Artists", slug: "east-african-artists", size: 100, market: "KE", marketScopeId: "scope_east_africa_ke_ug_tz", seriesId: "kenya", eligibilityProfileId: "elig_east_africa_selected_markets" },
    };
    const selected = templates[template];
    setChartTitle(selected.title);
    setChartSlug(selected.slug);
    setChartSize(selected.size);
    setMarket(selected.market);
    setSelectedMarketScopeId(selected.marketScopeId);
    setExistingSeriesId(selected.seriesId);
    setSelectedEligibilityProfileId(selected.eligibilityProfileId);
    setSaveAsRecurring(true);
  }

  function handleCreateSeries() {
    if (!newSeriesLabel || !newSeriesKey) return;
    const newFamily = createCustomFamily(newSeriesLabel, newSeriesKey, chartSize, market);
    setFamilies((previous) => [...previous, newFamily]);
    setExistingSeriesId(newSeriesKey);
    setNewSeriesLabel("");
    setNewSeriesKey("");
  }

  function handleContinueToRules() {
    const error = validateProgramStep();
    if (error) {
      setFormError(error);
      return;
    }
    setFormError(null);
    setSuccessMessage(null);
    setStep("rules");
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
      const urls = sourceUrls.split("\n").filter((url) => url.trim());
      const response = await runDryRun({ chartTitle, chartSlug, editionDate, chartSize, market, chartKind, coverStyle, sourceUrls: urls, saveAsRecurringSeries: saveAsRecurring, existingSeriesId: existingSeriesId || null, eligibilityProfileId: selectedEligibilityProfileId });
      const run = await getIngestRuns().then((allRuns) => allRuns.find((item) => item.id === response.runId));

      if (run) {
        setDryRunResult(run);
        setStep("preview");
        setSuccessMessage(`Dry run complete — ${run.summary.totalRows} rows, ${run.summary.matchRate.toFixed(1)}% match rate${selectedEligibilityProfile ? ` · ${selectedEligibilityProfile.name}` : ""}${selectedMarketScope ? ` · ${selectedMarketScope.name}` : ""}`);
        setGuardStatus(await getResourceGuardStatus(run.id));
      }
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Dry run failed";
      setFormError(message.includes("rate limit") ? "Spotify rate limit exceeded." : message.includes("credentials") ? "Provider credentials are missing." : message.includes("Apple") ? "Apple Music token is missing." : message.includes("all sources failed") ? "All sources failed to fetch." : `Dry run failed: ${message}`);
    } finally {
      setDryRunLoading(false);
    }
  }

  async function handleCommit() {
    if (!dryRunResult) return;
    setCommitLoading(true);
    setFormError(null);
    setCommitResult(null);

    try {
      const result = await commitIngestRun({ runId: dryRunResult.id, publishImmediately: true });
      setCommitResult(toBackendCommitResponse(result));
      setStep("commit");
      setDryRunResult(null);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Commit failed";
      if (message.includes("duplicate_edition") || message.includes("program_not_found") || message.includes("unresolved_required_gaps") || message.includes("commit_not_ready")) setFormError(message.replace(/^[^:]+: /, ""));
      else if (message.includes("no_rows_to_commit")) setFormError("No rows are eligible for commit. Resolve match statuses first.");
      else setFormError(`Commit failed: ${message}`);
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
    setCommitResult(null);
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

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-wk-brand/30 border-t-wk-brand" />
        <p className="text-[13px] font-medium text-wk-text-muted">Loading Ingest Studio…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">Chart Operations</div>
          <h1 className="text-[22px] font-bold text-wk-text">Ingest Studio</h1>
          <p className="text-[13px] text-wk-text-soft">Create chart editions from streaming playlists — program, rules, sources, review, commit</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${mode === "mock" ? "bg-wk-warning-soft text-wk-warning" : "bg-wk-success-soft text-wk-success"}`}>
            <WkIcon name={mode === "mock" ? "FlaskConical" : "Globe"} size={12} />{mode === "mock" ? "Mock Mode" : "WordPress Mode"}
          </span>
          <button onClick={() => navigate(`${ADMIN_CHARTS_BASE}/ingest-runs`)} className={BTN_GHOST}><WkIcon name="List" size={14} />All Runs</button>
          <button onClick={() => navigate(`${ADMIN_CHARTS_BASE}/ingest-health`)} className={BTN_GHOST}><WkIcon name="HeartPulse" size={14} />API Health</button>
        </div>
      </div>

      <Stepper step={step} onStepChange={(nextStep) => { if (nextStep === "configure") handleReset(); if (nextStep === "rules") setStep("rules"); }} />

      {kpis && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Editions This Week" value={String(kpis.editionsThisWeek)} trend="+1" positive />
          <KpiCard label="Match Rate" value={`${kpis.canonicalMatchRate.toFixed(1)}%`} trend="-1.2%" positive={kpis.canonicalMatchRate >= 85} />
          <KpiCard label="Awaiting Review" value={String(kpis.rowsAwaitingReview)} trend="-4" positive={kpis.rowsAwaitingReview < 20} />
          <KpiCard label="Avg Run Time" value={`${(kpis.averageRunTimeMs / 1000).toFixed(1)}s`} trend="-0.3s" positive />
        </div>
      )}

      {formError && <StatusBanner tone="danger" icon="AlertCircle" message={formError} />}
      {successMessage && <StatusBanner tone="success" icon="CheckCircle2" message={successMessage} />}
      {editionExistsWarning && <StatusBanner tone="warning" icon="AlertTriangle" message={editionExistsWarning} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {step === "configure" && (
            <ProgramSetupStep
              families={families}
              selectedFamily={selectedFamily}
              existingSeriesId={existingSeriesId}
              setExistingSeriesId={setExistingSeriesId}
              newSeriesLabel={newSeriesLabel}
              setNewSeriesLabel={setNewSeriesLabel}
              newSeriesKey={newSeriesKey}
              setNewSeriesKey={setNewSeriesKey}
              onCreateSeries={handleCreateSeries}
              chartTitle={chartTitle}
              setChartTitle={setChartTitle}
              chartSlug={chartSlug}
              setChartSlug={setChartSlug}
              publicUrlPreview={publicUrlPreview}
              editionDate={editionDate}
              setEditionDate={setEditionDate}
              chartSize={chartSize}
              setChartSize={setChartSize}
              market={market}
              setMarket={setMarket}
              sourceUrls={sourceUrls}
              setSourceUrls={setSourceUrls}
              detectedProviders={detectedProviders}
              chartKind={chartKind}
              setChartKind={setChartKind}
              coverStyle={coverStyle}
              setCoverStyle={setCoverStyle}
              saveAsRecurring={saveAsRecurring}
              setSaveAsRecurring={setSaveAsRecurring}
              onQuickTemplate={handleQuickTemplate}
              onContinueToRules={handleContinueToRules}
              onReset={handleReset}
            />
          )}

          {step === "rules" && (
            <div className="space-y-5">
              <MarketScopeStep scopes={marketScopes} selectedMarketScopeId={selectedMarketScopeId} onSelectMarketScope={setSelectedMarketScopeId} />
              <RulesStep profiles={eligibilityProfiles} selectedEligibilityProfileId={selectedEligibilityProfileId} onSelectEligibilityProfile={setSelectedEligibilityProfileId} onBack={() => setStep("configure")} onContinue={handleDryRun} />
              {dryRunLoading && <StatusBanner tone="info" icon="RefreshCcw" message="Running dry run…" />}
            </div>
          )}

          {step === "preview" && dryRunResult && (
            <PreviewStep
              run={dryRunResult}
              selectedMarketScope={selectedMarketScope}
              selectedEligibilityProfile={selectedEligibilityProfile}
              filteredRows={filteredRows}
              rowFilter={rowFilter}
              setRowFilter={setRowFilter}
              expandedRowId={expandedRowId}
              setExpandedRowId={setExpandedRowId}
              onCommit={handleCommit}
              commitLoading={commitLoading}
              commitError={formError && formError.includes("Commit") ? formError : null}
              onBackToRules={() => setStep("rules")}
              onOpenRun={() => navigate(`${ADMIN_CHARTS_BASE}/ingest-runs/${dryRunResult.id}`)}
            />
          )}

          {step === "commit" && commitResult && <CommitResultPanel result={commitResult} onNewIngest={handleReset} />}
        </div>

        <IngestSidebar
          activeRun={activeRun}
          dryRunResult={dryRunResult}
          selectedMarketScope={selectedMarketScope}
          selectedEligibilityProfile={selectedEligibilityProfile}
          guardStatus={guardStatus}
          runs={runs}
          activity={activity}
          cancelLoading={cancelLoading}
          retryLoading={retryLoading}
          onNavigate={navigate}
          onCancelRun={handleCancelRun}
          onRetryRun={handleRetryRun}
        />
      </div>
    </div>
  );
}

function StatusBanner({ tone, icon, message }: { tone: "danger" | "success" | "warning" | "info"; icon: string; message: string }) {
  const classes = {
    danger: "border-wk-danger/20 bg-wk-danger-soft text-wk-danger",
    success: "border-wk-success/20 bg-wk-success-soft text-wk-success",
    warning: "border-wk-warning/20 bg-wk-warning-soft text-wk-warning",
    info: "border-wk-brand/20 bg-wk-brand-soft text-wk-brand",
  }[tone];

  return (
    <div className={`rounded-lg border p-3 ${classes}`}>
      <div className="flex items-center gap-2"><WkIcon name={icon as any} size={16} /><span className="text-[13px] font-semibold">{message}</span></div>
    </div>
  );
}

function PreviewStep({
  run,
  selectedMarketScope,
  selectedEligibilityProfile,
  filteredRows,
  rowFilter,
  setRowFilter,
  expandedRowId,
  setExpandedRowId,
  onCommit,
  commitLoading,
  commitError,
  onBackToRules,
  onOpenRun,
}: {
  run: IngestRun;
  selectedMarketScope: StoredChartMarketScope | null;
  selectedEligibilityProfile: ChartEligibilityProfile | null;
  filteredRows: IngestRun["rows"];
  rowFilter: string;
  setRowFilter: (value: string) => void;
  expandedRowId: string | null;
  setExpandedRowId: (value: string | null) => void;
  onCommit: () => void;
  commitLoading: boolean;
  commitError: string | null;
  onBackToRules: () => void;
  onOpenRun: () => void;
}) {
  return (
    <div className="space-y-5">
      <RunMetadataPanel run={run} />
      {selectedMarketScope && <MarketScopeSummary scope={selectedMarketScope} />}
      {selectedEligibilityProfile && <EligibilitySummary profile={selectedEligibilityProfile} />}
      <PipelinePanel run={run} />
      <MatchSummary summary={run.summary} runId={run.id} />
      <PublishChecklist run={run} onCommit={onCommit} commitLoading={commitLoading} commitError={commitError} />
      <ChartPreview run={run} />
      <ResolvedRowsTable rows={filteredRows} totalRows={run.rows.length} rowFilter={rowFilter} setRowFilter={setRowFilter} expandedRowId={expandedRowId} setExpandedRowId={setExpandedRowId} />
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBackToRules} className={BTN_GHOST}><WkIcon name="ArrowLeft" size={14} />Back to Rules</button>
        <button onClick={onOpenRun} className={BTN_GHOST}><WkIcon name="ExternalLink" size={14} />Open Run Detail</button>
      </div>
    </div>
  );
}

function MarketScopeSummary({ scope }: { scope: StoredChartMarketScope }) {
  return (
    <WkSurface className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-bold text-wk-text">Market Scope</h2>
          <p className="mt-1 text-[12px] text-wk-text-soft">{scope.name} · {scope.aggregationMode.replace(/_/g, " ")}</p>
          <p className="mt-1 text-[11px] text-wk-text-muted">{scope.includedMarkets.map((item) => `${item.marketSlug} (${item.countryCode})`).join(" · ")}</p>
        </div>
        <span className="rounded-full bg-wk-brand-soft px-2.5 py-1 text-[11px] font-bold text-wk-brand">{scope.primaryMarketSlug}</span>
      </div>
    </WkSurface>
  );
}

function EligibilitySummary({ profile }: { profile: ChartEligibilityProfile }) {
  return (
    <WkSurface className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-bold text-wk-text">Eligibility Profile</h2>
          <p className="mt-1 text-[12px] text-wk-text-soft">{profile.name} · {profile.slug}</p>
          <p className="mt-1 text-[11px] text-wk-text-muted">{profile.description}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${profile.visibility === "public" ? "bg-wk-success-soft text-wk-success" : "bg-wk-warning-soft text-wk-warning"}`}>{profile.visibility === "public" ? "Public label allowed" : "Admin-only rules"}</span>
      </div>
    </WkSurface>
  );
}

function ChartPreview({ run }: { run: IngestRun }) {
  return (
    <WkSurface className="overflow-hidden p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[14px] font-bold text-wk-text">Chart Preview</h2>
        <span className="text-[12px] text-wk-text-muted">Top {Math.min(10, run.rows.length)} of {run.rows.length}</span>
      </div>
      <div className="space-y-1">{run.rows.slice(0, 10).map((row, index) => <MiniChartRow key={row.id} row={row} index={index} />)}</div>
    </WkSurface>
  );
}

function ResolvedRowsTable({ rows, totalRows, rowFilter, setRowFilter, expandedRowId, setExpandedRowId }: { rows: IngestRun["rows"]; totalRows: number; rowFilter: string; setRowFilter: (value: string) => void; expandedRowId: string | null; setExpandedRowId: (value: string | null) => void }) {
  const filters = ["all", "canonical", "shell", "no_match", "needs_review", "duplicate_candidate"];
  return (
    <WkSurface className="overflow-hidden">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[14px] font-bold text-wk-text">Resolved Rows</h2>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-wk-text-muted">{totalRows} rows</span>
          <div className="flex flex-wrap gap-1">
            {filters.map((filter) => <button key={filter} onClick={() => setRowFilter(filter)} className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all ${rowFilter === filter ? "bg-wk-brand text-wk-brand-on" : "bg-wk-surface-raised text-wk-text-soft hover:bg-wk-border"}`}>{filter === "all" ? "All" : filter.replace(/_/g, " ")}</button>)}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead><tr className="border-b border-wk-border">{["#", "Title & Artist", "Match", "Confidence", "Warnings", "Decision", ""].map((heading) => <th key={heading} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-wk-text-muted">{heading}</th>)}</tr></thead>
          <tbody>{rows.map((row) => <RowTableRow key={row.id} row={row} expanded={expandedRowId === row.id} onToggle={() => setExpandedRowId(expandedRowId === row.id ? null : row.id)} onDecisionApplied={() => {}} />)}</tbody>
        </table>
      </div>
      {rows.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-wk-text-muted">No rows match the selected filter.</div>}
    </WkSurface>
  );
}

function IngestSidebar({ activeRun, dryRunResult, selectedMarketScope, selectedEligibilityProfile, guardStatus, runs, activity, cancelLoading, retryLoading, onNavigate, onCancelRun, onRetryRun }: { activeRun?: IngestRun; dryRunResult: IngestRun | null; selectedMarketScope: StoredChartMarketScope | null; selectedEligibilityProfile: ChartEligibilityProfile | null; guardStatus: ResourceGuardStatus | null; runs: IngestRun[]; activity: RecentIngestActivity[]; cancelLoading: string | null; retryLoading: string | null; onNavigate: (path: string) => void; onCancelRun: (runId: string) => void; onRetryRun: (runId: string) => void }) {
  const activeRuns = runs.filter((run) => run.status === "running" || run.status === "draft" || run.status === "dry_run_complete").slice(0, 4);
  return (
    <div className="space-y-5">
      <ProviderHealthPanel />
      {selectedMarketScope && <SelectedSidebarCard title="Selected Market Scope" main={selectedMarketScope.name} sub={`${selectedMarketScope.includedMarkets.map((item) => item.countryCode).join(" + ")} · ${selectedMarketScope.aggregationMode.replace(/_/g, " ")}`} />}
      {selectedEligibilityProfile && <SelectedSidebarCard title="Selected Rules" main={selectedEligibilityProfile.name} sub={selectedEligibilityProfile.description} />}
      {activeRun && !dryRunResult && (
        <WkSurface className="border-l-4 border-l-wk-brand p-4">
          <div className="mb-2 flex items-center justify-between"><h2 className="text-[14px] font-bold text-wk-text">Running Now</h2><span className="flex items-center gap-1 text-[11px] font-semibold text-wk-brand"><span className="inline-block h-2 w-2 animate-pulse rounded-full bg-wk-brand" />In progress</span></div>
          <PipelinePanel run={activeRun} compact />
          <button onClick={() => onNavigate(`${ADMIN_CHARTS_BASE}/ingest-runs/${activeRun.id}`)} className="mt-3 w-full rounded-md bg-wk-brand-soft px-3 py-2 text-[12px] font-semibold text-wk-brand transition-colors hover:bg-wk-brand/20">Monitor Run →</button>
        </WkSurface>
      )}
      {(guardStatus || dryRunResult) && <ResourceGuardPanel guard={guardStatus} run={dryRunResult} />}
      <WkSurface className="p-4"><h2 className="mb-3 text-[14px] font-bold text-wk-text">Active Runs</h2><div className="space-y-2">{activeRuns.map((run) => <RunCard key={run.id} run={run} onClick={() => onNavigate(`${ADMIN_CHARTS_BASE}/ingest-runs/${run.id}`)} onCancel={() => onCancelRun(run.id)} onRetry={() => onRetryRun(run.id)} cancelLoading={cancelLoading === run.id} retryLoading={retryLoading === run.id} />)}{activeRuns.length === 0 && <p className="text-[13px] text-wk-text-muted">No active runs</p>}</div></WkSurface>
      <WkSurface className="p-4"><h2 className="mb-3 text-[14px] font-bold text-wk-text">Recent Activity</h2><div className="space-y-3">{activity.slice(0, 6).map((item) => <ActivityItem key={item.id} activity={item} onClick={() => item.runId && onNavigate(`${ADMIN_CHARTS_BASE}/ingest-runs/${item.runId}`)} />)}{activity.length === 0 && <p className="text-[13px] text-wk-text-muted">No recent activity</p>}</div></WkSurface>
      <WkSurface className="p-4"><h2 className="mb-3 text-[14px] font-bold text-wk-text">Operations</h2><div className="space-y-1"><NavButton icon={GitPullRequest} label="Review Queue" path={`${ADMIN_CHARTS_BASE}/review-queue`} /><NavButton icon={XCircle} label="No-match Releases" path={`${ADMIN_CHARTS_BASE}/no-match`} /><NavButton icon={FolderPlus} label="Release Shells" path={`${ADMIN_CHARTS_BASE}/release-shells`} /><NavButton icon={AlertCircle} label="Canon Gaps" path={`${ADMIN_CHARTS_BASE}/canon-gaps`} /><NavButton icon={History} label="Legacy Ingest Jobs" path={`${ADMIN_CHARTS_BASE}/ingest-jobs`} /></div></WkSurface>
    </div>
  );
}

function SelectedSidebarCard({ title, main, sub }: { title: string; main: string; sub: string }) {
  return <WkSurface className="border-l-4 border-l-wk-brand p-4"><h2 className="mb-2 text-[14px] font-bold text-wk-text">{title}</h2><p className="text-[12px] font-semibold text-wk-text-soft">{main}</p><p className="mt-1 text-[11px] text-wk-text-muted">{sub}</p></WkSurface>;
}
