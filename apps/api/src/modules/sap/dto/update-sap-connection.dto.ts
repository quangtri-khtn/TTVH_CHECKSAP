// DTO cập nhật tài khoản kết nối SQL Server cho SAP.
// password rỗng hoặc không gửi nghĩa là giữ nguyên mật khẩu cũ; không nhận isActive.
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class UpdateSapConnectionDto {
  @ApiProperty({ required: false, maxLength: 128 })
  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  username?: string;

  @ApiProperty({ required: false, maxLength: 128 })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(128)
  password?: string;
}
