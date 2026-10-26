import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';

export class SapStoreDto {
  @ApiProperty({ example: 'MC001' })
  code!: string;

  @ApiProperty({ example: 'Cửa hàng MC001' })
  name!: string;

  @ApiPropertyOptional({ type: String, example: '5001', nullable: true })
  brandCode!: string | null;

  @ApiPropertyOptional({ type: String, example: 'Maycha', nullable: true })
  brandName!: string | null;

  @ApiProperty({ example: false })
  sapInactive!: boolean;

  @ApiProperty({ example: true })
  isActiveSales!: boolean;

  @ApiProperty({ example: true })
  isActiveReturn!: boolean;

  @ApiProperty({ example: '2026-10-26T02:00:00.000Z' })
  syncedAt!: string;
}

export class SapStoreEnvelopeDto extends ApiResponseDto {
  @ApiProperty({ type: SapStoreDto })
  declare data: SapStoreDto;
}

export class SapStoreListResponseDto extends ApiResponseDto {
  @ApiProperty({ type: [SapStoreDto] })
  declare data: SapStoreDto[];

  @ApiProperty({ type: PaginationMetaDto })
  declare meta: PaginationMetaDto;
}
