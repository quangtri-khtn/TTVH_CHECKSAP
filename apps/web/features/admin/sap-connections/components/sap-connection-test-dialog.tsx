'use client';

import { CheckCircle2, CircleX, Loader2, MinusCircle } from 'lucide-react';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { SapConnectionDto, SapConnectionTestResultDto } from '@/lib/api/generated/model';

export function SapConnectionTestDialog({
  open,
  onOpenChange,
  target,
  isTesting,
  result,
  errorMessage,
  onRetry,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: SapConnectionDto | null;
  isTesting: boolean;
  result: SapConnectionTestResultDto | null;
  errorMessage: string | null;
  onRetry: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isTesting) onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={!isTesting}>
        <DialogHeader>
          <DialogTitle>Kiểm tra kết nối SAP</DialogTitle>
          <DialogDescription>
            Kiểm tra 3 bước kết nối SQL Server và Linked Server cho tài khoản{' '}
            <span className="font-mono font-medium text-foreground">{target?.username ?? ''}</span>.
          </DialogDescription>
        </DialogHeader>

        {isTesting && (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <p className="text-sm font-medium">Đang kiểm tra 3 bước kết nối cho tài khoản...</p>
            <p className="text-xs text-muted-foreground">
              Quá trình kiểm tra qua Linked Server có thể mất tới 1 phút.
            </p>
          </div>
        )}

        {!isTesting && errorMessage && (
          <div className="rounded-md border border-status-danger-border bg-status-danger-bg p-3 text-xs break-words whitespace-pre-wrap text-status-danger">
            {errorMessage}
          </div>
        )}

        {!isTesting && result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <StatusBadge
                label={result.ok ? 'Đạt 3/3 bước' : 'Kiểm tra có bước lỗi'}
                tone={result.ok ? 'success' : 'danger'}
                icon={result.ok ? CheckCircle2 : CircleX}
              />
              <span className="text-xs text-muted-foreground">
                Hoàn tất trong {result.durationMs} ms
              </span>
            </div>

            <div className="space-y-2.5">
              {result.steps.map((step) => (
                <div key={step.key} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{step.label}</span>
                    {step.status === 'ok' && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-status-success">
                        <CheckCircle2 className="size-4 shrink-0 text-status-success" />
                        Đạt
                      </span>
                    )}
                    {step.status === 'failed' && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-status-danger">
                        <CircleX className="size-4 shrink-0 text-status-danger" />
                        Lỗi
                      </span>
                    )}
                    {step.status === 'skipped' && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <MinusCircle className="size-4 shrink-0 text-muted-foreground" />
                        Bỏ qua
                      </span>
                    )}
                  </div>

                  {step.status === 'failed' && step.message && (
                    <div className="mt-2 rounded-md border border-status-danger-border bg-status-danger-bg p-2 text-xs break-words whitespace-pre-wrap text-status-danger">
                      {step.message}
                    </div>
                  )}

                  {step.status === 'skipped' && step.message && (
                    <p className="mt-1.5 text-xs break-words text-muted-foreground">{step.message}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onRetry} disabled={isTesting}>
            Kiểm tra lại
          </Button>
          <Button onClick={() => onOpenChange(false)} disabled={isTesting}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
