import type {
  ReviewSapQueryResultDto,
  SapQuerySummaryDto,
} from '@/lib/api/generated/model';
import {
  buildSampleExecutableSql,
  canPublishQuery,
  checkClientPlaceholders,
  computeLineDiff,
  countQueriesByFlow,
  formatQueryOrderBadge,
  getStageVisualMeta,
  groupQueriesByFlowAndStage,
  normalizeSqlText,
  tokenizeSqlForHighlight,
} from './sap-query-domain';

const MOCK_QUERIES: SapQuerySummaryDto[] = [
  {
    key: 'funnel',
    flow: 'ban',
    stage: 'list',
    sortOrder: 1,
    title: '#01 · Tổng hợp PO & SO theo Cửa hàng',
    description: 'Đếm tổng PO và SO theo cửa hàng',
    impactBadges: ['Bảng Tổng hợp Cửa hàng'],
    allowedPlaceholders: ['{d}', '{br}'],
    requiredColumns: ['Store', 'Ten cua hang', 'PO', 'SO'],
    baselineColumns: ['Store', 'Ten cua hang', 'PO', 'SO'],
    dedupKeys: ['Store'],
    supportsExtraColumns: false,
    currentVersionNo: 1,
    isCustomized: false,
    activeSqlHash: 'h1',
    defaultSqlHash: 'h1',
    updatedAt: '2026-10-29T00:00:00.000Z',
  },
  {
    key: 'chain_po',
    flow: 'ban',
    stage: 'chain',
    sortOrder: 9,
    title: '#09 · Chuỗi PO Gốc (OPOR/POR1)',
    description: 'Lấy danh sách PO gốc để ghép chuỗi',
    impactBadges: ['Bảng Chi tiết theo PO'],
    allowedPlaceholders: ['{br}', '{po_filter}'],
    requiredColumns: ['PO Number', 'DocDate'],
    baselineColumns: ['PO DocEntry', 'PO Number', 'DocDate'],
    dedupKeys: ['PO Number'],
    supportsExtraColumns: true,
    currentVersionNo: 2,
    isCustomized: true,
    activeSqlHash: 'h2',
    defaultSqlHash: 'h1',
    updatedAt: '2026-10-29T01:00:00.000Z',
  },
  {
    key: 'ret_po',
    flow: 'tra',
    stage: 'main',
    sortOrder: 14,
    title: '#14 · Đơn PO Trả hàng Gốc',
    description: 'Lấy danh sách PO trả hàng',
    impactBadges: ['Bảng Chi tiết Chuỗi Trả'],
    allowedPlaceholders: ['{brand}', '{date_cond}'],
    requiredColumns: ['PO Number'],
    baselineColumns: ['PO Number', 'Kho PO min', 'Kho PO max'],
    dedupKeys: ['PO Number'],
    supportsExtraColumns: true,
    currentVersionNo: 1,
    isCustomized: false,
    activeSqlHash: 'h3',
    defaultSqlHash: 'h3',
    updatedAt: '2026-10-29T00:00:00.000Z',
  },
  {
    key: 'ret_old_1',
    flow: 'tra',
    stage: 'old_discovery',
    sortOrder: 21,
    title: '#21 · Tìm PO Cũ — Nhánh 1 (SO Trả trong kỳ)',
    description: 'Tìm PO trả phát sinh trước kỳ nhưng có SO trả trong kỳ',
    impactBadges: ['Nhóm Cũ Luồng Trả'],
    allowedPlaceholders: ['{d}', '{brand}'],
    requiredColumns: ['PO Number'],
    baselineColumns: ['PO Number'],
    dedupKeys: [],
    supportsExtraColumns: false,
    currentVersionNo: 3,
    isCustomized: true,
    activeSqlHash: 'h4',
    defaultSqlHash: 'h0',
    updatedAt: '2026-10-29T02:00:00.000Z',
  },
];

describe('sap-query-domain', () => {
  describe('normalizeSqlText', () => {
    it('chuẩn hóa CRLF về LF và cắt khoảng trắng hai đầu khớp với backend', () => {
      const raw = '  \r\nSELECT "DocNum"\r\nFROM maycha_live.OPOR P\r\n  ';
      expect(normalizeSqlText(raw)).toBe('SELECT "DocNum"\nFROM maycha_live.OPOR P');
      expect(normalizeSqlText(raw)).toBe(normalizeSqlText('SELECT "DocNum"\nFROM maycha_live.OPOR P\n'));
    });
  });

  describe('groupQueriesByFlowAndStage & countQueriesByFlow', () => {
    it('chia đúng nhóm 1A/1B cho Luồng Bán và 2A/2B cho Luồng Trả, hỗ trợ lọc từ khóa', () => {
      expect(countQueriesByFlow(MOCK_QUERIES)).toEqual({
        banTotal: 2,
        traTotal: 2,
        banCustomized: 1,
        traCustomized: 1,
      });

      const banGroups = groupQueriesByFlowAndStage(MOCK_QUERIES, 'ban');
      expect(banGroups).toHaveLength(2);
      expect(banGroups[0]?.groupCode).toBe('1A');
      expect(banGroups[0]?.items.map((i) => i.key)).toEqual(['funnel']);
      expect(banGroups[1]?.groupCode).toBe('1B');
      expect(banGroups[1]?.items.map((i) => i.key)).toEqual(['chain_po']);

      const traFiltered = groupQueriesByFlowAndStage(MOCK_QUERIES, 'tra', '#21');
      expect(traFiltered).toHaveLength(1);
      expect(traFiltered[0]?.groupCode).toBe('2B');
      expect(traFiltered[0]?.items.map((i) => i.key)).toEqual(['ret_old_1']);
      expect(formatQueryOrderBadge(1)).toBe('#01');
    });
  });

  describe('buildSampleExecutableSql', () => {
    it('thay thế đúng 5 biến runtime {d}, {brand}, {br}, {po_filter}, {date_cond} và giữ nguyên dấu < cho ret_old_1..5', () => {
      const salesSql = 'SELECT * FROM maycha_live.OPOR P {br} WHERE {po_filter} AND P."DocDate" >= \'{d}\'';
      const expandedSales = buildSampleExecutableSql(salesSql, '20261007', '5001');
      expect(expandedSales).toContain(
        'JOIN maycha_live.OWHS W ON W."WhsCode" = P."U_Store" AND W."U_Brand" = \'5001\'',
      );
      expect(expandedSales).toContain(
        'P."CardCode" = \'309019\' AND P."CANCELED" = \'N\' AND P."DocDate" >= \'20261007\'',
      );

      const retMainSql = 'SELECT * FROM maycha_live.OPOR P WHERE W."U_Brand" = \'{brand}\' AND {date_cond}';
      expect(buildSampleExecutableSql(retMainSql, '20261007', '5001')).toBe(
        'SELECT * FROM maycha_live.OPOR P WHERE W."U_Brand" = \'5001\' AND P."DocDate" >= \'20261007\'',
      );

      const retOldSql =
        'SELECT DISTINCT P."DocNum" AS "PO Number" FROM maycha_live.OPOR P WHERE W."U_Brand" = \'{brand}\' AND P."DocDate" < \'{d}\' AND S."DocDate" >= \'{d}\'';
      expect(buildSampleExecutableSql(retOldSql, '20261007', '5001')).toBe(
        'SELECT DISTINCT P."DocNum" AS "PO Number" FROM maycha_live.OPOR P WHERE W."U_Brand" = \'5001\' AND P."DocDate" < \'20261007\' AND S."DocDate" >= \'20261007\'',
      );
    });
  });

  describe('checkClientPlaceholders', () => {
    it('phát hiện biến bị thiếu hoặc biến lạ ngoài danh sách cho phép', () => {
      const ok = checkClientPlaceholders('SELECT * FROM maycha_live.OPOR P {br} WHERE P."DocDate" >= \'{d}\'', [
        '{d}',
        '{br}',
      ]);
      expect(ok.isComplete).toBe(true);
      expect(ok.missingPlaceholders).toEqual([]);
      expect(ok.unexpectedPlaceholders).toEqual([]);

      const bad = checkClientPlaceholders('SELECT * FROM maycha_live.OPOR P WHERE {unknown_var}', ['{d}', '{br}']);
      expect(bad.isComplete).toBe(false);
      expect(bad.missingPlaceholders).toEqual(['{d}', '{br}']);
      expect(bad.unexpectedPlaceholders).toEqual(['{unknown_var}']);
    });
  });

  describe('computeLineDiff & canPublishQuery', () => {
    it('tính chính xác dòng thêm/xóa và kiểm tra khóa an toàn nút Xuất bản', () => {
      const diff = computeLineDiff(
        'SELECT "A",\n"B"\nFROM maycha_live.OPOR',
        'SELECT "A",\n"B",\n"U_Extra"\nFROM maycha_live.OPOR',
      );
      expect(diff.hasChanges).toBe(true);
      expect(diff.addedCount).toBe(2);
      expect(diff.removedCount).toBe(1);

      const mockReview: ReviewSapQueryResultDto = {
        valid: true,
        staticValid: true,
        executionRan: true,
        sqlHash: 'hash',
        worstCaseOpenQueryLength: 500,
        maxOpenQueryLength: 7800,
        detectedPlaceholders: ['{d}'],
        missingPlaceholders: [],
        unexpectedPlaceholders: [],
        referencedTables: ['maycha_live.OPOR'],
        steps: {
          placeholdersOk: true,
          readOnlySelectOk: true,
          allowedTablesOk: true,
          openQueryLengthOk: true,
        },
        staticErrors: [],
        requiredColumns: ['PO Number'],
        baselineColumns: ['PO Number'],
        actualColumns: ['PO Number'],
        missingColumns: [],
        extraColumns: [],
        duplicateKeyCount: 0,
        columnChecks: [],
        warnings: [],
        semanticErrors: [],
        errors: [],
        rowCount: 1,
        durationMs: 25,
        testedAt: '2026-10-29T00:00:00.000Z',
        previewTable: { columns: ['PO Number'], rows: [[1001]] },
      };

      expect(
        canPublishQuery({
          reviewResult: mockReview,
          currentSql: 'SELECT 1\r\n',
          lastReviewedSql: '  SELECT 1 ',
          changeNote: 'Thêm cột UDF',
        }),
      ).toBe(true);

      expect(
        canPublishQuery({
          reviewResult: mockReview,
          currentSql: 'SELECT 2',
          lastReviewedSql: 'SELECT 1',
          changeNote: 'Thêm cột UDF',
        }),
      ).toBe(false);

      expect(
        canPublishQuery({
          reviewResult: mockReview,
          currentSql: 'SELECT 1',
          lastReviewedSql: 'SELECT 1',
          changeNote: 'ab',
        }),
      ).toBe(false);
    });
  });

  describe('getStageVisualMeta & tokenizeSqlForHighlight', () => {
    it('trả về đúng nhãn nhóm và màu sắc ngữ nghĩa cho 1A, 1B, 2A, 2B', () => {
      expect(getStageVisualMeta('list').groupCode).toBe('1A');
      expect(getStageVisualMeta('ban_alert').groupCode).toBe('1A');
      expect(getStageVisualMeta('chain').groupCode).toBe('1B');
      expect(getStageVisualMeta('ban_chain').groupCode).toBe('1B');
      expect(getStageVisualMeta('main').groupCode).toBe('2A');
      expect(getStageVisualMeta('tra_main').groupCode).toBe('2A');
      expect(getStageVisualMeta('old_discovery').groupCode).toBe('2B');
      expect(getStageVisualMeta('tra_old').groupCode).toBe('2B');
    });

    it('tokenizeSqlForHighlight tách dòng, keyword, schema, identifier, string và placeholder bảo toàn 100% chuỗi gốc', () => {
      const sample =
        'SELECT DISTINCT P."DocNum" AS "PO Number"\r\nFROM maycha_live.OPOR P {br}\r\nWHERE {po_filter} AND P."DocDate" >= \'{d}\'';
      const lines = tokenizeSqlForHighlight(sample);
      expect(lines).toHaveLength(3);
      expect(lines.map((l) => l.lineLabel)).toEqual(['01', '02', '03']);

      const allTokens = lines.flatMap((l) => l.tokens);
      expect(allTokens.filter((t) => t.type === 'placeholder').map((t) => t.text)).toEqual([
        '{br}',
        '{po_filter}',
        '{d}',
      ]);
      expect(allTokens.filter((t) => t.type === 'schema').map((t) => t.text)).toEqual(['maycha_live.OPOR']);
      expect(allTokens.filter((t) => t.type === 'identifier').map((t) => t.text)).toEqual([
        '"DocNum"',
        '"PO Number"',
        '"DocDate"',
      ]);
      expect(allTokens.filter((t) => t.type === 'keyword').map((t) => t.text)).toEqual([
        'SELECT',
        'DISTINCT',
        'AS',
        'FROM',
        'WHERE',
        'AND',
      ]);

      const reconstructed = lines.map((l) => l.tokens.map((t) => t.text).join('')).join('\n');
      expect(reconstructed).toBe(sample.replace(/\r\n/g, '\n'));
    });
  });
});
