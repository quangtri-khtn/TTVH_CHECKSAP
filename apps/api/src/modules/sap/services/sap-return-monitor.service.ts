// Dịch vụ điều phối truy vấn và tính toán dữ liệu cho màn hình Monitor Luồng Trả hàng.
// Tích hợp Single-flight in-memory, TTL Cache 60 giây gắn với poolEpoch của SapQueryGatewayService,
// chia lô tối đa 300 PO cho nhóm cũ (bỏ qua truy vấn whs) và đóng gói phản hồi 4 khóa ở root.
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { GetReturnMonitorQueryDto } from '../dto/return-monitor-query.dto';
import { ReturnMonitorDataDto } from '../dto/return-monitor-response.dto';
import {
  RET_AR_NOINV_COLS,
  assembleReturnChain,
  buildReturnArNoInv,
  buildReturnFunnel,
  buildReturnStatusSummary,
  countReturnStatusByCohort,
} from '../lib/return-monitor';
import {
  NHOM_CU,
  NHOM_MOI,
  recordsToTable,
  todayInVietnam,
} from '../lib/sales-monitor';
import { MONITOR_DEFAULT_BRAND, MONITOR_DEFAULT_DATE } from '../lib/sap-constants';
import { assertSapBrand, assertSapDate } from '../lib/sap-query-params';
import type { SapQueryResult } from '../lib/sap-row-normalizer';
import type { ReturnListQueryKey } from '../queries/return-monitor-queries';
import { SAP_RETURN_OLD_QUERY_KEYS } from '../queries/sap-query-catalog';
import { SapQueryConfigService } from './sap-query-config.service';
import { SapQueryGatewayService } from './sap-query-gateway.service';
import { SapStoreService } from './sap-store.service';

const CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 20;
const OLD_PO_CHUNK_SIZE = 300;

const RETURN_LIST_ORDER: readonly ReturnListQueryKey[] = [
  'po',
  'so',
  'do',
  'ar',
  'grpo',
  'ap',
  'whs',
];

const RETURN_OLD_PO_ORDER: readonly Exclude<ReturnListQueryKey, 'whs'>[] = [
  'po',
  'so',
  'do',
  'ar',
  'grpo',
  'ap',
];

interface CacheEntry {
  data: ReturnMonitorDataDto;
  expiresAt: number;
  poolEpoch: number;
  configEpoch: number;
}

function assertBatchColumnsMatch(
  baseColumns: readonly string[],
  chunkColumns: readonly string[],
  label: string,
  logger: Logger,
): void {
  if (
    chunkColumns.length !== baseColumns.length ||
    chunkColumns.some((col, idx) => col !== baseColumns[idx])
  ) {
    const message = `Lệch cấu trúc cột khi nối lô PO cũ tại ${label}: [${chunkColumns.join(', ')}] !== [${baseColumns.join(', ')}]`;
    logger.error(message);
    throw new InternalServerErrorException(message);
  }
}

@Injectable()
export class SapReturnMonitorService {
  private readonly logger = new Logger(SapReturnMonitorService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<ReturnMonitorDataDto>>();

  constructor(
    private readonly gateway: SapQueryGatewayService,
    private readonly storeService: SapStoreService,
    private readonly queryConfigService: SapQueryConfigService,
  ) {}

  private getCombinedConfigEpoch(): number {
    return (
      this.storeService.getConfigEpoch() +
      this.queryConfigService.getConfigEpoch()
    );
  }

  /** Xóa toàn bộ bộ đệm TTL trong bộ nhớ (phục vụ kiểm thử hoặc làm sạch cưỡng bức). */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Lấy dữ liệu Monitor Luồng Trả hoàn chỉnh gồm 4 khóa root (`meta`, `summary`, `cohorts`, `lists`).
   * Sử dụng TTL Cache 60 giây và Single-flight chống dồn truy vấn khi `refresh !== true`.
   */
  async getReturnMonitor(query: GetReturnMonitorQueryDto): Promise<ReturnMonitorDataDto> {
    const dateFrom = query.dateFrom ?? MONITOR_DEFAULT_DATE;
    const rawBrand = query.brand ?? MONITOR_DEFAULT_BRAND;
    const brand = rawBrand.toUpperCase() === 'ALL' ? 'ALL' : rawBrand;
    const refresh = Boolean(query.refresh);

    assertSapDate(dateFrom);
    assertSapBrand(brand);

    const currentEpoch = this.gateway.getPoolEpoch();
    const currentConfigEpoch = this.getCombinedConfigEpoch();
    const cacheKey = `${dateFrom}:${brand}`;
    const inFlightKey = `${currentEpoch}:${currentConfigEpoch}:${cacheKey}`;

    if (refresh) {
      this.cache.delete(cacheKey);
    } else {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        if (
          Date.now() < cached.expiresAt &&
          cached.poolEpoch === currentEpoch &&
          cached.configEpoch === currentConfigEpoch
        ) {
          this.logger.log(`return monitor hit cache key=${cacheKey}`);
          return {
            ...cached.data,
            meta: {
              ...cached.data.meta,
              fromCache: true,
              durationMs: 0,
            },
          };
        }
        this.cache.delete(cacheKey);
      }

      const existingFlight = this.inFlight.get(inFlightKey);
      if (existingFlight) {
        this.logger.log(`return monitor join in-flight key=${cacheKey}`);
        return existingFlight;
      }
    }

    const execPromise = this.executeFetch(dateFrom, brand);
    this.inFlight.set(inFlightKey, execPromise);

    try {
      const data = await execPromise;
      if (
        this.gateway.getPoolEpoch() === currentEpoch &&
        this.getCombinedConfigEpoch() === currentConfigEpoch
      ) {
        this.pruneCache();
        this.cache.set(cacheKey, {
          data,
          expiresAt: Date.now() + CACHE_TTL_MS,
          poolEpoch: currentEpoch,
          configEpoch: currentConfigEpoch,
        });
      }
      return data;
    } finally {
      if (this.inFlight.get(inFlightKey) === execPromise) {
        this.inFlight.delete(inFlightKey);
      }
    }
  }

  private pruneCache(): void {
    const now = Date.now();
    const currentEpoch = this.gateway.getPoolEpoch();
    const currentConfigEpoch = this.getCombinedConfigEpoch();
    for (const [key, entry] of this.cache.entries()) {
      if (
        now >= entry.expiresAt ||
        entry.poolEpoch !== currentEpoch ||
        entry.configEpoch !== currentConfigEpoch
      ) {
        this.cache.delete(key);
      }
    }
    while (this.cache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      this.cache.delete(oldestKey);
    }
  }

  private async executeFetch(
    dateFrom: string,
    brand: string,
  ): Promise<ReturnMonitorDataDto> {
    const startedAt = Date.now();
    let queryCount = 0;
    const today = todayInVietnam();
    const activeStoreCodes = await this.storeService.getActiveStoreCodes(brand, 'return');
    const shouldFilter = activeStoreCodes.size > 0;
    if (!shouldFilter) {
      this.logger.warn(
        `[SapReturnMonitorService] Brand ${brand} has no active return stores configured. Falling back to all stores.`,
      );
    }

    const querySnapshot = await this.queryConfigService.getSnapshot();

    // Bước 1: Chạy tuần tự 7 câu truy vấn chuẩn (po, so, do, ar, grpo, ap, whs)
    const listQueries = this.queryConfigService.buildReturnMainSqlMap(
      querySnapshot,
      dateFrom,
      brand,
    );
    const results = {} as Record<ReturnListQueryKey, SapQueryResult>;
    for (const key of RETURN_LIST_ORDER) {
      results[key] = await this.gateway.run(
        `return-list:${key}`,
        listQueries[key],
      );
      queryCount++;
    }

    // Bước 2: Tập hợp các PO Number của nhóm mới từ kết quả po
    const poNumIdx = results.po.columns.indexOf('PO Number');
    const newPoSet = new Set<number>(
      poNumIdx >= 0
        ? results.po.rows
            .map((r) => Number(r[poNumIdx]))
            .filter((n) => Number.isSafeInteger(n) && n > 0)
        : [],
    );

    // Bước 3: Chạy tuần tự 5 câu ret_old_1..5 tìm ứng viên PO cũ và lọc những PO chưa nằm trong tập PO mới
    const oldDiscoveryQueries =
      this.queryConfigService.buildReturnOldDiscoverySqlMap(
        querySnapshot,
        dateFrom,
        brand,
      );
    const oldPoSet = new Set<number>();
    for (const oldKey of SAP_RETURN_OLD_QUERY_KEYS) {
      const oldPosResult = await this.gateway.run(
        `return-candidates:${oldKey}`,
        oldDiscoveryQueries[oldKey],
      );
      queryCount++;
      const oldPoColIdx = oldPosResult.columns.indexOf('PO Number');
      if (oldPoColIdx >= 0) {
        for (const row of oldPosResult.rows) {
          const n = Number(row[oldPoColIdx]);
          if (Number.isSafeInteger(n) && n > 0 && !newPoSet.has(n)) {
            oldPoSet.add(n);
          }
        }
      }
    }
    const oldPos = [...oldPoSet].sort((a, b) => a - b);

    // Bước 4: Chia lô tối đa 300 PO nhóm cũ và bỏ qua truy vấn whs (Bẫy lệch số 6)
    for (let i = 0; i < oldPos.length; i += OLD_PO_CHUNK_SIZE) {
      const chunk = oldPos.slice(i, i + OLD_PO_CHUNK_SIZE);
      const chunkQueries = this.queryConfigService.buildReturnMainSqlMap(
        querySnapshot,
        dateFrom,
        brand,
        chunk,
      );
      for (const key of RETURN_OLD_PO_ORDER) {
        const chunkRes = await this.gateway.run(
          `return-old:${key}:${i}`,
          chunkQueries[key],
        );
        queryCount++;
        assertBatchColumnsMatch(
          results[key].columns,
          chunkRes.columns,
          `return-old:${key}:${i}`,
          this.logger,
        );
        for (const row of chunkRes.rows) {
          results[key].rows.push(row);
        }
      }
    }

    // Bước 5: Lọc theo cửa hàng active (in-memory Set<string>) và gọi Pure Domain Logic
    if (shouldFilter) {
      const storeIdx = results.po.columns.indexOf('Store');
      if (storeIdx >= 0) {
        results.po = {
          columns: results.po.columns,
          rows: results.po.rows.filter((r) =>
            activeStoreCodes.has(String(r[storeIdx] ?? '').trim()),
          ),
        };
      }
    }

    const {
      table: chainTable,
      rows: chainRows,
      arRows,
      grpoRows,
      extraArCols,
    } = assembleReturnChain(results, dateFrom, today);
    const arNoInvRows = buildReturnArNoInv(
      chainRows,
      arRows,
      today,
      extraArCols,
    );
    const moiRows = chainRows.filter((r) => r.Nhom === NHOM_MOI);
    const moiAr = arRows.filter((r) => r.Nhom === NHOM_MOI);
    const moiGrpo = grpoRows.filter((r) => r.Nhom === NHOM_MOI);
    const moi = {
      funnel: buildReturnFunnel(moiRows, moiAr, moiGrpo, today),
      statusCounts: countReturnStatusByCohort(chainRows, NHOM_MOI),
      poCount: moiRows.length,
    };

    const cuRows = chainRows.filter((r) => r.Nhom === NHOM_CU);
    const cuAr = arRows.filter((r) => r.Nhom === NHOM_CU);
    const cuGrpo = grpoRows.filter((r) => r.Nhom === NHOM_CU);
    const cu = {
      funnel: buildReturnFunnel(cuRows, cuAr, cuGrpo, today),
      statusCounts: countReturnStatusByCohort(chainRows, NHOM_CU),
      poCount: cuRows.length,
    };

    const tatCa = {
      funnel: buildReturnFunnel(chainRows, arRows, grpoRows, today),
      statusCounts: countReturnStatusByCohort(chainRows, null),
      poCount: chainRows.length,
    };

    const summary = buildReturnStatusSummary(chainRows, arNoInvRows);
    const arNoInvTable = recordsToTable(
      [...RET_AR_NOINV_COLS, ...extraArCols],
      arNoInvRows,
    );
    const durationMs = Date.now() - startedAt;

    return {
      meta: {
        dateFrom,
        brand,
        today,
        generatedAt: new Date().toISOString(),
        fromCache: false,
        queryCount,
        durationMs,
      },
      summary,
      cohorts: { moi, cu, tatCa },
      lists: {
        chain: chainTable,
        arNoInv: arNoInvTable,
      },
    };
  }
}
