import type { ReactNode } from "react";

export interface AdminTableColumn<T> {
  key: keyof T | string;
  label: string;
  render?: (row: T) => ReactNode;
  width?: string;
}

interface AdminTableProps<T> {
  columns: AdminTableColumn<T>[];
  rows: T[];
  keyField: keyof T;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export function AdminTable<T extends Record<string, unknown>>({
  columns,
  rows,
  keyField,
  emptyMessage = "No data available.",
  onRowClick,
}: AdminTableProps<T>) {
  return (
    <div className="wk-panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--wk-border)]">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]"
                  style={{ width: col.width }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-[13px] text-[var(--wk-text-muted)]"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={String(row[keyField])}
                  onClick={() => onRowClick?.(row)}
                  className={`border-b border-[var(--wk-divider)] transition-colors ${
                    onRowClick ? "cursor-pointer hover:bg-[var(--wk-surface-raised)]" : ""
                  } ${i === rows.length - 1 ? "border-b-0" : ""}`}
                >
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className="px-4 py-3 text-[13px] text-[var(--wk-text-soft)]"
                    >
                      {col.render
                        ? col.render(row)
                        : String(row[col.key as keyof T] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}