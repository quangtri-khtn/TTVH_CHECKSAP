'use client';

// Action hook điều phối state, tự động gọi/cache qua TanStack Query khi đổi Từ ngày hoặc Brand,
// xử lý nhấp bước 3 Phễu (A/R chưa xuất HĐ), lọc Trạng thái chuỗi chứng từ và xuất Excel cho trang /sap/monitor-tra.
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useSapReturnMonitorGetData } from '@/lib/api/generated/sap-monitor/sap-monitor';
import {
  downloadReturnMonitorDetailExcel,
  downloadReturnMonitorGridExcel,
} from '@/lib/sap-monitor/download-return-monitor-excel';
import {
  type CohortFilter,
  DEFAULT_RETURN_BRAND,
  type ReturnViewMode,
  getReturnMonitorErrorMessage,
  getYesterdaySapDate,
  resolveReturnGridData,
} from '@/lib/sap-monitor/return-monitor-domain';

export interface UseReturnMonitorActionsOptions {
  enabled?: boolean;
}

export function useReturnMonitorActions({
  enabled = true,
}: UseReturnMonitorActionsOptions = {}) {
  const [dateFrom, setDateFrom] = useState<string>(() => getYesterdaySapDate());
  const [brand, setBrand] = useState<string>(DEFAULT_RETURN_BRAND);

  const [selectedCohort, setSelectedCohort] = useState<CohortFilter>('moi');
  const [viewMode, setViewMode] = useState<ReturnViewMode>('po');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showStatusBox, setShowStatusBox] = useState<boolean>(false);

  const [isDetailExporting, setIsDetailExporting] = useState<boolean>(false);
  const [isGridExporting, setIsGridExporting] = useState<boolean>(false);

  const queryParams = useMemo(
    () => ({ dateFrom, brand, refresh: false }),
    [dateFrom, brand],
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
      await downloadReturnMonitorDetailExcel({ dateFrom, brand });
      toast.success('Đã xuất file Excel chi tiết thành công.', { id: toastId });
    } catch (err) {
      toast.error(getReturnMonitorErrorMessage(err), { id: toastId });
    } finally {
      setIsDetailExporting(false);
    }
  }, [brand, dateFrom]);

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
        brand,
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
  }, [activeGrid.rows.length, brand, dateFrom, selectedCohort, statusFilter, viewMode]);

  return {
    dateFrom,
    setDateFrom,
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
    isDetailExporting,
    isGridExporting,
    error: query.error,
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
