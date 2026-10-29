// DTO tham số truy vấn cho endpoint GET /sap/return-monitor/export-grid xuất dữ liệu lưới đang xem.
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { MONITOR_DEFAULT_BRAND, MONITOR_DEFAULT_DATE } from '../lib/sap-constants';

export const RETURN_MONITOR_EXPORT_COHORTS = ['moi', 'cu', 'tatCa'] as const;
export type ReturnMonitorExportCohort =
  (typeof RETURN_MONITOR_EXPORT_COHORTS)[number];

export const RETURN_MONITOR_EXPORT_VIEW_MODES = ['so', 'po', 'ar_noinv'] as const;
export type ReturnMonitorExportViewMode =
  (typeof RETURN_MONITOR_EXPORT_VIEW_MODES)[number];

export class ExportReturnMonitorGridQueryDto {
  @ApiPropertyOptional({
    default: MONITOR_DEFAULT_DATE,
    description: 'Từ ngày theo định dạng YYYYMMDD (ví dụ 20261007)',
    example: '20261007',
  })
  @IsOptional()
  @Matches(/^\d{8}$/, {
    message: 'Ngày truy vấn SAP không hợp lệ (yêu cầu định dạng YYYYMMDD)',
  })
  dateFrom?: string = MONITOR_DEFAULT_DATE;

  @ApiPropertyOptional({
    description: 'Đến ngày theo định dạng YYYYMMDD (mặc định ngày hiện tại)',
    example: '20261028',
  })
  @IsOptional()
  @Matches(/^\d{8}$/, {
    message: 'Ngày truy vấn SAP không hợp lệ (yêu cầu định dạng YYYYMMDD)',
  })
  dateTo?: string;

  @ApiPropertyOptional({
    default: MONITOR_DEFAULT_BRAND,
    description: 'Mã thương hiệu 0-10 ký tự chữ và số ASCII (ví dụ 5001, để trống = mọi brand)',
    example: '5001',
  })
  @IsOptional()
  @Matches(/^[A-Za-z0-9]{0,10}$/, {
    message:
      'Mã thương hiệu (brand) truy vấn SAP không hợp lệ (chỉ chấp nhận 1–10 ký tự chữ và số ASCII, hoặc để trống = mọi brand)',
  })
  brand?: string = MONITOR_DEFAULT_BRAND;
  @ApiPropertyOptional({
    default: 'moi',
    enum: RETURN_MONITOR_EXPORT_COHORTS,
    description: 'Nhóm PO cần xuất (moi | cu | tatCa)',
  })
  @IsOptional()
  @IsIn(RETURN_MONITOR_EXPORT_COHORTS, {
    message: 'Tham số cohort chỉ chấp nhận moi, cu hoặc tatCa',
  })
  cohort?: ReturnMonitorExportCohort = 'moi';

  @ApiPropertyOptional({
    default: 'po',
    enum: RETURN_MONITOR_EXPORT_VIEW_MODES,
    description: 'Chế độ hiển thị lưới cần xuất (po | ar_noinv)',
  })
  @IsOptional()
  @IsIn(RETURN_MONITOR_EXPORT_VIEW_MODES, {
    message: 'Tham số viewMode chỉ chấp nhận po hoặc ar_noinv',
  })
  viewMode?: ReturnMonitorExportViewMode = 'po';

  @ApiPropertyOptional({
    description: 'Trạng thái chuỗi chứng từ cần lọc (chỉ áp dụng khi viewMode === po)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  statusFilter?: string;
}
