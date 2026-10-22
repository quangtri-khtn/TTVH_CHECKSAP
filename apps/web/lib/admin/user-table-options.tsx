import { Shield, User } from 'lucide-react';
import { UserResponseDtoRole } from '@/lib/api/generated/model';
import type { StatusTone } from './status-tone';

export {
  ACTIVE_STATUSES as USER_STATUSES,
  findActiveStatus as findUserStatus,
} from './active-status-options';

/** Vai trò kèm icon, dùng chung cho cột bảng và bộ lọc. */
export const USER_ROLES = [
  {
    value: UserResponseDtoRole.ADMIN,
    label: 'Quản trị viên',
    icon: Shield,
    // Tô màu để quyền cao nổi lên khi quét danh sách người dùng.
    tone: 'info' as StatusTone,
  },
  {
    value: UserResponseDtoRole.EMPLOYEE,
    label: 'Nhân viên',
    icon: User,
    tone: 'neutral' as StatusTone,
  },
] as const;

export function findUserRole(role: UserResponseDtoRole) {
  return USER_ROLES.find((item) => item.value === role);
}
