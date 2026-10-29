import { wrapOpenquery } from '../lib/openquery';
import { SALES_PO_VENDOR_CODE } from '../lib/sap-constants';
import { applyDateTo } from '../lib/sap-query-params';
import {
  buildReturnQueries,
  type ReturnCandidatesQueryKey,
  type ReturnListQueryKey,
} from './return-monitor-queries';
import {
  buildSalesChainQueries,
  buildSalesListQueries,
  type SalesChainQueryKey,
  type SalesListQueryKey,
} from './sales-monitor-queries';
import {
  SAP_QUERY_CATALOG,
  SAP_QUERY_CATALOG_BY_KEY,
  SAP_RETURN_MAIN_QUERY_KEYS,
  SAP_RETURN_OLD_QUERY_KEYS,
  SAP_SALES_CHAIN_QUERY_KEYS,
  SAP_SALES_LIST_QUERY_KEYS,
  getSapQueryCatalogEntry,
  isSapQueryKey,
  type SapQueryCatalogEntry,
} from './sap-query-catalog';

function expandTemplate(
  entry: SapQueryCatalogEntry,
  opts: {
    readonly dateFrom: string;
    readonly dateTo?: string;
    readonly brand?: string;
    readonly docNumbers?: readonly number[];
  },
): string {
  const { dateFrom, dateTo, brand = '', docNumbers } = opts;
  const normalizedBrand =
    brand.trim().toUpperCase() === 'ALL' ? '' : brand.trim();
  const br = normalizedBrand
    ? `JOIN maycha_live.OWHS W ON W."WhsCode" = P."U_Store" AND W."U_Brand" = '${normalizedBrand}'`
    : `JOIN maycha_live.OWHS W ON W."WhsCode" = P."U_Store"`;
  const brandCond = normalizedBrand
    ? ` AND W."U_Brand" = '${normalizedBrand}'`
    : '';
  const poFilter =
    docNumbers !== undefined
      ? `P."CardCode" = '${SALES_PO_VENDOR_CODE}' AND P."CANCELED" = 'N' AND P."DocNum" IN (${docNumbers.join(', ')})`
      : `P."CardCode" = '${SALES_PO_VENDOR_CODE}' AND P."CANCELED" = 'N' AND P."DocDate" >= '${dateFrom}'`;
  const dateCond =
    docNumbers !== undefined
      ? `S."DocNum" IN (${docNumbers.join(', ')})`
      : `S."DocDate" >= '${dateFrom}'`;

  const replacements: Record<string, string> = {
    '{d}': dateFrom,
    '{br}': br,
    '{po_filter}': poFilter,
    '{brand_cond}': brandCond,
    '{date_cond}': dateCond,
  };

  const rendered = entry.defaultSql.replace(
    /\{(d|br|po_filter|brand_cond|date_cond)\}/g,
    (match) => replacements[match] ?? match,
  );

  return entry.autoDateUpper && docNumbers === undefined && dateTo
    ? applyDateTo(rendered, dateFrom, dateTo)
    : rendered;
}
describe('SAP_QUERY_CATALOG', () => {
  it('defines exactly 25 queries split into 13 sales (ban) and 12 return (tra) sorted 1..25', () => {
    expect(SAP_QUERY_CATALOG).toHaveLength(25);
    expect(SAP_QUERY_CATALOG.filter((e) => e.flow === 'ban')).toHaveLength(13);
    expect(SAP_QUERY_CATALOG.filter((e) => e.flow === 'tra')).toHaveLength(12);
    expect(SAP_QUERY_CATALOG.map((e) => e.sortOrder)).toEqual(
      Array.from({ length: 25 }, (_, idx) => idx + 1),
    );

    for (const entry of SAP_QUERY_CATALOG) {
      expect(isSapQueryKey(entry.key)).toBe(true);
      expect(getSapQueryCatalogEntry(entry.key)).toBe(entry);
      expect(entry.title.length).toBeGreaterThan(5);
      expect(entry.description.length).toBeGreaterThan(10);
      expect(entry.impactBadges.length).toBeGreaterThan(0);
      expect(entry.requiredColumns.length).toBeGreaterThan(0);
      expect(entry.baselineColumns.length).toBeGreaterThanOrEqual(
        entry.requiredColumns.length,
      );
      for (const reqCol of entry.requiredColumns) {
        expect(entry.baselineColumns).toContain(reqCol);
      }
      expect(entry.dedupKeys.length).toBeGreaterThan(0);
      for (const dedupKey of entry.dedupKeys) {
        expect(entry.requiredColumns).toContain(dedupKey);
      }
    }
    expect(isSapQueryKey('unknown_key')).toBe(false);
    expect(getSapQueryCatalogEntry('unknown_key')).toBeUndefined();
  });

  it('includes internal baseline columns (PO DocEntry on chain_po, SO Canceled & Kho min/max on ret_so/ret_po/ret_grpo)', () => {
    expect(SAP_QUERY_CATALOG_BY_KEY.chain_po.requiredColumns).not.toContain(
      'PO DocEntry',
    );
    expect(SAP_QUERY_CATALOG_BY_KEY.chain_po.baselineColumns).toContain(
      'PO DocEntry',
    );
    expect(SAP_QUERY_CATALOG_BY_KEY.ret_so.baselineColumns).toEqual(
      expect.arrayContaining(['SO Canceled', 'Kho SO min', 'Kho SO max']),
    );
    expect(SAP_QUERY_CATALOG_BY_KEY.ret_po.baselineColumns).toEqual(
      expect.arrayContaining(['Kho PO min', 'Kho PO max']),
    );
    expect(SAP_QUERY_CATALOG_BY_KEY.ret_ap.baselineColumns).toContain(
      'AP Invoice No',
    );
  });

  it('matches buildSalesListQueries character-for-character across all 8 list queries (with brand, empty brand, and dateTo)', () => {
    const dateFrom = '20261007';
    const dateTo = '20261028';

    for (const brand of ['5001', '']) {
      const oracle = buildSalesListQueries(dateFrom, brand, dateTo);
      for (const key of SAP_SALES_LIST_QUERY_KEYS) {
        const entry = SAP_QUERY_CATALOG_BY_KEY[key];
        const rendered = wrapOpenquery(
          expandTemplate(entry, { dateFrom, dateTo, brand }),
        );
        expect(rendered.trim()).toBe(oracle[key as SalesListQueryKey].trim());
      }
    }
  });

  it('matches buildSalesChainQueries character-for-character in date mode (with dateTo) and PO batch mode', () => {
    const dateFrom = '20261007';
    const dateTo = '20261028';
    const brand = '5002';
    const poBatch = [1001, 1002, 1003];

    const oracleDate = buildSalesChainQueries(dateFrom, brand, undefined, dateTo);
    const oracleBatch = buildSalesChainQueries(dateFrom, brand, poBatch, dateTo);

    const keyMap: Record<
      (typeof SAP_SALES_CHAIN_QUERY_KEYS)[number],
      SalesChainQueryKey
    > = {
      chain_po: 'po',
      chain_so: 'so',
      chain_ar: 'ar',
      chain_grpo: 'grpo',
      chain_ap: 'ap',
    };

    for (const catalogKey of SAP_SALES_CHAIN_QUERY_KEYS) {
      const entry = SAP_QUERY_CATALOG_BY_KEY[catalogKey];
      const legacyKey = keyMap[catalogKey];

      const renderedDate = wrapOpenquery(
        expandTemplate(entry, { dateFrom, dateTo, brand }),
      );
      expect(renderedDate.trim()).toBe(oracleDate[legacyKey].trim());

      const renderedBatch = wrapOpenquery(
        expandTemplate(entry, {
          dateFrom,
          dateTo,
          brand,
          docNumbers: poBatch,
        }),
      );
      expect(renderedBatch.trim()).toBe(oracleBatch[legacyKey].trim());
    }
  });

  it('matches buildReturnQueries character-for-character across all 7 main SO-based return queries (date mode with dateTo, empty brand, and SO batch mode)', () => {
    const dateFrom = '20261007';
    const dateTo = '20261028';
    const soBatch = [5565, 5568];

    const keyMap: Record<
      (typeof SAP_RETURN_MAIN_QUERY_KEYS)[number],
      ReturnListQueryKey
    > = {
      ret_so: 'so',
      ret_po: 'po',
      ret_do: 'do',
      ret_ar: 'ar',
      ret_grpo: 'grpo',
      ret_ap: 'ap',
      ret_whs: 'whs',
    };

    for (const brand of ['5001', '']) {
      const oracleDate = buildReturnQueries(dateFrom, brand, { dateTo });
      const oracleBatch = buildReturnQueries(dateFrom, brand, {
        soNumbers: soBatch,
        dateTo,
      });

      for (const catalogKey of SAP_RETURN_MAIN_QUERY_KEYS) {
        const entry = SAP_QUERY_CATALOG_BY_KEY[catalogKey];
        const legacyKey = keyMap[catalogKey];

        const renderedDate = wrapOpenquery(
          expandTemplate(entry, { dateFrom, dateTo, brand }),
        );
        expect(renderedDate).toBe(oracleDate[legacyKey]);

        const renderedBatch = wrapOpenquery(
          expandTemplate(entry, {
            dateFrom,
            dateTo,
            brand,
            docNumbers: soBatch,
          }),
        );
        expect(renderedBatch).toBe(oracleBatch[legacyKey]);
      }
    }
  });

  it('matches buildReturnQueries({ candidates: true }) across all 5 old_sos_1..5 queries and applies dateTo only on old_sos_4..5', () => {
    const dateFrom = '20261007';
    const dateTo = '20261028';

    for (const brand of ['5001', '']) {
      const oracleOld = buildReturnQueries(dateFrom, brand, {
        candidates: true,
        dateTo,
      });

      for (const key of SAP_RETURN_OLD_QUERY_KEYS) {
        const entry = SAP_QUERY_CATALOG_BY_KEY[key];
        expect(entry.allowedPlaceholders).toEqual(['{d}', '{brand_cond}']);
        expect(entry.defaultSql).toContain('S."DocDate" < \'{d}\'');
        expect(entry.defaultSql).not.toContain('{date_cond}');

        const rendered = wrapOpenquery(
          expandTemplate(entry, { dateFrom, dateTo, brand }),
        );
        expect(rendered).toBe(oracleOld[key as ReturnCandidatesQueryKey]);
      }

      expect(oracleOld.old_sos_1).not.toContain('BETWEEN');
      expect(oracleOld.old_sos_2).not.toContain('BETWEEN');
      expect(oracleOld.old_sos_3).not.toContain('BETWEEN');
      expect(oracleOld.old_sos_4).toContain('BETWEEN');
      expect(oracleOld.old_sos_5).toContain('BETWEEN');
    }
  });
});
