import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Role } from '../../../generated/prisma/enums';
import { PaginationQueryDto } from '../../../common/dto/pagination-meta.dto';
import { SortOrder } from '../../../common/dto/sort-order.enum';

export enum UserSortField {
  EMAIL = 'email',
  NAME = 'name',
  ROLE = 'role',
  CREATED_AT = 'createdAt',
}

function splitCsv({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.split(',').filter(Boolean) : value;
}

export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiProperty({ enum: Role, isArray: true, required: false, description: '?role=ADMIN&role=EMPLOYEE (also accepts CSV: ?role=ADMIN,EMPLOYEE)' })
  @IsOptional()
  @Transform(splitCsv)
  @IsEnum(Role, { each: true })
  role?: Role[];

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ enum: UserSortField, required: false })
  @IsOptional()
  @IsEnum(UserSortField)
  sortBy?: UserSortField;

  @ApiProperty({ enum: SortOrder, required: false })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder;
}
