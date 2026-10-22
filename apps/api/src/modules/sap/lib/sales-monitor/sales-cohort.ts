// Phân nhóm PO Cũ / Mới theo ngày PO DocDate, gắn cột Nhom vào 7 danh sách truy vấn
// và gom danh sách số PO nguyên dương hợp lệ của nhóm cũ cần tải chuỗi chứng từ.
// Nguồn đối chiếu 1:1: desktop `sales_flow_checker.py` (:2373-2410).
import type { SapQueryResult } from '../sap-row-normalizer';
import { toSapDateString } from './sales-monitor-helpers';

/** Nhóm PO mới: PO có ngày chứng từ từ ngày bắt đầu đo trở đi (`:2373`). */
export const NHOM_MOI = 'Mới';

/** Nhóm PO cũ: PO có ngày chứng từ trước ngày bắt đầu đo nhưng còn phát sinh chứng từ trong kỳ (`:2374`). */
export const NHOM_CU = 'Cũ';

/** Danh sách 7 bảng kết quả Monitor Bán hàng được gắn cột `'Nhom'` ở đầu (`:2375`). */
export const COHORT_KEYS = [
  't1',
  't2',
  't3',
  't4',
  'ar',
  'grpo',
  'ap',
] as const;

export type CohortKey = (typeof COHORT_KEYS)[number];

const OLD_COHORT_SCAN_KEYS = ['ar', 'grpo', 'ap', 't2', 't3', 't4'] as const;

/**
 * Xác định nhóm của 1 PO dựa trên ngày chứng từ PO (`po_cohort`, `:2379-2382`).
 * PO có ngày trước `dateFrom` thuộc nhóm `'Cũ'`, còn lại thuộc nhóm `'Mới'`.
 */
export function poCohort(
  poDocDate: unknown,
  dateFrom: string,
): typeof NHOM_MOI | typeof NHOM_CU {
  const d = toSapDateString(poDocDate);
  const cutoff = toSapDateString(dateFrom);
  return d !== null && cutoff !== null && d < cutoff ? NHOM_CU : NHOM_MOI;
}

/**
 * Gắn cột `'Nhom'` vào vị trí đầu tiên của 7 bảng trong `COHORT_KEYS` (`tag_cohort`, `:2393-2400`).
 * Lưu ý: bảng `t1` chỉ có cột `'DocDate'` thay vì `'PO DocDate'`.
 */
export function tagCohort<K extends string>(
  results: Record<K, SapQueryResult>,
  dateFrom: string,
): Record<K, SapQueryResult> {
  const out: Record<K, SapQueryResult> = { ...results };

  for (const key of COHORT_KEYS) {
    const table = results[key as unknown as K];
    if (!table) {
      continue;
    }

    const poDocDateIdx = table.columns.indexOf('PO DocDate');
    const dateColIdx =
      poDocDateIdx !== -1 ? poDocDateIdx : table.columns.indexOf('DocDate');

    const taggedRows = table.rows.map((row) => {
      const nhom = poCohort(
        dateColIdx >= 0 ? row[dateColIdx] : null,
        dateFrom,
      );
      return [nhom, ...row];
    });

    out[key as unknown as K] = {
      columns: ['Nhom', ...table.columns.filter((c) => c !== 'Nhom')],
      rows: taggedRows,
    };
  }

  return out;
}

/**
 * Gom danh sách số PO nguyên dương thuộc nhóm cũ có phát sinh A/R, GRPO, AP hoặc treo T2–T4
 * trong kỳ nhưng chưa nằm trong tập PO mới (`old_cohort_po_numbers`, `:2402-2410`).
 */
export function oldCohortPoNumbers(
  listResults: Record<string, SapQueryResult>,
  newPoSet: ReadonlySet<number>,
): number[] {
  const pos = new Set<number>();

  for (const key of OLD_COHORT_SCAN_KEYS) {
    const table = listResults[key];
    if (!table) {
      continue;
    }
    const poColIdx = table.columns.indexOf('PO Number');
    if (poColIdx === -1) {
      continue;
    }

    for (const row of table.rows) {
      const val = row[poColIdx];
      if (val !== null && val !== undefined && val !== '') {
        const num = Number(val);
        if (Number.isSafeInteger(num) && num > 0 && !newPoSet.has(num)) {
          pos.add(num);
        }
      }
    }
  }

  return Array.from(pos).sort((a, b) => a - b);
}
