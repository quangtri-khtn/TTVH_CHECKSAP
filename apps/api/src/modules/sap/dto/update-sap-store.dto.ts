import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateSapStoreDto {
  @ApiPropertyOptional({ description: 'Cho phép cửa hàng tham gia Monitor Bán hàng' })
  @IsOptional()
  @IsBoolean()
  isActiveSales?: boolean;

  @ApiPropertyOptional({ description: 'Cho phép cửa hàng tham gia Monitor Luồng trả' })
  @IsOptional()
  @IsBoolean()
  isActiveReturn?: boolean;
}
