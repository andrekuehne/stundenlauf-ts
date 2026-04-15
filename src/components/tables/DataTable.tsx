import type { ReactNode } from "react";

export interface DataTableColumn<Row> {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
  align?: "left" | "right" | "center";
  headerClassName?: string;
  cellClassName?: string;
}

interface DataTableProps<Row> {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  emptyMessage?: string;
  rowKey?: (row: Row, index: number) => string;
  className?: string;
}

function alignmentClass(align: DataTableColumn<unknown>["align"]): string {
  if (!align) {
    return "";
  }
  return `ui-table__cell--${align}`;
}

export function DataTable<Row>({ columns, rows, emptyMessage, rowKey, className }: DataTableProps<Row>) {
  const tableClassName = className ? `ui-table ${className}` : "ui-table";

  return (
    <div className="table-wrap">
      <table className={tableClassName}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={[alignmentClass(column.align), column.headerClassName].filter(Boolean).join(" ")}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row, rowIndex) => (
              <tr key={rowKey ? rowKey(row, rowIndex) : String(rowIndex)}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={[alignmentClass(column.align), column.cellClassName].filter(Boolean).join(" ")}
                    data-label={column.header}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length}>{emptyMessage ?? "Keine Daten vorhanden."}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
