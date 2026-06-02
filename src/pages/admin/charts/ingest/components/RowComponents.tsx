import { Plus, ArrowUp, ArrowDown, Minus, AlertTriangle, Check, ChevronUp, ChevronDown } from "lucide-react";
import type { IngestResolvedRow } from "@/services/chartsIngestion/ingestStudioTypes";

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

interface RowTableRowProps {
  row: IngestResolvedRow;
  expanded: boolean;
  onToggle: () => void;
}

export function RowTableRow({ row, expanded, onToggle }: RowTableRowProps) {
  return (
    <>
      <tr className="border-b border-wk-divider/50 transition-colors hover:bg-wk-bg-subtle/50 cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-3 font-bold text-wk-text">{row.rank}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {row.artworkUrl ? (
              <img src={row.artworkUrl} alt="" className="h-8 w-8 rounded object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded bg-wk-border text-wk-text-faint">
                <Plus size={12} />
              </div>
            )}
            <span className="font-semibold text-wk-text">{row.title}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-wk-text-soft">{row.artistNames.join(", ")}</td>
        <td className="px-4 py-3">
          <MatchBadge status={row.matchStatus} />
        </td>
        <td className="px-4 py-3 text-wk-text-soft">{row.confidence}%</td>
        <td className="px-4 py-3">
          {row.warnings && row.warnings.length > 0 ? (
            <span className="text-[11px] text-wk-warning" title={row.warnings.join("; ")}>
              <AlertTriangle size={12} className="mr-1 inline" />
              {row.warnings.length}
            </span>
          ) : (
            <span className="text-[11px] text-wk-success">
              <Check size={12} className="mr-1 inline" />OK
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="px-4 py-3 bg-wk-bg">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-[12px]">
              <div>
                <span className="text-wk-text-muted">Provider:</span>{" "}
                <span className="font-semibold text-wk-text-soft">{row.sourceProvider}</span>
              </div>
              <div>
                <span className="text-wk-text-muted">Canonical Track:</span>{" "}
                <span className="font-semibold text-wk-text-soft">{row.canonicalTrackId || "—"}</span>
              </div>
              <div>
                <span className="text-wk-text-muted">Release Shell:</span>{" "}
                <span className="font-semibold text-wk-text-soft">{row.releaseShellId || "—"}</span>
              </div>
              {row.warnings && row.warnings.length > 0 && (
                <div className="sm:col-span-3">
                  <span className="text-wk-text-muted">Warnings:</span>{" "}
                  <span className="text-wk-warning">{row.warnings.join("; ")}</span>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}