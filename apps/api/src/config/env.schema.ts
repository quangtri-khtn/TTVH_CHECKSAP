import { z } from 'zod';

// Chuẩn hóa giá trị biến môi trường tùy chọn: cắt khoảng trắng hai đầu,
// coi chuỗi rỗng như chưa cấu hình (undefined) để áp mặc định hoặc bỏ qua.
function emptyToUndefined(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }
  return value;
}

// Biểu thức chính quy kiểm tra chuỗi base64 chuẩn (32 byte -> 44 chars)
// hoặc chuỗi hex 64 ký tự (32 byte).
const STANDARD_BASE64_REGEX =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const HEX_32_BYTE_REGEX = /^[0-9a-fA-F]{64}$/;

export function isValidSapCredentialKey(val: string): boolean {
  if (HEX_32_BYTE_REGEX.test(val)) {
    return true;
  }
  return (
    val.length > 0 &&
    STANDARD_BASE64_REGEX.test(val) &&
    Buffer.from(val, 'base64').byteLength === 32
  );
}

// Validates only the env vars this app actually reads. Every var here has a
// default matching the same fallback already hardcoded in code
// (JwtStrategy/AccessControlModule use 'dev-placeholder-secret'), so this
// does not tighten the "boots with no .env file present" guarantee — it
// only turns a genuinely malformed value into a clear boot-time error
// instead of a confusing runtime failure later.
const envSchema = z.object({
  JWT_ACCESS_SECRET: z.string().min(1).default('dev-placeholder-access-secret'),
  JWT_REFRESH_SECRET: z.string().min(1).default('dev-placeholder-refresh-secret'),
  JWT_ACCESS_TTL: z.string().min(1).default('15m'),
  JWT_REFRESH_TTL: z.string().min(1).default('7d'),
  AUTH_COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  ALLOW_INSECURE_HTTP: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.string().min(1).default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgresql://postgres:postgres@localhost:5433/ttvh_sap_monitor_db?schema=public'),
  LOG_PRETTY: z.string().optional(),
  SAP_SQL_HOST: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  SAP_SQL_PORT: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(65535).default(1433),
  ),
  SAP_CREDENTIAL_KEY: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .refine(
        isValidSapCredentialKey,
        {
          message:
            'SAP_CREDENTIAL_KEY phải là chuỗi 64 ký tự hex hoặc chuỗi base64 giải mã ra đúng 32 byte',
        },
      )
      .optional(),
  ),
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  // The default secrets are public (checked into source control) and only
  // safe for local dev boot-without-.env convenience. Refuse to boot in
  // production with either one still set — that would let anyone forge a
  // valid access or refresh token for any user id.
  if (result.data.NODE_ENV === 'production') {
    if (result.data.JWT_ACCESS_SECRET === 'dev-placeholder-access-secret') {
      throw new Error(
        'JWT_ACCESS_SECRET must be set explicitly in production, refusing to boot with the default dev secret',
      );
    }
    if (result.data.JWT_REFRESH_SECRET === 'dev-placeholder-refresh-secret') {
      throw new Error(
        'JWT_REFRESH_SECRET must be set explicitly in production, refusing to boot with the default dev secret',
      );
    }
  }

  // Sharing one secret across access and refresh tokens defeats the reason
  // they're split in the first place — a leaked access token (short TTL,
  // seen by more code paths) would also let an attacker forge refresh
  // tokens (long TTL, session-granting power) if both were signed with the
  // same key.
  if (result.data.JWT_ACCESS_SECRET === result.data.JWT_REFRESH_SECRET) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values');
  }

  // AUTH_COOKIE_SECURE=false means both cookies (including the 7-day
  // refresh token) get sent over plain HTTP with no Secure flag. Same class
  // of mistake as booting production with a default JWT secret — refuse
  // to boot rather than silently ship a session-hijackable cookie.
  if (
    result.data.NODE_ENV === 'production' &&
    !result.data.AUTH_COOKIE_SECURE &&
    !result.data.ALLOW_INSECURE_HTTP
  ) {
    throw new Error(
      'AUTH_COOKIE_SECURE must be true in production — auth cookies must only be sent over HTTPS. Set ALLOW_INSECURE_HTTP=true if running in a private HTTP UAT/testing environment.',
    );
  }

  if (
    result.data.NODE_ENV === 'production' &&
    !result.data.SAP_CREDENTIAL_KEY
  ) {
    throw new Error(
      'SAP_CREDENTIAL_KEY bắt buộc phải được cấu hình trên môi trường production (chuỗi 64 hex hoặc base64 32-byte)',
    );
  }

  return result.data;
}
