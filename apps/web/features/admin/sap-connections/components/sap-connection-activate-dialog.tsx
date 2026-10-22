'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { SapConnectionDto } from '@/lib/api/generated/model';

export function SapConnectionActivateDialog({
  open,
  onOpenChange,
  target,
  isPending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: SapConnectionDto | null;
  isPending: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending) onOpenChange(nextOpen);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`Kích hoạt tài khoản "${target?.username ?? ''}"?`}</AlertDialogTitle>
          <AlertDialogDescription>
            Hệ thống sẽ mở kết nối SQL Server mới bằng tài khoản này, chuyển các màn hình Monitor
            sang dùng tài khoản mới và đóng kết nối cũ mà không cần khởi động lại máy chủ.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {target && target.lastTestOk !== true && (
          <div className="rounded-md border border-status-warning-border bg-status-warning-bg p-3 text-xs text-status-warning">
            Lưu ý: Tài khoản này chưa có kết quả Kiểm tra 3 bước đạt gần nhất. Bạn nên chạy Kiểm tra
            trước để đảm bảo tài khoản có đủ quyền truy cập maycha_live và kbmd_live.
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Hủy</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Đang kích hoạt...' : 'Kích hoạt'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
