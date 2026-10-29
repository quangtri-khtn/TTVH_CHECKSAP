import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';

export class BulkUpdateSapStoresByBrandDto {
  @ApiProperty({ description: 'Mã thương hiệu SAP (U_Brand)', example: '5001' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9]{1,10}$/, { message: 'Mã thương hiệu không hợp lệ' })
  brandCode!: string;

  @ApiProperty({
    description:
      'true = Bật toàn bộ kho đang hoạt động trên SAP (sapInactive = false) thuộc thương hiệu; false = Tắt toàn bộ kho thuộc thương hiệu',
    example: true,
  })
  @IsBoolean()
  isActive!: boolean;
}

export class BulkUpdateSapStoresByBrandResultDto {
  @ApiProperty({ example: '5001' })
  brandCode!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ description: 'Số lượng cửa hàng được bật/tắt', example: 84 })
  updatedCount!: number;
}

export class BulkUpdateSapStoresByBrandResponseDto extends ApiResponseDto {
  @ApiProperty({ type: BulkUpdateSapStoresByBrandResultDto })
  declare data: BulkUpdateSapStoresByBrandResultDto;
}
