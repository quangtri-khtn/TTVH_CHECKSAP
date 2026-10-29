'use client';

// Thanh hiển thị phạm vi kỳ đo luồng trả, 4 thẻ KPI tổng quan dùng Card + STATUS_TONE_TEXT,
// trạng thái lọc hiện tại và cảnh báo lỗi tiếng Việt.
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clock,
  FileWarning,
  Loader2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { STATUS_TONE_CLASS, STATUS_TONE_TEXT, type StatusTone } from '@/lib/admin/status-tone';
import type { ReturnMonitorSummaryDto } from '@/lib/api/generated/model';
import {
  formatReturnGeneratedTime,
  formatReturnScopeLine,
  formatSapCell,
  getReturnMonitorErrorMessage,
} from '@/lib/sap-monitor/return-monitor-domain';
import { getReturnKpiQueryKeys } from '@/lib/sap-monitor/sap-query-tag-map';
import { cn } from '@/lib/utils';
import { SapQueryTagBar } from './sap-query-tag-bar';
export interface ReturnMonitorStatusBarProps {
  dateFrom: string;
  brand: string;
  summary: ReturnMonitorSummaryDto | undefined;
  generatedAt: string | undefined;
  drilldownTitle: string | null;
  onClearFilter: () => void;
  isLoading: boolean;
  isFetching?: boolean;
  error: unknown;
}

export function ReturnMonitorStatusBar({
  dateFrom,
  brand,
  summary,
  generatedAt,
  drilldownTitle,
  onClearFilter,
  isLoading,
  isFetching = false,
  error,
}: ReturnMonitorStatusBarProps) {
  const isBusy = isLoading || isFetching;
  const updatedTime = formatReturnGeneratedTime(generatedAt);
  const problems = summary?.problems ?? 0;
  const arNoInvCount = summary?.arNoInvCount ?? 0;

  const TONE_TOP_BAR: Record<StatusTone, string> = {
    danger: 'bg-status-danger',
    warning: 'bg-status-warning',
    success: 'bg-status-success',
    info: 'bg-status-info',
    neutral: 'bg-status-neutral/50',
  };

  const kpiCards: readonly {
    label: string;
    value: number;
    sub: string;
    tone: StatusTone;
    icon: LucideIcon;
  }[] = [
    {
      label: 'PO treo cần xử lý',
      value: problems,
      sub: 'Nhóm mới • đã đến SO ShipDate',
      tone: problems > 0 ? 'danger' : 'success',
      icon: problems > 0 ? AlertTriangle : CheckCircle2,
    },
    {
      label: 'A/R chưa xuất HĐ',
      value: arNoInvCount,
      sub: 'Chứng từ A/R (TTVH) chờ xuất hóa đơn',
      tone: arNoInvCount > 0 ? 'warning' : 'neutral',
      icon: FileWarning,
    },
    {
      label: 'Đang chờ đến SO ShipDate',
      value: summary?.waiting ?? 0,
      sub: 'Chưa tới ngày xuất (Bình thường)',
      tone: 'info',
      icon: Clock,
    },
    {
      label: 'Tồn nhóm cũ (Trước kỳ)',
      value: summary?.backlog ?? 0,
      sub: 'Không tính vào số treo kỳ này',
      tone: 'neutral',
      icon: Archive,
    },
  ];
  return (
    <div className="flex flex-col gap-2.5">
      {Boolean(error) && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Không thể tải dữ liệu Monitor Luồng Trả</AlertTitle>
          <AlertDescription>{getReturnMonitorErrorMessage(error)}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3.5 py-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          {isBusy && <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />}
          <span>{formatReturnScopeLine(dateFrom, brand)}</span>
        </div>

        <div className="flex items-center gap-2">
          {updatedTime && (
            <Badge variant="outline" className="font-mono text-[11px] tabular-nums">
              Cập nhật: {updatedTime}
            </Badge>
          )}
          {drilldownTitle !== null && (
            <>
              <Badge variant="secondary" className="font-medium">
                Đang lọc: {drilldownTitle}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={onClearFilter}
                className="gap-1 text-xs"
              >
                <X className="size-3" />
                Xóa lọc
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        {kpiCards.map(({ label, value, sub, tone, icon: Icon }, cardIdx) => (
          <Card
            key={label}
            size="sm"
            className="group relative overflow-hidden border border-border/80 bg-card shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className={cn('h-0.5 w-full', TONE_TOP_BAR[tone])} />
            <CardContent className="flex flex-col gap-1.5 pt-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground">{label}</span>
                <span
                  className={cn(
                    'inline-flex size-7 shrink-0 items-center justify-center rounded-lg border transition-transform duration-200 group-hover:scale-105',
                    STATUS_TONE_CLASS[tone],
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
              </div>
              <span
                className={cn(
                  'font-heading text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums',
                  value > 0 || tone === 'success' ? STATUS_TONE_TEXT[tone] : 'text-foreground',
                )}
              >
                {summary ? formatSapCell(value) : isBusy ? '...' : '0'}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">{sub}</span>
              <SapQueryTagBar
                queryKeys={getReturnKpiQueryKeys(cardIdx)}
                className="pt-1"
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
