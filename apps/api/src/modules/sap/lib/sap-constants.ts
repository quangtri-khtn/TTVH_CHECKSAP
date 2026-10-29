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

/** Mã khách hàng trên SO trả hàng bên TTVH — tức KBMĐ trả hàng về TTVH (Mục 2.2 Đặc tả v1.1). */
export const RETURN_SO_CUSTOMER_CODE = '209010';

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


/**
 * Danh sách 120 mã cửa hàng mặc định được bật cho cả Luồng Bán và Luồng Trả
 * theo Phụ lục A của `Dac_Ta_Ky_Thuat_Web_Monitor_Ban_Tra.md` (v1.1 – 28/10/2026).
 */
export const DEFAULT_ACTIVE_STORES = [
  'MC027', 'MC076', 'MC089', 'MC136', 'MC079', 'MC083', 'MC059', 'MC062', 'MC092', 'MC132',
  'MC081', 'MC058', 'MC093', 'MC087', 'MC095', 'MC065', 'MC090', 'MC002', 'MC118', 'MC125',
  'MC085', 'MC103', 'MC004', 'MC107', 'MC109', 'MC084', 'MC104', 'MC117', 'MC042', 'MC054',
  'MC113', 'MC056', 'MC036', 'MC082', 'MC001', 'MC051', 'MC039', 'MC047', 'MC066', 'MC013',
  'MC007', 'MC105', 'MC008', 'MC072', 'MC017', 'MC122', 'MC115', 'MC111', 'MC052', 'MC024',
  'MC078', 'MC026', 'MC011', 'MC028', 'MC080', 'MC086', 'MC060', 'MC023', 'MC073', 'MC112',
  'MC121', 'MC110', 'MC045', 'MC048', 'MC074', 'MC124', 'MC116', 'MC071', 'MC030', 'MC057',
  'MC097', 'MC044', 'MC070', 'MC128', 'MC100', 'MC129', 'MC029', 'MC061', 'MC114', 'MC130',
  'MC119', 'MC088', 'MC120', 'MC123', 'MC126', 'MC099', 'MC131', 'MC069', 'MC127', 'MC133',
  'MC134', 'MC137', 'MC091', 'MC094', 'MC064', 'MC138', 'MC135', 'MC139', 'MC012', 'MC140',
  'MC141', 'MC142', 'BB013', 'BB073', 'GA006', 'GA001', 'GA002', 'GA003', 'GA004', 'GA005',
  'GA012', 'BB115', 'GA015', 'TC001', 'TC002', 'TC003', 'TC004', 'TC005', 'TC006', 'TC007',
] as const;
/** Ngày bắt đầu mặc định của màn hình Monitor go-live (`:2225`). */
export const MONITOR_DEFAULT_DATE = '20261007';

/** Mã thương hiệu (OWHS.U_Brand) mặc định của màn hình Monitor (`:2226`, 5001 = Maycha). */
export const MONITOR_DEFAULT_BRAND = '5001';
