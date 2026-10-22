import { ApiError } from '@/lib/api/http-client';
import type { ReturnMonitorListsDto } from '@/lib/api/generated/model';
import {
  RETURN_AR_NOINV_COLS,
  RETURN_BRAND_OPTIONS,
  RETURN_CHAIN_COLUMNS,
  RST_AR_NO_INV,
  RST_FULL,
  RST_NO_SO,
  dateInputToSapDate,
  formatReturnGeneratedTime,
  formatReturnScopeLine,
  formatSapCell,
  getReturnMonitorErrorMessage,
  getReturnViewRowCount,
  getYesterdaySapDate,
  resolveReturnGridData,
  sapDateToDateInput,
} from './return-monitor-domain';

function makeMockReturnLists(): ReturnMonitorListsDto {
  const makeChainRow = (nhom: string, poNum: number, status: string) => {
    const row: (string | number | boolean | null)[] = Array(
      RETURN_CHAIN_COLUMNS.length,
    ).fill('');
    row[0] = nhom;
    row[1] = 'S01';
    row[2] = 'Cửa hàng 1';
    row[3] = '5001';
    row[4] = poNum;
    row[RETURN_CHAIN_COLUMNS.indexOf('Trang thai chuoi chung tu')] = status;
    return row;
  };

  const makeArNoInvRow = (nhom: string, poNum: number, arNum: number, age: number) => {
    const row: (string | number | boolean | null)[] = Array(
      RETURN_AR_NOINV_COLS.length,
    ).fill('');
    row[0] = nhom;
    row[1] = 'S01';
    row[3] = poNum;
    row[7] = arNum;
    row[11] = age;
    return row;
  };

  return {
    chain: {
      columns: [...RETURN_CHAIN_COLUMNS],
      rows: [
        makeChainRow('Mới', 1001, RST_NO_SO),
        makeChainRow('Mới', 1002, RST_FULL),
        makeChainRow('Cũ', 901, RST_AR_NO_INV),
      ],
    },
    arNoInv: {
      columns: [...RETURN_AR_NOINV_COLS],
      rows: [
        makeArNoInvRow('Mới', 1003, 5001, 4),
        makeArNoInvRow('Cũ', 901, 4901, 12),
      ],
    },
  };
}

describe('return-monitor-domain', () => {
  it('Test Case 1: Lọc dữ liệu theo selectedCohort (moi chỉ giữ Mới, cu chỉ giữ Cũ, tatCa giữ cả hai)', () => {
    const lists = makeMockReturnLists();

    const moiGrid = resolveReturnGridData({
      lists,
      viewMode: 'po',
      statusFilter: null,
      selectedCohort: 'moi',
    });
    expect(moiGrid.rows).toHaveLength(2);
    expect(moiGrid.rows.every((r) => r[0] === 'Mới')).toBe(true);
    expect(moiGrid.title).toBe('Danh sách PO trả hàng (2)');

    const cuGrid = resolveReturnGridData({
      lists,
      viewMode: 'po',
      statusFilter: null,
      selectedCohort: 'cu',
    });
    expect(cuGrid.rows).toHaveLength(1);
    expect(cuGrid.rows[0]?.[0]).toBe('Cũ');

    const tatCaGrid = resolveReturnGridData({
      lists,
      viewMode: 'po',
      statusFilter: null,
      selectedCohort: 'tatCa',
    });
    expect(tatCaGrid.rows).toHaveLength(3);

    const arMoiGrid = resolveReturnGridData({
      lists,
      viewMode: 'ar_noinv',
      statusFilter: null,
      selectedCohort: 'moi',
    });
    expect(arMoiGrid.rows).toHaveLength(1);
    expect(arMoiGrid.title).toBe(
      'A/R (TTVH) chưa xuất hóa đơn (1 A/R) – sắp theo tuổi A/R giảm dần',
    );
    expect(getReturnViewRowCount(lists, 'ar_noinv', 'tatCa')).toBe(2);
  });

  it('Test Case 2: Lọc dữ liệu theo statusFilter khi ở chế độ po', () => {
    const lists = makeMockReturnLists();

    const filtered = resolveReturnGridData({
      lists,
      viewMode: 'po',
      statusFilter: RST_NO_SO,
      selectedCohort: 'moi',
    });

    expect(filtered.rows).toHaveLength(1);
    expect(filtered.rows[0]?.[4]).toBe(1001);
    expect(filtered.title).toBe(`Danh sách PO trả hàng (1) – ${RST_NO_SO}`);
    expect(filtered.drilldownTitle).toBe(`${RST_NO_SO} (1 PO)`);
  });

  it('Test Case 3: Chuyển đổi qua lại giữa định dạng Date Input YYYY-MM-DD và SAP Date YYYYMMDD', () => {
    expect(sapDateToDateInput('20261021')).toBe('2026-10-21');
    expect(sapDateToDateInput('invalid')).toBe('');
    expect(dateInputToSapDate('2026-10-21')).toBe('20261021');
    expect(dateInputToSapDate('2019-12-31')).toBe('');
    expect(getYesterdaySapDate(new Date('2026-10-21T08:00:00.000Z'))).toBe('20261020');
    expect(formatReturnGeneratedTime('2026-10-21T08:43:36.000Z')).toBe('15:43:36');
    expect(formatReturnScopeLine('20261007', '5001')).toContain(
      'từ 07/10/2026, brand 5001 + cửa hàng pilot',
    );
    expect(formatSapCell(1250)).toBe('1,250');
    expect(RETURN_BRAND_OPTIONS).toHaveLength(7);
  });

  it('Test Case 4: Xử lý thông báo lỗi tiếng Việt thân thiện khi mã lỗi là 503, 403 hoặc chuỗi thông báo kết nối thất bại', () => {
    expect(getReturnMonitorErrorMessage(new ApiError(503, 'HTTP 503'))).toBe(
      'Chưa cấu hình kết nối SAP, liên hệ admin',
    );
    expect(
      getReturnMonitorErrorMessage(
        new ApiError(503, 'Chưa cấu hình kết nối SAP cho môi trường này'),
      ),
    ).toBe('Chưa cấu hình kết nối SAP cho môi trường này');
    expect(getReturnMonitorErrorMessage(new ApiError(403, 'Forbidden'))).toBe(
      'Bạn không có quyền truy cập Monitor SAP',
    );
    expect(getReturnMonitorErrorMessage(new Error('Lỗi kết nối SAP timeout'))).toBe(
      'Chưa cấu hình kết nối SAP, liên hệ admin',
    );
  });
});
