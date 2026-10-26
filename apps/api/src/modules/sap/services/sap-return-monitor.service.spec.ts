import { SapReturnMonitorService } from './sap-return-monitor.service';

describe('SapReturnMonitorService (Active Store Filtering & Cache)', () => {
  const createMocks = (activeStores: string[] = ['MC073']) => {
    let configEpoch = 0;
    const gateway = {
      getPoolEpoch: jest.fn(() => 1),
      run: jest.fn(async (key: string) => {
        if (key === 'return-list:po') {
          return {
            columns: [
              'PO Number',
              'PO DocDate',
              'PO CreateDate',
              'Store',
              'Brand',
              'MC Docnum',
              'Kho PO min',
              'Kho PO max',
            ],
            rows: [
              [4001, '2026-10-10', '2026-10-10', 'MC073', '5001', 'MC073-001', 'DC001', 'DC001'],
              [4002, '2026-10-10', '2026-10-10', 'MC999', '5001', 'MC999-001', 'DC001', 'DC001'],
            ],
          };
        }
        if (key === 'return-list:whs') {
          return {
            columns: ['DB', 'WhsCode', 'WhsName'],
            rows: [
              ['T', 'MC073', 'Cửa hàng MC073'],
              ['T', 'MC999', 'Cửa hàng MC999'],
              ['K', 'DC001', 'Kho Tổng DC001'],
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

    const service = new SapReturnMonitorService(
      gateway as never,
      storeService as never,
    );
    return { gateway, storeService, service };
  };

  it('lọc bỏ các kho không nằm trong activeStoreCodes khỏi chainTable và cohorts', async () => {
    const { service } = createMocks(['MC073']);

    const res = await service.getReturnMonitor({
      dateFrom: '20261007',
      brand: '5001',
    });

    expect(res.cohorts.tatCa.poCount).toBe(1);
    expect(res.lists.chain.rows).toHaveLength(1);
    expect(res.lists.chain.rows[0][1]).toBe('MC073');
  });

  it('fallback giữ nguyên toàn bộ kho khi activeStoreCodes rỗng (Set.size === 0)', async () => {
    const { service } = createMocks([]);

    const res = await service.getReturnMonitor({
      dateFrom: '20261007',
      brand: '5001',
    });

    expect(res.cohorts.tatCa.poCount).toBe(2);
    expect(res.lists.chain.rows).toHaveLength(2);
  });
});
