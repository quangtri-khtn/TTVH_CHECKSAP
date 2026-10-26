import type { SapStoreDto } from '@/lib/api/generated/model';
import {
  calculateStoreMetrics,
  filterStores,
  formatSyncedAt,
} from './sap-store-domain';

const MOCK_STORES: SapStoreDto[] = [
  {
    code: 'MC001',
    name: 'MC-001 Nguyễn Trãi',
    brandCode: '5001',
    brandName: 'Maycha',
    sapInactive: false,
    isActiveSales: true,
    isActiveReturn: true,
    syncedAt: '2026-10-26T01:00:00.000Z',
  },
  {
    code: 'MC002',
    name: 'MC-002 Lê Văn Sỹ',
    brandCode: '5001',
    brandName: 'Maycha',
    sapInactive: false,
    isActiveSales: true,
    isActiveReturn: false,
    syncedAt: '2026-10-26T03:00:00.000Z',
  },
  {
    code: 'BB073',
    name: 'BB-263 Trần Hưng Đạo',
    brandCode: '5002',
    brandName: 'Tam Hảo',
    sapInactive: true,
    isActiveSales: false,
    isActiveReturn: false,
    syncedAt: '2026-10-26T02:00:00.000Z',
  },
];

describe('sap-store-domain', () => {
  describe('calculateStoreMetrics', () => {
    it('tính chính xác tổng số kho, active bán, active trả và thời điểm sync mới nhất', () => {
      const metrics = calculateStoreMetrics(MOCK_STORES);
      expect(metrics).toEqual({
        total: 3,
        activeSalesCount: 2,
        activeReturnCount: 1,
        sapActiveCount: 2,
        lastSyncedAt: '2026-10-26T03:00:00.000Z',
      });
    });
  });

  describe('filterStores', () => {
    it('lọc theo brandCode, activityFilter và từ khóa tìm kiếm', () => {
      expect(
        filterStores(MOCK_STORES, {
          brandCode: '5001',
          search: '',
          activityFilter: 'all',
        }).map((s) => s.code),
      ).toEqual(['MC001', 'MC002']);

      expect(
        filterStores(MOCK_STORES, {
          brandCode: 'all',
          search: '',
          activityFilter: 'active_return',
        }).map((s) => s.code),
      ).toEqual(['MC001']);

      expect(
        filterStores(MOCK_STORES, {
          brandCode: 'all',
          search: 'trần hưng đạo',
          activityFilter: 'sap_inactive',
        }).map((s) => s.code),
      ).toEqual(['BB073']);
    });
  });

  describe('formatSyncedAt', () => {
    it('trả về Chưa đồng bộ khi rỗng hoặc không hợp lệ', () => {
      expect(formatSyncedAt(null)).toBe('Chưa đồng bộ');
      expect(formatSyncedAt('invalid')).toBe('Chưa đồng bộ');
      expect(formatSyncedAt('2026-10-26T03:00:00.000Z')).toContain('2026');
    });
  });
});
