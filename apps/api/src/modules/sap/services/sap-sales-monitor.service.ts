// Dịch vụ điều phối truy vấn và tính toán dữ liệu cho màn hình Monitor Bán hàng (Go-live).
// Tích hợp Single-flight in-memory, TTL Cache 60 giây gắn với poolEpoch của SapQueryGatewayService,
// chia lô tối đa 300 PO cho nhóm cũ và đóng gói phản hồi 5 khóa ở root.
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { GetSalesMonitorQueryDto } from '../dto/sales-monitor-query.dto';
import { SalesMonitorDataDto } from '../dto/sales-monitor-response.dto';
import {
  NHOM_CU,
  NHOM_MOI,
  assemblePoChain,
  buildChainArAndGrpo,
  buildConversionFunnel,
  buildDocStatus,
  buildMonitorOverview,
  buildStatusSummary,
  countDocStatusByCohort,
  oldCohortPoNumbers,
  recordsToTable,
  tagCohort,
  todayInVietnam,
} from '../lib/sales-monitor';
import { MONITOR_DEFAULT_BRAND, MONITOR_DEFAULT_DATE } from '../lib/sap-constants';
import { assertSapBrand, assertSapDateRange } from '../lib/sap-query-params';
import type { SapQueryResult } from '../lib/sap-row-normalizer';
import type {
  SalesChainQueryKey,
  SalesListQueryKey,
} from '../queries/sales-monitor-queries';
import { SapQueryConfigService } from './sap-query-config.service';
import { SapQueryGatewayService } from './sap-query-gateway.service';
import { SapStoreService } from './sap-store.service';

const CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 20;
const OLD_PO_CHUNK_SIZE = 300;

const SALES_LIST_ORDER: readonly SalesListQueryKey[] = [
  'funnel',
  't1',
  't2',
  't3',
  't4',
  'ar',
  'grpo',
  'ap',
];

const SALES_CHAIN_ORDER: readonly SalesChainQueryKey[] = [
  'po',
  'so',
  'ar',
  'grpo',
  'ap',
];

interface CacheEntry {
  data: SalesMonitorDataDto;
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
export class SapSalesMonitorService {
  private readonly logger = new Logger(SapSalesMonitorService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<SalesMonitorDataDto>>();

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
   * Lấy dữ liệu Monitor Bán hàng hoàn chỉnh gồm 5 khóa root (`meta`, `summary`, `cohorts`, `docStatus`, `lists`).
   * Sử dụng TTL Cache 60 giây và Single-flight chống dồn truy vấn khi `refresh !== true`.
   */
  async getSalesMonitor(query: GetSalesMonitorQueryDto): Promise<SalesMonitorDataDto> {
    const dateFrom = query.dateFrom ?? MONITOR_DEFAULT_DATE;
    const dateTo = query.dateTo || todayInVietnam().replaceAll('-', '');
    const rawBrand = query.brand ?? MONITOR_DEFAULT_BRAND;
    const brand =
      rawBrand.trim().toUpperCase() === 'ALL' ? '' : rawBrand.trim();
    const refresh = Boolean(query.refresh);

    assertSapDateRange(dateFrom, dateTo);
    assertSapBrand(brand);

    const currentEpoch = this.gateway.getPoolEpoch();
    const currentConfigEpoch = this.getCombinedConfigEpoch();
    const cacheKey = `${dateFrom}:${dateTo}:${brand}`;
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
          this.logger.log(`sales monitor hit cache key=${cacheKey}`);
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
        this.logger.log(`sales monitor join in-flight key=${cacheKey}`);
        return existingFlight;
      }
    }

    const execPromise = this.executeFetch(dateFrom, dateTo, brand);
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
    dateTo: string,
    brand: string,
  ): Promise<SalesMonitorDataDto> {
    const startedAt = Date.now();
    let queryCount = 0;
    const today = todayInVietnam();
    const activeStoreCodes = await this.storeService.getActiveStoreCodes(
      brand || 'ALL',
      'sales',
    );
    if (activeStoreCodes.size === 0) {
      this.logger.warn(
        `[SapSalesMonitorService] Brand ${brand || 'ALL'} has no active sales stores configured. Returning empty results.`,
      );
    }
    const querySnapshot = await this.queryConfigService.getSnapshot();

    // Bước 1: Chạy tuần tự 8 câu truy vấn danh sách
    const listQueries = this.queryConfigService.buildSalesListSqlMap(
      querySnapshot,
      dateFrom,
      brand,
      dateTo,
    );
    const rawListResults = {} as Record<SalesListQueryKey, SapQueryResult>;
    for (const key of SALES_LIST_ORDER) {
      const res = await this.gateway.run(`sales-list:${key}`, listQueries[key]);
      queryCount++;
      const storeIdx = res.columns.indexOf('Store');
      rawListResults[key] = {
        columns: res.columns,
        rows:
          storeIdx >= 0
            ? res.rows.filter((r) =>
                activeStoreCodes.has(String(r[storeIdx] ?? '').trim()),
              )
            : activeStoreCodes.size === 0
              ? []
              : res.rows,
      };
    }

    // Bước 2: Chạy tuần tự 5 câu truy vấn chuỗi nhóm mới
    const chainQueries = this.queryConfigService.buildSalesChainSqlMap(
      querySnapshot,
      dateFrom,
      brand,
      undefined,
      dateTo,
    );
    const chainResults = {} as Record<SalesChainQueryKey, SapQueryResult>;
    for (const key of SALES_CHAIN_ORDER) {
      const res = await this.gateway.run(
        `sales-chain:${key}`,
        chainQueries[key],
      );
      queryCount++;
      if (key === 'po') {
        const storeIdx = res.columns.indexOf('Store');
        chainResults[key] = {
          columns: res.columns,
          rows:
            storeIdx >= 0
              ? res.rows.filter((r) =>
                  activeStoreCodes.has(String(r[storeIdx] ?? '').trim()),
                )
              : activeStoreCodes.size === 0
                ? []
                : res.rows,
        };
      } else {
        chainResults[key] = res;
      }
    }

    // Bước 3: Gom PO nhóm cũ và chia lô tối đa 300 PO/lô
    const poNumIdx = chainResults.po.columns.indexOf('PO Number');
    const newPoSet = new Set<number>(
      poNumIdx >= 0
        ? chainResults.po.rows
            .map((r) => Number(r[poNumIdx]))
            .filter((n) => Number.isSafeInteger(n) && n > 0)
        : [],
    );
    const oldPos = oldCohortPoNumbers(rawListResults, newPoSet);

    for (let i = 0; i < oldPos.length; i += OLD_PO_CHUNK_SIZE) {
      const chunk = oldPos.slice(i, i + OLD_PO_CHUNK_SIZE);
      const chunkQueries = this.queryConfigService.buildSalesChainSqlMap(
        querySnapshot,
        dateFrom,
        brand,
        chunk,
        dateTo,
      );
      for (const key of SALES_CHAIN_ORDER) {
        const chunkRes = await this.gateway.run(
          `sales-chain-old:${key}:${i}`,
          chunkQueries[key],
        );
        queryCount++;
        assertBatchColumnsMatch(
          chainResults[key].columns,
          chunkRes.columns,
          `sales-chain-old:${key}:${i}`,
          this.logger,
        );
        const chunkStoreIdx =
          key === 'po' ? chunkRes.columns.indexOf('Store') : -1;
        for (const row of chunkRes.rows) {
          if (
            key === 'po' &&
            chunkStoreIdx >= 0 &&
            !activeStoreCodes.has(String(row[chunkStoreIdx] ?? '').trim())
          ) {
            continue;
          }
          chainResults[key].rows.push(row);
        }
      }
    }

    // Bước 4: Gắn Nhom và dựng chuỗi chứng từ trên tập cửa hàng active
    const listResults = tagCohort(rawListResults, dateFrom);
    const { rows: rawChainRows, columns: chainColumns } = assemblePoChain(
      chainResults,
      dateFrom,
      today,
    );
    const chainRows = rawChainRows.filter((r) =>
      activeStoreCodes.has(String(r['Store'] ?? '').trim()),
    );
    const chainTable = recordsToTable(chainColumns, chainRows);
    const { chainAr, chainGrpo } = buildChainArAndGrpo(chainResults, chainRows);
    const overviewTable = buildMonitorOverview(listResults);
    const docStatus = buildDocStatus(chainRows, chainAr, chainGrpo, today);
    const moiRows = chainRows.filter((r) => r['Nhom'] === NHOM_MOI);
    const moiAr = chainAr.filter((r) => r['Nhom'] === NHOM_MOI);
    const moiGrpo = chainGrpo.filter((r) => r.Nhom === NHOM_MOI);
    const moi = {
      funnel: buildConversionFunnel(moiRows, moiAr, moiGrpo, today),
      docStatusCounts: countDocStatusByCohort(docStatus, NHOM_MOI),
      poCount: moiRows.length,
    };

    const cuRows = chainRows.filter((r) => r['Nhom'] === NHOM_CU);
    const cuAr = chainAr.filter((r) => r['Nhom'] === NHOM_CU);
    const cuGrpo = chainGrpo.filter((r) => r.Nhom === NHOM_CU);
    const cu = {
      funnel: buildConversionFunnel(cuRows, cuAr, cuGrpo, today),
      docStatusCounts: countDocStatusByCohort(docStatus, NHOM_CU),
      poCount: cuRows.length,
    };

    const tatCa = {
      funnel: buildConversionFunnel(chainRows, chainAr, chainGrpo, today),
      docStatusCounts: countDocStatusByCohort(docStatus, null),
      poCount: chainRows.length,
    };

    const summary = buildStatusSummary(listResults);
    const lists = {
      overview: overviewTable,
      chain: chainTable,
      t1: listResults.t1,
      t2: listResults.t2,
      t3: listResults.t3,
      t4: listResults.t4,
      ar: listResults.ar,
      grpo: listResults.grpo,
      ap: listResults.ap,
    };

    const durationMs = Date.now() - startedAt;

    return {
      meta: {
        dateFrom,
        dateTo,
        brand,
        today,
        generatedAt: new Date().toISOString(),
        fromCache: false,
        queryCount,
        durationMs,
      },
      summary,
      cohorts: { moi, cu, tatCa },
      docStatus,
      lists,
    };
  }
}
