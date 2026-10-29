'use client';

// Action hook điều phối state, tự động gọi/cache qua TanStack Query khi đổi Từ ngày hoặc Brand,
// tải lại cưỡng bức (refresh=true), xử lý nhấp bước 3 Phễu (A/R chưa xuất HĐ), lọc Trạng thái chuỗi chứng từ và xuất Excel cho trang /sap/monitor-tra.
import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getSapReturnMonitorGetDataQueryKey,
  sapReturnMonitorGetData,
  useSapReturnMonitorGetData,
} from '@/lib/api/generated/sap-monitor/sap-monitor';
import {
  downloadReturnMonitorDetailExcel,
  downloadReturnMonitorGridExcel,
} from '@/lib/sap-monitor/download-return-monitor-excel';
import {
  type CohortFilter,
  DEFAULT_RETURN_BRAND,
  type ReturnViewMode,
  getReturnMonitorErrorMessage,
  getTodaySapDate,
  getYesterdaySapDate,
  resolveReturnGridData,
} from '@/lib/sap-monitor/return-monitor-domain';

export interface UseReturnMonitorActionsOptions {
  enabled?: boolean;
}

export function useReturnMonitorActions({
  enabled = true,
}: UseReturnMonitorActionsOptions = {}) {
  const queryClient = useQueryClient();
  const [dateFrom, setDateFrom] = useState<string>(() => getYesterdaySapDate());
  const [dateTo, setDateTo] = useState<string>(() => getTodaySapDate());
  const [brand, setBrand] = useState<string>(DEFAULT_RETURN_BRAND);

  const [selectedCohort, setSelectedCohort] = useState<CohortFilter>('moi');
  const [viewMode, setViewMode] = useState<ReturnViewMode>('po');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showStatusBox, setShowStatusBox] = useState<boolean>(false);

  const [isReloading, setIsReloading] = useState<boolean>(false);
  const [isDetailExporting, setIsDetailExporting] = useState<boolean>(false);
  const [isGridExporting, setIsGridExporting] = useState<boolean>(false);

  const apiBrand = brand === 'ALL' ? '' : brand;
  const queryParams = useMemo(
    () => ({ dateFrom, dateTo, brand: apiBrand, refresh: false }),
    [dateFrom, dateTo, apiBrand],
  );
  const query = useSapReturnMonitorGetData(queryParams, {
    query: {
      enabled,
    },
  });

  // Bóc đúng Double-Envelope từ customFetch ({ data: { statusCode, data: ReturnMonitorDataDto } })
  const monitorData = query.data?.data?.data;
  const activeCohortData = monitorData?.cohorts[selectedCohort];

  const activeGrid = useMemo(
    () =>
      resolveReturnGridData({
        lists: monitorData?.lists,
        viewMode,
        statusFilter,
        selectedCohort,
      }),
    [monitorData?.lists, viewMode, statusFilter, selectedCohort],
  );

  const handleReload = useCallback(async () => {
    setIsReloading(true);
    const toastId = toast.loading(
      `Đang tải lại dữ liệu luồng trả mới nhất từ SAP HANA (${dateFrom} -> ${dateTo} · Brand ${brand || 'Tất cả'})...`,
    );
    try {
      const freshResponse = await sapReturnMonitorGetData({
        dateFrom,
        dateTo,
        brand: apiBrand,
        refresh: true,
      });
      queryClient.setQueryData(
        getSapReturnMonitorGetDataQueryKey(queryParams),
        freshResponse,
      );
      toast.success('Đã tải lại dữ liệu luồng trả mới nhất từ SAP HANA.', {
        id: toastId,
      });
    } catch (err) {
      toast.error(getReturnMonitorErrorMessage(err), { id: toastId });
    } finally {
      setIsReloading(false);
    }
  }, [apiBrand, brand, dateFrom, dateTo, queryClient, queryParams]);
  const handleCohortChange = useCallback((cohort: CohortFilter) => {
    setSelectedCohort(cohort);
    setViewMode('po');
    setStatusFilter(null);
  }, []);

  // Bẫy lệch số 7 (Parity Trap 7): chỉ duy nhất bước 3 (stepIndex === 2, "3. A/R → xuất hóa đơn")
  // có thể nhấp để chuyển lưới sang chế độ 'ar_noinv'. Các bước khác giữ nguyên.
  const handleSelectFunnelStep = useCallback((stepIndex: number) => {
    if (stepIndex === 2) {
      setViewMode('ar_noinv');
      setStatusFilter(null);
    }
  }, []);

  const handleSelectStatus = useCallback((status: string) => {
    setViewMode('po');
    setStatusFilter(status);
  }, []);

  const handleSelectAllChain = useCallback(() => {
    setViewMode('po');
    setStatusFilter(null);
  }, []);

  const handleSelectViewMode = useCallback((nextMode: ReturnViewMode) => {
    setViewMode(nextMode);
    if (nextMode === 'ar_noinv') {
      setStatusFilter(null);
    }
  }, []);

  const handleClearFilter = useCallback(() => {
    setViewMode('po');
    setStatusFilter(null);
  }, []);

  const handleToggleStatusBox = useCallback(() => {
    setShowStatusBox((prev) => !prev);
  }, []);

  const handleExportDetail = useCallback(async () => {
    setIsDetailExporting(true);
    const toastId = toast.loading('Đang xuất file Excel chi tiết luồng trả (3 sheets)...');
    try {
      await downloadReturnMonitorDetailExcel({ dateFrom, dateTo, brand: apiBrand });
      toast.success('Đã xuất file Excel chi tiết thành công.', { id: toastId });
    } catch (err) {
      toast.error(getReturnMonitorErrorMessage(err), { id: toastId });
    } finally {
      setIsDetailExporting(false);
    }
  }, [apiBrand, dateFrom, dateTo]);

  const handleExportGrid = useCallback(async () => {
    if (activeGrid.rows.length === 0) {
      toast.error('Không có dữ liệu trên lưới để xuất Excel.');
      return;
    }

    setIsGridExporting(true);
    const toastId = toast.loading('Đang xuất file Excel danh sách...');
    try {
      await downloadReturnMonitorGridExcel({
        dateFrom,
        dateTo,
        brand: apiBrand,
        cohort: selectedCohort,
        viewMode,
        statusFilter,
      });
      toast.success('Đã xuất file Excel danh sách thành công.', { id: toastId });
    } catch (err) {
      toast.error(getReturnMonitorErrorMessage(err), { id: toastId });
    } finally {
      setIsGridExporting(false);
    }
  }, [activeGrid.rows.length, apiBrand, dateFrom, dateTo, selectedCohort, statusFilter, viewMode]);

  return {
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    brand,
    setBrand,
    selectedCohort,
    viewMode,
    statusFilter,
    showStatusBox,
    monitorData,
    activeCohortData,
    activeGrid,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isReloading,
    isDetailExporting,
    isGridExporting,
    error: query.error,
    handleReload,
    handleCohortChange,
    handleSelectFunnelStep,
    handleSelectStatus,
    handleSelectAllChain,
    handleSelectViewMode,
    handleClearFilter,
    handleToggleStatusBox,
    handleExportDetail,
    handleExportGrid,
  };
}
