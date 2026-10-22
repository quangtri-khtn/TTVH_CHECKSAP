// Phân loại 9 danh mục chứng từ treo theo đúng đơn vị của từng bước (PO, SO, A/R, GRPO),
// sắp xếp tuổi A/R giảm dần và cung cấp hàm đếm số dòng theo cohort.
// Nguồn đối chiếu 1:1: desktop `sales_flow_checker.py` (:2499-2520, :2642-2692).
import type { SapCellValue } from '../sap-row-normalizer';
import {
  type SapRowRecord,
  compareAscii,
  diffDays,
  hasValue,
  recordsToTable,
  toSapDateString,
} from './sales-monitor-helpers';
import {
  CHAIN_COLUMNS,
  type ChainGrpoRecord,
  ST_FULL,
  ST_NO_AR,
  ST_NO_AR_WAIT_SHIP,
  ST_NO_SO,
} from './sales-po-chain';

export const DOC_STATUS_ITEMS = [
  { key: 'po_no_so', label: '1 - PO chưa có SO', unit: 'PO', tag: 'attn' },
  {
    key: 'so_no_ar',
    label: '2a - SO chưa có A/R (đã đến/qua SO ShipDate, cần kiểm tra)',
    unit: 'SO',
    tag: 'attn',
  },
  {
    key: 'so_no_ar_wait',
    label: '2b - SO chưa có A/R: SO ShipDate > hôm nay, chưa đến ngày xuất hàng (bình thường)',
    unit: 'SO',
    tag: 'normal',
  },
  { key: 'ar_no_inv', label: '3a - A/R chưa xuất hóa đơn (cần xử lý)', unit: 'A/R', tag: 'attn' },
  {
    key: 'ar_no_inv_bd',
    label: '3b - A/R chưa xuất HĐ: tạo hôm nay, posting lùi ngày (HĐ tự xuất chỉ trong ngày - không phải lỗi)',
    unit: 'A/R',
    tag: 'normal',
  },
  { key: 'ar_no_grpo', label: '4a - A/R đã xuất HĐ, PO chưa có GRPO (cần xử lý)', unit: 'A/R', tag: 'attn' },
  {
    key: 'ar_no_grpo_wait',
    label: '4b - A/R đã xuất HĐ, PO chưa có GRPO: AR ShipDate > hôm nay, chờ đến ngày (bình thường)',
    unit: 'A/R',
    tag: 'normal',
  },
  { key: 'grpo_no_ap', label: '5 - GRPO chưa có AP', unit: 'GRPO', tag: 'attn' },
  { key: 'po_full', label: '6 - PO đủ chuỗi PO → AP', unit: 'PO', tag: '' },
] as const;

export type SalesDocStatusKey = (typeof DOC_STATUS_ITEMS)[number]['key'];

export const FUNNEL_ROW_KEYS: readonly (readonly SalesDocStatusKey[])[] = [
  ['po_no_so'],
  ['so_no_ar', 'so_no_ar_wait'],
  ['ar_no_inv', 'ar_no_inv_bd'],
  ['ar_no_grpo', 'ar_no_grpo_wait'],
  ['grpo_no_ap'],
];

export const DOC_AR_COLS = [
  'Nhom', 'Store', 'PO Number', 'SO Number', 'AR Number', 'Invoice No',
  'AR DocDate', 'AR CreateDate', 'AR ShipDate', 'Tuoi A/R (ngay)', 'Phan loai', 'Trang thai PO',
] as const;

export const DOC_SO_COLS = [
  'Nhom', 'Store', 'PO Number', 'PO DocDate', 'SO Number',
  'SO CreateDate', 'SO ShipDate', 'Ghi chu ShipDate', 'Trang thai PO',
] as const;

export const DOC_GRPO_COLS = [
  'Nhom', 'Store', 'PO Number', 'GRPO Number', 'GRPO DocDate', 'Trang thai PO',
] as const;

export interface SalesDocStatusItem {
  key: SalesDocStatusKey;
  label: string;
  unit: string;
  tag: string;
  count: number;
  columns: string[];
  rows: SapCellValue[][];
}

export type SalesDocStatusMap = Record<SalesDocStatusKey, SalesDocStatusItem>;

const AR_DOC_KEYS: readonly SalesDocStatusKey[] = [
  'ar_no_inv',
  'ar_no_inv_bd',
  'ar_no_grpo',
  'ar_no_grpo_wait',
];

function columnsForDocStatusKey(key: SalesDocStatusKey): readonly string[] {
  if (key === 'po_no_so' || key === 'po_full') return CHAIN_COLUMNS;
  if (key === 'so_no_ar' || key === 'so_no_ar_wait') return DOC_SO_COLS;
  if (key === 'grpo_no_ap') return DOC_GRPO_COLS;
  return DOC_AR_COLS;
}

/** Xây dựng 9 mục chứng từ treo theo đúng đơn vị từng bước (`build_doc_status`, `:2642-2692`). */
export function buildDocStatus(
  chainRows: readonly SapRowRecord[],
  chainAr: readonly SapRowRecord[],
  chainGrpo: readonly ChainGrpoRecord[],
  today: string,
): SalesDocStatusMap {
  const poBy = new Map<number, SapRowRecord>(
    chainRows.map((r) => [Number(r['PO Number']), r]),
  );
  const poHasGrpo = new Set<number>(
    chainRows
      .filter((r) => hasValue(r['GRPO Number']))
      .map((r) => Number(r['PO Number'])),
  );
  const labelByKey = new Map<SalesDocStatusKey, string>(
    DOC_STATUS_ITEMS.map((item) => [item.key, item.label]),
  );

  const recordsByKey: Record<SalesDocStatusKey, SapRowRecord[]> = {
    po_no_so: [],
    so_no_ar: [],
    so_no_ar_wait: [],
    ar_no_inv: [],
    ar_no_inv_bd: [],
    ar_no_grpo: [],
    ar_no_grpo_wait: [],
    grpo_no_ap: [],
    po_full: [],
  };

  for (const r of chainRows) {
    const st = String(r['Trang thai chuoi chung tu'] ?? '');
    if (st === ST_NO_SO) {
      recordsByKey.po_no_so.push(r);
    } else if (st === ST_FULL) {
      recordsByKey.po_full.push(r);
    } else if (st === ST_NO_AR || st === ST_NO_AR_WAIT_SHIP) {
      const targetKey: SalesDocStatusKey = st === ST_NO_AR ? 'so_no_ar' : 'so_no_ar_wait';
      for (const so of String(r['SO Number'] ?? '').split(', ').filter(Boolean)) {
        recordsByKey[targetKey].push({
          Nhom: r['Nhom'] ?? null,
          Store: r['Store'] ?? null,
          'PO Number': r['PO Number'] ?? null,
          'PO DocDate': r['PO DocDate'] ?? null,
          'SO Number': so,
          'SO CreateDate': r['SO CreateDate'] ?? null,
          'SO ShipDate': r['SO ShipDate'] ?? null,
          'Ghi chu ShipDate': r['Ghi chu ShipDate'] ?? null,
          'Trang thai PO': st,
        });
      }
    }
  }

  for (const a of chainAr) {
    const poNum = Number(a['PO Number']);
    const po = poBy.get(poNum);
    const created = toSapDateString(a['AR CreateDate']);
    const posted = toSapDateString(a['AR DocDate']);

    let key: SalesDocStatusKey;
    if (!hasValue(a['Invoice No'])) {
      key = created === today && posted !== null && posted < today ? 'ar_no_inv_bd' : 'ar_no_inv';
    } else if (poHasGrpo.has(poNum)) {
      continue;
    } else {
      key = (toSapDateString(a['AR ShipDate']) ?? today) > today ? 'ar_no_grpo_wait' : 'ar_no_grpo';
    }

    recordsByKey[key].push({
      Nhom: a['Nhom'] ?? null,
      Store: po?.['Store'] ?? null,
      'PO Number': a['PO Number'] ?? null,
      'SO Number': po?.['SO Number'] ?? null,
      'AR Number': a['AR Number'] ?? null,
      'Invoice No': a['Invoice No'] ?? null,
      'AR DocDate': a['AR DocDate'] ?? null,
      'AR CreateDate': a['AR CreateDate'] ?? null,
      'AR ShipDate': a['AR ShipDate'] ?? null,
      'Tuoi A/R (ngay)': created !== null ? diffDays(today, created) : null,
      'Phan loai': labelByKey.get(key) ?? '',
      'Trang thai PO': po?.['Trang thai chuoi chung tu'] ?? '',
    });
  }

  for (const key of AR_DOC_KEYS) {
    recordsByKey[key].sort(
      (a, b) =>
        Number(b['Tuoi A/R (ngay)'] ?? 0) - Number(a['Tuoi A/R (ngay)'] ?? 0) ||
        compareAscii(String(a['AR Number'] ?? ''), String(b['AR Number'] ?? '')),
    );
  }

  for (const g of chainGrpo) {
    if (!g.has_ap) {
      const po = poBy.get(g['PO Number']);
      recordsByKey.grpo_no_ap.push({
        Nhom: g.Nhom,
        Store: po?.['Store'] ?? null,
        'PO Number': g['PO Number'],
        'GRPO Number': g['GRPO Number'],
        'GRPO DocDate': po?.['GRPO DocDate'] ?? null,
        'Trang thai PO': po?.['Trang thai chuoi chung tu'] ?? '',
      });
    }
  }

  const out = {} as SalesDocStatusMap;
  for (const item of DOC_STATUS_ITEMS) {
    const table = recordsToTable(columnsForDocStatusKey(item.key), recordsByKey[item.key]);
    out[item.key] = {
      key: item.key,
      label: item.label,
      unit: item.unit,
      tag: item.tag,
      count: table.rows.length,
      columns: table.columns,
      rows: table.rows,
    };
  }
  return out;
}

/** Đếm số lượng dòng chứng từ treo của từng mục theo nhóm cohort (`'Mới'`, `'Cũ'`, hoặc `null` = Tất cả). */
export function countDocStatusByCohort(
  docStatus: SalesDocStatusMap,
  cohort: 'Mới' | 'Cũ' | null,
): Record<SalesDocStatusKey, number> {
  const counts = {} as Record<SalesDocStatusKey, number>;
  for (const item of DOC_STATUS_ITEMS) {
    const rows = docStatus[item.key].rows;
    counts[item.key] = cohort === null ? rows.length : rows.filter((row) => row[0] === cohort).length;
  }
  return counts;
}
