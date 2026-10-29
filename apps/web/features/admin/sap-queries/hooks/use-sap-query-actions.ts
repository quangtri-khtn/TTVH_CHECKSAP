'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/http-client';
import {
  getSapQueriesGetDetailQueryKey,
  getSapQueriesListQueryKey,
  useSapQueriesPublish,
  useSapQueriesResetDefault,
  useSapQueriesReview,
  useSapQueriesRollback,
} from '@/lib/api/generated/sap-queries/sap-queries';
import {
  getSapReturnMonitorGetDataQueryKey,
  getSapSalesMonitorGetDataQueryKey,
} from '@/lib/api/generated/sap-monitor/sap-monitor';
import type {
  ReviewSapQueryResultDto,
  SapQueryDetailDto,
} from '@/lib/api/generated/model';

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return (
        error.message ||
        'Hệ thống đang thực thi một lượt Review khác, vui lòng thử lại sau vài giây.'
      );
    }
    return error.message || fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export interface ReviewQueryInput {
  key: string;
  sqlText: string;
  dateFrom?: string;
  brand?: string;
}

export interface PublishQueryInput {
  key: string;
  sqlText: string;
  changeNote: string;
}

export interface RollbackQueryInput {
  key: string;
  targetVersionNo: number;
  changeNote?: string;
}

export interface ResetDefaultQueryInput {
  key: string;
  changeNote?: string;
}

export function useSapQueryActions() {
  const queryClient = useQueryClient();

  const reviewMutation = useSapQueriesReview();
  const publishMutation = useSapQueriesPublish();
  const rollbackMutation = useSapQueriesRollback();
  const resetDefaultMutation = useSapQueriesResetDefault();

  const invalidateQueryAndMonitors = useCallback(
    async (key: string) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getSapQueriesListQueryKey() }),
        queryClient.invalidateQueries({
          queryKey: getSapQueriesGetDetailQueryKey(key),
        }),
        queryClient.invalidateQueries({
          queryKey: getSapSalesMonitorGetDataQueryKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: getSapReturnMonitorGetDataQueryKey(),
        }),
      ]);
    },
    [queryClient],
  );

  const copySqlToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Đã sao chép ${label} vào bộ nhớ tạm`);
    } catch {
      toast.error(`Không thể sao chép ${label}`);
    }
  }, []);

  const reviewQuery = useCallback(
    async ({
      key,
      sqlText,
      dateFrom,
      brand,
    }: ReviewQueryInput): Promise<ReviewSapQueryResultDto | null> => {
      try {
        const res = await reviewMutation.mutateAsync({
          key,
          data: { sqlText, dateFrom, brand },
        });
        const result = res.data.data;
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: getSapQueriesListQueryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: getSapQueriesGetDetailQueryKey(key),
          }),
        ]);

        if (result.valid) {
          toast.success(
            `Review & Validate hợp lệ (${result.rowCount} dòng · ${result.durationMs}ms). Bạn có thể Xuất bản.`,
          );
        } else {
          const firstError =
            result.errors[0] ??
            'Câu truy vấn chưa đạt điều kiện Hợp đồng Cột hoặc Bảo mật.';
          toast.error(`Review không hợp lệ: ${firstError}`);
        }
        return result;
      } catch (err) {
        toast.error(
          getErrorMessage(err, `Không thể chạy Review & Validate cho câu ${key}`),
        );
        return null;
      }
    },
    [reviewMutation, queryClient],
  );

  const publishQuery = useCallback(
    async ({
      key,
      sqlText,
      changeNote,
    }: PublishQueryInput): Promise<SapQueryDetailDto | null> => {
      try {
        const res = await publishMutation.mutateAsync({
          key,
          data: { sqlText, changeNote: changeNote.trim() },
        });
        const detail = res.data.data;
        toast.success(
          `Đã xuất bản câu ${key} lên phiên bản v${detail.currentVersionNo}`,
        );
        await invalidateQueryAndMonitors(key);
        return detail;
      } catch (err) {
        toast.error(getErrorMessage(err, `Xuất bản câu truy vấn ${key} thất bại`));
        return null;
      }
    },
    [publishMutation, invalidateQueryAndMonitors],
  );

  const rollbackQuery = useCallback(
    async ({
      key,
      targetVersionNo,
      changeNote,
    }: RollbackQueryInput): Promise<SapQueryDetailDto | null> => {
      try {
        const res = await rollbackMutation.mutateAsync({
          key,
          data: {
            targetVersionNo,
            changeNote: changeNote?.trim() || undefined,
          },
        });
        const detail = res.data.data;
        toast.success(
          `Đã hoàn tác câu ${key} về nội dung v${targetVersionNo} (phiên bản mới v${detail.currentVersionNo})`,
        );
        await invalidateQueryAndMonitors(key);
        return detail;
      } catch (err) {
        toast.error(
          getErrorMessage(err, `Hoàn tác câu truy vấn ${key} thất bại`),
        );
        return null;
      }
    },
    [rollbackMutation, invalidateQueryAndMonitors],
  );

  const resetDefaultQuery = useCallback(
    async ({
      key,
      changeNote,
    }: ResetDefaultQueryInput): Promise<SapQueryDetailDto | null> => {
      try {
        const res = await resetDefaultMutation.mutateAsync({
          key,
          data: {
            changeNote: changeNote?.trim() || undefined,
          },
        });
        const detail = res.data.data;
        toast.success(
          `Đã khôi phục câu ${key} về SQL gốc chuẩn v1 (phiên bản mới v${detail.currentVersionNo})`,
        );
        await invalidateQueryAndMonitors(key);
        return detail;
      } catch (err) {
        toast.error(
          getErrorMessage(err, `Khôi phục mặc định cho câu ${key} thất bại`),
        );
        return null;
      }
    },
    [resetDefaultMutation, invalidateQueryAndMonitors],
  );

  return {
    copySqlToClipboard,
    reviewQuery,
    publishQuery,
    rollbackQuery,
    resetDefaultQuery,
    isReviewing: reviewMutation.isPending,
    isPublishing: publishMutation.isPending,
    isRollingBack: rollbackMutation.isPending,
    isResettingDefault: resetDefaultMutation.isPending,
    isMutating:
      reviewMutation.isPending ||
      publishMutation.isPending ||
      rollbackMutation.isPending ||
      resetDefaultMutation.isPending,
  };
}
