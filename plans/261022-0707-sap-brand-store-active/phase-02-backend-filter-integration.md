---
title: "Phase 2: Backend Filter Integration & Excel Alignment"
status: todo
effort: 1.5h
dependencies: [1]
---

# Phase 2: Backend Filter Integration & Excel Alignment

## 1. Tổng quan Giai đoạn (Overview)

Phase 2 là giai đoạn quyết định về mặt nghiệp vụ tính toán:
1. Tích hợp bộ lọc cửa hàng active (`activeSalesStoreCodes` và `activeReturnStoreCodes`) vào hai dịch vụ điều phối trung tâm:
   - `SapSalesMonitorService` (Màn hình Monitor Bán hàng)
   - `SapReturnMonitorService` (Màn hình Monitor Luồng trả)
2. Áp dụng cơ chế **Lọc an toàn trong bộ nhớ (In-Memory Set Filtering)**:
   - Truy vấn SAP HANA giữ nguyên câu lệnh `W."U_Brand" = '{brand}'` (không truyền danh sách mã kho vào SQL `OPENQUERY` để bảo vệ trần 8000 ký tự).
   - Lọc dữ liệu thô ngay sau khi nhận từ SAP trước khi đưa vào các hàm Pure Domain Logic (`assemblePoChain`, `buildDocStatus`, `buildConversionFunnel`, `buildReturnFunnel`,...).
3. Triển khai **Safe Fallback Guard**: Nếu thương hiệu chưa được cấu hình kho active nào (`Set.size === 0`), giữ nguyên toàn bộ dữ liệu kèm log cảnh báo, không làm trắng màn hình.
4. Đảm bảo tính nhất quán 100% của hai dịch vụ xuất Excel (`SapSalesMonitorExcelService` và `SapReturnMonitorExcelService`).
5. Cập nhật bộ unit test backend và chạy quy trình `pnpm codegen` để tự động sinh OpenAPI spec và Orval client phục vụ cho Phase 3.

---

## 2. Danh mục Tệp tin & Ký hiệu Mục tiêu (Target Files & Symbols)

| STT | Đường dẫn Tệp tin | Vị trí / Ký hiệu mục tiêu | Hành động | Mục đích |
|:---:|---|---|:---:|---|
| 1 | `apps/api/src/modules/sap/services/sap-sales-monitor.service.ts` | Dòng 61-70 (constructor), 154-275 (`executeFetch`) | Sửa đổi | Inject `SapStoreService`, nạp Set active sales stores, lọc `chainRows` và `listResults` |
| 2 | `apps/api/src/modules/sap/services/sap-return-monitor.service.ts` | Dòng 60-68 (constructor), 152-271 (`executeFetch`) | Sửa đổi | Inject `SapStoreService`, nạp Set active return stores, lọc `chainRows`, `arRows`, `grpoRows` |
| 3 | `apps/api/src/modules/sap/services/sap-sales-monitor-excel.service.ts` | Dòng 45-65 (`exportDetailWorkbook`, `exportGridWorkbook`) | Xác nhận & Tinh chỉnh | Bảo đảm dữ liệu xuất Excel khớp 100% với dữ liệu hiển thị đã lọc |
| 4 | `apps/api/src/modules/sap/services/sap-return-monitor-excel.service.ts` | Dòng 45-65 (`exportDetailWorkbook`, `exportGridWorkbook`) | Xác nhận & Tinh chỉnh | Bảo đảm dữ liệu xuất Excel luồng trả khớp 100% với dữ liệu hiển thị đã lọc |
| 5 | `apps/api/src/modules/sap/services/sap-sales-monitor.service.spec.ts` | File test | Sửa đổi / Bổ sung | Mock `SapStoreService`, kiểm thử các kịch bản lọc và fallback rỗng |
| 6 | `apps/api/src/modules/sap/services/sap-return-monitor.service.spec.ts` | File test | Sửa đổi / Bổ sung | Mock `SapStoreService`, kiểm thử các kịch bản lọc luồng trả và fallback rỗng |
| 7 | `apps/api/scripts/generate-openapi.ts` | Toàn bộ file | Thực thi | Sinh lại OpenAPI schema chứa các endpoints SAP Brands & Stores |
| 8 | `apps/web/lib/api/generated/` | Toàn bộ thư mục Orval | Tự động sinh | Chứa các hooks Orval mới cho frontend |

---

## 3. Các Nhiệm vụ Triển khai Chi tiết (Implementation Tasks)

### Task 2.1: Tích hợp Active Sales Stores Filter vào SapSalesMonitorService

- **Mục tiêu**: Lọc dữ liệu Monitor Bán hàng theo danh sách các kho có `isActiveSales = true` thuộc thương hiệu được chọn.
- **Tệp tin mục tiêu**:
  - `apps/api/src/modules/sap/services/sap-sales-monitor.service.ts`
- **Các bước thực hiện**:
  1. Inject `SapStoreService` vào `SapSalesMonitorService` qua constructor:
     ```typescript
     constructor(
       private readonly gateway: SapQueryGatewayService,
       private readonly storeService: SapStoreService,
     ) {}
     ```
  2. Trong hàm `executeFetch(dateFrom: string, brand: string)`:
     - Trước hoặc song song với các truy vấn SAP, gọi lấy danh sách active stores:
       ```typescript
       const activeStoreCodes = await this.storeService.getActiveStoreCodes(brand, 'sales');
       ```
     - Sau **Bước 3** (khi đã nhận đủ `rawListResults` và `chainResults` từ SAP):
       ```typescript
       const shouldFilter = activeStoreCodes.size > 0;
       if (!shouldFilter) {
         this.logger.warn(
           `[SapSalesMonitorService] Brand ${brand} has no active sales stores configured. Falling back to all stores.`,
         );
       }
       ```
     - Lọc danh sách `rawListResults` nếu `shouldFilter = true`:
       - Mỗi kết quả `rawListResults[key]` (với key thuộc `t1`, `t2`, `t3`, `t4`, `ar`, `grpo`, `ap`, `funnel`): tìm chỉ số cột `"Store"`, lọc bỏ các dòng có mã kho không thuộc `activeStoreCodes`.
     - Lọc danh sách chuỗi chứng từ:
       - Sau khi `assemblePoChain(chainResults, dateFrom, today)` tạo ra `chainRows`, lọc:
         ```typescript
         const filteredChainRows = shouldFilter
           ? chainRows.filter((r) => activeStoreCodes.has(String(r['Store'] ?? '')))
           : chainRows;
         ```
       - Dùng `filteredChainRows` để lọc tiếp `chainAr` và `chainGrpo`:
         ```typescript
         const { chainAr, chainGrpo } = buildChainArAndGrpo(chainResults, filteredChainRows);
         ```
     - Toàn bộ các bước tiếp theo (tính `buildDocStatus`, `buildConversionFunnel`, `buildMonitorOverview`, `buildStatusSummary`, chia nhóm Mới/Cũ/Tất cả) sẽ nhận `filteredChainRows` và các danh sách đã được lọc.
- **Tiêu chí thành công**:
  - Khi có cấu hình active stores: Số lượng PO và các dòng dữ liệu chỉ tương ứng với các kho trong `activeStoreCodes`.
  - Khi `activeStoreCodes.size === 0`: Không lọc dòng nào, giữ nguyên toàn bộ dữ liệu, ghi log cảnh báo an toàn.
- **Xác minh cơ học**:
  - Kiểm tra log chạy với brand test xác nhận có thông báo fallback nếu chưa cấu hình.

---

### Task 2.2: Tích hợp Active Return Stores Filter vào SapReturnMonitorService

- **Mục tiêu**: Lọc dữ liệu Monitor Luồng Trả theo danh sách các kho có `isActiveReturn = true` thuộc thương hiệu được chọn.
- **Tệp tin mục tiêu**:
  - `apps/api/src/modules/sap/services/sap-return-monitor.service.ts`
- **Các bước thực hiện**:
  1. Inject `SapStoreService` vào `SapReturnMonitorService` qua constructor:
     ```typescript
     constructor(
       private readonly gateway: SapQueryGatewayService,
       private readonly storeService: SapStoreService,
     ) {}
     ```
  2. Trong hàm `executeFetch(dateFrom: string, brand: string)`:
     - Lấy danh sách active stores cho luồng trả:
       ```typescript
       const activeStoreCodes = await this.storeService.getActiveStoreCodes(brand, 'return');
       const shouldFilter = activeStoreCodes.size > 0;
       if (!shouldFilter) {
         this.logger.warn(
           `[SapReturnMonitorService] Brand ${brand} has no active return stores configured. Falling back to all stores.`,
         );
       }
       ```
     - Sau **Bước 4** (khi đã nhận đủ `results` từ SAP và chạy xong các batch old PO):
       - Gọi `assembleReturnChain(results, dateFrom, today)` để thu về `chainRows`, `arRows`, `grpoRows`.
       - Thực hiện lọc nếu `shouldFilter = true`:
         ```typescript
         const filteredChainRows = shouldFilter
           ? chainRows.filter((r) => activeStoreCodes.has(String(r.Store ?? '')))
           : chainRows;
         const filteredArRows = shouldFilter
           ? arRows.filter((r) => activeStoreCodes.has(String(r.Store ?? '')))
           : arRows;
         const filteredGrpoRows = shouldFilter
           ? grpoRows.filter((r) => activeStoreCodes.has(String(r.Store ?? '')))
           : grpoRows;
         ```
       - Đưa các mảng đã lọc vào tính toán tiếp:
         ```typescript
         const arNoInvRows = buildReturnArNoInv(filteredChainRows, filteredArRows, today);
         // Tính toán funnel và statusCounts cho moi, cu, tatCa bằng filteredChainRows, filteredArRows, filteredGrpoRows
         ```
- **Tiêu chí thành công**:
  - Các chỉ số Phễu luồng trả (Return Funnel), Đếm trạng thái chứng từ (Status Counts) và danh sách chứng từ treo (AR No Invoice) chỉ phản ánh các kho active.
  - Hoạt động ổn định với fallback an toàn khi `activeStoreCodes.size === 0`.
- **Xác minh cơ học**:
  - Rà soát code đảm bảo không có dòng dữ liệu nào của kho ngoài Set lọt vào `filteredChainRows`.

---

### Task 2.3: Đồng bộ và Kiểm tra Tính Nhất Quán của Excel Export Services

- **Mục tiêu**: Khẳng định 100% dữ liệu xuất file Excel (bản chi tiết 11 sheets và bản lưới đang xem) đồng bộ hoàn toàn với dữ liệu trên màn hình sau khi lọc.
- **Tệp tin mục tiêu**:
  - `apps/api/src/modules/sap/services/sap-sales-monitor-excel.service.ts`
  - `apps/api/src/modules/sap/services/sap-return-monitor-excel.service.ts`
- **Các bước thực hiện**:
  1. Kiểm tra luồng gọi dữ liệu trong `SapSalesMonitorExcelService`:
     - Phương thức `exportDetailWorkbook` gọi `this.salesMonitorService.getSalesMonitor(...)`. Vì `SapSalesMonitorService` đã được tích hợp bộ lọc, đối tượng `SalesMonitorDataDto` trả về đã là dữ liệu đã lọc.
     - Phương thức `exportGridWorkbook` cũng đọc từ `data.lists[viewKey]` hoặc `data.lists.chain`, do đó cũng tự động được lọc.
  2. Kiểm tra luồng gọi dữ liệu trong `SapReturnMonitorExcelService`:
     - Phương thức `exportDetailWorkbook` gọi `this.returnMonitorService.getReturnMonitor(...)`.
     - Phương thức `exportGridWorkbook` đọc từ `data.lists.chain` hoặc `data.lists.arNoInv`. Cả hai đều đã được lọc chính xác.
  3. Bổ sung ghi chú thông tin số lượng kho active vào sheet Overview nếu cần thiết để báo cáo rõ ràng hơn cho người dùng.
- **Tiêu chí thành công**:
  - File Excel xuất ra từ API không chứa bất kỳ dòng dữ liệu nào thuộc về các kho bị vô hiệu hóa (`isActive = false`).
- **Xác minh cơ học**:
  - Unit test kiểm tra độ dài các dòng xuất Excel khớp với số dòng sau khi lọc.

---

### Task 2.4: Cập nhật Unit Test cho SapSalesMonitorService & SapReturnMonitorService

- **Mục tiêu**: Viết các kịch bản kiểm thử tự động xác nhận tính chính xác của bộ lọc in-memory và tính an toàn của fallback.
- **Tệp tin mục tiêu**:
  - `apps/api/src/modules/sap/services/sap-sales-monitor.service.spec.ts`
  - `apps/api/src/modules/sap/services/sap-return-monitor.service.spec.ts`
- **Các bước thực hiện**:
  1. Trong `sap-sales-monitor.service.spec.ts`:
     - Mock `SapStoreService.getActiveStoreCodes`:
       - *Kịch bản 1 (Có lọc)*: Trả về `new Set(['MC001', 'MC002'])`. Giả lập SAP trả về dữ liệu của 3 kho (`MC001`, `MC002`, `MC999`). Xác nhận kết quả trả về `cohorts.tatCa.poCount` chỉ đếm 2 kho, `lists.chain.rows` không có dòng nào của `MC999`.
       - *Kịch bản 2 (Fallback rỗng)*: Trả về `new Set()`. Xác nhận toàn bộ 3 kho đều được giữ lại, log ra cảnh báo.
  2. Trong `sap-return-monitor.service.spec.ts`:
     - Mock `SapStoreService.getActiveStoreCodes`:
       - *Kịch bản 1 (Có lọc)*: Trả về `new Set(['MC073', 'BB013'])`. Giả lập SAP trả về các dòng kho `MC073`, `BB013` và `MC999`. Xác nhận `chainRows` và `arNoInv` chỉ chứa 2 kho hợp lệ.
       - *Kịch bản 2 (Fallback rỗng)*: Trả về `new Set()`. Xác nhận toàn bộ kho được giữ lại.
- **Tiêu chí thành công**:
  - 100% assertions trong 2 file spec đều pass.
- **Xác minh cơ học**:
  - Chạy `pnpm --filter=api test sales-monitor` và `pnpm --filter=api test return-monitor`.

---

### Task 2.5: Chạy Codegen Sinh OpenAPI JSON & Orval Client Frontend

- **Mục tiêu**: Xuất bản contract API mới từ backend (gồm 4 endpoints SAP Brands & Stores) và sinh tự động React Query hooks cho frontend.
- **Tệp tin mục tiêu**:
  - `apps/api/scripts/generate-openapi.ts`
  - `apps/web/lib/api/generated/`
- **Các bước thực hiện**:
  1. Chạy script sinh OpenAPI spec JSON từ backend NestJS:
     ```bash
     pnpm --filter=api openapi:generate
     ```
  2. Chạy Orval ở frontend Next.js:
     ```bash
     pnpm --filter=web codegen:web
     ```
     (Hoặc chạy lệnh tổng hợp từ root: `pnpm codegen`).
  3. Kiểm tra các hooks mới được sinh trong `apps/web/lib/api/generated/`:
     - `useSapBrandsGet`: Lấy danh mục thương hiệu
     - `useSapStoresGet`: Lấy danh sách cửa hàng kèm bộ lọc
     - `useSapStoreUpdate`: Cập nhật trạng thái active store
     - `useSapStoresSync`: Kích hoạt đồng bộ từ SAP HANA
- **Tiêu chí thành công**:
  - File model TypeScript trong `apps/web/lib/api/generated/model/` chứa các kiểu DTO tương ứng (`SapBrandDto`, `SapStoreDto`, `UpdateSapStoreDto`, `SyncSapStoresResultDto`).
  - Không có cảnh báo lỗi cú pháp hoặc thiếu type.
- **Xác minh cơ học**:
  - Kiểm tra sự xuất hiện của các file sinh trong `apps/web/lib/api/generated/`.

---

## 4. Danh sách Kiểm tra Công việc (Todo List)

- [ ] Task 2.1: Inject `SapStoreService` vào `SapSalesMonitorService`, áp dụng bộ lọc `activeSalesStoreCodes` và safe fallback guard.
- [ ] Task 2.2: Inject `SapStoreService` vào `SapReturnMonitorService`, áp dụng bộ lọc `activeReturnStoreCodes` và safe fallback guard.
- [ ] Task 2.3: Kiểm tra và xác nhận tính nhất quán 100% của `SapSalesMonitorExcelService` và `SapReturnMonitorExcelService`.
- [ ] Task 2.4: Bổ sung unit tests cho `SapSalesMonitorService` và `SapReturnMonitorService` kiểm chứng các kịch bản lọc và fallback.
- [ ] Task 2.5: Chạy `pnpm codegen` để sinh OpenAPI JSON và Orval hooks cho frontend.

---

## 5. Quy trình Ứng phó Sự cố (Failure Protocol)

1. **Sự cố: Lệch số liệu giữa danh sách chuỗi (`chainRows`) và danh sách tổng quan (`overviewTable`)**
   - *Triệu chứng*: Bảng tổng quan hiển thị 100 PO nhưng bảng chi tiết chỉ có 80 PO.
   - *Nguyên nhân*: Bảng `overviewTable` được xây dựng từ `listResults` chưa được lọc qua cùng tập `activeStoreCodes`.
   - *Xử lý*: Phải lọc đồng thời cả `rawListResults` (từng danh sách t1..t4, ar, grpo, ap, funnel) và `chainResults`/`chainRows` bằng cùng một đối tượng `activeStoreCodes`.
2. **Sự cố: Codegen Orval thất bại hoặc không sinh ra hook mong muốn**
   - *Triệu chứng*: Lệnh `pnpm codegen` ném lỗi phân tích cú pháp OpenAPI JSON hoặc không tìm thấy file output.
   - *Nguyên nhân*: Thiếu decorator `@ApiOperation({ operationId: '...' })` hoặc `@ApiOkResponse({ type: ... })` trên các controller methods của `SapStoresController`.
   - *Xử lý*: Kiểm tra lại `SapStoresController` đảm bảo mỗi endpoint đều có `operationId` tường minh dạng camelCase (vd: `sapBrandsGet`, `sapStoresGet`, `sapStoreUpdate`, `sapStoresSync`) và DTO có `@ApiProperty()`.
3. **Sự cố: Tràn bộ nhớ khi thực hiện lọc In-Memory trên mảng lớn**
   - *Triệu chứng*: Tiến trình Node.js tăng dung lượng RAM đột biến hoặc CPU bị nghẽn trong vòng lặp lọc.
   - *Nguyên nhân*: Sử dụng `Array.indexOf` hoặc `Array.includes` bên trong hàm `filter` dẫn đến độ phức tạp $O(N \times M)$.
   - *Xử lý*: Bắt buộc chuyển danh sách mã kho sang cấu trúc `Set<string>` để thao tác `has()` luôn đạt $O(1)$.
