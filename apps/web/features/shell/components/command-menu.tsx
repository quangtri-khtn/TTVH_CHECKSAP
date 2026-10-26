'use client';

import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Laptop, Moon, Sun } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { getNavGroups } from '@/lib/shell/sidebar-nav-data';
import type { UserResponseDto } from '@/lib/api/generated/model';
import { useSearch } from './search-provider';

/**
 * Bảng lệnh mở bằng Ctrl/⌘+K: nhảy trang và đổi giao diện.
 *
 * Không dùng `CommandDialog` của registry vì nó đặt DialogTitle bên ngoài
 * DialogContent — base-ui yêu cầu tiêu đề nằm trong popup, đặt ngoài sẽ ném
 * lỗi "Cannot read properties of undefined (reading 'subscribe')".
 */
export function CommandMenu({
  user,
  permissions,
}: {
  user: UserResponseDto;
  permissions?: string[];
}) {
  const { open, setOpen } = useSearch();
  const router = useRouter();
  const { setTheme } = useTheme();
  const navGroups = getNavGroups(permissions ?? user.permissions);
  const runCommand = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-1/3 translate-y-0 overflow-hidden rounded-xl! p-0" showCloseButton={false}>
        <DialogTitle className="sr-only">Bảng lệnh</DialogTitle>
        <DialogDescription className="sr-only">Tìm trang hoặc chạy lệnh nhanh</DialogDescription>

        <Command>
          <CommandInput placeholder="Nhập tên trang hoặc lệnh..." />
          <CommandList className="max-h-72">
            <CommandEmpty>Không tìm thấy kết quả.</CommandEmpty>

            {navGroups.map((group) => (
              <CommandGroup key={group.title} heading={group.title}>
                {group.items.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={`${group.title} ${item.title}`}
                    onSelect={() => runCommand(() => router.push(item.href))}
                  >
                    <item.icon className="size-4 text-muted-foreground" />
                    {item.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}

            <CommandSeparator />

            <CommandGroup heading="Giao diện">
              <CommandItem value="giao diện sáng" onSelect={() => runCommand(() => setTheme('light'))}>
                <Sun className="size-4 text-muted-foreground" />
                Sáng
              </CommandItem>
              <CommandItem value="giao diện tối" onSelect={() => runCommand(() => setTheme('dark'))}>
                <Moon className="size-4 text-muted-foreground" />
                Tối
              </CommandItem>
              <CommandItem
                value="giao diện theo hệ thống"
                onSelect={() => runCommand(() => setTheme('system'))}
              >
                <Laptop className="size-4 text-muted-foreground" />
                Theo hệ thống
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
