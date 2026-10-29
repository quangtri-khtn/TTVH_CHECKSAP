'use client';

import { useMemo, useState } from 'react';
import { History, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { SapQueryDetailDto } from '@/lib/api/generated/model';
import { computeLineDiff } from '@/lib/admin/sap-query-domain';
import { cn } from '@/lib/utils';

export interface SapQueryHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: SapQueryDetailDto;
  onLoadSqlToEditor: (sqlText: string) => void;
  onRollbackVersion: (targetVersionNo: number) => void;
  isRollingBack: boolean;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function SapQueryHistorySheet({
  open,
  onOpenChange,
  detail,
  onLoadSqlToEditor,
  onRollbackVersion,
  isRollingBack,
}: SapQueryHistorySheetProps) {
  const [selectedVersionNo, setSelectedVersionNo] = useState<number | null>(null);

  const activeVersionNo = selectedVersionNo ?? detail.versions[0]?.versionNo ?? 1;
  const selectedVersion =
    detail.versions.find((v) => v.versionNo === activeVersionNo) ?? detail.versions[0];

  const diffWithActive = useMemo(() => {
    if (!selectedVersion) {
      return { lines: [], addedCount: 0, removedCount: 0, hasChanges: false };
    }
    return computeLineDiff(detail.activeSql, selectedVersion.sqlText);
  }, [detail.activeSql, selectedVersion]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-4 overflow-y-auto p-5 data-[side=right]:w-[94vw] data-[side=right]:sm:max-w-3xl data-[side=right]:lg:max-w-4xl"
      >
        <SheetHeader className="border-b p-0 pr-10 pb-3">
          <SheetTitle className="flex items-center gap-2 text-base font-bold">
            <History className="size-4 shrink-0 text-primary" />
            <span>Lịch sử Phiên bản · {detail.title}</span>
          </SheetTitle>
          <SheetDescription className="text-xs">
            Mỗi lần Xuất bản, Hoàn tác hoặc Khôi phục gốc đều tạo phiên bản mới theo cơ chế
            append-only để bảo toàn dấu vết kiểm toán.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground">
            <span>Chọn phiên bản để xem và đối chiếu ({detail.versions.length} phiên bản):</span>
            <span className="font-mono text-muted-foreground">
              Đang chạy: v{detail.currentVersionNo}
            </span>
          </div>

          <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
            {detail.versions.map((ver) => {
              const isCurrentActive = ver.versionNo === detail.currentVersionNo;
              const isSelected = ver.versionNo === selectedVersion?.versionNo;
              return (
                <button
                  key={ver.id}
                  type="button"
                  onClick={() => setSelectedVersionNo(ver.versionNo)}
                  className={cn(
                    'flex flex-col gap-1 rounded-lg border p-2.5 text-left text-xs transition-all',
                    isSelected
                      ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30'
                      : 'bg-card hover:bg-muted/50',
                  )}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-mono text-xs font-bold text-foreground">
                      Phiên bản v{ver.versionNo}
                    </span>
                    {isCurrentActive && (
                      <Badge className="px-1.5 py-0 text-xs font-semibold">
                        Đang chạy
                      </Badge>
                    )}
                  </div>
                  <p className="line-clamp-1 text-xs font-medium text-foreground">
                    {ver.changeNote}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {ver.createdBy ?? 'Hệ thống'} · {formatDateTime(ver.createdAt)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {selectedVersion ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3 text-xs">
              <div className="space-y-0.5">
                <div className="text-sm font-bold text-foreground">
                  Phiên bản v{selectedVersion.versionNo} — {selectedVersion.changeNote}
                </div>
                <div className="text-xs text-muted-foreground">
                  Người tạo: {selectedVersion.createdBy ?? 'Hệ thống'} ·{' '}
                  {formatDateTime(selectedVersion.createdAt)}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onLoadSqlToEditor(selectedVersion.sqlText);
                    onOpenChange(false);
                  }}
                >
                  Nạp vào ô sửa SQL
                </Button>
                {selectedVersion.versionNo !== detail.currentVersionNo && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={isRollingBack}
                    onClick={() => onRollbackVersion(selectedVersion.versionNo)}
                  >
                    <RotateCcw className="size-3.5" />
                    {isRollingBack
                      ? 'Đang hoàn tác...'
                      : `Hoàn tác về v${selectedVersion.versionNo}`}
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">
                  So sánh Diff với bản đang chạy (v{detail.currentVersionNo}):
                </span>
                <span className="font-mono text-xs font-semibold text-foreground">
                  +{diffWithActive.addedCount} dòng thêm / -{diffWithActive.removedCount} dòng xóa
                </span>
              </div>
              <div
                tabIndex={0}
                className="max-h-96 overflow-auto rounded-lg border bg-background p-3 font-mono text-xs leading-relaxed"
              >
                {diffWithActive.lines.map((line, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'flex items-baseline gap-2.5 px-2 py-0.5 whitespace-pre-wrap break-all',
                      line.type === 'added' &&
                        'bg-emerald-500/15 text-emerald-900 dark:text-emerald-200',
                      line.type === 'removed' &&
                        'bg-destructive/15 text-destructive line-through',
                    )}
                  >
                    <span className="w-7 shrink-0 text-right text-muted-foreground select-none">
                      {String(line.newLineNo ?? line.oldLineNo ?? idx + 1).padStart(2, '0')}
                    </span>
                    <span className="w-3 shrink-0 select-none font-bold opacity-75">
                      {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                    </span>
                    <span className="min-w-0 flex-1">{line.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Chưa có lịch sử phiên bản.</p>
        )}

        {detail.audits.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <div className="text-xs font-semibold text-foreground">
              Nhật ký kiểm toán gần nhất ({detail.audits.length} sự kiện):
            </div>
            <div className="max-h-48 space-y-1.5 overflow-y-auto text-xs">
              {detail.audits.map((audit) => (
                <div
                  key={audit.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/25 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="px-1.5 py-0 font-mono text-xs font-semibold">
                      {audit.action}
                    </Badge>
                    <span className="font-medium text-foreground">
                      {audit.changeNote ?? 'Thực thi kiểm tra'}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {audit.actorName ?? 'Hệ thống'} · {formatDateTime(audit.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
