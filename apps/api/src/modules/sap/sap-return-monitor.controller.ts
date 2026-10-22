// Controller mỏng cho các endpoint dưới /sap/return-monitor: lấy dữ liệu JSON, xuất Excel chi tiết 3 sheets và xuất Excel lưới đang xem.
import { Controller, Get, Query, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { RequirePermissions } from '../access-control/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../access-control/permission-catalog';
import { ExportReturnMonitorGridQueryDto } from './dto/return-monitor-export-grid.dto';
import { GetReturnMonitorQueryDto } from './dto/return-monitor-query.dto';
import {
  ReturnMonitorDataDto,
  ReturnMonitorResponseDto,
} from './dto/return-monitor-response.dto';
import { SapReturnMonitorExcelService } from './services/sap-return-monitor-excel.service';
import { SapReturnMonitorService } from './services/sap-return-monitor.service';

@ApiTags('SAP Monitor')
@ApiBearerAuth()
@Controller('sap/return-monitor')
export class SapReturnMonitorController {
  constructor(
    private readonly service: SapReturnMonitorService,
    private readonly excelService: SapReturnMonitorExcelService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SAP_MONITOR_READ)
  @ApiOperation({
    summary: 'Lấy dữ liệu Monitor Luồng Trả',
    operationId: 'sapReturnMonitorGetData',
  })
  @ApiOkResponse({
    description:
      'Dữ liệu Monitor Luồng Trả hoàn chỉnh gồm 4 phần: meta, summary, cohorts, lists',
    type: ReturnMonitorResponseDto,
  })
  getData(@Query() query: GetReturnMonitorQueryDto): Promise<ReturnMonitorDataDto> {
    return this.service.getReturnMonitor(query);
  }

  @Get('export')
  @RequirePermissions(PERMISSIONS.SAP_MONITOR_READ)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiExcludeEndpoint()
  async exportDetail(
    @Query() query: GetReturnMonitorQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.excelService.exportDetailWorkbook(query);
    this.sendExcelBuffer(res, filename, buffer);
  }

  @Get('export-grid')
  @RequirePermissions(PERMISSIONS.SAP_MONITOR_READ)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiExcludeEndpoint()
  async exportGrid(
    @Query() query: ExportReturnMonitorGridQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.excelService.exportGridWorkbook(query);
    this.sendExcelBuffer(res, filename, buffer);
  }

  private sendExcelBuffer(res: Response, filename: string, buffer: Buffer): void {
    const asciiFallback = filename.replace(/[^A-Za-z0-9._-]/g, '_');
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.end(buffer);
  }
}
