// Nạp có chọn lọc 3 biến môi trường kết nối SAP từ file .env ở gốc monorepo
// vào object đích khi chạy dev (tránh nạp tràn lan các biến nhạy cảm khác như SAP_TEST_*).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import * as dotenv from 'dotenv';

export const ROOT_SAP_ENV_KEYS = ['SAP_SQL_HOST', 'SAP_SQL_PORT', 'SAP_CREDENTIAL_KEY'] as const;

export type RootSapEnvKey = (typeof ROOT_SAP_ENV_KEYS)[number];

export type SapEnvEntries = Partial<Record<RootSapEnvKey, string>>;

/**
 * Đi ngược từ thư mục bắt đầu lên thư mục cha cho tới khi gặp `pnpm-workspace.yaml`.
 * Nếu chạm gốc ổ đĩa mà không thấy thì trả về `null` (ví dụ khi chạy trong container).
 */
export function findWorkspaceRoot(startDir: string): string | null {
  let current = resolve(startDir);
  while (true) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

/**
 * Phân tích nội dung file .env và chỉ giữ lại đúng 3 khóa trong allowlist SAP.
 */
export function pickSapEntries(content: string | Buffer): SapEnvEntries {
  const parsed = dotenv.parse(content);
  const result: SapEnvEntries = {};
  for (const key of ROOT_SAP_ENV_KEYS) {
    if (Object.prototype.hasOwnProperty.call(parsed, key) && parsed[key] !== undefined) {
      result[key] = parsed[key];
    }
  }
  return result;
}

/**
 * Gán các khóa SAP vào `target` chỉ khi khóa đó đang `undefined` hoặc chuỗi rỗng `''`.
 * Trả về danh sách tên các khóa đã được gán (không bao giờ trả về giá trị).
 */
export function applySapEntries(
  entries: SapEnvEntries,
  target: Record<string, string | undefined>,
): RootSapEnvKey[] {
  const applied: RootSapEnvKey[] = [];
  for (const key of ROOT_SAP_ENV_KEYS) {
    const value = entries[key];
    if (value !== undefined && (target[key] === undefined || target[key] === '')) {
      target[key] = value;
    }
  }
  return applied;
}

/**
 * Tìm file `.env` tại gốc monorepo và nạp 3 biến SAP vào `target` nếu chưa có.
 * Không thực hiện gì nếu không tìm thấy gốc monorepo hoặc không có file `.env`.
 */
export function loadRootSapEnv(
  startDir: string,
  target: Record<string, string | undefined>,
): RootSapEnvKey[] {
  const rootDir = findWorkspaceRoot(startDir);
  if (!rootDir) {
    return [];
  }
  const envPath = join(rootDir, '.env');
  if (!existsSync(envPath)) {
    return [];
  }
  const content = readFileSync(envPath, 'utf8');
  const entries = pickSapEntries(content);
  return applySapEntries(entries, target);
}
