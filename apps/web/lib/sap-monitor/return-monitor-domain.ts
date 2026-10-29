// Pure domain helpers cho màn hình Monitor Luồng Trả hàng (/sap/monitor-tra):
// lọc bảng theo Nhóm PO & Trạng thái chuỗi chứng từ, giải quyết dữ liệu lưới, định dạng ô và thông báo lỗi.
import { ApiError } from '@/lib/api/http-client';
import type {
  ReturnMonitorListsDto,
  ReturnStatusCountsDto,
} from '@/lib/api/generated/model';
import {
  COHORT_OPTIONS,
  type CohortFilter,
  SALES_BRAND_OPTIONS,
  type SapCellValue,
  dateInputToSapDate,
  formatSalesGeneratedTime,
  formatSapCell,
  getYesterdaySapDate,
  sapDateToDateInput,
} from './sales-monitor-domain';

export {
  COHORT_OPTIONS,
  type CohortFilter,
  type SapCellValue,
  dateInputToSapDate,
  formatSapCell,
  getYesterdaySapDate,
  sapDateToDateInput,
};

export type ReturnViewMode = 'po' | 'ar_noinv';
export type ReturnStatusKey = keyof ReturnStatusCountsDto;

export const DEFAULT_RETURN_DATE_FROM = getYesterdaySapDate();
export const DEFAULT_RETURN_BRAND = '5001';
export const RETURN_BRAND_OPTIONS = SALES_BRAND_OPTIONS;

export const RETURN_CHAIN_COLUMNS = [
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

export const RETURN_AR_NOINV_COLS = [
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

export const RET_FUNNEL_HEADERS = [
  'Bước chuyển',
  'Đơn vị',
  'Đầu vào',
  'Thành công',
  'Tỷ lệ',
  'Chưa thành công',
  'Chờ đến ngày (bình thường)',
  'Cần xử lý',
] as const;

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

export const RET_STATUS_META = [
  { key: 'po_no_so', label: RST_NO_SO, unit: 'PO', tag: 'attn' },
  { key: 'so_no_ar', label: RST_NO_AR, unit: 'PO', tag: 'attn' },
  { key: 'so_no_ar_wait', label: RST_NO_AR_WAIT_SHIP, unit: 'PO', tag: 'normal' },
  { key: 'ar_no_inv', label: RST_AR_NO_INV, unit: 'PO', tag: 'attn' },
  { key: 'ar_no_grpo', label: RST_NO_GRPO, unit: 'PO', tag: 'attn' },
  { key: 'ar_no_grpo_wait', label: RST_NO_GRPO_WAIT_SHIP, unit: 'PO', tag: 'normal' },
  { key: 'grpo_no_ap', label: RST_NO_AP, unit: 'PO', tag: 'attn' },
  { key: 'po_full', label: RST_FULL, unit: 'PO', tag: '' },
] as const satisfies readonly {
  key: ReturnStatusKey;
  label: ReturnStatusLabel;
  unit: string;
  tag: 'attn' | 'normal' | '';
}[];

export const RETURN_VIEW_OPTIONS = [
  { key: 'po', label: 'Danh sách PO trả hàng', isAlert: false },
  { key: 'ar_noinv', label: 'A/R chưa xuất hóa đơn', isAlert: true },
] as const satisfies readonly { key: ReturnViewMode; label: string; isAlert: boolean }[];

export interface ResolvedReturnGridData {
  columns: string[];
  rows: SapCellValue[][];
  title: string;
  drilldownTitle: string | null;
}

export function filterReturnRowsByCohort(
  columns: readonly string[],
  rows: readonly (readonly SapCellValue[])[],
  cohort: CohortFilter,
): SapCellValue[][] {
  if (cohort === 'tatCa' || rows.length === 0) {
    return rows.map((r) => [...r]);
  }
  const nhomIdx = columns.indexOf('Nhom') !== -1 ? columns.indexOf('Nhom') : 0;
  const target = cohort === 'moi' ? 'Mới' : 'Cũ';
  return rows.filter((r) => r[nhomIdx] === target).map((r) => [...r]);
}

export function getReturnViewRowCount(
  lists: ReturnMonitorListsDto | undefined,
  viewMode: ReturnViewMode,
  selectedCohort: CohortFilter,
): number {
  if (!lists) return 0;
  const table = viewMode === 'ar_noinv' ? lists.arNoInv : lists.chain;
  return filterReturnRowsByCohort(table.columns, table.rows, selectedCohort).length;
}

export function resolveReturnGridData(params: {
  lists: ReturnMonitorListsDto | undefined;
  viewMode: ReturnViewMode;
  statusFilter: string | null;
  selectedCohort: CohortFilter;
}): ResolvedReturnGridData {
  const { lists, viewMode, statusFilter, selectedCohort } = params;
  if (!lists) {
    return {
      columns:
        viewMode === 'ar_noinv' ? [...RETURN_AR_NOINV_COLS] : [...RETURN_CHAIN_COLUMNS],
      rows: [],
      title:
        viewMode === 'ar_noinv'
          ? 'A/R (TTVH) chưa xuất hóa đơn (0 A/R) – sắp theo tuổi A/R giảm dần'
          : `Danh sách PO trả hàng (0)${statusFilter ? ` – ${statusFilter}` : ''}`,
      drilldownTitle:
        viewMode === 'ar_noinv'
          ? 'A/R (TTVH) chưa xuất hóa đơn (0 A/R) – sắp theo tuổi A/R giảm dần'
          : statusFilter,
    };
  }

  if (viewMode === 'ar_noinv') {
    const columns =
      lists.arNoInv.columns.length > 0
        ? [...lists.arNoInv.columns]
        : [...RETURN_AR_NOINV_COLS];
    const rows = filterReturnRowsByCohort(columns, lists.arNoInv.rows, selectedCohort);
    const title = `A/R (TTVH) chưa xuất hóa đơn (${rows.length} A/R) – sắp theo tuổi A/R giảm dần`;
    return {
      columns,
      rows,
      title,
      drilldownTitle: title,
    };
  }

  const columns =
    lists.chain.columns.length > 0
      ? [...lists.chain.columns]
      : [...RETURN_CHAIN_COLUMNS];
  const cohortRows = filterReturnRowsByCohort(columns, lists.chain.rows, selectedCohort);
  const statusColIdx = columns.indexOf('Trang thai chuoi chung tu');
  const rows =
    statusFilter && statusColIdx !== -1
      ? cohortRows.filter((r) => r[statusColIdx] === statusFilter)
      : cohortRows;
  const title = `Danh sách PO trả hàng (${rows.length})${statusFilter ? ` – ${statusFilter}` : ''}`;

  return {
    columns,
    rows,
    title,
    drilldownTitle: statusFilter ? `${statusFilter} (${rows.length} PO)` : null,
  };
}

export function formatReturnGeneratedTime(generatedAt: string | undefined): string {
  return formatSalesGeneratedTime(generatedAt);
}

export function formatReturnScopeLine(dateFrom: string, brand: string): string {
  const formattedDate = /^\d{8}$/.test(dateFrom)
    ? `${dateFrom.slice(6, 8)}/${dateFrom.slice(4, 6)}/${dateFrom.slice(0, 4)}`
    : dateFrom;
  const brandLabel =
    brand.toUpperCase() === 'ALL' ? 'tất cả thương hiệu' : `brand ${brand}`;
  return `Luồng trả (KBMD ↔ TTVH) từ ${formattedDate}, ${brandLabel} + cửa hàng pilot. Nhóm mới = PO từ ngày này; nhóm cũ = PO trước ngày này còn phát sinh chứng từ.`;
}

export function getReturnMonitorErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 503) {
      return err.message && !err.message.startsWith('HTTP ')
        ? err.message
        : 'Chưa cấu hình kết nối SAP, liên hệ admin';
    }
    if (err.status === 403) {
      return 'Bạn không có quyền truy cập Monitor SAP';
    }
    return err.message;
  }
  if (err instanceof Error && err.message) {
    if (err.message.includes('503') || err.message.toLowerCase().includes('kết nối sap')) {
      return 'Chưa cấu hình kết nối SAP, liên hệ admin';
    }
    return err.message;
  }
  return 'Không thể tải dữ liệu Monitor Luồng Trả. Vui lòng thử lại.';
}
