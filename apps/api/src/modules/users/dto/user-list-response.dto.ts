import { ApiProperty } from '@nestjs/swagger';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { UserResponseDto } from './user-response.dto';

export class UserListResponseDto extends ApiResponseDto {
  @ApiProperty({ type: [UserResponseDto] })
  data!: UserResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
