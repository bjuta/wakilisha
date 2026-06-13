import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { WkIcon } from "@/components/design-system/Icon";
import type { IngestRun } from "@/services/chartsIngestion/ingestStudioTypes";
import { validateCommitReadiness } from "@/services/chartsIngestion/commitService";
import type { CommitValidationResult } from "@/services/chartsIngestion/commitTypes";
import { resolveV2Program } from "@/services/chartsIngestion/v2Programs";

interface PublishChecklistProps {
  run: IngestRun;
  onCommit?: () => void;
  commitLoading?: boolean;
  commitError?: string | null;
}

interface ChecklistItem {
  label: string;
  pass: boolean;
  required: boolean;
  detail?: string;
  blocking?: boolean;
}

async function buildChecklist(run: IngestRun): Promise<ChecklistItem[]> {
  const failedStages = run.stages.filter((s) => s.status === "failed");
  const fetchStage = run.stages.find((s) => s.stage === "source_fetch");
  const canonicalStage = run.stages.find((s) => s.stage === "canonical_match");
  const enrichmentStage = run.stages.find((s) => s.stage === "enrichment");
  const noMatchRows = run.rows.filter((r) => r.matchStatus === "no_match");
  const shells = run.rows.filter((r) => r.matchStatus === "shell");
  const unresolvedGaps = run.rows.filter((r) => r.matchStatus === "needs_review");
  const matchRate = run.summary.matchRate ?? 0;

  const programId = run.existingSeriesId || "";
  const program = await resolveV2Program(programId);

  return [
    {
      label: "Dry run completed",
      pass: run.status === "dry_run_complete" || run.status === "ready_to_commit",
      required: true,
      blocking: true,
      detail:
        run.status === "dry_run_complete"
          ? "Dry run complete and ready for commit"
          : `Status: ${run.status.replace(/_/g, " ")} — run a dry run first`,
    },
    {
      label: "Edition metadata complete",
      pass: !!(run.chartTitle && run.chartSlug && run.editionDate),
      required: true,
      blocking: true,
      detail: !run.chartTitle
        ? "Missing chart title"
        : !run.chartSlug
        ? "Missing chart slug"
        : !run.editionDate
        ? "Missing edition date"
        : `${run.chartSlug} · ${run.editionDate}`,
    },
    {
      label: "Program resolved (V2)",
      pass: !!program,
      required: true,
      blocking: true,
      detail: program
        ? `Program: ${program.label} (${program.publicSlug})`
        : `No V2 program found for family '${programId}'. Select a valid chart family.`,
    },
    {
      label: "Sources fetched",
      pass: fetchStage?.status === "done" || fetchStage?.status === "warning",
      required: true,
      blocking: true,
      detail:
        fetchStage?.status === "failed"
          ? `Source fetch failed: ${fetchStage.message || "check credentials"}`
          : fetchStage?.status === "warning"
          ? "Partial source failure — some rows may be missing"
          : "All sources fetched",
    },
    {
      label: "No failed pipeline stages",
      pass: failedStages.length === 0,
      required: true,
      blocking: true,
      detail:
        failedStages.length > 0
          ? `${failedStages.length} failed: ${failedStages.map((s) => s.stage.replace(/_/g, " ")).join(", ")}`
          : "All stages passed",
    },
    {
      label: "Canonical matching done",
      pass: canonicalStage?.status === "done" || canonicalStage?.status === "warning",
      required: true,
      blocking: true,
      detail:
        canonicalStage?.status !== "done" && canonicalStage?.status !== "warning"
          ? "Canonical match stage has not run"
          : `Match rate: ${matchRate.toFixed(1)}% · ${run.summary.canonicalMatches} canonical`,
    },
    {
      label: "No unresolved review gaps",
      pass: unresolvedGaps.length === 0,
      required: true,
      blocking: true,
      detail:
        unresolvedGaps.length > 0
          ? `${unresolvedGaps.length} rows in 'needs_review' — resolve or send to review queue`
          : "All rows resolved",
    },
    {
      label: "Chart size valid",
      pass: run.chartSize >= 1 && run.chartSize <= 200,
      required: true,
      blocking: true,
      detail: `${run.chartSize} tracks (valid 1–200)`,
    },
    {
      label: "Match rate ≥ 85%",
      pass: matchRate >= 85,
      required: false,
      detail:
        matchRate < 85
          ? `${matchRate.toFixed(1)}% — below target, edition will be committed with warnings`
          : `${matchRate.toFixed(1)}% — excellent match rate`,
    },
    {
      label: "No unmatched rows",
      pass: noMatchRows.length === 0,
      required: false,
      detail:
        noMatchRows.length > 0
          ? `${noMatchRows.length} no_match rows — will be committed honestly flagged`
          : "All rows matched",
    },
    {
      label: "Release shells resolved",
      pass: shells.length === 0,
      required: false,
      detail:
        shells.length > 0
          ? `${shells.length} shells — will be committed, promote to canonical later`
          : "No pending shells",
    },
    {
      label: "Enrichment complete",
      pass: enrichmentStage?.status === "done" || enrichmentStage?.status === "warning",
      required: false,
      detail:
        enrichmentStage?.status === "warning"
          ? "Enrichment ran with warnings (mock mode or missing credentials)"
          : enrichmentStage?.status !== "done"
          ? "Enrichment not yet run"
          : "All rows enriched",
    },
  ];
}

export function PublishChecklist({
  run,
  onCommit,
  commitLoading,
  commitError,
}: PublishChecklistProps) {
  const navigate = useNavigate();
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [validation, setValidation] = useState<CommitValidationResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [cl, val] = await Promise.all([
        buildChecklist(run),
        validateCommitReadiness(run),
      ]);
      if (!cancelled) {
        setChecklist(cl);
        setValidation(val);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [run]);

  const required = checklist.filter((c) => c.required && c.blocking);
  const passCount = checklist.filter((c) => c.pass).length;
  const requiredFail = required.filter((c) => !c.pass);
  const allRequiredPass = requiredFail.length === 0;

  // Also run the full validation to get specific error messages
  const canCommit = validation?.canCommit;

  return (
    <WkSurface className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-bold text-wk-text">Publish Readiness</h2>
        <div className="flex items-center gap-2">
          {requiredFail.length > 0 && (
            <span className="text-[11px] font-bold text-wk-danger">
              <i className="ri-lock-line mr-0.5" />
              {requiredFail.length} required failing
            </span>
          )}
          <span
            className={`text-[12px] font-bold ${allRequiredPass ? "text-wk-success" : "text-wk-warning"}`}
          >
            {passCount}/{checklist.length}
          </span>
        </div>
      </div>

      <div className="space-y-1.5 mb-4">
        {checklist.map((item) => (
          <div key={item.label} className="flex items-start gap-2">
            <div
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] ${
                item.pass
                  ? "bg-wk-success text-white"
                  : item.required
                  ? "bg-wk-danger text-white"
                  : "bg-wk-border text-wk-text-faint"
              }`}
            >
              {item.pass ? (
                <i className="ri-check-line" />
              ) : (
                <i className="ri-close-line" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[12px] font-semibold ${
                    item.pass
                      ? "text-wk-text-soft"
                      : item.required
                      ? "text-wk-danger"
                      : "text-wk-text-muted"
                  }`}
                >
                  {item.label}
                </span>
                {!item.required && (
                  <span className="text-[9px] text-wk-text-faint bg-wk-surface-raised px-1 py-0.5 rounded">
                    optional
                  </span>
                )}
              </div>
              {item.detail && (
                <p
                  className={`text-[11px] leading-relaxed ${
                    item.pass
                      ? "text-wk-text-faint"
                      : item.required && !item.pass
                      ? "text-wk-danger/80"
                      : "text-wk-text-muted"
                  }`}
                >
                  {item.detail}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Validation errors from service */}
      {!canCommit && validation?.errors.length > 0 && (
        <div className="mb-3 rounded-lg border border-wk-danger/20 bg-wk-danger-soft p-3">
          <p className="text-[12px] font-bold text-wk-danger mb-1.5">
            <i className="ri-lock-line mr-1" />
            Cannot commit — {validation.errors.length} issue
            {validation.errors.length > 1 ? "s" : ""}
          </p>
          <ul className="space-y-1">
            {validation.errors.slice(0, 4).map((err, i) => (
              <li key={i} className="text-[11px] text-wk-danger/90 flex items-start gap-1">
                <i className="ri-error-warning-line shrink-0 mt-0.5" />
                {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {canCommit && validation?.warnings.length > 0 && (
        <div className="mb-3 rounded-lg border border-wk-warning/20 bg-wk-warning-soft p-3">
          <p className="text-[11px] font-bold text-wk-warning mb-1">
            <i className="ri-alert-line mr-1" />
            {validation.warnings.length} warning
            {validation.warnings.length > 1 ? "s" : ""} — edition will commit with these notes
          </p>
          <ul className="space-y-0.5">
            {validation.warnings.slice(0, 3).map((w, i) => (
              <li key={i} className="text-[11px] text-wk-text-soft">
                · {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Commit error from parent */}
      {commitError && (
        <div className="mb-3 rounded-lg border border-wk-danger/20 bg-wk-danger-soft p-3">
          <p className="text-[12px] font-bold text-wk-danger">
            <i className="ri-close-circle-line mr-1" />
            Commit failed
          </p>
          <p className="text-[11px] text-wk-danger/90 mt-1">{commitError}</p>
        </div>
      )}

      {/* Commit button */}
      {onCommit && (
        <button
          onClick={onCommit}
          disabled={!canCommit || commitLoading}
          className={`w-full rounded-lg px-4 py-2.5 text-[13px] font-bold transition-all whitespace-nowrap ${
            canCommit && !commitLoading
              ? "bg-wk-brand text-wk-brand-on hover:opacity-90 active:scale-[0.98] cursor-pointer"
              : "bg-wk-surface-raised text-wk-text-faint cursor-not-allowed"
          }`}
          title={
            !canCommit
              ? `Commit blocked: ${validation?.errors[0]?.message || "resolve required checks"}`
              : "Commit this edition to V2"
          }
        >
          {commitLoading ? (
            <span className="flex items-center justify-center gap-2">
              <i className="ri-loader-4-line animate-spin" />
              Committing…
            </span>
          ) : canCommit ? (
            <span className="flex items-center justify-center gap-1.5">
              <WkIcon name="SendHorizontal" size={14} />
              Commit Edition to V2
            </span>
          ) : (
            <span className="flex items-center justify-center gap-1.5">
              <WkIcon name="Lock" size={14} />
              Commit Blocked ({requiredFail.length} required failing)
            </span>
          )}
        </button>
      )}

      {canCommit && (
        <p className="mt-2 text-center text-[11px] text-wk-text-muted">
          This will write a V2 edition, entries, and source coverage. Irreversible in production.
        </p>
      )}
    </WkSurface>
  );
}