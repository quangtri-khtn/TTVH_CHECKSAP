// Xây dựng Phễu chuyển đổi 6 bước cho luồng Trả hàng theo gốc SO (buildReturnFunnel),
// tính toán 4 chỉ số tóm tắt KPI (buildReturnStatusSummary) và đếm số SO theo 11 trạng thái (countReturnStatusByCohort).
// Nguồn đối chiếu 1:1: Mục 7.3 Đặc tả kỹ thuật v1.1 (28/10/2026).
import { NHOM_CU, NHOM_MOI } from '../sales-monitor/sales-cohort';
import {
  type SapRowRecord,
  descLines,
  formatPercentLikePython,
  funnelIcon,
  hasValue,
  todayInVietnam,
  toSapDateString,
  topDays,
} from '../sales-monitor/sales-monitor-helpers';
import {
  RET_OUT_OF_FUNNEL_STATUSES,
  RET_WAIT_STATUSES,
  RST_AP_NO_INV,
  RST_AR_NO_INV,
  RST_FULL,
  RST_MANUAL_SO,
  RST_NO_AP,
  RST_NO_AR,
  RST_NO_AR_WAIT_SHIP,
  RST_NO_GRPO,
  RST_NO_GRPO_WAIT_SHIP,
  RST_NO_PO,
  RST_SO_CANCELED,
  type ReturnArNoInvRow,
  type ReturnArRow,
  type ReturnChainRow,
  type ReturnGrpoRow,
} from './return-chain';

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

export const RET_STATUS_ITEMS = [
  { key: 'so_canceled', label: RST_SO_CANCELED, tag: 'attn' },
  { key: 'so_no_po', label: RST_NO_PO, tag: 'attn' },
  { key: 'so_no_ar', label: RST_NO_AR, tag: 'attn' },
  { key: 'so_no_ar_wait', label: RST_NO_AR_WAIT_SHIP, tag: 'normal' },
  { key: 'ar_no_inv', label: RST_AR_NO_INV, tag: 'attn' },
  { key: 'ar_no_grpo', label: RST_NO_GRPO, tag: 'attn' },
  { key: 'ar_no_grpo_wait', label: RST_NO_GRPO_WAIT_SHIP, tag: 'normal' },
  { key: 'grpo_no_ap', label: RST_NO_AP, tag: 'attn' },
  { key: 'ap_no_inv', label: RST_AP_NO_INV, tag: 'attn' },
  { key: 'so_full', label: RST_FULL, tag: '' },
  { key: 'so_manual', label: RST_MANUAL_SO, tag: 'normal' },
] as const;

export type ReturnStatusKey = (typeof RET_STATUS_ITEMS)[number]['key'];

export interface ReturnStatusCounts {
  so_canceled: number;
  so_no_po: number;
  so_no_ar: number;
  so_no_ar_wait: number;
  ar_no_inv: number;
  ar_no_grpo: number;
  ar_no_grpo_wait: number;
  grpo_no_ap: number;
  ap_no_inv: number;
  so_full: number;
  so_manual: number;
}

export interface ReturnFunnelStep {
  step: number;
  label: string;
  autoLabel: string;
  unit: string;
  vin: number;
  ok: number;
  okText: string;
  rate: string;
  notOk: number;
  wait: number;
  act: number;
  icon: string;
}

export interface ReturnMonitorSummary {
  problems: number;
  arNoInvCount: number;
  waiting: number;
  backlog: number;
}

function dayCounts(rows: readonly SapRowRecord[], col: string): string {
  return topDays(rows.map((r) => toSapDateString(r[col])));
}

function makeReturnStep(
  step: number,
  stepTitle: string,
  unit: string,
  vin: number,
  ok: number,
  okText: string,
  wait: number,
  act: number,
  okTxt: string,
  waitTxt = '',
  actTxt = '',
  detail = '',
): ReturnFunnelStep {
  const desc = descLines(
    `${ok}/${vin} ${okTxt}`,
    wait,
    waitTxt,
    act,
    actTxt,
    detail,
  );
  const autoLabel = `${stepTitle}:\n${desc}`;
  const notOk = vin - ok;
  const icon = funnelIcon(notOk, act);
  return {
    step,
    label: `${icon} ${autoLabel}`,
    autoLabel,
    unit,
    vin,
    ok,
    okText,
    rate: formatPercentLikePython(ok, vin),
    notOk,
    wait,
    act,
    icon,
  };
}

/**
 * Xây dựng Phễu chuyển đổi 6 bước cho luồng Trả hàng theo gốc SO (`build_return_funnel`, Mục 7.3 Đặc tả v1.1):
 * - Loại các SO trạng thái `0` (đã hủy) và `8` (thủ công) khỏi phễu trước khi tính toán.
 * - Bước 4 xét `SO ShipDate > today` để xác định trạng thái chờ.
 * - Bước 6 kiểm tra các SO có AP đã có `AP Invoice No`.
 */
export function buildReturnFunnel(
  rows: readonly ReturnChainRow[],
  arRows: readonly ReturnArRow[],
  grpoRows: readonly ReturnGrpoRow[],
  today: string = todayInVietnam(),
): ReturnFunnelStep[] {
  const nCanceled = rows.filter(
    (r) => r['Trang thai chuoi chung tu'] === RST_SO_CANCELED,
  ).length;
  const nManual = rows.filter(
    (r) => r['Trang thai chuoi chung tu'] === RST_MANUAL_SO,
  ).length;

  const funnelRows = rows.filter(
    (r) =>
      !RET_OUT_OF_FUNNEL_STATUSES.has(
        String(r['Trang thai chuoi chung tu'] ?? ''),
      ),
  );
  const inFunnelSoNums = new Set<number>(
    funnelRows.map((r) => Number(r['SO Number'])),
  );
  const fArRows = arRows.filter((r) =>
    inFunnelSoNums.has(Number(r['SO Number'])),
  );
  const fGrpoRows = grpoRows.filter((r) =>
    inFunnelSoNums.has(Number(r['SO Number'])),
  );

  const nStatus = (...sts: string[]): number =>
    funnelRows.filter((r) =>
      sts.includes(String(r['Trang thai chuoi chung tu'] ?? '')),
    ).length;

  const soPo = funnelRows.filter((r) => hasValue(r['PO Number']));
  const soAr = soPo.filter((r) => hasValue(r['AR Number']));
  const arInv = fArRows.filter((r) => hasValue(r['Invoice No']));
  const soHasGrpo = new Set<number>(
    funnelRows
      .filter((r) => hasValue(r['GRPO Number']))
      .map((r) => Number(r['SO Number'])),
  );
  const arGrpo = arInv.filter((r) => soHasGrpo.has(Number(r['SO Number'])));
  const arNoGrpo = arInv.filter((r) => !soHasGrpo.has(Number(r['SO Number'])));

  const arNoGrpoWait = arNoGrpo.filter(
    (r) => (toSapDateString(r['SO ShipDate']) ?? today) > today,
  ).length;

  const grpoAp = fGrpoRows.filter((g) => g.has_ap).length;
  const soWithAp = funnelRows.filter((r) => hasValue(r['AP Number']));
  const soWithApInv = soWithAp.filter((r) => hasValue(r['AP Invoice No']));

  const noinv = fArRows.filter((r) => !hasValue(r['Invoice No']));
  const late = noinv.filter(
    (r) =>
      (toSapDateString(r['AR CreateDate']) ?? today) >
      (toSapDateString(r['AR ShipDate']) ?? today),
  ).length;

  const invDetail =
    noinv.length > 0
      ? `AR ShipDate ${dayCounts(noinv, 'AR ShipDate')}; A/R tạo ngày ${dayCounts(noinv, 'AR CreateDate')}${late > 0 ? ` – ${late} A/R tạo sau ShipDate` : ''}`
      : '';

  const nAr = soAr.reduce(
    (acc, r) =>
      acc +
      String(r['AR Number'] ?? '')
        .split(', ')
        .filter(Boolean).length,
    0,
  );

  const soNoPo = funnelRows.filter(
    (r) => r['Trang thai chuoi chung tu'] === RST_NO_PO,
  );
  const step1Detail =
    soNoPo.length > 0
      ? `SO tạo ngày ${dayCounts(soNoPo, 'SO CreateDate')}`
      : '';
  const step1ExtraNote =
    nCanceled + nManual > 0
      ? `\n      (ngoài ra ${nCanceled} SO đã hủy nhưng PO KBMD vẫn mở (trạng thái 0), ${nManual} SO thủ công không có PO (trạng thái 8) – không tính ở đây)`
      : '';

  const soNoAr = funnelRows.filter(
    (r) => r['Trang thai chuoi chung tu'] === RST_NO_AR,
  );
  const soDetail =
    soNoAr.length > 0
      ? `SO ShipDate ${dayCounts(soNoAr, 'SO ShipDate')}; SO tạo ngày ${dayCounts(soNoAr, 'SO CreateDate')}`
      : '';

  const b3SoCount = new Set(arInv.map((r) => Number(r['SO Number']))).size;
  const b4SoCount = new Set(arGrpo.map((r) => Number(r['SO Number']))).size;

  return [
    makeReturnStep(
      1,
      '1. SO (TTVH) → PO (KBMD)',
      'SO',
      funnelRows.length,
      soPo.length,
      `${soPo.length} SO → PO`,
      0,
      nStatus(RST_NO_PO),
      `SO đã sinh PO (KBMD)${step1ExtraNote}`,
      '',
      'SO chưa sinh PO',
      step1Detail,
    ),
    makeReturnStep(
      2,
      '2. SO → A/R (TTVH)',
      'SO',
      soPo.length,
      soAr.length,
      `${soAr.length} SO → ${nAr} A/R`,
      nStatus(RST_NO_AR_WAIT_SHIP),
      nStatus(RST_NO_AR),
      `SO đã có A/R (tổng ${nAr} A/R)`,
      'SO chưa có A/R, chờ đến SO ShipDate (bình thường)',
      'SO đã đến SO ShipDate mà chưa có A/R',
      soDetail,
    ),
    makeReturnStep(
      3,
      '3. A/R → xuất hóa đơn',
      'A/R',
      fArRows.length,
      arInv.length,
      `${arInv.length} A/R đã xuất HĐ (thuộc ${b3SoCount} SO)`,
      0,
      fArRows.length - arInv.length,
      'A/R đã xuất hóa đơn',
      '',
      'A/R chưa xuất hóa đơn',
      invDetail,
    ),
    makeReturnStep(
      4,
      '4. A/R đã xuất HĐ → GRPO (KBMD)',
      'A/R',
      arInv.length,
      arGrpo.length,
      `${arGrpo.length} A/R (thuộc ${b4SoCount} SO) đã có GRPO`,
      arNoGrpoWait,
      arNoGrpo.length - arNoGrpoWait,
      'A/R đã xuất HĐ có GRPO (KBMD)',
      'A/R chưa có GRPO, chờ đến SO ShipDate (bình thường)',
      'A/R chưa có GRPO, đã đến SO ShipDate',
    ),
    makeReturnStep(
      5,
      '5. GRPO → AP (KBMD)',
      'GRPO',
      fGrpoRows.length,
      grpoAp,
      `${grpoAp} GRPO đã có AP`,
      0,
      fGrpoRows.length - grpoAp,
      'GRPO đã có AP',
      '',
      'GRPO chưa có AP',
    ),
    makeReturnStep(
      6,
      '6. AP (KBMD) → có Invoice',
      'SO',
      soWithAp.length,
      soWithApInv.length,
      `${soWithApInv.length} SO có AP đã có Invoice`,
      0,
      soWithAp.length - soWithApInv.length,
      'SO có AP đã có Invoice (Vendor Ref No)',
      '',
      'SO có AP nhưng AP chưa có Invoice',
    ),
  ];
}

/**
 * Tính 4 chỉ số KPI tổng quan cho màn hình Monitor Trả theo SO:
 * - `problems`: số SO nhóm mới cần xử lý (khác `RST_FULL`, khác `RST_MANUAL_SO`, và không thuộc `RET_WAIT_STATUSES`).
 * - `arNoInvCount`: tổng số chứng từ A/R chưa xuất hóa đơn.
 * - `waiting`: số SO nhóm mới đang chờ đến SO ShipDate.
 * - `backlog`: số SO nhóm cũ chưa hoàn tất chuỗi chứng từ (khác `RST_FULL` và khác `RST_MANUAL_SO`).
 */
export function buildReturnStatusSummary(
  rows: readonly ReturnChainRow[],
  arNoInvRows: readonly ReturnArNoInvRow[],
): ReturnMonitorSummary {
  let problems = 0;
  let waiting = 0;
  let backlog = 0;

  for (const r of rows) {
    const nhom = String(r['Nhom'] ?? '');
    const status = String(r['Trang thai chuoi chung tu'] ?? '');
    if (nhom === NHOM_MOI) {
      if (RET_WAIT_STATUSES.has(status)) {
        waiting++;
      } else if (status !== RST_FULL && status !== RST_MANUAL_SO) {
        problems++;
      }
    } else if (nhom === NHOM_CU) {
      if (status !== RST_FULL && status !== RST_MANUAL_SO) {
        backlog++;
      }
    }
  }

  return {
    problems,
    arNoInvCount: arNoInvRows.length,
    waiting,
    backlog,
  };
}

/**
 * Đếm số SO trả hàng theo 11 trạng thái trong `RET_STATUS_ORDER`,
 * hỗ trợ lọc theo nhóm `cohort` (`'Mới'`, `'Cũ'`, hoặc `null` cho tất cả).
 */
export function countReturnStatusByCohort(
  rows: readonly ReturnChainRow[],
  cohort: 'Mới' | 'Cũ' | null = null,
): ReturnStatusCounts {
  const counts: ReturnStatusCounts = {
    so_canceled: 0,
    so_no_po: 0,
    so_no_ar: 0,
    so_no_ar_wait: 0,
    ar_no_inv: 0,
    ar_no_grpo: 0,
    ar_no_grpo_wait: 0,
    grpo_no_ap: 0,
    ap_no_inv: 0,
    so_full: 0,
    so_manual: 0,
  };

  const keyByLabel = new Map<string, ReturnStatusKey>(
    RET_STATUS_ITEMS.map((item) => [item.label, item.key]),
  );

  for (const r of rows) {
    if (cohort !== null && r['Nhom'] !== cohort) {
      continue;
    }
    const status = String(r['Trang thai chuoi chung tu'] ?? '');
    const key = keyByLabel.get(status);
    if (key !== undefined) {
      counts[key]++;
    }
  }

  return counts;
}
