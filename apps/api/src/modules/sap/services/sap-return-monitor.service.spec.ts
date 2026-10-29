import { RET_AR_NOINV_COLS, RET_CHAIN_COLUMNS } from '../lib/return-monitor';
import { SapReturnMonitorService } from './sap-return-monitor.service';

describe('SapReturnMonitorService (Frozen Snapshot, 5 old_sos Queries, 150 SO Batch & Extra Column Passthrough)', () => {
  const createMocks = (
    activeStores: string[] = ['MC073'],
    extraSoCols: string[] = [],
    extraArCols: string[] = [],
  ) => {
    let storeConfigEpoch = 0;
    let queryConfigEpoch = 0;

    const gateway = {
      getPoolEpoch: jest.fn(() => 1),
      run: jest.fn(async (key: string) => {
        if (key === 'return-list:so') {
          return {
            columns: [
              'SO Number',
              'SO DocDate',
              'SO CreateDate',
              'SO Canceled',
              'Store',
              'Brand',
              'MC Docnum',
              'SO ShipDate',
              'Kho SO min',
              'Kho SO max',
              ...extraSoCols,
            ],
            rows: [
              [
                5001,
                '2026-10-10',
                '2026-10-10',
                'N',
                'MC073',
                '5001',
                'MC073-001',
                '2026-10-12',
                'MC073',
                'MC073',
                ...extraSoCols.map((c) => `so-${c}-5001`),
              ],
              [
                5002,
                '2026-10-10',
                '2026-10-10',
                'N',
                'MC999',
                '5001',
                'MC999-001',
                '2026-10-12',
                'MC999',
                'MC999',
                ...extraSoCols.map((c) => `so-${c}-5002`),
              ],
            ],
          };
        }
        if (key === 'return-list:po') {
          return {
            columns: [
              'SO Number',
              'PO Number',
              'PO DocDate',
              'PO CreateDate',
              'Kho PO min',
              'Kho PO max',
            ],
            rows: [[5001, 4001, '2026-10-10', '2026-10-10', 'DC001', 'DC001']],
          };
        }
        if (key === 'return-list:ar') {
          return {
            columns: [
              'SO Number',
              'AR Number',
              'AR DocDate',
              'AR CreateDate',
              'AR ShipDate',
              'Invoice No',
              ...extraArCols,
            ],
            rows: [
              [
                5001,
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
        return { columns: ['SO Number'], rows: [] };
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
        so: 'sql:ret_so',
        po: 'sql:ret_po',
        do: 'sql:ret_do',
        ar: 'sql:ret_ar',
        grpo: 'sql:ret_grpo',
        ap: 'sql:ret_ap',
        whs: 'sql:ret_whs',
      })),
      buildReturnOldDiscoverySqlMap: jest.fn(() => ({
        old_sos_1: 'sql:old_sos_1',
        old_sos_2: 'sql:old_sos_2',
        old_sos_3: 'sql:old_sos_3',
        old_sos_4: 'sql:old_sos_4',
        old_sos_5: 'sql:old_sos_5',
      })),
    };

    const service = new SapReturnMonitorService(
      gateway as never,
      storeService as never,
      queryConfigService as never,
    );
    return { gateway, storeService, queryConfigService, snapshot, service };
  };

  it('lọc bỏ các kho không nằm trong activeStoreCodes và chạy tuần tự 5 câu old_sos_1..5', async () => {
    const { gateway, queryConfigService, snapshot, service } = createMocks([
      'MC073',
    ]);

    const res = await service.getReturnMonitor({
      dateFrom: '20261007',
      dateTo: '20261028',
      brand: '5001',
    });

    expect(queryConfigService.getSnapshot).toHaveBeenCalledTimes(1);
    expect(queryConfigService.buildReturnOldDiscoverySqlMap).toHaveBeenCalledWith(
      snapshot,
      '20261007',
      '5001',
      '20261028',
    );
    // 7 main queries + 5 old_sos_1..5 queries = 12 queries when oldSoSet is empty
    expect(res.meta.queryCount).toBe(12);
    expect(gateway.run).toHaveBeenCalledWith(
      'return-candidates:old_sos_1',
      'sql:old_sos_1',
    );
    expect(gateway.run).toHaveBeenCalledWith(
      'return-candidates:old_sos_5',
      'sql:old_sos_5',
    );
    expect(res.cohorts.tatCa.poCount).toBe(1);
    expect(res.lists.chain.columns).toEqual([...RET_CHAIN_COLUMNS]);
    expect(res.lists.chain.rows).toHaveLength(1);
    expect(res.lists.chain.rows[0][1]).toBe('MC073');
  });

  it('trả về danh sách rỗng khi activeStoreCodes rỗng (Set.size === 0)', async () => {
    const { service } = createMocks([]);

    const res = await service.getReturnMonitor({
      dateFrom: '20261007',
      brand: '5001',
    });

    expect(res.cohorts.tatCa.poCount).toBe(0);
    expect(res.lists.chain.rows).toHaveLength(0);
    expect(res.lists.arNoInv.rows).toHaveLength(0);
  });

  it('gom SO cũ từ 5 câu old_sos_1..5 (bỏ qua SO đã thuộc nhóm mới) và passthrough cột phụ trên chain + arNoInv', async () => {
    const { gateway, queryConfigService, snapshot, service } = createMocks(
      ['MC073'],
      ['Ghi chú SO'],
      ['Kênh HĐ'],
    );

    gateway.run.mockImplementation(async (key: string) => {
      if (key === 'return-list:so') {
        return {
          columns: [
            'SO Number',
            'SO DocDate',
            'SO CreateDate',
            'SO Canceled',
            'Store',
            'Brand',
            'MC Docnum',
            'SO ShipDate',
            'Kho SO min',
            'Kho SO max',
            'Ghi chú SO',
          ],
          rows: [
            [
              5001,
              '2026-10-10',
              '2026-10-10',
              'N',
              'MC073',
              '5001',
              'MC073-001',
              '2026-10-12',
              'MC073',
              'MC073',
              'SO Mới',
            ],
          ],
        };
      }
      if (key === 'return-list:ar') {
        return {
          columns: [
            'SO Number',
            'AR Number',
            'AR DocDate',
            'AR CreateDate',
            'AR ShipDate',
            'Invoice No',
            'Kênh HĐ',
          ],
          rows: [
            [5001, 8001, '2026-10-11', '2026-10-11', '2026-10-12', null, 'E-Inv'],
          ],
        };
      }
      if (key === 'return-candidates:old_sos_1') {
        return {
          columns: ['SO Number'],
          rows: [[5001], [3500]],
        };
      }
      if (key === 'return-candidates:old_sos_3') {
        return {
          columns: ['SO Number'],
          rows: [[3500], [3499]],
        };
      }
      if (key === 'return-old:so:0') {
        return {
          columns: [
            'SO Number',
            'SO DocDate',
            'SO CreateDate',
            'SO Canceled',
            'Store',
            'Brand',
            'MC Docnum',
            'SO ShipDate',
            'Kho SO min',
            'Kho SO max',
            'Ghi chú SO',
          ],
          rows: [
            [
              3499,
              '2026-10-01',
              '2026-10-01',
              'N',
              'MC073',
              '5001',
              'MC073-OLD',
              '2026-10-05',
              'MC073',
              'MC073',
              'SO Cũ 3499',
            ],
          ],
        };
      }
      if (key === 'return-old:ar:0') {
        return {
          columns: [
            'SO Number',
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
      return { columns: ['SO Number'], rows: [] };
    });

    const res = await service.getReturnMonitor({
      dateFrom: '20261007',
      dateTo: '20261028',
      brand: '5001',
    });

    expect(queryConfigService.buildReturnMainSqlMap).toHaveBeenCalledWith(
      snapshot,
      '20261007',
      '5001',
      [3499, 3500],
      '20261028',
    );
    expect(res.lists.chain.columns).toEqual([
      ...RET_CHAIN_COLUMNS,
      'Ghi chú SO',
    ]);
    expect(res.lists.chain.rows).toHaveLength(2);
    expect(res.lists.chain.rows[0]?.[31]).toBe('SO Cũ 3499');
    expect(res.lists.chain.rows[1]?.[31]).toBe('SO Mới');
    expect(res.lists.arNoInv.columns).toEqual([
      ...RET_AR_NOINV_COLS,
      'Kênh HĐ',
    ]);
    expect(res.lists.arNoInv.rows[0]?.[19]).toBe('E-Inv');
  });

  it('tự động vô hiệu hóa cache 60s khi configEpoch của SapStoreService hoặc SapQueryConfigService tăng và chặn lệch cột lô 150 SO cũ', async () => {
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
      if (key === 'return-candidates:old_sos_1') {
        return { columns: ['SO Number'], rows: [[3000]] };
      }
      if (key === 'return-old:so:0') {
        return {
          columns: ['SO Number', 'Mismatched Col'],
          rows: [[3000, 'X']],
        };
      }
      return { columns: ['SO Number'], rows: [] };
    });

    await expect(
      service.getReturnMonitor({
        dateFrom: '20261007',
        brand: '5001',
      }),
    ).rejects.toThrow(/Lệch cấu trúc cột khi nối lô SO cũ/);
  });
});
