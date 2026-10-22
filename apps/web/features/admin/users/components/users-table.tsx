'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { DataTable, DataTablePagination, DataTableToolbar } from '@/components/data-table';
import { USER_ROLES, USER_STATUSES } from '@/lib/admin/user-table-options';
import type { UserResponseDto } from '@/lib/api/generated/model';
import { usePermissions } from '@/lib/auth/use-permissions';
import { PERMISSIONS } from '@/lib/auth/permission-keys';
import { buildUsersColumns } from './users-columns';
import { UsersBulkActions } from './users-bulk-actions';

export function UsersTable({
  data,
  isLoading,
  currentUserId,
  currentUser,
  onEdit,
  onToggleActive,
  onDeactivateSelected,
  onReactivateSelected,
  actions,
}: {
  data: UserResponseDto[];
  isLoading: boolean;
  currentUserId: string;
  currentUser?: UserResponseDto;
  onEdit: (row: UserResponseDto) => void;
  onToggleActive: (row: UserResponseDto) => void;
  onDeactivateSelected: (rows: UserResponseDto[]) => void;
  onReactivateSelected: (rows: UserResponseDto[]) => void;
  actions?: ReactNode;
}) {
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const [globalFilter, setGlobalFilter] = useState<string | undefined>();

  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.USER_MANAGE);

  const columns = useMemo(
    () =>
      buildUsersColumns({
        currentUserId,
        currentUser,
        canManage,
        onEdit,
        onToggleActive,
      }),
    [currentUserId, currentUser, canManage, onEdit, onToggleActive],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility, rowSelection, globalFilter },
    enableRowSelection: true,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  return (
    <div className="flex flex-col gap-4">
      <DataTableToolbar
        table={table}
        searchPlaceholder="Tìm theo tên hoặc email..."
        actions={actions}
        filters={[
          { columnId: 'role', title: 'Vai trò', options: [...USER_ROLES] },
          { columnId: 'status', title: 'Trạng thái', options: [...USER_STATUSES] },
        ]}
      />

      <DataTable
        table={table}
        columnCount={columns.length}
        isLoading={isLoading}
        emptyState="Không tìm thấy người dùng nào."
      />

      <DataTablePagination table={table} />

      <UsersBulkActions
        table={table}
        currentUserId={currentUserId}
        actor={currentUser}
        canManage={canManage}
        onDeactivateSelected={onDeactivateSelected}
        onReactivateSelected={onReactivateSelected}
      />
    </div>
  );
}
