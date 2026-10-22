'use client';

// Trang App Router cho màn hình Monitor Luồng Trả hàng – Go-live (KBMD ↔ TTVH) (/sap/monitor-tra).
import { RequirePermission } from '@/features/auth/components/require-permission';
import { ReturnChainStatusTable } from '@/features/sap-monitor/components/return-chain-status-table';
import { ReturnConversionFunnelTable } from '@/features/sap-monitor/components/return-conversion-funnel-table';
import { ReturnMonitorListPanel } from '@/features/sap-monitor/components/return-monitor-list-panel';
import { ReturnMonitorStatusBar } from '@/features/sap-monitor/components/return-monitor-status-bar';
import { ReturnMonitorToolbar } from '@/features/sap-monitor/components/return-monitor-toolbar';
import { useReturnMonitorActions } from '@/features/sap-monitor/hooks/use-return-monitor-actions';
import { PERMISSIONS } from '@/lib/auth/permission-keys';
import { usePermissions } from '@/lib/auth/use-permissions';

export default function ReturnMonitorPage() {
  const { can } = usePermissions();
  const canRead = can(PERMISSIONS.SAP_MONITOR_READ);

  const {
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
    isLoading,
    isFetching,
    isDetailExporting,
    isGridExporting,
    error,
    handleCohortChange,
    handleSelectFunnelStep,
    handleSelectStatus,
    handleSelectAllChain,
    handleSelectViewMode,
    handleClearFilter,
    handleToggleStatusBox,
    handleExportDetail,
    handleExportGrid,
  } = useReturnMonitorActions({ enabled: canRead });

  return (
    <RequirePermission permission={PERMISSIONS.SAP_MONITOR_READ}>
      <div className="flex flex-1 flex-col gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Monitor Luồng Trả hàng – Go-live (KBMD ↔ TTVH)
          </h1>
        </div>

        <ReturnMonitorToolbar
          dateFrom={dateFrom}
          onDateFromChange={setDateFrom}
          brand={brand}
          onBrandChange={setBrand}
          onExportDetail={handleExportDetail}
          showStatusBox={showStatusBox}
          onToggleStatusBox={handleToggleStatusBox}
          isLoading={isLoading}
          isDetailExporting={isDetailExporting}
        />

        <ReturnMonitorStatusBar
          dateFrom={dateFrom}
          brand={brand}
          summary={monitorData?.summary}
          generatedAt={monitorData?.meta.generatedAt}
          drilldownTitle={activeGrid.drilldownTitle}
          onClearFilter={handleClearFilter}
          isLoading={isLoading}
          isFetching={isFetching}
          error={error}
        />

        <ReturnConversionFunnelTable
          funnel={activeCohortData?.funnel}
          viewMode={viewMode}
          onSelectFunnelStep={handleSelectFunnelStep}
          selectedCohort={selectedCohort}
          onCohortChange={handleCohortChange}
        />

        {showStatusBox && (
          <ReturnChainStatusTable
            statusCounts={activeCohortData?.statusCounts}
            poCount={activeCohortData?.poCount}
            viewMode={viewMode}
            statusFilter={statusFilter}
            onSelectStatus={handleSelectStatus}
            onSelectAllChain={handleSelectAllChain}
          />
        )}

        <ReturnMonitorListPanel
          lists={monitorData?.lists}
          viewMode={viewMode}
          onSelectViewMode={handleSelectViewMode}
          selectedCohort={selectedCohort}
          title={activeGrid.title}
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
