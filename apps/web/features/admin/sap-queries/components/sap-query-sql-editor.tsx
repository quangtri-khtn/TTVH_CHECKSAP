'use client';

import { useMemo, useState } from 'react';
import {
  Copy,
  FileDiff,
  History,
  Play,
  RotateCcw,
  TerminalSquare,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { SapQueryDetailDto } from '@/lib/api/generated/model';
import {
  MAX_OPENQUERY_LENGTH,
  buildSampleExecutableSql,
  computeLineDiff,
  estimateOpenQueryLength,
  normalizeSqlText,
} from '@/lib/admin/sap-query-domain';
import { cn } from '@/lib/utils';

export interface SapQuerySqlEditorProps {
  detail: SapQueryDetailDto;
  currentSql: string;
  onChangeSql: (nextSql: string) => void;
  sampleDate: string;
  onChangeSampleDate: (value: string) => void;
  sampleBrand: string;
  onChangeSampleBrand: (value: string) => void;
  onCopyText: (text: string, label: string) => void;
  onReview: () => void;
  onResetDefault: () => void;
  onOpenHistory: () => void;
  isReviewing: boolean;
  isResettingDefault: boolean;
}

export function SapQuerySqlEditor({
  detail,
  currentSql,
  onChangeSql,
  sampleDate,
  onChangeSampleDate,
  sampleBrand,
  onChangeSampleBrand,
  onCopyText,
  onReview,
  onResetDefault,
  onOpenHistory,
  isReviewing,
  isResettingDefault,
}: SapQuerySqlEditorProps) {
  const [showDiff, setShowDiff] = useState(false);

  const estimatedLength = useMemo(
    () => estimateOpenQueryLength(currentSql, sampleDate, sampleBrand),
    [currentSql, sampleDate, sampleBrand],
  );
  const isOverLimit = estimatedLength > MAX_OPENQUERY_LENGTH;
  const isModifiedFromActive =
    normalizeSqlText(currentSql) !== normalizeSqlText(detail.activeSql);
  const isDifferentFromDefault =
    normalizeSqlText(currentSql) !== normalizeSqlText(detail.defaultSql);

  const lineDiff = useMemo(
    () =>
      showDiff
        ? computeLineDiff(detail.defaultSql, currentSql)
        : { lines: [], addedCount: 0, removedCount: 0, hasChanges: false },
    [showDiff, detail.defaultSql, currentSql],
  );

  const handleCopySample = () => {
    const expanded = buildSampleExecutableSql(
      currentSql,
      sampleDate,
      sampleBrand,
    );
    onCopyText(
      expanded,
      `SQL đã điền mẫu (${sampleDate} · Brand ${sampleBrand})`,
    );
  };

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3.5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            Soạn thảo Full SQL (SAP HANA)
          </span>
          <Badge
            variant={isOverLimit ? 'destructive' : 'outline'}
            className="font-mono text-[11px]"
          >
            {estimatedLength.toLocaleString('vi-VN')} /{' '}
            {MAX_OPENQUERY_LENGTH.toLocaleString('vi-VN')} ký tự OPENQUERY
          </Badge>
          {isModifiedFromActive && (
            <Badge variant="secondary" className="text-[11px]">
              Đang sửa nháp (chưa xuất bản)
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1">
            <Label htmlFor="sample-date-input" className="text-[11px]">
              Ngày mẫu:
            </Label>
            <Input
              id="sample-date-input"
              value={sampleDate}
              onChange={(e) => onChangeSampleDate(e.target.value)}
              placeholder="20261007"
              maxLength={8}
              className="h-7 w-24 font-mono text-xs"
            />
          </div>
          <div className="flex items-center gap-1">
            <Label htmlFor="sample-brand-input" className="text-[11px]">
              Brand:
            </Label>
            <Input
              id="sample-brand-input"
              value={sampleBrand}
              onChange={(e) => onChangeSampleBrand(e.target.value)}
              placeholder="5001"
              maxLength={10}
              className="h-7 w-18 font-mono text-xs"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-y py-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onCopyText(detail.defaultSql, 'SQL gốc v1')}
        >
          <Copy className="size-3.5" />
          Copy SQL gốc v1
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopySample}
        >
          <TerminalSquare className="size-3.5" />
          Copy SQL đã điền mẫu
        </Button>

        <Button
          type="button"
          variant={showDiff ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setShowDiff((prev) => !prev)}
        >
          <FileDiff className="size-3.5" />
          {showDiff ? 'Ẩn Diff với v1' : 'Xem Diff với v1'}
        </Button>

        {isDifferentFromDefault && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChangeSql(detail.defaultSql)}
          >
            Nạp lại SQL gốc v1 vào ô sửa
          </Button>
        )}

        {detail.isCustomized && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isResettingDefault || isReviewing}
            onClick={onResetDefault}
          >
            <RotateCcw className="size-3.5" />
            {isResettingDefault ? 'Đang khôi phục...' : 'Khôi phục gốc v1'}
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenHistory}
        >
          <History className="size-3.5" />
          Lịch sử ({detail.versions.length})
        </Button>

        <Button
          type="button"
          size="sm"
          disabled={isReviewing || !currentSql.trim()}
          onClick={onReview}
          className="ml-auto gap-1.5"
        >
          <Play className="size-3.5" />
          {isReviewing ? 'Đang chạy Review & Validate...' : 'Review & Validate'}
        </Button>
      </div>

      <Textarea
        value={currentSql}
        onChange={(e) => onChangeSql(e.target.value)}
        rows={14}
        spellCheck={false}
        placeholder="Nhập câu truy vấn SELECT / WITH cho SAP HANA..."
        className="min-h-[260px] font-mono text-xs leading-relaxed"
      />

      {showDiff && (
        <div className="space-y-1.5 rounded-md border bg-muted/20 p-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">
              So sánh dòng với câu gốc chuẩn v1:
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              +{lineDiff.addedCount} dòng thêm · -{lineDiff.removedCount} dòng
              xóa
            </span>
          </div>
          {!lineDiff.hasChanges ? (
            <p className="text-xs text-muted-foreground">
              Nội dung hiện tại khớp 100% với bản gốc chuẩn v1.
            </p>
          ) : (
            <div className="max-h-56 overflow-auto rounded border bg-background p-2 font-mono text-[11px]">
              {lineDiff.lines.map((line, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'px-1.5 py-0.5 whitespace-pre',
                    line.type === 'added' &&
                      'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
                    line.type === 'removed' &&
                      'bg-destructive/15 text-destructive line-through',
                  )}
                >
                  <span className="mr-2 inline-block w-4 select-none opacity-60">
                    {line.type === 'added'
                      ? '+'
                      : line.type === 'removed'
                        ? '-'
                        : ' '}
                  </span>
                  {line.text}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
