// Must run before any import that reads process.env.DATABASE_URL at
// module-load time (PrismaService's adapter reads it directly) — same
// reasoning as main.ts's leading dotenv/config import.
import * as dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const cliNodeEnv = process.env.NODE_ENV;
const rootEnv = resolve(__dirname, '../../../.env');
const apiEnv = resolve(__dirname, '../.env');
if (existsSync(rootEnv)) dotenv.config({ path: rootEnv, override: true });
if (existsSync(apiEnv)) dotenv.config({ path: apiEnv, override: true });
if (cliNodeEnv) process.env.NODE_ENV = cliNodeEnv;
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { createHash } from 'node:crypto';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role } from '../src/generated/prisma/enums';
import { ARGON2_OPTIONS } from '../src/modules/auth/argon2-options.constant';
import { RETURN_PILOT_STORES } from '../src/modules/sap/lib/sap-constants';
import { SAP_QUERY_CATALOG } from '../src/modules/sap/queries/sap-query-catalog';

const SAP_BRANDS_SEED = [
  { code: '5001', name: 'Maycha', sortOrder: 1 },
  { code: '5002', name: 'Tam Hảo', sortOrder: 2 },
  { code: '5003', name: 'HO - DCCK', sortOrder: 3 },
  { code: '5004', name: 'Cloud Kitchen', sortOrder: 4 },
  { code: '5005', name: 'Gà Giòn Sốt 3 Cô Gái', sortOrder: 5 },
  { code: '5006', name: 'Trà Hú', sortOrder: 6 },
  { code: '5007', name: 'Thức Coffee', sortOrder: 7 },
] as const;

function resolvePilotBrandCode(storeCode: string): string {
  if (storeCode.startsWith('MC')) return '5001';
  if (storeCode.startsWith('BB')) return '5002';
  if (storeCode.startsWith('GA')) return '5005';
  if (storeCode.startsWith('TC')) return '5007';
  return '5001';
}

const ADMIN_EMAIL = 'admin@maycha.com';
const ADMIN_PASSWORD = 'Admin@123456';
const ADMIN_NAME = 'Maycha Admin';

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run seed in production (NODE_ENV=production). Seed data is dev-only.');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const hashedPassword = await argon2.hash(ADMIN_PASSWORD, ARGON2_OPTIONS);

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: ADMIN_NAME,
      role: Role.ADMIN,
      isActive: true,
    },
    create: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      password: hashedPassword,
      role: Role.ADMIN,
      isActive: true,
      customPermissions: [],
    },
  });

  console.log(`Seeded admin user: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);

  for (const brand of SAP_BRANDS_SEED) {
    await prisma.sapBrand.upsert({
      where: { code: brand.code },
      update: { name: brand.name, sortOrder: brand.sortOrder, isActive: true },
      create: {
        code: brand.code,
        name: brand.name,
        sortOrder: brand.sortOrder,
        isActive: true,
      },
    });
  }
  console.log(`[seed] SAP brands upserted: ${SAP_BRANDS_SEED.length}`);

  for (const storeCode of RETURN_PILOT_STORES) {
    const brandCode = resolvePilotBrandCode(storeCode);
    await prisma.sapStore.upsert({
      where: { code: storeCode },
      update: {
        brandCode,
        isActiveSales: true,
        isActiveReturn: true,
      },
      create: {
        code: storeCode,
        name: `Cửa hàng ${storeCode}`,
        brandCode,
        sapInactive: false,
        isActiveSales: true,
        isActiveReturn: true,
      },
    });
  }
  const brand5001Res = await prisma.sapStore.updateMany({
    where: { brandCode: '5001' },
    data: { isActiveSales: true, isActiveReturn: true },
  });
  console.log(`[seed] SAP brand 5001 stores activated: ${brand5001Res.count}`);
  console.log(`[seed] SAP pilot stores upserted: ${RETURN_PILOT_STORES.length}`);

  for (const entry of SAP_QUERY_CATALOG) {
    const normalizedSql = entry.defaultSql.replace(/\r\n/g, '\n').trim();
    const sqlHash = createHash('sha256').update(normalizedSql).digest('hex');

    await prisma.sapQueryDef.upsert({
      where: { key: entry.key },
      update: {
        flow: entry.flow,
        stage: entry.stage,
        sortOrder: entry.sortOrder,
        title: entry.title,
        description: entry.description,
        impactBadges: [...entry.impactBadges],
        allowedPlaceholders: [...entry.allowedPlaceholders],
        requiredColumns: [...entry.requiredColumns],
        baselineColumns: [...entry.baselineColumns],
        dedupKeys: [...entry.dedupKeys],
        supportsExtraColumns: entry.supportsExtraColumns,
        defaultSql: entry.defaultSql,
      },
      create: {
        key: entry.key,
        flow: entry.flow,
        stage: entry.stage,
        sortOrder: entry.sortOrder,
        title: entry.title,
        description: entry.description,
        impactBadges: [...entry.impactBadges],
        allowedPlaceholders: [...entry.allowedPlaceholders],
        requiredColumns: [...entry.requiredColumns],
        baselineColumns: [...entry.baselineColumns],
        dedupKeys: [...entry.dedupKeys],
        supportsExtraColumns: entry.supportsExtraColumns,
        defaultSql: entry.defaultSql,
        currentVersionNo: 1,
      },
    });

    await prisma.sapQueryVersion.upsert({
      where: {
        queryKey_versionNo: {
          queryKey: entry.key,
          versionNo: 1,
        },
      },
      update: {},
      create: {
        queryKey: entry.key,
        versionNo: 1,
        sqlText: entry.defaultSql,
        sqlHash,
        changeNote: 'Phiên bản mặc định ban đầu (Seed v1)',
        createdBy: 'system-seed',
      },
    });
  }
  console.log(`[seed] SAP query catalog upserted: ${SAP_QUERY_CATALOG.length}`);
  await app.close();
  process.exit(0);
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
