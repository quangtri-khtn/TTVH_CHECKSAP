import type {
  ReviewSapQueryResultDto,
  SapQuerySummaryDto,
  SapQuerySummaryDtoFlow,
  SapQuerySummaryDtoStage,
} from '@/lib/api/generated/model';

export type SapQueryFlowTab = SapQuerySummaryDtoFlow;
export type SapQueryStageKey = SapQuerySummaryDtoStage;

export const MAX_OPENQUERY_LENGTH = 7800;
export const DEFAULT_SAMPLE_DATE = '20261007';
export const DEFAULT_SAMPLE_BRAND = '5001';

export interface SapQueryStageGroup {
  readonly stage: SapQueryStageKey;
  readonly groupCode: '1A' | '1B' | '2A' | '2B';
  readonly title: string;
  readonly subtitle: string;
  readonly items: SapQuerySummaryDto[];
}

export interface SapQueryFlowCounts {
  readonly banTotal: number;
  readonly traTotal: number;
  readonly banCustomized: number;
  readonly traCustomized: number;
}

export interface ClientPlaceholderCheckResult {
  readonly detectedPlaceholders: string[];
  readonly missingPlaceholders: string[];
  readonly unexpectedPlaceholders: string[];
  readonly isComplete: boolean;
}

export interface SqlDiffLine {
  readonly type: 'same' | 'added' | 'removed';
  readonly text: string;
  readonly oldLineNo?: number;
  readonly newLineNo?: number;
}

export interface SqlLineDiffResult {
  readonly lines: SqlDiffLine[];
  readonly addedCount: number;
  readonly removedCount: number;
  readonly hasChanges: boolean;
}

const STAGE_META: Record<
  SapQueryStageKey,
  {
    flow: SapQueryFlowTab;
    groupCode: '1A' | '1B' | '2A' | '2B';
    title: string;
    subtitle: string;
  }
> = {
  list: {
    flow: 'ban',
    groupCode: '1A',
    title: 'Nhóm 1A: Danh sách & Cảnh báo Treo',
    subtitle: '8 câu truy vấn cảnh báo treo T1..T4, A/R, GRPO, A/P và tổng hợp cửa hàng',
  },
  chain: {
    flow: 'ban',
    groupCode: '1B',
    title: 'Nhóm 1B: Ghép Chuỗi PO & Phễu',
    subtitle: '5 câu truy vấn gốc ghép chuỗi PO -> SO -> A/R -> GRPO -> A/P',
  },
  main: {
    flow: 'tra',
    groupCode: '2A',
    title: 'Nhóm 2A: Ghép Chuỗi Trả hàng & Từ điển Kho',
    subtitle: '7 câu truy vấn chuỗi PO trả -> SO trả -> DO -> A/R Credit -> GRPO -> A/P Credit & Kho',
  },
  old_discovery: {
    flow: 'tra',
    groupCode: '2B',
    title: 'Nhóm 2B: Tìm Chứng từ Nhóm Cũ',
    subtitle: '5 câu truy vấn đơn lẻ tìm PO trả phát sinh trước kỳ nhưng có hoạt động trong kỳ',
  },
};

/**
 * Chuẩn hóa văn bản SQL đồng nhất 100% với backend (`sap-query-template-engine.ts:130`):
 * đổi CRLF về LF và cắt khoảng trắng hai đầu.
 */
export function normalizeSqlText(sql: string): string {
  return sql.replace(/\r\n/g, '\n').trim();
}

export function formatQueryOrderBadge(sortOrder: number): string {
  return `#${String(sortOrder).padStart(2, '0')}`;
}

export function countQueriesByFlow(
  queries: readonly SapQuerySummaryDto[],
): SapQueryFlowCounts {
  let banTotal = 0;
  let traTotal = 0;
  let banCustomized = 0;
  let traCustomized = 0;

  for (const q of queries) {
    if (q.flow === 'ban') {
      banTotal++;
      if (q.isCustomized) banCustomized++;
    } else if (q.flow === 'tra') {
      traTotal++;
      if (q.isCustomized) traCustomized++;
    }
  }

  return { banTotal, traTotal, banCustomized, traCustomized };
}

export function groupQueriesByFlowAndStage(
  queries: readonly SapQuerySummaryDto[],
  flow: SapQueryFlowTab,
  search = '',
): SapQueryStageGroup[] {
  const keyword = search.trim().toLowerCase();
  const stageOrder: SapQueryStageKey[] =
    flow === 'ban' ? ['list', 'chain'] : ['main', 'old_discovery'];

  const filtered = queries
    .filter((item) => item.flow === flow)
    .filter((item) => {
      if (!keyword) return true;
      const orderTag = formatQueryOrderBadge(item.sortOrder).toLowerCase();
      return (
        item.key.toLowerCase().includes(keyword) ||
        item.title.toLowerCase().includes(keyword) ||
        item.description.toLowerCase().includes(keyword) ||
        orderTag.includes(keyword) ||
        item.impactBadges.some((b) => b.toLowerCase().includes(keyword))
      );
    })
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return stageOrder
    .map((stage) => {
      const meta = STAGE_META[stage];
      return {
        stage,
        groupCode: meta.groupCode,
        title: meta.title,
        subtitle: meta.subtitle,
        items: filtered.filter((q) => q.stage === stage),
      };
    })
    .filter((group) => group.items.length > 0 || !keyword);
}

/**
 * Tạo bản SQL đã điền tham số mẫu để IT copy trực tiếp sang HANA Studio / DBeaver chạy thử.
 * Khớp 100% quy tắc `expandCatalogTemplate` ở backend.
 */
export function buildSampleExecutableSql(
  sqlText: string,
  sampleDate = DEFAULT_SAMPLE_DATE,
  sampleBrand = DEFAULT_SAMPLE_BRAND,
): string {
  const safeDate = /^\d{8}$/.test(sampleDate.trim())
    ? sampleDate.trim()
    : DEFAULT_SAMPLE_DATE;
  const safeBrand = /^[A-Za-z0-9_-]{1,10}$/.test(sampleBrand.trim())
    ? sampleBrand.trim()
    : DEFAULT_SAMPLE_BRAND;

  const replacements: Record<string, string> = {
    '{d}': safeDate,
    '{brand}': safeBrand,
    '{br}': `JOIN maycha_live.OWHS W ON W."WhsCode" = P."U_Store" AND W."U_Brand" = '${safeBrand}'`,
    '{po_filter}': `P."CardCode" = '309019' AND P."CANCELED" = 'N' AND P."DocDate" >= '${safeDate}'`,
    '{date_cond}': `P."DocDate" >= '${safeDate}'`,
  };

  return sqlText.replace(
    /\{(d|br|po_filter|brand|date_cond)\}/g,
    (match) => replacements[match] ?? match,
  );
}

export function estimateOpenQueryLength(
  sqlText: string,
  sampleDate = DEFAULT_SAMPLE_DATE,
  sampleBrand = DEFAULT_SAMPLE_BRAND,
): number {
  const expanded = buildSampleExecutableSql(sqlText, sampleDate, sampleBrand);
  const escaped = expanded.replace(/'/g, "''");
  return `SELECT * FROM OPENQUERY(hana_mc, '${escaped}')`.length;
}

export function checkClientPlaceholders(
  sqlText: string,
  allowedPlaceholders: readonly string[],
): ClientPlaceholderCheckResult {
  const matches = sqlText.match(/\{[A-Za-z0-9_]+\}/g) ?? [];
  const detectedPlaceholders = Array.from(new Set(matches));
  const allowedSet = new Set(allowedPlaceholders);
  const detectedSet = new Set(detectedPlaceholders);
  const missingPlaceholders = allowedPlaceholders.filter((p) => !detectedSet.has(p));
  const unexpectedPlaceholders = detectedPlaceholders.filter((p) => !allowedSet.has(p));

  return {
    detectedPlaceholders,
    missingPlaceholders,
    unexpectedPlaceholders,
    isComplete:
      missingPlaceholders.length === 0 && unexpectedPlaceholders.length === 0,
  };
}

export function computeLineDiff(
  originalSql: string,
  currentSql: string,
): SqlLineDiffResult {
  const normOrig = normalizeSqlText(originalSql);
  const normCurr = normalizeSqlText(currentSql);
  const origLines = normOrig ? normOrig.split('\n') : [];
  const currLines = normCurr ? normCurr.split('\n') : [];
  const m = origLines.length;
  const n = currLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i]![j] =
        origLines[i] === currLines[j]
          ? 1 + (dp[i + 1]?.[j + 1] ?? 0)
          : Math.max(dp[i + 1]?.[j] ?? 0, dp[i]?.[j + 1] ?? 0);
    }
  }

  const lines: SqlDiffLine[] = [];
  let addedCount = 0;
  let removedCount = 0;
  let i = 0;
  let j = 0;

  while (i < m && j < n) {
    if (origLines[i] === currLines[j]) {
      lines.push({ type: 'same', text: origLines[i]!, oldLineNo: i + 1, newLineNo: j + 1 });
      i++;
      j++;
    } else if ((dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0)) {
      lines.push({ type: 'removed', text: origLines[i]!, oldLineNo: i + 1 });
      removedCount++;
      i++;
    } else {
      lines.push({ type: 'added', text: currLines[j]!, newLineNo: j + 1 });
      addedCount++;
      j++;
    }
  }
  while (i < m) {
    lines.push({ type: 'removed', text: origLines[i]!, oldLineNo: i + 1 });
    removedCount++;
    i++;
  }
  while (j < n) {
    lines.push({ type: 'added', text: currLines[j]!, newLineNo: j + 1 });
    addedCount++;
    j++;
  }

  return { lines, addedCount, removedCount, hasChanges: addedCount > 0 || removedCount > 0 };
}

export function canPublishQuery(params: {
  reviewResult: ReviewSapQueryResultDto | null;
  currentSql: string;
  lastReviewedSql: string | null;
  changeNote: string;
}): boolean {
  const { reviewResult, currentSql, lastReviewedSql, changeNote } = params;
  if (!reviewResult?.valid || lastReviewedSql === null) return false;
  if (normalizeSqlText(currentSql) !== normalizeSqlText(lastReviewedSql)) return false;
  return changeNote.trim().length >= 3;
}
