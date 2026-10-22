import type { ColumnDef } from '@tanstack/react-table';
import {
  CheckCircle2,
  CircleCheck,
  CircleDashed,
  CircleX,
  Database,
  KeyRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTableColumnHeader } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import type { StatusTone } from '@/lib/admin/status-tone';
import type { SapConnectionDto } from '@/lib/api/generated/model';

const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const SAP_CONNECTION_STATUS_OPTIONS = [
  { value: 'true', label: 'Đang dùng', icon: CircleCheck, tone: 'success' as StatusTone },
  { value: 'false', label: 'Chưa dùng', icon: CircleDashed, tone: 'neutral' as StatusTone },
] as const;

export function buildSapConnectionsColumns(opts: {
  onTest: (row: SapConnectionDto) => void;
  onActivate: (row: SapConnectionDto) => void;
  onEdit: (row: SapConnectionDto) => void;
  testingId: string | null;
  activatingId: string | null;
  isBusy: boolean;
}): ColumnDef<SapConnectionDto>[] {
  return [
    {
      accessorKey: 'username',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Tài khoản" />,
      meta: { title: 'Tài khoản', thClassName: 'ps-1', tdClassName: 'ps-4' },
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Database className="size-4 shrink-0 text-muted-foreground" />
          <span className="font-mono font-medium">{row.original.username}</span>
        </div>
      ),
      enableHiding: false,
    },
    {
      accessorKey: 'hasPassword',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Mật khẩu" />,
      meta: { title: 'Mật khẩu', thClassName: 'ps-1', tdClassName: 'ps-4' },
      cell: ({ row }) => (
        <StatusBadge
          label={row.original.hasPassword ? 'Đã cấu hình' : 'Chưa cấu hình'}
          tone={row.original.hasPassword ? 'info' : 'warning'}
          icon={KeyRound}
        />
      ),
      enableSorting: false,
    },
    {
      id: 'status',
      accessorFn: (row) => String(row.isActive),
      header: ({ column }) => <DataTableColumnHeader column={column} title="Trạng thái" />,
      meta: { title: 'Trạng thái', thClassName: 'ps-1', tdClassName: 'ps-4' },
      cell: ({ row }) =>
        row.original.isActive ? (
          <StatusBadge label="Đang dùng" tone="success" icon={CircleCheck} />
        ) : (
          <StatusBadge label="Chưa dùng" tone="neutral" icon={CircleDashed} />
        ),
      filterFn: (row, id, value: string[]) => value.includes(row.getValue(id)),
    },
    {
      accessorKey: 'lastTestAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Lần kiểm cuối" />,
      meta: { title: 'Lần kiểm cuối', thClassName: 'ps-1', tdClassName: 'ps-4' },
      cell: ({ row }) => {
        if (row.original.lastTestAt == null) {
          return <span className="text-xs text-muted-foreground">Chưa kiểm tra</span>;
        }
        return (
          <div className="flex flex-col gap-1">
            <StatusBadge
              label={row.original.lastTestOk ? 'Đạt (3/3)' : 'Lỗi kiểm tra'}
              tone={row.original.lastTestOk ? 'success' : 'danger'}
              icon={row.original.lastTestOk ? CheckCircle2 : CircleX}
            />
            <span className="text-xs text-muted-foreground">
              {dateTimeFormatter.format(new Date(row.original.lastTestAt))}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'updatedAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Cập nhật cuối" />,
      meta: { title: 'Cập nhật cuối', thClassName: 'ps-1', tdClassName: 'ps-4' },
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-sm">{row.original.updatedByName ?? '—'}</span>
          <span className="text-xs text-muted-foreground">
            {dateTimeFormatter.format(new Date(row.original.updatedAt))}
          </span>
        </div>
      ),
    },
    {
      id: 'actions',
      enableSorting: false,
      enableHiding: false,
      meta: { className: 'w-56 text-end', tdClassName: 'text-end' },
      cell: ({ row }) => {
        const item = row.original;
        const isTestingThis = opts.testingId === item.id;
        const isActivatingThis = opts.activatingId === item.id;

        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={opts.isBusy}
              onClick={() => opts.onTest(item)}
            >
              {isTestingThis ? 'Đang kiểm...' : 'Kiểm tra'}
            </Button>
            {!item.isActive && (
              <Button
                variant="secondary"
                size="sm"
                disabled={opts.isBusy}
                onClick={() => opts.onActivate(item)}
              >
                {isActivatingThis ? 'Đang bật...' : 'Kích hoạt'}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={opts.isBusy}
              onClick={() => opts.onEdit(item)}
            >
              Sửa
            </Button>
          </div>
        );
      },
    },
  ];
}
