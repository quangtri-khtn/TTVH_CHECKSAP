// Các envelope DTO cho nhóm API kết nối SAP, kế thừa ApiResponseDto theo chuẩn TransformInterceptor.
import { ApiProperty } from '@nestjs/swagger';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { SapConnectionTestResultDto } from './sap-connection-test-result.dto';
import { SapConnectionDto } from './sap-connection.dto';

export class SapConnectionEnvelopeDto extends ApiResponseDto {
  @ApiProperty({ type: SapConnectionDto })
  declare data: SapConnectionDto;
}

export class SapConnectionListResponseDto extends ApiResponseDto {
  @ApiProperty({ type: [SapConnectionDto] })
  declare data: SapConnectionDto[];
}

export class SapConnectionTestResponseDto extends ApiResponseDto {
  @ApiProperty({ type: SapConnectionTestResultDto })
  declare data: SapConnectionTestResultDto;
}
