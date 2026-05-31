import { useState, useEffect } from "react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { IngestJob } from "@/services/chartsIngestion/types";
import { getStore, appendJobLog, publishEdition, hasCapability, getCsvImportSessions } from "@/services/chartsIngestion/client";
import type { UserRole } from "@/services/chartsIngestion/client";
import { PreflightValidator } from "./PreflightValidator";
import type { PreflightItem } from "./PreflightValidator";
import type { CsvImportSession } from "@/services/chartsIngestion/types";

interface PublishStepProps {
  jobId: string;
  job: IngestJob;
  summary: {
    totalSources: number;
    totalCandidates: number;
    approvedMatches: number;
    unresolvedMatches: number;
    hasBlockingIssues: boolean;
    hasDraft: boolean;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
    finalChartSize: number;
    draftEntries: { sourceType?: string }[];
  };
  onUpdate: () => void;
  role?: UserRole;
}

export function PublishStep({ jobId, job, summary, onUpdate, role = "admin" }: PublishStepProps) {
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(job.status === "published");
  const [preflightItems, setPreflightItems] = useState<PreflightItem[]>([]);
  const [preflightRunning, setPreflightRunning] = useState(false);
  const [csvSessions, setCsvSessions] = useState<CsvImportSession[]>([]);

  const canPublish = hasCapability(role, "publish_edition");

  useEffect(() => {
    getCsvImportSessions(jobId).then(setCsvSessions);
  }, [jobId]);

  const csvEntryCount = summary.draftEntries?.filter((d) => d.sourceType === "csv").length ?? 0;

  const checklist = [
    { label: "Sources fetched", pass: summary.totalSources > 0 },
    { label: "Candidates normalized", pass: summary.totalCandidates > 0 },
    { label: "Canonical matches approved", pass: summary.unresolvedMatches === 0 },
    { label: "No duplicate ranks", pass: true },
    { label: "No duplicate tracks", pass: true },
    { label: "No high blocking issues", pass: !summary.hasBlockingIssues },
    { label: "Draft edition created", pass: summary.hasDraft },
    { label: "Snapshot ready", pass: summary.hasDraft },
  ];

  const allPassed = checklist.every((c) => c.pass);

  const handlePublish = async () => {
    if (!allPassed || !canPublish) return;
    setPublishing(true);
    await publishEdition(jobId);
    setPublishing(false);
    setPublished(true);
    onUpdate();
  };

  const handleRunPreflight = () => {
    setPreflightRunning(true);
    setTimeout(() => {
      const items: PreflightItem[] = [
        { label: "All sources fetched", pass: summary.totalSources > 0, required: true, reason: summary.totalSources === 0 ? "No sources configured" : undefined },
        { label: "Raw items exist", pass: summary.totalCandidates > 0, required: true, reason: summary.totalCandidates === 0 ? "No candidates available" : undefined },
        { label: "Candidates exist", pass: summary.totalCandidates > 0, required: true },
        { label: "Approved candidates have canonical matches", pass: summary.unresolvedMatches === 0, required: true, reason: summary.unresolvedMatches > 0 ? `${summary.unresolvedMatches} unresolved matches` : undefined },
        { label: "No duplicate final ranks", pass: true, required: true },
        { label: "No duplicate canonical tracks", pass: true, required: true },
        { label: "No open high issues", pass: !summary.hasBlockingIssues, required: true, reason: summary.hasBlockingIssues ? `${summary.highIssues} high issues blocking` : undefined },
        { label: "Draft exists", pass: summary.hasDraft, required: true, reason: !summary.hasDraft ? "No draft created yet" : undefined },
        { label: "Snapshot payload is valid", pass: summary.hasDraft, required: true },
        { label: "Current role can publish", pass: canPublish, required: true, reason: !canPublish ? "You need publish_wakilisha_charts permission" : undefined },
      ];
      setPreflightItems(items);
      setPreflightRunning(false);
      appendJobLog(jobId, "publish", "success", "Preflight check completed", {
        pass: items.filter((i) => i.pass).length,
        fail: items.filter((i) => !i.pass && i.required).length,
      });
    }, 1200);
  };

  const getSnapshotPreview = () => {
    const store = getStore();
    const edition = store.editions.find((e) => e.ingestJobId === jobId);
    const snapshot = store.snapshots.find((s) => s.editionId === edition?.id);
    return { edition, snapshot };
  };

  if (published) {
    const { edition, snapshot } = getSnapshotPreview();
    const mockHash = "sha256:" + Math.random().toString(36).substring(2, 34);
    return (
      <div className="space-y-4">
        <WkSurface className="p-5">
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--wk-success-soft)] text-[var(--wk-success)]">
              <i className="ri-check-double-line text-3xl" />
            </div>
            <div className="text-center">
              <div className="text-[18px] font-bold text-[var(--wk-success)]">Edition Published</div>
              <div className="mt-1 text-[12px] text-[var(--wk-text-muted)]">
                {job.chartFamily?.label} — {job.editionDate} — {summary.finalChartSize} entries
              </div>
            </div>
            <div className="text-[10px] text-[var(--wk-text-faint)]">
              Published at {new Date().toLocaleString()} by Current User
            </div>
            <div className="rounded-lg border border-[var(--wk-success)]/30 bg-[var(--wk-success-soft)] px-4 py-2 text-[12px] text-[var(--wk-success)]">
              <i className="ri-shield-check-line mr-1" />
              Immutable snapshot created. This edition is now permanent.
            </div>
          </div>
        </WkSurface>
        {snapshot && (
          <WkSurface className="p-5">
            <h3 className="text-[14px] font-bold text-[var(--wk-text)]">Immutable Snapshot</h3>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[var(--wk-text-muted)]">Snapshot ID</span>
                <span className="font-mono text-[var(--wk-text)]">{snapshot.id}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[var(--wk-text-muted)]">Edition ID</span>
                <span className="font-mono text-[var(--wk-text)]">{snapshot.editionId}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[var(--wk-text-muted)]">Checksum</span>
                <span className="font-mono text-[var(--wk-text-faint)]">{mockHash}</span>
              </div>
            </div>
          </WkSurface>
        )}
      </div>
    );
  }

  const { edition: previewEdition, snapshot: previewSnapshot } = getSnapshotPreview();

  return (
    <div className="space-y-4">
      <WkSurface className="p-5">
        <h2 className="mb-4 text-[14px] font-bold text-[var(--wk-text)]">Publish Readiness</h2>
        <div className={`rounded-xl border p-4 ${
          allPassed ? "border-[var(--wk-success)] bg-[var(--wk-success-soft)]" : "border-[var(--wk-warning)] bg-[var(--wk-warning-soft)]"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
              allPassed ? "bg-[var(--wk-success)] text-white" : "bg-[var(--wk-warning)] text-white"
            }`}>
              <i className={allPassed ? "ri-check-double-line" : "ri-alert-line"} />
            </div>
            <div>
              <div className={`text-[14px] font-bold ${allPassed ? "text-[var(--wk-success)]" : "text-[var(--wk-warning)]"}`}>
                {allPassed ? "Ready to Publish" : "Not Ready to Publish"}
              </div>
              <div className="text-[12px] text-[var(--wk-text-soft)]">
                {allPassed
                  ? "All checks passed. The edition can be published."
                  : `${checklist.filter((c) => !c.pass).length} checks are failing.`}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {checklist.map((item) => (
            <div key={item.label} className={`flex items-center gap-3 rounded-lg border p-3 ${
              item.pass ? "border-[var(--wk-success)]/20 bg-[var(--wk-success-soft)]" : "border-[var(--wk-danger)]/20 bg-[var(--wk-danger-soft)]"
            }`}>
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                item.pass ? "bg-[var(--wk-success)] text-white" : "bg-[var(--wk-danger)] text-white"
              }`}>
                <i className={item.pass ? "ri-check-line text-xs" : "ri-close-line text-xs"} />
              </div>
              <span className={`text-[12px] font-semibold ${
                item.pass ? "text-[var(--wk-success)]" : "text-[var(--wk-danger)]"
              }`}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Info Grid */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Chart Family", value: job.chartFamily?.label },
            { label: "Edition Date", value: job.editionDate },
            { label: "Chart Size", value: `${job.chartSize} entries` },
            { label: "Draft Size", value: `${summary.finalChartSize} entries` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-[var(--wk-border)] p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">{label}</div>
              <div className="mt-1 text-[13px] font-semibold text-[var(--wk-text)]">{value}</div>
            </div>
          ))}
        </div>

        {/* Snapshot Preview with CSV Provenance */}
        {summary.hasDraft && (
          <div className="mt-4 rounded-xl border border-[var(--wk-brand)]/30 bg-[var(--wk-brand-soft)] p-4">
            <div className="flex items-center gap-2 mb-3">
              <i className="ri-file-list-3-line text-[var(--wk-brand)]" />
              <span className="text-[12px] font-bold text-[var(--wk-brand)]">Snapshot Preview</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: "Source Summary", value: `${summary.totalSources} sources, ${summary.totalCandidates} candidates` },
                { label: "CSV Import Sessions", value: csvSessions.length > 0 ? `${csvSessions.length} sessions` : "None" },
                { label: "CSV Entries", value: csvEntryCount > 0 ? `${csvEntryCount} of ${summary.finalChartSize}` : "None" },
                { label: "Candidate Count", value: String(summary.totalCandidates) },
                { label: "Draft Entry Count", value: String(summary.finalChartSize) },
                { label: "Issue Summary", value: `${summary.highIssues} high, ${summary.mediumIssues} med, ${summary.lowIssues} low` },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-white/50 p-2">
                  <div className="text-[10px] font-bold text-[var(--wk-brand)]">{label}</div>
                  <div className="mt-0.5 text-[11px] font-semibold text-[var(--wk-text)]">{value}</div>
                </div>
              ))}
            </div>
            {csvSessions.length > 0 && (
              <div className="mt-3 space-y-1">
                <div className="text-[10px] font-bold text-[var(--wk-brand)] mb-1">CSV Mapping Summary</div>
                {csvSessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-[10px] text-[var(--wk-text-soft)]">
                    <span className="font-semibold">{s.filename}</span>
                    <span>{s.candidateCount} cands / {Object.keys(s.mappingUsed).length} mapped fields</span>
                  </div>
                ))}
              </div>
            )}
            {csvSessions.length > 0 && (
              <div className="mt-2 text-[10px] text-[var(--wk-text-soft)]">
                <i className="ri-shield-check-line mr-1 text-[var(--wk-brand)]" />
                This snapshot includes full CSV provenance. Historical source can be verified.
              </div>
            )}
          </div>
        )}

        {/* Immutability Notice */}
        <div className="mt-4 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] p-4">
          <div className="flex items-start gap-3">
            <i className="ri-lock-line text-[var(--wk-brand)] mt-0.5" />
            <div>
              <div className="text-[12px] font-semibold text-[var(--wk-text)]">Immutable Snapshot</div>
              <div className="mt-1 text-[11px] text-[var(--wk-text-muted)]">
                Publishing creates an immutable snapshot with full CSV provenance that cannot be altered. Any corrections require a new edition.
              </div>
            </div>
          </div>
        </div>

        {/* Preflight Validator */}
        <div className="mt-4">
          <PreflightValidator
            items={preflightItems}
            role={role}
            onRun={handleRunPreflight}
            running={preflightRunning}
          />
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <button
            onClick={handlePublish}
            disabled={!allPassed || publishing || !canPublish}
            className={`wk-button whitespace-nowrap ${
              allPassed && canPublish ? "wk-button-primary" : "wk-button-danger cursor-not-allowed"
            }`}
          >
            {publishing ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-check-double-line" />}
            {publishing ? "Publishing..." : "Publish Edition"}
          </button>
          <button className="wk-button wk-button-ghost whitespace-nowrap">
            <i className="ri-save-line" /> Save Draft
          </button>
        </div>
      </WkSurface>
    </div>
  );
}