'use client';

// Panel bọc lưới dữ liệu gồm thanh công cụ 1 hàng ngang: chọn Danh sách (Select), ô Tìm nhanh tức thì, số dòng thực tế (trừ dòng TỔNG) và nút Xuất Excel lưới.
import { useEffect, useMemo, useState } from 'react';
import { Download, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import { STATUS_TONE_CLASS } from '@/lib/admin/status-tone';
import type { SalesMonitorListsDto } from '@/lib/api/generated/model';
import {
  type CohortFilter,
  MONITOR_VIEW_OPTIONS,
  type SalesViewKey,
  type SapCellValue,
  formatSapCell,
  getViewRowCount,
} from '@/lib/sap-monitor/sales-monitor-domain';
import { cn } from '@/lib/utils';
import { SapDataGrid } from './sap-data-grid';

export interface SalesMonitorListPanelProps {
  lists: SalesMonitorListsDto | undefined;
  selectedViewKey: SalesViewKey;
  onSelectView: (viewKey: SalesViewKey) => void;
  selectedCohort: CohortFilter;
  columns: readonly string[];
  rows: readonly (readonly SapCellValue[])[];
  isLoading: boolean;
  isGridExporting: boolean;
  onExportGrid: () => void;
}

export function SalesMonitorListPanel({
  lists,
  selectedViewKey,
  onSelectView,
  selectedCohort,
  columns,
  rows,
  isLoading,
  isGridExporting,
  onExportGrid,
}: SalesMonitorListPanelProps) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    setSearch('');
  }, [selectedViewKey, selectedCohort, columns]);

  const selectedViewOption =
    MONITOR_VIEW_OPTIONS.find((opt) => opt.key === selectedViewKey) ?? MONITOR_VIEW_OPTIONS[0];
  const selectedViewCount = getViewRowCount(lists, selectedViewKey, selectedCohort);

  const filteredRows = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter(
      (row) =>
        row[0] === 'TỔNG' ||
        row.some(
          (cell, idx) =>
            cell !== null &&
            cell !== undefined &&
            (String(cell).toLowerCase().includes(kw) ||
              formatSapCell(cell, columns[idx]).toLowerCase().includes(kw)),
        ),
    );
  }, [columns, rows, search]);

  const displayRowCount = useMemo(() => {
    if (filteredRows.length === 0) return 0;
    const lastRow = filteredRows[filteredRows.length - 1];
    return lastRow && lastRow[0] === 'TỔNG' ? filteredRows.length - 1 : filteredRows.length;
  }, [filteredRows]);

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-3 shadow-xs">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2">
          <Label className="whitespace-nowrap text-xs font-medium">Danh sách:</Label>
          <Select
            value={selectedViewKey}
            onValueChange={(val) => {
              if (val) onSelectView(val as SalesViewKey);
            }}
          >
            <SelectTrigger className="h-8 w-72 text-xs">
              <SelectValue>
                {`${selectedViewOption.label} (${selectedViewCount.toLocaleString('en-US')})`}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {MONITOR_VIEW_OPTIONS.map((option) => {
                const count = getViewRowCount(lists, option.key, selectedCohort);
                const hasAlertRows = option.isAlert && count > 0;
                return (
                  <SelectItem key={option.key} value={option.key}>
                    <div className="flex w-full items-center justify-between gap-2">
                      <span>{option.label}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          'font-mono text-[11px] tabular-nums',
                          hasAlertRows ? STATUS_TONE_CLASS.danger : 'text-muted-foreground',
                        )}
                      >
                        {count.toLocaleString('en-US')}
                      </Badge>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm nhanh Store, PO, SO, A/R..."
            aria-label="Tìm nhanh trong bảng dữ liệu SAP"
            className="h-8 pl-8 text-xs"
          />
        </div>

        {search.trim().length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setSearch('')}
            className="gap-1 text-xs"
          >
            Xóa lọc
            <X className="size-3" />
          </Button>
        )}

        <Badge variant="secondary" className="font-mono text-xs tabular-nums">
          {displayRowCount.toLocaleString('en-US')} dòng
        </Badge>

        <div className="ml-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onExportGrid}
            disabled={displayRowCount === 0 || isGridExporting}
            className="gap-1.5"
          >
            <Download className="size-3.5" />
            {isGridExporting ? 'Đang xuất...' : 'Xuất Excel'}
          </Button>
        </div>
      </div>

      <SapDataGrid columns={columns} rows={filteredRows} isLoading={isLoading} />
    </section>
  );
}
