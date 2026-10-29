import type { ReturnListQueryKey } from '../../queries/return-monitor-queries';
import { NHOM_CU, NHOM_MOI } from '../sales-monitor/sales-cohort';
import { recordsToTable } from '../sales-monitor/sales-monitor-helpers';
import type { SapQueryResult } from '../sap-row-normalizer';
import {
  RET_AR_NOINV_COLS,
  RET_CHAIN_COLUMNS,
  RET_FUNNEL_HEADERS,
  RET_STATUS_ORDER,
  RST_AP_NO_INV,
  RST_AR_NO_INV,
  RST_FULL,
  RST_MANUAL_SO,
  RST_NO_AP,
  RST_NO_AR,
  RST_NO_AR_WAIT_SHIP,
  RST_NO_GRPO,
  RST_NO_GRPO_WAIT_SHIP,
  RST_NO_PO,
  RST_SO_CANCELED,
  assembleReturnChain,
  buildReturnArNoInv,
  buildReturnFunnel,
  buildReturnStatusSummary,
  countReturnStatusByCohort,
} from './index';

function createBaseQueryResults(
  overrides: Partial<Record<ReturnListQueryKey, SapQueryResult>> = {},
): Record<ReturnListQueryKey, SapQueryResult> {
  const empty: Record<ReturnListQueryKey, SapQueryResult> = {
    so: {
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
      ],
      rows: [],
    },
    po: {
      columns: [
        'SO Number',
        'PO Number',
        'PO DocDate',
        'PO CreateDate',
        'Kho PO min',
        'Kho PO max',
      ],
      rows: [],
    },
    do: {
      columns: ['SO Number', 'DO Number'],
      rows: [],
    },
    ar: {
      columns: [
        'SO Number',
        'AR Number',
        'AR DocDate',
        'AR CreateDate',
        'AR ShipDate',
        'Invoice No',
      ],
      rows: [],
    },
    grpo: {
      columns: [
        'SO Number',
        'GRPO Number',
        'GRPO DocDate',
        'Kho GRPO min',
        'Kho GRPO max',
      ],
      rows: [],
    },
    ap: {
      columns: [
        'SO Number',
        'GRPO Number',
        'AP Number',
        'AP DocDate',
        'AP Invoice No',
      ],
      rows: [],
    },
    whs: {
      columns: ['DB', 'WhsCode', 'WhsName'],
      rows: [],
    },
  };
  return { ...empty, ...overrides };
}

describe('Return Monitor Pure Domain Logic (SO-Based v1.1)', () => {
  const today = '2026-10-21';
  const dateFrom = '20261007';

  it('Test Case 1: deduplicates SOs in ascending numeric order keeping the first occurrence and computes Nguon SO & SO Huy', () => {
    const results = createBaseQueryResults({
      so: {
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
        ],
        rows: [
          [5002, '2026-10-10', '2026-10-10', 'N', 'MC001', '5001', 'MC001-FIRST', '2026-10-12', 'T01', 'T01'],
          [4999, '2026-10-01', '2026-10-01', 'Y', 'MC011', '5001', 'MC011-OLD', '2026-10-05', 'T02', 'T02'],
          [5002, '2026-10-11', '2026-10-11', 'N', 'MC073', '5001', 'MC001-SECOND', '2026-10-13', 'T03', 'T03'],
          [5001, '2026-10-08', '2026-10-08', 'N', 'MC013', '5001', null, '2026-10-10', 'T01', 'T02'],
        ],
      },
    });

    const assembled = assembleReturnChain(results, dateFrom, today);

    expect(assembled.table.columns).toEqual([...RET_CHAIN_COLUMNS]);
    expect(assembled.table.columns).toHaveLength(31);
    expect(assembled.rows.map((r) => r['SO Number'])).toEqual([4999, 5001, 5002]);
    expect(assembled.rows.map((r) => r['Nhom'])).toEqual([NHOM_CU, NHOM_MOI, NHOM_MOI]);

    const so4999 = assembled.rows.find((r) => r['SO Number'] === 4999)!;
    expect(so4999['SO Huy']).toBe('Đã hủy');
    expect(so4999['Trang thai chuoi chung tu']).toBe(RST_SO_CANCELED);

    const so5001 = assembled.rows.find((r) => r['SO Number'] === 5001)!;
    expect(so5001['Nguon SO']).toBe('THỦ CÔNG');
    expect(so5001['Trang thai chuoi chung tu']).toBe(RST_MANUAL_SO);

    const so5002 = assembled.rows.find((r) => r['SO Number'] === 5002)!;
    expect(so5002['Store']).toBe('MC001');
    expect(so5002['MC Docnum']).toBe('MC001-FIRST');
    expect(so5002['Nguon SO']).toBe('AUTO');
    expect(so5002['Kho xuat SO (TTVH)']).toBe('T01');
    expect(so5002['Trang thai chuoi chung tu']).toBe(RST_NO_PO);
  });

  it('Test Case 2: maps TTVH stores (DB=T) and KBMD warehouses (DB=K) accurately', () => {
    const results = createBaseQueryResults({
      so: {
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
        ],
        rows: [
          [5001, '2026-10-12', '2026-10-12', 'N', 'MC001', '5001', 'MC001-01', '2026-10-15', 'WH_T2', 'WH_T1'],
        ],
      },
      po: {
        columns: [
          'SO Number',
          'PO Number',
          'PO DocDate',
          'PO CreateDate',
          'Kho PO min',
          'Kho PO max',
        ],
        rows: [
          [5001, 2001, '2026-10-12', '2026-10-12', 'DC002', 'DC001'],
        ],
      },
      whs: {
        columns: ['DB', 'WhsCode', 'WhsName'],
        rows: [
          ['T', 'MC001', 'Cửa hàng Maycha 001'],
          ['K', 'MC001', 'Kho KBMD Trùng Mã'],
          ['K', 'DC001', 'Kho Tổng KBMD 1'],
          ['K', 'DC002', 'Kho Tổng KBMD 2'],
          ['T', 'DC001', 'Cửa hàng Trùng Mã DC001'],
        ],
      },
    });

    const { rows } = assembleReturnChain(results, dateFrom, today);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['Ten cua hang']).toBe('Cửa hàng Maycha 001');
    expect(rows[0]?.['Kho nhan PO (KBMD)']).toBe('DC001, DC002');
    expect(rows[0]?.['Ten kho nhan (KBMD)']).toBe('Kho Tổng KBMD 1; Kho Tổng KBMD 2');
    expect(rows[0]?.['Kho xuat SO (TTVH)']).toBe('WH_T1, WH_T2');
  });

  it('Test Case 3: uses SO ShipDate > today for step 2 and step 4 wait statuses and excludes statuses 0 and 8 from 6-step funnel', () => {
    const results = createBaseQueryResults({
      so: {
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
        ],
        rows: [
          // SO 6000: Đã hủy (trạng thái 0, loại khỏi phễu)
          [6000, '2026-10-15', '2026-10-15', 'Y', 'MC001', '5001', 'MC-6000', '2026-10-20', 'MC001', 'MC001'],
          // SO 6001: Có PO, SO ShipDate > today, chưa có A/R -> RST_NO_AR_WAIT_SHIP (2a)
          [6001, '2026-10-15', '2026-10-15', 'N', 'MC001', '5001', 'MC-6001', '2026-10-25', 'MC001', 'MC001'],
          // SO 6002: Có PO, SO ShipDate > today, có A/R đã xuất HĐ, chưa có GRPO -> RST_NO_GRPO_WAIT_SHIP (4a)
          [6002, '2026-10-15', '2026-10-15', 'N', 'MC001', '5001', 'MC-6002', '2026-10-24', 'MC001', 'MC001'],
          // SO 6003: Có PO, SO ShipDate <= today, có A/R đã xuất HĐ (AR ShipDate > today), chưa có GRPO -> RST_NO_GRPO (4)
          [6003, '2026-10-15', '2026-10-15', 'N', 'MC001', '5001', 'MC-6003', '2026-10-20', 'MC001', 'MC001'],
          // SO 6004: Thủ công không có MC Docnum, không có PO -> RST_MANUAL_SO (8, loại khỏi phễu)
          [6004, '2026-10-15', '2026-10-15', 'N', 'MC001', '5001', null, '2026-10-20', 'MC001', 'MC001'],
        ],
      },
      po: {
        columns: [
          'SO Number',
          'PO Number',
          'PO DocDate',
          'PO CreateDate',
          'Kho PO min',
          'Kho PO max',
        ],
        rows: [
          [6000, 3000, '2026-10-15', '2026-10-15', 'DC01', 'DC01'],
          [6001, 3001, '2026-10-15', '2026-10-15', 'DC01', 'DC01'],
          [6002, 3002, '2026-10-15', '2026-10-15', 'DC01', 'DC01'],
          [6003, 3003, '2026-10-15', '2026-10-15', 'DC01', 'DC01'],
        ],
      },
      ar: {
        columns: [
          'SO Number',
          'AR Number',
          'AR DocDate',
          'AR CreateDate',
          'AR ShipDate',
          'Invoice No',
        ],
        rows: [
          [6002, 7002, '2026-10-16', '2026-10-16', null, 'INV-7002'],
          [6003, 7003, '2026-10-16', '2026-10-16', '2026-10-28', 'INV-7003'],
        ],
      },
    });

    const { rows, arRows, grpoRows } = assembleReturnChain(results, dateFrom, today);

    const so6001 = rows.find((r) => r['SO Number'] === 6001)!;
    const so6002 = rows.find((r) => r['SO Number'] === 6002)!;
    const so6003 = rows.find((r) => r['SO Number'] === 6003)!;

    expect(so6001['Trang thai chuoi chung tu']).toBe(RST_NO_AR_WAIT_SHIP);
    expect(so6001['Ghi chu ShipDate']).toBe(
      'Chờ SO ShipDate 25/10/2026 (chưa đến ngày xuất hàng)',
    );

    expect(so6002['Trang thai chuoi chung tu']).toBe(RST_NO_GRPO_WAIT_SHIP);
    expect(so6002['Ghi chu ShipDate']).toBe(
      'Chờ SO ShipDate 24/10/2026 (chưa đến ngày sync GRPO)',
    );

    expect(so6003['Trang thai chuoi chung tu']).toBe(RST_NO_GRPO);
    expect(so6003['Ghi chu ShipDate']).toBe(
      'Đã đến/qua SO ShipDate 20/10/2026 — GRPO chưa có, cần kiểm tra',
    );

    const funnel = buildReturnFunnel(rows, arRows, grpoRows, today);
    expect(funnel).toHaveLength(6);

    // Bước 1: loại SO 6000 (trạng thái 0) và SO 6004 (trạng thái 8) khỏi vin -> vin = 3
    const step1 = funnel[0]!;
    expect(step1.vin).toBe(3);
    expect(step1.ok).toBe(3);
    expect(step1.autoLabel).toContain(
      'ngoài ra 1 SO đã hủy nhưng PO KBMD vẫn mở (trạng thái 0), 1 SO thủ công không có PO (trạng thái 8)',
    );

    const step4 = funnel[3]!;
    expect(step4.vin).toBe(2);
    expect(step4.ok).toBe(0);
    expect(step4.wait).toBe(1); // chỉ SO 6002 có SO ShipDate > today
    expect(step4.act).toBe(1); // SO 6003 có SO ShipDate <= today dù AR ShipDate > today
  });

  it('Test Case 4: computes 6-step funnel including Step 6 (AP -> có Invoice) and statuses 6 vs 7', () => {
    const results = createBaseQueryResults({
      so: {
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
        ],
        rows: [
          [501, '2026-10-10', '2026-10-10', 'N', 'MC001', '5001', 'MC-1', '2026-10-12', 'M1', 'M1'],
          [502, '2026-10-11', '2026-10-11', 'N', 'MC001', '5001', 'MC-2', '2026-10-12', 'M1', 'M1'],
        ],
      },
      po: {
        columns: [
          'SO Number',
          'PO Number',
          'PO DocDate',
          'PO CreateDate',
          'Kho PO min',
          'Kho PO max',
        ],
        rows: [
          [501, 4001, '2026-10-10', '2026-10-10', 'K1', 'K1'],
          [502, 4002, '2026-10-11', '2026-10-11', 'K1', 'K1'],
        ],
      },
      ar: {
        columns: [
          'SO Number',
          'AR Number',
          'AR DocDate',
          'AR CreateDate',
          'AR ShipDate',
          'Invoice No',
        ],
        rows: [
          [501, 801, '2026-10-12', '2026-10-12', '2026-10-12', 'INV-1'],
          [501, 802, '2026-10-12', '2026-10-12', '2026-10-12', 'INV-2'],
          [502, 803, '2026-10-12', '2026-10-12', '2026-10-12', 'INV-3'],
        ],
      },
      grpo: {
        columns: [
          'SO Number',
          'GRPO Number',
          'GRPO DocDate',
          'Kho GRPO min',
          'Kho GRPO max',
        ],
        rows: [
          [501, 901, '2026-10-13', 'K1', 'K1'],
          [502, 902, '2026-10-13', 'K1', 'K1'],
        ],
      },
      ap: {
        columns: [
          'SO Number',
          'GRPO Number',
          'AP Number',
          'AP DocDate',
          'AP Invoice No',
        ],
        rows: [
          [501, 901, 1001, '2026-10-14', 'AP-INV-1'],
          [502, 902, 1002, '2026-10-14', null],
        ],
      },
    });

    const { rows, arRows, grpoRows } = assembleReturnChain(results, dateFrom, today);
    const funnel = buildReturnFunnel(rows, arRows, grpoRows, today);

    expect(RET_FUNNEL_HEADERS).toHaveLength(8);
    expect(funnel).toHaveLength(6);

    const so501 = rows.find((r) => r['SO Number'] === 501)!;
    const so502 = rows.find((r) => r['SO Number'] === 502)!;
    expect(so501['Trang thai chuoi chung tu']).toBe(RST_FULL);
    expect(so502['Trang thai chuoi chung tu']).toBe(RST_AP_NO_INV);

    const step2 = funnel[1]!;
    expect(step2.unit).toBe('SO');
    expect(step2.vin).toBe(2);
    expect(step2.ok).toBe(2);
    expect(step2.okText).toBe('2 SO → 3 A/R');

    const step6 = funnel[5]!;
    expect(step6.unit).toBe('SO');
    expect(step6.vin).toBe(2);
    expect(step6.ok).toBe(1);
    expect(step6.act).toBe(1);
    expect(step6.okText).toBe('1 SO có AP đã có Invoice');
  });

  it('Test Case 5: builds 19-column A/R without invoice table with sibling SO note and sorts by age desc then AR Number asc', () => {
    const results = createBaseQueryResults({
      so: {
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
        ],
        rows: [
          // SO 6001 có 1 A/R đã xuất HĐ (9001) và 1 A/R chưa xuất HĐ (9002) -> SO sang bước 4 (RST_NO_GRPO)
          [6001, '2026-10-10', '2026-10-10', 'N', 'MC001', '5001', 'MC-5001', '2026-10-12', 'M1', 'M1'],
          // SO 6002 chỉ có A/R chưa xuất HĐ (9010, 9005) -> SO ở bước 3 (RST_AR_NO_INV)
          [6002, '2026-10-12', '2026-10-12', 'N', 'MC011', '5001', 'MC-5002', '2026-10-14', 'M1', 'M1'],
        ],
      },
      po: {
        columns: [
          'SO Number',
          'PO Number',
          'PO DocDate',
          'PO CreateDate',
          'Kho PO min',
          'Kho PO max',
        ],
        rows: [
          [6001, 5001, '2026-10-10', '2026-10-10', 'K1', 'K1'],
          [6002, 5002, '2026-10-12', '2026-10-12', 'K1', 'K1'],
        ],
      },
      ar: {
        columns: [
          'SO Number',
          'AR Number',
          'AR DocDate',
          'AR CreateDate',
          'AR ShipDate',
          'Invoice No',
        ],
        rows: [
          [6001, 9001, '2026-10-11', '2026-10-11', '2026-10-12', 'HD-9001'],
          [6001, 9002, '2026-10-18', '2026-10-18', '2026-10-18', ''],
          [6002, 9010, '2026-10-15', '2026-10-15', '2026-10-15', null],
          [6002, 9005, '2026-10-15', '2026-10-15', '2026-10-15', '   '],
        ],
      },
    });

    const { rows, arRows } = assembleReturnChain(results, dateFrom, today);
    const arNoInv = buildReturnArNoInv(rows, arRows, today);
    const arNoInvTable = recordsToTable(RET_AR_NOINV_COLS, arNoInv);

    expect(arNoInvTable.columns).toEqual([...RET_AR_NOINV_COLS]);
    expect(arNoInvTable.columns).toHaveLength(19);
    expect(arNoInv).toHaveLength(3);

    expect(arNoInv.map((r) => r['AR Number'])).toEqual([9005, 9010, 9002]);
    expect(arNoInv.map((r) => r['Tuoi A/R (ngay)'])).toEqual([6, 6, 3]);

    const ar9002 = arNoInv[2]!;
    expect(ar9002['SO con A/R khac da xuat HD']).toBe('9001');
    expect(ar9002['Trang thai SO']).toBe(RST_NO_GRPO);
    expect(ar9002['Ghi chu']).toBe(
      'SO đã được xếp vào bước sau vì có A/R khác đã xuất HĐ – A/R này vẫn thiếu HĐ',
    );

    expect(arNoInv[0]!['SO con A/R khac da xuat HD']).toBe('');
    expect(arNoInv[0]!['Trang thai SO']).toBe(RST_AR_NO_INV);
    expect(arNoInv[0]!['Ghi chu']).toBe('');
  });

  it('Test Case 6: computes buildReturnStatusSummary and countReturnStatusByCohort across all 11 statuses', () => {
    const results = createBaseQueryResults({
      so: {
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
        ],
        rows: [
          // Nhóm mới: 1 RST_NO_PO (problem), 1 RST_NO_AR_WAIT_SHIP (waiting), 1 RST_NO_AP (problem), 1 RST_FULL, 1 RST_MANUAL_SO (tham khảo)
          [7001, '2026-10-10', '2026-10-10', 'N', 'MC001', '5001', 'M-1', '2026-10-15', 'M1', 'M1'],
          [7002, '2026-10-11', '2026-10-11', 'N', 'MC001', '5001', 'M-2', '2026-10-25', 'M1', 'M1'],
          [7003, '2026-10-12', '2026-10-12', 'N', 'MC001', '5001', 'M-3', '2026-10-15', 'M1', 'M1'],
          [7004, '2026-10-13', '2026-10-13', 'N', 'MC001', '5001', 'M-4', '2026-10-15', 'M1', 'M1'],
          [7005, '2026-10-14', '2026-10-14', 'N', 'MC001', '5001', null, '2026-10-15', 'M1', 'M1'],
          // Nhóm cũ: 1 RST_NO_AR (backlog), 1 RST_FULL
          [6901, '2026-10-01', '2026-10-01', 'N', 'MC001', '5001', 'C-1', '2026-10-10', 'M1', 'M1'],
          [6902, '2026-10-02', '2026-10-02', 'N', 'MC001', '5001', 'C-2', '2026-10-10', 'M1', 'M1'],
        ],
      },
      po: {
        columns: [
          'SO Number',
          'PO Number',
          'PO DocDate',
          'PO CreateDate',
          'Kho PO min',
          'Kho PO max',
        ],
        rows: [
          [7002, 6002, '2026-10-11', '2026-10-11', 'K1', 'K1'],
          [7003, 6003, '2026-10-12', '2026-10-12', 'K1', 'K1'],
          [7004, 6004, '2026-10-13', '2026-10-13', 'K1', 'K1'],
          [6901, 5901, '2026-10-01', '2026-10-01', 'K1', 'K1'],
          [6902, 5902, '2026-10-02', '2026-10-02', 'K1', 'K1'],
        ],
      },
      ar: {
        columns: [
          'SO Number',
          'AR Number',
          'AR DocDate',
          'AR CreateDate',
          'AR ShipDate',
          'Invoice No',
        ],
        rows: [
          [7003, 8003, '2026-10-12', '2026-10-12', '2026-10-15', 'INV-8003'],
          [7003, 80031, '2026-10-12', '2026-10-12', '2026-10-15', null],
          [7004, 8004, '2026-10-13', '2026-10-13', '2026-10-15', 'INV-8004'],
          [6902, 7902, '2026-10-09', '2026-10-09', '2026-10-10', 'INV-7902'],
        ],
      },
      grpo: {
        columns: [
          'SO Number',
          'GRPO Number',
          'GRPO DocDate',
          'Kho GRPO min',
          'Kho GRPO max',
        ],
        rows: [
          [7003, 9003, '2026-10-14', 'K1', 'K1'],
          [7004, 9004, '2026-10-14', 'K1', 'K1'],
          [6902, 8902, '2026-10-10', 'K1', 'K1'],
        ],
      },
      ap: {
        columns: [
          'SO Number',
          'GRPO Number',
          'AP Number',
          'AP DocDate',
          'AP Invoice No',
        ],
        rows: [
          [7004, 9004, 10004, '2026-10-15', 'AP-INV-1'],
          [6902, 8902, 10902, '2026-10-11', 'AP-INV-2'],
        ],
      },
    });

    const { rows, arRows } = assembleReturnChain(results, dateFrom, today);
    const arNoInvRows = buildReturnArNoInv(rows, arRows, today);
    const summary = buildReturnStatusSummary(rows, arNoInvRows);

    expect(RET_STATUS_ORDER).toHaveLength(11);
    expect(summary).toEqual({
      problems: 2, // SO 7001 (RST_NO_PO) + SO 7003 (RST_NO_AP)
      arNoInvCount: 1, // A/R 80031
      waiting: 1, // SO 7002 (RST_NO_AR_WAIT_SHIP)
      backlog: 1, // SO 6901 (RST_NO_AR, nhóm Cũ)
    });

    const moiCounts = countReturnStatusByCohort(rows, NHOM_MOI);
    expect(moiCounts).toEqual({
      so_canceled: 0,
      so_no_po: 1,
      so_no_ar: 0,
      so_no_ar_wait: 1,
      ar_no_inv: 0,
      ar_no_grpo: 0,
      ar_no_grpo_wait: 0,
      grpo_no_ap: 1,
      ap_no_inv: 0,
      so_full: 1,
      so_manual: 1,
    });

    const cuCounts = countReturnStatusByCohort(rows, NHOM_CU);
    expect(cuCounts.so_no_ar).toBe(1);
    expect(cuCounts.so_full).toBe(1);
  });

  it('Test Case 7: preserves 31/19 baseline columns without leaking internal columns (SO Canceled, Kho min/max) and passes through extra SO/AR columns', () => {
    const baselineRes = assembleReturnChain(createBaseQueryResults(), dateFrom, today);
    expect(baselineRes.columns).toHaveLength(31);
    expect(baselineRes.columns).not.toContain('SO Canceled');
    expect(baselineRes.columns).not.toContain('Kho SO min');
    expect(baselineRes.columns).not.toContain('Kho SO max');
    expect(baselineRes.extraArCols).toEqual([]);

    const withExtras = createBaseQueryResults({
      so: {
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
          'Ghi chú UDF',
        ],
        rows: [
          [8001, '2026-10-12', '2026-10-12', 'N', 'MC001', '5001', 'MC-7001', '2026-10-14', 'MC001', 'MC001', 'Hàng vỡ vận chuyển'],
        ],
      },
      po: {
        columns: [
          'SO Number',
          'PO Number',
          'PO DocDate',
          'PO CreateDate',
          'Kho PO min',
          'Kho PO max',
        ],
        rows: [
          [8001, 7001, '2026-10-12', '2026-10-12', 'DC01', 'DC01'],
        ],
      },
      ar: {
        columns: [
          'SO Number',
          'AR Number',
          'AR DocDate',
          'AR CreateDate',
          'AR ShipDate',
          'Invoice No',
          'Kênh xuất HĐ',
        ],
        rows: [
          [8001, 9001, '2026-10-13', '2026-10-13', '2026-10-14', null, 'E-Invoice VNPT'],
        ],
      },
    });

    const assembled = assembleReturnChain(withExtras, dateFrom, today);
    expect(assembled.table.columns).toEqual([...RET_CHAIN_COLUMNS, 'Ghi chú UDF']);
    expect(assembled.table.rows[0]?.[31]).toBe('Hàng vỡ vận chuyển');
    expect(assembled.rows[0]?.['Ghi chú UDF']).toBe('Hàng vỡ vận chuyển');
    expect(assembled.extraArCols).toEqual(['Kênh xuất HĐ']);

    const arNoInvRows = buildReturnArNoInv(
      assembled.rows,
      assembled.arRows,
      today,
      assembled.extraArCols,
    );
    const arNoInvTable = recordsToTable(
      [...RET_AR_NOINV_COLS, ...assembled.extraArCols],
      arNoInvRows,
    );
    expect(arNoInvTable.columns).toEqual([...RET_AR_NOINV_COLS, 'Kênh xuất HĐ']);
    expect(arNoInvTable.rows[0]?.[19]).toBe('E-Invoice VNPT');
  });
});
