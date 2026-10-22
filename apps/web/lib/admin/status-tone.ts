/** Sắc thái ngữ nghĩa của một trạng thái, quyết định bộ màu badge. */
export type StatusTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

/**
 * Class Tailwind cho từng sắc thái. Tách thành bảng tra thay vì ghép chuỗi
 * động vì Tailwind quét class theo văn bản tĩnh — tên class dựng lúc chạy sẽ
 * không được sinh ra trong CSS.
 */
export const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  success: 'border-status-success-border bg-status-success-bg text-status-success',
  info: 'border-status-info-border bg-status-info-bg text-status-info',
  warning: 'border-status-warning-border bg-status-warning-bg text-status-warning',
  danger: 'border-status-danger-border bg-status-danger-bg text-status-danger',
  neutral: 'border-status-neutral-border bg-status-neutral-bg text-status-neutral',
};

/** Chỉ màu chữ, dùng cho icon đứng một mình không có nền badge. */
export const STATUS_TONE_TEXT: Record<StatusTone, string> = {
  success: 'text-status-success',
  info: 'text-status-info',
  warning: 'text-status-warning',
  danger: 'text-status-danger',
  neutral: 'text-status-neutral',
};
