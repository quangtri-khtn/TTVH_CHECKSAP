'use client';

// Bảng Phễu chuyển đổi 5 bước (8 cột) cho Luồng Trả kèm bộ lọc Nhóm PO toàn cục ở header.
// Bẫy lệch số 7: chỉ bước 3 (stepIndex === 2, "3. A/R → xuất hóa đơn") có thể nhấp để chuyển sang chế độ xem A/R chưa xuất HĐ.
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { STATUS_TONE_CLASS } from '@/lib/admin/status-tone';
import type { ReturnFunnelStepDto } from '@/lib/api/generated/model';
import {
  COHORT_OPTIONS,
  type CohortFilter,
  RET_FUNNEL_HEADERS,
  type ReturnViewMode,
  formatSapCell,
} from '@/lib/sap-monitor/return-monitor-domain';
import { cn } from '@/lib/utils';

export interface ReturnConversionFunnelTableProps {
  funnel: readonly ReturnFunnelStepDto[] | undefined;
  viewMode: ReturnViewMode;
  onSelectFunnelStep: (stepIndex: number) => void;
  selectedCohort: CohortFilter;
  onCohortChange: (cohort: CohortFilter) => void;
}

export function ReturnConversionFunnelTable({
  funnel,
  viewMode,
  onSelectFunnelStep,
  selectedCohort,
  onCohortChange,
}: ReturnConversionFunnelTableProps) {
  const steps = funnel ?? [];

  return (
    <section className="flex flex-col gap-2.5 rounded-lg border bg-card p-3 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold text-foreground">
          Phễu chuyển đổi từng bước (nhấp bước 3 để xem danh sách A/R chưa xuất hóa đơn)
        </h2>

        <div className="flex items-center gap-2">
          <Label className="whitespace-nowrap text-xs font-medium text-muted-foreground">
            Nhóm PO:
          </Label>
          <Tabs
            value={selectedCohort}
            onValueChange={(val) => {
              if (val) onCohortChange(val as CohortFilter);
            }}
          >
            <TabsList>
              {COHORT_OPTIONS.map((cohort) => (
                <TabsTrigger key={cohort.value} value={cohort.value} className="px-2.5 text-xs">
                  {cohort.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border">
        <Table className="text-xs">
          <TableHeader className="bg-muted/60">
            <TableRow className="hover:bg-muted/60">
              {RET_FUNNEL_HEADERS.map((header, idx) => (
                <TableHead
                  key={header}
                  className={cn(
                    'h-9 border-r px-3 py-2 text-xs font-semibold text-foreground last:border-r-0',
                    idx === 0 && 'text-left',
                    idx === 1 && 'w-20 text-center',
                    idx >= 2 && 'text-right',
                  )}
                >
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {steps.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={RET_FUNNEL_HEADERS.length}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  Chưa có dữ liệu phễu chuyển đổi.
                </TableCell>
              </TableRow>
            ) : (
              steps.map((step, idx) => {
                const isClickable = idx === 2;
                const isSelected = isClickable && viewMode === 'ar_noinv';
                const numericRate = Number.parseFloat(step.rate);
                const hasRate = Number.isFinite(numericRate);
                const clampedRate = hasRate ? Math.max(0, Math.min(100, numericRate)) : 0;
                const barColor =
                  clampedRate >= 100
                    ? 'bg-status-success'
                    : clampedRate >= 50
                      ? 'bg-status-info'
                      : clampedRate > 0
                        ? 'bg-status-warning'
                        : 'bg-muted-foreground/30';

                return (
                  <TableRow
                    key={`${step.step}-${idx}`}
                    data-state={isSelected ? 'selected' : undefined}
                    role={isClickable ? 'button' : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    onClick={isClickable ? () => onSelectFunnelStep(idx) : undefined}
                    onKeyDown={
                      isClickable
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onSelectFunnelStep(idx);
                            }
                          }
                        : undefined
                    }
                    aria-label={
                      isClickable
                        ? 'Xem danh sách A/R chưa xuất hóa đơn'
                        : undefined
                    }
                    className={cn(
                      'align-top transition-colors',
                      isClickable
                        ? 'cursor-pointer hover:bg-muted/60'
                        : 'cursor-default hover:bg-transparent',
                      isSelected && 'bg-primary/8 hover:bg-primary/12',
                    )}
                  >
                    <TableCell className="border-r px-3 py-2.5 align-top whitespace-pre-line leading-relaxed">
                      {step.label}
                    </TableCell>
                    <TableCell className="border-r px-3 py-2.5 align-top text-center">
                      <Badge variant="outline" className="font-mono text-[11px]">
                        {step.unit}
                      </Badge>
                    </TableCell>
                    <TableCell className="border-r px-3 py-2.5 align-top text-right font-mono tabular-nums">
                      {formatSapCell(step.vin)}
                    </TableCell>
                    <TableCell className="border-r px-3 py-2.5 align-top text-right tabular-nums">
                      {step.okText || formatSapCell(step.ok)}
                    </TableCell>
                    <TableCell className="border-r px-3 py-2.5 align-top text-right font-medium tabular-nums">
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-mono font-semibold">{step.rate}</span>
                        {hasRate && (
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-500 ease-out',
                                barColor,
                              )}
                              style={{ width: `${clampedRate}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="border-r px-3 py-2.5 align-top text-right font-mono tabular-nums">
                      {formatSapCell(step.notOk)}
                    </TableCell>
                    <TableCell className="border-r px-3 py-2.5 align-top text-right tabular-nums">
                      {step.wait > 0 ? (
                        <Badge
                          variant="outline"
                          className={cn('font-mono tabular-nums', STATUS_TONE_CLASS.info)}
                        >
                          {formatSapCell(step.wait)}
                        </Badge>
                      ) : (
                        <span className="font-mono text-muted-foreground">{formatSapCell(step.wait)}</span>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 align-top text-right tabular-nums">
                      {step.act > 0 ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            'font-mono font-semibold tabular-nums',
                            STATUS_TONE_CLASS.danger,
                          )}
                        >
                          {formatSapCell(step.act)}
                        </Badge>
                      ) : (
                        <span className="font-mono text-muted-foreground">{formatSapCell(step.act)}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
