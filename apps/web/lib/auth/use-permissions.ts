'use client';

import { useCurrentUser } from './use-current-user';
import { hasPermission, hasAnyPermission } from './has-permission';

export interface UsePermissionsResult {
  permissions: string[];
  can: (key: string | readonly string[]) => boolean;
  canAny: (keys: readonly string[]) => boolean;
  isSuperAdmin: boolean;
  isLoading: boolean;
}

export function usePermissions(): UsePermissionsResult {
  const { user, isLoading } = useCurrentUser();
  const permissions = user?.permissions ?? [];
  const isSuperAdmin = permissions.includes('*') || user?.role === 'ADMIN';

  return {
    permissions,
    can: (key: string | readonly string[]) => hasPermission(permissions, key),
    canAny: (keys: readonly string[]) => hasAnyPermission(permissions, keys),
    isSuperAdmin,
    isLoading,
  };
}
