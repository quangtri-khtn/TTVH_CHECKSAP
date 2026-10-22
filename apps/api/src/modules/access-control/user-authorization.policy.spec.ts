import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role } from '../../generated/prisma/enums';
import { PERMISSIONS } from './permission-catalog';
import {
  assertActorCanManageTarget,
  assertNoPrivilegeAmplification,
  assertNotSelfLockout,
  assertPermissionsWhitelisted,
} from './user-authorization.policy';

describe('UserAuthorizationPolicy', () => {
  describe('assertPermissionsWhitelisted', () => {
    it('passes for valid permission catalog keys', () => {
      expect(() =>
        assertPermissionsWhitelisted([
          PERMISSIONS.SAP_MONITOR_READ,
          PERMISSIONS.SAP_CONNECTION_MANAGE,
        ]),
      ).not.toThrow();
    });

    it('throws BadRequestException if wildcard * is passed', () => {
      expect(() => assertPermissionsWhitelisted(['*'])).toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for unknown permission key', () => {
      expect(() => assertPermissionsWhitelisted(['unknown:key'])).toThrow(
        BadRequestException,
      );
    });
  });

  describe('assertActorCanManageTarget', () => {
    it('passes when actor is super admin', () => {
      const actor = { role: Role.ADMIN };
      const target = { role: Role.ADMIN };
      expect(() => assertActorCanManageTarget(actor, target)).not.toThrow();
    });

    it('throws ForbiddenException when target is ADMIN and actor is not super admin', () => {
      const actor = {
        role: Role.EMPLOYEE,
        customPermissions: [PERMISSIONS.USER_MANAGE],
      };
      const target = { role: Role.ADMIN };
      expect(() => assertActorCanManageTarget(actor, target)).toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException when target has user:manage and actor is non-super', () => {
      const actor = {
        role: Role.EMPLOYEE,
        customPermissions: [PERMISSIONS.USER_MANAGE],
      };
      const target = {
        role: Role.EMPLOYEE,
        customPermissions: [PERMISSIONS.USER_MANAGE],
      };
      expect(() => assertActorCanManageTarget(actor, target)).toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException when target has permissions actor lacks', () => {
      const actor = {
        role: Role.EMPLOYEE,
        customPermissions: [PERMISSIONS.USER_READ],
      };
      const target = {
        role: Role.EMPLOYEE,
        customPermissions: [PERMISSIONS.SAP_CONNECTION_MANAGE],
      };
      expect(() => assertActorCanManageTarget(actor, target)).toThrow(
        ForbiddenException,
      );
    });

    it('passes when target has strict subset of actor permissions and target does not have user:manage', () => {
      const actor = {
        role: Role.EMPLOYEE,
        customPermissions: [
          PERMISSIONS.USER_READ,
          PERMISSIONS.SAP_CONNECTION_MANAGE,
        ],
      };
      const target = {
        role: Role.EMPLOYEE,
        customPermissions: [PERMISSIONS.SAP_CONNECTION_MANAGE],
      };
      expect(() => assertActorCanManageTarget(actor, target)).not.toThrow();
    });
  });

  describe('assertNoPrivilegeAmplification', () => {
    it('passes when actor is super admin', () => {
      const actor = { role: Role.ADMIN };
      expect(() =>
        assertNoPrivilegeAmplification(actor, {
          roleBefore: Role.EMPLOYEE,
          roleAfter: Role.ADMIN,
          before: [],
          after: [PERMISSIONS.SAP_CONNECTION_MANAGE],
        }),
      ).not.toThrow();
    });

    it('throws ForbiddenException when non-super tries to assign ADMIN role', () => {
      const actor = {
        role: Role.EMPLOYEE,
        customPermissions: [PERMISSIONS.USER_MANAGE],
      };
      expect(() =>
        assertNoPrivilegeAmplification(actor, {
          roleBefore: Role.EMPLOYEE,
          roleAfter: Role.ADMIN,
          before: [],
          after: [],
        }),
      ).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when non-super tries to add permissions they do not have', () => {
      const actor = {
        role: Role.EMPLOYEE,
        customPermissions: [PERMISSIONS.USER_READ],
      };
      expect(() =>
        assertNoPrivilegeAmplification(actor, {
          roleBefore: Role.EMPLOYEE,
          roleAfter: Role.EMPLOYEE,
          before: [],
          after: [PERMISSIONS.SAP_CONNECTION_MANAGE],
        }),
      ).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when non-super tries to remove permissions they do not have', () => {
      const actor = {
        role: Role.EMPLOYEE,
        customPermissions: [PERMISSIONS.USER_READ],
      };
      expect(() =>
        assertNoPrivilegeAmplification(actor, {
          roleBefore: Role.EMPLOYEE,
          roleAfter: Role.EMPLOYEE,
          before: [PERMISSIONS.SAP_CONNECTION_MANAGE],
          after: [],
        }),
      ).toThrow(ForbiddenException);
    });

    it('passes when non-super modifies permissions within their own scope', () => {
      const actor = {
        role: Role.EMPLOYEE,
        customPermissions: [
          PERMISSIONS.USER_READ,
          PERMISSIONS.SAP_CONNECTION_MANAGE,
        ],
      };
      expect(() =>
        assertNoPrivilegeAmplification(actor, {
          roleBefore: Role.EMPLOYEE,
          roleAfter: Role.EMPLOYEE,
          before: [],
          after: [PERMISSIONS.SAP_CONNECTION_MANAGE],
        }),
      ).not.toThrow();
    });
  });

  describe('assertNotSelfLockout', () => {
    it('does nothing when actor is not target', () => {
      const actor = { id: 'actor-1', role: Role.EMPLOYEE };
      const target = { id: 'target-1', role: Role.EMPLOYEE, isActive: true };
      expect(() =>
        assertNotSelfLockout(actor, target, { isActive: false }),
      ).not.toThrow();
    });

    it('throws BadRequestException when self-deactivating', () => {
      const actor = { id: 'user-1', role: Role.EMPLOYEE, isActive: true };
      expect(() =>
        assertNotSelfLockout(actor, actor, { isActive: false }),
      ).toThrow(BadRequestException);
    });

    it('throws BadRequestException when changing self role', () => {
      const actor = { id: 'user-1', role: Role.ADMIN, isActive: true };
      expect(() =>
        assertNotSelfLockout(actor, actor, { role: Role.EMPLOYEE }),
      ).toThrow(BadRequestException);
    });

    it('throws BadRequestException when changing self customPermissions', () => {
      const actor = {
        id: 'user-1',
        role: Role.EMPLOYEE,
        isActive: true,
        customPermissions: [],
      };
      expect(() =>
        assertNotSelfLockout(actor, actor, {
          customPermissions: [PERMISSIONS.SAP_CONNECTION_MANAGE],
        }),
      ).toThrow(BadRequestException);
    });

    it('passes when self-updating without changing role, permissions, or isActive', () => {
      const actor = {
        id: 'user-1',
        role: Role.EMPLOYEE,
        isActive: true,
        customPermissions: [PERMISSIONS.SAP_CONNECTION_MANAGE],
      };
      expect(() =>
        assertNotSelfLockout(actor, actor, {
          isActive: true,
          role: Role.EMPLOYEE,
          customPermissions: [PERMISSIONS.SAP_CONNECTION_MANAGE],
        }),
      ).not.toThrow();
    });
  });
});
