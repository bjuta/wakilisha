import { useState } from "react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { WkTag } from "@/components/design-system/primitives/Tag";
import type { IngestCandidate, IngestMatch } from "@/services/chartsIngestion/types";
import {
  approveCandidateMatch,
  rejectCandidateMatch,
  markAsNewEntity,
  rematchCandidate,
  searchCanonicalTracks,
  hasCapability,
  getDisabledReason,
} from "@/services/chartsIngestion/client";
import type { UserRole } from "@/services/chartsIngestion/client";

interface MatchingStepProps {
  jobId: string;
  candidates: IngestCandidate[];
  matches: IngestMatch[];
  onUpdate: () => void;
  role?: UserRole;
}

export function MatchingStep({ jobId, candidates, matches, onUpdate, role = "admin" }: MatchingStepProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; title: string; artist: string }[]>([]);
  const [activeRematch, setActiveRematch] = useState<string | null>(null);

  const canApprove = hasCapability(role, "approve_matches");
  const canRematch = hasCapability(role, "rematch");

  const handleApprove = async (matchId: string) => {
    if (!canApprove) return;
    await approveCandidateMatch(jobId, "", matchId);
    onUpdate();
  };

  const handleReject = async (matchId: string) => {
    if (!canApprove) return;
    await rejectCandidateMatch(jobId, matchId);
    onUpdate();
  };

  const handleNewEntity = async (candidateId: string) => {
    if (!canApprove) return;
    await markAsNewEntity(jobId, candidateId);
    onUpdate();
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length > 2) {
      const results = await searchCanonicalTracks(query);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const handleRematch = async (candidateId: string, trackId: string) => {
    await rematchCandidate(jobId, candidateId, trackId, 95, "manual");
    setActiveRematch(null);
    setSearchQuery("");
    setSearchResults([]);
    onUpdate();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Canonical Matching</h2>
        <div className="flex items-center gap-2">
          <WkTag variant="brand">{matches.filter((m) => m.approvedBy).length} approved</WkTag>
          <WkTag>{matches.filter((m) => !m.approvedBy).length} pending</WkTag>
          <WkTag>{matches.filter((m) => m.matchMethod === "new_entity").length} new</WkTag>
        </div>
      </div>

      <div className="grid gap-3">
        {matches.map((m) => {
          const candidate = candidates.find((c) => c.id === m.candidateId);
          if (!candidate) return null;

          const isAutoApproved = m.approvedBy !== null && m.matchMethod !== "new_entity" && m.approvedBy === "James";
          const isAdminApproved = m.approvedBy !== null && m.approvedBy === "Current User";
          const isNewEntity = m.matchMethod === "new_entity";
          const isUnresolved = m.approvedBy === null && !isNewEntity;
          const isLowConfidence = (m.matchConfidence ?? 0) < 70;

          return (
            <WkSurface key={m.id} className="p-4">
              <div className="flex items-center gap-4">
                {candidate.artworkUrl && (
                  <img src={candidate.artworkUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--wk-text)]">{candidate.normalizedTitle}</div>
                  <div className="text-[12px] text-[var(--wk-text-muted)]">{candidate.normalizedArtistLine}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`text-[10px] font-semibold ${
                      m.matchConfidence >= 90 ? "text-[var(--wk-success)]" :
                      m.matchConfidence >= 70 ? "text-[var(--wk-brand)]" :
                      m.matchConfidence >= 50 ? "text-[var(--wk-warning)]" :
                      "text-[var(--wk-danger)]"
                    }`}>
                      {m.matchConfidence}% confidence
                    </span>
                    <span className="text-[10px] text-[var(--wk-text-faint)]">{m.matchMethod}</span>
                    {isAutoApproved && (
                      <span className="rounded-full bg-[var(--wk-success-soft)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--wk-success)]">
                        AUTO
                      </span>
                    )}
                    {isAdminApproved && (
                      <span className="rounded-full bg-[var(--wk-brand-soft)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--wk-brand)]">
                        ADMIN
                      </span>
                    )}
                    {isNewEntity && (
                      <span className="rounded-full bg-[var(--wk-info-soft)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--wk-info)]">
                        NEW
                      </span>
                    )}
                    {isLowConfidence && (
                      <span className="rounded-full bg-[var(--wk-warning-soft)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--wk-warning)]">
                        LOW
                      </span>
                    )}
                    {isUnresolved && (
                      <span className="rounded-full bg-[var(--wk-danger-soft)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--wk-danger)]">
                        UNRESOLVED
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isUnresolved && (
                    <>
                      <button
                        onClick={() => handleApprove(m.id)}
                        className="flex h-7 items-center gap-1 rounded-md bg-[var(--wk-success-soft)] px-2 text-[11px] font-semibold text-[var(--wk-success)] hover:bg-[var(--wk-success)]/20"
                      >
                        <i className="ri-check-line" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(m.id)}
                        className="flex h-7 items-center gap-1 rounded-md bg-[var(--wk-danger-soft)] px-2 text-[11px] font-semibold text-[var(--wk-danger)] hover:bg-[var(--wk-danger)]/20"
                      >
                        <i className="ri-close-line" />
                        Reject
                      </button>
                      <button
                        onClick={() => handleNewEntity(m.candidateId)}
                        className="flex h-7 items-center gap-1 rounded-md bg-[var(--wk-info-soft)] px-2 text-[11px] font-semibold text-[var(--wk-info)] hover:bg-[var(--wk-info)]/20"
                      >
                        <i className="ri-add-line" />
                        New
                      </button>
                      <button
                        onClick={() => setActiveRematch(activeRematch === m.id ? null : m.id)}
                        className="flex h-7 items-center gap-1 rounded-md bg-[var(--wk-warning-soft)] px-2 text-[11px] font-semibold text-[var(--wk-warning)] hover:bg-[var(--wk-warning)]/20"
                      >
                        <i className="ri-search-line" />
                        Rematch
                      </button>
                    </>
                  )}
                  {isNewEntity && (
                    <span className="text-[11px] text-[var(--wk-info)]">New entity approved</span>
                  )}
                  {isAdminApproved && !isNewEntity && (
                    <span className="text-[11px] text-[var(--wk-success)]">Approved</span>
                  )}
                  {isAutoApproved && !isNewEntity && (
                    <span className="text-[11px] text-[var(--wk-success)]">Auto-approved</span>
                  )}
                </div>
              </div>

              {/* Rematch Search */}
              {activeRematch === m.id && (
                <div className="mt-3 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] p-3">
                  <div className="text-[12px] font-semibold text-[var(--wk-text)] mb-2">Search Canonical Track</div>
                  <div className="flex items-center gap-2 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2">
                    <i className="ri-search-line text-[var(--wk-text-muted)]" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      placeholder="Search by title or artist..."
                      className="flex-1 bg-transparent text-[12px] text-[var(--wk-text)] outline-none placeholder:text-[var(--wk-text-faint)]"
                    />
                  </div>
                  {searchResults.length > 0 && (
                    <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                      {searchResults.map((result) => (
                        <button
                          key={result.id}
                          onClick={() => handleRematch(m.candidateId, result.id)}
                          className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-[var(--wk-surface-raised)]"
                        >
                          <div>
                            <div className="text-[12px] font-semibold text-[var(--wk-text)]">{result.title}</div>
                            <div className="text-[11px] text-[var(--wk-text-muted)]">{result.artist}</div>
                          </div>
                          <span className="ml-auto text-[10px] text-[var(--wk-brand)]">Select</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchQuery.length > 2 && searchResults.length === 0 && (
                    <div className="mt-2 text-[11px] text-[var(--wk-text-muted)]">No results found</div>
                  )}
                </div>
              )}

              {m.matchNotes && (
                <div className="mt-2 text-[11px] text-[var(--wk-text-muted)]">{m.matchNotes}</div>
              )}
            </WkSurface>
          );
        })}
      </div>
    </div>
  );
}