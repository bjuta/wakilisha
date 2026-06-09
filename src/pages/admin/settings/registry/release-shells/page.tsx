import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { getIngestRuns } from "@/services/chartsIngestion/client";
import type { IngestResolvedRow, IngestRun } from "@/services/chartsIngestion/ingestStudioTypes";

interface RegistryReleaseShell extends IngestResolvedRow {
  sourceSurface: "charts";
  sourceRunId: string;
  sourceRunTitle: string;
  sourceEditionDate: string;
}

type ShellReviewState = "pending" | "reviewing" | "approved" | "rejected";
type SuggestionDecision = "draft" | "approved" | "rejected" | "needs_review";

interface MockEnrichmentSuggestion {
  id: string;
  fieldName: string;
  currentValue: string | null;
  suggestedValue: string;
  provider: "apple_music" | "spotify" | "charts";
  confidence: number;
  status: SuggestionDecision;
}

function buildMockSuggestions(row: RegistryReleaseShell): MockEnrichmentSuggestion[] {
  return [
    {
      id: `${row.id}-title`,
      fieldName: "title",
      currentValue: null,
      suggestedValue: row.title,
      provider: "charts",
      confidence: row.confidence,
      status: "draft",
    },
    {
      id: `${row.id}-artist_display_name`,
      fieldName: "artist_display_name",
      currentValue: null,
      suggestedValue: row.artistNames.join(", "),
      provider: "charts",
      confidence: Math.max(55, row.confidence - 5),
      status: "draft",
    },
    {
      id: `${row.id}-source_surface`,
      fieldName: "source_surface",
      currentValue: null,
      suggestedValue: row.sourceSurface,
      provider: "charts",
      confidence: 80,
      status: "draft",
    },
  ];
}

export default function AdminSettingsRegistryReleaseShells() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<IngestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [states, setStates] = useState<Record<string, ShellReviewState>>({});
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [suggestionDecisions, setSuggestionDecisions] = useState<Record<string, SuggestionDecision>>({});
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setRuns(await getIngestRuns());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const shells = useMemo<RegistryReleaseShell[]>(() => (
    runs.flatMap((run) =>
      run.rows
        .filter((row) => row.matchStatus === "shell")
        .map((row) => ({
          ...row,
          sourceSurface: "charts" as const,
          sourceRunId: run.id,
          sourceRunTitle: run.chartTitle,
          sourceEditionDate: run.editionDate,
        })),
    )
  ), [runs]);

  const filtered = shells.filter((row) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [row.title, row.artistNames.join(", "), row.releaseShellId ?? "", row.sourceRunTitle, row.sourceEditionDate]
      .some((value) => value.toLowerCase().includes(q));
  });

  const enrichmentByShell = useMemo(() => {
    return Object.fromEntries(shells.map((row) => {
      const suggestions = buildMockSuggestions(row).map((suggestion) => ({
        ...suggestion,
        status: suggestionDecisions[suggestion.id] ?? suggestion.status,
      }));
      return [row.id, suggestions];
    }));
  }, [shells, suggestionDecisions]);

  const pendingCount = filtered.filter((row) => !["approved", "rejected"].includes(states[row.id] ?? "pending")).length;
  const suggestionCount = Object.values(enrichmentByShell).reduce((sum, suggestions) => sum + suggestions.length, 0);
  const approvedSuggestionCount = Object.values(suggestionDecisions).filter((state) => state === "approved").length;
  const rejectedSuggestionCount = Object.values(suggestionDecisions).filter((state) => state === "rejected").length;
  const avgConfidence = shells.length > 0 ? Math.round(shells.reduce((sum, row) => sum + row.confidence, 0) / shells.length) : 0;

  const markState = (row: RegistryReleaseShell, state: ShellReviewState) => {
    setStates((prev) => ({ ...prev, [row.id]: state }));
    showToast(`Release shell "${row.title}" marked ${state}`);
  };

  const decideSuggestion = (suggestion: MockEnrichmentSuggestion, decision: SuggestionDecision) => {
    setSuggestionDecisions((prev) => ({ ...prev, [suggestion.id]: decision }));
    showToast(`${suggestion.fieldName} suggestion marked ${decision}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--wk-text-muted)]">
          <WkIcon name="Loader" size={16} className="animate-spin" /> Loading registry release shells…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface-strong)] px-4 py-3 text-[13px] font-semibold text-[var(--wk-text)] shadow-lg">{toast}</div>}

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
        <button onClick={load} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"><WkIcon name="RefreshCcw" size={14} /> Refresh</button>
      </div>

      <WkSurface className="border-l-4 border-[var(--wk-brand)] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"><WkIcon name="GitBranch" size={16} /></div>
          <div>
            <p className="text-[13px] font-bold text-[var(--wk-text)]">Registry-first ownership</p>
            <p className="mt-0.5 text-[12px] text-[var(--wk-text-muted)]">
              This page replaces the chart-owned release-shell mental model. Chart ingestion remains a source surface, while registry pages own the lifecycle.
              Phase 9 now adds an enrichment suggestion review layer before canonical writes.
            </p>
          </div>
        </div>
      </WkSurface>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <WkSurface className="p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">Total shells</p><p className="mt-1 text-[26px] font-black text-[var(--wk-text)]">{shells.length}</p></WkSurface>
        <WkSurface className="p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">Pending review</p><p className="mt-1 text-[26px] font-black text-[var(--wk-text)]">{pendingCount}</p></WkSurface>
        <WkSurface className="p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">Suggestions</p><p className="mt-1 text-[26px] font-black text-[var(--wk-text)]">{suggestionCount}</p></WkSurface>
        <WkSurface className="p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">Approved / rejected</p><p className="mt-1 text-[26px] font-black text-[var(--wk-text)]">{approvedSuggestionCount}/{rejectedSuggestionCount}</p></WkSurface>
        <WkSurface className="p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">Avg confidence</p><p className="mt-1 text-[26px] font-black text-[var(--wk-text)]">{avgConfidence}%</p></WkSurface>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full max-w-md">
          <WkIcon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--wk-text-faint)]" />
          <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title, artist, shell ID, or source run…" className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)] py-2 pl-9 pr-3 text-[13px] text-[var(--wk-text)] outline-none placeholder:text-[var(--wk-text-faint)] focus:border-[var(--wk-border-strong)]" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigate("/admin/registry/releases")} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">Registry Releases</button>
          <button onClick={() => navigate("/admin/charts/release-shells")} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">Legacy chart view</button>
        </div>
      </div>

      <WkSurface className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--wk-border)]">
                {["", "#", "Release / Track", "Artist", "Registry shell", "Source", "Confidence", "Suggestions", "Review"].map((heading) => <th key={heading || "toggle"} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">{heading}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const state = states[row.id] ?? "pending";
                const isExpanded = Boolean(expandedRows[row.id]);
                const suggestions = enrichmentByShell[row.id] ?? [];
                const pendingSuggestions = suggestions.filter((suggestion) => suggestion.status === "draft" || suggestion.status === "needs_review").length;
                return (
                  <>
                    <tr key={row.id} className="border-b border-[var(--wk-border)]/60 hover:bg-[var(--wk-surface-raised)]/60">
                      <td className="px-4 py-3"><button onClick={() => setExpandedRows((prev) => ({ ...prev, [row.id]: !isExpanded }))} className="rounded p-1 text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]"><WkIcon name={isExpanded ? "ChevronDown" : "ChevronRight"} size={14} /></button></td>
                      <td className="px-4 py-3 font-bold text-[var(--wk-text-muted)]">{row.rank}</td>
                      <td className="px-4 py-3"><div className="flex items-center gap-2">{row.artworkUrl && <img src={row.artworkUrl} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />}<div><p className="font-semibold text-[var(--wk-text)]">{row.title}</p><p className="text-[11px] text-[var(--wk-text-muted)]">Match source: {row.matchStatus}</p></div></div></td>
                      <td className="px-4 py-3 text-[var(--wk-text-soft)]">{row.artistNames.join(", ")}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-[var(--wk-text-muted)]">{row.releaseShellId || "—"}</td>
                      <td className="px-4 py-3"><button onClick={() => navigate(`/admin/charts/ingest-runs/${row.sourceRunId}`)} className="text-[11px] font-semibold text-[var(--wk-brand)] hover:underline">{row.sourceSurface} · {row.sourceEditionDate}</button></td>
                      <td className="px-4 py-3"><span className="inline-flex rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] px-2 py-0.5 text-[11px] font-semibold text-[var(--wk-text-soft)]">{row.confidence}%</span></td>
                      <td className="px-4 py-3"><span className="inline-flex rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--wk-brand)]">{pendingSuggestions}/{suggestions.length} pending</span></td>
                      <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{state === "approved" || state === "rejected" ? <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${state === "approved" ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]" : "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]"}`}>{state}</span> : <><button onClick={() => markState(row, "reviewing")} className="rounded px-2 py-1 text-[11px] font-semibold text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]">Review</button><button onClick={() => markState(row, "approved")} className="rounded px-2 py-1 text-[11px] font-semibold text-[var(--wk-brand)] hover:bg-[var(--wk-brand-soft)]">Approve shell</button><button onClick={() => markState(row, "rejected")} className="rounded px-2 py-1 text-[11px] font-semibold text-[var(--wk-danger)] hover:bg-[var(--wk-danger-soft)]">Reject</button></>}</div></td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${row.id}-enrichment`} className="border-b border-[var(--wk-border)] bg-[var(--wk-surface-raised)]/40">
                        <td colSpan={9} className="px-4 py-4">
                          <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
                            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
                              <div className="mb-3 flex items-center justify-between"><p className="text-[12px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">Enrichment suggestions</p><span className="text-[11px] font-semibold text-[var(--wk-text-muted)]">Mock UI until API wiring</span></div>
                              <div className="space-y-2">
                                {suggestions.map((suggestion) => (
                                  <div key={suggestion.id} className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3">
                                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                      <div><p className="text-[13px] font-bold text-[var(--wk-text)]">{suggestion.fieldName}</p><p className="mt-1 text-[12px] text-[var(--wk-text-muted)]">Suggested: <span className="font-semibold text-[var(--wk-text)]">{suggestion.suggestedValue}</span></p><p className="text-[11px] text-[var(--wk-text-faint)]">Current: {suggestion.currentValue ?? "empty"} · {suggestion.provider} · {suggestion.confidence}%</p></div>
                                      <div className="flex flex-wrap gap-1"><button onClick={() => decideSuggestion(suggestion, "approved")} className="rounded px-2 py-1 text-[11px] font-semibold text-[var(--wk-brand)] hover:bg-[var(--wk-brand-soft)]">Approve</button><button onClick={() => decideSuggestion(suggestion, "needs_review")} className="rounded px-2 py-1 text-[11px] font-semibold text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]">Needs review</button><button onClick={() => decideSuggestion(suggestion, "rejected")} className="rounded px-2 py-1 text-[11px] font-semibold text-[var(--wk-danger)] hover:bg-[var(--wk-danger-soft)]">Reject</button></div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
                              <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--wk-text-muted)]">Provider context</p>
                              <div className="mt-3 space-y-2 text-[12px] text-[var(--wk-text-muted)]">
                                <p><span className="font-semibold text-[var(--wk-text)]">Provider observations:</span> {suggestions.length * 2}</p>
                                <p><span className="font-semibold text-[var(--wk-text)]">Provider entity links:</span> 1 source link pending</p>
                                <p><span className="font-semibold text-[var(--wk-text)]">Canonical writes:</span> disabled until controlled runner approval</p>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="px-4 py-14 text-center"><WkIcon name="FolderCheck" size={28} className="mx-auto mb-3 text-[var(--wk-text-faint)]" /><p className="text-[14px] font-bold text-[var(--wk-text)]">No registry release shells</p><p className="mt-1 text-[12px] text-[var(--wk-text-muted)]">Release shells will appear here when downstream surfaces request provisional registry entities.</p></div>}
      </WkSurface>
    </div>
  );
}
