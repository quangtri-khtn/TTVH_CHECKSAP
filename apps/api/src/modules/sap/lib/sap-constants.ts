// Các hằng số nghiệp vụ dùng chung cho truy vấn SAP HANA qua SQL Server Linked Server (hana_mc).
// Nguồn đối chiếu 1:1: desktop `sales_flow_checker.py` (:596, :2225-2230, :3411-3418).

/** Tên Linked Server trên SQL Server trỏ sang SAP HANA (`:596`). */
export const SAP_LINKED_SERVER = 'hana_mc';

/** Schema SAP HANA của pháp nhân Thịnh Thế Vinh Hoa (TTVH). */
export const SAP_SCHEMA_TTVH = 'maycha_live';

/** Schema SAP HANA của pháp nhân Khang Bách Minh Đại (KBMĐ). */
export const SAP_SCHEMA_KBMD = 'kbmd_live';

/** Mã nhà cung cấp trên PO bên TTVH — tức KBMĐ bán hàng cho TTVH (`:2237`). */
export const SALES_PO_VENDOR_CODE = '309019';

/** Mã khách hàng trên SO bên KBMĐ — tức TTVH mua hàng từ KBMĐ (`:2242`). */
export const SALES_SO_CUSTOMER_CODE = 'NB010002';

/** Mã nhà cung cấp trên PO trả hàng bên KBMĐ — tức TTVH nhận hàng trả từ KBMĐ (`:3412`). */
export const RETURN_PO_VENDOR_CODE = 'V0800001';

/**
 * Danh sách 26 mã cửa hàng pilot của luồng Trả hàng (`:3414-3418`).
 * Giữ nguyên đúng thứ tự desktop (có `BB115`, không có `BB071`).
 */
export const RETURN_PILOT_STORES = [
  'MC073',
  'MC011',
  'MC013',
  'MC001',
  'MC028',
  'MC078',
  'MC088',
  'MC115',
  'GA001',
  'GA002',
  'GA003',
  'GA004',
  'GA005',
  'GA006',
  'GA012',
  'GA015',
  'TC001',
  'TC002',
  'TC003',
  'TC004',
  'TC005',
  'TC006',
  'TC007',
  'BB013',
  'BB115',
  'BB073',
] as const;

/** Chuỗi danh sách mã cửa hàng pilot đã bọc nháy đơn để nhúng vào mệnh đề `IN (...)` của SQL. */
export const RETURN_PILOT_STORES_SQL = RETURN_PILOT_STORES.map((s) => `'${s}'`).join(', ');

/** Ngày bắt đầu mặc định của màn hình Monitor go-live (`:2225`). */
export const MONITOR_DEFAULT_DATE = '20261007';

/** Mã thương hiệu (OWHS.U_Brand) mặc định của màn hình Monitor (`:2226`, 5001 = Maycha). */
export const MONITOR_DEFAULT_BRAND = '5001';
