import { hasPermission, hasAnyPermission } from './has-permission';

describe('hasPermission', () => {
  it('returns true when required is empty', () => {
    expect(hasPermission(['sap-monitor:read'], '')).toBe(true);
    expect(hasPermission(['sap-monitor:read'], [])).toBe(true);
  });

  it('returns false when permissions is null or empty', () => {
    expect(hasPermission(null, 'sap-monitor:read')).toBe(false);
    expect(hasPermission([], 'sap-monitor:read')).toBe(false);
  });

  it('returns true when permissions contains wildcard', () => {
    expect(hasPermission(['*'], 'sap-monitor:read')).toBe(true);
  });

  it('checks single permission string', () => {
    expect(hasPermission(['sap-monitor:read', 'user:read'], 'sap-monitor:read')).toBe(true);
    expect(hasPermission(['user:read'], 'sap-monitor:read')).toBe(false);
  });

  it('checks all permissions in array', () => {
    expect(hasPermission(['sap-monitor:read', 'user:read'], ['sap-monitor:read', 'user:read'])).toBe(true);
    expect(hasPermission(['sap-monitor:read'], ['sap-monitor:read', 'user:read'])).toBe(false);
  });
});

describe('hasAnyPermission', () => {
  it('returns true when wildcard is present', () => {
    expect(hasAnyPermission(['*'], ['sap-monitor:read'])).toBe(true);
  });

  it('returns true when any permission matches', () => {
    expect(hasAnyPermission(['sap-monitor:read'], ['sap-monitor:read', 'user:read'])).toBe(true);
  });

  it('returns false when no permissions match', () => {
    expect(hasAnyPermission(['user:manage'], ['sap-monitor:read', 'user:read'])).toBe(false);
  });
});
