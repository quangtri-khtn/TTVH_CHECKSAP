// Khóa tuần tự FIFO toàn tiến trình (không tái nhập) để đảm bảo tại mỗi thời điểm
// chỉ có tối đa 1 câu truy vấn OPENQUERY chạy trên linked server hana_mc.

export class FifoLock {
  private tail: Promise<void> = Promise.resolve();

  async runExclusive<T>(work: () => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  }
}
