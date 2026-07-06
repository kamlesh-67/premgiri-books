import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T, idx: number) => ReactNode;
  align?: "left" | "right" | "center";
  width?: string;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  empty?: ReactNode;
  footer?: ReactNode;
  rowKey?: (row: T, idx: number) => string;
}

export function DataTable<T>({ columns, rows, empty, footer, rowKey }: DataTableProps<T>) {
  const alignClass = (a?: string) => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{ width: c.width }}
                  className={cn(
                    "whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                    alignClass(c.align)
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {empty ?? "No data to display."}
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={rowKey ? rowKey(row, idx) : idx}
                  className="border-t border-border transition-colors hover:bg-muted/40"
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "whitespace-nowrap px-4 py-3.5 text-foreground",
                        alignClass(c.align),
                        c.className
                      )}
                    >
                      {c.cell(row, idx)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {footer && (
            <tfoot className="border-t border-border bg-muted/40 text-sm font-semibold">
              {footer}
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
