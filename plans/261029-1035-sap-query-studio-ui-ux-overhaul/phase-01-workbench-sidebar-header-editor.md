# Phase 1: Workbench Layout, Sidebar Phân Màu, Interactive Passport & SQL IDE Editor

## Context Links
- Master Plan: [`./plan.md`](./plan.md)
- Báo cáo UI/UX Audit: [`../261029-0154-sap-query-admin-25-queries/reports/ui-ux-audit/ui-ux-audit-report.md`](../261029-0154-sap-query-admin-25-queries/reports/ui-ux-audit/ui-ux-audit-report.md)
- Frontend Rules: [`../../CLAUDE.md`](../../CLAUDE.md)

## Overview
- **Priority**: P1 (Critical UX Overhaul)
- **Current Status**: Completed
- ** Effort**: 1.5h
- **Dependencies**: None

## Key Tasks & Requirements

### Task 1.1: Bổ sung Helper Phân Màu Nhóm & Tokenize SQL An Toàn (`apps/web/lib/admin/sap-query-domain.ts` & `.spec.ts`)
- [x] Giữ nguyên toàn bộ hàm hiện có (`normalizeSqlText`, `checkClientPlaceholders`, `buildSampleExecutableSql`, `estimateOpenQueryLength`, `computeLineDiff`, `canPublishQuery`, `groupQueriesByFlowAndStage`, `countQueriesByFlow`, `formatQueryOrderBadge`) để tương thích 100%.
- [x] Bổ sung hàm `getStageVisualMeta(stage: string)` trả về nhãn ngắn, màu viền trái (border accent), màu badge cho từng nhóm giai đoạn:
  - `ban_alert`: Nhóm 1A Cảnh báo & Danh sách (Tông Amber/Blue rõ nét)
  - `ban_chain`: Nhóm 1B Ghép chuỗi PO & Phễu (Tông Indigo/Violet)
  - `tra_main`: Nhóm 2A Truy vấn chính Luồng trả (Tông Blue/Cyan)
  - `tra_old`: Nhóm 2B Truy tìm PO đơn cũ (Tông Amber/Orange)
- [x] Bổ sung hàm pure `tokenizeSqlForHighlight(sqlText: string)` tách câu SQL theo từng dòng và từng token (`keyword` như `SELECT`, `FROM`, `INNER`, `LEFT`, `JOIN`, `ON`, `WHERE`, `AND`, `OR`, `GROUP`, `BY`, `ORDER`, `UNION`, `ALL`, `AS`, `IN`, `NOT`, `NULL`, `CASE`, `WHEN`, `THEN`, `ELSE`, `END`, `COUNT`, `SUM`, `MIN`, `MAX`, `COALESCE`, `TO_VARCHAR`, `CAST`, `DISTINCT`, `WITH`; `placeholder` như `{d}`, `{br}`, `{po_filter}`, `{brand}`, `{date_cond}`; `schema` như `maycha_live.`, `kbmd_live.`; `string` `'...'`; `identifier` `"..."`; `text` thường) để render bằng React JSX an toàn (không dùng `dangerouslySetInnerHTML`).
- [x] Bổ sung unit test trong `apps/web/lib/admin/sap-query-domain.spec.ts` kiểm tra `getStageVisualMeta` và `tokenizeSqlForHighlight`.
- [x] Đảm bảo `sap-query-domain.ts` `<= 300` dòng.

### Task 1.2: Nâng cấp `SapQueriesSidebarList` (`apps/web/features/admin/sap-queries/components/sap-queries-sidebar-list.tsx`)
- [x] Ghim cố định Sidebar trên màn hình lớn (`lg:sticky lg:top-4 lg:w-[340px]`) để khi cuộn khu vực bên phải thì danh sách 25 câu truy vấn vẫn luôn cố định trong tầm mắt.
- [x] Thêm hàng nút lọc nhanh theo Nhóm giai đoạn (`Tất cả` + các nhóm trong Tab hiện tại) ngay dưới ô tìm kiếm.
- [x] Thiết kế lại thẻ câu truy vấn trong danh sách:
  - Có thanh chỉ báo màu bên trái (`border-l-4`) theo nhóm giai đoạn hoặc trạng thái `Đã tùy chỉnh` (Emerald).
  - Tăng độ tương phản cho badge `#01`, mã `key`, phiên bản `v1` và tiêu đề câu truy vấn (không dùng chữ `10px` mờ nhạt trên nền xám gây lỗi `color-contrast` của `axe-core`).
  - Hiển thị thêm badge nhỏ `+Passthrough` cho các câu cho phép thêm cột phụ (`supportsExtraColumns`) để người dùng nhận diện ngay từ danh sách.
- [x] Đảm bảo file `<= 300` dòng.

### Task 1.3: Nâng cấp `SapQueryPassportHeader` Gọn, Sắc Nét & Tương Tác (`apps/web/features/admin/sap-queries/components/sap-query-passport-header.tsx`)
- [x] Thiết kế lại bố cục `Passport Header` gọn theo chiều dọc để ngay khi mở trang trên màn hình laptop, cả `Passport Header` VÀ `SapQuerySqlEditor` đều hiển thị ngay trong tầm mắt đầu tiên (Above-the-fold).
- [x] **Xóa bỏ giới hạn `max-h-20 overflow-y-auto`** đang làm cắt cụt danh sách **Hợp đồng Cột bắt buộc** ở câu `#09 chain_po` và `#14 ret_po` — hiển thị trọn vẹn tất cả chip cột bắt buộc.
- [x] Phân biệt rõ bằng màu sắc & icon:
  - Cột thuộc khóa khử trùng (`dedupKeys`) có icon `<KeyRound />` và viền Amber nổi bật.
  - Cột bắt buộc (`requiredColumns`) có viền Slate/Blue rõ nét; cột nội bộ (`internalCols`) có viền nét đứt kèm nhãn `(nội bộ)`.
  - Biến runtime bắt buộc (`allowedPlaceholders`) hiển thị trạng thái `✓ Đã có trong SQL` (Emerald) hoặc `✗ Đang thiếu` (Destructive).
- [x] Hỗ trợ tương tác **Click-to-copy** (thông qua prop optional `onCopyToken?: (token: string, label: string) => void`): khi người dùng bấm vào một biến `{br}`, `{po_filter}` hoặc một chip cột bắt buộc (`Store`, `PO Number`), tự động copy chuỗi chuẩn (`{br}` hoặc `"PO Number"`) để dán nhanh vào câu SQL!
- [x] Đảm bảo file `<= 300` dòng.

### Task 1.4: Nâng cấp `SapQuerySqlEditor` thành SQL IDE Editor Có Số Dòng & Highlight (`apps/web/features/admin/sap-queries/components/sap-query-sql-editor.tsx`)
- [x] Nâng cấp vùng soạn thảo SQL thành khung **SQL IDE Workbench**:
  - Có **Cột Số Dòng (Line Numbers Gutter `01, 02, ...`)** bên trái đồng bộ cuộn dọc (`onScroll`) với `<textarea>` hoặc chế độ xem/sửa trực quan.
  - Có thanh **Chuyển chế độ nhìn nhanh** hoặc **Khung xem SQL tô màu cú pháp & biến (`Highlighted SQL Preview` / `Split Code View`)** sử dụng `tokenizeSqlForHighlight(currentSql)` làm nổi bật từ khóa SQL (Blue/Indigo đậm), bảng `maycha_live.`/`kbmd_live.` (Teal/Emerald), chuỗi `'...'` (Amber), và đóng khung pill rực rỡ cho các biến `{d}`, `{br}`, `{po_filter}`, `{brand}`, `{date_cond}`!
  - Có **Thanh đo dung lượng OPENQUERY (`Progress Bar`)** trực quan hiển thị tỷ lệ `%` (`estimatedLength / 7.800`) đổi màu Xanh (`< 70%`) $\rightarrow$ Vàng (`70–90%`) $\rightarrow$ Đỏ (`> 90%`).
  - Nhóm lại thanh công cụ rõ ràng: Nhóm Tham số mẫu (`Ngày mẫu`, `Brand`), Nhóm Công cụ SQL (`Copy SQL gốc v1`, `Copy SQL đã điền mẫu`, `Xem Diff v1`, `Lịch sử`), và Nút chính nổi bật `Review & Validate`.
- [x] Đảm bảo file `<= 300` dòng.

## Acceptance Criteria
- [x] `pnpm --filter=web test -- sap-query-domain.spec.ts` pass 100%.
- [x] `pnpm --filter=web check-types` pass (0 lỗi).
- [x] Tất cả các file chỉnh sửa trong Phase 1 đều `<= 300` dòng.
