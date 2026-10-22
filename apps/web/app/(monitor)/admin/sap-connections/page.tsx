'use client';

import { useCallback, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSapConnectionListConnections } from '@/lib/api/generated/sap-connections/sap-connections';
import { useSapConnectionActions } from '@/features/admin/hooks/use-sap-connection-actions';
import { AdminPageHeader } from '@/features/admin/components/admin-page-header';
import { SapConnectionsTable } from '@/features/admin/sap-connections/components/sap-connections-table';
import { SapConnectionsMutateDrawer } from '@/features/admin/sap-connections/components/sap-connections-mutate-drawer';
import { SapConnectionTestDialog } from '@/features/admin/sap-connections/components/sap-connection-test-dialog';
import { SapConnectionActivateDialog } from '@/features/admin/sap-connections/components/sap-connection-activate-dialog';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { usePermissions } from '@/lib/auth/use-permissions';
import { PERMISSIONS } from '@/lib/auth/permission-keys';
import {
  buildCreateSapConnectionPayload,
  buildUpdateSapConnectionPayload,
  getSapConnectionErrorMessage,
  type SapConnectionFormValues,
} from '@/lib/admin/sap-connection-schemas';
import type { SapConnectionDto, SapConnectionTestResultDto } from '@/lib/api/generated/model';

export default function AdminSapConnectionsPage() {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.SAP_CONNECTION_MANAGE);
  const listQuery = useSapConnectionListConnections({ query: { enabled: canManage } });
  const rows = useMemo(() => listQuery.data?.data.data ?? [], [listQuery.data]);

  const {
    create,
    update,
    testConnection,
    activate,
    isMutatingForm,
    isTesting,
    testingId,
    isActivating,
    activatingId,
  } = useSapConnectionActions();

  const [drawerState, setDrawerState] = useState<{ open: boolean; editingId?: string }>({
    open: false,
  });
  const currentRow = useMemo(
    () => rows.find((r) => r.id === drawerState.editingId),
    [rows, drawerState.editingId],
  );
  const [activateTarget, setActivateTarget] = useState<SapConnectionDto | null>(null);
  const [testDialogState, setTestDialogState] = useState<{
    open: boolean;
    target: SapConnectionDto | null;
    result: SapConnectionTestResultDto | null;
    errorMessage: string | null;
  }>({
    open: false,
    target: null,
    result: null,
    errorMessage: null,
  });

  const handleSubmitForm = async (values: SapConnectionFormValues) => {
    try {
      if (drawerState.editingId) {
        if (!currentRow) {
          setDrawerState((prev) => ({ ...prev, open: false }));
          return;
        }
        const payload = buildUpdateSapConnectionPayload(values, currentRow);
        if (payload === null) {
          setDrawerState((prev) => ({ ...prev, open: false }));
          return;
        }
        await update(currentRow.id, payload, currentRow.isActive);
      } else {
        await create(buildCreateSapConnectionPayload(values));
      }
      setDrawerState((prev) => ({ ...prev, open: false }));
    } catch {
      // Giữ nguyên drawer mở để người dùng chỉnh lại dữ liệu
    }
  };

  const handleRunTest = useCallback(
    async (row: SapConnectionDto) => {
      setTestDialogState({ open: true, target: row, result: null, errorMessage: null });
      try {
        const result = await testConnection(row.id);
        setTestDialogState((prev) => ({ ...prev, result }));
      } catch (err) {
        setTestDialogState((prev) => ({
          ...prev,
          errorMessage: getSapConnectionErrorMessage(err, 'Không thể kiểm tra kết nối SAP'),
        }));
      }
    },
    [testConnection],
  );

  const handleEdit = useCallback((row: SapConnectionDto) => {
    setDrawerState({ open: true, editingId: row.id });
  }, []);

  const handleRetryTest = () => {
    if (testDialogState.target && !isTesting) {
      void handleRunTest(testDialogState.target);
    }
  };

  const handleConfirmActivate = async () => {
    if (!activateTarget) return;
    try {
      await activate(activateTarget.id);
      setActivateTarget(null);
    } catch {
      setActivateTarget(null);
    }
  };

  return (
    <RequirePermission permission={PERMISSIONS.SAP_CONNECTION_MANAGE}>
      <div className="flex flex-1 flex-col gap-6">
        <AdminPageHeader
          title="Kết nối SAP"
          description="Quản lý tài khoản SQL Server trung gian phục vụ truy vấn Master Board (SAP HANA qua Linked Server)."
          actions={
            <Button onClick={() => setDrawerState({ open: true, editingId: undefined })}>
              <Plus className="size-4 mr-1.5" />
              Thêm tài khoản
            </Button>
          }
        />

        <SapConnectionsTable
          data={rows}
          isLoading={listQuery.isLoading}
          onTest={handleRunTest}
          onActivate={setActivateTarget}
          onEdit={handleEdit}
          testingId={testingId}
          activatingId={activatingId}
          isBusy={isTesting || isActivating || listQuery.isFetching}
        />

        <SapConnectionsMutateDrawer
          open={drawerState.open}
          onOpenChange={(open) => setDrawerState((prev) => ({ ...prev, open }))}
          currentRow={currentRow}
          onSubmit={handleSubmitForm}
          isPending={isMutatingForm}
        />

        <SapConnectionTestDialog
          open={testDialogState.open}
          onOpenChange={(open) => setTestDialogState((prev) => ({ ...prev, open }))}
          target={testDialogState.target}
          isTesting={isTesting}
          result={testDialogState.result}
          errorMessage={testDialogState.errorMessage}
          onRetry={handleRetryTest}
        />

        <SapConnectionActivateDialog
          open={activateTarget !== null}
          onOpenChange={(open) => {
            if (!open) setActivateTarget(null);
          }}
          target={activateTarget}
          isPending={isActivating}
          onConfirm={handleConfirmActivate}
        />
      </div>
    </RequirePermission>
  );
}
