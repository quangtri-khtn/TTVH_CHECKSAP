// DTO biểu diễn thông tin kết nối SAP trả về cho client (whitelist, không có mật khẩu hay ciphertext).
import { ApiProperty } from '@nestjs/swagger';

export class SapConnectionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty()
  hasPassword!: boolean;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ type: Date, required: false, nullable: true })
  lastTestAt!: Date | null;

  @ApiProperty({ type: Boolean, required: false, nullable: true })
  lastTestOk!: boolean | null;

  @ApiProperty({ type: String, required: false, nullable: true })
  updatedById!: string | null;

  @ApiProperty({ type: String, required: false, nullable: true })
  updatedByName!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
