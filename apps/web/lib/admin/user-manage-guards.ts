import { PERMISSIONS } from '@/lib/auth/permission-keys';

export interface ManageGuardSubject {
  id?: string;
  role?: string;
  permissions?: readonly string[] | string[];
}

/**
 * Kiểm tra đối tượng có phải là quản trị viên cấp cao (Super Admin) hay không.
 */
export function isSuperAdminSubject(subject?: ManageGuardSubject | null): boolean {
  if (!subject) return false;
  if (subject.role === 'ADMIN') return true;
  if (subject.permissions?.includes('*')) return true;
  return false;
}

/**
 * Kiểm tra xem actor có quyền quản lý target hay không (phản chiếu policy backend assertActorCanManageTarget):
 * 1. Actor là Super Admin -> luôn có quyền (true).
 * 2. Target là ADMIN hoặc Super Admin -> actor không phải super không thể quản lý (false).
 * 3. Target có quyền user:manage -> actor không phải super không thể quản lý (false).
 * 4. Quyền của target phải là tập con của quyền actor (target.permissions ⊆ actor.permissions) -> nếu target có quyền mà actor không có, trả về false.
 */
export function canActorManageUser(
  actor?: ManageGuardSubject | null,
  target?: ManageGuardSubject | null,
): boolean {
  if (!actor || !target) {
    return false;
  }

  // 1. Quản trị viên cấp cao có toàn quyền
  if (isSuperAdminSubject(actor)) {
    return true;
  }

  // 2. Không thể quản lý tài khoản ADMIN
  if (isSuperAdminSubject(target) || target.role === 'ADMIN') {
    return false;
  }

  const targetPerms = target.permissions ?? [];
  // 3. Không thể quản lý tài khoản có quyền user:manage
  if (targetPerms.includes(PERMISSIONS.USER_MANAGE) || targetPerms.includes('*')) {
    return false;
  }

  // 4. Quyền của target phải là tập con của actor
  const actorPerms = actor.permissions ?? [];
  const isSubset = targetPerms.every((perm) => actorPerms.includes(perm));
  if (!isSubset) {
    return false;
  }

  return true;
}

/**
 * Kiểm tra actor có được phép gán vai trò `targetRole` cho người khác hay không.
 * Chỉ quản trị viên cấp cao mới được phép gán vai trò ADMIN.
 */
export function canActorAssignRole(
  actor?: ManageGuardSubject | null,
  targetRole?: string,
): boolean {
  if (!actor) return false;
  if (targetRole === 'ADMIN') {
    return isSuperAdminSubject(actor);
  }
  return true;
}

/**
 * Kiểm tra actor có được phép vô hiệu hoá target hay không.
 * Backend chặn tự vô hiệu hoá chính mình, và áp dụng policy quản lý user thông thường.
 */
export function canActorDeactivateUser(
  actor?: ManageGuardSubject | null,
  target?: ManageGuardSubject | null,
): boolean {
  if (!actor || !target) return false;
  if (actor.id && target.id && actor.id === target.id) {
    return false;
  }
  return canActorManageUser(actor, target);
}
