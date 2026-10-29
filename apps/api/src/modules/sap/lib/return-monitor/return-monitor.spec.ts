import type { ReturnListQueryKey } from '../../queries/return-monitor-queries';
import { NHOM_CU, NHOM_MOI } from '../sales-monitor/sales-cohort';
import { recordsToTable } from '../sales-monitor/sales-monitor-helpers';
import type { SapQueryResult } from '../sap-row-normalizer';
import {
  RET_AR_NOINV_COLS,
  RET_CHAIN_COLUMNS,
  RET_FUNNEL_HEADERS,
  RET_STATUS_ORDER,
  RST_AR_NO_INV,
  RST_FULL,
  RST_NO_AP,
  RST_NO_AR,
  RST_NO_AR_WAIT_SHIP,
  RST_NO_GRPO,
  RST_NO_GRPO_WAIT_SHIP,
  RST_NO_SO,
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
    po: {
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
      rows: [],
    },
    so: {
      columns: [
        'PO Number',
        'SO Number',
        'SO DocDate',
        'SO CreateDate',
        'SO ShipDate',
        'Kho SO min',
        'Kho SO max',
      ],
      rows: [],
    },
    do: {
      columns: ['PO Number', 'DO Number'],
      rows: [],
    },
    ar: {
      columns: [
        'PO Number',
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
        'PO Number',
        'GRPO Number',
        'GRPO DocDate',
        'Kho GRPO min',
        'Kho GRPO max',
      ],
      rows: [],
    },
    ap: {
      columns: ['PO Number', 'GRPO Number', 'AP Number', 'AP DocDate'],
      rows: [],
    },
    whs: {
      columns: ['DB', 'WhsCode', 'WhsName'],
      rows: [],
    },
  };
  return { ...empty, ...overrides };
}

describe('Return Monitor Pure Domain Logic', () => {
  const today = '2026-10-21';
  const dateFrom = '20261007';

  it('Test Case 1: deduplicates POs in ascending numeric order keeping the first occurrence (Parity Trap 1)', () => {
    const results = createBaseQueryResults({
      po: {
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
          [1002, '2026-10-10', '2026-10-10', 'MC001', '5001', 'MC001-FIRST', 'K01', 'K01'],
          [999, '2026-10-01', '2026-10-01', 'MC011', '5001', 'MC011-OLD', 'K02', 'K02'],
          [1002, '2026-10-11', '2026-10-11', 'MC073', '5001', 'MC001-SECOND', 'K03', 'K03'],
          [1001, '2026-10-08', '2026-10-08', 'MC013', '5001', 'MC013-NEW', 'K01', 'K02'],
        ],
      },
    });

    const assembled = assembleReturnChain(results, dateFrom, today);

    expect(assembled.table.columns).toEqual([...RET_CHAIN_COLUMNS]);
    expect(assembled.rows.map((r) => r['PO Number'])).toEqual([999, 1001, 1002]);
    expect(assembled.rows.map((r) => r['Nhom'])).toEqual([NHOM_CU, NHOM_MOI, NHOM_MOI]);

    const po1002 = assembled.rows.find((r) => r['PO Number'] === 1002);
    expect(po1002?.['Store']).toBe('MC001');
    expect(po1002?.['MC Docnum']).toBe('MC001-FIRST');
    expect(po1002?.['Kho nhan PO (KBMD)']).toBe('K01');
  });

  it('Test Case 2: maps TTVH stores (DB=T) and KBMD warehouses (DB=K) accurately (Parity Trap 2)', () => {
    const results = createBaseQueryResults({
      po: {
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
          [2001, '2026-10-12', '2026-10-12', 'MC001', '5001', 'MC001-01', 'DC002', 'DC001'],
        ],
      },
      so: {
        columns: [
          'PO Number',
          'SO Number',
          'SO DocDate',
          'SO CreateDate',
          'SO ShipDate',
          'Kho SO min',
          'Kho SO max',
        ],
        rows: [
          [2001, 5001, '2026-10-12', '2026-10-12', '2026-10-15', 'WH_T2', 'WH_T1'],
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

  it('Test Case 3: uses SO ShipDate > today for both step 2 and step 4 wait statuses, ignoring AR ShipDate (Parity Trap 3)', () => {
    const results = createBaseQueryResults({
      po: {
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
          // PO 3001: Có SO (SO ShipDate > today), chưa có A/R -> RST_NO_AR_WAIT_SHIP
          [3001, '2026-10-15', '2026-10-15', 'MC001', '5001', 'MC-3001', 'DC01', 'DC01'],
          // PO 3002: Có SO (SO ShipDate > today), có A/R đã xuất HĐ (AR ShipDate rỗng), chưa có GRPO -> RST_NO_GRPO_WAIT_SHIP
          [3002, '2026-10-15', '2026-10-15', 'MC001', '5001', 'MC-3002', 'DC01', 'DC01'],
          // PO 3003: Có SO (SO ShipDate <= today), có A/R đã xuất HĐ (AR ShipDate > today), chưa có GRPO -> vẫn là RST_NO_GRPO vì xét SO ShipDate
          [3003, '2026-10-15', '2026-10-15', 'MC001', '5001', 'MC-3003', 'DC01', 'DC01'],
        ],
      },
      so: {
        columns: [
          'PO Number',
          'SO Number',
          'SO DocDate',
          'SO CreateDate',
          'SO ShipDate',
          'Kho SO min',
          'Kho SO max',
        ],
        rows: [
          [3001, 6001, '2026-10-15', '2026-10-15', '2026-10-25', 'MC001', 'MC001'],
          [3002, 6002, '2026-10-15', '2026-10-15', '2026-10-24', 'MC001', 'MC001'],
          [3003, 6003, '2026-10-15', '2026-10-15', '2026-10-20', 'MC001', 'MC001'],
        ],
      },
      ar: {
        columns: [
          'PO Number',
          'AR Number',
          'AR DocDate',
          'AR CreateDate',
          'AR ShipDate',
          'Invoice No',
        ],
        rows: [
          [3002, 7002, '2026-10-16', '2026-10-16', null, 'INV-7002'],
          [3003, 7003, '2026-10-16', '2026-10-16', '2026-10-28', 'INV-7003'],
        ],
      },
    });

    const { rows, arRows, grpoRows } = assembleReturnChain(results, dateFrom, today);

    const po3001 = rows.find((r) => r['PO Number'] === 3001)!;
    const po3002 = rows.find((r) => r['PO Number'] === 3002)!;
    const po3003 = rows.find((r) => r['PO Number'] === 3003)!;

    expect(po3001['Trang thai chuoi chung tu']).toBe(RST_NO_AR_WAIT_SHIP);
    expect(po3001['Ghi chu ShipDate']).toBe(
      'Chờ SO ShipDate 25/10/2026 (chưa đến ngày xuất hàng)',
    );

    expect(po3002['Trang thai chuoi chung tu']).toBe(RST_NO_GRPO_WAIT_SHIP);
    expect(po3002['Ghi chu ShipDate']).toBe(
      'Chờ SO ShipDate 24/10/2026 (chưa đến ngày sync GRPO)',
    );

    expect(po3003['Trang thai chuoi chung tu']).toBe(RST_NO_GRPO);
    expect(po3003['Ghi chu ShipDate']).toBe(
      'Đã đến/qua SO ShipDate 20/10/2026 — GRPO chưa có, cần kiểm tra',
    );

    const funnel = buildReturnFunnel(rows, arRows, grpoRows, today);
    const step4 = funnel[3]!;
    expect(step4.vin).toBe(2);
    expect(step4.ok).toBe(0);
    expect(step4.wait).toBe(1); // chỉ PO 3002 có SO ShipDate > today
    expect(step4.act).toBe(1); // PO 3003 có SO ShipDate <= today dù AR ShipDate > today
  });

  it('Test Case 4: computes step 2 funnel with unit SO but PO-based vin/ok and "{ok} SO → {n_ar} A/R" label (Parity Trap 4)', () => {
    const results = createBaseQueryResults({
      po: {
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
          [4001, '2026-10-10', '2026-10-10', 'MC001', '5001', 'MC-1', 'K1', 'K1'],
          [4002, '2026-10-11', '2026-10-11', 'MC001', '5001', 'MC-2', 'K1', 'K1'],
          [4003, '2026-10-12', '2026-10-12', 'MC001', '5001', 'MC-3', 'K1', 'K1'],
        ],
      },
      so: {
        columns: [
          'PO Number',
          'SO Number',
          'SO DocDate',
          'SO CreateDate',
          'SO ShipDate',
          'Kho SO min',
          'Kho SO max',
        ],
        rows: [
          // PO 4001 có 2 SO và 3 A/R
          [4001, 501, '2026-10-10', '2026-10-10', '2026-10-12', 'M1', 'M1'],
          [4001, 502, '2026-10-10', '2026-10-10', '2026-10-12', 'M1', 'M1'],
          // PO 4002 có 1 SO nhưng chưa có A/R (đã qua ShipDate)
          [4002, 503, '2026-10-11', '2026-10-11', '2026-10-15', 'M1', 'M1'],
          // PO 4003 chưa có SO
        ],
      },
      ar: {
        columns: [
          'PO Number',
          'AR Number',
          'AR DocDate',
          'AR CreateDate',
          'AR ShipDate',
          'Invoice No',
        ],
        rows: [
          [4001, 801, '2026-10-12', '2026-10-12', '2026-10-12', 'INV-1'],
          [4001, 802, '2026-10-12', '2026-10-12', '2026-10-12', 'INV-2'],
          [4001, 803, '2026-10-12', '2026-10-12', '2026-10-12', 'INV-3'],
        ],
      },
    });

    const { rows, arRows, grpoRows } = assembleReturnChain(results, dateFrom, today);
    const funnel = buildReturnFunnel(rows, arRows, grpoRows, today);

    expect(RET_FUNNEL_HEADERS).toHaveLength(8);
    expect(funnel).toHaveLength(5);

    const step2 = funnel[1]!;
    expect(step2.unit).toBe('SO');
    expect(step2.vin).toBe(2); // 2 PO có SO (4001, 4002), không phải 3 SO
    expect(step2.ok).toBe(1); // 1 PO có A/R (4001)
    expect(step2.okText).toBe('1 SO → 3 A/R');
    expect(step2.wait).toBe(0);
    expect(step2.act).toBe(1);
    expect(step2.rate).toBe('50%');
  });

  it('Test Case 5: builds A/R without invoice table with sibling note and sorts by age desc then AR Number asc (Parity Trap 5)', () => {
    const results = createBaseQueryResults({
      po: {
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
          // PO 5001 có 1 A/R đã xuất HĐ (9001) và 1 A/R chưa xuất HĐ (9002) -> PO sang bước 4 (RST_NO_GRPO)
          [5001, '2026-10-10', '2026-10-10', 'MC001', '5001', 'MC-5001', 'K1', 'K1'],
          // PO 5002 chỉ có A/R chưa xuất HĐ (9010, 9005) -> PO ở bước 3 (RST_AR_NO_INV)
          [5002, '2026-10-12', '2026-10-12', 'MC011', '5001', 'MC-5002', 'K1', 'K1'],
        ],
      },
      so: {
        columns: [
          'PO Number',
          'SO Number',
          'SO DocDate',
          'SO CreateDate',
          'SO ShipDate',
          'Kho SO min',
          'Kho SO max',
        ],
        rows: [
          [5001, 6001, '2026-10-10', '2026-10-10', '2026-10-12', 'M1', 'M1'],
          [5002, 6002, '2026-10-12', '2026-10-12', '2026-10-14', 'M1', 'M1'],
        ],
      },
      ar: {
        columns: [
          'PO Number',
          'AR Number',
          'AR DocDate',
          'AR CreateDate',
          'AR ShipDate',
          'Invoice No',
        ],
        rows: [
          [5001, 9001, '2026-10-11', '2026-10-11', '2026-10-12', 'HD-9001'],
          // A/R 9002 tạo ngày 2026-10-18 -> tuổi = 3 ngày
          [5001, 9002, '2026-10-18', '2026-10-18', '2026-10-18', ''],
          // A/R 9010 và 9005 cùng tạo ngày 2026-10-15 -> tuổi = 6 ngày
          [5002, 9010, '2026-10-15', '2026-10-15', '2026-10-15', null],
          [5002, 9005, '2026-10-15', '2026-10-15', '2026-10-15', '   '],
        ],
      },
    });

    const { rows, arRows } = assembleReturnChain(results, dateFrom, today);
    const arNoInv = buildReturnArNoInv(rows, arRows, today);
    const arNoInvTable = recordsToTable(RET_AR_NOINV_COLS, arNoInv);

    expect(arNoInvTable.columns).toEqual([...RET_AR_NOINV_COLS]);
    expect(arNoInv).toHaveLength(3);

    // Sắp xếp theo tuổi giảm dần (6 ngày trước, 3 ngày sau), cùng tuổi thì AR Number ASCII tăng dần ('9005' trước '9010')
    expect(arNoInv.map((r) => r['AR Number'])).toEqual([9005, 9010, 9002]);
    expect(arNoInv.map((r) => r['Tuoi A/R (ngay)'])).toEqual([6, 6, 3]);

    // A/R 9002 thuộc PO 5001 (đã có 9001 xuất HĐ, trạng thái PO là RST_NO_GRPO != RST_AR_NO_INV)
    const ar9002 = arNoInv[2]!;
    expect(ar9002['PO con A/R khac da xuat HD']).toBe('9001');
    expect(ar9002['Trang thai PO']).toBe(RST_NO_GRPO);
    expect(ar9002['Ghi chu']).toBe(
      'PO đã được xếp vào bước sau vì có A/R khác đã xuất HĐ – A/R này vẫn thiếu HĐ',
    );

    // A/R 9005 thuộc PO 5002 (không có A/R nào xuất HĐ, trạng thái PO là RST_AR_NO_INV)
    expect(arNoInv[0]!['PO con A/R khac da xuat HD']).toBe('');
    expect(arNoInv[0]!['Trang thai PO']).toBe(RST_AR_NO_INV);
    expect(arNoInv[0]!['Ghi chu']).toBe('');
  });

  it('Test Case 6: computes buildReturnStatusSummary (problems, arNoInvCount, waiting, backlog) and countReturnStatusByCohort accurately', () => {
    const results = createBaseQueryResults({
      po: {
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
          // Nhóm mới: 1 RST_NO_SO (problem), 1 RST_NO_AR_WAIT_SHIP (waiting), 1 RST_NO_AP (problem), 1 RST_FULL
          [6001, '2026-10-10', '2026-10-10', 'MC001', '5001', 'M-1', 'K1', 'K1'],
          [6002, '2026-10-11', '2026-10-11', 'MC001', '5001', 'M-2', 'K1', 'K1'],
          [6003, '2026-10-12', '2026-10-12', 'MC001', '5001', 'M-3', 'K1', 'K1'],
          [6004, '2026-10-13', '2026-10-13', 'MC001', '5001', 'M-4', 'K1', 'K1'],
          // Nhóm cũ: 1 RST_NO_AR (backlog), 1 RST_FULL (không tính backlog)
          [5901, '2026-10-01', '2026-10-01', 'MC001', '5001', 'C-1', 'K1', 'K1'],
          [5902, '2026-10-02', '2026-10-02', 'MC001', '5001', 'C-2', 'K1', 'K1'],
        ],
      },
      so: {
        columns: [
          'PO Number',
          'SO Number',
          'SO DocDate',
          'SO CreateDate',
          'SO ShipDate',
          'Kho SO min',
          'Kho SO max',
        ],
        rows: [
          [6002, 7002, '2026-10-11', '2026-10-11', '2026-10-25', 'M1', 'M1'],
          [6003, 7003, '2026-10-12', '2026-10-12', '2026-10-15', 'M1', 'M1'],
          [6004, 7004, '2026-10-13', '2026-10-13', '2026-10-15', 'M1', 'M1'],
          [5901, 6901, '2026-10-08', '2026-10-08', '2026-10-10', 'M1', 'M1'],
          [5902, 6902, '2026-10-08', '2026-10-08', '2026-10-10', 'M1', 'M1'],
        ],
      },
      ar: {
        columns: [
          'PO Number',
          'AR Number',
          'AR DocDate',
          'AR CreateDate',
          'AR ShipDate',
          'Invoice No',
        ],
        rows: [
          [6003, 8003, '2026-10-12', '2026-10-12', '2026-10-15', 'INV-8003'],
          [6003, 80031, '2026-10-12', '2026-10-12', '2026-10-15', null],
          [6004, 8004, '2026-10-13', '2026-10-13', '2026-10-15', 'INV-8004'],
          [5902, 7902, '2026-10-09', '2026-10-09', '2026-10-10', 'INV-7902'],
        ],
      },
      grpo: {
        columns: [
          'PO Number',
          'GRPO Number',
          'GRPO DocDate',
          'Kho GRPO min',
          'Kho GRPO max',
        ],
        rows: [
          [6003, 9003, '2026-10-14', 'K1', 'K1'],
          [6004, 9004, '2026-10-14', 'K1', 'K1'],
          [5902, 8902, '2026-10-10', 'K1', 'K1'],
        ],
      },
      ap: {
        columns: ['PO Number', 'GRPO Number', 'AP Number', 'AP DocDate'],
        rows: [
          [6004, 9004, 10004, '2026-10-15'],
          [5902, 8902, 10902, '2026-10-11'],
        ],
      },
    });

    const { rows, arRows } = assembleReturnChain(results, dateFrom, today);
    const arNoInvRows = buildReturnArNoInv(rows, arRows, today);
    const summary = buildReturnStatusSummary(rows, arNoInvRows);

    expect(RET_STATUS_ORDER).toHaveLength(8);
    expect(summary).toEqual({
      problems: 2, // PO 6001 (RST_NO_SO) + PO 6003 (RST_NO_AP)
      arNoInvCount: 1, // A/R 80031
      waiting: 1, // PO 6002 (RST_NO_AR_WAIT_SHIP)
      backlog: 1, // PO 5901 (RST_NO_AR, nhóm Cũ)
    });

    const moiCounts = countReturnStatusByCohort(rows, NHOM_MOI);
    expect(moiCounts).toEqual({
      po_no_so: 1,
      so_no_ar: 0,
      so_no_ar_wait: 1,
      ar_no_inv: 0,
      ar_no_grpo: 0,
      ar_no_grpo_wait: 0,
      grpo_no_ap: 1,
      po_full: 1,
    });

    const cuCounts = countReturnStatusByCohort(rows, NHOM_CU);
    expect(cuCounts).toEqual({
      po_no_so: 0,
      so_no_ar: 1,
      so_no_ar_wait: 0,
      ar_no_inv: 0,
      ar_no_grpo: 0,
      ar_no_grpo_wait: 0,
      grpo_no_ap: 0,
      po_full: 1,
    });

    const allCounts = countReturnStatusByCohort(rows, null);
    expect(allCounts.po_full).toBe(2);
    expect(allCounts.po_no_so + allCounts.so_no_ar + allCounts.so_no_ar_wait + allCounts.grpo_no_ap + allCounts.po_full).toBe(6);

    const po6003 = rows.find((r) => r['PO Number'] === 6003);
    expect(po6003?.['Trang thai chuoi chung tu']).toBe(RST_NO_AP);
    const po6004 = rows.find((r) => r['PO Number'] === 6004);
    expect(po6004?.['Trang thai chuoi chung tu']).toBe(RST_FULL);
    const po6001 = rows.find((r) => r['PO Number'] === 6001);
    expect(po6001?.['Trang thai chuoi chung tu']).toBe(RST_NO_SO);
    const po5901 = rows.find((r) => r['PO Number'] === 5901);
    expect(po5901?.['Trang thai chuoi chung tu']).toBe(RST_NO_AR);
  });

  it('Test Case 7: preserves 28/15 baseline columns without leaking Kho PO min/max and passes through extra PO/AR columns', () => {
    const baselineRes = assembleReturnChain(createBaseQueryResults(), dateFrom, today);
    expect(baselineRes.columns).toHaveLength(28);
    expect(baselineRes.columns).not.toContain('Kho PO min');
    expect(baselineRes.columns).not.toContain('Kho PO max');
    expect(baselineRes.extraArCols).toEqual([]);

    const withExtras = createBaseQueryResults({
      po: {
        columns: [
          'PO Number',
          'PO DocDate',
          'PO CreateDate',
          'Store',
          'Brand',
          'MC Docnum',
          'Kho PO min',
          'Kho PO max',
          'Ghi chú UDF',
        ],
        rows: [
          [7001, '2026-10-12', '2026-10-12', 'MC001', '5001', 'MC-7001', 'DC01', 'DC01', 'Hàng vỡ vận chuyển'],
        ],
      },
      so: {
        columns: [
          'PO Number',
          'SO Number',
          'SO DocDate',
          'SO CreateDate',
          'SO ShipDate',
          'Kho SO min',
          'Kho SO max',
        ],
        rows: [
          [7001, 8001, '2026-10-12', '2026-10-12', '2026-10-14', 'MC001', 'MC001'],
        ],
      },
      ar: {
        columns: [
          'PO Number',
          'AR Number',
          'AR DocDate',
          'AR CreateDate',
          'AR ShipDate',
          'Invoice No',
          'Kênh xuất HĐ',
        ],
        rows: [
          [7001, 9001, '2026-10-13', '2026-10-13', '2026-10-14', null, 'E-Invoice VNPT'],
        ],
      },
    });

    const assembled = assembleReturnChain(withExtras, dateFrom, today);
    expect(assembled.table.columns).toEqual([...RET_CHAIN_COLUMNS, 'Ghi chú UDF']);
    expect(assembled.table.rows[0]?.[28]).toBe('Hàng vỡ vận chuyển');
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
    expect(arNoInvTable.rows[0]?.[15]).toBe('E-Invoice VNPT');
  });
});
