import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

function toOptionalBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return undefined;
}

export class GetSapStoresQueryDto {
  @ApiPropertyOptional({ description: 'Mã thương hiệu (vd: 5001)' })
  @IsOptional()
  @IsString()
  brandCode?: string;

  @ApiPropertyOptional({ description: 'Tìm kiếm theo mã hoặc tên kho' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Lọc theo trạng thái Active Bán hàng' })
  @IsOptional()
  @Transform(({ value }) => toOptionalBool(value))
  @IsBoolean()
  activeSales?: boolean;

  @ApiPropertyOptional({ description: 'Lọc theo trạng thái Active Luồng trả' })
  @IsOptional()
  @Transform(({ value }) => toOptionalBool(value))
  @IsBoolean()
  activeReturn?: boolean;

  @ApiPropertyOptional({ description: 'Lọc theo trạng thái ngưng hoạt động trên SAP' })
  @IsOptional()
  @Transform(({ value }) => toOptionalBool(value))
  @IsBoolean()
  sapInactive?: boolean;

  @ApiPropertyOptional({ default: 500, minimum: 1, maximum: 2000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2000)
  limit?: number = 500;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
