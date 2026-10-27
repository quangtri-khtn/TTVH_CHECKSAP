// Must run before any other import that reads process.env at module-load
// time (e.g. PrismaService's constructor, which runs during Nest's DI
// container build, before ConfigModule.forRoot() has a chance to populate
// anything). @nestjs/config's ConfigModule only feeds ConfigService — it
// does not guarantee process.env itself is populated for code that reads
// process.env directly, so main.ts loads dotenv explicitly, the same way
// prisma.config.ts already does for CLI commands.
import * as dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { findWorkspaceRoot } from './config/load-root-sap-env';

// Nạp .env từ apps/api và từ root workspace một cách tin cậy
const workspaceRoot = findWorkspaceRoot(__dirname) || resolve(__dirname, '../../..');
const rootEnv = join(workspaceRoot, '.env');
const apiEnv = join(workspaceRoot, 'apps/api/.env');
if (existsSync(rootEnv)) dotenv.config({ path: rootEnv, override: true });
if (existsSync(apiEnv)) dotenv.config({ path: apiEnv, override: true });

import './config/register-root-sap-env';
import 'reflect-metadata';
import type { Request } from 'express';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, type LoggerService } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { isRequestOriginAllowed } from './common/guards/origin-check.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  // Buffers Nest's internal logs (framework startup messages, module init)
  // until the pino Logger below is wired up, so nothing is lost or printed
  // through the default console logger mid-bootstrap.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  // Trust first proxy hop (Next.js rewrites / reverse proxy) so X-Forwarded-* headers are honored
  app.set('trust proxy', 1);
  app.useLogger(app.get<LoggerService>(Logger));
  // the DB connection gets cut abruptly instead of closed cleanly when a
  // container orchestrator stops the process.
  app.enableShutdownHooks();
  // CSP disabled: Swagger UI (mounted at /api below) relies on inline
  // scripts/styles that helmet's default CSP blocks. All other helmet
  // headers (HSTS, X-Content-Type-Options, etc.) stay active.
  app.use(helmet({ contentSecurityPolicy: false }));
  // Required for JwtStrategy/AuthController to read the access/refresh
  // cookies off incoming requests — without this, request.cookies is
  // always undefined.
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  const configService = app.get(ConfigService);
  const webOrigin = configService.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000';
  app.enableCors((request: Request, callback) => {
    const isAllowed = isRequestOriginAllowed(request, webOrigin);
    callback(null, {
      origin: isAllowed,
      credentials: true,
    });
  });

  const config = new DocumentBuilder()
    .setTitle('TTVH SAP Monitor API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api', app, SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
