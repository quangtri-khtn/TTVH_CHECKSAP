import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { GetSapStoresQueryDto } from '../dto/get-sap-stores-query.dto';
import type { SapStoreDto } from '../dto/sap-store.dto';
import type { SyncSapStoresResultDto } from '../dto/sync-sap-stores.dto';
import type { UpdateSapStoreDto } from '../dto/update-sap-store.dto';
import { wrapOpenquery } from '../lib/openquery';
import { SapQueryGatewayService } from './sap-query-gateway.service';

const SYNC_OWHS_SQL = wrapOpenquery(`SELECT "WhsCode", "WhsName", "U_Brand", "Inactive"
FROM maycha_live.OWHS
WHERE "U_Brand" IS NOT NULL`);

const KNOWN_BRAND_NAMES: Record<string, { name: string; sortOrder: number }> = {
  '5001': { name: 'Maycha', sortOrder: 1 },
  '5002': { name: 'Tam Hảo', sortOrder: 2 },
  '5003': { name: 'HO - DCCK', sortOrder: 3 },
  '5004': { name: 'Cloud Kitchen', sortOrder: 4 },
  '5005': { name: 'Gà Giòn Sốt 3 Cô Gái', sortOrder: 5 },
  '5006': { name: 'Trà Hú', sortOrder: 6 },
  '5007': { name: 'Thức Coffee', sortOrder: 7 },
};

function toSapStoreDto(row: {
  code: string;
  name: string;
  brandCode: string | null;
  brand?: { name: string } | null;
  sapInactive: boolean;
  isActiveSales: boolean;
  isActiveReturn: boolean;
  syncedAt: Date;
}): SapStoreDto {
  return {
    code: row.code,
    name: row.name,
    brandCode: row.brandCode,
    brandName: row.brand?.name ?? null,
    sapInactive: row.sapInactive,
    isActiveSales: row.isActiveSales,
    isActiveReturn: row.isActiveReturn,
    syncedAt: row.syncedAt.toISOString(),
  };
}

@Injectable()
export class SapStoreService {
  private readonly logger = new Logger(SapStoreService.name);
  private configEpoch = 0;
  private isSyncing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: SapQueryGatewayService,
  ) {}

  /** Phiên bản cấu hình cửa hàng active để vô hiệu hóa bộ đệm 60s của Monitor ngay khi thay đổi. */
  getConfigEpoch(): number {
    return this.configEpoch;
  }

  async findAll(query: GetSapStoresQueryDto) {
    const limit = query.limit ?? 500;
    const offset = query.offset ?? 0;
    const search = query.search?.trim();

    const where = {
      ...(query.brandCode ? { brandCode: query.brandCode } : {}),
      ...(query.activeSales !== undefined ? { isActiveSales: query.activeSales } : {}),
      ...(query.activeReturn !== undefined ? { isActiveReturn: query.activeReturn } : {}),
      ...(query.sapInactive !== undefined ? { sapInactive: query.sapInactive } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' as const } },
              { name: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.sapStore.findMany({
        where,
        include: { brand: { select: { name: true } } },
        orderBy: [{ brandCode: 'asc' }, { code: 'asc' }],
        skip: offset,
        take: limit,
      }),
      this.prisma.sapStore.count({ where }),
    ]);

    return {
      data: rows.map(toSapStoreDto),
      meta: {
        total,
        limit,
        offset,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async update(code: string, dto: UpdateSapStoreDto): Promise<SapStoreDto> {
    const existing = await this.prisma.sapStore.findUnique({ where: { code } });
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy cửa hàng SAP mã ${code}`);
    }

    const updated = await this.prisma.sapStore.update({
      where: { code },
      data: {
        ...(dto.isActiveSales !== undefined ? { isActiveSales: dto.isActiveSales } : {}),
        ...(dto.isActiveReturn !== undefined ? { isActiveReturn: dto.isActiveReturn } : {}),
      },
      include: { brand: { select: { name: true } } },
    });

    this.configEpoch++;
    return toSapStoreDto(updated);
  }

  /**
   * Đồng bộ danh mục cửa hàng từ `maycha_live.OWHS` qua FifoLock.
   * QUY TẮC BẤT BIẾN: Chỉ cập nhật `name`, `brandCode`, `sapInactive`, `syncedAt`;
   * TUYỆT ĐỐI KHÔNG ghi đè `isActiveSales` và `isActiveReturn` của các kho đã tồn tại.
   */
  async syncFromSap(): Promise<SyncSapStoresResultDto> {
    if (this.isSyncing) {
      throw new ConflictException(
        'Tiến trình đồng bộ cửa hàng từ SAP đang được thực thi, vui lòng đợi.',
      );
    }
    this.isSyncing = true;
    try {
      const result = await this.gateway.run('sync-sap-stores', SYNC_OWHS_SQL);
      const now = new Date();

      const codeIdx = result.columns.indexOf('WhsCode');
      const nameIdx = result.columns.indexOf('WhsName');
      const brandIdx = result.columns.indexOf('U_Brand');
      const inactiveIdx = result.columns.indexOf('Inactive');

      const existingStores = await this.prisma.sapStore.findMany({
        select: { code: true },
      });
      const existingCodes = new Set(existingStores.map((s) => s.code));
      const seenBrands = new Set<string>();

      let inserted = 0;
      let updated = 0;

      for (const row of result.rows) {
        const code = String(row[codeIdx >= 0 ? codeIdx : 0] ?? '').trim();
        if (!code) continue;

        const rawName = String(row[nameIdx >= 0 ? nameIdx : 1] ?? '').trim();
        const name = rawName || `Cửa hàng ${code}`;
        const rawBrand = String(row[brandIdx >= 0 ? brandIdx : 2] ?? '').trim();
        const brandCode = rawBrand || null;
        const rawInactive = String(row[inactiveIdx >= 0 ? inactiveIdx : 3] ?? '')
          .trim()
          .toUpperCase();
        const sapInactive = rawInactive === 'Y';

        if (brandCode && !seenBrands.has(brandCode)) {
          seenBrands.add(brandCode);
          const known = KNOWN_BRAND_NAMES[brandCode];
          await this.prisma.sapBrand.upsert({
            where: { code: brandCode },
            update: {},
            create: {
              code: brandCode,
              name: known?.name ?? `Thương hiệu ${brandCode}`,
              sortOrder: known?.sortOrder ?? 99,
              isActive: true,
            },
          });
        }

        const isExisting = existingCodes.has(code);
        await this.prisma.sapStore.upsert({
          where: { code },
          update: {
            name,
            brandCode,
            sapInactive,
            syncedAt: now,
          },
          create: {
            code,
            name,
            brandCode,
            sapInactive,
            isActiveSales: false,
            isActiveReturn: false,
            syncedAt: now,
          },
        });

        if (isExisting) {
          updated++;
        } else {
          existingCodes.add(code);
          inserted++;
        }
      }

      this.configEpoch++;
      this.logger.log(
        `[syncFromSap] totalFetched=${result.rows.length} inserted=${inserted} updated=${updated}`,
      );

      return {
        totalFetched: inserted + updated,
        inserted,
        updated,
        syncedAt: now.toISOString(),
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Trả về tập mã cửa hàng đang kích hoạt (`Set<string>`) cho Brand và luồng tương ứng.
   */
  async getActiveStoreCodes(
    brandCode: string,
    type: 'sales' | 'return',
  ): Promise<Set<string>> {
    const stores = await this.prisma.sapStore.findMany({
      where: {
        brandCode,
        ...(type === 'sales' ? { isActiveSales: true } : { isActiveReturn: true }),
      },
      select: { code: true },
    });
    return new Set(stores.map((s) => s.code));
  }
}
