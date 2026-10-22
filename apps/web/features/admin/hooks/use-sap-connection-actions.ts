import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/http-client';
import { getSapConnectionErrorMessage } from '@/lib/admin/sap-connection-schemas';
import {
  useSapConnectionCreateConnection,
  useSapConnectionUpdateConnection,
  useSapConnectionTestConnection,
  useSapConnectionActivateConnection,
  getSapConnectionListConnectionsQueryKey,
} from '@/lib/api/generated/sap-connections/sap-connections';
import type {
  CreateSapConnectionDto,
  SapConnectionDto,
  SapConnectionTestResultDto,
  UpdateSapConnectionDto,
} from '@/lib/api/generated/model';

export function useSapConnectionActions() {
  const queryClient = useQueryClient();
  const createMutation = useSapConnectionCreateConnection();
  const updateMutation = useSapConnectionUpdateConnection();
  const testMutation = useSapConnectionTestConnection();
  const activateMutation = useSapConnectionActivateConnection();

  const invalidateList = () =>
    queryClient.invalidateQueries({ queryKey: getSapConnectionListConnectionsQueryKey() });

  const create = async (dto: CreateSapConnectionDto): Promise<SapConnectionDto> => {
    try {
      const res = await createMutation.mutateAsync({ data: dto });
      await invalidateList();
      toast.success('Đã thêm tài khoản kết nối SAP');
      return res.data.data;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        await invalidateList();
      }
      toast.error(getSapConnectionErrorMessage(err, 'Không thể thêm tài khoản kết nối SAP'));
      throw err;
    }
  };

  const update = async (
    id: string,
    dto: UpdateSapConnectionDto,
    isActiveRow?: boolean,
  ): Promise<SapConnectionDto> => {
    try {
      const res = await updateMutation.mutateAsync({ id, data: dto });
      await invalidateList();
      toast.success('Đã cập nhật tài khoản kết nối SAP');
      return res.data.data;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        await invalidateList();
      }
      const baseMsg = getSapConnectionErrorMessage(err, 'Không thể cập nhật tài khoản kết nối SAP');
      const message =
        isActiveRow && err instanceof ApiError && [502, 503, 504].includes(err.status)
          ? `${baseMsg} (Chưa lưu thay đổi, kết nối cũ vẫn đang dùng)`
          : baseMsg;
      toast.error(message);
      throw err;
    }
  };

  const testConnection = async (id: string): Promise<SapConnectionTestResultDto> => {
    try {
      const res = await testMutation.mutateAsync({ id });
      await invalidateList();
      return res.data.data;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        await invalidateList();
      }
      toast.error(getSapConnectionErrorMessage(err, 'Không thể kiểm tra kết nối SAP'));
      throw err;
    }
  };

  const activate = async (id: string): Promise<SapConnectionDto> => {
    try {
      const res = await activateMutation.mutateAsync({ id });
      await invalidateList();
      toast.success('Đã kích hoạt tài khoản kết nối SAP');
      return res.data.data;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        await invalidateList();
      }
      toast.error(getSapConnectionErrorMessage(err, 'Không thể kích hoạt tài khoản kết nối SAP'));
      throw err;
    }
  };

  return {
    create,
    update,
    testConnection,
    activate,
    isMutatingForm: createMutation.isPending || updateMutation.isPending,
    isTesting: testMutation.isPending,
    testingId: testMutation.isPending ? (testMutation.variables?.id ?? null) : null,
    isActivating: activateMutation.isPending,
    activatingId: activateMutation.isPending ? (activateMutation.variables?.id ?? null) : null,
  };
}
