'use client';

// Trang App Router cho màn hình Monitor Chứng từ Treo – Go-live (Luồng Bán) (/sap/monitor-ban).
import { RequirePermission } from '@/features/auth/components/require-permission';
import { SalesConversionFunnelTable } from '@/features/sap-monitor/components/sales-conversion-funnel-table';
import { SalesDocStatusTable } from '@/features/sap-monitor/components/sales-doc-status-table';
import { SalesMonitorListPanel } from '@/features/sap-monitor/components/sales-monitor-list-panel';
import { SalesMonitorStatusBar } from '@/features/sap-monitor/components/sales-monitor-status-bar';
import { SalesMonitorToolbar } from '@/features/sap-monitor/components/sales-monitor-toolbar';
import { useSalesMonitorActions } from '@/features/sap-monitor/hooks/use-sales-monitor-actions';
import { PERMISSIONS } from '@/lib/auth/permission-keys';
import { usePermissions } from '@/lib/auth/use-permissions';

export default function SalesMonitorPage() {
  const { can } = usePermissions();
  const canRead = can(PERMISSIONS.SAP_MONITOR_READ);

  const {
    dateFrom,
    setDateFrom,
    brand,
    setBrand,
    selectedCohort,
    selectedViewKey,
    drilldownSource,
    showDocStatus,
    monitorData,
    activeCohortData,
    activeGrid,
    isLoading,
    isFetching,
    isDetailExporting,
    isGridExporting,
    error,
    handleSelectFunnelStep,
    handleSelectDocStatus,
    handleClearDrilldown,
    handleSelectAllChain,
    handleSelectView,
    handleCohortChange,
    handleToggleDocStatus,
    handleExportDetail,
    handleExportGrid,
  } = useSalesMonitorActions({ enabled: canRead });

  const activeFunnelStepIndex =
    drilldownSource?.type === 'funnel' ? drilldownSource.stepIndex : null;
  const activeDocStatusKey =
    drilldownSource?.type === 'docStatus' ? drilldownSource.key : null;

  return (
    <RequirePermission permission={PERMISSIONS.SAP_MONITOR_READ}>
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Monitor Chứng từ Treo – Go-live (Luồng Bán)
            </h1>
            <p className="text-xs text-muted-foreground">
              Đối soát thời gian thực tiến độ chuyển đổi PO → SO → A/R → GRPO → AP từ SAP HANA.
            </p>
          </div>
        </div>

        <SalesMonitorToolbar
          dateFrom={dateFrom}
          onDateFromChange={setDateFrom}
          brand={brand}
          onBrandChange={setBrand}
          onExportDetail={handleExportDetail}
          showDocStatus={showDocStatus}
          onToggleDocStatus={handleToggleDocStatus}
          isLoading={isLoading}
          isDetailExporting={isDetailExporting}
        />

        <SalesMonitorStatusBar
          dateFrom={dateFrom}
          brand={brand}
          summary={monitorData?.summary}
          generatedAt={monitorData?.meta.generatedAt}
          drilldownTitle={activeGrid.drilldownTitle}
          onClearDrilldown={handleClearDrilldown}
          isLoading={isLoading}
          isFetching={isFetching}
          error={error}
        />

        <SalesConversionFunnelTable
          funnel={activeCohortData?.funnel}
          activeFunnelStepIndex={activeFunnelStepIndex}
          onSelectFunnelStep={handleSelectFunnelStep}
          selectedCohort={selectedCohort}
          onCohortChange={handleCohortChange}
        />

        {showDocStatus && (
          <SalesDocStatusTable
            docStatusCounts={activeCohortData?.docStatusCounts}
            poCount={activeCohortData?.poCount}
            activeDocStatusKey={activeDocStatusKey}
            onSelectDocStatus={handleSelectDocStatus}
            onSelectAllChain={handleSelectAllChain}
          />
        )}

        <SalesMonitorListPanel
          lists={monitorData?.lists}
          selectedViewKey={selectedViewKey}
          onSelectView={handleSelectView}
          selectedCohort={selectedCohort}
          columns={activeGrid.columns}
          rows={activeGrid.rows}
          isLoading={isLoading}
          isGridExporting={isGridExporting}
          onExportGrid={handleExportGrid}
        />
      </div>
    </RequirePermission>
  );
}
