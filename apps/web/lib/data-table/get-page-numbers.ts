/** Dấu ba chấm ngăn cách các khoảng trang bị lược bớt. */
export const PAGE_GAP = '...' as const;

export type PageToken = number | typeof PAGE_GAP;

const MAX_VISIBLE_PAGES = 5;

/**
 * Dãy nút số trang, rút gọn bằng dấu ba chấm khi có quá nhiều trang.
 * Trang đầu và trang cuối luôn hiển thị để nhảy nhanh về hai đầu.
 */
export function getPageNumbers(currentPage: number, totalPages: number): PageToken[] {
  if (totalPages <= 0) return [];

  if (totalPages <= MAX_VISIBLE_PAGES) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, PAGE_GAP, totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, PAGE_GAP, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, PAGE_GAP, currentPage - 1, currentPage, currentPage + 1, PAGE_GAP, totalPages];
}
