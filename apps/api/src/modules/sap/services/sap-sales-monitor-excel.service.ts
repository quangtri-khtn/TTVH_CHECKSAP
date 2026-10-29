// Dịch vụ tạo file Excel chi tiết 11 sheets (exportDetailWorkbook) và file Excel lưới đang xem (exportGridWorkbook)
// khớp 100% đặc tả desktop `sales_flow_checker.py` (:3248-3307).
import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ExportSalesMonitorGridQueryDto,
  type SalesMonitorExportCohort,
} from '../dto/sales-monitor-export-grid.dto';
import { GetSalesMonitorQueryDto } from '../dto/sales-monitor-query.dto';
import type {
  SalesMonitorDataDto,
  SalesMonitorListsDto,
} from '../dto/sales-monitor-response.dto';
import {
  type StreamingWorkbookHandle,
  createStreamingWorkbook,
  formatVietnamDateTime,
  sanitizeExcelCellValue,
  sanitizeExcelSheetName,
  writeStandardWorksheet,
} from '../lib/excel-sheet-writer';
import {
  CONV_HEADERS,
  DOC_STATUS_ITEMS,
  FUNNEL_ROW_KEYS,
  MONITOR_VIEWS,
  NHOM_CU,
  NHOM_MOI,
  type SalesDocStatusKey,
} from '../lib/sales-monitor';
import { MONITOR_DEFAULT_BRAND, MONITOR_DEFAULT_DATE } from '../lib/sap-constants';
import type { SapCellValue } from '../lib/sap-row-normalizer';
import { SapSalesMonitorService } from './sap-sales-monitor.service';

const OVERVIEW_SHEET_COLUMN_WIDTHS = [105, 22, 24, 24, 24, 24, 24, 24] as const;

const VALID_VIEW_KEYS: ReadonlySet<keyof SalesMonitorListsDto> = new Set(
  MONITOR_VIEWS.map((v) => v.key),
);

const VALID_DOC_STATUS_KEYS: ReadonlySet<SalesDocStatusKey> = new Set(
  DOC_STATUS_ITEMS.map((item) => item.key),
);

@Injectable()
export class SapSalesMonitorExcelService {
  constructor(private readonly salesMonitorService: SapSalesMonitorService) {}

  async exportDetailWorkbook(
    query: GetSalesMonitorQueryDto,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const dateFrom = query.dateFrom ?? MONITOR_DEFAULT_DATE;
    const dateTo = query.dateTo;
    const brand = query.brand ?? MONITOR_DEFAULT_BRAND;
    const data = await this.salesMonitorService.getSalesMonitor({
      dateFrom,
      dateTo,
      brand,
      refresh: false,
    });

    const { workbook, finishWorkbook } = createStreamingWorkbook();
    const { fileTimestamp, displayTimestamp } = formatVietnamDateTime();

    this.writeOverviewSheet(
      workbook,
      data,
      dateFrom,
      dateTo ?? data.meta.dateTo,
      brand,
      displayTimestamp,
    );
    writeStandardWorksheet(
      workbook,
      'Chi tiet theo PO',
      data.lists.chain.columns,
      data.lists.chain.rows,
    );

    writeStandardWorksheet(
      workbook,
      'A-R chua xuat HD',
      data.docStatus.ar_no_inv.columns,
      [...data.docStatus.ar_no_inv.rows, ...data.docStatus.ar_no_inv_bd.rows],
    );

    for (const view of MONITOR_VIEWS) {
      if (view.key === 'chain') {
        continue;
      }
      const listTable = data.lists[view.key];
      writeStandardWorksheet(
        workbook,
        sanitizeExcelSheetName(view.label),
        listTable.columns,
        listTable.rows,
      );
    }

    const buffer = await finishWorkbook();
    return {
      buffer,
      filename: `Monitor_Chi_Tiet_${dateFrom}_Brand${brand}_${fileTimestamp}.xlsx`,
    };
  }

  async exportGridWorkbook(
    query: ExportSalesMonitorGridQueryDto,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const dateFrom = query.dateFrom ?? MONITOR_DEFAULT_DATE;
    const dateTo = query.dateTo;
    const brand = query.brand ?? MONITOR_DEFAULT_BRAND;
    const cohort: SalesMonitorExportCohort = query.cohort ?? 'moi';
    const sourceType = query.sourceType ?? 'view';
    const sourceKey = query.sourceKey ?? 'overview';
    const data = await this.salesMonitorService.getSalesMonitor({
      dateFrom,
      dateTo,
      brand,
      refresh: false,
    });
    const { columns, rows } = this.extractGridTable(
      data,
      sourceType,
      sourceKey,
      cohort,
    );

    const { workbook, finishWorkbook } = createStreamingWorkbook();
    const { fileTimestamp } = formatVietnamDateTime();

    writeStandardWorksheet(workbook, 'Monitor_Chung_Tu_Treo', columns, rows);

    const buffer = await finishWorkbook();
    return {
      buffer,
      filename: `Monitor_Chung_Tu_Treo_${fileTimestamp}.xlsx`,
    };
  }

  private writeOverviewSheet(
    workbook: StreamingWorkbookHandle['workbook'],
    data: SalesMonitorDataDto,
    dateFrom: string,
    dateTo: string | undefined,
    brand: string,
    displayTimestamp: string,
  ): void {
    const ws = workbook.addWorksheet('Tong quan');
    ws.columns = OVERVIEW_SHEET_COLUMN_WIDTHS.map((width) => ({ width }));

    const dd = `${dateFrom.slice(6, 8)}/${dateFrom.slice(4, 6)}`;
    const cohortEntries = [
      { key: 'moi' as const, label: `Nhóm mới – PO từ ${dd}` },
      {
        key: 'cu' as const,
        label: `Nhóm cũ – PO trước ${dd}, còn phát sinh chứng từ từ ${dd} (không tính vào số treo)`,
      },
    ];

    const overviewRows: (string | number)[][] = [
      [
        'Từ ngày',
        `${dateFrom.slice(6, 8)}/${dateFrom.slice(4, 6)}/${dateFrom.slice(0, 4)}`,
      ],
      ...(dateTo
        ? [
            [
              'Đến ngày',
              `${dateTo.slice(6, 8)}/${dateTo.slice(4, 6)}/${dateTo.slice(0, 4)}`,
            ] as [string, string],
          ]
        : []),
      ['Brand (U_Brand)', brand || 'Tất cả thương hiệu'],
      ['Xuất lúc', displayTimestamp],
      ['', ''],
      ['Phễu chuyển đổi từng bước (đơn vị ghi ở cột Đơn vị)', ''],
    ];

    for (const { key: cohortKey, label: cohortLabel } of cohortEntries) {
      overviewRows.push(['', ''], [cohortLabel, ''], [...CONV_HEADERS]);
      for (const step of data.cohorts[cohortKey].funnel) {
        overviewRows.push([
          step.autoLabel,
          step.unit,
          step.vin,
          step.okText,
          step.rate,
          step.notOk,
          step.wait,
          step.act,
        ]);
      }
    }

    for (const { key: cohortKey, label: cohortLabel } of cohortEntries) {
      overviewRows.push(
        ['', ''],
        [
          `Chứng từ treo theo từng bước – ${cohortLabel} (đếm đúng theo chứng từ, đơn vị trong [ ])`,
          '',
        ],
      );
      for (const item of DOC_STATUS_ITEMS) {
        overviewRows.push([
          `${item.label} [${item.unit}]`,
          data.cohorts[cohortKey].docStatusCounts[item.key],
        ]);
      }
    }

    const poTaoTruocKyColIdx = data.lists.chain.columns.indexOf('PO tao truoc ky');
    const poTaoTruocKyCount =
      poTaoTruocKyColIdx >= 0
        ? data.lists.chain.rows.reduce(
            (acc, row) => (row[poTaoTruocKyColIdx] === 'Co' ? acc + 1 : acc),
            0,
          )
        : 0;

    overviewRows.push(
      ['', ''],
      ['Tổng số PO trong sheet chi tiết (cả 2 nhóm)', data.lists.chain.rows.length],
      ['PO có ngày tạo trước kỳ', poTaoTruocKyCount],
    );
    for (const item of overviewRows) {
      const sanitizedItem = item.map((val) => sanitizeExcelCellValue(val));
      const r = ws.addRow(sanitizedItem);
      r.getCell(1).alignment = { wrapText: true, vertical: 'top' };
      const isSectionHeader = item[1] === '' || item[1] == null;
      if (Boolean(item[0]) && (isSectionHeader || item[0] === CONV_HEADERS[0])) {
        for (let colIdx = 1; colIdx <= item.length; colIdx++) {
          r.getCell(colIdx).font = { bold: true };
        }
      }
      r.commit();
    }

    ws.commit();
  }

  private extractGridTable(
    data: SalesMonitorDataDto,
    sourceType: 'view' | 'funnel' | 'docStatus',
    sourceKey: string,
    cohort: SalesMonitorExportCohort,
  ): { columns: string[]; rows: SapCellValue[][] } {
    if (sourceType === 'view') {
      if (!VALID_VIEW_KEYS.has(sourceKey as keyof SalesMonitorListsDto)) {
        throw new BadRequestException(`Danh sách xem (sourceKey) không hợp lệ: ${sourceKey}`);
      }
      const viewKey = sourceKey as keyof SalesMonitorListsDto;
      const table = data.lists[viewKey];
      if (viewKey === 'overview') {
        return { columns: table.columns, rows: table.rows };
      }
      return {
        columns: table.columns,
        rows: this.filterRowsByCohort(table.columns, table.rows, cohort),
      };
    }

    if (sourceType === 'funnel') {
      const stepIndex = Number.parseInt(sourceKey, 10);
      const keys = FUNNEL_ROW_KEYS[stepIndex];
      if (!Number.isInteger(stepIndex) || !keys || keys.length === 0) {
        throw new BadRequestException(`Bước phễu (sourceKey) không hợp lệ: ${sourceKey}`);
      }
      const columns = data.docStatus[keys[0]!].columns;
      const combinedRows = keys.flatMap((k) => data.docStatus[k].rows);
      return { columns, rows: this.filterRowsByCohort(columns, combinedRows, cohort) };
    }

    if (!VALID_DOC_STATUS_KEYS.has(sourceKey as SalesDocStatusKey)) {
      throw new BadRequestException(`Mã trạng thái chứng từ (sourceKey) không hợp lệ: ${sourceKey}`);
    }
    const docItem = data.docStatus[sourceKey as SalesDocStatusKey];
    return {
      columns: docItem.columns,
      rows: this.filterRowsByCohort(docItem.columns, docItem.rows, cohort),
    };
  }

  private filterRowsByCohort(
    columns: readonly string[],
    rows: readonly (readonly SapCellValue[])[],
    cohort: SalesMonitorExportCohort,
  ): SapCellValue[][] {
    if (cohort === 'tatCa' || rows.length === 0) {
      return rows.map((r) => [...r]);
    }
    const nhomColIdx = columns.indexOf('Nhom');
    if (nhomColIdx === -1) {
      return rows.map((r) => [...r]);
    }
    const targetLabel = cohort === 'moi' ? NHOM_MOI : NHOM_CU;
    return rows
      .filter((r) => r[nhomColIdx] === targetLabel)
      .map((r) => [...r]);
  }
}
