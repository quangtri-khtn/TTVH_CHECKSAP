import { LayoutGrid } from 'lucide-react';
import { PERMISSIONS } from '@/lib/auth/permission-keys';
import { getNavGroups, isNavItemActive, type NavItem } from './sidebar-nav-data';

function makeItem(overrides: Partial<NavItem> = {}): NavItem {
  return { title: 'Test', href: '/test', icon: LayoutGrid, ...overrides };
}

describe('getNavGroups', () => {
  it('* thấy đủ 2 nhóm SAP Monitor và Quản trị hệ thống', () => {
    const groups = getNavGroups(['*']);
    expect(groups.map((g) => g.title)).toEqual(['SAP Monitor', 'Quản trị hệ thống']);
    expect(groups[0]?.items.map((i) => i.href)).toEqual([
      '/sap/monitor-ban',
      '/sap/monitor-tra',
    ]);
    expect(groups[1]?.items.map((i) => i.href)).toEqual([
      '/admin/sap-connections',
      '/admin/sap-stores',
      '/admin/users',
    ]);
  });

  it('nhân viên chỉ có quyền sap-monitor:read chỉ thấy nhóm SAP Monitor', () => {
    const groups = getNavGroups([PERMISSIONS.SAP_MONITOR_READ]);
    expect(groups.map((g) => g.title)).toEqual(['SAP Monitor']);
  });

  it('người dùng có quyền sap-store:manage thấy mục Cửa hàng SAP trong nhóm Quản trị', () => {
    const groups = getNavGroups([PERMISSIONS.SAP_STORE_MANAGE]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.items.map((i) => i.href)).toEqual(['/admin/sap-stores']);
  });
});

describe('isNavItemActive', () => {
  it('khớp tuyệt đối cho mục không bật matchNested', () => {
    const item = makeItem({ href: '/admin/users' });
    expect(isNavItemActive(item, '/admin/users')).toBe(true);
    expect(isNavItemActive(item, '/admin/users/123')).toBe(false);
  });

  it('khớp route con khi bật matchNested', () => {
    const item = makeItem({ href: '/sap/monitor-ban', matchNested: true });
    expect(isNavItemActive(item, '/sap/monitor-ban')).toBe(true);
    expect(isNavItemActive(item, '/sap/monitor-ban/detail')).toBe(true);
  });
});
