---
title: "Port Proxy Same-Origin Check & Multi-Origin Support from Portal/QLHD"
status: completed
branch: fix/proxy-same-origin-guard
created: 2026-10-27
---

# Plan: Port Proxy Same-Origin Check & Multi-Origin Support

## 1. Context & Root Cause (`[Direct]`)
- `apps/api/src/common/guards/origin-check.guard.ts:28-40` currently compares `request.headers.origin` strictly against a single `WEB_ORIGIN` string (`origin !== expectedOrigin`).
- `apps/api/src/main.ts:36-55` lacks `app.set('trust proxy', 1)` and uses a static string for `app.enableCors(...)`.
- In `quan_ly_hop_dong` (`apps/api/src/common/guards/origin-check.guard.ts:37-55`) and `thinh-the-vinh-hoa-portal` (`apps/api/src/common/guards/origin-check.guard.ts:28-59` & `apps/api/src/main.ts:34,72-90`), state-changing requests proxied through the Next.js `web` container (`API_INTERNAL_URL=http://api:3001`) are validated against `x-forwarded-host` / `host` (Same-Origin check) first, plus comma-separated `WEB_ORIGIN` fallback. This allows deploying the container stack to any server IP/domain without reconfiguring `WEB_ORIGIN`.

## 2. Scope & Phases
- [x] [Phase 1: Port Same-Origin Proxy Guard, Request-Aware CORS & Tests](./phase-01-proxy-same-origin.md)

## 3. Acceptance Criteria
- [x] `OriginCheckGuard` allows state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) when `Origin` matches `x-forwarded-host` (with `x-forwarded-proto` or `request.protocol`) or `request.headers.host`.
- [x] `OriginCheckGuard` supports comma-separated origins in `WEB_ORIGIN` (stripping trailing slashes) and rejects mismatched origins with `403 Forbidden`.
- [x] `apps/api/src/main.ts` sets `app.set('trust proxy', 1)` on `NestExpressApplication` and configures request-aware CORS matching `OriginCheckGuard`.
- [x] Unit tests in `apps/api/src/common/guards/origin-check.guard.spec.ts` cover `x-forwarded-host`, `host`, comma-separated `WEB_ORIGIN`, trailing slashes, and rejection of spoofed/external origins.
- [x] `.env.example` documents automatic Next.js proxy same-origin support and comma-separated `WEB_ORIGIN`.
