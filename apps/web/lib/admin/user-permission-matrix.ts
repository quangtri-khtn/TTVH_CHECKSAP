import type { PermissionCatalogItemDto, RolePermissionsDto } from '@/lib/api/generated/model';
export interface PermissionRowState {
  key: string;
  label: string;
  category: string;
  inheritedFromRole: boolean;
  impliedBy?: string;
  grantedAsCustom: boolean;
  checked: boolean;
  disabled: boolean;
}

export interface PermissionGroupState {
  category: string;
  permissions: PermissionRowState[];
}
export interface BuildPermissionMatrixParams {
  catalog: readonly PermissionCatalogItemDto[] | PermissionCatalogItemDto[];
  rolePermissions: RolePermissionsDto | Record<string, readonly string[] | string[]>;
  selectedRole: string;
  selectedCustomPermissions: readonly string[] | string[];
  actorPermissions: readonly string[] | string[];
  readOnly?: boolean;
}

/**
 * Đảo trạng thái một quyền trong danh sách custom permissions đang chọn.
 */
export function togglePermission(current: readonly string[] | string[], key: string): string[] {
  const list = Array.from(current);
  if (list.includes(key)) {
    return list.filter((k) => k !== key);
  }
  return [...list, key];
}

/**
 * Lọc chỉ lấy các quyền custom thực sự (loại bỏ quyền đã có từ vai trò hoặc được kéo theo).
 */
export function toCustomPayload(
  input: readonly PermissionRowState[] | readonly PermissionGroupState[] | PermissionRowState[] | PermissionGroupState[],
): string[] {
  if (!input || input.length === 0) {
    return [];
  }

  const rows: PermissionRowState[] = 'permissions' in input[0]
    ? (input as PermissionGroupState[]).flatMap((g) => g.permissions)
    : (input as PermissionRowState[]);

  return rows
    .filter((row) => row.grantedAsCustom && !row.inheritedFromRole && !row.impliedBy)
    .map((row) => row.key);
}

/**
 * Xây dựng ma trận quyền phân nhóm theo danh mục với đầy đủ trạng thái checked/disabled/inherited/implied.
 */
export function buildPermissionMatrix(params: BuildPermissionMatrixParams): PermissionGroupState[] {
  const {
    catalog = [],
    rolePermissions = {},
    selectedRole,
    selectedCustomPermissions = [],
    actorPermissions = [],
    readOnly = false,
  } = params;

  const rolesMap = rolePermissions as Record<string, readonly string[] | string[]>;
  const baseRolePerms = rolesMap[selectedRole] ?? [];
  const isSuperRole = baseRolePerms.includes('*');
  const isSuperActor = actorPermissions.includes('*');
  // Bản đồ implies từ catalog để tra cứu nhanh quyền nào kéo theo quyền nào
  const catalogMap = new Map<string, PermissionCatalogItemDto>();
  for (const item of catalog) {
    catalogMap.set(item.key, item);
  }

  const groupsMap = new Map<string, PermissionRowState[]>();

  for (const item of catalog) {
    // 1. Kiểm tra thừa kế từ vai trò (bao gồm cả trường hợp role có '*' hoặc quyền của role kéo theo item này)
    const isDirectRole = isSuperRole || baseRolePerms.includes(item.key);
    const isImpliedByRole = !isDirectRole && baseRolePerms.some((rk) => {
      const roleItem = catalogMap.get(rk);
      return roleItem?.implies?.includes(item.key) ?? false;
    });
    const inheritedFromRole = isDirectRole || isImpliedByRole;

    // 2. Kiểm tra có được kéo theo bởi một quyền custom đang được chọn không (nếu chưa thừa kế từ role)
    let impliedBy: string | undefined;
    if (!inheritedFromRole) {
      for (const customKey of selectedCustomPermissions) {
        if (customKey === item.key) continue;
        const customItem = catalogMap.get(customKey);
        if (customItem?.implies?.includes(item.key)) {
          impliedBy = customKey;
          break;
        }
      }
    }

    // 3. Trạng thái custom permission và checked
    const isDirectCustom = selectedCustomPermissions.includes(item.key);
    const grantedAsCustom = !inheritedFromRole && !impliedBy && isDirectCustom;
    const checked = inheritedFromRole || Boolean(impliedBy) || grantedAsCustom;

    // 4. Trạng thái disabled
    let disabled = false;
    if (readOnly) {
      disabled = true;
    } else if (inheritedFromRole || Boolean(impliedBy)) {
      disabled = true;
    } else {
      const actorCanGrant = isSuperActor || actorPermissions.includes(item.key);
      disabled = !actorCanGrant;
    }

    const rowState: PermissionRowState = {
      key: item.key,
      label: item.label,
      category: item.category,
      inheritedFromRole,
      impliedBy,
      grantedAsCustom,
      checked,
      disabled,
    };

    if (!groupsMap.has(item.category)) {
      groupsMap.set(item.category, []);
    }
    groupsMap.get(item.category)!.push(rowState);
  }

  const groups: PermissionGroupState[] = [];
  for (const [category, permissions] of groupsMap.entries()) {
    groups.push({ category, permissions });
  }

  return groups;
}
