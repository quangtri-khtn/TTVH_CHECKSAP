'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { Table } from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getPageNumbers, PAGE_GAP } from '@/lib/data-table/get-page-numbers';

const PAGE_SIZES = [10, 20, 30, 40, 50];

export function DataTablePagination<TData>({
  table,
  className,
}: {
  table: Table<TData>;
  className?: string;
}) {
  const currentPage = table.getState().pagination.pageIndex + 1;
  const totalPages = table.getPageCount();
  const pageTokens = getPageNumbers(currentPage, totalPages);

  return (
    <div className={cn('flex flex-col-reverse items-center gap-4 px-2 sm:flex-row sm:justify-between', className)}>
      <div className="flex items-center gap-2">
        <p className="hidden text-sm text-muted-foreground sm:block">Số dòng mỗi trang</p>
        <Select
          value={`${table.getState().pagination.pageSize}`}
          onValueChange={(value) => table.setPageSize(Number(value))}
        >
          <SelectTrigger className="h-8 w-18" aria-label="Số dòng mỗi trang">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={`${size}`}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground sm:hidden">
          Trang {currentPage}/{totalPages || 1}
        </span>

        <Button
          variant="outline"
          className="hidden size-8 p-0 sm:inline-flex"
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
          aria-label="Về trang đầu"
        >
          <ChevronsLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          className="size-8 p-0"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          aria-label="Trang trước"
        >
          <ChevronLeft className="size-4" />
        </Button>

        <div className="hidden items-center gap-1 sm:flex">
          {pageTokens.map((token, index) =>
            token === PAGE_GAP ? (
              <span key={`gap-${index}`} className="px-1 text-sm text-muted-foreground">
                {PAGE_GAP}
              </span>
            ) : (
              <Button
                key={token}
                variant={currentPage === token ? 'default' : 'outline'}
                className="h-8 min-w-8 px-2"
                onClick={() => table.setPageIndex(token - 1)}
                aria-label={`Tới trang ${token}`}
                aria-current={currentPage === token ? 'page' : undefined}
              >
                {token}
              </Button>
            ),
          )}
        </div>

        <Button
          variant="outline"
          className="size-8 p-0"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          aria-label="Trang sau"
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button
          variant="outline"
          className="hidden size-8 p-0 sm:inline-flex"
          onClick={() => table.setPageIndex(totalPages - 1)}
          disabled={!table.getCanNextPage()}
          aria-label="Tới trang cuối"
        >
          <ChevronsRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
