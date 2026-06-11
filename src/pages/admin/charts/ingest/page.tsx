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
import { generateAndPersistIngestRunIntelligence } from "@/services/chartsIntelligence/intelligenceStore";

import { IngestKpiStrip } from "./components/IngestKpiStrip";
import { IngestLoadingState } from "./components/IngestLoadingState";
import { IngestMainPanel, type QuickTemplateKey } from "./components/IngestMainPanel";
import { IngestPageHeader } from "./components/IngestPageHeader";
import { IngestSidebar } from "./components/IngestSidebar";
import { IngestStatusStack } from "./components/IngestStatusStack";
import { Stepper, type IngestStudioStep } from "./components/Stepper";

const ADMIN_CHARTS_BASE = "/admin/charts";

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

function toMarketScopeSnapshot(scope: StoredChartMarketScope | null) {
  if (!scope) return null;
  return {
    id: scope.id,
    name: scope.name,
    slug: scope.slug,
    primaryMarketSlug: scope.primaryMarketSlug,
    includedMarkets: scope.includedMarkets,
    aggregationMode: scope.aggregationMode,
    visibility: scope.visibility,
    description: scope.description,
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

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { setDetectedProviders(detectProvidersFromUrls(sourceUrls.split("\n").filter((url) => url.trim()))); }, [sourceUrls]);
  useEffect(() => {
    if (chartTitle && !chartSlug) setChartSlug(chartTitle.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-").substring(0, 60));
  }, [chartTitle, chartSlug]);
  useEffect(() => {
    if (!existingSeriesId || !editionDate || existingSeriesId === "__new__") { setEditionExistsWarning(null); return; }
    const duplicate = runs.find((run) => run.existingSeriesId === existingSeriesId && run.editionDate === editionDate && run.status !== "cancelled");
    setEditionExistsWarning(duplicate ? `An edition already exists for this series on ${editionDate} (${duplicate.chartTitle}). Committing will overwrite unless you change the date.` : null);
  }, [existingSeriesId, editionDate, runs]);

  const selectedFamily = useMemo(() => families.find((family) => family.id === existingSeriesId) ?? null, [families, existingSeriesId]);
  const selectedEligibilityProfile = useMemo(() => eligibilityProfiles.find((profile) => profile.id === selectedEligibilityProfileId || profile.slug === selectedEligibilityProfileId) ?? null, [eligibilityProfiles, selectedEligibilityProfileId]);
  const selectedMarketScope = useMemo(() => marketScopes.find((scope) => scope.id === selectedMarketScopeId || scope.slug === selectedMarketScopeId) ?? null, [marketScopes, selectedMarketScopeId]);
  const marketScopeSnapshot = useMemo(() => toMarketScopeSnapshot(selectedMarketScope), [selectedMarketScope]);
  const publicUrlPreview = useMemo(() => (chartSlug && editionDate ? `/charts/${chartSlug}/${editionDate}` : null), [chartSlug, editionDate]);
  const filteredRows = useMemo(() => !dryRunResult ? [] : rowFilter === "all" ? dryRunResult.rows : dryRunResult.rows.filter((row) => row.matchStatus === rowFilter), [dryRunResult, rowFilter]);
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
    setChartTitle(selected.title); setChartSlug(selected.slug); setChartSize(selected.size); setMarket(selected.market); setSelectedMarketScopeId(selected.marketScopeId); setExistingSeriesId(selected.seriesId); setSelectedEligibilityProfileId(selected.eligibilityProfileId); setSaveAsRecurring(true);
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
    if (error) { setFormError(error); return; }
    setFormError(null); setSuccessMessage(null); setStep("rules");
  }

  async function handleDryRun() {
    const error = validateForm();
    if (error) { setFormError(error); return; }
    setFormError(null); setDryRunLoading(true); setDryRunResult(null); setSuccessMessage(null); setExpandedRowId(null);
    try {
      const urls = sourceUrls.split("\n").filter((url) => url.trim());
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
        eligibilityProfileId: selectedEligibilityProfileId,
        marketScopeId: selectedMarketScope?.id ?? selectedMarketScopeId,
        marketScopeSnapshot,
        enrichmentOptions: null,
      });
      const run = await getIngestRuns().then((allRuns) => allRuns.find((item) => item.id === response.runId));
      if (run) {
        generateAndPersistIngestRunIntelligence(run, {
          marketScopeId: selectedMarketScope?.id ?? selectedMarketScopeId,
          marketScopeSnapshot,
        });
        setDryRunResult(run); setStep("preview");
        setSuccessMessage(`Dry run complete — ${run.summary.totalRows} rows, ${run.summary.matchRate.toFixed(1)}% match rate · intelligence generated${selectedEligibilityProfile ? ` · ${selectedEligibilityProfile.name}` : ""}${selectedMarketScope ? ` · ${selectedMarketScope.name}` : ""}`);
        setGuardStatus(await getResourceGuardStatus(run.id));
      }
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Dry run failed";
      setFormError(message.includes("rate limit") ? "Spotify rate limit exceeded." : message.includes("credentials") ? "Provider credentials are missing." : message.includes("Apple") ? "Apple Music token is missing." : message.includes("all sources failed") ? "All sources failed to fetch." : `Dry run failed: ${message}`);
    } finally { setDryRunLoading(false); }
  }

  async function handleCommit() {
    if (!dryRunResult) return;
    setCommitLoading(true); setFormError(null); setCommitResult(null);
    try {
      const result = await commitIngestRun({ runId: dryRunResult.id, publishImmediately: true });
      setCommitResult(toBackendCommitResponse(result)); setStep("commit"); setDryRunResult(null); await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Commit failed";
      if (message.includes("duplicate_edition") || message.includes("program_not_found") || message.includes("unresolved_required_gaps") || message.includes("commit_not_ready")) setFormError(message.replace(/^[^:]+: /, ""));
      else if (message.includes("no_rows_to_commit")) setFormError("No rows are eligible for commit. Resolve match statuses first.");
      else setFormError(`Commit failed: ${message}`);
    } finally { setCommitLoading(false); }
  }

  function handleReset() {
    setStep("configure"); setDryRunResult(null); setFormError(null); setSuccessMessage(null); setGuardStatus(null); setExpandedRowId(null); setRowFilter("all"); setEditionExistsWarning(null); setCommitResult(null);
  }

  async function handleCancelRun(runId: string) { setCancelLoading(runId); try { await cancelIngestRun(runId); await loadData(); } catch (err) { setFormError(err instanceof Error ? err.message : "Cancel failed"); } finally { setCancelLoading(null); } }
  async function handleRetryRun(runId: string) { setRetryLoading(runId); try { await retryIngestRun(runId); await loadData(); } catch (err) { setFormError(err instanceof Error ? err.message : "Retry failed"); } finally { setRetryLoading(null); } }

  if (loading) return <IngestLoadingState />;

  return (
    <div className="space-y-6">
      <IngestPageHeader mode={mode} onOpenRuns={() => navigate(`${ADMIN_CHARTS_BASE}/ingest-runs`)} onOpenHealth={() => navigate(`${ADMIN_CHARTS_BASE}/ingest-health`)} />
      <Stepper step={step} onStepChange={(nextStep) => { if (nextStep === "configure") handleReset(); if (nextStep === "rules") setStep("rules"); }} />
      <IngestKpiStrip kpis={kpis} />
      <IngestStatusStack formError={formError} successMessage={successMessage} editionExistsWarning={editionExistsWarning} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <IngestMainPanel
          step={step}
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
          marketScopes={marketScopes}
          selectedMarketScopeId={selectedMarketScopeId}
          onSelectMarketScope={setSelectedMarketScopeId}
          eligibilityProfiles={eligibilityProfiles}
          selectedEligibilityProfileId={selectedEligibilityProfileId}
          onSelectEligibilityProfile={setSelectedEligibilityProfileId}
          onBackToProgram={() => setStep("configure")}
          onDryRun={handleDryRun}
          dryRunLoading={dryRunLoading}
          dryRunResult={dryRunResult}
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
          onOpenRun={() => dryRunResult && navigate(`${ADMIN_CHARTS_BASE}/ingest-runs/${dryRunResult.id}`)}
          commitResult={commitResult}
        />
        <IngestSidebar activeRun={activeRun} dryRunResult={dryRunResult} selectedMarketScope={selectedMarketScope} selectedEligibilityProfile={selectedEligibilityProfile} guardStatus={guardStatus} runs={runs} activity={activity} cancelLoading={cancelLoading} retryLoading={retryLoading} onNavigate={navigate} onCancelRun={handleCancelRun} onRetryRun={handleRetryRun} />
      </div>
    </div>
  );
}
