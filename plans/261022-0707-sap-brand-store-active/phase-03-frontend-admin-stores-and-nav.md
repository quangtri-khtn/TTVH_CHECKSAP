---
title: "Phase 3: Frontend Admin SAP Stores & Dynamic Monitor Nav"
status: todo
effort: 2.0h
dependencies: [2]
---

# Phase 3: Frontend Admin SAP Stores & Dynamic Monitor Nav

## 1. Tổng quan Giai đoạn (Overview)

Phase 3 hoàn thiện giao diện người dùng và trải nghiệm điều hành:
1. Bổ sung mục điều hướng **"Cửa hàng SAP"** (`/admin/sap-stores`) vào nhóm Quản trị của thanh Sidebar Navigation, bảo vệ bởi quyền `sap-store:manage`.
2. Xây dựng phân hệ Quản trị Cửa hàng SAP (`apps/web/features/admin/sap-stores/`) tuân thủ nghiêm ngặt chuẩn kiến trúc `CLAUDE.md`:
   - Tách biệt UI và Action: Side-effects (mutations, toast, query invalidation) đóng gói trong `use-sap-store-actions.ts`.
   - Pure Domain Logic: Tính toán chỉ số, lọc bộ nhớ, định dạng nhãn trong `lib/admin/sap-store-domain.ts` kèm unit test `.spec.ts`.
   - Cấu trúc bảng và các cột tách riêng `sap-stores-columns.tsx`, kiểm soát file component dưới 300 dòng.
   - Thao tác bật/tắt Active Bán/Trả bằng Switch UI với phản hồi tức thì (Optimistic updates / Loading state).
   - Nút "Đồng bộ từ SAP" mở hộp thoại xác nhận `sap-stores-sync-dialog.tsx` hiển thị tiến trình và kết quả.
3. Chuyển đổi dropdown Thương hiệu (Brand) trên cả hai màn hình **Monitor Bán hàng** (`/sap/monitor-ban`) và **Monitor Luồng Trả** (`/sap/monitor-tra`) sang nạp dữ liệu động từ backend qua hook `useSapBrandsGet()`, với cơ chế fallback an toàn về danh sách tĩnh nếu API chưa phản hồi.

---

## 2. Danh mục Tệp tin & Ký hiệu Mục tiêu (Target Files & Symbols)

| STT | Đường dẫn Tệp tin | Vị trí / Ký hiệu mục tiêu | Hành động | Mục đích |
|:---:|---|---|:---:|---|
| 1 | `apps/web/lib/auth/permission-keys.ts` | Dòng 1-13 (`PERMISSIONS`) | Sửa đổi | Bổ sung `SAP_STORE_MANAGE: 'sap-store:manage'` |
| 2 | `apps/web/lib/shell/sidebar-nav-data.ts` | Dòng 1-12 (lucide icons), 39-46 (`ADMIN_AREA_PERMISSIONS`), 102-143 (`NAV_GROUPS`) | Sửa đổi | Import icon `Store`, cấp quyền truy cập admin và thêm item Cửa hàng SAP |
| 3 | `apps/web/lib/shell/sidebar-nav-data.spec.ts` | File test | Sửa đổi | Cập nhật kiểm thử số lượng và quyền các mục menu Quản trị |
| 4 | `apps/web/lib/admin/sap-store-domain.ts` | File mới | Tạo mới | Pure domain logic: filter, badge mapping, metrics calculation |
| 5 | `apps/web/lib/admin/sap-store-domain.spec.ts` | File mới | Tạo mới | Unit test cho `sap-store-domain.ts` |
| 6 | `apps/web/features/admin/sap-stores/hooks/use-sap-store-actions.ts` | File mới | Tạo mới | Hook xử lý side-effects: toggle sales/return, sync SAP, toast thông báo |
| 7 | `apps/web/features/admin/sap-stores/components/sap-stores-metrics.tsx` | File mới | Tạo mới | 4 thẻ thống kê: Tổng kho, Active Bán, Active Trả, Thời điểm sync |
| 8 | `apps/web/features/admin/sap-stores/components/sap-stores-toolbar.tsx` | File mới | Tạo mới | Bộ lọc Brand, search kho, filter status và nút kích hoạt sync |
| 9 | `apps/web/features/admin/sap-stores/components/sap-stores-columns.tsx` | File mới | Tạo mới | Định nghĩa cột bảng TanStack Table: Switch toggle, status badge |
| 10 | `apps/web/features/admin/sap-stores/components/sap-stores-table.tsx` | File mới | Tạo mới | Component hiển thị bảng phân trang |
| 11 | `apps/web/features/admin/sap-stores/components/sap-stores-sync-dialog.tsx` | File mới | Tạo mới | Modal xác nhận đồng bộ dữ liệu từ SAP HANA |
| 12 | `apps/web/app/(portal)/admin/sap-stores/page.tsx` | File mới | Tạo mới | Page route mỏng bọc bởi `RequirePermission` |
| 13 | `apps/web/features/sap-monitor/components/sales-monitor-toolbar.tsx` | Dòng 43-81 (`SalesMonitorToolbar`) | Sửa đổi | Đọc danh sách Brand động từ backend kèm fallback tĩnh |
| 14 | `apps/web/features/sap-monitor/components/return-monitor-toolbar.tsx` | Dòng 34-80 (`ReturnMonitorToolbar`) | Sửa đổi | Đọc danh sách Brand động từ backend kèm fallback tĩnh |

---

## 3. Các Nhiệm vụ Triển khai Chi tiết (Implementation Tasks)

### Task 3.1: Bổ sung Quyền & Menu "Cửa hàng SAP" vào Sidebar Navigation

- **Mục tiêu**: Tích hợp quyền `sap-store:manage` và hiển thị mục menu "Cửa hàng SAP" trong danh mục Quản trị trên thanh sidebar bên trái.
- **Tệp tin mục tiêu**:
  - `apps/web/lib/auth/permission-keys.ts`
  - `apps/web/lib/shell/sidebar-nav-data.ts`
  - `apps/web/lib/shell/sidebar-nav-data.spec.ts`
- **Các bước thực hiện**:
  1. Trong `apps/web/lib/auth/permission-keys.ts`:
     - Thêm `SAP_STORE_MANAGE: 'sap-store:manage'` vào object `PERMISSIONS`.
  2. Trong `apps/web/lib/shell/sidebar-nav-data.ts`:
     - Import thêm icon `Store` từ `lucide-react`.
     - Bổ sung `PERMISSIONS.SAP_STORE_MANAGE` vào mảng `ADMIN_AREA_PERMISSIONS`.
     - Trong nhóm `title: 'Quản trị'`, thêm item sau mục `Kết nối SAP`:
       ```typescript
       {
         title: 'Cửa hàng SAP',
         href: '/admin/sap-stores',
         icon: Store,
         requiredPermissions: [PERMISSIONS.SAP_STORE_MANAGE],
       },
       ```
  3. Trong `apps/web/lib/shell/sidebar-nav-data.spec.ts`:
     - Cập nhật số lượng items trong nhóm Quản trị và kiểm tra item `/admin/sap-stores` chỉ hiển thị khi có quyền `sap-store:manage` hoặc vai trò `ADMIN`.
- **Tiêu chí thành công**:
  - Sidebar hiển thị icon `Store` và nhãn "Cửa hàng SAP" khi đăng nhập tài khoản Admin.
  - Người dùng không có quyền `sap-store:manage` không nhìn thấy menu này.
  - Toàn bộ test trong `sidebar-nav-data.spec.ts` pass 100%.
- **Xác minh cơ học**:
  - Chạy `pnpm --filter=web test sidebar-nav-data.spec.ts`.

---

### Task 3.2: Xây dựng Pure Domain & Schemas cho SAP Stores Frontend

- **Mục tiêu**: Viết các hàm logic tính toán thuần túy phục vụ giao diện (tính số liệu tóm tắt, lọc danh sách kho trong bộ nhớ, định dạng badge trạng thái).
- **Tệp tin mục tiêu**:
  - `apps/web/lib/admin/sap-store-domain.ts`
  - `apps/web/lib/admin/sap-store-domain.spec.ts`
- **Các bước thực hiện**:
  1. Tạo `sap-store-domain.ts`:
     - Định nghĩa kiểu: `SapStoreFilterState` gồm `brandCode`, `search`, `salesStatus`, `returnStatus`, `sapStatus`.
     - Hàm `calculateStoreMetrics(stores: SapStoreDto[])`:
       - `total`: Tổng số kho.
       - `activeSalesCount`: Số kho có `isActiveSales === true`.
       - `activeReturnCount`: Số kho có `isActiveReturn === true`.
       - `sapActiveCount`: Số kho có `sapInactive === false`.
       - `lastSyncedAt`: Thời điểm `syncedAt` mới nhất trong danh sách.
     - Hàm `filterStores(stores: SapStoreDto[], filters: SapStoreFilterState)`: Thực hiện lọc mảng kho theo search text (mã hoặc tên không dấu/có dấu), thương hiệu, trạng thái.
     - Hàm `formatSyncedAt(dateString?: string)`: Định dạng ngày giờ theo múi giờ Việt Nam.
  2. Tạo `sap-store-domain.spec.ts`:
     - Kiểm thử hàm `calculateStoreMetrics` với danh sách mock stores.
     - Kiểm thử hàm `filterStores` với các bộ lọc kết hợp.
- **Tiêu chí thành công**:
  - Hàm pure logic hoạt động chính xác không phụ thuộc vào React DOM.
  - 100% tests trong `sap-store-domain.spec.ts` vượt qua.
- **Xác minh cơ học**:
  - Chạy `pnpm --filter=web test sap-store-domain.spec.ts`.

---

### Task 3.3: Hook Quản lý Side-effects `use-sap-store-actions.ts`

- **Mục tiêu**: Đóng gói toàn bộ logic gọi mutation, xử lý phản hồi, hiển thị thông báo toast và vô hiệu hóa cache React Query.
- **Tệp tin mục tiêu**:
  - `apps/web/features/admin/sap-stores/hooks/use-sap-store-actions.ts`
- **Các bước thực hiện**:
  1. Tạo hook `useSapStoreActions()`:
     - Khởi tạo `queryClient = useQueryClient()`.
     - Sử dụng Orval hook `useSapStoreUpdate()`:
       - Hàm `toggleActiveSales(code: string, currentVal: boolean)`:
         - Gọi mutation với `{ isActiveSales: !currentVal }`.
         - Hiển thị toast.success khi thành công.
         - Invalidate queries `['/sap/stores']`.
       - Hàm `toggleActiveReturn(code: string, currentVal: boolean)`:
         - Gọi mutation với `{ isActiveReturn: !currentVal }`.
         - Hiển thị toast.success khi thành công.
         - Invalidate queries `['/sap/stores']`.
     - Sử dụng Orval hook `useSapStoresSync()`:
       - Hàm `syncStores()`:
         - Gọi mutation `POST /sap/stores/sync`.
         - Hiển thị toast.success: "Đồng bộ thành công X kho từ SAP HANA (Thêm mới Y, cập nhật Z)".
         - Invalidate queries `['/sap/stores']` và `['/sap/brands']`.
     - Quản lý trạng thái: `isUpdatingStore`, `updatingStoreCode`, `isSyncing`.
- **Tiêu chí thành công**:
  - Không có bất kỳ lệnh gọi mutation hoặc `queryClient.invalidateQueries` nào xuất hiện trong các component UI.
  - Xử lý lỗi đầy đủ qua `toast.error(error.message)`.
- **Xác minh cơ học**:
  - Kiểm tra file code tuân thủ pattern phân tách Action/UI trong `CLAUDE.md`.

---

### Task 3.4: Bộ Components Giao diện Quản trị Cửa hàng SAP

- **Mục tiêu**: Xây dựng các component UI chuyên biệt, tuân thủ shadcn/ui và Tailwind CSS, giữ mỗi file dưới 300 dòng.
- **Tệp tin mục tiêu**:
  - `apps/web/features/admin/sap-stores/components/sap-stores-metrics.tsx`
  - `apps/web/features/admin/sap-stores/components/sap-stores-toolbar.tsx`
  - `apps/web/features/admin/sap-stores/components/sap-stores-columns.tsx`
  - `apps/web/features/admin/sap-stores/components/sap-stores-table.tsx`
  - `apps/web/features/admin/sap-stores/components/sap-stores-sync-dialog.tsx`
- **Các bước thực hiện**:
  1. `sap-stores-metrics.tsx`:
     - Render 4 Card hiển thị: Tổng số cửa hàng, Kho Active Bán hàng, Kho Active Luồng trả, Lần đồng bộ gần nhất.
  2. `sap-stores-toolbar.tsx`:
     - Select Brand (lựa chọn 5001..5007 hoặc Tất cả).
     - Input Search mã/tên kho.
     - Select lọc trạng thái (Active Bán, Active Trả, SAP Inactive).
     - Button "Đồng bộ từ SAP" (màu primary, kèm icon `RefreshCw`, click mở Modal xác nhận).
  3. `sap-stores-columns.tsx`:
     - Cấu hình `ColumnDef<SapStoreDto>[]`:
       - Cột Mã kho (`code`): font-mono font-medium.
       - Cột Tên kho (`name`): hiển thị rõ ràng.
       - Cột Thương hiệu (`brand`): Badge hiển thị mã + tên thương hiệu.
       - Cột Trạng thái SAP: Badge màu xanh "Hoạt động" (`sapInactive === false`) hoặc màu xám/đỏ "Đã ngưng" (`sapInactive === true`).
       - Cột Active Bán hàng: Component `<Switch checked={row.isActiveSales} onCheckedChange={() => onToggleSales(row.code, row.isActiveSales)} disabled={isUpdating} />`.
       - Cột Active Luồng trả: Component `<Switch checked={row.isActiveReturn} onCheckedChange={() => onToggleReturn(row.code, row.isActiveReturn)} disabled={isUpdating} />`.
       - Cột Đồng bộ: Hiển thị thời gian định dạng tiếng Việt.
  4. `sap-stores-table.tsx`:
     - Nhận columns, data, loading, pagination. Render bảng với `shadcn/ui/table`.
  5. `sap-stores-sync-dialog.tsx`:
     - Hộp thoại cảnh báo xác nhận trước khi đồng bộ, giải thích rõ: "Quá trình đồng bộ sẽ nạp danh sách kho mới nhất từ SAP HANA OWHS. Các cấu hình Active Bán và Active Trả hiện tại sẽ được bảo lưu nguyên vẹn."
- **Tiêu chí thành công**:
  - Giao diện đồng bộ với phong cách thiết kế của portal (shadcn/ui).
  - Thao tác gạt Switch bật/tắt phản hồi mượt mà, disable nút trong lúc request đang gửi.
- **Xác minh cơ học**:
  - Kiểm tra số dòng code của từng file component đều nhỏ hơn 300 dòng.

---

### Task 3.5: Trang Quản trị `/admin/sap-stores/page.tsx`

- **Mục tiêu**: Ghép nối các components thành trang quản trị hoàn chỉnh dưới route `/admin/sap-stores`.
- **Tệp tin mục tiêu**:
  - `apps/web/app/(portal)/admin/sap-stores/page.tsx`
- **Các bước thực hiện**:
  1. Tạo `page.tsx`:
     - Khai báo `'use client'`.
     - Bọc nội dung bằng `<RequirePermission permission={PERMISSIONS.SAP_STORE_MANAGE}>`.
     - Sử dụng `AdminPageHeader` với tiêu đề "Quản lý Cửa hàng SAP", mô tả "Đồng bộ danh mục kho từ SAP HANA OWHS và cấu hình cửa hàng kích hoạt cho Monitor Bán hàng & Luồng trả".
     - Gọi query `useSapStoresGet({ query: { brandCode, search, ... } })`.
     - Gọi `useSapStoreActions()` để lấy các hàm mutation và dialog controls.
     - Render theo thứ tự: `AdminPageHeader` -> `SapStoresMetrics` -> `SapStoresToolbar` -> `SapStoresTable` -> `SapStoresSyncDialog`.
- **Tiêu chí thành công**:
  - Trang render nhanh, có skeleton/spinner khi đang tải dữ liệu ban đầu.
  - Khi người dùng không có quyền `sap-store:manage`, hiển thị thông báo từ chối truy cập chuẩn của portal.
- **Xác minh cơ học**:
  - `pnpm --filter=web check-types` không phát hiện lỗi type.

---

### Task 3.6: Chuyển đổi Dropdown Brand Động trên Màn hình Monitor Bán & Trả

- **Mục tiêu**: Thay thế danh sách thương hiệu tĩnh bằng dữ liệu động từ backend trên hai màn hình `/sap/monitor-ban` và `/sap/monitor-tra`.
- **Tệp tin mục tiêu**:
  - `apps/web/features/sap-monitor/components/sales-monitor-toolbar.tsx`
  - `apps/web/features/sap-monitor/components/return-monitor-toolbar.tsx`
- **Các bước thực hiện**:
  1. Trong `sales-monitor-toolbar.tsx`:
     - Gọi hook `useSapBrandsGet()` từ generated api (hoặc nhận qua props từ page).
     - Xây dựng mảng options động:
       ```typescript
       const brandOptions = useMemo(() => {
         if (!brandsData?.data?.length) return SALES_BRAND_OPTIONS;
         return brandsData.data.map((b) => ({
           value: b.code,
           label: `${b.code} — ${b.name}`,
         }));
       }, [brandsData]);
       ```
     - Cập nhật `<SelectContent>` để render theo `brandOptions`.
  2. Trong `return-monitor-toolbar.tsx`:
     - Thực hiện tương tự với `RETURN_BRAND_OPTIONS` làm fallback.
- **Tiêu chí thành công**:
  - Khi API phản hồi: Hiển thị đầy đủ các thương hiệu có trong cơ sở dữ liệu PostgreSQL.
  - Khi API bị lỗi hoặc đang tải: Không bị crash giao diện, hiển thị fallback an toàn 7 thương hiệu mặc định.
- **Xác minh cơ học**:
  - Kiểm tra component không ném runtime exception khi danh sách trả về rỗng.

---

## 4. Danh sách Kiểm tra Công việc (Todo List)

- [ ] Task 3.1: Thêm `SAP_STORE_MANAGE` vào `permission-keys.ts` và menu "Cửa hàng SAP" vào `sidebar-nav-data.ts`, cập nhật `sidebar-nav-data.spec.ts`.
- [ ] Task 3.2: Xây dựng `sap-store-domain.ts` và viết unit test `sap-store-domain.spec.ts`.
- [ ] Task 3.3: Xây dựng hook `use-sap-store-actions.ts` quản lý toàn bộ side-effects (toggle, sync, toast).
- [ ] Task 3.4: Xây dựng bộ components: `sap-stores-metrics.tsx`, `sap-stores-toolbar.tsx`, `sap-stores-columns.tsx`, `sap-stores-table.tsx`, `sap-stores-sync-dialog.tsx`.
- [ ] Task 3.5: Tạo trang quản trị `/admin/sap-stores/page.tsx` bọc bởi `RequirePermission`.
- [ ] Task 3.6: Nâng cấp dropdown chọn Brand trong `sales-monitor-toolbar.tsx` và `return-monitor-toolbar.tsx` sang đọc động từ `useSapBrandsGet()`.

---

## 5. Quy trình Ứng phó Sự cố (Failure Protocol)

1. **Sự cố: Lỗi "Rendered more hooks than during the previous render" khi dùng `useSapBrandsGet`**
   - *Triệu chứng*: Màn hình Monitor bị trắng và console báo lỗi React hook order violation.
   - *Nguyên nhân*: Đặt lệnh gọi hook `useSapBrandsGet` bên trong câu lệnh điều kiện `if` hoặc sau một lệnh return sớm.
   - *Xử lý*: Luôn đặt lệnh gọi hook ở đầu component hoặc bọc logic nạp brand vào custom hook điều phối chung (`use-sales-monitor-actions.ts`).
2. **Sự cố: Switch bị nhấp nháy hoặc tự bật lại trạng thái cũ sau khi bấm**
   - *Triệu chứng*: Người dùng gạt Switch sang bật, Switch nhảy về tắt rồi một lúc sau mới nhảy sang bật.
   - *Nguyên nhân*: Xung đột giữa local optimistic state và dữ liệu trả về từ React Query cache.
   - *Xử lý*: Sử dụng trực tiếp `row.isActiveSales` kết hợp `disabled={isUpdatingStore && updatingStoreCode === row.code}` để đảm bảo tính nhất quán của dữ liệu từ server.
3. **Sự cố: Menu Quản trị không hiển thị mục "Cửa hàng SAP" dù tài khoản là Admin**
   - *Triệu chứng*: Đăng nhập bằng `admin@example.com` nhưng trong nhóm Quản trị không thấy mục Cửa hàng SAP.
   - *Nguyên nhân*: Chưa cập nhật `ADMIN_AREA_PERMISSIONS` trong `sidebar-nav-data.ts` hoặc hàm lọc `getNavGroups` kiểm tra strict key không có wildcard.
   - *Xử lý*: Kiểm tra lại `ADMIN_AREA_PERMISSIONS` có chứa `PERMISSIONS.SAP_STORE_MANAGE`, và kiểm tra `hasAnyPermission` hỗ trợ quyền `*` của vai trò Admin.
