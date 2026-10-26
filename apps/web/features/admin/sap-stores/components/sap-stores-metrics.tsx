'use client';

import { Clock, RotateCcw, Store, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { STATUS_TONE_CLASS, STATUS_TONE_TEXT, type StatusTone } from '@/lib/admin/status-tone';
import { formatSyncedAt, type SapStoreMetrics } from '@/lib/admin/sap-store-domain';
import { cn } from '@/lib/utils';

interface SapStoresMetricsProps {
  metrics: SapStoreMetrics;
  isLoading: boolean;
}

export function SapStoresMetrics({ metrics, isLoading }: SapStoresMetricsProps) {
  const cards: readonly {
    label: string;
    value: string;
    sub: string;
    tone: StatusTone;
    icon: typeof Store;
  }[] = [
    {
      label: 'Tổng cửa hàng SAP',
      value: isLoading ? '...' : String(metrics.total),
      sub: `${metrics.sapActiveCount} kho đang hoạt động trên SAP`,
      tone: 'neutral',
      icon: Store,
    },
    {
      label: 'Active Luồng Bán',
      value: isLoading ? '...' : String(metrics.activeSalesCount),
      sub: 'Cho phép tính vào Monitor Bán hàng',
      tone: metrics.activeSalesCount > 0 ? 'success' : 'warning',
      icon: TrendingUp,
    },
    {
      label: 'Active Luồng Trả',
      value: isLoading ? '...' : String(metrics.activeReturnCount),
      sub: 'Cho phép tính vào Monitor Luồng trả',
      tone: metrics.activeReturnCount > 0 ? 'info' : 'warning',
      icon: RotateCcw,
    },
    {
      label: 'Đồng bộ OWHS gần nhất',
      value: isLoading ? '...' : formatSyncedAt(metrics.lastSyncedAt),
      sub: 'Nguồn: maycha_live.OWHS (SAP HANA)',
      tone: 'neutral',
      icon: Clock,
    },
  ];

  const TONE_TOP_BAR: Record<StatusTone, string> = {
    danger: 'bg-status-danger',
    warning: 'bg-status-warning',
    success: 'bg-status-success',
    info: 'bg-status-info',
    neutral: 'bg-status-neutral/50',
  };

  return (
    <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
      {cards.map(({ label, value, sub, tone, icon: Icon }) => (
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
                  'inline-flex size-7 shrink-0 items-center justify-center rounded-lg border',
                  STATUS_TONE_CLASS[tone],
                )}
              >
                <Icon className="size-3.5" />
              </span>
            </div>
            <span
              className={cn(
                'font-heading text-xl sm:text-2xl font-bold tracking-tight tabular-nums truncate',
                tone === 'success' || tone === 'info' ? STATUS_TONE_TEXT[tone] : 'text-foreground',
              )}
            >
              {value}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">{sub}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
