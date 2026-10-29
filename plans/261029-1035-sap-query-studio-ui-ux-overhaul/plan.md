---
title: "Đại tu UI/UX SQL Query Studio (/admin/sap-queries) — Split-Workbench, SQL IDE Editor & Tabbed Review"
description: "Khắc phục triệt để 5 điểm nghẽn UX-01..UX-05 từ báo cáo kiểm định thực tế: bố cục Split-Workbench không trôi, Sidebar phân màu nhóm, Passport không cắt cột hỗ trợ click-to-copy, SQL Editor có số dòng + tô màu cú pháp/biến + thanh tiến trình OPENQUERY, Thanh Xuất bản đặt ngay trên đầu kèm 3 Tab kết quả Review, và mở rộng Drawer Lịch sử."
status: completed
priority: P1
effort: 3.0h
branch: main
tags: [frontend, ui-ux, sap-queries, workbench, accessibility]
created: 2026-10-29
---

# Kế Hoạch Đại Tu UI/UX: SAP HANA Query Studio (`/admin/sap-queries`)

## 1. Nguồn gốc & Mục tiêu
Dựa trên báo cáo kiểm định thực nghiệm `plans/261029-0154-sap-query-admin-25-queries/reports/ui-ux-audit/ui-ux-audit-report.md` (chụp và đo đạc trực tiếp bằng `agent-browser` + `axe-core` + `ak-ui-ux-pro-max`), kế hoạch này giải quyết triệt để 5 vấn đề khiến người dùng thấy **"quá khó nhìn, quá khó quan sát, bị đơn điệu"**:

1. **UX-01 (Bố cục xếp chồng dọc `1.950px`)**: Mở trang lên không thấy nổi 1 dòng SQL; cuộn xuống xem kết quả Review thì Sidebar bên trái trôi mất.
2. **UX-02 (`<Textarea>` trắng trơn đơn điệu)**: Không có cột số dòng (Line Numbers), không tô màu từ khóa SQL hay các biến sống còn `{d}`, `{br}`, `{po_filter}`, không có thanh tiến trình dung lượng `OPENQUERY`.
3. **UX-03 (Đơn sắc xám & Chữ siêu nhỏ `10px` + Cắt cụt cột bắt buộc)**: 89 node chữ `< 12px`, 17 cảnh báo tương phản `axe-core`, 13 thẻ câu truy vấn bên trái xám giống hệt nhau, ô Hợp đồng Cột bắt buộc bị `max-h-20` cắt mất dòng thứ 3.
4. **UX-04 (Đứt mạch `Review` $\rightarrow$ `Xuất bản`)**: Ô nhập Ghi chú thay đổi và nút `Xuất bản phiên bản mới` nằm dưới đáy bảng 50 dòng dữ liệu (cách nút Review hơn `1.100px`), dùng emoji `🔒` thay vì icon SVG.
5. **UX-05 (Drawer Lịch sử hẹp & đè nút đóng `X`)**: `SheetHeader` thiếu `pr-8` làm tiêu đề đè lên nút `X`; `sm:max-w-2xl` quá hẹp khi chia 2 cột làm câu SQL trong Diff bị cắt ngang.

---

## 2. Danh sách Phase Thực Thi

| Phase | File chi tiết | Trọng tâm bàn giao | Ước lượng | Phụ thuộc | Trạng thái |
|---|---|---|---:|:---:|:---:|
| 1 | [Phase 1: Workbench Layout, Sidebar Phân Màu, Interactive Passport & SQL IDE Editor](./phase-01-workbench-sidebar-header-editor.md) | Domain helpers phân màu/tokenize SQL, Sidebar `sticky` có lọc nhanh theo Nhóm & dải màu ngữ nghĩa, Passport Header gọn hiển thị trọn vẹn cột bắt buộc + click-to-copy, SQL Editor có Gutter số dòng + Highlight SQL/biến + Thanh tiến trình OPENQUERY | 1.5h | Không có | Completed |
| 2 | [Phase 2: Top Publish Bar, Tabbed Review Panel, History Sheet Rộng & Kiểm Định Build](./phase-02-review-tabs-history-sheet-verify.md) | Đưa thanh Ghi chú & Xuất bản lên đầu `SapQueryReviewPanel`, chia kết quả Review thành 3 Tab (`Hợp đồng Cột & An toàn`, `Dữ liệu Preview 50 dòng`, `Diff v1`), mở rộng `SapQueryHistorySheet` (`sm:max-w-4xl`, `pr-8`), kết nối `page.tsx`, pass 100% test/typecheck/build | 1.5h | Phase 1 | Completed |

---

## 3. Ràng buộc Kiến trúc (`CLAUDE.md`)
- Mọi file component/hook trong `apps/web/` **BẮT BUỘC `<= 300` dòng**.
- Không dùng emoji làm icon (dùng `lucide-react` SVG).
- Cỡ chữ nội dung/badge tối thiểu đạt độ tương phản WCAG AA (`axe-core` `color-contrast` = 0 lỗi).
