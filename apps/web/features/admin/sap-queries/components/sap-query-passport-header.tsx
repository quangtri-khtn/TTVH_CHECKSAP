'use client';

import {
  CheckCircle2,
  Columns3,
  KeyRound,
  Layers,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SapQueryDetailDto } from '@/lib/api/generated/model';
import {
  checkClientPlaceholders,
  formatQueryOrderBadge,
} from '@/lib/admin/sap-query-domain';
import { cn } from '@/lib/utils';

export interface SapQueryPassportHeaderProps {
  detail: SapQueryDetailDto;
  currentSql: string;
}

export function SapQueryPassportHeader({
  detail,
  currentSql,
}: SapQueryPassportHeaderProps) {
  const placeholderCheck = checkClientPlaceholders(
    currentSql,
    detail.allowedPlaceholders,
  );
  const requiredSet = new Set(detail.requiredColumns);
  const internalCols = detail.baselineColumns.filter(
    (col) => !requiredSet.has(col),
  );

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3.5 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
              {formatQueryOrderBadge(detail.sortOrder)}
            </span>
            <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
              {detail.key}
            </code>
            <h2 className="text-sm font-bold text-foreground sm:text-base">
              {detail.title}
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">{detail.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="font-mono text-xs">
            Phiên bản đang chạy: v{detail.currentVersionNo}
          </Badge>
          {detail.isCustomized ? (
            <Badge className="bg-emerald-600 text-xs text-white hover:bg-emerald-600">
              Đã tùy chỉnh
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              Bản gốc chuẩn v1
            </Badge>
          )}
          <Badge
            variant={detail.supportsExtraColumns ? 'default' : 'outline'}
            className="gap-1 text-xs"
          >
            <Sparkles className="size-3" />
            {detail.supportsExtraColumns
              ? 'Cho phép thêm cột phụ (Passthrough)'
              : 'Cố định cấu trúc cột'}
          </Badge>
        </div>
      </div>

      <div className="grid gap-2.5 border-t pt-2.5 text-xs md:grid-cols-3">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
            <Layers className="size-3.5" />
            <span>Nuôi vùng nào trên UI / Excel:</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {detail.impactBadges.map((badge) => (
              <Badge key={badge} variant="secondary" className="text-[11px]">
                {badge}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
            <KeyRound className="size-3.5" />
            <span>
              Biến runtime bắt buộc ({detail.allowedPlaceholders.length}):
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {detail.allowedPlaceholders.map((ph) => {
              const isMissing =
                placeholderCheck.missingPlaceholders.includes(ph);
              return (
                <span
                  key={ph}
                  className={cn(
                    'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] font-medium',
                    isMissing
                      ? 'border-destructive/50 bg-destructive/10 text-destructive'
                      : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                  )}
                >
                  {isMissing ? (
                    <XCircle className="size-3" />
                  ) : (
                    <CheckCircle2 className="size-3" />
                  )}
                  {ph}
                </span>
              );
            })}
            {placeholderCheck.unexpectedPlaceholders.map((unexpected) => (
              <span
                key={unexpected}
                className="inline-flex items-center gap-1 rounded border border-destructive/50 bg-destructive/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-destructive"
              >
                <XCircle className="size-3" />
                Lạ: {unexpected}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
            <Columns3 className="size-3.5" />
            <span>
              Hợp đồng Cột bắt buộc ({detail.requiredColumns.length} cột
              {detail.dedupKeys.length > 0
                ? ` · Khóa: ${detail.dedupKeys.join(', ')}`
                : ''}
              ):
            </span>
          </div>
          <div className="flex max-h-20 flex-wrap gap-1 overflow-y-auto">
            {detail.requiredColumns.map((col) => (
              <code
                key={col}
                className="rounded border bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-foreground"
              >
                {col}
              </code>
            ))}
            {internalCols.map((col) => (
              <code
                key={col}
                title="Cột kỹ thuật nội bộ trong câu gốc v1"
                className="rounded border border-dashed bg-muted/30 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
              >
                {col} (nội bộ)
              </code>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
