import {
  RETURN_CHAIN_QUERY_KEYS,
  RETURN_OLD_COHORT_QUERY_KEYS,
  SALES_CHAIN_QUERY_KEYS,
  SAP_QUERY_TAG_CATALOG,
  getReturnFunnelStepQueryKeys,
  getReturnKpiQueryKeys,
  getReturnListViewQueryKeys,
  getSalesFunnelStepQueryKeys,
  getSalesKpiQueryKeys,
  getSalesListViewQueryKeys,
  isValidSapQueryKey,
} from './sap-query-tag-map';

describe('sap-query-tag-map', () => {
  it('chứa đầy đủ 25 câu truy vấn (#01..#25) với đường dẫn deep-link chuẩn', () => {
    const entries = Object.values(SAP_QUERY_TAG_CATALOG);
    expect(entries).toHaveLength(25);

    const banEntries = entries.filter((e) => e.flow === 'ban');
    const traEntries = entries.filter((e) => e.flow === 'tra');
    expect(banEntries).toHaveLength(13);
    expect(traEntries).toHaveLength(12);

    for (const entry of entries) {
      expect(entry.href).toBe(`/admin/sap-queries?flow=${entry.flow}&key=${entry.key}`);
      expect(entry.code).toBe(`#${String(entry.sortOrder).padStart(2, '0')}`);
      expect(isValidSapQueryKey(entry.key)).toBe(true);
    }
    expect(isValidSapQueryKey('unknown_key')).toBe(false);
    expect(isValidSapQueryKey(null)).toBe(false);
  });

  it('ánh xạ đầy đủ 13 câu Luồng Bán vào KPI, Phễu và 8 chế độ xem lưới', () => {
    const coveredBanKeys = new Set<string>();
    for (let i = 0; i < 4; i++) {
      getSalesKpiQueryKeys(i).forEach((k) => coveredBanKeys.add(k));
    }
    for (let i = 0; i < 6; i++) {
      getSalesFunnelStepQueryKeys(i).forEach((k) => coveredBanKeys.add(k));
    }
    for (const view of ['overview', 'chain', 't1', 't2', 't3', 't4', 'ar', 'grpo'] as const) {
      getSalesListViewQueryKeys(view, false).forEach((k) => coveredBanKeys.add(k));
    }
    SALES_CHAIN_QUERY_KEYS.forEach((k) => coveredBanKeys.add(k));

    expect(coveredBanKeys.size).toBe(13);
    expect(getSalesListViewQueryKeys('ar', true)).toEqual(['chain_ar']);
    expect(getSalesListViewQueryKeys('grpo', true)).toEqual(['chain_grpo']);
  });

  it('ánh xạ đầy đủ 12 câu Luồng Trả vào KPI, Phễu và 2 chế độ xem lưới', () => {
    const coveredTraKeys = new Set<string>();
    for (let i = 0; i < 4; i++) {
      getReturnKpiQueryKeys(i).forEach((k) => coveredTraKeys.add(k));
    }
    for (let i = 0; i < 6; i++) {
      getReturnFunnelStepQueryKeys(i).forEach((k) => coveredTraKeys.add(k));
    }
    getReturnListViewQueryKeys('po', 'moi').forEach((k) => coveredTraKeys.add(k));
    getReturnListViewQueryKeys('ar_noinv', 'tatCa').forEach((k) => coveredTraKeys.add(k));
    RETURN_CHAIN_QUERY_KEYS.forEach((k) => coveredTraKeys.add(k));
    RETURN_OLD_COHORT_QUERY_KEYS.forEach((k) => coveredTraKeys.add(k));

    expect(coveredTraKeys.size).toBe(12);
    expect(getReturnListViewQueryKeys('po', 'moi')).toHaveLength(7);
    expect(getReturnListViewQueryKeys('po', 'cu')).toHaveLength(12);
  });
});
