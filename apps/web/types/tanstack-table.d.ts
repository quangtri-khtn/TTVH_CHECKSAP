import '@tanstack/react-table';

declare module '@tanstack/react-table' {
  // TData/TValue phải khai báo để khớp chữ ký gốc của ColumnMeta dù không dùng.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    /** Nhãn tiếng Việt của cột, dùng cho menu hiện/ẩn cột. */
    title?: string;
    /** Class áp cho cả <th> và <td> của cột. */
    className?: string;
    /** Class chỉ áp cho <th>. */
    thClassName?: string;
    /** Class chỉ áp cho <td>. */
    tdClassName?: string;
  }
}
