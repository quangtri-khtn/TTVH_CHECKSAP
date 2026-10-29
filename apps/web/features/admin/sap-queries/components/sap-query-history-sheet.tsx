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
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
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
  const [selectedVersionNo, setSelectedVersionNo] = useState<number | null>(
    null,
  );

  const activeVersionNo =
    selectedVersionNo ?? detail.versions[0]?.versionNo ?? 1;
  const selectedVersion =
    detail.versions.find((v) => v.versionNo === activeVersionNo) ??
    detail.versions[0];

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
        className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-2xl"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            <History className="size-4" />
            <span>Lịch sử Phiên bản · {detail.title}</span>
          </SheetTitle>
          <SheetDescription className="text-xs">
            Mỗi lần Xuất bản, Hoàn tác hoặc Khôi phục gốc đều tạo phiên bản mới
            theo cơ chế append-only để bảo toàn dấu vết kiểm toán.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-3 md:grid-cols-5">
          <div className="space-y-1.5 md:col-span-2">
            <div className="text-xs font-semibold text-foreground">
              Danh sách phiên bản ({detail.versions.length}):
            </div>
            <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {detail.versions.map((ver) => {
                const isCurrentActive =
                  ver.versionNo === detail.currentVersionNo;
                const isSelected = ver.versionNo === selectedVersion?.versionNo;
                return (
                  <button
                    key={ver.id}
                    type="button"
                    onClick={() => setSelectedVersionNo(ver.versionNo)}
                    className={cn(
                      'flex w-full flex-col gap-1 rounded-md border p-2 text-left text-xs transition-colors',
                      isSelected
                        ? 'border-primary bg-primary/8'
                        : 'hover:bg-muted/50',
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono font-bold text-foreground">
                        v{ver.versionNo}
                      </span>
                      {isCurrentActive && (
                        <Badge className="h-4 px-1.5 text-[10px]">
                          Đang chạy
                        </Badge>
                      )}
                    </div>
                    <p className="line-clamp-2 text-[11px] text-foreground">
                      {ver.changeNote}
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      {ver.createdBy ?? 'Hệ thống'} ·{' '}
                      {formatDateTime(ver.createdAt)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2.5 md:col-span-3">
            {selectedVersion ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 p-2.5 text-xs">
                  <div>
                    <div className="font-semibold text-foreground">
                      Phiên bản v{selectedVersion.versionNo} —{' '}
                      {selectedVersion.changeNote}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Người tạo: {selectedVersion.createdBy ?? 'Hệ thống'} ·{' '}
                      {formatDateTime(selectedVersion.createdAt)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => {
                        onLoadSqlToEditor(selectedVersion.sqlText);
                        onOpenChange(false);
                      }}
                    >
                      Nạp vào ô sửa
                    </Button>
                    {selectedVersion.versionNo !== detail.currentVersionNo && (
                      <Button
                        type="button"
                        size="xs"
                        disabled={isRollingBack}
                        onClick={() =>
                          onRollbackVersion(selectedVersion.versionNo)
                        }
                      >
                        <RotateCcw className="size-3" />
                        {isRollingBack
                          ? 'Đang hoàn tác...'
                          : `Hoàn tác về v${selectedVersion.versionNo}`}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      So sánh Diff với bản đang chạy (v{detail.currentVersionNo}
                      ):
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      +{diffWithActive.addedCount} / -
                      {diffWithActive.removedCount} dòng
                    </span>
                  </div>
                  <div className="max-h-72 overflow-auto rounded border bg-background p-2 font-mono text-[11px]">
                    {diffWithActive.lines.map((line, idx) => (
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
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Chưa có lịch sử phiên bản.
              </p>
            )}
          </div>
        </div>

        {detail.audits.length > 0 && (
          <div className="space-y-1.5 border-t pt-3">
            <div className="text-xs font-semibold text-foreground">
              Nhật ký kiểm toán gần nhất ({detail.audits.length} sự kiện):
            </div>
            <div className="max-h-44 space-y-1 overflow-y-auto text-[11px]">
              {detail.audits.map((audit) => (
                <div
                  key={audit.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border bg-muted/20 px-2.5 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="h-4 px-1.5 font-mono text-[10px]"
                    >
                      {audit.action}
                    </Badge>
                    <span className="text-foreground">
                      {audit.changeNote ?? 'Thực thi kiểm tra'}
                    </span>
                  </div>
                  <span className="text-muted-foreground">
                    {audit.actorName ?? 'Hệ thống'} ·{' '}
                    {formatDateTime(audit.createdAt)}
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
