'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Database, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { PERMISSIONS } from '@/lib/auth/permission-keys';
import {
  useSapQueriesGetDetail,
  useSapQueriesList,
} from '@/lib/api/generated/sap-queries/sap-queries';
import type { ReviewSapQueryResultDto } from '@/lib/api/generated/model';
import {
  DEFAULT_SAMPLE_BRAND,
  DEFAULT_SAMPLE_DATE,
  countQueriesByFlow,
  groupQueriesByFlowAndStage,
  type SapQueryFlowTab,
} from '@/lib/admin/sap-query-domain';
import { useSapQueryActions } from '@/features/admin/sap-queries/hooks/use-sap-query-actions';
import { SapQueriesSidebarList } from '@/features/admin/sap-queries/components/sap-queries-sidebar-list';
import { SapQueryPassportHeader } from '@/features/admin/sap-queries/components/sap-query-passport-header';
import { SapQuerySqlEditor } from '@/features/admin/sap-queries/components/sap-query-sql-editor';
import { SapQueryReviewPanel } from '@/features/admin/sap-queries/components/sap-query-review-panel';
import { SapQueryHistorySheet } from '@/features/admin/sap-queries/components/sap-query-history-sheet';

function SapQueriesStudioContent() {
  const searchParams = useSearchParams();
  const initialFlow: SapQueryFlowTab =
    searchParams.get('flow') === 'tra' ? 'tra' : 'ban';

  const [activeFlow, setActiveFlow] = useState<SapQueryFlowTab>(initialFlow);
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState<string>(
    initialFlow === 'tra' ? 'ret_po' : 'funnel',
  );
  const [currentSql, setCurrentSql] = useState('');
  const [sampleDate, setSampleDate] = useState(DEFAULT_SAMPLE_DATE);
  const [sampleBrand, setSampleBrand] = useState(DEFAULT_SAMPLE_BRAND);
  const [changeNote, setChangeNote] = useState('');
  const [reviewResult, setReviewResult] =
    useState<ReviewSapQueryResultDto | null>(null);
  const [lastReviewedSql, setLastReviewedSql] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const listQuery = useSapQueriesList();
  const detailQuery = useSapQueriesGetDetail(selectedKey, {
    query: { enabled: Boolean(selectedKey) },
  });

  const allQueries = useMemo(
    () => listQuery.data?.data.data ?? [],
    [listQuery.data],
  );
  const detail = detailQuery.data?.data.data;

  const flowCounts = useMemo(
    () => countQueriesByFlow(allQueries),
    [allQueries],
  );
  const stageGroups = useMemo(
    () => groupQueriesByFlowAndStage(allQueries, activeFlow, search),
    [allQueries, activeFlow, search],
  );
  const totalCustomized = flowCounts.banCustomized + flowCounts.traCustomized;
  const totalQueries = (flowCounts.banTotal + flowCounts.traTotal) || 25;

  useEffect(() => {
    if (detail) {
      setCurrentSql(detail.activeSql);
      setReviewResult(null);
      setLastReviewedSql(null);
      setChangeNote('');
    }
  }, [detail]);

  const handleFlowChange = useCallback(
    (nextFlow: SapQueryFlowTab) => {
      setActiveFlow(nextFlow);
      const firstInFlow = allQueries
        .filter((q) => q.flow === nextFlow)
        .sort((a, b) => a.sortOrder - b.sortOrder)[0];
      if (firstInFlow) {
        setSelectedKey(firstInFlow.key);
      } else {
        setSelectedKey(nextFlow === 'ban' ? 'funnel' : 'ret_po');
      }
    },
    [allQueries],
  );

  const {
    copySqlToClipboard,
    reviewQuery,
    publishQuery,
    rollbackQuery,
    resetDefaultQuery,
    isReviewing,
    isPublishing,
    isRollingBack,
    isResettingDefault,
  } = useSapQueryActions();

  const handleReview = useCallback(async () => {
    if (!selectedKey) return;
    const result = await reviewQuery({
      key: selectedKey,
      sqlText: currentSql,
      dateFrom: sampleDate,
      brand: sampleBrand,
    });
    if (result) {
      setReviewResult(result);
      setLastReviewedSql(currentSql);
    }
  }, [selectedKey, currentSql, sampleDate, sampleBrand, reviewQuery]);

  const handlePublish = useCallback(async () => {
    if (!selectedKey) return;
    const updated = await publishQuery({
      key: selectedKey,
      sqlText: currentSql,
      changeNote,
    });
    if (updated) {
      setCurrentSql(updated.activeSql);
      setReviewResult(null);
      setLastReviewedSql(null);
      setChangeNote('');
    }
  }, [selectedKey, currentSql, changeNote, publishQuery]);

  const handleResetDefault = useCallback(async () => {
    if (!selectedKey) return;
    const updated = await resetDefaultQuery({
      key: selectedKey,
      changeNote: 'Khôi phục về câu SQL gốc chuẩn v1',
    });
    if (updated) {
      setCurrentSql(updated.activeSql);
      setReviewResult(null);
      setLastReviewedSql(null);
    }
  }, [selectedKey, resetDefaultQuery]);

  const handleRollbackVersion = useCallback(
    async (targetVersionNo: number) => {
      if (!selectedKey) return;
      const updated = await rollbackQuery({
        key: selectedKey,
        targetVersionNo,
      });
      if (updated) {
        setCurrentSql(updated.activeSql);
        setReviewResult(null);
        setLastReviewedSql(null);
        setHistoryOpen(false);
      }
    },
    [selectedKey, rollbackQuery],
  );

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3.5 py-2 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <Database className="size-4 text-primary" />
          <h1 className="font-heading text-sm font-bold tracking-tight text-foreground sm:text-base">
            Quản trị 25 Câu Truy vấn SAP HANA
          </h1>
          <span className="hidden text-xs text-muted-foreground md:inline">
            · Luồng Bán (13 câu) &amp; Luồng Trả (12 câu) · Kiểm định Hợp đồng Cột &amp; Hoàn tác 1 click
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <Badge variant="outline" className="font-mono text-xs font-semibold">
            Đã tùy chỉnh: {totalCustomized}/{totalQueries}
          </Badge>
          <Badge variant="secondary" className="font-mono text-xs">
            Bản gốc v1: {Math.max(0, totalQueries - totalCustomized)}/{totalQueries}
          </Badge>
          {detail && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setHistoryOpen(true)}
              className="gap-1"
            >
              <History className="size-3.5" />
              <span>Lịch sử {detail.key} (v{detail.currentVersionNo})</span>
            </Button>
          )}
        </div>
      </div>

      <SapQueriesSidebarList
        activeFlow={activeFlow}
        onFlowChange={handleFlowChange}
        search={search}
        onSearchChange={setSearch}
        flowCounts={flowCounts}
        groups={stageGroups}
        selectedKey={selectedKey}
        onSelectQuery={setSelectedKey}
        isLoading={listQuery.isLoading}
      />

      {detailQuery.isLoading || !detail ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
      ) : (
        <div className="space-y-3">
          <SapQueryPassportHeader
            detail={detail}
            currentSql={currentSql}
            onCopyToken={copySqlToClipboard}
          />

          <SapQuerySqlEditor
            detail={detail}
            currentSql={currentSql}
            onChangeSql={setCurrentSql}
            sampleDate={sampleDate}
            onChangeSampleDate={setSampleDate}
            sampleBrand={sampleBrand}
            onChangeSampleBrand={setSampleBrand}
            onCopyText={copySqlToClipboard}
            onReview={handleReview}
            onResetDefault={handleResetDefault}
            onOpenHistory={() => setHistoryOpen(true)}
            isReviewing={isReviewing}
            isResettingDefault={isResettingDefault}
          />

          <SapQueryReviewPanel
            reviewResult={reviewResult}
            currentSql={currentSql}
            activeSql={detail.activeSql}
            lastReviewedSql={lastReviewedSql}
            changeNote={changeNote}
            onChangeNote={setChangeNote}
            onPublish={handlePublish}
            isPublishing={isPublishing}
            isReviewing={isReviewing}
          />

          <SapQueryHistorySheet
            open={historyOpen}
            onOpenChange={setHistoryOpen}
            detail={detail}
            onLoadSqlToEditor={setCurrentSql}
            onRollbackVersion={handleRollbackVersion}
            isRollingBack={isRollingBack}
          />
        </div>
      )}
    </div>
  );
}

export default function AdminSapQueriesPage() {
  return (
    <RequirePermission permission={PERMISSIONS.SAP_QUERY_MANAGE}>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <SapQueriesStudioContent />
      </Suspense>
    </RequirePermission>
  );
}
