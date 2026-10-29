'use client';

// Thanh công cụ điều khiển tham số truy vấn SAP (Từ ngày Date Picker, Brand Select 5001..5007 — tự động gọi/cache khi thay đổi), xuất Excel 11 sheet và bật/tắt bảng chứng từ treo.
import { useMemo } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, FileSpreadsheet, Settings } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  SALES_BRAND_OPTIONS,
  dateInputToSapDate,
  sapDateToDateInput,
} from '@/lib/sap-monitor/sales-monitor-domain';
import { useSapBrandsGet } from '@/lib/api/generated/sap-stores/sap-stores';
import { PERMISSIONS } from '@/lib/auth/permission-keys';
import { usePermissions } from '@/lib/auth/use-permissions';
import { cn } from '@/lib/utils';

export interface SalesMonitorToolbarProps {
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  brand: string;
  onBrandChange: (value: string) => void;
  onExportDetail: () => void;
  showDocStatus: boolean;
  onToggleDocStatus: () => void;
  isLoading: boolean;
  isDetailExporting: boolean;
}

export function SalesMonitorToolbar({
  dateFrom,
  onDateFromChange,
  brand,
  onBrandChange,
  onExportDetail,
  showDocStatus,
  onToggleDocStatus,
  isLoading,
  isDetailExporting,
}: SalesMonitorToolbarProps) {
  const brandsQuery = useSapBrandsGet();
  const { can } = usePermissions();
  const canManageSql = can(PERMISSIONS.SAP_QUERY_MANAGE);
  const brandOptions = useMemo(() => {
    const list = brandsQuery.data?.data.data;
    if (!list?.length) return SALES_BRAND_OPTIONS;
    return list.map((b) => ({
      value: b.code,
      label: `${b.code} — ${b.name}`,
    }));
  }, [brandsQuery.data]);

  const selectedBrand =
    brandOptions.find((b) => b.value === brand) ?? brandOptions[0];
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 shadow-xs">
      <div className="flex items-center gap-2">
        <Label htmlFor="sales-monitor-date-from" className="whitespace-nowrap text-xs font-medium">
          Từ ngày:
        </Label>
        <Input
          id="sales-monitor-date-from"
          type="date"
          value={sapDateToDateInput(dateFrom)}
          onChange={(e) => {
            const nextSap = dateInputToSapDate(e.target.value);
            if (nextSap) onDateFromChange(nextSap);
          }}
          className="h-8 w-36 font-mono text-xs"
        />
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="sales-monitor-brand" className="whitespace-nowrap text-xs font-medium">
          Brand:
        </Label>
        <Select value={brand} onValueChange={(val) => val && onBrandChange(val)}>
          <SelectTrigger id="sales-monitor-brand" className="h-8 w-56 text-xs">
            <SelectValue>{selectedBrand.label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {brandOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onExportDetail}
        disabled={isLoading || isDetailExporting}
        className="gap-1.5"
      >
        <FileSpreadsheet className="size-3.5 text-emerald-700 dark:text-emerald-400" />
        {isDetailExporting ? 'Đang xuất Excel...' : 'Xuất file chi tiết (Excel)'}
      </Button>

      <div className="ml-auto flex items-center gap-2">
        {canManageSql && (
          <Link
            href="/admin/sap-queries?flow=ban"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
          >
            <Settings className="size-3.5" />
            ⚙ Quản lý SQL
          </Link>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onToggleDocStatus}
          className="gap-1.5"
        >
          {showDocStatus ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          {showDocStatus ? 'Ẩn bảng chứng từ treo' : 'Hiện bảng chứng từ treo'}
        </Button>
      </div>
    </div>
  );
}
