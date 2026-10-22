// Ánh xạ lỗi từ mssql/tedious sang HttpException tiếng Việt an toàn.
// Tuyệt đối không đưa err.message, tên máy chủ, câu lệnh SQL hay username ra thông báo lỗi.
// Không bao giờ trả HTTP 401 hoặc 403 để tránh kích hoạt cơ chế refresh token của web client.
import { BadGatewayException, GatewayTimeoutException, HttpException } from '@nestjs/common';

export interface SapErrorMeta {
  code: string | undefined;
  number: number | undefined;
  precedingNumbers: number[];
}

interface RawDriverError {
  code?: unknown;
  number?: unknown;
  originalError?: {
    info?: {
      number?: unknown;
    };
  };
  precedingErrors?: unknown;
}

const SAFE_ERROR_CODE_REGEX = /^[A-Za-z0-9_-]{1,32}$/;

const OLE_DB_ERROR_MESSAGES: Readonly<Record<number, string>> = {
  7303: 'Linked server không mở được nguồn dữ liệu SAP HANA (mã 7303)',
  7320: 'Lỗi khi chạy câu truy vấn trên SAP HANA (mã 7320)',
  7321: 'SAP HANA từ chối câu truy vấn (mã 7321)',
  7330: 'Lỗi khi đọc dữ liệu từ SAP HANA (mã 7330)',
  7399: 'Linked server tới SAP HANA báo lỗi (mã 7399)',
};

function pickErrorNumber(raw: RawDriverError): number | undefined {
  const direct =
    typeof raw.number === 'number' && Number.isFinite(raw.number) ? raw.number : undefined;
  const nested =
    typeof raw.originalError?.info?.number === 'number' &&
    Number.isFinite(raw.originalError.info.number)
      ? raw.originalError.info.number
      : undefined;
  return direct ?? nested;
}

/**
 * Trích xuất mã `code`, `number` (kể cả trong `originalError.info.number`) và danh sách
 * mã số của `precedingErrors` để phục vụ map lỗi và ghi log chẩn đoán không chứa message gốc.
 */
export function extractSapErrorMeta(err: unknown): SapErrorMeta {
  if (!err || typeof err !== 'object') {
    return { code: undefined, number: undefined, precedingNumbers: [] };
  }

  const raw = err as RawDriverError;
  const code =
    typeof raw.code === 'string' && SAFE_ERROR_CODE_REGEX.test(raw.code) ? raw.code : undefined;

  const number = pickErrorNumber(raw);

  const precedingNumbers: number[] = [];
  if (Array.isArray(raw.precedingErrors)) {
    for (const item of raw.precedingErrors) {
      if (item && typeof item === 'object') {
        const itemNum = pickErrorNumber(item as RawDriverError);
        if (itemNum !== undefined) {
          precedingNumbers.push(itemNum);
        }
      }
    }
  }

  return { code, number, precedingNumbers };
}

/**
 * Chuyển đổi lỗi khi kết nối hoặc truy vấn SQL Server / linked server SAP HANA sang `HttpException`.
 * Giữ nguyên nếu đã là `HttpException`. Các lỗi khác được ánh xạ sang 502 hoặc 504 với thông báo tiếng Việt.
 */
export function toSapHttpException(err: unknown): HttpException {
  if (err instanceof HttpException) {
    return err;
  }

  const { code, number } = extractSapErrorMeta(err);

  if (code === 'ELOGIN') {
    return new BadGatewayException(
      'Đăng nhập SQL Server thất bại: sai tài khoản/mật khẩu hoặc tài khoản bị khóa',
    );
  }
  if (code === 'ETIMEOUT') {
    return new GatewayTimeoutException('SQL Server không phản hồi trong thời gian cho phép');
  }
  if (code === 'ESOCKET') {
    return new BadGatewayException('Không kết nối được tới SQL Server');
  }

  if (number !== undefined && OLE_DB_ERROR_MESSAGES[number]) {
    return new BadGatewayException(OLE_DB_ERROR_MESSAGES[number]);
  }
  if (number !== undefined) {
    return new BadGatewayException(`Lỗi khi truy vấn SAP (mã ${number})`);
  }
  if (code !== undefined) {
    return new BadGatewayException(`Lỗi khi truy vấn SAP (mã ${code})`);
  }

  return new BadGatewayException('Lỗi khi truy vấn SAP');
}
