---
title: "Phase 1: Schema, Permission & 25-Query Seed Catalog"
status: todo
priority: P1
effort: 2.0h
dependencies: []
---

# Phase 1: Schema, Permission & 25-Query Seed Catalog

## Overview

Thiết lập nền tảng dữ liệu PostgreSQL (`SapQueryDef`, `SapQueryVersion`, `SapQueryAudit`), bổ sung quyền `sap-query:manage` vào hệ thống phân quyền 2 đầu Backend/Frontend, và xây dựng danh mục chuẩn 25 câu truy vấn Full SQL trải phẳng (`SAP_QUERY_CATALOG`) chia làm 2 Tab (13 câu Luồng Bán + 12 câu Luồng Trả) kèm `requiredColumns`, `baselineColumns`, `dedupKeys` và bộ kiểm thử chứng minh khớp 100% từng ký tự với bộ câu truy vấn hiện hành.

---

## Target Files & Symbols

| STT | Đường dẫn Tệp tin | Hành động | Mục đích |
|:---:|---|:---:|---|
| 1 | `apps/api/prisma/schema.prisma` | Modify | Thêm 3 model `SapQueryDef`, `SapQueryVersion`, `SapQueryAudit` (sau `SapStore` dòng 92) |
| 2 | `apps/api/src/modules/access-control/permission-catalog.ts` | Modify | Thêm quyền `sap-query:manage` vào `PERMISSION_CATALOG`, `PERMISSIONS`, `PERMISSION_KEYS_MAP` |
| 3 | `apps/api/src/modules/access-control/permission-catalog.spec.ts` | Modify | Cập nhật test kiểm tra 6 quyền trong catalog |
| 4 | `apps/api/src/modules/users/users.service.spec.ts` | Modify | Cập nhật dòng 79 (`expect(catalog.permissions.length).toBe(6)`) <!-- Updated: Red Team 2026-10-29 - thêm caller users.service.spec.ts:79 --> |
| 5 | `apps/web/lib/auth/permission-keys.ts` | Modify | Thêm `SAP_QUERY_MANAGE: 'sap-query:manage'` vào `PERMISSIONS` và `ADMIN_PERMISSIONS` |
| 6 | `apps/web/lib/shell/sidebar-nav-data.ts` | Modify | Import `FileCode2` từ `lucide-react`, thêm `PERMISSIONS.SAP_QUERY_MANAGE` vào `ADMIN_AREA_PERMISSIONS` và mục menu `"Câu truy vấn SAP"` (`/admin/sap-queries`) |
| 7 | `apps/web/lib/shell/sidebar-nav-data.spec.ts` | Modify | Cập nhật unit test điều hướng sidebar cho quyền `sap-query:manage` |
| 8 | `apps/api/src/modules/sap/queries/sap-query-catalog.ts` | Create | Danh mục chuẩn 25 câu Full SQL trải phẳng, chia 2 Tab, kèm nhãn, `impactBadges`, `allowedPlaceholders`, `requiredColumns`, `baselineColumns`, `dedupKeys` |
| 9 | `apps/api/src/modules/sap/queries/sap-query-catalog.spec.ts` | Create | Unit test đối chiếu 1:1 từng ký tự giữa 25 câu trong catalog và `buildSalesListQueries`, `buildSalesChainQueries`, `buildReturnQueries` (giữ lại 3 hàm cũ làm oracle đối chiếu) |
| 10 | `apps/api/scripts/seed.ts` | Modify | Upsert 25 dòng `SapQueryDef` và phiên bản gốc `v1` (`SapQueryVersion`) khi chạy seed |

---

## Requirements

- [x] Model Prisma `SapQueryDef`, `SapQueryVersion`, `SapQueryAudit` lưu đầy đủ thông tin định nghĩa câu query, `requiredColumns`, `baselineColumns`, `dedupKeys`, lịch sử phiên bản append-only và nhật ký chỉnh sửa. <!-- Updated: Red Team 2026-10-29 - thêm baselineColumns và append-only SapQueryVersion -->
- [x] Quyền `sap-query:manage` được khai báo đồng bộ ở cả 3 cấu trúc trong `permission-catalog.ts`, `users.service.spec.ts`, và phía `apps/web`.
- [x] `SAP_QUERY_CATALOG` định nghĩa đúng **25 câu truy vấn** (13 câu `flow: 'ban'` + 12 câu `flow: 'tra'`), trải phẳng toàn bộ đoạn nối chuỗi tĩnh (`poCols`, `poGrp`, `base`, `grpoJoin`, `apJoin`, `doJoin`, `arDirect`, `arViaDo`, mã đối tác `309019`, `NB010002`, `V0800001`), chỉ giữ biến runtime:
  - `stage: 'list'` (`#01..#08`): `allowedPlaceholders: ['{d}', '{br}']`
  - `stage: 'chain'` (`#09..#13`): `allowedPlaceholders: ['{br}', '{po_filter}']`
  - `stage: 'main'` (`#14..#19`): `allowedPlaceholders: ['{brand}', '{date_cond}']`; riêng `#20 ret_whs` có `allowedPlaceholders: []`
  - `stage: 'old_discovery'` (`#21..#25` — `ret_old_1..5`): cố định `P."DocDate" < '{d}'` trực tiếp trong câu SQL, chỉ dùng `allowedPlaceholders: ['{d}', '{brand}']` (không dùng `{date_cond}`) để không bao giờ bị bung nhầm thành `>= '{d}'`. <!-- Updated: Red Team 2026-10-29 - ret_old_1..5 dùng P."DocDate" < '{d}' cố định -->
- [x] Mỗi mục trong `SAP_QUERY_CATALOG` khai báo tường minh cả `requiredColumns` (cột bắt buộc không được xóa) lẫn `baselineColumns` (toàn bộ cột trả về của bản gốc `v1`, bao gồm cả `"PO DocEntry"` ở `chain_po` và `"Kho PO min"`, `"Kho PO max"` ở `ret_po`) để khi tính `extraColumns` không làm lộ cột nội bộ. <!-- Updated: Red Team 2026-10-29 - tách rõ requiredColumns và baselineColumns -->

---

## Implementation Steps

1. **Cập nhật Prisma Schema (`apps/api/prisma/schema.prisma`):**
   - Thêm 3 model `SapQueryDef`, `SapQueryVersion`, `SapQueryAudit` vào cuối file `apps/api/prisma/schema.prisma` (sau `SapStore` ở dòng 92).
   - Chạy `pnpm --filter=api prisma migrate dev --name add_sap_query_config_tables` để tạo migration và sinh lại Prisma Client trong `apps/api/src/generated/prisma`.
2. **Bổ sung quyền `sap-query:manage`:**
   - Trong `apps/api/src/modules/access-control/permission-catalog.ts`:
     - Thêm `{ key: 'sap-query:manage', label: 'Quản lý câu truy vấn SAP', category: 'SAP Monitor' }` vào `PERMISSION_CATALOG`.
     - Thêm `SAP_QUERY_MANAGE: 'sap-query:manage'` vào `PERMISSIONS`.
     - Thêm `'sap-query:manage': true` vào `PERMISSION_KEYS_MAP`.
   - Cập nhật `apps/api/src/modules/access-control/permission-catalog.spec.ts` và `apps/api/src/modules/users/users.service.spec.ts:79` (`toBe(6)`).
   - Trong `apps/web/lib/auth/permission-keys.ts`: thêm `SAP_QUERY_MANAGE: 'sap-query:manage'` vào `PERMISSIONS` và `ADMIN_PERMISSIONS`.
   - Trong `apps/web/lib/shell/sidebar-nav-data.ts`: import `FileCode2` từ `lucide-react`, thêm `PERMISSIONS.SAP_QUERY_MANAGE` vào `ADMIN_AREA_PERMISSIONS` và thêm mục `{ title: 'Câu truy vấn SAP', href: '/admin/sap-queries', icon: FileCode2, requiredPermissions: [PERMISSIONS.SAP_QUERY_MANAGE] }` vào nhóm `'Quản trị hệ thống'`. Cập nhật `sidebar-nav-data.spec.ts`.
3. **Xây dựng `apps/api/src/modules/sap/queries/sap-query-catalog.ts`:**
   - Khai báo tường minh `SapQueryKey` (union của 25 khóa), `SapQueryFlow = 'ban' | 'tra'`, `SapQueryStage = 'list' | 'chain' | 'main' | 'old_discovery'`, `SapRuntimePlaceholder = '{d}' | '{br}' | '{po_filter}' | '{brand}' | '{date_cond}'`, và interface `SapQueryCatalogEntry`.
   - Khai báo mảng bất biến `SAP_QUERY_CATALOG` gồm **25 mục** (`sortOrder: 1..25`) với đầy đủ `requiredColumns`, `baselineColumns`, `dedupKeys`:
     - `funnel`: `requiredColumns = baselineColumns = ['Store', 'Ten cua hang', 'PO', 'SO']`, `dedupKeys = ['Store']`
     - `t1`: `requiredColumns = ['Store', 'PO Number', 'DocDate', 'Ly do']`, `baselineColumns = ['Store', 'PO Number', 'DocDate', 'PO CreateDate', 'PO Status', 'So dong PO', 'Ly do']`, `dedupKeys = ['PO Number']`
     - `t2`: `requiredColumns = ['Store', 'SO Number', 'PO Number', 'PO DocDate', 'Ghi chu ShipDate']`, `baselineColumns = ['Store', 'SO Number', 'PO Number', 'PO DocDate', 'PO CreateDate', 'PO tao truoc ky', 'DocDate', 'SO ShipDate', 'Ghi chu ShipDate', 'So dong SO', 'So dong chua co AR']`, `dedupKeys = ['SO Number', 'PO Number']`
     - `t3`: `requiredColumns = ['Store', 'AR Number', 'SO Number', 'PO Number', 'PO DocDate', 'Ghi chu ShipDate']`, `baselineColumns = ['Store', 'AR Number', 'AR DocDate', 'AR CreateDate', 'AR ShipDate', 'Invoice No', 'SO Number', 'PO Number', 'PO DocDate', 'PO CreateDate', 'PO tao truoc ky', 'So dong AR', 'So dong chua co GRPO', 'Trang thai', 'Ghi chu ShipDate']`, `dedupKeys = ['AR Number', 'SO Number', 'PO Number']`
     - `t4`: `requiredColumns = ['Store', 'GRPO Number', 'PO Number', 'PO DocDate']`, `baselineColumns = ['Store', 'GRPO Number', 'DocDate', 'PO Number', 'PO DocDate', 'PO CreateDate', 'PO tao truoc ky', 'So dong GRPO']`, `dedupKeys = ['GRPO Number', 'PO Number']`
     - `ar`: `requiredColumns = ['Store', 'AR Number', 'Invoice No', 'SO Number', 'PO Number', 'PO DocDate']`, `baselineColumns = ['Store', 'AR Number', 'DocDate', 'Invoice No', 'Invoice Seri', 'Invoice Date', 'SO Number', 'PO Number', 'PO DocDate', 'PO CreateDate', 'PO tao truoc ky']`, `dedupKeys = ['AR Number', 'SO Number', 'PO Number']`
     - `grpo`: `requiredColumns = ['Store', 'GRPO Number', 'PO Number', 'PO DocDate']`, `baselineColumns = ['Store', 'GRPO Number', 'DocDate', 'PO Number', 'PO DocDate', 'PO CreateDate', 'PO tao truoc ky', 'Comments']`, `dedupKeys = ['GRPO Number', 'PO Number']`
     - `ap`: `requiredColumns = ['Store', 'AP Number', 'GRPO Number', 'PO Number', 'PO DocDate']`, `baselineColumns = ['Store', 'AP Number', 'DocDate', 'Invoice No', 'GRPO Number', 'PO Number', 'PO DocDate', 'PO CreateDate', 'PO tao truoc ky']`, `dedupKeys = ['AP Number', 'GRPO Number', 'PO Number']`
     - `chain_po`: `requiredColumns = ['Store', 'PO Number', 'PO DocDate', 'PO CreateDate', 'PO Status', 'So dong PO', 'Tong SL PO']`, `baselineColumns = ['Store', 'PO Number', 'PO DocEntry', 'PO DocDate', 'PO CreateDate', 'PO Status', 'So dong PO', 'Tong SL PO']`, `dedupKeys = ['PO Number']`
     - `chain_so`: `requiredColumns = ['PO Number', 'SO Number', 'SO CreateDate', 'SO ShipDate']`, `baselineColumns = ['PO Number', 'SO Number', 'SO DocDate', 'SO CreateDate', 'SO ShipDate']`, `dedupKeys = ['PO Number', 'SO Number']`
     - `chain_ar`: `requiredColumns = baselineColumns = ['PO Number', 'AR Number', 'AR DocDate', 'AR CreateDate', 'AR ShipDate', 'Invoice No']`, `dedupKeys = ['PO Number', 'AR Number']`
     - `chain_grpo`: `requiredColumns = baselineColumns = ['PO Number', 'GRPO Number', 'GRPO DocDate']`, `dedupKeys = ['PO Number', 'GRPO Number']`
     - `chain_ap`: `requiredColumns = baselineColumns = ['PO Number', 'GRPO Number', 'AP Number', 'AP DocDate']`, `dedupKeys = ['PO Number', 'GRPO Number', 'AP Number']`
     - `ret_po`: `requiredColumns = baselineColumns = ['PO Number', 'PO DocDate', 'PO CreateDate', 'Store', 'Brand', 'MC Docnum', 'Kho PO min', 'Kho PO max']`, `dedupKeys = ['PO Number']`
     - `ret_so`: `requiredColumns = baselineColumns = ['PO Number', 'SO Number', 'SO DocDate', 'SO CreateDate', 'SO ShipDate', 'Kho SO min', 'Kho SO max']`, `dedupKeys = ['PO Number', 'SO Number']`
     - `ret_do`: `requiredColumns = baselineColumns = ['PO Number', 'DO Number']`, `dedupKeys = ['PO Number', 'DO Number']`
     - `ret_ar`: `requiredColumns = baselineColumns = ['PO Number', 'AR Number', 'AR DocDate', 'AR CreateDate', 'AR ShipDate', 'Invoice No']`, `dedupKeys = ['PO Number', 'AR Number']`
     - `ret_grpo`: `requiredColumns = baselineColumns = ['PO Number', 'GRPO Number', 'GRPO DocDate', 'Kho GRPO min', 'Kho GRPO max']`, `dedupKeys = ['PO Number', 'GRPO Number']`
     - `ret_ap`: `requiredColumns = baselineColumns = ['PO Number', 'GRPO Number', 'AP Number', 'AP DocDate']`, `dedupKeys = ['PO Number', 'GRPO Number', 'AP Number']`
     - `ret_whs`: `requiredColumns = baselineColumns = ['DB', 'WhsCode', 'WhsName']`, `dedupKeys = ['DB', 'WhsCode']`
     - `ret_old_1..5`: `requiredColumns = baselineColumns = ['PO Number']`, `dedupKeys = ['PO Number']`
4. **Cập nhật `apps/api/scripts/seed.ts` & Viết Unit Test `sap-query-catalog.spec.ts`:**
   - Trong `seed.ts`: lặp qua `SAP_QUERY_CATALOG`, upsert `SapQueryDef` và tạo `SapQueryVersion` `versionNo = 1` nếu chưa tồn tại.
   - Trong `sap-query-catalog.spec.ts`: kiểm tra đủ 25 câu, kiểm tra khi bung `defaultSql` của 8 câu `list`, 5 câu `chain` (cả chế độ ngày và chế độ lô PO), 7 câu `ret_*` (cả chế độ ngày và lô PO), và nối 5 câu `ret_old_1..5` bằng `'\nUNION\n'` rồi bọc `wrapOpenquery()` thì khớp 100% từng ký tự với `buildSalesListQueries`, `buildSalesChainQueries`, `buildReturnQueries`.

---

## Todo

- [x] Task 1.1: Thêm `SapQueryDef`, `SapQueryVersion`, `SapQueryAudit` vào `apps/api/prisma/schema.prisma` và tạo migration Prisma.
- [x] Task 1.2: Thêm quyền `sap-query:manage` vào `permission-catalog.ts`, `permission-catalog.spec.ts`, `users.service.spec.ts`, `permission-keys.ts`, `sidebar-nav-data.ts`, `sidebar-nav-data.spec.ts`.
- [x] Task 1.3: Tạo `apps/api/src/modules/sap/queries/sap-query-catalog.ts` chứa đủ 25 câu Full SQL trải phẳng chia 2 Tab kèm metadata, `impactBadges`, `allowedPlaceholders`, `requiredColumns`, `baselineColumns`, `dedupKeys`.
- [x] Task 1.4: Cập nhật `apps/api/scripts/seed.ts` và viết `apps/api/src/modules/sap/queries/sap-query-catalog.spec.ts` kiểm chứng khớp 100% ký tự với bộ query hiện hành.

---

## Success Criteria

- Migration tạo bảng `sap_query_defs`, `sap_query_versions`, `sap_query_audits` thành công.
- `pnpm --filter=api test -- permission-catalog.spec.ts users.service.spec.ts sap-query-catalog.spec.ts` và `pnpm --filter=web test -- sidebar-nav-data.spec.ts` pass 100%.
