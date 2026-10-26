// Hàm dựng 8 câu truy vấn SQL cho màn hình Monitor Trả hàng (7 câu chứng từ/kho + 1 câu tìm PO cũ `old_pos`).
// Nguồn đối chiếu 1:1: `build_return_queries` (:3439-3510) trong desktop `sales_flow_checker.py`.
import { type OpenQuerySql, wrapOpenquery } from '../lib/openquery';
import { RETURN_PO_VENDOR_CODE } from '../lib/sap-constants';
import { assertPoNumbers, assertSapBrand, assertSapDate } from '../lib/sap-query-params';

export type ReturnCandidatesQueryKey = 'old_pos';
export type ReturnListQueryKey = 'po' | 'so' | 'do' | 'ar' | 'grpo' | 'ap' | 'whs';

export interface ReturnQueriesCandidatesOptions {
  readonly poNumbers?: readonly number[];
  readonly candidates: true;
}

export interface ReturnQueriesStandardOptions {
  readonly poNumbers?: readonly number[];
  readonly candidates?: false;
}

export type ReturnQueriesOptions = ReturnQueriesCandidatesOptions | ReturnQueriesStandardOptions;

/**
 * Dựng các câu truy vấn SQL của màn hình Monitor Trả hàng (`build_return_queries`, desktop `:3439-3510`).
 * - Khi `candidates: true`: chỉ trả `{ old_pos }` (5 nhánh `UNION` tìm PO trước kỳ còn phát sinh chứng từ trong kỳ).
 * - Còn lại: trả 7 khóa `po`, `so`, `do`, `ar`, `grpo`, `ap`, `whs`.
 * Lưu ý thứ tự ưu tiên như desktop (`:3447-3452`): `poNumbers` được xét trước `candidates` khi dựng `dateCond`.
 */
export function buildReturnQueries(
  dateFrom: string,
  brand: string,
  options: ReturnQueriesCandidatesOptions,
): Record<ReturnCandidatesQueryKey, OpenQuerySql>;
export function buildReturnQueries(
  dateFrom: string,
  brand: string,
  options?: ReturnQueriesStandardOptions,
): Record<ReturnListQueryKey, OpenQuerySql>;
export function buildReturnQueries(
  dateFrom: string,
  brand: string,
  options: ReturnQueriesOptions = {},
): Record<ReturnCandidatesQueryKey, OpenQuerySql> | Record<ReturnListQueryKey, OpenQuerySql> {
  assertSapDate(dateFrom);
  assertSapBrand(brand);

  const { poNumbers, candidates = false } = options;
  if (poNumbers !== undefined) {
    assertPoNumbers(poNumbers);
  }

  const d = dateFrom;
  const storeExpr = `COALESCE(S."U_Store", SUBSTR_BEFORE(P."U_MCDocNum", '-'))`;

  let dateCond: string;
  if (poNumbers !== undefined) {
    const nums = poNumbers.join(', ');
    dateCond = `P."DocNum" IN (${nums})`;
  } else if (candidates) {
    dateCond = `P."DocDate" < '${d}'`;
  } else {
    dateCond = `P."DocDate" >= '${d}'`;
  }

  const base = (joins: string): string => `FROM kbmd_live.OPOR P
LEFT JOIN maycha_live.ORDR S ON P."U_from_refno" = 'SO' || TO_VARCHAR(S."DocNum") AND S."CANCELED" = 'N'
LEFT JOIN maycha_live.OWHS W ON W."WhsCode" = ${storeExpr}
${joins}
WHERE P."CardCode" = '${RETURN_PO_VENDOR_CODE}' AND P."CANCELED" = 'N' AND ${dateCond}
  AND W."U_Brand" = '${brand}'`;

  const grpoJoin = `INNER JOIN kbmd_live.PDN1 GL ON GL."BaseType" = 22 AND GL."BaseEntry" = P."DocEntry"
INNER JOIN kbmd_live.OPDN G ON G."DocEntry" = GL."DocEntry" AND G."CANCELED" = 'N'`;

  const apJoin = `${grpoJoin}
INNER JOIN kbmd_live.PCH1 AL ON AL."BaseType" = 20 AND AL."BaseEntry" = G."DocEntry"
INNER JOIN kbmd_live.OPCH A ON A."DocEntry" = AL."DocEntry" AND A."CANCELED" = 'N'`;

  const doJoin = `INNER JOIN maycha_live.DLN1 DL ON DL."BaseType" = 17 AND DL."BaseEntry" = S."DocEntry"
INNER JOIN maycha_live.ODLN D ON D."DocEntry" = DL."DocEntry" AND D."CANCELED" = 'N'`;

  const arCols = `SELECT DISTINCT P."DocNum" AS "PO Number", I."DocNum" AS "AR Number", I."DocDate" AS "AR DocDate",
 I."CreateDate" AS "AR CreateDate", (SELECT MAX(L."ShipDate") FROM maycha_live.INV1 L WHERE L."DocEntry" = I."DocEntry") AS "AR ShipDate", I."NumAtCard" AS "Invoice No"`;

  const arDirect = `INNER JOIN maycha_live.INV1 N ON N."BaseType" = 17 AND N."BaseEntry" = S."DocEntry"
INNER JOIN maycha_live.OINV I ON I."DocEntry" = N."DocEntry" AND I."CANCELED" = 'N'`;

  const arViaDo = `INNER JOIN maycha_live.DLN1 DL ON DL."BaseType" = 17 AND DL."BaseEntry" = S."DocEntry"
INNER JOIN maycha_live.INV1 N ON N."BaseType" = 15 AND N."BaseEntry" = DL."DocEntry"
INNER JOIN maycha_live.OINV I ON I."DocEntry" = N."DocEntry" AND I."CANCELED" = 'N'`;

  if (candidates) {
    const pick = `SELECT DISTINCT P."DocNum" AS "PO Number"`;
    const parts = [
      `${pick}\n${base('')} AND S."DocNum" IS NOT NULL AND S."CreateDate" >= '${d}'`,
      `${pick}\n${base(arDirect)} AND I."CreateDate" >= '${d}'`,
      `${pick}\n${base(arViaDo)} AND I."CreateDate" >= '${d}'`,
      `${pick}\n${base(grpoJoin)} AND G."DocDate" >= '${d}'`,
      `${pick}\n${base(apJoin)} AND A."DocDate" >= '${d}'`,
    ];
    return {
      old_pos: wrapOpenquery(parts.join('\nUNION\n')),
    };
  }

  return {
    po: wrapOpenquery(`SELECT DISTINCT P."DocNum" AS "PO Number", P."DocDate" AS "PO DocDate", P."CreateDate" AS "PO CreateDate",
 ${storeExpr} AS "Store", W."U_Brand" AS "Brand", P."U_MCDocNum" AS "MC Docnum",
 (SELECT MIN(PL."WhsCode") FROM kbmd_live.POR1 PL WHERE PL."DocEntry" = P."DocEntry") AS "Kho PO min",
 (SELECT MAX(PL."WhsCode") FROM kbmd_live.POR1 PL WHERE PL."DocEntry" = P."DocEntry") AS "Kho PO max"
${base('')}`),

    so: wrapOpenquery(`SELECT DISTINCT P."DocNum" AS "PO Number", S."DocNum" AS "SO Number", S."DocDate" AS "SO DocDate",
 S."CreateDate" AS "SO CreateDate",
 (SELECT MAX(L."ShipDate") FROM maycha_live.RDR1 L WHERE L."DocEntry" = S."DocEntry") AS "SO ShipDate",
 (SELECT MIN(L."WhsCode") FROM maycha_live.RDR1 L WHERE L."DocEntry" = S."DocEntry") AS "Kho SO min",
 (SELECT MAX(L."WhsCode") FROM maycha_live.RDR1 L WHERE L."DocEntry" = S."DocEntry") AS "Kho SO max"
${base('')} AND S."DocNum" IS NOT NULL`),

    do: wrapOpenquery(`SELECT DISTINCT P."DocNum" AS "PO Number", D."DocNum" AS "DO Number"
${base(doJoin)}`),

    ar: wrapOpenquery(`${arCols}\n${base(arDirect)}\nUNION\n${arCols}\n${base(arViaDo)}`),

    grpo: wrapOpenquery(`SELECT DISTINCT P."DocNum" AS "PO Number", G."DocNum" AS "GRPO Number", G."DocDate" AS "GRPO DocDate",
 (SELECT MIN(X."WhsCode") FROM kbmd_live.PDN1 X WHERE X."DocEntry" = G."DocEntry") AS "Kho GRPO min",
 (SELECT MAX(X."WhsCode") FROM kbmd_live.PDN1 X WHERE X."DocEntry" = G."DocEntry") AS "Kho GRPO max"
${base(grpoJoin)}`),

    ap: wrapOpenquery(`SELECT DISTINCT P."DocNum" AS "PO Number", G."DocNum" AS "GRPO Number", A."DocNum" AS "AP Number", A."DocDate" AS "AP DocDate"
${base(apJoin)}`),

    whs: wrapOpenquery(`SELECT 'T' AS "DB", "WhsCode", "WhsName" FROM maycha_live.OWHS
UNION ALL
SELECT 'K', "WhsCode", "WhsName" FROM kbmd_live.OWHS`),
  };
}
