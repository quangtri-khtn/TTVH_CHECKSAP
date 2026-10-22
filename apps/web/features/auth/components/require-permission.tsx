'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/lib/auth/use-permissions';

export interface RequirePermissionProps {
  permission: string;
  fallbackTarget?: string;
  children: React.ReactNode;
}

export function RequirePermission({
  permission,
  fallbackTarget = '/sap/monitor-ban',
  children,
}: RequirePermissionProps) {
  const { can, isLoading } = usePermissions();
  const router = useRouter();
  const hasNotifiedRef = useRef(false);

  const hasAccess = can(permission);

  useEffect(() => {
    if (isLoading) return;
    if (!hasAccess && !hasNotifiedRef.current) {
      hasNotifiedRef.current = true;
      toast.error('Bạn không có quyền truy cập');
      router.replace(fallbackTarget);
    }
  }, [isLoading, hasAccess, router, fallbackTarget]);

  if (isLoading || !hasAccess) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  return <>{children}</>;
}
