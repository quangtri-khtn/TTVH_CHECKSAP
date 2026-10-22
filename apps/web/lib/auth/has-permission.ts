export function hasPermission(
  permissions: readonly string[] | string[] | null | undefined,
  required: string | readonly string[] | string[],
): boolean {
  if (!required || (Array.isArray(required) && required.length === 0)) {
    return true;
  }
  if (!permissions || permissions.length === 0) {
    return false;
  }
  if (permissions.includes('*')) {
    return true;
  }
  const reqList: readonly string[] = typeof required === 'string' ? [required] : required;
  return reqList.every((perm) => permissions.includes(perm));
}

export function hasAnyPermission(
  permissions: readonly string[] | string[] | null | undefined,
  required: readonly string[] | string[],
): boolean {
  if (!required || required.length === 0) {
    return true;
  }
  if (!permissions || permissions.length === 0) {
    return false;
  }
  if (permissions.includes('*')) {
    return true;
  }
  return required.some((perm) => permissions.includes(perm));
}
