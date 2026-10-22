'use client';

import { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserListUsers } from '@/lib/api/generated/users/users';
import { useUserActions } from '@/features/admin/hooks/use-user-actions';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { usePermissions } from '@/lib/auth/use-permissions';
import { PERMISSIONS } from '@/lib/auth/permission-keys';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { AdminPageHeader } from '@/features/admin/components/admin-page-header';
import { AdminStatusDialog } from '@/features/admin/components/admin-status-dialog';
import {
  UsersMutateDrawer,
  type UserMutateFormValues,
} from '@/features/admin/users/components/users-mutate-drawer';
import { UsersTable } from '@/features/admin/users/components/users-table';
import type { UserResponseDto } from '@/lib/api/generated/model';

const FETCH_LIMIT = 1000;

type BulkTarget = { mode: 'deactivate' | 'reactivate'; users: UserResponseDto[] };

export default function AdminUsersPage() {
  const [drawerState, setDrawerState] = useState<{ open: boolean; user?: UserResponseDto }>({
    open: false,
  });
  const [statusTarget, setStatusTarget] = useState<UserResponseDto | null>(null);
  const [bulkTarget, setBulkTarget] = useState<BulkTarget | null>(null);

  const { user: currentUser } = useCurrentUser();
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.USER_MANAGE);
  const listQuery = useUserListUsers({ limit: FETCH_LIMIT, includeInactive: true });
  const { create, update, deactivate, reactivate, isPending } = useUserActions();

  const handleEdit = useCallback((row: UserResponseDto) => {
    setDrawerState({ open: true, user: row });
  }, []);

  const handleToggleActive = useCallback((row: UserResponseDto) => {
    setStatusTarget(row);
  }, []);

  const handleDeactivateSelected = useCallback((users: UserResponseDto[]) => {
    setBulkTarget({ mode: 'deactivate', users });
  }, []);

  const handleReactivateSelected = useCallback((users: UserResponseDto[]) => {
    setBulkTarget({ mode: 'reactivate', users });
  }, []);

  const handleSubmit = async (values: UserMutateFormValues) => {
    try {
      if (drawerState.user) {
        const isSelf = Boolean(
          (currentUser && drawerState.user.id === currentUser.id) ||
            values.role === undefined,
        );
        await update(drawerState.user.id, {
          email: values.email,
          name: values.name,
          ...(isSelf
            ? {}
            : {
                role: values.role,
                customPermissions: values.customPermissions,
              }),
          ...(values.password ? { password: values.password } : {}),
        });
      } else {
        await create({
          email: values.email,
          password: values.password,
          name: values.name,
          role: values.role!,
          customPermissions: values.customPermissions,
        });
      }
      setDrawerState({ open: false });
    } catch {
      // Giữ drawer mở khi có lỗi để người dùng sửa form
    }
  };

  const handleConfirmToggle = async () => {
    if (!statusTarget) return;
    if (statusTarget.isActive) {
      await deactivate(statusTarget.id);
    } else {
      await reactivate(statusTarget.id);
    }
    setStatusTarget(null);
  };

  const handleConfirmBulk = async () => {
    if (!bulkTarget) return;
    for (const user of bulkTarget.users) {
      if (bulkTarget.mode === 'deactivate') {
        await deactivate(user.id);
      } else {
        await reactivate(user.id);
      }
    }
    setBulkTarget(null);
  };

  return (
    <RequirePermission permission={PERMISSIONS.USER_READ}>
      <div className="flex flex-1 flex-col gap-4 sm:gap-6">
        <AdminPageHeader
          title="Người dùng"
          description="Quản lý tài khoản và phân quyền truy cập hệ thống SAP Monitor."
          actions={
            canManage ? (
              <Button onClick={() => setDrawerState({ open: true })}>
                <Plus className="size-4 mr-1.5" />
                Thêm người dùng
              </Button>
            ) : undefined
          }
        />

        <UsersTable
          data={listQuery.data?.data.data ?? []}
          isLoading={listQuery.isLoading}
          currentUserId={currentUser?.id ?? ''}
          currentUser={currentUser}
          onEdit={handleEdit}
          onToggleActive={handleToggleActive}
          onDeactivateSelected={handleDeactivateSelected}
          onReactivateSelected={handleReactivateSelected}
        />

        <UsersMutateDrawer
          open={drawerState.open}
          onOpenChange={(open) => setDrawerState(open ? drawerState : { open: false })}
          currentRow={drawerState.user}
          onSubmit={handleSubmit}
          isPending={isPending}
        />

        <AdminStatusDialog
          open={statusTarget !== null}
          onOpenChange={(open) => !open && setStatusTarget(null)}
          mode={statusTarget?.isActive ? 'deactivate' : 'reactivate'}
          entityLabel="người dùng này"
          description={{
            deactivate:
              'Người dùng này sẽ không thể đăng nhập vào hệ thống. Dữ liệu đã tạo vẫn được giữ lại và bạn có thể kích hoạt lại bất cứ lúc nào.',
            reactivate: 'Người dùng này sẽ có thể đăng nhập trở lại vào hệ thống.',
          }}
          extraWarning={
            statusTarget?.isActive
              ? 'Phiên đăng nhập hiện tại của người dùng này sẽ bị chấm dứt ngay lập tức.'
              : undefined
          }
          onConfirm={handleConfirmToggle}
          isPending={isPending}
        />

        <AdminStatusDialog
          open={bulkTarget !== null}
          onOpenChange={(open) => !open && setBulkTarget(null)}
          mode={bulkTarget?.mode ?? 'deactivate'}
          entityLabel={`${bulkTarget?.users.length ?? 0} người dùng đã chọn`}
          description={{
            deactivate:
              'Những người dùng này sẽ không thể đăng nhập vào hệ thống. Dữ liệu đã tạo vẫn được giữ lại và bạn có thể kích hoạt lại bất cứ lúc nào.',
            reactivate: 'Những người dùng này sẽ có thể đăng nhập trở lại vào hệ thống.',
          }}
          extraWarning={
            bulkTarget?.mode === 'deactivate'
              ? 'Phiên đăng nhập hiện tại của những người dùng này sẽ bị chấm dứt ngay lập tức.'
              : undefined
          }
          onConfirm={handleConfirmBulk}
          isPending={isPending}
        />
      </div>
    </RequirePermission>
  );
}
