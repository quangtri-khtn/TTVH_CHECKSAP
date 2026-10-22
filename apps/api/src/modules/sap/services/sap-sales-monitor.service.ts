// Dịch vụ điều phối truy vấn và tính toán dữ liệu cho màn hình Monitor Bán hàng (Go-live).
// Tích hợp Single-flight in-memory, TTL Cache 60 giây gắn với poolEpoch của SapQueryGatewayService,
// chia lô tối đa 300 PO cho nhóm cũ và đóng gói phản hồi 5 khóa ở root.
import { Injectable, Logger } from '@nestjs/common';
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
  tagCohort,
  todayInVietnam,
} from '../lib/sales-monitor';
import { MONITOR_DEFAULT_BRAND, MONITOR_DEFAULT_DATE } from '../lib/sap-constants';
import { assertSapBrand, assertSapDate } from '../lib/sap-query-params';
import type { SapQueryResult } from '../lib/sap-row-normalizer';
import {
  type SalesChainQueryKey,
  type SalesListQueryKey,
  buildSalesChainQueries,
  buildSalesListQueries,
} from '../queries/sales-monitor-queries';
import { SapQueryGatewayService } from './sap-query-gateway.service';

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
}

@Injectable()
export class SapSalesMonitorService {
  private readonly logger = new Logger(SapSalesMonitorService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<SalesMonitorDataDto>>();

  constructor(private readonly gateway: SapQueryGatewayService) {}

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
    const brand = query.brand ?? MONITOR_DEFAULT_BRAND;
    const refresh = Boolean(query.refresh);

    assertSapDate(dateFrom);
    assertSapBrand(brand);

    const currentEpoch = this.gateway.getPoolEpoch();
    const cacheKey = `${dateFrom}:${brand}`;
    const inFlightKey = `${currentEpoch}:${cacheKey}`;

    if (refresh) {
      this.cache.delete(cacheKey);
    } else {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        if (Date.now() < cached.expiresAt && cached.poolEpoch === currentEpoch) {
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

    const execPromise = this.executeFetch(dateFrom, brand);
    this.inFlight.set(inFlightKey, execPromise);

    try {
      const data = await execPromise;
      if (this.gateway.getPoolEpoch() === currentEpoch) {
        this.pruneCache();
        this.cache.set(cacheKey, {
          data,
          expiresAt: Date.now() + CACHE_TTL_MS,
          poolEpoch: currentEpoch,
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
    for (const [key, entry] of this.cache.entries()) {
      if (now >= entry.expiresAt || entry.poolEpoch !== currentEpoch) {
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
  ): Promise<SalesMonitorDataDto> {
    const startedAt = Date.now();
    let queryCount = 0;
    const today = todayInVietnam();

    // Bước 1: Chạy tuần tự 8 câu truy vấn danh sách
    const listQueries = buildSalesListQueries(dateFrom, brand);
    const rawListResults = {} as Record<SalesListQueryKey, SapQueryResult>;
    for (const key of SALES_LIST_ORDER) {
      rawListResults[key] = await this.gateway.run(
        `sales-list:${key}`,
        listQueries[key],
      );
      queryCount++;
    }

    // Bước 2: Chạy tuần tự 5 câu truy vấn chuỗi nhóm mới
    const chainQueries = buildSalesChainQueries(dateFrom, brand);
    const chainResults = {} as Record<SalesChainQueryKey, SapQueryResult>;
    for (const key of SALES_CHAIN_ORDER) {
      chainResults[key] = await this.gateway.run(
        `sales-chain:${key}`,
        chainQueries[key],
      );
      queryCount++;
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
      const chunkQueries = buildSalesChainQueries(dateFrom, brand, chunk);
      for (const key of SALES_CHAIN_ORDER) {
        const chunkRes = await this.gateway.run(
          `sales-chain-old:${key}:${i}`,
          chunkQueries[key],
        );
        queryCount++;
        for (const row of chunkRes.rows) {
          chainResults[key].rows.push(row);
        }
      }
    }

    // Bước 4: Gọi các hàm Pure Domain Logic từ Phase 1
    const listResults = tagCohort(rawListResults, dateFrom);
    const { table: chainTable, rows: chainRows } = assemblePoChain(
      chainResults,
      dateFrom,
      today,
    );
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
