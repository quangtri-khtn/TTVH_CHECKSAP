'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  TrendingUp,
  RotateCcw,
  Database,
  Users,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { usePermissions } from '@/lib/auth/use-permissions';
import { useAuthActions } from '@/features/auth/hooks/use-auth-actions';
import { PERMISSIONS } from '@/lib/auth/permission-keys';
import { getInitials } from '@/lib/shell/get-initials';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Monitor Bán Hàng',
    href: '/sap/monitor-ban',
    icon: TrendingUp,
    permission: PERMISSIONS.SAP_MONITOR_READ,
  },
  {
    label: 'Monitor Luồng Trả',
    href: '/sap/monitor-tra',
    icon: RotateCcw,
    permission: PERMISSIONS.SAP_MONITOR_READ,
  },
  {
    label: 'Cấu Hình SAP',
    href: '/admin/sap-connections',
    icon: Database,
    permission: PERMISSIONS.SAP_CONNECTION_MANAGE,
  },
  {
    label: 'Quản Trị User',
    href: '/admin/users',
    icon: Users,
    permission: PERMISSIONS.USER_READ,
  },
];

export default function MonitorLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isError } = useCurrentUser();
  const { can, isSuperAdmin } = usePermissions();
  const { logout } = useAuthActions();
  const pathname = usePathname();
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
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (!item.permission) return true;
    return isSuperAdmin || can(item.permission);
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75 shadow-xs">
        <div className="mx-auto flex h-16 max-w-[1720px] items-center justify-between px-4 sm:px-6">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <Link
              href="/sap/monitor-ban"
              className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-xs">
                <Sparkles className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight text-foreground leading-none">
                  Maycha
                </span>
                <span className="text-xs font-medium text-muted-foreground leading-tight">
                  SAP Monitor
                </span>
              </div>
            </Link>
          </div>

          {/* Horizontal Navigation Tabs */}
          <nav className="flex items-center gap-1.5 overflow-x-auto py-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + '/');

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors whitespace-nowrap',
                    isActive
                      ? 'bg-primary/10 text-primary font-semibold shadow-xs'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className={cn('size-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Menu & Logout */}
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2.5 px-2 py-1.5 h-auto hover:bg-muted rounded-lg"
                  />
                }
              >
                <Avatar className="size-8 border">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {getInitials(user.name || user.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden flex-col items-start text-left md:flex">
                  <span className="text-sm font-semibold text-foreground leading-tight">
                    {user.name || user.email}
                  </span>
                  <span className="text-[11px] text-muted-foreground leading-tight">
                    {user.role === 'ADMIN' ? 'Quản trị viên' : 'Nhân viên'}
                  </span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.name || 'Người dùng'}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    <div className="pt-1.5">
                      <Badge variant="secondary" className="text-[10px] font-medium">
                        {user.role === 'ADMIN' ? 'Quản trị viên' : 'Nhân viên'}
                      </Badge>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                >
                  <LogOut className="size-4 mr-2" />
                  <span>Đăng xuất</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 min-w-0 px-4 py-6 sm:px-6 md:py-8 mx-auto max-w-[1720px] w-full">
        {children}
      </main>
    </div>
  );
}
