# Phase 2: Top Publish Bar, Tabbed Review Panel, History Sheet Rộng & Kiểm Định Build

## Context Links
- Master Plan: [`./plan.md`](./plan.md)
- Phase 1: [`./phase-01-workbench-sidebar-header-editor.md`](./phase-01-workbench-sidebar-header-editor.md)
- Báo cáo UI/UX Audit: [`../261029-0154-sap-query-admin-25-queries/reports/ui-ux-audit/ui-ux-audit-report.md`](../261029-0154-sap-query-admin-25-queries/reports/ui-ux-audit/ui-ux-audit-report.md)

## Overview
- **Priority**: P1 (Critical UX Overhaul)
- **Current Status**: Pending
- **Effort**: 1.5h
- **Dependencies**: Phase 1

## Key Tasks & Requirements

### Task 2.1: Tái cấu trúc `SapQueryReviewPanel` — Đưa Thanh Xuất Bản Lên Đầu & Chia 3 Tab Kết Quả (`apps/web/features/admin/sap-queries/components/sap-query-review-panel.tsx`)
- [x] **Đưa Thanh Điều Khiển Xuất Bản (Publish Control Bar) lên ngay đầu `SapQueryReviewPanel`** (ngay dưới tiêu đề khối Review, TRƯỚC các tab kết quả và bảng 50 dòng dữ liệu):
  - Ô nhập `Ghi chú thay đổi phiên bản` + Nút `Xuất bản phiên bản mới` nằm ngay tầm mắt sau khi bấm `Review & Validate`.
  - Thay thế hoàn toàn ký tự emoji `🔒` bằng icon SVG `<Lock className="size-3.5 shrink-0" />` của `lucide-react` (tuân thủ quy tắc `no-emoji-icons` của `ak-ui-ux-pro-max`).
- [x] Khi đã có `reviewResult`, hiển thị thanh tóm tắt 4 bước kiểm tra tĩnh gọn gàng (`1. Biến runtime`, `2. Chỉ SELECT`, `3. Schema hợp lệ`, `4. Độ dài OPENQUERY`) và chia phần chi tiết bên dưới thành **3 Tab (`Tabs` từ `@/components/ui/tabs`)** để trang không bị kéo dài `1.950px`:
  1. **Tab `contract` (`Hợp đồng Cột & Cảnh báo`)**: Hiển thị lỗi chặn (nếu có), cảnh báo `warnings` / `duplicateKeyCount`, và Bảng đối chiếu từng cột (`present`, `added`, `missing`, `removed`) với màu sắc phân biệt rõ ràng. Mặc định mở tab này khi có lỗi hoặc cảnh báo, hoặc sau khi vừa Review.
  2. **Tab `preview` (`Dữ liệu Chạy thử SAP · ${rowCount} dòng`)**: Hiển thị bảng `SapDataGrid` (tối đa 50 dòng đầu tiên) kèm thời gian thực thi `durationMs`.
  3. **Tab `diff` (`So sánh Diff với bản đang chạy`)**: Cho phép đối chiếu nhanh thay đổi SQL ngay trong khu vực Review (hoặc thông báo khớp 100%).
- [x] Đảm bảo file `<= 300` dòng.

### Task 2.2: Mở rộng & Sửa lỗi Đè Chữ trên `SapQueryHistorySheet` (`apps/web/features/admin/sap-queries/components/sap-query-history-sheet.tsx`)
- [x] Mở rộng `SheetContent` từ `sm:max-w-2xl` lên `sm:max-w-4xl` (`896px`) để danh sách phiên bản và khung Diff có không gian rộng rãi, không bị cắt ngang câu SQL.
- [x] Thêm `pr-8` vào `SheetHeader` (`sap-query-history-sheet.tsx:70`) để tiêu đề dài (`Lịch sử Phiên bản · #09 · Chuỗi PO — Đầu mục PO gốc (TTVH)`) không bao giờ đè lên nút đóng `X` ở góc trên bên phải.
- [x] Hiển thị cột số dòng (`01, 02...`) trong khung Diff lịch sử và nâng cỡ chữ/độ tương phản cho danh sách phiên bản & nhật ký kiểm toán.
- [x] Đảm bảo file `<= 300` dòng.

### Task 2.3: Kết nối `page.tsx` & Kiểm định Toàn Diện (`apps/web/app/(monitor)/admin/sap-queries/page.tsx`)
- [x] Cập nhật `apps/web/app/(monitor)/admin/sap-queries/page.tsx`:
  - Thu gọn phần tiêu đề đầu trang thành thanh Header Studio gọn sắc nét (kèm tổng số câu Đã tùy chỉnh / Bản gốc v1 và nút mở nhanh Lịch sử phiên bản đang chọn).
  - Truyền `onCopyToken={copySqlToClipboard}` vào `SapQueryPassportHeader` để bấm vào biến/cột trên Passport là copy ngay kèm toast hướng dẫn.
- [x] Kiểm tra mọi file trong `apps/web/features/admin/sap-queries/**`, `apps/web/lib/admin/sap-query-domain.ts`, và `apps/web/app/(monitor)/admin/sap-queries/page.tsx` đều **strictly `<= 300` dòng**.
- [x] Chạy đầy đủ bộ kiểm định:
  - `pnpm --filter=web test`
  - `pnpm --filter=web check-types`
  - `pnpm --filter=web lint`
  - `pnpm build`

## Acceptance Criteria
- [x] `pnpm --filter=web test` pass 100%.
- [x] `pnpm --filter=web check-types` và `pnpm --filter=web lint` pass (0 lỗi).
- [x] `pnpm build` thành công 100% cho toàn bộ monorepo.
- [x] Không có bất kỳ file component/hook/domain nào vượt quá `300` dòng.
