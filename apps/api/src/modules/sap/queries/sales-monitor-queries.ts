// Hàm dựng 13 câu truy vấn SQL cho màn hình Monitor Bán hàng (8 câu danh sách + 5 câu chuỗi chứng từ PO).
// Nguồn đối chiếu 1:1: `build_monitor_queries` (:2228-2351) và `build_monitor_chain_queries` (:2694-2743)
// trong desktop `sales_flow_checker.py`.
import { type OpenQuerySql, wrapOpenquery } from '../lib/openquery';
import {
  SALES_PO_VENDOR_CODE,
  SALES_SO_CUSTOMER_CODE,
} from '../lib/sap-constants';
import {
  assertPoNumbers,
  assertSapBrand,
  assertSapDate,
} from '../lib/sap-query-params';

export type SalesListQueryKey =
  | 'funnel'
  | 't1'
  | 't2'
  | 't3'
  | 't4'
  | 'ar'
  | 'grpo'
  | 'ap';

export type SalesChainQueryKey = 'po' | 'so' | 'ar' | 'grpo' | 'ap';

/** Mảnh JOIN kho/cửa hàng để lọc theo thương hiệu (`_MONITOR_BRAND_JOIN`, desktop `:2228-2230`). */
const _MONITOR_BRAND_JOIN = `JOIN maycha_live.OWHS W ON W."WhsCode" = P."U_Store" AND W."U_Brand" = '{brand}'`;

/**
 * Dựng 8 câu truy vấn danh sách của màn hình Monitor Bán hàng (`build_monitor_queries`, desktop `:2233-2351`).
 * Giữ nguyên thứ tự khóa: `funnel`, `t1`, `t2`, `t3`, `t4`, `ar`, `grpo`, `ap`.
 */
export function buildSalesListQueries(
  dateFrom: string,
  brand: string,
): Record<SalesListQueryKey, OpenQuerySql> {
  assertSapDate(dateFrom);
  assertSapBrand(brand);

  const br = _MONITOR_BRAND_JOIN.replace('{brand}', brand);
  const d = dateFrom;
  const poCols = `P."DocDate" AS "PO DocDate", P."CreateDate" AS "PO CreateDate", CASE WHEN P."CreateDate" < '${d}' THEN 'Co' ELSE 'Khong' END AS "PO tao truoc ky"`;
  const poGrp = `P."DocDate", P."CreateDate"`;

  return {
    funnel: wrapOpenquery(`
SELECT "Store", "Ten cua hang", SUM("PO") AS "PO", SUM("SO") AS "SO" FROM (
 SELECT P."U_Store" AS "Store", W."WhsName" AS "Ten cua hang", 1 AS "PO", 0 AS "SO"
 FROM maycha_live.OPOR P ${br}
 WHERE P."CardCode" = '${SALES_PO_VENDOR_CODE}' AND P."CANCELED" = 'N' AND P."DocDate" >= '${d}'
 UNION ALL
 SELECT P."U_Store", W."WhsName", 0, 1
 FROM kbmd_live.ORDR S
 INNER JOIN maycha_live.OPOR P ON 'PO' || TO_VARCHAR(P."DocNum") = S."U_from_refno" AND P."CardCode" = '${SALES_PO_VENDOR_CODE}'
 ${br}
 WHERE S."CardCode" = '${SALES_SO_CUSTOMER_CODE}' AND S."CANCELED" = 'N' AND S."DocDate" >= '${d}' AND P."DocDate" >= '${d}'
) GROUP BY "Store", "Ten cua hang" `),

    t1: wrapOpenquery(`
SELECT P."U_Store" AS "Store", P."DocNum" AS "PO Number", P."DocDate", P."CreateDate" AS "PO CreateDate", P."DocStatus" AS "PO Status",
 COUNT(*) AS "So dong PO",
 CASE WHEN MAX(CASE WHEN S."DocNum" IS NOT NULL THEN 1 ELSE 0 END) = 1 THEN 'SO da bi huy' ELSE 'Chua co SO' END AS "Ly do"
FROM maycha_live.OPOR P ${br}
INNER JOIN maycha_live.POR1 PL ON PL."DocEntry" = P."DocEntry"
LEFT JOIN kbmd_live.ORDR S ON S."U_from_refno" = 'PO' || TO_VARCHAR(P."DocNum") AND S."CardCode" = '${SALES_SO_CUSTOMER_CODE}'
WHERE P."CardCode" = '${SALES_PO_VENDOR_CODE}' AND P."CANCELED" = 'N' AND P."DocDate" >= '${d}'
  AND NOT EXISTS (SELECT 1 FROM kbmd_live.ORDR S2 WHERE S2."U_from_refno" = 'PO' || TO_VARCHAR(P."DocNum")
                    AND S2."CardCode" = '${SALES_SO_CUSTOMER_CODE}' AND S2."CANCELED" = 'N')
GROUP BY P."U_Store", P."DocNum", P."DocDate", P."CreateDate", P."DocStatus"
ORDER BY P."DocDate", P."DocNum" `),

    t2: wrapOpenquery(`
SELECT P."U_Store" AS "Store", S."DocNum" AS "SO Number", P."DocNum" AS "PO Number", ${poCols}, S."DocDate",
 MAX(SL."ShipDate") AS "SO ShipDate",
 CASE WHEN MAX(SL."ShipDate") > CURRENT_DATE THEN 'Chua den ShipDate - chua den ngay xuat hang (binh thuong)'
      ELSE 'Da den/qua ShipDate - chua co A/R, can kiem tra' END AS "Ghi chu ShipDate",
 COUNT(*) AS "So dong SO", SUM(CASE WHEN IL."DocEntry" IS NULL THEN 1 ELSE 0 END) AS "So dong chua co AR"
FROM kbmd_live.ORDR S
INNER JOIN kbmd_live.RDR1 SL ON SL."DocEntry" = S."DocEntry"
INNER JOIN maycha_live.OPOR P ON 'PO' || TO_VARCHAR(P."DocNum") = S."U_from_refno" AND P."CardCode" = '${SALES_PO_VENDOR_CODE}'
${br}
LEFT JOIN kbmd_live.INV1 IL ON IL."BaseType" = 17 AND IL."BaseEntry" = S."DocEntry" AND IL."BaseLine" = SL."LineNum"
  AND IL."DocEntry" IN (SELECT "DocEntry" FROM kbmd_live.OINV WHERE "CANCELED" = 'N')
WHERE S."CardCode" = '${SALES_SO_CUSTOMER_CODE}' AND S."CANCELED" = 'N' AND S."DocDate" >= '${d}'
GROUP BY P."U_Store", S."DocNum", P."DocNum", ${poGrp}, S."DocDate"
HAVING SUM(CASE WHEN IL."DocEntry" IS NULL THEN 1 ELSE 0 END) > 0
ORDER BY S."DocDate", S."DocNum" `),

    t3: wrapOpenquery(`
SELECT P."U_Store" AS "Store", I."DocNum" AS "AR Number", I."DocDate" AS "AR DocDate", I."CreateDate" AS "AR CreateDate", I."U_ShipDate" AS "AR ShipDate", I."NumAtCard" AS "Invoice No",
 S."DocNum" AS "SO Number", P."DocNum" AS "PO Number", ${poCols}, COUNT(*) AS "So dong AR",
 SUM(CASE WHEN G."DocNum" IS NULL THEN 1 ELSE 0 END) AS "So dong chua co GRPO",
 CASE WHEN SUM(CASE WHEN G."DocNum" IS NOT NULL THEN 1 ELSE 0 END) = 0 THEN 'Chua co GRPO nao' ELSE 'Thieu 1 phan dong hang' END AS "Trang thai",
 CASE WHEN I."U_ShipDate" > CURRENT_DATE THEN 'Chua den ShipDate - cho he thong sync GRPO'
      ELSE 'Da den/qua ShipDate - GRPO chua sync, can kiem tra' END AS "Ghi chu ShipDate"
FROM kbmd_live.OINV I
INNER JOIN kbmd_live.INV1 N ON N."DocEntry" = I."DocEntry" AND N."BaseType" = 17
INNER JOIN kbmd_live.ORDR S ON S."DocEntry" = N."BaseEntry" AND S."CardCode" = '${SALES_SO_CUSTOMER_CODE}'
INNER JOIN maycha_live.OPOR P ON 'PO' || TO_VARCHAR(P."DocNum") = S."U_from_refno" AND P."CardCode" = '${SALES_PO_VENDOR_CODE}'
${br}
LEFT JOIN maycha_live.POR1 PL ON PL."DocEntry" = P."DocEntry" AND PL."LineNum" = N."BaseLine"
LEFT JOIN maycha_live.PDN1 GL ON GL."BaseEntry" = PL."DocEntry" AND GL."BaseType" = 22 AND GL."BaseLine" = PL."LineNum"
LEFT JOIN maycha_live.OPDN G ON G."DocEntry" = GL."DocEntry" AND G."CANCELED" = 'N'
WHERE I."DocDate" >= '${d}' AND I."CANCELED" = 'N' AND I."NumAtCard" IS NOT NULL
GROUP BY P."U_Store", I."DocNum", I."DocDate", I."CreateDate", I."U_ShipDate", I."NumAtCard", S."DocNum", P."DocNum", ${poGrp}
HAVING SUM(CASE WHEN G."DocNum" IS NULL THEN 1 ELSE 0 END) > 0
ORDER BY I."DocDate" DESC, I."DocNum" DESC`),

    t4: wrapOpenquery(`
SELECT P."U_Store" AS "Store", G."DocNum" AS "GRPO Number", G."DocDate", P."DocNum" AS "PO Number", ${poCols}, COUNT(*) AS "So dong GRPO"
FROM maycha_live.OPDN G
INNER JOIN maycha_live.PDN1 GL ON GL."DocEntry" = G."DocEntry" AND GL."BaseType" = 22
INNER JOIN maycha_live.OPOR P ON P."DocEntry" = GL."BaseEntry" AND P."CardCode" = '${SALES_PO_VENDOR_CODE}'
${br}
WHERE G."CANCELED" = 'N' AND G."DocDate" >= '${d}'
  AND NOT EXISTS (SELECT 1 FROM maycha_live.PCH1 AL WHERE AL."BaseEntry" = G."DocEntry" AND AL."BaseType" = 20)
GROUP BY P."U_Store", G."DocNum", G."DocDate", P."DocNum", ${poGrp}
ORDER BY G."DocDate", G."DocNum" `),

    ar: wrapOpenquery(`
SELECT P."U_Store" AS "Store", I."DocNum" AS "AR Number", I."DocDate", I."NumAtCard" AS "Invoice No",
 I."U_InvSeri" AS "Invoice Seri", I."U_InvDate" AS "Invoice Date", S."DocNum" AS "SO Number", P."DocNum" AS "PO Number", ${poCols}
FROM kbmd_live.OINV I
INNER JOIN kbmd_live.INV1 N ON N."DocEntry" = I."DocEntry" AND N."BaseType" = 17 AND N."LineNum" = 0
INNER JOIN kbmd_live.ORDR S ON S."DocEntry" = N."BaseEntry" AND S."CardCode" = '${SALES_SO_CUSTOMER_CODE}'
INNER JOIN maycha_live.OPOR P ON 'PO' || TO_VARCHAR(P."DocNum") = S."U_from_refno"
${br}
WHERE I."DocDate" >= '${d}' AND I."CANCELED" = 'N'
ORDER BY I."DocNum" DESC`),

    grpo: wrapOpenquery(`
SELECT P."U_Store" AS "Store", G."DocNum" AS "GRPO Number", G."DocDate", P."DocNum" AS "PO Number", ${poCols}, G."Comments"
FROM maycha_live.OPDN G
INNER JOIN maycha_live.PDN1 GL ON GL."DocEntry" = G."DocEntry" AND GL."LineNum" = 0 AND GL."BaseType" = 22
INNER JOIN maycha_live.OPOR P ON P."DocEntry" = GL."BaseEntry" AND P."CardCode" = '${SALES_PO_VENDOR_CODE}'
${br}
WHERE G."DocDate" >= '${d}' AND G."CANCELED" = 'N'
ORDER BY G."DocNum" DESC`),

    ap: wrapOpenquery(`
SELECT DISTINCT P."U_Store" AS "Store", A."DocNum" AS "AP Number", A."DocDate", A."NumAtCard" AS "Invoice No",
 G."DocNum" AS "GRPO Number", P."DocNum" AS "PO Number", ${poCols}
FROM maycha_live.OPCH A
INNER JOIN maycha_live.PCH1 L ON L."DocEntry" = A."DocEntry" AND L."BaseType" = 20
INNER JOIN maycha_live.OPDN G ON G."DocEntry" = L."BaseEntry"
INNER JOIN maycha_live.PDN1 GL ON GL."DocEntry" = G."DocEntry" AND GL."BaseType" = 22
INNER JOIN maycha_live.OPOR P ON P."DocEntry" = GL."BaseEntry" AND P."CardCode" = '${SALES_PO_VENDOR_CODE}'
${br}
WHERE A."DocDate" >= '${d}' AND A."CANCELED" = 'N'
ORDER BY A."DocNum" DESC`),
  };
}

/**
 * Dựng 5 câu truy vấn chuỗi chứng từ PO -> SO -> AR / GRPO -> AP của luồng Bán hàng
 * (`build_monitor_chain_queries`, desktop `:2694-2743`).
 */
export function buildSalesChainQueries(
  dateFrom: string,
  brand: string,
  poNumbers?: readonly number[],
): Record<SalesChainQueryKey, OpenQuerySql> {
  assertSapDate(dateFrom);
  assertSapBrand(brand);
  if (poNumbers !== undefined) {
    assertPoNumbers(poNumbers);
  }

  const br = _MONITOR_BRAND_JOIN.replace('{brand}', brand);
  const d = dateFrom;
  let poFilter = `P."CardCode" = '${SALES_PO_VENDOR_CODE}' AND P."CANCELED" = 'N' AND P."DocDate" >= '${d}'`;
  if (poNumbers !== undefined) {
    const nums = poNumbers.join(', ');
    poFilter = `P."CardCode" = '${SALES_PO_VENDOR_CODE}' AND P."CANCELED" = 'N' AND P."DocNum" IN (${nums})`;
  }
  const poFrom = `FROM maycha_live.OPOR P ${br}`;
  const soJoin = `INNER JOIN kbmd_live.ORDR S ON S."U_from_refno" = 'PO' || TO_VARCHAR(P."DocNum") AND S."CardCode" = '${SALES_SO_CUSTOMER_CODE}' AND S."CANCELED" = 'N'`;

  return {
    po: wrapOpenquery(`
SELECT P."U_Store" AS "Store", P."DocNum" AS "PO Number", P."DocEntry" AS "PO DocEntry",
 P."DocDate" AS "PO DocDate", P."CreateDate" AS "PO CreateDate", P."DocStatus" AS "PO Status",
 COUNT(*) AS "So dong PO", SUM(PL."Quantity") AS "Tong SL PO"
${poFrom}
INNER JOIN maycha_live.POR1 PL ON PL."DocEntry" = P."DocEntry"
WHERE ${poFilter}
GROUP BY P."U_Store", P."DocNum", P."DocEntry", P."DocDate", P."CreateDate", P."DocStatus" `),

    so: wrapOpenquery(`
SELECT DISTINCT P."DocNum" AS "PO Number", S."DocNum" AS "SO Number", S."DocDate" AS "SO DocDate", S."CreateDate" AS "SO CreateDate",
 (SELECT MAX(SL."ShipDate") FROM kbmd_live.RDR1 SL WHERE SL."DocEntry" = S."DocEntry") AS "SO ShipDate"
${poFrom}
${soJoin}
WHERE ${poFilter}`),

    ar: wrapOpenquery(`
SELECT DISTINCT P."DocNum" AS "PO Number", I."DocNum" AS "AR Number", I."DocDate" AS "AR DocDate", I."CreateDate" AS "AR CreateDate", I."U_ShipDate" AS "AR ShipDate", I."NumAtCard" AS "Invoice No"
${poFrom}
${soJoin}
INNER JOIN kbmd_live.INV1 N ON N."BaseType" = 17 AND N."BaseEntry" = S."DocEntry"
INNER JOIN kbmd_live.OINV I ON I."DocEntry" = N."DocEntry" AND I."CANCELED" = 'N'
WHERE ${poFilter}`),

    grpo: wrapOpenquery(`
SELECT DISTINCT P."DocNum" AS "PO Number", G."DocNum" AS "GRPO Number", G."DocDate" AS "GRPO DocDate"
${poFrom}
INNER JOIN maycha_live.PDN1 GL ON GL."BaseType" = 22 AND GL."BaseEntry" = P."DocEntry"
INNER JOIN maycha_live.OPDN G ON G."DocEntry" = GL."DocEntry" AND G."CANCELED" = 'N'
WHERE ${poFilter}`),

    ap: wrapOpenquery(`
SELECT DISTINCT P."DocNum" AS "PO Number", G."DocNum" AS "GRPO Number", A."DocNum" AS "AP Number", A."DocDate" AS "AP DocDate"
${poFrom}
INNER JOIN maycha_live.PDN1 GL ON GL."BaseType" = 22 AND GL."BaseEntry" = P."DocEntry"
INNER JOIN maycha_live.OPDN G ON G."DocEntry" = GL."DocEntry" AND G."CANCELED" = 'N'
INNER JOIN maycha_live.PCH1 AL ON AL."BaseType" = 20 AND AL."BaseEntry" = G."DocEntry"
INNER JOIN maycha_live.OPCH A ON A."DocEntry" = AL."DocEntry" AND A."CANCELED" = 'N'
WHERE ${poFilter}`),
  };
}
