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

export interface StageVisualMeta {
  readonly groupCode: '1A' | '1B' | '2A' | '2B';
  readonly shortLabel: string;
  readonly borderClass: string;
  readonly badgeClass: string;
  readonly dotClass: string;
}

export type SqlTokenKind = 'keyword' | 'placeholder' | 'schema' | 'string' | 'identifier' | 'text';
export interface SqlHighlightToken {
  readonly type: SqlTokenKind;
  readonly text: string;
}
export interface SqlHighlightLine {
  readonly lineNo: number;
  readonly lineLabel: string;
  readonly tokens: SqlHighlightToken[];
}

const STAGE_META: Record<
  SapQueryStageKey,
  { flow: SapQueryFlowTab; groupCode: '1A' | '1B' | '2A' | '2B'; title: string; subtitle: string; visual: StageVisualMeta }
> = {
  list: {
    flow: 'ban',
    groupCode: '1A',
    title: 'Nhóm 1A: Danh sách & Cảnh báo Treo',
    subtitle: '8 câu truy vấn cảnh báo treo T1..T4, A/R, GRPO, A/P và tổng hợp cửa hàng',
    visual: {
      groupCode: '1A',
      shortLabel: '1A · Cảnh báo & DS',
      borderClass: 'border-l-blue-600 dark:border-l-blue-400',
      badgeClass: 'border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-200',
      dotClass: 'bg-blue-600',
    },
  },
  chain: {
    flow: 'ban',
    groupCode: '1B',
    title: 'Nhóm 1B: Ghép Chuỗi PO & Phễu',
    subtitle: '5 câu truy vấn gốc ghép chuỗi PO -> SO -> A/R -> GRPO -> A/P',
    visual: {
      groupCode: '1B',
      shortLabel: '1B · Chuỗi PO & Phễu',
      borderClass: 'border-l-indigo-600 dark:border-l-indigo-400',
      badgeClass: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-800 dark:text-indigo-200',
      dotClass: 'bg-indigo-600',
    },
  },
  main: {
    flow: 'tra',
    groupCode: '2A',
    title: 'Nhóm 2A: Ghép Chuỗi SO Trả hàng & Từ điển Kho',
    subtitle: '7 câu truy vấn chuỗi SO trả -> PO trả -> DO -> A/R -> GRPO -> A/P & Kho',
    visual: {
      groupCode: '2A',
      shortLabel: '2A · Chuỗi SO Trả & Kho',
      borderClass: 'border-l-cyan-600 dark:border-l-cyan-400',
      badgeClass: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200',
      dotClass: 'bg-cyan-600',
    },
  },
  old_discovery: {
    flow: 'tra',
    groupCode: '2B',
    title: 'Nhóm 2B: Tìm SO Nhóm Cũ',
    subtitle: '5 câu truy vấn tìm SO trả phát sinh trước kỳ nhưng còn chứng từ phát sinh trong kỳ',
    visual: {
      groupCode: '2B',
      shortLabel: '2B · Tìm SO Cũ',
      borderClass: 'border-l-amber-600 dark:border-l-amber-400',
      badgeClass: 'border-amber-500/40 bg-amber-500/15 text-amber-900 dark:text-amber-200',
      dotClass: 'bg-amber-600',
    },
  },
};

export function getStageVisualMeta(stage: string): StageVisualMeta {
  if (stage === 'list' || stage === 'ban_alert') return STAGE_META.list.visual;
  if (stage === 'chain' || stage === 'ban_chain') return STAGE_META.chain.visual;
  if (stage === 'main' || stage === 'tra_main') return STAGE_META.main.visual;
  return STAGE_META.old_discovery.visual;
}

const SQL_TOKEN_REGEX =
  /(\{[A-Za-z0-9_]+\})|('[^'{}]*(?:''[^'{}]*)*')|("[^"]*")|(\b(?:maycha_live|kbmd_live)\.[A-Za-z0-9_]*)|\b(SELECT|FROM|INNER|LEFT|RIGHT|FULL|OUTER|CROSS|JOIN|ON|WHERE|AND|OR|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|UNION|ALL|AS|IN|EXISTS|NOT|IS|NULL|CASE|WHEN|THEN|ELSE|END|COUNT|SUM|MIN|MAX|AVG|COALESCE|IFNULL|NULLIF|TO_VARCHAR|TO_NVARCHAR|TO_DATE|TO_DECIMAL|TO_INTEGER|CAST|DISTINCT|WITH|ASC|DESC|BETWEEN|LIKE)\b/gi;

export function tokenizeSqlForHighlight(sqlText: string): SqlHighlightLine[] {
  return sqlText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((rawLine, idx) => {
      const tokens: SqlHighlightToken[] = [];
      let lastIdx = 0;
      SQL_TOKEN_REGEX.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = SQL_TOKEN_REGEX.exec(rawLine)) !== null) {
        if (m.index > lastIdx) tokens.push({ type: 'text', text: rawLine.slice(lastIdx, m.index) });
        const type: SqlTokenKind = m[1] ? 'placeholder' : m[2] ? 'string' : m[3] ? 'identifier' : m[4] ? 'schema' : 'keyword';
        tokens.push({ type, text: m[0] });
        lastIdx = m.index + m[0].length;
      }
      if (lastIdx < rawLine.length || tokens.length === 0) tokens.push({ type: 'text', text: rawLine.slice(lastIdx) });
      return { lineNo: idx + 1, lineLabel: String(idx + 1).padStart(2, '0'), tokens };
    });
}

export function normalizeSqlText(sql: string): string {
  return sql.replace(/\r\n/g, '\n').trim();
}

export function formatQueryOrderBadge(sortOrder: number): string {
  return `#${String(sortOrder).padStart(2, '0')}`;
}

export function countQueriesByFlow(queries: readonly SapQuerySummaryDto[]): SapQueryFlowCounts {
  let banTotal = 0, traTotal = 0, banCustomized = 0, traCustomized = 0;
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
  const stageOrder: SapQueryStageKey[] = flow === 'ban' ? ['list', 'chain'] : ['main', 'old_discovery'];
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
    .map((stage) => ({
      stage,
      groupCode: STAGE_META[stage].groupCode,
      title: STAGE_META[stage].title,
      subtitle: STAGE_META[stage].subtitle,
      items: filtered.filter((q) => q.stage === stage),
    }))
    .filter((group) => group.items.length > 0 || !keyword);
}

export function buildSampleExecutableSql(
  sqlText: string,
  sampleDate = DEFAULT_SAMPLE_DATE,
  sampleBrand = DEFAULT_SAMPLE_BRAND,
  sampleDateTo = '',
  autoDateUpper = true,
): string {
  const safeDate = /^\d{8}$/.test(sampleDate.trim()) ? sampleDate.trim() : DEFAULT_SAMPLE_DATE;
  const trimmedBrand = sampleBrand.trim();
  const isAllBrand = trimmedBrand === '' || trimmedBrand.toUpperCase() === 'ALL';
  const safeBrand = isAllBrand
    ? ''
    : /^[A-Za-z0-9_-]{1,10}$/.test(trimmedBrand)
      ? trimmedBrand
      : DEFAULT_SAMPLE_BRAND;
  const br = safeBrand
    ? `JOIN maycha_live.OWHS W ON W."WhsCode" = P."U_Store" AND W."U_Brand" = '${safeBrand}'`
    : 'JOIN maycha_live.OWHS W ON W."WhsCode" = P."U_Store"';
  const brandCond = safeBrand ? ` AND W."U_Brand" = '${safeBrand}'` : '';
  const replacements: Record<string, string> = {
    '{d}': safeDate,
    '{brand}': safeBrand,
    '{brand_cond}': brandCond,
    '{br}': br,
    '{po_filter}': `P."CardCode" = '309019' AND P."CANCELED" = 'N' AND P."DocDate" >= '${safeDate}'`,
    '{date_cond}': `S."DocDate" >= '${safeDate}'`,
  };
  const rendered = sqlText.replace(
    /\{(d|br|po_filter|brand_cond|brand|date_cond)\}/g,
    (match) => replacements[match] ?? match,
  );
  const safeDateTo = /^\d{8}$/.test(sampleDateTo.trim()) ? sampleDateTo.trim() : '';
  return autoDateUpper && safeDateTo
    ? rendered
        .split(`"DocDate" >= '${safeDate}'`)
        .join(`"DocDate" BETWEEN '${safeDate}' AND '${safeDateTo}'`)
    : rendered;
}

export function estimateOpenQueryLength(
  sqlText: string,
  sampleDate = DEFAULT_SAMPLE_DATE,
  sampleBrand = DEFAULT_SAMPLE_BRAND,
): number {
  const expanded = buildSampleExecutableSql(sqlText, sampleDate, sampleBrand);
  return `SELECT * FROM OPENQUERY(hana_mc, '${expanded.replace(/'/g, "''")}')`.length;
}

export function checkClientPlaceholders(
  sqlText: string,
  allowedPlaceholders: readonly string[],
): ClientPlaceholderCheckResult {
  const detectedPlaceholders = Array.from(new Set(sqlText.match(/\{[A-Za-z0-9_]+\}/g) ?? []));
  const allowedSet = new Set(allowedPlaceholders);
  const detectedSet = new Set(detectedPlaceholders);
  const missingPlaceholders = allowedPlaceholders.filter((p) => !detectedSet.has(p));
  const unexpectedPlaceholders = detectedPlaceholders.filter((p) => !allowedSet.has(p));
  return {
    detectedPlaceholders,
    missingPlaceholders,
    unexpectedPlaceholders,
    isComplete: missingPlaceholders.length === 0 && unexpectedPlaceholders.length === 0,
  };
}

export function computeLineDiff(originalSql: string, currentSql: string): SqlLineDiffResult {
  const normOrig = normalizeSqlText(originalSql);
  const normCurr = normalizeSqlText(currentSql);
  const origLines = normOrig ? normOrig.split('\n') : [];
  const currLines = normCurr ? normCurr.split('\n') : [];
  const m = origLines.length, n = currLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i]![j] = origLines[i] === currLines[j] ? 1 + (dp[i + 1]?.[j + 1] ?? 0) : Math.max(dp[i + 1]?.[j] ?? 0, dp[i]?.[j + 1] ?? 0);
    }
  }
  const lines: SqlDiffLine[] = [];
  let addedCount = 0, removedCount = 0, i = 0, j = 0;
  while (i < m && j < n) {
    if (origLines[i] === currLines[j]) {
      lines.push({ type: 'same', text: origLines[i]!, oldLineNo: ++i, newLineNo: ++j });
    } else if ((dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0)) {
      lines.push({ type: 'removed', text: origLines[i]!, oldLineNo: ++i });
      removedCount++;
    } else {
      lines.push({ type: 'added', text: currLines[j]!, newLineNo: ++j });
      addedCount++;
    }
  }
  while (i < m) { lines.push({ type: 'removed', text: origLines[i]!, oldLineNo: ++i }); removedCount++; }
  while (j < n) { lines.push({ type: 'added', text: currLines[j]!, newLineNo: ++j }); addedCount++; }
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
  return normalizeSqlText(currentSql) === normalizeSqlText(lastReviewedSql) && changeNote.trim().length >= 3;
}
