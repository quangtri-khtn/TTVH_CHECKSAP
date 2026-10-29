---
title: "Phase 4: Frontend 2-Tab Admin Query Studio (/admin/sap-queries)"
status: todo
priority: P1
effort: 2.0h
dependencies: [3]
---

# Phase 4: Frontend 2-Tab Admin Query Studio (/admin/sap-queries)

## Overview

Xây dựng giao diện Quản trị Câu Truy vấn SAP tại `/admin/sap-queries` theo đúng kiến trúc Frontend của dự án (tách riêng pure logic `lib/admin/sap-query-domain.ts`, action hook `use-sap-query-actions.ts`, và các UI component nhỏ gọn $\le 300$ dòng/file), tổ chức 25 câu query vào **2 Tab (Monitor Luồng Bán 13 câu · Monitor Luồng Trả 12 câu)** kèm khung soạn thảo Full SQL, nút **Review & Validate** hiển thị bảng đối chiếu cột bắt buộc/cột mới + 50 dòng preview, chức năng Xuất bản, Lịch sử/Diff/Hoàn tác và nút tắt `⚙ Quản lý SQL` trên 2 màn hình Monitor.

---

## Target Files & Symbols

| STT | Đường dẫn Tệp tin | Hành động | Mục đích |
|:---:|---|:---:|---|
| 1 | `apps/web/lib/admin/sap-query-domain.ts` | Create | Pure logic: phân nhóm 25 câu theo 2 Tab & 4 Stage, chuẩn hóa chuỗi SQL (`normalizeSqlText`), tạo bản SQL đã điền mẫu để copy sang HANA Studio, kiểm tra nhanh biến runtime ở client, tính diff dòng giữa 2 bản SQL |
| 2 | `apps/web/lib/admin/sap-query-domain.spec.ts` | Create | Unit test cho `sap-query-domain.ts` |
| 3 | `apps/web/features/admin/sap-queries/hooks/use-sap-query-actions.ts` | Create | Action hook bọc Orval mutations (`review`, `publish`, `rollback`, `resetDefault`), quản lý toast & invalidate cache (kể cả cache Monitor Bán/Trả) |
| 4 | `apps/web/features/admin/sap-queries/components/sap-queries-sidebar-list.tsx` | Create | Cột trái: 2 Tab (`Luồng Bán (13)` / `Luồng Trả (12)`), ô tìm nhanh, danh sách câu `#01..#25` chia theo nhóm kèm badge `vN` / chấm xanh `Đã sửa` |
| 5 | `apps/web/features/admin/sap-queries/components/sap-query-passport-header.tsx` | Create | Header thông tin câu đang chọn: tên nghiệp vụ, mô tả, badge "Nuôi vùng nào trên UI", chip biến runtime (`{d}`, `{br}`...) và danh sách Cột bắt buộc |
| 6 | `apps/web/features/admin/sap-queries/components/sap-query-sql-editor.tsx` | Create | Khung soạn thảo Full SQL (font mono, đếm ký tự/7800, nút Copy SQL gốc v1, Copy SQL điền mẫu, Xem Diff, Review & Validate, Khôi phục gốc, Lịch sử) |
| 7 | `apps/web/features/admin/sap-queries/components/sap-query-review-panel.tsx` | Create | Panel kết quả Review & Validate: trạng thái 4 bước kiểm tra tĩnh, bảng đối chiếu Cột gốc (`✓`/`✗`) + Cột mới (`+`) + cảnh báo trùng khóa `dedupKeys`, lưới preview 50 dòng (`SapDataGrid`), ô nhập `changeNote` và nút `Xuất bản` |
| 8 | `apps/web/features/admin/sap-queries/components/sap-query-history-sheet.tsx` | Create | Sheet xem lịch sử phiên bản, so sánh diff SQL trước/sau và nút `Hoàn tác về phiên bản này` |
| 9 | `apps/web/app/(monitor)/admin/sap-queries/page.tsx` | Create | Trang App Router mỏng `/admin/sap-queries` bọc `<RequirePermission permission={PERMISSIONS.SAP_QUERY_MANAGE}>` |
| 10 | `apps/web/features/sap-monitor/components/sales-monitor-toolbar.tsx` | Modify | Thêm nút tắt `⚙ Quản lý SQL` dẫn tới `/admin/sap-queries?flow=ban` cho user có quyền `sap-query:manage` |
| 11 | `apps/web/features/sap-monitor/components/return-monitor-toolbar.tsx` | Modify | Thêm nút tắt `⚙ Quản lý SQL` dẫn tới `/admin/sap-queries?flow=tra` cho user có quyền `sap-query:manage` |

---

## Requirements

- [x] **Tuân thủ tuyệt đối kiến trúc Frontend (`CLAUDE.md` & `.agent/projectRules/frontend-architecture.md`):**
  - Mọi file đặt tên `kebab-case`, giới hạn $\le 300$ dòng/file.
  - `page.tsx` chỉ đóng vai trò điều phối hiển thị, không gọi trực tiếp mutation kèm side-effect.
  - Dùng lại component `SapDataGrid` (`apps/web/features/sap-monitor/components/sap-data-grid.tsx`) để hiển thị 50 dòng dữ liệu chạy thử (Preview).
- [x] **Trải nghiệm 2 Tab × 25 Câu trực quan cho IT:**
  - Tab 1 (`Luồng Bán · 13 câu`): chia 2 nhóm *Nhóm 1A: Danh sách & Cảnh báo Treo (8 câu)* và *Nhóm 1B: Ghép Chuỗi PO & Phễu (5 câu)*.
  - Tab 2 (`Luồng Trả · 12 câu`): chia 2 nhóm *Nhóm 2A: Ghép Chuỗi Trả hàng & Từ điển Kho (7 câu)* và *Nhóm 2B: Tìm Chứng từ Nhóm Cũ (5 câu)*.
  - Nút **`📋 Copy SQL đã điền mẫu`** tự thay `{d}` $\rightarrow$ `'20261007'`, `{brand}` $\rightarrow$ `'5001'`, `{br}` $\rightarrow$ `JOIN maycha_live.OWHS W ON W."WhsCode" = P."U_Store" AND W."U_Brand" = '5001'`, `{po_filter}` $\rightarrow$ `P."CardCode" = '309019' AND P."CANCELED" = 'N' AND P."DocDate" >= '20261007'`, `{date_cond}` $\rightarrow$ `P."DocDate" >= '20261007'` (riêng 5 câu `ret_old_1..5` đã có sẵn `P."DocDate" < '{d}'` trong SQL gốc nên khi thay `{d}` sẽ ra đúng `P."DocDate" < '20261007'`). <!-- Updated: Red Team 2026-10-29 - đồng bộ cách điền mẫu cho ret_old_1..5 -->
- [x] **Cơ chế khóa an toàn nút `Xuất bản` trên UI:**
  - Dùng chung quy tắc chuẩn hóa `normalizeSqlText(s) = s.replace(/\r\n/g, '\n').trim()` giữa client và server (`computeSqlHash`). <!-- Updated: Red Team 2026-10-29 - đồng bộ chuẩn hóa CRLF/trim giữa client và server -->
  - Nút `Xuất bản` chỉ bật khi: (1) đã bấm `Review & Validate` và kết quả `valid === true`, (2) `normalizeSqlText(currentSql) === normalizeSqlText(lastReviewedSql)`, và (3) ô `Ghi chú thay đổi` (`changeNote`) có ít nhất 3 ký tự.

---

## Implementation Steps

1. **Xây dựng Pure Domain Logic (`apps/web/lib/admin/sap-query-domain.ts` + `.spec.ts`):**
   - Viết hàm `normalizeSqlText(sql: string): string`.
   - Viết hàm `groupQueriesByFlowAndStage(queries, flow, search)` trả về các nhóm con có tiêu đề tiếng Việt rõ ràng.
   - Viết hàm `buildSampleExecutableSql(sqlText, sampleDate, sampleBrand)` để phục vụ nút *"Copy SQL đã điền mẫu"*.
   - Viết hàm `computeLineDiff(originalSql, currentSql)` để tô màu dòng thêm/xóa khi xem Diff với bản gốc `v1` hoặc phiên bản trước.
   - Viết unit test trong `sap-query-domain.spec.ts`.
2. **Xây dựng Action Hook (`apps/web/features/admin/sap-queries/hooks/use-sap-query-actions.ts`):**
   - Đóng gói `useSapQueriesReview`, `useSapQueriesPublish`, `useSapQueriesRollback`, `useSapQueriesResetDefault`.
   - Sau khi `publish`, `rollback`, hoặc `resetDefault` thành công: hiển thị `toast.success(...)`, gọi `queryClient.invalidateQueries()` cho cả query list/detail lẫn `getSapSalesMonitorGetDataQueryKey()` và `getSapReturnMonitorGetDataQueryKey()`.
3. **Xây dựng 5 Component giao diện (`features/admin/sap-queries/components/*`) và trang `/admin/sap-queries/page.tsx`:**
   - Thiết kế bố cục Split-pane (cột trái rộng `320px` danh sách 25 câu theo 2 Tab; cột phải gồm Passport Header + SQL Editor + Review & Validate Panel + History Sheet).
   - Bổ sung nút `⚙ Quản lý SQL` trên `SalesMonitorToolbar` và `ReturnMonitorToolbar`.

---

## Todo

- [x] Task 4.1: Tạo `apps/web/lib/admin/sap-query-domain.ts` và `sap-query-domain.spec.ts`.
- [x] Task 4.2: Tạo `apps/web/features/admin/sap-queries/hooks/use-sap-query-actions.ts`.
- [x] Task 4.3: Tạo 5 component trong `apps/web/features/admin/sap-queries/components/` (`sap-queries-sidebar-list.tsx`, `sap-query-passport-header.tsx`, `sap-query-sql-editor.tsx`, `sap-query-review-panel.tsx`, `sap-query-history-sheet.tsx`).
- [x] Task 4.4: Tạo trang `apps/web/app/(monitor)/admin/sap-queries/page.tsx` và gắn nút tắt `⚙ Quản lý SQL` vào `sales-monitor-toolbar.tsx` & `return-monitor-toolbar.tsx`.
- [x] Task 4.5: Chạy `pnpm --filter=web test`, `pnpm --filter=web check-types` và `pnpm build` để xác minh toàn bộ hệ thống.

---

## Success Criteria

- Mọi file Frontend mới $\le 300$ dòng, không có lỗi ESLint hay TypeScript (`pnpm --filter=web check-types` và `pnpm build` pass 100%).
- `pnpm --filter=web test` và `pnpm --filter=api test` pass 100%.
