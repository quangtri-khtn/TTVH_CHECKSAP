import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { SapBrandDto } from '../dto/sap-brand.dto';

@Injectable()
export class SapBrandService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(onlyActive = true): Promise<SapBrandDto[]> {
    const rows = await this.prisma.sapBrand.findMany({
      where: onlyActive ? { isActive: true } : {},
      include: {
        _count: {
          select: { stores: true },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });

    return rows.map((row) => ({
      code: row.code,
      name: row.name,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      storeCount: row._count.stores,
    }));
  }
}
