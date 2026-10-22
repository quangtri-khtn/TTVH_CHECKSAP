import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Role } from '../../../generated/prisma/enums';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  customPermissions: string[];
  permissions: string[];
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    return ctx.switchToHttp().getRequest().user;
  },
);
