'use client';

import type { ReactNode } from 'react';
import { flexRender, type Table as TanstackTable } from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Khung bảng dùng chung: header + thân + trạng thái rỗng/đang tải.
 * Toolbar và phân trang do trang gọi tự đặt quanh nó, vì mỗi trang có bộ lọc
 * và nút hành động riêng.
 */
export function DataTable<TData>({
  table,
  columnCount,
  isLoading,
  emptyState,
  onRowClick,
}: {
  table: TanstackTable<TData>;
  columnCount: number;
  isLoading?: boolean;
  emptyState?: ReactNode;
  onRowClick?: (row: TData) => void;
}) {
  const rows = table.getRowModel().rows;

  return (
    // `overflow-x-auto` giữ phần cuộn ngang nằm trong khung bảng khi có nhiều
    // cột, thay vì đẩy tràn ra toàn trang.
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="group/row">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  colSpan={header.colSpan}
                  className={cn(
                    'bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
                    header.column.columnDef.meta?.className,
                    header.column.columnDef.meta?.thClassName,
                  )}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                {Array.from({ length: columnCount }).map((__, cellIndex) => (
                  <TableCell key={cellIndex}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columnCount} className="h-24 text-center">
                {emptyState ?? 'Không có dữ liệu.'}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? 'selected' : undefined}
                className={cn('group/row', onRowClick && 'cursor-pointer')}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      'bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
                      cell.column.columnDef.meta?.className,
                      cell.column.columnDef.meta?.tdClassName,
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
