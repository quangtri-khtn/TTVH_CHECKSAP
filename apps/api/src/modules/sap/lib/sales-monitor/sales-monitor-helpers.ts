// Bộ hàm tiện ích cốt lõi cho màn hình Monitor Bán hàng: chuyển đổi bảng 2D ↔ bản ghi,
// làm tròn Banker's Rounding, chuẩn hóa ngày SAP theo giờ Việt Nam và định dạng mô tả phễu.
// Nguồn đối chiếu 1:1: desktop `sales_flow_checker.py` (:857-885, :2435-2437, :2611-2640, :2756-2762).
import type { SapCellValue, SapQueryResult } from '../sap-row-normalizer';

export type SapRowRecord = Record<string, SapCellValue>;

/** Chuyển đổi bảng kết quả 2 chiều `SapQueryResult` sang mảng bản ghi `SapRowRecord[]` theo tên cột. */
export function tableToRecords(table: SapQueryResult): SapRowRecord[] {
  const { columns, rows } = table;
  return rows.map((row) => {
    const record: SapRowRecord = {};
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      if (col !== undefined) {
        record[col] = row[i] ?? null;
      }
    }
    return record;
  });
}

/** Chuyển đổi mảng bản ghi `SapRowRecord[]` sang bảng 2 chiều `SapQueryResult` theo thứ tự cột chỉ định. */
export function recordsToTable(
  columns: readonly string[],
  records: readonly SapRowRecord[],
): SapQueryResult {
  return {
    columns: [...columns],
    rows: records.map((r) => columns.map((col) => r[col] ?? null)),
  };
}

/** So sánh chuỗi theo mã ASCII thuần (khớp toán tử `<` của Python `str`, không phụ thuộc locale OS). */
export function compareAscii(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Kiểm tra giá trị khác null/undefined và chuỗi sau khi cắt khoảng trắng khác rỗng (`_has_value`, `:857`). */
export function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

/** Làm tròn nửa chẵn (Banker's Rounding / Round Half to Even) khớp `round()` của Python 3. */
export function roundHalfToEven(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (Math.abs(diff - 0.5) < 1e-9) {
    return floor % 2 === 0 ? floor : floor + 1;
  }
  return diff < 0.5 ? floor : floor + 1;
}

/** Định dạng tỷ lệ phần trăm theo chuẩn `f"{ok / vin:.0%}"` của Python (`:2436`). Khi `!vin`, trả về `'–'` (`\u2013`). */
export function formatPercentLikePython(ok: number, vin: number): string {
  if (!vin || vin === 0) {
    return '–';
  }
  return `${roundHalfToEven((ok / vin) * 100)}%`;
}

/** Lấy ngày hiện tại theo múi giờ Việt Nam (`Asia/Ho_Chi_Minh`) định dạng `'YYYY-MM-DD'`. */
export function todayInVietnam(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

/** Chuẩn hóa giá trị ngày (`Date`, `'YYYY-MM-DD'`, `'YYYYMMDD'`, `'DD/MM/YYYY'`) về `'YYYY-MM-DD'` (`_to_date`, `:861`). */
export function toSapDateString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value.toISOString().slice(0, 10);
  }
  const text = String(value).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  if (/^\d{8}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    return `${text.slice(6, 10)}-${text.slice(3, 5)}-${text.slice(0, 2)}`;
  }
  return null;
}

/** Tạo ghi chú trạng thái chờ hoặc quá hạn ShipDate (`ship_wait_text`, `:875-885`). */
export function shipWaitText(
  ship: unknown,
  name = 'ShipDate',
  target = 'GRPO',
  today: string = todayInVietnam(),
): string {
  const d = toSapDateString(ship);
  if (d === null) {
    return `Không có ${name}`;
  }
  const formatted = `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
  if (d > today) {
    const why =
      target === 'GRPO'
        ? 'chưa đến ngày sync GRPO'
        : 'chưa đến ngày xuất hàng';
    return `Chờ ${name} ${formatted} (${why})`;
  }
  return `Đã đến/qua ${name} ${formatted} — ${target} chưa có, cần kiểm tra`;
}

/** Gom các mã chứng từ duy nhất khác rỗng, sắp xếp theo `(len, ascii)` và nối bằng `', '` (`join_nums`, `:2756`). */
export function joinNums(rows: readonly SapRowRecord[], col: string): string {
  const vals = Array.from(
    new Set(
      rows
        .map((r) => r[col])
        .filter((v) => v !== null && v !== undefined && v !== '')
        .map((v) => String(v)),
    ),
  );
  vals.sort((a, b) => a.length - b.length || compareAscii(a, b));
  return vals.join(', ');
}

/** Lấy giá trị lớn nhất khác null của cột theo thứ tự chuỗi ASCII (`latest`, `:2760`). */
export function latestValue(
  rows: readonly SapRowRecord[],
  col: string,
): SapCellValue {
  const vals = rows
    .map((r) => r[col])
    .filter(
      (v): v is Exclude<SapCellValue, null> => v !== null && v !== undefined,
    );
  if (vals.length === 0) {
    return null;
  }
  let maxVal = vals[0]!;
  for (let i = 1; i < vals.length; i++) {
    const cur = vals[i]!;
    if (compareAscii(String(cur), String(maxVal)) > 0) {
      maxVal = cur;
    }
  }
  return maxVal;
}

/** Thống kê tối đa 3 ngày xuất hiện nhiều nhất dạng `dd/mm (count)` (`top_days`, `:2611-2618`). */
export function topDays(dates: readonly unknown[]): string {
  const counts = new Map<string, number>();
  for (const raw of dates) {
    const d = toSapDateString(raw);
    if (d !== null) {
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
  }
  const sorted = Array.from(counts.entries()).sort(
    ([dateA, countA], [dateB, countB]) =>
      countB - countA || compareAscii(dateA, dateB),
  );
  const top3 = sorted
    .slice(0, 3)
    .map(([d, n]) => `${d.slice(8, 10)}/${d.slice(5, 7)} (${n})`)
    .join(', ');
  return counts.size > 3 ? `${top3} ...` : top3;
}

/** Định dạng mô tả bước phễu dạng checklist nhiều dòng (`desc_lines`, `:2621-2630`). */
export function descLines(
  okTxt: string,
  wait = 0,
  waitTxt = '',
  act = 0,
  actTxt = '',
  actDetail = '',
): string {
  const lines = [`   ✔ ${okTxt}`];
  if (wait > 0) {
    lines.push(`   ⏳ ${wait} ${waitTxt}`);
  }
  if (act > 0) {
    lines.push(`   ⚠ ${act} ${actTxt}`);
    if (actDetail) {
      lines.push(`        ↳ ${actDetail}`);
    }
  }
  return lines.join('\n');
}

/** Chọn biểu tượng trạng thái cho dòng phễu chuyển đổi (`funnel_icon`, `:2637-2639`). */
export function funnelIcon(notOk: number, act: number): string {
  return act > 0 ? '⚠' : notOk > 0 ? '⏳' : '✔';
}

/** Tính khoảng cách số ngày nguyên giữa 2 chuỗi `'YYYY-MM-DD'` (`d1 - d2`). */
export function diffDays(d1: string, d2: string): number {
  return Math.round(
    (Date.parse(`${d1}T00:00:00Z`) - Date.parse(`${d2}T00:00:00Z`)) /
      86_400_000,
  );
}
