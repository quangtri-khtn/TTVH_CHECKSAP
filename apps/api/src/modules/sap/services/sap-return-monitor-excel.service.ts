// Dịch vụ tạo file Excel chi tiết 3 sheets (exportDetailWorkbook) và file Excel lưới đang xem (exportGridWorkbook)
// cho Monitor Luồng Trả hàng khớp 100% đặc tả desktop `sales_flow_checker.py` (:3931-3978).
import { Injectable } from '@nestjs/common';
import {
  ExportReturnMonitorGridQueryDto,
  type ReturnMonitorExportCohort,
  type ReturnMonitorExportViewMode,
} from '../dto/return-monitor-export-grid.dto';
import { GetReturnMonitorQueryDto } from '../dto/return-monitor-query.dto';
import type { ReturnMonitorDataDto } from '../dto/return-monitor-response.dto';
import {
  type StreamingWorkbookHandle,
  createStreamingWorkbook,
  formatVietnamDateTime,
  sanitizeExcelCellValue,
  writeStandardWorksheet,
} from '../lib/excel-sheet-writer';
import {
  RET_AR_NOINV_COLS,
  RET_CHAIN_COLUMNS,
  RET_FUNNEL_HEADERS,
  RET_STATUS_ITEMS,
} from '../lib/return-monitor';
import { NHOM_CU, NHOM_MOI } from '../lib/sales-monitor';
import { MONITOR_DEFAULT_BRAND, MONITOR_DEFAULT_DATE } from '../lib/sap-constants';
import type { SapCellValue } from '../lib/sap-row-normalizer';
import { SapReturnMonitorService } from './sap-return-monitor.service';

const OVERVIEW_SHEET_COLUMN_WIDTHS = [105, 28, 28, 28, 28, 28, 28, 28] as const;

@Injectable()
export class SapReturnMonitorExcelService {
  constructor(private readonly returnMonitorService: SapReturnMonitorService) {}

  async exportDetailWorkbook(
    query: GetReturnMonitorQueryDto,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const dateFrom = query.dateFrom ?? MONITOR_DEFAULT_DATE;
    const brand = query.brand ?? MONITOR_DEFAULT_BRAND;
    const data = await this.returnMonitorService.getReturnMonitor({
      dateFrom,
      brand,
      refresh: false,
    });

    const { workbook, finishWorkbook } = createStreamingWorkbook();
    const { fileTimestamp, displayTimestamp } = formatVietnamDateTime();

    this.writeOverviewSheet(workbook, data, dateFrom, brand, displayTimestamp);

    writeStandardWorksheet(
      workbook,
      'Chi tiet theo PO',
      data.lists.chain.columns,
      data.lists.chain.rows,
    );

    writeStandardWorksheet(
      workbook,
      'A-R chua xuat HD',
      data.lists.arNoInv.columns,
      data.lists.arNoInv.rows,
    );

    const buffer = await finishWorkbook();
    return {
      buffer,
      filename: `Monitor_Luong_Tra_${dateFrom}_${fileTimestamp}.xlsx`,
    };
  }

  async exportGridWorkbook(
    query: ExportReturnMonitorGridQueryDto,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const dateFrom = query.dateFrom ?? MONITOR_DEFAULT_DATE;
    const brand = query.brand ?? MONITOR_DEFAULT_BRAND;
    const cohort: ReturnMonitorExportCohort = query.cohort ?? 'moi';
    const viewMode: ReturnMonitorExportViewMode = query.viewMode ?? 'po';
    const statusFilter = query.statusFilter?.trim() || undefined;

    const data = await this.returnMonitorService.getReturnMonitor({
      dateFrom,
      brand,
      refresh: false,
    });

    const { workbook, finishWorkbook } = createStreamingWorkbook();
    const { fileTimestamp } = formatVietnamDateTime();

    if (viewMode === 'ar_noinv') {
      const filteredRows = this.filterRowsByCohort(
        data.lists.arNoInv.columns,
        data.lists.arNoInv.rows,
        cohort,
      );
      writeStandardWorksheet(
        workbook,
        'A-R chua xuat HD',
        data.lists.arNoInv.columns.length > 0
          ? data.lists.arNoInv.columns
          : RET_AR_NOINV_COLS,
        filteredRows,
      );
    } else {
      const columns =
        data.lists.chain.columns.length > 0
          ? data.lists.chain.columns
          : RET_CHAIN_COLUMNS;
      let filteredRows = this.filterRowsByCohort(
        columns,
        data.lists.chain.rows,
        cohort,
      );
      if (statusFilter) {
        const statusColIdx = columns.indexOf('Trang thai chuoi chung tu');
        const effectiveIdx = statusColIdx >= 0 ? statusColIdx : 27;
        filteredRows = filteredRows.filter((r) => r[effectiveIdx] === statusFilter);
      }
      writeStandardWorksheet(
        workbook,
        'Danh sach PO tra hang',
        columns,
        filteredRows,
      );
    }

    const buffer = await finishWorkbook();
    return {
      buffer,
      filename: `Monitor_Luong_Tra_Luoi_${fileTimestamp}.xlsx`,
    };
  }

  private writeOverviewSheet(
    workbook: StreamingWorkbookHandle['workbook'],
    data: ReturnMonitorDataDto,
    dateFrom: string,
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
        label: `Nhóm cũ – PO trước ${dd}, còn phát sinh chứng từ từ ${dd}`,
      },
    ];

    const overviewRows: (string | number)[][] = [
      [
        'Từ ngày',
        `${dateFrom.slice(6, 8)}/${dateFrom.slice(4, 6)}/${dateFrom.slice(0, 4)}`,
      ],
      ['Brand (U_Brand) + cửa hàng pilot', brand],
      ['Xuất lúc', displayTimestamp],
      ['', ''],
      ['Phễu chuyển đổi từng bước', ''],
    ];

    for (const { key: cohortKey, label: cohortLabel } of cohortEntries) {
      overviewRows.push(['', ''], [cohortLabel, ''], [...RET_FUNNEL_HEADERS]);
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
        [`Trạng thái chuỗi chứng từ theo PO – ${cohortLabel}`, 'Số PO'],
      );
      for (const item of RET_STATUS_ITEMS) {
        overviewRows.push([
          item.label,
          data.cohorts[cohortKey].statusCounts[item.key],
        ]);
      }
      overviewRows.push(['Tổng số PO trả hàng', data.cohorts[cohortKey].poCount]);
    }

    for (const item of overviewRows) {
      const sanitizedItem = item.map((val) => sanitizeExcelCellValue(val));
      const r = ws.addRow(sanitizedItem);
      r.getCell(1).alignment = { wrapText: true, vertical: 'top' };

      const col0 = String(item[0] ?? '');
      const isSectionHeader = item[1] === '' || item[1] == null;
      const isFunnelHeader = col0 === RET_FUNNEL_HEADERS[0];
      const isCohortOrStatusTitle =
        col0.startsWith('Nhóm') ||
        col0.startsWith('Trạng thái') ||
        col0 === 'Tổng số PO trả hàng' ||
        item[1] === 'Số PO';

      if (
        Boolean(col0) &&
        (isSectionHeader || isFunnelHeader || isCohortOrStatusTitle)
      ) {
        for (let colIdx = 1; colIdx <= item.length; colIdx++) {
          r.getCell(colIdx).font = { bold: true };
        }
      }
      r.commit();
    }

    ws.commit();
  }

  private filterRowsByCohort(
    columns: readonly string[],
    rows: readonly (readonly SapCellValue[])[],
    cohort: ReturnMonitorExportCohort,
  ): SapCellValue[][] {
    if (cohort === 'tatCa' || rows.length === 0) {
      return rows.map((r) => [...r]);
    }
    const nhomColIdx = columns.indexOf('Nhom');
    const effectiveIdx = nhomColIdx >= 0 ? nhomColIdx : 0;
    const targetLabel = cohort === 'moi' ? NHOM_MOI : NHOM_CU;
    return rows
      .filter((r) => r[effectiveIdx] === targetLabel)
      .map((r) => [...r]);
  }
}
