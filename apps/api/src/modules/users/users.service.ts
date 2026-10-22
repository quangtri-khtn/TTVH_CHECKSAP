import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { ARGON2_OPTIONS } from '../auth/argon2-options.constant';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UserResponseDto } from './dto/user-response.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { Role } from '../../generated/prisma/client';
import type { User } from '../../generated/prisma/client';
import { AuthSessionsService } from '../auth-sessions/auth-sessions.service';
import {
  getEffectivePermissions,
  normalizeCustomPermissions,
  ROLE_PERMISSIONS,
} from '../access-control/role-permissions';
import { PERMISSION_CATALOG } from '../access-control/permission-catalog';
import { PermissionCatalogResponseDto } from './dto/permission-catalog-response.dto';
import {
  assertActorCanManageTarget,
  assertNoPrivilegeAmplification,
  assertNotSelfLockout,
  assertPermissionsWhitelisted,
} from '../access-control/user-authorization.policy';
import type { AuthUser } from '../access-control/decorators/current-user.decorator';

export const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
  customPermissions: true,
} as const;

export type UserPublicRow = {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  customPermissions: string[];
};

export function toUserResponse(row: UserPublicRow): UserResponseDto {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    isActive: row.isActive,
    createdAt: row.createdAt,
    customPermissions: row.customPermissions ? [...row.customPermissions] : [],
    permissions: getEffectivePermissions(row),
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authSessionsService: AuthSessionsService,
  ) {}

  async findById(id: string): Promise<UserResponseDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_PUBLIC_SELECT,
    });
    return user ? toUserResponse(user) : null;
  }

  // Returns the raw Prisma User (includes password hash) — internal use by
  // AuthService only, never serialize this directly into an API response.
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findAll(query: ListUsersQueryDto) {
    const { limit = 20, offset = 0, search, role, isActive, sortBy, sortOrder } = query;
    const where = {
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' as const } },
              { name: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(role?.length ? { role: { in: role } } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    };

    const orderBy: Prisma.UserOrderByWithRelationInput = sortBy ? { [sortBy]: sortOrder ?? 'asc' } : { email: 'asc' };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({ where, skip: offset, take: limit, select: USER_PUBLIC_SELECT, orderBy }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: data.map(toUserResponse),
      meta: { total, limit, offset, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(dto: CreateUserDto, actor: AuthUser): Promise<UserResponseDto> {
    const role = dto.role ?? Role.EMPLOYEE;
    const customPermissions = dto.customPermissions
      ? normalizeCustomPermissions(role, dto.customPermissions)
      : [];

    assertPermissionsWhitelisted(customPermissions);
    assertNoPrivilegeAmplification(actor, {
      roleBefore: Role.EMPLOYEE,
      roleAfter: role,
      before: [],
      after: customPermissions,
    });

    const passwordHash = await this.hashPassword(dto.password);
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          password: passwordHash,
          name: dto.name,
          role,
          customPermissions,
        },
        select: USER_PUBLIC_SELECT,
      });
      return toUserResponse(user);
    } catch (err) {
      if (this.isUniqueConstraintError(err)) {
        throw new ConflictException('Email đã tồn tại');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthUser): Promise<UserResponseDto> {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException(`User ${id} not found`);
    }

    if (actor.id !== target.id) {
      assertActorCanManageTarget(actor, target);
    }

    const targetRoleBefore = target.role;
    const targetRoleAfter = dto.role ?? target.role;
    const targetCustomBefore = normalizeCustomPermissions(targetRoleBefore, target.customPermissions ?? []);

    let targetCustomAfter: string[];
    if (dto.customPermissions !== undefined) {
      targetCustomAfter = normalizeCustomPermissions(targetRoleAfter, dto.customPermissions);
    } else if (dto.role !== undefined && dto.role !== target.role) {
      targetCustomAfter = normalizeCustomPermissions(targetRoleAfter, target.customPermissions ?? []);
    } else {
      targetCustomAfter = targetCustomBefore;
    }

    const addedPermissions = targetCustomAfter.filter((p) => !targetCustomBefore.includes(p));
    assertPermissionsWhitelisted(addedPermissions);

    assertNotSelfLockout(actor, target, {
      role: dto.role,
      customPermissions: dto.customPermissions,
    });

    assertNoPrivilegeAmplification(actor, {
      roleBefore: targetRoleBefore,
      roleAfter: targetRoleAfter,
      before: targetCustomBefore,
      after: targetCustomAfter,
    });

    if (target.role === Role.ADMIN && targetRoleAfter !== Role.ADMIN && target.isActive) {
      const activeAdmins = await this.prisma.user.count({
        where: { role: Role.ADMIN, isActive: true },
      });
      if (activeAdmins <= 1) {
        throw new BadRequestException('Không thể giáng cấp quản trị viên duy nhất còn lại');
      }
    }

    const data: {
      email?: string;
      password?: string;
      name?: string;
      role?: Role;
      customPermissions?: string[];
    } = {};
    if (dto.email !== undefined) data.email = dto.email.toLowerCase();
    if (dto.password !== undefined) data.password = await this.hashPassword(dto.password);
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.customPermissions !== undefined || (dto.role !== undefined && dto.role !== target.role)) {
      data.customPermissions = targetCustomAfter;
    }

    try {
      const result = await this.prisma.user.updateMany({
        where: {
          id,
          role: target.role,
          isActive: target.isActive,
          customPermissions: { equals: target.customPermissions },
        },
        data,
      });
      if (result.count === 0) {
        throw new ConflictException('Dữ liệu người dùng đã thay đổi, tải lại và thử lại');
      }
      const updated = await this.findById(id);
      return updated!;
    } catch (err) {
      if (this.isUniqueConstraintError(err)) {
        throw new ConflictException('Email đã tồn tại');
      }
      throw err;
    }
  }

  async deactivate(id: string, actor: AuthUser): Promise<UserResponseDto> {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException(`User ${id} not found`);
    }

    if (actor.id !== target.id) {
      assertActorCanManageTarget(actor, target);
    }

    assertNotSelfLockout(actor, target, { isActive: false });

    if (target.role === Role.ADMIN && target.isActive) {
      const activeAdmins = await this.prisma.user.count({
        where: { role: Role.ADMIN, isActive: true },
      });
      if (activeAdmins <= 1) {
        throw new BadRequestException('Không thể vô hiệu hoá quản trị viên cuối cùng');
      }
    }

    const result = await this.prisma.user.updateMany({
      where: {
        id,
        role: target.role,
        isActive: target.isActive,
        customPermissions: { equals: target.customPermissions },
      },
      data: { isActive: false },
    });
    if (result.count === 0) {
      throw new ConflictException('Dữ liệu người dùng đã thay đổi, tải lại và thử lại');
    }

    await this.authSessionsService.revokeAllUserSessions(id);
    const updated = await this.findById(id);
    return updated!;
  }

  async reactivate(id: string, actor: AuthUser): Promise<UserResponseDto> {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException(`User ${id} not found`);
    }

    if (actor.id !== target.id) {
      assertActorCanManageTarget(actor, target);
    }

    assertNotSelfLockout(actor, target, { isActive: true });

    const result = await this.prisma.user.updateMany({
      where: {
        id,
        role: target.role,
        isActive: target.isActive,
        customPermissions: { equals: target.customPermissions },
      },
      data: { isActive: true },
    });
    if (result.count === 0) {
      throw new ConflictException('Dữ liệu người dùng đã thay đổi, tải lại và thử lại');
    }

    const updated = await this.findById(id);
    return updated!;
  }

  getPermissionCatalog(): PermissionCatalogResponseDto {
    return {
      permissions: PERMISSION_CATALOG.map((item) => ({
        key: item.key,
        label: item.label,
        category: item.category,
        implies: 'implies' in item && Array.isArray(item.implies) ? [...item.implies] : [],
      })),
      roles: {
        ADMIN: [...ROLE_PERMISSIONS[Role.ADMIN]],
        EMPLOYEE: [...ROLE_PERMISSIONS[Role.EMPLOYEE]],
      },
    };
  }

  private hashPassword(plain: string): Promise<string> {
    return argon2.hash(plain, ARGON2_OPTIONS);
  }

  private isUniqueConstraintError(err: unknown): boolean {
    return typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002';
  }
}
