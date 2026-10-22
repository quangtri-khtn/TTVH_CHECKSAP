// Pure domain helpers cho màn hình Monitor Bán hàng (/sap/monitor-ban):
// lọc bảng theo Nhóm PO, giải quyết dữ liệu drilldown, đếm dòng danh sách, định dạng ô và thông báo lỗi.
import { ApiError } from '@/lib/api/http-client';
import type {
  SalesMonitorDataDto,
  SalesMonitorDocStatusDto,
  SalesMonitorListsDto,
} from '@/lib/api/generated/model';

export type SapCellValue = string | number | boolean | null;
export type CohortFilter = 'moi' | 'cu' | 'tatCa';
export type SalesViewKey = keyof SalesMonitorListsDto;
export type SalesDocStatusKey = keyof SalesMonitorDocStatusDto;
export type ExportSourceType = 'view' | 'funnel' | 'docStatus';

export type DrilldownSource =
  | { type: 'funnel'; stepIndex: number }
  | { type: 'docStatus'; key: SalesDocStatusKey }
  | null;

export interface ResolvedGridData {
  columns: string[];
  rows: SapCellValue[][];
  drilldownTitle: string | null;
  exportSourceType: ExportSourceType;
  exportSourceKey: string;
}

export function getYesterdaySapDate(now: Date = new Date()): string {
  const yesterday = new Date(now.getTime() - 86_400_000);
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(yesterday);
  return iso.replaceAll('-', '');
}

export const DEFAULT_SALES_DATE_FROM = getYesterdaySapDate();
export const DEFAULT_SALES_BRAND = '5001';

export const SALES_BRAND_OPTIONS = [
  { value: '5001', label: '5001 — Maycha' },
  { value: '5002', label: '5002 — Tam Hảo' },
  { value: '5003', label: '5003 — HO - DCCK' },
  { value: '5004', label: '5004 — Cloud Kitchen' },
  { value: '5005', label: '5005 — Gà Giòn Sốt 3 Cô Gái' },
  { value: '5006', label: '5006 — Trà Hú' },
  { value: '5007', label: '5007 — Thức Coffee' },
] as const;

export const CONV_HEADERS = [
  'Bước chuyển', 'Đơn vị', 'Đầu vào', 'Thành công', 'Tỷ lệ',
  'Chưa thành công', 'Chờ đến ngày (bình thường)', 'Cần xử lý',
] as const;

export const COHORT_OPTIONS = [
  { value: 'moi', label: 'Nhóm mới' },
  { value: 'cu', label: 'Nhóm cũ' },
  { value: 'tatCa', label: 'Tất cả' },
] as const;

export const MONITOR_VIEW_OPTIONS = [
  { key: 'overview', label: 'Tổng quan theo cửa hàng', isAlert: false },
  { key: 'chain', label: 'Chi tiết theo PO', isAlert: false },
  { key: 't1', label: 'T1 – PO chưa có SO', isAlert: true },
  { key: 't2', label: 'T2 – SO chưa có AR', isAlert: true },
  { key: 't3', label: 'T3 – AR đã xuất HĐ, chưa có GRPO', isAlert: true },
  { key: 't4', label: 'T4 – GRPO chưa có AP', isAlert: true },
  { key: 'ar', label: 'A/R trong kỳ', isAlert: false },
  { key: 'grpo', label: 'GRPO trong kỳ', isAlert: false },
  { key: 'ap', label: 'AP trong kỳ', isAlert: false },
] as const satisfies readonly { key: SalesViewKey; label: string; isAlert: boolean }[];

export const DOC_STATUS_META = [
  { key: 'po_no_so', label: '1 - PO chưa có SO', unit: 'PO', tag: 'attn' },
  { key: 'so_no_ar', label: '2a - SO chưa có A/R (đã đến/qua SO ShipDate, cần kiểm tra)', unit: 'SO', tag: 'attn' },
  { key: 'so_no_ar_wait', label: '2b - SO chưa có A/R: SO ShipDate > hôm nay, chưa đến ngày xuất hàng (bình thường)', unit: 'SO', tag: 'normal' },
  { key: 'ar_no_inv', label: '3a - A/R chưa xuất hóa đơn (cần xử lý)', unit: 'A/R', tag: 'attn' },
  { key: 'ar_no_inv_bd', label: '3b - A/R chưa xuất HĐ: tạo hôm nay, posting lùi ngày (HĐ tự xuất chỉ trong ngày - không phải lỗi)', unit: 'A/R', tag: 'normal' },
  { key: 'ar_no_grpo', label: '4a - A/R đã xuất HĐ, PO chưa có GRPO (cần xử lý)', unit: 'A/R', tag: 'attn' },
  { key: 'ar_no_grpo_wait', label: '4b - A/R đã xuất HĐ, PO chưa có GRPO: AR ShipDate > hôm nay, chờ đến ngày (bình thường)', unit: 'A/R', tag: 'normal' },
  { key: 'grpo_no_ap', label: '5 - GRPO chưa có AP', unit: 'GRPO', tag: 'attn' },
  { key: 'po_full', label: '6 - PO đủ chuỗi PO → AP', unit: 'PO', tag: '' },
] as const satisfies readonly { key: SalesDocStatusKey; label: string; unit: string; tag: 'attn' | 'normal' | '' }[];

export const FUNNEL_ROW_KEYS: readonly (readonly SalesDocStatusKey[])[] = [
  ['po_no_so'],
  ['so_no_ar', 'so_no_ar_wait'],
  ['ar_no_inv', 'ar_no_inv_bd'],
  ['ar_no_grpo', 'ar_no_grpo_wait'],
  ['grpo_no_ap'],
];

const FUNNEL_STEP_FALLBACKS = [
  { header: '1. PO → SO', unit: 'PO' },
  { header: '2. SO → A/R', unit: 'SO' },
  { header: '3. A/R → xuất hóa đơn', unit: 'A/R' },
  { header: '4. A/R đã xuất HĐ → GRPO', unit: 'A/R' },
  { header: '5. GRPO → AP', unit: 'GRPO' },
] as const;

const RAW_IDENTIFIER_COLUMNS: Record<string, true> = {
  Store: true, 'PO Number': true, 'SO Number': true, 'AR Number': true,
  'GRPO Number': true, 'AP Number': true, 'PO DocEntry': true, 'Invoice No': true,
};

const KNOWN_NUMERIC_COLUMNS: Record<string, true> = {
  PO: true, SO: true, 'A/R': true, 'A/R đã có HĐ': true, GRPO: true, AP: true,
  'T1 PO chưa SO': true, 'T2 SO chưa A/R': true, 'T3 A/R chưa GRPO': true, 'T4 GRPO chưa AP': true,
  'Treo cần xử lý (T1+T3+T4)': true, 'So dong PO': true, 'Tong SL PO': true, 'Tuoi A/R (ngay)': true,
};

export function filterTableByCohort(
  columns: readonly string[],
  rows: readonly (readonly SapCellValue[])[],
  cohort: CohortFilter,
): SapCellValue[][] {
  if (cohort === 'tatCa' || rows.length === 0) return rows.map((r) => [...r]);
  const nhomColIdx = columns.indexOf('Nhom');
  if (nhomColIdx === -1) return rows.map((r) => [...r]);
  const targetLabel = cohort === 'moi' ? 'Mới' : 'Cũ';
  return rows.filter((r) => r[nhomColIdx] === targetLabel).map((r) => [...r]);
}

export function resolveActiveGridData(
  data: SalesMonitorDataDto | undefined,
  selectedViewKey: SalesViewKey,
  selectedCohort: CohortFilter,
  drilldownSource: DrilldownSource,
): ResolvedGridData {
  if (!data) {
    return { columns: [], rows: [], drilldownTitle: null, exportSourceType: 'view', exportSourceKey: selectedViewKey };
  }

  if (drilldownSource?.type === 'funnel') {
    const { stepIndex } = drilldownSource;
    const keys = FUNNEL_ROW_KEYS[stepIndex];
    if (keys && keys.length > 0) {
      const columns = [...data.docStatus[keys[0]!].columns];
      const mergedRows = keys.flatMap((k) => data.docStatus[k].rows);
      const filteredRows = filterTableByCohort(columns, mergedRows, selectedCohort);
      const stepObj = data.cohorts[selectedCohort]?.funnel[stepIndex];
      const fallback = FUNNEL_STEP_FALLBACKS[stepIndex] ?? { header: `Bước ${stepIndex + 1}`, unit: 'PO' };
      const stepHeader = stepObj?.label.split(':')[0]?.trim() || fallback.header;
      const stepUnit = stepObj?.unit || fallback.unit;
      return {
        columns,
        rows: filteredRows,
        drilldownTitle: `${stepHeader} – chưa thành công [${stepUnit}]: ${filteredRows.length} chứng từ`,
        exportSourceType: 'funnel',
        exportSourceKey: String(stepIndex),
      };
    }
  }

  if (drilldownSource?.type === 'docStatus') {
    const item = data.docStatus[drilldownSource.key];
    const columns = [...item.columns];
    const filteredRows = filterTableByCohort(columns, item.rows, selectedCohort);
    return {
      columns,
      rows: filteredRows,
      drilldownTitle: `${item.label} [${item.unit}]: ${filteredRows.length} chứng từ`,
      exportSourceType: 'docStatus',
      exportSourceKey: drilldownSource.key,
    };
  }

  const table = data.lists[selectedViewKey];
  const columns = [...table.columns];
  const rows =
    selectedViewKey === 'overview'
      ? table.rows.map((r) => [...r])
      : filterTableByCohort(columns, table.rows, selectedCohort);

  return { columns, rows, drilldownTitle: null, exportSourceType: 'view', exportSourceKey: selectedViewKey };
}

export function getViewRowCount(
  lists: SalesMonitorListsDto | undefined,
  viewKey: SalesViewKey,
  cohort: CohortFilter,
): number {
  if (!lists) return 0;
  const table = lists[viewKey];
  if (viewKey === 'overview') return Math.max(0, table.rows.length - 1);
  return filterTableByCohort(table.columns, table.rows, cohort).length;
}

export function formatSapCell(val: SapCellValue | undefined, colName?: string): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return String(val);
  if (colName && RAW_IDENTIFIER_COLUMNS[colName]) return String(val);
  if (typeof val === 'number' && Number.isFinite(val)) {
    if (colName === 'Tong SL PO' || !Number.isInteger(val)) {
      return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
    }
    return val.toLocaleString('en-US');
  }
  return String(val);
}

export function isNumericSapColumn(
  colName: string,
  sampleRows: readonly (readonly SapCellValue[])[],
  colIdx: number,
): boolean {
  if (RAW_IDENTIFIER_COLUMNS[colName]) return false;
  if (KNOWN_NUMERIC_COLUMNS[colName]) return true;
  const limit = Math.min(sampleRows.length, 200);
  for (let i = 0; i < limit; i++) {
    if (typeof sampleRows[i]?.[colIdx] === 'number') return true;
  }
  return false;
}

export function sapDateToDateInput(dateFrom: string): string {
  return /^\d{8}$/.test(dateFrom)
    ? `${dateFrom.slice(0, 4)}-${dateFrom.slice(4, 6)}-${dateFrom.slice(6, 8)}`
    : '';
}

export function dateInputToSapDate(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate) || Number(isoDate.slice(0, 4)) < 2020) return '';
  return isoDate.replaceAll('-', '');
}

export function formatSalesGeneratedTime(generatedAt: string | undefined): string {
  if (!generatedAt) return '';
  const parsedDate = new Date(generatedAt);
  if (Number.isNaN(parsedDate.getTime())) return generatedAt;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(parsedDate);
}

export function formatSalesScopeLine(dateFrom: string, brand: string): string {
  const formattedDate = /^\d{8}$/.test(dateFrom)
    ? `${dateFrom.slice(6, 8)}/${dateFrom.slice(4, 6)}/${dateFrom.slice(0, 4)}`
    : dateFrom;
  return `Chứng từ từ ${formattedDate} – brand ${brand}. Nhóm mới = PO từ ngày này; nhóm cũ = PO trước ngày này còn phát sinh chứng từ (xem riêng, không tính vào số treo).`;
}
export function getSalesMonitorErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 503) {
      return err.message && !err.message.startsWith('HTTP ')
        ? err.message
        : 'Chưa cấu hình kết nối SAP, liên hệ admin';
    }
    if (err.status === 403) return 'Bạn không có quyền truy cập dữ liệu Monitor Bán hàng.';
    return err.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Không thể tải dữ liệu Monitor Bán hàng. Vui lòng thử lại.';
}
