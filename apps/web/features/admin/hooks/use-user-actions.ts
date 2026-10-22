import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  useUserCreateUser,
  useUserUpdateUser,
  useUserDeactivateUser,
  useUserReactivateUser,
  getUserListUsersQueryKey,
} from '@/lib/api/generated/users/users';
import { getAuthGetMeQueryKey } from '@/lib/api/generated/auth/auth';
import type { CreateUserDto, UpdateUserDto } from '@/lib/api/generated/model';

function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function useUserActions() {
  const queryClient = useQueryClient();
  const createMutation = useUserCreateUser();
  const updateMutation = useUserUpdateUser();
  const deactivateMutation = useUserDeactivateUser();
  const reactivateMutation = useUserReactivateUser();

  const invalidateList = () => {
    queryClient.invalidateQueries({ queryKey: getUserListUsersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getAuthGetMeQueryKey() });
  };
  const create = async (dto: CreateUserDto) => {
    try {
      await createMutation.mutateAsync({ data: dto });
      toast.success('Đã tạo người dùng');
      invalidateList();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Không thể tạo người dùng'));
      throw err;
    }
  };

  const update = async (id: string, dto: UpdateUserDto) => {
    try {
      await updateMutation.mutateAsync({ id, data: dto });
      toast.success('Đã cập nhật người dùng');
      invalidateList();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Không thể cập nhật người dùng này'));
      throw err;
    }
  };

  // Backend rejects self-deactivation and deactivating the last active
  // ADMIN with 400 — the FE-side "disable my own row" guard is UX only, so
  // this must surface the real backend message rather than swallow it.
  const deactivate = async (id: string) => {
    try {
      await deactivateMutation.mutateAsync({ id });
      toast.success('Đã vô hiệu hoá người dùng');
      invalidateList();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Không thể vô hiệu hoá người dùng này'));
    }
  };

  const reactivate = async (id: string) => {
    try {
      await reactivateMutation.mutateAsync({ id });
      toast.success('Đã kích hoạt lại người dùng');
      invalidateList();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Không thể kích hoạt lại người dùng này'));
    }
  };

  return {
    create,
    update,
    deactivate,
    reactivate,
    isPending:
      createMutation.isPending || updateMutation.isPending || deactivateMutation.isPending || reactivateMutation.isPending,
  };
}
