'use client';

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getSapBrandsGetQueryKey,
  getSapStoresGetQueryKey,
  useSapStoreUpdate,
  useSapStoresBulkUpdateByBrand,
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
  const bulkBrandMutation = useSapStoresBulkUpdateByBrand();
  const syncMutation = useSapStoresSync();

  const invalidateAllMonitorAndStores = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getSapStoresGetQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getSapBrandsGetQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getSapSalesMonitorGetDataQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getSapReturnMonitorGetDataQueryKey() }),
    ]);
  }, [queryClient]);

  const toggleStoreActive = useCallback(
    async (code: string, currentVal: boolean) => {
      setUpdatingStoreCode(code);
      try {
        const nextVal = !currentVal;
        await updateMutation.mutateAsync({
          code,
          data: { isActiveSales: nextVal, isActiveReturn: nextVal },
        });
        toast.success(
          nextVal
            ? `Đã bật cho phép Query cho kho ${code}`
            : `Đã tắt cho phép Query cho kho ${code}`,
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

  const toggleBrandActive = useCallback(
    async (brandCode: string, nextVal: boolean) => {
      try {
        const res = await bulkBrandMutation.mutateAsync({
          data: { brandCode, isActive: nextVal },
        });
        const result = res.data.data;
        toast.success(
          nextVal
            ? `Đã bật ${result.updatedCount} kho hoạt động trên SAP của thương hiệu ${brandCode}`
            : `Đã tắt toàn bộ (${result.updatedCount}) kho của thương hiệu ${brandCode}`,
        );
        await invalidateAllMonitorAndStores();
      } catch (err) {
        toast.error(
          getErrorMessage(err, `Không thể cập nhật hàng loạt cho thương hiệu ${brandCode}`),
        );
      }
    },
    [bulkBrandMutation, invalidateAllMonitorAndStores],
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
    toggleStoreActive,
    toggleBrandActive,
    syncStores,
    isUpdatingStore: updateMutation.isPending,
    isBulkUpdatingBrand: bulkBrandMutation.isPending,
    updatingStoreCode,
    isSyncing: syncMutation.isPending,
    syncDialogOpen,
    setSyncDialogOpen,
  };
}
