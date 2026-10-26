'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { getNavGroups, isNavItemActive } from '@/lib/shell/sidebar-nav-data';
import type { UserResponseDto } from '@/lib/api/generated/model';
import { NavUser } from './nav-user';

export function AppSidebar({
  user,
  permissions,
  onLogout,
}: {
  user: UserResponseDto;
  permissions?: string[];
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const navGroups = getNavGroups(permissions ?? user.permissions);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              onClick={() => setOpenMobile(false)}
              render={<Link href="/sap/monitor-ban" />}
            >
              <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-background p-1 shadow-2xs">
                <Image
                  src="/brand/logo-mark.png"
                  alt="Thịnh Thế Vinh Hoa"
                  width={24}
                  height={24}
                  className="size-6 object-contain"
                />
              </div>
              <div className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-heading font-semibold">Thịnh Thế Vinh Hoa</span>
                <span className="truncate text-xs text-muted-foreground">SAP Monitor</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const active = isNavItemActive(item, pathname);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.title}
                      onClick={() => setOpenMobile(false)}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} onLogout={onLogout} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
