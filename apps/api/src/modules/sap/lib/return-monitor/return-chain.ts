// Xây dựng chuỗi chứng từ trả hàng 28 cột theo từng PO (assembleReturnChain)
// và bảng 15 cột A/R chưa xuất hóa đơn (buildReturnArNoInv).
// Nguồn đối chiếu 1:1: desktop `sales_flow_checker.py` (:3419-3430, :3513-3598, :3657-3691).
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

export const RST_NO_SO = '1 - PO chưa sync sang SO (TTVH)';
export const RST_NO_AR = '2 - Có SO, chưa có A/R (TTVH)';
export const RST_NO_AR_WAIT_SHIP =
  '2a - Có SO, chưa có A/R: SO ShipDate > hôm nay, chưa đến ngày xuất hàng (bình thường)';
export const RST_AR_NO_INV = '3 - Có A/R, chưa xuất hóa đơn';
export const RST_NO_GRPO = '4 - A/R đã xuất HĐ, chưa có GRPO (KBMD)';
export const RST_NO_GRPO_WAIT_SHIP =
  '4a - A/R đã xuất HĐ, chưa có GRPO: SO ShipDate > hôm nay, chờ đến ngày (bình thường)';
export const RST_NO_AP = '5 - Có GRPO, chưa có AP (KBMD)';
export const RST_FULL = '6 - Đủ chuỗi PO → AP';

export const RET_STATUS_ORDER = [
  RST_NO_SO,
  RST_NO_AR,
  RST_NO_AR_WAIT_SHIP,
  RST_AR_NO_INV,
  RST_NO_GRPO,
  RST_NO_GRPO_WAIT_SHIP,
  RST_NO_AP,
  RST_FULL,
] as const;

export type ReturnStatusLabel = (typeof RET_STATUS_ORDER)[number];

export const RET_WAIT_STATUSES = new Set<string>([
  RST_NO_AR_WAIT_SHIP,
  RST_NO_GRPO_WAIT_SHIP,
]);

export const RET_CHAIN_COLUMNS = [
  'Nhom',
  'Store',
  'Ten cua hang',
  'Brand',
  'PO Number',
  'PO DocDate',
  'PO CreateDate',
  'MC Docnum',
  'Kho nhan PO (KBMD)',
  'Ten kho nhan (KBMD)',
  'SO Number',
  'SO DocDate',
  'SO CreateDate',
  'SO ShipDate',
  'Kho xuat SO (TTVH)',
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
  'AP DocDate',
  'Trang thai chuoi chung tu',
] as const;

export const RET_AR_NOINV_COLS = [
  'Nhom',
  'Store',
  'Ten cua hang',
  'PO Number',
  'MC Docnum',
  'SO Number',
  'SO ShipDate',
  'AR Number',
  'AR DocDate',
  'AR CreateDate',
  'AR ShipDate',
  'Tuoi A/R (ngay)',
  'PO con A/R khac da xuat HD',
  'Trang thai PO',
  'Ghi chu',
] as const;

export interface ReturnChainRow extends SapRowRecord {
  Nhom: string;
  Store: SapCellValue;
  'Ten cua hang': string;
  Brand: SapCellValue;
  'PO Number': number;
  'PO DocDate': SapCellValue;
  'PO CreateDate': SapCellValue;
  'MC Docnum': SapCellValue;
  'Kho nhan PO (KBMD)': string;
  'Ten kho nhan (KBMD)': string;
  'SO Number': string;
  'SO DocDate': SapCellValue;
  'SO CreateDate': SapCellValue;
  'SO ShipDate': SapCellValue;
  'Kho xuat SO (TTVH)': string;
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
  'AP DocDate': SapCellValue;
  'Trang thai chuoi chung tu': string;
}

export interface ReturnArRow extends SapRowRecord {
  Nhom: string;
  'SO ShipDate': SapCellValue;
  'PO Number': number;
  'AR Number': SapCellValue;
  'AR DocDate': SapCellValue;
  'AR CreateDate': SapCellValue;
  'AR ShipDate': SapCellValue;
  'Invoice No': SapCellValue;
}

export interface ReturnGrpoRow {
  Nhom: string;
  'PO Number': number;
  'GRPO Number': SapCellValue;
  has_ap: boolean;
}

export interface ReturnArNoInvRow extends SapRowRecord {
  Nhom: SapCellValue;
  Store: SapCellValue;
  'Ten cua hang': SapCellValue;
  'PO Number': SapCellValue;
  'MC Docnum': SapCellValue;
  'SO Number': SapCellValue;
  'SO ShipDate': SapCellValue;
  'AR Number': SapCellValue;
  'AR DocDate': SapCellValue;
  'AR CreateDate': SapCellValue;
  'AR ShipDate': SapCellValue;
  'Tuoi A/R (ngay)': number | null;
  'PO con A/R khac da xuat HD': string;
  'Trang thai PO': string;
  'Ghi chu': string;
}

export interface AssembledReturnChainResult {
  table: SapQueryResult;
  rows: ReturnChainRow[];
  arRows: ReturnArRow[];
  grpoRows: ReturnGrpoRow[];
}

function groupByPoNumber(
  records: readonly SapRowRecord[],
): Map<number, SapRowRecord[]> {
  const map = new Map<number, SapRowRecord[]>();
  for (const r of records) {
    const poNum = Number(r['PO Number']);
    const list = map.get(poNum);
    if (list) {
      list.push(r);
    } else {
      map.set(poNum, [r]);
    }
  }
  return map;
}

/** Gom tập mã kho duy nhất từ 2 cột min/max, sắp xếp ASCII và nối bằng `', '` (`kho`, `:3535-3538`). */
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

/** Ánh xạ chuỗi mã kho (ngăn cách bởi `', '`) sang tên kho từ `khoNameMap`, nối bằng `'; '` (`kho_names`, `:3540-3541`). */
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
 * Ghép 7 bảng kết quả truy vấn luồng Trả thành 1 dòng / PO gồm 28 cột,
 * đồng thời trả về `arRows` và `grpoRows` phục vụ tính Phễu (`assemble_return_chain`, `:3513-3598`).
 */
export function assembleReturnChain(
  results: Record<ReturnListQueryKey, SapQueryResult>,
  dateFrom = '',
  today: string = todayInVietnam(),
): AssembledReturnChainResult {
  const poRecords = tableToRecords(results.po);
  const soBy = groupByPoNumber(tableToRecords(results.so));
  const doBy = groupByPoNumber(tableToRecords(results.do));
  const arBy = groupByPoNumber(tableToRecords(results.ar));
  const grpoBy = groupByPoNumber(tableToRecords(results.grpo));
  const apRecords = tableToRecords(results.ap);
  const apBy = groupByPoNumber(apRecords);
  const whsRecords = tableToRecords(results.whs);

  const grpoWithAp = new Set<string>(
    apRecords
      .filter((r) => hasValue(r['GRPO Number']))
      .map((r) => String(r['GRPO Number'])),
  );

  // Bẫy 2: Tách OWHS theo DB ('T' -> storeNameMap cho TTVH, 'K' -> khoNameMap cho KBMD)
  const storeNameMap = new Map<string, string>();
  const khoNameMap = new Map<string, string>();
  for (const r of whsRecords) {
    const code = hasValue(r['WhsCode']) ? String(r['WhsCode']) : '';
    if (!code) {
      continue;
    }
    const name = r['WhsName'] !== null && r['WhsName'] !== undefined ? String(r['WhsName']) : '';
    if (r['DB'] === 'T') {
      storeNameMap.set(code, name);
    } else if (r['DB'] === 'K') {
      khoNameMap.set(code, name);
    }
  }

  // Bẫy 1: Sắp xếp số học PO Number tăng dần, giữ bản ghi đầu tiên của mỗi PO Number
  const sortedPo = [...poRecords].sort(
    (a, b) => Number(a['PO Number']) - Number(b['PO Number']),
  );

  const rows: ReturnChainRow[] = [];
  const arRows: ReturnArRow[] = [];
  const grpoRows: ReturnGrpoRow[] = [];
  const seen = new Set<number>();

  for (const po of sortedPo) {
    const n = Number(po['PO Number']);
    if (seen.has(n)) {
      continue;
    }
    seen.add(n);

    const so = soBy.get(n) ?? [];
    const doList = doBy.get(n) ?? [];
    const ar = arBy.get(n) ?? [];
    const grpo = grpoBy.get(n) ?? [];
    const ap = apBy.get(n) ?? [];

    const soShip = latestValue(so, 'SO ShipDate');
    const ship = toSapDateString(soShip);
    // Bẫy 3: Cả bước 2 và bước 4 đều xét SO ShipDate > today
    const shipInFuture = ship !== null && ship > today;
    const hasInvoice = ar.some((r) => hasValue(r['Invoice No']));

    let status: string;
    let note = '';
    if (so.length === 0) {
      status = RST_NO_SO;
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
    } else {
      status = RST_FULL;
    }

    const khoPo = kho([po], 'Kho PO min', 'Kho PO max');
    const nhom = dateFrom ? poCohort(po['PO DocDate'], dateFrom) : NHOM_MOI;
    const storeCode = hasValue(po['Store']) ? String(po['Store']) : '';

    rows.push({
      Nhom: nhom,
      Store: po['Store'] ?? null,
      'Ten cua hang': storeNameMap.get(storeCode) ?? '',
      Brand: po['Brand'] ?? null,
      'PO Number': n,
      'PO DocDate': po['PO DocDate'] ?? null,
      'PO CreateDate': po['PO CreateDate'] ?? null,
      'MC Docnum': po['MC Docnum'] ?? null,
      'Kho nhan PO (KBMD)': khoPo,
      'Ten kho nhan (KBMD)': khoNames(khoPo, khoNameMap),
      'SO Number': joinNums(so, 'SO Number'),
      'SO DocDate': latestValue(so, 'SO DocDate'),
      'SO CreateDate': latestValue(so, 'SO CreateDate'),
      'SO ShipDate': soShip,
      'Kho xuat SO (TTVH)': kho(so, 'Kho SO min', 'Kho SO max'),
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
      'AP DocDate': latestValue(ap, 'AP DocDate'),
      'Trang thai chuoi chung tu': status,
    });

    for (const r of ar) {
      arRows.push({
        ...r,
        Nhom: nhom,
        'SO ShipDate': soShip,
        'PO Number': n,
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
        'PO Number': n,
        'GRPO Number': grpoNum,
        has_ap: hasValue(grpoNum) && grpoWithAp.has(String(grpoNum)),
      });
    }
  }

  return {
    table: recordsToTable(RET_CHAIN_COLUMNS, rows),
    rows,
    arRows,
    grpoRows,
  };
}

/**
 * Xây dựng danh sách 15 cột các chứng từ A/R (TTVH) chưa xuất hóa đơn,
 * kèm ghi chú chéo nếu PO có A/R khác đã xuất HĐ và sắp xếp theo tuổi A/R giảm dần (`build_return_ar_noinv`, `:3662-3691`).
 */
export function buildReturnArNoInv(
  rows: readonly ReturnChainRow[],
  arRows: readonly ReturnArRow[],
  today: string = todayInVietnam(),
): ReturnArNoInvRow[] {
  const poBy = new Map<number, ReturnChainRow>();
  for (const r of rows) {
    poBy.set(Number(r['PO Number']), r);
  }

  const invByPo = new Map<number, SapCellValue[]>();
  for (const a of arRows) {
    if (hasValue(a['Invoice No'])) {
      const poNum = Number(a['PO Number']);
      const list = invByPo.get(poNum);
      if (list) {
        list.push(a['AR Number'] ?? null);
      } else {
        invByPo.set(poNum, [a['AR Number'] ?? null]);
      }
    }
  }

  const out: ReturnArNoInvRow[] = [];
  for (const a of arRows) {
    if (hasValue(a['Invoice No'])) {
      continue;
    }
    const poNum = Number(a['PO Number']);
    const po = poBy.get(poNum);
    const created = toSapDateString(a['AR CreateDate']);
    const sibling = invByPo.get(poNum);
    const status = String(po?.['Trang thai chuoi chung tu'] ?? '');

    // Bẫy 5: Ghi chú khi PO đã sang bước sau vì có A/R khác đã xuất HĐ
    let note = '';
    if (sibling && sibling.length > 0 && status !== RST_AR_NO_INV) {
      note =
        'PO đã được xếp vào bước sau vì có A/R khác đã xuất HĐ – A/R này vẫn thiếu HĐ';
    }

    out.push({
      Nhom: a['Nhom'] ?? null,
      Store: po?.['Store'] ?? null,
      'Ten cua hang': po?.['Ten cua hang'] ?? null,
      'PO Number': a['PO Number'] ?? poNum,
      'MC Docnum': po?.['MC Docnum'] ?? null,
      'SO Number': po?.['SO Number'] ?? null,
      'SO ShipDate': a['SO ShipDate'] ?? null,
      'AR Number': a['AR Number'] ?? null,
      'AR DocDate': a['AR DocDate'] ?? null,
      'AR CreateDate': a['AR CreateDate'] ?? null,
      'AR ShipDate': a['AR ShipDate'] ?? null,
      'Tuoi A/R (ngay)': created !== null ? diffDays(today, created) : null,
      'PO con A/R khac da xuat HD':
        sibling && sibling.length > 0
          ? sibling.map((x) => String(x ?? '')).join(', ')
          : '',
      'Trang thai PO': status,
      'Ghi chu': note,
    });
  }

  return out.sort(
    (a, b) =>
      Number(b['Tuoi A/R (ngay)'] || 0) - Number(a['Tuoi A/R (ngay)'] || 0) ||
      compareAscii(String(a['AR Number'] ?? ''), String(b['AR Number'] ?? '')),
  );
}
