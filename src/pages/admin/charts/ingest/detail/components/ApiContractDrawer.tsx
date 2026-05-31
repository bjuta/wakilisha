import { useState } from "react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type {
  IngestJob,
  IngestSource,
  IngestCandidate,
  ReviewIssue,
  DraftEntry,
  ChartEdition,
  Snapshot,
} from "@/services/chartsIngestion/types";

interface ApiContractDrawerProps {
  job: IngestJob;
  sources: IngestSource[];
  candidates: IngestCandidate[];
  issues: ReviewIssue[];
  draftEntries: DraftEntry[];
  snapshot: Snapshot | null;
  edition: ChartEdition | null;
  open: boolean;
  onClose: () => void;
}

export function ApiContractDrawer({
  job,
  sources,
  candidates,
  issues,
  draftEntries,
  snapshot,
  edition,
  open,
  onClose,
}: ApiContractDrawerProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  if (!open) return null;

  const jobPayload = {
    id: job.id,
    chartFamilyId: job.chartFamilyId,
    editionDate: job.editionDate,
    periodStart: job.periodStart,
    periodEnd: job.periodEnd,
    chartSize: job.chartSize,
    rulesetKey: job.rulesetKey,
    scoringModelKey: job.scoringModelKey,
  };

  const sourcePayloads = sources.map((s) => ({
    id: s.id,
    jobId: s.jobId,
    sourceType: s.sourceType,
    provider: s.provider,
    sourceUrl: s.sourceUrl,
    weight: s.weight,
    priority: s.priority,
    status: s.status,
  }));

  const candidatePayload = candidates.length > 0 ? {
    id: candidates[0].id,
    jobId: candidates[0].jobId,
    rawItemIds: candidates[0].rawItemIds,
    normalizedTitle: candidates[0].normalizedTitle,
    normalizedArtistLine: candidates[0].normalizedArtistLine,
    isrc: candidates[0].isrc,
    sourcePositions: candidates[0].sourcePositions,
    score: candidates[0].score,
    calculatedRank: candidates[0].calculatedRank,
    eligibilityStatus: candidates[0].eligibilityStatus,
  } : null;

  const issuePayload = issues.length > 0 ? {
    id: issues[0].id,
    jobId: issues[0].jobId,
    candidateId: issues[0].candidateId,
    severity: issues[0].severity,
    issueType: issues[0].issueType,
    message: issues[0].message,
    blocking: issues[0].blocking,
    status: issues[0].status,
  } : null;

  const draftPayload = draftEntries.length > 0 ? {
    id: draftEntries[0].id,
    jobId: draftEntries[0].jobId,
    candidateId: draftEntries[0].candidateId,
    finalRank: draftEntries[0].finalRank,
    movement: draftEntries[0].movement,
    score: draftEntries[0].score,
    entryPayload: draftEntries[0].entryPayload,
  } : null;

  const publishPayload = edition ? {
    editionId: edition.id,
    familyId: edition.familyId,
    slug: edition.slug,
    label: edition.label,
    date: edition.date,
    periodStart: edition.periodStart,
    periodEnd: edition.periodEnd,
    ingestJobId: edition.ingestJobId,
    entryCount: edition.entryCount,
    newEntries: edition.newEntries,
    reEntries: edition.reEntries,
  } : null;

  const snapshotPayload = snapshot ? {
    id: snapshot.id,
    editionId: snapshot.editionId,
    familyId: snapshot.familyId,
    snapshotJson: snapshot.snapshotJson,
    publishedAt: snapshot.publishedAt,
    publishedBy: snapshot.publishedBy,
  } : null;

  const sections = [
    { id: "job", label: "Job Payload", data: jobPayload },
    { id: "sources", label: "Source Payloads", data: sourcePayloads },
    { id: "candidate", label: "Candidate Payload (sample)", data: candidatePayload },
    { id: "issue", label: "Issue Payload (sample)", data: issuePayload },
    { id: "draft", label: "Draft Entry Payload (sample)", data: draftPayload },
    { id: "publish", label: "Publish Payload", data: publishPayload },
    { id: "snapshot", label: "Snapshot Payload", data: snapshotPayload },
  ];

  const handleCopy = (sectionId: string, data: unknown) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50">
      <div className="h-full w-full max-w-lg overflow-y-auto bg-[var(--wk-surface)] p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-bold text-[var(--wk-text)]">API Contract</h2>
            <p className="mt-0.5 text-[10px] text-[var(--wk-text-muted)]">
              Backend developer reference — exact payloads for WordPress wiring
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]"
          >
            <i className="ri-close-line" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {sections.map((section) => (
            <div key={section.id} className="rounded-lg border border-[var(--wk-border)]">
              <div className="flex items-center justify-between border-b border-[var(--wk-border)] p-3">
                <span className="text-[12px] font-semibold text-[var(--wk-text)]">{section.label}</span>
                <button
                  onClick={() => handleCopy(section.id, section.data)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-[var(--wk-brand)] hover:bg-[var(--wk-brand-soft)]"
                >
                  <i className={copiedSection === section.id ? "ri-check-line" : "ri-file-copy-line"} />
                  {copiedSection === section.id ? "Copied" : "Copy JSON"}
                </button>
              </div>
              <div className="p-3">
                {section.data ? (
                  <pre className="max-h-48 overflow-y-auto text-[10px] text-[var(--wk-text-soft)]">
                    {JSON.stringify(section.data, null, 2)}
                  </pre>
                ) : (
                  <div className="text-[11px] text-[var(--wk-text-muted)] italic">
                    No data available for this section yet.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}