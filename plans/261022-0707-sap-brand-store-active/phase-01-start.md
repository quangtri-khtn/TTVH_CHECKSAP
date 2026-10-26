---
title: "Phase 1: Start - Schema, Seed, Sync API & Unit Tests"
status: todo
effort: 2.0h
dependencies: []
---

# Phase 1: Start - Schema, Seed, Sync API & Unit Tests

## 1. Tổng quan Giai đoạn (Overview)

Phase 1 đặt nền móng toàn diện cho phân hệ Quản lý Thương hiệu và Cửa hàng SAP:
1. Thiết lập 2 bảng dữ liệu cốt lõi trong PostgreSQL: `sap_brands` và `sap_stores` qua Prisma Migration.
2. Cập nhật hệ thống phân quyền: Bổ sung quyền `sap-store:manage` vào Permission Catalog của phân hệ Master Board.
3. Khởi tạo dữ liệu mẫu (Seed): Cung cấp sẵn 7 thương hiệu chính (`5001` đến `5007`) và 26 kho pilot ban đầu (`RETURN_PILOT_STORES`).
4. Xây dựng tầng Service & Controller:
   - `SapBrandService`: Cung cấp danh mục thương hiệu cho các màn hình Monitor và Admin.
   - `SapStoreService`: Cung cấp danh sách kho có phân trang và bộ lọc, cập nhật bật/tắt Active Bán/Trả, đồng bộ tự động từ bảng `maycha_live.OWHS` của SAP HANA, và trích xuất danh sách active store codes dạng `Set<string>`.
   - `SapStoresController`: Expose 4 endpoints REST chuẩn Swagger với `operationId` rõ ràng.
5. Viết bộ Unit Test độc lập kiểm chứng logic đồng bộ, cập nhật flag và trích xuất Set.

---

## 2. Danh mục Tệp tin & Ký hiệu Mục tiêu (Target Files & Symbols)

| STT | Đường dẫn Tệp tin | Vị trí / Ký hiệu mục tiêu | Hành động | Mục đích |
|:---:|---|---|:---:|---|
| 1 | `apps/api/prisma/schema.prisma` | Dòng 156-171 (`SapConnection`) | Sửa đổi | Bổ sung 2 model `SapBrand` và `SapStore` kèm indexes |
| 2 | `apps/api/src/modules/access-control/permission-catalog.ts` | Dòng 47-56 (`PERMISSION_CATALOG`), 68-70 (`PERMISSIONS`), 80-82 | Sửa đổi | Thêm quyền `sap-store:manage` |
| 3 | `apps/api/src/modules/access-control/role-permissions.ts` | Dòng 14-20 (`ROLE_PERMISSIONS`) | Xác nhận | Đảm bảo `Role.ADMIN` thừa hưởng `['*']` |
| 4 | `apps/api/scripts/seed.ts` | Dòng 20-25, 60-118 (`seed()`) | Sửa đổi | Seed 7 brands và 26 pilot stores từ `sap-constants.ts` |
| 5 | `apps/api/src/modules/sap/dto/sap-brand.dto.ts` | File mới | Tạo mới | DTO hiển thị danh sách thương hiệu |
| 6 | `apps/api/src/modules/sap/dto/sap-store.dto.ts` | File mới | Tạo mới | DTO hiển thị danh sách cửa hàng kèm quan hệ brand |
| 7 | `apps/api/src/modules/sap/dto/update-sap-store.dto.ts` | File mới | Tạo mới | DTO cập nhật trạng thái `isActiveSales` và `isActiveReturn` |
| 8 | `apps/api/src/modules/sap/dto/sync-sap-stores.dto.ts` | File mới | Tạo mới | DTO phản hồi kết quả đồng bộ từ SAP |
| 9 | `apps/api/src/modules/sap/dto/get-sap-stores-query.dto.ts` | File mới | Tạo mới | DTO lọc danh sách kho (brand, search, status, paging) |
| 10 | `apps/api/src/modules/sap/services/sap-brand.service.ts` | File mới | Tạo mới | Dịch vụ truy vấn thương hiệu |
| 11 | `apps/api/src/modules/sap/services/sap-store.service.ts` | File mới | Tạo mới | Dịch vụ quản lý kho, sync SAP HANA và trích xuất Set |
| 12 | `apps/api/src/modules/sap/services/sap-store.service.spec.ts` | File mới | Tạo mới | Unit test cho `SapStoreService` |
| 13 | `apps/api/src/modules/sap/sap-stores.controller.ts` | File mới | Tạo mới | Controller tiếp nhận các REST API dưới `/sap/brands` và `/sap/stores` |
| 14 | `apps/api/src/modules/sap/sap.module.ts` | Dòng 14-36 (`SapModule`) | Sửa đổi | Khai báo `SapStoresController`, `SapStoreService`, `SapBrandService` |

---

## 3. Các Nhiệm vụ Triển khai Chi tiết (Implementation Tasks)

### Task 1.1: Prisma Schema Migration & Permission Catalog

- **Mục tiêu**: Định nghĩa cấu trúc lưu trữ PostgreSQL cho Brand và Store, đồng thời đăng ký quyền mới vào hệ thống phân quyền Access Control.
- **Tệp tin mục tiêu**:
  - `apps/api/prisma/schema.prisma`
  - `apps/api/src/modules/access-control/permission-catalog.ts`
- **Các bước thực hiện**:
  1. Thêm model `SapBrand` vào cuối file `schema.prisma`:
     ```prisma
     model SapBrand {
       code      String     @id
       name      String
       isActive  Boolean    @default(true)
       sortOrder Int        @default(0)
       createdAt DateTime   @default(now())
       updatedAt DateTime   @updatedAt
       stores    SapStore[]

       @@map("sap_brands")
     }
     ```
  2. Thêm model `SapStore` vào cuối file `schema.prisma`:
     ```prisma
     model SapStore {
       code           String    @id
       name           String
       brandCode      String?
       brand          SapBrand? @relation(fields: [brandCode], references: [code], onDelete: SetNull)
       sapInactive    Boolean   @default(false)
       isActiveSales  Boolean   @default(false)
       isActiveReturn Boolean   @default(false)
       syncedAt       DateTime  @default(now())
       createdAt      DateTime  @default(now())
       updatedAt      DateTime  @updatedAt

       @@index([brandCode])
       @@index([isActiveSales])
       @@index([isActiveReturn])
       @@index([sapInactive])
       @@map("sap_stores")
     }
     ```
  3. Trong `permission-catalog.ts`:
     - Thêm vào mảng `PERMISSION_CATALOG`:
       ```typescript
       {
         key: 'sap-store:manage',
         label: 'Quản lý cửa hàng SAP',
         category: 'Master Board',
       },
       ```
     - Thêm vào object `PERMISSIONS`:
       ```typescript
       SAP_STORE_MANAGE: 'sap-store:manage',
       ```
     - Thêm `'sap-store:manage': true` vào `PERMISSION_KEYS_MAP`.
  4. Tạo migration Prisma:
     ```bash
     pnpm --filter=api prisma migrate dev --name add_sap_brands_and_stores
     ```
- **Tiêu chí thành công**:
  - Migration được tạo thành công trong `apps/api/prisma/migrations/`.
  - Prisma client sinh lại chứa model `SapBrand` và `SapStore`.
  - TypeScript biên dịch không lỗi kiểu dữ liệu với `PERMISSIONS.SAP_STORE_MANAGE`.
- **Xác minh cơ học**:
  - Chạy `git status` xác nhận file migration mới xuất hiện.
  - Lệnh `pnpm --filter=api exec prisma validate` trả về exit code 0.

---

### Task 1.2: Seed Script cho 7 Brands và 26 Pilot Stores

- **Mục tiêu**: Cung cấp dữ liệu gốc đầy đủ cho 7 thương hiệu chuẩn và 26 cửa hàng pilot ban đầu khi chạy script seed.
- **Tệp tin mục tiêu**:
  - `apps/api/scripts/seed.ts`
  - `apps/api/src/modules/sap/lib/sap-constants.ts:26-53`
- **Các bước thực hiện**:
  1. Định nghĩa danh sách 7 Brands trong `seed.ts`:
     ```typescript
     const SAP_BRANDS_SEED = [
       { code: '5001', name: 'Maycha', sortOrder: 1 },
       { code: '5002', name: 'Tam Hảo', sortOrder: 2 },
       { code: '5003', name: 'HO - DCCK', sortOrder: 3 },
       { code: '5004', name: 'Cloud Kitchen', sortOrder: 4 },
       { code: '5005', name: 'Gà Giòn Sốt 3 Cô Gái', sortOrder: 5 },
       { code: '5006', name: 'Trà Hú', sortOrder: 6 },
       { code: '5007', name: 'Thức Coffee', sortOrder: 7 },
     ];
     ```
  2. Map 26 kho pilot từ `RETURN_PILOT_STORES` (`apps/api/src/modules/sap/lib/sap-constants.ts:26-53`) sang Brand tương ứng:
     - `MC...` (MC073, MC011, MC013, MC001, MC028, MC078, MC088, MC115) -> Brand `5001`
     - `GA...` (GA001 đến GA006, GA012, GA015) -> Brand `5005`
     - `TC...` (TC001 đến TC007) -> Brand `5007`
     - `BB...` (BB013, BB115, BB073) -> Brand `5002`
  3. Viết vòng lặp upsert `SapBrand`:
     ```typescript
     for (const brand of SAP_BRANDS_SEED) {
       await prisma.sapBrand.upsert({
         where: { code: brand.code },
         update: { name: brand.name, sortOrder: brand.sortOrder, isActive: true },
         create: { code: brand.code, name: brand.name, sortOrder: brand.sortOrder, isActive: true },
       });
     }
     ```
  4. Viết vòng lặp upsert 26 kho pilot vào `SapStore` với `isActiveSales = true` và `isActiveReturn = true`.
- **Tiêu chí thành công**:
  - Chạy `pnpm --filter=api db:seed` ghi nhận thành công 7 brands và 26 stores trong database.
  - Bảng `sap_stores` chứa đúng 26 dòng với cả hai cờ `isActiveSales = true` và `isActiveReturn = true`.
- **Xác minh cơ học**:
  - Chạy `node -e "..."` hoặc prisma query xác nhận `count` của `sap_brands` bằng 7 và `sap_stores` bằng 26.

---

### Task 1.3: DTOs & Swagger Contract cho SAP Brands & Stores

- **Mục tiêu**: Định nghĩa các DTO request/response có class-validator và Swagger decorator chuẩn xác để chuẩn bị cho Orval sinh contract frontend.
- **Tệp tin mục tiêu**:
  - `apps/api/src/modules/sap/dto/sap-brand.dto.ts`
  - `apps/api/src/modules/sap/dto/sap-store.dto.ts`
  - `apps/api/src/modules/sap/dto/update-sap-store.dto.ts`
  - `apps/api/src/modules/sap/dto/sync-sap-stores.dto.ts`
  - `apps/api/src/modules/sap/dto/get-sap-stores-query.dto.ts`
- **Các bước thực hiện**:
  1. `sap-brand.dto.ts`:
     - `SapBrandDto`: `@ApiProperty()` cho `code`, `name`, `isActive`, `sortOrder`, `storeCount`.
     - `SapBrandListResponseDto`: `{ data: SapBrandDto[] }`.
  2. `sap-store.dto.ts`:
     - `SapStoreDto`: `code`, `name`, `brandCode`, `brandName`, `sapInactive`, `isActiveSales`, `isActiveReturn`, `syncedAt`.
     - `SapStoreListResponseDto`: `{ data: SapStoreDto[], meta: { total, limit, offset, totalPages } }`.
  3. `update-sap-store.dto.ts`:
     - `UpdateSapStoreDto`: `@IsOptional() @IsBoolean()` cho `isActiveSales` và `isActiveReturn`.
  4. `sync-sap-stores.dto.ts`:
     - `SyncSapStoresResultDto`: `totalFetched: number`, `inserted: number`, `updated: number`, `syncedAt: string`.
  5. `get-sap-stores-query.dto.ts`:
     - `GetSapStoresQueryDto`: `brandCode?: string`, `search?: string`, `activeSales?: boolean`, `activeReturn?: boolean`, `sapInactive?: boolean`, `limit?: number`, `offset?: number`.
- **Tiêu chí thành công**:
  - Tất cả properties đều có decorator Swagger `@ApiProperty` hoặc `@ApiPropertyOptional`.
  - Không có trường `any` không xác định kiểu.
- **Xác minh cơ học**:
  - `pnpm --filter=api exec tsc --noEmit` hoàn tất không có lỗi gõ kiểu.

---

### Task 1.4: Triển khai SapBrandService & SapStoreService

- **Mục tiêu**: Xây dựng nghiệp vụ quản lý thương hiệu, lọc cửa hàng, đồng bộ từ SAP HANA OWHS và trích xuất `Set<string>`.
- **Tệp tin mục tiêu**:
  - `apps/api/src/modules/sap/services/sap-brand.service.ts`
  - `apps/api/src/modules/sap/services/sap-store.service.ts`
- **Các bước thực hiện**:
  1. Xây dựng `SapBrandService`:
     - Inject `PrismaService`.
     - Phương thức `findAll(onlyActive = true)`: Truy vấn `prisma.sapBrand.findMany({ where, include: { _count: { select: { stores: true } } }, orderBy: { sortOrder: 'asc' } })`.
  2. Xây dựng `SapStoreService`:
     - Inject `PrismaService` và `SapQueryGatewayService`.
     - Phương thức `findAll(query: GetSapStoresQueryDto)`: Xây dựng mệnh đề `where` lọc theo `brandCode`, `search` (chứa trong code hoặc name, không phân biệt hoa thường), `isActiveSales`, `isActiveReturn`, `sapInactive`. Trả về `{ data, meta }`.
     - Phương thức `update(code: string, dto: UpdateSapStoreDto)`: Kiểm tra tồn tại qua `findUniqueOrThrow`, cập nhật `isActiveSales` và/hoặc `isActiveReturn`, trả về store đã cập nhật.
     - Phương thức `syncFromSap()`:
       - Câu lệnh SQL gửi qua gateway:
         ```sql
         SELECT "WhsCode", "WhsName", "U_Brand", "Inactive"
         FROM maycha_live.OWHS
         WHERE "U_Brand" IS NOT NULL
         ```
       - Sử dụng `wrapOpenquery` qua `this.gateway.run('sync-sap-stores', sql)`.
       - Lặp qua từng dòng kết quả:
         - Chuẩn hóa: `code = String(row[0]).trim()`, `name = String(row[1]).trim()`, `brandCode = String(row[2]).trim()`, `sapInactive = (String(row[3]).trim().toUpperCase() === 'Y')`.
         - Đảm bảo Brand tồn tại: Nếu `brandCode` chưa có trong `sap_brands`, tự động upsert với tên mặc định `Thương hiệu ${brandCode}`.
         - Thực hiện Upsert store:
           - `where: { code }`
           - `update: { name, brandCode, sapInactive, syncedAt: now }` (**KHÔNG ghi đè `isActiveSales` và `isActiveReturn`**)
           - `create: { code, name, brandCode, sapInactive, isActiveSales: false, isActiveReturn: false, syncedAt: now }`
       - Trả về tổng kết: `{ totalFetched, inserted, updated, syncedAt: now.toISOString() }`.
     - Phương thức `getActiveStoreCodes(brandCode: string, type: 'sales' | 'return'): Promise<Set<string>>`:
       - Truy vấn:
         ```typescript
         const stores = await this.prisma.sapStore.findMany({
           where: {
             brandCode,
             ...(type === 'sales' ? { isActiveSales: true } : { isActiveReturn: true }),
           },
           select: { code: true },
         });
         return new Set(stores.map((s) => s.code));
         ```
- **Tiêu chí thành công**:
  - Logic `syncFromSap` bảo lưu nguyên vẹn 100% các cờ `isActiveSales` và `isActiveReturn` đã được cấu hình trước đó.
  - `getActiveStoreCodes` trả về cấu trúc `Set<string>` nhanh chóng với bộ nhớ tối thiểu.
- **Xác minh cơ học**:
  - Kiểm tra signature của hàm trong `sap-store.service.ts` khớp chính xác các hàm sẽ được gọi ở Phase 2.

---

### Task 1.5: Controller SapStoresController & Đăng ký SapModule

- **Mục tiêu**: Expose các API REST cho danh mục Brand và Store dưới các path `/sap/brands` và `/sap/stores`, gắn decorator phân quyền và Swagger operationId.
- **Tệp tin mục tiêu**:
  - `apps/api/src/modules/sap/sap-stores.controller.ts`
  - `apps/api/src/modules/sap/sap.module.ts:14-36`
- **Các bước thực hiện**:
  1. Tạo `SapStoresController`:
     - `@ApiTags('SAP Stores')`
     - `@ApiBearerAuth()`
     - `@Controller('sap')`
     - `GET /sap/brands`:
       - `@ApiOperation({ summary: 'Lấy danh mục thương hiệu SAP', operationId: 'sapBrandsGet' })`
       - `@RequirePermissions(PERMISSIONS.SAP_MONITOR_READ)`
       - Gọi `this.brandService.findAll()`
     - `GET /sap/stores`:
       - `@ApiOperation({ summary: 'Lấy danh sách cửa hàng SAP', operationId: 'sapStoresGet' })`
       - `@RequirePermissions(PERMISSIONS.SAP_STORE_MANAGE)`
       - Nhận `@Query() query: GetSapStoresQueryDto`
       - Gọi `this.storeService.findAll(query)`
     - `PATCH /sap/stores/:code`:
       - `@ApiOperation({ summary: 'Cập nhật trạng thái kích hoạt cửa hàng', operationId: 'sapStoreUpdate' })`
       - `@RequirePermissions(PERMISSIONS.SAP_STORE_MANAGE)`
       - Nhận `@Param('code') code: string`, `@Body() dto: UpdateSapStoreDto`
       - Gọi `this.storeService.update(code, dto)`
     - `POST /sap/stores/sync`:
       - `@ApiOperation({ summary: 'Đồng bộ danh sách cửa hàng từ SAP HANA', operationId: 'sapStoresSync' })`
       - `@RequirePermissions(PERMISSIONS.SAP_STORE_MANAGE)`
       - Gọi `this.storeService.syncFromSap()`
  2. Đăng ký trong `SapModule` (`apps/api/src/modules/sap/sap.module.ts`):
     - Thêm `SapStoresController` vào mảng `controllers`.
     - Thêm `SapBrandService`, `SapStoreService` vào mảng `providers`.
     - Thêm `SapBrandService`, `SapStoreService` vào mảng `exports` để các module khác hoặc Phase 2 có thể inject trực tiếp.
- **Tiêu chí thành công**:
  - Swagger hiển thị đầy đủ 4 endpoint mới kèm mô tả và schema response chuẩn.
  - Phân quyền chặt chẽ: chỉ user có `sap-store:manage` mới gọi được sync và patch.
- **Xác minh cơ học**:
  - Khởi động app context kiểm tra NestJS dependency injection không bị thiếu token.

---

### Task 1.6: Unit Test cho SapStoreService & SapBrandService

- **Mục tiêu**: Đảm bảo toàn bộ logic cốt lõi (bảo lưu flag khi sync, toggle flag, trích xuất Set, fallback rỗng) được kiểm chứng tự động.
- **Tệp tin mục tiêu**:
  - `apps/api/src/modules/sap/services/sap-store.service.spec.ts`
- **Các bước thực hiện**:
  1. Tạo file test `sap-store.service.spec.ts` sử dụng Jest mock `PrismaService` và `SapQueryGatewayService`.
  2. Viết các ca kiểm thử:
     - `getActiveStoreCodes`: Trả về `Set<string>` gồm đúng các mã kho có flag `isActiveSales = true` hoặc `isActiveReturn = true`. Khi database trả về rỗng, hàm trả về Set rỗng (`size === 0`).
     - `update`: Gọi `prisma.sapStore.update` với đúng tham số payload và trả về object cửa hàng.
     - `syncFromSap`:
       - Giả lập gateway trả về 3 dòng kho từ SAP (trong đó có 1 kho đã tồn tại với `isActiveSales = true`).
       - Xác nhận lệnh upsert vào Prisma giữ nguyên `isActiveSales = true` của kho cũ và gán `isActiveSales = false` cho kho mới tạo.
- **Tiêu chí thành công**:
  - Bộ unit test chạy hoàn tất và pass 100%.
- **Xác minh cơ học**:
  - Lệnh `pnpm --filter=api test sap-store.service.spec.ts` vượt qua toàn bộ assertions.

---

## 4. Danh sách Kiểm tra Công việc (Todo List)

- [ ] Task 1.1: Định nghĩa model `SapBrand` và `SapStore` trong `schema.prisma`, thêm `sap-store:manage` vào `permission-catalog.ts`, chạy `prisma migrate dev`.
- [ ] Task 1.2: Cập nhật `seed.ts` để seed 7 brands (`5001..5007`) và 26 stores pilot từ `RETURN_PILOT_STORES`.
- [ ] Task 1.3: Tạo các file DTO: `sap-brand.dto.ts`, `sap-store.dto.ts`, `update-sap-store.dto.ts`, `sync-sap-stores.dto.ts`, `get-sap-stores-query.dto.ts`.
- [ ] Task 1.4: Xây dựng `SapBrandService` và `SapStoreService` (hỗ trợ `syncFromSap` bảo lưu flag, `getActiveStoreCodes`).
- [ ] Task 1.5: Xây dựng `SapStoresController` với 4 endpoints Swagger và đăng ký vào `SapModule`.
- [ ] Task 1.6: Viết và chạy thành công unit test `sap-store.service.spec.ts`.

---

## 5. Quy trình Ứng phó Sự cố (Failure Protocol)

1. **Sự cố: Lỗi chạy Migration Prisma (`prisma migrate dev` thất bại)**
   - *Triệu chứng*: Báo lỗi quan hệ foreign key hoặc bảng đã tồn tại trong database PostgreSQL phát triển.
   - *Nguyên nhân*: Có thể đã tồn tại bảng rác hoặc lệch phiên bản migration trước đó.
   - *Xử lý*: Kiểm tra lại file migration, nếu môi trường dev cục bộ có thể chạy `pnpm --filter=api prisma migrate reset` (chỉ trên local dev) hoặc xóa migration rác và chạy lại.
2. **Sự cố: Đồng bộ từ SAP HANA thất bại (`gateway.run` ném lỗi timeout hoặc rớt mạng)**
   - *Triệu chứng*: Endpoint `POST /sap/stores/sync` trả về mã lỗi `502 Bad Gateway` hoặc `504 Gateway Timeout`.
   - *Nguyên nhân*: Máy chủ SQL Server linked server hoặc kết nối tới HANA bị gián đoạn.
   - *Xử lý*: Giữ nguyên dữ liệu hiện có trong PostgreSQL, không làm thay đổi trạng thái kho; ghi log chi tiết lỗi từ `SapErrorMap`; thông báo cho quản trị viên kiểm tra lại kết nối SAP tại màn hình `/admin/sap-connections`.
3. **Sự cố: Ghi đè nhầm cờ Active Store khi Sync**
   - *Triệu chứng*: Sau khi sync, các kho đang active chuyển thành inactive toàn bộ.
   - *Nguyên nhân*: Trong câu lệnh `prisma.sapStore.upsert`, khối `update` vô tình chứa `isActiveSales: false` hoặc `isActiveReturn: false`.
   - *Xử lý*: Kiểm tra kỹ khối `update` trong `SapStoreService.syncFromSap()` — chỉ cho phép update `name`, `brandCode`, `sapInactive`, `syncedAt`. Unit test tại Task 1.6 phải phát hiện lỗi này trước khi merge.
