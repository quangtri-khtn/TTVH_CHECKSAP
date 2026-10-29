---
title: "Phase 2: Backend Engine, Review Validator & CRUD API"
status: todo
priority: P1
effort: 2.5h
dependencies: [1]
---

# Phase 2: Backend Engine, Review Validator & CRUD API

## Overview

Xây dựng bộ máy xử lý câu truy vấn động (`sap-query-template-engine.ts`), trình kiểm tra tĩnh dùng state-machine lexer & đối chiếu Hợp đồng Cột (`Review & Validate`), dịch vụ quản lý phiên bản append-only và snapshot bất biến (`SapQueryConfigService`), và REST Controller (`SapQueriesController`) cho phép IT xem danh sách 25 câu theo 2 Tab, chạy thử đối chiếu cột với câu gốc (có bảo vệ `FifoLock`), xuất bản phiên bản mới, xem lịch sử/diff, hoàn tác và khôi phục mặc định.

---

## Target Files & Symbols

| STT | Đường dẫn Tệp tin | Hành động | Mục đích |
|:---:|---|:---:|---|
| 1 | `apps/api/src/modules/sap/lib/sap-query-template-engine.ts` | Create | Hàm thuần bung biến runtime (1 pass có `assertSapDate`/`assertSapBrand`/`assertPoNumbers`), kiểm tra tĩnh bằng lexer (`validateQueryStatic`), đối chiếu cột & khóa khử trùng (`compareQueryColumns`), tính `computeSqlHash` |
| 2 | `apps/api/src/modules/sap/lib/sap-query-template-engine.spec.ts` | Create | Unit test kiểm tra cả 25 câu seed `v1` pass `validateQueryStatic`, chống SQL injection, chặn bảng ngoài `maycha_live`/`kbmd_live`, kiểm tra độ dài 7800 ký tự, đối chiếu cột thiếu/cột mới/trùng `dedupKeys` |
| 3 | `apps/api/src/modules/sap/dto/sap-query-config.dto.ts` | Create | Swagger DTOs cho danh sách, chi tiết, request/response Review & Validate (có `@Matches` cho `dateFrom`/`brand`), Publish, Rollback, Reset |
| 4 | `apps/api/src/modules/sap/services/sap-query-config.service.ts` | Create | Quản lý frozen snapshot `{ epoch, sqlByKey }`, single-flight `initPromise` lazy-seed & đồng bộ metadata 25 câu, chạy dry-run (có `isReviewRunning` guard), publish/rollback/reset append-only |
| 5 | `apps/api/src/modules/sap/services/sap-query-config.service.spec.ts` | Create | Unit test cho `SapQueryConfigService` (review pass/fail, `409 Conflict` khi review chồng, chặn publish khi chưa review hoặc lệch `sqlHash`, append-only rollback, frozen snapshot) |
| 6 | `apps/api/src/modules/sap/sap-queries.controller.ts` | Create | REST endpoints `/sap/queries` bảo vệ bởi `@RequirePermissions(PERMISSIONS.SAP_QUERY_MANAGE)` và `@Throttle` |
| 7 | `apps/api/src/modules/sap/sap.module.ts` | Modify | Đăng ký `SapQueriesController` và `SapQueryConfigService` |

---

## Requirements

- [x] **Kiểm tra tĩnh 4 lớp (`validateQueryStatic`) với State-Machine Lexer:** <!-- Updated: Red Team 2026-10-29 - quét biến trước, lexer tách chuỗi/định danh, kiểm tra bảng sau FROM/JOIN -->
  1. **Bước 1 — Biến runtime (`allowedPlaceholders`) trên văn bản gốc:** Quét mọi token `\{[a-zA-Z0-9_]+\}` trên chuỗi `sqlText` gốc (trước khi tách chuỗi `'...'` vì `'{d}'` và `'{brand}'` nằm trong nháy đơn). Báo lỗi nếu có biến lạ không thuộc `entry.allowedPlaceholders` hoặc thiếu biến bắt buộc trong `entry.allowedPlaceholders`.
  2. **Bước 2 — Chỉ đọc (`SELECT` / `WITH`) sau khi Lexer tách `'...'` và `"..."`:** Dùng hàm lexer một lượt đi qua `sqlText` (sau khi đã thay các biến hợp lệ bằng giá trị mẫu): phát hiện comment `--` hoặc `/* */` ở ngoài chuỗi/định danh thì chặn ngay; thay nội dung bên trong `'...'` bằng `''` và nội dung bên trong `"..."` bằng `"_id"` (nhờ đó alias cột như `"Ngay Update"` hoặc dấu nháy đơn trong tên cột không gây nhận diện nhầm). Trên chuỗi đã làm sạch: chỉ cho phép bắt đầu bằng `SELECT` hoặc `WITH`; chặn dấu `;` và các từ khóa biên giới từ (`\b...\b`, không phân biệt hoa thường): `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `UPSERT`, `DROP`, `ALTER`, `CREATE`, `TRUNCATE`, `GRANT`, `REVOKE`, `CALL`, `EXEC`, `EXECUTE`, `INTO` (không chặn `REPLACE` vì là hàm chuỗi chuẩn của HANA).
  3. **Bước 3 — Kiểm tra bảng sau `FROM` / `JOIN`:** Quét mọi định danh bảng đứng ngay sau từ khóa `FROM` hoặc `JOIN` (bỏ qua subquery mở ngoặc `FROM (`): bắt buộc mọi bảng vật lý phải có dạng `maycha_live.<Table>` hoặc `kbmd_live.<Table>` (chặn tuyệt đối bảng không ghi schema như `FROM USERS`, `FROM M_CONNECTIONS`, `FROM DUMMY` hoặc schema lạ như `"SYS"."USERS"`).
  4. **Bước 4 — Giới hạn độ dài `OPENQUERY` ($\le 7.800$ ký tự):** Bung câu SQL bằng `renderCatalogSql` với kịch bản dài nhất (300 số PO 7 chữ số `1000000..1000299` cho `{po_filter}` / `{date_cond}`, `dateFrom = '20261007'`, `brand = '5001'`), nhân đôi dấu nháy đơn và đo độ dài phần trong `OPENQUERY`; nếu `> 7800` ký tự thì báo lỗi kèm số ký tự thực tế.
- [x] **Bung biến 1 lượt kèm kiểm tra tham số (`renderCatalogSql`):** <!-- Updated: Red Team 2026-10-29 - assertSapDate/Brand/PoNumbers và thay thế 1 pass -->
  - Luôn gọi `assertSapDate(dateFrom)`, `assertSapBrand(brand)` và (nếu có `poNumbers`) `assertPoNumbers(poNumbers)` ngay đầu hàm `renderCatalogSql`.
  - Xây dựng bảng giá trị thay thế (`{d}`, `{br}`, `{po_filter}`, `{brand}`, `{date_cond}`) và thay thế trong **1 lượt regex** `/\{(d|br|po_filter|brand|date_cond)\}/g` rồi gọi `wrapOpenquery()`.
- [x] **Chạy thử & Đối chiếu Hợp đồng Cột (`reviewQuery`) có bảo vệ `FifoLock`:** <!-- Updated: Red Team 2026-10-29 - cờ isReviewRunning chống nghẽn FifoLock, kiểm tra dedupKeys và ghi audit review -->
  - Đặt cờ `isReviewRunning` trên `SapQueryConfigService`: nếu đang có một lượt Review chạy trên `FifoLock`, trả ngay `409 Conflict ('Hệ thống đang chạy thử một câu truy vấn khác, vui lòng đợi vài giây')` thay vì xếp hàng làm nghẽn Monitor.
  - Thực thi câu SQL qua `gateway.run('review:' + key, renderedSql)` và cắt tối đa `50` dòng đầu tiên để trả về `previewTable`.
  - Đối chiếu mảng `result.columns` với `entry.requiredColumns` và `entry.baselineColumns`:
    - `missingColumns`: các cột trong `entry.requiredColumns` không có trong `result.columns`.
    - `extraColumns`: các cột trong `result.columns` không có trong `entry.baselineColumns`.
    - `duplicateKeyCount`: đếm số dòng bị trùng khóa dựa trên `entry.dedupKeys` (cảnh báo nếu IT sửa `GROUP BY` / `DISTINCT` làm nhân bội dòng).
    - `semanticErrors`: với `t2` và `t3`, nếu có dòng trả về nhưng cột `Ghi chu ShipDate` có giá trị không bắt đầu bằng `'Da den'` hoặc `'Chua den'` thì báo lỗi ngữ nghĩa (chặn xuất bản để không làm lệch KPI thanh trạng thái).
  - Ghi 1 dòng `SapQueryAudit` (`action: 'review'`). Nếu kiểm tra tĩnh đạt, `missingColumns.length === 0` và `semanticErrors.length === 0`, cập nhật `lastTestedSqlHash = computeSqlHash(dto.sqlText)`, `lastTestedAt = now()`, `lastTestedById = actor.id`, `lastTestRowCount = result.rows.length`, `lastTestDurationMs` vào `SapQueryDef`.
- [x] **Chốt chặn Xuất bản & Append-Only Versioning (`publish`, `rollback`, `resetDefault`):** <!-- Updated: Red Team 2026-10-29 - append-only versionNo = MAX + 1 và chỉ cập nhật RAM sau khi commit -->
  - `publish`: kiểm tra `lastTestedSqlHash === computeSqlHash(dto.sqlText)` và `lastTestedAt` trong 24 giờ gần nhất; kiểm tra lại `validateQueryStatic` một lần nữa; yêu cầu `changeNote` tối thiểu 3 ký tự.
  - Cả 3 thao tác `publish`, `rollback`, `resetDefault` đều chạy trong transaction Prisma: lấy `maxVer = await tx.sapQueryVersion.aggregate({ where: { queryKey: key }, _max: { versionNo: true } })`, tính `nextVersionNo = (maxVer._max.versionNo ?? 0) + 1`, tạo bản ghi `SapQueryVersion` mới, cập nhật `SapQueryDef.currentVersionNo = nextVersionNo`, ghi `SapQueryAudit`.
  - **Chỉ sau khi transaction commit thành công**, cập nhật bản đồ in-memory `activeSqlByKey` và tăng `configEpoch++`.

---

## Implementation Steps

1. **Viết `apps/api/src/modules/sap/lib/sap-query-template-engine.ts` (+ `.spec.ts`):**
   - Cài đặt `computeSqlHash(sqlText: string): string` (SHA-256 trên chuỗi `sqlText.replace(/\r\n/g, '\n').trim()`).
   - Cài đặt `renderCatalogSql(sqlText: string, params: RenderSqlParams): OpenQuerySql`.
   - Cài đặt `validateQueryStatic(entry: SapQueryCatalogEntry, sqlText: string): StaticValidationResult`.
   - Cài đặt `compareQueryColumns(entry: SapQueryCatalogEntry, actualColumns: readonly string[], rows: readonly (readonly SapCellValue[])[]): ColumnDiffResult`.
   - Viết unit test trong `sap-query-template-engine.spec.ts` (bao gồm test bắt buộc cả 25 câu trong `SAP_QUERY_CATALOG` đều pass `validateQueryStatic`).
2. **Tạo DTOs trong `apps/api/src/modules/sap/dto/sap-query-config.dto.ts`:**
   - Định nghĩa các class có `@ApiProperty` và validator (`@IsString`, `@MinLength`, `@Matches` cho `dateFrom` và `brand` trong `ReviewSapQueryRequestDto`):
     - `SapQuerySummaryDto`, `SapQueryListResponseDto`
     - `SapQueryVersionDto`, `SapQueryAuditDto`, `SapQueryDetailDto`, `SapQueryDetailResponseDto`
     - `ReviewSapQueryRequestDto`, `SapQueryColumnCheckItemDto`, `ReviewSapQueryResultDto`, `ReviewSapQueryResponseDto`
     - `PublishSapQueryRequestDto`, `RollbackSapQueryRequestDto`, `ResetSapQueryRequestDto`
3. **Xây dựng `SapQueryConfigService` (`apps/api/src/modules/sap/services/sap-query-config.service.ts`):**
   - Dùng `initPromise: Promise<void> | null` (single-flight) trong `ensureInitialized()` để nạp 25 câu từ DB; nếu câu nào chưa có trong DB thì khởi tạo `v1`, nếu đã có thì đồng bộ lại các trường metadata (`title`, `description`, `impactBadges`, `allowedPlaceholders`, `requiredColumns`, `baselineColumns`, `dedupKeys`, `defaultSql`) từ `SAP_QUERY_CATALOG`.
   - Cung cấp `getSnapshot(): Promise<SapQuerySnapshot>` trả về `{ epoch: number; sqlByKey: ReadonlyMap<SapQueryKey, string>; versionByKey: ReadonlyMap<SapQueryKey, number> }`.
   - Cung cấp các hàm dựng câu SQL thuần từ `snapshot`:
     - `buildSalesListSqlMap(snapshot, dateFrom, brand)`
     - `buildSalesChainSqlMap(snapshot, dateFrom, brand, poNumbers?)`
     - `buildReturnMainSqlMap(snapshot, dateFrom, brand, poNumbers?)`
     - `buildReturnOldDiscoverySqlMap(snapshot, dateFrom, brand)`
   - Cung cấp các hàm quản trị: `findAll()`, `findOne(key)`, `review(key, dto, actor)`, `publish(key, dto, actor)`, `rollback(key, dto, actor)`, `resetDefault(key, dto, actor)`.
4. **Xây dựng `SapQueriesController` (`apps/api/src/modules/sap/sap-queries.controller.ts`) & đăng ký `SapModule`:**
   - Gắn `@ApiTags('SAP Queries')`, `@ApiBearerAuth()`, `@Controller('sap/queries')`, `@RequirePermissions(PERMISSIONS.SAP_QUERY_MANAGE)`.
   - Gắn `@Throttle({ default: { limit: 5, ttl: 60_000 } })` cho endpoint `POST :key/review`.
   - Đặt `operationId` tường minh: `sapQueriesList`, `sapQueriesGetDetail`, `sapQueriesReview`, `sapQueriesPublish`, `sapQueriesRollback`, `sapQueriesResetDefault`.

---

## Todo

- [x] Task 2.1: Tạo `sap-query-template-engine.ts` và `sap-query-template-engine.spec.ts` (kèm test 25 câu `v1` pass `validateQueryStatic`).
- [x] Task 2.2: Tạo `dto/sap-query-config.dto.ts` với đầy đủ Swagger decorators và `@Matches` cho `dateFrom`/`brand`.
- [x] Task 2.3: Tạo `services/sap-query-config.service.ts` và `services/sap-query-config.service.spec.ts`.
- [x] Task 2.4: Tạo `sap-queries.controller.ts` và đăng ký vào `sap.module.ts`.

---

## Success Criteria

- `pnpm --filter=api test -- sap-query-template-engine.spec.ts sap-query-config.service.spec.ts` pass 100%.
- Mọi ca kiểm thử injection (`; DROP TABLE`, `UPDATE`, comment `--`, `brand` chứa SQL injection, bảng `SYS.USERS` / `M_CONNECTIONS`), thiếu biến `{po_filter}`/`{date_cond}`, thiếu cột bắt buộc, hoặc publish khi chưa review đều bị chặn chính xác.
