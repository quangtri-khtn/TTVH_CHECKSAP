import { Test, TestingModule } from '@nestjs/testing';
import { UsersService, USER_PUBLIC_SELECT } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthSessionsService } from '../auth-sessions/auth-sessions.service';
import { Role } from '../../generated/prisma/enums';
import { PERMISSIONS } from '../access-control/permission-catalog';

describe('UsersService', () => {
  let service: UsersService;
  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const authSessionsServiceMock = {
    revokeAllUserSessions: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuthSessionsService, useValue: authSessionsServiceMock },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findById', () => {
    it('selects customPermissions via USER_PUBLIC_SELECT and returns calculated permissions', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user1@example.com',
        name: 'User One',
        role: Role.EMPLOYEE,
        isActive: true,
        createdAt: new Date('2026-01-01'),
        customPermissions: [PERMISSIONS.SAP_CONNECTION_MANAGE],
      });

      const result = await service.findById('user-1');

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: USER_PUBLIC_SELECT,
      });
      expect(result).toEqual({
        id: 'user-1',
        email: 'user1@example.com',
        name: 'User One',
        role: Role.EMPLOYEE,
        isActive: true,
        createdAt: new Date('2026-01-01'),
        customPermissions: [PERMISSIONS.SAP_CONNECTION_MANAGE],
        permissions: [
          PERMISSIONS.SAP_CONNECTION_MANAGE,
          PERMISSIONS.SAP_MONITOR_READ,
        ],
      });
    });

    it('returns null when user is not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      const result = await service.findById('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getPermissionCatalog', () => {
    it('returns catalog items and role mapping', () => {
      const catalog = service.getPermissionCatalog();
      expect(catalog.permissions.length).toBe(4);
      expect(catalog.roles.ADMIN).toEqual(['*']);
      expect(catalog.roles.EMPLOYEE).toEqual([PERMISSIONS.SAP_MONITOR_READ]);
    });
  });
});
