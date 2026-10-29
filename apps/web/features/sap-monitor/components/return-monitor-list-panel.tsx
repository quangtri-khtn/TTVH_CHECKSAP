'use client';

// Panel bọc lưới dữ liệu Luồng Trả gồm thanh công cụ 1 hàng ngang:
// chọn chế độ xem (Danh sách PO trả hàng / A/R chưa xuất hóa đơn), ô Tìm nhanh tức thì, badge số dòng và nút Xuất Excel.
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
import type { ReturnMonitorListsDto } from '@/lib/api/generated/model';
import {
  type CohortFilter,
  RETURN_VIEW_OPTIONS,
  type ReturnViewMode,
  type SapCellValue,
  formatSapCell,
  getReturnViewRowCount,
} from '@/lib/sap-monitor/return-monitor-domain';
import { getReturnListViewQueryKeys } from '@/lib/sap-monitor/sap-query-tag-map';
import { cn } from '@/lib/utils';
import { SapDataGrid } from './sap-data-grid';
import { SapQueryTagBar } from './sap-query-tag-bar';
export interface ReturnMonitorListPanelProps {
  lists: ReturnMonitorListsDto | undefined;
  viewMode: ReturnViewMode;
  onSelectViewMode: (viewMode: ReturnViewMode) => void;
  selectedCohort: CohortFilter;
  title: string;
  columns: readonly string[];
  rows: readonly (readonly SapCellValue[])[];
  isLoading: boolean;
  isGridExporting: boolean;
  onExportGrid: () => void;
}

export function ReturnMonitorListPanel({
  lists,
  viewMode,
  onSelectViewMode,
  selectedCohort,
  title,
  columns,
  rows,
  isLoading,
  isGridExporting,
  onExportGrid,
}: ReturnMonitorListPanelProps) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    setSearch('');
  }, [viewMode, selectedCohort, columns]);

  const selectedViewOption =
    RETURN_VIEW_OPTIONS.find((opt) => opt.key === viewMode) ?? RETURN_VIEW_OPTIONS[0];
  const selectedViewCount = getReturnViewRowCount(lists, viewMode, selectedCohort);

  const filteredRows = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter((row) =>
      row.some(
        (cell, idx) =>
          cell !== null &&
          cell !== undefined &&
          (String(cell).toLowerCase().includes(kw) ||
            formatSapCell(cell, columns[idx]).toLowerCase().includes(kw)),
      ),
    );
  }, [columns, rows, search]);

  const displayRowCount = filteredRows.length;

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-3 shadow-xs">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2">
          <Label htmlFor="return-monitor-view-select" className="whitespace-nowrap text-xs font-medium">
            Chế độ xem:
          </Label>
          <Select
            value={viewMode}
            onValueChange={(val) => {
              if (val) onSelectViewMode(val as ReturnViewMode);
            }}
          >
            <SelectTrigger
              id="return-monitor-view-select"
              aria-label="Chọn chế độ xem"
              className="h-8 w-64 text-xs"
            >
              <SelectValue>
                {`${selectedViewOption.label} (${selectedViewCount.toLocaleString('en-US')})`}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {RETURN_VIEW_OPTIONS.map((option) => {
                const count = getReturnViewRowCount(lists, option.key, selectedCohort);
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
            placeholder="Tìm nhanh Store, PO, SO, A/R, kho..."
            aria-label="Tìm nhanh trong bảng dữ liệu luồng trả SAP"
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
            Xóa tìm
            <X className="size-3" />
          </Button>
        )}

        <Badge variant="secondary" className="font-mono text-xs tabular-nums">
          {displayRowCount.toLocaleString('en-US')} dòng
        </Badge>

        <SapQueryTagBar
          label="SQL:"
          queryKeys={getReturnListViewQueryKeys(viewMode, selectedCohort)}
        />

        <span className="hidden text-xs text-muted-foreground lg:inline">{title}</span>
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
