import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { IngestRun } from "@/services/chartsIngestion/ingestStudioTypes";

interface PublishChecklistProps {
  run: IngestRun;
}

interface ChecklistItem {
  label: string;
  pass: boolean;
  required: boolean;
  detail?: string;
  sprint5Gate?: boolean;
}

function buildPublishChecklist(run: IngestRun): ChecklistItem[] {
  const failedStages = run.stages.filter((s) => s.status === "failed");
  const warnStages = run.stages.filter((s) => s.status === "warning");
  const unresolved = run.rows.filter((r) => r.matchStatus === "needs_review" || r.matchStatus === "no_match");
  const shells = run.rows.filter((r) => r.matchStatus === "shell");
  const noMatchRows = run.rows.filter((r) => r.matchStatus === "no_match");

  const canonicalStage = run.stages.find((s) => s.stage === "canonical_match");
  const enrichmentStage = run.stages.find((s) => s.stage === "enrichment");
  const fetchStage = run.stages.find((s) => s.stage === "source_fetch");

  const matchRate = run.summary.matchRate ?? 0;

  return [
    {
      label: "Dry run completed",
      pass: run.status === "dry_run_complete" || run.status === "ready_to_commit",
      required: true,
      detail: run.status === "dry_run_complete" ? "Ready for review" : "Run a dry run first",
    },
    {
      label: "Edition metadata is complete",
      pass: !!run.chartTitle && !!run.chartSlug && !!run.editionDate,
      required: true,
      detail: !run.chartTitle ? "Missing chart title" : !run.chartSlug ? "Missing chart slug" : !run.editionDate ? "Missing edition date" : "All metadata present",
    },
    {
      label: "Sources fetched successfully",
      pass: fetchStage?.status === "done" || fetchStage?.status === "warning",
      required: true,
      detail: fetchStage?.status === "failed"
        ? `Source fetch failed: ${fetchStage.message || "check source URLs and credentials"}`
        : fetchStage?.status === "warning"
        ? "Partial source failure — some rows may be missing"
        : "All sources fetched",
    },
    {
      label: "No failed pipeline stages",
      pass: failedStages.length === 0,
      required: true,
      detail: failedStages.length > 0
        ? `${failedStages.length} failed: ${failedStages.map((s) => s.stage.replace(/_/g, " ")).join(", ")}`
        : "All stages passed",
    },
    {
      label: "Canonical matching complete",
      pass: canonicalStage?.status === "done" || canonicalStage?.status === "warning",
      required: true,
      detail: canonicalStage?.status !== "done" && canonicalStage?.status !== "warning"
        ? "Canonical match stage not run"
        : `Match rate: ${matchRate.toFixed(1)}% (${run.summary.canonicalMatches} canonical)`,
    },
    {
      label: "Match rate ≥ 85%",
      pass: matchRate >= 85,
      required: false,
      detail: matchRate < 85
        ? `Current: ${matchRate.toFixed(1)}% — ${unresolved.length + noMatchRows.length} rows unresolved`
        : `${matchRate.toFixed(1)}% — excellent match rate`,
    },
    {
      label: "No no_match rows",
      pass: noMatchRows.length === 0,
      required: false,
      detail: noMatchRows.length > 0
        ? `${noMatchRows.length} rows have no registry match — create shells or resolve manually`
        : "All rows matched",
    },
    {
      label: "Release shells resolved",
      pass: shells.length === 0,
      required: false,
      detail: shells.length > 0
        ? `${shells.length} shells exist — promote to canonical or mark as new entity`
        : "No pending shells",
    },
    {
      label: "Enrichment pipeline run",
      pass: enrichmentStage?.status === "done" || enrichmentStage?.status === "warning",
      required: false,
      detail: enrichmentStage?.status === "warning"
        ? "Enrichment ran with warnings — some providers may be mocked"
        : enrichmentStage?.status !== "done"
        ? "Enrichment not yet run"
        : "All rows enriched",
    },
    {
      label: "Chart size target met",
      pass: run.rows.length >= Math.min(run.chartSize * 0.8, 10),
      required: false,
      detail: run.rows.length < run.chartSize
        ? `${run.rows.length}/${run.chartSize} — below target size`
        : `${run.rows.length}/${run.chartSize} — target met`,
    },
    {
      label: "Snapshot / Commit",
      pass: false,
      required: false,
      sprint5Gate: true,
      detail: "Commit is gated until Sprint 5. Dry run complete — edition will be persisted when Sprint 5 gates are cleared.",
    },
  ];
}

export function PublishChecklist({ run }: PublishChecklistProps) {
  const checklist = buildPublishChecklist(run);
  const required = checklist.filter((c) => c.required);
  const passCount = checklist.filter((c) => c.pass).length;
  const requiredFail = required.filter((c) => !c.pass).length;
  const allRequiredPass = requiredFail === 0;
  const total = checklist.length;

  return (
    <WkSurface className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-bold text-wk-text">Publish Readiness</h2>
        <div className="flex items-center gap-2">
          {requiredFail > 0 && (
            <span className="text-[11px] font-bold text-wk-danger">
              <i className="ri-lock-line mr-0.5" />{requiredFail} required failing
            </span>
          )}
          <span className={`text-[12px] font-bold ${allRequiredPass ? "text-wk-success" : "text-wk-warning"}`}>
            {passCount}/{total}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        {checklist.map((item) => (
          <div key={item.label} className="flex items-start gap-2">
            <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] ${
              item.sprint5Gate
                ? "bg-wk-surface-raised text-wk-text-faint border border-wk-border"
                : item.pass
                ? "bg-wk-success text-white"
                : item.required
                ? "bg-wk-danger text-white"
                : "bg-wk-border text-wk-text-faint"
            }`}>
              {item.sprint5Gate ? (
                <i className="ri-time-line" />
              ) : item.pass ? (
                <i className="ri-check-line" />
              ) : (
                <i className="ri-close-line" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className={`text-[12px] font-semibold ${
                  item.sprint5Gate ? "text-wk-text-faint" :
                  item.pass ? "text-wk-text-soft" :
                  item.required ? "text-wk-danger" : "text-wk-text-muted"
                }`}>
                  {item.label}
                </span>
                {!item.required && !item.sprint5Gate && (
                  <span className="text-[9px] text-wk-text-faint bg-wk-surface-raised px-1 py-0.5 rounded">optional</span>
                )}
                {item.sprint5Gate && (
                  <span className="text-[9px] text-wk-warning bg-wk-warning-soft px-1 py-0.5 rounded">Sprint 5</span>
                )}
              </div>
              {item.detail && (
                <p className={`text-[11px] leading-relaxed ${
                  item.pass ? "text-wk-text-faint" :
                  item.required && !item.pass ? "text-wk-danger/80" :
                  "text-wk-text-muted"
                }`}>
                  {item.detail}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {allRequiredPass && !checklist.find((c) => c.sprint5Gate)?.pass && (
        <div className="mt-3 rounded-lg border border-wk-warning/20 bg-wk-warning-soft px-3 py-2">
          <p className="text-[12px] font-semibold text-wk-warning">
            <i className="ri-time-line mr-1" />Commit gated — Sprint 5
          </p>
          <p className="text-[11px] text-wk-text-soft mt-0.5">
            All required checks pass. The Commit button will become active in Sprint 5 when the snapshot persistence layer is complete.
          </p>
        </div>
      )}

      {!allRequiredPass && (
        <div className="mt-3 rounded-lg border border-wk-danger/20 bg-wk-danger-soft px-3 py-2">
          <p className="text-[12px] font-semibold text-wk-danger">
            <i className="ri-lock-line mr-1" />{requiredFail} required check{requiredFail > 1 ? "s" : ""} failing
          </p>
          <p className="text-[11px] text-wk-text-soft mt-0.5">
            Resolve the failing required checks before this edition can be committed.
          </p>
        </div>
      )}
    </WkSurface>
  );
}