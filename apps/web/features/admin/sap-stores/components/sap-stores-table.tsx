'use client';

import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { SapStoreDto } from '@/lib/api/generated/model';

interface SapStoresTableProps {
  columns: ColumnDef<SapStoreDto>[];
  data: SapStoreDto[];
  isLoading: boolean;
}

export function SapStoresTable({ columns, data, isLoading }: SapStoresTableProps) {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

  // Reset về trang 0 nếu dữ liệu lọc ít hơn vị trí trang hiện tại
  const safePagination = useMemo(() => {
    const maxPage = Math.max(0, Math.ceil(data.length / pagination.pageSize) - 1);
    return {
      ...pagination,
      pageIndex: Math.min(pagination.pageIndex, maxPage),
    };
  }, [data.length, pagination]);

  const table = useReactTable({
    data,
    columns,
    state: { pagination: safePagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  if (isLoading) {
    return (
      <div className="space-y-2 rounded-lg border bg-card p-4">
        {Array.from({ length: 6 }).map((_, idx) => (
          <Skeleton key={idx} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border bg-card shadow-2xs">
        <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id} className="px-3 py-2.5 text-xs font-semibold">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-xs text-muted-foreground"
                >
                  Không tìm thấy cửa hàng SAP nào khớp với điều kiện lọc.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/40">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-3 py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span>
          Trang <strong>{safePagination.pageIndex + 1}</strong> /{' '}
          {Math.max(1, table.getPageCount())} ({data.length} cửa hàng)
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Trang trước"
            className="h-7 px-2 text-xs"
          >
            <ChevronLeft className="size-3.5" />
            Trước
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Trang tiếp"
            className="h-7 px-2 text-xs"
          >
            Tiếp
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
