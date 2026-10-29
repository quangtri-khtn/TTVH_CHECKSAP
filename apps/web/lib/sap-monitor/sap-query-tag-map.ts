import type { CohortFilter, SalesViewKey } from './sales-monitor-domain';
import type { ReturnViewMode } from './return-monitor-domain';

export type SapQueryCatalogKey =
  | 'funnel'
  | 't1'
  | 't2'
  | 't3'
  | 't4'
  | 'ar'
  | 'grpo'
  | 'ap'
  | 'chain_po'
  | 'chain_so'
  | 'chain_ar'
  | 'chain_grpo'
  | 'chain_ap'
  | 'ret_so'
  | 'ret_po'
  | 'ret_do'
  | 'ret_ar'
  | 'ret_grpo'
  | 'ret_ap'
  | 'ret_whs'
  | 'old_sos_1'
  | 'old_sos_2'
  | 'old_sos_3'
  | 'old_sos_4'
  | 'old_sos_5';

export interface SapQueryTagMeta {
  readonly key: SapQueryCatalogKey;
  readonly sortOrder: number;
  readonly code: string;
  readonly flow: 'ban' | 'tra';
  readonly groupCode: '1A' | '1B' | '2A' | '2B';
  readonly title: string;
  readonly href: string;
}

function defineTag(
  sortOrder: number,
  key: SapQueryCatalogKey,
  flow: 'ban' | 'tra',
  groupCode: '1A' | '1B' | '2A' | '2B',
  title: string,
): SapQueryTagMeta {
  return {
    key,
    sortOrder,
    code: `#${String(sortOrder).padStart(2, '0')}`,
    flow,
    groupCode,
    title,
    href: `/admin/sap-queries?flow=${flow}&key=${key}`,
  };
}

export const SAP_QUERY_TAG_CATALOG: Record<SapQueryCatalogKey, SapQueryTagMeta> = {
  funnel: defineTag(1, 'funnel', 'ban', '1A', 'Tổng hợp PO & SO theo Cửa hàng (Bảng Overview)'),
  t1: defineTag(2, 't1', 'ban', '1A', 'T1 — PO chưa có SO (Quá hạn)'),
  t2: defineTag(3, 't2', 'ban', '1A', 'T2 — SO chưa có A/R Invoice (TTVH)'),
  t3: defineTag(4, 't3', 'ban', '1A', 'T3 — A/R đã xuất HĐ nhưng chưa có GRPO (KBMĐ)'),
  t4: defineTag(5, 't4', 'ban', '1A', 'T4 — GRPO chưa có A/P Invoice (KBMĐ)'),
  ar: defineTag(6, 'ar', 'ban', '1A', 'Danh sách A/R Invoice bán hàng (TTVH)'),
  grpo: defineTag(7, 'grpo', 'ban', '1A', 'Danh sách GRPO nhập hàng (KBMĐ)'),
  ap: defineTag(8, 'ap', 'ban', '1A', 'Danh sách A/P Invoice mua hàng (KBMĐ)'),
  chain_po: defineTag(9, 'chain_po', 'ban', '1B', 'Chuỗi PO — Danh sách PO gốc (KBMĐ)'),
  chain_so: defineTag(10, 'chain_so', 'ban', '1B', 'Chuỗi PO — Nhánh SO đối ứng (TTVH)'),
  chain_ar: defineTag(11, 'chain_ar', 'ban', '1B', 'Chuỗi PO — Nhánh A/R Invoice & HĐĐT (TTVH)'),
  chain_grpo: defineTag(12, 'chain_grpo', 'ban', '1B', 'Chuỗi PO — Nhánh GRPO nhập kho (KBMĐ)'),
  chain_ap: defineTag(13, 'chain_ap', 'ban', '1B', 'Chuỗi PO — Nhánh A/P Invoice & Số HĐ (KBMĐ)'),
  ret_so: defineTag(14, 'ret_so', 'tra', '2A', 'Chuỗi Trả hàng — Danh sách SO gốc (KBMĐ)'),
  ret_po: defineTag(15, 'ret_po', 'tra', '2A', 'Chuỗi Trả hàng — Nhánh PO trả hàng (TTVH)'),
  ret_do: defineTag(16, 'ret_do', 'tra', '2A', 'Chuỗi Trả hàng — Nhánh Delivery / Xuất kho (KBMĐ)'),
  ret_ar: defineTag(17, 'ret_ar', 'tra', '2A', 'Chuỗi Trả hàng — Nhánh A/R & HĐĐT (KBMĐ)'),
  ret_grpo: defineTag(18, 'ret_grpo', 'tra', '2A', 'Chuỗi Trả hàng — Nhánh GRPO nhận hàng trả (TTVH)'),
  ret_ap: defineTag(19, 'ret_ap', 'tra', '2A', 'Chuỗi Trả hàng — Nhánh A/P Invoice trả hàng (TTVH)'),
  ret_whs: defineTag(20, 'ret_whs', 'tra', '2A', 'Từ điển Danh mục Kho (OWHS · TTVH & KBMĐ)'),
  old_sos_1: defineTag(21, 'old_sos_1', 'tra', '2B', 'Tìm SO Nhóm Cũ #1 — SO đã hủy nhưng PO vẫn mở'),
  old_sos_2: defineTag(22, 'old_sos_2', 'tra', '2B', 'Tìm SO Nhóm Cũ #2 — SO có PO nhưng chưa có A/R'),
  old_sos_3: defineTag(23, 'old_sos_3', 'tra', '2B', 'Tìm SO Nhóm Cũ #3 — SO phát sinh A/R (OINV) trong kỳ'),
  old_sos_4: defineTag(24, 'old_sos_4', 'tra', '2B', 'Tìm SO Nhóm Cũ #4 — SO phát sinh A/R qua Delivery (ODLN) trong kỳ'),
  old_sos_5: defineTag(25, 'old_sos_5', 'tra', '2B', 'Tìm SO Nhóm Cũ #5 — SO phát sinh GRPO (OPDN) trong kỳ'),
};

export const SALES_CHAIN_QUERY_KEYS: readonly SapQueryCatalogKey[] = [
  'chain_po',
  'chain_so',
  'chain_ar',
  'chain_grpo',
  'chain_ap',
];

export const SALES_OLD_COHORT_QUERY_KEYS: readonly SapQueryCatalogKey[] = [
  't1',
  't2',
  't3',
  't4',
];

export const RETURN_CHAIN_QUERY_KEYS: readonly SapQueryCatalogKey[] = [
  'ret_so',
  'ret_po',
  'ret_do',
  'ret_ar',
  'ret_grpo',
  'ret_ap',
];

export const RETURN_OLD_COHORT_QUERY_KEYS: readonly SapQueryCatalogKey[] = [
  'old_sos_1',
  'old_sos_2',
  'old_sos_3',
  'old_sos_4',
  'old_sos_5',
];

const SALES_KPI_KEYS: readonly (readonly SapQueryCatalogKey[])[] = [
  ['chain_po', 'chain_so', 'chain_ar', 'chain_grpo', 'chain_ap'],
  ['chain_po', 'chain_so', 'chain_ar'],
  ['chain_po', 'chain_so', 'chain_ar'],
  ['t1', 't2', 't3', 't4', 'chain_po'],
];

const SALES_FUNNEL_STEP_KEYS: readonly (readonly SapQueryCatalogKey[])[] = [
  ['chain_po', 'chain_so', 't1'],
  ['chain_so', 'chain_ar', 't2'],
  ['chain_ar', 'ar'],
  ['chain_ar', 'chain_grpo', 't3'],
  ['chain_grpo', 'chain_ap', 't4'],
  ['chain_ap', 'ap'],
];

const SALES_LIST_VIEW_KEYS: Record<SalesViewKey, readonly SapQueryCatalogKey[]> = {
  overview: ['funnel', 't1', 't2', 't3', 't4', 'ar', 'grpo', 'ap'],
  chain: ['chain_po', 'chain_so', 'chain_ar', 'chain_grpo', 'chain_ap'],
  t1: ['t1'],
  t2: ['t2'],
  t3: ['t3'],
  t4: ['t4'],
  ar: ['ar'],
  grpo: ['grpo'],
  ap: ['ap'],
};

const RETURN_KPI_KEYS: readonly (readonly SapQueryCatalogKey[])[] = [
  ['ret_so', 'ret_po', 'ret_do', 'ret_ar', 'ret_grpo', 'ret_ap'],
  ['ret_so', 'ret_ar', 'ret_whs'],
  ['ret_so', 'ret_po', 'ret_ar'],
  ['old_sos_1', 'old_sos_2', 'old_sos_3', 'old_sos_4', 'old_sos_5'],
];

const RETURN_FUNNEL_STEP_KEYS: readonly (readonly SapQueryCatalogKey[])[] = [
  ['ret_so', 'ret_po', 'ret_do'],
  ['ret_so', 'ret_ar'],
  ['ret_ar'],
  ['ret_ar', 'ret_grpo'],
  ['ret_grpo', 'ret_ap'],
  ['ret_ap'],
];

export function isValidSapQueryKey(value: string | null | undefined): value is SapQueryCatalogKey {
  if (!value) return false;
  return Object.prototype.hasOwnProperty.call(SAP_QUERY_TAG_CATALOG, value);
}

export function getSalesKpiQueryKeys(cardIndex: number): readonly SapQueryCatalogKey[] {
  return SALES_KPI_KEYS[cardIndex] ?? SALES_CHAIN_QUERY_KEYS;
}

export function getSalesFunnelStepQueryKeys(stepIndex: number): readonly SapQueryCatalogKey[] {
  return SALES_FUNNEL_STEP_KEYS[stepIndex] ?? SALES_CHAIN_QUERY_KEYS;
}

export function getSalesListViewQueryKeys(
  viewKey: SalesViewKey,
  isDrilldown = false,
): readonly SapQueryCatalogKey[] {
  if (isDrilldown && viewKey === 'ar') return ['chain_ar'];
  if (isDrilldown && viewKey === 'grpo') return ['chain_grpo'];
  return SALES_LIST_VIEW_KEYS[viewKey] ?? SALES_CHAIN_QUERY_KEYS;
}

export function getReturnKpiQueryKeys(cardIndex: number): readonly SapQueryCatalogKey[] {
  return RETURN_KPI_KEYS[cardIndex] ?? RETURN_CHAIN_QUERY_KEYS;
}

export function getReturnFunnelStepQueryKeys(stepIndex: number): readonly SapQueryCatalogKey[] {
  return RETURN_FUNNEL_STEP_KEYS[stepIndex] ?? RETURN_CHAIN_QUERY_KEYS;
}

export function getReturnListViewQueryKeys(
  viewMode: ReturnViewMode,
  cohort: CohortFilter,
): readonly SapQueryCatalogKey[] {
  const base: readonly SapQueryCatalogKey[] =
    viewMode === 'ar_noinv'
      ? ['ret_so', 'ret_ar', 'ret_whs']
      : ['ret_so', 'ret_po', 'ret_do', 'ret_ar', 'ret_grpo', 'ret_ap', 'ret_whs'];
  return cohort === 'moi' ? base : [...base, ...RETURN_OLD_COHORT_QUERY_KEYS];
}
