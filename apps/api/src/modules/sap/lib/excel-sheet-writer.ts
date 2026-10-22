// Bộ công cụ ghi worksheet Excel dạng streaming bằng ExcelJS.stream.xlsx.WorkbookWriter qua PassThrough.
// Chống deadlock backpressure 16KB, chống Formula Injection, định dạng tiêu đề #1F4E79, freeze A2, AutoFilter và số thực #,##0.00###.
// Nguồn đối chiếu 1:1: desktop `sales_flow_checker.py` (:2815-2839, :3301).
import { PassThrough } from 'node:stream';
import ExcelJS from 'exceljs';
import type { SapCellValue } from './sap-row-normalizer';

const SAMPLE_WIDTH_ROW_LIMIT = 300;
const MIN_COL_WIDTH = 10;
const MAX_COL_WIDTH = 40;
const FLOAT_NUM_FMT = '#,##0.00###';
const HEADER_BG_ARGB = 'FF1F4E79';
const HEADER_FONT_ARGB = 'FFFFFFFF';
const FORMULA_INJECTION_REGEX = /^[=+\-@]/;

/**
 * Chuẩn hóa tên sheet Excel tối đa 31 ký tự và loại bỏ ký tự cấm (`sales_flow_checker.py:3301`).
 */
export function sanitizeExcelSheetName(label: string): string {
  return label
    .replace(' – ', ' ')
    .replace(/[\\/*?:[\]]/g, '')
    .slice(0, 31);
}

/**
 * Làm sạch giá trị ô trước khi ghi vào Excel để chống Formula Injection / CSV Injection.
 * Chuỗi bắt đầu bằng `=`, `+`, `-`, `@` (kể cả có khoảng trắng đầu) sẽ được thêm dấu nháy đơn `'`.
 */
export function sanitizeExcelCellValue(val: SapCellValue): SapCellValue {
  if (typeof val === 'string' && FORMULA_INJECTION_REGEX.test(val.trimStart())) {
    return `'${val}`;
  }
  return val;
}

/**
 * Định dạng giá trị ô thành chuỗi để ước lượng độ rộng hiển thị của cột (`sales_flow_checker.py:1133, 2835`).
 */
export function formatCellForWidth(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }
  if (typeof val === 'number' && !Number.isInteger(val)) {
    return val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  }
  return String(val);
}

/**
 * Định dạng thời gian theo múi giờ Việt Nam (`Asia/Ho_Chi_Minh`) phục vụ đặt tên file và dòng meta "Xuất lúc".
 */
export function formatVietnamDateTime(now: Date = new Date()): {
  fileTimestamp: string;
  displayTimestamp: string;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }

  const yyyy = map.year ?? '0000';
  const MM = map.month ?? '01';
  const dd = map.day ?? '01';
  const rawHour = map.hour ?? '00';
  const HH = rawHour === '24' ? '00' : rawHour;
  const mm = map.minute ?? '00';
  const ss = map.second ?? '00';

  return {
    fileTimestamp: `${yyyy}${MM}${dd}_${HH}${mm}${ss}`,
    displayTimestamp: `${dd}/${MM}/${yyyy} ${HH}:${mm}:${ss}`,
  };
}

/**
 * Khởi tạo `WorkbookWriter` ghi qua `PassThrough` stream.
 * Bắt buộc gắn listener `'data'` ngay khi tạo `PassThrough` để stream luôn ở chế độ flowing,
 * tránh đầy bộ đệm 16KB gây treo `workbook.commit()`.
 */
export interface StreamingWorkbookHandle {
  workbook: ExcelJS.stream.xlsx.WorkbookWriter;
  finishWorkbook: () => Promise<Buffer>;
}

export function createStreamingWorkbook(): StreamingWorkbookHandle {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];

  const bufferPromise = new Promise<Buffer>((resolve, reject) => {
    stream.on('data', (chunk: Buffer) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream,
    useStyles: true,
  });

  return {
    workbook,
    finishWorkbook: async (): Promise<Buffer> => {
      await workbook.commit();
      return bufferPromise;
    },
  };
}

/**
 * Ghi 1 worksheet chuẩn từ bảng `{ columns, rows }` (`write_excel_sheet`, `sales_flow_checker.py:2815-2839`):
 * - Freeze dòng đầu (`A2`: `ySplit: 1`)
 * - Tự động căn độ rộng cột trong khoảng `[10, 40]` dựa trên tiêu đề và tối đa 300 dòng mẫu đầu
 * - Dòng tiêu đề chữ trắng in đậm trên nền xanh đậm `#1F4E79`
 * - Định dạng số thực và cột `'Tong SL PO'` với `#,##0.00###`
 * - Bật AutoFilter khi có dữ liệu
 */
export function writeStandardWorksheet(
  workbook: ExcelJS.stream.xlsx.WorkbookWriter,
  sheetName: string,
  columns: readonly string[],
  rows: readonly (readonly SapCellValue[])[],
): void {
  const ws = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const sampleCount = Math.min(rows.length, SAMPLE_WIDTH_ROW_LIMIT);
  const widths = columns.map((col, colIdx) => {
    let longest = String(col).length;
    for (let i = 0; i < sampleCount; i++) {
      const cellLen = formatCellForWidth(rows[i]?.[colIdx]).length;
      if (cellLen > longest) {
        longest = cellLen;
      }
    }
    return Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, longest + 2));
  });

  ws.columns = columns.map((_col, idx) => ({ width: widths[idx] }));

  if (rows.length > 0 && columns.length > 0) {
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: rows.length + 1, column: columns.length },
    };
  }

  const headerRow = ws.addRow([...columns]);
  for (let colIdx = 0; colIdx < columns.length; colIdx++) {
    const cell = headerRow.getCell(colIdx + 1);
    cell.font = { bold: true, color: { argb: HEADER_FONT_ARGB } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: HEADER_BG_ARGB },
    };
  }
  headerRow.commit();

  for (const rawRow of rows) {
    const sanitizedValues = columns.map((_col, colIdx) =>
      sanitizeExcelCellValue(rawRow[colIdx] ?? null),
    );
    const row = ws.addRow(sanitizedValues);
    for (let colIdx = 0; colIdx < columns.length; colIdx++) {
      const rawVal = rawRow[colIdx];
      if (
        typeof rawVal === 'number' &&
        (columns[colIdx] === 'Tong SL PO' || !Number.isInteger(rawVal))
      ) {
        row.getCell(colIdx + 1).numFmt = FLOAT_NUM_FMT;
      }
    }
    row.commit();
  }

  ws.commit();
}
