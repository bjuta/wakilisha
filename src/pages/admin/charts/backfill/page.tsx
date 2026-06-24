import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  getChartFamilies,
  getChartBackfillPresets,
  saveChartBackfillPreset,
  getWeeklyBackfillPlan,
  runDryRun,
  runFullPipeline,
} from "@/services/chartsIngestion/client";
import type {
  ChartBackfillPreset,
  ChartBackfillPresetConfig,
  WeeklyBackfillPlanRow,
} from "@/services/chartsIngestion/client";
import type { ChartFamily } from "@/services/chartsIngestion/types";
import { getEligibilityProfiles } from "@/services/chartsEligibility/eligibilityStore";
import { getMarketScopes } from "@/services/chartsMarkets/marketScopeStore";

const INPUT_CLASS = "w-full rounded-md border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none focus:border-wk-brand";
const LABEL_CLASS = "mb-1 block text-[11px] font-bold uppercase tracking-[0.12em] text-wk-text-muted";

function mondayToday(): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d.toISOString().split("T")[0];
}

function defaultConfig(family: ChartFamily | null): ChartBackfillPresetConfig {
  return {
    chartTitle: family?.label ?? "Chart",
    chartSlug: family?.publicSlug ?? family?.familyKey ?? "",
    chartSize: family?.defaultChartSize ?? 100,
    market: family?.defaultRegion ?? "KE",
    chartKind: "tracks",
    coverStyle: "default",
    eligibilityProfileId: "elig_kenyan_artists_only",
    marketScopeId: "scope_kenya",
    sourceUrlsTemplate: "",
    releaseWindowStart: "2024-01-01",
    releaseWindowEndMode: "day_before_edition",
    cadence: "weekly_monday",
    playbackProvider: "apple_music",
    playbackStorefront: "ke",
    minAutoAccept: 0.9,
  };
}

function actionLabel(action: string): string {
  switch (action) {
    case "create_run": return "Create run";
    case "open_run": return "Open run";
    case "wait_for_run": return "Running";
    case "rerun": return "Rerun";
    case "edition_exists": return "Edition exists";
    case "published": return "Published";
    default: return action.replace(/_/g, " ");
  }
}

function actionClass(action: string): string {
  if (action === "published") return "bg-wk-success-soft text-wk-success";
  if (action === "create_run") return "bg-wk-brand-soft text-wk-brand";
  if (action === "open_run") return "bg-wk-warning-soft text-wk-warning";
  if (action === "rerun") return "bg-wk-danger-soft text-wk-danger";
  return "bg-wk-surface-raised text-wk-text-muted";
}

export default function AdminChartsBackfillPlanner() {
  const navigate = useNavigate();

  const [families, setFamilies] = useState<ChartFamily[]>([]);
  const [presets, setPresets] = useState<ChartBackfillPreset[]>([]);
  const [familyId, setFamilyId] = useState("");
  const [config, setConfig] = useState<ChartBackfillPresetConfig>(() => defaultConfig(null));
  const [startDate, setStartDate] = useState("2025-12-29");
  const [endDate, setEndDate] = useState(mondayToday());
  const [plan, setPlan] = useState<WeeklyBackfillPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(false);
  const [runLoadingDate, setRunLoadingDate] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eligibilityProfiles = useMemo(() => getEligibilityProfiles(), []);
  const marketScopes = useMemo(() => getMarketScopes(), []);

  const selectedFamily = useMemo(
    () => families.find((family) => family.id === familyId) ?? null,
    [families, familyId],
  );

  async function load() {
    setLoading(true);
    const [familyRows, presetRows] = await Promise.all([
      getChartFamilies(),
      getChartBackfillPresets(),
    ]);

    setFamilies(familyRows);
    setPresets(presetRows);

    const firstFamily = familyRows[0] ?? null;
    const nextFamilyId = familyId || firstFamily?.id || "";
    setFamilyId(nextFamilyId);

    const preset = presetRows.find((row) => row.familyId === nextFamilyId);
    setConfig(preset?.config ?? defaultConfig(firstFamily));

    setLoading(false);
  }

  async function refreshPlan(nextFamilyId = familyId, nextConfig = config) {
    if (!nextFamilyId || !startDate || !endDate) return;

    setPlanLoading(true);
    setError(null);

    try {
      await saveChartBackfillPreset({
        familyId: nextFamilyId,
        config: nextConfig,
      });

      const rows = await getWeeklyBackfillPlan({
        familyId: nextFamilyId,
        startDate,
        endDate,
      });

      setPlan(rows);
      setMessage(`Plan loaded: ${rows.length} weekly edition(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load backfill plan.");
    } finally {
      setPlanLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!familyId || families.length === 0) return;

    const preset = presets.find((row) => row.familyId === familyId);
    const family = families.find((row) => row.id === familyId) ?? null;

    setConfig(preset?.config ?? defaultConfig(family));
  }, [familyId, families, presets]);

  async function handleSavePreset() {
    if (!familyId) return;

    setError(null);

    try {
      await saveChartBackfillPreset({ familyId, config });
      setMessage(`Backfill preset saved for ${selectedFamily?.label ?? familyId}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save preset.");
    }
  }

  async function handleCreateRun(row: WeeklyBackfillPlanRow) {
    if (!familyId || !selectedFamily) return;

    setRunLoadingDate(row.editionDate);
    setError(null);
    setMessage(null);

    try {
      await saveChartBackfillPreset({ familyId, config });

      const sourceUrls = config.sourceUrlsTemplate
        .split("\n")
        .map((url) => url.trim())
        .filter(Boolean);

      if (sourceUrls.length === 0) {
        throw new Error("Preset needs at least one source URL.");
      }

      const response = await runDryRun({
        chartTitle: config.chartTitle || selectedFamily.label,
        chartSlug: config.chartSlug || selectedFamily.publicSlug || selectedFamily.familyKey,
        editionDate: row.editionDate,
        chartSize: config.chartSize,
        market: config.market,
        chartKind: config.chartKind,
        coverStyle: config.coverStyle,
        sourceUrls,
        saveAsRecurringSeries: true,
        existingSeriesId: familyId,
        eligibilityProfileId: config.eligibilityProfileId,
        marketScopeId: config.marketScopeId,
        releaseWindowStart: row.releaseWindowStart,
        releaseWindowEnd: row.releaseWindowEnd,
        backfillPresetId: familyId,
        backfill: {
          presetId: familyId,
          releaseWindowStart: row.releaseWindowStart,
          releaseWindowEnd: row.releaseWindowEnd,
          cadence: "weekly_monday",
        },
      });

      await runFullPipeline(response.runId);
      setMessage(`Created and ran ${row.editionDate}. Opening run…`);
      navigate(`/admin/charts/ingest-runs/${response.runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create backfill run.");
    } finally {
      setRunLoadingDate(null);
    }
  }

  if (loading) {
    return <div className="p-6 text-[13px] text-wk-text-muted">Loading backfill planner…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-[22px] font-black tracking-tight text-wk-text">Backfill Planner</h1>
          <p className="mt-1 max-w-3xl text-[13px] text-wk-text-muted">
            Save each chart family’s settings once, then generate weekly Monday editions with release windows computed automatically.
          </p>
        </div>
        <button
          onClick={() => navigate("/admin/charts/ingest-runs")}
          className="wk-button wk-button-ghost"
        >
          <WkIcon name="ListChecks" size={14} />
          Ingest Runs
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-wk-danger/20 bg-wk-danger-soft p-3 text-[12px] font-semibold text-wk-danger">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-lg border border-wk-success/20 bg-wk-success-soft p-3 text-[12px] font-semibold text-wk-success">
          {message}
        </div>
      )}

      <WkSurface className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <WkIcon name="Settings2" size={16} className="text-wk-brand" />
          <h2 className="text-[14px] font-bold text-wk-text">Family preset</h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <label className={LABEL_CLASS}>Chart family</label>
            <select value={familyId} onChange={(event) => setFamilyId(event.target.value)} className={INPUT_CLASS}>
              {families.map((family) => (
                <option key={family.id} value={family.id}>
                  {family.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL_CLASS}>Chart title</label>
            <input value={config.chartTitle} onChange={(event) => setConfig({ ...config, chartTitle: event.target.value })} className={INPUT_CLASS} />
          </div>

          <div>
            <label className={LABEL_CLASS}>Public slug</label>
            <input value={config.chartSlug} onChange={(event) => setConfig({ ...config, chartSlug: event.target.value })} className={INPUT_CLASS} />
          </div>

          <div>
            <label className={LABEL_CLASS}>Chart size</label>
            <input type="number" min={1} max={100} value={config.chartSize} onChange={(event) => setConfig({ ...config, chartSize: Number(event.target.value) || 100 })} className={INPUT_CLASS} />
          </div>

          <div>
            <label className={LABEL_CLASS}>Market</label>
            <input value={config.market} onChange={(event) => setConfig({ ...config, market: event.target.value.toUpperCase() })} className={INPUT_CLASS} />
          </div>

          <div>
            <label className={LABEL_CLASS}>Chart kind</label>
            <select value={config.chartKind} onChange={(event) => setConfig({ ...config, chartKind: event.target.value as "tracks" | "releases" })} className={INPUT_CLASS}>
              <option value="tracks">Tracks</option>
              <option value="releases">Releases</option>
            </select>
          </div>

          <div>
            <label className={LABEL_CLASS}>Eligibility profile</label>
            <select value={config.eligibilityProfileId} onChange={(event) => setConfig({ ...config, eligibilityProfileId: event.target.value })} className={INPUT_CLASS}>
              {eligibilityProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL_CLASS}>Market scope</label>
            <select value={config.marketScopeId} onChange={(event) => setConfig({ ...config, marketScopeId: event.target.value })} className={INPUT_CLASS}>
              {marketScopes.map((scope) => (
                <option key={scope.id} value={scope.id}>
                  {scope.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL_CLASS}>Release window start</label>
            <input type="date" value={config.releaseWindowStart} onChange={(event) => setConfig({ ...config, releaseWindowStart: event.target.value })} className={INPUT_CLASS} />
          </div>

          <div className="lg:col-span-3">
            <label className={LABEL_CLASS}>Source URLs</label>
            <textarea
              value={config.sourceUrlsTemplate}
              onChange={(event) => setConfig({ ...config, sourceUrlsTemplate: event.target.value })}
              className={`${INPUT_CLASS} min-h-[92px]`}
              placeholder="Spotify / Apple playlist URL. One source per line."
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={handleSavePreset} className="wk-button wk-button-primary">
            <WkIcon name="Save" size={14} />
            Save family preset
          </button>
          <button onClick={() => refreshPlan()} disabled={planLoading} className="wk-button wk-button-ghost disabled:opacity-50">
            <WkIcon name={planLoading ? "Loader" : "CalendarDays"} size={14} className={planLoading ? "animate-spin" : ""} />
            {planLoading ? "Building plan…" : "Build backfill plan"}
          </button>
        </div>
      </WkSurface>

      <WkSurface className="p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <WkIcon name="CalendarRange" size={16} className="text-wk-brand" />
              <h2 className="text-[14px] font-bold text-wk-text">Weekly editions</h2>
            </div>
            <p className="mt-1 text-[12px] text-wk-text-muted">
              Each Monday gets release window start from the preset and release window end as the Sunday before that edition date.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={LABEL_CLASS}>From Monday</label>
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>To Monday</label>
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className={INPUT_CLASS} />
            </div>
          </div>
        </div>

        {plan.length === 0 ? (
          <div className="rounded-lg border border-dashed border-wk-border p-6 text-center text-[13px] text-wk-text-muted">
            Save a preset, then build a plan.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-wk-border">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-wk-border bg-wk-surface-raised">
                  {["Edition date", "Release window", "Edition", "Latest run", "Action"].map((header) => (
                    <th key={header} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-wk-text-muted">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plan.map((row) => (
                  <tr key={row.editionDate} className="border-b border-wk-border/60">
                    <td className="px-4 py-3 font-mono font-bold text-wk-text">{row.editionDate}</td>
                    <td className="px-4 py-3 font-mono text-wk-text-muted">
                      {row.releaseWindowStart} → {row.releaseWindowEnd}
                    </td>
                    <td className="px-4 py-3">
                      {row.existingEditionStatus ? (
                        <span className="font-semibold text-wk-text">{row.existingEditionStatus} · {row.existingEntryCount ?? 0} rows</span>
                      ) : (
                        <span className="text-wk-text-faint">No edition</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.latestRunId ? (
                        <button
                          onClick={() => navigate(`/admin/charts/ingest-runs/${row.latestRunId}`)}
                          className="font-mono text-[11px] font-semibold text-wk-brand hover:underline"
                        >
                          {row.latestRunId.slice(0, 8)} · {row.latestRunStatus}
                        </button>
                      ) : (
                        <span className="text-wk-text-faint">No run</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.latestRunId && row.recommendedAction !== "create_run" ? (
                        <button
                          onClick={() => navigate(`/admin/charts/ingest-runs/${row.latestRunId}`)}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${actionClass(row.recommendedAction)}`}
                        >
                          {actionLabel(row.recommendedAction)}
                        </button>
                      ) : row.recommendedAction === "published" ? (
                        <span className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${actionClass(row.recommendedAction)}`}>
                          Published
                        </span>
                      ) : (
                        <button
                          onClick={() => handleCreateRun(row)}
                          disabled={runLoadingDate === row.editionDate}
                          className="rounded-md bg-wk-brand px-2.5 py-1 text-[11px] font-bold text-wk-brand-on disabled:opacity-50"
                        >
                          {runLoadingDate === row.editionDate ? "Creating…" : "Create + run"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </WkSurface>
    </div>
  );
}
