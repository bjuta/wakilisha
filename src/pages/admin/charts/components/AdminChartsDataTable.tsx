import type { ReactNode } from "react";
import { WkSurface } from "@/components/design-system/primitives/Surface";

interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface AdminChartsDataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  keyExtractor: (row: T) => string;
  emptyState?: ReactNode;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
}

export function AdminChartsDataTable<T>({
  columns,
  rows,
  keyExtractor,
  emptyState,
  onRowClick,
  rowClassName,
}: AdminChartsDataTableProps<T>) {
  return (
    <WkSurface className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-wk-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-wk-text-muted ${col.width ? "" : ""}`}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={keyExtractor(row)}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-wk-border/50 transition-colors ${
                  onRowClick ? "cursor-pointer hover:bg-wk-surface-raised/50" : "hover:bg-wk-surface-raised/50"
                } ${rowClassName?.(row) ?? ""}`}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 ${col.className ?? ""}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && emptyState && (
        <div className="px-4 py-12">{emptyState}</div>
      )}
    </WkSurface>
  );
}