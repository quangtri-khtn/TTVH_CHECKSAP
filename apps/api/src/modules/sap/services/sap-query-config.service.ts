// Dịch vụ quản lý cấu hình 25 câu truy vấn SAP HANA (<= 500 dòng theo chuẩn kiến trúc Backend):
// - Single-flight `initPromise` tự nạp & đồng bộ metadata 25 câu từ `SAP_QUERY_CATALOG`
// - Cung cấp `SapQuerySnapshot` bất biến cho Monitor Bán & Trả (chống lệch cột giữa chừng)
// - Thực thi Review & Validate (có cờ `isReviewRunning` bảo vệ `FifoLock`, ghi audit cả khi lỗi SAP)
// - Xuất bản (`publish`), Hoàn tác (`rollback`), Khôi phục gốc (`resetDefault`) theo cơ chế append-only
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  PublishSapQueryRequestDto,
  ResetSapQueryRequestDto,
  ReviewSapQueryRequestDto,
  ReviewSapQueryResultDto,
  RollbackSapQueryRequestDto,
  SapQueryDetailDto,
  SapQuerySummaryDto,
} from '../dto/sap-query-config.dto';
import type { OpenQuerySql } from '../lib/openquery';
import { MONITOR_DEFAULT_BRAND, MONITOR_DEFAULT_DATE } from '../lib/sap-constants';
import { assertSapBrand, assertSapDate } from '../lib/sap-query-params';
import {
  compareQueryColumns,
  computeSqlHash,
  normalizeSqlText,
  renderCatalogSql,
  validateQueryStatic,
} from '../lib/sap-query-template-engine';
import {
  type ReturnMainSqlMap,
  type SalesChainSqlMap,
  type SapQuerySnapshot,
  syncCatalogWithPrisma,
  buildLiveReviewResultDto,
  buildReturnMainSqlMapFromSnapshot,
  buildReturnOldDiscoverySqlMapFromSnapshot,
  buildSalesChainSqlMapFromSnapshot,
  buildSalesListSqlMapFromSnapshot,
  buildStaticFailedReviewDto,
  toSapQueryDetailDto,
  toSapQuerySummaryDto,
} from '../lib/sap-query-template-engine-mappers';
import type { SalesListQueryKey } from '../queries/sales-monitor-queries';
import {
  type SapQueryCatalogEntry,
  type SapQueryKey,
  type SapReturnOldCatalogKey,
  getSapQueryCatalogEntry,
} from '../queries/sap-query-catalog';
import { SapQueryGatewayService } from './sap-query-gateway.service';

export type { ReturnMainSqlMap, SalesChainSqlMap, SapQuerySnapshot };

const REVIEW_CONFLICT_MESSAGE =
  'Hệ thống đang chạy thử một câu truy vấn khác, vui lòng đợi vài giây';
const REVIEW_VALIDITY_TTL_MS = 24 * 60 * 60 * 1000;

export interface SapQueryActor {
  readonly id?: string | null;
  readonly name?: string | null;
  readonly email?: string | null;
}

@Injectable()
export class SapQueryConfigService {
  private readonly logger = new Logger(SapQueryConfigService.name);
  private readonly activeSqlByKey = new Map<SapQueryKey, string>();
  private readonly activeVersionByKey = new Map<SapQueryKey, number>();
  private configEpoch = 0;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private isReviewRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: SapQueryGatewayService,
  ) {}

  getConfigEpoch(): number {
    return this.configEpoch;
  }

  async getSnapshot(): Promise<SapQuerySnapshot> {
    await this.ensureInitialized();
    return {
      epoch: this.configEpoch,
      sqlByKey: new Map(this.activeSqlByKey),
      versionByKey: new Map(this.activeVersionByKey),
    };
  }

  buildSalesListSqlMap(
    snapshot: SapQuerySnapshot,
    dateFrom: string,
    brand: string,
  ): Record<SalesListQueryKey, OpenQuerySql> {
    return buildSalesListSqlMapFromSnapshot(snapshot, dateFrom, brand);
  }

  buildSalesChainSqlMap(
    snapshot: SapQuerySnapshot,
    dateFrom: string,
    brand: string,
    poNumbers?: readonly number[],
  ): SalesChainSqlMap {
    return buildSalesChainSqlMapFromSnapshot(snapshot, dateFrom, brand, poNumbers);
  }

  buildReturnMainSqlMap(
    snapshot: SapQuerySnapshot,
    dateFrom: string,
    brand: string,
    poNumbers?: readonly number[],
  ): ReturnMainSqlMap {
    return buildReturnMainSqlMapFromSnapshot(snapshot, dateFrom, brand, poNumbers);
  }

  buildReturnOldDiscoverySqlMap(
    snapshot: SapQuerySnapshot,
    dateFrom: string,
    brand: string,
  ): Record<SapReturnOldCatalogKey, OpenQuerySql> {
    return buildReturnOldDiscoverySqlMapFromSnapshot(snapshot, dateFrom, brand);
  }

  async findAll(): Promise<SapQuerySummaryDto[]> {
    await this.ensureInitialized();
    const defs = await this.prisma.sapQueryDef.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return defs.map((row) => toSapQuerySummaryDto(row, this.activeSqlByKey));
  }

  async findOne(key: string): Promise<SapQueryDetailDto> {
    const entry = this.getCatalogEntryOrThrow(key);
    await this.ensureInitialized();
    const row = await this.prisma.sapQueryDef.findUnique({
      where: { key: entry.key },
      include: {
        versions: { orderBy: { versionNo: 'desc' }, take: 30 },
        audits: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!row) {
      throw new NotFoundException(
        `Không tìm thấy cấu hình câu truy vấn SAP mã ${key}`,
      );
    }
    return toSapQueryDetailDto(row, this.activeSqlByKey);
  }

  async review(
    key: string,
    dto: ReviewSapQueryRequestDto,
    actor?: SapQueryActor,
  ): Promise<ReviewSapQueryResultDto> {
    const entry = this.getCatalogEntryOrThrow(key);
    if (this.isReviewRunning) {
      throw new ConflictException(REVIEW_CONFLICT_MESSAGE);
    }
    this.isReviewRunning = true;
    try {
      await this.ensureInitialized();
      const dateFrom = dto.dateFrom ?? MONITOR_DEFAULT_DATE;
      const brand = dto.brand ?? MONITOR_DEFAULT_BRAND;
      assertSapDate(dateFrom);
      assertSapBrand(brand);

      const normalizedSql = normalizeSqlText(dto.sqlText);
      const staticRes = validateQueryStatic(entry, normalizedSql);
      const testedAt = new Date();
      const beforeSql =
        this.activeSqlByKey.get(entry.key) ?? normalizeSqlText(entry.defaultSql);
      const currentVersionNo = this.activeVersionByKey.get(entry.key) ?? 1;

      if (!staticRes.valid) {
        await this.recordAudit(
          entry.key,
          'review',
          currentVersionNo,
          currentVersionNo,
          beforeSql,
          normalizedSql,
          `Kiểm tra tĩnh không đạt: ${staticRes.errors.join(' | ')}`,
          actor,
        );
        return buildStaticFailedReviewDto(entry, staticRes, testedAt);
      }

      const renderedSql = renderCatalogSql(normalizedSql, { dateFrom, brand });
      const startMs = Date.now();
      let queryResult;
      try {
        queryResult = await this.gateway.run(`review:${entry.key}`, renderedSql);
      } catch (err) {
        await this.recordAudit(
          entry.key,
          'review',
          currentVersionNo,
          currentVersionNo,
          beforeSql,
          normalizedSql,
          'Chạy thử trên SAP thất bại',
          actor,
        );
        throw err;
      }
      const durationMs = Math.max(0, Date.now() - startMs);
      const colDiff = compareQueryColumns(
        entry,
        queryResult.columns,
        queryResult.rows,
      );
      const allErrors: string[] = [...staticRes.errors];
      if (colDiff.missingColumns.length > 0) {
        allErrors.push(
          `Thiếu cột bắt buộc so với câu gốc: ${colDiff.missingColumns.join(', ')}`,
        );
      }
      allErrors.push(...colDiff.semanticErrors);
      const valid = staticRes.valid && colDiff.valid;

      await this.recordAudit(
        entry.key,
        'review',
        currentVersionNo,
        currentVersionNo,
        beforeSql,
        normalizedSql,
        valid
          ? `Review & Validate đạt (${queryResult.rows.length} dòng, ${durationMs}ms)`
          : `Review & Validate không đạt: ${allErrors.join(' | ')}`,
        actor,
      );

      if (valid) {
        await this.prisma.sapQueryDef.update({
          where: { key: entry.key },
          data: {
            lastTestedSqlHash: staticRes.sqlHash,
            lastTestedAt: testedAt,
            lastTestedById: actor?.id ?? null,
            lastTestRowCount: queryResult.rows.length,
            lastTestDurationMs: durationMs,
          },
        });
      }

      return buildLiveReviewResultDto(
        staticRes,
        colDiff,
        queryResult,
        allErrors,
        durationMs,
        testedAt,
      );
    } finally {
      this.isReviewRunning = false;
    }
  }

  async publish(
    key: string,
    dto: PublishSapQueryRequestDto,
    actor?: SapQueryActor,
  ): Promise<SapQueryDetailDto> {
    const entry = this.getCatalogEntryOrThrow(key);
    await this.ensureInitialized();
    const changeNote = dto.changeNote?.trim() ?? '';
    if (changeNote.length < 3) {
      throw new BadRequestException('Ghi chú thay đổi phải có ít nhất 3 ký tự');
    }
    const normalizedSql = normalizeSqlText(dto.sqlText);
    const staticRes = validateQueryStatic(entry, normalizedSql);
    if (!staticRes.valid) {
      throw new BadRequestException(staticRes.errors.join(' | '));
    }
    const def = await this.prisma.sapQueryDef.findUnique({
      where: { key: entry.key },
    });
    if (!def) {
      throw new NotFoundException(
        `Không tìm thấy cấu hình câu truy vấn SAP mã ${key}`,
      );
    }
    const isRecentlyTested =
      def.lastTestedSqlHash === staticRes.sqlHash &&
      def.lastTestedAt !== null &&
      Date.now() - def.lastTestedAt.getTime() <= REVIEW_VALIDITY_TTL_MS;
    if (!isRecentlyTested) {
      throw new BadRequestException(
        'Câu truy vấn chưa được chạy Review & Validate thành công (hoặc nội dung SQL đã thay đổi sau khi Review). Vui lòng bấm Review & Validate trước khi Xuất bản.',
      );
    }
    return this.appendVersionAndCommit(
      entry,
      def,
      'publish',
      normalizedSql,
      staticRes.sqlHash,
      changeNote,
      actor,
    );
  }

  async rollback(
    key: string,
    dto: RollbackSapQueryRequestDto,
    actor?: SapQueryActor,
  ): Promise<SapQueryDetailDto> {
    const entry = this.getCatalogEntryOrThrow(key);
    await this.ensureInitialized();
    const [def, targetVer] = await Promise.all([
      this.prisma.sapQueryDef.findUnique({ where: { key: entry.key } }),
      this.prisma.sapQueryVersion.findUnique({
        where: {
          queryKey_versionNo: {
            queryKey: entry.key,
            versionNo: dto.targetVersionNo,
          },
        },
      }),
    ]);
    if (!def) {
      throw new NotFoundException(
        `Không tìm thấy cấu hình câu truy vấn SAP mã ${key}`,
      );
    }
    if (!targetVer) {
      throw new NotFoundException(
        `Không tìm thấy phiên bản v${dto.targetVersionNo} của câu truy vấn ${entry.key}`,
      );
    }
    const normalizedSql = normalizeSqlText(targetVer.sqlText);
    const staticRes = validateQueryStatic(entry, normalizedSql);
    if (!staticRes.valid) {
      throw new BadRequestException(staticRes.errors.join(' | '));
    }
    const changeNote =
      dto.changeNote?.trim() || `Hoàn tác về phiên bản v${dto.targetVersionNo}`;
    return this.appendVersionAndCommit(
      entry,
      def,
      'rollback',
      normalizedSql,
      staticRes.sqlHash,
      changeNote,
      actor,
    );
  }

  async resetDefault(
    key: string,
    dto: ResetSapQueryRequestDto,
    actor?: SapQueryActor,
  ): Promise<SapQueryDetailDto> {
    const entry = this.getCatalogEntryOrThrow(key);
    await this.ensureInitialized();
    const def = await this.prisma.sapQueryDef.findUnique({
      where: { key: entry.key },
    });
    if (!def) {
      throw new NotFoundException(
        `Không tìm thấy cấu hình câu truy vấn SAP mã ${key}`,
      );
    }
    const defaultSql = normalizeSqlText(entry.defaultSql);
    const defaultSqlHash = computeSqlHash(defaultSql);
    const changeNote =
      dto.changeNote?.trim() || 'Khôi phục về câu truy vấn gốc chuẩn (Seed v1)';
    return this.appendVersionAndCommit(
      entry,
      def,
      'reset_default',
      defaultSql,
      defaultSqlHash,
      changeNote,
      actor,
    );
  }

  private async appendVersionAndCommit(
    entry: SapQueryCatalogEntry,
    def: { currentVersionNo: number; defaultSql: string },
    action: 'publish' | 'rollback' | 'reset_default',
    normalizedSql: string,
    sqlHash: string,
    changeNote: string,
    actor?: SapQueryActor,
  ): Promise<SapQueryDetailDto> {
    const beforeSql =
      this.activeSqlByKey.get(entry.key) ?? normalizeSqlText(def.defaultSql);
    const nextVersionNo = await this.prisma.$transaction(async (tx) => {
      const maxVer = await tx.sapQueryVersion.aggregate({
        where: { queryKey: entry.key },
        _max: { versionNo: true },
      });
      const nextVer = (maxVer._max.versionNo ?? 0) + 1;
      await tx.sapQueryVersion.create({
        data: {
          queryKey: entry.key,
          versionNo: nextVer,
          sqlText: normalizedSql,
          sqlHash,
          changeNote,
          createdById: actor?.id ?? null,
          createdBy: actor?.name ?? actor?.email ?? null,
        },
      });
      await tx.sapQueryDef.update({
        where: { key: entry.key },
        data: { currentVersionNo: nextVer },
      });
      await tx.sapQueryAudit.create({
        data: {
          queryKey: entry.key,
          action,
          fromVersion: def.currentVersionNo,
          toVersion: nextVer,
          beforeSql,
          afterSql: normalizedSql,
          changeNote,
          actorId: actor?.id ?? null,
          actorName: actor?.name ?? actor?.email ?? null,
        },
      });
      return nextVer;
    });

    this.activeSqlByKey.set(entry.key, normalizedSql);
    this.activeVersionByKey.set(entry.key, nextVersionNo);
    this.configEpoch++;
    this.logger.log(
      `sap query ${action} key=${entry.key} version=${nextVersionNo} epoch=${this.configEpoch}`,
    );
    return this.findOne(entry.key);
  }

  private async recordAudit(
    queryKey: string,
    action: string,
    fromVersion: number,
    toVersion: number,
    beforeSql: string,
    afterSql: string,
    changeNote: string,
    actor?: SapQueryActor,
  ): Promise<void> {
    await this.prisma.sapQueryAudit.create({
      data: {
        queryKey,
        action,
        fromVersion,
        toVersion,
        beforeSql,
        afterSql,
        changeNote,
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? actor?.email ?? null,
      },
    });
  }

  private getCatalogEntryOrThrow(key: string): SapQueryCatalogEntry {
    const entry = getSapQueryCatalogEntry(key);
    if (!entry) {
      throw new NotFoundException(
        `Không tìm thấy cấu hình câu truy vấn SAP mã ${key}`,
      );
    }
    return entry;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doInitialize().finally(() => {
      this.initPromise = null;
    });
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    await syncCatalogWithPrisma(
      this.prisma,
      this.activeSqlByKey,
      this.activeVersionByKey,
    );
    this.initialized = true;
  }
}
