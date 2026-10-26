import {
  PERMISSION_CATALOG,
  PERMISSIONS,
  isPermissionKey,
} from './permission-catalog';

describe('PermissionCatalog', () => {
  it('contains expected permission entries and structure', () => {
    expect(PERMISSION_CATALOG.length).toBe(5);
    for (const item of PERMISSION_CATALOG) {
      expect(item.key).toBeTruthy();
      expect(item.label).toBeTruthy();
      expect(item.category).toBeTruthy();
      if ('implies' in item && item.implies) {
        expect(Array.isArray(item.implies)).toBe(true);
        for (const implied of item.implies) {
          expect(isPermissionKey(implied)).toBe(true);
        }
      }
    }
  });

  it('PERMISSIONS constant matches catalog keys', () => {
    expect(PERMISSIONS.USER_READ).toBe('user:read');
    expect(PERMISSIONS.USER_MANAGE).toBe('user:manage');
    expect(PERMISSIONS.SAP_MONITOR_READ).toBe('sap-monitor:read');
    expect(PERMISSIONS.SAP_CONNECTION_MANAGE).toBe('sap-connection:manage');
    expect(PERMISSIONS.SAP_STORE_MANAGE).toBe('sap-store:manage');
  });

  it('isPermissionKey correctly validates keys', () => {
    expect(isPermissionKey('user:read')).toBe(true);
    expect(isPermissionKey('user:manage')).toBe(true);
    expect(isPermissionKey('sap-monitor:read')).toBe(true);
    expect(isPermissionKey('sap-connection:manage')).toBe(true);
    expect(isPermissionKey('sap-store:manage')).toBe(true);
    expect(isPermissionKey('*')).toBe(false);
    expect(isPermissionKey('unknown:key')).toBe(false);
    expect(isPermissionKey('')).toBe(false);
  });
});
