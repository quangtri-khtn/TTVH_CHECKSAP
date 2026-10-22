'use client';

import { ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { PermissionGroupState } from '@/lib/admin/user-permission-matrix';

export interface UserPermissionMatrixProps {
  groups: PermissionGroupState[];
  selectedRole: string;
  onToggle: (key: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function UserPermissionMatrix({
  groups,
  selectedRole,
  onToggle,
  isLoading = false,
  disabled = false,
}: UserPermissionMatrixProps) {
  if (isLoading) {
    return (
      <div className="space-y-4 py-2">
        <Skeleton className="h-4 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  // Quản trị viên (ADMIN) mặc định có toàn quyền hệ thống — ẩn ma trận để tránh gây nhầm lẫn
  if (selectedRole === 'ADMIN') {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <ShieldCheck className="size-4 text-primary" />
          <span>Toàn quyền hệ thống</span>
        </div>
        <p className="mt-1 text-xs">
          Tài khoản Quản trị viên (ADMIN) mặc định có toàn bộ quyền trong hệ thống. Không cần cấu hình quyền bổ sung.
        </p>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="py-4 text-center text-xs text-muted-foreground">
        Không có danh mục quyền nào để hiển thị.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.category} className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {group.category}
          </div>
          <div className="divide-y rounded-lg border bg-card">
            {group.permissions.map((perm) => {
              const isRowDisabled = disabled || perm.disabled;
              return (
                <div
                  key={perm.key}
                  className={cn(
                    'flex items-center justify-between gap-3 p-3 transition-colors',
                    isRowDisabled ? 'opacity-80' : 'hover:bg-muted/40',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`perm-${perm.key}`}
                      checked={perm.checked}
                      disabled={isRowDisabled}
                      onCheckedChange={() => onToggle(perm.key)}
                      className="mt-0.5"
                    />
                    <label
                      htmlFor={`perm-${perm.key}`}
                      className={cn(
                        'grid gap-0.5 select-none text-start',
                        isRowDisabled ? 'cursor-not-allowed' : 'cursor-pointer',
                      )}
                    >
                      <span className="text-sm font-medium leading-none text-foreground">
                        {perm.label}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {perm.key}
                      </span>
                    </label>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {perm.inheritedFromRole && (
                      <Badge variant="secondary" className="text-[11px] font-normal">
                        Theo vai trò
                      </Badge>
                    )}
                    {Boolean(perm.impliedBy) && (
                      <Badge
                        variant="outline"
                        className="border-primary/30 text-[11px] font-normal text-primary"
                      >
                        Kéo theo
                      </Badge>
                    )}
                    {perm.grantedAsCustom && (
                      <Badge variant="default" className="text-[11px] font-normal">
                        Bổ sung
                      </Badge>
                    )}
                    {perm.disabled && !perm.inheritedFromRole && !perm.impliedBy && (
                      <span className="text-[11px] italic text-muted-foreground">
                        Không có quyền cấp
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
