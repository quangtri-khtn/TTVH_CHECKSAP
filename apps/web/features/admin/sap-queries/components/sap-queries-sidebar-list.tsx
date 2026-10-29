'use client';

import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  formatQueryOrderBadge,
  type SapQueryFlowCounts,
  type SapQueryFlowTab,
  type SapQueryStageGroup,
} from '@/lib/admin/sap-query-domain';
import { cn } from '@/lib/utils';

export interface SapQueriesSidebarListProps {
  activeFlow: SapQueryFlowTab;
  onFlowChange: (flow: SapQueryFlowTab) => void;
  search: string;
  onSearchChange: (value: string) => void;
  flowCounts: SapQueryFlowCounts;
  groups: readonly SapQueryStageGroup[];
  selectedKey: string;
  onSelectQuery: (key: string) => void;
  isLoading: boolean;
}

export function SapQueriesSidebarList({
  activeFlow,
  onFlowChange,
  search,
  onSearchChange,
  flowCounts,
  groups,
  selectedKey,
  onSelectQuery,
  isLoading,
}: SapQueriesSidebarListProps) {
  return (
    <aside className="flex w-full shrink-0 flex-col rounded-lg border bg-card shadow-xs lg:w-[320px]">
      <div className="space-y-2.5 border-b p-3">
        <Tabs
          value={activeFlow}
          onValueChange={(val) => {
            if (val === 'ban' || val === 'tra') {
              onFlowChange(val);
            }
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ban" className="text-xs">
              <span>Luồng Bán ({flowCounts.banTotal || 13})</span>
              {flowCounts.banCustomized > 0 && (
                <span
                  title={`${flowCounts.banCustomized} câu đã chỉnh sửa`}
                  className="ml-1 inline-block size-2 rounded-full bg-emerald-500"
                />
              )}
            </TabsTrigger>
            <TabsTrigger value="tra" className="text-xs">
              <span>Luồng Trả ({flowCounts.traTotal || 12})</span>
              {flowCounts.traCustomized > 0 && (
                <span
                  title={`${flowCounts.traCustomized} câu đã chỉnh sửa`}
                  className="ml-1 inline-block size-2 rounded-full bg-emerald-500"
                />
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm theo #01..#25, mã, tên câu..."
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      <div className="max-h-[680px] flex-1 space-y-4 overflow-y-auto p-2.5">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, idx) => (
              <Skeleton key={idx} className="h-14 w-full rounded-md" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Không tìm thấy câu truy vấn phù hợp.
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.stage} className="space-y-1.5">
              <div className="px-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold tracking-wide text-foreground uppercase">
                    {group.title} ({group.items.length} câu)
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {group.subtitle}
                </p>
              </div>

              <div className="space-y-1">
                {group.items.map((item) => {
                  const isSelected = item.key === selectedKey;
                  const cleanTitle = item.title.replace(/^#\d+\s*·\s*/, '');
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => onSelectQuery(item.key)}
                      className={cn(
                        'flex w-full flex-col gap-1 rounded-md border px-2.5 py-2 text-left transition-colors',
                        isSelected
                          ? 'border-primary bg-primary/8 text-foreground shadow-2xs'
                          : 'border-transparent hover:border-border hover:bg-muted/50',
                      )}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground">
                            {formatQueryOrderBadge(item.sortOrder)}
                          </span>
                          <span className="font-mono text-[11px] font-medium text-muted-foreground">
                            {item.key}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {item.isCustomized ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                              Đã sửa
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">
                              Gốc
                            </span>
                          )}
                          <Badge
                            variant="outline"
                            className="h-4 px-1.5 font-mono text-[10px]"
                          >
                            v{item.currentVersionNo}
                          </Badge>
                        </div>
                      </div>

                      <div className="line-clamp-2 text-xs font-medium text-foreground">
                        {cleanTitle}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
