'use client';

import {
  AlertTriangle,
  CheckCircle2,
  PlusCircle,
  Rocket,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SapDataGrid } from '@/features/sap-monitor/components/sap-data-grid';
import type { SapCellValue } from '@/lib/sap-monitor/sales-monitor-domain';
import type { ReviewSapQueryResultDto } from '@/lib/api/generated/model';
import {
  canPublishQuery,
  normalizeSqlText,
} from '@/lib/admin/sap-query-domain';
import { cn } from '@/lib/utils';

export interface SapQueryReviewPanelProps {
  reviewResult: ReviewSapQueryResultDto | null;
  currentSql: string;
  lastReviewedSql: string | null;
  changeNote: string;
  onChangeNote: (value: string) => void;
  onPublish: () => void;
  isPublishing: boolean;
  isReviewing: boolean;
}

function toSapCellRows(
  rows: readonly (readonly unknown[])[] | undefined | null,
): (readonly SapCellValue[])[] {
  if (!rows) return [];
  return rows.map((row) =>
    row.map((cell): SapCellValue => {
      if (cell === null || cell === undefined) return null;
      if (
        typeof cell === 'string' ||
        typeof cell === 'number' ||
        typeof cell === 'boolean'
      ) {
        return cell;
      }
      return String(cell);
    }),
  );
}

export function SapQueryReviewPanel({
  reviewResult,
  currentSql,
  lastReviewedSql,
  changeNote,
  onChangeNote,
  onPublish,
  isPublishing,
  isReviewing,
}: SapQueryReviewPanelProps) {
  const isSqlMatchesReviewed =
    lastReviewedSql !== null &&
    normalizeSqlText(currentSql) === normalizeSqlText(lastReviewedSql);
  const canPublish = canPublishQuery({
    reviewResult,
    currentSql,
    lastReviewedSql,
    changeNote,
  });

  const lockReason = !reviewResult
    ? 'Cần bấm "Review & Validate" trước khi Xuất bản.'
    : !reviewResult.valid
      ? 'Kết quả Review & Validate chưa đạt yêu cầu.'
      : !isSqlMatchesReviewed
        ? 'Nội dung SQL đã thay đổi sau lần Review gần nhất — vui lòng chạy lại Review & Validate.'
        : changeNote.trim().length < 3
          ? 'Nhập ghi chú lý do thay đổi (tối thiểu 3 ký tự) để mở khóa nút Xuất bản.'
          : null;

  const staticSteps = reviewResult
    ? [
        {
          label: '1. Biến runtime bắt buộc ({d}, {br}...)',
          ok: reviewResult.steps.placeholdersOk,
        },
        {
          label: '2. Chỉ SELECT / Chặn từ khóa ghi & comment',
          ok: reviewResult.steps.readOnlySelectOk,
        },
        {
          label: '3. Bảng thuộc maycha_live / kbmd_live',
          ok: reviewResult.steps.allowedTablesOk,
        },
        {
          label: `4. Độ dài OPENQUERY (${reviewResult.worstCaseOpenQueryLength.toLocaleString('vi-VN')}/${reviewResult.maxOpenQueryLength.toLocaleString('vi-VN')})`,
          ok: reviewResult.steps.openQueryLengthOk,
        },
      ]
    : [];

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3.5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
        <div className="flex items-center gap-2">
          {reviewResult?.valid && isSqlMatchesReviewed ? (
            <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <ShieldAlert className="size-4 text-amber-600 dark:text-amber-400" />
          )}
          <h3 className="text-xs font-bold text-foreground sm:text-sm">
            Kết quả Review &amp; Validate · Xuất bản Phiên bản Mới
          </h3>
        </div>

        {reviewResult && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Badge variant={reviewResult.valid ? 'default' : 'destructive'}>
              {reviewResult.valid ? 'Hợp lệ để Xuất bản' : 'Chưa đạt yêu cầu'}
            </Badge>
            {reviewResult.executionRan && (
              <Badge variant="outline" className="font-mono text-[11px]">
                {reviewResult.rowCount} dòng · {reviewResult.durationMs} ms
              </Badge>
            )}
          </div>
        )}
      </div>

      {reviewResult && (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {staticSteps.map((step) => (
              <div
                key={step.label}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs',
                  step.ok
                    ? 'border-emerald-500/30 bg-emerald-500/8 text-emerald-800 dark:text-emerald-300'
                    : 'border-destructive/40 bg-destructive/10 text-destructive',
                )}
              >
                {step.ok ? (
                  <CheckCircle2 className="size-3.5 shrink-0" />
                ) : (
                  <XCircle className="size-3.5 shrink-0" />
                )}
                <span className="font-medium">{step.label}</span>
              </div>
            ))}
          </div>

          {reviewResult.errors.length > 0 && (
            <div className="space-y-1 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              <div className="font-semibold">
                Lỗi chặn xuất bản ({reviewResult.errors.length}):
              </div>
              <ul className="list-inside list-disc space-y-0.5">
                {reviewResult.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {reviewResult.warnings.length > 0 && (
            <div className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="size-3.5" />
                <span>
                  Cảnh báo kiểm tra dữ liệu ({reviewResult.warnings.length}
                  {reviewResult.duplicateKeyCount > 0
                    ? ` · Trùng khóa dedupKeys: ${reviewResult.duplicateKeyCount} dòng`
                    : ''}
                  ):
                </span>
              </div>
              <ul className="list-inside list-disc space-y-0.5">
                {reviewResult.warnings.map((warn, idx) => (
                  <li key={idx}>{warn}</li>
                ))}
              </ul>
            </div>
          )}

          {reviewResult.columnChecks.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-foreground">
                Bảng đối chiếu Hợp đồng Cột với câu gốc v1 (
                {reviewResult.actualColumns.length} cột trả về):
              </div>
              <div className="flex flex-wrap gap-1.5 rounded-md border bg-muted/20 p-2.5">
                {reviewResult.columnChecks.map((item) => {
                  const isPresent = item.status === 'present';
                  const isMissing =
                    item.status === 'missing' ||
                    item.status === 'unsupported_extra';
                  const isAdded = item.status === 'added';
                  return (
                    <span
                      key={`${item.kind}-${item.columnName}`}
                      className={cn(
                        'inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[11px] font-medium',
                        isPresent &&
                          'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
                        isAdded &&
                          'border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-300',
                        isMissing &&
                          'border-destructive/50 bg-destructive/15 text-destructive',
                        item.status === 'removed' &&
                          'border-border bg-muted text-muted-foreground line-through',
                      )}
                    >
                      {isPresent && <CheckCircle2 className="size-3" />}
                      {isAdded && <PlusCircle className="size-3" />}
                      {isMissing && <XCircle className="size-3" />}
                      <span>{item.columnName}</span>
                      <span className="text-[10px] opacity-75">
                        {item.kind === 'required'
                          ? isPresent
                            ? '(✓ Bắt buộc)'
                            : '(✗ Thiếu)'
                          : item.kind === 'extra'
                            ? item.status === 'added'
                              ? '(+ Cột mới)'
                              : '(✗ Cấm thêm)'
                            : '(Cột gốc)'}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {reviewResult.executionRan && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">
                  Dữ liệu chạy thử trên SAP HANA (tối đa 50 dòng đầu tiên):
                </span>
                <span className="text-muted-foreground">
                  Tổng số dòng trả về: {reviewResult.rowCount}
                </span>
              </div>
              <SapDataGrid
                columns={reviewResult.previewTable?.columns ?? []}
                rows={toSapCellRows(reviewResult.previewTable?.rows)}
              />
            </div>
          )}
        </div>
      )}

      <div className="space-y-2 rounded-md border bg-muted/20 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor="publish-change-note" className="text-xs font-medium">
              Ghi chú thay đổi phiên bản (bắt buộc tối thiểu 3 ký tự):
            </Label>
            <Input
              id="publish-change-note"
              value={changeNote}
              onChange={(e) => onChangeNote(e.target.value)}
              placeholder="Ví dụ: Thêm cột U_RefNo phục vụ đối soát kế toán..."
              className="h-8 text-xs"
            />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!canPublish || isPublishing || isReviewing}
            onClick={onPublish}
            className="gap-1.5"
          >
            <Rocket className="size-3.5" />
            {isPublishing ? 'Đang xuất bản...' : 'Xuất bản phiên bản mới'}
          </Button>
        </div>

        {lockReason && (
          <p className="text-[11px] text-muted-foreground">🔒 {lockReason}</p>
        )}
      </div>
    </div>
  );
}
