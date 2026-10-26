# TTVH SAP Monitor

Hệ thống độc lập giám sát & đối soát chuỗi chứng từ SAP HANA theo thời gian thực (Monitor Bán hàng `/sap/monitor-ban`, Monitor Luồng trả `/sap/monitor-tra`, Quản trị kết nối SAP `/admin/sap-connections`, Quản trị người dùng & phân quyền `/admin/users`).

## Kiến trúc Monorepo

- `apps/api`: NestJS REST API + Prisma (PostgreSQL) + MSSQL Linked Server `hana_mc` (`FifoLock` tuần tự + mã hóa `AES-256-GCM`) + ExcelJS exporters.
- `apps/web`: Next.js 15 App Router + React 19 + TanStack Query 5 + Orval generated client + shadcn/ui + Tailwind CSS v4.

## Lệnh phát triển Local

```bash
# 1. Khởi chạy PostgreSQL container (port 5435)
docker compose up -d postgres

# 2. Cài đặt dependencies & sinh Prisma client
pnpm install
pnpm --filter=api exec prisma generate

# 3. Chạy đồng thời API (:3001) và Web (:3000)
pnpm dev

# 4. Đồng bộ OpenAPI -> Orval client
pnpm codegen

# 5. Kiểm tra kiểu, test & build
pnpm check-types
pnpm test
pnpm build
```
