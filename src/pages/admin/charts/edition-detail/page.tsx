import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { AdminChartsPageHeader } from "../components/AdminChartsPageHeader";
import { AdminChartsStatusBadge } from "../components/AdminChartsStatusBadge";
import { AdminChartsLoadingState } from "../components/AdminChartsLoadingState";
import { PolicySnapshotPanel } from "./components/PolicySnapshotPanel";
import { ExclusionSummaryPanel } from "./components/ExclusionSummaryPanel";
import { EntryAuditTable } from "./components/EntryAuditTable";
import { AuditSurfacePanel } from "./components/AuditSurfacePanel";
import type { WkChartEditionV2Row, WkChartEntryV2Row, ScoringConfig } from "@/services/chartsScoring/scoringTypes";

interface ChartProgramBasic {
  id: string;
  public_label: string;
  short_label: string;
}

interface PlaybackEnrichmentRunRow {
  id: string;
  status: string;
  provider: string;
  storefront: string;
  write_mode: boolean;
  total_candidates: number;
  processed_count: number;
  matched_count: number;
  accepted_count: number;
  needs_review_count: number;
  failed_count: number;
  top_ten_coverage_count: number;
  full_coverage_count: number;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

interface PlaybackEnrichmentItemRow {
  id: string;
  rank: number | null;
  track_title: string;
  artist_name: string | null;
  status: string;
  match_method: string | null;
  confidence: number | null;
  provider_track_id: string | null;
  provider_url: string | null;
  preview_url: string | null;
  error_message: string | null;
}

function formatShortDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusTone(status: string): "muted" | "brand" | "success" | "warning" | "danger" | "info" {
  if (["completed", "accepted", "matched"].includes(status)) return "success";
  if (["running", "queued"].includes(status)) return "info";
  if (["partial", "needs_review"].includes(status)) return "warning";
  if (["failed", "not_found"].includes(status)) return "danger";
  return "muted";
}

function Pill({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "brand" | "success" | "warning" | "danger" | "info" }) {
  const classes: Record<string, string> = {
    muted: "border-wk-border bg-wk-surface-raised text-wk-text-muted",
    brand: "border-wk-brand/25 bg-wk-brand-soft text-wk-brand",
    success: "border-wk-success/25 bg-wk-success-soft text-wk-success",
    warning: "border-wk-warning/25 bg-wk-warning-soft text-wk-warning",
    danger: "border-wk-danger/25 bg-wk-danger-soft text-wk-danger",
    info: "border-wk-info/25 bg-wk-info-soft text-wk-info",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${classes[tone]}`}>
      {children}
    </span>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function KpiCard({ label, value, icon, accent = "muted" }: {
  label: string;
  value: number | string;
  icon: string;
  accent?: "muted" | "brand" | "success" | "warning" | "danger" | "info";
}) {
  const colors: Record<string, string> = {
    muted:   "bg-wk-surface-raised text-wk-text-muted",
    brand:   "bg-wk-brand-soft text-wk-brand",
    success: "bg-wk-success-soft text-wk-success",
    warning: "bg-wk-warning-soft text-wk-warning",
    danger:  "bg-wk-danger-soft text-wk-danger",
    info:    "bg-wk-info-soft text-wk-info",
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-wk-border bg-wk-surface p-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${colors[accent]}`}>
        <WkIcon name={icon as never} size={18} />
      </div>
      <div>
        <div className="text-[22px] font-black tabular-nums text-wk-text leading-none">{value}</div>
        <div className="text-[11px] text-wk-text-muted mt-0.5">{label}</div>
      </div>
    </div>
  );
}

export default function AdminChartsEditionDetailPage() {
  const { editionId } = useParams<{ editionId: string }>();
  const navigate = useNavigate();

  const [edition, setEdition] = useState<WkChartEditionV2Row | null>(null);
  const [entries, setEntries] = useState<WkChartEntryV2Row[]>([]);
  const [program, setProgram] = useState<ChartProgramBasic | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [playbackRun, setPlaybackRun] = useState<PlaybackEnrichmentRunRow | null>(null);
  const [playbackItems, setPlaybackItems] = useState<PlaybackEnrichmentItemRow[]>([]);
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [playbackBusy, setPlaybackBusy] = useState<"dry" | "write" | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const loadEdition = useCallback(async () => {
    if (!editionId) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: edErr } = await supabase
        .from("wk_chart_editions_v2")
        .select("*")
        .eq("id", editionId)
        .maybeSingle();

      if (edErr) throw new Error(edErr.message);
      if (!data) throw new Error("Edition not found");

      const ed = data as WkChartEditionV2Row;
      setEdition(ed);

      // Load program
      const { data: progData } = await supabase
        .from("wk_chart_programs_v2")
        .select("id, public_label, short_label")
        .eq("id", ed.program_id)
        .maybeSingle();

      if (progData) setProgram(progData as ChartProgramBasic);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load edition");
    } finally {
      setLoading(false);
    }
  }, [editionId]);

  const loadEntries = useCallback(async () => {
    if (!editionId) return;
    setLoadingEntries(true);

    try {
      const { data, error: entErr } = await supabase
        .from("wk_chart_entries_v2")
        .select("*")
        .eq("edition_id", editionId)
        .order("rank", { ascending: true });

      if (entErr) throw new Error(entErr.message);
      setEntries((data ?? []) as WkChartEntryV2Row[]);
    } catch {
      setEntries([]);
    } finally {
      setLoadingEntries(false);
    }
  }, [editionId]);

  const loadPlaybackEnrichment = useCallback(async () => {
    if (!editionId) return;
    setPlaybackLoading(true);
    setPlaybackError(null);

    try {
      const { data: runData, error: runErr } = await supabase
        .from("wk_chart_playback_enrichment_runs")
        .select("*")
        .eq("chart_edition_id", editionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (runErr) throw new Error(runErr.message);

      const latestRun = runData as PlaybackEnrichmentRunRow | null;
      setPlaybackRun(latestRun);

      if (!latestRun?.id) {
        setPlaybackItems([]);
        return;
      }

      const { data: itemData, error: itemErr } = await supabase
        .from("wk_chart_playback_enrichment_items")
        .select("id, rank, track_title, artist_name, status, match_method, confidence, provider_track_id, provider_url, preview_url, error_message")
        .eq("run_id", latestRun.id)
        .order("rank", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
        .limit(15);

      if (itemErr) throw new Error(itemErr.message);

      setPlaybackItems((itemData ?? []) as PlaybackEnrichmentItemRow[]);
    } catch (err: unknown) {
      setPlaybackError(err instanceof Error ? err.message : "Failed to load playback enrichment");
    } finally {
      setPlaybackLoading(false);
    }
  }, [editionId]);

  const startPlaybackEnrichment = useCallback(async (write: boolean) => {
    if (!editionId) return;
    setPlaybackBusy(write ? "write" : "dry");
    setPlaybackError(null);

    try {
      const limit = Math.max(1, Math.min(500, Number(edition?.chart_size ?? entries.length ?? 100) || 100));

      const { error: invokeErr } = await supabase.functions.invoke("run-chart-playback-enrichment", {
        body: {
          chart_edition_id: editionId,
          provider: "apple_music",
          storefront: "ke",
          limit,
          min_auto_accept: 0.9,
          write,
        },
      });

      if (invokeErr) throw new Error(invokeErr.message);

      await loadPlaybackEnrichment();
    } catch (err: unknown) {
      setPlaybackError(err instanceof Error ? err.message : "Playback enrichment failed");
    } finally {
      setPlaybackBusy(null);
    }
  }, [edition?.chart_size, editionId, entries.length, loadPlaybackEnrichment]);

  useEffect(() => {
    loadEdition();
    loadEntries();
  }, [loadEdition, loadEntries]);

  useEffect(() => {
    loadPlaybackEnrichment();
  }, [loadPlaybackEnrichment]);

  if (loading) return <AdminChartsLoadingState message="Loading edition audit…" />;

  if (error || !edition) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <WkIcon name="AlertCircle" size={40} className="text-wk-danger" />
        <p className="text-[15px] font-semibold text-wk-text">{error ?? "Edition not found"}</p>
        <button
          onClick={() => navigate("/admin/charts/scoring-runs")}
          className="wk-button wk-button-ghost wk-button-sm"
        >
          <WkIcon name="ArrowLeft" size={14} />
          Back to Scoring Runs
        </button>
      </div>
    );
  }

  const totalExcluded = edition.entry_count
    ? (edition.carry_forward_count + edition.new_entries_count + edition.re_entries_count) < edition.entry_count
      ? 0
      : 0
    : 0;

  const exclusionTotal = Object.values(edition.exclusion_summary ?? {}).reduce<number>((s, n) => s + Number(n), 0);
  const eligibleTotal = edition.entry_count ?? entries.length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <AdminChartsPageHeader
        eyebrow={program?.public_label ?? "Chart Program"}
        title={edition.edition_label ?? edition.edition_slug}
        description={`Edition ${edition.edition_date} · Full scoring audit surface`}
      >
        <button
          onClick={() => navigate("/admin/charts/scoring-runs")}
          className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
        >
          <WkIcon name="ArrowLeft" size={14} />
          Scoring Runs
        </button>
        <button
          onClick={() => navigate("/admin/charts/editions")}
          className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
        >
          <WkIcon name="Layers" size={14} />
          All Editions
        </button>
      </AdminChartsPageHeader>

      {/* Edition meta banner */}
      <WkSurface className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <AdminChartsStatusBadge status={edition.status} size="base" />
            <span className="text-[12px] text-wk-text-muted font-mono">{edition.edition_slug}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-wk-text-muted">
            <WkIcon name="Calendar" size={12} />
            Edition date: <strong className="text-wk-text">{formatDate(edition.edition_date)}</strong>
          </div>
          {edition.period_start && edition.period_end && (
            <div className="flex items-center gap-1.5 text-[12px] text-wk-text-muted">
              <WkIcon name="CalendarRange" size={12} />
              Period: {formatDate(edition.period_start)} → {formatDate(edition.period_end)}
            </div>
          )}
          {edition.published_at && (
            <div className="flex items-center gap-1.5 text-[12px] text-wk-text-muted">
              <WkIcon name="CheckCircle2" size={12} className="text-wk-success" />
              Published {formatDate(edition.published_at)}
              {edition.published_by && <span className="text-wk-text-faint">by {edition.published_by}</span>}
            </div>
          )}
          {edition.override_mode && (
            <div className="flex items-center gap-1.5 text-[12px] text-wk-text-muted">
              <WkIcon name="Settings" size={12} />
              Override mode: <code className="font-mono text-[11px]">{edition.override_mode}</code>
            </div>
          )}
        </div>
      </WkSurface>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <KpiCard label="Total Entries"   value={edition.entry_count ?? entries.length} icon="Hash"        accent="brand" />
        <KpiCard label="New Entries"     value={edition.new_entries_count}              icon="Star"        accent="success" />
        <KpiCard label="Re-entries"      value={edition.re_entries_count}               icon="RefreshCw"   accent="info" />
        <KpiCard label="Carry-Forward"   value={edition.carry_forward_count}            icon="RotateCcw"   accent="warning" />
        <KpiCard label="Excluded"        value={exclusionTotal}                         icon="Filter"      accent={exclusionTotal > 0 ? "warning" : "muted"} />
        <KpiCard label="Chart Size"      value={edition.chart_size ?? "—"}             icon="List"        accent="muted" />
      </div>

      {/* Policy Snapshot (§12) */}
      <PolicySnapshotPanel
        methodologyVersion={edition.methodology_version}
        sourceVersion={edition.source_policy_version}
        eligibilityVersion={edition.eligibility_policy_version}
        scoringVersion={edition.scoring_policy_version}
        ruleSetSnapshot={(edition.rule_set_snapshot as unknown as ScoringConfig) ?? null}
        overrideMode={edition.override_mode}
      />

      {/* Exclusion Summary (§6) */}
      <ExclusionSummaryPanel
        exclusionSummary={edition.exclusion_summary ?? {}}
        totalExcluded={exclusionTotal}
        totalEligible={eligibleTotal}
      />

      {/* Apple Music playback enrichment */}
      <WkSurface className="p-4 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <WkIcon name="Music" size={16} className="text-wk-brand" />
              <h2 className="text-[15px] font-bold text-wk-text">Apple Music Playback Enrichment</h2>
              {playbackRun && <Pill tone={statusTone(playbackRun.status)}>{playbackRun.status}</Pill>}
            </div>
            <p className="max-w-3xl text-[12px] text-wk-text-muted">
              Match this edition against Apple Music, review confidence, then persist accepted links into playback provider data.
            </p>
            {playbackRun && (
              <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-wk-text-muted">
                <span>Run <code className="font-mono text-wk-text">{playbackRun.id.slice(0, 8)}</code></span>
                <span>Created {formatShortDateTime(playbackRun.created_at)}</span>
                {playbackRun.finished_at && <span>Finished {formatShortDateTime(playbackRun.finished_at)}</span>}
                <span>{playbackRun.write_mode ? "Persist mode" : "Dry run"}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadPlaybackEnrichment()}
              disabled={playbackLoading || playbackBusy !== null}
              className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
            >
              <WkIcon name="RefreshCw" size={13} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => startPlaybackEnrichment(false)}
              disabled={playbackBusy !== null}
              className="wk-button wk-button-secondary wk-button-sm whitespace-nowrap"
            >
              <WkIcon name="Play" size={13} />
              {playbackBusy === "dry" ? "Running…" : "Dry Run"}
            </button>
            <button
              type="button"
              onClick={() => startPlaybackEnrichment(true)}
              disabled={playbackBusy !== null}
              className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
            >
              <WkIcon name="Save" size={13} />
              {playbackBusy === "write" ? "Persisting…" : "Run + Persist Accepted"}
            </button>
          </div>
        </div>

        {playbackError && (
          <div className="rounded-lg border border-wk-danger/20 bg-wk-danger-soft px-3 py-2 text-[12px] font-semibold text-wk-danger">
            {playbackError}
          </div>
        )}

        {playbackRun ? (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
              <KpiCard label="Candidates" value={playbackRun.total_candidates ?? 0} icon="List" accent="muted" />
              <KpiCard label="Processed" value={playbackRun.processed_count ?? 0} icon="RefreshCw" accent="info" />
              <KpiCard label="Matched" value={playbackRun.matched_count ?? 0} icon="CheckCircle2" accent="success" />
              <KpiCard label="Accepted" value={playbackRun.accepted_count ?? 0} icon="BadgeCheck" accent="success" />
              <KpiCard label="Needs Review" value={playbackRun.needs_review_count ?? 0} icon="AlertTriangle" accent="warning" />
              <KpiCard label="Failed" value={playbackRun.failed_count ?? 0} icon="XCircle" accent={playbackRun.failed_count > 0 ? "danger" : "muted"} />
              <KpiCard
                label="Persisted"
                value={Number(playbackRun.metadata?.persisted_provider_link_count ?? 0)}
                icon="Link"
                accent={Number(playbackRun.metadata?.persisted_provider_link_count ?? 0) > 0 ? "brand" : "muted"}
              />
            </div>

            <div className="overflow-hidden rounded-xl border border-wk-border">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-wk-surface-raised text-[10px] font-bold uppercase tracking-[0.12em] text-wk-text-muted">
                  <tr>
                    <th className="px-3 py-2">Rank</th>
                    <th className="px-3 py-2">Track</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Confidence</th>
                    <th className="px-3 py-2">Provider</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-wk-border">
                  {playbackItems.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-wk-text-muted">
                        {playbackLoading ? "Loading playback items…" : "No playback items yet."}
                      </td>
                    </tr>
                  )}
                  {playbackItems.map((item) => (
                    <tr key={item.id} className="bg-wk-surface">
                      <td className="px-3 py-2 font-mono text-wk-text-muted">{item.rank ?? "—"}</td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-wk-text">{item.track_title}</div>
                        <div className="text-[11px] text-wk-text-muted">{item.artist_name ?? "Unknown artist"}</div>
                        {item.error_message && <div className="mt-1 text-[11px] text-wk-danger">{item.error_message}</div>}
                      </td>
                      <td className="px-3 py-2"><Pill tone={statusTone(item.status)}>{item.status}</Pill></td>
                      <td className="px-3 py-2 font-mono text-wk-text-muted">
                        {item.confidence == null ? "—" : item.confidence.toFixed(2)}
                        {item.match_method && <div className="text-[10px]">{item.match_method}</div>}
                      </td>
                      <td className="px-3 py-2">
                        {item.provider_track_id ? (
                          <div className="space-y-1">
                            <code className="block font-mono text-[11px] text-wk-text">{item.provider_track_id}</code>
                            {item.provider_url && (
                              <a href={item.provider_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-wk-brand">
                                Open <WkIcon name="ExternalLink" size={10} />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-wk-text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-wk-border bg-wk-surface-raised px-4 py-6 text-center text-[12px] text-wk-text-muted">
            No playback enrichment run exists for this edition yet.
          </div>
        )}
      </WkSurface>

      {/* Ingest run link */}
      {edition.ingest_run_id && (
        <WkSurface className="p-4 flex items-center gap-3">
          <WkIcon name="Database" size={16} className="text-wk-info" />
          <div className="flex-1 text-[12px] text-wk-text-muted">
            Sourced from ingest run: <code className="font-mono text-wk-text">{edition.ingest_run_id}</code>
          </div>
          <button
            onClick={() => navigate(`/admin/charts/ingest-runs/${edition.ingest_run_id}`)}
            className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
          >
            <WkIcon name="ArrowRight" size={13} />
            View Run
          </button>
        </WkSurface>
      )}

      {/* Score sum invariant note */}
      <div className="flex items-start gap-3 rounded-xl border border-wk-brand/20 bg-wk-brand-soft px-4 py-3">
        <WkIcon name="FlaskConical" size={15} className="text-wk-brand mt-0.5 shrink-0" />
        <div className="text-[12px] text-wk-text-muted">
          <strong className="text-wk-text">Score Sum Invariant check</strong> — Each row below shows a{" "}
          <span className="font-mono text-[11px] bg-wk-surface px-1.5 py-0.5 rounded border border-wk-border">Sum ✓</span>{" "}
          badge verifying that <code className="font-mono text-[11px]">src + cross + ovl + rec + cont + cf + air − penalty = stored_total</code>{" "}
          to 0.001 precision. Any mismatch surfaces as a red{" "}
          <span className="font-mono text-[11px] bg-wk-danger-soft text-wk-danger px-1.5 py-0.5 rounded border border-wk-danger/20">Mismatch</span> flag.
        </div>
      </div>

      {/* Aggregate audit surface */}
      {!loadingEntries && entries.length > 0 && (
        <AuditSurfacePanel entries={entries} />
      )}

      {/* Per-entry audit table */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <WkIcon name="BarChart2" size={16} className="text-wk-brand" />
          <h2 className="text-[15px] font-bold text-wk-text">
            Entry Audit ({loadingEntries ? "…" : entries.length} entries)
          </h2>
          <span className="text-[11px] text-wk-text-muted">Click any row to expand full audit breakdown</span>
        </div>
        <EntryAuditTable entries={entries} loading={loadingEntries} />
      </div>
    </div>
  );
}