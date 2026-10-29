// Xây dựng chuỗi chứng từ trả hàng 31 cột theo từng SO (assembleReturnChain)
// và bảng 19 cột A/R chưa xuất hóa đơn (buildReturnArNoInv) theo Đặc tả v1.1 (28/10/2026).
import type { ReturnListQueryKey } from '../../queries/return-monitor-queries';
import { NHOM_MOI, poCohort } from '../sales-monitor/sales-cohort';
import {
  type SapRowRecord,
  compareAscii,
  diffDays,
  hasValue,
  joinNums,
  latestValue,
  recordsToTable,
  shipWaitText,
  tableToRecords,
  todayInVietnam,
  toSapDateString,
} from '../sales-monitor/sales-monitor-helpers';
import type { SapCellValue, SapQueryResult } from '../sap-row-normalizer';

export const RST_SO_CANCELED =
  '0 - SO (TTVH) đã hủy nhưng PO (KBMD) sinh từ SO vẫn mở – cần hủy PO';
export const RST_NO_PO = '1 - SO chưa sinh PO (KBMD)';
/** Bí danh tương thích ngược cho `RST_NO_PO`. */
export const RST_NO_SO = RST_NO_PO;
export const RST_NO_AR = '2 - Có SO + PO, chưa có A/R (TTVH)';
export const RST_NO_AR_WAIT_SHIP =
  '2a - Có SO + PO, chưa có A/R: SO ShipDate > hôm nay, chưa đến ngày xuất hàng (bình thường)';
export const RST_AR_NO_INV = '3 - Có A/R, chưa xuất hóa đơn';
export const RST_NO_GRPO = '4 - A/R đã xuất HĐ, chưa có GRPO (KBMD)';
export const RST_NO_GRPO_WAIT_SHIP =
  '4a - A/R đã xuất HĐ, chưa có GRPO: SO ShipDate > hôm nay, chờ đến ngày (bình thường)';
export const RST_NO_AP = '5 - Có GRPO, chưa có AP (KBMD)';
export const RST_AP_NO_INV = '6 - Có AP, chưa có Invoice (KBMD)';
export const RST_FULL = '7 - Đủ chuỗi SO → PO → AP → Invoice';
export const RST_MANUAL_SO =
  '8 - SO thủ công (không có MC_Docnum, không qua MC Tool) – không sinh PO tự động (tham khảo)';

export const RET_STATUS_ORDER = [
  RST_SO_CANCELED,
  RST_NO_PO,
  RST_NO_AR,
  RST_NO_AR_WAIT_SHIP,
  RST_AR_NO_INV,
  RST_NO_GRPO,
  RST_NO_GRPO_WAIT_SHIP,
  RST_NO_AP,
  RST_AP_NO_INV,
  RST_FULL,
  RST_MANUAL_SO,
] as const;

export type ReturnStatusLabel = (typeof RET_STATUS_ORDER)[number];

export const RET_WAIT_STATUSES = new Set<string>([
  RST_NO_AR_WAIT_SHIP,
  RST_NO_GRPO_WAIT_SHIP,
]);

export const RET_OUT_OF_FUNNEL_STATUSES = new Set<string>([
  RST_SO_CANCELED,
  RST_MANUAL_SO,
]);

export const RET_CHAIN_COLUMNS = [
  'Nhom',
  'Store',
  'Ten cua hang',
  'Brand',
  'SO Number',
  'SO DocDate',
  'SO CreateDate',
  'SO ShipDate',
  'MC Docnum',
  'Nguon SO',
  'SO Huy',
  'Kho xuat SO (TTVH)',
  'PO Number',
  'PO DocDate',
  'PO CreateDate',
  'Kho nhan PO (KBMD)',
  'Ten kho nhan (KBMD)',
  'DO Number',
  'AR Number',
  'Invoice No',
  'AR DocDate',
  'AR CreateDate',
  'AR ShipDate',
  'Ghi chu ShipDate',
  'GRPO Number',
  'GRPO DocDate',
  'Kho GRPO (KBMD)',
  'AP Number',
  'AP Invoice No',
  'AP DocDate',
  'Trang thai chuoi chung tu',
] as const;

export const RET_AR_NOINV_COLS = [
  'Nhom',
  'Store',
  'Ten cua hang',
  'SO Number',
  'SO DocDate',
  'SO CreateDate',
  'MC Docnum',
  'PO Number',
  'PO DocDate',
  'PO CreateDate',
  'SO ShipDate',
  'AR Number',
  'AR DocDate',
  'AR CreateDate',
  'AR ShipDate',
  'Tuoi A/R (ngay)',
  'SO con A/R khac da xuat HD',
  'Trang thai SO',
  'Ghi chu',
] as const;

export const RET_SO_BASELINE_COLS = new Set<string>([
  'SO Number',
  'SO DocDate',
  'SO CreateDate',
  'SO Canceled',
  'Store',
  'Brand',
  'MC Docnum',
  'SO ShipDate',
  'Kho SO min',
  'Kho SO max',
]);

export const RET_AR_BASELINE_COLS = new Set<string>([
  'SO Number',
  'AR Number',
  'AR DocDate',
  'AR CreateDate',
  'AR ShipDate',
  'Invoice No',
]);

const RET_CHAIN_COLUMNS_SET = new Set<string>(RET_CHAIN_COLUMNS);
const RET_AR_NOINV_COLS_SET = new Set<string>(RET_AR_NOINV_COLS);

export interface ReturnChainRow extends SapRowRecord {
  Nhom: string;
  Store: SapCellValue;
  'Ten cua hang': string;
  Brand: SapCellValue;
  'SO Number': number;
  'SO DocDate': SapCellValue;
  'SO CreateDate': SapCellValue;
  'SO ShipDate': SapCellValue;
  'MC Docnum': SapCellValue;
  'Nguon SO': string;
  'SO Huy': string;
  'Kho xuat SO (TTVH)': string;
  'PO Number': string;
  'PO DocDate': SapCellValue;
  'PO CreateDate': SapCellValue;
  'Kho nhan PO (KBMD)': string;
  'Ten kho nhan (KBMD)': string;
  'DO Number': string;
  'AR Number': string;
  'Invoice No': string;
  'AR DocDate': SapCellValue;
  'AR CreateDate': SapCellValue;
  'AR ShipDate': SapCellValue;
  'Ghi chu ShipDate': string;
  'GRPO Number': string;
  'GRPO DocDate': SapCellValue;
  'Kho GRPO (KBMD)': string;
  'AP Number': string;
  'AP Invoice No': string;
  'AP DocDate': SapCellValue;
  'Trang thai chuoi chung tu': string;
}

export interface ReturnArRow extends SapRowRecord {
  Nhom: string;
  'SO ShipDate': SapCellValue;
  'SO Number': number;
  'AR Number': SapCellValue;
  'AR DocDate': SapCellValue;
  'AR CreateDate': SapCellValue;
  'AR ShipDate': SapCellValue;
  'Invoice No': SapCellValue;
}

export interface ReturnGrpoRow {
  Nhom: string;
  'SO Number': number;
  'GRPO Number': SapCellValue;
  has_ap: boolean;
}

export interface ReturnArNoInvRow extends SapRowRecord {
  Nhom: SapCellValue;
  Store: SapCellValue;
  'Ten cua hang': SapCellValue;
  'SO Number': SapCellValue;
  'SO DocDate': SapCellValue;
  'SO CreateDate': SapCellValue;
  'MC Docnum': SapCellValue;
  'PO Number': SapCellValue;
  'PO DocDate': SapCellValue;
  'PO CreateDate': SapCellValue;
  'SO ShipDate': SapCellValue;
  'AR Number': SapCellValue;
  'AR DocDate': SapCellValue;
  'AR CreateDate': SapCellValue;
  'AR ShipDate': SapCellValue;
  'Tuoi A/R (ngay)': number | null;
  'SO con A/R khac da xuat HD': string;
  'Trang thai SO': string;
  'Ghi chu': string;
}

export interface AssembledReturnChainResult {
  table: SapQueryResult;
  rows: ReturnChainRow[];
  arRows: ReturnArRow[];
  grpoRows: ReturnGrpoRow[];
  columns: string[];
  extraArCols: string[];
}

function groupBySoNumber(
  records: readonly SapRowRecord[],
): Map<number, SapRowRecord[]> {
  const map = new Map<number, SapRowRecord[]>();
  for (const r of records) {
    const soNum = Number(r['SO Number']);
    const list = map.get(soNum);
    if (list) {
      list.push(r);
    } else {
      map.set(soNum, [r]);
    }
  }
  return map;
}

/** Gom tập mã kho duy nhất từ 2 cột min/max, sắp xếp ASCII và nối bằng `', '` (`kho`, Mục 7.2). */
function kho(
  rows: readonly SapRowRecord[],
  loCol: string,
  hiCol: string,
): string {
  const vals = new Set<string>();
  for (const r of rows) {
    const lo = r[loCol];
    const hi = r[hiCol];
    if (hasValue(lo)) {
      vals.add(String(lo));
    }
    if (hasValue(hi)) {
      vals.add(String(hi));
    }
  }
  return Array.from(vals).sort(compareAscii).join(', ');
}

/** Ánh xạ chuỗi mã kho (ngăn cách bởi `', '`) sang tên kho từ `khoNameMap`, nối bằng `'; '` (`kho_names`, Mục 7.2). */
function khoNames(
  codes: string,
  khoNameMap: ReadonlyMap<string, string>,
): string {
  return codes
    .split(', ')
    .filter(Boolean)
    .map((c) => khoNameMap.get(c) ?? '')
    .join('; ');
}

/**
 * Ghép 7 bảng kết quả truy vấn luồng Trả thành 1 dòng / SO gồm 31 cột chuẩn (+ passthrough `extraSoCols`),
 * đồng thời trả về `arRows` và `grpoRows` phục vụ tính Phễu 6 bước (`assemble_return_chain`, Mục 7.2 Đặc tả v1.1).
 */
export function assembleReturnChain(
  results: Record<ReturnListQueryKey, SapQueryResult>,
  dateFrom = '',
  today: string = todayInVietnam(),
): AssembledReturnChainResult {
  const extraSoCols = results.so.columns.filter(
    (c) => !RET_SO_BASELINE_COLS.has(c) && !RET_CHAIN_COLUMNS_SET.has(c),
  );
  const extraArCols = results.ar.columns.filter(
    (c) => !RET_AR_BASELINE_COLS.has(c) && !RET_AR_NOINV_COLS_SET.has(c),
  );
  const soRecords = tableToRecords(results.so);
  const poBy = groupBySoNumber(tableToRecords(results.po));
  const doBy = groupBySoNumber(tableToRecords(results.do));
  const arBy = groupBySoNumber(tableToRecords(results.ar));
  const grpoBy = groupBySoNumber(tableToRecords(results.grpo));
  const apRecords = tableToRecords(results.ap);
  const apBy = groupBySoNumber(apRecords);
  const whsRecords = tableToRecords(results.whs);

  const grpoWithAp = new Set<string>(
    apRecords
      .filter((r) => hasValue(r['GRPO Number']))
      .map((r) => String(r['GRPO Number'])),
  );

  const storeNameMap = new Map<string, string>();
  const khoNameMap = new Map<string, string>();
  for (const r of whsRecords) {
    const code = hasValue(r['WhsCode']) ? String(r['WhsCode']) : '';
    if (!code) {
      continue;
    }
    const name =
      r['WhsName'] !== null && r['WhsName'] !== undefined
        ? String(r['WhsName'])
        : '';
    if (r['DB'] === 'T') {
      storeNameMap.set(code, name);
    } else if (r['DB'] === 'K') {
      khoNameMap.set(code, name);
    }
  }

  const sortedSo = [...soRecords].sort(
    (a, b) => Number(a['SO Number']) - Number(b['SO Number']),
  );

  const rows: ReturnChainRow[] = [];
  const arRows: ReturnArRow[] = [];
  const grpoRows: ReturnGrpoRow[] = [];
  const seen = new Set<number>();

  for (const so of sortedSo) {
    const n = Number(so['SO Number']);
    if (seen.has(n)) {
      continue;
    }
    seen.add(n);

    const po = poBy.get(n) ?? [];
    const doList = doBy.get(n) ?? [];
    const ar = arBy.get(n) ?? [];
    const grpo = grpoBy.get(n) ?? [];
    const ap = apBy.get(n) ?? [];

    const soShip = so['SO ShipDate'] ?? null;
    const ship = toSapDateString(soShip);
    const shipInFuture = ship !== null && ship > today;
    const hasInvoice = ar.some((r) => hasValue(r['Invoice No']));
    const isCanceled =
      String(so['SO Canceled'] ?? '').trim().toUpperCase() === 'Y';
    const isAuto = hasValue(so['MC Docnum']);
    const hasApInvoice = ap.some((r) => hasValue(r['AP Invoice No']));

    let status: string;
    let note = '';
    if (isCanceled) {
      status = RST_SO_CANCELED;
    } else if (po.length === 0 && !isAuto) {
      status = RST_MANUAL_SO;
    } else if (po.length === 0) {
      status = RST_NO_PO;
    } else if (ar.length === 0) {
      status = shipInFuture ? RST_NO_AR_WAIT_SHIP : RST_NO_AR;
      note = shipWaitText(soShip, 'SO ShipDate', 'A/R', today);
    } else if (!hasInvoice) {
      status = RST_AR_NO_INV;
    } else if (grpo.length === 0) {
      status = shipInFuture ? RST_NO_GRPO_WAIT_SHIP : RST_NO_GRPO;
      note = shipWaitText(soShip, 'SO ShipDate', 'GRPO', today);
    } else if (ap.length === 0) {
      status = RST_NO_AP;
    } else if (!hasApInvoice) {
      status = RST_AP_NO_INV;
    } else {
      status = RST_FULL;
    }

    const khoSo = kho([so], 'Kho SO min', 'Kho SO max');
    const khoPo = kho(po, 'Kho PO min', 'Kho PO max');
    const nhom = dateFrom ? poCohort(so['SO DocDate'], dateFrom) : NHOM_MOI;
    const storeCode = hasValue(so['Store']) ? String(so['Store']) : '';

    const chainRow: ReturnChainRow = {
      Nhom: nhom,
      Store: so['Store'] ?? null,
      'Ten cua hang': storeNameMap.get(storeCode) ?? '',
      Brand: so['Brand'] ?? null,
      'SO Number': n,
      'SO DocDate': so['SO DocDate'] ?? null,
      'SO CreateDate': so['SO CreateDate'] ?? null,
      'SO ShipDate': soShip,
      'MC Docnum': so['MC Docnum'] ?? null,
      'Nguon SO': isAuto ? 'AUTO' : 'THỦ CÔNG',
      'SO Huy': isCanceled ? 'Đã hủy' : '',
      'Kho xuat SO (TTVH)': khoSo,
      'PO Number': joinNums(po, 'PO Number'),
      'PO DocDate': latestValue(po, 'PO DocDate'),
      'PO CreateDate': latestValue(po, 'PO CreateDate'),
      'Kho nhan PO (KBMD)': khoPo,
      'Ten kho nhan (KBMD)': khoNames(khoPo, khoNameMap),
      'DO Number': joinNums(doList, 'DO Number'),
      'AR Number': joinNums(ar, 'AR Number'),
      'Invoice No': joinNums(ar, 'Invoice No'),
      'AR DocDate': latestValue(ar, 'AR DocDate'),
      'AR CreateDate': latestValue(ar, 'AR CreateDate'),
      'AR ShipDate': latestValue(ar, 'AR ShipDate'),
      'Ghi chu ShipDate': note,
      'GRPO Number': joinNums(grpo, 'GRPO Number'),
      'GRPO DocDate': latestValue(grpo, 'GRPO DocDate'),
      'Kho GRPO (KBMD)': kho(grpo, 'Kho GRPO min', 'Kho GRPO max'),
      'AP Number': joinNums(ap, 'AP Number'),
      'AP Invoice No': joinNums(ap, 'AP Invoice No'),
      'AP DocDate': latestValue(ap, 'AP DocDate'),
      'Trang thai chuoi chung tu': status,
    };
    for (const col of extraSoCols) {
      chainRow[col] = so[col] ?? null;
    }
    rows.push(chainRow);

    for (const r of ar) {
      arRows.push({
        ...r,
        Nhom: nhom,
        'SO ShipDate': soShip,
        'SO Number': n,
        'AR Number': r['AR Number'] ?? null,
        'AR DocDate': r['AR DocDate'] ?? null,
        'AR CreateDate': r['AR CreateDate'] ?? null,
        'AR ShipDate': r['AR ShipDate'] ?? null,
        'Invoice No': r['Invoice No'] ?? null,
      });
    }

    for (const g of grpo) {
      const grpoNum = g['GRPO Number'] ?? null;
      grpoRows.push({
        Nhom: nhom,
        'SO Number': n,
        'GRPO Number': grpoNum,
        has_ap: hasValue(grpoNum) && grpoWithAp.has(String(grpoNum)),
      });
    }
  }

  const columns = [...RET_CHAIN_COLUMNS, ...extraSoCols];
  return {
    table: recordsToTable(columns, rows),
    rows,
    arRows,
    grpoRows,
    columns,
    extraArCols,
  };
}

/**
 * Xây dựng danh sách 19 cột các chứng từ A/R (TTVH) chưa xuất hóa đơn theo SO,
 * kèm ghi chú chéo nếu SO có A/R khác đã xuất HĐ và sắp xếp theo tuổi A/R giảm dần (`build_return_ar_noinv`, Mục 7.4).
 */
export function buildReturnArNoInv(
  rows: readonly ReturnChainRow[],
  arRows: readonly ReturnArRow[],
  today: string = todayInVietnam(),
  extraArCols: readonly string[] = [],
): ReturnArNoInvRow[] {
  const soBy = new Map<number, ReturnChainRow>();
  for (const r of rows) {
    soBy.set(Number(r['SO Number']), r);
  }

  const invBySo = new Map<number, SapCellValue[]>();
  for (const a of arRows) {
    if (hasValue(a['Invoice No'])) {
      const soNum = Number(a['SO Number']);
      const list = invBySo.get(soNum);
      if (list) {
        list.push(a['AR Number'] ?? null);
      } else {
        invBySo.set(soNum, [a['AR Number'] ?? null]);
      }
    }
  }

  const out: ReturnArNoInvRow[] = [];
  for (const a of arRows) {
    if (hasValue(a['Invoice No'])) {
      continue;
    }
    const soNum = Number(a['SO Number']);
    const so = soBy.get(soNum);
    const created = toSapDateString(a['AR CreateDate']);
    const sibling = invBySo.get(soNum);
    const status = String(so?.['Trang thai chuoi chung tu'] ?? '');

    let note = '';
    if (sibling && sibling.length > 0 && status !== RST_AR_NO_INV) {
      note =
        'SO đã được xếp vào bước sau vì có A/R khác đã xuất HĐ – A/R này vẫn thiếu HĐ';
    }

    const row: ReturnArNoInvRow = {
      Nhom: a['Nhom'] ?? null,
      Store: so?.['Store'] ?? null,
      'Ten cua hang': so?.['Ten cua hang'] ?? null,
      'SO Number': a['SO Number'] ?? soNum,
      'SO DocDate': so?.['SO DocDate'] ?? null,
      'SO CreateDate': so?.['SO CreateDate'] ?? null,
      'MC Docnum': so?.['MC Docnum'] ?? null,
      'PO Number': so?.['PO Number'] ?? null,
      'PO DocDate': so?.['PO DocDate'] ?? null,
      'PO CreateDate': so?.['PO CreateDate'] ?? null,
      'SO ShipDate': a['SO ShipDate'] ?? null,
      'AR Number': a['AR Number'] ?? null,
      'AR DocDate': a['AR DocDate'] ?? null,
      'AR CreateDate': a['AR CreateDate'] ?? null,
      'AR ShipDate': a['AR ShipDate'] ?? null,
      'Tuoi A/R (ngay)': created !== null ? diffDays(today, created) : null,
      'SO con A/R khac da xuat HD':
        sibling && sibling.length > 0
          ? sibling.map((x) => String(x ?? '')).join(', ')
          : '',
      'Trang thai SO': status,
      'Ghi chu': note,
    };
    for (const col of extraArCols) {
      row[col] = a[col] ?? null;
    }
    out.push(row);
  }

  return out.sort(
    (a, b) =>
      Number(b['Tuoi A/R (ngay)'] || 0) - Number(a['Tuoi A/R (ngay)'] || 0) ||
      compareAscii(String(a['AR Number'] ?? ''), String(b['AR Number'] ?? '')),
  );
}
