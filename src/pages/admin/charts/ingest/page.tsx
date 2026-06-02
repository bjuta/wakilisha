import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  getIngestKpis,
  getRecentIngestActivity,
  getIngestRuns,
  runDryRun,
  commitIngestRun,
  detectProvidersFromUrls,
  getProviderLabel,
  getProviderColorClass,
  getProviderIcon,
  isValidProviderUrl,
  getResourceGuardStatus,
} from "@/services/chartsIngestion/client";
import type {
  IngestStudioKpi,
  RecentIngestActivity,
  IngestRun,
  ProviderName,
  IngestStageStatus,
  IngestResolvedRow,
  ResourceGuardStatus,
} from "@/services/chartsIngestion/ingestStudioTypes";
import { WkSurface } from "@/components/design-system/primitives/Surface";

export default function AdminChartsIngest() {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<IngestStudioKpi | null>(null);
  const [activity, setActivity] = useState<RecentIngestActivity[]>([]);
  const [runs, setRuns] = useState<IngestRun[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [chartTitle, setChartTitle] = useState("");
  const [chartSlug, setChartSlug] = useState("");
  const [sourceUrls, setSourceUrls] = useState("");
  const [editionDate, setEditionDate] = useState("");
  const [chartSize, setChartSize] = useState(40);
  const [market, setMarket] = useState("KE");
  const [chartKind, setChartKind] = useState<"tracks" | "releases">("tracks");
  const [coverStyle, setCoverStyle] = useState("default");
  const [saveAsRecurring, setSaveAsRecurring] = useState(false);
  const [existingSeriesId, setExistingSeriesId] = useState("");

  // UI state
  const [detectedProviders, setDetectedProviders] = useState<ProviderName[]>([]);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<IngestRun | null>(null);
  const [commitLoading, setCommitLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showRows, setShowRows] = useState(false);
  const [rowFilter, setRowFilter] = useState<string>("all");
  const [guardStatus, setGuardStatus] = useState<ResourceGuardStatus | null>(null);

  const loadData = useCallback(async () => {
    const [k, a, r] = await Promise.all([
      getIngestKpis(),
      getRecentIngestActivity(),
      getIngestRuns(),
    ]);
    setKpis(k);
    setActivity(a);
    setRuns(r);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Detect providers when source URLs change
  useEffect(() => {
    const urls = sourceUrls.split("\n").filter((u) => u.trim());
    const providers = detectProvidersFromUrls(urls);
    setDetectedProviders(providers);
  }, [sourceUrls]);

  // Auto-generate slug from title
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

  function validateForm(): string | null {
    if (!chartTitle.trim()) return "Chart title is required";
    if (!chartSlug.trim()) return "Chart slug is required";
    if (!editionDate) return "Edition date is required";
    const urls = sourceUrls.split("\n").filter((u) => u.trim());
    if (urls.length === 0) return "At least one source URL is required";
    const invalidUrls = urls.filter((u) => !isValidProviderUrl(u));
    if (invalidUrls.length > 0) {
      return `Unrecognized provider(s): ${invalidUrls.join(", ")}`;
    }
    if (chartSize < 1 || chartSize > 100) return "Chart size must be between 1 and 100";
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
    setShowRows(false);

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
        setShowRows(true);
        setSuccessMessage(
          `Dry run complete — ${run.summary.totalRows} rows processed, ${run.summary.matchRate.toFixed(1)}% match rate`
        );
        const guard = await getResourceGuardStatus(run.id);
        setGuardStatus(guard);
      }
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Dry run failed");
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
      setDryRunResult(null);
      setShowRows(false);
      await loadData();
      navigate(`/admin/charts/ingest-runs/${result.runId}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Commit failed");
    } finally {
      setCommitLoading(false);
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
      <div className="flex h-64 items-center justify-center">
        <div className="text-foreground-600">Loading Ingest Studio...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-foreground-500">
            Chart Operations
          </div>
          <h1 className="text-[20px] font-bold text-foreground-950">Ingest Studio</h1>
          <p className="text-[13px] text-foreground-600">
            Create new chart editions from streaming providers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/admin/charts/ingest-runs")}
            className="inline-flex items-center gap-1.5 rounded-md border border-background-200 bg-background-50 px-3 py-2 text-[13px] font-semibold text-foreground-700 transition-colors hover:bg-background-100 whitespace-nowrap"
          >
            <i className="ri-list-check" />
            View All Runs
          </button>
          <button
            onClick={() => navigate("/admin/charts/ingest-health")}
            className="inline-flex items-center gap-1.5 rounded-md border border-background-200 bg-background-50 px-3 py-2 text-[13px] font-semibold text-foreground-700 transition-colors hover:bg-background-100 whitespace-nowrap"
          >
            <i className="ri-heart-pulse-line" />
            API Health
          </button>
        </div>
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <WkSurface className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-500">
              Editions This Week
            </p>
            <p className="mt-1 text-[24px] font-black text-foreground-950">{kpis.editionsThisWeek}</p>
          </WkSurface>
          <WkSurface className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-500">
              Canonical Match Rate
            </p>
            <p className="mt-1 text-[24px] font-black text-foreground-950">
              {kpis.canonicalMatchRate.toFixed(1)}%
            </p>
          </WkSurface>
          <WkSurface className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-500">
              Rows Awaiting Review
            </p>
            <p className="mt-1 text-[24px] font-black text-foreground-950">{kpis.rowsAwaitingReview}</p>
          </WkSurface>
          <WkSurface className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-500">
              Avg Run Time
            </p>
            <p className="mt-1 text-[24px] font-black text-foreground-950">
              {(kpis.averageRunTimeMs / 1000).toFixed(1)}s
            </p>
          </WkSurface>
        </div>
      )}

      {/* Error / Success */}
      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="flex items-center gap-2 text-red-700">
            <i className="ri-error-warning-line" />
            <span className="text-[13px] font-semibold">{formError}</span>
          </div>
        </div>
      )}
      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="flex items-center gap-2 text-green-700">
            <i className="ri-check-line" />
            <span className="text-[13px] font-semibold">{successMessage}</span>
          </div>
        </div>
      )}

      {/* Main grid: Form + Sidebar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column — Form + Rows */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ingest Form */}
          <WkSurface className="p-5">
            <h2 className="mb-4 text-[16px] font-bold text-foreground-950">New Ingest Run</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-foreground-700">
                    Chart Title *
                  </label>
                  <input
                    type="text"
                    value={chartTitle}
                    onChange={(e) => setChartTitle(e.target.value)}
                    placeholder="e.g. WAKILISHA Top 40 — Week 22"
                    className="w-full rounded-md border border-background-200 bg-background-50 px-3 py-2 text-[13px] text-foreground-950 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-foreground-700">
                    Chart Slug *
                  </label>
                  <input
                    type="text"
                    value={chartSlug}
                    onChange={(e) => setChartSlug(e.target.value)}
                    placeholder="wakilisha-top-40-week-22"
                    className="w-full rounded-md border border-background-200 bg-background-50 px-3 py-2 text-[13px] text-foreground-950 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-semibold text-foreground-700">
                  Source URLs * (one per line)
                </label>
                <textarea
                  value={sourceUrls}
                  onChange={(e) => setSourceUrls(e.target.value)}
                  rows={3}
                  placeholder="https://open.spotify.com/playlist/...&#10;https://music.apple.com/..."
                  className="w-full rounded-md border border-background-200 bg-background-50 px-3 py-2 text-[13px] text-foreground-950 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
                />
                {detectedProviders.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-foreground-500">Detected:</span>
                    {detectedProviders.map((p) => (
                      <span
                        key={p}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border ${getProviderColorClass(p)}`}
                      >
                        <i className={getProviderIcon(p)} />
                        {getProviderLabel(p)}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-foreground-700">
                    Edition Date *
                  </label>
                  <input
                    type="date"
                    value={editionDate}
                    onChange={(e) => setEditionDate(e.target.value)}
                    className="w-full rounded-md border border-background-200 bg-background-50 px-3 py-2 text-[13px] text-foreground-950 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-foreground-700">
                    Chart Size *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={chartSize}
                    onChange={(e) => setChartSize(Number(e.target.value))}
                    className="w-full rounded-md border border-background-200 bg-background-50 px-3 py-2 text-[13px] text-foreground-950 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-foreground-700">
                    Market *
                  </label>
                  <select
                    value={market}
                    onChange={(e) => setMarket(e.target.value)}
                    className="w-full rounded-md border border-background-200 bg-background-50 px-3 py-2 text-[13px] text-foreground-950 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
                  >
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-foreground-700">
                    Chart Kind
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setChartKind("tracks")}
                      className={`flex-1 rounded-md border px-3 py-2 text-[13px] font-semibold transition-all ${
                        chartKind === "tracks"
                          ? "border-primary-400 bg-primary-50 text-primary-700"
                          : "border-background-200 bg-background-50 text-foreground-600 hover:bg-background-100"
                      }`}
                    >
                      <i className="ri-music-line mr-1" />Tracks
                    </button>
                    <button
                      onClick={() => setChartKind("releases")}
                      className={`flex-1 rounded-md border px-3 py-2 text-[13px] font-semibold transition-all ${
                        chartKind === "releases"
                          ? "border-primary-400 bg-primary-50 text-primary-700"
                          : "border-background-200 bg-background-50 text-foreground-600 hover:bg-background-100"
                      }`}
                    >
                      <i className="ri-album-line mr-1" />Releases
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-foreground-700">
                    Cover Style
                  </label>
                  <select
                    value={coverStyle}
                    onChange={(e) => setCoverStyle(e.target.value)}
                    className="w-full rounded-md border border-background-200 bg-background-50 px-3 py-2 text-[13px] text-foreground-950 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
                  >
                    <option value="default">Default</option>
                    <option value="genre">Genre</option>
                    <option value="minimal">Minimal</option>
                    <option value="editorial">Editorial</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-foreground-700">
                    Existing Series (optional)
                  </label>
                  <input
                    type="text"
                    value={existingSeriesId}
                    onChange={(e) => setExistingSeriesId(e.target.value)}
                    placeholder="series-top-40"
                    className="w-full rounded-md border border-background-200 bg-background-50 px-3 py-2 text-[13px] text-foreground-950 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
                  />
                </div>
                <div className="flex items-center">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={saveAsRecurring}
                      onChange={(e) => setSaveAsRecurring(e.target.checked)}
                      className="h-4 w-4 rounded border-background-200 accent-primary-500"
                    />
                    <span className="text-[13px] text-foreground-600">Save as recurring series</span>
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  onClick={handleDryRun}
                  disabled={dryRunLoading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary-500 px-4 py-2 text-[13px] font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:opacity-50 whitespace-nowrap"
                >
                  <i className={dryRunLoading ? "ri-loader-4-line animate-spin" : "ri-flask-line"} />
                  {dryRunLoading ? "Running dry run..." : "Run Dry Run"}
                </button>
                <button
                  onClick={handleCommit}
                  disabled={commitLoading || !dryRunResult || dryRunResult.status !== "dry_run_complete"}
                  className="inline-flex items-center gap-1.5 rounded-md border border-background-200 bg-background-50 px-4 py-2 text-[13px] font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:opacity-50 whitespace-nowrap"
                >
                  <i className={commitLoading ? "ri-loader-4-line animate-spin" : "ri-check-line"} />
                  {commitLoading ? "Committing..." : "Commit Edition"}
                </button>
              </div>

              {/* Dry run result summary */}
              {dryRunResult && (
                <div className="mt-4 rounded-lg border border-primary-200 bg-primary-50 p-3">
                  <div className="flex items-center gap-2 text-primary-700">
                    <i className="ri-check-line" />
                    <span className="text-[13px] font-semibold">
                      Dry run ready — {dryRunResult.summary.totalRows} rows,{" "}
                      {dryRunResult.summary.canonicalMatches} canonical, {dryRunResult.summary.gaps} gaps
                    </span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => navigate(`/admin/charts/ingest-runs/${dryRunResult.id}`)}
                      className="text-[12px] font-semibold text-primary-700 hover:underline"
                    >
                      View full run details →
                    </button>
                    <button
                      onClick={() => setShowRows(!showRows)}
                      className="text-[12px] font-semibold text-primary-700 hover:underline"
                    >
                      {showRows ? "Hide rows" : "Inspect rows"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </WkSurface>

          {/* Resolved Rows Table */}
          {showRows && dryRunResult && (
            <WkSurface className="overflow-hidden">
              <div className="flex items-center justify-between p-4 pb-2">
                <h2 className="text-[14px] font-bold text-foreground-950">Resolved Rows</h2>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-foreground-500">{dryRunResult.rows.length} rows</span>
                  <div className="flex gap-1">
                    {["all", "canonical", "shell", "no_match", "needs_review", "duplicate_candidate"].map((f) => (
                      <button
                        key={f}
                        onClick={() => setRowFilter(f)}
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition-all ${
                          rowFilter === f
                            ? "bg-primary-500 text-background-50"
                            : "bg-background-100 text-foreground-600 hover:bg-background-200"
                        }`}
                      >
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
                      <th className="px-4 py-3 font-semibold text-foreground-500">Provider</th>
                      <th className="px-4 py-3 font-semibold text-foreground-500">Match</th>
                      <th className="px-4 py-3 font-semibold text-foreground-500">Confidence</th>
                      <th className="px-4 py-3 font-semibold text-foreground-500">Warnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <RowTableRow key={row.id} row={row} />
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredRows.length === 0 && (
                <div className="px-4 py-8 text-center text-[13px] text-foreground-500">
                  No rows match the selected filter.
                </div>
              )}
            </WkSurface>
          )}
        </div>

        {/* Right column — Sidebar */}
        <div className="space-y-4">
          {/* Pipeline Visualizer */}
          {dryRunResult && (
            <PipelinePanel run={dryRunResult} />
          )}

          {/* Active run pipeline */}
          {activeRun && !dryRunResult && (
            <PipelinePanel run={activeRun} />
          )}

          {/* Resource Guard */}
          {(guardStatus || dryRunResult) && (
            <ResourceGuardPanel guard={guardStatus} run={dryRunResult} />
          )}

          {/* Recent Activity */}
          <WkSurface className="p-4">
            <h2 className="mb-3 text-[14px] font-bold text-foreground-950">Recent Activity</h2>
            <div className="space-y-3">
              {activity.slice(0, 6).map((act) => (
                <ActivityItem key={act.id} activity={act} />
              ))}
              {activity.length === 0 && (
                <p className="text-[13px] text-foreground-500">No recent activity</p>
              )}
            </div>
          </WkSurface>

          {/* Active runs */}
          <WkSurface className="p-4">
            <h2 className="mb-3 text-[14px] font-bold text-foreground-950">Active Runs</h2>
            <div className="space-y-2">
              {runs
                .filter((r) => r.status === "running" || r.status === "draft" || r.status === "dry_run_complete")
                .slice(0, 4)
                .map((run) => (
                  <button
                    key={run.id}
                    onClick={() => navigate(`/admin/charts/ingest-runs/${run.id}`)}
                    className="flex w-full items-center justify-between rounded-lg bg-background-100 p-3 text-left transition-colors hover:bg-background-200"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold text-foreground-950">
                        {run.chartTitle}
                      </p>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-semibold ${
                            run.status === "running"
                              ? "text-primary-600"
                              : run.status === "dry_run_complete"
                                ? "text-amber-600"
                                : "text-foreground-500"
                          }`}
                        >
                          {run.status.replace(/_/g, " ")}
                        </span>
                        <span className="text-[10px] text-foreground-400">{run.editionDate}</span>
                      </div>
                    </div>
                    <i className="ri-arrow-right-s-line text-foreground-500" />
                  </button>
                ))}
              {runs.filter((r) => r.status === "running" || r.status === "draft" || r.status === "dry_run_complete").length === 0 && (
                <p className="text-[13px] text-foreground-500">No active runs</p>
              )}
            </div>
          </WkSurface>

          {/* Quick Links */}
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

function NavButton({ icon, label, path }: { icon: string; label: string; path: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(path)}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-foreground-600 transition-colors hover:bg-background-100"
    >
      <i className={icon} />
      {label}
    </button>
  );
}

function ActivityItem({ activity: act }: { activity: RecentIngestActivity }) {
  const typeConfig: Record<string, { icon: string; bg: string; text: string }> = {
    commit: { icon: "ri-check-line", bg: "bg-green-100", text: "text-green-700" },
    dry_run: { icon: "ri-flask-line", bg: "bg-primary-100", text: "text-primary-700" },
    cancel: { icon: "ri-close-line", bg: "bg-red-100", text: "text-red-700" },
    retry: { icon: "ri-refresh-line", bg: "bg-amber-100", text: "text-amber-700" },
    review: { icon: "ri-git-pull-request-line", bg: "bg-purple-100", text: "text-purple-700" },
  };
  const cfg = typeConfig[act.type] || typeConfig.dry_run;

  return (
    <div className="flex items-start gap-2">
      <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${cfg.bg} ${cfg.text}`}>
        <i className={cfg.icon} />
      </div>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-foreground-950 truncate">{act.chartTitle}</p>
        <p className="text-[11px] text-foreground-500">
          {act.type === "commit" ? "Committed" : act.type === "dry_run" ? "Dry run" : act.type === "cancel" ? "Cancelled" : "Sent to review"} by {act.actor}
        </p>
        <p className="text-[10px] text-foreground-400">
          {new Date(act.createdAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function RowTableRow({ row }: { row: IngestResolvedRow }) {
  const matchBadge: Record<string, string> = {
    canonical: "bg-green-100 text-green-700",
    shell: "bg-amber-100 text-amber-700",
    no_match: "bg-red-100 text-red-700",
    needs_review: "bg-primary-100 text-primary-700",
    duplicate_candidate: "bg-purple-100 text-purple-700",
  };

  return (
    <tr className="border-b border-background-200/50 transition-colors hover:bg-background-100/50">
      <td className="px-4 py-3 font-bold text-foreground-950">{row.rank}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {row.artworkUrl && (
            <img src={row.artworkUrl} alt="" className="h-8 w-8 rounded object-cover" />
          )}
          <span className="font-semibold text-foreground-950">{row.title}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-foreground-600">{row.artistNames.join(", ")}</td>
      <td className="px-4 py-3">
        <span className="rounded bg-background-100 px-1.5 py-0.5 text-[11px] font-semibold text-foreground-600 border border-background-200">
          {row.sourceProvider === "spotify" ? "Spotify" : "Apple"}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${matchBadge[row.matchStatus] || "bg-background-100 text-foreground-500"}`}>
          {row.matchStatus.replace(/_/g, " ")}
        </span>
      </td>
      <td className="px-4 py-3 text-foreground-600">{row.confidence}%</td>
      <td className="px-4 py-3">
        {row.warnings && row.warnings.length > 0 ? (
          <span className="text-[11px] text-amber-600" title={row.warnings.join("; ")}>
            <i className="ri-alert-line mr-1" />
            {row.warnings.length} warning{row.warnings.length > 1 ? "s" : ""}
          </span>
        ) : (
          <span className="text-[11px] text-green-600">
            <i className="ri-check-line mr-1" />OK
          </span>
        )}
      </td>
    </tr>
  );
}

function PipelinePanel({ run }: { run: IngestRun }) {
  const stageStatusColor = (status: IngestStageStatus["status"]) => {
    switch (status) {
      case "done": return "bg-green-500";
      case "running": return "bg-primary-500 animate-pulse";
      case "warning": return "bg-amber-500";
      case "failed": return "bg-red-500";
      default: return "bg-background-200";
    }
  };

  const stageStatusLabel = (status: IngestStageStatus["status"]) => {
    switch (status) {
      case "done": return "Done";
      case "running": return "Running";
      case "warning": return "Warning";
      case "failed": return "Failed";
      default: return "Idle";
    }
  };

  const stageName = (stage: string) => {
    const names: Record<string, string> = {
      validate: "Validate",
      provider_detection: "Provider Detection",
      resource_guard: "Resource Guard",
      source_fetch: "Source Fetch",
      normalize: "Normalize",
      canonical_match: "Canonical Match",
      enrichment: "Enrichment",
      snapshot_commit: "Snapshot / Commit",
    };
    return names[stage] || stage;
  };

  const doneStages = run.stages.filter((s) => s.status === "done").length;
  const progressPct = Math.round((doneStages / run.stages.length) * 100);

  return (
    <WkSurface className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-bold text-foreground-950">Ingestion Pipeline</h2>
        {run.status === "running" && (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 rounded-full bg-background-200 overflow-hidden">
              <div className="h-full rounded-full bg-primary-500 transition-all duration-700" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="text-[11px] font-semibold text-primary-600">{progressPct}%</span>
          </div>
        )}
      </div>
      <div className="space-y-2.5">
        {run.stages.map((stage, i) => (
          <div key={stage.stage} className="flex items-center gap-3">
            <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-background-50 ${stageStatusColor(stage.status)}`}>
              {stage.status === "done" ? <i className="ri-check-line" /> : i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-foreground-950 truncate">{stageName(stage.stage)}</span>
                <span className={`text-[11px] font-semibold ${
                  stage.status === "done" ? "text-green-600" :
                  stage.status === "running" ? "text-primary-600" :
                  stage.status === "failed" ? "text-red-600" :
                  stage.status === "warning" ? "text-amber-600" :
                  "text-foreground-400"
                }`}>
                  {stageStatusLabel(stage.status)}
                  {stage.durationMs ? ` (${(stage.durationMs / 1000).toFixed(1)}s)` : ""}
                </span>
              </div>
              {stage.message && (
                <p className="text-[11px] text-foreground-500 truncate">{stage.message}</p>
              )}
              {stage.metrics && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {Object.entries(stage.metrics).slice(0, 3).map(([k, v]) => (
                    <span key={k} className="rounded bg-background-100 px-1.5 py-0.5 text-[10px] font-semibold text-foreground-500">
                      {k}: {String(v)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </WkSurface>
  );
}

function ResourceGuardPanel({ guard, run }: { guard: ResourceGuardStatus | null; run: IngestRun | null }) {
  return (
    <WkSurface className="p-4">
      <h2 className="mb-3 text-[14px] font-bold text-foreground-950">Resource Guard</h2>
      {guard ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-foreground-600">Sources</span>
            <span className="text-[13px] font-semibold text-foreground-950">{guard.sourceCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-foreground-600">Provider Budget</span>
            <span className="text-[13px] font-semibold text-foreground-950">{guard.providerBudgetRemaining}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-foreground-600">Worker Concurrency</span>
            <span className="text-[13px] font-semibold text-foreground-950">{guard.workerConcurrency}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-foreground-600">Est. Rows</span>
            <span className="text-[13px] font-semibold text-foreground-950">{guard.estimatedRowCount}</span>
          </div>
          {guard.duplicateRunWarning && (
            <div className="rounded bg-amber-50 p-2 text-[12px] text-amber-700">
              <i className="ri-alert-line mr-1" />{guard.duplicateRunWarning}
            </div>
          )}
          {guard.sameEditionDateWarning && (
            <div className="rounded bg-amber-50 p-2 text-[12px] text-amber-700">
              <i className="ri-alert-line mr-1" />{guard.sameEditionDateWarning}
            </div>
          )}
        </div>
      ) : run ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-foreground-600">Sources</span>
            <span className="text-[13px] font-semibold text-foreground-950">{run.sourceUrls.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-foreground-600">Chart Size</span>
            <span className="text-[13px] font-semibold text-foreground-950">{run.chartSize}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-foreground-600">Market</span>
            <span className="text-[13px] font-semibold text-foreground-950">{run.market}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-foreground-600">Detected Providers</span>
            <span className="text-[13px] font-semibold text-foreground-950">{run.detectedProviders.length}</span>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-foreground-500">Resource guard data will appear after dry run.</p>
      )}
    </WkSurface>
  );
}