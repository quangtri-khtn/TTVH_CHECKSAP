import { NotFoundException } from '@nestjs/common';
import { SapStoreService } from './sap-store.service';

describe('SapStoreService', () => {
  const createMocks = () => {
    const prisma = {
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      sapStore: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        updateMany: jest.fn(),
      },
      sapBrand: {
        upsert: jest.fn(),
      },
    };
    const gateway = {
      run: jest.fn(),
    };
    const service = new SapStoreService(prisma as never, gateway as never);
    return { prisma, gateway, service };
  };

  describe('getActiveStoreCodes', () => {
    it('trả về Set chứa đúng các mã kho active và truy vấn đúng cờ theo luồng', async () => {
      const { prisma, service } = createMocks();
      prisma.sapStore.findMany.mockResolvedValue([
        { code: 'MC001' },
        { code: 'MC073' },
      ]);

      const salesSet = await service.getActiveStoreCodes('5001', 'sales');
      expect(prisma.sapStore.findMany).toHaveBeenCalledWith({
        where: { brandCode: '5001', isActiveSales: true },
        select: { code: true },
      });
      expect([...salesSet]).toEqual(['MC001', 'MC073']);

      prisma.sapStore.findMany.mockResolvedValue([]);
      const returnSet = await service.getActiveStoreCodes('5002', 'return');
      expect(prisma.sapStore.findMany).toHaveBeenCalledWith({
        where: { brandCode: '5002', isActiveReturn: true },
        select: { code: true },
      });
      expect(returnSet.size).toBe(0);
    });

    it('khi brandCode=ALL: chỉ trả về đúng các kho đang bật (không tự bật lại các brand đã tắt)', async () => {
      const { prisma, service } = createMocks();
      prisma.sapStore.findMany.mockResolvedValue([
        { code: 'MC001' },
        { code: 'MC002' },
      ]);

      const allSalesSet = await service.getActiveStoreCodes('ALL', 'sales');
      expect(prisma.sapStore.findMany).toHaveBeenCalledWith({
        where: { isActiveSales: true },
        select: { code: true },
      });
      expect([...allSalesSet]).toEqual(['MC001', 'MC002']);
    });
  });

  describe('update', () => {
    it('ném NotFoundException khi mã kho không tồn tại', async () => {
      const { prisma, service } = createMocks();
      prisma.sapStore.findUnique.mockResolvedValue(null);

      await expect(
        service.update('UNKNOWN', { isActiveSales: true }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('cập nhật cờ isActiveSales/isActiveReturn và tăng configEpoch', async () => {
      const { prisma, service } = createMocks();
      const now = new Date('2026-10-26T02:00:00.000Z');
      prisma.sapStore.findUnique.mockResolvedValue({ code: 'MC001' });
      prisma.sapStore.update.mockResolvedValue({
        code: 'MC001',
        name: 'MC-001 Nguyễn Trãi',
        brandCode: '5001',
        brand: { name: 'Maycha' },
        sapInactive: false,
        isActiveSales: true,
        isActiveReturn: false,
        syncedAt: now,
      });

      const epochBefore = service.getConfigEpoch();
      const res = await service.update('MC001', {
        isActiveSales: true,
        isActiveReturn: false,
      });

      expect(prisma.sapStore.update).toHaveBeenCalledWith({
        where: { code: 'MC001' },
        data: { isActiveSales: true, isActiveReturn: false },
        include: { brand: { select: { name: true } } },
      });
      expect(res.isActiveSales).toBe(true);
      expect(res.brandName).toBe('Maycha');
      expect(service.getConfigEpoch()).toBe(epochBefore + 1);
    });
  });

  describe('bulkUpdateByBrand', () => {
    it('khi isActive=true: bật các kho sapInactive=false của đúng brandCode, tắt kho sapInactive=true và tăng configEpoch', async () => {
      const { prisma, service } = createMocks();
      prisma.sapStore.updateMany
        .mockResolvedValueOnce({ count: 84 })
        .mockResolvedValueOnce({ count: 11 });

      const epochBefore = service.getConfigEpoch();
      const res = await service.bulkUpdateByBrand({
        brandCode: '5001',
        isActive: true,
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.sapStore.updateMany).toHaveBeenNthCalledWith(1, {
        where: { brandCode: '5001', sapInactive: false },
        data: { isActiveSales: true, isActiveReturn: true },
      });
      expect(prisma.sapStore.updateMany).toHaveBeenNthCalledWith(2, {
        where: { brandCode: '5001', sapInactive: true },
        data: { isActiveSales: false, isActiveReturn: false },
      });
      expect(res).toEqual({
        brandCode: '5001',
        isActive: true,
        updatedCount: 84,
      });
      expect(service.getConfigEpoch()).toBe(epochBefore + 1);
    });

    it('khi isActive=false: tắt toàn bộ kho thuộc đúng brandCode và tăng configEpoch', async () => {
      const { prisma, service } = createMocks();
      prisma.sapStore.updateMany.mockResolvedValueOnce({ count: 130 });

      const epochBefore = service.getConfigEpoch();
      const res = await service.bulkUpdateByBrand({
        brandCode: '5002',
        isActive: false,
      });

      expect(prisma.sapStore.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.sapStore.updateMany).toHaveBeenCalledWith({
        where: { brandCode: '5002' },
        data: { isActiveSales: false, isActiveReturn: false },
      });
      expect(res).toEqual({
        brandCode: '5002',
        isActive: false,
        updatedCount: 130,
      });
      expect(service.getConfigEpoch()).toBe(epochBefore + 1);
    });
  });

  describe('syncFromSap', () => {
    it('bảo lưu nguyên vẹn cờ isActiveSales/isActiveReturn của kho cũ và đặt false cho kho mới', async () => {
      const { prisma, gateway, service } = createMocks();
      prisma.sapStore.findMany.mockResolvedValue([{ code: 'MC001' }]);
      gateway.run.mockResolvedValue({
        columns: ['WhsCode', 'WhsName', 'U_Brand', 'Inactive'],
        rows: [
          ['MC001', 'MC-001 Đã Đổi Tên', '5001', 'N'],
          ['MC999', 'MC-999 Cửa Hàng Mới', '5001', 'N'],
          ['BB088', 'BB-088 Đã Ngưng', '5002', 'Y'],
        ],
      });
      prisma.sapBrand.upsert.mockResolvedValue({});
      prisma.sapStore.upsert.mockResolvedValue({});

      const summary = await service.syncFromSap();

      expect(summary.totalFetched).toBe(3);
      expect(summary.inserted).toBe(2);
      expect(summary.updated).toBe(1);

      const firstUpsertArg = prisma.sapStore.upsert.mock.calls[0][0];
      expect(firstUpsertArg.where).toEqual({ code: 'MC001' });
      expect(firstUpsertArg.update).not.toHaveProperty('isActiveSales');
      expect(firstUpsertArg.update).not.toHaveProperty('isActiveReturn');
      expect(firstUpsertArg.update).toMatchObject({
        name: 'MC-001 Đã Đổi Tên',
        brandCode: '5001',
        sapInactive: false,
      });

      const thirdUpsertArg = prisma.sapStore.upsert.mock.calls[2][0];
      expect(thirdUpsertArg.where).toEqual({ code: 'BB088' });
      expect(thirdUpsertArg.create).toMatchObject({
        code: 'BB088',
        name: 'BB-088 Đã Ngưng',
        brandCode: '5002',
        sapInactive: true,
        isActiveSales: false,
        isActiveReturn: false,
      });
    });
  });
});
