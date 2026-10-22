'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import type { Table } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTableFacetedFilter, type FacetedFilterOption } from './faceted-filter';
import { DataTableViewOptions } from './view-options';

export interface ToolbarFilter {
  columnId: string;
  title: string;
  options: FacetedFilterOption[];
}

export function DataTableToolbar<TData>({
  table,
  searchPlaceholder = 'Tìm kiếm...',
  searchKey,
  filters = [],
  actions,
}: {
  table: Table<TData>;
  searchPlaceholder?: string;
  /** Cột dùng cho ô tìm kiếm. Bỏ trống thì tìm trên toàn bảng (global filter). */
  searchKey?: string;
  filters?: ToolbarFilter[];
  /** Nút hành động chính của trang, vd "Thêm mới". */
  actions?: ReactNode;
}) {
  const searchColumn = searchKey ? table.getColumn(searchKey) : undefined;
  const searchValue = searchKey
    ? ((searchColumn?.getFilterValue() as string) ?? '')
    : (table.getState().globalFilter ?? '');

  const setSearchValue = (value: string) => {
    if (searchKey) {
      searchColumn?.setFilterValue(value || undefined);
    } else {
      table.setGlobalFilter(value || undefined);
    }
  };

  // Dựa vào `searchValue` chứ không đọc lại `getState().globalFilter`: khi ô
  // tìm kiếm gắn với một cột cụ thể (searchKey), giá trị nằm ở column filter
  // nên global filter luôn rỗng và nút đặt lại sẽ không bao giờ hiện.
  const isFiltered = table.getState().columnFilters.length > 0 || searchValue.length > 0;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          className="h-8 w-full sm:w-56 lg:w-64"
        />
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => {
            const column = table.getColumn(filter.columnId);
            if (!column) return null;
            return (
              <DataTableFacetedFilter
                key={filter.columnId}
                column={column}
                title={filter.title}
                options={filter.options}
              />
            );
          })}
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 lg:px-3"
              onClick={() => {
                table.resetColumnFilters();
                table.setGlobalFilter(undefined);
              }}
            >
              Đặt lại
              <X className="ms-2 size-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <DataTableViewOptions table={table} />
        {actions}
      </div>
    </div>
  );
}
