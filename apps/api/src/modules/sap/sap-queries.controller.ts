// REST Controller quản trị 25 câu truy vấn SAP HANA (/sap/queries).
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type AuthUser,
  CurrentUser,
} from '../access-control/decorators/current-user.decorator';
import { RequirePermissions } from '../access-control/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../access-control/permission-catalog';
import {
  PublishSapQueryRequestDto,
  ResetSapQueryRequestDto,
  ReviewSapQueryRequestDto,
  ReviewSapQueryResponseDto,
  RollbackSapQueryRequestDto,
  SapQueryDetailResponseDto,
  SapQueryListResponseDto,
} from './dto/sap-query-config.dto';
import { SapQueryConfigService } from './services/sap-query-config.service';

@ApiTags('SAP Queries')
@ApiBearerAuth()
@Controller('sap/queries')
@RequirePermissions(PERMISSIONS.SAP_QUERY_MANAGE)
export class SapQueriesController {
  constructor(private readonly queryConfigService: SapQueryConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách 25 câu truy vấn SAP HANA chia theo 2 Tab (Luồng Bán & Luồng Trả)',
    operationId: 'sapQueriesList',
  })
  @ApiOkResponse({ type: SapQueryListResponseDto })
  async findAll() {
    return this.queryConfigService.findAll();
  }

  @Get(':key')
  @ApiOperation({
    summary: 'Lấy chi tiết câu truy vấn SAP kèm lịch sử phiên bản và nhật ký audit',
    operationId: 'sapQueriesGetDetail',
  })
  @ApiOkResponse({ type: SapQueryDetailResponseDto })
  async findOne(@Param('key') key: string) {
    return this.queryConfigService.findOne(key);
  }

  @Post(':key/review')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Kiểm tra tĩnh 4 bước và chạy thử đối chiếu Hợp đồng Cột với câu gốc (Review & Validate)',
    operationId: 'sapQueriesReview',
  })
  @ApiOkResponse({ type: ReviewSapQueryResponseDto })
  async review(
    @Param('key') key: string,
    @Body() dto: ReviewSapQueryRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.queryConfigService.review(key, dto, user);
  }

  @Post(':key/publish')
  @ApiOperation({
    summary: 'Xuất bản phiên bản mới cho câu truy vấn SAP sau khi đã vượt qua Review & Validate',
    operationId: 'sapQueriesPublish',
  })
  @ApiOkResponse({ type: SapQueryDetailResponseDto })
  async publish(
    @Param('key') key: string,
    @Body() dto: PublishSapQueryRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.queryConfigService.publish(key, dto, user);
  }

  @Post(':key/rollback')
  @ApiOperation({
    summary: 'Hoàn tác câu truy vấn SAP về một phiên bản trước đó (append-only)',
    operationId: 'sapQueriesRollback',
  })
  @ApiOkResponse({ type: SapQueryDetailResponseDto })
  async rollback(
    @Param('key') key: string,
    @Body() dto: RollbackSapQueryRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.queryConfigService.rollback(key, dto, user);
  }

  @Post(':key/reset-default')
  @ApiOperation({
    summary: 'Khôi phục câu truy vấn SAP về bản gốc chuẩn Seed v1 (append-only)',
    operationId: 'sapQueriesResetDefault',
  })
  @ApiOkResponse({ type: SapQueryDetailResponseDto })
  async resetDefault(
    @Param('key') key: string,
    @Body() dto: ResetSapQueryRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.queryConfigService.resetDefault(key, dto, user);
  }
}
