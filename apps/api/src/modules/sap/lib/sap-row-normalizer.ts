// Chuẩn hóa kết quả truy vấn mssql ở chế độ arrayRowMode = true về cấu trúc
// { columns, rows } đồng nhất, đổi BigInt sang number và Date sang YYYY-MM-DD.
import * as sql from 'mssql';

export type SapCellValue = string | number | boolean | null;

export interface SapQueryResult {
  columns: string[];
  rows: SapCellValue[][];
}

interface RawColumnMetadata {
  name?: unknown;
  type?: unknown;
}

interface RawArrayModeResult {
  recordset?: unknown;
  columns?: unknown;
}

/**
 * Chuẩn hóa kết quả trả về từ `request.query(...)` khi bật `request.arrayRowMode = true`.
 * - Cột có `type === sql.BigInt` (khác null/undefined) được đổi sang `Number(value)`.
 * - Giá trị `Date` được đổi sang chuỗi ngày UTC `YYYY-MM-DD` (`toISOString().slice(0, 10)`).
 * - Các giá trị còn lại (bao gồm chuỗi `nvarchar` có dạng số như `'00123'`) giữ nguyên.
 * - Bảo toàn thứ tự cột và các cột trùng tên theo `result.columns[0]`.
 */
export function normalizeArrayModeResult(result: unknown): SapQueryResult {
  if (!result || typeof result !== 'object') {
    return { columns: [], rows: [] };
  }

  const raw = result as RawArrayModeResult;
  if (!Array.isArray(raw.recordset)) {
    return { columns: [], rows: [] };
  }

  const rawColumnsOuter = Array.isArray(raw.columns) ? raw.columns : [];
  const colMetaList: RawColumnMetadata[] = Array.isArray(rawColumnsOuter[0])
    ? (rawColumnsOuter[0] as RawColumnMetadata[])
    : [];

  const columns = colMetaList.map((col) =>
    typeof col?.name === 'string' ? col.name : '',
  );

  const rows: SapCellValue[][] = raw.recordset.map((rawRow) => {
    if (!Array.isArray(rawRow)) {
      return [];
    }
    return rawRow.map((cell, colIndex): SapCellValue => {
      if (cell === null || cell === undefined) {
        return null;
      }
      if (colMetaList[colIndex]?.type === sql.BigInt) {
        return Number(cell);
      }
      if (cell instanceof Date) {
        return cell.toISOString().slice(0, 10);
      }
      if (
        typeof cell === 'string' ||
        typeof cell === 'number' ||
        typeof cell === 'boolean'
      ) {
        return cell;
      }
      return String(cell);
    });
  });

  return { columns, rows };
}
