// Tách địa chỉ máy chủ SQL Server (host, host,port, tcp:host,port, host\instance)
// và dựng object cấu hình mới cho mssql ConnectionPool ở mỗi lần mở kết nối.
import type * as sql from 'mssql';

export const SAP_CONNECTION_TIMEOUT_MS = 15_000;
export const SAP_DATABASE = 'master';

export interface SapPoolProfile {
  readonly requestTimeoutMs: number;
  readonly poolMax: number;
}

export const MONITOR_POOL_PROFILE: SapPoolProfile = {
  requestTimeoutMs: 60_000,
  poolMax: 2,
};

export const CHECK_POOL_PROFILE: SapPoolProfile = {
  requestTimeoutMs: 20_000,
  poolMax: 1,
};

export interface SqlServerAddress {
  server: string;
  port?: number;
  instanceName?: string;
}

export type ParsedSqlServerAddress = ({ ok: true } & SqlServerAddress) | { ok: false };

export interface SapSqlCredentials {
  username: string;
  password: string;
}

function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

/**
 * Tách cấu hình địa chỉ SQL Server từ `SAP_SQL_HOST` và `SAP_SQL_PORT`.
 * Không bao giờ đính kèm giá trị đầu vào trong kết quả lỗi để tránh lộ cấu hình.
 */
export function parseSqlServerAddress(
  host: string | undefined,
  port = 1433,
): ParsedSqlServerAddress {
  if (typeof host !== 'string') {
    return { ok: false };
  }

  const withoutPrefix = host.trim().replace(/^tcp:/i, '');
  if (withoutPrefix === '') {
    return { ok: false };
  }

  if (
    withoutPrefix.includes(':') ||
    /\s/.test(withoutPrefix) ||
    (withoutPrefix.includes('\\') && withoutPrefix.includes(','))
  ) {
    return { ok: false };
  }

  if (withoutPrefix.includes('\\')) {
    const parts = withoutPrefix.split('\\');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return { ok: false };
    }
    return {
      ok: true,
      server: parts[0],
      instanceName: parts[1],
    };
  }

  if (withoutPrefix.includes(',')) {
    const parts = withoutPrefix.split(',');
    if (parts.length !== 2 || !parts[0] || !/^\d+$/.test(parts[1] ?? '')) {
      return { ok: false };
    }
    const parsedPort = Number(parts[1]);
    if (!isValidPort(parsedPort)) {
      return { ok: false };
    }
    return {
      ok: true,
      server: parts[0],
      port: parsedPort,
    };
  }

  if (!isValidPort(port)) {
    return { ok: false };
  }

  return {
    ok: true,
    server: withoutPrefix,
    port,
  };
}

/**
 * Dựng object cấu hình mới hoàn toàn cho `mssql.ConnectionPool` (vì constructor
 * của tedious/mssql ghi đè trực tiếp lên object truyền vào).
 */
export function buildMssqlConfig(
  address: SqlServerAddress,
  { username, password }: SapSqlCredentials,
  profile: SapPoolProfile,
): sql.config {
  const options: sql.IOptions = {
    encrypt: true,
    trustServerCertificate: true,
    useUTC: true,
    ...(address.instanceName ? { instanceName: address.instanceName } : {}),
  };

  const baseConfig: sql.config = {
    server: address.server,
    user: username,
    password,
    database: SAP_DATABASE,
    connectionTimeout: SAP_CONNECTION_TIMEOUT_MS,
    requestTimeout: profile.requestTimeoutMs,
    pool: {
      max: profile.poolMax,
      min: 0,
    },
    options,
  };

  if (!address.instanceName) {
    baseConfig.port = address.port ?? 1433;
  }

  return baseConfig;
}
