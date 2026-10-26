'use client';

import { RefreshCw, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SapBrandDto } from '@/lib/api/generated/model';
import type {
  SapStoreFilterState,
  StoreActivityFilter,
} from '@/lib/admin/sap-store-domain';

const ACTIVITY_OPTIONS: readonly { value: StoreActivityFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'active_sales', label: 'Đang bật Monitor Bán' },
  { value: 'active_return', label: 'Đang bật Monitor Trả' },
  { value: 'inactive_both', label: 'Đang tắt cả Bán & Trả' },
  { value: 'sap_inactive', label: 'Ngưng hoạt động trên SAP' },
];

interface SapStoresToolbarProps {
  brands: readonly SapBrandDto[];
  filters: SapStoreFilterState;
  filteredCount: number;
  totalCount: number;
  isSyncing: boolean;
  onChangeFilters: (next: Partial<SapStoreFilterState>) => void;
  onResetFilters: () => void;
  onOpenSyncDialog: () => void;
}

export function SapStoresToolbar({
  brands,
  filters,
  filteredCount,
  totalCount,
  isSyncing,
  onChangeFilters,
  onResetFilters,
  onOpenSyncDialog,
}: SapStoresToolbarProps) {
  const hasActiveFilter =
    filters.brandCode !== 'all' ||
    filters.activityFilter !== 'all' ||
    filters.search.trim().length > 0;

  const selectedBrandLabel =
    filters.brandCode === 'all'
      ? 'Tất cả thương hiệu'
      : (() => {
          const found = brands.find((b) => b.code === filters.brandCode);
          return found ? `${found.code} — ${found.name}` : filters.brandCode;
        })();

  const selectedActivityLabel =
    ACTIVITY_OPTIONS.find((o) => o.value === filters.activityFilter)?.label ??
    'Tất cả trạng thái';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3 shadow-xs">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={filters.search}
            onChange={(e) => onChangeFilters({ search: e.target.value })}
            placeholder="Tìm mã kho hoặc tên cửa hàng..."
            aria-label="Tìm mã kho hoặc tên cửa hàng"
            className="h-8 ps-8 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="sap-store-brand-filter" className="text-xs font-medium whitespace-nowrap">
            Brand:
          </Label>
          <Select
            value={filters.brandCode}
            onValueChange={(val) => {
              if (val) onChangeFilters({ brandCode: val });
            }}
          >
            <SelectTrigger
              id="sap-store-brand-filter"
              aria-label="Lọc theo thương hiệu"
              className="h-8 w-52 text-xs"
            >
              <SelectValue>{selectedBrandLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                Tất cả thương hiệu
              </SelectItem>
              {brands.map((b) => (
                <SelectItem key={b.code} value={b.code} className="text-xs">
                  {b.code} — {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="sap-store-status-filter" className="text-xs font-medium whitespace-nowrap">
            Trạng thái:
          </Label>
          <Select
            value={filters.activityFilter}
            onValueChange={(val) => {
              if (val) onChangeFilters({ activityFilter: val as StoreActivityFilter });
            }}
          >
            <SelectTrigger
              id="sap-store-status-filter"
              aria-label="Lọc theo trạng thái kích hoạt"
              className="h-8 w-52 text-xs"
            >
              <SelectValue>{selectedActivityLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilter && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="h-8 gap-1 text-xs"
          >
            <X className="size-3.5" />
            Xóa lọc
          </Button>
        )}

        <span className="text-xs text-muted-foreground tabular-nums">
          Hiển thị <strong>{filteredCount}</strong> / {totalCount} cửa hàng
        </span>
      </div>

      <Button
        type="button"
        size="sm"
        onClick={onOpenSyncDialog}
        disabled={isSyncing}
        className="h-8 gap-1.5 text-xs"
      >
        <RefreshCw className={`size-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
        Đồng bộ từ SAP (OWHS)
      </Button>
    </div>
  );
}
