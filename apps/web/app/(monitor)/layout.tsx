'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { usePermissions } from '@/lib/auth/use-permissions';
import { useAuthActions } from '@/features/auth/hooks/use-auth-actions';
import { AppSidebar } from '@/features/shell/components/app-sidebar';
import { AppHeader } from '@/features/shell/components/app-header';
import { SearchProvider } from '@/features/shell/components/search-provider';
import { SearchButton } from '@/features/shell/components/search-button';
import { ThemeSwitch } from '@/features/shell/components/theme-switch';
import { ProfileDropdown } from '@/features/shell/components/profile-dropdown';
import { CommandMenu } from '@/features/shell/components/command-menu';

export default function MonitorLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isError } = useCurrentUser();
  const { permissions } = usePermissions();
  const { logout } = useAuthActions();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (isError || !user) {
      router.replace('/login');
    }
  }, [isLoading, isError, user, router]);

  if (isLoading || isError || !user) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>
    );
  }

  return (
    <SearchProvider>
      <SidebarProvider>
        <AppSidebar user={user} permissions={permissions} onLogout={logout} />
        <SidebarInset className="min-w-0">
          <AppHeader>
            <SearchButton placeholder="Tìm trang nhanh..." />
            <div className="ms-auto flex items-center gap-2">
              <ThemeSwitch />
              <ProfileDropdown user={user} onLogout={logout} />
            </div>
          </AppHeader>
          <div className="mx-auto w-full max-w-[1720px] flex-1 min-w-0 px-4 py-5 sm:px-6">
            {children}
          </div>
        </SidebarInset>
        <CommandMenu user={user} permissions={permissions} />
      </SidebarProvider>
    </SearchProvider>
  );
}
