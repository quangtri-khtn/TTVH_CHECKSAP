// Định nghĩa kiểu dữ liệu, nhãn hiển thị và hàm tiện ích dựng kết quả 3 bước
// cho chức năng Kiểm tra kết nối SAP (dùng chung giữa gateway và service).

export const SAP_CHECK_STEP_KEYS = ['login', 'maycha_live', 'kbmd_live'] as const;
export type SapCheckStepKey = (typeof SAP_CHECK_STEP_KEYS)[number];

export const SAP_CHECK_STEP_STATUSES = ['ok', 'failed', 'skipped'] as const;
export type SapCheckStepStatus = (typeof SAP_CHECK_STEP_STATUSES)[number];

export interface SapCheckStep {
  key: SapCheckStepKey;
  label: string;
  status: SapCheckStepStatus;
  message?: string;
}

export const SAP_CHECK_STEP_LABELS: Readonly<Record<SapCheckStepKey, string>> = {
  login: 'Đăng nhập SQL Server',
  maycha_live: 'OPENQUERY bên maycha_live (TTVH)',
  kbmd_live: 'OPENQUERY bên kbmd_live (KBMĐ)',
};

export const SKIPPED_DUE_TO_LOGIN_MESSAGE = 'Bỏ qua vì bước 1 lỗi';

/**
 * Dựng danh sách 3 bước khi bước 1 (Đăng nhập SQL Server / ping) thất bại:
 * bước 1 nhận trạng thái `failed` kèm thông báo lỗi đã map, bước 2 và 3 là `skipped`.
 */
export function loginFailedSteps(message: string): SapCheckStep[] {
  return [
    {
      key: 'login',
      label: SAP_CHECK_STEP_LABELS.login,
      status: 'failed',
      message,
    },
    {
      key: 'maycha_live',
      label: SAP_CHECK_STEP_LABELS.maycha_live,
      status: 'skipped',
      message: SKIPPED_DUE_TO_LOGIN_MESSAGE,
    },
    {
      key: 'kbmd_live',
      label: SAP_CHECK_STEP_LABELS.kbmd_live,
      status: 'skipped',
      message: SKIPPED_DUE_TO_LOGIN_MESSAGE,
    },
  ];
}
