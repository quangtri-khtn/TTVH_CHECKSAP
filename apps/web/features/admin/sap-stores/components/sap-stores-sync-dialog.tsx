'use client';

import { Database, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SapStoresSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSyncing: boolean;
  onConfirmSync: () => void;
}

export function SapStoresSyncDialog({
  open,
  onOpenChange,
  isSyncing,
  onConfirmSync,
}: SapStoresSyncDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-base">
            <Database className="size-4 text-muted-foreground" />
            Đồng bộ danh sách cửa hàng từ SAP HANA
          </DialogTitle>
          <DialogDescription className="pt-1 text-xs leading-relaxed">
            Hệ thống sẽ truy vấn trực tiếp bảng <code className="font-mono">maycha_live.OWHS</code>{' '}
            trên SAP HANA để nạp các cửa hàng/kho mới tạo vào hệ thống.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-status-success" />
            <span>
              <strong>Bảo toàn cấu hình hiện tại:</strong> Trạng thái bật/tắt{' '}
              <em>Cho phép Query Bán hàng</em> và <em>Cho phép Query Luồng trả</em> của các cửa hàng
              đã có sẽ được giữ nguyên 100%.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <RefreshCw className="mt-0.5 size-4 shrink-0 text-status-info" />
            <span>
              <strong>Cửa hàng mới phát sinh:</strong> Sẽ được thêm vào danh sách với trạng thái mặc
              định là <em>Tắt</em> để Quản trị viên chủ động kiểm duyệt và bật khi đưa vào Go-live.
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSyncing}
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Hủy
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isSyncing}
            onClick={onConfirmSync}
            className="gap-1.5 text-xs"
          >
            {isSyncing ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Đang đồng bộ từ SAP...
              </>
            ) : (
              <>
                <RefreshCw className="size-3.5" />
                Bắt đầu đồng bộ
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
