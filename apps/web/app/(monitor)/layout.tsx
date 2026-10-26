'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Database,
  LogOut,
  RotateCcw,
  ShieldCheck,
  Store,
  TrendingUp,
  Users,
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
import { ThemeSwitch } from '@/features/shell/components/theme-switch';

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
    label: 'Cửa Hàng SAP',
    href: '/admin/sap-stores',
    icon: Store,
    permission: PERMISSIONS.SAP_STORE_MANAGE,
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
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled((document.body.scrollTop || document.documentElement.scrollTop) > 8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
          <Skeleton className="h-11 w-11 rounded-xl" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>
    );
  }

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (!item.permission) return true;
    return isSuperAdmin || can(item.permission);
  });

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* Top Navigation Bar */}
      <header
        className={cn(
          'sticky top-0 z-40 w-full border-b bg-card/90 backdrop-blur-md transition-shadow duration-150',
          scrolled ? 'border-border shadow-2xs' : 'border-border/70',
        )}
      >
        <div className="mx-auto flex h-14 max-w-[1720px] items-center justify-between gap-4 px-4 sm:px-6">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2.5">
            <Link
              href="/sap/monitor-ban"
              className="flex items-center gap-2.5 transition-opacity hover:opacity-85"
            >
              <div className="flex size-8 items-center justify-center rounded-lg border border-border/80 bg-background p-1 shadow-2xs">
                <Image
                  src="/brand/logo-mark.png"
                  alt="Thịnh Thế Vinh Hoa Logo"
                  width={22}
                  height={22}
                  className="object-contain"
                  priority
                />
              </div>
              <div className="flex flex-col">
                <span className="font-heading text-xs font-semibold tracking-tight text-foreground sm:text-sm leading-none">
                  Thịnh Thế Vinh Hoa
                </span>
                <span className="text-[11px] text-muted-foreground leading-tight">
                  SAP Monitor
                </span>
              </div>
            </Link>
          </div>

          {/* Horizontal Navigation Tabs */}
          <nav
            aria-label="Điều hướng chính"
            className="flex items-center gap-1 overflow-x-auto rounded-lg border border-border/60 bg-muted/60 p-1"
          >
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + '/');

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150 whitespace-nowrap',
                    isActive
                      ? 'bg-card text-foreground font-semibold shadow-2xs ring-1 ring-border/70'
                      : 'text-muted-foreground hover:bg-card/50 hover:text-foreground',
                  )}
                >
                  <Icon
                    className={cn(
                      'size-3.5',
                      isActive ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Theme Switch & User Menu */}
          <div className="flex items-center gap-2">
            <ThemeSwitch />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    className="flex h-auto items-center gap-2.5 rounded-xl border border-transparent px-2.5 py-1.5 transition-all hover:border-border/70 hover:bg-muted/70"
                  />
                }
              >
                <Avatar className="size-8 border border-primary/20 shadow-xs">
                  <AvatarFallback className="bg-primary/10 font-heading text-xs font-bold text-primary">
                    {getInitials(user.name || user.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden flex-col items-start text-left md:flex">
                  <span className="text-xs font-semibold text-foreground leading-tight">
                    {user.name || user.email}
                  </span>
                  <span className="text-[11px] text-muted-foreground leading-tight">
                    {user.role === 'ADMIN' ? 'Quản trị viên' : 'Nhân viên'}
                  </span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1.5">
                    <p className="font-heading text-sm font-semibold leading-none">
                      {user.name || 'Người dùng'}
                    </p>
                    <p className="font-mono text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                    <div className="pt-1">
                      <Badge
                        variant="outline"
                        className="gap-1 border-primary/25 bg-primary/10 text-[10px] font-semibold text-primary"
                      >
                        <ShieldCheck className="size-3" />
                        {user.role === 'ADMIN' ? 'Quản trị viên hệ thống' : 'Nhân viên vận hành'}
                      </Badge>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <LogOut className="mr-2 size-4" />
                  <span>Đăng xuất khỏi hệ thống</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="relative z-10 mx-auto w-full max-w-[1720px] flex-1 min-w-0 px-4 py-5 sm:px-6 md:py-6 animate-in fade-in duration-300">
        {children}
      </main>
    </div>
  );
}
