import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Paired with ApiResponseDto (src/common/dto/api-response.dto.ts) — if this
// wrapping shape ever changes, that DTO (and every subclass) must change with
// it, or the documented OpenAPI schema silently stops matching the wire.
//
// List services return { data: T[], meta: PaginationMetaDto } to match the
// flat `{ statusCode, data, meta }` shape their *ListResponseDto declares.
function isPaginatedShape(value: unknown): value is { data: unknown; meta: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    Array.isArray((value as Record<string, unknown>).data) &&
    'meta' in value &&
    typeof (value as Record<string, unknown>).meta === 'object'
  );
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  { statusCode: number; data: T }
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<{ statusCode: number; data: T }> {
    const statusCode = context.switchToHttp().getResponse().statusCode;
    return next.handle().pipe(
      map((result) =>
        isPaginatedShape(result)
          ? ({ statusCode, ...result } as { statusCode: number; data: T })
          : { statusCode, data: result },
      ),
    );
  }
}
