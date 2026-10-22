'use client';

import { Ban, MoreHorizontal, Pencil, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { UserResponseDto } from '@/lib/api/generated/model';
import { canActorManageUser, canActorDeactivateUser } from '@/lib/admin/user-manage-guards';

export function UsersRowActions({
  user,
  actor,
  isCurrentUser,
  onEdit,
  onToggleActive,
}: {
  user: UserResponseDto;
  actor?: UserResponseDto;
  isCurrentUser: boolean;
  onEdit: (row: UserResponseDto) => void;
  onToggleActive: (row: UserResponseDto) => void;
}) {
  const canManage = canActorManageUser(actor, user);
  const canEdit = isCurrentUser || canManage;
  const canDeactivate = canActorDeactivateUser(actor, user);
  const canReactivate = !isCurrentUser && canManage;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Thao tác với ${user.name}`}
            onClick={(event) => event.stopPropagation()}
          />
        }
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem disabled={!canEdit} onClick={() => onEdit(user)}>
          <Pencil className="size-4" />
          Sửa
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {user.isActive ? (
          <DropdownMenuItem
            variant="destructive"
            disabled={!canDeactivate}
            onClick={() => onToggleActive(user)}
          >
            <Ban className="size-4" />
            Vô hiệu hoá
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            disabled={!canReactivate}
            onClick={() => onToggleActive(user)}
          >
            <RotateCcw className="size-4" />
            Kích hoạt lại
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
