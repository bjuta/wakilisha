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

  useEffect(() => {
    loadEdition();
    loadEntries();
  }, [loadEdition, loadEntries]);

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