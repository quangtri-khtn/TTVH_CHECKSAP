'use client';

// Hiển thị dải badge định danh câu truy vấn SAP (#01 · funnel .. #25 · old_sos_5).
// Nhấp vào bất kỳ badge nào sẽ mở trực tiếp câu truy vấn đó trong /admin/sap-queries?flow=...&key=...
import Link from 'next/link';
import { Database } from 'lucide-react';
import {
  SAP_QUERY_TAG_CATALOG,
  type SapQueryCatalogKey,
} from '@/lib/sap-monitor/sap-query-tag-map';
import { cn } from '@/lib/utils';

const GROUP_BADGE_CLASS: Record<'1A' | '1B' | '2A' | '2B', string> = {
  '1A': 'border-blue-500/35 bg-blue-500/10 text-blue-800 hover:bg-blue-500/20 dark:text-blue-200',
  '1B': 'border-indigo-500/35 bg-indigo-500/10 text-indigo-800 hover:bg-indigo-500/20 dark:text-indigo-200',
  '2A': 'border-cyan-500/35 bg-cyan-500/10 text-cyan-800 hover:bg-cyan-500/20 dark:text-cyan-200',
  '2B': 'border-amber-500/40 bg-amber-500/15 text-amber-900 hover:bg-amber-500/25 dark:text-amber-200',
};

export interface SapQueryTagBarProps {
  readonly queryKeys: readonly SapQueryCatalogKey[];
  readonly label?: string;
  readonly size?: 'xs' | 'sm';
  readonly className?: string;
}

export function SapQueryTagBar({
  queryKeys,
  label,
  size = 'xs',
  className,
}: SapQueryTagBarProps) {
  if (queryKeys.length === 0) return null;

  return (
    <div
      className={cn(
        'inline-flex flex-wrap items-center gap-1',
        className,
      )}
    >
      {label && (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
          <Database className="size-2.5 shrink-0" />
          <span>{label}</span>
        </span>
      )}
      {queryKeys.map((key) => {
        const meta = SAP_QUERY_TAG_CATALOG[key];
        if (!meta) return null;
        return (
          <Link
            key={meta.key}
            href={meta.href}
            onClick={(e) => {
              e.stopPropagation();
            }}
            title={`${meta.code} · ${meta.key} — ${meta.title} (Nhấp để mở trong Quản lý SQL)`}
            className={cn(
              'inline-flex items-center gap-1 rounded border font-mono leading-none font-medium transition-colors',
              size === 'xs'
                ? 'px-1.5 py-0.5 text-[10px]'
                : 'px-2 py-1 text-[11px]',
              GROUP_BADGE_CLASS[meta.groupCode],
            )}
          >
            <span className="font-semibold">{meta.code}</span>
            <span className="opacity-60">·</span>
            <span>{meta.key}</span>
          </Link>
        );
      })}
    </div>
  );
}
