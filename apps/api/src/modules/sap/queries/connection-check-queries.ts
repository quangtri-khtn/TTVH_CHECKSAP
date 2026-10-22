// 2 câu truy vấn OPENQUERY tối giản cho bước 2 và bước 3 của chức năng Kiểm tra kết nối SAP (maycha_live và kbmd_live).
import { type OpenQuerySql, wrapOpenquery } from '../lib/openquery';
import { SAP_SCHEMA_KBMD, SAP_SCHEMA_TTVH } from '../lib/sap-constants';

export const CONNECTION_CHECK_QUERIES: Readonly<Record<'maycha_live' | 'kbmd_live', OpenQuerySql>> =
  {
    maycha_live: wrapOpenquery(`SELECT TOP 1 "DocEntry" FROM ${SAP_SCHEMA_TTVH}.OPOR`),
    kbmd_live: wrapOpenquery(`SELECT TOP 1 "DocEntry" FROM ${SAP_SCHEMA_KBMD}.ORDR`),
  };
