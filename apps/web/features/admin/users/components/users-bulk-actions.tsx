'use client';

import { Ban, RotateCcw } from 'lucide-react';
import type { Table } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DataTableBulkActions } from '@/components/data-table';
import type { UserResponseDto } from '@/lib/api/generated/model';
import { canActorManageUser, canActorDeactivateUser } from '@/lib/admin/user-manage-guards';
/**
 * Hành động hàng loạt cho bảng người dùng. Chỉ mở hộp xác nhận — việc gọi API
 * do trang đảm nhiệm để giữ side-effect ở một chỗ.
 */
export function UsersBulkActions({
  table,
  currentUserId: _currentUserId,
  actor,
  canManage = true,
  onDeactivateSelected,
  onReactivateSelected,
}: {
  table: Table<UserResponseDto>;
  currentUserId: string;
  actor?: UserResponseDto;
  canManage?: boolean;
  onDeactivateSelected: (users: UserResponseDto[]) => void;
  onReactivateSelected: (users: UserResponseDto[]) => void;
}) {
  if (!canManage) {
    return null;
  }

  const selected = table.getFilteredSelectedRowModel().rows.map((row) => row.original);
  const activeSelected = selected.filter((user) => user.isActive);
  const deactivatable = activeSelected.filter((user) => canActorDeactivateUser(actor, user));
  const skippedDeactivate = activeSelected.length - deactivatable.length;

  const inactiveSelected = selected.filter((user) => !user.isActive);
  const reactivatable = inactiveSelected.filter((user) => canActorManageUser(actor, user));
  const skippedReactivate = inactiveSelected.length - reactivatable.length;

  const handleDeactivate = () => {
    if (skippedDeactivate > 0) {
      toast.info(
        `Đã bỏ qua ${skippedDeactivate} người dùng không thể vô hiệu hoá (do không đủ quyền hoặc là chính bạn).`,
      );
    }
    if (deactivatable.length > 0) {
      onDeactivateSelected(deactivatable);
    }
  };

  const handleReactivate = () => {
    if (skippedReactivate > 0) {
      toast.info(
        `Đã bỏ qua ${skippedReactivate} người dùng không thể kích hoạt lại do không đủ quyền.`,
      );
    }
    if (reactivatable.length > 0) {
      onReactivateSelected(reactivatable);
    }
  };
  return (
    <DataTableBulkActions table={table} entityName="người dùng">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              aria-label={`Vô hiệu hoá ${deactivatable.length} người dùng`}
              disabled={deactivatable.length === 0}
              onClick={handleDeactivate}
            />
          }
        >
          <Ban />
        </TooltipTrigger>
        <TooltipContent>
          {deactivatable.length > 0
            ? `Vô hiệu hoá ${deactivatable.length} người dùng`
            : 'Không có tài khoản nào vô hiệu hoá được'}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              aria-label={`Kích hoạt lại ${reactivatable.length} người dùng`}
              disabled={reactivatable.length === 0}
              onClick={handleReactivate}
            />
          }
        >
          <RotateCcw />
        </TooltipTrigger>
        <TooltipContent>
          {reactivatable.length > 0
            ? `Kích hoạt lại ${reactivatable.length} người dùng`
            : 'Không có tài khoản nào cần kích hoạt lại'}
        </TooltipContent>
      </Tooltip>
    </DataTableBulkActions>
  );
}
