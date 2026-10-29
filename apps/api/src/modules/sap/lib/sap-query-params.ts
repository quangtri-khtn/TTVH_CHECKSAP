// Kiểm tra tính hợp lệ của tham số đầu vào trước khi nội suy vào câu truy vấn SAP HANA.
// OPENQUERY không hỗ trợ bind parameter nên mọi tham số phải qua kiểm tra định dạng nghiêm ngặt.
import { BadRequestException } from '@nestjs/common';

const SAP_DATE_REGEX = /^\d{8}$/;
const SAP_BRAND_REGEX = /^[A-Za-z0-9]{1,10}$/;
const SAP_BRAND_OPTIONAL_REGEX = /^[A-Za-z0-9]{0,10}$/;

/**
 * Kiểm tra chuỗi ngày SAP dạng `YYYYMMDD` và là ngày lịch có thật.
 * Sai định dạng hoặc ngày không tồn tại (vd `20260230`) sẽ ném `BadRequestException`.
 */
export function assertSapDate(value: string): void {
  if (typeof value !== 'string' || !SAP_DATE_REGEX.test(value)) {
    throw new BadRequestException(
      'Ngày truy vấn SAP không hợp lệ (yêu cầu định dạng YYYYMMDD)',
    );
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    throw new BadRequestException(
      'Ngày truy vấn SAP không tồn tại trên lịch (yêu cầu định dạng YYYYMMDD hợp lệ)',
    );
  }
}

/**
 * Kiểm tra khoảng ngày `Từ ngày` (`dateFrom`) và `Đến ngày` (`dateTo`, tùy chọn).
 * Cả hai phải đúng định dạng `YYYYMMDD` hợp lệ và `dateFrom <= dateTo`.
 */
export function assertSapDateRange(dateFrom: string, dateTo?: string): void {
  assertSapDate(dateFrom);
  if (dateTo !== undefined && dateTo !== '') {
    assertSapDate(dateTo);
    if (dateFrom > dateTo) {
      throw new BadRequestException(
        'Từ ngày phải nhỏ hơn hoặc bằng Đến ngày.',
      );
    }
  }
}

/**
 * Kiểm tra mã thương hiệu (`OWHS.U_Brand`): mặc định cho phép chuỗi rỗng `""` (= mọi thương hiệu)
 * hoặc gồm chữ cái ASCII và chữ số, dài 1–10 ký tự.
 */
export function assertSapBrand(
  value: string,
  options: { readonly allowEmpty?: boolean } = { allowEmpty: true },
): void {
  const allowEmpty = options.allowEmpty ?? true;
  const regex = allowEmpty ? SAP_BRAND_OPTIONAL_REGEX : SAP_BRAND_REGEX;
  if (typeof value !== 'string' || !regex.test(value)) {
    throw new BadRequestException(
      'Mã thương hiệu (brand) truy vấn SAP không hợp lệ (chỉ chấp nhận 1–10 ký tự chữ và số ASCII, hoặc để trống = mọi brand)',
    );
  }
}

/**
 * Chuyển mọi cụm `"DocDate" >= '${dateFrom}'` thành `"DocDate" BETWEEN '${dateFrom}' AND '${dateTo}'`
 * trước khi bọc `OPENQUERY` (Mục 4.1 & Phụ lục C.1 Đặc tả v1.1).
 * Giữ nguyên `"CreateDate" >= '${dateFrom}'` và `"DocDate" < '${dateFrom}'`.
 */
export function applyDateTo(
  sqlText: string,
  dateFrom: string,
  dateTo?: string,
): string {
  assertSapDateRange(dateFrom, dateTo);
  if (!dateTo || dateTo === '') {
    return sqlText;
  }
  return sqlText
    .split(`"DocDate" >= '${dateFrom}'`)
    .join(`"DocDate" BETWEEN '${dateFrom}' AND '${dateTo}'`);
}

/**
 * Kiểm tra danh sách số chứng từ PO (`DocNum`): mảng không rỗng, mỗi phần tử là số nguyên dương an toàn.
 * Chặn mảng rỗng để không bao giờ sinh mệnh đề `IN ()` lỗi cú pháp trên HANA.
 */
export function assertPoNumbers(values: readonly number[]): void {
  if (!Array.isArray(values) || values.length === 0) {
    throw new BadRequestException(
      'Danh sách số PO truy vấn SAP không được để trống',
    );
  }

  for (const n of values) {
    if (typeof n !== 'number' || !Number.isSafeInteger(n) || n <= 0) {
      throw new BadRequestException(
        'Số PO truy vấn SAP phải là số nguyên dương hợp lệ',
      );
    }
  }
}
