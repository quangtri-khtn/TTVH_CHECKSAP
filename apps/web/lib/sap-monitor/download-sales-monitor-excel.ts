// Helper tải file Excel nhị phân authenticated từ backend (/sap/sales-monitor/export & /export-grid)
// sử dụng authedFetch + Blob + synthetic anchor click.
import { authedFetch } from '@/lib/api/authed-fetch';
import type { CohortFilter, ExportSourceType } from './sales-monitor-domain';

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

export async function downloadSalesMonitorDetailExcel(params: {
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
    `${getApiBase()}/sap/sales-monitor/export?${searchParams.toString()}`,
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? 'Không thể xuất file Excel chi tiết.');
  }

  const fallback = `Monitor_Chi_Tiet_${params.dateFrom}_Brand${params.brand || 'ALL'}.xlsx`;
  await triggerBlobDownload(res, fallback);
}

export async function downloadSalesMonitorGridExcel(params: {
  dateFrom: string;
  dateTo?: string;
  brand: string;
  cohort: CohortFilter;
  sourceType: ExportSourceType;
  sourceKey: string;
}): Promise<void> {
  const searchParams = new URLSearchParams({
    dateFrom: params.dateFrom,
    brand: params.brand === 'ALL' ? '' : params.brand,
    cohort: params.cohort,
    sourceType: params.sourceType,
    sourceKey: params.sourceKey,
  });
  if (params.dateTo) {
    searchParams.set('dateTo', params.dateTo);
  }

  const res = await authedFetch(
    `${getApiBase()}/sap/sales-monitor/export-grid?${searchParams.toString()}`,
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? 'Không thể xuất file Excel danh sách.');
  }

  await triggerBlobDownload(res, 'Monitor_Chung_Tu_Treo.xlsx');
}
