'use client';

// Thanh công cụ điều khiển tham số truy vấn SAP Luồng Trả (Từ ngày Date Picker, Brand Select 5001..5007),
// tải lại cưỡng bức (refresh=true), xuất Excel chi tiết 3 sheets và bật/tắt bảng trạng thái chuỗi chứng từ.
import { useMemo } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, FileSpreadsheet, RefreshCw, Settings } from 'lucide-react';
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
  RETURN_BRAND_OPTIONS,
  dateInputToSapDate,
  sapDateToDateInput,
} from '@/lib/sap-monitor/return-monitor-domain';
import { useSapBrandsGet } from '@/lib/api/generated/sap-stores/sap-stores';
import { PERMISSIONS } from '@/lib/auth/permission-keys';
import { usePermissions } from '@/lib/auth/use-permissions';
import { cn } from '@/lib/utils';

export interface ReturnMonitorToolbarProps {
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  brand: string;
  onBrandChange: (value: string) => void;
  onReload: () => void;
  onExportDetail: () => void;
  showStatusBox: boolean;
  onToggleStatusBox: () => void;
  isLoading: boolean;
  isReloading?: boolean;
  isDetailExporting: boolean;
}

export function ReturnMonitorToolbar({
  dateFrom,
  onDateFromChange,
  brand,
  onBrandChange,
  onReload,
  onExportDetail,
  showStatusBox,
  onToggleStatusBox,
  isLoading,
  isReloading = false,
  isDetailExporting,
}: ReturnMonitorToolbarProps) {
  const brandsQuery = useSapBrandsGet();
  const { can } = usePermissions();
  const canManageSql = can(PERMISSIONS.SAP_QUERY_MANAGE);
  const brandOptions = useMemo(() => {
    const list = brandsQuery.data?.data.data;
    if (!list?.length) return RETURN_BRAND_OPTIONS;
    return [
      { value: 'ALL', label: 'Tất cả thương hiệu' },
      ...list.map((b) => ({
        value: b.code,
        label: `${b.code} — ${b.name}`,
      })),
    ];
  }, [brandsQuery.data]);

  const selectedBrand =
    brandOptions.find((b) => b.value === brand) ?? brandOptions[0];
  const isBusy = isLoading || isReloading;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 shadow-xs">
      <div className="flex items-center gap-2">
        <Label htmlFor="return-monitor-date-from" className="whitespace-nowrap text-xs font-medium">
          Từ ngày:
        </Label>
        <Input
          id="return-monitor-date-from"
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
        <Label htmlFor="return-monitor-brand" className="whitespace-nowrap text-xs font-medium">
          Brand:
        </Label>
        <Select value={brand} onValueChange={(val) => val && onBrandChange(val)}>
          <SelectTrigger id="return-monitor-brand" className="h-8 w-56 text-xs">
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
        variant="default"
        size="sm"
        onClick={onReload}
        disabled={isBusy || isDetailExporting}
        title="Bỏ qua bộ đệm 60 giây và tải lại dữ liệu mới nhất từ SAP HANA theo bộ lọc hiện tại"
        className="gap-1.5 font-semibold"
      >
        <RefreshCw className={cn('size-3.5', isBusy && 'animate-spin')} />
        {isReloading ? 'Đang tải lại...' : 'Tải lại dữ liệu'}
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onExportDetail}
        disabled={isBusy || isDetailExporting}
        className="gap-1.5"
      >
        <FileSpreadsheet className="size-3.5 text-emerald-700 dark:text-emerald-400" />
        {isDetailExporting ? 'Đang xuất Excel...' : 'Xuất file chi tiết (Excel)'}
      </Button>

      <div className="ml-auto flex items-center gap-2">
        {canManageSql && (
          <Link
            href="/admin/sap-queries?flow=tra"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
          >
            <Settings className="size-3.5" />
            Quản lý SQL
          </Link>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onToggleStatusBox}
          className="gap-1.5"
        >
          {showStatusBox ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          {showStatusBox ? 'Ẩn bảng trạng thái chuỗi' : 'Hiện bảng trạng thái chuỗi'}
        </Button>
      </div>
    </div>
  );
}
