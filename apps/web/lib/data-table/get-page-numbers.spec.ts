import { getPageNumbers, PAGE_GAP } from './get-page-numbers';

describe('getPageNumbers', () => {
  it('trả về rỗng khi chưa có trang nào', () => {
    expect(getPageNumbers(1, 0)).toEqual([]);
  });

  it('hiện đủ mọi trang khi tổng số trang không vượt 5', () => {
    expect(getPageNumbers(1, 1)).toEqual([1]);
    expect(getPageNumbers(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('rút gọn phía sau khi đang ở gần đầu', () => {
    expect(getPageNumbers(1, 10)).toEqual([1, 2, 3, 4, PAGE_GAP, 10]);
    expect(getPageNumbers(3, 10)).toEqual([1, 2, 3, 4, PAGE_GAP, 10]);
  });

  it('rút gọn phía trước khi đang ở gần cuối', () => {
    expect(getPageNumbers(10, 10)).toEqual([1, PAGE_GAP, 7, 8, 9, 10]);
    expect(getPageNumbers(8, 10)).toEqual([1, PAGE_GAP, 7, 8, 9, 10]);
  });

  it('rút gọn cả hai phía khi đang ở giữa', () => {
    expect(getPageNumbers(5, 10)).toEqual([1, PAGE_GAP, 4, 5, 6, PAGE_GAP, 10]);
  });

  it('luôn giữ trang đầu và trang cuối để nhảy nhanh về hai đầu', () => {
    for (const page of [1, 4, 7, 12]) {
      const tokens = getPageNumbers(page, 12);
      expect(tokens[0]).toBe(1);
      expect(tokens[tokens.length - 1]).toBe(12);
    }
  });

  it('không sinh số trang nằm ngoài khoảng hợp lệ', () => {
    for (const page of [1, 2, 5, 9, 10]) {
      const numbers = getPageNumbers(page, 10).filter((t): t is number => t !== PAGE_GAP);
      expect(numbers.every((n) => n >= 1 && n <= 10)).toBe(true);
    }
  });
});
