# syntax=docker/dockerfile:1.7
# Multi-stage Dockerfile for NestJS API (pnpm workspace)
#
# NOT wired to any specific deploy platform (Dokploy, K8s, etc.) — that's
# the concrete project's job once a deploy target is chosen. This only
# proves the image builds and runs `node dist/main.js` standalone.
#
# node:22-alpine (not 20) — pnpm@11.2.2 (pinned via corepack below) requires
# Node >=22.13 to run; node:20-alpine failed at `pnpm install` with
# ERR_UNKNOWN_BUILTIN_MODULE (node:sqlite) the first time this Dockerfile
# was actually built. Verified with a real `docker build` + `docker run`.

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.2.2 --activate
WORKDIR /app

# ---------- Stage 1: deps (install all workspace deps for building) ----------
FROM base AS deps
# argon2's native addon needs a build toolchain on musl (Alpine) when no
# prebuilt binary matches — node-gyp-build falls back to compiling from
# source without this. bcryptjs (the previous hasher) was pure-JS and never
# needed this; argon2 is the first native dependency in this repo.
RUN apk add --no-cache python3 make g++
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY turbo.json ./
COPY apps/api/package.json apps/api/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/typescript-config/package.json packages/typescript-config/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---------- Stage 2: prod-deps (cached across source/schema edits) ----------
FROM deps AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm --filter api --prod deploy /deploy/api --legacy

# ---------- Stage 3: build ----------
FROM deps AS build
COPY packages/ ./packages/
COPY apps/api/tsconfig*.json apps/api/prisma.config.ts ./apps/api/
COPY apps/api/prisma ./apps/api/prisma
# src/generated/prisma is gitignored — regenerate only when schema/tsconfig changes.
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public" \
    pnpm --filter api prisma:generate
COPY apps/api/ ./apps/api/
RUN pnpm --filter api build

# ---------- Stage 4: runner ----------
FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# Non-root user
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs

# Copy prod node_modules BEFORE dist so code rebuilds keep node_modules layer cached
COPY --from=prod-deps --chown=nestjs:nodejs /deploy/api/node_modules ./node_modules
COPY --from=prod-deps --chown=nestjs:nodejs /deploy/api/package.json ./package.json
COPY --from=build --chown=nestjs:nodejs /app/apps/api/dist ./dist
USER nestjs
EXPOSE 3001
# nest build's outDir mirrors src/, so the entry point is dist/src/main.js,
# not dist/main.js — confirmed by inspecting the built image's dist/ layout.
CMD ["node", "dist/src/main.js"]
