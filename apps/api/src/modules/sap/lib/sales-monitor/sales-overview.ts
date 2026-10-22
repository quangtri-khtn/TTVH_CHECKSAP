// Xây dựng bảng Tổng quan 13 cột theo cửa hàng (chỉ tính nhóm mới, khử trùng lặp theo cặp Store::Num,
// kèm dòng TỔNG) và tính toán 4 chỉ số tóm tắt tình trạng.
// Nguồn đối chiếu 1:1: desktop `sales_flow_checker.py` (:2842-2912, :3195-3214).
import type { SalesListQueryKey } from '../../queries/sales-monitor-queries';
import type { SapCellValue, SapQueryResult } from '../sap-row-normalizer';
import { COHORT_KEYS, NHOM_CU } from './sales-cohort';
import {
  type SapRowRecord,
  compareAscii,
  hasValue,
  recordsToTable,
  tableToRecords,
} from './sales-monitor-helpers';

export const OVERVIEW_COLUMNS = [
  'Store', 'Tên cửa hàng', 'PO', 'SO', 'A/R', 'A/R đã có HĐ', 'GRPO', 'AP',
  'T1 PO chưa SO', 'T2 SO chưa A/R', 'T3 A/R chưa GRPO', 'T4 GRPO chưa AP',
  'Treo cần xử lý (T1+T3+T4)',
] as const;

export const MONITOR_VIEWS = [
  { key: 'overview', label: 'Tổng quan theo cửa hàng', isAlert: false, links: [] },
  {
    key: 'chain',
    label: 'Chi tiết theo PO',
    isAlert: false,
    links: [['PO Number', 'PO'], ['SO Number', 'SO'], ['AR Number', 'AR'], ['GRPO Number', 'GRPO'], ['AP Number', 'AP']],
  },
  { key: 't1', label: 'T1 – PO chưa có SO', isAlert: true, links: [['PO Number', 'PO']] },
  { key: 't2', label: 'T2 – SO chưa có AR', isAlert: true, links: [['SO Number', 'SO'], ['PO Number', 'PO']] },
  { key: 't3', label: 'T3 – AR đã xuất HĐ, chưa có GRPO', isAlert: true, links: [['AR Number', 'AR'], ['SO Number', 'SO'], ['PO Number', 'PO']] },
  { key: 't4', label: 'T4 – GRPO chưa có AP', isAlert: true, links: [['GRPO Number', 'GRPO'], ['PO Number', 'PO']] },
  { key: 'ar', label: 'A/R trong kỳ', isAlert: false, links: [['AR Number', 'AR'], ['SO Number', 'SO'], ['PO Number', 'PO']] },
  { key: 'grpo', label: 'GRPO trong kỳ', isAlert: false, links: [['GRPO Number', 'GRPO'], ['PO Number', 'PO']] },
  { key: 'ap', label: 'AP trong kỳ', isAlert: false, links: [['AP Number', 'AP'], ['GRPO Number', 'GRPO'], ['PO Number', 'PO']] },
] as const;

export interface SalesMonitorSummary {
  problems: number;
  t2Due: number;
  waiting: number;
  backlog: number;
}

const DOC_DEDUP_SPECS: readonly [SalesListQueryKey, string, string][] = [
  ['ar', 'AR Number', 'A/R'],
  ['grpo', 'GRPO Number', 'GRPO'],
  ['ap', 'AP Number', 'AP'],
];

const PENDING_COL_SPECS: readonly [SalesListQueryKey, string][] = [
  ['t1', 'T1 PO chưa SO'],
  ['t2', 'T2 SO chưa A/R'],
  ['t3', 'T3 A/R chưa GRPO'],
  ['t4', 'T4 GRPO chưa AP'],
];

/** Xây dựng bảng tổng quan 13 cột theo cửa hàng, chỉ tính Nhóm mới, kèm dòng `TỔNG` (`build_monitor_overview`, `:2871-2912`). */
export function buildMonitorOverview(
  listResults: Record<SalesListQueryKey, SapQueryResult>,
): SapQueryResult {
  const cohortKeySet = new Set<string>(COHORT_KEYS);
  const filteredRecords = {} as Record<SalesListQueryKey, SapRowRecord[]>;

  for (const key of Object.keys(listResults) as SalesListQueryKey[]) {
    const records = tableToRecords(listResults[key]);
    filteredRecords[key] = cohortKeySet.has(key)
      ? records.filter((r) => r['Nhom'] !== NHOM_CU)
      : records;
  }

  const names = new Map<string, SapCellValue>();
  const byStore = new Map<string, SapRowRecord>();

  const getOrCreateRow = (store: string): SapRowRecord => {
    const existing = byStore.get(store);
    if (existing) return existing;
    const row: SapRowRecord = {
      Store: store,
      'Tên cửa hàng': names.get(store) ?? null,
      PO: 0, SO: 0, 'A/R': 0, 'A/R đã có HĐ': 0, GRPO: 0, AP: 0,
      'T1 PO chưa SO': 0, 'T2 SO chưa A/R': 0, 'T3 A/R chưa GRPO': 0, 'T4 GRPO chưa AP': 0,
      'Treo cần xử lý (T1+T3+T4)': 0,
    };
    byStore.set(store, row);
    return row;
  };

  for (const r of filteredRecords.funnel) {
    const store = String(r['Store'] ?? '');
    names.set(store, r['Ten cua hang'] ?? null);
    const row = getOrCreateRow(store);
    row['Tên cửa hàng'] = r['Ten cua hang'] ?? null;
    row['PO'] = Number(r['PO'] || 0);
    row['SO'] = Number(r['SO'] || 0);
  }

  for (const [key, numCol, col] of DOC_DEDUP_SPECS) {
    const seen = new Set<string>();
    for (const r of filteredRecords[key]) {
      const store = String(r['Store'] ?? '');
      const pairKey = `${store}::${String(r[numCol] ?? '')}`;
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);
      const storeRow = getOrCreateRow(store);
      storeRow[col] = Number(storeRow[col] ?? 0) + 1;
      if (key === 'ar' && hasValue(r['Invoice No'])) {
        storeRow['A/R đã có HĐ'] = Number(storeRow['A/R đã có HĐ'] ?? 0) + 1;
      }
    }
  }

  for (const [key, col] of PENDING_COL_SPECS) {
    for (const r of filteredRecords[key]) {
      const storeRow = getOrCreateRow(String(r['Store'] ?? ''));
      storeRow[col] = Number(storeRow[col] ?? 0) + 1;
    }
  }

  const rows = Array.from(byStore.values());
  for (const row of rows) {
    row['Treo cần xử lý (T1+T3+T4)'] =
      Number(row['T1 PO chưa SO'] ?? 0) +
      Number(row['T3 A/R chưa GRPO'] ?? 0) +
      Number(row['T4 GRPO chưa AP'] ?? 0);
  }

  rows.sort(
    (a, b) =>
      Number(b['Treo cần xử lý (T1+T3+T4)'] ?? 0) - Number(a['Treo cần xử lý (T1+T3+T4)'] ?? 0) ||
      Number(b['T2 SO chưa A/R'] ?? 0) - Number(a['T2 SO chưa A/R'] ?? 0) ||
      compareAscii(String(a['Store'] ?? ''), String(b['Store'] ?? '')),
  );

  const totalRow: SapRowRecord = {
    Store: 'TỔNG',
    'Tên cửa hàng': `${rows.length} cửa hàng`,
  };
  for (const col of OVERVIEW_COLUMNS.slice(2)) {
    totalRow[col] = rows.reduce((sum, r) => sum + Number(r[col] ?? 0), 0);
  }

  return recordsToTable(OVERVIEW_COLUMNS, [...rows, totalRow]);
}

/** Tính 4 chỉ số tóm tắt tình trạng (`problems`, `t2Due`, `waiting`, `backlog`, `:3195-3214`). */
export function buildStatusSummary(
  listResults: Record<SalesListQueryKey, SapQueryResult>,
): SalesMonitorSummary {
  const recordsByKey = {
    t1: tableToRecords(listResults.t1),
    t2: tableToRecords(listResults.t2),
    t3: tableToRecords(listResults.t3),
    t4: tableToRecords(listResults.t4),
  };

  const rowsOf = (
    key: 't1' | 't2' | 't3' | 't4',
    cohortNew: boolean,
    due?: boolean,
  ): SapRowRecord[] =>
    recordsByKey[key].filter((r) => {
      if ((r['Nhom'] !== NHOM_CU) !== cohortNew) return false;
      if (due !== undefined) {
        const isDue = String(r['Ghi chu ShipDate'] ?? '').startsWith('Da den');
        if (isDue !== due) return false;
      }
      return true;
    });

  return {
    problems: rowsOf('t1', true).length + rowsOf('t3', true, true).length + rowsOf('t4', true).length,
    t2Due: rowsOf('t2', true, true).length,
    waiting: rowsOf('t2', true, false).length + rowsOf('t3', true, false).length,
    backlog: rowsOf('t1', false).length + rowsOf('t3', false).length + rowsOf('t4', false).length,
  };
}
