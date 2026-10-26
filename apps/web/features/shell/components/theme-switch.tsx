'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const THEMES = [
  { value: 'light', label: 'Giao diện Sáng', icon: Sun },
  { value: 'dark', label: 'Giao diện Tối', icon: Moon },
  { value: 'system', label: 'Theo hệ thống', icon: Monitor },
] as const;

/**
 * Chuyển đổi giao diện Sáng / Tối / Hệ thống.
 * Đợi mounted ở client trước khi đọc resolvedTheme để tránh hydration mismatch.
 */
export function ThemeSwitch() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Đổi giao diện sáng/tối"
            className="size-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          />
        }
      >
        {mounted && resolvedTheme === 'dark' ? (
          <Moon className="size-4" />
        ) : (
          <Sun className="size-4" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {THEMES.map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem
              key={item.value}
              onClick={() => setTheme(item.value)}
              className="gap-2 text-xs cursor-pointer"
            >
              <Icon className="size-3.5 text-muted-foreground" />
              <span>{item.label}</span>
              {mounted && theme === item.value && <Check className="ms-auto size-3.5 text-foreground" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
