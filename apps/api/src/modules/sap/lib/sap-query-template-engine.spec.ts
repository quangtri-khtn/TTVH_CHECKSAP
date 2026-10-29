import { BadRequestException } from '@nestjs/common';
import {
  SAP_QUERY_CATALOG,
  SAP_QUERY_CATALOG_BY_KEY,
  SAP_RETURN_MAIN_QUERY_KEYS,
  SAP_RETURN_OLD_QUERY_KEYS,
  SAP_SALES_CHAIN_QUERY_KEYS,
  SAP_SALES_LIST_QUERY_KEYS,
} from '../queries/sap-query-catalog';
import {
  buildReturnQueries,
  type ReturnListQueryKey,
} from '../queries/return-monitor-queries';
import {
  buildSalesChainQueries,
  buildSalesListQueries,
  type SalesChainQueryKey,
  type SalesListQueryKey,
} from '../queries/sales-monitor-queries';
import {
  OPENQUERY_SAFE_MAX_LENGTH,
  compareQueryColumns,
  computeSqlHash,
  normalizeSqlText,
  renderCatalogSql,
  validateQueryStatic,
} from './sap-query-template-engine';

describe('sap-query-template-engine', () => {
  describe('normalizeSqlText & computeSqlHash', () => {
    it('normalizes CRLF to LF and trims leading/trailing whitespace consistently', () => {
      const a = '  SELECT "Store"\r\nFROM maycha_live.OPOR  \r\n';
      const b = 'SELECT "Store"\nFROM maycha_live.OPOR';

      expect(normalizeSqlText(a)).toBe(b);
      expect(computeSqlHash(a)).toBe(computeSqlHash(b));
      expect(computeSqlHash(a)).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('renderCatalogSql', () => {
    it('expands all 25 catalog entries identically to legacy query builders', () => {
      const dateFrom = '20261007';
      const brand = '5001';
      const poNumbers = [1001, 1002];

      const salesListOracle = buildSalesListQueries(dateFrom, brand);
      for (const key of SAP_SALES_LIST_QUERY_KEYS) {
        const entry = SAP_QUERY_CATALOG_BY_KEY[key];
        expect(renderCatalogSql(entry.defaultSql, { dateFrom, brand })).toBe(
          salesListOracle[key as SalesListQueryKey],
        );
      }

      const salesChainOracle = buildSalesChainQueries(dateFrom, brand, poNumbers);
      const salesChainMap: Record<
        (typeof SAP_SALES_CHAIN_QUERY_KEYS)[number],
        SalesChainQueryKey
      > = {
        chain_po: 'po',
        chain_so: 'so',
        chain_ar: 'ar',
        chain_grpo: 'grpo',
        chain_ap: 'ap',
      };
      for (const key of SAP_SALES_CHAIN_QUERY_KEYS) {
        const entry = SAP_QUERY_CATALOG_BY_KEY[key];
        expect(
          renderCatalogSql(entry.defaultSql, { dateFrom, brand, poNumbers }),
        ).toBe(salesChainOracle[salesChainMap[key]]);
      }

      const returnMainOracle = buildReturnQueries(dateFrom, brand, {
        poNumbers,
      });
      const returnMainMap: Record<
        (typeof SAP_RETURN_MAIN_QUERY_KEYS)[number],
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
      for (const key of SAP_RETURN_MAIN_QUERY_KEYS) {
        const entry = SAP_QUERY_CATALOG_BY_KEY[key];
        expect(
          renderCatalogSql(entry.defaultSql, { dateFrom, brand, poNumbers }),
        ).toBe(returnMainOracle[returnMainMap[key]]);
      }

      for (const key of SAP_RETURN_OLD_QUERY_KEYS) {
        const entry = SAP_QUERY_CATALOG_BY_KEY[key];
        const rendered = renderCatalogSql(entry.defaultSql, { dateFrom, brand });
        expect(rendered).toContain("select * from openquery(hana_mc, '");
        expect(rendered).toContain('P."DocDate" < \'\'20261007\'\'');
      }
    });

    it('expands brand=ALL safely across Sales ({br}) and all 6 Return ({brand}) queries, and fails closed on unsupported {brand} patterns', () => {
      const dateFrom = '20261007';
      for (const key of SAP_SALES_LIST_QUERY_KEYS) {
        const rendered = renderCatalogSql(SAP_QUERY_CATALOG_BY_KEY[key].defaultSql, {
          dateFrom,
          brand: 'ALL',
        });
        expect(rendered).toContain('W."U_Brand" IS NOT NULL');
        expect(rendered).not.toContain("''ALL''");
      }

      for (const key of ['ret_po', ...SAP_RETURN_OLD_QUERY_KEYS] as const) {
        const rendered = renderCatalogSql(SAP_QUERY_CATALOG_BY_KEY[key].defaultSql, {
          dateFrom,
          brand: 'ALL',
        });
        expect(rendered).toContain('W."U_Brand" IS NOT NULL');
        expect(rendered).not.toContain('{brand}');
        expect(rendered).not.toContain("''ALL''");
      }

      expect(() =>
        renderCatalogSql(
          `SELECT P."DocNum" FROM kbmd_live.OPOR P LEFT JOIN maycha_live.OWHS W ON W."WhsCode" = 'MC01' WHERE W."U_Brand" IN ('{brand}')`,
          { dateFrom, brand: 'ALL' },
        ),
      ).toThrow(BadRequestException);
    });

    it('rejects invalid dateFrom, brand (SQL injection attempt), or empty/negative poNumbers', () => {
      const sql = SAP_QUERY_CATALOG_BY_KEY.t1.defaultSql;

      expect(() =>
        renderCatalogSql(sql, { dateFrom: '2026-10-07', brand: '5001' }),
      ).toThrow(BadRequestException);

      expect(() =>
        renderCatalogSql(sql, {
          dateFrom: '20261007',
          brand: "5001' OR '1'='1",
        }),
      ).toThrow(BadRequestException);

      expect(() =>
        renderCatalogSql(sql, {
          dateFrom: '20261007',
          brand: '5001',
          poNumbers: [],
        }),
      ).toThrow(BadRequestException);

      expect(() =>
        renderCatalogSql(sql, {
          dateFrom: '20261007',
          brand: '5001',
          poNumbers: [-10],
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('validateQueryStatic', () => {
    it('passes all 25 seed v1 queries in SAP_QUERY_CATALOG with 0 errors', () => {
      for (const entry of SAP_QUERY_CATALOG) {
        const res = validateQueryStatic(entry, entry.defaultSql);
        expect({ key: entry.key, valid: res.valid, errors: res.errors }).toEqual({
          key: entry.key,
          valid: true,
          errors: [],
        });
        expect(res.steps).toEqual({
          placeholdersOk: true,
          readOnlySelectOk: true,
          allowedTablesOk: true,
          openQueryLengthOk: true,
        });
        expect(res.worstCaseOpenQueryLength).toBeLessThanOrEqual(
          OPENQUERY_SAFE_MAX_LENGTH,
        );
        expect(res.referencedTables.length).toBeGreaterThan(0);
      }
    });

    it('allows double-quoted column aliases containing keywords like "Ngay Update" or "Delete Flag" and REPLACE() function', () => {
      const entry = SAP_QUERY_CATALOG_BY_KEY.t1;
      const sqlWithAliases = `${entry.defaultSql.replace(
        'SELECT P."U_Store" AS "Store",',
        'SELECT P."U_Store" AS "Store", REPLACE(P."Comments", \'DELETE\', \'OK\') AS "Ngay Update",',
      )}`;

      const res = validateQueryStatic(entry, sqlWithAliases);
      expect(res.valid).toBe(true);
      expect(res.errors).toEqual([]);
    });

    it('blocks missing required placeholders or unexpected placeholders on raw SQL before stripping strings', () => {
      const chainPo = SAP_QUERY_CATALOG_BY_KEY.chain_po;
      const missingPoFilter = chainPo.defaultSql.replace('{po_filter}', '1 = 1');

      const resMissing = validateQueryStatic(chainPo, missingPoFilter);
      expect(resMissing.valid).toBe(false);
      expect(resMissing.steps.placeholdersOk).toBe(false);
      expect(resMissing.missingPlaceholders).toContain('{po_filter}');

      const unexpectedVar = `${chainPo.defaultSql} AND P."Comments" = '{evil_var}'`;
      const resUnexpected = validateQueryStatic(chainPo, unexpectedVar);
      expect(resUnexpected.valid).toBe(false);
      expect(resUnexpected.steps.placeholdersOk).toBe(false);
      expect(resUnexpected.unexpectedPlaceholders).toContain('{evil_var}');
    });

    it('blocks SQL injection attempts: semicolons, DML/DDL keywords, and comments (-- or /* */)', () => {
      const t1 = SAP_QUERY_CATALOG_BY_KEY.t1;

      const withSemicolonDrop = `${t1.defaultSql}; DROP TABLE maycha_live.OPOR`;
      const resDrop = validateQueryStatic(t1, withSemicolonDrop);
      expect(resDrop.valid).toBe(false);
      expect(resDrop.steps.readOnlySelectOk).toBe(false);

      const withUpdate = `UPDATE maycha_live.OPOR P SET P."Comments" = '{d}' FROM maycha_live.OPOR P {br}`;
      const resUpdate = validateQueryStatic(t1, withUpdate);
      expect(resUpdate.valid).toBe(false);
      expect(resUpdate.steps.readOnlySelectOk).toBe(false);

      const withLineComment = `${t1.defaultSql}\n-- comment injection`;
      const resLineComment = validateQueryStatic(t1, withLineComment);
      expect(resLineComment.valid).toBe(false);
      expect(resLineComment.steps.readOnlySelectOk).toBe(false);

      const withBlockComment = `/* header */ ${t1.defaultSql}`;
      const resBlockComment = validateQueryStatic(t1, withBlockComment);
      expect(resBlockComment.valid).toBe(false);
      expect(resBlockComment.steps.readOnlySelectOk).toBe(false);
    });

    it('blocks tables outside maycha_live / kbmd_live (e.g. USERS, M_CONNECTIONS, DUMMY, SYS.USERS, comma-join)', () => {
      const retWhs = SAP_QUERY_CATALOG_BY_KEY.ret_whs;

      const unqualifiedTable = `SELECT 'T' AS "DB", "WhsCode", "WhsName" FROM M_CONNECTIONS`;
      const resUnqualified = validateQueryStatic(retWhs, unqualifiedTable);
      expect(resUnqualified.valid).toBe(false);
      expect(resUnqualified.steps.allowedTablesOk).toBe(false);

      const sysSchemaTable = `SELECT 'T' AS "DB", "WhsCode", "WhsName" FROM "SYS"."USERS"`;
      const resSys = validateQueryStatic(retWhs, sysSchemaTable);
      expect(resSys.valid).toBe(false);
      expect(resSys.steps.allowedTablesOk).toBe(false);

      const dummyTable = `SELECT 'T' AS "DB", "WhsCode", "WhsName" FROM maycha_live.OWHS JOIN DUMMY ON 1 = 1`;
      const resDummy = validateQueryStatic(retWhs, dummyTable);
      expect(resDummy.valid).toBe(false);
      expect(resDummy.steps.allowedTablesOk).toBe(false);

      const commaJoinEvil = `SELECT 'T' AS "DB", W."WhsCode", W."WhsName" FROM maycha_live.OWHS W, SYS.USERS U`;
      const resComma = validateQueryStatic(retWhs, commaJoinEvil);
      expect(resComma.valid).toBe(false);
      expect(resComma.steps.allowedTablesOk).toBe(false);

      const subqueryCommaEvil = `SELECT W."WhsCode", W."WhsName" FROM (SELECT * FROM maycha_live.OWHS) W, SYS.USERS U`;
      const resSubqueryComma = validateQueryStatic(retWhs, subqueryCommaEvil);
      expect(resSubqueryComma.valid).toBe(false);
      expect(resSubqueryComma.steps.allowedTablesOk).toBe(false);

      const joinThenCommaEvil = `SELECT W."WhsCode", W."WhsName" FROM maycha_live.OWHS W JOIN kbmd_live.OWHS K ON K."WhsCode" = W."WhsCode", SYS.USERS U`;
      const resJoinComma = validateQueryStatic(retWhs, joinThenCommaEvil);
      expect(resJoinComma.valid).toBe(false);
      expect(resJoinComma.steps.allowedTablesOk).toBe(false);
    });

    it('blocks queries exceeding 7800 characters inside OPENQUERY under worst-case 300-PO expansion', () => {
      const chainPo = SAP_QUERY_CATALOG_BY_KEY.chain_po;
      const overLengthSql = chainPo.defaultSql.replace(
        '\nGROUP BY',
        `\nAND P."Comments" <> '${'A'.repeat(6000)}'\nGROUP BY`,
      );

      const res = validateQueryStatic(chainPo, overLengthSql);
      expect(res.valid).toBe(false);
      expect(res.steps.openQueryLengthOk).toBe(false);
      expect(res.worstCaseOpenQueryLength).toBeGreaterThan(
        OPENQUERY_SAFE_MAX_LENGTH,
      );
      expect(res.errors.join(' ')).toContain('7800');
    });
  });

  describe('compareQueryColumns', () => {
    it('detects missing required columns and extra columns relative to baselineColumns (hiding internal PO DocEntry)', () => {
      const chainPo = SAP_QUERY_CATALOG_BY_KEY.chain_po;

      // Exact v1 baseline columns (includes PO DocEntry) -> 0 missing, 0 extra
      const baselineRes = compareQueryColumns(
        chainPo,
        chainPo.baselineColumns,
        [['MC001', 1001, 501, '2026-10-07', '2026-10-07', 'O', 2, 10]],
      );
      expect(baselineRes.valid).toBe(true);
      expect(baselineRes.missingColumns).toEqual([]);
      expect(baselineRes.extraColumns).toEqual([]);
      expect(baselineRes.duplicateKeyCount).toBe(0);

      // Adding a new UDF column on a passthrough-enabled query -> valid: true, extraColumns: ['U_GhiChu']
      const withExtraRes = compareQueryColumns(
        chainPo,
        [...chainPo.baselineColumns, 'U_GhiChu'],
        [['MC001', 1001, 501, '2026-10-07', '2026-10-07', 'O', 2, 10, 'Test']],
      );
      expect(withExtraRes.valid).toBe(true);
      expect(withExtraRes.extraColumns).toEqual(['U_GhiChu']);

      // Missing required column 'PO Number' -> valid: false
      const missingPoNum = compareQueryColumns(
        chainPo,
        chainPo.baselineColumns.filter((c) => c !== 'PO Number'),
        [],
      );
      expect(missingPoNum.valid).toBe(false);
      expect(missingPoNum.missingColumns).toEqual(['PO Number']);
    });

    it('blocks extra columns when entry.supportsExtraColumns is false', () => {
      const funnel = SAP_QUERY_CATALOG_BY_KEY.funnel;
      expect(funnel.supportsExtraColumns).toBe(false);

      const res = compareQueryColumns(
        funnel,
        [...funnel.baselineColumns, 'ExtraCol'],
        [['MC001', 'Cua hang 1', 10, 10, 'extra']],
      );
      expect(res.valid).toBe(false);
      expect(res.extraColumns).toEqual(['ExtraCol']);
      expect(res.semanticErrors.length).toBeGreaterThan(0);
    });

    it('counts duplicate keys using entry.dedupKeys and validates Ghi chu ShipDate prefix on t2/t3', () => {
      const t2 = SAP_QUERY_CATALOG_BY_KEY.t2;

      const dupRows = [
        [
          'MC001',
          2001,
          1001,
          '2026-10-07',
          '2026-10-07',
          'Khong',
          '2026-10-07',
          '2026-10-08',
          'Da den/qua ShipDate - chua co A/R, can kiem tra',
          2,
          1,
        ],
        [
          'MC001',
          2001,
          1001,
          '2026-10-07',
          '2026-10-07',
          'Khong',
          '2026-10-07',
          '2026-10-08',
          'Chua den ShipDate - chua den ngay xuat hang (binh thuong)',
          2,
          1,
        ],
      ];

      const resDup = compareQueryColumns(t2, t2.baselineColumns, dupRows);
      expect(resDup.valid).toBe(true);
      expect(resDup.duplicateKeyCount).toBe(1);
      expect(resDup.warnings.length).toBe(1);

      const badShipDateRow = [
        [
          'MC001',
          2001,
          1001,
          '2026-10-07',
          '2026-10-07',
          'Khong',
          '2026-10-07',
          '2026-10-08',
          'Qua han giao hang', // sai tien to 'Da den' / 'Chua den'
          2,
          1,
        ],
      ];
      const resBadSemantic = compareQueryColumns(
        t2,
        t2.baselineColumns,
        badShipDateRow,
      );
      expect(resBadSemantic.valid).toBe(false);
      expect(resBadSemantic.semanticErrors[0]).toContain('Ghi chu ShipDate');
    });
  });
});
