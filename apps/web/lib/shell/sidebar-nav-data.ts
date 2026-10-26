import {
  Activity,
  Database,
  RotateCcw,
  Store,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { PERMISSIONS } from '@/lib/auth/permission-keys';
import { hasAnyPermission } from '@/lib/auth/has-permission';

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Khớp cả route con (vd /admin/users/123) thay vì chỉ khớp tuyệt đối. */
  matchNested?: boolean;
  /** Quyền yêu cầu (any-of). Nếu bỏ trống = ai cũng thấy. */
  requiredPermissions?: readonly string[] | string[];
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const ADMIN_AREA_PERMISSIONS: readonly string[] = [
  PERMISSIONS.SAP_CONNECTION_MANAGE,
  PERMISSIONS.SAP_STORE_MANAGE,
  PERMISSIONS.USER_READ,
  PERMISSIONS.USER_MANAGE,
];

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'SAP Monitor',
    items: [
      {
        title: 'Monitor Bán hàng',
        href: '/sap/monitor-ban',
        icon: Activity,
        matchNested: true,
        requiredPermissions: [PERMISSIONS.SAP_MONITOR_READ],
      },
      {
        title: 'Monitor Luồng trả',
        href: '/sap/monitor-tra',
        icon: RotateCcw,
        matchNested: true,
        requiredPermissions: [PERMISSIONS.SAP_MONITOR_READ],
      },
    ],
  },
  {
    title: 'Quản trị hệ thống',
    items: [
      {
        title: 'Kết nối SAP',
        href: '/admin/sap-connections',
        icon: Database,
        requiredPermissions: [PERMISSIONS.SAP_CONNECTION_MANAGE],
      },
      {
        title: 'Cửa hàng SAP',
        href: '/admin/sap-stores',
        icon: Store,
        requiredPermissions: [PERMISSIONS.SAP_STORE_MANAGE],
      },
      {
        title: 'Người dùng',
        href: '/admin/users',
        icon: Users,
        requiredPermissions: [PERMISSIONS.USER_READ],
      },
    ],
  },
];

/**
 * Lọc menu theo permissions. Đây chỉ là UX — quyền thật do backend quyết định qua
 * PermissionsGuard.
 */
export function getNavGroups(
  permissions: readonly string[] | string[] | undefined,
): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (!item.requiredPermissions || item.requiredPermissions.length === 0) {
        return true;
      }
      return hasAnyPermission(permissions, item.requiredPermissions);
    }),
  })).filter((group) => group.items.length > 0);
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.matchNested) {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }
  return pathname === item.href;
}
