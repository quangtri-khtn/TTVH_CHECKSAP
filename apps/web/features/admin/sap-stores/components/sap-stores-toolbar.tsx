'use client';

import { RefreshCw, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SapBrandDto } from '@/lib/api/generated/model';
import type {
  SapBrandToggleStats,
  SapStoreFilterState,
  StoreActivityFilter,
} from '@/lib/admin/sap-store-domain';

const ACTIVITY_OPTIONS: readonly { value: StoreActivityFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang bật Query' },
  { value: 'inactive', label: 'Đang tắt Query' },
  { value: 'sap_inactive', label: 'Ngưng hoạt động trên SAP' },
];

interface SapStoresToolbarProps {
  brands: readonly SapBrandDto[];
  filters: SapStoreFilterState;
  brandToggleStats: SapBrandToggleStats | null;
  filteredCount: number;
  totalCount: number;
  isSyncing: boolean;
  isBulkUpdatingBrand: boolean;
  onChangeFilters: (next: Partial<SapStoreFilterState>) => void;
  onResetFilters: () => void;
  onToggleBrandActive: (brandCode: string, nextVal: boolean) => void;
  onOpenSyncDialog: () => void;
}

export function SapStoresToolbar({
  brands,
  filters,
  brandToggleStats,
  filteredCount,
  totalCount,
  isSyncing,
  isBulkUpdatingBrand,
  onChangeFilters,
  onResetFilters,
  onToggleBrandActive,
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
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 shadow-xs xl:flex-nowrap">
      <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
        <div className="relative w-48 lg:w-52">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={filters.search}
            onChange={(e) => onChangeFilters({ search: e.target.value })}
            placeholder="Tìm mã hoặc tên kho..."
            aria-label="Tìm mã kho hoặc tên cửa hàng"
            className="h-8 ps-8 text-xs"
          />
        </div>

        <div className="inline-flex h-8 items-center overflow-hidden rounded-lg border border-input bg-background shadow-2xs">
          <Select
            value={filters.brandCode}
            onValueChange={(val) => {
              if (val) onChangeFilters({ brandCode: val });
            }}
          >
            <SelectTrigger
              id="sap-store-brand-filter"
              aria-label="Lọc theo thương hiệu"
              className="h-8 w-40 rounded-none border-0 bg-transparent px-2.5 text-xs font-medium shadow-none focus-visible:ring-0"
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

          {brandToggleStats && (
            <div className="flex h-full items-center gap-1.5 border-l border-border/70 bg-muted/40 px-2.5">
              <Switch
                id="sap-store-brand-bulk-switch"
                size="sm"
                checked={brandToggleStats.isAllSapActiveEnabled}
                disabled={isBulkUpdatingBrand || brandToggleStats.sapActiveInBrand === 0}
                aria-label={`Đóng/mở hàng loạt theo SAP cho thương hiệu ${brandToggleStats.brandCode}`}
                onCheckedChange={(checked) =>
                  onToggleBrandActive(brandToggleStats.brandCode, checked)
                }
              />
              <Label
                htmlFor="sap-store-brand-bulk-switch"
                className="cursor-pointer text-xs font-medium whitespace-nowrap text-foreground"
              >
                Mở theo SAP
              </Label>
              <span className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground tabular-nums ring-1 ring-border/60">
                {brandToggleStats.enabledInBrand}/{brandToggleStats.sapActiveInBrand}
              </span>
            </div>
          )}
        </div>

        <Select
          value={filters.activityFilter}
          onValueChange={(val) => {
            if (val) onChangeFilters({ activityFilter: val as StoreActivityFilter });
          }}
        >
          <SelectTrigger
            id="sap-store-status-filter"
            aria-label="Lọc theo trạng thái kích hoạt"
            className="h-8 w-38 text-xs"
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

        {hasActiveFilter && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
            Xóa lọc
          </Button>
        )}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Badge
          variant="secondary"
          className="h-7 px-2 font-mono text-xs font-medium tabular-nums"
        >
          {filteredCount}/{totalCount} kho
        </Badge>

        <Button
          type="button"
          size="sm"
          onClick={onOpenSyncDialog}
          disabled={isSyncing}
          className="h-8 gap-1.5 px-3 text-xs"
        >
          <RefreshCw className={`size-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          Đồng bộ từ SAP (OWHS)
        </Button>
      </div>
    </div>
  );
}
