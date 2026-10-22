import { Role } from '../../generated/prisma/enums';
import {
  PERMISSION_CATALOG,
  PermissionKey,
  PERMISSIONS,
  isPermissionKey,
} from './permission-catalog';

export type UserPermissionSubject = {
  role: Role | string;
  customPermissions?: readonly string[] | string[] | null;
};

export const ROLE_PERMISSIONS: Record<Role, readonly (PermissionKey | '*')[]> = {
  [Role.ADMIN]: ['*'],
  [Role.EMPLOYEE]: [PERMISSIONS.SAP_MONITOR_READ],
};

const IMPLIES_MAP: Record<string, readonly string[]> = {};
for (const entry of PERMISSION_CATALOG) {
  if ('implies' in entry && Array.isArray(entry.implies) && entry.implies.length > 0) {
    IMPLIES_MAP[entry.key] = entry.implies;
  }
}

export function isSuperAdmin(
  user: UserPermissionSubject | string | null | undefined,
): boolean {
  if (!user) return false;
  if (typeof user === 'string') {
    return user === Role.ADMIN;
  }
  return user.role === Role.ADMIN || (user.customPermissions ?? []).includes('*');
}

export function getEffectivePermissions(
  user: UserPermissionSubject | string,
): string[] {
  const subject: UserPermissionSubject =
    typeof user === 'string' ? { role: user, customPermissions: [] } : user;

  if (isSuperAdmin(subject)) {
    return ['*'];
  }

  const roleKey = subject.role as Role;
  const basePerms = ROLE_PERMISSIONS[roleKey] ?? [];
  if (basePerms.includes('*')) {
    return ['*'];
  }

  const validCustom = (subject.customPermissions ?? []).filter((key) => {
    return isPermissionKey(key) || key === '*';
  });

  if (validCustom.includes('*')) {
    return ['*'];
  }

  const granted: Record<string, true> = {};
  for (const perm of basePerms) {
    if (perm !== '*') {
      granted[perm] = true;
    }
  }
  for (const perm of validCustom) {
    if (perm !== '*') {
      granted[perm] = true;
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const key of Object.keys(granted)) {
      const impliedKeys = IMPLIES_MAP[key];
      if (impliedKeys) {
        for (const implied of impliedKeys) {
          if (!granted[implied]) {
            granted[implied] = true;
            changed = true;
          }
        }
      }
    }
  }

  return Object.keys(granted).sort();
}

export function hasPermission(
  user: UserPermissionSubject | string | null | undefined,
  required: string | readonly string[] | string[],
): boolean {
  const reqList: readonly string[] = typeof required === 'string' ? [required] : required;
  if (reqList.length === 0 || (reqList.length === 1 && reqList[0] === '')) {
    return true;
  }
  if (!user) {
    return false;
  }
  const effective = getEffectivePermissions(user);
  if (effective.includes('*')) {
    return true;
  }
  return reqList.every((perm) => effective.includes(perm));
}

export function normalizeCustomPermissions(
  role: Role | string,
  perms: readonly string[] | string[],
): string[] {
  const seen: Record<string, true> = {};
  const deduped: string[] = [];
  for (const perm of perms) {
    if (!seen[perm]) {
      seen[perm] = true;
      deduped.push(perm);
    }
  }
  deduped.sort();
  if (role === Role.ADMIN) {
    return deduped;
  }

  const baseEffective = getEffectivePermissions({ role, customPermissions: [] });
  return deduped.filter((perm) => !baseEffective.includes(perm));
}
