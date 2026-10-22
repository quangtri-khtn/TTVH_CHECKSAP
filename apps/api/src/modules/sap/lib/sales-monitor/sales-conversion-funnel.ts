// Xây dựng phễu chuyển đổi 5 bước (PO -> SO -> A/R -> xuất hóa đơn -> GRPO -> AP)
// với đầy đủ mô tả checklist chi tiết, icon cảnh báo và tỷ lệ phần trăm Banker's Rounding.
// Nguồn đối chiếu 1:1: desktop `sales_flow_checker.py` (:2413-2496, :3161).
import {
  type SapRowRecord,
  descLines,
  formatPercentLikePython,
  funnelIcon,
  hasValue,
  toSapDateString,
  topDays,
} from './sales-monitor-helpers';
import {
  type ChainGrpoRecord,
  ST_NO_AR,
  ST_NO_AR_WAIT_SHIP,
  ST_NO_SO,
} from './sales-po-chain';

export const CONV_HEADERS = [
  'Bước chuyển',
  'Đơn vị',
  'Đầu vào',
  'Thành công',
  'Tỷ lệ',
  'Chưa thành công',
  'Chờ đến ngày (bình thường)',
  'Cần xử lý',
] as const;

export interface SalesFunnelStep {
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

function splitTokens(v: unknown): string[] {
  return String(v ?? '')
    .split(', ')
    .filter(Boolean);
}

function soCount(rows: readonly SapRowRecord[]): number {
  let total = 0;
  for (const r of rows) {
    total += splitTokens(r['SO Number']).length;
  }
  return total;
}

function makeStep(
  step: number,
  autoLabel: string,
  unit: string,
  vin: number,
  ok: number,
  okText: string,
  wait: number,
  act: number,
): SalesFunnelStep {
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

/** Tính toán phễu chuyển đổi 5 bước cho một tập PO (`build_conversion_funnel`, `:2413-2492`). */
export function buildConversionFunnel(
  chainRows: readonly SapRowRecord[],
  arRows: readonly SapRowRecord[],
  grpoRows: readonly ChainGrpoRecord[],
  today: string,
): SalesFunnelStep[] {
  const statusRows = (...sts: string[]): SapRowRecord[] =>
    chainRows.filter((r) =>
      sts.includes(String(r['Trang thai chuoi chung tu'] ?? '')),
    );

  const backdatedToday = (r: SapRowRecord): boolean => {
    const created = toSapDateString(r['AR CreateDate']);
    const posted = toSapDateString(r['AR DocDate']);
    return created === today && posted !== null && posted < today;
  };

  // Bước 1: PO -> SO (Đơn vị PO)
  const po = chainRows.length;
  const poSo = chainRows.filter((r) => hasValue(r['SO Number']));
  const b1Act = statusRows(ST_NO_SO).length;
  const d1 = descLines(
    `${poSo.length}/${po} PO đã sinh SO`,
    0,
    '',
    b1Act,
    'PO chưa có SO',
  );

  // Bước 2: SO -> A/R (Đơn vị SO)
  const soAll = soCount(chainRows);
  const poAr = chainRows.filter(
    (r) => hasValue(r['SO Number']) && hasValue(r['AR Number']),
  );
  const soOk = soCount(poAr);
  const nAr2 = poAr.reduce(
    (acc, r) => acc + splitTokens(r['AR Number']).length,
    0,
  );
  const soWait = soCount(statusRows(ST_NO_AR_WAIT_SHIP));
  const soAct = soCount(statusRows(ST_NO_AR));

  // Khóa bẫy `so_no_ar`: giữ nguyên dòng PO cho từng token SO (:2464)
  const soNoAr: SapRowRecord[] = [];
  for (const r of statusRows(ST_NO_AR)) {
    const tokens = splitTokens(r['SO Number']);
    for (let i = 0; i < tokens.length; i++) {
      soNoAr.push(r);
    }
  }
  const d2Detail =
    soNoAr.length > 0
      ? `SO ShipDate ${topDays(soNoAr.map((r) => r['SO ShipDate']))}; SO tạo ngày ${topDays(soNoAr.map((r) => r['SO CreateDate']))}`
      : '';
  const d2 = descLines(
    `${soOk}/${soAll} SO đã có A/R (tổng ${nAr2} A/R)`,
    soWait,
    'SO chưa có A/R, chờ đến ShipDate (bình thường)',
    soAct,
    'SO đã đến ShipDate mà chưa có A/R',
    d2Detail,
  );

  // Bước 3: A/R -> xuất hóa đơn (Đơn vị A/R)
  const arN = arRows.length;
  const arInv = arRows.filter((r) => hasValue(r['Invoice No']));
  const arWait = arRows.filter(
    (r) => !hasValue(r['Invoice No']) && backdatedToday(r),
  ).length;
  const noinv = arRows.filter(
    (r) => !hasValue(r['Invoice No']) && !backdatedToday(r),
  );
  const late = noinv.filter(
    (r) =>
      (toSapDateString(r['AR CreateDate']) ?? today) >
      (toSapDateString(r['AR ShipDate']) ?? today),
  ).length;
  const d3Detail =
    noinv.length > 0
      ? `AR ShipDate ${topDays(noinv.map((r) => r['AR ShipDate']))}; tạo ngày ${topDays(noinv.map((r) => r['AR CreateDate']))}${late > 0 ? ` – ${late} A/R tạo sau ShipDate` : ''}`
      : '';
  const b3Act = arN - arInv.length - arWait;
  const d3 = descLines(
    `${arInv.length}/${arN} A/R đã xuất hóa đơn`,
    arWait,
    'A/R chưa xuất HĐ: tạo hôm nay, posting lùi ngày (bình thường)',
    b3Act,
    'A/R chưa xuất hóa đơn',
    d3Detail,
  );
  const b3OkPoCount = new Set(arInv.map((r) => Number(r['PO Number']))).size;

  // Bước 4: A/R đã xuất HĐ -> GRPO (Đơn vị A/R)
  const poHasGrpo = new Set(
    chainRows
      .filter((r) => hasValue(r['GRPO Number']))
      .map((r) => Number(r['PO Number'])),
  );
  const arGrpo = arInv.filter((r) => poHasGrpo.has(Number(r['PO Number'])));
  const arNoGrpo = arInv.filter((r) => !poHasGrpo.has(Number(r['PO Number'])));
  // Khóa bẫy AR ShipDate null: fallback về today -> today > today là false -> tính vào gAct (:2454)
  const gWait = arNoGrpo.filter(
    (r) => (toSapDateString(r['AR ShipDate']) ?? today) > today,
  ).length;
  const gAct = arNoGrpo.length - gWait;
  const d4 = descLines(
    `${arGrpo.length}/${arInv.length} A/R đã xuất HĐ có GRPO (KBMD)`,
    gWait,
    'A/R chưa có GRPO, chờ đến ShipDate (bình thường)',
    gAct,
    'A/R chưa có GRPO, đã đến ShipDate',
  );
  const b4OkPoCount = new Set(arGrpo.map((r) => Number(r['PO Number']))).size;

  // Bước 5: GRPO -> AP (Đơn vị GRPO)
  const grpoN = grpoRows.length;
  const grpoAp = grpoRows.filter((r) => r.has_ap).length;
  const b5Act = grpoN - grpoAp;
  const d5 = descLines(
    `${grpoAp}/${grpoN} GRPO đã có AP`,
    0,
    '',
    b5Act,
    'GRPO chưa có AP',
  );

  return [
    makeStep(1, `1. PO → SO:\n${d1}`, 'PO', po, poSo.length, `${poSo.length} SO`, 0, b1Act),
    makeStep(2, `2. SO → A/R:\n${d2}`, 'SO', soAll, soOk, `${soOk} SO → ${nAr2} A/R`, soWait, soAct),
    makeStep(
      3,
      `3. A/R → xuất hóa đơn:\n${d3}`,
      'A/R',
      arN,
      arInv.length,
      `${arInv.length} A/R đã xuất HĐ (thuộc ${b3OkPoCount} PO)`,
      arWait,
      b3Act,
    ),
    makeStep(
      4,
      `4. A/R đã xuất HĐ → GRPO:\n${d4}`,
      'A/R',
      arInv.length,
      arGrpo.length,
      `${arGrpo.length} A/R (thuộc ${b4OkPoCount} PO) đã có GRPO`,
      gWait,
      gAct,
    ),
    makeStep(5, `5. GRPO → AP:\n${d5}`, 'GRPO', grpoN, grpoAp, `${grpoAp} GRPO đã có AP`, 0, b5Act),
  ];
}
