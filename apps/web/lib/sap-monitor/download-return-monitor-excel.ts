// Helper tải file Excel nhị phân authenticated từ backend (/sap/return-monitor/export & /export-grid)
// sử dụng authedFetch + Blob + synthetic anchor click.
import { authedFetch } from '@/lib/api/authed-fetch';
import type { CohortFilter, ReturnViewMode } from './return-monitor-domain';

const getApiBase = (): string => {
  if (typeof window === 'undefined') {
    return process.env.API_INTERNAL_URL ?? 'http://localhost:3001';
  }
  return '/api';
};

function extractFilenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) {
    return fallback;
  }
  const utf8Match = header.match(/filename\*=UTF-8''([^;\s]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }
  const asciiMatch = header.match(/filename="?([^";]+)"?/i);
  if (asciiMatch?.[1]) {
    return asciiMatch[1].trim();
  }
  return fallback;
}

async function triggerBlobDownload(res: Response, fallbackFilename: string): Promise<void> {
  const filename = extractFilenameFromDisposition(
    res.headers.get('content-disposition'),
    fallbackFilename,
  );
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

export async function downloadReturnMonitorDetailExcel(params: {
  dateFrom: string;
  dateTo?: string;
  brand: string;
}): Promise<void> {
  const searchParams = new URLSearchParams({
    dateFrom: params.dateFrom,
    brand: params.brand === 'ALL' ? '' : params.brand,
  });
  if (params.dateTo) {
    searchParams.set('dateTo', params.dateTo);
  }

  const res = await authedFetch(
    `${getApiBase()}/sap/return-monitor/export?${searchParams.toString()}`,
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? 'Không thể xuất file Excel chi tiết luồng trả.');
  }

  const fallback = `Monitor_Tra_Chi_Tiet_${params.dateFrom}_Brand${params.brand || 'ALL'}.xlsx`;
  await triggerBlobDownload(res, fallback);
}

export async function downloadReturnMonitorGridExcel(params: {
  dateFrom: string;
  dateTo?: string;
  brand: string;
  cohort: CohortFilter;
  viewMode: ReturnViewMode;
  statusFilter?: string | null;
}): Promise<void> {
  const searchParams = new URLSearchParams({
    dateFrom: params.dateFrom,
    brand: params.brand === 'ALL' ? '' : params.brand,
    cohort: params.cohort,
    viewMode: params.viewMode,
  });
  if (params.dateTo) {
    searchParams.set('dateTo', params.dateTo);
  }
  if (params.statusFilter) {
    searchParams.set('statusFilter', params.statusFilter);
  }

  const res = await authedFetch(
    `${getApiBase()}/sap/return-monitor/export-grid?${searchParams.toString()}`,
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? 'Không thể xuất file Excel danh sách luồng trả.');
  }
  const fallback =
    params.viewMode === 'ar_noinv'
      ? `Monitor_Tra_AR_Chua_Xuat_HD_${params.dateFrom}_Brand${params.brand}.xlsx`
      : `Monitor_Tra_PO_${params.dateFrom}_Brand${params.brand}.xlsx`;
  await triggerBlobDownload(res, fallback);
}
