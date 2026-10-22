/**
 * Chữ cái đầu của tối đa 2 từ cuối trong tên, dùng làm avatar dự phòng.
 * Lấy 2 từ cuối vì tên tiếng Việt đặt tên riêng ở cuối ("Nguyễn Văn An" → "VA").
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(-2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}
