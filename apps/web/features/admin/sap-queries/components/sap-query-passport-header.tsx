'use client';

import {
  CheckCircle2,
  Columns3,
  Copy,
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
  getStageVisualMeta,
} from '@/lib/admin/sap-query-domain';
import { cn } from '@/lib/utils';

export interface SapQueryPassportHeaderProps {
  detail: SapQueryDetailDto;
  currentSql: string;
  onCopyToken?: (text: string, label: string) => void;
}

export function SapQueryPassportHeader({
  detail,
  currentSql,
  onCopyToken,
}: SapQueryPassportHeaderProps) {
  const placeholderCheck = checkClientPlaceholders(
    currentSql,
    detail.allowedPlaceholders,
  );
  const stageMeta = getStageVisualMeta(detail.stage);
  const requiredSet = new Set(detail.requiredColumns);
  const dedupSet = new Set(detail.dedupKeys);
  const internalCols = detail.baselineColumns.filter(
    (col) => !requiredSet.has(col),
  );

  const handleChipCopy = (tokenText: string, label: string) => {
    if (onCopyToken) {
      onCopyToken(tokenText, label);
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(tokenText);
    }
  };

  return (
    <div
      className={cn(
        'space-y-2.5 rounded-lg border border-l-4 bg-card p-3 shadow-xs',
        stageMeta.borderClass,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                'rounded border px-2 py-0.5 font-mono text-xs font-bold',
                stageMeta.badgeClass,
              )}
            >
              {formatQueryOrderBadge(detail.sortOrder)}
            </span>
            <code className="rounded border bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
              {detail.key}
            </code>
            <Badge
              variant="outline"
              className={cn('text-xs font-semibold', stageMeta.badgeClass)}
            >
              {stageMeta.shortLabel}
            </Badge>
            <h2 className="text-sm font-bold text-foreground sm:text-base">
              {detail.title.replace(/^#\d+\s*·\s*/, '')}
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">{detail.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="font-mono text-xs font-semibold">
            Đang chạy: v{detail.currentVersionNo}
          </Badge>
          {detail.isCustomized ? (
            <Badge className="bg-emerald-700 text-xs font-semibold text-white hover:bg-emerald-700">
              Đã tùy chỉnh
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs font-medium">
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

      <div className="grid gap-2.5 border-t pt-2.5 text-xs lg:grid-cols-12">
        <div className="space-y-1 lg:col-span-3">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Layers className="size-3.5 text-primary" />
            <span>Nuôi vùng UI / Excel:</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {detail.impactBadges.map((badge) => (
              <Badge
                key={badge}
                variant="secondary"
                className="text-xs font-medium text-foreground"
              >
                {badge}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-1 lg:col-span-4">
          <div className="flex items-center justify-between gap-1 font-semibold text-foreground">
            <span className="inline-flex items-center gap-1.5">
              <KeyRound className="size-3.5 text-primary" />
              Biến runtime bắt buộc ({detail.allowedPlaceholders.length}):
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              Bấm để copy
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {detail.allowedPlaceholders.map((ph) => {
              const isMissing =
                placeholderCheck.missingPlaceholders.includes(ph);
              return (
                <button
                  key={ph}
                  type="button"
                  onClick={() => handleChipCopy(ph, `Biến runtime ${ph}`)}
                  title={
                    isMissing
                      ? `Biến ${ph} đang thiếu trong câu SQL — bấm để copy ${ph}`
                      : `Biến ${ph} đã có trong câu SQL — bấm để copy ${ph}`
                  }
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-xs font-semibold transition-colors hover:opacity-90',
                    isMissing
                      ? 'border-destructive/60 bg-destructive/15 text-destructive'
                      : 'border-emerald-600/40 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200',
                  )}
                >
                  {isMissing ? (
                    <XCircle className="size-3.5 shrink-0" />
                  ) : (
                    <CheckCircle2 className="size-3.5 shrink-0" />
                  )}
                  <span>{ph}</span>
                  <span className="font-sans text-xs font-medium">
                    {isMissing ? '(Thiếu)' : '(Đã có)'}
                  </span>
                  <Copy className="size-3 opacity-70" />
                </button>
              );
            })}
            {placeholderCheck.unexpectedPlaceholders.map((unexpected) => (
              <span
                key={unexpected}
                className="inline-flex items-center gap-1 rounded-md border border-destructive/60 bg-destructive/15 px-2 py-0.5 font-mono text-xs font-semibold text-destructive"
              >
                <XCircle className="size-3.5 shrink-0" />
                Lạ: {unexpected}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-1 lg:col-span-5">
          <div className="flex flex-wrap items-center justify-between gap-1 font-semibold text-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Columns3 className="size-3.5 text-primary" />
              Hợp đồng Cột bắt buộc ({detail.requiredColumns.length} cột
              {detail.dedupKeys.length > 0
                ? ` · Khóa: ${detail.dedupKeys.join(', ')}`
                : ''}
              ):
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              Bấm cột để copy alias SQL
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {detail.requiredColumns.map((col) => {
              const isDedupKey = dedupSet.has(col);
              return (
                <button
                  key={col}
                  type="button"
                  onClick={() =>
                    handleChipCopy(`"${col}"`, `Cột bắt buộc "${col}"`)
                  }
                  title={
                    isDedupKey
                      ? `Khóa khử trùng + Cột bắt buộc — bấm để copy "${col}"`
                      : `Cột bắt buộc — bấm để copy "${col}"`
                  }
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-xs font-semibold transition-colors hover:bg-muted',
                    isDedupKey
                      ? 'border-amber-500/60 bg-amber-500/15 text-amber-950 dark:text-amber-200'
                      : 'border-blue-500/40 bg-blue-500/10 text-foreground',
                  )}
                >
                  {isDedupKey && (
                    <KeyRound className="size-3 shrink-0 text-amber-700 dark:text-amber-300" />
                  )}
                  <span>{col}</span>
                  <Copy className="size-2.5 opacity-60" />
                </button>
              );
            })}
            {internalCols.map((col) => (
              <button
                key={col}
                type="button"
                onClick={() =>
                  handleChipCopy(`"${col}"`, `Cột nội bộ "${col}"`)
                }
                title={`Cột kỹ thuật nội bộ trong câu gốc v1 — bấm để copy "${col}"`}
                className="inline-flex items-center gap-1 rounded-md border border-dashed border-border bg-muted/50 px-2 py-0.5 font-mono text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                <span>{col} (nội bộ)</span>
                <Copy className="size-2.5 opacity-60" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
