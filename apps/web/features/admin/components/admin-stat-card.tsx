import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function AdminStatCard({
  label,
  value,
  isLoading,
  href,
  icon: Icon,
}: {
  label: string;
  value: number;
  isLoading: boolean;
  href: string;
  icon: LucideIcon;
}) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:bg-muted/50">
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            {isLoading ? <Skeleton className="mt-1 h-7 w-12" /> : <p className="text-2xl font-semibold">{value}</p>}
          </div>
          <Icon className="size-8 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
