export interface PermissionCatalogEntry {
  readonly key: string;
  readonly label: string;
  readonly category: string;
  readonly implies?: readonly string[];
}

export const PERMISSION_CATALOG = [
  {
    key: 'sap-monitor:read',
    label: 'Xem SAP Monitor',
    category: 'SAP Monitor',
  },
  {
    key: 'sap-connection:manage',
    label: 'Quản lý kết nối SAP',
    category: 'SAP Monitor',
  },
  {
    key: 'user:read',
    label: 'Xem danh sách người dùng',
    category: 'Người dùng',
  },
  {
    key: 'user:manage',
    label: 'Quản lý người dùng',
    category: 'Người dùng',
    implies: ['user:read'],
  },
] as const satisfies readonly PermissionCatalogEntry[];

export type PermissionKey = (typeof PERMISSION_CATALOG)[number]['key'];

export const PERMISSIONS = {
  SAP_MONITOR_READ: 'sap-monitor:read',
  SAP_CONNECTION_MANAGE: 'sap-connection:manage',
  USER_READ: 'user:read',
  USER_MANAGE: 'user:manage',
} as const;

const PERMISSION_KEYS_MAP: Record<string, true> = {
  'sap-monitor:read': true,
  'sap-connection:manage': true,
  'user:read': true,
  'user:manage': true,
};

export function isPermissionKey(key: string): key is PermissionKey {
  return PERMISSION_KEYS_MAP[key] === true;
}
