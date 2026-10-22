import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DataTableColumnHeader } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { findUserRole, findUserStatus } from '@/lib/admin/user-table-options';
import type { UserResponseDto } from '@/lib/api/generated/model';
import { UsersRowActions } from './users-row-actions';

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function buildUsersColumns(opts: {
  currentUserId: string;
  currentUser?: UserResponseDto;
  canManage?: boolean;
  onEdit: (row: UserResponseDto) => void;
  onToggleActive: (row: UserResponseDto) => void;
}): ColumnDef<UserResponseDto>[] {
  const columns: ColumnDef<UserResponseDto>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        // base-ui tách `indeterminate` thành prop riêng thay vì nhận chuỗi
        // "indeterminate" trong `checked` như một số thư viện khác.
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Chọn tất cả"
          className="translate-y-0.5"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={`Chọn ${row.original.name}`}
          className="translate-y-0.5"
        />
      ),
      enableSorting: false,
      enableHiding: false,
      meta: { className: 'w-10' },
    },
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Họ tên" />,
      meta: { title: 'Họ tên', thClassName: 'ps-1', tdClassName: 'ps-4' },
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{row.original.name}</span>
          {row.original.id === opts.currentUserId && (
            <Badge variant="outline" className="shrink-0 text-xs font-normal">
              Bạn
            </Badge>
          )}
        </div>
      ),
      enableHiding: false,
    },
    {
      accessorKey: 'email',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
      meta: { title: 'Email', thClassName: 'ps-1', tdClassName: 'ps-4' },
      cell: ({ row }) => (
        <span className="truncate text-muted-foreground">{row.original.email}</span>
      ),
    },
    {
      accessorKey: 'role',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Vai trò" />,
      meta: { title: 'Vai trò', thClassName: 'ps-1', tdClassName: 'ps-4' },
      cell: ({ row }) => {
        const role = findUserRole(row.original.role);
        if (!role) return null;
        return <StatusBadge label={role.label} tone={role.tone} icon={role.icon} />;
      },
      // Faceted filter đưa vào mảng giá trị, nên so khớp theo "có nằm trong tập
      // đã chọn" thay vì so bằng chuỗi đơn.
      filterFn: (row, id, value: string[]) => value.includes(row.getValue(id)),
    },
    {
      accessorKey: 'customPermissions',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Quyền bổ sung" />,
      meta: { title: 'Quyền bổ sung', thClassName: 'ps-1', tdClassName: 'ps-4' },
      cell: ({ row }) => {
        const perms = row.original.customPermissions ?? [];
        if (perms.length === 0) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return (
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex cursor-default" />}>
              <Badge variant="outline" className="font-mono text-xs font-normal">
                +{perms.length}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs space-y-1">
              <p className="text-xs font-medium">Quyền bổ sung ({perms.length}):</p>
              <ul className="list-inside list-disc space-y-0.5 font-mono text-[11px]">
                {perms.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        );
      },
      enableSorting: false,
    },
    {
      id: 'status',
      accessorFn: (row) => String(row.isActive),
      header: ({ column }) => <DataTableColumnHeader column={column} title="Trạng thái" />,
      meta: { title: 'Trạng thái', thClassName: 'ps-1', tdClassName: 'ps-4' },
      cell: ({ row }) => {
        const status = findUserStatus(row.original.isActive);
        if (!status) return null;
        return <StatusBadge label={status.label} tone={status.tone} icon={status.icon} />;
      },
      filterFn: (row, id, value: string[]) => value.includes(row.getValue(id)),
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Ngày tạo" />,
      meta: { title: 'Ngày tạo', thClassName: 'ps-1', tdClassName: 'ps-4' },
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {dateFormatter.format(new Date(row.original.createdAt))}
        </span>
      ),
    },
  ];

  if (opts.canManage !== false) {
    columns.push({
      id: 'actions',
      cell: ({ row }) => (
        <UsersRowActions
          user={row.original}
          actor={opts.currentUser}
          isCurrentUser={row.original.id === opts.currentUserId}
          onEdit={opts.onEdit}
          onToggleActive={opts.onToggleActive}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      meta: { className: 'w-12' },
    });
  }

  return columns;
}
