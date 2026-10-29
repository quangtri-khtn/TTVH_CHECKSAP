import { NotFoundException } from '@nestjs/common';
import { SapStoreService } from './sap-store.service';

describe('SapStoreService', () => {
  const createMocks = () => {
    const prisma = {
      sapStore: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
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

    it('khi brandCode=ALL (Phương án A): lấy kho active của brand đã cấu hình và fallback lấy toàn bộ kho của brand chưa bật kho active nào', async () => {
      const { prisma, service } = createMocks();
      prisma.sapStore.findMany.mockResolvedValue([
        { code: 'MC001', brandCode: '5001', isActiveSales: true, isActiveReturn: true },
        { code: 'MC002', brandCode: '5001', isActiveSales: false, isActiveReturn: false },
        { code: 'CK001', brandCode: '5004', isActiveSales: false, isActiveReturn: false },
        { code: 'CK002', brandCode: '5004', isActiveSales: false, isActiveReturn: false },
      ]);

      const allSalesSet = await service.getActiveStoreCodes('ALL', 'sales');
      expect([...allSalesSet]).toEqual(['MC001', 'CK001', 'CK002']);
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
