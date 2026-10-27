---
title: "Phase 1: Port Same-Origin Proxy Guard, Request-Aware CORS & Tests"
status: completed
---

# Phase 1: Port Same-Origin Proxy Guard, Request-Aware CORS & Tests

## Tasks (TDD)
1. **Write failing unit tests (`apps/api/src/common/guards/origin-check.guard.spec.ts`)**:
   - Test `POST` allowed when `Origin` matches `x-forwarded-proto` + `x-forwarded-host` (e.g., `http://172.16.2.88:3000` with `x-forwarded-host: 172.16.2.88:3000`), even when `WEB_ORIGIN` is `http://localhost:3000`.
   - Test `POST` allowed when `Origin` matches one of multiple comma-separated origins in `WEB_ORIGIN`.
   - Test `POST` rejected (`ForbiddenException`) when `Origin` matches neither `x-forwarded-host`/`host` nor `WEB_ORIGIN`.
2. **Implement `OriginCheckGuard` (`apps/api/src/common/guards/origin-check.guard.ts`)**:
   - Port same-origin check (`x-forwarded-host` / `host` + `x-forwarded-proto` / `protocol`) and comma-separated `WEB_ORIGIN` from `thinh-the-vinh-hoa-portal`.
3. **Update `apps/api/src/main.ts` & `.env.example`**:
   - Type `NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true })`.
   - Add `app.set('trust proxy', 1)`.
   - Configure request-aware `app.enableCors(...)` using `ConfigService` and `x-forwarded-host`.
   - Update `.env.example` comments for `WEB_ORIGIN`.
4. **Verification**:
   - Run `pnpm --filter=api test -- origin-check.guard.spec.ts` and `pnpm --filter=api check-types`.
