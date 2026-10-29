'use client';

import { useMemo, useRef, useState } from 'react';
import { Code2, Columns2, Copy, Eye, FileDiff, History, Play, RotateCcw, TerminalSquare } from 'lucide-react';
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
  tokenizeSqlForHighlight,
  type SqlTokenKind,
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

type EditorViewMode = 'edit' | 'highlight' | 'split';

const TOKEN_STYLE: Record<SqlTokenKind, string> = {
  keyword: 'font-bold text-blue-700 dark:text-blue-300',
  placeholder:
    'mx-0.5 inline-block rounded border border-violet-500/50 bg-violet-500/15 px-1 font-bold text-violet-950 dark:text-violet-200',
  schema: 'font-semibold text-teal-800 dark:text-teal-300',
  string: 'text-amber-800 dark:text-amber-300',
  identifier: 'text-sky-900 dark:text-sky-200',
  text: 'text-foreground',
};

const VIEW_MODES: { id: EditorViewMode; label: string; icon: typeof Columns2 }[] = [
  { id: 'edit', label: 'Soạn thảo SQL', icon: Code2 },
  { id: 'highlight', label: 'Tô màu Cú pháp & Biến', icon: Eye },
  { id: 'split', label: 'Song song 2 khung', icon: Columns2 },
];

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
  const [viewMode, setViewMode] = useState<EditorViewMode>('edit');
  const gutterRef = useRef<HTMLDivElement | null>(null);

  const estimatedLength = useMemo(
    () => estimateOpenQueryLength(currentSql, sampleDate, sampleBrand),
    [currentSql, sampleDate, sampleBrand],
  );
  const usageRatio = Math.min(100, Math.round((estimatedLength / MAX_OPENQUERY_LENGTH) * 100));
  const isOverLimit = estimatedLength > MAX_OPENQUERY_LENGTH;
  const meterColorClass =
    usageRatio > 90 || isOverLimit ? 'bg-destructive' : usageRatio >= 70 ? 'bg-amber-500' : 'bg-emerald-600';

  const isModifiedFromActive = normalizeSqlText(currentSql) !== normalizeSqlText(detail.activeSql);
  const isDifferentFromDefault = normalizeSqlText(currentSql) !== normalizeSqlText(detail.defaultSql);
  const highlightedLines = useMemo(() => tokenizeSqlForHighlight(currentSql), [currentSql]);
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
      '',
      detail.autoDateUpper,
    );
    onCopyText(expanded, `SQL đã điền mẫu (${sampleDate} · Brand ${sampleBrand || 'Tất cả'})`);
  };

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3.5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-foreground">SQL IDE Workbench (SAP HANA)</span>
          <Badge variant="outline" className="font-mono text-xs font-semibold">
            {highlightedLines.length} dòng
          </Badge>
          {isModifiedFromActive && (
            <Badge className="bg-amber-600 text-xs font-semibold text-white hover:bg-amber-600">
              Đang sửa nháp (chưa xuất bản)
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1">
            <div className="space-y-0.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-foreground">OPENQUERY:</span>
                <span className={cn('font-mono font-bold', isOverLimit ? 'text-destructive' : 'text-foreground')}>
                  {estimatedLength.toLocaleString('vi-VN')} / {MAX_OPENQUERY_LENGTH.toLocaleString('vi-VN')} ({usageRatio}%)
                </span>
              </div>
              <div className="h-1.5 w-44 overflow-hidden rounded-full bg-muted">
                <div className={cn('h-full transition-all', meterColorClass)} style={{ width: `${usageRatio}%` }} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-muted/20 px-2 py-1">
            <div className="flex items-center gap-1">
              <Label htmlFor="sample-date-input" className="text-xs font-medium">Ngày mẫu:</Label>
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
              <Label htmlFor="sample-brand-input" className="text-xs font-medium">Brand:</Label>
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
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-y py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
            {VIEW_MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setViewMode(id)}
                className={cn(
                  'inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                  viewMode === id ? 'bg-background text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={() => onCopyText(detail.defaultSql, 'SQL gốc v1')}>
            <Copy className="size-3.5" /> Copy SQL gốc v1
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleCopySample}>
            <TerminalSquare className="size-3.5" /> Copy SQL đã điền mẫu
          </Button>
          <Button type="button" variant={showDiff ? 'secondary' : 'outline'} size="sm" onClick={() => setShowDiff((p) => !p)}>
            <FileDiff className="size-3.5" /> {showDiff ? 'Ẩn Diff v1' : 'Xem Diff v1'}
          </Button>
          {isDifferentFromDefault && (
            <Button type="button" variant="outline" size="sm" onClick={() => onChangeSql(detail.defaultSql)}>
              Nạp lại gốc v1
            </Button>
          )}
          {detail.isCustomized && (
            <Button type="button" variant="outline" size="sm" disabled={isResettingDefault || isReviewing} onClick={onResetDefault}>
              <RotateCcw className="size-3.5" /> {isResettingDefault ? 'Đang khôi phục...' : 'Khôi phục gốc v1'}
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={onOpenHistory}>
            <History className="size-3.5" /> Lịch sử ({detail.versions.length})
          </Button>
        </div>

        <Button type="button" size="sm" disabled={isReviewing || !currentSql.trim()} onClick={onReview} className="gap-1.5 font-semibold">
          <Play className="size-3.5" /> {isReviewing ? 'Đang chạy Review & Validate...' : 'Review & Validate'}
        </Button>
      </div>

      <div className={cn('grid gap-3', viewMode === 'split' ? 'lg:grid-cols-2' : 'grid-cols-1')}>
        {viewMode !== 'highlight' && (
          <div className="flex overflow-hidden rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring/40">
            <div
              ref={gutterRef}
              aria-hidden="true"
              className="max-h-[420px] min-h-[300px] w-12 shrink-0 overflow-hidden border-r bg-muted/50 py-2.5 text-right font-mono text-sm leading-relaxed text-muted-foreground select-none"
            >
              {highlightedLines.map((line) => (
                <div key={line.lineNo} className="px-2.5">{line.lineLabel}</div>
              ))}
            </div>
            <Textarea
              value={currentSql}
              onChange={(e) => onChangeSql(e.target.value)}
              onScroll={(e) => {
                if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
              }}
              rows={14}
              spellCheck={false}
              placeholder="Nhập câu truy vấn SELECT / WITH cho SAP HANA..."
              className="max-h-[420px] min-h-[300px] flex-1 resize-y rounded-none border-0 p-2.5 font-mono text-sm leading-relaxed shadow-none focus-visible:ring-0"
            />
          </div>
        )}

        {viewMode !== 'edit' && (
          <div
            tabIndex={0}
            className="max-h-[420px] min-h-[300px] overflow-auto rounded-md border bg-muted/20 p-2.5 font-mono text-sm leading-relaxed"
          >
            {highlightedLines.map((line) => (
              <div key={line.lineNo} className="flex items-baseline gap-3 px-1.5 py-0.5 hover:bg-muted/50">
                <span className="w-8 shrink-0 text-right text-xs font-semibold text-muted-foreground select-none">
                  {line.lineLabel}
                </span>
                <div className="min-w-0 flex-1 whitespace-pre-wrap break-all">
                  {line.tokens.map((tok, tIdx) => (
                    <span key={tIdx} className={TOKEN_STYLE[tok.type]}>{tok.text}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showDiff && (
        <div className="space-y-1.5 rounded-md border bg-muted/20 p-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">So sánh dòng với câu gốc chuẩn v1:</span>
            <span className="font-mono text-xs font-medium text-foreground">
              +{lineDiff.addedCount} dòng thêm · -{lineDiff.removedCount} dòng xóa
            </span>
          </div>
          {!lineDiff.hasChanges ? (
            <p className="text-xs text-muted-foreground">Nội dung hiện tại khớp 100% với bản gốc chuẩn v1.</p>
          ) : (
            <div tabIndex={0} className="max-h-64 overflow-auto rounded border bg-background p-2 font-mono text-xs">
              {lineDiff.lines.map((line, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'px-1.5 py-0.5 whitespace-pre',
                    line.type === 'added' && 'bg-emerald-500/15 text-emerald-900 dark:text-emerald-200',
                    line.type === 'removed' && 'bg-destructive/15 text-destructive line-through',
                  )}
                >
                  <span className="mr-2 inline-block w-4 select-none opacity-70">
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
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
