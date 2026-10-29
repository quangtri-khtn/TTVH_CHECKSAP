// Hàm dựng 12 câu truy vấn SQL cho màn hình Monitor Luồng Trả gốc SO (7 câu chính `so..whs` + 5 câu tìm SO cũ `old_sos_1..5`).
// Nguồn đối chiếu 1:1: Phụ lục C Mục 3.1 & 3.2 Đặc tả kỹ thuật v1.1 (28/10/2026).
import { type OpenQuerySql, wrapOpenquery } from '../lib/openquery';
import {
  RETURN_PO_VENDOR_CODE,
  RETURN_SO_CUSTOMER_CODE,
} from '../lib/sap-constants';
import {
  applyDateTo,
  assertPoNumbers,
  assertSapBrand,
  assertSapDateRange,
} from '../lib/sap-query-params';

export type ReturnCandidatesQueryKey =
  | 'old_sos_1'
  | 'old_sos_2'
  | 'old_sos_3'
  | 'old_sos_4'
  | 'old_sos_5';
export type ReturnListQueryKey =
  | 'so'
  | 'po'
  | 'do'
  | 'ar'
  | 'grpo'
  | 'ap'
  | 'whs';

export interface ReturnQueriesCandidatesOptions {
  readonly soNumbers?: readonly number[];
  readonly poNumbers?: readonly number[];
  readonly dateTo?: string;
  readonly candidates: true;
}

export interface ReturnQueriesStandardOptions {
  readonly soNumbers?: readonly number[];
  readonly poNumbers?: readonly number[];
  readonly dateTo?: string;
  readonly candidates?: false;
}

export type ReturnQueriesOptions =
  | ReturnQueriesCandidatesOptions
  | ReturnQueriesStandardOptions;

/**
 * Dựng các câu truy vấn SQL của màn hình Monitor Luồng Trả theo gốc `SO Number` (Phụ lục C.3 Đặc tả v1.1).
 * - Khi `candidates: true`: trả 5 khóa `{ old_sos_1, old_sos_2, old_sos_3, old_sos_4, old_sos_5 }`.
 * - Còn lại: trả 7 khóa `{ so, po, do, ar, grpo, ap, whs }`.
 */
export function buildReturnQueries(
  dateFrom: string,
  brand: string,
  options: ReturnQueriesCandidatesOptions,
): Record<ReturnCandidatesQueryKey, OpenQuerySql>;
export function buildReturnQueries(
  dateFrom: string,
  brand?: string,
  options?: ReturnQueriesStandardOptions,
): Record<ReturnListQueryKey, OpenQuerySql>;
export function buildReturnQueries(
  dateFrom: string,
  brand = '',
  options: ReturnQueriesOptions = {},
):
  | Record<ReturnCandidatesQueryKey, OpenQuerySql>
  | Record<ReturnListQueryKey, OpenQuerySql> {
  const { soNumbers, poNumbers, dateTo, candidates = false } = options;
  const docNumbers = soNumbers ?? poNumbers;
  assertSapDateRange(dateFrom, dateTo);
  assertSapBrand(brand);
  if (docNumbers !== undefined) {
    assertPoNumbers(docNumbers);
  }

  const d = dateFrom;
  const normalizedBrand =
    brand.trim().toUpperCase() === 'ALL' ? '' : brand.trim();
  const brandCond = normalizedBrand ? ` AND W."U_Brand" = '${normalizedBrand}'` : '';
  const storeExpr = `COALESCE(S."U_Store", SUBSTR_BEFORE(S."U_MCDocNum", '-'))`;

  let dateCond: string;
  if (docNumbers !== undefined) {
    const nums = docNumbers.join(', ');
    dateCond = `S."DocNum" IN (${nums})`;
  } else if (candidates) {
    dateCond = `S."DocDate" < '${d}'`;
  } else {
    dateCond = `S."DocDate" >= '${d}'`;
  }

  const base = (joins: string): string => {
    const joinsLine = joins ? `\n${joins}` : '';
    return `FROM maycha_live.ORDR S
LEFT JOIN kbmd_live.OPOR P ON P."U_from_refno" = 'SO' || TO_VARCHAR(S."DocNum")
  AND P."CardCode" = '${RETURN_PO_VENDOR_CODE}' AND P."CANCELED" = 'N'
LEFT JOIN maycha_live.OWHS W ON W."WhsCode" = ${storeExpr}${joinsLine}
WHERE S."CardCode" = '${RETURN_SO_CUSTOMER_CODE}' AND (S."CANCELED" = 'N' OR P."DocNum" IS NOT NULL) AND ${dateCond}${brandCond}`;
  };

  const grpoJoin = `INNER JOIN kbmd_live.PDN1 GL ON GL."BaseType" = 22 AND GL."BaseEntry" = P."DocEntry"
INNER JOIN kbmd_live.OPDN G ON G."DocEntry" = GL."DocEntry" AND G."CANCELED" = 'N'`;

  const apJoin = `${grpoJoin}
INNER JOIN kbmd_live.PCH1 AL ON AL."BaseType" = 20 AND AL."BaseEntry" = G."DocEntry"
INNER JOIN kbmd_live.OPCH A ON A."DocEntry" = AL."DocEntry" AND A."CANCELED" = 'N'`;

  const doJoin = `INNER JOIN maycha_live.DLN1 DL ON DL."BaseType" = 17 AND DL."BaseEntry" = S."DocEntry"
INNER JOIN maycha_live.ODLN D ON D."DocEntry" = DL."DocEntry" AND D."CANCELED" = 'N'`;

  const arCols = `SELECT DISTINCT S."DocNum" AS "SO Number", I."DocNum" AS "AR Number", I."DocDate" AS "AR DocDate",
 I."CreateDate" AS "AR CreateDate", (SELECT MAX(L."ShipDate") FROM maycha_live.INV1 L WHERE L."DocEntry" = I."DocEntry") AS "AR ShipDate", I."NumAtCard" AS "Invoice No"`;

  const arDirect = `INNER JOIN maycha_live.INV1 N ON N."BaseType" = 17 AND N."BaseEntry" = S."DocEntry"
INNER JOIN maycha_live.OINV I ON I."DocEntry" = N."DocEntry" AND I."CANCELED" = 'N'`;

  const arViaDo = `INNER JOIN maycha_live.DLN1 DL ON DL."BaseType" = 17 AND DL."BaseEntry" = S."DocEntry"
INNER JOIN maycha_live.INV1 N ON N."BaseType" = 15 AND N."BaseEntry" = DL."DocEntry"
INNER JOIN maycha_live.OINV I ON I."DocEntry" = N."DocEntry" AND I."CANCELED" = 'N'`;

  const wrap = (sql: string, allowUpper = true): OpenQuerySql =>
    wrapOpenquery(
      allowUpper && docNumbers === undefined
        ? applyDateTo(sql, dateFrom, dateTo)
        : sql,
    );

  if (candidates) {
    const pick = `SELECT DISTINCT S."DocNum" AS "SO Number"`;
    return {
      old_sos_1: wrap(
        `${pick}\n${base('')}\n AND P."DocNum" IS NOT NULL AND P."CreateDate" >= '${d}'`,
        false,
      ),
      old_sos_2: wrap(
        `${pick}\n${base(arDirect)}\n AND I."CreateDate" >= '${d}'`,
        false,
      ),
      old_sos_3: wrap(
        `${pick}\n${base(arViaDo)}\n AND I."CreateDate" >= '${d}'`,
        false,
      ),
      old_sos_4: wrap(
        `${pick}\n${base(grpoJoin)}\n AND G."DocDate" >= '${d}'`,
        true,
      ),
      old_sos_5: wrap(
        `${pick}\n${base(apJoin)}\n AND A."DocDate" >= '${d}'`,
        true,
      ),
    };
  }

  return {
    so: wrap(`SELECT DISTINCT S."DocNum" AS "SO Number", S."DocDate" AS "SO DocDate", S."CreateDate" AS "SO CreateDate",
 S."CANCELED" AS "SO Canceled", ${storeExpr} AS "Store", W."U_Brand" AS "Brand", S."U_MCDocNum" AS "MC Docnum",
 (SELECT MAX(L."ShipDate") FROM maycha_live.RDR1 L WHERE L."DocEntry" = S."DocEntry") AS "SO ShipDate",
 (SELECT MIN(L."WhsCode") FROM maycha_live.RDR1 L WHERE L."DocEntry" = S."DocEntry") AS "Kho SO min",
 (SELECT MAX(L."WhsCode") FROM maycha_live.RDR1 L WHERE L."DocEntry" = S."DocEntry") AS "Kho SO max"
${base('')}`),

    po: wrap(`SELECT DISTINCT S."DocNum" AS "SO Number", P."DocNum" AS "PO Number", P."DocDate" AS "PO DocDate",
 P."CreateDate" AS "PO CreateDate",
 (SELECT MIN(PL."WhsCode") FROM kbmd_live.POR1 PL WHERE PL."DocEntry" = P."DocEntry") AS "Kho PO min",
 (SELECT MAX(PL."WhsCode") FROM kbmd_live.POR1 PL WHERE PL."DocEntry" = P."DocEntry") AS "Kho PO max"
${base('')}
 AND P."DocNum" IS NOT NULL`),

    do: wrap(`SELECT DISTINCT S."DocNum" AS "SO Number", D."DocNum" AS "DO Number"
${base(doJoin)}`),

    ar: wrap(`${arCols}\n${base(arDirect)}\nUNION\n${arCols}\n${base(arViaDo)}`),

    grpo: wrap(`SELECT DISTINCT S."DocNum" AS "SO Number", G."DocNum" AS "GRPO Number", G."DocDate" AS "GRPO DocDate",
 (SELECT MIN(X."WhsCode") FROM kbmd_live.PDN1 X WHERE X."DocEntry" = G."DocEntry") AS "Kho GRPO min",
 (SELECT MAX(X."WhsCode") FROM kbmd_live.PDN1 X WHERE X."DocEntry" = G."DocEntry") AS "Kho GRPO max"
${base(grpoJoin)}`),

    ap: wrap(`SELECT DISTINCT S."DocNum" AS "SO Number", G."DocNum" AS "GRPO Number", A."DocNum" AS "AP Number", A."DocDate" AS "AP DocDate",
 A."NumAtCard" AS "AP Invoice No"
${base(apJoin)}`),

    whs: wrap(
      `SELECT 'T' AS "DB", "WhsCode", "WhsName" FROM maycha_live.OWHS
UNION ALL
SELECT 'K', "WhsCode", "WhsName" FROM kbmd_live.OWHS`,
      false,
    ),
  };
}
