import type { SapStoreDto } from '@/lib/api/generated/model';

export type StoreActivityFilter = 'all' | 'active_sales' | 'active_return' | 'inactive_both' | 'sap_inactive';

export interface SapStoreFilterState {
  brandCode: string;
  search: string;
  activityFilter: StoreActivityFilter;
}

export interface SapStoreMetrics {
  total: number;
  activeSalesCount: number;
  activeReturnCount: number;
  sapActiveCount: number;
  lastSyncedAt: string | null;
}

export function calculateStoreMetrics(stores: readonly SapStoreDto[]): SapStoreMetrics {
  let activeSalesCount = 0;
  let activeReturnCount = 0;
  let sapActiveCount = 0;
  let latestMs = 0;
  let lastSyncedAt: string | null = null;

  for (const store of stores) {
    if (store.isActiveSales) activeSalesCount++;
    if (store.isActiveReturn) activeReturnCount++;
    if (!store.sapInactive) sapActiveCount++;
    if (store.syncedAt) {
      const ms = Date.parse(store.syncedAt);
      if (Number.isFinite(ms) && ms > latestMs) {
        latestMs = ms;
        lastSyncedAt = store.syncedAt;
      }
    }
  }

  return {
    total: stores.length,
    activeSalesCount,
    activeReturnCount,
    sapActiveCount,
    lastSyncedAt,
  };
}

export function filterStores(
  stores: readonly SapStoreDto[],
  filters: SapStoreFilterState,
): SapStoreDto[] {
  const brandCode = filters.brandCode.trim();
  const q = filters.search.trim().toLowerCase();
  const { activityFilter } = filters;

  return stores.filter((store) => {
    if (brandCode && brandCode !== 'all' && String(store.brandCode ?? '') !== brandCode) {
      return false;
    }

    if (activityFilter === 'active_sales' && !store.isActiveSales) return false;
    if (activityFilter === 'active_return' && !store.isActiveReturn) return false;
    if (activityFilter === 'inactive_both' && (store.isActiveSales || store.isActiveReturn)) {
      return false;
    }
    if (activityFilter === 'sap_inactive' && !store.sapInactive) return false;

    if (q) {
      const codeMatch = store.code.toLowerCase().includes(q);
      const nameMatch = store.name.toLowerCase().includes(q);
      const brandMatch = String(store.brandName ?? '').toLowerCase().includes(q);
      if (!codeMatch && !nameMatch && !brandMatch) return false;
    }

    return true;
  });
}

export function formatSyncedAt(dateString?: string | null): string {
  if (!dateString) return 'Chưa đồng bộ';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Chưa đồng bộ';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}
