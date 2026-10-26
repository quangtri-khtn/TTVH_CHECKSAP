import { ApiProperty } from '@nestjs/swagger';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';

export class SyncSapStoresResultDto {
  @ApiProperty({ example: 120 })
  totalFetched!: number;

  @ApiProperty({ example: 15 })
  inserted!: number;

  @ApiProperty({ example: 105 })
  updated!: number;

  @ApiProperty({ example: '2026-10-26T02:00:00.000Z' })
  syncedAt!: string;
}

export class SyncSapStoresResponseDto extends ApiResponseDto {
  @ApiProperty({ type: SyncSapStoresResultDto })
  declare data: SyncSapStoresResultDto;
}
