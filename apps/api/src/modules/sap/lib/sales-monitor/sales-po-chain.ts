// Ghép nối 5 truy vấn chuỗi chứng từ (PO -> SO -> A/R -> GRPO -> AP) thành bảng 23 cột theo từng PO
// và xây dựng tập bản ghi `chainAr`, `chainGrpo` phục vụ phễu chuyển đổi và bảng chứng từ treo.
// Nguồn đối chiếu 1:1: desktop `sales_flow_checker.py` (:2356-2369, :2746-2812, :3114-3123).
import type { SalesChainQueryKey } from '../../queries/sales-monitor-queries';
import type { SapQueryResult } from '../sap-row-normalizer';
import { poCohort } from './sales-cohort';
import {
  type SapRowRecord,
  hasValue,
  joinNums,
  latestValue,
  recordsToTable,
  shipWaitText,
  tableToRecords,
  toSapDateString,
} from './sales-monitor-helpers';

export const ST_NO_SO = '1 - Chưa có SO';
export const ST_NO_AR = '2 - Có SO, chưa có A/R';
export const ST_NO_AR_WAIT_SHIP =
  '2a - Có SO, chưa có A/R: SO ShipDate > hôm nay, chưa đến ngày xuất hàng (bình thường)';
export const ST_AR_NO_INV = '3 - Có A/R, chưa xuất hóa đơn';
export const ST_AR_NO_INV_BACKDATED =
  '3a - Có A/R chưa xuất HĐ: A/R tạo hôm nay, posting lùi ngày (HĐ tự xuất chỉ trong ngày - không phải lỗi)';
export const ST_AR_NO_GRPO = '4 - A/R đã xuất HĐ, chưa có GRPO';
export const ST_AR_NO_GRPO_WAIT_SHIP =
  '4a - A/R đã xuất HĐ, chưa có GRPO: AR ShipDate > hôm nay, chờ đến ngày (bình thường)';
export const ST_NO_AP = '5 - Có GRPO, chưa có AP';
export const ST_FULL = '6 - Đủ chuỗi PO → AP';

export const CHAIN_STATUS_ORDER = [
  ST_NO_SO,
  ST_NO_AR,
  ST_NO_AR_WAIT_SHIP,
  ST_AR_NO_INV,
  ST_AR_NO_INV_BACKDATED,
  ST_AR_NO_GRPO,
  ST_AR_NO_GRPO_WAIT_SHIP,
  ST_NO_AP,
  ST_FULL,
] as const;

export const CHAIN_COLUMNS = [
  'Nhom',
  'Store',
  'PO Number',
  'PO DocDate',
  'PO CreateDate',
  'PO tao truoc ky',
  'PO Status',
  'So dong PO',
  'Tong SL PO',
  'SO Number',
  'SO CreateDate',
  'SO ShipDate',
  'AR Number',
  'Invoice No',
  'AR DocDate',
  'AR CreateDate',
  'AR ShipDate',
  'Ghi chu ShipDate',
  'GRPO Number',
  'GRPO DocDate',
  'AP Number',
  'AP DocDate',
  'Trang thai chuoi chung tu',
] as const;

export interface ChainGrpoRecord {
  Nhom: string;
  'PO Number': number;
  'GRPO Number': number;
  has_ap: boolean;
}

export interface AssembledPoChainResult {
  table: SapQueryResult;
  rows: SapRowRecord[];
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

/** Ghép 5 kết quả truy vấn chuỗi thành 1 dòng / PO gồm 23 cột (`assemble_po_chain`, `:2746-2812`). */
export function assemblePoChain(
  chainResults: Record<SalesChainQueryKey, SapQueryResult>,
  dateFrom: string,
  today: string,
): AssembledPoChainResult {
  const poRecords = tableToRecords(chainResults.po);
  const soBy = groupByPoNumber(tableToRecords(chainResults.so));
  const arBy = groupByPoNumber(tableToRecords(chainResults.ar));
  const grpoBy = groupByPoNumber(tableToRecords(chainResults.grpo));
  const apBy = groupByPoNumber(tableToRecords(chainResults.ap));

  const cutoff = toSapDateString(dateFrom) ?? '';
  const sortedPo = [...poRecords].sort(
    (a, b) => Number(a['PO Number']) - Number(b['PO Number']),
  );

  const rows: SapRowRecord[] = [];

  for (const po of sortedPo) {
    const n = Number(po['PO Number']);
    const so = soBy.get(n) ?? [];
    const ar = arBy.get(n) ?? [];
    const grpo = grpoBy.get(n) ?? [];
    const ap = apBy.get(n) ?? [];
    const hasInvoice = ar.some((r) => hasValue(r['Invoice No']));

    let status: string;
    if (so.length === 0) {
      status = ST_NO_SO;
    } else if (ar.length === 0) {
      const soShip = toSapDateString(latestValue(so, 'SO ShipDate'));
      status =
        soShip !== null && soShip > today ? ST_NO_AR_WAIT_SHIP : ST_NO_AR;
    } else if (!hasInvoice) {
      const allBackdated = ar.every((r) => {
        const created = toSapDateString(r['AR CreateDate']);
        const posted = toSapDateString(r['AR DocDate']);
        return created === today && posted !== null && posted < today;
      });
      status = allBackdated ? ST_AR_NO_INV_BACKDATED : ST_AR_NO_INV;
    } else if (grpo.length === 0) {
      const arShip = toSapDateString(latestValue(ar, 'AR ShipDate'));
      status =
        arShip !== null && arShip > today
          ? ST_AR_NO_GRPO_WAIT_SHIP
          : ST_AR_NO_GRPO;
    } else if (ap.length === 0) {
      status = ST_NO_AP;
    } else {
      status = ST_FULL;
    }

    const createdRaw = po['PO CreateDate'] ?? null;
    const createdDate = toSapDateString(createdRaw);
    const poTaoTruocKy =
      createdDate !== null && cutoff !== '' && createdDate < cutoff
        ? 'Co'
        : 'Khong';

    let ghiChuShipDate = '';
    if (hasInvoice && grpo.length === 0) {
      ghiChuShipDate = shipWaitText(
        latestValue(ar, 'AR ShipDate'),
        'AR ShipDate',
        'GRPO',
        today,
      );
    } else if (so.length > 0 && ar.length === 0) {
      ghiChuShipDate = shipWaitText(
        latestValue(so, 'SO ShipDate'),
        'SO ShipDate',
        'A/R',
        today,
      );
    }

    rows.push({
      Nhom: poCohort(po['PO DocDate'], dateFrom),
      Store: po['Store'] ?? null,
      'PO Number': po['PO Number'] ?? n,
      'PO DocDate': po['PO DocDate'] ?? null,
      'PO CreateDate': createdRaw,
      'PO tao truoc ky': poTaoTruocKy,
      'PO Status': po['PO Status'] ?? null,
      'So dong PO': po['So dong PO'] ?? null,
      'Tong SL PO': po['Tong SL PO'] ?? null,
      'SO Number': joinNums(so, 'SO Number'),
      'SO CreateDate': latestValue(so, 'SO CreateDate'),
      'SO ShipDate': latestValue(so, 'SO ShipDate'),
      'AR Number': joinNums(ar, 'AR Number'),
      'Invoice No': joinNums(ar, 'Invoice No'),
      'AR DocDate': latestValue(ar, 'AR DocDate'),
      'AR CreateDate': latestValue(ar, 'AR CreateDate'),
      'AR ShipDate': latestValue(ar, 'AR ShipDate'),
      'Ghi chu ShipDate': ghiChuShipDate,
      'GRPO Number': joinNums(grpo, 'GRPO Number'),
      'GRPO DocDate': latestValue(grpo, 'GRPO DocDate'),
      'AP Number': joinNums(ap, 'AP Number'),
      'AP DocDate': latestValue(ap, 'AP DocDate'),
      'Trang thai chuoi chung tu': status,
    });
  }

  return { table: recordsToTable(CHAIN_COLUMNS, rows), rows };
}

/** Dựng danh sách `chainAr` và `chainGrpo` (khử trùng lặp GRPO theo thứ tự trả về từ SQL Server, `:3114-3123`). */
export function buildChainArAndGrpo(
  chainResults: Record<SalesChainQueryKey, SapQueryResult>,
  chainRows: readonly SapRowRecord[],
): { chainAr: SapRowRecord[]; chainGrpo: ChainGrpoRecord[] } {
  const poGroup = new Map<number, string>();
  for (const r of chainRows) {
    poGroup.set(Number(r['PO Number']), String(r['Nhom'] ?? ''));
  }

  const chainAr: SapRowRecord[] = [];
  for (const r of tableToRecords(chainResults.ar)) {
    const nhom = poGroup.get(Number(r['PO Number']));
    if (nhom !== undefined) {
      chainAr.push({ ...r, Nhom: nhom });
    }
  }

  const grpoWithAp = new Set<number>(
    tableToRecords(chainResults.ap).map((r) => Number(r['GRPO Number'])),
  );
  const seenGrpo = new Set<number>();
  const chainGrpo: ChainGrpoRecord[] = [];

  for (const r of tableToRecords(chainResults.grpo)) {
    const poNum = Number(r['PO Number']);
    const grpoNum = Number(r['GRPO Number']);
    const nhom = poGroup.get(poNum);
    if (nhom !== undefined && !seenGrpo.has(grpoNum)) {
      seenGrpo.add(grpoNum);
      chainGrpo.push({
        Nhom: nhom,
        'PO Number': poNum,
        'GRPO Number': grpoNum,
        has_ap: grpoWithAp.has(grpoNum),
      });
    }
  }

  return { chainAr, chainGrpo };
}
