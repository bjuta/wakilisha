import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  runFullPipeline,
} from "@/services/chartsIngestion/client";
import type {
  IngestRun,
  IngestStudioKpi,
  ProviderName,
  RecentIngestActivity,
  ResourceGuardStatus,
  BackendCommitResponse,
} from "@/services/chartsIngestion/ingestStudioTypes";
import type { ChartFamily } from "@/services/chartsIngestion/types";
import { getEligibilityProfiles } from "@/services/chartsEligibility/eligibilityStore";
import type { ChartEligibilityProfile } from "@/services/chartsEligibility/eligibilityTypes";
import { getMarketScopes, type StoredChartMarketScope } from "@/services/chartsMarkets/marketScopeStore";
import { generateAndPersistIngestRunIntelligence } from "@/services/chartsIntelligence/intelligenceStore";
import {
  getFamilyDefaults,
  saveFamilyDefaults,
  computeDefaultsDiff,
  getFamiliesWithDefaults,
  type ChartFamilyDefaults,
  type ChartFamilyDefaultsDiff,
} from "@/services/chartsIngestion/chartFamilyDefaultsStore";
import { iso2ToCountrySlug, countrySlugToIso2 } from "@/utils/countries";

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
    description: "Custom chart family",
    defaultChartSize: chartSize,
    defaultRegion: market,
    editionFrequency: "weekly",
    defaultRuleset: "csv_registry_import_v1",
    defaultScoringModel: "csv_position_order",
    publicSlug: key,
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

function getISOWeekNumber(d: Date): number {
  const tmp = new Date(d.getTime());
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const jan1 = new Date(tmp.getFullYear(), 0, 1);
  const week = Math.round(((tmp.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return week;
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
  const prevMarketRef = useRef<string>(market);

  // ── Family defaults ──
  const [familyDefaults, setFamilyDefaults] = useState<ChartFamilyDefaults | null>(null);
  const [defaultsToast, setDefaultsToast] = useState<string | null>(null);

  const familiesWithDefaults = useMemo(
    () => getFamiliesWithDefaults(families.map((f) => f.id)),
    [families],
  );

  const defaultsDiff = useMemo<ChartFamilyDefaultsDiff>(() => {
    if (!existingSeriesId || existingSeriesId === "__new__") {
      return { hasDefaults: false, fields: { chartTitle: false, chartSlug: false, chartSize: false, market: false, chartKind: false, coverStyle: false, eligibilityProfileId: false, marketScopeId: false, sourceUrlsTemplate: false }, changedCount: 0 };
    }
    return computeDefaultsDiff(existingSeriesId, {
      chartTitle,
      chartSlug,
      chartSize,
      market,
      chartKind,
      coverStyle,
      eligibilityProfileId: selectedEligibilityProfileId,
      marketScopeId: selectedMarketScopeId,
      sourceUrls,
    });
  }, [existingSeriesId, chartTitle, chartSlug, chartSize, market, chartKind, coverStyle, selectedEligibilityProfileId, selectedMarketScopeId, sourceUrls]);

  const loadData = useCallback(async () => {
    const [kpiData, recentActivity, ingestRuns, chartFamilies] = await Promise.all([
      getIngestKpis(),
      getRecentIngestActivity(),
      getIngestRuns(),
      getChartFamilies(),
    ]);
    const scopes = getMarketScopes();
    const profiles = getEligibilityProfiles();

    setKpis(kpiData);
    setActivity(recentActivity);
    setRuns(ingestRuns);
    setFamilies(chartFamilies);
    setMarketScopes(scopes);
    setEligibilityProfiles(profiles);

    if (!scopes.some((scope) => scope.id === selectedMarketScopeId)) {
      setSelectedMarketScopeId(scopes[0]?.id ?? "scope_kenya");
    }

    if (!profiles.some((profile) => profile.id === selectedEligibilityProfileId)) {
      setSelectedEligibilityProfileId(profiles[0]?.id ?? "elig_all_artists");
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

  // Auto-load saved family defaults when family changes
  useEffect(() => {
    if (!existingSeriesId || existingSeriesId === "__new__") {
      setFamilyDefaults(null);
      return;
    }
    const defaults = getFamilyDefaults(existingSeriesId);
    if (defaults) {
      setFamilyDefaults(defaults);
      setChartTitle(defaults.chartTitle);
      setChartSlug(defaults.chartSlug);
      setChartSize(defaults.chartSize);
      setMarket(defaults.market);
      setChartKind(defaults.chartKind);
      setCoverStyle(defaults.coverStyle);
      setSelectedEligibilityProfileId(defaults.eligibilityProfileId);
      setSelectedMarketScopeId(defaults.marketScopeId);
      setSourceUrls(defaults.sourceUrlsTemplate);
      setSaveAsRecurring(true);
    } else {
      setFamilyDefaults(null);
      // No saved defaults yet → generate smart defaults from the ChartFamily object
      const family = families.find((f) => f.id === existingSeriesId);
      if (family) {
        const d = new Date(editionDate);
        const weekNumber = getISOWeekNumber(d);
        const generatedTitle = `${family.label} — Week ${weekNumber}`;
        const generatedSlug = family.publicSlug;
        setChartTitle(generatedTitle);
        setChartSlug(generatedSlug);
        setChartSize(family.defaultChartSize);
        // Extract market from the publicSlug (e.g. "top-songs-kenya" → "KE")
        const slugParts = family.publicSlug.split("-");
        const possibleCountrySlug = slugParts.slice(-2).join("-"); // try last 2 segments for "south-africa" etc
        const iso2From2 = countrySlugToIso2(possibleCountrySlug);
        const iso2From1 = countrySlugToIso2(slugParts[slugParts.length - 1] ?? "");
        const extractedIso2 = iso2From2 ?? iso2From1;
        setMarket(extractedIso2 ?? "KE");
        prevMarketRef.current = extractedIso2 ?? "KE";
        setChartKind("tracks");
        setCoverStyle("default");
      }
    }
  }, [existingSeriesId, editionDate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const firstMarket = selectedMarketScope?.includedMarkets[0]?.countryCode;
    if (firstMarket) {
      setMarket(firstMarket);
      prevMarketRef.current = firstMarket;
    }
  }, [selectedMarketScopeId]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!defaultsToast) return;
    const timer = setTimeout(() => setDefaultsToast(null), 3000);
    return () => clearTimeout(timer);
  }, [defaultsToast]);

  // ── Market → Slug connection ──
  // When the user changes the market, update the chart slug to reflect the new country
  useEffect(() => {
    const prevMarket = prevMarketRef.current;
    if (prevMarket === market) { prevMarketRef.current = market; return; }

    const oldSlug = iso2ToCountrySlug(prevMarket);
    const newSlug = iso2ToCountrySlug(market);

    setChartSlug((previous) => {
      // Replace the market suffix at the end of the slug
      if (previous.endsWith(`-${oldSlug}`)) {
        return previous.replace(new RegExp(`-${oldSlug}$`), `-${newSlug}`);
      }
      // If the slug doesn't end with the old market pattern, just append
      if (market && market !== "GLOBAL") {
        return `${previous}-${newSlug}`;
      }
      return previous;
    });

    prevMarketRef.current = market;
  }, [market]);

  function handleSaveDefaults() {
    if (!existingSeriesId || existingSeriesId === "__new__") return;
    const saved = saveFamilyDefaults(existingSeriesId, {
      chartTitle,
      chartSlug,
      chartSize,
      market,
      chartKind,
      coverStyle,
      eligibilityProfileId: selectedEligibilityProfileId,
      marketScopeId: selectedMarketScopeId,
      sourceUrlsTemplate: sourceUrls,
    });
    setFamilyDefaults(saved);
    setDefaultsToast(`Defaults saved for "${selectedFamily?.label ?? existingSeriesId}"`);
  }

  function handleResetToDefaults() {
    if (!familyDefaults) return;
    setChartTitle(familyDefaults.chartTitle);
    setChartSlug(familyDefaults.chartSlug);
    setChartSize(familyDefaults.chartSize);
    setMarket(familyDefaults.market);
    setChartKind(familyDefaults.chartKind);
    setCoverStyle(familyDefaults.coverStyle);
    setSelectedEligibilityProfileId(familyDefaults.eligibilityProfileId);
    setSelectedMarketScopeId(familyDefaults.marketScopeId);
    setSourceUrls(familyDefaults.sourceUrlsTemplate);
    setDefaultsToast("Reset to saved defaults");
  }

  function validateProgramStep(): string | null {
    if (!chartTitle.trim()) return "Chart title is required.";
    if (!chartSlug.trim()) return "Chart slug is required.";
    if (!editionDate) return "Edition date is required.";
    if (chartSize < 1 || chartSize > 100) return "Chart size must be between 1 and 100.";
    if (!existingSeriesId || existingSeriesId === "__new__") return "Select an existing chart family.";
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
    setChartTitle(selected.title); setChartSlug(selected.slug); setChartSize(selected.size); setMarket(selected.market); prevMarketRef.current = selected.market; setSelectedMarketScopeId(selected.marketScopeId); setExistingSeriesId(selected.seriesId); setSelectedEligibilityProfileId(selected.eligibilityProfileId); setSaveAsRecurring(true);
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

      // Trigger the full pipeline after creating the run record
      setSuccessMessage(`Run created (${response.runId.slice(0, 8)}) — running pipeline stages…`);
      await runFullPipeline(response.runId);

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

      {/* Family defaults toast */}
      {defaultsToast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-wk-success px-4 py-3 text-[13px] font-semibold text-white shadow-lg flex items-center gap-2">
          <i className="ri-check-line" />
          {defaultsToast}
        </div>
      )}

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
          familyDefaults={familyDefaults}
          defaultsDiff={defaultsDiff}
          onSaveDefaults={handleSaveDefaults}
          onResetToDefaults={handleResetToDefaults}
          familiesWithDefaults={familiesWithDefaults}
        />
        <IngestSidebar activeRun={activeRun} dryRunResult={dryRunResult} selectedMarketScope={selectedMarketScope} selectedEligibilityProfile={selectedEligibilityProfile} guardStatus={guardStatus} runs={runs} activity={activity} cancelLoading={cancelLoading} retryLoading={retryLoading} onNavigate={navigate} onCancelRun={handleCancelRun} onRetryRun={handleRetryRun} />
      </div>
    </div>
  );
}
