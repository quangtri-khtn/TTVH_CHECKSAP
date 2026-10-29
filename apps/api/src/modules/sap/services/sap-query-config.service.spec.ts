import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  SAP_QUERY_CATALOG,
  SAP_QUERY_CATALOG_BY_KEY,
  type SapQueryKey,
} from '../queries/sap-query-catalog';
import { computeSqlHash, normalizeSqlText } from '../lib/sap-query-template-engine';
import { SapQueryConfigService } from './sap-query-config.service';

interface InMemoryDef {
  key: string;
  flow: string;
  stage: string;
  sortOrder: number;
  title: string;
  description: string;
  impactBadges: string[];
  allowedPlaceholders: string[];
  requiredColumns: string[];
  baselineColumns: string[];
  dedupKeys: string[];
  supportsExtraColumns: boolean;
  defaultSql: string;
  currentVersionNo: number;
  lastTestedSqlHash: string | null;
  lastTestedAt: Date | null;
  lastTestedById: string | null;
  lastTestRowCount: number | null;
  lastTestDurationMs: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface InMemoryVersion {
  id: string;
  queryKey: string;
  versionNo: number;
  sqlText: string;
  sqlHash: string;
  changeNote: string;
  createdById: string | null;
  createdBy: string | null;
  createdAt: Date;
}

interface InMemoryAudit {
  id: string;
  queryKey: string;
  action: string;
  fromVersion: number | null;
  toVersion: number | null;
  beforeSql: string | null;
  afterSql: string | null;
  changeNote: string | null;
  actorId: string | null;
  actorName: string | null;
  createdAt: Date;
}

interface FakePrisma {
  sapQueryDef: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  sapQueryVersion: {
    findUnique: jest.Mock;
    upsert: jest.Mock;
    aggregate: jest.Mock;
    create: jest.Mock;
  };
  sapQueryAudit: {
    create: jest.Mock;
  };
  $transaction: jest.Mock;
  _defs: Map<string, InMemoryDef>;
  _versions: InMemoryVersion[];
  _audits: InMemoryAudit[];
}

function createFakePrisma(): FakePrisma {
  const defs = new Map<string, InMemoryDef>();
  const versions: InMemoryVersion[] = [];
  const audits: InMemoryAudit[] = [];
  let seq = 1;

  const client = {
    sapQueryDef: {
      findMany: jest.fn(async (args?: { include?: { versions?: boolean }; orderBy?: { sortOrder?: 'asc' } }) => {
        const list = Array.from(defs.values()).sort(
          (a, b) => a.sortOrder - b.sortOrder,
        );
        if (args?.include?.versions) {
          return list.map((d) => ({
            ...d,
            versions: versions.filter((v) => v.queryKey === d.key),
          }));
        }
        return list;
      }),
      findUnique: jest.fn(async (args: { where: { key: string }; include?: { versions?: unknown; audits?: unknown } }) => {
        const d = defs.get(args.where.key);
        if (!d) return null;
        if (args.include) {
          return {
            ...d,
            versions: versions
              .filter((v) => v.queryKey === d.key)
              .sort((a, b) => b.versionNo - a.versionNo),
            audits: audits
              .filter((a) => a.queryKey === d.key)
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
          };
        }
        return d;
      }),
      create: jest.fn(async (args: { data: Record<string, unknown> }) => {
        const data = args.data;
        const now = new Date();
        const key = String(data.key);
        const def: InMemoryDef = {
          key,
          flow: String(data.flow),
          stage: String(data.stage),
          sortOrder: Number(data.sortOrder),
          title: String(data.title),
          description: String(data.description),
          impactBadges: (data.impactBadges as string[]) ?? [],
          allowedPlaceholders: (data.allowedPlaceholders as string[]) ?? [],
          requiredColumns: (data.requiredColumns as string[]) ?? [],
          baselineColumns: (data.baselineColumns as string[]) ?? [],
          dedupKeys: (data.dedupKeys as string[]) ?? [],
          supportsExtraColumns: Boolean(data.supportsExtraColumns),
          defaultSql: String(data.defaultSql),
          currentVersionNo: Number(data.currentVersionNo ?? 1),
          lastTestedSqlHash: null,
          lastTestedAt: null,
          lastTestedById: null,
          lastTestRowCount: null,
          lastTestDurationMs: null,
          createdAt: now,
          updatedAt: now,
        };
        defs.set(key, def);
        const nestedVer = (data.versions as { create?: Record<string, unknown> } | undefined)?.create;
        if (nestedVer) {
          versions.push({
            id: `ver_${seq++}`,
            queryKey: key,
            versionNo: Number(nestedVer.versionNo),
            sqlText: String(nestedVer.sqlText),
            sqlHash: String(nestedVer.sqlHash),
            changeNote: String(nestedVer.changeNote),
            createdById: (nestedVer.createdById as string | null) ?? null,
            createdBy: (nestedVer.createdBy as string | null) ?? null,
            createdAt: now,
          });
        }
        return def;
      }),
      update: jest.fn(async (args: { where: { key: string }; data: Record<string, unknown> }) => {
        const d = defs.get(args.where.key);
        if (!d) throw new Error(`Missing def ${args.where.key}`);
        Object.assign(d, args.data, { updatedAt: new Date() });
        return d;
      }),
    },
    sapQueryVersion: {
      findUnique: jest.fn(
        async (args: {
          where: { queryKey_versionNo: { queryKey: string; versionNo: number } };
        }) => {
          const { queryKey, versionNo } = args.where.queryKey_versionNo;
          return (
            versions.find(
              (v) => v.queryKey === queryKey && v.versionNo === versionNo,
            ) ?? null
          );
        },
      ),
      upsert: jest.fn(),
      aggregate: jest.fn(async (args: { where: { queryKey: string } }) => {
        const matching = versions.filter(
          (v) => v.queryKey === args.where.queryKey,
        );
        const maxVer = matching.reduce(
          (max, v) => Math.max(max, v.versionNo),
          0,
        );
        return { _max: { versionNo: maxVer || null } };
      }),
      create: jest.fn(async (args: { data: Record<string, unknown> }) => {
        const d = args.data;
        const item: InMemoryVersion = {
          id: `ver_${seq++}`,
          queryKey: String(d.queryKey),
          versionNo: Number(d.versionNo),
          sqlText: String(d.sqlText),
          sqlHash: String(d.sqlHash),
          changeNote: String(d.changeNote),
          createdById: (d.createdById as string | null) ?? null,
          createdBy: (d.createdBy as string | null) ?? null,
          createdAt: new Date(),
        };
        versions.push(item);
        return item;
      }),
    },
    sapQueryAudit: {
      create: jest.fn(async (args: { data: Record<string, unknown> }) => {
        const d = args.data;
        const item: InMemoryAudit = {
          id: `aud_${seq++}`,
          queryKey: String(d.queryKey),
          action: String(d.action),
          fromVersion: (d.fromVersion as number | null) ?? null,
          toVersion: (d.toVersion as number | null) ?? null,
          beforeSql: (d.beforeSql as string | null) ?? null,
          afterSql: (d.afterSql as string | null) ?? null,
          changeNote: (d.changeNote as string | null) ?? null,
          actorId: (d.actorId as string | null) ?? null,
          actorName: (d.actorName as string | null) ?? null,
          createdAt: new Date(),
        };
        audits.push(item);
        return item;
      }),
    },
    $transaction: jest.fn(async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      return fn(client);
    }),
    _defs: defs,
    _versions: versions,
    _audits: audits,
  };

  return client;
}

describe('SapQueryConfigService', () => {
  let prisma: FakePrisma;
  let gateway: { run: jest.Mock };
  let service: SapQueryConfigService;

  beforeEach(() => {
    prisma = createFakePrisma();
    gateway = {
      run: jest.fn(),
    };
    service = new SapQueryConfigService(
      prisma as never,
      gateway as never,
    );
  });

  it('lazy-seeds all 25 catalog queries on first call (single-flight initPromise) and returns frozen snapshot', async () => {
    const [list, snap] = await Promise.all([
      service.findAll(),
      service.getSnapshot(),
    ]);

    expect(list).toHaveLength(25);
    expect(snap.epoch).toBe(0);
    expect(snap.sqlByKey.size).toBe(25);
    expect(prisma.sapQueryDef.findMany).toHaveBeenCalledTimes(2); // 1 in doInitialize + 1 in findAll

    for (const entry of SAP_QUERY_CATALOG) {
      expect(snap.sqlByKey.get(entry.key)).toBe(
        normalizeSqlText(entry.defaultSql),
      );
      expect(snap.versionByKey.get(entry.key)).toBe(1);
    }
  });

  it('builds sales list, sales chain, return main, and return old discovery SQL maps from snapshot', async () => {
    const snap = await service.getSnapshot();
    const salesList = service.buildSalesListSqlMap(snap, '20261007', '5001');
    const salesChain = service.buildSalesChainSqlMap(
      snap,
      '20261007',
      '5001',
      [1001],
    );
    const retMain = service.buildReturnMainSqlMap(
      snap,
      '20261007',
      '5001',
      [2001],
    );
    const retOld = service.buildReturnOldDiscoverySqlMap(
      snap,
      '20261007',
      '5001',
    );

    expect(Object.keys(salesList)).toHaveLength(8);
    expect(salesChain.po).toBe(salesChain.chain_po);
    expect(retMain.po).toBe(retMain.ret_po);
    expect(Object.keys(retOld)).toEqual([
      'ret_old_1',
      'ret_old_2',
      'ret_old_3',
      'ret_old_4',
      'ret_old_5',
    ]);
  });

  it('rejects concurrent review calls with 409 Conflict to protect FifoLock', async () => {
    await service.getSnapshot();
    const t1Sql = SAP_QUERY_CATALOG_BY_KEY.t1.defaultSql;

    let resolveGateway!: (value: unknown) => void;
    gateway.run.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGateway = resolve;
        }),
    );

    const firstReview = service.review('t1', {
      sqlText: t1Sql,
      dateFrom: '20261007',
      brand: '5001',
    });

    await expect(
      service.review('t2', {
        sqlText: SAP_QUERY_CATALOG_BY_KEY.t2.defaultSql,
        dateFrom: '20261007',
        brand: '5001',
      }),
    ).rejects.toThrow(ConflictException);

    resolveGateway({
      columns: [...SAP_QUERY_CATALOG_BY_KEY.t1.baselineColumns],
      rows: [['MC001', 1001, '2026-10-07', '2026-10-07', 'O', 2, 'Chua co SO']],
    });

    const firstRes = await firstReview;
    expect(firstRes.valid).toBe(true);
  });

  it('blocks publish when query was not reviewed or sqlHash changed after review, and allows publish after valid review', async () => {
    const t1Entry = SAP_QUERY_CATALOG_BY_KEY.t1;
    const customSql = t1Entry.defaultSql.replace(
      'SELECT P."U_Store" AS "Store",',
      'SELECT P."U_Store" AS "Store", P."Comments" AS "Ghi chu PO",',
    );

    // Chưa review -> chặn publish
    await expect(
      service.publish('t1', {
        sqlText: customSql,
        changeNote: 'Thêm cột Ghi chú PO',
      }),
    ).rejects.toThrow(BadRequestException);

    // Chạy review hợp lệ
    gateway.run.mockResolvedValueOnce({
      columns: [...t1Entry.baselineColumns, 'Ghi chu PO'],
      rows: [
        [
          'MC001',
          1001,
          '2026-10-07',
          '2026-10-07',
          'O',
          2,
          'Chua co SO',
          'Ghi chú thử nghiệm',
        ],
      ],
    });

    const reviewRes = await service.review(
      't1',
      { sqlText: customSql, dateFrom: '20261007', brand: '5001' },
      { id: 'u1', name: 'IT Admin' },
    );
    expect(reviewRes.valid).toBe(true);
    expect(reviewRes.extraColumns).toEqual(['Ghi chu PO']);
    expect(reviewRes.sqlHash).toBe(computeSqlHash(customSql));

    // Sửa SQL sau khi review (lệch sqlHash) -> chặn publish
    await expect(
      service.publish('t1', {
        sqlText: customSql.replace('Ghi chu PO', 'Ghi chu khac'),
        changeNote: 'Đổi tên cột nhưng chưa review lại',
      }),
    ).rejects.toThrow(BadRequestException);

    // Giữ snapshot trước khi publish để kiểm chứng tính bất biến (Frozen Snapshot)
    const frozenBeforePublish = await service.getSnapshot();
    expect(frozenBeforePublish.epoch).toBe(0);
    expect(frozenBeforePublish.sqlByKey.get('t1')).toBe(
      normalizeSqlText(t1Entry.defaultSql),
    );

    // Publish đúng bản đã review -> tạo version v2 append-only và tăng configEpoch
    const detailAfterPublish = await service.publish(
      't1',
      {
        sqlText: customSql,
        changeNote: 'Thêm cột Ghi chú PO cho vận hành',
      },
      { id: 'u1', name: 'IT Admin' },
    );

    expect(detailAfterPublish.currentVersionNo).toBe(2);
    expect(detailAfterPublish.isCustomized).toBe(true);
    expect(detailAfterPublish.activeSql).toBe(normalizeSqlText(customSql));
    expect(service.getConfigEpoch()).toBe(1);

    // Snapshot cũ vẫn bất biến (giữ v1), snapshot mới mang v2
    expect(frozenBeforePublish.sqlByKey.get('t1')).toBe(
      normalizeSqlText(t1Entry.defaultSql),
    );
    const newSnapshot = await service.getSnapshot();
    expect(newSnapshot.epoch).toBe(1);
    expect(newSnapshot.sqlByKey.get('t1')).toBe(normalizeSqlText(customSql));
    expect(newSnapshot.versionByKey.get('t1')).toBe(2);

    // Rollback về v1 -> tạo v3 append-only (MAX + 1)
    const detailAfterRollback = await service.rollback(
      't1',
      { targetVersionNo: 1, changeNote: 'Hoàn tác về bản v1' },
      { id: 'u1', name: 'IT Admin' },
    );
    expect(detailAfterRollback.currentVersionNo).toBe(3);
    expect(detailAfterRollback.isCustomized).toBe(false);
    expect(detailAfterRollback.activeSql).toBe(
      normalizeSqlText(t1Entry.defaultSql),
    );
    expect(service.getConfigEpoch()).toBe(2);

    // Reset default -> tạo v4 append-only
    const detailAfterReset = await service.resetDefault(
      't1',
      { changeNote: 'Khôi phục mặc định' },
      { id: 'u1', name: 'IT Admin' },
    );
    expect(detailAfterReset.currentVersionNo).toBe(4);
    expect(service.getConfigEpoch()).toBe(3);
  });

  it('records a review audit row and resets isReviewRunning when gateway.run throws on SAP execution', async () => {
    await service.getSnapshot();
    gateway.run.mockRejectedValueOnce(new Error('HANA syntax error'));

    await expect(
      service.review(
        't1',
        {
          sqlText: SAP_QUERY_CATALOG_BY_KEY.t1.defaultSql,
          dateFrom: '20261007',
          brand: '5001',
        },
        { id: 'u1', name: 'IT Admin' },
      ),
    ).rejects.toThrow('HANA syntax error');

    expect(prisma._audits).toHaveLength(1);
    expect(prisma._audits[0]?.action).toBe('review');
    expect(prisma._audits[0]?.changeNote).toContain(
      'Chạy thử trên SAP thất bại',
    );

    // Subsequent review must not be blocked by isReviewRunning
    gateway.run.mockResolvedValueOnce({
      columns: [...SAP_QUERY_CATALOG_BY_KEY.t1.baselineColumns],
      rows: [['MC001', 1001, '2026-10-07', '2026-10-07', 'O', 2, 'Chua co SO']],
    });
    const retryRes = await service.review('t1', {
      sqlText: SAP_QUERY_CATALOG_BY_KEY.t1.defaultSql,
      dateFrom: '20261007',
      brand: '5001',
    });
    expect(retryRes.valid).toBe(true);
  });

  it('throws NotFoundException on unknown query key', async () => {
    await expect(
      service.findOne('invalid_key' as SapQueryKey),
    ).rejects.toThrow(NotFoundException);
  });
});
