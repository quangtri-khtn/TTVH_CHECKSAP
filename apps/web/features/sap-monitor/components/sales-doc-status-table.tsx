'use client';

// Bảng Chứng từ treo theo từng bước (9 danh mục + dòng thứ 10 xem toàn bộ chuỗi PO) dùng shadcn Table + Badge ngữ nghĩa.
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
import type { SalesDocStatusCountsDto } from '@/lib/api/generated/model';
import {
  DOC_STATUS_META,
  type SalesDocStatusKey,
  formatSapCell,
} from '@/lib/sap-monitor/sales-monitor-domain';
import { SALES_CHAIN_QUERY_KEYS } from '@/lib/sap-monitor/sap-query-tag-map';
import { cn } from '@/lib/utils';
import { SapQueryTagBar } from './sap-query-tag-bar';
export interface SalesDocStatusTableProps {
  docStatusCounts: SalesDocStatusCountsDto | undefined;
  poCount: number | undefined;
  activeDocStatusKey: SalesDocStatusKey | null;
  onSelectDocStatus: (key: SalesDocStatusKey) => void;
  onSelectAllChain: () => void;
}

export function SalesDocStatusTable({
  docStatusCounts,
  poCount = 0,
  activeDocStatusKey,
  onSelectDocStatus,
  onSelectAllChain,
}: SalesDocStatusTableProps) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold text-foreground">
          Chứng từ treo theo từng bước – nhấp một dòng để xem danh sách bên dưới
        </h2>
        <SapQueryTagBar label="SQL:" queryKeys={SALES_CHAIN_QUERY_KEYS} />
      </div>

      <div className="overflow-hidden rounded-md border">
        <Table className="text-xs">
          <TableHeader className="bg-muted/60">
            <TableRow className="hover:bg-muted/60">
              <TableHead className="h-9 border-r px-3 py-2 text-left text-xs font-semibold text-foreground">
                Trạng thái
              </TableHead>
              <TableHead className="h-9 w-24 border-r px-3 py-2 text-center text-xs font-semibold text-foreground">
                Đơn vị
              </TableHead>
              <TableHead className="h-9 w-36 px-3 py-2 text-right text-xs font-semibold text-foreground">
                Số chứng từ
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {DOC_STATUS_META.map((item) => {
              const count = docStatusCounts?.[item.key] ?? 0;
              const isSelected = activeDocStatusKey === item.key;
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
                  onClick={() => onSelectDocStatus(item.key)}
                  className={cn(
                    'cursor-pointer transition-colors',
                    isSelected && 'bg-primary/8 hover:bg-primary/12',
                  )}
                >
                  <TableCell className={cn('border-r px-3 py-2 whitespace-normal', tone === 'danger' && 'font-medium')}>
                    {item.label}
                  </TableCell>
                  <TableCell className="border-r px-3 py-2 text-center">
                    <Badge variant="outline" className="font-mono text-[11px]">
                      {item.unit}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right tabular-nums">
                    {count > 0 && item.tag !== '' ? (
                      <Badge variant="outline" className={cn('font-mono tabular-nums', STATUS_TONE_CLASS[tone])}>
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
              onClick={onSelectAllChain}
              className="cursor-pointer bg-muted/40 font-semibold transition-colors hover:bg-muted/70"
            >
              <TableCell className="border-r px-3 py-2">
                Tổng số PO trong nhóm (xem toàn bộ chuỗi)
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
