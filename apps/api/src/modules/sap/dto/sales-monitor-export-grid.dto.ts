// DTO tham số truy vấn cho endpoint GET /sap/sales-monitor/export-grid xuất dữ liệu lưới đang xem.
// Backend tự trích xuất đúng bảng dữ liệu từ bộ đệm SAP thay vì nhận mảng rows từ client.
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { MONITOR_DEFAULT_BRAND, MONITOR_DEFAULT_DATE } from '../lib/sap-constants';

export const SALES_MONITOR_EXPORT_COHORTS = ['moi', 'cu', 'tatCa'] as const;
export type SalesMonitorExportCohort = (typeof SALES_MONITOR_EXPORT_COHORTS)[number];

export const SALES_MONITOR_EXPORT_SOURCE_TYPES = [
  'view',
  'funnel',
  'docStatus',
] as const;
export type SalesMonitorExportSourceType =
  (typeof SALES_MONITOR_EXPORT_SOURCE_TYPES)[number];

export class ExportSalesMonitorGridQueryDto {
  @IsOptional()
  @Matches(/^\d{8}$/, {
    message: 'Ngày truy vấn SAP không hợp lệ (yêu cầu định dạng YYYYMMDD)',
  })
  dateFrom?: string = MONITOR_DEFAULT_DATE;

  @IsOptional()
  @Matches(/^[A-Za-z0-9]{1,10}$/, {
    message:
      'Mã thương hiệu (brand) truy vấn SAP không hợp lệ (chỉ chấp nhận 1–10 ký tự chữ và số ASCII)',
  })
  brand?: string = MONITOR_DEFAULT_BRAND;

  @IsOptional()
  @IsIn(SALES_MONITOR_EXPORT_COHORTS, {
    message: 'Tham số cohort chỉ chấp nhận moi, cu hoặc tatCa',
  })
  cohort?: SalesMonitorExportCohort = 'moi';

  @IsOptional()
  @IsIn(SALES_MONITOR_EXPORT_SOURCE_TYPES, {
    message: 'Tham số sourceType chỉ chấp nhận view, funnel hoặc docStatus',
  })
  sourceType?: SalesMonitorExportSourceType = 'view';

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9_]{1,32}$/, {
    message: 'Tham số sourceKey không hợp lệ',
  })
  sourceKey?: string = 'overview';
}
