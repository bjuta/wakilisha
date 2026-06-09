import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { IngestResolvedRow } from "@/services/chartsIngestion/ingestStudioTypes";
import {
  getLiveReleaseShellReviewRows,
} from "@/services/registry/enrichment-review/client";
import {
  formatConfidence,
  getReleaseShellEnrichmentContexts,
  type EnrichmentDecisionStatus,
  type ReleaseShellEnrichmentContext,
  type RegistryEnrichmentSuggestionReviewItem,
} from "@/services/registry/enrichment-review/client";

interface RegistryReleaseShell extends IngestResolvedRow {
  shellKey: string;
  sourceSurface: "charts";
  sourceRunId: string;
  sourceRunTitle: string;
  sourceEditionDate: string;
}

type ShellReviewState = "pending" | "reviewing" | "approved" | "rejected";
type LocalSuggestionDecision = Extract<EnrichmentDecisionStatus, "approved" | "rejected" | "needs_review">;
type SuggestionLaneKey = "pending" | "needsReview" | "approved" | "rejected" | "other";

function getSuggestionStatus(
  suggestion: RegistryEnrichmentSuggestionReviewItem,
  overrides: Record<string, EnrichmentDecisionStatus>,
): EnrichmentDecisionStatus {
  return overrides[suggestion.id] ?? suggestion.decisionStatus;
}

function groupSuggestionsByDecision(
  suggestions: RegistryEnrichmentSuggestionReviewItem[],
  overrides: Record<string, EnrichmentDecisionStatus>,
): Record<SuggestionLaneKey, RegistryEnrichmentSuggestionReviewItem[]> {
  return suggestions.reduce<Record<SuggestionLaneKey, RegistryEnrichmentSuggestionReviewItem[]>>(
    (groups, suggestion) => {
      const status = getSuggestionStatus(suggestion, overrides);

      if (status === "draft") groups.pending.push(suggestion);
      else if (status === "needs_review") groups.needsReview.push(suggestion);
      else if (status === "approved") groups.approved.push(suggestion);
      else if (status === "rejected") groups.rejected.push(suggestion);
      else groups.other.push(suggestion);

      return groups;
    },
    { pending: [], needsReview: [], approved: [], rejected: [], other: [] },
  );
}

function getStatusPillClass(status: EnrichmentDecisionStatus): string {
  if (status === "approved") return "bg-[var(--wk-success-soft)] text-[var(--wk-success)]";
  if (status === "rejected") return "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]";
  if (status === "needs_review") return "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]";
  return "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]";
}

function formatDecisionStatus(status: EnrichmentDecisionStatus): string {
  return status.replace(/_/g, " ");
}

export default function AdminSettingsRegistryReleaseShells() {
  const navigate = useNavigate();

  const [shellRows, setShellRows] = useState<RegistryReleaseShell[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrichmentLoading, setEnrichmentLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [states, setStates] = useState<Record<string, ShellReviewState>>({});
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [suggestionDecisions, setSuggestionDecisions] = useState<Record<string, EnrichmentDecisionStatus>>({});
  const [enrichmentByShell, setEnrichmentByShell] = useState<Record<string, ReleaseShellEnrichmentContext>>({});
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { shells: liveShells, contexts } = await getLiveReleaseShellReviewRows();
    setShellRows(liveShells);
    setEnrichmentByShell(contexts);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const shells = useMemo<RegistryReleaseShell[]>(() => shellRows, [shellRows]);

  useEffect(() => {
    setEnrichmentLoading(false);
  }, [shells]);

  const filtered = shells.filter((row) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;

    return [
      row.title,
      row.artistNames.join(", "),
      row.releaseShellId ?? "",
      row.sourceRunTitle,
      row.sourceEditionDate,
    ].some((value) => value.toLowerCase().includes(q));
  });

  const pendingCount = filtered.filter((row) => {
    const state = states[row.shellKey] ?? "pending";
    return !["approved", "rejected"].includes(state);
  }).length;

  const allSuggestions = Object.values(enrichmentByShell).flatMap((context) => context.suggestions);
  const suggestionCount = allSuggestions.length;
  const pendingSuggestionCount = allSuggestions.filter((suggestion) => getSuggestionStatus(suggestion, suggestionDecisions) === "draft").length;
  const needsReviewSuggestionCount = allSuggestions.filter((suggestion) => getSuggestionStatus(suggestion, suggestionDecisions) === "needs_review").length;
  const approvedSuggestionCount = allSuggestions.filter((suggestion) => getSuggestionStatus(suggestion, suggestionDecisions) === "approved").length;
  const rejectedSuggestionCount = allSuggestions.filter((suggestion) => getSuggestionStatus(suggestion, suggestionDecisions) === "rejected").length;
  const avgConfidence = shells.length > 0 ? Math.round(shells.reduce((sum, row) => sum + row.confidence, 0) / shells.length) : 0;

  const markState = (row: RegistryReleaseShell, state: ShellReviewState) => {
    setStates((prev) => ({ ...prev, [row.shellKey]: state }));
    showToast(`Release shell "${row.title}" marked ${state}`);
  };

  const decideSuggestion = (suggestion: RegistryEnrichmentSuggestionReviewItem, decision: LocalSuggestionDecision) => {
    setSuggestionDecisions((prev) => ({ ...prev, [suggestion.id]: decision }));
    showToast(`${suggestion.fieldName} suggestion marked ${decision}`);
  };

  const renderSuggestionCard = (
    suggestion: RegistryEnrichmentSuggestionReviewItem,
    options: { readOnly?: boolean; allowNeedsReview?: boolean } = {},
  ) => {
    const status = getSuggestionStatus(suggestion, suggestionDecisions);
    const readOnly = options.readOnly ?? false;
    const allowNeedsReview = options.allowNeedsReview ?? true;

    return (
      <div key={suggestion.id} className={`rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3 ${readOnly ? "opacity-80" : ""}`}>
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-bold text-[var(--wk-text)]">{suggestion.fieldName}</p>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${getStatusPillClass(status)}`}>
                {formatDecisionStatus(status)}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-[var(--wk-text-muted)]">Suggested: <span className="font-semibold text-[var(--wk-text)]">{suggestion.suggestedValue}</span></p>
            <p className="text-[11px] text-[var(--wk-text-faint)]">Current: {suggestion.currentValue ?? "empty"} · {formatConfidence(suggestion.confidenceScore)}</p>
          </div>
          {!readOnly && (
            <div className="flex flex-wrap gap-1">
              {status !== "approved" && <button onClick={() => decideSuggestion(suggestion, "approved")} className="rounded px-2 py-1 text-[11px] font-semibold text-[var(--wk-brand)] hover:bg-[var(--wk-brand-soft)]">Approve</button>}
              {allowNeedsReview && status !== "needs_review" && <button onClick={() => decideSuggestion(suggestion, "needs_review")} className="rounded px-2 py-1 text-[11px] font-semibold text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]">Needs review</button>}
              {status !== "rejected" && <button onClick={() => decideSuggestion(suggestion, "rejected")} className="rounded px-2 py-1 text-[11px] font-semibold text-[var(--wk-danger)] hover:bg-[var(--wk-danger-soft)]">Reject</button>}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--wk-text-muted)]">
          <WkIcon name="Loader" size={16} className="animate-spin" />
          Loading registry release shells…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface-strong)] px-4 py-3 text-[13px] font-semibold text-[var(--wk-text)] shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <WkIcon name="Database" size={20} className="text-[var(--wk-brand)]" />
            <h1 className="text-[20px] font-black tracking-tight text-[var(--wk-text)]">Registry Release Shells</h1>
          </div>
          <p className="max-w-3xl text-[13px] text-[var(--wk-text-muted)]">
            Registry-owned provisional releases created when downstream surfaces cannot confidently match an incoming track or release.
            Charts can create demand for shells, but the registry owns review, enrichment, deduplication, and canonicalization.
          </p>
        </div>

        <button onClick={load} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
          <WkIcon name="RefreshCcw" size={14} />
          Refresh
        </button>
      </div>

      <WkSurface className="border-l-4 border-[var(--wk-brand)] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
            <WkIcon name="GitBranch" size={16} />
          </div>
          <div>
            <p className="text-[13px] font-bold text-[var(--wk-text)]">Registry-first ownership</p>
            <p className="mt-0.5 text-[12px] text-[var(--wk-text-muted)]">
              This page replaces the chart-owned release-shell mental model. Chart ingestion remains a source surface, while registry pages own the lifecycle.
              Phase 9B now reads enrichment context through the registry enrichment-review client. Canonical writes remain disabled.
            </p>
          </div>
        </div>
      </WkSurface>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <WkSurface className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">Total shells</p>
          <p className="mt-1 text-[26px] font-black text-[var(--wk-text)]">{shells.length}</p>
        </WkSurface>
        <WkSurface className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">Pending review</p>
          <p className="mt-1 text-[26px] font-black text-[var(--wk-text)]">{pendingCount}</p>
        </WkSurface>
        <WkSurface className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">Pending suggestions</p>
          <p className="mt-1 text-[26px] font-black text-[var(--wk-text)]">{pendingSuggestionCount}</p>
          {needsReviewSuggestionCount > 0 && <p className="mt-1 text-[11px] font-semibold text-[var(--wk-warning)]">{needsReviewSuggestionCount} needs review</p>}
        </WkSurface>
        <WkSurface className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">Approved / rejected</p>
          <p className="mt-1 text-[26px] font-black text-[var(--wk-text)]">{approvedSuggestionCount}/{rejectedSuggestionCount}</p>
        </WkSurface>
        <WkSurface className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">Avg confidence</p>
          <p className="mt-1 text-[26px] font-black text-[var(--wk-text)]">{avgConfidence}%</p>
        </WkSurface>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full max-w-md">
          <WkIcon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--wk-text-faint)]" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title, artist, shell ID, or source run…"
            className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)] py-2 pl-9 pr-3 text-[13px] text-[var(--wk-text)] outline-none placeholder:text-[var(--wk-text-faint)] focus:border-[var(--wk-border-strong)]"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {enrichmentLoading && <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-[var(--wk-text-muted)]"><WkIcon name="Loader" size={13} className="animate-spin" /> Loading enrichment</span>}
          <button onClick={() => navigate("/admin/registry/releases")} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">Registry Releases</button>
          <button onClick={() => navigate("/admin/charts/release-shells")} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">Legacy chart view</button>
        </div>
      </div>

      <WkSurface className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--wk-border)]">
                {["", "#", "Release / Track", "Artist", "Registry shell", "Source", "Confidence", "Suggestions", "Review"].map((heading) => (
                  <th key={heading || "toggle"} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">{heading}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filtered.map((row) => {
                const state = states[row.shellKey] ?? "pending";
                const isExpanded = expandedRows[row.shellKey] ?? false;
                const context = enrichmentByShell[row.shellKey];
                const suggestions = context?.suggestions ?? [];
                const suggestionGroups = groupSuggestionsByDecision(suggestions, suggestionDecisions);
                const completedSuggestionCount = suggestionGroups.approved.length + suggestionGroups.rejected.length;
                const shellSuggestionsComplete = suggestions.length > 0 && suggestionGroups.pending.length === 0 && suggestionGroups.needsReview.length === 0;

                return (
                  <Fragment key={row.shellKey}>
                    <tr className="border-b border-[var(--wk-border)]/60 hover:bg-[var(--wk-surface-raised)]/60">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandedRows((prev) => ({ ...prev, [row.shellKey]: !prev[row.shellKey] }))}
                          className="rounded p-1 text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]"
                          aria-label={isExpanded ? "Collapse enrichment panel" : "Expand enrichment panel"}
                        >
                          <WkIcon name={isExpanded ? "ChevronDown" : "ChevronRight"} size={14} />
                        </button>
                      </td>
                      <td className="px-4 py-3 font-bold text-[var(--wk-text-muted)]">{row.rank}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {row.artworkUrl && <img src={row.artworkUrl} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />}
                          <div>
                            <p className="font-semibold text-[var(--wk-text)]">{row.title}</p>
                            <p className="text-[11px] text-[var(--wk-text-muted)]">Match source: {row.matchStatus}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--wk-text-soft)]">{row.artistNames.join(", ")}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-[var(--wk-text-muted)]">{row.releaseShellId || "—"}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => navigate(`/admin/charts/ingest-runs/${row.sourceRunId}`)} className="text-[11px] font-semibold text-[var(--wk-brand)] hover:underline">
                          {row.sourceSurface} · {row.sourceEditionDate}
                        </button>
                      </td>
                      <td className="px-4 py-3"><span className="inline-flex rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] px-2 py-0.5 text-[11px] font-semibold text-[var(--wk-text-soft)]">{row.confidence}%</span></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${shellSuggestionsComplete ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]" : "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"}`}>
                            {shellSuggestionsComplete ? "Review complete" : `${suggestionGroups.pending.length}/${suggestions.length} pending`}
                          </span>
                          {suggestionGroups.needsReview.length > 0 && <span className="text-[10px] font-semibold text-[var(--wk-warning)]">{suggestionGroups.needsReview.length} needs review</span>}
                          {completedSuggestionCount > 0 && <span className="text-[10px] font-semibold text-[var(--wk-text-muted)]">{completedSuggestionCount} reviewed</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {state === "approved" || state === "rejected" ? (
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${state === "approved" ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]" : "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]"}`}>{state}</span>
                          ) : (
                            <>
                              <button onClick={() => markState(row, "reviewing")} className="rounded px-2 py-1 text-[11px] font-semibold text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]">Review</button>
                              <button onClick={() => markState(row, "approved")} className="rounded px-2 py-1 text-[11px] font-semibold text-[var(--wk-brand)] hover:bg-[var(--wk-brand-soft)]">Approve shell</button>
                              <button onClick={() => markState(row, "rejected")} className="rounded px-2 py-1 text-[11px] font-semibold text-[var(--wk-danger)] hover:bg-[var(--wk-danger-soft)]">Reject</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="border-b border-[var(--wk-border)] bg-[var(--wk-surface-raised)]/40">
                        <td colSpan={9} className="px-4 py-4">
                          <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
                            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
                              <div className="mb-3 flex items-center justify-between">
                                <div>
                                  <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">Enrichment suggestions</p>
                                  <p className="mt-1 text-[11px] text-[var(--wk-text-faint)]">Acted-on suggestions move out of the active pending list into their review lanes.</p>
                                </div>
                                <span className="text-[11px] font-semibold text-[var(--wk-text-muted)]">{context?.dataSource === "runtime_api" ? "Live staging data" : "Fallback context"}</span>
                              </div>

                              <div className="space-y-4">
                                <div>
                                  <div className="mb-2 flex items-center justify-between">
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">Pending</p>
                                    <span className="text-[11px] font-semibold text-[var(--wk-text-muted)]">{suggestionGroups.pending.length}</span>
                                  </div>
                                  {suggestionGroups.pending.length > 0 ? (
                                    <div className="space-y-2">{suggestionGroups.pending.map((suggestion) => renderSuggestionCard(suggestion))}</div>
                                  ) : (
                                    <p className="rounded-lg border border-dashed border-[var(--wk-border)] px-3 py-3 text-[12px] text-[var(--wk-text-muted)]">No pending suggestions in this shell.</p>
                                  )}
                                </div>

                                {suggestionGroups.needsReview.length > 0 && (
                                  <div className="border-t border-[var(--wk-border)] pt-4">
                                    <div className="mb-2 flex items-center justify-between">
                                      <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--wk-warning)]">Needs review</p>
                                      <span className="text-[11px] font-semibold text-[var(--wk-warning)]">{suggestionGroups.needsReview.length}</span>
                                    </div>
                                    <div className="space-y-2">{suggestionGroups.needsReview.map((suggestion) => renderSuggestionCard(suggestion, { allowNeedsReview: false }))}</div>
                                  </div>
                                )}

                                {(suggestionGroups.approved.length > 0 || suggestionGroups.rejected.length > 0 || suggestionGroups.other.length > 0) && (
                                  <div className="border-t border-[var(--wk-border)] pt-4">
                                    <div className="mb-2 flex items-center justify-between">
                                      <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">Reviewed</p>
                                      <span className="text-[11px] font-semibold text-[var(--wk-text-muted)]">{completedSuggestionCount + suggestionGroups.other.length}</span>
                                    </div>
                                    <div className="space-y-2">
                                      {[...suggestionGroups.approved, ...suggestionGroups.rejected, ...suggestionGroups.other].map((suggestion) => renderSuggestionCard(suggestion, { readOnly: true }))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
                              <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">Provider context</p>
                              <div className="mt-3 space-y-2 text-[12px] text-[var(--wk-text-muted)]">
                                <p><span className="font-semibold text-[var(--wk-text)]">Provider observations:</span> {context?.observations.length ?? 0}</p>
                                <p><span className="font-semibold text-[var(--wk-text)]">Provider entity links:</span> {context?.providerLinks.length ?? 0}</p>
                                <p><span className="font-semibold text-[var(--wk-text)]">Context source:</span> {context?.dataSource ?? "loading"}</p>
                                <p><span className="font-semibold text-[var(--wk-text)]">Canonical writes:</span> disabled until controlled runner approval</p>
                              </div>

                              {(context?.observations.length ?? 0) > 0 && (
                                <div className="mt-4 border-t border-[var(--wk-border)] pt-3">
                                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">Top observations</p>
                                  <div className="space-y-1">
                                    {context?.observations.slice(0, 4).map((observation) => (
                                      <p key={observation.id} className="text-[11px] text-[var(--wk-text-muted)]"><span className="font-semibold text-[var(--wk-text-soft)]">{observation.fieldName}:</span> {observation.fieldValue ?? "—"}</p>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="px-4 py-14 text-center">
            <WkIcon name="FolderCheck" size={28} className="mx-auto mb-3 text-[var(--wk-text-faint)]" />
            <p className="text-[14px] font-bold text-[var(--wk-text)]">No registry release shells</p>
            <p className="mt-1 text-[12px] text-[var(--wk-text-muted)]">Release shells will appear here when downstream surfaces request provisional registry entities.</p>
          </div>
        )}
      </WkSurface>
    </div>
  );
}
