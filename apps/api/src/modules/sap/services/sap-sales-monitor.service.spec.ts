import { CHAIN_COLUMNS } from '../lib/sales-monitor';
import { SapSalesMonitorService } from './sap-sales-monitor.service';

describe('SapSalesMonitorService (Frozen Snapshot, Active Store Filtering & Extra Column Passthrough)', () => {
  const createMocks = (
    activeStores: string[] = ['MC001'],
    extraPoCols: string[] = [],
  ) => {
    let storeConfigEpoch = 0;
    let queryConfigEpoch = 0;

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
            columns: [
              'Store',
              'PO Number',
              'PO DocDate',
              'PO CreateDate',
              'So dong PO',
              'Tong SL PO',
            ],
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
              'Store',
              'PO Number',
              'PO DocEntry',
              'PO DocDate',
              'PO CreateDate',
              'PO Status',
              'So dong PO',
              'Tong SL PO',
              ...extraPoCols,
            ],
            rows: [
              [
                'MC001',
                1001,
                9001,
                '2026-10-10',
                '2026-10-10',
                'O',
                1,
                5,
                ...extraPoCols.map((c) => `val-${c}-1001`),
              ],
              [
                'MC999',
                1002,
                9002,
                '2026-10-10',
                '2026-10-10',
                'O',
                1,
                10,
                ...extraPoCols.map((c) => `val-${c}-1002`),
              ],
            ],
          };
        }
        return { columns: ['PO Number'], rows: [] };
      }),
    };

    const storeService = {
      getConfigEpoch: jest.fn(() => storeConfigEpoch),
      bumpEpoch: () => {
        storeConfigEpoch++;
      },
      getActiveStoreCodes: jest.fn(async () => new Set(activeStores)),
    };

    const snapshot = {
      epoch: 0,
      sqlByKey: new Map(),
      versionByKey: new Map(),
    };

    const queryConfigService = {
      getConfigEpoch: jest.fn(() => queryConfigEpoch),
      bumpEpoch: () => {
        queryConfigEpoch++;
      },
      getSnapshot: jest.fn(async () => snapshot),
      buildSalesListSqlMap: jest.fn(() => ({
        funnel: 'sql:funnel',
        t1: 'sql:t1',
        t2: 'sql:t2',
        t3: 'sql:t3',
        t4: 'sql:t4',
        ar: 'sql:ar',
        grpo: 'sql:grpo',
        ap: 'sql:ap',
      })),
      buildSalesChainSqlMap: jest.fn(() => ({
        po: 'sql:chain_po',
        so: 'sql:chain_so',
        ar: 'sql:chain_ar',
        grpo: 'sql:chain_grpo',
        ap: 'sql:chain_ap',
      })),
    };

    const service = new SapSalesMonitorService(
      gateway as never,
      storeService as never,
      queryConfigService as never,
    );
    return { gateway, storeService, queryConfigService, snapshot, service };
  };

  it('lọc bỏ các kho không nằm trong activeStoreCodes khỏi cả chain, overview và lists', async () => {
    const { service, queryConfigService, snapshot } = createMocks(['MC001']);

    const res = await service.getSalesMonitor({
      dateFrom: '20261007',
      brand: '5001',
    });

    expect(queryConfigService.getSnapshot).toHaveBeenCalledTimes(1);
    expect(queryConfigService.buildSalesListSqlMap).toHaveBeenCalledWith(
      snapshot,
      '20261007',
      '5001',
    );
    expect(res.cohorts.tatCa.poCount).toBe(1);
    expect(res.lists.chain.columns).toEqual([...CHAIN_COLUMNS]);
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

  it('tự động vô hiệu hóa cache 60s ngay khi configEpoch của SapStoreService hoặc SapQueryConfigService tăng', async () => {
    const { gateway, storeService, queryConfigService, service } = createMocks([
      'MC001',
    ]);

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

    queryConfigService.bumpEpoch();
    const fourth = await service.getSalesMonitor({
      dateFrom: '20261007',
      brand: '5001',
    });
    expect(fourth.meta.fromCache).toBe(false);
    expect(gateway.run).toHaveBeenCalledTimes(39);
  });

  it('passthrough cột phụ mới thêm trên chain_po ra lists.chain và ẩn cột nội bộ PO DocEntry', async () => {
    const { service } = createMocks(['MC001'], ['Ghi chú UDF']);

    const res = await service.getSalesMonitor({
      dateFrom: '20261007',
      brand: '5001',
    });

    expect(res.lists.chain.columns).toEqual([...CHAIN_COLUMNS, 'Ghi chú UDF']);
    expect(res.lists.chain.columns).not.toContain('PO DocEntry');
    expect(res.lists.chain.rows[0]?.[23]).toBe('val-Ghi chú UDF-1001');
  });

  it('ném lỗi rõ ràng nếu lô 300 PO cũ trả về cấu trúc cột lệch với nhóm mới', async () => {
    const { gateway, queryConfigService, snapshot, service } = createMocks([
      'MC001',
    ]);
    gateway.run.mockImplementation(async (key: string) => {
      if (key === 'sales-list:ar') {
        return {
          columns: ['Store', 'PO Number', 'PO DocDate'],
          rows: [['MC001', 900, '2026-10-01']],
        };
      }
      if (key === 'sales-chain:po') {
        return {
          columns: ['Store', 'PO Number', 'PO DocDate'],
          rows: [['MC001', 1001, '2026-10-10']],
        };
      }
      if (key === 'sales-chain-old:po:0') {
        return {
          columns: ['Store', 'PO Number', 'PO DocDate', 'Extra Mismatched Col'],
          rows: [['MC001', 900, '2026-10-01', 'X']],
        };
      }
      return { columns: ['Store', 'PO Number', 'PO DocDate'], rows: [] };
    });

    await expect(
      service.getSalesMonitor({
        dateFrom: '20261007',
        brand: '5001',
      }),
    ).rejects.toThrow(/Lệch cấu trúc cột khi nối lô PO cũ/);
    expect(queryConfigService.buildSalesChainSqlMap).toHaveBeenCalledWith(
      snapshot,
      '20261007',
      '5001',
      [900],
    );
  });
});
