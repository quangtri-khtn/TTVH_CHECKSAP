// DTO biểu diễn dữ liệu bảng 2 chiều { columns, rows } tối ưu kích thước truyền tải và tương thích Orval.
import { ApiProperty } from '@nestjs/swagger';
import type { SapCellValue } from '../lib/sap-row-normalizer';

export class SapTableDto {
  @ApiProperty({
    description: 'Danh sách tên các cột của bảng theo đúng thứ tự',
    type: [String],
    example: ['Store', 'PO Number', 'DocDate'],
  })
  columns!: string[];

  @ApiProperty({
    description: 'Mảng 2 chiều chứa các dòng dữ liệu [dòng][cột]',
    type: 'array',
    items: {
      type: 'array',
      items: {
        oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
        nullable: true,
      },
    },
    example: [['MC001', 100234, '2026-10-07']],
  })
  rows!: SapCellValue[][];
}
