import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { SalesMonitorDataDto } from '../dto/sales-monitor-response.dto';
import {
  formatCellForWidth,
  formatVietnamDateTime,
  sanitizeExcelCellValue,
  sanitizeExcelSheetName,
} from '../lib/excel-sheet-writer';
import {
  CHAIN_COLUMNS,
  DOC_AR_COLS,
  DOC_GRPO_COLS,
  DOC_SO_COLS,
  DOC_STATUS_ITEMS,
  OVERVIEW_COLUMNS,
} from '../lib/sales-monitor';
import { SapSalesMonitorExcelService } from './sap-sales-monitor-excel.service';

function createMockSalesMonitorData(): SalesMonitorDataDto {
  const funnel = [
    {
      step: 1,
      label: '⚠ 1. PO -> SO',
      autoLabel: '1. PO -> SO:\n  + OK: 8 PO',
      unit: 'PO',
      vin: 10,
      ok: 8,
      okText: '8 PO',
      rate: '80%',
      notOk: 2,
      wait: 0,
      act: 2,
      icon: '⚠',
    },
    {
      step: 2,
      label: '⏳ 2. SO -> A/R',
      autoLabel: '2. SO -> A/R:\n  + OK: 7 SO',
      unit: 'SO',
      vin: 8,
      ok: 7,
      okText: '7 SO',
      rate: '88%',
      notOk: 1,
      wait: 1,
      act: 0,
      icon: '⏳',
    },
    {
      step: 3,
      label: '⚠ 3. A/R -> HĐ',
      autoLabel: '3. A/R -> HĐ:\n  + OK: 6 A/R',
      unit: 'A/R',
      vin: 7,
      ok: 6,
      okText: '6 A/R',
      rate: '86%',
      notOk: 1,
      wait: 0,
      act: 1,
      icon: '⚠',
    },
    {
      step: 4,
      label: '⚠ 4. A/R -> GRPO',
      autoLabel: '4. A/R -> GRPO:\n  + OK: 5 A/R',
      unit: 'A/R',
      vin: 6,
      ok: 5,
      okText: '5 A/R',
      rate: '83%',
      notOk: 1,
      wait: 0,
      act: 1,
      icon: '⚠',
    },
    {
      step: 5,
      label: '✔ 5. GRPO -> AP',
      autoLabel: '5. GRPO -> AP:\n  + OK: 5 GRPO',
      unit: 'GRPO',
      vin: 5,
      ok: 5,
      okText: '5 GRPO',
      rate: '100%',
      notOk: 0,
      wait: 0,
      act: 0,
      icon: '✔',
    },
  ];

  const docStatusCounts = {
    po_no_so: 2,
    so_no_ar: 0,
    so_no_ar_wait: 1,
    ar_no_inv: 1,
    ar_no_inv_bd: 1,
    ar_no_grpo: 1,
    ar_no_grpo_wait: 0,
    grpo_no_ap: 0,
    po_full: 5,
  };

  const docStatusEntries = Object.fromEntries(
    DOC_STATUS_ITEMS.map((item) => {
      const cols =
        item.unit === 'SO'
          ? [...DOC_SO_COLS]
          : item.unit === 'A/R'
            ? [...DOC_AR_COLS]
            : item.unit === 'GRPO'
              ? [...DOC_GRPO_COLS]
              : [...CHAIN_COLUMNS];
      return [
        item.key,
        {
          key: item.key,
          label: item.label,
          unit: item.unit,
          tag: item.tag,
          count: 2,
          columns: cols,
          rows: [
            cols.map((_c, idx) => (idx === 0 ? 'Mới' : `moi_${item.key}_${idx}`)),
            cols.map((_c, idx) => (idx === 0 ? 'Cũ' : `cu_${item.key}_${idx}`)),
          ],
        },
      ];
    }),
  );

  return {
    meta: {
      dateFrom: '20261007',
      brand: '5001',
      today: '2026-10-21',
      generatedAt: '2026-10-21T08:00:00.000Z',
      fromCache: true,
      queryCount: 8,
      durationMs: 120,
    },
    summary: { problems: 4, t2Due: 0, waiting: 1, backlog: 1 },
    cohorts: {
      moi: { funnel, docStatusCounts, poCount: 1 },
      cu: { funnel, docStatusCounts, poCount: 1 },
      tatCa: { funnel, docStatusCounts, poCount: 2 },
    },
    docStatus: docStatusEntries as unknown as SalesMonitorDataDto['docStatus'],
    lists: {
      overview: {
        columns: [...OVERVIEW_COLUMNS],
        rows: [
          ['MC001', 'Store 1', 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
          ['TỔNG', '1 cửa hàng', 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
        ],
      },
      chain: {
        columns: [...CHAIN_COLUMNS],
        rows: [
          [
            'Mới',
            'MC001',
            1001,
            '2026-10-08',
            '2026-10-08',
            '',
            'O',
            3,
            12.5,
            'SO1',
            '2026-10-08',
            '2026-10-09',
            'AR1',
            'INV1',
            '2026-10-08',
            '2026-10-08',
            '2026-10-09',
            '',
            'GRPO1',
            '2026-10-08',
            'AP1',
            '2026-10-08',
            '6 - Đủ chuỗi PO → AP',
          ],
          [
            'Cũ',
            '=CMD|"/C calc"!A0',
            999,
            '2026-10-01',
            '2026-10-01',
            'Co',
            'O',
            2,
            10,
            'SO0',
            '2026-10-07',
            '2026-10-08',
            'AR0',
            '',
            '2026-10-07',
            '2026-10-07',
            '2026-10-08',
            '',
            '',
            '',
            '',
            '',
            '3 - Có A/R, chưa xuất hóa đơn',
          ],
        ],
      },
      t1: {
        columns: ['Nhom', 'Store', 'PO Number'],
        rows: [
          ['Mới', 'MC001', 1001],
          ['Cũ', 'MC002', 999],
        ],
      },
      t2: { columns: ['Nhom', 'Store', 'SO Number'], rows: [['Mới', 'MC001', 2001]] },
      t3: { columns: ['Nhom', 'Store', 'AR Number'], rows: [['Mới', 'MC001', 3001]] },
      t4: { columns: ['Nhom', 'Store', 'GRPO Number'], rows: [['Mới', 'MC001', 4001]] },
      ar: { columns: ['Nhom', 'Store', 'AR Number'], rows: [['Mới', 'MC001', 3001]] },
      grpo: { columns: ['Nhom', 'Store', 'GRPO Number'], rows: [['Mới', 'MC001', 4001]] },
      ap: { columns: ['Nhom', 'Store', 'AP Number'], rows: [['Mới', 'MC001', 5001]] },
    },
  };
}

describe('SapSalesMonitorExcelService & excel-sheet-writer', () => {
  it('sanitizes sheet names, formula injection, cell widths, and timestamps', () => {
    expect(sanitizeExcelSheetName('T3 – AR đã xuất HĐ, chưa có GRPO')).toBe(
      'T3 AR đã xuất HĐ, chưa có GRPO',
    );
    expect(
      sanitizeExcelSheetName('A/B\\C*D?E:F[G]H123456789012345678901234567890'),
    ).toBe('ABCDEFGH12345678901234567890123');
    expect(sanitizeExcelCellValue('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(sanitizeExcelCellValue('  +cmd')).toBe("'  +cmd");
    expect(sanitizeExcelCellValue('MC001')).toBe('MC001');
    expect(formatCellForWidth(null)).toBe('');
    expect(formatCellForWidth(12.5)).toBe('12.50');
    const ts = formatVietnamDateTime(new Date('2026-10-21T08:05:09.000Z'));
    expect(ts.fileTimestamp).toBe('20261021_150509');
    expect(ts.displayTimestamp).toBe('21/10/2026 15:05:09');
  });

  it('builds a valid 11-sheet detail workbook with styling and formula protection', async () => {
    const mockData = createMockSalesMonitorData();
    const getSalesMonitor = jest.fn().mockResolvedValue(mockData);
    const service = new SapSalesMonitorExcelService({
      getSalesMonitor,
    } as never);

    const { buffer, filename } = await service.exportDetailWorkbook({
      dateFrom: '20261007',
      brand: '5001',
    });

    expect(getSalesMonitor).toHaveBeenCalledWith({
      dateFrom: '20261007',
      brand: '5001',
      refresh: false,
    });
    expect(filename).toMatch(/^Monitor_Chi_Tiet_20261007_Brand5001_\d{8}_\d{6}\.xlsx$/);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    expect(wb.worksheets.map((ws) => ws.name)).toEqual([
      'Tong quan',
      'Chi tiet theo PO',
      'A-R chua xuat HD',
      'Tổng quan theo cửa hàng',
      'T1 PO chưa có SO',
      'T2 SO chưa có AR',
      'T3 AR đã xuất HĐ, chưa có GRPO',
      'T4 GRPO chưa có AP',
      'AR trong kỳ',
      'GRPO trong kỳ',
      'AP trong kỳ',
    ]);

    const chainWs = wb.getWorksheet('Chi tiet theo PO')!;
    expect(chainWs.getRow(1).getCell(1).fill).toMatchObject({
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E79' },
    });
    expect(chainWs.getRow(2).getCell(9).numFmt).toBe('#,##0.00###');
    expect(chainWs.getRow(3).getCell(2).value).toBe('\'=CMD|"/C calc"!A0');

    const arNoInvWs = wb.getWorksheet('A-R chua xuat HD')!;
    expect(arNoInvWs.rowCount).toBe(5); // 1 header + 2 ar_no_inv + 2 ar_no_inv_bd

    const overviewWs = wb.getWorksheet('Tong quan')!;
    const lastRow = overviewWs.getRow(overviewWs.rowCount);
    expect(lastRow.getCell(1).value).toBe('PO có ngày tạo trước kỳ');
    expect(lastRow.getCell(2).value).toBe(1);
  });

  it('builds a 1-sheet grid workbook filtered by cohort and sourceType', async () => {
    const mockData = createMockSalesMonitorData();
    const service = new SapSalesMonitorExcelService({
      getSalesMonitor: jest.fn().mockResolvedValue(mockData),
    } as never);

    const viewRes = await service.exportGridWorkbook({
      dateFrom: '20261007',
      brand: '5001',
      cohort: 'moi',
      sourceType: 'view',
      sourceKey: 't1',
    });
    expect(viewRes.filename).toMatch(/^Monitor_Chung_Tu_Treo_\d{8}_\d{6}\.xlsx$/);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(viewRes.buffer as unknown as ExcelJS.Buffer);
    const ws = wb.getWorksheet('Monitor_Chung_Tu_Treo')!;
    expect(ws.rowCount).toBe(2); // 1 header + 1 row in 'Mới'

    const funnelRes = await service.exportGridWorkbook({
      dateFrom: '20261007',
      brand: '5001',
      cohort: 'tatCa',
      sourceType: 'funnel',
      sourceKey: '1', // ['so_no_ar', 'so_no_ar_wait'] -> 2 + 2 = 4 rows
    });
    const wbFunnel = new ExcelJS.Workbook();
    await wbFunnel.xlsx.load(funnelRes.buffer as unknown as ExcelJS.Buffer);
    expect(wbFunnel.getWorksheet('Monitor_Chung_Tu_Treo')!.rowCount).toBe(5);

    await expect(
      service.exportGridWorkbook({
        sourceType: 'view',
        sourceKey: 'invalid_key',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
