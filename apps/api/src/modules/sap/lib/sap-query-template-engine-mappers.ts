// Các hàm ánh xạ DTO, dựng kết quả Review & Validate và dựng bản đồ SQL từ Frozen Snapshot
// tách khỏi SapQueryConfigService để giữ service <= 500 dòng theo chuẩn kiến trúc Backend.
import type {
  ReviewSapQueryResultDto,
  SapQueryAuditDto,
  SapQueryDetailDto,
  SapQuerySummaryDto,
  SapQueryVersionDto,
} from '../dto/sap-query-config.dto';
import type { OpenQuerySql } from './openquery';
import type { SapQueryResult } from './sap-row-normalizer';
import {
  type ColumnDiffResult,
  type StaticValidationResult,
  computeSqlHash,
  normalizeSqlText,
  renderCatalogSql,
} from './sap-query-template-engine';
import type { ReturnListQueryKey } from '../queries/return-monitor-queries';
import type {
  SalesChainQueryKey,
  SalesListQueryKey,
} from '../queries/sales-monitor-queries';
import type { PrismaService } from '../../../prisma/prisma.service';
import {
  SAP_QUERY_CATALOG_BY_KEY,
  SAP_QUERY_CATALOG,
  SAP_RETURN_MAIN_QUERY_KEYS,
  SAP_RETURN_OLD_QUERY_KEYS,
  SAP_SALES_CHAIN_QUERY_KEYS,
  SAP_SALES_LIST_QUERY_KEYS,
  type SapQueryCatalogEntry,
  type SapQueryKey,
  type SapReturnMainCatalogKey,
  type SapReturnOldCatalogKey,
  type SapSalesChainCatalogKey,
} from '../queries/sap-query-catalog';

const PREVIEW_ROW_LIMIT = 50;

export interface SapQuerySnapshot {
  readonly epoch: number;
  readonly sqlByKey: ReadonlyMap<SapQueryKey, string>;
  readonly versionByKey: ReadonlyMap<SapQueryKey, number>;
}

export type SalesChainSqlMap = Record<
  SalesChainQueryKey | SapSalesChainCatalogKey,
  OpenQuerySql
>;

export type ReturnMainSqlMap = Record<
  ReturnListQueryKey | SapReturnMainCatalogKey,
  OpenQuerySql
>;

const SALES_CHAIN_KEY_TO_LEGACY: Record<
  SapSalesChainCatalogKey,
  SalesChainQueryKey
> = {
  chain_po: 'po',
  chain_so: 'so',
  chain_ar: 'ar',
  chain_grpo: 'grpo',
  chain_ap: 'ap',
};

const RETURN_MAIN_KEY_TO_LEGACY: Record<
  SapReturnMainCatalogKey,
  ReturnListQueryKey
> = {
  ret_po: 'po',
  ret_so: 'so',
  ret_do: 'do',
  ret_ar: 'ar',
  ret_grpo: 'grpo',
  ret_ap: 'ap',
  ret_whs: 'whs',
};

export interface SapQueryDefRowShape {
  key: string;
  flow: string;
  stage: string;
  sortOrder: number;
  title: string;
  description: string;
  impactBadges: string[];
  allowedPlaceholders: string[];
  requiredColumns: string[];
  baselineColumns: string[];
  dedupKeys: string[];
  supportsExtraColumns: boolean;
  defaultSql: string;
  currentVersionNo: number;
  lastTestedSqlHash: string | null;
  lastTestedAt: Date | null;
  lastTestedById: string | null;
  lastTestRowCount: number | null;
  lastTestDurationMs: number | null;
  updatedAt: Date;
}

export interface SapQueryDetailRowShape extends SapQueryDefRowShape {
  versions: Array<{
    id: string;
    queryKey: string;
    versionNo: number;
    sqlText: string;
    sqlHash: string;
    changeNote: string;
    createdById: string | null;
    createdBy: string | null;
    createdAt: Date;
  }>;
  audits: Array<{
    id: string;
    queryKey: string;
    action: string;
    fromVersion: number | null;
    toVersion: number | null;
    beforeSql: string | null;
    afterSql: string | null;
    changeNote: string | null;
    actorId: string | null;
    actorName: string | null;
    createdAt: Date;
  }>;
}

export function buildSalesListSqlMapFromSnapshot(
  snapshot: SapQuerySnapshot,
  dateFrom: string,
  brand: string,
): Record<SalesListQueryKey, OpenQuerySql> {
  const map = {} as Record<SalesListQueryKey, OpenQuerySql>;
  for (const key of SAP_SALES_LIST_QUERY_KEYS) {
    const sqlText =
      snapshot.sqlByKey.get(key) ?? SAP_QUERY_CATALOG_BY_KEY[key].defaultSql;
    map[key] = renderCatalogSql(sqlText, { dateFrom, brand });
  }
  return map;
}

export function buildSalesChainSqlMapFromSnapshot(
  snapshot: SapQuerySnapshot,
  dateFrom: string,
  brand: string,
  poNumbers?: readonly number[],
): SalesChainSqlMap {
  const map = {} as SalesChainSqlMap;
  for (const catalogKey of SAP_SALES_CHAIN_QUERY_KEYS) {
    const sqlText =
      snapshot.sqlByKey.get(catalogKey) ??
      SAP_QUERY_CATALOG_BY_KEY[catalogKey].defaultSql;
    const rendered = renderCatalogSql(sqlText, { dateFrom, brand, poNumbers });
    map[catalogKey] = rendered;
    map[SALES_CHAIN_KEY_TO_LEGACY[catalogKey]] = rendered;
  }
  return map;
}

export function buildReturnMainSqlMapFromSnapshot(
  snapshot: SapQuerySnapshot,
  dateFrom: string,
  brand: string,
  poNumbers?: readonly number[],
): ReturnMainSqlMap {
  const map = {} as ReturnMainSqlMap;
  for (const catalogKey of SAP_RETURN_MAIN_QUERY_KEYS) {
    const sqlText =
      snapshot.sqlByKey.get(catalogKey) ??
      SAP_QUERY_CATALOG_BY_KEY[catalogKey].defaultSql;
    const rendered = renderCatalogSql(sqlText, { dateFrom, brand, poNumbers });
    map[catalogKey] = rendered;
    map[RETURN_MAIN_KEY_TO_LEGACY[catalogKey]] = rendered;
  }
  return map;
}

export function buildReturnOldDiscoverySqlMapFromSnapshot(
  snapshot: SapQuerySnapshot,
  dateFrom: string,
  brand: string,
): Record<SapReturnOldCatalogKey, OpenQuerySql> {
  const map = {} as Record<SapReturnOldCatalogKey, OpenQuerySql>;
  for (const key of SAP_RETURN_OLD_QUERY_KEYS) {
    const sqlText =
      snapshot.sqlByKey.get(key) ?? SAP_QUERY_CATALOG_BY_KEY[key].defaultSql;
    map[key] = renderCatalogSql(sqlText, { dateFrom, brand });
  }
  return map;
}

export function toSapQuerySummaryDto(
  row: SapQueryDefRowShape,
  activeSqlByKey: ReadonlyMap<SapQueryKey, string>,
): SapQuerySummaryDto {
  const queryKey = row.key as SapQueryKey;
  const activeSql =
    activeSqlByKey.get(queryKey) ?? normalizeSqlText(row.defaultSql);
  const activeSqlHash = computeSqlHash(activeSql);
  const defaultSqlHash = computeSqlHash(row.defaultSql);

  return {
    key: row.key,
    flow: row.flow as 'ban' | 'tra',
    stage: row.stage as 'list' | 'chain' | 'main' | 'old_discovery',
    sortOrder: row.sortOrder,
    title: row.title,
    description: row.description,
    impactBadges: row.impactBadges,
    allowedPlaceholders: row.allowedPlaceholders,
    requiredColumns: row.requiredColumns,
    baselineColumns: row.baselineColumns,
    dedupKeys: row.dedupKeys,
    supportsExtraColumns: row.supportsExtraColumns,
    currentVersionNo: row.currentVersionNo,
    isCustomized: activeSqlHash !== defaultSqlHash,
    activeSqlHash,
    defaultSqlHash,
    lastTestedSqlHash: row.lastTestedSqlHash,
    lastTestedAt: row.lastTestedAt ? row.lastTestedAt.toISOString() : null,
    lastTestedById: row.lastTestedById,
    lastTestRowCount: row.lastTestRowCount,
    lastTestDurationMs: row.lastTestDurationMs,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toSapQueryDetailDto(
  row: SapQueryDetailRowShape,
  activeSqlByKey: ReadonlyMap<SapQueryKey, string>,
): SapQueryDetailDto {
  const summary = toSapQuerySummaryDto(row, activeSqlByKey);
  const activeSql =
    activeSqlByKey.get(row.key as SapQueryKey) ??
    normalizeSqlText(row.defaultSql);

  return {
    ...summary,
    activeSql,
    defaultSql: normalizeSqlText(row.defaultSql),
    versions: row.versions.map(
      (v): SapQueryVersionDto => ({
        id: v.id,
        queryKey: v.queryKey,
        versionNo: v.versionNo,
        sqlText: v.sqlText,
        sqlHash: v.sqlHash,
        changeNote: v.changeNote,
        createdById: v.createdById,
        createdBy: v.createdBy,
        createdAt: v.createdAt.toISOString(),
      }),
    ),
    audits: row.audits.map(
      (a): SapQueryAuditDto => ({
        id: a.id,
        queryKey: a.queryKey,
        action: a.action,
        fromVersion: a.fromVersion,
        toVersion: a.toVersion,
        beforeSql: a.beforeSql,
        afterSql: a.afterSql,
        changeNote: a.changeNote,
        actorId: a.actorId,
        actorName: a.actorName,
        createdAt: a.createdAt.toISOString(),
      }),
    ),
  };
}

export function buildStaticFailedReviewDto(
  entry: SapQueryCatalogEntry,
  staticRes: StaticValidationResult,
  testedAt: Date,
): ReviewSapQueryResultDto {
  return {
    valid: false,
    staticValid: false,
    executionRan: false,
    sqlHash: staticRes.sqlHash,
    worstCaseOpenQueryLength: staticRes.worstCaseOpenQueryLength,
    maxOpenQueryLength: staticRes.maxOpenQueryLength,
    detectedPlaceholders: staticRes.detectedPlaceholders,
    missingPlaceholders: staticRes.missingPlaceholders,
    unexpectedPlaceholders: staticRes.unexpectedPlaceholders,
    referencedTables: staticRes.referencedTables,
    steps: staticRes.steps,
    staticErrors: staticRes.errors,
    requiredColumns: [...entry.requiredColumns],
    baselineColumns: [...entry.baselineColumns],
    actualColumns: [],
    missingColumns: [],
    extraColumns: [],
    duplicateKeyCount: 0,
    columnChecks: [],
    warnings: [],
    semanticErrors: [],
    errors: [...staticRes.errors],
    rowCount: 0,
    durationMs: 0,
    testedAt: testedAt.toISOString(),
    previewTable: { columns: [], rows: [] },
  };
}

export function buildLiveReviewResultDto(
  staticRes: StaticValidationResult,
  colDiff: ColumnDiffResult,
  queryResult: SapQueryResult,
  allErrors: string[],
  durationMs: number,
  testedAt: Date,
): ReviewSapQueryResultDto {
  return {
    valid: staticRes.valid && colDiff.valid,
    staticValid: true,
    executionRan: true,
    sqlHash: staticRes.sqlHash,
    worstCaseOpenQueryLength: staticRes.worstCaseOpenQueryLength,
    maxOpenQueryLength: staticRes.maxOpenQueryLength,
    detectedPlaceholders: staticRes.detectedPlaceholders,
    missingPlaceholders: staticRes.missingPlaceholders,
    unexpectedPlaceholders: staticRes.unexpectedPlaceholders,
    referencedTables: staticRes.referencedTables,
    steps: staticRes.steps,
    staticErrors: [],
    requiredColumns: colDiff.requiredColumns,
    baselineColumns: colDiff.baselineColumns,
    actualColumns: colDiff.actualColumns,
    missingColumns: colDiff.missingColumns,
    extraColumns: colDiff.extraColumns,
    duplicateKeyCount: colDiff.duplicateKeyCount,
    columnChecks: colDiff.columnChecks,
    warnings: colDiff.warnings,
    semanticErrors: colDiff.semanticErrors,
    errors: allErrors,
    rowCount: queryResult.rows.length,
    durationMs,
    testedAt: testedAt.toISOString(),
    previewTable: {
      columns: queryResult.columns,
      rows: queryResult.rows.slice(0, PREVIEW_ROW_LIMIT),
    },
  };
}

export function buildCatalogMetadataPayload(
  entry: SapQueryCatalogEntry,
  normalizedDefault: string,
) {
  return {
    flow: entry.flow,
    stage: entry.stage,
    sortOrder: entry.sortOrder,
    title: entry.title,
    description: entry.description,
    impactBadges: [...entry.impactBadges],
    allowedPlaceholders: [...entry.allowedPlaceholders],
    requiredColumns: [...entry.requiredColumns],
    baselineColumns: [...entry.baselineColumns],
    dedupKeys: [...entry.dedupKeys],
    supportsExtraColumns: entry.supportsExtraColumns,
    defaultSql: normalizedDefault,
  };
}

export async function syncCatalogWithPrisma(
  prisma: PrismaService,
  activeSqlByKey: Map<SapQueryKey, string>,
  activeVersionByKey: Map<SapQueryKey, number>,
): Promise<void> {
  const existingDefs = await prisma.sapQueryDef.findMany({
    include: { versions: true },
  });
  const existingByKey = new Map(existingDefs.map((d) => [d.key, d]));

  for (const entry of SAP_QUERY_CATALOG) {
    const normalizedDefault = normalizeSqlText(entry.defaultSql);
    const defaultHash = computeSqlHash(normalizedDefault);
    const meta = buildCatalogMetadataPayload(entry, normalizedDefault);
    const existing = existingByKey.get(entry.key);

    if (!existing) {
      await prisma.sapQueryDef.create({
        data: {
          key: entry.key,
          ...meta,
          currentVersionNo: 1,
          versions: {
            create: {
              versionNo: 1,
              sqlText: normalizedDefault,
              sqlHash: defaultHash,
              changeNote: 'Khởi tạo câu truy vấn gốc chuẩn (Seed v1)',
              createdBy: 'System Seed',
            },
          },
        },
      });
      activeSqlByKey.set(entry.key, normalizedDefault);
      activeVersionByKey.set(entry.key, 1);
      continue;
    }

    await prisma.sapQueryDef.update({
      where: { key: entry.key },
      data: meta,
    });

    const activeVersion = existing.versions.find(
      (v) => v.versionNo === existing.currentVersionNo,
    );
    if (activeVersion) {
      activeSqlByKey.set(entry.key, normalizeSqlText(activeVersion.sqlText));
      activeVersionByKey.set(entry.key, existing.currentVersionNo);
    } else {
      await prisma.sapQueryVersion.upsert({
        where: { queryKey_versionNo: { queryKey: entry.key, versionNo: 1 } },
        update: {},
        create: {
          queryKey: entry.key,
          versionNo: 1,
          sqlText: normalizedDefault,
          sqlHash: defaultHash,
          changeNote: 'Khởi tạo câu truy vấn gốc chuẩn (Seed v1)',
          createdBy: 'System Seed',
        },
      });
      activeSqlByKey.set(entry.key, normalizedDefault);
      activeVersionByKey.set(entry.key, 1);
    }
  }
}
