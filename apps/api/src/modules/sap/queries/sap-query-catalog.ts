// Danh mục chuẩn 25 câu truy vấn SAP HANA (Full SQL trải phẳng) chia theo 2 Tab (Đặc tả v1.1 – 28/10/2026):
// - Tab 1 (flow = 'ban', 13 câu): 8 câu danh sách (list) + 5 câu ghép chuỗi PO (chain)
// - Tab 2 (flow = 'tra', 12 câu): 7 câu ghép chuỗi SO trả hàng & kho (main) + 5 câu tìm SO cũ (old_discovery)

export type SapQueryFlow = 'ban' | 'tra';
export type SapQueryStage = 'list' | 'chain' | 'main' | 'old_discovery';
export type SapRuntimePlaceholder =
  | '{d}'
  | '{br}'
  | '{po_filter}'
  | '{brand_cond}'
  | '{date_cond}';

export const SAP_SALES_LIST_QUERY_KEYS = [
  'funnel',
  't1',
  't2',
  't3',
  't4',
  'ar',
  'grpo',
  'ap',
] as const;

export const SAP_SALES_CHAIN_QUERY_KEYS = [
  'chain_po',
  'chain_so',
  'chain_ar',
  'chain_grpo',
  'chain_ap',
] as const;

export const SAP_RETURN_MAIN_QUERY_KEYS = [
  'ret_so',
  'ret_po',
  'ret_do',
  'ret_ar',
  'ret_grpo',
  'ret_ap',
  'ret_whs',
] as const;

export const SAP_RETURN_OLD_QUERY_KEYS = [
  'old_sos_1',
  'old_sos_2',
  'old_sos_3',
  'old_sos_4',
  'old_sos_5',
] as const;

export const SAP_QUERY_KEYS = [
  ...SAP_SALES_LIST_QUERY_KEYS,
  ...SAP_SALES_CHAIN_QUERY_KEYS,
  ...SAP_RETURN_MAIN_QUERY_KEYS,
  ...SAP_RETURN_OLD_QUERY_KEYS,
] as const;

export type SapSalesListCatalogKey = (typeof SAP_SALES_LIST_QUERY_KEYS)[number];
export type SapSalesChainCatalogKey = (typeof SAP_SALES_CHAIN_QUERY_KEYS)[number];
export type SapReturnMainCatalogKey = (typeof SAP_RETURN_MAIN_QUERY_KEYS)[number];
export type SapReturnOldCatalogKey = (typeof SAP_RETURN_OLD_QUERY_KEYS)[number];
export type SapQueryKey = (typeof SAP_QUERY_KEYS)[number];

export interface SapQueryCatalogEntry {
  readonly key: SapQueryKey;
  readonly flow: SapQueryFlow;
  readonly stage: SapQueryStage;
  readonly sortOrder: number;
  readonly title: string;
  readonly description: string;
  readonly impactBadges: readonly string[];
  readonly allowedPlaceholders: readonly SapRuntimePlaceholder[];
  readonly requiredColumns: readonly string[];
  readonly baselineColumns: readonly string[];
  readonly dedupKeys: readonly string[];
  readonly supportsExtraColumns: boolean;
  readonly autoDateUpper: boolean;
  readonly defaultSql: string;
}
export const SAP_QUERY_CATALOG: readonly SapQueryCatalogEntry[] = [
  // =========================================================================
  // TAB 1: MONITOR LUỒNG BÁN — NHÓM 1A: DANH SÁCH & CẢNH BÁO TREO (#01..#08)
  // =========================================================================
  {
    key: 'funnel',
    flow: 'ban',
    stage: 'list',
    sortOrder: 1,
    title: '#01 · Tổng hợp PO & SO theo Cửa hàng (Store Funnel)',
    description:
      'Đếm tổng số đơn PO (TTVH) và SO (KBMĐ) theo từng cửa hàng phát sinh từ ngày bắt đầu để dựng bảng Tổng hợp theo cửa hàng.',
    impactBadges: ['Bảng Tổng hợp Cửa hàng', 'KPI Phễu Cửa hàng'],
    allowedPlaceholders: ['{d}', '{br}'],
    requiredColumns: ['Store', 'Ten cua hang', 'PO', 'SO'],
    baselineColumns: ['Store', 'Ten cua hang', 'PO', 'SO'],
    dedupKeys: ['Store'],
    supportsExtraColumns: false,
    autoDateUpper: true,
    defaultSql: `SELECT "Store", "Ten cua hang", SUM("PO") AS "PO", SUM("SO") AS "SO" FROM (
 SELECT P."U_Store" AS "Store", W."WhsName" AS "Ten cua hang", 1 AS "PO", 0 AS "SO"
 FROM maycha_live.OPOR P {br}
 WHERE P."CardCode" = '309019' AND P."CANCELED" = 'N' AND P."DocDate" >= '{d}'
 UNION ALL
 SELECT P."U_Store", W."WhsName", 0, 1
 FROM kbmd_live.ORDR S
 INNER JOIN maycha_live.OPOR P ON 'PO' || TO_VARCHAR(P."DocNum") = S."U_from_refno" AND P."CardCode" = '309019'
 {br}
 WHERE S."CardCode" = 'NB010002' AND S."CANCELED" = 'N' AND S."DocDate" >= '{d}' AND P."DocDate" >= '{d}'
) GROUP BY "Store", "Ten cua hang"`,
  },
  {
    key: 't1',
    flow: 'ban',
    stage: 'list',
    sortOrder: 2,
    title: '#02 · T1 — PO chưa có SO hợp lệ',
    description:
      'Danh sách đơn PO tại TTVH chưa sinh SO bên KBMĐ hoặc SO đối ứng đã bị hủy.',
    impactBadges: ['Tab T1: PO chưa có SO', 'KPI Treo T1', 'Excel Sheet T1'],
    allowedPlaceholders: ['{d}', '{br}'],
    requiredColumns: ['Store', 'PO Number', 'DocDate', 'Ly do'],
    baselineColumns: [
      'Store',
      'PO Number',
      'DocDate',
      'PO CreateDate',
      'PO Status',
      'So dong PO',
      'Ly do',
    ],
    dedupKeys: ['PO Number'],
    supportsExtraColumns: true,
    autoDateUpper: true,
    defaultSql: `SELECT P."U_Store" AS "Store", P."DocNum" AS "PO Number", P."DocDate", P."CreateDate" AS "PO CreateDate", P."DocStatus" AS "PO Status",
 COUNT(*) AS "So dong PO",
 CASE WHEN MAX(CASE WHEN S."DocNum" IS NOT NULL THEN 1 ELSE 0 END) = 1 THEN 'SO da bi huy' ELSE 'Chua co SO' END AS "Ly do"
FROM maycha_live.OPOR P {br}
INNER JOIN maycha_live.POR1 PL ON PL."DocEntry" = P."DocEntry"
LEFT JOIN kbmd_live.ORDR S ON S."U_from_refno" = 'PO' || TO_VARCHAR(P."DocNum") AND S."CardCode" = 'NB010002'
WHERE P."CardCode" = '309019' AND P."CANCELED" = 'N' AND P."DocDate" >= '{d}'
  AND NOT EXISTS (SELECT 1 FROM kbmd_live.ORDR S2 WHERE S2."U_from_refno" = 'PO' || TO_VARCHAR(P."DocNum")
                    AND S2."CardCode" = 'NB010002' AND S2."CANCELED" = 'N')
GROUP BY P."U_Store", P."DocNum", P."DocDate", P."CreateDate", P."DocStatus"
ORDER BY P."DocDate", P."DocNum"`,
  },
  {
    key: 't2',
    flow: 'ban',
    stage: 'list',
    sortOrder: 3,
    title: '#03 · T2 — SO chưa xuất đủ A/R Invoice',
    description:
      'Danh sách đơn SO tại KBMĐ còn dòng hàng chưa lên hóa đơn A/R, phân loại đã đến/chưa đến ShipDate.',
    impactBadges: [
      'Tab T2: SO chưa có A/R',
      'KPI Treo T2 (Đã đến / Chưa đến ShipDate)',
      'Excel Sheet T2',
    ],
    allowedPlaceholders: ['{d}', '{br}'],
    requiredColumns: [
      'Store',
      'SO Number',
      'PO Number',
      'PO DocDate',
      'Ghi chu ShipDate',
    ],
    baselineColumns: [
      'Store',
      'SO Number',
      'PO Number',
      'PO DocDate',
      'PO CreateDate',
      'PO tao truoc ky',
      'DocDate',
      'SO ShipDate',
      'Ghi chu ShipDate',
      'So dong SO',
      'So dong chua co AR',
    ],
    dedupKeys: ['SO Number', 'PO Number'],
    supportsExtraColumns: true,
    autoDateUpper: true,
    defaultSql: `SELECT P."U_Store" AS "Store", S."DocNum" AS "SO Number", P."DocNum" AS "PO Number", P."DocDate" AS "PO DocDate", P."CreateDate" AS "PO CreateDate", CASE WHEN P."CreateDate" < '{d}' THEN 'Co' ELSE 'Khong' END AS "PO tao truoc ky", S."DocDate",
 MAX(SL."ShipDate") AS "SO ShipDate",
 CASE WHEN MAX(SL."ShipDate") > CURRENT_DATE THEN 'Chua den ShipDate - chua den ngay xuat hang (binh thuong)'
      ELSE 'Da den/qua ShipDate - chua co A/R, can kiem tra' END AS "Ghi chu ShipDate",
 COUNT(*) AS "So dong SO", SUM(CASE WHEN IL."DocEntry" IS NULL THEN 1 ELSE 0 END) AS "So dong chua co AR"
FROM kbmd_live.ORDR S
INNER JOIN kbmd_live.RDR1 SL ON SL."DocEntry" = S."DocEntry"
INNER JOIN maycha_live.OPOR P ON 'PO' || TO_VARCHAR(P."DocNum") = S."U_from_refno" AND P."CardCode" = '309019'
{br}
LEFT JOIN kbmd_live.INV1 IL ON IL."BaseType" = 17 AND IL."BaseEntry" = S."DocEntry" AND IL."BaseLine" = SL."LineNum"
  AND IL."DocEntry" IN (SELECT "DocEntry" FROM kbmd_live.OINV WHERE "CANCELED" = 'N')
WHERE S."CardCode" = 'NB010002' AND S."CANCELED" = 'N' AND S."DocDate" >= '{d}'
GROUP BY P."U_Store", S."DocNum", P."DocNum", P."DocDate", P."CreateDate", S."DocDate"
HAVING SUM(CASE WHEN IL."DocEntry" IS NULL THEN 1 ELSE 0 END) > 0
ORDER BY S."DocDate", S."DocNum"`,
  },
  {
    key: 't3',
    flow: 'ban',
    stage: 'list',
    sortOrder: 4,
    title: '#04 · T3 — A/R đã có HĐ nhưng thiếu GRPO',
    description:
      'Danh sách hóa đơn A/R (KBMĐ) đã có số hóa đơn điện tử nhưng bên TTVH chưa đồng bộ đủ phiếu nhập kho GRPO.',
    impactBadges: [
      'Tab T3: A/R thiếu GRPO',
      'KPI Treo T3 (Đã đến / Chưa đến ShipDate)',
      'Excel Sheet T3',
    ],
    allowedPlaceholders: ['{d}', '{br}'],
    requiredColumns: [
      'Store',
      'AR Number',
      'SO Number',
      'PO Number',
      'PO DocDate',
      'Ghi chu ShipDate',
    ],
    baselineColumns: [
      'Store',
      'AR Number',
      'AR DocDate',
      'AR CreateDate',
      'AR ShipDate',
      'Invoice No',
      'SO Number',
      'PO Number',
      'PO DocDate',
      'PO CreateDate',
      'PO tao truoc ky',
      'So dong AR',
      'So dong chua co GRPO',
      'Trang thai',
      'Ghi chu ShipDate',
    ],
    dedupKeys: ['AR Number', 'SO Number', 'PO Number'],
    supportsExtraColumns: true,
    autoDateUpper: true,
    defaultSql: `SELECT P."U_Store" AS "Store", I."DocNum" AS "AR Number", I."DocDate" AS "AR DocDate", I."CreateDate" AS "AR CreateDate", I."U_ShipDate" AS "AR ShipDate", I."NumAtCard" AS "Invoice No",
 S."DocNum" AS "SO Number", P."DocNum" AS "PO Number", P."DocDate" AS "PO DocDate", P."CreateDate" AS "PO CreateDate", CASE WHEN P."CreateDate" < '{d}' THEN 'Co' ELSE 'Khong' END AS "PO tao truoc ky", COUNT(*) AS "So dong AR",
 SUM(CASE WHEN G."DocNum" IS NULL THEN 1 ELSE 0 END) AS "So dong chua co GRPO",
 CASE WHEN SUM(CASE WHEN G."DocNum" IS NOT NULL THEN 1 ELSE 0 END) = 0 THEN 'Chua co GRPO nao' ELSE 'Thieu 1 phan dong hang' END AS "Trang thai",
 CASE WHEN I."U_ShipDate" > CURRENT_DATE THEN 'Chua den ShipDate - cho he thong sync GRPO'
      ELSE 'Da den/qua ShipDate - GRPO chua sync, can kiem tra' END AS "Ghi chu ShipDate"
FROM kbmd_live.OINV I
INNER JOIN kbmd_live.INV1 N ON N."DocEntry" = I."DocEntry" AND N."BaseType" = 17
INNER JOIN kbmd_live.ORDR S ON S."DocEntry" = N."BaseEntry" AND S."CardCode" = 'NB010002'
INNER JOIN maycha_live.OPOR P ON 'PO' || TO_VARCHAR(P."DocNum") = S."U_from_refno" AND P."CardCode" = '309019'
{br}
LEFT JOIN maycha_live.POR1 PL ON PL."DocEntry" = P."DocEntry" AND PL."LineNum" = N."BaseLine"
LEFT JOIN maycha_live.PDN1 GL ON GL."BaseEntry" = PL."DocEntry" AND GL."BaseType" = 22 AND GL."BaseLine" = PL."LineNum"
LEFT JOIN maycha_live.OPDN G ON G."DocEntry" = GL."DocEntry" AND G."CANCELED" = 'N'
WHERE I."DocDate" >= '{d}' AND I."CANCELED" = 'N' AND I."NumAtCard" IS NOT NULL
GROUP BY P."U_Store", I."DocNum", I."DocDate", I."CreateDate", I."U_ShipDate", I."NumAtCard", S."DocNum", P."DocNum", P."DocDate", P."CreateDate"
HAVING SUM(CASE WHEN G."DocNum" IS NULL THEN 1 ELSE 0 END) > 0
ORDER BY I."DocDate" DESC, I."DocNum" DESC`,
  },
  {
    key: 't4',
    flow: 'ban',
    stage: 'list',
    sortOrder: 5,
    title: '#05 · T4 — GRPO chưa lên hóa đơn A/P',
    description:
      'Danh sách phiếu nhập kho GRPO tại TTVH chưa được kế toán lập hóa đơn mua hàng A/P Invoice.',
    impactBadges: ['Tab T4: GRPO chưa có A/P', 'KPI Treo T4', 'Excel Sheet T4'],
    allowedPlaceholders: ['{d}', '{br}'],
    requiredColumns: ['Store', 'GRPO Number', 'PO Number', 'PO DocDate'],
    baselineColumns: [
      'Store',
      'GRPO Number',
      'DocDate',
      'PO Number',
      'PO DocDate',
      'PO CreateDate',
      'PO tao truoc ky',
      'So dong GRPO',
    ],
    dedupKeys: ['GRPO Number', 'PO Number'],
    supportsExtraColumns: true,
    autoDateUpper: true,
    defaultSql: `SELECT P."U_Store" AS "Store", G."DocNum" AS "GRPO Number", G."DocDate", P."DocNum" AS "PO Number", P."DocDate" AS "PO DocDate", P."CreateDate" AS "PO CreateDate", CASE WHEN P."CreateDate" < '{d}' THEN 'Co' ELSE 'Khong' END AS "PO tao truoc ky", COUNT(*) AS "So dong GRPO"
FROM maycha_live.OPDN G
INNER JOIN maycha_live.PDN1 GL ON GL."DocEntry" = G."DocEntry" AND GL."BaseType" = 22
INNER JOIN maycha_live.OPOR P ON P."DocEntry" = GL."BaseEntry" AND P."CardCode" = '309019'
{br}
WHERE G."CANCELED" = 'N' AND G."DocDate" >= '{d}'
  AND NOT EXISTS (SELECT 1 FROM maycha_live.PCH1 AL WHERE AL."BaseEntry" = G."DocEntry" AND AL."BaseType" = 20)
GROUP BY P."U_Store", G."DocNum", G."DocDate", P."DocNum", P."DocDate", P."CreateDate"
ORDER BY G."DocDate", G."DocNum"`,
  },
  {
    key: 'ar',
    flow: 'ban',
    stage: 'list',
    sortOrder: 6,
    title: '#06 · Danh sách A/R Invoice (KBMĐ)',
    description:
      'Toàn bộ chứng từ A/R Invoice phát sinh từ ngày bắt đầu bên KBMĐ để kiểm tra hóa đơn điện tử (NumAtCard) và đối chiếu chuỗi.',
    impactBadges: [
      'Tab Danh sách A/R',
      'Tab A/R chưa xuất HĐ',
      'Excel Sheet AR',
    ],
    allowedPlaceholders: ['{d}', '{br}'],
    requiredColumns: [
      'Store',
      'AR Number',
      'Invoice No',
      'SO Number',
      'PO Number',
      'PO DocDate',
    ],
    baselineColumns: [
      'Store',
      'AR Number',
      'DocDate',
      'Invoice No',
      'Invoice Seri',
      'Invoice Date',
      'SO Number',
      'PO Number',
      'PO DocDate',
      'PO CreateDate',
      'PO tao truoc ky',
    ],
    dedupKeys: ['AR Number', 'SO Number', 'PO Number'],
    supportsExtraColumns: true,
    autoDateUpper: true,
    defaultSql: `SELECT P."U_Store" AS "Store", I."DocNum" AS "AR Number", I."DocDate", I."NumAtCard" AS "Invoice No",
 I."U_InvSeri" AS "Invoice Seri", I."U_InvDate" AS "Invoice Date", S."DocNum" AS "SO Number", P."DocNum" AS "PO Number", P."DocDate" AS "PO DocDate", P."CreateDate" AS "PO CreateDate", CASE WHEN P."CreateDate" < '{d}' THEN 'Co' ELSE 'Khong' END AS "PO tao truoc ky"
FROM kbmd_live.OINV I
INNER JOIN kbmd_live.INV1 N ON N."DocEntry" = I."DocEntry" AND N."BaseType" = 17 AND N."LineNum" = 0
INNER JOIN kbmd_live.ORDR S ON S."DocEntry" = N."BaseEntry" AND S."CardCode" = 'NB010002'
INNER JOIN maycha_live.OPOR P ON 'PO' || TO_VARCHAR(P."DocNum") = S."U_from_refno"
{br}
WHERE I."DocDate" >= '{d}' AND I."CANCELED" = 'N'
ORDER BY I."DocNum" DESC`,
  },
  {
    key: 'grpo',
    flow: 'ban',
    stage: 'list',
    sortOrder: 7,
    title: '#07 · Danh sách GRPO (TTVH)',
    description:
      'Toàn bộ phiếu nhập kho GRPO phát sinh từ ngày bắt đầu tại TTVH gắn với đơn PO mua hàng nội bộ.',
    impactBadges: ['Tab Danh sách GRPO', 'Excel Sheet GRPO'],
    allowedPlaceholders: ['{d}', '{br}'],
    requiredColumns: ['Store', 'GRPO Number', 'PO Number', 'PO DocDate'],
    baselineColumns: [
      'Store',
      'GRPO Number',
      'DocDate',
      'PO Number',
      'PO DocDate',
      'PO CreateDate',
      'PO tao truoc ky',
      'Comments',
    ],
    dedupKeys: ['GRPO Number', 'PO Number'],
    supportsExtraColumns: true,
    autoDateUpper: true,
    defaultSql: `SELECT P."U_Store" AS "Store", G."DocNum" AS "GRPO Number", G."DocDate", P."DocNum" AS "PO Number", P."DocDate" AS "PO DocDate", P."CreateDate" AS "PO CreateDate", CASE WHEN P."CreateDate" < '{d}' THEN 'Co' ELSE 'Khong' END AS "PO tao truoc ky", G."Comments"
FROM maycha_live.OPDN G
INNER JOIN maycha_live.PDN1 GL ON GL."DocEntry" = G."DocEntry" AND GL."LineNum" = 0 AND GL."BaseType" = 22
INNER JOIN maycha_live.OPOR P ON P."DocEntry" = GL."BaseEntry" AND P."CardCode" = '309019'
{br}
WHERE G."DocDate" >= '{d}' AND G."CANCELED" = 'N'
ORDER BY G."DocNum" DESC`,
  },
  {
    key: 'ap',
    flow: 'ban',
    stage: 'list',
    sortOrder: 8,
    title: '#08 · Danh sách A/P Invoice (TTVH)',
    description:
      'Toàn bộ hóa đơn đầu vào A/P Invoice phát sinh từ ngày bắt đầu tại TTVH kế thừa từ phiếu nhập GRPO.',
    impactBadges: ['Tab Danh sách A/P', 'Excel Sheet AP'],
    allowedPlaceholders: ['{d}', '{br}'],
    requiredColumns: [
      'Store',
      'AP Number',
      'GRPO Number',
      'PO Number',
      'PO DocDate',
    ],
    baselineColumns: [
      'Store',
      'AP Number',
      'DocDate',
      'Invoice No',
      'GRPO Number',
      'PO Number',
      'PO DocDate',
      'PO CreateDate',
      'PO tao truoc ky',
    ],
    dedupKeys: ['AP Number', 'GRPO Number', 'PO Number'],
    supportsExtraColumns: true,
    autoDateUpper: true,
    defaultSql: `SELECT DISTINCT P."U_Store" AS "Store", A."DocNum" AS "AP Number", A."DocDate", A."NumAtCard" AS "Invoice No",
 G."DocNum" AS "GRPO Number", P."DocNum" AS "PO Number", P."DocDate" AS "PO DocDate", P."CreateDate" AS "PO CreateDate", CASE WHEN P."CreateDate" < '{d}' THEN 'Co' ELSE 'Khong' END AS "PO tao truoc ky"
FROM maycha_live.OPCH A
INNER JOIN maycha_live.PCH1 L ON L."DocEntry" = A."DocEntry" AND L."BaseType" = 20
INNER JOIN maycha_live.OPDN G ON G."DocEntry" = L."BaseEntry"
INNER JOIN maycha_live.PDN1 GL ON GL."DocEntry" = G."DocEntry" AND GL."BaseType" = 22
INNER JOIN maycha_live.OPOR P ON P."DocEntry" = GL."BaseEntry" AND P."CardCode" = '309019'
{br}
WHERE A."DocDate" >= '{d}' AND A."CANCELED" = 'N'
ORDER BY A."DocNum" DESC`,
  },

  // =========================================================================
  // TAB 1: MONITOR LUỒNG BÁN — NHÓM 1B: GHÉP CHUỖI PO & PHỄU 5 BƯỚC (#09..#13)
  // =========================================================================
  {
    key: 'chain_po',
    flow: 'ban',
    stage: 'chain',
    sortOrder: 9,
    title: '#09 · Chuỗi PO — Đầu mục PO gốc (TTVH)',
    description:
      'Truy vấn gốc của bảng Chi tiết theo PO: lấy danh sách đơn PO cùng tổng số dòng và tổng số lượng đặt. Hỗ trợ thêm cột phụ hiển thị ra bảng Chi tiết theo PO & Excel.',
    impactBadges: [
      'Bảng Chi tiết theo PO',
      'Phễu 5 bước Bán hàng',
      'Excel Chi tiết PO',
    ],
    allowedPlaceholders: ['{br}', '{po_filter}'],
    requiredColumns: [
      'Store',
      'PO Number',
      'PO DocDate',
      'PO CreateDate',
      'PO Status',
      'So dong PO',
      'Tong SL PO',
    ],
    baselineColumns: [
      'Store',
      'PO Number',
      'PO DocEntry',
      'PO DocDate',
      'PO CreateDate',
      'PO Status',
      'So dong PO',
      'Tong SL PO',
    ],
    dedupKeys: ['PO Number'],
    supportsExtraColumns: true,
    autoDateUpper: true,
    defaultSql: `SELECT P."U_Store" AS "Store", P."DocNum" AS "PO Number", P."DocEntry" AS "PO DocEntry",
 P."DocDate" AS "PO DocDate", P."CreateDate" AS "PO CreateDate", P."DocStatus" AS "PO Status",
 COUNT(*) AS "So dong PO", SUM(PL."Quantity") AS "Tong SL PO"
FROM maycha_live.OPOR P {br}
INNER JOIN maycha_live.POR1 PL ON PL."DocEntry" = P."DocEntry"
WHERE {po_filter}
GROUP BY P."U_Store", P."DocNum", P."DocEntry", P."DocDate", P."CreateDate", P."DocStatus"`,
  },
  {
    key: 'chain_so',
    flow: 'ban',
    stage: 'chain',
    sortOrder: 10,
    title: '#10 · Chuỗi PO — Nhánh SO đối ứng (KBMĐ)',
    description:
      'Ghép đơn bán hàng SO (KBMĐ) vào từng PO gốc qua trường tham chiếu U_from_refno = PO<DocNum>.',
    impactBadges: ['Bảng Chi tiết theo PO', 'Phễu 5 bước (Bước SO)'],
    allowedPlaceholders: ['{br}', '{po_filter}'],
    requiredColumns: ['PO Number', 'SO Number', 'SO CreateDate', 'SO ShipDate'],
    baselineColumns: [
      'PO Number',
      'SO Number',
      'SO DocDate',
      'SO CreateDate',
      'SO ShipDate',
    ],
    dedupKeys: ['PO Number', 'SO Number'],
    supportsExtraColumns: false,
    autoDateUpper: true,
    defaultSql: `SELECT DISTINCT P."DocNum" AS "PO Number", S."DocNum" AS "SO Number", S."DocDate" AS "SO DocDate", S."CreateDate" AS "SO CreateDate",
 (SELECT MAX(SL."ShipDate") FROM kbmd_live.RDR1 SL WHERE SL."DocEntry" = S."DocEntry") AS "SO ShipDate"
FROM maycha_live.OPOR P {br}
INNER JOIN kbmd_live.ORDR S ON S."U_from_refno" = 'PO' || TO_VARCHAR(P."DocNum") AND S."CardCode" = 'NB010002' AND S."CANCELED" = 'N'
WHERE {po_filter}`,
  },
  {
    key: 'chain_ar',
    flow: 'ban',
    stage: 'chain',
    sortOrder: 11,
    title: '#11 · Chuỗi PO — Nhánh A/R Invoice (KBMĐ)',
    description:
      'Ghép hóa đơn A/R và số hóa đơn điện tử (Invoice No) bên KBMĐ vào từng PO gốc.',
    impactBadges: ['Bảng Chi tiết theo PO', 'Phễu 5 bước (Bước A/R)'],
    allowedPlaceholders: ['{br}', '{po_filter}'],
    requiredColumns: [
      'PO Number',
      'AR Number',
      'AR DocDate',
      'AR CreateDate',
      'AR ShipDate',
      'Invoice No',
    ],
    baselineColumns: [
      'PO Number',
      'AR Number',
      'AR DocDate',
      'AR CreateDate',
      'AR ShipDate',
      'Invoice No',
    ],
    dedupKeys: ['PO Number', 'AR Number'],
    supportsExtraColumns: false,
    autoDateUpper: true,
    defaultSql: `SELECT DISTINCT P."DocNum" AS "PO Number", I."DocNum" AS "AR Number", I."DocDate" AS "AR DocDate", I."CreateDate" AS "AR CreateDate", I."U_ShipDate" AS "AR ShipDate", I."NumAtCard" AS "Invoice No"
FROM maycha_live.OPOR P {br}
INNER JOIN kbmd_live.ORDR S ON S."U_from_refno" = 'PO' || TO_VARCHAR(P."DocNum") AND S."CardCode" = 'NB010002' AND S."CANCELED" = 'N'
INNER JOIN kbmd_live.INV1 N ON N."BaseType" = 17 AND N."BaseEntry" = S."DocEntry"
INNER JOIN kbmd_live.OINV I ON I."DocEntry" = N."DocEntry" AND I."CANCELED" = 'N'
WHERE {po_filter}`,
  },
  {
    key: 'chain_grpo',
    flow: 'ban',
    stage: 'chain',
    sortOrder: 12,
    title: '#12 · Chuỗi PO — Nhánh GRPO (TTVH)',
    description:
      'Ghép phiếu nhập kho GRPO bên TTVH vào từng PO gốc qua liên kết BaseType = 22.',
    impactBadges: ['Bảng Chi tiết theo PO', 'Phễu 5 bước (Bước GRPO)'],
    allowedPlaceholders: ['{br}', '{po_filter}'],
    requiredColumns: ['PO Number', 'GRPO Number', 'GRPO DocDate'],
    baselineColumns: ['PO Number', 'GRPO Number', 'GRPO DocDate'],
    dedupKeys: ['PO Number', 'GRPO Number'],
    supportsExtraColumns: false,
    autoDateUpper: true,
    defaultSql: `SELECT DISTINCT P."DocNum" AS "PO Number", G."DocNum" AS "GRPO Number", G."DocDate" AS "GRPO DocDate"
FROM maycha_live.OPOR P {br}
INNER JOIN maycha_live.PDN1 GL ON GL."BaseType" = 22 AND GL."BaseEntry" = P."DocEntry"
INNER JOIN maycha_live.OPDN G ON G."DocEntry" = GL."DocEntry" AND G."CANCELED" = 'N'
WHERE {po_filter}`,
  },
  {
    key: 'chain_ap',
    flow: 'ban',
    stage: 'chain',
    sortOrder: 13,
    title: '#13 · Chuỗi PO — Nhánh A/P Invoice (TTVH)',
    description:
      'Ghép hóa đơn đầu vào A/P Invoice bên TTVH vào từng PO gốc qua liên kết GRPO (BaseType = 20).',
    impactBadges: ['Bảng Chi tiết theo PO', 'Phễu 5 bước (Bước A/P)'],
    allowedPlaceholders: ['{br}', '{po_filter}'],
    requiredColumns: ['PO Number', 'GRPO Number', 'AP Number', 'AP DocDate'],
    baselineColumns: ['PO Number', 'GRPO Number', 'AP Number', 'AP DocDate'],
    dedupKeys: ['PO Number', 'GRPO Number', 'AP Number'],
    supportsExtraColumns: false,
    autoDateUpper: true,
    defaultSql: `SELECT DISTINCT P."DocNum" AS "PO Number", G."DocNum" AS "GRPO Number", A."DocNum" AS "AP Number", A."DocDate" AS "AP DocDate"
FROM maycha_live.OPOR P {br}
INNER JOIN maycha_live.PDN1 GL ON GL."BaseType" = 22 AND GL."BaseEntry" = P."DocEntry"
INNER JOIN maycha_live.OPDN G ON G."DocEntry" = GL."DocEntry" AND G."CANCELED" = 'N'
INNER JOIN maycha_live.PCH1 AL ON AL."BaseType" = 20 AND AL."BaseEntry" = G."DocEntry"
INNER JOIN maycha_live.OPCH A ON A."DocEntry" = AL."DocEntry" AND A."CANCELED" = 'N'
WHERE {po_filter}`,
  },

  // =========================================================================
  // TAB 2: MONITOR LUỒNG TRẢ — NHÓM 2A: GHÉP CHUỖI SO TRẢ HÀNG & KHO (#14..#20)
  // =========================================================================
  {
    key: 'ret_so',
    flow: 'tra',
    stage: 'main',
    sortOrder: 14,
    title: '#14 · Chuỗi Trả hàng — Đầu mục SO trả gốc (TTVH)',
    description:
      'Truy vấn gốc của Luồng Trả hàng: lấy đơn SO trả hàng bên TTVH (CardCode = 209010, chưa hủy hoặc còn PO KBMD mở) kèm mã cửa hàng, phiếu MC Tool và kho SO min/max. Hỗ trợ thêm cột phụ hiển thị ra bảng Chi tiết theo SO & Excel.',
    impactBadges: [
      'Bảng Chi tiết theo SO (Luồng Trả)',
      'Phễu 6 bước Trả hàng',
      'Excel Trả hàng',
    ],
    allowedPlaceholders: ['{brand_cond}', '{date_cond}'],
    requiredColumns: [
      'SO Number',
      'SO DocDate',
      'SO CreateDate',
      'SO Canceled',
      'Store',
      'Brand',
      'MC Docnum',
      'SO ShipDate',
      'Kho SO min',
      'Kho SO max',
    ],
    baselineColumns: [
      'SO Number',
      'SO DocDate',
      'SO CreateDate',
      'SO Canceled',
      'Store',
      'Brand',
      'MC Docnum',
      'SO ShipDate',
      'Kho SO min',
      'Kho SO max',
    ],
    dedupKeys: ['SO Number'],
    supportsExtraColumns: true,
    autoDateUpper: true,
    defaultSql: `SELECT DISTINCT S."DocNum" AS "SO Number", S."DocDate" AS "SO DocDate", S."CreateDate" AS "SO CreateDate",
 S."CANCELED" AS "SO Canceled", COALESCE(S."U_Store", SUBSTR_BEFORE(S."U_MCDocNum", '-')) AS "Store", W."U_Brand" AS "Brand", S."U_MCDocNum" AS "MC Docnum",
 (SELECT MAX(L."ShipDate") FROM maycha_live.RDR1 L WHERE L."DocEntry" = S."DocEntry") AS "SO ShipDate",
 (SELECT MIN(L."WhsCode") FROM maycha_live.RDR1 L WHERE L."DocEntry" = S."DocEntry") AS "Kho SO min",
 (SELECT MAX(L."WhsCode") FROM maycha_live.RDR1 L WHERE L."DocEntry" = S."DocEntry") AS "Kho SO max"
FROM maycha_live.ORDR S
LEFT JOIN kbmd_live.OPOR P ON P."U_from_refno" = 'SO' || TO_VARCHAR(S."DocNum")
  AND P."CardCode" = 'V0800001' AND P."CANCELED" = 'N'
LEFT JOIN maycha_live.OWHS W ON W."WhsCode" = COALESCE(S."U_Store", SUBSTR_BEFORE(S."U_MCDocNum", '-'))
WHERE S."CardCode" = '209010' AND (S."CANCELED" = 'N' OR P."DocNum" IS NOT NULL) AND {date_cond}{brand_cond}`,
  },
  {
    key: 'ret_po',
    flow: 'tra',
    stage: 'main',
    sortOrder: 15,
    title: '#15 · Chuỗi Trả hàng — Nhánh PO nhận hàng trả (KBMĐ)',
    description:
      'Ghép đơn PO nhận hàng trả bên KBMĐ (CardCode = V0800001) sinh từ SO qua U_from_refno = SO<DocNum>, kèm thông tin kho nhận PO min/max.',
    impactBadges: [
      'Bảng Chi tiết theo SO (Luồng Trả)',
      'Phễu 6 bước (Bước 1: SO → PO)',
    ],
    allowedPlaceholders: ['{brand_cond}', '{date_cond}'],
    requiredColumns: [
      'SO Number',
      'PO Number',
      'PO DocDate',
      'PO CreateDate',
      'Kho PO min',
      'Kho PO max',
    ],
    baselineColumns: [
      'SO Number',
      'PO Number',
      'PO DocDate',
      'PO CreateDate',
      'Kho PO min',
      'Kho PO max',
    ],
    dedupKeys: ['SO Number', 'PO Number'],
    supportsExtraColumns: false,
    autoDateUpper: true,
    defaultSql: `SELECT DISTINCT S."DocNum" AS "SO Number", P."DocNum" AS "PO Number", P."DocDate" AS "PO DocDate",
 P."CreateDate" AS "PO CreateDate",
 (SELECT MIN(PL."WhsCode") FROM kbmd_live.POR1 PL WHERE PL."DocEntry" = P."DocEntry") AS "Kho PO min",
 (SELECT MAX(PL."WhsCode") FROM kbmd_live.POR1 PL WHERE PL."DocEntry" = P."DocEntry") AS "Kho PO max"
FROM maycha_live.ORDR S
LEFT JOIN kbmd_live.OPOR P ON P."U_from_refno" = 'SO' || TO_VARCHAR(S."DocNum")
  AND P."CardCode" = 'V0800001' AND P."CANCELED" = 'N'
LEFT JOIN maycha_live.OWHS W ON W."WhsCode" = COALESCE(S."U_Store", SUBSTR_BEFORE(S."U_MCDocNum", '-'))
WHERE S."CardCode" = '209010' AND (S."CANCELED" = 'N' OR P."DocNum" IS NOT NULL) AND {date_cond}{brand_cond}
 AND P."DocNum" IS NOT NULL`,
  },
  {
    key: 'ret_do',
    flow: 'tra',
    stage: 'main',
    sortOrder: 16,
    title: '#16 · Chuỗi Trả hàng — Nhánh Delivery DO (TTVH)',
    description:
      'Ghép phiếu giao hàng Delivery (ODLN/DLN1) bên TTVH phát sinh từ đơn SO trả hàng.',
    impactBadges: ['Bảng Chi tiết theo SO (Cột DO Number)'],
    allowedPlaceholders: ['{brand_cond}', '{date_cond}'],
    requiredColumns: ['SO Number', 'DO Number'],
    baselineColumns: ['SO Number', 'DO Number'],
    dedupKeys: ['SO Number', 'DO Number'],
    supportsExtraColumns: false,
    autoDateUpper: true,
    defaultSql: `SELECT DISTINCT S."DocNum" AS "SO Number", D."DocNum" AS "DO Number"
FROM maycha_live.ORDR S
LEFT JOIN kbmd_live.OPOR P ON P."U_from_refno" = 'SO' || TO_VARCHAR(S."DocNum")
  AND P."CardCode" = 'V0800001' AND P."CANCELED" = 'N'
LEFT JOIN maycha_live.OWHS W ON W."WhsCode" = COALESCE(S."U_Store", SUBSTR_BEFORE(S."U_MCDocNum", '-'))
INNER JOIN maycha_live.DLN1 DL ON DL."BaseType" = 17 AND DL."BaseEntry" = S."DocEntry"
INNER JOIN maycha_live.ODLN D ON D."DocEntry" = DL."DocEntry" AND D."CANCELED" = 'N'
WHERE S."CardCode" = '209010' AND (S."CANCELED" = 'N' OR P."DocNum" IS NOT NULL) AND {date_cond}{brand_cond}`,
  },
  {
    key: 'ret_ar',
    flow: 'tra',
    stage: 'main',
    sortOrder: 17,
    title: '#17 · Chuỗi Trả hàng — Nhánh A/R Invoice (TTVH · Trực tiếp & Qua DO)',
    description:
      'Ghép hóa đơn A/R bên TTVH từ cả 2 nhánh: xuất trực tiếp từ SO (BaseType = 17) và xuất qua phiếu giao DO (BaseType = 15). Hỗ trợ thêm cột phụ hiển thị ở bảng A/R chưa xuất HĐ.',
    impactBadges: [
      'Bảng Chi tiết theo SO (Luồng Trả)',
      'Tab A/R chưa xuất HĐ (Luồng Trả)',
      'Phễu 6 bước (Bước 2 & Bước 3)',
    ],
    allowedPlaceholders: ['{brand_cond}', '{date_cond}'],
    requiredColumns: [
      'SO Number',
      'AR Number',
      'AR DocDate',
      'AR CreateDate',
      'AR ShipDate',
      'Invoice No',
    ],
    baselineColumns: [
      'SO Number',
      'AR Number',
      'AR DocDate',
      'AR CreateDate',
      'AR ShipDate',
      'Invoice No',
    ],
    dedupKeys: ['SO Number', 'AR Number'],
    supportsExtraColumns: true,
    autoDateUpper: true,
    defaultSql: `SELECT DISTINCT S."DocNum" AS "SO Number", I."DocNum" AS "AR Number", I."DocDate" AS "AR DocDate",
 I."CreateDate" AS "AR CreateDate", (SELECT MAX(L."ShipDate") FROM maycha_live.INV1 L WHERE L."DocEntry" = I."DocEntry") AS "AR ShipDate", I."NumAtCard" AS "Invoice No"
FROM maycha_live.ORDR S
LEFT JOIN kbmd_live.OPOR P ON P."U_from_refno" = 'SO' || TO_VARCHAR(S."DocNum")
  AND P."CardCode" = 'V0800001' AND P."CANCELED" = 'N'
LEFT JOIN maycha_live.OWHS W ON W."WhsCode" = COALESCE(S."U_Store", SUBSTR_BEFORE(S."U_MCDocNum", '-'))
INNER JOIN maycha_live.INV1 N ON N."BaseType" = 17 AND N."BaseEntry" = S."DocEntry"
INNER JOIN maycha_live.OINV I ON I."DocEntry" = N."DocEntry" AND I."CANCELED" = 'N'
WHERE S."CardCode" = '209010' AND (S."CANCELED" = 'N' OR P."DocNum" IS NOT NULL) AND {date_cond}{brand_cond}
UNION
SELECT DISTINCT S."DocNum" AS "SO Number", I."DocNum" AS "AR Number", I."DocDate" AS "AR DocDate",
 I."CreateDate" AS "AR CreateDate", (SELECT MAX(L."ShipDate") FROM maycha_live.INV1 L WHERE L."DocEntry" = I."DocEntry") AS "AR ShipDate", I."NumAtCard" AS "Invoice No"
FROM maycha_live.ORDR S
LEFT JOIN kbmd_live.OPOR P ON P."U_from_refno" = 'SO' || TO_VARCHAR(S."DocNum")
  AND P."CardCode" = 'V0800001' AND P."CANCELED" = 'N'
LEFT JOIN maycha_live.OWHS W ON W."WhsCode" = COALESCE(S."U_Store", SUBSTR_BEFORE(S."U_MCDocNum", '-'))
INNER JOIN maycha_live.DLN1 DL ON DL."BaseType" = 17 AND DL."BaseEntry" = S."DocEntry"
INNER JOIN maycha_live.INV1 N ON N."BaseType" = 15 AND N."BaseEntry" = DL."DocEntry"
INNER JOIN maycha_live.OINV I ON I."DocEntry" = N."DocEntry" AND I."CANCELED" = 'N'
WHERE S."CardCode" = '209010' AND (S."CANCELED" = 'N' OR P."DocNum" IS NOT NULL) AND {date_cond}{brand_cond}`,
  },
  {
    key: 'ret_grpo',
    flow: 'tra',
    stage: 'main',
    sortOrder: 18,
    title: '#18 · Chuỗi Trả hàng — Nhánh GRPO nhận hàng trả (KBMĐ)',
    description:
      'Ghép phiếu nhập kho GRPO bên KBMĐ (OPDN/PDN1) kế thừa từ đơn PO trả hàng kèm mã kho GRPO min/max.',
    impactBadges: [
      'Bảng Chi tiết theo SO (Luồng Trả)',
      'Phễu 6 bước (Bước 4: A/R → GRPO)',
    ],
    allowedPlaceholders: ['{brand_cond}', '{date_cond}'],
    requiredColumns: [
      'SO Number',
      'GRPO Number',
      'GRPO DocDate',
      'Kho GRPO min',
      'Kho GRPO max',
    ],
    baselineColumns: [
      'SO Number',
      'GRPO Number',
      'GRPO DocDate',
      'Kho GRPO min',
      'Kho GRPO max',
    ],
    dedupKeys: ['SO Number', 'GRPO Number'],
    supportsExtraColumns: false,
    autoDateUpper: true,
    defaultSql: `SELECT DISTINCT S."DocNum" AS "SO Number", G."DocNum" AS "GRPO Number", G."DocDate" AS "GRPO DocDate",
 (SELECT MIN(X."WhsCode") FROM kbmd_live.PDN1 X WHERE X."DocEntry" = G."DocEntry") AS "Kho GRPO min",
 (SELECT MAX(X."WhsCode") FROM kbmd_live.PDN1 X WHERE X."DocEntry" = G."DocEntry") AS "Kho GRPO max"
FROM maycha_live.ORDR S
LEFT JOIN kbmd_live.OPOR P ON P."U_from_refno" = 'SO' || TO_VARCHAR(S."DocNum")
  AND P."CardCode" = 'V0800001' AND P."CANCELED" = 'N'
LEFT JOIN maycha_live.OWHS W ON W."WhsCode" = COALESCE(S."U_Store", SUBSTR_BEFORE(S."U_MCDocNum", '-'))
INNER JOIN kbmd_live.PDN1 GL ON GL."BaseType" = 22 AND GL."BaseEntry" = P."DocEntry"
INNER JOIN kbmd_live.OPDN G ON G."DocEntry" = GL."DocEntry" AND G."CANCELED" = 'N'
WHERE S."CardCode" = '209010' AND (S."CANCELED" = 'N' OR P."DocNum" IS NOT NULL) AND {date_cond}{brand_cond}`,
  },
  {
    key: 'ret_ap',
    flow: 'tra',
    stage: 'main',
    sortOrder: 19,
    title: '#19 · Chuỗi Trả hàng — Nhánh A/P Invoice (KBMĐ)',
    description:
      'Ghép hóa đơn A/P Invoice và số hóa đơn đầu vào (AP Invoice No) bên KBMĐ kế thừa từ phiếu nhập kho GRPO trả hàng.',
    impactBadges: [
      'Bảng Chi tiết theo SO (Luồng Trả)',
      'Phễu 6 bước (Bước 5 & Bước 6)',
    ],
    allowedPlaceholders: ['{brand_cond}', '{date_cond}'],
    requiredColumns: [
      'SO Number',
      'GRPO Number',
      'AP Number',
      'AP DocDate',
      'AP Invoice No',
    ],
    baselineColumns: [
      'SO Number',
      'GRPO Number',
      'AP Number',
      'AP DocDate',
      'AP Invoice No',
    ],
    dedupKeys: ['SO Number', 'GRPO Number', 'AP Number'],
    supportsExtraColumns: false,
    autoDateUpper: true,
    defaultSql: `SELECT DISTINCT S."DocNum" AS "SO Number", G."DocNum" AS "GRPO Number", A."DocNum" AS "AP Number", A."DocDate" AS "AP DocDate",
 A."NumAtCard" AS "AP Invoice No"
FROM maycha_live.ORDR S
LEFT JOIN kbmd_live.OPOR P ON P."U_from_refno" = 'SO' || TO_VARCHAR(S."DocNum")
  AND P."CardCode" = 'V0800001' AND P."CANCELED" = 'N'
LEFT JOIN maycha_live.OWHS W ON W."WhsCode" = COALESCE(S."U_Store", SUBSTR_BEFORE(S."U_MCDocNum", '-'))
INNER JOIN kbmd_live.PDN1 GL ON GL."BaseType" = 22 AND GL."BaseEntry" = P."DocEntry"
INNER JOIN kbmd_live.OPDN G ON G."DocEntry" = GL."DocEntry" AND G."CANCELED" = 'N'
INNER JOIN kbmd_live.PCH1 AL ON AL."BaseType" = 20 AND AL."BaseEntry" = G."DocEntry"
INNER JOIN kbmd_live.OPCH A ON A."DocEntry" = AL."DocEntry" AND A."CANCELED" = 'N'
WHERE S."CardCode" = '209010' AND (S."CANCELED" = 'N' OR P."DocNum" IS NOT NULL) AND {date_cond}{brand_cond}`,
  },
  {
    key: 'ret_whs',
    flow: 'tra',
    stage: 'main',
    sortOrder: 20,
    title: '#20 · Từ điển Danh mục Kho (OWHS · TTVH & KBMĐ)',
    description:
      'Lấy danh mục mã kho và tên kho từ cả 2 pháp nhân maycha_live (T) và kbmd_live (K) để hiển thị tên cửa hàng và tên kho nhận đầy đủ.',
    impactBadges: ['Tên Cửa hàng & Kho trên Luồng Trả'],
    allowedPlaceholders: [],
    requiredColumns: ['DB', 'WhsCode', 'WhsName'],
    baselineColumns: ['DB', 'WhsCode', 'WhsName'],
    dedupKeys: ['DB', 'WhsCode'],
    supportsExtraColumns: false,
    autoDateUpper: false,
    defaultSql: `SELECT 'T' AS "DB", "WhsCode", "WhsName" FROM maycha_live.OWHS
UNION ALL
SELECT 'K', "WhsCode", "WhsName" FROM kbmd_live.OWHS`,
  },

  // =========================================================================
  // TAB 2: MONITOR LUỒNG TRẢ — NHÓM 2B: TÌM SO NHÓM CŨ (#21..#25)
  // =========================================================================
  {
    key: 'old_sos_1',
    flow: 'tra',
    stage: 'old_discovery',
    sortOrder: 21,
    title: '#21 · Tìm SO Trả cũ — Nhánh 1: Có PO KBMĐ mới tạo trong kỳ',
    description:
      'Tìm các đơn SO trả hàng có DocDate trước ngày bắt đầu ({d}) nhưng có đơn PO đối ứng bên KBMĐ mới được tạo từ ngày bắt đầu.',
    impactBadges: ['Nhóm Cũ (SO trước kỳ có phát sinh chứng từ trong kỳ)'],
    allowedPlaceholders: ['{d}', '{brand_cond}'],
    requiredColumns: ['SO Number'],
    baselineColumns: ['SO Number'],
    dedupKeys: ['SO Number'],
    supportsExtraColumns: false,
    autoDateUpper: false,
    defaultSql: `SELECT DISTINCT S."DocNum" AS "SO Number"
FROM maycha_live.ORDR S
LEFT JOIN kbmd_live.OPOR P ON P."U_from_refno" = 'SO' || TO_VARCHAR(S."DocNum")
  AND P."CardCode" = 'V0800001' AND P."CANCELED" = 'N'
LEFT JOIN maycha_live.OWHS W ON W."WhsCode" = COALESCE(S."U_Store", SUBSTR_BEFORE(S."U_MCDocNum", '-'))
WHERE S."CardCode" = '209010' AND (S."CANCELED" = 'N' OR P."DocNum" IS NOT NULL) AND S."DocDate" < '{d}'{brand_cond}
 AND P."DocNum" IS NOT NULL AND P."CreateDate" >= '{d}'`,
  },
  {
    key: 'old_sos_2',
    flow: 'tra',
    stage: 'old_discovery',
    sortOrder: 22,
    title: '#22 · Tìm SO Trả cũ — Nhánh 2: Có A/R trực tiếp mới tạo trong kỳ',
    description:
      'Tìm các đơn SO trả hàng có DocDate trước ngày bắt đầu ({d}) nhưng có hóa đơn A/R trực tiếp từ SO mới tạo từ ngày bắt đầu.',
    impactBadges: ['Nhóm Cũ (SO trước kỳ có phát sinh chứng từ trong kỳ)'],
    allowedPlaceholders: ['{d}', '{brand_cond}'],
    requiredColumns: ['SO Number'],
    baselineColumns: ['SO Number'],
    dedupKeys: ['SO Number'],
    supportsExtraColumns: false,
    autoDateUpper: false,
    defaultSql: `SELECT DISTINCT S."DocNum" AS "SO Number"
FROM maycha_live.ORDR S
LEFT JOIN kbmd_live.OPOR P ON P."U_from_refno" = 'SO' || TO_VARCHAR(S."DocNum")
  AND P."CardCode" = 'V0800001' AND P."CANCELED" = 'N'
LEFT JOIN maycha_live.OWHS W ON W."WhsCode" = COALESCE(S."U_Store", SUBSTR_BEFORE(S."U_MCDocNum", '-'))
INNER JOIN maycha_live.INV1 N ON N."BaseType" = 17 AND N."BaseEntry" = S."DocEntry"
INNER JOIN maycha_live.OINV I ON I."DocEntry" = N."DocEntry" AND I."CANCELED" = 'N'
WHERE S."CardCode" = '209010' AND (S."CANCELED" = 'N' OR P."DocNum" IS NOT NULL) AND S."DocDate" < '{d}'{brand_cond}
 AND I."CreateDate" >= '{d}'`,
  },
  {
    key: 'old_sos_3',
    flow: 'tra',
    stage: 'old_discovery',
    sortOrder: 23,
    title: '#23 · Tìm SO Trả cũ — Nhánh 3: Có A/R qua DO mới tạo trong kỳ',
    description:
      'Tìm các đơn SO trả hàng có DocDate trước ngày bắt đầu ({d}) nhưng có hóa đơn A/R kế thừa từ phiếu giao DO mới tạo từ ngày bắt đầu.',
    impactBadges: ['Nhóm Cũ (SO trước kỳ có phát sinh chứng từ trong kỳ)'],
    allowedPlaceholders: ['{d}', '{brand_cond}'],
    requiredColumns: ['SO Number'],
    baselineColumns: ['SO Number'],
    dedupKeys: ['SO Number'],
    supportsExtraColumns: false,
    autoDateUpper: false,
    defaultSql: `SELECT DISTINCT S."DocNum" AS "SO Number"
FROM maycha_live.ORDR S
LEFT JOIN kbmd_live.OPOR P ON P."U_from_refno" = 'SO' || TO_VARCHAR(S."DocNum")
  AND P."CardCode" = 'V0800001' AND P."CANCELED" = 'N'
LEFT JOIN maycha_live.OWHS W ON W."WhsCode" = COALESCE(S."U_Store", SUBSTR_BEFORE(S."U_MCDocNum", '-'))
INNER JOIN maycha_live.DLN1 DL ON DL."BaseType" = 17 AND DL."BaseEntry" = S."DocEntry"
INNER JOIN maycha_live.INV1 N ON N."BaseType" = 15 AND N."BaseEntry" = DL."DocEntry"
INNER JOIN maycha_live.OINV I ON I."DocEntry" = N."DocEntry" AND I."CANCELED" = 'N'
WHERE S."CardCode" = '209010' AND (S."CANCELED" = 'N' OR P."DocNum" IS NOT NULL) AND S."DocDate" < '{d}'{brand_cond}
 AND I."CreateDate" >= '{d}'`,
  },
  {
    key: 'old_sos_4',
    flow: 'tra',
    stage: 'old_discovery',
    sortOrder: 24,
    title: '#24 · Tìm SO Trả cũ — Nhánh 4: Có GRPO mới hạch toán trong kỳ',
    description:
      'Tìm các đơn SO trả hàng có DocDate trước ngày bắt đầu ({d}) nhưng có phiếu nhập kho GRPO bên KBMĐ phát sinh trong kỳ.',
    impactBadges: ['Nhóm Cũ (SO trước kỳ có phát sinh chứng từ trong kỳ)'],
    allowedPlaceholders: ['{d}', '{brand_cond}'],
    requiredColumns: ['SO Number'],
    baselineColumns: ['SO Number'],
    dedupKeys: ['SO Number'],
    supportsExtraColumns: false,
    autoDateUpper: true,
    defaultSql: `SELECT DISTINCT S."DocNum" AS "SO Number"
FROM maycha_live.ORDR S
LEFT JOIN kbmd_live.OPOR P ON P."U_from_refno" = 'SO' || TO_VARCHAR(S."DocNum")
  AND P."CardCode" = 'V0800001' AND P."CANCELED" = 'N'
LEFT JOIN maycha_live.OWHS W ON W."WhsCode" = COALESCE(S."U_Store", SUBSTR_BEFORE(S."U_MCDocNum", '-'))
INNER JOIN kbmd_live.PDN1 GL ON GL."BaseType" = 22 AND GL."BaseEntry" = P."DocEntry"
INNER JOIN kbmd_live.OPDN G ON G."DocEntry" = GL."DocEntry" AND G."CANCELED" = 'N'
WHERE S."CardCode" = '209010' AND (S."CANCELED" = 'N' OR P."DocNum" IS NOT NULL) AND S."DocDate" < '{d}'{brand_cond}
 AND G."DocDate" >= '{d}'`,
  },
  {
    key: 'old_sos_5',
    flow: 'tra',
    stage: 'old_discovery',
    sortOrder: 25,
    title: '#25 · Tìm SO Trả cũ — Nhánh 5: Có A/P mới hạch toán trong kỳ',
    description:
      'Tìm các đơn SO trả hàng có DocDate trước ngày bắt đầu ({d}) nhưng có hóa đơn A/P bên KBMĐ phát sinh trong kỳ.',
    impactBadges: ['Nhóm Cũ (SO trước kỳ có phát sinh chứng từ trong kỳ)'],
    allowedPlaceholders: ['{d}', '{brand_cond}'],
    requiredColumns: ['SO Number'],
    baselineColumns: ['SO Number'],
    dedupKeys: ['SO Number'],
    supportsExtraColumns: false,
    autoDateUpper: true,
    defaultSql: `SELECT DISTINCT S."DocNum" AS "SO Number"
FROM maycha_live.ORDR S
LEFT JOIN kbmd_live.OPOR P ON P."U_from_refno" = 'SO' || TO_VARCHAR(S."DocNum")
  AND P."CardCode" = 'V0800001' AND P."CANCELED" = 'N'
LEFT JOIN maycha_live.OWHS W ON W."WhsCode" = COALESCE(S."U_Store", SUBSTR_BEFORE(S."U_MCDocNum", '-'))
INNER JOIN kbmd_live.PDN1 GL ON GL."BaseType" = 22 AND GL."BaseEntry" = P."DocEntry"
INNER JOIN kbmd_live.OPDN G ON G."DocEntry" = GL."DocEntry" AND G."CANCELED" = 'N'
INNER JOIN kbmd_live.PCH1 AL ON AL."BaseType" = 20 AND AL."BaseEntry" = G."DocEntry"
INNER JOIN kbmd_live.OPCH A ON A."DocEntry" = AL."DocEntry" AND A."CANCELED" = 'N'
WHERE S."CardCode" = '209010' AND (S."CANCELED" = 'N' OR P."DocNum" IS NOT NULL) AND S."DocDate" < '{d}'{brand_cond}
 AND A."DocDate" >= '{d}'`,
  },
] as const;

export const SAP_QUERY_CATALOG_BY_KEY: Readonly<
  Record<SapQueryKey, SapQueryCatalogEntry>
> = Object.fromEntries(
  SAP_QUERY_CATALOG.map((entry) => [entry.key, entry]),
) as unknown as Readonly<Record<SapQueryKey, SapQueryCatalogEntry>>;

export function isSapQueryKey(key: string): key is SapQueryKey {
  return Object.prototype.hasOwnProperty.call(SAP_QUERY_CATALOG_BY_KEY, key);
}

export function getSapQueryCatalogEntry(
  key: string,
): SapQueryCatalogEntry | undefined {
  return isSapQueryKey(key) ? SAP_QUERY_CATALOG_BY_KEY[key] : undefined;
}
