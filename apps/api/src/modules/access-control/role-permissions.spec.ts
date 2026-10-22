import { Role } from '../../generated/prisma/enums';
import {
  ROLE_PERMISSIONS,
  getEffectivePermissions,
  hasPermission,
  isSuperAdmin,
  normalizeCustomPermissions,
} from './role-permissions';
import { PERMISSIONS } from './permission-catalog';

describe('RolePermissions', () => {
  describe('ROLE_PERMISSIONS constant', () => {
    it('defines expected role bundles', () => {
      expect(ROLE_PERMISSIONS[Role.ADMIN]).toEqual(['*']);
      expect(ROLE_PERMISSIONS[Role.EMPLOYEE]).toEqual([
        PERMISSIONS.SAP_MONITOR_READ,
      ]);
    });
  });

  describe('isSuperAdmin', () => {
    it('returns true for ADMIN role or * permission', () => {
      expect(isSuperAdmin({ role: Role.ADMIN })).toBe(true);
      expect(isSuperAdmin('ADMIN')).toBe(true);
      expect(isSuperAdmin({ role: Role.EMPLOYEE, customPermissions: ['*'] })).toBe(true);
    });

    it('returns false for normal employee', () => {
      expect(isSuperAdmin({ role: Role.EMPLOYEE })).toBe(false);
      expect(isSuperAdmin(null)).toBe(false);
      expect(isSuperAdmin(undefined)).toBe(false);
    });
  });

  describe('getEffectivePermissions', () => {
    it('returns [*] for ADMIN', () => {
      expect(getEffectivePermissions({ role: Role.ADMIN })).toEqual(['*']);
      expect(getEffectivePermissions('ADMIN')).toEqual(['*']);
    });

    it('returns base permissions for EMPLOYEE with no customPermissions', () => {
      const perms = getEffectivePermissions({ role: Role.EMPLOYEE });
      expect(perms).toEqual([
        PERMISSIONS.SAP_MONITOR_READ,
      ]);
    });

    it('computes implied permissions for user:manage (implies user:read)', () => {
      const perms = getEffectivePermissions({
        role: Role.EMPLOYEE,
        customPermissions: [PERMISSIONS.USER_MANAGE],
      });
      expect(perms).toContain(PERMISSIONS.USER_MANAGE);
      expect(perms).toContain(PERMISSIONS.USER_READ);
      expect(perms).toContain(PERMISSIONS.SAP_MONITOR_READ);
    });

    it('ignores unknown permission keys not in catalog', () => {
      const perms = getEffectivePermissions({
        role: Role.EMPLOYEE,
        customPermissions: ['unknown:key'],
      });
      expect(perms).toEqual([
        PERMISSIONS.SAP_MONITOR_READ,
      ]);
    });

    it('returns [*] if customPermissions contains *', () => {
      const perms = getEffectivePermissions({
        role: Role.EMPLOYEE,
        customPermissions: ['*'],
      });
      expect(perms).toEqual(['*']);
    });
  });

  describe('hasPermission', () => {
    it('returns true for super admin with any required permission', () => {
      expect(hasPermission({ role: Role.ADMIN }, 'any:perm')).toBe(true);
      expect(hasPermission({ role: Role.ADMIN }, [PERMISSIONS.USER_READ, PERMISSIONS.USER_MANAGE])).toBe(true);
    });

    it('returns true for empty required permission', () => {
      expect(hasPermission({ role: Role.EMPLOYEE }, [])).toBe(true);
      expect(hasPermission(null, [])).toBe(true);
    });

    it('returns true if user has required permissions', () => {
      const user = {
        role: Role.EMPLOYEE,
        customPermissions: [PERMISSIONS.SAP_CONNECTION_MANAGE],
      };
      expect(hasPermission(user, PERMISSIONS.SAP_CONNECTION_MANAGE)).toBe(true);
      expect(hasPermission(user, PERMISSIONS.SAP_MONITOR_READ)).toBe(true);
    });

    it('returns false if user is missing at least one required permission', () => {
      const user = {
        role: Role.EMPLOYEE,
        customPermissions: [PERMISSIONS.SAP_CONNECTION_MANAGE],
      };
      expect(hasPermission(user, [PERMISSIONS.SAP_CONNECTION_MANAGE, PERMISSIONS.USER_MANAGE])).toBe(false);
    });
  });

  describe('normalizeCustomPermissions', () => {
    it('removes base and implied permissions for EMPLOYEE', () => {
      const input = [
        PERMISSIONS.SAP_MONITOR_READ,
        PERMISSIONS.SAP_CONNECTION_MANAGE,
      ];
      const normalized = normalizeCustomPermissions(Role.EMPLOYEE, input);
      expect(normalized).toEqual([PERMISSIONS.SAP_CONNECTION_MANAGE]);
    });

    it('dedupes and sorts permissions', () => {
      const input = [
        PERMISSIONS.USER_MANAGE,
        PERMISSIONS.SAP_CONNECTION_MANAGE,
        PERMISSIONS.USER_MANAGE,
      ];
      const normalized = normalizeCustomPermissions(Role.EMPLOYEE, input);
      expect(normalized).toEqual([
        PERMISSIONS.SAP_CONNECTION_MANAGE,
        PERMISSIONS.USER_MANAGE,
      ]);
    });

    it('preserves all permissions for ADMIN role so downgrading does not lose them', () => {
      const input = [
        PERMISSIONS.USER_MANAGE,
        PERMISSIONS.SAP_CONNECTION_MANAGE,
      ];
      const normalized = normalizeCustomPermissions(Role.ADMIN, input);
      expect(normalized).toEqual([
        PERMISSIONS.SAP_CONNECTION_MANAGE,
        PERMISSIONS.USER_MANAGE,
      ]);
    });
  });
});
