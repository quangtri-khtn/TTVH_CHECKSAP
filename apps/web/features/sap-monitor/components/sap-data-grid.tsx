'use client';

// Bảng lưới dữ liệu SAP với sticky header, sticky cột đầu, cố định dòng TỔNG ở chân bảng và giữ nguyên 100% raw data/columns.
import { useMemo } from 'react';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  type SapCellValue,
  formatSapCell,
  isNumericSapColumn,
} from '@/lib/sap-monitor/sales-monitor-domain';
import { cn } from '@/lib/utils';

export interface SapDataGridProps {
  columns: readonly string[];
  rows: readonly (readonly SapCellValue[])[];
  isLoading?: boolean;
}

export function SapDataGrid({ columns, rows, isLoading = false }: SapDataGridProps) {
  const numericColFlags = useMemo(
    () => columns.map((col, idx) => isNumericSapColumn(col, rows, idx)),
    [columns, rows],
  );

  if (columns.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md border bg-muted/10 text-xs text-muted-foreground">
        {isLoading ? 'Đang tải dữ liệu từ SAP...' : 'Không có dữ liệu hiển thị.'}
      </div>
    );
  }

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Bảng dữ liệu chứng từ SAP"
      className="max-h-[520px] overflow-auto rounded-md border focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden"
    >
      <table className="w-full border-collapse text-xs">
        <TableHeader className="sticky top-0 z-20 bg-muted/95 backdrop-blur-xs">
          <TableRow className="hover:bg-muted/95">
            {columns.map((col, idx) => (
              <TableHead
                key={`${col}-${idx}`}
                className={cn(
                  'h-9 border-b border-r px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-foreground last:border-r-0',
                  idx === 0 && 'sticky left-0 z-30 bg-muted/95',
                  numericColFlags[idx] ? 'text-right' : 'text-left',
                )}
              >
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="px-3 py-8 text-center text-muted-foreground"
              >
                {isLoading ? 'Đang tải dữ liệu...' : 'Không có dòng dữ liệu nào trong danh sách này.'}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, rowIdx) => {
              const isTotalRow = row[0] === 'TỔNG';
              return (
                <TableRow
                  key={rowIdx}
                  className={cn(
                    'group/row transition-colors hover:bg-muted/50',
                    isTotalRow
                      ? 'sticky bottom-0 z-20 bg-muted font-bold text-foreground'
                      : rowIdx % 2 === 1 && 'bg-muted/15',
                  )}
                >
                  {columns.map((col, colIdx) => {
                    const isNum = numericColFlags[colIdx];
                    return (
                      <TableCell
                        key={colIdx}
                        className={cn(
                          'border-r px-3 py-1.5 whitespace-nowrap last:border-r-0',
                          colIdx === 0 &&
                            (isTotalRow
                              ? 'sticky left-0 z-30 bg-muted'
                              : 'sticky left-0 z-10 bg-background font-medium group-hover/row:bg-muted'),
                          isNum ? 'text-right tabular-nums' : 'text-left',
                        )}
                      >
                        {formatSapCell(row[colIdx] ?? null, col)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </table>
    </div>
  );
}
