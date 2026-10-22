import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role } from '../../generated/prisma/enums';
import {
  PERMISSIONS,
  isPermissionKey,
} from './permission-catalog';
import {
  getEffectivePermissions,
  hasPermission,
  isSuperAdmin,
  normalizeCustomPermissions,
  type UserPermissionSubject,
} from './role-permissions';

export type PolicyUser = UserPermissionSubject & {
  id?: string;
  isActive?: boolean;
};

export function assertPermissionsWhitelisted(added: readonly string[]): void {
  for (const perm of added) {
    if (!isPermissionKey(perm)) {
      throw new BadRequestException(`Quyền không hợp lệ hoặc nằm ngoài danh mục cho phép: ${perm}`);
    }
  }
}

export function assertActorCanManageTarget(
  actor: PolicyUser,
  target: PolicyUser,
): void {
  if (isSuperAdmin(actor)) {
    return;
  }

  if (isSuperAdmin(target) || target.role === Role.ADMIN) {
    throw new ForbiddenException('Không thể quản lý tài khoản quản trị viên');
  }

  if (hasPermission(target, PERMISSIONS.USER_MANAGE)) {
    throw new ForbiddenException('Không thể quản lý tài khoản có quyền quản lý người dùng');
  }

  const actorPerms = getEffectivePermissions(actor);
  const targetPerms = getEffectivePermissions(target);

  const isSubset = targetPerms.every((p) => actorPerms.includes(p));
  if (!isSubset) {
    throw new ForbiddenException('Không thể quản lý tài khoản có quyền mà bạn không sở hữu');
  }
}

export function assertNoPrivilegeAmplification(
  actor: PolicyUser,
  diff: {
    roleBefore: Role | string;
    roleAfter: Role | string;
    before: readonly string[];
    after: readonly string[];
  },
): void {
  if (isSuperAdmin(actor)) {
    return;
  }

  if (diff.roleAfter === Role.ADMIN) {
    throw new ForbiddenException('Chỉ quản trị viên cấp cao mới có quyền gán vai trò ADMIN');
  }

  const actorPerms = getEffectivePermissions(actor);

  const added = diff.after.filter((perm) => !diff.before.includes(perm));
  for (const perm of added) {
    if (!actorPerms.includes(perm)) {
      throw new ForbiddenException(`Không thể cấp quyền mà bạn không sở hữu: ${perm}`);
    }
  }

  const removed = diff.before.filter((perm) => !diff.after.includes(perm));
  for (const perm of removed) {
    if (!actorPerms.includes(perm)) {
      throw new ForbiddenException(`Không thể gỡ quyền mà bạn không sở hữu: ${perm}`);
    }
  }
}

export function assertNotSelfLockout(
  actor: PolicyUser,
  target: PolicyUser,
  intent: {
    isActive?: boolean;
    role?: Role | string;
    customPermissions?: readonly string[];
  },
): void {
  if (!actor.id || !target.id || actor.id !== target.id) {
    return;
  }

  if (intent.isActive === false && target.isActive !== false) {
    throw new BadRequestException('Không thể tự vô hiệu hoá tài khoản của chính mình');
  }

  if (intent.role !== undefined && intent.role !== target.role) {
    throw new BadRequestException('Không thể tự thay đổi vai trò của chính mình');
  }

  if (intent.customPermissions !== undefined) {
    const targetNorm = normalizeCustomPermissions(
      target.role,
      target.customPermissions ?? [],
    );
    const intentNorm = normalizeCustomPermissions(
      intent.role ?? target.role,
      intent.customPermissions,
    );
    const isDiff =
      targetNorm.length !== intentNorm.length ||
      targetNorm.some((p, i) => p !== intentNorm[i]);

    if (isDiff) {
      throw new BadRequestException('Không thể tự điều chỉnh quyền của chính mình');
    }
  }
}
