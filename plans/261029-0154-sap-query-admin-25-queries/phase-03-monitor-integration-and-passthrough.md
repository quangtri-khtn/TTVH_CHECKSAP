---
title: "Phase 3: Monitor Integration, Extra-Col Passthrough & Codegen"
status: todo
priority: P1
effort: 1.5h
dependencies: [2]
---

# Phase 3: Monitor Integration, Extra-Col Passthrough & Codegen

## Overview

Nối `SapQueryConfigService` vào 2 dịch vụ `SapSalesMonitorService` và `SapReturnMonitorService` thông qua cơ chế **Frozen Snapshot** (đảm bảo toàn bộ các câu danh sách, chuỗi Nhóm Mới và các lô 300 PO Nhóm Cũ trong cùng 1 request dùng chung 1 phiên bản SQL đồng nhất), đồng thời nâng cấp các hàm ghép chuỗi (`assemblePoChain`, `assembleReturnChain`, `buildReturnArNoInv`) và 2 Monitor Service để tự động chuyển tiếp (passthrough) các cột phụ mới thêm (ngoài `baselineColumns`) ra bảng dữ liệu UI và file Excel, rồi chạy `pnpm codegen` sinh Orval client cho Frontend.

---

## Target Files & Symbols

| STT | Đường dẫn Tệp tin | Hành động | Mục đích |
|:---:|---|:---:|---|
| 1 | `apps/api/src/modules/sap/lib/sales-monitor/sales-po-chain.ts` | Modify | Nâng cấp `assemblePoChain` nhận diện các cột phụ (ngoài `CHAIN_PO_BASELINE_COLS`), trả về `{ table, rows, columns }` |
| 2 | `apps/api/src/modules/sap/lib/return-monitor/return-chain.ts` | Modify | Nâng cấp `assembleReturnChain` (cột phụ ngoài `RET_PO_BASELINE_COLS`) và `buildReturnArNoInv` (nhận `extraArColumns`, trả về `{ rows, columns }`) |
| 3 | `apps/api/src/modules/sap/lib/return-monitor/return-monitor.spec.ts` | Modify | Thêm unit test kiểm chứng passthrough cột mới ở `assembleReturnChain` và `buildReturnArNoInv` (đảm bảo câu `v1` gốc không lộ cột ẩn `Kho PO min/max`) |
| 4 | `apps/api/src/modules/sap/services/sap-sales-monitor.service.ts` | Modify | Inject `SapQueryConfigService`, lấy `querySnapshot` đầu `executeFetch`, kiểm tra khớp `columns` khi nối lô 300 PO cũ, và dùng `columns` từ `assemblePoChain` tại dòng 261 (`recordsToTable(chainColumns, chainRows)`) <!-- Updated: Red Team 2026-10-29 - dùng chainColumns tại dòng 261 và frozen snapshot --> |
| 5 | `apps/api/src/modules/sap/services/sap-sales-monitor.service.spec.ts` | Modify | Cập nhật mock/test cho `SapSalesMonitorService` với `SapQueryConfigService` và passthrough cột mới trên `lists.chain` |
| 6 | `apps/api/src/modules/sap/services/sap-return-monitor.service.ts` | Modify | Inject `SapQueryConfigService`, lấy `querySnapshot` đầu `executeFetch`, chạy 5 câu `ret_old_1..5` gom `oldPoSet`, dùng `arNoInvColumns` tại dòng 289 |
| 7 | `apps/api/src/modules/sap/services/sap-return-monitor.service.spec.ts` | Modify | Cập nhật test `SapReturnMonitorService` với 5 câu `ret_old_1..5`, `SapQueryConfigService`, và passthrough cột mới |
| 8 | `apps/web/lib/api/generated/**` | Modify (Codegen) | Chạy `pnpm codegen` sinh client và React Query hooks cho `sap-queries` |

---

## Requirements

- [x] **Bảo toàn 100% cột chuẩn + Passthrough cột phụ (Extra Columns ngoài `baselineColumns`):** <!-- Updated: Red Team 2026-10-29 - lọc theo baselineColumns và sửa sap-sales-monitor.service.ts:261 + buildReturnArNoInv -->
  - Trong `assemblePoChain` (`sales-po-chain.ts:98-202`):
    - Khai báo `CHAIN_PO_BASELINE_COLS = new Set(['Store', 'PO Number', 'PO DocEntry', 'PO DocDate', 'PO CreateDate', 'PO Status', 'So dong PO', 'Tong SL PO'])` (chứa cả `'PO DocEntry'` để cột nội bộ này không bao giờ bị coi là cột mới).
    - Tính `extraPoCols = chainResults.po.columns.filter((c) => !CHAIN_PO_BASELINE_COLS.has(c) && !CHAIN_COLUMNS_SET.has(c))`.
    - Với mỗi dòng PO, copy các giá trị `po[col] ?? null` của `extraPoCols` vào bản ghi `rows`.
    - Tính `columns = [...CHAIN_COLUMNS, ...extraPoCols]` và trả về `{ table: recordsToTable(columns, rows), rows, columns }`.
    - Tại `sap-sales-monitor.service.ts:253-261`: lấy `{ rows: rawChainRows, columns: chainColumns } = assemblePoChain(...)`, sau khi lọc `chainRows` theo `activeStoreCodes`, gọi `const chainTable = recordsToTable(chainColumns, chainRows);` để giữ nguyên toàn bộ cột phụ cho cả UI và Excel.
  - Trong `assembleReturnChain` (`return-chain.ts:225-374`):
    - Khai báo `RET_PO_BASELINE_COLS = new Set(['PO Number', 'PO DocDate', 'PO CreateDate', 'Store', 'Brand', 'MC Docnum', 'Kho PO min', 'Kho PO max'])` và `RET_AR_BASELINE_COLS = new Set(['PO Number', 'AR Number', 'AR DocDate', 'AR CreateDate', 'AR ShipDate', 'Invoice No'])`.
    - Tính `extraPoCols = results.po.columns.filter((c) => !RET_PO_BASELINE_COLS.has(c) && !RET_CHAIN_COLUMNS_SET.has(c))` và `extraArCols = results.ar.columns.filter((c) => !RET_AR_BASELINE_COLS.has(c) && !RET_AR_NOINV_COLS_SET.has(c))`.
    - Copy giá trị `po[col] ?? null` của `extraPoCols` vào từng dòng `ReturnChainRow`, trả về `table: recordsToTable([...RET_CHAIN_COLUMNS, ...extraPoCols], rows)` cùng `extraArCols` trong kết quả của `assembleReturnChain`.
  - Trong `buildReturnArNoInv(rows, arRows, today, extraArCols = [])` (`return-chain.ts:380-448`) và `SapReturnMonitorService` (`sap-return-monitor.service.ts:263, 289`):
    - Copy các giá trị `a[col] ?? null` của `extraArCols` vào từng bản ghi `ReturnArNoInvRow` (do `arRows` đã spread `...r` tại dòng 345 nên giá trị đã có sẵn trên `a`).
    - Tại `sap-return-monitor.service.ts:289`: gọi `const arNoInvTable = recordsToTable([...RET_AR_NOINV_COLS, ...extraArCols], arNoInvRows);`.
- [x] **Frozen Snapshot & Chạy 5 câu `ret_old_1..5`:** <!-- Updated: Red Team 2026-10-29 - dùng frozen querySnapshot xuyên suốt executeFetch -->
  - Cả `SapSalesMonitorService` và `SapReturnMonitorService` kết hợp `currentConfigEpoch = this.storeService.getConfigEpoch() + this.queryConfigService.getConfigEpoch()` trong `getSalesMonitor` / `getReturnMonitor` và `pruneCache()`.
  - Ngay đầu `executeFetch`, gọi `const querySnapshot = await this.queryConfigService.getSnapshot();` đúng 1 lần và truyền `querySnapshot` vào mọi lệnh `build*SqlMap(...)` (kể cả vòng lặp chia lô 300 PO cũ).
  - Trước khi nối dòng của lô 300 PO cũ (`rows.push(row)`), kiểm tra `chunkRes.columns.length === baseRes.columns.length`; nếu lệch thì ném lỗi rõ ràng để không bao giờ trả dữ liệu lệch cột.
  - Trong `SapReturnMonitorService.executeFetch`: Bước 3 chạy tuần tự 5 câu `ret_old_1..5` từ `queryConfigService.buildReturnOldDiscoverySqlMap(querySnapshot, dateFrom, brand)`, gom toàn bộ giá trị cột `'PO Number'` chưa nằm trong `newPoSet` vào `oldPoSet`.
- [x] **Sinh mã Orval (`pnpm codegen`):**
  - Chạy `pnpm codegen` thành công, sinh ra `apps/web/lib/api/generated/sap-queries/sap-queries.ts` và các model DTO trong `apps/web/lib/api/generated/model/`.

---

## Implementation Steps

1. **Nâng cấp Passthrough cột phụ trong `sales-po-chain.ts` và `return-chain.ts`:**
   - Khai báo `CHAIN_PO_BASELINE_COLS`, `RET_PO_BASELINE_COLS`, `RET_AR_BASELINE_COLS`.
   - Cập nhật `assemblePoChain`, `assembleReturnChain`, `buildReturnArNoInv` (tham số thứ 4 `extraArCols: readonly string[] = []` có mặc định `[]` để tương thích ngược với mọi test hiện hữu).
   - Bổ sung unit test kiểm tra cả 2 trường hợp: (a) với cột gốc `v1` thì `columns` giữ nguyên 23 / 28 / 15 cột chuẩn, (b) khi thêm cột `"Ghi chú UDF"` thì `table.columns` và `table.rows` chứa đúng cột đó ở cuối mỗi dòng.
2. **Tích hợp `SapQueryConfigService` vào `SapSalesMonitorService` và `SapReturnMonitorService`:**
   - Inject `SapQueryConfigService` vào constructor của cả 2 service.
   - Sử dụng `querySnapshot` bất biến trong `executeFetch` và cập nhật dòng `261` của `sap-sales-monitor.service.ts` cùng dòng `263, 289` của `sap-return-monitor.service.ts`.
   - Cập nhật `sap-sales-monitor.service.spec.ts` và `sap-return-monitor.service.spec.ts`.
3. **Chạy `pnpm codegen`:**
   - Chạy `pnpm codegen` để sinh OpenAPI JSON từ Backend và tạo bộ React Query hooks cho Frontend qua Orval.

---

## Todo

- [x] Task 3.1: Nâng cấp `assemblePoChain`, `assembleReturnChain`, `buildReturnArNoInv` hỗ trợ passthrough cột phụ ngoài `baselineColumns` kèm unit test.
- [x] Task 3.2: Tích hợp `SapQueryConfigService` (với `querySnapshot` bất biến) vào `SapSalesMonitorService` và `SapReturnMonitorService`, cập nhật unit tests.
- [x] Task 3.3: Chạy `pnpm codegen` và kiểm tra file sinh ra trong `apps/web/lib/api/generated/`.

---

## Success Criteria

- `pnpm --filter=api test` pass 100% trên toàn bộ spec của module `sap`.
- `pnpm codegen` hoàn tất với exit code 0 và sinh đầy đủ hooks trong `apps/web/lib/api/generated/sap-queries/sap-queries.ts`.
