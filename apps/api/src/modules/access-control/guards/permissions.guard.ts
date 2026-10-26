import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PUBLIC_KEY } from '../decorators/public.decorator';
import {
  REQUIRE_ANY_PERMISSIONS_KEY,
  REQUIRE_PERMISSIONS_KEY,
} from '../decorators/require-permissions.decorator';
import { hasPermission } from '../role-permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // @Public() routes bypass JwtAuthGuard entirely, so request.user is never
    // set on them — must mirror that bypass here too, or a route combining
    // @Public() with @RequirePermissions() would always 403 on undefined user.
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required =
      this.reflector.getAllAndOverride<string[]>(REQUIRE_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const { user } = context.switchToHttp().getRequest();
    if (required.length > 0 && (!user || !hasPermission(user, required))) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const requiredAny =
      this.reflector.getAllAndOverride<string[]>(REQUIRE_ANY_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (
      requiredAny.length > 0 &&
      (!user || !requiredAny.some((perm) => hasPermission(user, [perm])))
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
