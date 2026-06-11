import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminChartsPageHeader } from "../components/AdminChartsPageHeader";
import { AdminChartsStatusBadge } from "../components/AdminChartsStatusBadge";
import { AdminChartsLoadingState } from "../components/AdminChartsLoadingState";

interface ChartProgram {
  id: string;
  public_label: string;
  short_label: string;
  chart_size: number;
  airplay_enabled: boolean;
}

interface ScoringRun {
  id: string;
  program_id: string;
  edition_date: string;
  status: "pending" | "running" | "completed" | "failed";
  scoring_policy_version: string;
  total_rows: number;
  eligible_rows: number;
  excluded_rows: number;
  carry_forward_rows: number;
  airplay_rescue_rows: number;
  source_urls: string[];
  run_notes: string | null;
  error_message: string | null;
  created_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface EditionPreview {
  id: string;
  edition_slug: string;
  edition_label: string;
  entry_count: number;
  new_entries_count: number;
  re_entries_count: number;
  carry_forward_count: number;
  status: string;
}

interface EntryPreview {
  rank: number;
  track_title: string;
  artist_name: string;
  total_score: number;
  movement: string | null;
  previous_rank: number | null;
  source_score: number;
  airplay_score: number;
  carry_forward_bonus: number;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function todayISO(): string {
  const d = new Date();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

export default function AdminScoringRunsPage() {
  const navigate = useNavigate();

  const [programs, setPrograms] = useState<ChartProgram[]>([]);
  const [runs, setRuns] = useState<ScoringRun[]>([]);
  const [loading, setLoading] = useState(true);

  // Trigger form state
  const [selectedProgram, setSelectedProgram] = useState("");
  const [editionDate, setEditionDate] = useState(todayISO());
  const [triggering, setTriggering] = useState(false);
  const [triggerStatus, setTriggerStatus] = useState<{ ok: boolean; message: string } | null>(null);

  // Expanded state
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [editionPreview, setEditionPreview] = useState<EditionPreview | null>(null);
  const [entriesPreview, setEntriesPreview] = useState<EntryPreview[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // ── Load programs + runs ──
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: progData, error: progErr }, { data: runData, error: runErr }] = await Promise.all([
        supabase.from("wk_chart_programs_v2").select("id, public_label, short_label, chart_size, airplay_enabled").order("public_label"),
        supabase.from("wk_chart_scoring_runs").select("*").order("created_at", { ascending: false }).limit(50),
      ]);

      if (!progErr && progData) setPrograms(progData as ChartProgram[]);
      if (!runErr && runData) setRuns(runData as ScoringRun[]);
    } catch {
      // leave defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Trigger a scoring run ──
  const handleTriggerRun = async () => {
    if (!selectedProgram || !editionDate) return;
    setTriggering(true);
    setTriggerStatus(null);

    try {
      const { error } = await supabase.functions.invoke("run-chart-scoring", {
        body: { program_id: selectedProgram, edition_date: editionDate },
      });

      if (error) {
        setTriggerStatus({ ok: false, message: error.message ?? "Edge function returned an error." });
      } else {
        setTriggerStatus({ ok: true, message: "Scoring run triggered successfully. Results are being written." });
        // Reload runs after a short delay
        setTimeout(() => loadData(), 2000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error invoking scoring function.";
      setTriggerStatus({ ok: false, message: msg });
    } finally {
      setTriggering(false);
    }
  };

  // ── Expand run to show results ──
  const handleExpandRun = async (run: ScoringRun) => {
    if (expandedRunId === run.id) {
      setExpandedRunId(null);
      setEditionPreview(null);
      setEntriesPreview([]);
      return;
    }

    setExpandedRunId(run.id);
    setLoadingPreview(true);
    setEditionPreview(null);
    setEntriesPreview([]);

    try {
      // Find the edition for this program + date
      const { data: editionData, error: editionErr } = await supabase
        .from("wk_chart_editions_v2")
        .select("id, edition_slug, edition_label, entry_count, new_entries_count, re_entries_count, carry_forward_count, status")
        .eq("program_id", run.program_id)
        .eq("edition_date", run.edition_date)
        .maybeSingle();

      if (editionErr || !editionData) {
        setEditionPreview(null);
        setLoadingPreview(false);
        return;
      }

      const edition = editionData as EditionPreview;
      setEditionPreview(edition);

      // Fetch entries
      const { data: entriesData, error: entriesErr } = await supabase
        .from("wk_chart_entries_v2")
        .select("rank, track_title, artist_name, total_score, movement, previous_rank, source_score, airplay_score, carry_forward_bonus")
        .eq("edition_id", edition.id)
        .order("rank", { ascending: true })
        .limit(30);

      if (!entriesErr && entriesData) {
        setEntriesPreview(entriesData as EntryPreview[]);
      }
    } catch {
      // ignore
    } finally {
      setLoadingPreview(false);
    }
  };

  // ── Loading state ──
  if (loading) return <AdminChartsLoadingState message="Loading scoring runs..." />;

  const runningCount = runs.filter((r) => r.status === "running").length;
  const failedCount = runs.filter((r) => r.status === "failed").length;
  const completedCount = runs.filter((r) => r.status === "completed").length;

  return (
    <div className="space-y-6">
      <AdminChartsPageHeader
        title="Scoring Runs"
        description="Run the full scoring pipeline against a chart program and edition date. The edge function fetches evidence, runs the engine, and writes results to chart editions."
      >
        <button
          onClick={() => navigate("/admin/charts/editions")}
          className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
        >
          <WkIcon name="Layers" size={14} />
          Editions
        </button>
      </AdminChartsPageHeader>

      {/* ── KPI strip ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="wk-panel p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-wk-success-soft text-wk-success">
            <WkIcon name="CheckCircle2" size={18} />
          </div>
          <div>
            <div className="text-[22px] font-black text-wk-text">{completedCount}</div>
            <div className="text-[11px] text-wk-text-muted">Completed Runs</div>
          </div>
        </div>
        <div className="wk-panel p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-wk-info-soft text-wk-info">
            <WkIcon name="Loader" size={18} className={runningCount > 0 ? "animate-spin" : ""} />
          </div>
          <div>
            <div className="text-[22px] font-black text-wk-text">{runningCount}</div>
            <div className="text-[11px] text-wk-text-muted">Running</div>
          </div>
        </div>
        <div className="wk-panel p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-wk-danger-soft text-wk-danger">
            <WkIcon name="AlertCircle" size={18} />
          </div>
          <div>
            <div className="text-[22px] font-black text-wk-text">{failedCount}</div>
            <div className="text-[11px] text-wk-text-muted">Failed</div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
        {/* ── Left: Run history ── */}
        <div className="space-y-4">
          <WkSurface className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <WkIcon name="History" size={16} className="text-wk-brand" />
                <h2 className="text-[14px] font-bold text-wk-text">Run History</h2>
              </div>
              <span className="text-[11px] text-wk-text-muted">{runs.length} runs</span>
            </div>

            {runs.length === 0 ? (
              <div className="py-8 text-center">
                <WkIcon name="BarChart3" size={32} className="text-wk-text-faint mx-auto mb-3" />
                <p className="text-[13px] text-wk-text-muted">No scoring runs yet.</p>
                <p className="text-[11px] text-wk-text-faint mt-1">Select a program and date, then click Run Scoring.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {runs.map((run) => {
                  const isExpanded = expandedRunId === run.id;
                  const program = programs.find((p) => p.id === run.program_id);
                  return (
                    <div key={run.id}>
                      <button
                        onClick={() => handleExpandRun(run)}
                        className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all hover:bg-wk-surface-raised ${
                          isExpanded ? "border-wk-brand bg-wk-surface-raised" : "border-wk-border"
                        }`}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-wk-brand-soft text-wk-brand">
                          <WkIcon name={run.status === "running" ? "Loader" : run.status === "completed" ? "Check" : run.status === "failed" ? "XCircle" : "Clock"} size={16} className={run.status === "running" ? "animate-spin" : ""} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[13px] font-bold text-wk-text">
                              {program?.short_label ?? program?.public_label ?? run.program_id}
                            </span>
                            <AdminChartsStatusBadge status={run.status} size="sm" />
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-wk-text-muted">
                            <span>{formatDate(run.edition_date)}</span>
                            {run.status === "completed" && (
                              <>
                                <span>{run.total_rows} rows</span>
                                <span>{run.eligible_rows} eligible</span>
                                <span>{run.carry_forward_rows} CF</span>
                              </>
                            )}
                            {run.status === "running" && <span>Started {formatDateTime(run.started_at)}</span>}
                          </div>
                          {run.error_message && (
                            <div className="mt-1 text-[11px] text-wk-danger truncate">{run.error_message}</div>
                          )}
                        </div>
                        <div className="shrink-0 text-wk-text-faint">
                          <WkIcon name={isExpanded ? "ChevronUp" : "ChevronDown"} size={16} />
                        </div>
                      </button>

                      {/* Expanded results preview */}
                      {isExpanded && (
                        <div className="ml-4 mt-2 border-l-2 border-wk-brand/30 pl-4 space-y-3">
                          {loadingPreview ? (
                            <div className="py-6 text-center text-[12px] text-wk-text-muted">
                              <WkIcon name="Loader" size={16} className="animate-spin inline mr-2" />
                              Loading results...
                            </div>
                          ) : editionPreview ? (
                            <>
                              {/* Edition summary */}
                              <div className="rounded-lg border border-wk-border bg-wk-bg-subtle p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <WkIcon name="Layers" size={14} className="text-wk-brand" />
                                  <span className="text-[12px] font-bold text-wk-text">{editionPreview.edition_label}</span>
                                  <AdminChartsStatusBadge status={editionPreview.status} size="sm" />
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-wk-text-muted">
                                  <span>{editionPreview.entry_count} entries</span>
                                  <span>{editionPreview.new_entries_count} new</span>
                                  <span>{editionPreview.re_entries_count} re-entries</span>
                                  <span>{editionPreview.carry_forward_count} carry-forward</span>
                                </div>
                              </div>

                              {/* Top entries */}
                              {entriesPreview.length > 0 && (
                                <div className="space-y-1">
                                  <div className="text-[11px] font-semibold text-wk-text-muted uppercase tracking-wider">Top Entries</div>
                                  <div className="rounded-lg border border-wk-border overflow-hidden">
                                    <table className="w-full text-left">
                                      <thead>
                                        <tr className="border-b border-wk-border bg-wk-bg-subtle">
                                          <th className="px-3 py-2 text-[10px] font-bold text-wk-text-muted uppercase">#</th>
                                          <th className="px-3 py-2 text-[10px] font-bold text-wk-text-muted uppercase">Track</th>
                                          <th className="px-3 py-2 text-[10px] font-bold text-wk-text-muted uppercase">Score</th>
                                          <th className="px-3 py-2 text-[10px] font-bold text-wk-text-muted uppercase">Movement</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {entriesPreview.slice(0, 10).map((entry) => (
                                          <tr key={entry.rank} className="border-b border-wk-border last:border-0 hover:bg-wk-surface-raised transition-colors">
                                            <td className="px-3 py-2 text-[12px] font-bold text-wk-text">{entry.rank}</td>
                                            <td className="px-3 py-2">
                                              <div className="text-[12px] font-semibold text-wk-text truncate max-w-[200px]">{entry.track_title}</div>
                                              <div className="text-[10px] text-wk-text-muted truncate max-w-[200px]">{entry.artist_name}</div>
                                            </td>
                                            <td className="px-3 py-2">
                                              <div className="text-[12px] font-bold text-wk-brand tabular-nums">{entry.total_score.toFixed(1)}</div>
                                              <div className="text-[9px] text-wk-text-faint flex gap-1">
                                                <span title="Source score">S:{entry.source_score.toFixed(1)}</span>
                                                {entry.airplay_score > 0 && <span title="Airplay">A:{entry.airplay_score.toFixed(1)}</span>}
                                                {entry.carry_forward_bonus > 0 && <span title="Carry-forward">C:{entry.carry_forward_bonus.toFixed(1)}</span>}
                                              </div>
                                            </td>
                                            <td className="px-3 py-2">
                                              {entry.movement === "new" && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-wk-success-soft px-2 py-0.5 text-[10px] font-bold text-wk-success">NEW</span>
                                              )}
                                              {entry.movement === "reentry" && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-wk-info-soft px-2 py-0.5 text-[10px] font-bold text-wk-info">RE</span>
                                              )}
                                              {entry.movement === "up" && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-wk-success">
                                                  <WkIcon name="ArrowUp" size={12} />{entry.previous_rank !== null ? entry.previous_rank - entry.rank : ""}
                                                </span>
                                              )}
                                              {entry.movement === "down" && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-wk-danger">
                                                  <WkIcon name="ArrowDown" size={12} />{entry.previous_rank !== null ? entry.rank - entry.previous_rank : ""}
                                                </span>
                                              )}
                                              {entry.movement === "same" && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-wk-text-muted">
                                                  <WkIcon name="Minus" size={12} />
                                                </span>
                                              )}
                                              {!entry.movement && <span className="text-[10px] text-wk-text-faint">—</span>}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {/* View full edition audit CTA */}
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => navigate(`/admin/charts/editions/${editionPreview.id}`)}
                                  className="flex items-center gap-1.5 text-[12px] font-semibold text-wk-brand hover:underline"
                                >
                                  <WkIcon name="BarChart2" size={14} />
                                  Full audit view
                                </button>
                                <span className="text-wk-text-faint text-[11px]">·</span>
                                <button
                                  onClick={() => navigate(`/admin/charts/editions`)}
                                  className="flex items-center gap-1.5 text-[12px] font-semibold text-wk-text-muted hover:underline"
                                >
                                  <WkIcon name="Layers" size={14} />
                                  All editions
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="py-4 text-center text-[12px] text-wk-text-muted">
                              No edition found for this run. The run may still be processing.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </WkSurface>
        </div>

        {/* ── Right: Trigger panel ── */}
        <div className="space-y-4">
          <WkSurface className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <WkIcon name="Rocket" size={16} className="text-wk-brand" />
              <h2 className="text-[14px] font-bold text-wk-text">Trigger Scoring Run</h2>
            </div>

            <div className="space-y-4">
              {/* Program selector */}
              <div>
                <label className="block text-[11px] font-bold text-wk-text-muted uppercase tracking-wider mb-1.5">
                  Chart Program
                </label>
                <select
                  value={selectedProgram}
                  onChange={(e) => { setSelectedProgram(e.target.value); setTriggerStatus(null); }}
                  className="wk-input w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text focus:outline-none focus:border-wk-brand"
                >
                  <option value="">Select a program...</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.public_label} {p.short_label && p.short_label !== p.public_label ? `(${p.short_label})` : ""} — {p.chart_size} positions
                    </option>
                  ))}
                </select>
              </div>

              {/* Edition date */}
              <div>
                <label className="block text-[11px] font-bold text-wk-text-muted uppercase tracking-wider mb-1.5">
                  Edition Date (Monday)
                </label>
                <input
                  type="date"
                  value={editionDate}
                  onChange={(e) => { setEditionDate(e.target.value); setTriggerStatus(null); }}
                  className="wk-input w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text focus:outline-none focus:border-wk-brand"
                />
                <p className="mt-1 text-[10px] text-wk-text-faint">The edition date determines the chart week (Mon-Sun).</p>
              </div>

              {/* Trigger button */}
              <button
                onClick={handleTriggerRun}
                disabled={triggering || !selectedProgram || !editionDate}
                className="wk-button wk-button-primary wk-button-base w-full justify-center whitespace-nowrap"
              >
                {triggering ? (
                  <>
                    <WkIcon name="Loader" size={14} className="animate-spin" />
                    Running Pipeline...
                  </>
                ) : (
                  <>
                    <WkIcon name="Rocket" size={14} />
                    Run Scoring
                  </>
                )}
              </button>

              {/* Status feedback */}
              {triggerStatus && (
                <div className={`rounded-lg border p-3 flex items-start gap-2 ${
                  triggerStatus.ok
                    ? "border-wk-success/20 bg-wk-success-soft"
                    : "border-wk-danger/20 bg-wk-danger-soft"
                }`}>
                  <WkIcon
                    name={triggerStatus.ok ? "CheckCircle2" : "AlertCircle"}
                    size={14}
                    className={triggerStatus.ok ? "text-wk-success mt-0.5" : "text-wk-danger mt-0.5"}
                  />
                  <p className={`text-[12px] ${triggerStatus.ok ? "text-wk-success" : "text-wk-danger"}`}>
                    {triggerStatus.message}
                  </p>
                </div>
              )}

              {/* Quick info */}
              <div className="rounded-lg border border-wk-border bg-wk-bg-subtle p-3">
                <div className="text-[11px] font-bold text-wk-text mb-1">What happens</div>
                <ul className="text-[11px] text-wk-text-muted space-y-1 list-disc list-inside">
                  <li>Fetches the program config from <code className="text-[10px] bg-wk-surface-raised px-1 rounded">wk_chart_programs_v2</code></li>
                  <li>Pulls staging evidence rows and airplay data</li>
                  <li>Runs the full scoring pipeline (sources, cross-source, continuity, airplay, anti-gaming)</li>
                  <li>Writes a draft edition + ranked entries to Supabase</li>
                  <li>Scoring policy version: v1.0.1</li>
                </ul>
              </div>
            </div>
          </WkSurface>

          {/* Selected program preview */}
          {selectedProgram && (
            <WkSurface className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <WkIcon name="FolderTree" size={14} className="text-wk-text-muted" />
                <h3 className="text-[12px] font-bold text-wk-text">Program Config</h3>
              </div>
              {(() => {
                const prog = programs.find((p) => p.id === selectedProgram);
                if (!prog) return null;
                return (
                  <div className="space-y-2 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-wk-text-muted">Chart size</span>
                      <span className="font-semibold text-wk-text">{prog.chart_size} positions</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-wk-text-muted">Airplay</span>
                      <span className={`font-semibold ${prog.airplay_enabled ? "text-wk-success" : "text-wk-text-faint"}`}>
                        {prog.airplay_enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </WkSurface>
          )}
        </div>
      </div>
    </div>
  );
}