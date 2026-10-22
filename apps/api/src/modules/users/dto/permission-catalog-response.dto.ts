import { ApiProperty } from '@nestjs/swagger';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';

export class PermissionCatalogItemDto {
  @ApiProperty()
  key!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  category!: string;

  @ApiProperty({ type: [String] })
  implies!: string[];
}

export class RolePermissionsDto {
  @ApiProperty({ type: [String] })
  ADMIN!: string[];

  @ApiProperty({ type: [String] })
  EMPLOYEE!: string[];
}

export class PermissionCatalogResponseDto {
  @ApiProperty({ type: [PermissionCatalogItemDto] })
  permissions!: PermissionCatalogItemDto[];

  @ApiProperty({ type: RolePermissionsDto })
  roles!: RolePermissionsDto;
}

export class PermissionCatalogEnvelopeDto extends ApiResponseDto {
  @ApiProperty({ type: PermissionCatalogResponseDto })
  declare data: PermissionCatalogResponseDto;
}
