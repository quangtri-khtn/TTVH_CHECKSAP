'use client';

import { Search as SearchIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useSearch } from './search-provider';

export function SearchButton({
  className,
  placeholder = 'Tìm kiếm',
}: {
  className?: string;
  placeholder?: string;
}) {
  const { setOpen } = useSearch();

  return (
    <Button
      variant="outline"
      aria-keyshortcuts="Meta+K Control+K"
      onClick={() => setOpen(true)}
      className={cn(
        'group relative h-8 w-full flex-1 justify-start rounded-md bg-muted/25 text-sm font-normal text-muted-foreground shadow-none hover:bg-accent sm:w-40 sm:pe-12 md:flex-none lg:w-52 xl:w-64',
        className,
      )}
    >
      <SearchIcon aria-hidden className="absolute inset-s-1.5 top-1/2 -translate-y-1/2" size={16} />
      <span className="ms-4">{placeholder}</span>
      <kbd className="pointer-events-none absolute inset-e-[0.3rem] top-[0.3rem] hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium group-hover:bg-accent sm:flex">
        <span className="text-xs">Ctrl</span>K
      </kbd>
    </Button>
  );
}
