'use client';

// Bảng Trạng thái chuỗi chứng từ luồng trả (8 trạng thái từ RET_STATUS_ORDER + dòng thứ 9 Tổng số PO trả hàng).
// Nhấp một dòng sẽ lọc danh sách PO theo trạng thái đó và chuyển lưới về chế độ 'po'.
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { STATUS_TONE_CLASS, type StatusTone } from '@/lib/admin/status-tone';
import type { ReturnStatusCountsDto } from '@/lib/api/generated/model';
import {
  RET_STATUS_META,
  type ReturnViewMode,
  formatSapCell,
} from '@/lib/sap-monitor/return-monitor-domain';
import { cn } from '@/lib/utils';

export interface ReturnChainStatusTableProps {
  statusCounts: ReturnStatusCountsDto | undefined;
  poCount: number | undefined;
  viewMode: ReturnViewMode;
  statusFilter: string | null;
  onSelectStatus: (statusLabel: string) => void;
  onSelectAllChain: () => void;
}

export function ReturnChainStatusTable({
  statusCounts,
  poCount = 0,
  viewMode,
  statusFilter,
  onSelectStatus,
  onSelectAllChain,
}: ReturnChainStatusTableProps) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
      <h2 className="text-xs font-semibold text-foreground">
        Trạng thái chuỗi chứng từ – nhấp một dòng để lọc danh sách PO trả hàng bên dưới
      </h2>

      <div className="overflow-hidden rounded-md border">
        <Table className="text-xs">
          <TableHeader className="bg-muted/60">
            <TableRow className="hover:bg-muted/60">
              <TableHead className="h-9 border-r px-3 py-2 text-left text-xs font-semibold text-foreground">
                Trạng thái chuỗi chứng từ
              </TableHead>
              <TableHead className="h-9 w-24 border-r px-3 py-2 text-center text-xs font-semibold text-foreground">
                Đơn vị
              </TableHead>
              <TableHead className="h-9 w-36 px-3 py-2 text-right text-xs font-semibold text-foreground">
                Số PO
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {RET_STATUS_META.map((item) => {
              const count = statusCounts?.[item.key] ?? 0;
              const isSelected = viewMode === 'po' && statusFilter === item.label;
              const tone: StatusTone =
                count > 0 && item.tag === 'attn'
                  ? 'danger'
                  : count > 0 && item.tag === 'normal'
                    ? 'info'
                    : 'neutral';

              return (
                <TableRow
                  key={item.key}
                  data-state={isSelected ? 'selected' : undefined}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectStatus(item.label)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectStatus(item.label);
                    }
                  }}
                  className={cn(
                    'cursor-pointer transition-colors',
                    isSelected && 'bg-primary/8 hover:bg-primary/12',
                  )}
                >
                  <TableCell
                    className={cn(
                      'border-r px-3 py-2 whitespace-normal',
                      tone === 'danger' && 'font-medium',
                    )}
                  >
                    {item.label}
                  </TableCell>
                  <TableCell className="border-r px-3 py-2 text-center">
                    <Badge variant="outline" className="font-mono text-[11px]">
                      {item.unit}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right tabular-nums">
                    {count > 0 && item.tag !== '' ? (
                      <Badge
                        variant="outline"
                        className={cn('font-mono tabular-nums', STATUS_TONE_CLASS[tone])}
                      >
                        {formatSapCell(count)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">{formatSapCell(count)}</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}

            <TableRow
              role="button"
              tabIndex={0}
              onClick={onSelectAllChain}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectAllChain();
                }
              }}
              className="cursor-pointer bg-muted/40 font-semibold transition-colors hover:bg-muted/70"
            >
              <TableCell className="border-r px-3 py-2">
                Tổng số PO trả hàng (xem toàn bộ chuỗi)
              </TableCell>
              <TableCell className="border-r px-3 py-2 text-center">
                <Badge variant="outline" className="font-mono text-[11px]">
                  PO
                </Badge>
              </TableCell>
              <TableCell className="px-3 py-2 text-right font-mono tabular-nums">
                {formatSapCell(poCount)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
