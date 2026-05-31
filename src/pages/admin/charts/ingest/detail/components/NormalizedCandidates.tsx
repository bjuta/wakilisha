/**
 * Normalized Candidates — Phase 5
 * Grouped by source/edition, full provenance rows, drawer with provenance.
 */
import { useState, useMemo } from "react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { IngestCandidate, IngestMatch, ReviewIssue, CsvImportSession } from "@/services/chartsIngestion/types";
import { approveCandidate, excludeCandidate, restoreCandidate, hasCapability, getDisabledReason } from "@/services/chartsIngestion/client";
import type { UserRole } from "@/services/chartsIngestion/client";

interface NormalizedCandidatesProps {
  jobId: string;
  candidates: IngestCandidate[];
  matches: IngestMatch[];
  issues: ReviewIssue[];
  importSessions: CsvImportSession[];
  onUpdate: () => void;
  role?: UserRole;
}

export function NormalizedCandidates({
  jobId,
  candidates,
  matches,
  issues,
  importSessions,
  onUpdate,
  role = "admin",
}: NormalizedCandidatesProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [groupBySource, setGroupBySource] = useState(false);
  const [detailCandidate, setDetailCandidate] = useState<IngestCandidate | null>(null);

  const canReview = hasCapability(role, "review_candidates");

  const csvCandidates = candidates.filter((c) => c.sourceType === "csv");
  const otherCandidates = candidates.filter((c) => c.sourceType !== "csv");

  const filtered = useMemo(() => {
    let result = [...candidates];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) =>
        c.normalizedTitle.toLowerCase().includes(q) ||
        c.normalizedArtistLine.toLowerCase().includes(q) ||
        (c.isrc ?? "").toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") result = result.filter((c) => c.status === statusFilter);
    if (sourceFilter !== "all") result = result.filter((c) => c.sourceType === sourceFilter);
    return result.sort((a, b) => (a.finalRank ?? a.calculatedRank) - (b.finalRank ?? b.calculatedRank));
  }, [candidates, search, statusFilter, sourceFilter]);

  const handleApprove = async (id: string) => {
    if (!canReview) return;
    await approveCandidate(id);
    onUpdate();
  };
  const handleExclude = async (id: string) => {
    if (!canReview) return;
    await excludeCandidate(id);
    onUpdate();
  };
  const handleRestore = async (id: string) => {
    if (!canReview) return;
    await restoreCandidate(id);
    onUpdate();
  };

  const renderTable = (rows: IngestCandidate[]) => (
    <div className="overflow-x-auto">
      <table className="wk-table min-w-full">
        <thead>
          <tr>
            <th className="whitespace-nowrap">Rank</th>
            <th className="whitespace-nowrap">Track</th>
            <th className="whitespace-nowrap">Artist</th>
            <th className="whitespace-nowrap">ISRC</th>
            <th className="whitespace-nowrap">Label</th>
            <th className="whitespace-nowrap">Source</th>
            <th className="whitespace-nowrap">Score</th>
            <th className="whitespace-nowrap">Match</th>
            <th className="whitespace-nowrap">Status</th>
            <th className="whitespace-nowrap">Issues</th>
            <th className="whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const match = matches.find((m) => m.candidateId === c.id);
            const cIssues = issues.filter((i) => i.candidateId === c.id && i.status === "open");
            const isCsv = c.sourceType === "csv";
            return (
              <tr key={c.id} className={isCsv ? "bg-[var(--wk-brand-soft)]/10" : ""}>
                <td className="tabular-nums font-bold text-[var(--wk-text)]">
                  {c.finalRank ?? c.calculatedRank}
                </td>
                <td className="font-semibold text-[var(--wk-text)]">
                  <div className="flex items-center gap-2">
                    {c.artworkUrl && <img src={c.artworkUrl} alt="" className="h-7 w-7 rounded-md object-cover shrink-0" />}
                    <span className="truncate max-w-[140px]">{c.normalizedTitle}</span>
                    {isCsv && (
                      <span className="rounded-full bg-[var(--wk-brand-soft)] px-1.5 py-0 text-[9px] font-semibold text-[var(--wk-brand)]">CSV</span>
                    )}
                  </div>
                </td>
                <td className="text-[12px] text-[var(--wk-text-soft)]">{c.normalizedArtistLine}</td>
                <td className="text-[10px] text-[var(--wk-text-muted)] font-mono">{c.isrc ?? "—"}</td>
                <td className="text-[11px] text-[var(--wk-text-muted)]">{c.label ?? "—"}</td>
                <td>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    c.sourceType === "csv" ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]" :
                    c.sourceType === "manual" ? "bg-[var(--wk-info-soft)] text-[var(--wk-info)]" :
                    "bg-[var(--wk-text-faint)]/10 text-[var(--wk-text-faint)]"
                  }`}>
                    {c.sourceType ?? "gen"}
                  </span>
                </td>
                <td className="tabular-nums text-[12px] font-semibold text-[var(--wk-brand)]">{c.score.toFixed(1)}</td>
                <td>
                  <span className={`text-[10px] font-semibold ${
                    (match?.matchConfidence ?? 0) >= 90 ? "text-[var(--wk-success)]" :
                    (match?.matchConfidence ?? 0) >= 70 ? "text-[var(--wk-brand)]" :
                    (match?.matchConfidence ?? 0) >= 50 ? "text-[var(--wk-warning)]" :
                    "text-[var(--wk-danger)]"
                  }`}>{match?.matchConfidence ?? 0}%</span>
                </td>
                <td>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    c.status === "approved" ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]" :
                    c.status === "excluded" ? "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]" :
                    c.status === "needs_review" ? "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]" :
                    "bg-[var(--wk-info-soft)] text-[var(--wk-info)]"
                  }`}>
                    {c.status}
                  </span>
                </td>
                <td>
                  {cIssues.length > 0 ? (
                    <span className="rounded-full bg-[var(--wk-warning-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-warning)]">
                      {cIssues.length}
                    </span>
                  ) : (
                    <span className="text-[10px] text-[var(--wk-text-faint)]">—</span>
                  )}
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setDetailCandidate(c)} className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]" title="Details">
                      <i className="ri-eye-line text-sm" />
                    </button>
                    {c.status !== "approved" && (
                      <button onClick={() => handleApprove(c.id)} disabled={!canReview} className={`flex h-7 w-7 items-center justify-center rounded-md text-[var(--wk-success)] hover:bg-[var(--wk-success-soft)] ${!canReview ? "cursor-not-allowed opacity-50" : ""}`} title="Approve">
                        <i className="ri-check-line text-sm" />
                      </button>
                    )}
                    {c.status !== "excluded" && (
                      <button onClick={() => handleExclude(c.id)} disabled={!canReview} className={`flex h-7 w-7 items-center justify-center rounded-md text-[var(--wk-danger)] hover:bg-[var(--wk-danger-soft)] ${!canReview ? "cursor-not-allowed opacity-50" : ""}`} title="Exclude">
                        <i className="ri-close-line text-sm" />
                      </button>
                    )}
                    {c.status === "excluded" && (
                      <button onClick={() => handleRestore(c.id)} disabled={!canReview} className={`flex h-7 w-7 items-center justify-center rounded-md text-[var(--wk-info)] hover:bg-[var(--wk-info-soft)] ${!canReview ? "cursor-not-allowed opacity-50" : ""}`} title="Restore">
                        <i className="ri-restart-line text-sm" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Normalized Candidates</h2>
          <p className="mt-0.5 text-[11px] text-[var(--wk-text-muted)]">
            {candidates.length} total — {csvCandidates.length} from CSV — {candidates.filter((c) => c.status === "approved").length} approved
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setGroupBySource(!groupBySource)}
            className={`wk-button wk-button-sm ${groupBySource ? "wk-button-primary" : "wk-button-ghost"} whitespace-nowrap`}
          >
            <i className="ri-stack-line" />
            Group by Source
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 flex-1">
          <i className="ri-search-line text-[var(--wk-text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search track, artist, ISRC..."
            className="bg-transparent text-[12px] text-[var(--wk-text)] outline-none placeholder:text-[var(--wk-text-faint)] w-full"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[12px] text-[var(--wk-text)]">
          <option value="all">All Status</option>
          <option value="approved">Approved</option>
          <option value="excluded">Excluded</option>
          <option value="needs_review">Needs Review</option>
          <option value="candidate">Candidate</option>
        </select>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[12px] text-[var(--wk-text)]">
          <option value="all">All Sources</option>
          <option value="csv">CSV</option>
          <option value="manual">Manual</option>
          <option value="mock">Generated</option>
        </select>
      </div>

      {/* Group by source or flat table */}
      {groupBySource ? (
        <div className="space-y-4">
          {csvCandidates.length > 0 && (
            <WkSurface className="overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--wk-border)] bg-[var(--wk-brand-soft)]/20">
                <div className="flex items-center gap-2">
                  <i className="ri-file-list-line text-[var(--wk-brand)]" />
                  <span className="text-[13px] font-bold text-[var(--wk-brand)]">CSV Imported</span>
                  <span className="text-[11px] text-[var(--wk-text-muted)]">{csvCandidates.length} candidates</span>
                  {importSessions.map((s) => (
                    <span key={s.id} className="rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--wk-brand)]">
                      {s.filename}
                    </span>
                  ))}
                </div>
              </div>
              {renderTable(csvCandidates.sort((a, b) => (a.finalRank ?? a.calculatedRank) - (b.finalRank ?? b.calculatedRank)))}
            </WkSurface>
          )}
          {otherCandidates.length > 0 && (
            <WkSurface className="overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--wk-border)]">
                <div className="flex items-center gap-2">
                  <i className="ri-bar-chart-2-line text-[var(--wk-text-muted)]" />
                  <span className="text-[13px] font-bold text-[var(--wk-text)]">Generated / Streaming</span>
                  <span className="text-[11px] text-[var(--wk-text-muted)]">{otherCandidates.length} candidates</span>
                </div>
              </div>
              {renderTable(otherCandidates.sort((a, b) => (a.finalRank ?? a.calculatedRank) - (b.finalRank ?? b.calculatedRank)))}
            </WkSurface>
          )}
        </div>
      ) : (
        <WkSurface className="overflow-hidden">
          {renderTable(filtered)}
          {filtered.length === 0 && (
            <div className="py-8 text-center text-[12px] text-[var(--wk-text-muted)]">No candidates match your filters.</div>
          )}
        </WkSurface>
      )}

      {/* Candidate Drawer */}
      {detailCandidate && (
        <CandidateDrawer
          candidate={detailCandidate}
          match={matches.find((m) => m.candidateId === detailCandidate.id)}
          issues={issues.filter((i) => i.candidateId === detailCandidate.id)}
          onClose={() => setDetailCandidate(null)}
        />
      )}
    </div>
  );
}

function CandidateDrawer({ candidate, match, issues, onClose }: {
  candidate: IngestCandidate;
  match?: IngestMatch;
  issues: ReviewIssue[];
  onClose: () => void;
}) {
  const isCsv = candidate.sourceType === "csv";
  const csvPosition = candidate.sourcePositions.csv;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-[var(--wk-surface)] p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-bold text-[var(--wk-text)]">Candidate Detail</h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]">
            <i className="ri-close-line" />
          </button>
        </div>
        <div className="mt-4 flex items-center gap-3">
          {candidate.artworkUrl && <img src={candidate.artworkUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />}
          <div>
            <div className="text-[13px] font-bold text-[var(--wk-text)]">{candidate.normalizedTitle}</div>
            <div className="text-[12px] text-[var(--wk-text-muted)]">{candidate.normalizedArtistLine}</div>
            <div className="text-[11px] text-[var(--wk-text-faint)]">{candidate.isrc ?? "No ISRC"}</div>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {[
            { label: "Score", value: candidate.score.toFixed(1), color: "text-[var(--wk-brand)]" },
            { label: "Rank", value: String(candidate.finalRank ?? candidate.calculatedRank) },
            { label: "Match Confidence", value: `${match?.matchConfidence ?? 0}%` },
            { label: "Match Method", value: match?.matchMethod ?? "—" },
            { label: "Status", value: candidate.status },
            { label: "Source Type", value: candidate.sourceType ?? "—" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg border border-[var(--wk-border)] p-3">
              <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">{label}</div>
              <div className={`mt-1 text-[13px] font-semibold ${color ?? "text-[var(--wk-text)]"}`}>{value}</div>
            </div>
          ))}
        </div>
        {isCsv && (
          <div className="mt-4 rounded-lg border border-[var(--wk-brand)] bg-[var(--wk-brand-soft)] p-4">
            <div className="flex items-center gap-2 mb-2">
              <i className="ri-file-list-line text-[var(--wk-brand)]" />
              <span className="text-[12px] font-bold text-[var(--wk-brand)]">CSV Source</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--wk-text-muted)]">CSV Position</span>
                <span className="font-semibold text-[var(--wk-text)]">{csvPosition ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--wk-text-muted)]">Raw Hash</span>
                <span className="font-mono text-[var(--wk-text-faint)]">{candidate.candidateHash.slice(0, 12)}...</span>
              </div>
            </div>
          </div>
        )}
        {/* Source positions */}
        <div className="mt-4">
          <h4 className="mb-2 text-[12px] font-bold text-[var(--wk-text)]">Source Positions</h4>
          <div className="space-y-1.5">
            {Object.entries(candidate.sourcePositions).map(([src, pos]) => (
              <div key={src} className="flex items-center justify-between rounded-lg border border-[var(--wk-border)] p-2">
                <span className="text-[12px] text-[var(--wk-text-muted)]">{src}</span>
                <span className="text-[12px] font-semibold text-[var(--wk-text)]">Position {pos}</span>
              </div>
            ))}
          </div>
        </div>
        {issues.length > 0 && (
          <div className="mt-4">
            <h4 className="mb-2 text-[12px] font-bold text-[var(--wk-text)]">Linked Issues</h4>
            <div className="space-y-1.5">
              {issues.map((issue) => (
                <div key={issue.id} className={`rounded-lg border-l-2 p-2 ${
                  issue.severity === "high" ? "border-l-[var(--wk-danger)] bg-[var(--wk-danger-soft)]" :
                  issue.severity === "medium" ? "border-l-[var(--wk-warning)] bg-[var(--wk-warning-soft)]" :
                  "border-l-[var(--wk-info)] bg-[var(--wk-info-soft)]"
                }`}>
                  <div className="text-[11px] font-semibold text-[var(--wk-text)]">{issue.issueType.replace(/_/g, " ")}</div>
                  <div className="text-[10px] text-[var(--wk-text-soft)]">{issue.message}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}