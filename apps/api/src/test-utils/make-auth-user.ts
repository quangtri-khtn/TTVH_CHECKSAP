import { Role } from '../generated/prisma/enums';
import type { AuthUser } from '../modules/access-control/decorators/current-user.decorator';
import { getEffectivePermissions } from '../modules/access-control/role-permissions';

export function makeAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  const role = overrides.role ?? Role.EMPLOYEE;
  const customPermissions = overrides.customPermissions ? [...overrides.customPermissions] : [];
  const permissions = overrides.permissions
    ? [...overrides.permissions]
    : getEffectivePermissions({ role, customPermissions });

  return {
    id: overrides.id ?? 'test-user-id',
    email: overrides.email ?? 'test@example.com',
    name: overrides.name ?? 'Test User',
    role,
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
    customPermissions,
    permissions,
  };
}
