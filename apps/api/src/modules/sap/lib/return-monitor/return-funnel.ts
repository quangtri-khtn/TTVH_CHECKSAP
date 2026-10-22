// Xây dựng Phễu chuyển đổi 5 bước cho luồng Trả hàng (buildReturnFunnel),
// tính toán 4 chỉ số tóm tắt KPI (buildReturnStatusSummary) và đếm số PO theo trạng thái (countReturnStatusByCohort).
// Nguồn đối chiếu 1:1: desktop `sales_flow_checker.py` (:3431-3432, :3601-3654, :3883-3893).
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
  RET_WAIT_STATUSES,
  RST_AR_NO_INV,
  RST_FULL,
  RST_NO_AP,
  RST_NO_AR,
  RST_NO_AR_WAIT_SHIP,
  RST_NO_GRPO,
  RST_NO_GRPO_WAIT_SHIP,
  RST_NO_SO,
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
  { key: 'po_no_so', label: RST_NO_SO, tag: 'attn' },
  { key: 'so_no_ar', label: RST_NO_AR, tag: 'attn' },
  { key: 'so_no_ar_wait', label: RST_NO_AR_WAIT_SHIP, tag: 'normal' },
  { key: 'ar_no_inv', label: RST_AR_NO_INV, tag: 'attn' },
  { key: 'ar_no_grpo', label: RST_NO_GRPO, tag: 'attn' },
  { key: 'ar_no_grpo_wait', label: RST_NO_GRPO_WAIT_SHIP, tag: 'normal' },
  { key: 'grpo_no_ap', label: RST_NO_AP, tag: 'attn' },
  { key: 'po_full', label: RST_FULL, tag: '' },
] as const;

export type ReturnStatusKey = (typeof RET_STATUS_ITEMS)[number]['key'];

export interface ReturnStatusCounts {
  po_no_so: number;
  so_no_ar: number;
  so_no_ar_wait: number;
  ar_no_inv: number;
  ar_no_grpo: number;
  ar_no_grpo_wait: number;
  grpo_no_ap: number;
  po_full: number;
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
 * Xây dựng Phễu chuyển đổi 5 bước cho luồng Trả hàng (`build_return_funnel`, `:3601-3654`).
 * - Bẫy 3: Bước 4 (`ar_no_grpo_wait`) xét `SO ShipDate > today` (tuyệt đối không xét `AR ShipDate`).
 * - Bẫy 4: Bước 2 hiển thị đơn vị `'SO'` nhưng `vin = po_so.length`, `ok = so_ar.length`, `okText = "{ok} SO → {n_ar} A/R"`.
 */
export function buildReturnFunnel(
  rows: readonly ReturnChainRow[],
  arRows: readonly ReturnArRow[],
  grpoRows: readonly ReturnGrpoRow[],
  today: string = todayInVietnam(),
): ReturnFunnelStep[] {
  const nStatus = (...sts: string[]): number =>
    rows.filter((r) =>
      sts.includes(String(r['Trang thai chuoi chung tu'] ?? '')),
    ).length;

  const poSo = rows.filter((r) => hasValue(r['SO Number']));
  const soAr = poSo.filter((r) => hasValue(r['AR Number']));
  const arInv = arRows.filter((r) => hasValue(r['Invoice No']));
  const poHasGrpo = new Set<number>(
    rows
      .filter((r) => hasValue(r['GRPO Number']))
      .map((r) => Number(r['PO Number'])),
  );
  const arGrpo = arInv.filter((r) => poHasGrpo.has(Number(r['PO Number'])));
  const arNoGrpo = arInv.filter((r) => !poHasGrpo.has(Number(r['PO Number'])));

  // Bẫy 3: Bước 4 xét SO ShipDate > today (fallback về today nếu rỗng -> today > today = false -> tính vào Cần xử lý)
  const arNoGrpoWait = arNoGrpo.filter(
    (r) => (toSapDateString(r['SO ShipDate']) ?? today) > today,
  ).length;

  const grpoAp = grpoRows.filter((g) => g.has_ap).length;
  const noinv = arRows.filter((r) => !hasValue(r['Invoice No']));
  const late = noinv.filter(
    (r) =>
      (toSapDateString(r['AR CreateDate']) ?? today) >
      (toSapDateString(r['AR ShipDate']) ?? today),
  ).length;

  const invDetail =
    noinv.length > 0
      ? `AR ShipDate ${dayCounts(noinv, 'AR ShipDate')}; A/R tạo ngày ${dayCounts(noinv, 'AR CreateDate')}${late > 0 ? ` – ${late} A/R tạo sau ShipDate` : ''}`
      : '';

  // Bẫy 4: Đếm tổng số chứng từ A/R từ các PO thuộc soAr
  const nAr = soAr.reduce(
    (acc, r) =>
      acc +
      String(r['AR Number'] ?? '')
        .split(', ')
        .filter(Boolean).length,
    0,
  );
  const soNoAr = rows.filter(
    (r) => r['Trang thai chuoi chung tu'] === RST_NO_AR,
  );
  const soDetail =
    soNoAr.length > 0
      ? `SO ShipDate ${dayCounts(soNoAr, 'SO ShipDate')}; SO tạo ngày ${dayCounts(soNoAr, 'SO CreateDate')}`
      : '';

  const b3PoCount = new Set(arInv.map((r) => Number(r['PO Number']))).size;
  const b4PoCount = new Set(arGrpo.map((r) => Number(r['PO Number']))).size;

  return [
    makeReturnStep(
      1,
      '1. PO (KBMD) → SO (TTVH)',
      'PO',
      rows.length,
      poSo.length,
      `${poSo.length} SO`,
      0,
      nStatus(RST_NO_SO),
      'PO đã sinh SO',
      '',
      'PO chưa có SO',
    ),
    makeReturnStep(
      2,
      '2. SO → A/R (TTVH)',
      'SO',
      poSo.length,
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
      arRows.length,
      arInv.length,
      `${arInv.length} A/R đã xuất HĐ (thuộc ${b3PoCount} PO)`,
      0,
      arRows.length - arInv.length,
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
      `${arGrpo.length} A/R (thuộc ${b4PoCount} PO) đã có GRPO`,
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
      grpoRows.length,
      grpoAp,
      `${grpoAp} GRPO đã có AP`,
      0,
      grpoRows.length - grpoAp,
      'GRPO đã có AP',
      '',
      'GRPO chưa có AP',
    ),
  ];
}

/**
 * Tính 4 chỉ số KPI tổng quan cho màn hình Monitor Trả:
 * - `problems`: số PO nhóm mới chưa hoàn tất và không thuộc trạng thái chờ ShipDate.
 * - `arNoInvCount`: tổng số chứng từ A/R chưa xuất hóa đơn.
 * - `waiting`: số PO nhóm mới đang chờ đến SO ShipDate.
 * - `backlog`: số PO nhóm cũ chưa hoàn tất chuỗi chứng từ.
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
      } else if (status !== RST_FULL) {
        problems++;
      }
    } else if (nhom === NHOM_CU) {
      if (status !== RST_FULL) {
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
 * Đếm số PO trả hàng theo 8 trạng thái trong `RET_STATUS_ORDER`,
 * hỗ trợ lọc theo nhóm `cohort` (`'Mới'`, `'Cũ'`, hoặc `null` cho tất cả).
 */
export function countReturnStatusByCohort(
  rows: readonly ReturnChainRow[],
  cohort: 'Mới' | 'Cũ' | null = null,
): ReturnStatusCounts {
  const counts: ReturnStatusCounts = {
    po_no_so: 0,
    so_no_ar: 0,
    so_no_ar_wait: 0,
    ar_no_inv: 0,
    ar_no_grpo: 0,
    ar_no_grpo_wait: 0,
    grpo_no_ap: 0,
    po_full: 0,
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
