'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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

  useEffect(() => {
    if (detail) {
      setCurrentSql(detail.activeSql);
      setReviewResult(null);
      setLastReviewedSql(null);
      setChangeNote('');
    }
  }, [detail?.key, detail?.currentVersionNo, detail?.activeSql]);

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
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Quản trị 25 Câu Truy vấn SAP HANA
        </h1>
        <p className="text-xs text-muted-foreground">
          Chỉnh sửa Full SQL cho Monitor Luồng Bán (13 câu) &amp; Monitor Luồng
          Trả (12 câu), kiểm tra Hợp đồng Cột trên SAP thật trước khi Xuất bản
          và hỗ trợ hoàn tác 1 click.
        </p>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
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

        <div className="min-w-0 flex-1 space-y-4">
          {detailQuery.isLoading || !detail ? (
            <div className="space-y-3">
              <Skeleton className="h-36 w-full rounded-lg" />
              <Skeleton className="h-80 w-full rounded-lg" />
            </div>
          ) : (
            <>
              <SapQueryPassportHeader detail={detail} currentSql={currentSql} />

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
            </>
          )}
        </div>
      </div>
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
