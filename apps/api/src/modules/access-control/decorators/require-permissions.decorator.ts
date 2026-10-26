import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSIONS_KEY = 'requiredPermissions';
export const RequirePermissions = (...perms: string[]) =>
  SetMetadata(REQUIRE_PERMISSIONS_KEY, perms);

export const REQUIRE_ANY_PERMISSIONS_KEY = 'requiredAnyPermissions';
export const RequireAnyPermissions = (...perms: string[]) =>
  SetMetadata(REQUIRE_ANY_PERMISSIONS_KEY, perms);
