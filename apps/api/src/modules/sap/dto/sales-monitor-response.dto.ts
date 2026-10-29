// Các DTO phản hồi cho API GET /sap/sales-monitor với 5 khóa ở root của data và kế thừa ApiResponseDto.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import type { SapCellValue } from '../lib/sap-row-normalizer';
import { SapTableDto } from './sales-monitor-table.dto';

export class SalesMonitorMetaDto {
  @ApiProperty({ description: 'Từ ngày truy vấn (YYYYMMDD)', example: '20261007' })
  dateFrom!: string;

  @ApiPropertyOptional({ description: 'Đến ngày truy vấn (YYYYMMDD)', example: '20261028' })
  dateTo?: string;

  @ApiProperty({ description: 'Mã thương hiệu truy vấn (chuỗi rỗng = mọi brand)', example: '5001' })
  brand!: string;

  @ApiProperty({ description: 'Ngày hiện tại theo múi giờ Việt Nam (YYYY-MM-DD)', example: '2026-10-21' })
  today!: string;

  @ApiProperty({ description: 'Thời điểm sinh dữ liệu (ISO 8601)' })
  generatedAt!: string;

  @ApiProperty({ description: 'Dữ liệu lấy từ TTL Cache hay truy vấn mới từ SAP' })
  fromCache!: boolean;

  @ApiProperty({ description: 'Số lượng câu truy vấn SQL thực thi', example: 8 })
  queryCount!: number;

  @ApiProperty({ description: 'Thời gian xử lý tính bằng mili-giây', example: 420 })
  durationMs!: number;
}

export class SalesMonitorSummaryDto {
  @ApiProperty({ description: 'Treo cần xử lý nhóm mới: T1 + T3 đến hạn + T4' })
  problems!: number;

  @ApiProperty({ description: 'SO đã đến ShipDate chưa có A/R' })
  t2Due!: number;

  @ApiProperty({ description: 'Đang chờ ShipDate bình thường' })
  waiting!: number;

  @ApiProperty({ description: 'Tồn nhóm cũ T1 + T3 + T4' })
  backlog!: number;
}

export class SalesFunnelStepDto {
  @ApiProperty({ description: 'Số thứ tự bước trong phễu (1..4)', example: 1 })
  step!: number;

  @ApiProperty({ description: 'Tiêu đề kèm icon và mô tả nhiều dòng' })
  label!: string;

  @ApiProperty({ description: 'Tiêu đề gốc kèm mô tả tự động không có icon đầu dòng' })
  autoLabel!: string;

  @ApiProperty({ description: 'Đơn vị chứng từ gốc của bước (PO | SO | A/R | GRPO)', example: 'PO' })
  unit!: string;

  @ApiProperty({ description: 'Số lượng chứng từ đầu vào' })
  vin!: number;

  @ApiProperty({ description: 'Số lượng chứng từ đã hoàn tất bước' })
  ok!: number;

  @ApiProperty({ description: 'Nhãn hiển thị số lượng hoàn tất' })
  okText!: string;

  @ApiProperty({ description: 'Tỷ lệ hoàn tất dạng phần trăm', example: '95%' })
  rate!: string;

  @ApiProperty({ description: 'Tổng số chứng từ chưa hoàn tất bước' })
  notOk!: number;

  @ApiProperty({ description: 'Số chứng từ đang chờ chưa đến hạn' })
  wait!: number;

  @ApiProperty({ description: 'Số chứng từ cần hành động xử lý ngay' })
  act!: number;

  @ApiProperty({ description: 'Biểu tượng trạng thái của bước', example: '✅' })
  icon!: string;
}

export class SalesDocStatusCountsDto {
  @ApiProperty() po_no_so!: number;
  @ApiProperty() so_no_ar!: number;
  @ApiProperty() so_no_ar_wait!: number;
  @ApiProperty() ar_no_inv!: number;
  @ApiProperty() ar_no_inv_bd!: number;
  @ApiProperty() ar_no_grpo!: number;
  @ApiProperty() ar_no_grpo_wait!: number;
  @ApiProperty() grpo_no_ap!: number;
  @ApiProperty() po_full!: number;
}

export class SalesMonitorCohortDto {
  @ApiProperty({ type: [SalesFunnelStepDto] })
  funnel!: SalesFunnelStepDto[];

  @ApiProperty({ type: () => SalesDocStatusCountsDto })
  docStatusCounts!: SalesDocStatusCountsDto;

  @ApiProperty({ description: 'Tổng số PO trong nhóm' })
  poCount!: number;
}

export class SalesMonitorCohortsDto {
  @ApiProperty({ type: () => SalesMonitorCohortDto })
  moi!: SalesMonitorCohortDto;

  @ApiProperty({ type: () => SalesMonitorCohortDto })
  cu!: SalesMonitorCohortDto;

  @ApiProperty({ type: () => SalesMonitorCohortDto })
  tatCa!: SalesMonitorCohortDto;
}

export class SalesDocStatusItemDto {
  @ApiProperty({ description: 'Mã khóa của trạng thái chứng từ', example: 'po_no_so' })
  key!: string;

  @ApiProperty({ description: 'Nhãn hiển thị trạng thái chứng từ' })
  label!: string;

  @ApiProperty({ description: 'Đơn vị đếm (PO | SO | A/R | GRPO)', example: 'PO' })
  unit!: string;

  @ApiProperty({ description: 'Nhãn phân loại mức độ ưu tiên (action | wait | info | ok)' })
  tag!: string;

  @ApiProperty({ description: 'Số lượng chứng từ trong nhóm trạng thái' })
  count!: number;

  @ApiProperty({ description: 'Danh sách tên các cột của bảng', type: [String] })
  columns!: string[];

  @ApiProperty({
    description: 'Mảng 2 chiều chứa các dòng dữ liệu [dòng][cột]',
    type: 'array',
    items: {
      type: 'array',
      items: {
        oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
        nullable: true,
      },
    },
  })
  rows!: SapCellValue[][];
}

export class SalesMonitorDocStatusDto {
  @ApiProperty({ type: () => SalesDocStatusItemDto }) po_no_so!: SalesDocStatusItemDto;
  @ApiProperty({ type: () => SalesDocStatusItemDto }) so_no_ar!: SalesDocStatusItemDto;
  @ApiProperty({ type: () => SalesDocStatusItemDto }) so_no_ar_wait!: SalesDocStatusItemDto;
  @ApiProperty({ type: () => SalesDocStatusItemDto }) ar_no_inv!: SalesDocStatusItemDto;
  @ApiProperty({ type: () => SalesDocStatusItemDto }) ar_no_inv_bd!: SalesDocStatusItemDto;
  @ApiProperty({ type: () => SalesDocStatusItemDto }) ar_no_grpo!: SalesDocStatusItemDto;
  @ApiProperty({ type: () => SalesDocStatusItemDto }) ar_no_grpo_wait!: SalesDocStatusItemDto;
  @ApiProperty({ type: () => SalesDocStatusItemDto }) grpo_no_ap!: SalesDocStatusItemDto;
  @ApiProperty({ type: () => SalesDocStatusItemDto }) po_full!: SalesDocStatusItemDto;
}

export class SalesMonitorListsDto {
  @ApiProperty({ type: () => SapTableDto }) overview!: SapTableDto;
  @ApiProperty({ type: () => SapTableDto }) chain!: SapTableDto;
  @ApiProperty({ type: () => SapTableDto }) t1!: SapTableDto;
  @ApiProperty({ type: () => SapTableDto }) t2!: SapTableDto;
  @ApiProperty({ type: () => SapTableDto }) t3!: SapTableDto;
  @ApiProperty({ type: () => SapTableDto }) t4!: SapTableDto;
  @ApiProperty({ type: () => SapTableDto }) ar!: SapTableDto;
  @ApiProperty({ type: () => SapTableDto }) grpo!: SapTableDto;
  @ApiProperty({ type: () => SapTableDto }) ap!: SapTableDto;
}

export class SalesMonitorDataDto {
  @ApiProperty({ type: () => SalesMonitorMetaDto })
  meta!: SalesMonitorMetaDto;

  @ApiProperty({ type: () => SalesMonitorSummaryDto })
  summary!: SalesMonitorSummaryDto;

  @ApiProperty({ type: () => SalesMonitorCohortsDto })
  cohorts!: SalesMonitorCohortsDto;

  @ApiProperty({ type: () => SalesMonitorDocStatusDto })
  docStatus!: SalesMonitorDocStatusDto;

  @ApiProperty({ type: () => SalesMonitorListsDto })
  lists!: SalesMonitorListsDto;
}

export class SalesMonitorResponseDto extends ApiResponseDto {
  @ApiProperty({ type: () => SalesMonitorDataDto })
  declare data: SalesMonitorDataDto;
}
