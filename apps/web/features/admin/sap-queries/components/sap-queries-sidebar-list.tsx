'use client';

import { useState } from 'react';
import { Filter, Search, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  formatQueryOrderBadge,
  getStageVisualMeta,
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
  const [stageFilter, setStageFilter] = useState<string>('all');

  const validStageFilter = groups.some((g) => g.stage === stageFilter)
    ? stageFilter
    : 'all';
  const visibleGroups =
    validStageFilter === 'all'
      ? groups
      : groups.filter((g) => g.stage === validStageFilter);

  return (
    <aside className="flex w-full shrink-0 flex-col rounded-lg border bg-card shadow-xs lg:sticky lg:top-4 lg:w-[340px]">
      <div className="space-y-2.5 border-b p-3">
        <Tabs
          value={activeFlow}
          onValueChange={(val) => {
            if (val === 'ban' || val === 'tra') {
              setStageFilter('all');
              onFlowChange(val);
            }
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ban" className="text-xs font-semibold">
              <span>Luồng Bán ({flowCounts.banTotal || 13})</span>
              {flowCounts.banCustomized > 0 && (
                <span
                  title={`${flowCounts.banCustomized} câu đã chỉnh sửa`}
                  className="ml-1.5 inline-block size-2 rounded-full bg-emerald-500"
                />
              )}
            </TabsTrigger>
            <TabsTrigger value="tra" className="text-xs font-semibold">
              <span>Luồng Trả ({flowCounts.traTotal || 12})</span>
              {flowCounts.traCustomized > 0 && (
                <span
                  title={`${flowCounts.traCustomized} câu đã chỉnh sửa`}
                  className="ml-1.5 inline-block size-2 rounded-full bg-emerald-500"
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

        <div className="flex flex-wrap items-center gap-1 pt-0.5">
          <Filter className="mr-0.5 size-3.5 text-muted-foreground" />
          <button
            type="button"
            onClick={() => setStageFilter('all')}
            className={cn(
              'rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
              validStageFilter === 'all'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-muted/40 text-foreground hover:bg-muted',
            )}
          >
            Tất cả
          </button>
          {groups.map((group) => {
            const meta = getStageVisualMeta(group.stage);
            const isActive = validStageFilter === group.stage;
            return (
              <button
                key={group.stage}
                type="button"
                onClick={() =>
                  setStageFilter(isActive ? 'all' : group.stage)
                }
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : meta.badgeClass,
                )}
              >
                <span>{meta.shortLabel}</span>
                <span className="font-mono">({group.items.length})</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-h-[calc(100vh-220px)] min-h-[420px] flex-1 space-y-4 overflow-y-auto p-2.5">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, idx) => (
              <Skeleton key={idx} className="h-16 w-full rounded-md" />
            ))}
          </div>
        ) : visibleGroups.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Không tìm thấy câu truy vấn phù hợp.
          </div>
        ) : (
          visibleGroups.map((group) => {
            const stageMeta = getStageVisualMeta(group.stage);
            return (
              <div key={group.stage} className="space-y-2">
                <div className="rounded-md bg-muted/40 px-2 py-1.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-tight text-foreground">
                      <span
                        className={cn('size-2 rounded-full', stageMeta.dotClass)}
                      />
                      {group.title}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn('px-1.5 py-0 font-mono text-xs', stageMeta.badgeClass)}
                    >
                      {group.items.length} câu
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {group.subtitle}
                  </p>
                </div>

                <div className="space-y-1.5">
                  {group.items.map((item) => {
                    const isSelected = item.key === selectedKey;
                    const cleanTitle = item.title.replace(/^#\d+\s*·\s*/, '');
                    const leftAccentClass = item.isCustomized
                      ? 'border-l-emerald-600 dark:border-l-emerald-400'
                      : stageMeta.borderClass;

                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => onSelectQuery(item.key)}
                        className={cn(
                          'flex w-full flex-col gap-1.5 rounded-md border border-l-4 px-2.5 py-2 text-left transition-all',
                          leftAccentClass,
                          isSelected
                            ? 'border-primary bg-primary/10 text-foreground shadow-xs ring-1 ring-primary/30'
                            : 'border-border/60 bg-background hover:border-border hover:bg-muted/50',
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                'rounded border px-1.5 py-0.5 font-mono text-xs font-bold',
                                stageMeta.badgeClass,
                              )}
                            >
                              {formatQueryOrderBadge(item.sortOrder)}
                            </span>
                            <span className="font-mono text-xs font-semibold text-foreground">
                              {item.key}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1">
                            {item.supportsExtraColumns && (
                              <span
                                title="Cho phép thêm cột phụ tự động hiển thị ra UI/Excel"
                                className="inline-flex items-center gap-0.5 rounded border border-violet-500/40 bg-violet-500/10 px-1.5 py-0.5 text-xs font-medium text-violet-900 dark:text-violet-200"
                              >
                                <Sparkles className="size-3" />
                                +Passthrough
                              </span>
                            )}
                            {item.isCustomized ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                                <span className="size-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                                Đã sửa
                              </span>
                            ) : (
                              <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-xs font-medium text-foreground">
                                Gốc
                              </span>
                            )}
                            <Badge
                              variant="outline"
                              className="px-1.5 py-0 font-mono text-xs font-semibold text-foreground"
                            >
                              v{item.currentVersionNo}
                            </Badge>
                          </div>
                        </div>

                        <div className="line-clamp-2 text-xs font-medium leading-snug text-foreground">
                          {cleanTitle}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
