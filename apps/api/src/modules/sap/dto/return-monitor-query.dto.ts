// DTO tham số truy vấn cho endpoint GET /sap/return-monitor.
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, Matches } from 'class-validator';
import { MONITOR_DEFAULT_BRAND, MONITOR_DEFAULT_DATE } from '../lib/sap-constants';

export class GetReturnMonitorQueryDto {
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
    default: MONITOR_DEFAULT_BRAND,
    description: 'Mã thương hiệu 1-10 ký tự chữ và số ASCII (ví dụ 5001)',
    example: '5001',
  })
  @IsOptional()
  @Matches(/^[A-Za-z0-9]{1,10}$/, {
    message:
      'Mã thương hiệu (brand) truy vấn SAP không hợp lệ (chỉ chấp nhận 1–10 ký tự chữ và số ASCII)',
  })
  brand?: string = MONITOR_DEFAULT_BRAND;

  @ApiPropertyOptional({
    default: false,
    description: 'Bỏ qua TTL Cache và ép buộc truy vấn lại từ SAP',
    example: false,
  })
  @IsOptional()
  @Transform(
    ({ value }) => value === 'true' || value === true || value === 1 || value === '1',
  )
  @IsBoolean()
  refresh?: boolean = false;
}
