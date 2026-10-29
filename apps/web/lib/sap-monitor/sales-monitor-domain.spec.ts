import { ApiError } from '@/lib/api/http-client';
import type { SalesMonitorDataDto } from '@/lib/api/generated/model';
import {
  SALES_BRAND_OPTIONS,
  dateInputToSapDate,
  filterTableByCohort,
  formatSalesGeneratedTime,
  formatSalesScopeLine,
  formatSapCell,
  getSalesMonitorErrorMessage,
  getViewRowCount,
  getYesterdaySapDate,
  isNumericSapColumn,
  resolveActiveGridData,
  sapDateToDateInput,
} from './sales-monitor-domain';
function makeMockMonitorData(): SalesMonitorDataDto {
  const emptyDocItem = (key: string, label: string, unit: string) => ({
    key,
    label,
    unit,
    tag: 'attn',
    count: 0,
    columns: ['Nhom', 'Store', 'PO Number'],
    rows: [],
  });

  return {
    meta: {
      dateFrom: '20261007',
      brand: '5001',
      today: '2026-10-21',
      generatedAt: '2026-10-21T08:30:00.000Z',
      fromCache: false,
      queryCount: 15,
      durationMs: 120,
    },
    summary: {
      problems: 5,
      t2Due: 2,
      waiting: 3,
      backlog: 1,
    },
    cohorts: {
      moi: {
        funnel: [
          {
            step: 1,
            label: '⚠ 1. PO → SO:\n   ✔ 8/10 PO đã sinh SO',
            autoLabel: '1. PO → SO:\n   ✔ 8/10 PO đã sinh SO',
            unit: 'PO',
            vin: 10,
            ok: 8,
            okText: '8 SO',
            rate: '80%',
            notOk: 2,
            wait: 0,
            act: 2,
            icon: '⚠',
          },
          {
            step: 2,
            label: '⏳ 2. SO → A/R:\n   ✔ 6/8 SO đã có A/R',
            autoLabel: '2. SO → A/R:\n   ✔ 6/8 SO đã có A/R',
            unit: 'SO',
            vin: 8,
            ok: 6,
            okText: '6 SO → 6 A/R',
            rate: '75%',
            notOk: 2,
            wait: 1,
            act: 1,
            icon: '⏳',
          },
        ],
        docStatusCounts: {
          po_no_so: 2,
          so_no_ar: 1,
          so_no_ar_wait: 1,
          ar_no_inv: 0,
          ar_no_inv_bd: 0,
          ar_no_grpo: 0,
          ar_no_grpo_wait: 0,
          grpo_no_ap: 0,
          po_full: 6,
        },
        poCount: 10,
      },
      cu: {
        funnel: [],
        docStatusCounts: {
          po_no_so: 1,
          so_no_ar: 0,
          so_no_ar_wait: 0,
          ar_no_inv: 0,
          ar_no_inv_bd: 0,
          ar_no_grpo: 0,
          ar_no_grpo_wait: 0,
          grpo_no_ap: 0,
          po_full: 0,
        },
        poCount: 1,
      },
      tatCa: {
        funnel: [],
        docStatusCounts: {
          po_no_so: 3,
          so_no_ar: 1,
          so_no_ar_wait: 1,
          ar_no_inv: 0,
          ar_no_inv_bd: 0,
          ar_no_grpo: 0,
          ar_no_grpo_wait: 0,
          grpo_no_ap: 0,
          po_full: 6,
        },
        poCount: 11,
      },
    },
    docStatus: {
      po_no_so: {
        key: 'po_no_so',
        label: '1 - PO chưa có SO',
        unit: 'PO',
        tag: 'attn',
        count: 3,
        columns: ['Nhom', 'Store', 'PO Number'],
        rows: [
          ['Mới', 'S01', 1001],
          ['Mới', 'S02', 1002],
          ['Cũ', 'S03', 900],
        ],
      },
      so_no_ar: {
        key: 'so_no_ar',
        label: '2a - SO chưa có A/R (đã đến/qua SO ShipDate, cần kiểm tra)',
        unit: 'SO',
        tag: 'attn',
        count: 1,
        columns: ['Nhom', 'Store', 'PO Number', 'SO Number'],
        rows: [['Mới', 'S01', 1003, '2001']],
      },
      so_no_ar_wait: {
        key: 'so_no_ar_wait',
        label: '2b - SO chưa có A/R: SO ShipDate > hôm nay, chưa đến ngày xuất hàng (bình thường)',
        unit: 'SO',
        tag: 'normal',
        count: 1,
        columns: ['Nhom', 'Store', 'PO Number', 'SO Number'],
        rows: [['Mới', 'S02', 1004, '2002']],
      },
      ar_no_inv: emptyDocItem('ar_no_inv', '3a - A/R chưa xuất hóa đơn (cần xử lý)', 'A/R'),
      ar_no_inv_bd: emptyDocItem('ar_no_inv_bd', '3b - A/R chưa xuất HĐ', 'A/R'),
      ar_no_grpo: emptyDocItem('ar_no_grpo', '4a - A/R đã xuất HĐ, PO chưa có GRPO', 'A/R'),
      ar_no_grpo_wait: emptyDocItem('ar_no_grpo_wait', '4b - A/R đã xuất HĐ chờ ngày', 'A/R'),
      grpo_no_ap: emptyDocItem('grpo_no_ap', '5 - GRPO chưa có AP', 'GRPO'),
      po_full: emptyDocItem('po_full', '6 - PO đủ chuỗi PO → AP', 'PO'),
    },
    lists: {
      overview: {
        columns: ['Store', 'Tên cửa hàng', 'PO'],
        rows: [
          ['S01', 'Cửa hàng 1', 5],
          ['S02', 'Cửa hàng 2', 5],
          ['TỔNG', '2 cửa hàng', 10],
        ],
      },
      chain: {
        columns: ['Nhom', 'Store', 'PO Number', 'Tong SL PO'],
        rows: [
          ['Mới', 'S01', 1001, 12.5],
          ['Cũ', 'S03', 900, 8],
        ],
      },
      t1: { columns: ['Nhom', 'Store', 'PO Number'], rows: [['Mới', 'S01', 1001]] },
      t2: { columns: ['Nhom', 'Store', 'PO Number'], rows: [] },
      t3: { columns: ['Nhom', 'Store', 'PO Number'], rows: [] },
      t4: { columns: ['Nhom', 'Store', 'PO Number'], rows: [] },
      ar: { columns: ['Nhom', 'Store', 'AR Number'], rows: [] },
      grpo: { columns: ['Nhom', 'Store', 'GRPO Number'], rows: [] },
      ap: { columns: ['Nhom', 'Store', 'AP Number'], rows: [] },
    },
  };
}

describe('sales-monitor-domain', () => {
  it('filterTableByCohort lọc đúng theo Nhóm mới, Nhóm cũ và Tất cả', () => {
    const cols = ['Nhom', 'Store', 'PO Number'];
    const rows = [
      ['Mới', 'S01', 1001],
      ['Cũ', 'S02', 900],
    ];
    expect(filterTableByCohort(cols, rows, 'moi')).toEqual([['Mới', 'S01', 1001]]);
    expect(filterTableByCohort(cols, rows, 'cu')).toEqual([['Cũ', 'S02', 900]]);
    expect(filterTableByCohort(cols, rows, 'tatCa')).toHaveLength(2);
  });

  it('getViewRowCount trừ dòng TỔNG cho overview và lọc theo cohort cho các bảng khác', () => {
    const data = makeMockMonitorData();
    expect(getViewRowCount(data.lists, 'overview', 'moi')).toBe(2);
    expect(getViewRowCount(data.lists, 'chain', 'moi')).toBe(1);
    expect(getViewRowCount(data.lists, 'chain', 'cu')).toBe(1);
    expect(getViewRowCount(data.lists, 'chain', 'tatCa')).toBe(2);
  });

  it('resolveActiveGridData gộp đúng dòng khi drilldown bước phễu và lọc theo cohort', () => {
    const data = makeMockMonitorData();
    const resStep2 = resolveActiveGridData(data, 'overview', 'moi', {
      type: 'funnel',
      stepIndex: 1,
    });
    expect(resStep2.exportSourceType).toBe('funnel');
    expect(resStep2.exportSourceKey).toBe('1');
    expect(resStep2.rows).toHaveLength(2);
    expect(resStep2.drilldownTitle).toContain('2. SO → A/R – chưa thành công [SO]: 2 chứng từ');
  });

  it('resolveActiveGridData lọc đúng khi drilldown docStatus và cập nhật khi đổi cohort', () => {
    const data = makeMockMonitorData();
    const resMoi = resolveActiveGridData(data, 'overview', 'moi', {
      type: 'docStatus',
      key: 'po_no_so',
    });
    expect(resMoi.rows).toHaveLength(2);
    expect(resMoi.drilldownTitle).toBe('1 - PO chưa có SO [PO]: 2 chứng từ');

    const resCu = resolveActiveGridData(data, 'overview', 'cu', {
      type: 'docStatus',
      key: 'po_no_so',
    });
    expect(resCu.rows).toHaveLength(1);
    expect(resCu.drilldownTitle).toBe('1 - PO chưa có SO [PO]: 1 chứng từ');
  });

  it('formatSapCell và isNumericSapColumn xử lý đúng mã chứng từ và số lượng', () => {
    expect(formatSapCell(1001234, 'PO Number')).toBe('1001234');
    expect(formatSapCell(1234.5, 'Tong SL PO')).toBe('1,234.50');
    expect(formatSapCell(1200, 'PO')).toBe('1,200');
    expect(isNumericSapColumn('PO Number', [[1001]], 0)).toBe(false);
    expect(isNumericSapColumn('Tong SL PO', [[12.5]], 0)).toBe(true);
  });

  it('formatSalesScopeLine, formatSalesGeneratedTime, getYesterdaySapDate, SALES_BRAND_OPTIONS, sapDateToDateInput, dateInputToSapDate và getSalesMonitorErrorMessage hoạt động đúng', () => {
    expect(formatSalesScopeLine('20261007', '5001')).toContain(
      'Chứng từ từ 07/10/2026 – brand 5001.',
    );
    expect(formatSalesScopeLine('20261007', 'ALL')).toContain(
      'Chứng từ từ 07/10/2026 – tất cả thương hiệu.',
    );
    expect(getYesterdaySapDate(new Date('2026-10-21T08:00:00.000Z'))).toBe('20261020');
    expect(SALES_BRAND_OPTIONS.map((b) => b.value)).toEqual([
      'ALL',
      '5001',
      '5002',
      '5003',
      '5004',
      '5005',
      '5006',
      '5007',
    ]);
    expect(sapDateToDateInput('20261021')).toBe('2026-10-21');
    expect(sapDateToDateInput('invalid')).toBe('');
    expect(dateInputToSapDate('2026-10-21')).toBe('20261021');
    expect(dateInputToSapDate('0002-10-21')).toBe('');
    expect(dateInputToSapDate('2026/10/21')).toBe('');
    expect(formatSalesGeneratedTime('2026-10-21T08:43:36.000Z')).toBe('15:43:36');
    expect(getSalesMonitorErrorMessage(new ApiError(503, 'HTTP 503'))).toBe(
      'Chưa cấu hình kết nối SAP, liên hệ admin',
    );
  });
});
