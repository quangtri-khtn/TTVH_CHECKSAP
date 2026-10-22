// Gateway thực thi tuần tự các câu lệnh OPENQUERY tới SAP HANA qua SQL Server
// và quản lý vòng đời ConnectionPool đang hoạt động (activePool).
//
// Các nguyên tắc và bất biến cốt lõi:
// 1. Khóa FIFO toàn tiến trình (`FifoLock`, không tái nhập): linked server `hana_mc`
//    chỉ cho phép mỗi thời điểm 1 truy vấn OPENQUERY. Mọi lệnh `run`, bước 2-3 của
//    `checkCredentials` và bước chuyển đổi trong `swapActivePool` đều xếp hàng qua khóa này.
// 2. Bất biến `activePool`: biến `activePool` chỉ giữ tham chiếu tới `ConnectionPool`
//    đã `await connect()` thành công. Nhờ đó `closePool(activePool)` không bao giờ gặp
//    lỗi đóng pool khi đang ở trạng thái connecting.
// 3. Thứ tự `swapActivePool` (dùng chung cho Kích hoạt và Sửa tài khoản đang dùng):
//    mở kết nối pool mới bằng thông tin mới ở NGOÀI khóa trước -> vào khóa -> chạy
//    transaction `commit(tx)` -> nếu lỗi thì đóng pool mới và giữ nguyên pool cũ ->
//    nếu thành công thì đổi tham chiếu `activePool = newPool` rồi đóng `oldPool`.
// 4. Listener `'error'` bắt buộc: `mssql`/`tedious` phát sự kiện `'error'` trên pool
//    cho mọi lỗi kết nối (trừ `ESOCKET`). Phải gắn `pool.on('error', ...)` trước khi
//    gọi `connect()` để ngăn UnhandledError làm sập tiến trình Node.js.
// 5. Bảo mật log: tuyệt đối không ghi `err.message`, tên máy chủ, câu lệnh SQL,
//    username hay mật khẩu ở bất kỳ mức log nào (kể cả debug).
import { Injectable, Logger, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sql from 'mssql';
import type { AppEnv } from '../../../config/env.schema';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { FifoLock } from '../lib/fifo-lock';
import {
  CHECK_POOL_PROFILE,
  MONITOR_POOL_PROFILE,
  type SapPoolProfile,
  type SapSqlCredentials,
  type SqlServerAddress,
  buildMssqlConfig,
  parseSqlServerAddress,
} from '../lib/mssql-config';
import type { OpenQuerySql } from '../lib/openquery';
import { SAP_CHECK_STEP_LABELS, type SapCheckStep, loginFailedSteps } from '../lib/sap-check-steps';
import { extractSapErrorMeta, toSapHttpException } from '../lib/sap-error-map';
import { type SapQueryResult, normalizeArrayModeResult } from '../lib/sap-row-normalizer';
import { CONNECTION_CHECK_QUERIES } from '../queries/connection-check-queries';
import { SapCredentialCipherService } from './sap-credential-cipher.service';

type ServerAddressState =
  { status: 'missing' } | { status: 'invalid' } | { status: 'valid'; address: SqlServerAddress };

const MISSING_HOST_MESSAGE = 'Máy chủ chưa cấu hình địa chỉ SQL Server cho SAP, liên hệ admin';
const INVALID_HOST_MESSAGE = 'Cấu hình máy chủ SAP không hợp lệ';
const MISSING_ACTIVE_CONNECTION_MESSAGE = 'Chưa cấu hình kết nối SAP, liên hệ admin';

@Injectable()
export class SapQueryGatewayService implements OnModuleDestroy {
  private readonly logger = new Logger(SapQueryGatewayService.name);
  private readonly lock = new FifoLock();
  private readonly serverAddressState: ServerAddressState;
  private activePool: sql.ConnectionPool | null = null;
  private poolEpoch = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: SapCredentialCipherService,
    private readonly configService: ConfigService<AppEnv, true>,
  ) {
    const rawHost = this.configService.get('SAP_SQL_HOST', { infer: true });
    const rawPort = this.configService.get('SAP_SQL_PORT', { infer: true });

    if (typeof rawHost !== 'string' || rawHost.trim() === '') {
      this.serverAddressState = { status: 'missing' };
      return;
    }

    const parsed = parseSqlServerAddress(rawHost, rawPort ?? 1433);
    if (!parsed.ok) {
      this.serverAddressState = { status: 'invalid' };
      return;
    }

    const { ok: _, ...address } = parsed;
    this.serverAddressState = { status: 'valid', address };
  }

  /**
   * Thực thi tuần tự 1 câu lệnh `OpenQuerySql` trên pool đang hoạt động trong khóa FIFO.
   * Nếu chưa có pool (câu đầu tiên sau khi khởi động API), tự động nạp và mở pool từ dòng `isActive = true`.
   */
  async run(key: string, sqlQuery: OpenQuerySql): Promise<SapQueryResult> {
    return this.lock.runExclusive(async () => {
      const pool = await this.ensureActivePool();
      return this.executeOnPool(pool, key, sqlQuery);
    });
  }

  /**
   * Kiểm tra 3 bước trên một `ConnectionPool` tạm thời (`CHECK_POOL_PROFILE`):
   * 0. Kiểm tra cấu hình địa chỉ máy chủ trước (thiếu hoặc sai hình dạng -> ném 503 cho cả request).
   * 1. Mở pool tạm và `ping` (`SELECT 1`) ở ngoài khóa. Nếu lỗi -> trả 3 bước `failed / skipped / skipped`.
   * 2. Trong khóa FIFO: chạy lần lượt 2 câu kiểm tra `maycha_live` và `kbmd_live` (bước 2 lỗi vẫn chạy bước 3).
   * 3. Luôn đóng pool tạm trong `finally`.
   */
  async checkCredentials(credentials: SapSqlCredentials): Promise<SapCheckStep[]> {
    this.assertServerAddress();

    let tempPool: sql.ConnectionPool | null = null;
    try {
      try {
        tempPool = await this.openPool(credentials, CHECK_POOL_PROFILE, 'check');
        await this.ping(tempPool);
      } catch (err) {
        const mapped = toSapHttpException(err);
        return loginFailedSteps(mapped.message);
      }

      const activeTempPool = tempPool;
      const steps: SapCheckStep[] = [
        {
          key: 'login',
          label: SAP_CHECK_STEP_LABELS.login,
          status: 'ok',
        },
      ];

      await this.lock.runExclusive(async () => {
        for (const stepKey of ['maycha_live', 'kbmd_live'] as const) {
          try {
            await this.executeOnPool(activeTempPool, stepKey, CONNECTION_CHECK_QUERIES[stepKey]);
            steps.push({
              key: stepKey,
              label: SAP_CHECK_STEP_LABELS[stepKey],
              status: 'ok',
            });
          } catch (err) {
            const mapped = toSapHttpException(err);
            steps.push({
              key: stepKey,
              label: SAP_CHECK_STEP_LABELS[stepKey],
              status: 'failed',
              message: mapped.message,
            });
          }
        }
      });

      return steps;
    } finally {
      await this.closePool(tempPool);
    }
  }

  /**
   * Mở kết nối pool mới bằng thông tin đăng nhập mới trước, sau đó lấy khóa FIFO để
   * chạy transaction `commit(tx)`, tráo `activePool` sang pool mới và đóng pool cũ.
   * Dùng chung cho Kích hoạt kết nối và Sửa thông tin đăng nhập của kết nối đang dùng.
   *
   * QUY TẮC CỨNG: callback `commit` chạy bên trong khóa FIFO không tái nhập (`FifoLock`),
   * do đó `commit` CHỈ được phép ghi DB qua `tx`, TUYỆT ĐỐI KHÔNG gọi lại bất kỳ hàm nào
   * của `SapQueryGatewayService` (`run`, `checkCredentials`, `swapActivePool`) để tránh deadlock.
   */
  async swapActivePool(
    credentials: SapSqlCredentials,
    commit: (tx: Prisma.TransactionClient) => Promise<void>,
    connectionId: string,
  ): Promise<void> {
    const newPool = await this.openPool(credentials, MONITOR_POOL_PROFILE, 'monitor');

    await this.lock.runExclusive(async () => {
      try {
        await this.prisma.$transaction(async (tx) => commit(tx));
      } catch (err) {
        await this.closePool(newPool);
        throw err;
      }

      const oldPool = this.activePool;
      this.activePool = newPool;
      this.poolEpoch++;
      await this.closePool(oldPool);
      this.logger.log(`active pool swapped connection=${connectionId}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    const pool = this.activePool;
    this.activePool = null;
    this.poolEpoch++;
    await this.closePool(pool);
  }

  /**
   * Trả về số thứ tự thế hệ (epoch) của activePool hiện tại.
   * Tăng thêm 1 mỗi khi swapActivePool hoặc onModuleDestroy để các bộ đệm Monitor tự vô hiệu hóa.
   */
  getPoolEpoch(): number {
    return this.poolEpoch;
  }

  private assertServerAddress(): SqlServerAddress {
    if (this.serverAddressState.status === 'missing') {
      throw new ServiceUnavailableException(MISSING_HOST_MESSAGE);
    }
    if (this.serverAddressState.status === 'invalid') {
      throw new ServiceUnavailableException(INVALID_HOST_MESSAGE);
    }
    return this.serverAddressState.address;
  }

  private async openPool(
    credentials: SapSqlCredentials,
    profile: SapPoolProfile,
    profileLabel: 'monitor' | 'check',
  ): Promise<sql.ConnectionPool> {
    const address = this.assertServerAddress();
    const config = buildMssqlConfig(address, credentials, profile);
    const pool = new sql.ConnectionPool(config);

    // Gắn listener 'error' trước khi connect() vì tedious phát sự kiện 'error' trên pool
    // cho mọi lỗi kết nối (trừ ESOCKET); thiếu listener sẽ làm sập tiến trình Node.js.
    pool.on('error', (err: unknown) => {
      const meta = extractSapErrorMeta(err);
      this.logger.error(
        `sap pool error profile=${profileLabel} code=${meta.code ?? 'none'} number=${meta.number ?? 'none'}`,
      );
    });

    try {
      await pool.connect();
    } catch (err) {
      await this.closePool(pool);
      throw toSapHttpException(err);
    }

    this.logger.log(`pool opened profile=${profileLabel}`);
    return pool;
  }

  private async ping(pool: sql.ConnectionPool): Promise<void> {
    try {
      await pool.request().query('SELECT 1');
    } catch (err) {
      throw toSapHttpException(err);
    }
  }

  private async closePool(pool: sql.ConnectionPool | null): Promise<void> {
    if (!pool) {
      return;
    }
    try {
      await pool.close();
      this.logger.log('pool closed');
    } catch (err) {
      const meta = extractSapErrorMeta(err);
      this.logger.warn(
        `pool close failed code=${meta.code ?? 'none'} number=${meta.number ?? 'none'}`,
      );
    }
  }

  private async ensureActivePool(): Promise<sql.ConnectionPool> {
    if (this.activePool) {
      return this.activePool;
    }

    const activeConnection = await this.prisma.sapConnection.findFirst({
      where: { isActive: true },
    });
    if (!activeConnection) {
      throw new ServiceUnavailableException(MISSING_ACTIVE_CONNECTION_MESSAGE);
    }

    const password = this.cipher.decrypt(activeConnection.passwordEncrypted);
    const pool = await this.openPool(
      { username: activeConnection.username, password },
      MONITOR_POOL_PROFILE,
      'monitor',
    );

    this.activePool = pool;
    this.logger.log(`active pool opened connection=${activeConnection.id}`);
    return pool;
  }

  private async executeOnPool(
    pool: sql.ConnectionPool,
    key: string,
    sqlQuery: OpenQuerySql,
  ): Promise<SapQueryResult> {
    const startedAt = Date.now();
    const infoNumbers: number[] = [];
    const request = pool.request();
    request.arrayRowMode = true;

    request.on('info', (info: { number?: unknown }) => {
      if (info && typeof info.number === 'number' && Number.isFinite(info.number)) {
        infoNumbers.push(info.number);
      }
    });

    try {
      const rawResult = await request.query(sqlQuery);
      const normalized = normalizeArrayModeResult(rawResult);
      const durationMs = Date.now() - startedAt;
      this.logger.log(`sap query ok key=${key} ms=${durationMs} rows=${normalized.rows.length}`);
      return normalized;
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const meta = extractSapErrorMeta(err);
      this.logger.warn(
        `sap query failed key=${key} ms=${durationMs} code=${meta.code ?? 'none'} number=${meta.number ?? 'none'} preceding=[${meta.precedingNumbers.join(',')}] info=[${infoNumbers.join(',')}]`,
      );
      throw toSapHttpException(err);
    }
  }
}
