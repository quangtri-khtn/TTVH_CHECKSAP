'use client';

import { useCallback, useMemo, useState } from 'react';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { PERMISSIONS } from '@/lib/auth/permission-keys';
import {
  useSapBrandsGet,
  useSapStoresGet,
} from '@/lib/api/generated/sap-stores/sap-stores';
import {
  calculateBrandToggleStats,
  calculateStoreMetrics,
  filterStores,
  type SapStoreFilterState,
} from '@/lib/admin/sap-store-domain';
import { useSapStoreActions } from '@/features/admin/sap-stores/hooks/use-sap-store-actions';
import { SapStoresMetrics } from '@/features/admin/sap-stores/components/sap-stores-metrics';
import { SapStoresToolbar } from '@/features/admin/sap-stores/components/sap-stores-toolbar';
import { createSapStoresColumns } from '@/features/admin/sap-stores/components/sap-stores-columns';
import { SapStoresTable } from '@/features/admin/sap-stores/components/sap-stores-table';
import { SapStoresSyncDialog } from '@/features/admin/sap-stores/components/sap-stores-sync-dialog';

const INITIAL_FILTERS: SapStoreFilterState = {
  brandCode: 'all',
  search: '',
  activityFilter: 'all',
};

export default function AdminSapStoresPage() {
  const [filters, setFilters] = useState<SapStoreFilterState>(INITIAL_FILTERS);

  const brandsQuery = useSapBrandsGet();
  const storesQuery = useSapStoresGet({ limit: 2000 });

  const brands = useMemo(() => brandsQuery.data?.data.data ?? [], [brandsQuery.data]);
  const allStores = useMemo(() => storesQuery.data?.data.data ?? [], [storesQuery.data]);

  const metrics = useMemo(() => calculateStoreMetrics(allStores), [allStores]);
  const brandToggleStats = useMemo(
    () => calculateBrandToggleStats(allStores, filters.brandCode),
    [allStores, filters.brandCode],
  );
  const filteredStores = useMemo(
    () => filterStores(allStores, filters),
    [allStores, filters],
  );

  const {
    toggleStoreActive,
    toggleBrandActive,
    syncStores,
    updatingStoreCode,
    isBulkUpdatingBrand,
    isSyncing,
    syncDialogOpen,
    setSyncDialogOpen,
  } = useSapStoreActions();

  const handleChangeFilters = useCallback((next: Partial<SapStoreFilterState>) => {
    setFilters((prev) => ({ ...prev, ...next }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
  }, []);

  const columns = useMemo(
    () =>
      createSapStoresColumns({
        updatingStoreCode,
        onToggleActive: toggleStoreActive,
      }),
    [updatingStoreCode, toggleStoreActive],
  );

  return (
    <RequirePermission permission={PERMISSIONS.SAP_STORE_MANAGE}>
      <div className="flex flex-1 flex-col gap-4">
        <div>
          <h1 className="font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Cửa hàng SAP (OWHS)
          </h1>
          <p className="text-xs text-muted-foreground">
            Đồng bộ danh mục cửa hàng từ SAP HANA và kiểm soát cửa hàng nào được phép đưa vào truy
            vấn Monitor Bán hàng &amp; Luồng trả.
          </p>
        </div>

        <SapStoresMetrics metrics={metrics} isLoading={storesQuery.isLoading} />

        <SapStoresToolbar
          brands={brands}
          filters={filters}
          brandToggleStats={brandToggleStats}
          filteredCount={filteredStores.length}
          totalCount={allStores.length}
          isSyncing={isSyncing}
          isBulkUpdatingBrand={isBulkUpdatingBrand}
          onChangeFilters={handleChangeFilters}
          onResetFilters={handleResetFilters}
          onToggleBrandActive={toggleBrandActive}
          onOpenSyncDialog={() => setSyncDialogOpen(true)}
        />

        <SapStoresTable
          columns={columns}
          data={filteredStores}
          isLoading={storesQuery.isLoading}
        />

        <SapStoresSyncDialog
          open={syncDialogOpen}
          onOpenChange={setSyncDialogOpen}
          isSyncing={isSyncing}
          onConfirmSync={syncStores}
        />
      </div>
    </RequirePermission>
  );
}
