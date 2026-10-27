import * as dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

const rootEnv = resolve(__dirname, '../../.env');
const apiEnv = resolve(__dirname, '.env');
if (existsSync(rootEnv)) dotenv.config({ path: rootEnv, override: true });
if (existsSync(apiEnv)) dotenv.config({ path: apiEnv, override: true });

// Prisma 7 moved connection config out of schema.prisma into this file.
// The CLI (migrate, studio) reads this; PrismaClient at runtime still uses
// generator output only and does not read this file.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/ttvh_sap_monitor_db?schema=public',
  },
});
