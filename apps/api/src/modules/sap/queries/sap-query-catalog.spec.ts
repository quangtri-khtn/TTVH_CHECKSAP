import { wrapOpenquery } from '../lib/openquery';
import { SALES_PO_VENDOR_CODE } from '../lib/sap-constants';
import {
  buildReturnQueries,
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
} from './sap-query-catalog';

function expandTemplate(
  sqlText: string,
  opts: {
    readonly dateFrom: string;
    readonly brand: string;
    readonly poNumbers?: readonly number[];
  },
): string {
  const { dateFrom, brand, poNumbers } = opts;
  const br = `JOIN maycha_live.OWHS W ON W."WhsCode" = P."U_Store" AND W."U_Brand" = '${brand}'`;
  const poFilter =
    poNumbers !== undefined
      ? `P."CardCode" = '${SALES_PO_VENDOR_CODE}' AND P."CANCELED" = 'N' AND P."DocNum" IN (${poNumbers.join(', ')})`
      : `P."CardCode" = '${SALES_PO_VENDOR_CODE}' AND P."CANCELED" = 'N' AND P."DocDate" >= '${dateFrom}'`;
  const dateCond =
    poNumbers !== undefined
      ? `P."DocNum" IN (${poNumbers.join(', ')})`
      : `P."DocDate" >= '${dateFrom}'`;

  const replacements: Record<string, string> = {
    '{d}': dateFrom,
    '{br}': br,
    '{po_filter}': poFilter,
    '{brand}': brand,
    '{date_cond}': dateCond,
  };

  return sqlText.replace(
    /\{(d|br|po_filter|brand|date_cond)\}/g,
    (match) => replacements[match] ?? match,
  );
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

  it('includes internal baseline columns (PO DocEntry on chain_po, Kho PO min/max on ret_po)', () => {
    expect(SAP_QUERY_CATALOG_BY_KEY.chain_po.requiredColumns).not.toContain(
      'PO DocEntry',
    );
    expect(SAP_QUERY_CATALOG_BY_KEY.chain_po.baselineColumns).toContain(
      'PO DocEntry',
    );
    expect(SAP_QUERY_CATALOG_BY_KEY.ret_po.baselineColumns).toEqual(
      expect.arrayContaining(['Kho PO min', 'Kho PO max']),
    );
  });

  it('matches buildSalesListQueries character-for-character across all 8 list queries', () => {
    const dateFrom = '20261007';
    const brand = '5001';
    const oracle = buildSalesListQueries(dateFrom, brand);

    for (const key of SAP_SALES_LIST_QUERY_KEYS) {
      const entry = SAP_QUERY_CATALOG_BY_KEY[key];
      const rendered = wrapOpenquery(
        expandTemplate(entry.defaultSql, { dateFrom, brand }),
      );
      expect(rendered).toBe(oracle[key as SalesListQueryKey]);
    }
  });

  it('matches buildSalesChainQueries character-for-character in both date mode and PO batch mode', () => {
    const dateFrom = '20261007';
    const brand = '5002';
    const poBatch = [1001, 1002, 1003];

    const oracleDate = buildSalesChainQueries(dateFrom, brand);
    const oracleBatch = buildSalesChainQueries(dateFrom, brand, poBatch);

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
        expandTemplate(entry.defaultSql, { dateFrom, brand }),
      );
      expect(renderedDate).toBe(oracleDate[legacyKey]);

      const renderedBatch = wrapOpenquery(
        expandTemplate(entry.defaultSql, {
          dateFrom,
          brand,
          poNumbers: poBatch,
        }),
      );
      expect(renderedBatch).toBe(oracleBatch[legacyKey]);
    }
  });

  it('matches buildReturnQueries character-for-character across all 7 main return queries (date mode and PO batch mode)', () => {
    const dateFrom = '20261007';
    const brand = '5001';
    const poBatch = [2001, 2002];

    const oracleDate = buildReturnQueries(dateFrom, brand);
    const oracleBatch = buildReturnQueries(dateFrom, brand, {
      poNumbers: poBatch,
    });

    const keyMap: Record<
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

    for (const catalogKey of SAP_RETURN_MAIN_QUERY_KEYS) {
      const entry = SAP_QUERY_CATALOG_BY_KEY[catalogKey];
      const legacyKey = keyMap[catalogKey];

      const renderedDate = wrapOpenquery(
        expandTemplate(entry.defaultSql, { dateFrom, brand }),
      );
      expect(renderedDate).toBe(oracleDate[legacyKey]);

      const renderedBatch = wrapOpenquery(
        expandTemplate(entry.defaultSql, {
          dateFrom,
          brand,
          poNumbers: poBatch,
        }),
      );
      expect(renderedBatch).toBe(oracleBatch[legacyKey]);
    }
  });

  it('matches buildReturnQueries({ candidates: true }).old_pos character-for-character when joining ret_old_1..5 with UNION', () => {
    const dateFrom = '20261007';
    const brand = '5001';
    const oracleOldPos = buildReturnQueries(dateFrom, brand, {
      candidates: true,
    }).old_pos;

    const expandedBranches = SAP_RETURN_OLD_QUERY_KEYS.map((key) => {
      const entry = SAP_QUERY_CATALOG_BY_KEY[key];
      expect(entry.allowedPlaceholders).toEqual(['{d}', '{brand}']);
      expect(entry.defaultSql).toContain('P."DocDate" < \'{d}\'');
      expect(entry.defaultSql).not.toContain('{date_cond}');
      return expandTemplate(entry.defaultSql, { dateFrom, brand });
    });

    const combined = wrapOpenquery(expandedBranches.join('\nUNION\n'));
    expect(combined).toBe(oracleOldPos);
  });
});
