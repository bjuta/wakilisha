import { useState, useMemo } from "react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { WkTag } from "@/components/design-system/primitives/Tag";
import type { IngestCandidate, IngestMatch, ReviewIssue } from "@/services/chartsIngestion/types";
import { approveCandidate, excludeCandidate, restoreCandidate, getRawItems, hasCapability, getDisabledReason } from "@/services/chartsIngestion/client";
import type { RawSourceItem } from "@/services/chartsIngestion/types";
import { useEffect } from "react";
import type { UserRole } from "@/services/chartsIngestion/client";

interface CandidatesStepProps {
  jobId: string;
  candidates: IngestCandidate[];
  matches: IngestMatch[];
  issues: ReviewIssue[];
  onUpdate: () => void;
  role?: UserRole;
}

type SortKey = "rank" | "score" | "title" | "confidence";

export function CandidatesStep({ jobId, candidates, matches, issues, onUpdate, role = "admin" }: CandidatesStepProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [detailCandidate, setDetailCandidate] = useState<IngestCandidate | null>(null);
  const [rawItems, setRawItems] = useState<RawSourceItem[]>([]);

  const canReview = hasCapability(role, "review_candidates");

  useEffect(() => {
    if (detailCandidate) {
      getRawItems(jobId).then(setRawItems);
    }
  }, [detailCandidate, jobId]);

  const sources = useMemo(() => {
    const allSources = new Set<string>();
    candidates.forEach((c) => Object.keys(c.sourcePositions).forEach((s) => allSources.add(s)));
    return Array.from(allSources);
  }, [candidates]);

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
    if (statusFilter !== "all") {
      result = result.filter((c) => c.status === statusFilter);
    }
    if (sourceFilter !== "all") {
      result = result.filter((c) => Object.keys(c.sourcePositions).includes(sourceFilter));
    }
    result.sort((a, b) => {
      let valA: number | string;
      let valB: number | string;
      switch (sortKey) {
        case "rank":
          valA = a.finalRank ?? a.calculatedRank;
          valB = b.finalRank ?? b.calculatedRank;
          break;
        case "score":
          valA = a.score;
          valB = b.score;
          break;
        case "title":
          valA = a.normalizedTitle.toLowerCase();
          valB = b.normalizedTitle.toLowerCase();
          break;
        case "confidence": {
          const matchA = matches.find((m) => m.candidateId === a.id);
          const matchB = matches.find((m) => m.candidateId === b.id);
          valA = matchA?.matchConfidence ?? 0;
          valB = matchB?.matchConfidence ?? 0;
          break;
        }
        default:
          valA = 0;
          valB = 0;
      }
      if (typeof valA === "string" && typeof valB === "string") {
        return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDir === "asc" ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
    return result;
  }, [candidates, search, statusFilter, sourceFilter, sortKey, sortDir, matches]);

  const handleApprove = async (candidateId: string) => {
    if (!canReview) return;
    await approveCandidate(candidateId);
    onUpdate();
  };

  const handleExclude = async (candidateId: string) => {
    if (!canReview) return;
    await excludeCandidate(candidateId);
    onUpdate();
  };

  const handleRestore = async (candidateId: string) => {
    if (!canReview) return;
    await restoreCandidate(candidateId);
    onUpdate();
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Normalized Candidates</h2>
        <div className="flex flex-wrap items-center gap-2">
          <WkTag variant="brand">{candidates.length} total</WkTag>
          <WkTag>{candidates.filter((c) => c.status === "approved").length} approved</WkTag>
          <WkTag>{candidates.filter((c) => c.status === "excluded").length} excluded</WkTag>
          <WkTag>{candidates.filter((c) => c.status === "needs_review").length} needs review</WkTag>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2">
          <i className="ri-search-line text-[var(--wk-text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search track, artist, ISRC..."
            className="bg-transparent text-[12px] text-[var(--wk-text)] outline-none placeholder:text-[var(--wk-text-faint)]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[12px] text-[var(--wk-text)]"
        >
          <option value="all">All Status</option>
          <option value="approved">Approved</option>
          <option value="excluded">Excluded</option>
          <option value="needs_review">Needs Review</option>
          <option value="candidate">Candidate</option>
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[12px] text-[var(--wk-text)]"
        >
          <option value="all">All Sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <WkSurface className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="wk-table min-w-full">
            <thead>
              <tr>
                <th className="whitespace-nowrap cursor-pointer" onClick={() => toggleSort("rank")}>
                  Rank {sortKey === "rank" && (sortDir === "asc" ? <i className="ri-arrow-up-s-line text-[10px]" /> : <i className="ri-arrow-down-s-line text-[10px]" />)}
                </th>
                <th className="whitespace-nowrap cursor-pointer" onClick={() => toggleSort("title")}>
                  Track {sortKey === "title" && (sortDir === "asc" ? <i className="ri-arrow-up-s-line text-[10px]" /> : <i className="ri-arrow-down-s-line text-[10px]" />)}
                </th>
                <th className="whitespace-nowrap">Artist</th>
                <th className="whitespace-nowrap">ISRC</th>
                <th className="whitespace-nowrap">Sources</th>
                <th className="whitespace-nowrap cursor-pointer" onClick={() => toggleSort("score")}>
                  Score {sortKey === "score" && (sortDir === "asc" ? <i className="ri-arrow-up-s-line text-[10px]" /> : <i className="ri-arrow-down-s-line text-[10px]" />)}
                </th>
                <th className="whitespace-nowrap cursor-pointer" onClick={() => toggleSort("confidence")}>
                  Match {sortKey === "confidence" && (sortDir === "asc" ? <i className="ri-arrow-up-s-line text-[10px]" /> : <i className="ri-arrow-down-s-line text-[10px]" />)}
                </th>
                <th className="whitespace-nowrap">Status</th>
                <th className="whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const match = matches.find((m) => m.candidateId === c.id);
                const candidateIssues = issues.filter((i) => i.candidateId === c.id);
                const isCsv = Object.keys(c.sourcePositions).includes("csv");
                return (
                  <tr key={c.id} className={isCsv ? "bg-[var(--wk-brand-soft)]/20" : ""}>
                    <td className="tabular-nums text-[var(--wk-text)]">
                      {c.finalRank ?? c.calculatedRank}
                    </td>
                    <td className="font-semibold text-[var(--wk-text)]">
                      <div className="flex items-center gap-2">
                        {c.artworkUrl && (
                          <img src={c.artworkUrl} alt="" className="h-8 w-8 rounded-md object-cover" />
                        )}
                        <span className="truncate max-w-[160px]">{c.normalizedTitle}</span>
                        {isCsv && (
                          <span className="rounded-full bg-[var(--wk-brand-soft)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--wk-brand)]">
                            CSV
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-[12px] text-[var(--wk-text-soft)]">{c.normalizedArtistLine}</td>
                    <td className="text-[11px] text-[var(--wk-text-muted)]">{c.isrc ?? "—"}</td>
                    <td className="text-[12px] text-[var(--wk-text-soft)]">
                      {Object.keys(c.sourcePositions).join(", ")}
                    </td>
                    <td className="tabular-nums text-[12px] font-semibold text-[var(--wk-text)]">{c.score.toFixed(1)}</td>
                    <td>
                      <span className={`text-[10px] font-semibold ${
                        (match?.matchConfidence ?? 0) >= 90 ? "text-[var(--wk-success)]" :
                        (match?.matchConfidence ?? 0) >= 70 ? "text-[var(--wk-brand)]" :
                        (match?.matchConfidence ?? 0) >= 50 ? "text-[var(--wk-warning)]" :
                        "text-[var(--wk-danger)]"
                      }`}>
                        {match?.matchConfidence ?? 0}%
                      </span>
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
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setDetailCandidate(c)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]"
                          title="Details"
                        >
                          <i className="ri-eye-line text-sm" />
                        </button>
                        {c.status !== "approved" && (
                          <button
                            onClick={() => handleApprove(c.id)}
                            disabled={!canReview}
                            className={`flex h-7 w-7 items-center justify-center rounded-md text-[var(--wk-success)] hover:bg-[var(--wk-success-soft)] ${!canReview ? "cursor-not-allowed opacity-50" : ""}`}
                            title={!canReview ? getDisabledReason(role, "review_candidates") : "Approve"}
                          >
                            <i className="ri-check-line text-sm" />
                          </button>
                        )}
                        {c.status !== "excluded" && (
                          <button
                            onClick={() => handleExclude(c.id)}
                            disabled={!canReview}
                            className={`flex h-7 w-7 items-center justify-center rounded-md text-[var(--wk-danger)] hover:bg-[var(--wk-danger-soft)] ${!canReview ? "cursor-not-allowed opacity-50" : ""}`}
                            title={!canReview ? getDisabledReason(role, "review_candidates") : "Exclude"}
                          >
                            <i className="ri-close-line text-sm" />
                          </button>
                        )}
                        {c.status === "excluded" && (
                          <button
                            onClick={() => handleRestore(c.id)}
                            disabled={!canReview}
                            className={`flex h-7 w-7 items-center justify-center rounded-md text-[var(--wk-info)] hover:bg-[var(--wk-info-soft)] ${!canReview ? "cursor-not-allowed opacity-50" : ""}`}
                            title={!canReview ? getDisabledReason(role, "review_candidates") : "Restore"}
                          >
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
        {filtered.length === 0 && (
          <div className="py-8 text-center text-[12px] text-[var(--wk-text-muted)]">
            No candidates match your filters.
          </div>
        )}
      </WkSurface>

      {/* Detail Drawer */}
      {detailCandidate && (
        <CandidateDetailDrawer
          candidate={detailCandidate}
          match={matches.find((m) => m.candidateId === detailCandidate.id)}
          candidateIssues={issues.filter((i) => i.candidateId === detailCandidate.id)}
          rawItems={rawItems}
          onClose={() => setDetailCandidate(null)}
        />
      )}
    </div>
  );
}

function CandidateDetailDrawer({ candidate, match, candidateIssues, rawItems, onClose }: {
  candidate: IngestCandidate;
  match?: IngestMatch;
  candidateIssues: ReviewIssue[];
  rawItems: RawSourceItem[];
  onClose: () => void;
}) {
  const candidateRawItems = rawItems.filter((r) => candidate.rawItemIds.includes(r.id));
  const isCsv = Object.keys(candidate.sourcePositions).includes("csv");
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
          {candidate.artworkUrl && (
            <img src={candidate.artworkUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
          )}
          <div>
            <div className="text-[13px] font-bold text-[var(--wk-text)]">{candidate.normalizedTitle}</div>
            <div className="text-[12px] text-[var(--wk-text-muted)]">{candidate.normalizedArtistLine}</div>
            <div className="mt-1 text-[11px] text-[var(--wk-text-faint)]">{candidate.isrc ?? "No ISRC"}</div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-[var(--wk-border)] p-3">
            <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Score</div>
            <div className="mt-1 text-[16px] font-black text-[var(--wk-brand)]">{candidate.score.toFixed(1)}</div>
          </div>
          <div className="rounded-lg border border-[var(--wk-border)] p-3">
            <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Calculated Rank</div>
            <div className="mt-1 text-[16px] font-black text-[var(--wk-text)]">{candidate.calculatedRank}</div>
          </div>
          <div className="rounded-lg border border-[var(--wk-border)] p-3">
            <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Match Confidence</div>
            <div className="mt-1 text-[16px] font-black text-[var(--wk-text)]">{match?.matchConfidence ?? 0}%</div>
          </div>
          <div className="rounded-lg border border-[var(--wk-border)] p-3">
            <div className="text-[10px] font-bold uppercase text-[var(--wk-text-muted)]">Match Method</div>
            <div className="mt-1 text-[13px] font-semibold text-[var(--wk-text)]">{match?.matchMethod ?? "—"}</div>
          </div>
        </div>

        {/* CSV Provenance Badge */}
        {isCsv && (
          <div className="mt-4 rounded-lg border border-[var(--wk-brand)] bg-[var(--wk-brand-soft)] p-3">
            <div className="flex items-center gap-2">
              <i className="ri-file-list-line text-[var(--wk-brand)]" />
              <span className="text-[12px] font-semibold text-[var(--wk-brand)]">CSV Source</span>
            </div>
            <div className="mt-1 text-[11px] text-[var(--wk-text-soft)]">
              Position {csvPosition} from CSV file
            </div>
          </div>
        )}

        {/* Source Provenance */}
        <div className="mt-4">
          <h4 className="mb-2 text-[12px] font-bold text-[var(--wk-text)]">Source Provenance</h4>
          <div className="space-y-1.5">
            {Object.entries(candidate.sourcePositions).map(([source, position]) => (
              <div key={source} className="flex items-center justify-between rounded-lg border border-[var(--wk-border)] p-2">
                <span className="text-[12px] text-[var(--wk-text-muted)]">{source}</span>
                <span className="text-[12px] font-semibold text-[var(--wk-text)]">Position {position}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Raw Item References */}
        {candidateRawItems.length > 0 && (
          <div className="mt-4">
            <h4 className="mb-2 text-[12px] font-bold text-[var(--wk-text)]">Raw Payload References</h4>
            <div className="space-y-1.5">
              {candidateRawItems.map((raw) => (
                <div key={raw.id} className="rounded-lg border border-[var(--wk-border)] p-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--wk-text-muted)]">Source ID</span>
                    <span className="font-mono text-[var(--wk-text)]">{raw.sourceId}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--wk-text-muted)]">Provider Track ID</span>
                    <span className="font-mono text-[var(--wk-text)]">{raw.providerTrackId ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--wk-text-muted)]">Raw Hash</span>
                    <span className="font-mono text-[var(--wk-text-faint)]">{raw.rawHash.slice(0, 12)}...</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {candidateIssues.length > 0 && (
          <div className="mt-4">
            <h4 className="mb-2 text-[12px] font-bold text-[var(--wk-text)]">Linked Issues</h4>
            <div className="space-y-2">
              {candidateIssues.map((issue) => (
                <div key={issue.id} className={`rounded-lg border-l-2 p-2 ${
                  issue.severity === "high" ? "border-l-[var(--wk-danger)] bg-[var(--wk-danger-soft)]" :
                  issue.severity === "medium" ? "border-l-[var(--wk-warning)] bg-[var(--wk-warning-soft)]" :
                  "border-l-[var(--wk-info)] bg-[var(--wk-info-soft)]"
                }`}>
                  <div className="text-[11px] font-semibold">{issue.issueType}</div>
                  <div className="text-[10px] text-[var(--wk-text-soft)]">{issue.message}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4">
          <h4 className="mb-2 text-[12px] font-bold text-[var(--wk-text)]">Eligibility</h4>
          <div className="text-[12px] text-[var(--wk-text-soft)]">
            Status: <span className="font-semibold text-[var(--wk-text)]">{candidate.eligibilityStatus}</span>
          </div>
          {candidate.eligibilityReasons.length > 0 && (
            <div className="mt-1 text-[11px] text-[var(--wk-text-muted)]">
              {candidate.eligibilityReasons.join(", ")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}