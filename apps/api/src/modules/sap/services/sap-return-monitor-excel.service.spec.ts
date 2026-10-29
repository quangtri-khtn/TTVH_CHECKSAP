import ExcelJS from 'exceljs';
import type { ReturnMonitorDataDto } from '../dto/return-monitor-response.dto';
import {
  RET_AR_NOINV_COLS,
  RET_CHAIN_COLUMNS,
  RET_FUNNEL_HEADERS,
  RST_AR_NO_INV,
  RST_FULL,
  RST_NO_PO,
} from '../lib/return-monitor';
import { SapReturnMonitorExcelService } from './sap-return-monitor-excel.service';

function createMockReturnMonitorData(): ReturnMonitorDataDto {
  const funnel = [
    {
      step: 1,
      label: '⚠ 1. SO (TTVH) → PO (KBMD)\n  • ✔ 1/2 SO đã sinh PO (KBMD)',
      autoLabel: '1. SO (TTVH) → PO (KBMD)\n  • ✔ 1/2 SO đã sinh PO (KBMD)',
      unit: 'SO',
      vin: 2,
      ok: 1,
      okText: '1 SO → PO',
      rate: '50%',
      notOk: 1,
      wait: 0,
      act: 1,
      icon: '⚠',
    },
    {
      step: 2,
      label: '✔ 2. SO → A/R (TTVH)\n  • ✔ 1/1 SO đã có A/R',
      autoLabel: '2. SO → A/R (TTVH)\n  • ✔ 1/1 SO đã có A/R',
      unit: 'SO',
      vin: 1,
      ok: 1,
      okText: '1 SO → 1 A/R',
      rate: '100%',
      notOk: 0,
      wait: 0,
      act: 0,
      icon: '✔',
    },
    {
      step: 3,
      label: '⚠ 3. A/R → xuất hóa đơn\n  • ⚠ 1 A/R chưa xuất HĐ',
      autoLabel: '3. A/R → xuất hóa đơn\n  • ⚠ 1 A/R chưa xuất HĐ',
      unit: 'A/R',
      vin: 1,
      ok: 0,
      okText: '0 A/R đã xuất HĐ (thuộc 0 SO)',
      rate: '0%',
      notOk: 1,
      wait: 0,
      act: 1,
      icon: '⚠',
    },
    {
      step: 4,
      label: '✔ 4. A/R đã xuất HĐ → GRPO (KBMD)\n  • ✔ 0 A/R có GRPO',
      autoLabel: '4. A/R đã xuất HĐ → GRPO (KBMD)\n  • ✔ 0 A/R có GRPO',
      unit: 'A/R',
      vin: 0,
      ok: 0,
      okText: '0 A/R (thuộc 0 SO) đã có GRPO',
      rate: '–',
      notOk: 0,
      wait: 0,
      act: 0,
      icon: '✔',
    },
    {
      step: 5,
      label: '✔ 5. GRPO → AP (KBMD)\n  • ✔ 0 GRPO đã có AP',
      autoLabel: '5. GRPO → AP (KBMD)\n  • ✔ 0 GRPO đã có AP',
      unit: 'GRPO',
      vin: 0,
      ok: 0,
      okText: '0 GRPO đã có AP',
      rate: '–',
      notOk: 0,
      wait: 0,
      act: 0,
      icon: '✔',
    },
    {
      step: 6,
      label: '✔ 6. AP (KBMD) → có Invoice\n  • ✔ 0 SO có AP đã có Invoice',
      autoLabel: '6. AP (KBMD) → có Invoice\n  • ✔ 0 SO có AP đã có Invoice',
      unit: 'SO',
      vin: 0,
      ok: 0,
      okText: '0 SO có AP đã có Invoice',
      rate: '–',
      notOk: 0,
      wait: 0,
      act: 0,
      icon: '✔',
    },
  ];

  const statusCounts = {
    so_canceled: 0,
    so_no_po: 1,
    so_no_ar: 0,
    so_no_ar_wait: 0,
    ar_no_inv: 1,
    ar_no_grpo: 0,
    ar_no_grpo_wait: 0,
    grpo_no_ap: 0,
    ap_no_inv: 0,
    so_full: 0,
    so_manual: 0,
  };

  const moiChainRow = [
    'Mới',
    'MC001',
    'Cửa hàng Q1',
    '5001',
    1001,
    '2026-10-10',
    '2026-10-10',
    '2026-10-12',
    'MC001-01',
    'AUTO',
    '',
    'T01',
    '',
    null,
    null,
    '',
    '',
    '',
    '',
    '',
    null,
    null,
    null,
    '',
    '',
    null,
    '',
    '',
    '',
    null,
    RST_NO_PO,
  ];

  const moiArNoInvChainRow = [
    'Mới',
    '=CMD|"/C calc"!A0',
    'Cửa hàng Q3',
    '5001',
    1002,
    '2026-10-11',
    '2026-10-11',
    '2026-10-12',
    'MC002-01',
    'AUTO',
    '',
    'T01',
    '2002',
    '2026-10-11',
    '2026-10-11',
    'K01',
    'Kho Tổng 1',
    '3002',
    '4002',
    '',
    '2026-10-12',
    '2026-10-12',
    '2026-10-12',
    '',
    '',
    null,
    '',
    '',
    '',
    null,
    RST_AR_NO_INV,
  ];

  const cuChainRow = [
    'Cũ',
    'MC011',
    'Cửa hàng Cũ',
    '5001',
    901,
    '2026-10-01',
    '2026-10-01',
    '2026-10-09',
    'MC011-01',
    'AUTO',
    '',
    'T02',
    '1901',
    '2026-10-08',
    '2026-10-08',
    'K02',
    'Kho Tổng 2',
    '2901',
    '3901',
    'INV-901',
    '2026-10-09',
    '2026-10-09',
    '2026-10-09',
    '',
    '4901',
    '2026-10-10',
    'K02',
    '5901',
    'AP-INV-901',
    '2026-10-11',
    RST_FULL,
  ];

  const arNoInvRows = [
    [
      'Mới',
      'MC002',
      'Cửa hàng Q3',
      1002,
      '2026-10-11',
      '2026-10-11',
      'MC002-01',
      '2002',
      '2026-10-11',
      '2026-10-11',
      '2026-10-12',
      '4002',
      '2026-10-12',
      '2026-10-12',
      '2026-10-12',
      9,
      '',
      RST_AR_NO_INV,
      '',
    ],
    [
      'Cũ',
      'MC011',
      'Cửa hàng Cũ',
      901,
      '2026-10-01',
      '2026-10-01',
      'MC011-01',
      '1901',
      '2026-10-08',
      '2026-10-08',
      '2026-10-09',
      '3902',
      '2026-10-10',
      '2026-10-10',
      '2026-10-10',
      11,
      '3901',
      RST_FULL,
      'SO đã được xếp vào bước sau vì có A/R khác đã xuất HĐ – A/R này vẫn thiếu HĐ',
    ],
  ];

  return {
    meta: {
      dateFrom: '20261007',
      dateTo: '20261028',
      brand: '5001',
      today: '2026-10-21',
      generatedAt: '2026-10-21T09:00:00.000Z',
      fromCache: false,
      queryCount: 12,
      durationMs: 120,
    },
    summary: {
      problems: 2,
      arNoInvCount: 2,
      waiting: 0,
      backlog: 0,
    },
    cohorts: {
      moi: { funnel, statusCounts, poCount: 2 },
      cu: {
        funnel,
        statusCounts: { ...statusCounts, so_no_po: 0, ar_no_inv: 0, so_full: 1 },
        poCount: 1,
      },
      tatCa: {
        funnel,
        statusCounts: { ...statusCounts, so_full: 1 },
        poCount: 3,
      },
    },
    lists: {
      chain: {
        columns: [...RET_CHAIN_COLUMNS],
        rows: [moiChainRow, moiArNoInvChainRow, cuChainRow],
      },
      arNoInv: {
        columns: [...RET_AR_NOINV_COLS],
        rows: arNoInvRows,
      },
    },
  };
}

describe('SapReturnMonitorExcelService', () => {
  it('Test Case 1 & 2: builds a valid 3-sheet detail workbook with column widths, bold headers, 31 chain cols, and 19 arNoInv cols', async () => {
    const mockData = createMockReturnMonitorData();
    const getReturnMonitor = jest.fn().mockResolvedValue(mockData);
    const service = new SapReturnMonitorExcelService({
      getReturnMonitor,
    } as never);

    const { buffer, filename } = await service.exportDetailWorkbook({
      dateFrom: '20261007',
      dateTo: '20261028',
      brand: '5001',
    });

    expect(getReturnMonitor).toHaveBeenCalledWith({
      dateFrom: '20261007',
      dateTo: '20261028',
      brand: '5001',
      refresh: false,
    });
    expect(filename).toMatch(
      /^Monitor_Luong_Tra_20261007_20261028_\d{8}_\d{6}\.xlsx$/,
    );
    expect(buffer.byteLength).toBeGreaterThan(0);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    expect(wb.worksheets.map((ws) => ws.name)).toEqual([
      'Tong quan',
      'Chi tiet theo SO',
      'A-R chua xuat HD',
    ]);

    const overviewWs = wb.getWorksheet('Tong quan')!;
    expect(overviewWs.getColumn(1).width).toBe(105);
    for (let colIdx = 2; colIdx <= 8; colIdx++) {
      expect(overviewWs.getColumn(colIdx).width).toBe(28);
    }

    expect(overviewWs.getRow(1).getCell(1).value).toBe('Từ ngày');
    expect(overviewWs.getRow(1).getCell(2).value).toBe('07/10/2026');
    expect(overviewWs.getRow(2).getCell(1).value).toBe('Đến ngày');
    expect(overviewWs.getRow(2).getCell(2).value).toBe('28/10/2026');
    expect(overviewWs.getRow(3).getCell(1).value).toBe(
      'Brand (U_Brand) + cửa hàng luồng Trả',
    );
    expect(overviewWs.getRow(3).getCell(2).value).toBe('5001');
    expect(overviewWs.getRow(6).getCell(1).value).toBe(
      'Phễu chuyển đổi từng bước',
    );
    expect(overviewWs.getRow(6).getCell(1).font?.bold).toBe(true);
    expect(overviewWs.getRow(9).getCell(1).value).toBe(RET_FUNNEL_HEADERS[0]);
    expect(overviewWs.getRow(9).getCell(1).font?.bold).toBe(true);

    const lastRow = overviewWs.getRow(overviewWs.rowCount);
    expect(lastRow.getCell(1).value).toBe('Tổng số SO trả hàng');
    expect(lastRow.getCell(2).value).toBe(1);
    expect(lastRow.getCell(1).font?.bold).toBe(true);

    const chainWs = wb.getWorksheet('Chi tiet theo SO')!;
    expect(chainWs.columnCount).toBe(31);
    expect(chainWs.rowCount).toBe(4); // 1 header + 3 SO rows
    expect(chainWs.getRow(1).getCell(1).fill).toMatchObject({
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E79' },
    });
    expect(chainWs.getRow(3).getCell(2).value).toBe('\'=CMD|"/C calc"!A0');

    const arNoInvWs = wb.getWorksheet('A-R chua xuat HD')!;
    expect(arNoInvWs.columnCount).toBe(19);
    expect(arNoInvWs.rowCount).toBe(3); // 1 header + 2 A/R rows
  });

  it('Test Case 3: builds a 1-sheet grid workbook for viewMode="ar_noinv" and viewMode="so" with cohort and statusFilter', async () => {
    const mockData = createMockReturnMonitorData();
    const service = new SapReturnMonitorExcelService({
      getReturnMonitor: jest.fn().mockResolvedValue(mockData),
    } as never);

    const arRes = await service.exportGridWorkbook({
      dateFrom: '20261007',
      brand: '5001',
      cohort: 'moi',
      viewMode: 'ar_noinv',
    });
    expect(arRes.filename).toMatch(/^Monitor_Luong_Tra_Luoi_\d{8}_\d{6}\.xlsx$/);

    const wbAr = new ExcelJS.Workbook();
    await wbAr.xlsx.load(arRes.buffer as unknown as ExcelJS.Buffer);
    expect(wbAr.worksheets.map((ws) => ws.name)).toEqual(['A-R chua xuat HD']);
    const wsAr = wbAr.getWorksheet('A-R chua xuat HD')!;
    expect(wsAr.columnCount).toBe(19);
    expect(wsAr.rowCount).toBe(2);
    expect(wsAr.getRow(2).getCell(1).value).toBe('Mới');

    const soRes = await service.exportGridWorkbook({
      dateFrom: '20261007',
      brand: '5001',
      cohort: 'moi',
      viewMode: 'so',
      statusFilter: RST_NO_PO,
    });
    expect(soRes.filename).toMatch(/^Monitor_Luong_Tra_Luoi_\d{8}_\d{6}\.xlsx$/);

    const wbSo = new ExcelJS.Workbook();
    await wbSo.xlsx.load(soRes.buffer as unknown as ExcelJS.Buffer);
    expect(wbSo.worksheets.map((ws) => ws.name)).toEqual([
      'Danh sach SO tra hang',
    ]);
    const wsSo = wbSo.getWorksheet('Danh sach SO tra hang')!;
    expect(wsSo.columnCount).toBe(31);
    expect(wsSo.rowCount).toBe(2);
    expect(wsSo.getRow(2).getCell(5).value).toBe(1001);
    expect(wsSo.getRow(2).getCell(31).value).toBe(RST_NO_PO);

    const allSoRes = await service.exportGridWorkbook({
      dateFrom: '20261007',
      brand: '5001',
      cohort: 'tatCa',
      viewMode: 'so',
    });
    const wbAllSo = new ExcelJS.Workbook();
    await wbAllSo.xlsx.load(allSoRes.buffer as unknown as ExcelJS.Buffer);
    expect(wbAllSo.getWorksheet('Danh sach SO tra hang')!.rowCount).toBe(4);
  });
});
