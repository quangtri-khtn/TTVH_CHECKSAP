import ExcelJS from 'exceljs';
import type { ReturnMonitorDataDto } from '../dto/return-monitor-response.dto';
import {
  RET_AR_NOINV_COLS,
  RET_CHAIN_COLUMNS,
  RET_FUNNEL_HEADERS,
  RST_AR_NO_INV,
  RST_FULL,
  RST_NO_SO,
} from '../lib/return-monitor';
import { SapReturnMonitorExcelService } from './sap-return-monitor-excel.service';

function createMockReturnMonitorData(): ReturnMonitorDataDto {
  const funnel = [
    {
      step: 1,
      label: '⚠ 1. PO → SO (TTVH)\n  • ✔ 1 PO đã sync SO',
      autoLabel: '1. PO → SO (TTVH)\n  • ✔ 1 PO đã sync SO',
      unit: 'PO',
      vin: 2,
      ok: 1,
      okText: '1 PO đã sync SO',
      rate: '50%',
      notOk: 1,
      wait: 0,
      act: 1,
      icon: '⚠',
    },
    {
      step: 2,
      label: '✔ 2. SO → A/R (TTVH)\n  • ✔ 1 SO đã lên A/R',
      autoLabel: '2. SO → A/R (TTVH)\n  • ✔ 1 SO đã lên A/R',
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
      okText: '0 A/R đã xuất HĐ',
      rate: '0%',
      notOk: 1,
      wait: 0,
      act: 1,
      icon: '⚠',
    },
    {
      step: 4,
      label: '✔ 4. A/R có HĐ → GRPO (KBMD)\n  • ✔ 0 A/R có GRPO',
      autoLabel: '4. A/R có HĐ → GRPO (KBMD)\n  • ✔ 0 A/R có GRPO',
      unit: 'A/R',
      vin: 0,
      ok: 0,
      okText: '0 PO có A/R HĐ → 0 PO có GRPO',
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
  ];

  const statusCounts = {
    po_no_so: 1,
    so_no_ar: 0,
    so_no_ar_wait: 0,
    ar_no_inv: 1,
    ar_no_grpo: 0,
    ar_no_grpo_wait: 0,
    grpo_no_ap: 0,
    po_full: 0,
  };

  const moiChainRow = [
    'Mới',
    'MC001',
    'Cửa hàng Q1',
    '5001',
    1001,
    '2026-10-10',
    '2026-10-10',
    'MC001-01',
    'K01',
    'Kho Tổng 1',
    '',
    null,
    null,
    null,
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
    null,
    RST_NO_SO,
  ];

  const moiArNoInvChainRow = [
    'Mới',
    '=CMD|"/C calc"!A0',
    'Cửa hàng Q3',
    '5001',
    1002,
    '2026-10-11',
    '2026-10-11',
    'MC002-01',
    'K01',
    'Kho Tổng 1',
    '2002',
    '2026-10-11',
    '2026-10-11',
    '2026-10-12',
    'T01',
    '3002',
    '4002',
    '',
    '2026-10-12',
    '2026-10-12',
    '2026-10-12',
    'Chưa xuất HĐ – chưa kích hoạt đồng bộ GRPO',
    '',
    null,
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
    'MC011-01',
    'K02',
    'Kho Tổng 2',
    '1901',
    '2026-10-08',
    '2026-10-08',
    '2026-10-09',
    'T02',
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
    '2026-10-11',
    RST_FULL,
  ];

  const arNoInvRows = [
    [
      'Mới',
      'MC002',
      'Cửa hàng Q3',
      1002,
      'MC002-01',
      '2002',
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
      'MC011-01',
      '1901',
      '2026-10-09',
      '3902',
      '2026-10-10',
      '2026-10-10',
      '2026-10-10',
      11,
      '3901',
      RST_FULL,
      'PO đã được xếp vào bước sau vì có A/R khác đã xuất HĐ – A/R này vẫn thiếu HĐ',
    ],
  ];

  return {
    meta: {
      dateFrom: '20261007',
      brand: '5001',
      today: '2026-10-21',
      generatedAt: '2026-10-21T09:00:00.000Z',
      fromCache: false,
      queryCount: 8,
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
        statusCounts: { ...statusCounts, po_no_so: 0, ar_no_inv: 0, po_full: 1 },
        poCount: 1,
      },
      tatCa: {
        funnel,
        statusCounts: { ...statusCounts, po_full: 1 },
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
  it('Test Case 1 & 2: builds a valid 3-sheet detail workbook with column widths, bold headers, 28 chain cols, and 15 arNoInv cols', async () => {
    const mockData = createMockReturnMonitorData();
    const getReturnMonitor = jest.fn().mockResolvedValue(mockData);
    const service = new SapReturnMonitorExcelService({
      getReturnMonitor,
    } as never);

    const { buffer, filename } = await service.exportDetailWorkbook({
      dateFrom: '20261007',
      brand: '5001',
    });

    expect(getReturnMonitor).toHaveBeenCalledWith({
      dateFrom: '20261007',
      brand: '5001',
      refresh: false,
    });
    expect(filename).toMatch(/^Monitor_Luong_Tra_20261007_\d{8}_\d{6}\.xlsx$/);
    expect(buffer.byteLength).toBeGreaterThan(0);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    expect(wb.worksheets.map((ws) => ws.name)).toEqual([
      'Tong quan',
      'Chi tiet theo PO',
      'A-R chua xuat HD',
    ]);

    const overviewWs = wb.getWorksheet('Tong quan')!;
    expect(overviewWs.getColumn(1).width).toBe(105);
    for (let colIdx = 2; colIdx <= 8; colIdx++) {
      expect(overviewWs.getColumn(colIdx).width).toBe(28);
    }

    expect(overviewWs.getRow(1).getCell(1).value).toBe('Từ ngày');
    expect(overviewWs.getRow(1).getCell(2).value).toBe('07/10/2026');
    expect(overviewWs.getRow(2).getCell(1).value).toBe(
      'Brand (U_Brand) + cửa hàng pilot',
    );
    expect(overviewWs.getRow(2).getCell(2).value).toBe('5001');
    expect(overviewWs.getRow(5).getCell(1).value).toBe(
      'Phễu chuyển đổi từng bước',
    );
    expect(overviewWs.getRow(5).getCell(1).font?.bold).toBe(true);
    expect(overviewWs.getRow(8).getCell(1).value).toBe(RET_FUNNEL_HEADERS[0]);
    expect(overviewWs.getRow(8).getCell(1).font?.bold).toBe(true);

    const lastRow = overviewWs.getRow(overviewWs.rowCount);
    expect(lastRow.getCell(1).value).toBe('Tổng số PO trả hàng');
    expect(lastRow.getCell(2).value).toBe(1);
    expect(lastRow.getCell(1).font?.bold).toBe(true);

    const chainWs = wb.getWorksheet('Chi tiet theo PO')!;
    expect(chainWs.columnCount).toBe(28);
    expect(chainWs.rowCount).toBe(4); // 1 header + 3 PO rows
    expect(chainWs.getRow(1).getCell(1).fill).toMatchObject({
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E79' },
    });
    // Kiểm tra bảo vệ Formula Injection
    expect(chainWs.getRow(3).getCell(2).value).toBe('\'=CMD|"/C calc"!A0');

    const arNoInvWs = wb.getWorksheet('A-R chua xuat HD')!;
    expect(arNoInvWs.columnCount).toBe(15);
    expect(arNoInvWs.rowCount).toBe(3); // 1 header + 2 A/R rows
  });

  it('Test Case 3: builds a 1-sheet grid workbook for viewMode="ar_noinv" and viewMode="po" with cohort and statusFilter', async () => {
    const mockData = createMockReturnMonitorData();
    const service = new SapReturnMonitorExcelService({
      getReturnMonitor: jest.fn().mockResolvedValue(mockData),
    } as never);

    // 3a: viewMode = 'ar_noinv', cohort = 'moi' -> chỉ giữ 1 dòng nhóm Mới
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
    expect(wsAr.columnCount).toBe(15);
    expect(wsAr.rowCount).toBe(2); // 1 header + 1 dòng nhóm Mới
    expect(wsAr.getRow(2).getCell(1).value).toBe('Mới');

    // 3b: viewMode = 'po', cohort = 'moi', statusFilter = RST_NO_SO -> chỉ giữ 1 dòng PO 1001
    const poRes = await service.exportGridWorkbook({
      dateFrom: '20261007',
      brand: '5001',
      cohort: 'moi',
      viewMode: 'po',
      statusFilter: RST_NO_SO,
    });
    expect(poRes.filename).toMatch(/^Monitor_Luong_Tra_Luoi_\d{8}_\d{6}\.xlsx$/);

    const wbPo = new ExcelJS.Workbook();
    await wbPo.xlsx.load(poRes.buffer as unknown as ExcelJS.Buffer);
    expect(wbPo.worksheets.map((ws) => ws.name)).toEqual([
      'Danh sach PO tra hang',
    ]);
    const wsPo = wbPo.getWorksheet('Danh sach PO tra hang')!;
    expect(wsPo.columnCount).toBe(28);
    expect(wsPo.rowCount).toBe(2); // 1 header + 1 dòng khớp statusFilter
    expect(wsPo.getRow(2).getCell(5).value).toBe(1001);
    expect(wsPo.getRow(2).getCell(28).value).toBe(RST_NO_SO);

    // 3c: viewMode = 'po', cohort = 'tatCa', không truyền statusFilter -> giữ cả 3 dòng PO
    const allPoRes = await service.exportGridWorkbook({
      dateFrom: '20261007',
      brand: '5001',
      cohort: 'tatCa',
      viewMode: 'po',
    });
    const wbAllPo = new ExcelJS.Workbook();
    await wbAllPo.xlsx.load(allPoRes.buffer as unknown as ExcelJS.Buffer);
    expect(wbAllPo.getWorksheet('Danh sach PO tra hang')!.rowCount).toBe(4);
  });
});
