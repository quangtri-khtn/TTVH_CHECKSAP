'use client';

import { useMemo } from 'react';
import { DataTable, DataTablePagination, DataTableToolbar } from '@/components/data-table';
import { useAdminTable } from '@/components/data-table/use-admin-table';
import type { SapConnectionDto } from '@/lib/api/generated/model';
import {
  buildSapConnectionsColumns,
  SAP_CONNECTION_STATUS_OPTIONS,
} from './sap-connections-columns';

export function SapConnectionsTable({
  data,
  isLoading,
  onTest,
  onActivate,
  onEdit,
  testingId,
  activatingId,
  isBusy,
}: {
  data: SapConnectionDto[];
  isLoading: boolean;
  onTest: (row: SapConnectionDto) => void;
  onActivate: (row: SapConnectionDto) => void;
  onEdit: (row: SapConnectionDto) => void;
  testingId: string | null;
  activatingId: string | null;
  isBusy: boolean;
}) {
  const columns = useMemo(
    () =>
      buildSapConnectionsColumns({
        onTest,
        onActivate,
        onEdit,
        testingId,
        activatingId,
        isBusy,
      }),
    [onTest, onActivate, onEdit, testingId, activatingId, isBusy],
  );

  const table = useAdminTable({
    data,
    columns,
    defaultSorting: [],
  });

  return (
    <div className="flex flex-col gap-4">
      <DataTableToolbar
        table={table}
        searchPlaceholder="Tìm theo tài khoản SQL..."
        searchKey="username"
        filters={[
          {
            columnId: 'status',
            title: 'Trạng thái',
            options: [...SAP_CONNECTION_STATUS_OPTIONS],
          },
        ]}
      />
      <DataTable
        table={table}
        columnCount={columns.length}
        isLoading={isLoading}
        emptyState="Chưa có tài khoản kết nối SAP nào. Hãy bấm Thêm tài khoản để cấu hình."
      />
      <DataTablePagination table={table} />
    </div>
  );
}
