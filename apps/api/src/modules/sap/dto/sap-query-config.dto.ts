// Bộ DTO cho phân hệ Quản trị & Chỉnh sửa 25 Câu Truy vấn SAP (/sap/queries).
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { MONITOR_DEFAULT_BRAND, MONITOR_DEFAULT_DATE } from '../lib/sap-constants';
import { SapTableDto } from './sales-monitor-table.dto';

export class SapQuerySummaryDto {
  @ApiProperty({ example: 't1', description: 'Khóa định danh câu truy vấn (1 trong 25 khóa)' })
  key!: string;

  @ApiProperty({
    enum: ['ban', 'tra'],
    example: 'ban',
    description: 'Luồng Monitor: ban (13 câu) hoặc tra (12 câu)',
  })
  flow!: 'ban' | 'tra';

  @ApiProperty({
    enum: ['list', 'chain', 'main', 'old_discovery'],
    example: 'list',
    description: 'Nhóm chức năng của câu truy vấn trong luồng Monitor',
  })
  stage!: 'list' | 'chain' | 'main' | 'old_discovery';

  @ApiProperty({ example: 2, description: 'Thứ tự hiển thị chuẩn từ 1 đến 25' })
  sortOrder!: number;

  @ApiProperty({ example: '#02 · T1 — PO chưa có SO hợp lệ' })
  title!: string;

  @ApiProperty({
    example: 'Danh sách đơn PO tại TTVH chưa sinh SO bên KBMĐ hoặc SO đối ứng đã bị hủy.',
  })
  description!: string;

  @ApiProperty({
    type: [String],
    example: ['Tab T1: PO chưa có SO', 'KPI Treo T1', 'Excel Sheet T1'],
  })
  impactBadges!: string[];

  @ApiProperty({
    type: [String],
    example: ['{d}', '{br}'],
  })
  allowedPlaceholders!: string[];

  @ApiProperty({
    type: [String],
    example: ['Store', 'PO Number', 'DocDate', 'Ly do'],
  })
  requiredColumns!: string[];

  @ApiProperty({
    type: [String],
    example: [
      'Store',
      'PO Number',
      'DocDate',
      'PO CreateDate',
      'PO Status',
      'So dong PO',
      'Ly do',
    ],
  })
  baselineColumns!: string[];

  @ApiProperty({
    type: [String],
    example: ['PO Number'],
  })
  dedupKeys!: string[];

  @ApiProperty({ example: true })
  supportsExtraColumns!: boolean;

  @ApiProperty({ example: 1 })
  currentVersionNo!: number;

  @ApiProperty({
    example: false,
    description: 'True nếu câu SQL đang chạy khác với bản mặc định gốc v1',
  })
  isCustomized!: boolean;

  @ApiProperty({ example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' })
  activeSqlHash!: string;

  @ApiProperty({ example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' })
  defaultSqlHash!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  lastTestedSqlHash!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  lastTestedAt!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  lastTestedById!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  lastTestRowCount!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  lastTestDurationMs!: number | null;

  @ApiProperty({ example: '2026-10-29T02:00:00.000Z' })
  updatedAt!: string;
}

export class SapQueryListResponseDto extends ApiResponseDto {
  @ApiProperty({ type: [SapQuerySummaryDto] })
  declare data: SapQuerySummaryDto[];
}

export class SapQueryVersionDto {
  @ApiProperty({ example: 'cm2xyz123' })
  id!: string;

  @ApiProperty({ example: 't1' })
  queryKey!: string;

  @ApiProperty({ example: 1 })
  versionNo!: number;

  @ApiProperty({ description: 'Nội dung Full SQL của phiên bản' })
  sqlText!: string;

  @ApiProperty({ description: 'SHA-256 của câu SQL đã chuẩn hóa' })
  sqlHash!: string;

  @ApiProperty({ example: 'Khởi tạo câu truy vấn gốc chuẩn (Seed v1)' })
  changeNote!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  createdById!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Admin' })
  createdBy!: string | null;

  @ApiProperty({ example: '2026-10-29T02:00:00.000Z' })
  createdAt!: string;
}

export class SapQueryAuditDto {
  @ApiProperty({ example: 'cm2audit123' })
  id!: string;

  @ApiProperty({ example: 't1' })
  queryKey!: string;

  @ApiProperty({
    enum: ['review', 'publish', 'rollback', 'reset_default'],
    example: 'publish',
  })
  action!: string;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 1 })
  fromVersion!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 2 })
  toVersion!: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  beforeSql!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  afterSql!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  changeNote!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  actorId!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  actorName!: string | null;

  @ApiProperty({ example: '2026-10-29T02:00:00.000Z' })
  createdAt!: string;
}

export class SapQueryDetailDto extends SapQuerySummaryDto {
  @ApiProperty({ description: 'Câu Full SQL đang hoạt động (active)' })
  activeSql!: string;

  @ApiProperty({ description: 'Câu Full SQL mặc định gốc (Seed v1) để đối chiếu và khôi phục' })
  defaultSql!: string;

  @ApiProperty({ type: [SapQueryVersionDto] })
  versions!: SapQueryVersionDto[];

  @ApiProperty({ type: [SapQueryAuditDto] })
  audits!: SapQueryAuditDto[];
}

export class SapQueryDetailResponseDto extends ApiResponseDto {
  @ApiProperty({ type: SapQueryDetailDto })
  declare data: SapQueryDetailDto;
}

export class ReviewSapQueryRequestDto {
  @ApiProperty({
    description: 'Câu Full SQL cần kiểm tra tĩnh và chạy thử đối chiếu Hợp đồng Cột',
  })
  @IsString()
  @MinLength(10, { message: 'Nội dung câu truy vấn SQL tối thiểu 10 ký tự' })
  sqlText!: string;

  @ApiPropertyOptional({
    default: MONITOR_DEFAULT_DATE,
    example: '20261007',
    description: 'Từ ngày chạy thử theo định dạng YYYYMMDD',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{8}$/, {
    message: 'Ngày truy vấn SAP không hợp lệ (yêu cầu định dạng YYYYMMDD)',
  })
  dateFrom?: string = MONITOR_DEFAULT_DATE;

  @ApiPropertyOptional({
    default: MONITOR_DEFAULT_BRAND,
    example: '5001',
    description: 'Mã thương hiệu chạy thử (1-10 ký tự chữ và số ASCII)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9]{1,10}$/, {
    message:
      'Mã thương hiệu (brand) truy vấn SAP không hợp lệ (chỉ chấp nhận 1–10 ký tự chữ và số ASCII)',
  })
  brand?: string = MONITOR_DEFAULT_BRAND;
}

export class SapQueryStaticCheckStepsDto {
  @ApiProperty({ example: true })
  placeholdersOk!: boolean;

  @ApiProperty({ example: true })
  readOnlySelectOk!: boolean;

  @ApiProperty({ example: true })
  allowedTablesOk!: boolean;

  @ApiProperty({ example: true })
  openQueryLengthOk!: boolean;
}

export class SapQueryColumnCheckItemDto {
  @ApiProperty({ example: 'PO Number' })
  columnName!: string;

  @ApiProperty({
    enum: ['required', 'baseline_optional', 'extra'],
    example: 'required',
  })
  kind!: 'required' | 'baseline_optional' | 'extra';

  @ApiProperty({
    enum: ['present', 'missing', 'removed', 'added', 'unsupported_extra'],
    example: 'present',
  })
  status!: 'present' | 'missing' | 'removed' | 'added' | 'unsupported_extra';
}

export class ReviewSapQueryResultDto {
  @ApiProperty({
    example: true,
    description: 'True khi vượt qua toàn bộ kiểm tra tĩnh, đủ cột bắt buộc và không có lỗi ngữ nghĩa',
  })
  valid!: boolean;

  @ApiProperty({ example: true })
  staticValid!: boolean;

  @ApiProperty({ example: true })
  executionRan!: boolean;

  @ApiProperty({ example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' })
  sqlHash!: string;

  @ApiProperty({ example: 1240 })
  worstCaseOpenQueryLength!: number;

  @ApiProperty({ example: 7800 })
  maxOpenQueryLength!: number;

  @ApiProperty({ type: [String], example: ['{d}', '{br}'] })
  detectedPlaceholders!: string[];

  @ApiProperty({ type: [String], example: [] })
  missingPlaceholders!: string[];

  @ApiProperty({ type: [String], example: [] })
  unexpectedPlaceholders!: string[];

  @ApiProperty({ type: [String], example: ['maycha_live.OPOR', 'maycha_live.OWHS'] })
  referencedTables!: string[];

  @ApiProperty({ type: SapQueryStaticCheckStepsDto })
  steps!: SapQueryStaticCheckStepsDto;

  @ApiProperty({ type: [String], example: [] })
  staticErrors!: string[];

  @ApiProperty({ type: [String] })
  requiredColumns!: string[];

  @ApiProperty({ type: [String] })
  baselineColumns!: string[];

  @ApiProperty({ type: [String] })
  actualColumns!: string[];

  @ApiProperty({ type: [String], example: [] })
  missingColumns!: string[];

  @ApiProperty({ type: [String], example: [] })
  extraColumns!: string[];

  @ApiProperty({ example: 0 })
  duplicateKeyCount!: number;

  @ApiProperty({ type: [SapQueryColumnCheckItemDto] })
  columnChecks!: SapQueryColumnCheckItemDto[];

  @ApiProperty({ type: [String], example: [] })
  warnings!: string[];

  @ApiProperty({ type: [String], example: [] })
  semanticErrors!: string[];

  @ApiProperty({
    type: [String],
    example: [],
    description: 'Danh sách tổng hợp mọi lỗi chặn xuất bản (tĩnh + thiếu cột + ngữ nghĩa)',
  })
  errors!: string[];

  @ApiProperty({ example: 42 })
  rowCount!: number;

  @ApiProperty({ example: 350 })
  durationMs!: number;

  @ApiProperty({ example: '2026-10-29T02:30:00.000Z' })
  testedAt!: string;

  @ApiProperty({
    type: SapTableDto,
    description: 'Tối đa 50 dòng dữ liệu đầu tiên để IT xem trước',
  })
  previewTable!: SapTableDto;
}

export class ReviewSapQueryResponseDto extends ApiResponseDto {
  @ApiProperty({ type: ReviewSapQueryResultDto })
  declare data: ReviewSapQueryResultDto;
}

export class PublishSapQueryRequestDto {
  @ApiProperty({ description: 'Câu Full SQL đã vượt qua Review & Validate' })
  @IsString()
  @MinLength(10, { message: 'Nội dung câu truy vấn SQL tối thiểu 10 ký tự' })
  sqlText!: string;

  @ApiProperty({
    example: 'Thêm cột U_GhiChuKho để đối chiếu ghi chú cửa hàng',
    description: 'Ghi chú lý do thay đổi phiên bản (bắt buộc tối thiểu 3 ký tự)',
  })
  @IsString()
  @MinLength(3, { message: 'Ghi chú thay đổi phải có ít nhất 3 ký tự' })
  @MaxLength(500, { message: 'Ghi chú thay đổi tối đa 500 ký tự' })
  changeNote!: string;
}

export class RollbackSapQueryRequestDto {
  @ApiProperty({
    example: 1,
    description: 'Số thứ tự phiên bản muốn hoàn tác về (tạo phiên bản mới append-only)',
  })
  @IsInt({ message: 'Số phiên bản hoàn tác phải là số nguyên dương' })
  @Min(1, { message: 'Số phiên bản hoàn tác phải lớn hơn hoặc bằng 1' })
  targetVersionNo!: number;

  @ApiPropertyOptional({
    example: 'Hoàn tác về bản ổn định trước đó',
    description: 'Ghi chú lý do hoàn tác (tùy chọn)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  changeNote?: string;
}

export class ResetSapQueryRequestDto {
  @ApiPropertyOptional({
    example: 'Khôi phục về câu truy vấn gốc chuẩn v1',
    description: 'Ghi chú lý do khôi phục mặc định (tùy chọn)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  changeNote?: string;
}
