'use client';

// Thanh hiển thị phạm vi kỳ đo, 4 thẻ KPI tổng quan dùng Card + STATUS_TONE_CLASS, trạng thái drilldown và cảnh báo lỗi.
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
import type { SalesMonitorSummaryDto } from '@/lib/api/generated/model';
import {
  formatSalesGeneratedTime,
  formatSalesScopeLine,
  formatSapCell,
  getSalesMonitorErrorMessage,
} from '@/lib/sap-monitor/sales-monitor-domain';
import { cn } from '@/lib/utils';

export interface SalesMonitorStatusBarProps {
  dateFrom: string;
  brand: string;
  summary: SalesMonitorSummaryDto | undefined;
  generatedAt: string | undefined;
  drilldownTitle: string | null;
  onClearDrilldown: () => void;
  isLoading: boolean;
  isFetching?: boolean;
  error: unknown;
}

export function SalesMonitorStatusBar({
  dateFrom,
  brand,
  summary,
  generatedAt,
  drilldownTitle,
  onClearDrilldown,
  isLoading,
  isFetching = false,
  error,
}: SalesMonitorStatusBarProps) {
  const isBusy = isLoading || isFetching;
  const updatedTime = formatSalesGeneratedTime(generatedAt);
  const problems = summary?.problems ?? 0;
  const t2Due = summary?.t2Due ?? 0;

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
      label: 'Treo cần xử lý (T1 + T3 + T4)',
      value: problems,
      sub: 'Nhóm mới • đã đến ShipDate',
      tone: problems > 0 ? 'danger' : 'success',
      icon: problems > 0 ? AlertTriangle : CheckCircle2,
    },
    {
      label: 'SO đến ShipDate chưa A/R (T2)',
      value: t2Due,
      sub: 'Đã đến hạn giao • cần kiểm tra',
      tone: t2Due > 0 ? 'warning' : 'neutral',
      icon: FileWarning,
    },
    {
      label: 'Đang chờ đến ShipDate',
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
          <AlertTitle>Không thể tải dữ liệu Monitor Bán hàng</AlertTitle>
          <AlertDescription>{getSalesMonitorErrorMessage(error)}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3.5 py-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          {isBusy && <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />}
          <span>{formatSalesScopeLine(dateFrom, brand)}</span>
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
                onClick={onClearDrilldown}
                className="gap-1 text-xs"
              >
                <X className="size-3" />
                Quay lại danh sách
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        {kpiCards.map(({ label, value, sub, tone, icon: Icon }) => (
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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
