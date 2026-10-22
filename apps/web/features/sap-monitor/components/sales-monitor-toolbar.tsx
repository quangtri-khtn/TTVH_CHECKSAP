'use client';

// Thanh công cụ điều khiển tham số truy vấn SAP (Từ ngày Date Picker, Brand Select 5001..5007 — tự động gọi/cache khi thay đổi), xuất Excel 11 sheet và bật/tắt bảng chứng từ treo.
import { ChevronDown, ChevronUp, FileSpreadsheet } from 'lucide-react';
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
import {
  SALES_BRAND_OPTIONS,
  dateInputToSapDate,
  sapDateToDateInput,
} from '@/lib/sap-monitor/sales-monitor-domain';

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
  const selectedBrand =
    SALES_BRAND_OPTIONS.find((b) => b.value === brand) ?? SALES_BRAND_OPTIONS[0];

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
            {SALES_BRAND_OPTIONS.map((option) => (
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

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onToggleDocStatus}
        className="ml-auto gap-1.5"
      >
        {showDocStatus ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        {showDocStatus ? 'Ẩn bảng chứng từ treo' : 'Hiện bảng chứng từ treo'}
      </Button>
    </div>
  );
}
