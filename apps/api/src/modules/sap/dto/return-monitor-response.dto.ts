// Các DTO phản hồi cho API GET /sap/return-monitor với 4 khóa ở root của data và kế thừa ApiResponseDto.
import { ApiProperty } from '@nestjs/swagger';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { SapTableDto } from './sales-monitor-table.dto';

export class ReturnMonitorMetaDto {
  @ApiProperty({ description: 'Từ ngày truy vấn (YYYYMMDD)', example: '20261007' })
  dateFrom!: string;

  @ApiProperty({ description: 'Mã thương hiệu truy vấn', example: '5001' })
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

export class ReturnMonitorSummaryDto {
  @ApiProperty({ description: 'PO nhóm mới treo cần xử lý (khác đủ chuỗi và không phải chờ ngày)' })
  problems!: number;

  @ApiProperty({ description: 'Tổng số chứng từ A/R chưa xuất hóa đơn' })
  arNoInvCount!: number;

  @ApiProperty({ description: 'PO nhóm mới đang chờ đến SO ShipDate (bình thường)' })
  waiting!: number;

  @ApiProperty({ description: 'Tồn PO nhóm cũ chưa đủ chuỗi PO → AP' })
  backlog!: number;
}

export class ReturnFunnelStepDto {
  @ApiProperty({ description: 'Số thứ tự bước trong phễu (1..5)', example: 1 })
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

  @ApiProperty({ description: 'Số chứng từ đang chờ chưa đến hạn SO ShipDate' })
  wait!: number;

  @ApiProperty({ description: 'Số chứng từ cần hành động xử lý ngay' })
  act!: number;

  @ApiProperty({ description: 'Biểu tượng trạng thái của bước', example: '✔' })
  icon!: string;
}

export class ReturnStatusCountsDto {
  @ApiProperty({ description: '1 - PO chưa sync sang SO (TTVH)' })
  po_no_so!: number;

  @ApiProperty({ description: '2 - Có SO, chưa có A/R (TTVH)' })
  so_no_ar!: number;

  @ApiProperty({ description: '2a - Có SO, chưa có A/R: SO ShipDate > hôm nay (bình thường)' })
  so_no_ar_wait!: number;

  @ApiProperty({ description: '3 - Có A/R, chưa xuất hóa đơn' })
  ar_no_inv!: number;

  @ApiProperty({ description: '4 - A/R đã xuất HĐ, chưa có GRPO (KBMD)' })
  ar_no_grpo!: number;

  @ApiProperty({ description: '4a - A/R đã xuất HĐ, chưa có GRPO: SO ShipDate > hôm nay (bình thường)' })
  ar_no_grpo_wait!: number;

  @ApiProperty({ description: '5 - Có GRPO, chưa có AP (KBMD)' })
  grpo_no_ap!: number;

  @ApiProperty({ description: '6 - Đủ chuỗi PO → AP' })
  po_full!: number;
}

export class ReturnMonitorCohortDto {
  @ApiProperty({ type: [ReturnFunnelStepDto] })
  funnel!: ReturnFunnelStepDto[];

  @ApiProperty({ type: () => ReturnStatusCountsDto })
  statusCounts!: ReturnStatusCountsDto;

  @ApiProperty({ description: 'Tổng số PO trả hàng trong nhóm' })
  poCount!: number;
}

export class ReturnMonitorCohortsDto {
  @ApiProperty({ type: () => ReturnMonitorCohortDto })
  moi!: ReturnMonitorCohortDto;

  @ApiProperty({ type: () => ReturnMonitorCohortDto })
  cu!: ReturnMonitorCohortDto;

  @ApiProperty({ type: () => ReturnMonitorCohortDto })
  tatCa!: ReturnMonitorCohortDto;
}

export class ReturnMonitorListsDto {
  @ApiProperty({ type: () => SapTableDto, description: 'Bảng 28 cột chi tiết chuỗi chứng từ theo PO trả hàng' })
  chain!: SapTableDto;

  @ApiProperty({ type: () => SapTableDto, description: 'Bảng 15 cột danh sách A/R chưa xuất hóa đơn' })
  arNoInv!: SapTableDto;
}

export class ReturnMonitorDataDto {
  @ApiProperty({ type: () => ReturnMonitorMetaDto })
  meta!: ReturnMonitorMetaDto;

  @ApiProperty({ type: () => ReturnMonitorSummaryDto })
  summary!: ReturnMonitorSummaryDto;

  @ApiProperty({ type: () => ReturnMonitorCohortsDto })
  cohorts!: ReturnMonitorCohortsDto;

  @ApiProperty({ type: () => ReturnMonitorListsDto })
  lists!: ReturnMonitorListsDto;
}

export class ReturnMonitorResponseDto extends ApiResponseDto {
  @ApiProperty({ type: () => ReturnMonitorDataDto })
  declare data: ReturnMonitorDataDto;
}
