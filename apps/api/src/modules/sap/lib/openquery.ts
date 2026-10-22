// Bọc câu truy vấn SAP HANA vào hàm OPENQUERY của SQL Server và đóng dấu kiểu OpenQuerySql.
// Nguồn đối chiếu 1:1: `_wrap_openquery` trong desktop `sales_flow_checker.py` (:595-596).
import { InternalServerErrorException } from '@nestjs/common';
import { SAP_LINKED_SERVER } from './sap-constants';

declare const brand: unique symbol;

/**
 * Chuỗi câu lệnh SQL Server đã qua `wrapOpenquery`.
 * Gateway chỉ chấp nhận kiểu này để ngăn truyền chuỗi SQL tùy ý chưa bọc/escape.
 */
export type OpenQuerySql = string & { readonly [brand]: true };

/** Giới hạn tối đa (8000 byte/ký tự ASCII) của đối số chuỗi trong hàm OPENQUERY của SQL Server. */
export const OPENQUERY_INNER_MAX_LENGTH = 8000;

/**
 * Cắt khoảng trắng đầu/cuối, nhân đôi dấu nháy đơn đúng 1 lần, kiểm tra giới hạn 8000 ký tự,
 * rồi bọc vào `select * from openquery(hana_mc, '...')`.
 */
export function wrapOpenquery(inner: string): OpenQuerySql {
  const escaped = inner.trim().replaceAll("'", "''");
  if (escaped.length > OPENQUERY_INNER_MAX_LENGTH) {
    throw new InternalServerErrorException(
      'Câu truy vấn SAP vượt giới hạn 8000 ký tự của OPENQUERY',
    );
  }
  return `select * from openquery(${SAP_LINKED_SERVER}, '${escaped}')` as OpenQuerySql;
}
