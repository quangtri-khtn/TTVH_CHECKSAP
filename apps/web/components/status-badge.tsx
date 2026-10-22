import type { LucideIcon } from 'lucide-react';
import { STATUS_TONE_CLASS, type StatusTone } from '@/lib/admin/status-tone';
import { cn } from '@/lib/utils';

/**
 * Badge trạng thái: nền nhạt, viền cùng tông, chữ đậm màu.
 *
 * Luôn kèm icon và nhãn chữ — màu chỉ là lớp hỗ trợ, không phải cách duy nhất
 * truyền đạt trạng thái (người mù màu vẫn phân biệt được qua icon và chữ).
 */
export function StatusBadge({
  label,
  tone,
  icon: Icon,
  className,
}: {
  label: string;
  tone: StatusTone;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        STATUS_TONE_CLASS[tone],
        className,
      )}
    >
      {Icon && <Icon className="size-3.5 shrink-0" />}
      {label}
    </span>
  );
}
