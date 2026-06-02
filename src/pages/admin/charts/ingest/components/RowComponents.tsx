import type { IngestResolvedRow } from "@/services/chartsIngestion/ingestStudioTypes";

function MatchBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    canonical: "bg-green-100 text-green-700 border-green-200",
    shell: "bg-amber-100 text-amber-700 border-amber-200",
    no_match: "bg-red-100 text-red-700 border-red-200",
    needs_review: "bg-primary-100 text-primary-700 border-primary-200",
    duplicate_candidate: "bg-purple-100 text-purple-700 border-purple-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${styles[status] || "bg-background-100 text-foreground-500 border-background-200"}`}>
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
  const movementIcon = movement === "up" ? "ri-arrow-up-line" : movement === "down" ? "ri-arrow-down-line" : movement === "new" ? "ri-add-line" : "ri-subtract-line";
  const movementColor = movement === "up" ? "text-green-600" : movement === "down" ? "text-red-600" : movement === "new" ? "text-primary-600" : "text-foreground-400";

  return (
    <div className={`flex items-center gap-3 rounded-lg p-2 transition-colors ${index % 2 === 0 ? "bg-background-50" : "bg-transparent"} hover:bg-background-100`}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background-100 text-[12px] font-bold text-foreground-700">
        {row.rank}
      </span>
      {row.artworkUrl ? (
        <img src={row.artworkUrl} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-background-200 text-foreground-400">
          <i className="ri-music-line" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-foreground-950">{row.title}</p>
        <p className="truncate text-[11px] text-foreground-500">{row.artistNames.join(", ")}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-[12px] font-bold ${movementColor}`}>
          <i className={movementIcon} />
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
      <tr className="border-b border-background-200/50 transition-colors hover:bg-background-100/50 cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-3 font-bold text-foreground-950">{row.rank}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {row.artworkUrl ? (
              <img src={row.artworkUrl} alt="" className="h-8 w-8 rounded object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded bg-background-200 text-foreground-400">
                <i className="ri-music-line text-[12px]" />
              </div>
            )}
            <span className="font-semibold text-foreground-950">{row.title}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-foreground-600">{row.artistNames.join(", ")}</td>
        <td className="px-4 py-3">
          <MatchBadge status={row.matchStatus} />
        </td>
        <td className="px-4 py-3 text-foreground-600">{row.confidence}%</td>
        <td className="px-4 py-3">
          {row.warnings && row.warnings.length > 0 ? (
            <span className="text-[11px] text-amber-600" title={row.warnings.join("; ")}>
              <i className="ri-alert-line mr-1" />
              {row.warnings.length}
            </span>
          ) : (
            <span className="text-[11px] text-green-600">
              <i className="ri-check-line mr-1" />OK
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <i className={expanded ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} />
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="px-4 py-3 bg-background-50">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-[12px]">
              <div>
                <span className="text-foreground-500">Provider:</span>{" "}
                <span className="font-semibold text-foreground-700">{row.sourceProvider}</span>
              </div>
              <div>
                <span className="text-foreground-500">Canonical Track:</span>{" "}
                <span className="font-semibold text-foreground-700">{row.canonicalTrackId || "—"}</span>
              </div>
              <div>
                <span className="text-foreground-500">Release Shell:</span>{" "}
                <span className="font-semibold text-foreground-700">{row.releaseShellId || "—"}</span>
              </div>
              {row.warnings && row.warnings.length > 0 && (
                <div className="sm:col-span-3">
                  <span className="text-foreground-500">Warnings:</span>{" "}
                  <span className="text-amber-700">{row.warnings.join("; ")}</span>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}