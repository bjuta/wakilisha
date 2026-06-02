import { useState } from "react";
import { Plus, ArrowUp, ArrowDown, Minus, AlertTriangle, Check, ChevronUp, ChevronDown } from "lucide-react";
import type { IngestResolvedRow } from "@/services/chartsIngestion/ingestStudioTypes";
import { applyMatchDecision, searchRegistryByQuery } from "@/services/chartsIngestion/canonicalMatch";
import type { MatchDecisionAction } from "@/services/chartsIngestion/canonicalMatch";

// ─── Match Badge ───
function MatchBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    canonical: "bg-wk-success-soft text-wk-success border-wk-success/20",
    shell: "bg-wk-warning-soft text-wk-warning border-wk-warning/20",
    no_match: "bg-wk-danger-soft text-wk-danger border-wk-danger/20",
    needs_review: "bg-wk-info-soft text-wk-info border-wk-info/20",
    duplicate_candidate: "bg-wk-brand-soft text-wk-brand border-wk-brand/20",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${styles[status] || "bg-wk-bg-subtle text-wk-text-muted border-wk-border"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ─── Mini Chart Row ───
interface MiniChartRowProps {
  row: IngestResolvedRow;
  index: number;
}

export function MiniChartRow({ row, index }: MiniChartRowProps) {
  const movement = row.movement;
  const MovementIcon = movement === "up" ? ArrowUp : movement === "down" ? ArrowDown : movement === "new" ? Plus : Minus;
  const movementColor = movement === "up" ? "text-wk-success" : movement === "down" ? "text-wk-danger" : movement === "new" ? "text-wk-brand" : "text-wk-text-faint";

  return (
    <div className={`flex items-center gap-3 rounded-lg p-2 transition-colors ${index % 2 === 0 ? "bg-wk-bg" : "bg-transparent"} hover:bg-wk-bg-subtle`}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-wk-bg-subtle text-[12px] font-bold text-wk-text-soft">
        {row.rank}
      </span>
      {row.artworkUrl ? (
        <img src={row.artworkUrl} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-wk-border text-wk-text-faint">
          <Plus size={14} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-wk-text">{row.title}</p>
        <p className="truncate text-[11px] text-wk-text-muted">{row.artistNames.join(", ")}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-[12px] font-bold ${movementColor}`}>
          <MovementIcon size={12} />
        </span>
        <MatchBadge status={row.matchStatus} />
      </div>
    </div>
  );
}

// ─── Match Decision Panel ───
interface MatchDecisionPanelProps {
  row: IngestResolvedRow;
  onApply: (result: ReturnType<typeof applyMatchDecision>) => void;
  onClose: () => void;
}

function MatchDecisionPanel({ row, onApply, onClose }: MatchDecisionPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ReturnType<typeof searchRegistryByQuery>>([]);
  const [note, setNote] = useState("");
  const [selectedAction, setSelectedAction] = useState<MatchDecisionAction | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (q.length >= 2) {
      const results = searchRegistryByQuery(q);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const handleApply = (action: MatchDecisionAction, trackId?: string) => {
    const result = applyMatchDecision(row, {
      rowId: row.id,
      action,
      canonicalTrackId: trackId,
      note: note || undefined,
      actor: "Current User",
      decidedAt: new Date().toISOString(),
    });
    onApply(result);
  };

  const requiresRegistrySearch = selectedAction === "change_match" || selectedAction === "attach_to_existing" || selectedAction === "merge_shell";

  return (
    <div className="mt-2 rounded-lg border border-wk-border bg-wk-surface-raised p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-bold text-wk-text">Match Decision: <span className="text-wk-text-soft">{row.title}</span></p>
        <button onClick={onClose} className="text-wk-text-faint hover:text-wk-text-muted">
          <i className="ri-close-line text-[14px]" />
        </button>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <ActionBtn
          icon="ri-check-double-line"
          label="Accept Canonical"
          disabled={row.matchStatus === "canonical" && !!row.canonicalTrackId}
          onClick={() => { handleApply("accept_canonical"); }}
          variant="success"
          title="Accept the current canonical match"
        />
        <ActionBtn
          icon="ri-search-eye-line"
          label="Change Match"
          onClick={() => setSelectedAction(selectedAction === "change_match" ? null : "change_match")}
          active={selectedAction === "change_match"}
          variant="brand"
          title="Search registry and reassign to a different canonical track"
        />
        <ActionBtn
          icon="ri-git-branch-line"
          label="Attach to Existing"
          onClick={() => setSelectedAction(selectedAction === "attach_to_existing" ? null : "attach_to_existing")}
          active={selectedAction === "attach_to_existing"}
          variant="info"
          title="Attach row to an existing canonical entity"
        />
        <ActionBtn
          icon="ri-folder-add-line"
          label="Create Shell"
          onClick={() => handleApply("create_shell")}
          variant="warning"
          title="Create a provisional release shell for this track"
        />
        <ActionBtn
          icon="ri-git-merge-line"
          label="Merge Shell"
          disabled={!row.releaseShellId}
          onClick={() => setSelectedAction(selectedAction === "merge_shell" ? null : "merge_shell")}
          active={selectedAction === "merge_shell"}
          variant="warning"
          title="Merge the shell with an existing canonical entity"
        />
        <ActionBtn
          icon="ri-file-copy-line"
          label="Mark Duplicate"
          onClick={() => handleApply("mark_duplicate")}
          variant="brand"
          title="Flag this row as a duplicate candidate"
        />
        <ActionBtn
          icon="ri-send-plane-line"
          label="Send to Review"
          disabled={row.matchStatus === "needs_review"}
          onClick={() => handleApply("send_to_review")}
          variant="info"
          title="Send to the review queue for manual investigation"
        />
        <ActionBtn
          icon="ri-eye-off-line"
          label="Ignore"
          onClick={() => handleApply("ignore")}
          variant="danger"
          title="Ignore this row — exclude from chart"
        />
      </div>

      {/* Registry search for change_match / attach / merge_shell */}
      {requiresRegistrySearch && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-surface px-3 py-2">
            <i className="ri-search-line text-wk-text-faint" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search registry by title or artist…"
              className="flex-1 bg-transparent text-[12px] text-wk-text outline-none placeholder:text-wk-text-faint"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {searchResults.map((track) => (
                <button
                  key={track.id}
                  onClick={() => {
                    setSelectedTrackId(track.id);
                    handleApply(selectedAction!, track.id);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-wk-border px-3 py-2 text-left text-[12px] hover:bg-wk-brand-soft transition-colors"
                >
                  <div>
                    <p className="font-semibold text-wk-text">{track.title}</p>
                    <p className="text-[11px] text-wk-text-muted">{track.artistNames.join(", ")}</p>
                  </div>
                  <span className="font-mono text-[9px] text-wk-text-faint">{track.id}</span>
                </button>
              ))}
            </div>
          )}
          {searchQuery.length >= 2 && searchResults.length === 0 && (
            <p className="text-[11px] text-wk-text-muted px-1">No registry matches found for "{searchQuery}"</p>
          )}
        </div>
      )}

      {/* Optional note */}
      <div>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note (optional)…"
          className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-1.5 text-[11px] text-wk-text placeholder:text-wk-text-faint outline-none focus:border-wk-border-strong"
        />
      </div>
    </div>
  );
}

interface ActionBtnProps {
  icon: string;
  label: string;
  onClick: () => void;
  variant?: "success" | "warning" | "danger" | "info" | "brand";
  disabled?: boolean;
  active?: boolean;
  title?: string;
}

function ActionBtn({ icon, label, onClick, variant = "brand", disabled, active, title }: ActionBtnProps) {
  const variantStyles: Record<string, string> = {
    success: "hover:bg-wk-success-soft hover:text-wk-success",
    warning: "hover:bg-wk-warning-soft hover:text-wk-warning",
    danger: "hover:bg-wk-danger-soft hover:text-wk-danger",
    info: "hover:bg-wk-info-soft hover:text-wk-info",
    brand: "hover:bg-wk-brand-soft hover:text-wk-brand",
  };
  const activeStyles: Record<string, string> = {
    success: "bg-wk-success-soft text-wk-success",
    warning: "bg-wk-warning-soft text-wk-warning",
    danger: "bg-wk-danger-soft text-wk-danger",
    info: "bg-wk-info-soft text-wk-info",
    brand: "bg-wk-brand-soft text-wk-brand",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-[10px] font-semibold text-wk-text-muted transition-colors ${
        active ? (activeStyles[variant] + " border-current/30") : "border-wk-border " + variantStyles[variant]
      } disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap`}
    >
      <i className={`${icon} text-[14px]`} />
      <span className="leading-tight text-center">{label}</span>
    </button>
  );
}

// ─── Row Table Row ───
interface RowTableRowProps {
  row: IngestResolvedRow;
  expanded: boolean;
  onToggle: () => void;
  onDecisionApplied?: (rowId: string, newRow: Partial<IngestResolvedRow>) => void;
}

export function RowTableRow({ row: initialRow, expanded, onToggle, onDecisionApplied }: RowTableRowProps) {
  const [row, setRow] = useState(initialRow);
  const [showDecision, setShowDecision] = useState(false);

  const handleDecisionApplied = (result: ReturnType<typeof applyMatchDecision>) => {
    const updated: IngestResolvedRow = {
      ...row,
      matchStatus: result.newStatus,
      confidence: result.confidence,
      canonicalTrackId: result.canonicalTrackId,
      releaseShellId: result.releaseShellId,
    };
    setRow(updated);
    setShowDecision(false);
    onDecisionApplied?.(row.id, { matchStatus: result.newStatus, confidence: result.confidence });
  };

  return (
    <>
      <tr
        className="border-b border-wk-divider/50 transition-colors hover:bg-wk-bg-subtle/50 cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-4 py-3 font-bold text-wk-text">{row.rank}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {row.artworkUrl ? (
              <img src={row.artworkUrl} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-wk-border text-wk-text-faint">
                <Plus size={12} />
              </div>
            )}
            <div>
              <p className="font-semibold text-wk-text">{row.title}</p>
              <p className="text-[11px] text-wk-text-muted">{row.artistNames.join(", ")}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <MatchBadge status={row.matchStatus} />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-12 rounded-full bg-wk-surface-raised overflow-hidden">
              <div
                className={`h-full rounded-full ${row.confidence >= 90 ? "bg-wk-success" : row.confidence >= 70 ? "bg-wk-warning" : row.confidence >= 40 ? "bg-wk-danger" : "bg-wk-border"}`}
                style={{ width: `${Math.max(row.confidence, 2)}%` }}
              />
            </div>
            <span className="text-[12px] font-semibold text-wk-text-soft">{row.confidence}%</span>
          </div>
        </td>
        <td className="px-4 py-3">
          {row.warnings && row.warnings.length > 0 ? (
            <span className="text-[11px] text-wk-warning" title={row.warnings.join("; ")}>
              <AlertTriangle size={11} className="mr-1 inline" />
              {row.warnings.length}
            </span>
          ) : (
            <span className="text-[11px] text-wk-success">
              <Check size={11} className="mr-1 inline" />OK
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          <button
            onClick={(e) => { e.stopPropagation(); setShowDecision(!showDecision); }}
            className={`rounded px-2 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
              showDecision ? "bg-wk-brand text-wk-brand-on" : "text-wk-brand hover:bg-wk-brand-soft"
            }`}
            title="Open match decision panel"
          >
            <i className={`${showDecision ? "ri-close-line" : "ri-git-branch-line"} mr-0.5`} />
            {showDecision ? "Close" : "Decide"}
          </button>
        </td>
        <td className="px-4 py-3 text-right">
          {expanded ? <ChevronUp size={14} className="text-wk-text-faint" /> : <ChevronDown size={14} className="text-wk-text-faint" />}
        </td>
      </tr>

      {/* Match Decision Panel */}
      {showDecision && (
        <tr>
          <td colSpan={7} className="px-4 py-2 bg-wk-surface-raised/50 border-b border-wk-border/50">
            <MatchDecisionPanel
              row={row}
              onApply={handleDecisionApplied}
              onClose={() => setShowDecision(false)}
            />
          </td>
        </tr>
      )}

      {/* Expanded detail row */}
      {expanded && (
        <tr>
          <td colSpan={7} className="px-4 py-3 bg-wk-bg border-b border-wk-border/50">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-[12px]">
              <div>
                <span className="text-wk-text-muted">Provider:</span>{" "}
                <span className="font-semibold text-wk-text-soft capitalize">{row.sourceProvider.replace("_", " ")}</span>
              </div>
              <div>
                <span className="text-wk-text-muted">Canonical Track:</span>{" "}
                <span className="font-mono text-[11px] text-wk-text-soft">{row.canonicalTrackId || "—"}</span>
              </div>
              <div>
                <span className="text-wk-text-muted">Release Shell:</span>{" "}
                <span className="font-mono text-[11px] text-wk-text-soft">{row.releaseShellId || "—"}</span>
              </div>
              {row.warnings && row.warnings.length > 0 && (
                <div className="sm:col-span-3 space-y-1">
                  {row.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-1.5 rounded bg-wk-warning-soft px-2 py-1 text-[11px] text-wk-warning">
                      <AlertTriangle size={10} className="shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Enrichment data if available */}
              {row.raw && (row.raw as Record<string, unknown>).enriched && (
                <div className="sm:col-span-3">
                  <p className="text-wk-text-muted mb-1">Enrichment Data:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(() => {
                      const e = (row.raw as Record<string, unknown>).enriched as Record<string, unknown>;
                      return [
                        e?.isrc && <span key="isrc" className="rounded bg-wk-surface-raised px-1.5 py-0.5 text-[10px] font-mono text-wk-text-muted">ISRC: {String(e.isrc)}</span>,
                        e?.label && <span key="label" className="rounded bg-wk-surface-raised px-1.5 py-0.5 text-[10px] text-wk-text-muted">Label: {String(e.label)}</span>,
                        e?.popularity && <span key="popularity" className="rounded bg-wk-surface-raised px-1.5 py-0.5 text-[10px] text-wk-text-muted">Popularity: {String(e.popularity)}</span>,
                        e?.youtubeVideoId && (
                          <a
                            key="yt"
                            href={`https://www.youtube.com/watch?v=${e.youtubeVideoId}`}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="rounded bg-wk-danger-soft px-1.5 py-0.5 text-[10px] text-wk-danger hover:underline"
                            onClick={(ev) => ev.stopPropagation()}
                          >
                            <i className="ri-youtube-fill mr-0.5" />YouTube
                          </a>
                        ),
                        ...(Array.isArray((e?.sources)) ? [(
                          <span key="sources" className="rounded bg-wk-success-soft px-1.5 py-0.5 text-[10px] text-wk-success">
                            <i className="ri-sparkling-line mr-0.5" />via: {(e.sources as string[]).join(", ")}
                          </span>
                        )] : []),
                      ].filter(Boolean);
                    })()}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}