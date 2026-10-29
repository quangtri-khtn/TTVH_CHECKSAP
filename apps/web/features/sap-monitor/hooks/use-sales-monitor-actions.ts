'use client';

// Action hook điều phối state, tự động gọi/cache qua TanStack Query khi đổi Từ ngày hoặc Brand, tải lại cưỡng bức (refresh=true) và xử lý xuất Excel cho trang /sap/monitor-ban.
import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getSapSalesMonitorGetDataQueryKey,
  sapSalesMonitorGetData,
  useSapSalesMonitorGetData,
} from '@/lib/api/generated/sap-monitor/sap-monitor';
import {
  downloadSalesMonitorDetailExcel,
  downloadSalesMonitorGridExcel,
} from '@/lib/sap-monitor/download-sales-monitor-excel';
import {
  type CohortFilter,
  DEFAULT_SALES_BRAND,
  type DrilldownSource,
  type SalesDocStatusKey,
  type SalesViewKey,
  getSalesMonitorErrorMessage,
  getTodaySapDate,
  getYesterdaySapDate,
  resolveActiveGridData,
} from '@/lib/sap-monitor/sales-monitor-domain';

export interface UseSalesMonitorActionsOptions {
  enabled?: boolean;
}

export function useSalesMonitorActions({ enabled = true }: UseSalesMonitorActionsOptions = {}) {
  const queryClient = useQueryClient();
  const [dateFrom, setDateFrom] = useState<string>(() => getYesterdaySapDate());
  const [dateTo, setDateTo] = useState<string>(() => getTodaySapDate());
  const [brand, setBrand] = useState<string>(DEFAULT_SALES_BRAND);

  const [selectedCohort, setSelectedCohort] = useState<CohortFilter>('moi');
  const [selectedViewKey, setSelectedViewKey] = useState<SalesViewKey>('overview');
  const [drilldownSource, setDrilldownSource] = useState<DrilldownSource>(null);
  const [showDocStatus, setShowDocStatus] = useState<boolean>(false);

  const [isReloading, setIsReloading] = useState<boolean>(false);
  const [isDetailExporting, setIsDetailExporting] = useState<boolean>(false);
  const [isGridExporting, setIsGridExporting] = useState<boolean>(false);

  const apiBrand = brand === 'ALL' ? '' : brand;
  const queryParams = useMemo(
    () => ({ dateFrom, dateTo, brand: apiBrand }),
    [dateFrom, dateTo, apiBrand],
  );
  const query = useSapSalesMonitorGetData(queryParams, {
    query: {
      enabled,
    },
  });

  // Bóc đúng Double-Envelope từ customFetch ({ data: { statusCode, data: SalesMonitorDataDto } })
  const monitorData = query.data?.data.data;
  const activeCohortData = monitorData?.cohorts[selectedCohort];

  const activeGrid = useMemo(
    () => resolveActiveGridData(monitorData, selectedViewKey, selectedCohort, drilldownSource),
    [monitorData, selectedViewKey, selectedCohort, drilldownSource],
  );

  const handleReload = useCallback(async () => {
    setIsReloading(true);
    const toastId = toast.loading(
      `Đang tải lại dữ liệu mới nhất từ SAP HANA (${dateFrom} -> ${dateTo} · Brand ${brand || 'Tất cả'})...`,
    );
    try {
      const freshResponse = await sapSalesMonitorGetData({
        dateFrom,
        dateTo,
        brand: apiBrand,
        refresh: true,
      });
      queryClient.setQueryData(
        getSapSalesMonitorGetDataQueryKey(queryParams),
        freshResponse,
      );
      toast.success('Đã tải lại dữ liệu mới nhất từ SAP HANA.', { id: toastId });
    } catch (err) {
      toast.error(getSalesMonitorErrorMessage(err), { id: toastId });
    } finally {
      setIsReloading(false);
    }
  }, [apiBrand, brand, dateFrom, dateTo, queryClient, queryParams]);
  const handleSelectFunnelStep = useCallback((stepIndex: number) => {
    setDrilldownSource({ type: 'funnel', stepIndex });
  }, []);

  const handleSelectDocStatus = useCallback((key: SalesDocStatusKey) => {
    setDrilldownSource({ type: 'docStatus', key });
  }, []);

  const handleClearDrilldown = useCallback(() => {
    setDrilldownSource(null);
  }, []);

  const handleSelectAllChain = useCallback(() => {
    setSelectedViewKey('chain');
    setDrilldownSource(null);
  }, []);

  const handleSelectView = useCallback((viewKey: SalesViewKey) => {
    setSelectedViewKey(viewKey);
    setDrilldownSource(null);
  }, []);

  const handleCohortChange = useCallback((cohort: CohortFilter) => {
    setSelectedCohort(cohort);
  }, []);

  const handleToggleDocStatus = useCallback(() => {
    setShowDocStatus((prev) => !prev);
  }, []);

  const handleExportDetail = useCallback(async () => {
    setIsDetailExporting(true);
    const toastId = toast.loading('Đang xuất file Excel chi tiết (11 sheets)...');
    try {
      await downloadSalesMonitorDetailExcel({ dateFrom, dateTo, brand: apiBrand });
      toast.success('Đã xuất file Excel chi tiết thành công.', { id: toastId });
    } catch (err) {
      toast.error(getSalesMonitorErrorMessage(err), { id: toastId });
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
      await downloadSalesMonitorGridExcel({
        dateFrom,
        dateTo,
        brand: apiBrand,
        cohort: selectedCohort,
        sourceType: activeGrid.exportSourceType,
        sourceKey: activeGrid.exportSourceKey,
      });
      toast.success('Đã xuất file Excel danh sách thành công.', { id: toastId });
    } catch (err) {
      toast.error(getSalesMonitorErrorMessage(err), { id: toastId });
    } finally {
      setIsGridExporting(false);
    }
  }, [
    activeGrid.exportSourceKey,
    activeGrid.exportSourceType,
    activeGrid.rows.length,
    apiBrand,
    dateFrom,
    dateTo,
    selectedCohort,
  ]);

  return {
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    brand,
    setBrand,
    selectedCohort,
    selectedViewKey,
    drilldownSource,
    showDocStatus,
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
    handleSelectFunnelStep,
    handleSelectDocStatus,
    handleClearDrilldown,
    handleSelectAllChain,
    handleSelectView,
    handleCohortChange,
    handleToggleDocStatus,
    handleExportDetail,
    handleExportGrid,
  };
}
