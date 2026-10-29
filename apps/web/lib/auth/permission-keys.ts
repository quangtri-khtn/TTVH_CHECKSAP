export const PERMISSIONS = {
  USER_READ: 'user:read',
  USER_MANAGE: 'user:manage',
  SAP_MONITOR_READ: 'sap-monitor:read',
  SAP_CONNECTION_MANAGE: 'sap-connection:manage',
  SAP_STORE_MANAGE: 'sap-store:manage',
  SAP_QUERY_MANAGE: 'sap-query:manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ADMIN_PERMISSIONS = [
  PERMISSIONS.SAP_CONNECTION_MANAGE,
  PERMISSIONS.SAP_STORE_MANAGE,
  PERMISSIONS.SAP_QUERY_MANAGE,
  PERMISSIONS.USER_READ,
  PERMISSIONS.USER_MANAGE,
] as const;
