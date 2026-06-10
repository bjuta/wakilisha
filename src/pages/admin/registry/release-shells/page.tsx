import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  formatConfidence,
  getLiveReleaseShellReviewRows,
  updateReleaseShellSuggestionDecision,
  type EnrichmentDecisionStatus,
  type RegistryEnrichmentSuggestionReviewItem,
  type RegistryReleaseShellReviewRow,
  type ReleaseShellEnrichmentContext,
} from "@/services/registry/enrichment-review/client";

type LocalSuggestionDecision = Extract<
  EnrichmentDecisionStatus,
  "approved" | "rejected" | "needs_review"
>;

type SuggestionLaneKey = "pending" | "needsReview" | "approved" | "rejected" | "other";
type QueueFilter = "active" | "all" | "open" | "blocked" | "resolved";

function getSuggestionStatus(
  suggestion: RegistryEnrichmentSuggestionReviewItem,
  overrides: Record<string, EnrichmentDecisionStatus>,
): EnrichmentDecisionStatus {
  return overrides[suggestion.id] ?? suggestion.decisionStatus;
}

function formatDecisionStatus(status: EnrichmentDecisionStatus): string {
  return status.replace(/_/g, " ");
}

function getStatusPillClass(status: EnrichmentDecisionStatus): string {
  if (status === "approved") return "bg-[var(--wk-success-soft)] text-[var(--wk-success)]";
  if (status === "rejected") return "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]";
  if (status === "needs_review") return "bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]";
  if (status === "applied") return "bg-[var(--wk-success-soft)] text-[var(--wk-success)]";
  return "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]";
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

function getQueueStatus(
  context: ReleaseShellEnrichmentContext | undefined,
  overrides: Record<string, EnrichmentDecisionStatus>,
): "open" | "blocked" | "resolved" {
  if (context?.lifecycle?.status === "resolved") return "resolved";

  const groups = groupSuggestionsByDecision(context?.suggestions ?? [], overrides);
  if (groups.needsReview.length > 0) return "blocked";

  return "open";
}

export default function AdminRegistryReleaseShells() {
  const navigate = useNavigate();

  const [shellRows, setShellRows] = useState<RegistryReleaseShellReviewRow[]>([]);
  const [enrichmentByShell, setEnrichmentByShell] = useState<Record<string, ReleaseShellEnrichmentContext>>({});
  const [suggestionDecisions, setSuggestionDecisions] = useState<Record<string, EnrichmentDecisionStatus>>({});
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("active");
  const [includeResolved, setIncludeResolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingSuggestionIds, setSavingSuggestionIds] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3200);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const shouldIncludeResolved = includeResolved || queueFilter === "all" || queueFilter === "resolved";
      const { shells, contexts } = await getLiveReleaseShellReviewRows({
        includeResolved: shouldIncludeResolved,
      });

      setShellRows(shells);
      setEnrichmentByShell(contexts);
    } catch (error) {
      setShellRows([]);
      setEnrichmentByShell({});
      setErrorMessage(error instanceof Error ? error.message : "Failed to load live release shells.");
    } finally {
      setLoading(false);
    }
  }, [includeResolved, queueFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return shellRows.filter((row) => {
      const context = enrichmentByShell[row.shellKey];
      const queueStatus = getQueueStatus(context, suggestionDecisions);

      const matchesFilter =
        queueFilter === "all"
          ? true
          : queueFilter === "active"
            ? queueStatus !== "resolved"
            : queueStatus === queueFilter;

      if (!matchesFilter) return false;

      const q = search.trim().toLowerCase();
      if (!q) return true;

      return [
        row.title,
        row.artistNames.join(", "),
        row.releaseShellId ?? "",
        row.sourceRunTitle,
        row.sourceEditionDate,
        queueStatus,
      ].some((value) => value.toLowerCase().includes(q));
    });
  }, [shellRows, enrichmentByShell, suggestionDecisions, queueFilter, search]);

  const allSuggestions = Object.values(enrichmentByShell).flatMap((context) => context.suggestions);
  const pendingSuggestionCount = allSuggestions.filter((suggestion) => getSuggestionStatus(suggestion, suggestionDecisions) === "draft").length;
  const needsReviewSuggestionCount = allSuggestions.filter((suggestion) => getSuggestionStatus(suggestion, suggestionDecisions) === "needs_review").length;
  const approvedSuggestionCount = allSuggestions.filter((suggestion) => getSuggestionStatus(suggestion, suggestionDecisions) === "approved").length;
  const rejectedSuggestionCount = allSuggestions.filter((suggestion) => getSuggestionStatus(suggestion, suggestionDecisions) === "rejected").length;

  const queueSummary = shellRows.reduce(
    (summary, row) => {
      const status = getQueueStatus(enrichmentByShell[row.shellKey], suggestionDecisions);
      summary[status] += 1;
      return summary;
    },
    { open: 0, blocked: 0, resolved: 0 },
  );

  const avgConfidence =
    shellRows.length > 0
      ? Math.round(shellRows.reduce((sum, row) => sum + row.confidence, 0) / shellRows.length)
      : 0;

  const decideSuggestion = async (
    suggestion: RegistryEnrichmentSuggestionReviewItem,
    decision: LocalSuggestionDecision,
  ) => {
    const previousOverride = suggestionDecisions[suggestion.id];

    setSavingSuggestionIds((prev) => ({ ...prev, [suggestion.id]: true }));
    setSuggestionDecisions((prev) => ({ ...prev, [suggestion.id]: decision }));

    try {
      const persisted = await updateReleaseShellSuggestionDecision(suggestion.id, decision);

      setSuggestionDecisions((prev) => ({
        ...prev,
        [suggestion.id]: persisted.decisionStatus,
      }));

      setEnrichmentByShell((prev) => {
        const next = { ...prev };

        for (const [shellKey, context] of Object.entries(next)) {
          if (!context.suggestions.some((item) => item.id === suggestion.id)) continue;

          next[shellKey] = {
            ...context,
            suggestions: context.suggestions.map((item) =>
              item.id === suggestion.id
                ? { ...item, decisionStatus: persisted.decisionStatus }
                : item,
            ),
          };
        }

        return next;
      });

      showToast(`${suggestion.fieldName} saved as ${formatDecisionStatus(persisted.decisionStatus)}.`);
    } catch (error) {
      setSuggestionDecisions((prev) => {
        const next = { ...prev };

        if (previousOverride) next[suggestion.id] = previousOverride;
        else delete next[suggestion.id];

        return next;
      });

      showToast(error instanceof Error ? error.message : "Failed to save suggestion decision.");
    } finally {
      setSavingSuggestionIds((prev) => {
        const next = { ...prev };
        delete next[suggestion.id];
        return next;
      });
    }
  };

  const renderSuggestionCard = (
    suggestion: RegistryEnrichmentSuggestionReviewItem,
    options: { readOnly?: boolean; allowNeedsReview?: boolean } = {},
  ) => {
    const status = getSuggestionStatus(suggestion, suggestionDecisions);
    const readOnly = options.readOnly ?? false;
    const allowNeedsReview = options.allowNeedsReview ?? true;
    const saving = Boolean(savingSuggestionIds[suggestion.id]);

    return (
      <div
        key={suggestion.id}
        className={`rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3 ${
          readOnly ? "opacity-80" : ""
        }`}
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-bold text-[var(--wk-text)]">{suggestion.fieldName}</p>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${getStatusPillClass(status)}`}>
                {formatDecisionStatus(status)}
              </span>
            </div>

            <p className="mt-1 text-[12px] text-[var(--wk-text-muted)]">
              Suggested:{" "}
              <span className="font-semibold text-[var(--wk-text)]">
                {suggestion.suggestedValue}
              </span>
            </p>

            <p className="text-[11px] text-[var(--wk-text-faint)]">
              Current: {suggestion.currentValue ?? "empty"} · {formatConfidence(suggestion.confidenceScore)}
            </p>
          </div>

          {!readOnly && (
            <div className="flex flex-wrap gap-1">
              {status !== "approved" && (
                <button
                  onClick={() => decideSuggestion(suggestion, "approved")}
                  disabled={saving}
                  className="rounded px-2 py-1 text-[11px] font-semibold text-[var(--wk-brand)] hover:bg-[var(--wk-brand-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Approve
                </button>
              )}

              {allowNeedsReview && status !== "needs_review" && (
                <button
                  onClick={() => decideSuggestion(suggestion, "needs_review")}
                  disabled={saving}
                  className="rounded px-2 py-1 text-[11px] font-semibold text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Needs review
                </button>
              )}

              {status !== "rejected" && (
                <button
                  onClick={() => decideSuggestion(suggestion, "rejected")}
                  disabled={saving}
                  className="rounded px-2 py-1 text-[11px] font-semibold text-[var(--wk-danger)] hover:bg-[var(--wk-danger-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reject
                </button>
              )}
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
          Loading live registry release shells…
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
            <h1 className="text-[20px] font-black tracking-tight text-[var(--wk-text)]">
              Registry Release Shells
            </h1>
          </div>

          <p className="max-w-3xl text-[13px] text-[var(--wk-text-muted)]">
            Live registry review queue sourced from Phase 8C enrichment staging. This route intentionally does not
            use chart-ingestion fixture rows and fails softly when no live staging content exists.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIncludeResolved((value) => !value)}
            className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
          >
            {includeResolved ? "Hide resolved" : "Show resolved"}
          </button>

          <button onClick={load} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
            <WkIcon name="RefreshCcw" size={14} />
            Refresh
          </button>
        </div>
      </div>

      <WkSurface className="border-l-4 border-[var(--wk-brand)] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
            <WkIcon name="ShieldCheck" size={16} />
          </div>

          <div>
            <p className="text-[13px] font-bold text-[var(--wk-text)]">
              Review-safe live staging mode
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--wk-text-muted)]">
              This page has no pre-apply preview or canonical write UI. It only persists reviewer decisions
              against live enrichment suggestions.
            </p>
          </div>
        </div>
      </WkSurface>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <WkSurface className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">Total shells</p>
          <p className="mt-1 text-[26px] font-black text-[var(--wk-text)]">{shellRows.length}</p>
        </WkSurface>

        <WkSurface className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">Pending suggestions</p>
          <p className="mt-1 text-[26px] font-black text-[var(--wk-text)]">{pendingSuggestionCount}</p>
          {needsReviewSuggestionCount > 0 && (
            <p className="mt-1 text-[11px] font-semibold text-[var(--wk-warning)]">
              {needsReviewSuggestionCount} needs review
            </p>
          )}
        </WkSurface>

        <WkSurface className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">Open</p>
          <p className="mt-1 text-[26px] font-black text-[var(--wk-text)]">{queueSummary.open}</p>
        </WkSurface>

        <WkSurface className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">Blocked</p>
          <p className="mt-1 text-[26px] font-black text-[var(--wk-text)]">{queueSummary.blocked}</p>
        </WkSurface>

        <WkSurface className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">Approved / rejected</p>
          <p className="mt-1 text-[26px] font-black text-[var(--wk-text)]">
            {approvedSuggestionCount}/{rejectedSuggestionCount}
          </p>
        </WkSurface>

        <WkSurface className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">Avg confidence</p>
          <p className="mt-1 text-[26px] font-black text-[var(--wk-text)]">{avgConfidence}%</p>
        </WkSurface>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ["active", "Active", queueSummary.open + queueSummary.blocked],
          ["open", "Open", queueSummary.open],
          ["blocked", "Blocked", queueSummary.blocked],
          ["resolved", "Resolved", queueSummary.resolved],
          ["all", "All", shellRows.length],
        ] as Array<[QueueFilter, string, number]>).map(([filter, label, count]) => (
          <button
            key={filter}
            onClick={() => setQueueFilter(filter)}
            className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
              queueFilter === filter
                ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                : "border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]"
            }`}
          >
            {label} · {count}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full max-w-md">
          <WkIcon
            name="Search"
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--wk-text-faint)]"
          />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search live release shells…"
            className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)] py-2 pl-9 pr-3 text-[13px] text-[var(--wk-text)] outline-none placeholder:text-[var(--wk-text-faint)] focus:border-[var(--wk-border-strong)]"
          />
        </div>

        <button
          onClick={() => navigate("/admin/registry/releases")}
          className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
        >
          Registry Releases
        </button>
      </div>

      <WkSurface className="overflow-hidden">
        {errorMessage && (
          <div className="border-b border-[var(--wk-border)] bg-[var(--wk-danger-soft)] px-4 py-3 text-[12px] font-semibold text-[var(--wk-danger)]">
            {errorMessage}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <WkIcon name="FolderCheck" size={32} className="mx-auto mb-3 text-[var(--wk-text-faint)]" />
            <p className="text-[15px] font-bold text-[var(--wk-text)]">
              No live release shells ready for review
            </p>
            <p className="mx-auto mt-1 max-w-xl text-[12px] text-[var(--wk-text-muted)]">
              There is no reviewable Phase 8C staging content for this queue. The system is intentionally
              not showing fixture data.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--wk-border)]">
                  {["", "#", "Release", "Artist", "Registry shell", "Source", "Confidence", "Suggestions"].map((heading) => (
                    <th
                      key={heading || "toggle"}
                      className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filtered.map((row) => {
                  const isExpanded = expandedRows[row.shellKey] ?? false;
                  const context = enrichmentByShell[row.shellKey];
                  const suggestions = context?.suggestions ?? [];
                  const suggestionGroups = groupSuggestionsByDecision(suggestions, suggestionDecisions);
                  const queueStatus = getQueueStatus(context, suggestionDecisions);
                  const completedSuggestionCount = suggestionGroups.approved.length + suggestionGroups.rejected.length;

                  return (
                    <Fragment key={row.shellKey}>
                      <tr className="border-b border-[var(--wk-border)]/60 hover:bg-[var(--wk-surface-raised)]/60">
                        <td className="px-4 py-3">
                          <button
                            onClick={() =>
                              setExpandedRows((prev) => ({
                                ...prev,
                                [row.shellKey]: !prev[row.shellKey],
                              }))
                            }
                            className="rounded p-1 text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]"
                            aria-label={isExpanded ? "Collapse enrichment panel" : "Expand enrichment panel"}
                          >
                            <WkIcon name={isExpanded ? "ChevronDown" : "ChevronRight"} size={14} />
                          </button>
                        </td>

                        <td className="px-4 py-3 font-bold text-[var(--wk-text-muted)]">
                          {row.rank}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {row.artworkUrl && (
                              <img src={row.artworkUrl} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
                            )}
                            <div>
                              <p className="font-semibold text-[var(--wk-text)]">{row.title}</p>
                              <p className="text-[11px] text-[var(--wk-text-muted)]">
                                Live staging data · {queueStatus}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-[var(--wk-text-soft)]">
                          {row.artistNames.join(", ") || "—"}
                        </td>

                        <td className="px-4 py-3 font-mono text-[11px] text-[var(--wk-text-muted)]">
                          {row.releaseShellId || row.id}
                        </td>

                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] px-2 py-0.5 text-[11px] font-semibold text-[var(--wk-text-soft)]">
                            registry · live
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] px-2 py-0.5 text-[11px] font-semibold text-[var(--wk-text-soft)]">
                            {row.confidence}%
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--wk-brand)]">
                              {suggestionGroups.pending.length}/{suggestions.length} pending
                            </span>
                            {suggestionGroups.needsReview.length > 0 && (
                              <span className="text-[10px] font-semibold text-[var(--wk-warning)]">
                                {suggestionGroups.needsReview.length} needs review
                              </span>
                            )}
                            {completedSuggestionCount > 0 && (
                              <span className="text-[10px] font-semibold text-[var(--wk-text-muted)]">
                                {completedSuggestionCount} reviewed
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="border-b border-[var(--wk-border)] bg-[var(--wk-surface-raised)]/40">
                          <td colSpan={8} className="px-4 py-4">
                            <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
                              <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
                                <div className="mb-3 flex items-center justify-between">
                                  <div>
                                    <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">
                                      Enrichment suggestions
                                    </p>
                                    <p className="mt-1 text-[11px] text-[var(--wk-text-faint)]">
                                      Decisions persist to Phase 8C staging. Canonical writes are not available on this safe page.
                                    </p>
                                  </div>
                                  <span className="text-[11px] font-semibold text-[var(--wk-text-muted)]">
                                    {context?.dataSource === "runtime_api" ? "Live staging data" : "No live context"}
                                  </span>
                                </div>

                                <div className="space-y-4">
                                  <div>
                                    <div className="mb-2 flex items-center justify-between">
                                      <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">
                                        Pending
                                      </p>
                                      <span className="text-[11px] font-semibold text-[var(--wk-text-muted)]">
                                        {suggestionGroups.pending.length}
                                      </span>
                                    </div>

                                    {suggestionGroups.pending.length > 0 ? (
                                      <div className="space-y-2">
                                        {suggestionGroups.pending.map((suggestion) => renderSuggestionCard(suggestion))}
                                      </div>
                                    ) : (
                                      <p className="rounded-lg border border-dashed border-[var(--wk-border)] px-3 py-3 text-[12px] text-[var(--wk-text-muted)]">
                                        No pending suggestions in this shell.
                                      </p>
                                    )}
                                  </div>

                                  {suggestionGroups.needsReview.length > 0 && (
                                    <div className="border-t border-[var(--wk-border)] pt-4">
                                      <div className="mb-2 flex items-center justify-between">
                                        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--wk-warning)]">
                                          Needs review
                                        </p>
                                        <span className="text-[11px] font-semibold text-[var(--wk-warning)]">
                                          {suggestionGroups.needsReview.length}
                                        </span>
                                      </div>
                                      <div className="space-y-2">
                                        {suggestionGroups.needsReview.map((suggestion) =>
                                          renderSuggestionCard(suggestion, { allowNeedsReview: false }),
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {(suggestionGroups.approved.length > 0 ||
                                    suggestionGroups.rejected.length > 0 ||
                                    suggestionGroups.other.length > 0) && (
                                    <div className="border-t border-[var(--wk-border)] pt-4">
                                      <div className="mb-2 flex items-center justify-between">
                                        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">
                                          Reviewed
                                        </p>
                                        <span className="text-[11px] font-semibold text-[var(--wk-text-muted)]">
                                          {completedSuggestionCount + suggestionGroups.other.length}
                                        </span>
                                      </div>
                                      <div className="space-y-2">
                                        {[...suggestionGroups.approved, ...suggestionGroups.rejected, ...suggestionGroups.other].map((suggestion) =>
                                          renderSuggestionCard(suggestion, { readOnly: true }),
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
                                <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">
                                  Provider context
                                </p>

                                <div className="mt-3 space-y-2 text-[12px] text-[var(--wk-text-muted)]">
                                  <p>
                                    <span className="font-semibold text-[var(--wk-text)]">Provider observations:</span>{" "}
                                    {context?.observations.length ?? 0}
                                  </p>
                                  <p>
                                    <span className="font-semibold text-[var(--wk-text)]">Provider entity links:</span>{" "}
                                    {context?.providerLinks.length ?? 0}
                                  </p>
                                  <p>
                                    <span className="font-semibold text-[var(--wk-text)]">Context source:</span>{" "}
                                    {context?.dataSource ?? "loading"}
                                  </p>
                                  <p>
                                    <span className="font-semibold text-[var(--wk-text)]">Lifecycle:</span>{" "}
                                    {context?.lifecycle?.status ?? "open"}
                                  </p>
                                  <p>
                                    <span className="font-semibold text-[var(--wk-text)]">Canonical writes:</span>{" "}
                                    disabled on this safe review route
                                  </p>
                                </div>
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
        )}
      </WkSurface>
    </div>
  );
}
