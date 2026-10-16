"""Builds all SAP/SQL queries - ported from sales_flow_checker.py."""

SCHEMA_MAP = {
    "TTVH": "maycha_live",
    "KBMD": "kbmd_live",
}

INTERNAL_CUSTOMER = "NB010002"

DEFAULT_DATE_FROM = "20261007"
OVER_PO_DEFAULT_DATE = "20260901"


def _wrap(inner: str) -> str:
    return "select * from openquery(hana_mc, '" + inner.replace("'", "''") + "')"


# ── Flow queries ─────────────────────────────────────────────────────────────

def build_flow_query(query_text: str, date_from: str) -> str:
    old = f"''{DEFAULT_DATE_FROM}''"
    new = f"''{date_from}''"
    if old not in query_text:
        raise ValueError(
            f'Không tìm thấy mốc ngày "{old}" trong query để thay thế.'
        )
    return query_text.replace(old, new, 1)


# ── PO → GRPO / SO → AR check ────────────────────────────────────────────────

def build_po_grpo_query(db: str, po_numbers: list[str]) -> str:
    schema = SCHEMA_MAP[db]
    po_list = ", ".join(po_numbers)
    inner = f"""
SELECT
    T0."DocNum" AS "PO Number",
    T0."DocDate",
    T0."CardCode",
    T0."CardName",
    T2."DocNum" AS "GRPO Number",
    CASE
        WHEN T2."DocNum" IS NULL THEN NULL
        WHEN T2."Comments" LIKE ''%Auto Copy%'' OR T2."UserSign" = 25 OR T2."U_JobStatus" = ''Y'' THEN TO_NVARCHAR(''AUTO'')
        ELSE TO_NVARCHAR(''TẠO TAY'')
    END AS "Nguồn GRPO",
    T2."CardCode" AS "GRPO Vendor Code",
    T2."CardName" AS "GRPO Vendor Name",
    CASE WHEN T2."DocNum" IS NULL THEN ''Chưa có GRPO'' ELSE ''Đã có GRPO'' END AS "Trang thái"
FROM {schema}.OPOR T0
LEFT JOIN {schema}.PDN1 T1 ON T1."BaseEntry" = T0."DocEntry" AND T1."BaseType" = ''22''
LEFT JOIN {schema}.OPDN T2 ON T1."DocEntry" = T2."DocEntry"
WHERE T0."DocNum" IN ({po_list})
GROUP BY T0."DocNum", T0."DocDate", T0."CardCode", T0."CardName", T2."DocNum",
         T2."Comments", T2."UserSign", T2."U_JobStatus", T2."CardCode", T2."CardName"
"""
    return _wrap(inner)


def build_so_ar_query(db: str, so_numbers: list[str]) -> str:
    schema = SCHEMA_MAP[db]
    so_list = ", ".join(so_numbers)
    inner = f"""
SELECT
    T0."DocNum" AS "SO Number",
    T0."DocDate",
    T0."CardCode",
    T0."CardName",
    T2."DocNum" AS "AR Number",
    CASE
        WHEN T2."DocNum" IS NULL THEN NULL
        WHEN T2."UserSign" = 25 OR T2."U_from_refno" LIKE ''PO%'' OR T2."Comments" LIKE ''%Auto Copy%'' THEN TO_NVARCHAR(''AUTO'')
        ELSE TO_NVARCHAR(''TẠO TAY'')
    END AS "Nguồn AR",
    T2."NumAtCard" AS "Customer Ref No",
    CASE WHEN T2."DocNum" IS NULL THEN ''Chưa có A/R'' ELSE ''Đã có A/R'' END AS "Trang thái"
FROM {schema}.ORDR T0
LEFT JOIN {schema}.INV1 T1 ON T1."BaseEntry" = T0."DocEntry" AND T1."BaseType" = ''17''
LEFT JOIN {schema}.OINV T2 ON T1."DocEntry" = T2."DocEntry"
WHERE T0."DocNum" IN ({so_list})
GROUP BY T0."DocNum", T0."DocDate", T0."CardCode", T0."CardName", T2."DocNum",
         T2."UserSign", T2."U_from_refno", T2."Comments", T2."NumAtCard"
"""
    return _wrap(inner)


# ── Nguồn chứng từ ────────────────────────────────────────────────────────────

def build_origin_query(db: str, doc_type: str, doc_numbers: list[str]) -> str:
    schema = SCHEMA_MAP[db]
    doc_list = ", ".join(doc_numbers)

    builders = {
        "PR": _origin_pr,
        "GRPO": _origin_grpo,
        "AP": _origin_ap,
        "SO": _origin_so,
        "AR": _origin_ar,
    }
    fn = builders.get(doc_type.upper())
    if fn is None:
        raise ValueError(f"Loại chứng từ không hỗ trợ: {doc_type}")
    return fn(schema, doc_list)


def _origin_pr(schema: str, doc_list: str) -> str:
    inner = f"""
SELECT
    T0."DocNum" AS "So_PR", T0."DocDate" AS "Ngay_Chung_Tu",
    T0."CreateDate" AS "Ngay_Tao_SAP", T0."DocTime" AS "Gio_Tao_SAP",
    T1."USER_CODE" AS "User_Code", T1."U_NAME" AS "Ten_Nguoi_Tao",
    T0."U_Store" AS "Cua_Hang", T0."U_MCDocNum" AS "So_Don_Maycha",
    T0."U_MCCreateDate" AS "Thoi_Gian_Tao_Maycha", T0."Comments" AS "Ghi_Chu",
    CASE
        WHEN T1."USER_CODE" = ''B1IF'' OR T0."U_MCDocNum" IS NOT NULL
            THEN ''AUTO (Hệ thống Maycha / B1IF)''
        ELSE ''TẠO TAY (User: '' || IFNULL(T1."U_NAME", ''N/A'') || '')''
    END AS "Nguon_Tao"
FROM {schema}.OPRQ T0
LEFT JOIN {schema}.OUSR T1 ON T0."UserSign" = T1."USERID"
WHERE T0."DocNum" IN ({doc_list})
ORDER BY T0."DocNum" DESC
"""
    return _wrap(inner)


def _origin_grpo(schema: str, doc_list: str) -> str:
    inner = f"""
SELECT
    T0."DocNum" AS "So_GRPO", T0."DocDate" AS "Ngay_Chung_Tu",
    T0."CreateDate" AS "Ngay_Tao_SAP", T0."DocTime" AS "Gio_Tao_SAP",
    T1."USER_CODE" AS "User_Code", T1."U_NAME" AS "Ten_Nguoi_Tao",
    T0."U_Store" AS "Cua_Hang", T0."U_MCDocNum" AS "So_Don_Maycha",
    T0."U_Docnum" AS "So_Phieu_GR_Maycha", T0."U_JobStatus" AS "Trang_Thai_Job",
    T0."U_LastSyncDate" AS "Thoi_Gian_Chay_Job", T0."Comments" AS "Ghi_Chu",
    CASE
        WHEN T0."Comments" LIKE ''%Auto Copy%'' OR T1."USER_CODE" = ''B1IF'' OR T0."U_JobStatus" = ''Y''
            THEN ''AUTO (Tự động đồng bộ / Auto Copy)''
        ELSE ''TẠO TAY (User: '' || IFNULL(T1."U_NAME", ''N/A'') || '')''
    END AS "Nguon_Tao"
FROM {schema}.OPDN T0
LEFT JOIN {schema}.OUSR T1 ON T0."UserSign" = T1."USERID"
WHERE T0."DocNum" IN ({doc_list})
ORDER BY T0."DocNum" DESC
"""
    return _wrap(inner)


def _origin_ap(schema: str, doc_list: str) -> str:
    inner = f"""
SELECT
    T0."DocNum" AS "So_AP", T0."DocDate" AS "Ngay_Chung_Tu",
    T0."CreateDate" AS "Ngay_Tao_SAP", T0."DocTime" AS "Gio_Tao_SAP",
    T1."USER_CODE" AS "User_Code", T1."U_NAME" AS "Ten_Nguoi_Tao",
    T0."U_Store" AS "Cua_Hang", T0."U_MCDocNum" AS "So_Don_Maycha",
    T0."U_Docnum" AS "So_Phieu_AP_Maycha", T0."U_JobStatus" AS "Trang_Thai_Job",
    T0."U_to_refno" AS "Ma_Tham_Chieu_Lien_Ket", T0."Comments" AS "Ghi_Chu",
    CASE
        WHEN T0."Comments" LIKE ''%Auto Copy%'' OR T1."USER_CODE" = ''B1IF'' OR T0."U_JobStatus" = ''Y''
            THEN ''AUTO (Tự động sinh / Auto Copy)''
        ELSE ''TẠO TAY (Kế toán: '' || IFNULL(T1."U_NAME", ''N/A'') || '')''
    END AS "Nguon_Tao"
FROM {schema}.OPCH T0
LEFT JOIN {schema}.OUSR T1 ON T0."UserSign" = T1."USERID"
WHERE T0."DocNum" IN ({doc_list})
ORDER BY T0."DocNum" DESC
"""
    return _wrap(inner)


def _origin_so(schema: str, doc_list: str) -> str:
    inner = f"""
SELECT
    T0."DocNum" AS "So_SO", T0."DocDate" AS "Ngay_Chung_Tu",
    T0."CreateDate" AS "Ngay_Tao_SAP", T0."DocTime" AS "Gio_Tao_SAP",
    T1."USER_CODE" AS "User_Code", T1."U_NAME" AS "Ten_Nguoi_Tao",
    T0."CardCode" AS "Ma_Khach_Hang", T0."CardName" AS "Ten_Khach_Hang",
    T0."U_from_refno" AS "Lien_Ket_PO_TTVH", T0."U_Buyer" AS "Thong_Tin_Buyer",
    T0."U_MCDocNum" AS "So_Don_Maycha", T0."Comments" AS "Ghi_Chu",
    CASE
        WHEN T1."USER_CODE" = ''B1IF'' OR T0."U_from_refno" LIKE ''PO%''
            THEN ''AUTO (Tự động sinh từ PO của TTVH)''
        ELSE ''TẠO TAY (User: '' || IFNULL(T1."U_NAME", ''N/A'') || '')''
    END AS "Nguon_Tao"
FROM {schema}.ORDR T0
LEFT JOIN {schema}.OUSR T1 ON T0."UserSign" = T1."USERID"
WHERE T0."DocNum" IN ({doc_list})
ORDER BY T0."DocNum" DESC
"""
    return _wrap(inner)


def _origin_ar(schema: str, doc_list: str) -> str:
    inner = f"""
SELECT
    T0."DocNum" AS "So_AR", T0."DocDate" AS "Ngay_Chung_Tu",
    T0."CreateDate" AS "Ngay_Tao_SAP", T0."DocTime" AS "Gio_Tao_SAP",
    T1."USER_CODE" AS "User_Code", T1."U_NAME" AS "Ten_Nguoi_Tao",
    T0."CardCode" AS "Ma_Khach_Hang", T0."CardName" AS "Ten_Khach_Hang",
    T0."U_from_refno" AS "Lien_Ket_PO_TTVH", T0."U_MCDocNum" AS "So_Don_Maycha",
    T0."U_WMSNumber" AS "Ma_Lenh_WMS", T0."U_EinvStatus" AS "Trang_Thai_HDDT",
    T0."U_Einv_id" AS "UUID_HDDT", T0."U_InvSeri" AS "So_Seri_HDDT",
    T0."U_InvDate" AS "Ngay_Xuat_HDDT", T0."U_InvTaxNo" AS "MST_Nguoi_Mua",
    T0."NumAtCard" AS "Customer Ref No",
    CASE
        WHEN IFNULL(T0."U_WMSNumber", '') <> ''
            THEN ''AUTO (WMS tự tạo - user '' || IFNULL(T1."USER_CODE", ''N/A'') || '')''
        ELSE ''TẠO TAY (User: '' || IFNULL(T1."U_NAME", ''N/A'') || '')''
    END AS "Nguon_Tao"
FROM {schema}.OINV T0
LEFT JOIN {schema}.OUSR T1 ON T0."UserSign" = T1."USERID"
WHERE T0."DocNum" IN ({doc_list})
ORDER BY T0."DocNum" DESC
"""
    return _wrap(inner)


# ── Flow chain (toàn bộ luồng 1 PO) ─────────────────────────────────────────

def build_flow_chain_queries(po_number: str) -> list[str]:
    po = int(po_number)
    T, K = "maycha_live", "kbmd_live"
    po_e = f'(SELECT "DocEntry" FROM {T}.OPOR WHERE "DocNum" = {po})'
    so_e = (f'(SELECT "DocEntry" FROM {K}.ORDR WHERE "U_from_refno" = \'PO{po}\' '
            f'AND "CardCode" = \'{INTERNAL_CUSTOMER}\')')
    do_e = f'(SELECT "DocEntry" FROM {K}.DLN1 WHERE "BaseType" = 17 AND "BaseEntry" IN {so_e})'
    ar_e = (f'(SELECT "DocEntry" FROM {K}.INV1 WHERE ("BaseType" = 17 AND "BaseEntry" IN {so_e}) '
            f'OR ("BaseType" = 15 AND "BaseEntry" IN {do_e}))')
    gr_e = f'(SELECT "DocEntry" FROM {T}.PDN1 WHERE "BaseType" = 22 AND "BaseEntry" IN {po_e})'
    ap_e = (f'(SELECT "DocEntry" FROM {T}.PCH1 WHERE ("BaseType" = 20 AND "BaseEntry" IN {gr_e}) '
            f'OR ("BaseType" = 22 AND "BaseEntry" IN {po_e}))')

    nul = 'CAST(NULL AS NVARCHAR(100))'
    empty = "TO_NVARCHAR('')"

    ar_source_sql = (
        f"CASE WHEN IFNULL(T0.\"U_WMSNumber\", '') <> '' "
        f"THEN 'AUTO - WMS tự tạo (' || T0.\"U_WMSNumber\" || ')' "
        f"ELSE 'TẠO TAY - ' || IFNULL((SELECT MAX(\"U_NAME\") FROM {K}.OUSR WHERE \"USERID\" = T0.\"UserSign\"), 'N/A') END"
    )
    ar_cols = ('TO_NVARCHAR(T0."NumAtCard")', 'TO_NVARCHAR(T0."U_EinvStatus")',
               'TO_NVARCHAR(T0."U_InvSeri")', 'T0."U_InvDate"', 'T0."U_ShipDate"')

    def sel(stage, order, schema, hdr, where, status='T0."DocStatus"', canceled='T0."CANCELED"',
            info=empty, ar=None):
        ref, st, ser, dt, ship = ar or (nul, nul, nul, nul, 'CAST(NULL AS DATE)')
        return (f'SELECT \'{stage}\' AS "Stage", {order} AS "Ord", T0."DocNum", T0."DocDate", '
                f'T0."CreateDate", TO_NVARCHAR({status}) AS "DocStatus", '
                f'TO_NVARCHAR({canceled}) AS "Canceled", T0."DocTotal" AS "DocTotal", '
                f'T0."TransId" AS "JE", {info} AS "Info", '
                f'{ref} AS "RefNo", {st} AS "EinvStatus", {ser} AS "InvSeri", '
                f'{dt} AS "InvDate", {ship} AS "ShipDate" '
                f'FROM {schema}.{hdr} T0 WHERE {where}')

    parts = [
        sel("PR", 1, T, "OPRQ",
            f'T0."DocEntry" IN (SELECT "BaseEntry" FROM {T}.POR1 WHERE "BaseType" = 1470000113 '
            f'AND "DocEntry" IN {po_e})', info='TO_NVARCHAR(T0."U_Store")'),
        sel("PO", 2, T, "OPOR", f'T0."DocNum" = {po}', info='TO_NVARCHAR(T0."U_Store")'),
        sel("SO", 3, K, "ORDR", f'T0."DocEntry" IN {so_e}', info='TO_NVARCHAR(T0."U_from_refno")'),
        sel("DO", 4, K, "ODLN", f'T0."DocEntry" IN {do_e}'),
        sel("AR", 5, K, "OINV", f'T0."DocEntry" IN {ar_e}', ar=ar_cols, info=ar_source_sql),
        sel("GRPO", 6, T, "OPDN", f'T0."DocEntry" IN {gr_e}'),
        sel("AP", 7, T, "OPCH", f'T0."DocEntry" IN {ap_e}'),
        sel("ARCM", 8, K, "ORIN",
            f'T0."DocEntry" IN (SELECT "DocEntry" FROM {K}.RIN1 WHERE "BaseType" = 13 AND "BaseEntry" IN {ar_e})'),
        sel("APCM", 9, T, "ORPC",
            f'T0."DocEntry" IN (SELECT "DocEntry" FROM {T}.RPC1 WHERE "BaseType" = 18 AND "BaseEntry" IN {ap_e})'),
        sel("IP", 10, K, "ORCT",
            f'T0."DocEntry" IN (SELECT "DocNum" FROM {K}.RCT2 WHERE "InvType" = 13 AND "DocEntry" IN {ar_e})',
            status=empty, canceled='T0."Canceled"'),
        sel("OP", 11, T, "OVPM",
            f'T0."DocEntry" IN (SELECT "DocNum" FROM {T}.VPM2 WHERE "InvType" = 18 AND "DocEntry" IN {ap_e})',
            status=empty, canceled='T0."Canceled"'),
    ]
    return [_wrap(part) for part in parts]
