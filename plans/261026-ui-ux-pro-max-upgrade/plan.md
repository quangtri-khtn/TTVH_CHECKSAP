# Implementation Plan: Nâng Cấp Toàn Diện UI/UX, Design System & Motion (`ttvh-sap-monitor`)

- **Status:** Validated & Approved
- **Date:** 2026-10-26
- **Branch:** `feat/ui-ux-pro-max-upgrade`
- **Target Repo:** `D:/work/maycha/ttvh-sap-monitor`
- **Ship Mode:** `--both` (Beta + Official Stable)

## 1. Mục tiêu & Tiêu chuẩn nghiệm thu (Acceptance Criteria)
1. **Gói 1 — Brand Assets, Typography Tiếng Việt & Design System Tokens:**
   - Copy `public/brand/logo-mark.png` và `public/brand/logo.webp` từ `thinh-the-vinh-hoa-portal` sang `ttvh-sap-monitor/apps/web/public/brand/`.
   - Cấu hình `apps/web/app/layout.tsx` với bộ 3 font chuẩn tiếng Việt: `Inter` (`--font-sans`), `Lexend` (`--font-display`), `JetBrains_Mono` (`--font-mono`), `lang="vi"`, `suppressHydrationWarning`, title **"Thịnh Thế Vinh Hoa — SAP Monitor"**.
   - Bọc `ThemeProvider` (`next-themes`) trong `apps/web/app/providers.tsx`.
   - Nâng cấp `apps/web/app/globals.css`: tích hợp đầy đủ bộ màu OKLCH có sắc độ Enterprise Blue/Amber, 19 semantic status variables (`--status-success*`, `--status-info*`, `--status-warning*`, `--status-danger*`, `--status-neutral*`, `--ok*`, `--soon*`), elevation `--e1..e3`, `@keyframes pulse-dot`, hỗ trợ cả Light Mode và Dark Mode (OLED).
2. **Gói 2 — Màn hình Login Split-Screen Showcase & Executive App Shell:**
   - Nâng cấp `apps/web/app/(auth)/layout.tsx`: Split-Screen 2 cột với hiệu ứng ambient lighting, grid pattern, logo `/brand/logo-mark.png` và 3 trụ cột nghiệp vụ SAP Monitor.
   - Nâng cấp `apps/web/features/auth/components/login-form.tsx`: thẻ kính mờ (`backdrop-blur-xl`), dải gradient đỉnh, nút ẩn/hiện mật khẩu (`Eye`/`EyeOff`), micro-interaction khi submit.
   - Tạo `apps/web/features/shell/components/theme-switch.tsx` và nâng cấp `apps/web/app/(monitor)/layout.tsx`: tích hợp logo thật `/brand/logo-mark.png`, chỉ báo trực tuyến `HANA_MC LIVE` (`pulse-dot`), nút `ThemeSwitch` (Sáng/Tối/Hệ thống), thanh tab ngang có hiệu ứng chuyển động mượt và hiệu ứng shadow/blur khi cuộn.
3. **Gói 3 — Nâng cấp UI/UX, Hierarchy & Motion cho `/sap/monitor-ban` và `/sap/monitor-tra`:**
   - **Status Bar KPI Cards (`sales-monitor-status-bar.tsx`, `return-monitor-status-bar.tsx`):** Bổ sung dải màu đỉnh (top accent bar) + icon ngữ nghĩa theo trạng thái (`AlertTriangle`/`CheckCircle2`/`Clock`/`Archive`), font `font-heading tabular-nums`, hiệu ứng `hover:-translate-y-0.5 hover:shadow-md transition-all duration-200`.
   - **Conversion Funnel Table (`sales-conversion-funnel-table.tsx`, `return-conversion-funnel-table.tsx`):** Bổ sung thanh tiến độ trực quan (**Visual Progress Bar** chuyển động mượt `transition-all duration-500 ease-out`) dưới cột Tỷ lệ (%), hiệu ứng hover/selected rõ nét.
   - **Doc Status / Chain Status / DataGrid & Pages:** Bổ sung hiệu ứng `animate-in fade-in slide-in-from-top-2 duration-200` khi đóng/mở bảng chứng từ treo, header trang có mô tả nghiệp vụ và badge kiến trúc dữ liệu, đảm bảo mọi file `< 300` dòng.
4. **Gói 4 — Sửa lỗi `/admin/users` & Kiểm định:**
   - Sửa `apps/web/app/(monitor)/admin/users/page.tsx`: đổi `FETCH_LIMIT = 100` và bỏ `includeInactive: true` để tránh lỗi `400 Bad Request` từ `ValidationPipe` (`forbidNonWhitelisted: true`).
   - Toàn bộ test (`pnpm test`), kiểm tra kiểu (`pnpm check-types`), và build (`pnpm build`) đạt 100%.
   - Kiểm tra trực quan bằng `agent-browser` trên cả 5 màn hình (Light & Dark mode).
