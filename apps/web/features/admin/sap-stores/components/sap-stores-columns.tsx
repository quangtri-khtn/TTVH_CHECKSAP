'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { StatusBadge } from '@/components/status-badge';
import type { SapStoreDto } from '@/lib/api/generated/model';
import { formatSyncedAt, isStoreQueryEnabled } from '@/lib/admin/sap-store-domain';

export interface SapStoresColumnsCallbacks {
  updatingStoreCode: string | null;
  onToggleActive: (code: string, currentVal: boolean) => void;
}

export function createSapStoresColumns({
  updatingStoreCode,
  onToggleActive,
}: SapStoresColumnsCallbacks): ColumnDef<SapStoreDto>[] {
  return [
    {
      accessorKey: 'code',
      header: 'Mã kho',
      cell: ({ row }) => (
        <span className="font-mono text-xs font-semibold text-foreground">
          {row.original.code}
        </span>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Tên cửa hàng / Kho',
      cell: ({ row }) => (
        <span className="text-xs font-medium text-foreground">{row.original.name}</span>
      ),
    },
    {
      accessorKey: 'brandCode',
      header: 'Thương hiệu (U_Brand)',
      cell: ({ row }) => {
        const { brandCode, brandName } = row.original;
        if (!brandCode) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return (
          <Badge variant="outline" className="font-mono text-[11px] font-normal">
            {brandCode} {brandName ? `— ${brandName}` : ''}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'sapInactive',
      header: 'Trạng thái trên SAP',
      cell: ({ row }) =>
        row.original.sapInactive ? (
          <StatusBadge tone="neutral" icon={XCircle} label="Ngưng trên SAP" />
        ) : (
          <StatusBadge tone="success" icon={CheckCircle2} label="Hoạt động" />
        ),
    },
    {
      id: 'isActiveQuery',
      header: 'Cho phép Query',
      cell: ({ row }) => {
        const store = row.original;
        const isRowUpdating = updatingStoreCode === store.code;
        const isEnabled = isStoreQueryEnabled(store);
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={isEnabled}
              disabled={isRowUpdating}
              aria-label={`Bật/tắt cho phép query cho kho ${store.code}`}
              onCheckedChange={() => onToggleActive(store.code, isEnabled)}
            />
            <span className="text-xs text-muted-foreground">
              {isEnabled ? 'Đang bật' : 'Tắt'}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'syncedAt',
      header: 'Đồng bộ cuối',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {formatSyncedAt(row.original.syncedAt)}
        </span>
      ),
    },
  ];
}
