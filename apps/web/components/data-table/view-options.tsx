'use client';

import { SlidersHorizontal } from 'lucide-react';
import type { Table } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Bật/tắt hiển thị cột. Nhãn lấy từ `meta.title` của cột — `column.id` là khoá
 * kỹ thuật (vd `isActive`) nên không dùng trực tiếp để hiện cho người dùng.
 */
export function DataTableViewOptions<TData>({ table }: { table: Table<TData> }) {
  const hideableColumns = table
    .getAllColumns()
    .filter((column) => typeof column.accessorFn !== 'undefined' && column.getCanHide());

  if (hideableColumns.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="ms-auto hidden h-8 lg:flex" />
        }
      >
        <SlidersHorizontal className="size-4" />
        Xem
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {/* Base UI bắt buộc GroupLabel nằm trong Group — đứng ngoài sẽ throw khi
            mở menu. Bọc luôn cả danh sách cột để nhãn mô tả đúng nhóm item. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>Hiện/ẩn cột</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {hideableColumns.map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={column.getIsVisible()}
              onCheckedChange={(value) => column.toggleVisibility(!!value)}
            >
              {column.columnDef.meta?.title ?? column.id}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
