import { RET_AR_NOINV_COLS, RET_CHAIN_COLUMNS } from '../lib/return-monitor';
import { SapReturnMonitorService } from './sap-return-monitor.service';

describe('SapReturnMonitorService (Frozen Snapshot, 5 ret_old Queries & Extra Column Passthrough)', () => {
  const createMocks = (
    activeStores: string[] = ['MC073'],
    extraPoCols: string[] = [],
    extraArCols: string[] = [],
  ) => {
    let storeConfigEpoch = 0;
    let queryConfigEpoch = 0;

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
              ...extraPoCols,
            ],
            rows: [
              [
                4001,
                '2026-10-10',
                '2026-10-10',
                'MC073',
                '5001',
                'MC073-001',
                'DC001',
                'DC001',
                ...extraPoCols.map((c) => `po-${c}-4001`),
              ],
              [
                4002,
                '2026-10-10',
                '2026-10-10',
                'MC999',
                '5001',
                'MC999-001',
                'DC001',
                'DC001',
                ...extraPoCols.map((c) => `po-${c}-4002`),
              ],
            ],
          };
        }
        if (key === 'return-list:ar') {
          return {
            columns: [
              'PO Number',
              'AR Number',
              'AR DocDate',
              'AR CreateDate',
              'AR ShipDate',
              'Invoice No',
              ...extraArCols,
            ],
            rows: [
              [
                4001,
                8001,
                '2026-10-11',
                '2026-10-11',
                '2026-10-12',
                null,
                ...extraArCols.map((c) => `ar-${c}-8001`),
              ],
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
      buildReturnMainSqlMap: jest.fn(() => ({
        po: 'sql:ret_po',
        so: 'sql:ret_so',
        do: 'sql:ret_do',
        ar: 'sql:ret_ar',
        grpo: 'sql:ret_grpo',
        ap: 'sql:ret_ap',
        whs: 'sql:ret_whs',
      })),
      buildReturnOldDiscoverySqlMap: jest.fn(() => ({
        ret_old_1: 'sql:ret_old_1',
        ret_old_2: 'sql:ret_old_2',
        ret_old_3: 'sql:ret_old_3',
        ret_old_4: 'sql:ret_old_4',
        ret_old_5: 'sql:ret_old_5',
      })),
    };

    const service = new SapReturnMonitorService(
      gateway as never,
      storeService as never,
      queryConfigService as never,
    );
    return { gateway, storeService, queryConfigService, snapshot, service };
  };

  it('lọc bỏ các kho không nằm trong activeStoreCodes và chạy tuần tự 5 câu ret_old_1..5', async () => {
    const { gateway, queryConfigService, snapshot, service } = createMocks([
      'MC073',
    ]);

    const res = await service.getReturnMonitor({
      dateFrom: '20261007',
      brand: '5001',
    });

    expect(queryConfigService.getSnapshot).toHaveBeenCalledTimes(1);
    expect(queryConfigService.buildReturnOldDiscoverySqlMap).toHaveBeenCalledWith(
      snapshot,
      '20261007',
      '5001',
    );
    // 7 main queries + 5 ret_old_1..5 queries = 12 queries when oldPoSet is empty
    expect(res.meta.queryCount).toBe(12);
    expect(gateway.run).toHaveBeenCalledWith(
      'return-candidates:ret_old_1',
      'sql:ret_old_1',
    );
    expect(gateway.run).toHaveBeenCalledWith(
      'return-candidates:ret_old_5',
      'sql:ret_old_5',
    );
    expect(res.cohorts.tatCa.poCount).toBe(1);
    expect(res.lists.chain.columns).toEqual([...RET_CHAIN_COLUMNS]);
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

  it('gom PO cũ từ 5 câu ret_old_1..5 (bỏ qua PO đã thuộc nhóm mới) và passthrough cột phụ trên chain + arNoInv', async () => {
    const { gateway, queryConfigService, snapshot, service } = createMocks(
      ['MC073'],
      ['Ghi chú PO'],
      ['Kênh HĐ'],
    );

    gateway.run.mockImplementation(async (key: string) => {
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
            'Ghi chú PO',
          ],
          rows: [
            [
              4001,
              '2026-10-10',
              '2026-10-10',
              'MC073',
              '5001',
              'MC073-001',
              'DC001',
              'DC001',
              'PO Mới',
            ],
          ],
        };
      }
      if (key === 'return-list:ar') {
        return {
          columns: [
            'PO Number',
            'AR Number',
            'AR DocDate',
            'AR CreateDate',
            'AR ShipDate',
            'Invoice No',
            'Kênh HĐ',
          ],
          rows: [
            [4001, 8001, '2026-10-11', '2026-10-11', '2026-10-12', null, 'E-Inv'],
          ],
        };
      }
      if (key === 'return-candidates:ret_old_1') {
        return {
          columns: ['PO Number'],
          rows: [[4001], [3500]],
        };
      }
      if (key === 'return-candidates:ret_old_3') {
        return {
          columns: ['PO Number'],
          rows: [[3500], [3499]],
        };
      }
      if (key === 'return-old:po:0') {
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
            'Ghi chú PO',
          ],
          rows: [
            [
              3499,
              '2026-10-01',
              '2026-10-01',
              'MC073',
              '5001',
              'MC073-OLD',
              'DC001',
              'DC001',
              'PO Cũ 3499',
            ],
          ],
        };
      }
      if (key === 'return-old:ar:0') {
        return {
          columns: [
            'PO Number',
            'AR Number',
            'AR DocDate',
            'AR CreateDate',
            'AR ShipDate',
            'Invoice No',
            'Kênh HĐ',
          ],
          rows: [],
        };
      }
      return { columns: ['PO Number'], rows: [] };
    });

    const res = await service.getReturnMonitor({
      dateFrom: '20261007',
      brand: '5001',
    });

    expect(queryConfigService.buildReturnMainSqlMap).toHaveBeenCalledWith(
      snapshot,
      '20261007',
      '5001',
      [3499, 3500],
    );
    expect(res.lists.chain.columns).toEqual([
      ...RET_CHAIN_COLUMNS,
      'Ghi chú PO',
    ]);
    expect(res.lists.chain.rows).toHaveLength(2);
    expect(res.lists.chain.rows[0]?.[28]).toBe('PO Cũ 3499');
    expect(res.lists.chain.rows[1]?.[28]).toBe('PO Mới');
    expect(res.lists.arNoInv.columns).toEqual([
      ...RET_AR_NOINV_COLS,
      'Kênh HĐ',
    ]);
    expect(res.lists.arNoInv.rows[0]?.[15]).toBe('E-Inv');
  });

  it('tự động vô hiệu hóa cache 60s khi configEpoch của SapStoreService hoặc SapQueryConfigService tăng và chặn lệch cột lô 300 PO cũ', async () => {
    const { gateway, storeService, queryConfigService, service } = createMocks([
      'MC073',
    ]);

    const first = await service.getReturnMonitor({
      dateFrom: '20261007',
      brand: '5001',
    });
    expect(first.meta.fromCache).toBe(false);

    const second = await service.getReturnMonitor({
      dateFrom: '20261007',
      brand: '5001',
    });
    expect(second.meta.fromCache).toBe(true);

    storeService.bumpEpoch();
    const third = await service.getReturnMonitor({
      dateFrom: '20261007',
      brand: '5001',
    });
    expect(third.meta.fromCache).toBe(false);

    queryConfigService.bumpEpoch();
    gateway.run.mockImplementation(async (key: string) => {
      if (key === 'return-candidates:ret_old_1') {
        return { columns: ['PO Number'], rows: [[3000]] };
      }
      if (key === 'return-old:po:0') {
        return {
          columns: ['PO Number', 'Mismatched Col'],
          rows: [[3000, 'X']],
        };
      }
      return { columns: ['PO Number'], rows: [] };
    });

    await expect(
      service.getReturnMonitor({
        dateFrom: '20261007',
        brand: '5001',
      }),
    ).rejects.toThrow(/Lệch cấu trúc cột khi nối lô PO cũ/);
  });
});
