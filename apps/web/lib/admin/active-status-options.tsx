import { Ban, CircleCheck } from 'lucide-react';
import type { StatusTone } from './status-tone';

/**
 * Trạng thái bật/tắt dùng chung cho danh mục, hệ thống và người dùng.
 * Giá trị là chuỗi vì cột được tính từ `String(isActive)` — faceted filter chỉ
 * so khớp chuỗi.
 */
export const ACTIVE_STATUSES = [
  { value: 'true', label: 'Đang hoạt động', icon: CircleCheck, tone: 'success' as StatusTone },
  { value: 'false', label: 'Đã vô hiệu hoá', icon: Ban, tone: 'neutral' as StatusTone },
] as const;

export function findActiveStatus(isActive: boolean) {
  return ACTIVE_STATUSES.find((item) => item.value === String(isActive));
}
