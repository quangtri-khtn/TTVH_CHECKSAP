'use client';

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getSapBrandsGetQueryKey,
  getSapStoresGetQueryKey,
  useSapStoreUpdate,
  useSapStoresSync,
} from '@/lib/api/generated/sap-stores/sap-stores';
import {
  getSapReturnMonitorGetDataQueryKey,
  getSapSalesMonitorGetDataQueryKey,
} from '@/lib/api/generated/sap-monitor/sap-monitor';

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function useSapStoreActions() {
  const queryClient = useQueryClient();
  const [updatingStoreCode, setUpdatingStoreCode] = useState<string | null>(null);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);

  const updateMutation = useSapStoreUpdate();
  const syncMutation = useSapStoresSync();

  const invalidateAllMonitorAndStores = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getSapStoresGetQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getSapBrandsGetQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getSapSalesMonitorGetDataQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getSapReturnMonitorGetDataQueryKey() }),
    ]);
  }, [queryClient]);

  const toggleActiveSales = useCallback(
    async (code: string, currentVal: boolean) => {
      setUpdatingStoreCode(code);
      try {
        const nextVal = !currentVal;
        await updateMutation.mutateAsync({
          code,
          data: { isActiveSales: nextVal },
        });
        toast.success(
          nextVal
            ? `Đã bật kho ${code} cho Monitor Bán hàng`
            : `Đã tắt kho ${code} khỏi Monitor Bán hàng`,
        );
        await invalidateAllMonitorAndStores();
      } catch (err) {
        toast.error(getErrorMessage(err, `Không thể cập nhật trạng thái kho ${code}`));
      } finally {
        setUpdatingStoreCode(null);
      }
    },
    [updateMutation, invalidateAllMonitorAndStores],
  );

  const toggleActiveReturn = useCallback(
    async (code: string, currentVal: boolean) => {
      setUpdatingStoreCode(code);
      try {
        const nextVal = !currentVal;
        await updateMutation.mutateAsync({
          code,
          data: { isActiveReturn: nextVal },
        });
        toast.success(
          nextVal
            ? `Đã bật kho ${code} cho Monitor Luồng trả`
            : `Đã tắt kho ${code} khỏi Monitor Luồng trả`,
        );
        await invalidateAllMonitorAndStores();
      } catch (err) {
        toast.error(getErrorMessage(err, `Không thể cập nhật trạng thái kho ${code}`));
      } finally {
        setUpdatingStoreCode(null);
      }
    },
    [updateMutation, invalidateAllMonitorAndStores],
  );

  const syncStores = useCallback(async () => {
    try {
      const res = await syncMutation.mutateAsync();
      const result = res.data.data;
      toast.success(
        `Đồng bộ thành công ${result.totalFetched} kho từ SAP (Thêm mới: ${result.inserted}, Cập nhật: ${result.updated})`,
      );
      await invalidateAllMonitorAndStores();
      setSyncDialogOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Đồng bộ danh sách cửa hàng từ SAP thất bại'));
    }
  }, [syncMutation, invalidateAllMonitorAndStores]);

  return {
    toggleActiveSales,
    toggleActiveReturn,
    syncStores,
    isUpdatingStore: updateMutation.isPending,
    updatingStoreCode,
    isSyncing: syncMutation.isPending,
    syncDialogOpen,
    setSyncDialogOpen,
  };
}
