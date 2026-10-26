import { SapSalesMonitorService } from './sap-sales-monitor.service';

describe('SapSalesMonitorService (Active Store Filtering & Cache)', () => {
  const createMocks = (activeStores: string[] = ['MC001']) => {
    let configEpoch = 0;
    const gateway = {
      getPoolEpoch: jest.fn(() => 1),
      run: jest.fn(async (key: string) => {
        if (key === 'sales-list:funnel') {
          return {
            columns: [
              'Store',
              'Ten cua hang',
              'PO',
              'SO',
              'A/R',
              'A/R da co HD',
              'GRPO',
              'AP',
            ],
            rows: [
              ['MC001', 'Maycha 1', 1, 1, 0, 0, 0, 0],
              ['MC999', 'Maycha Inactive', 2, 2, 0, 0, 0, 0],
            ],
          };
        }
        if (key === 'sales-list:t1') {
          return {
            columns: ['Store', 'PO Number', 'PO DocDate', 'PO CreateDate', 'So dong PO', 'Tong SL PO'],
            rows: [
              ['MC001', 1001, '2026-10-10', '2026-10-10', 1, 5],
              ['MC999', 1002, '2026-10-10', '2026-10-10', 1, 10],
            ],
          };
        }
        if (key.startsWith('sales-list:')) {
          return { columns: ['Store', 'PO Number', 'PO DocDate'], rows: [] };
        }
        if (key === 'sales-chain:po') {
          return {
            columns: [
              'PO Number',
              'PO DocDate',
              'PO CreateDate',
              'Store',
              'PO Status',
              'So dong PO',
              'Tong SL PO',
            ],
            rows: [
              [1001, '2026-10-10', '2026-10-10', 'MC001', 'O', 1, 5],
              [1002, '2026-10-10', '2026-10-10', 'MC999', 'O', 1, 10],
            ],
          };
        }
        return { columns: ['PO Number'], rows: [] };
      }),
    };

    const storeService = {
      getConfigEpoch: jest.fn(() => configEpoch),
      bumpEpoch: () => {
        configEpoch++;
      },
      getActiveStoreCodes: jest.fn(async () => new Set(activeStores)),
    };

    const service = new SapSalesMonitorService(
      gateway as never,
      storeService as never,
    );
    return { gateway, storeService, service };
  };

  it('lọc bỏ các kho không nằm trong activeStoreCodes khỏi cả chain, overview và lists', async () => {
    const { service } = createMocks(['MC001']);

    const res = await service.getSalesMonitor({
      dateFrom: '20261007',
      brand: '5001',
    });

    expect(res.cohorts.tatCa.poCount).toBe(1);
    expect(res.lists.chain.rows).toHaveLength(1);
    expect(res.lists.chain.rows[0][1]).toBe('MC001');
    expect(res.lists.t1.rows).toHaveLength(1);
    expect(res.lists.t1.rows[0][1]).toBe('MC001');
  });

  it('fallback giữ nguyên toàn bộ kho khi activeStoreCodes rỗng (Set.size === 0)', async () => {
    const { service } = createMocks([]);

    const res = await service.getSalesMonitor({
      dateFrom: '20261007',
      brand: '5001',
    });

    expect(res.cohorts.tatCa.poCount).toBe(2);
    expect(res.lists.chain.rows).toHaveLength(2);
    expect(res.lists.t1.rows).toHaveLength(2);
  });

  it('tự động vô hiệu hóa cache 60s ngay khi configEpoch của SapStoreService tăng', async () => {
    const { gateway, storeService, service } = createMocks(['MC001']);

    const first = await service.getSalesMonitor({
      dateFrom: '20261007',
      brand: '5001',
    });
    expect(first.meta.fromCache).toBe(false);

    const second = await service.getSalesMonitor({
      dateFrom: '20261007',
      brand: '5001',
    });
    expect(second.meta.fromCache).toBe(true);

    storeService.bumpEpoch();
    const third = await service.getSalesMonitor({
      dateFrom: '20261007',
      brand: '5001',
    });
    expect(third.meta.fromCache).toBe(false);
    expect(gateway.run).toHaveBeenCalledTimes(26);
  });
});
