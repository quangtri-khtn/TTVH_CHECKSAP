'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { Table } from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Thanh nổi hiện khi có hàng được chọn. Nút hành động do nơi gọi truyền vào qua
 * `children`, nên mỗi bảng tự quyết định làm được gì với lô đã chọn.
 *
 * Điều hướng bàn phím: mũi tên trái/phải chuyển giữa các nút, Home/End nhảy về
 * hai đầu, Escape bỏ chọn.
 */
export function DataTableBulkActions<TData>({
  table,
  entityName,
  children,
}: {
  table: Table<TData>;
  /** Danh từ tiếng Việt, vd "người dùng" — dùng cho nhãn và thông báo màn hình. */
  entityName: string;
  children: ReactNode;
}) {
  const selectedCount = table.getFilteredSelectedRowModel().rows.length;
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (selectedCount === 0) return;
    // queueMicrotask hoãn cập nhật state để không gây render lồng nhau ngay
    // trong lượt render đang chạy.
    queueMicrotask(() => {
      setAnnouncement(`Đã chọn ${selectedCount} ${entityName}. Thanh thao tác hàng loạt đã sẵn sàng.`);
    });
    const timer = setTimeout(() => setAnnouncement(''), 3000);
    return () => clearTimeout(timer);
  }, [selectedCount, entityName]);

  const handleKeyDown = (event: KeyboardEvent) => {
    const buttons = toolbarRef.current?.querySelectorAll('button');
    if (!buttons || buttons.length === 0) return;

    const currentIndex = Array.from(buttons).findIndex((b) => b === document.activeElement);

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        buttons[(currentIndex + 1) % buttons.length]?.focus();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        buttons[currentIndex <= 0 ? buttons.length - 1 : currentIndex - 1]?.focus();
        break;
      case 'Home':
        event.preventDefault();
        buttons[0]?.focus();
        break;
      case 'End':
        event.preventDefault();
        buttons[buttons.length - 1]?.focus();
        break;
      case 'Escape': {
        // Escape bấm khi đang mở dropdown là để đóng dropdown đó, không phải
        // để bỏ chọn cả lô — dropdown đã tự đóng trước khi handler này chạy
        // nên phải nhận diện qua phần tử đang focus.
        const target = event.target as HTMLElement | null;
        const active = document.activeElement as HTMLElement | null;
        const fromDropdown =
          target?.closest('[data-slot="dropdown-menu-trigger"]') ??
          target?.closest('[data-slot="dropdown-menu-content"]') ??
          active?.closest('[data-slot="dropdown-menu-trigger"]') ??
          active?.closest('[data-slot="dropdown-menu-content"]');
        if (fromDropdown) return;

        event.preventDefault();
        table.resetRowSelection();
        break;
      }
    }
  };

  if (selectedCount === 0) return null;

  return (
    <>
      <div aria-live="polite" aria-atomic="true" role="status" className="sr-only">
        {announcement}
      </div>

      <div
        ref={toolbarRef}
        role="toolbar"
        aria-label={`Thao tác hàng loạt cho ${selectedCount} ${entityName} đã chọn`}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          'fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl',
          'transition-all delay-100 duration-300 ease-out hover:scale-105',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          'motion-reduce:transition-none motion-reduce:hover:scale-100',
        )}
      >
        <div className="flex items-center gap-x-2 rounded-xl border bg-background/95 p-2 shadow-xl backdrop-blur-lg supports-backdrop-filter:bg-background/60">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="size-6 rounded-full"
                  aria-label="Bỏ chọn tất cả"
                  onClick={() => table.resetRowSelection()}
                />
              }
            >
              <X />
            </TooltipTrigger>
            <TooltipContent>Bỏ chọn (Esc)</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5" aria-hidden />

          <div className="flex items-center gap-x-1 text-sm">
            <Badge className="min-w-8 rounded-lg">{selectedCount}</Badge>
            <span className="hidden sm:inline">{entityName}</span>
            <span>đã chọn</span>
          </div>

          <Separator orientation="vertical" className="h-5" aria-hidden />

          {children}
        </div>
      </div>
    </>
  );
}
