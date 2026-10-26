import { ApiProperty } from '@nestjs/swagger';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';

export class SapBrandDto {
  @ApiProperty({ example: '5001' })
  code!: string;

  @ApiProperty({ example: 'Maycha' })
  name!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: 1 })
  sortOrder!: number;

  @ApiProperty({ example: 26 })
  storeCount!: number;
}

export class SapBrandListResponseDto extends ApiResponseDto {
  @ApiProperty({ type: [SapBrandDto] })
  declare data: SapBrandDto[];
}
